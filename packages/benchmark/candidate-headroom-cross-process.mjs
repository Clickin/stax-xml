import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const candidateHarnessPath = join(__dirname, 'candidate-headroom-large.mjs');
const defaultJsonOut = join(__dirname, 'results', 'release', 'candidate-headroom-cross-process-projection.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'candidate-headroom-cross-process-projection.md');
const defaultOutputDir = join(__dirname, 'results', 'cross-process', 'candidate-headroom-projection');
const defaultCorpusFile = resolve(__dirname, '../stax-xml/performance/samples/treebank_e.xml');
const defaultCases = [
  'stringFull',
  'eventObjectFull',
  'rawFrameNameId',
  'projectionLowSelectivity',
  'projectionHighSelectivity',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    runtimes: ['node'],
    processRuns: 3,
    childWarmups: 0,
    sizeGiB: 1,
    fixtureShape: 'projection-cycle',
    diverseCycleSize: 4096,
    corpusFile: defaultCorpusFile,
    batchSize: 16,
    boundedRssMiB: 512,
    cases: [...defaultCases],
    outputDir: defaultOutputDir,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || arg === '--') continue;
    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${arg} requires a value.`);
      index++;
      return value;
    };

    switch (name) {
      case '--runtimes':
        options.runtimes = parseList(readValue(), '--runtimes');
        break;
      case '--process-runs':
        options.processRuns = parsePositiveInteger(readValue(), '--process-runs');
        break;
      case '--child-warmups':
        options.childWarmups = parseNonNegativeInteger(readValue(), '--child-warmups');
        break;
      case '--size-gib':
        options.sizeGiB = parsePositiveNumber(readValue(), '--size-gib');
        break;
      case '--fixture-shape':
        options.fixtureShape = readValue();
        break;
      case '--diverse-cycle-size':
        options.diverseCycleSize = parsePositiveInteger(readValue(), '--diverse-cycle-size');
        break;
      case '--corpus-file':
        options.corpusFile = resolve(process.cwd(), readValue());
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), '--batch-size');
        break;
      case '--bounded-rss-mib':
        options.boundedRssMiB = parsePositiveNumber(readValue(), '--bounded-rss-mib');
        break;
      case '--cases':
        options.cases = parseList(readValue(), '--cases');
        break;
      case '--output-dir':
        options.outputDir = resolve(process.cwd(), readValue());
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!['repeated-person', 'diverse-cycle', 'corpus-cycle', 'projection-cycle'].includes(options.fixtureShape)) {
    throw new Error('--fixture-shape must be one of repeated-person, diverse-cycle, corpus-cycle, projection-cycle.');
  }
  for (const runtime of options.runtimes) {
    if (runtime !== 'node' && runtime !== 'bun') {
      throw new Error(`--runtimes currently supports node,bun. Received: ${runtime}`);
    }
  }
  return options;
}

function parseList(value, flag) {
  const parsed = value.split(',').map(entry => entry.trim()).filter(Boolean);
  if (parsed.length === 0) {
    throw new Error(`${flag} must contain at least one value.`);
  }
  return parsed;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
}

function parseNonNegativeInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${flag} must be a non-negative integer.`);
  return parsed;
}

function parsePositiveNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive number.`);
  return parsed;
}

function main() {
  const options = parseArgs();
  const samples = [];
  mkdirSync(options.outputDir, { recursive: true });

  for (const runtime of options.runtimes) {
    for (let runIndex = 0; runIndex < options.processRuns; runIndex++) {
      samples.push(runChildProcess(runtime, runIndex, options));
    }
  }

  const report = createReport(options, samples);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function runChildProcess(runtime, runIndex, options) {
  const childJsonOut = join(options.outputDir, `${runtime}-run-${runIndex + 1}.json`);
  const childMdOut = join(options.outputDir, `${runtime}-run-${runIndex + 1}.md`);
  const { command, args } = runtimeCommand(runtime, options, childJsonOut, childMdOut);
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw new Error(`${runtime} run ${runIndex + 1} failed to spawn: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${runtime} run ${runIndex + 1} failed with exit ${result.status}:\n${trimSpawnOutput(result)}`);
  }

  const childReport = JSON.parse(readFileSync(childJsonOut, 'utf8'));
  return {
    runtime,
    runIndex: runIndex + 1,
    startedAt,
    jsonPath: childJsonOut,
    mdPath: childMdOut,
    stdout: String(result.stdout ?? '').trim(),
    stderr: String(result.stderr ?? '').trim(),
    report: childReport,
  };
}

function runtimeCommand(runtime, options, jsonOut, mdOut) {
  const args = [
    candidateHarnessPath,
    '--size-gib',
    String(options.sizeGiB),
    '--fixture-shape',
    options.fixtureShape,
    '--diverse-cycle-size',
    String(options.diverseCycleSize),
    '--corpus-file',
    options.corpusFile,
    '--batch-size',
    String(options.batchSize),
    '--bounded-rss-mib',
    String(options.boundedRssMiB),
    '--runs',
    '1',
    '--warmups',
    String(options.childWarmups),
    '--cases',
    options.cases.join(','),
    '--json-out',
    jsonOut,
    '--md-out',
    mdOut,
  ];

  if (runtime === 'node') {
    return {
      command: process.execPath,
      args: ['--expose-gc', ...args],
    };
  }
  if (runtime === 'bun') {
    return {
      command: 'bun',
      args,
    };
  }
  throw new Error(`Unknown runtime: ${runtime}`);
}

function trimSpawnOutput(result) {
  return String(result.stderr ?? '').trim() || String(result.stdout ?? '').trim();
}

function createReport(options, samples) {
  const grouped = groupBy(samples, sample => sample.runtime);
  const runtimeReports = [...grouped.entries()].map(([runtime, runtimeSamples]) => {
    const first = runtimeSamples[0].report;
    return {
      runtime,
      environment: first.environment,
      sampleCount: runtimeSamples.length,
      fixture: first.fixture,
      childReports: runtimeSamples.map(sample => createChildSummary(sample)),
      parity: summarizeParity(runtimeSamples),
      variants: options.cases.map(caseId => summarizeVariant(caseId, runtimeSamples)),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    objective: 'candidate-headroom-cross-process',
    contract: 'independent-process-candidate-headroom-stability',
    note: 'Each sample invokes candidate-headroom-large.mjs in a fresh process with --runs=1. Projection rows report projected records, not full StAX parity.',
    options: {
      runtimes: options.runtimes,
      processRuns: options.processRuns,
      childWarmups: options.childWarmups,
      sizeGiB: options.sizeGiB,
      fixtureShape: options.fixtureShape,
      diverseCycleSize: options.diverseCycleSize,
      batchSize: options.batchSize,
      boundedRssMiB: options.boundedRssMiB,
      cases: options.cases,
    },
    rawArtifacts: {
      outputDir: options.outputDir,
      committed: false,
    },
    runtimes: runtimeReports,
    findings: createFindings(runtimeReports),
  };
}

function createChildSummary(sample) {
  return {
    runIndex: sample.runIndex,
    jsonPath: sample.jsonPath,
    mdPath: sample.mdPath,
    environment: sample.report.environment,
    variants: sample.report.variants.map(entry => ({
      id: entry.id,
      mibPerSec: entry.mibPerSec,
      eventCount: entry.eventCount,
      checksum: entry.checksum,
      eventCountKind: entry.eventCountKind,
      fullStringParity: entry.fullStringParity,
      boundedMemory: entry.boundedMemory,
      counterexampleStatus: entry.counterexampleStatus,
      maxRssBytes: entry.memory.maxRssBytes,
      maxHeapUsedBytes: entry.memory.maxHeapUsedBytes,
      materializationCounters: entry.materializationCounters,
    })),
  };
}

function summarizeParity(samples) {
  const fullRows = new Map();
  const projectionRows = new Map();

  for (const sample of samples) {
    for (const variant of sample.report.variants) {
      const target = variant.eventCountKind === 'projected-records' ? projectionRows : fullRows;
      const values = target.get(variant.id) ?? [];
      values.push({ eventCount: variant.eventCount, checksum: variant.checksum });
      target.set(variant.id, values);
    }
  }

  return {
    streamAndFullRowsStable: [...fullRows.values()].every(values => uniquePairs(values).length === 1),
    projectionRowsStable: [...projectionRows.values()].every(values => uniquePairs(values).length === 1),
    streamAndFullRowIds: [...fullRows.keys()],
    projectionRowIds: [...projectionRows.keys()],
  };
}

function summarizeVariant(caseId, samples) {
  const rows = samples.map((sample) => {
    const row = sample.report.variants.find(entry => entry.id === caseId);
    if (!row) {
      throw new Error(`Missing case ${caseId} in ${sample.runtime} run ${sample.runIndex}.`);
    }
    return row;
  });
  const mibPerSecSamples = rows.map(row => row.mibPerSec);
  const eventCounts = uniqueNumbers(rows.map(row => row.eventCount));
  const checksums = uniqueNumbers(rows.map(row => row.checksum));
  const avgMiBPerSec = average(mibPerSecSamples);
  const minMiBPerSec = Math.min(...mibPerSecSamples);
  const maxMiBPerSec = Math.max(...mibPerSecSamples);
  const maxRssBytes = Math.max(...rows.map(row => row.memory.maxRssBytes));
  const maxHeapUsedBytes = Math.max(...rows.map(row => row.memory.maxHeapUsedBytes));
  return {
    id: caseId,
    family: rows[0].family,
    contractScope: rows[0].contractScope,
    eventCountKind: rows[0].eventCountKind,
    fullStringParity: rows[0].fullStringParity,
    sampleCount: rows.length,
    avgMiBPerSec,
    minMiBPerSec,
    maxMiBPerSec,
    spreadRatio: avgMiBPerSec > 0 ? (maxMiBPerSec - minMiBPerSec) / avgMiBPerSec : 0,
    mibPerSecSamples,
    eventCounts,
    checksums,
    stableResult: eventCounts.length === 1 && checksums.length === 1,
    boundedMemoryAll: rows.every(row => row.boundedMemory),
    maxRssBytes,
    maxHeapUsedBytes,
    counterexampleFound: rows.some(row => row.counterexampleStatus === 'found'),
  };
}

function createFindings(runtimeReports) {
  const findings = [
    {
      id: 'independent-process-rerun',
      classification: 'BENCH_FACT',
      summary: 'Each sample was measured by a separate runtime process, unlike same-process runs-based timing stability.',
      evidence: runtimeReports.map(report => `${report.runtime}: processRuns=${report.sampleCount}`),
    },
    {
      id: 'projection-contract-separated',
      classification: 'BENCH_FACT',
      summary: 'Projection rows are reported as selected-field projected records and are not full StAX event-parity rows.',
      evidence: runtimeReports.flatMap(report => report.parity.projectionRowIds.map(id => `${report.runtime}: ${id}`)),
    },
  ];

  const foundCounterexamples = runtimeReports.flatMap(report =>
    report.variants
      .filter(row => row.fullStringParity && row.counterexampleFound)
      .map(row => `${report.runtime}: ${row.id} avg=${formatRate(row.avgMiBPerSec)}`),
  );
  findings.push({
    id: 'full-stax-counterexample-search',
    classification: 'BENCH_FACT',
    summary: foundCounterexamples.length > 0
      ? 'At least one full-string row reported a 200 MiB/s bounded-memory counterexample in an independent process sample.'
      : 'No full-string row reported a 200 MiB/s bounded-memory counterexample in these independent process samples.',
    evidence: foundCounterexamples.length > 0 ? foundCounterexamples : ['counterexample=not-found'],
  });

  return findings;
}

function renderMarkdown(report) {
  const lines = [
    '# Candidate Headroom Cross-Process Stability',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report repeats the selected candidate-headroom rows in fresh runtime processes.',
    'It is cross-process timing evidence for the recorded machine, not a proof that JavaScript runtimes have no further headroom.',
    'Projection rows report projected record counts and selected-field checksums; they are not full StAX parity rows.',
    '',
    '## Options',
    '',
    `- Runtimes: ${report.options.runtimes.join(', ')}`,
    `- Process runs: ${report.options.processRuns}`,
    `- Child warmups: ${report.options.childWarmups}`,
    `- Fixture shape: ${report.options.fixtureShape}`,
    `- Size GiB: ${report.options.sizeGiB}`,
    `- Diverse cycle size: ${report.options.diverseCycleSize}`,
    `- Batch size: ${report.options.batchSize}`,
    `- Bounded RSS gate: ${report.options.boundedRssMiB.toFixed(1)} MiB`,
    `- Cases: ${report.options.cases.join(', ')}`,
    '',
    '## Raw Artifacts',
    '',
    `- Output dir: ${report.rawArtifacts.outputDir}`,
    `- Committed: ${report.rawArtifacts.committed ? 'yes' : 'no'}`,
    '',
  ];

  for (const runtime of report.runtimes) {
    lines.push(`## Runtime: ${runtime.runtime}`);
    lines.push('');
    lines.push(`- Engine: ${runtime.environment.javascriptEngine}`);
    lines.push(`- Node: ${runtime.environment.node}`);
    if (runtime.environment.bunVersion) lines.push(`- Bun: ${runtime.environment.bunVersion}`);
    if (runtime.environment.webkitCommit) lines.push(`- WebKit: ${runtime.environment.webkitCommit}`);
    lines.push(`- Platform: ${runtime.environment.platform}`);
    lines.push(`- CPU: ${runtime.environment.cpuName}`);
    lines.push(`- Fixture bytes: ${runtime.fixture.actualBytes}`);
    lines.push('');
    lines.push('| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |');
    lines.push('| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |');
    for (const row of runtime.variants) {
      lines.push(
        `| ${row.id} | ${row.eventCountKind} | ${formatRate(row.avgMiBPerSec)} | ${formatRate(row.minMiBPerSec)} | `
        + `${formatRate(row.maxMiBPerSec)} | ${formatPercent(row.spreadRatio)} | ${formatSamples(row.mibPerSecSamples)} | `
        + `${row.stableResult ? 'yes' : 'no'} | ${row.boundedMemoryAll ? 'yes' : 'no'} | `
        + `${row.counterexampleFound ? 'found' : 'not-found'} | ${formatBytes(row.maxRssBytes)} |`,
      );
    }
    lines.push('');
    lines.push('### Parity');
    lines.push('');
    lines.push(`- Stream/full rows stable across processes: ${runtime.parity.streamAndFullRowsStable ? 'yes' : 'no'}`);
    lines.push(`- Stream/full rows: ${runtime.parity.streamAndFullRowIds.join(', ') || 'n/a'}`);
    lines.push(`- Projection rows stable across processes: ${runtime.parity.projectionRowsStable ? 'yes' : 'no'}`);
    lines.push(`- Projection rows: ${runtime.parity.projectionRowIds.join(', ') || 'n/a'}`);
    lines.push('');
  }

  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function printSummary(report) {
  console.log('Candidate headroom cross-process stability');
  for (const runtime of report.runtimes) {
    console.log(`${runtime.runtime}: samples=${runtime.sampleCount}`);
    for (const row of runtime.variants) {
      console.log(`${row.id.padEnd(28)} avg=${formatRate(row.avgMiBPerSec)} spread=${formatPercent(row.spreadRatio)} counterexample=${row.counterexampleFound ? 'found' : 'not-found'}`);
    }
  }
}

function groupBy(values, keyFn) {
  const grouped = new Map();
  for (const value of values) {
    const key = keyFn(value);
    const bucket = grouped.get(key) ?? [];
    bucket.push(value);
    grouped.set(key, bucket);
  }
  return grouped;
}

function uniquePairs(values) {
  return [...new Set(values.map(value => `${value.eventCount}:${value.checksum}`))];
}

function uniqueNumbers(values) {
  return [...new Set(values)];
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatRate(value) {
  return `${value.toFixed(2)} MiB/s`;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatSamples(values) {
  return values.map(value => value.toFixed(2)).join(', ');
}

function formatBytes(value) {
  if (Math.abs(value) >= MIB) {
    return `${(value / MIB).toFixed(1)} MiB`;
  }
  if (Math.abs(value) >= 1024) {
    return `${(value / 1024).toFixed(1)} KiB`;
  }
  return `${value} B`;
}

function writeOutput(path, content) {
  const resolved = resolve(process.cwd(), path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content, 'utf8');
  console.log(`Wrote ${resolved}`);
}

main();
