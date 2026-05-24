import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const byteBatchHarnessPath = join(__dirname, 'event-reader-byte-batch.mjs');
const defaultJsonOut = join(__dirname, 'results', 'release', 'event-reader-byte-batch-cross-process-corpus.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'event-reader-byte-batch-cross-process-corpus.md');
const defaultOutputDir = join(__dirname, 'results', 'cross-process', 'event-reader-byte-batch-corpus');
const defaultCorpusFile = join(__dirname, 'assets', 'books.xml');
const defaultVariants = ['readableStreamBatch16', 'asyncByteBatch16', 'syncIterableBatch16'];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    runtimes: ['node'],
    processRuns: 3,
    childWarmups: 0,
    sizeGiB: 1,
    fixtureShape: 'corpus-cycle',
    corpusFile: defaultCorpusFile,
    corpusChunkKiB: 64,
    diverseCycleSize: 4096,
    batchSize: 16,
    boundedRssMiB: 512,
    variants: [...defaultVariants],
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
        options.runtimes = parseList(readValue(), name);
        break;
      case '--process-runs':
        options.processRuns = parsePositiveInteger(readValue(), name);
        break;
      case '--child-warmups':
        options.childWarmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--size-gib':
        options.sizeGiB = parsePositiveNumber(readValue(), name);
        break;
      case '--fixture-shape':
        options.fixtureShape = parseFixtureShape(readValue(), name);
        break;
      case '--corpus-file':
        options.corpusFile = resolve(process.cwd(), readValue());
        break;
      case '--corpus-chunk-kib':
        options.corpusChunkKiB = parsePositiveInteger(readValue(), name);
        break;
      case '--diverse-cycle-size':
        options.diverseCycleSize = parsePositiveInteger(readValue(), name);
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), name);
        break;
      case '--bounded-rss-mib':
        options.boundedRssMiB = parsePositiveNumber(readValue(), name);
        break;
      case '--variants':
        options.variants = parseList(readValue(), name);
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

  for (const runtime of options.runtimes) {
    if (runtime !== 'node' && runtime !== 'bun' && runtime !== 'deno') {
      throw new Error(`--runtimes currently supports node,bun,deno. Received: ${runtime}`);
    }
  }
  return options;
}

function parseList(value, flag) {
  const parsed = value.split(',').map(entry => entry.trim()).filter(Boolean);
  if (parsed.length === 0) throw new Error(`${flag} must contain at least one value.`);
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

function parseFixtureShape(value, flag) {
  if (value === 'diverse-cycle' || value === 'corpus-cycle') return value;
  throw new Error(`${flag} must be diverse-cycle or corpus-cycle.`);
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

  return {
    runtime,
    runIndex: runIndex + 1,
    startedAt,
    jsonPath: childJsonOut,
    mdPath: childMdOut,
    stdout: String(result.stdout ?? '').trim(),
    stderr: String(result.stderr ?? '').trim(),
    report: JSON.parse(readFileSync(childJsonOut, 'utf8')),
  };
}

function runtimeCommand(runtime, options, jsonOut, mdOut) {
  const args = [
    byteBatchHarnessPath,
    '--size-gib',
    String(options.sizeGiB),
    '--fixture-shape',
    options.fixtureShape,
    '--corpus-file',
    options.corpusFile,
    '--corpus-chunk-kib',
    String(options.corpusChunkKiB),
    '--diverse-cycle-size',
    String(options.diverseCycleSize),
    '--batch-sizes',
    String(options.batchSize),
    '--bounded-rss-mib',
    String(options.boundedRssMiB),
    '--runs',
    '1',
    '--warmups',
    String(options.childWarmups),
    '--runtime-label',
    runtimeLabel(runtime),
    '--json-out',
    jsonOut,
    '--md-out',
    mdOut,
  ];

  if (runtime === 'node') return { command: process.execPath, args: ['--expose-gc', ...args] };
  if (runtime === 'bun') return { command: 'bun', args };
  if (runtime === 'deno') {
    return {
      command: 'deno',
      args: [
        'run',
        '--allow-read',
        '--allow-env',
        '--allow-sys',
        `--allow-write=${options.outputDir}`,
        ...args,
      ],
    };
  }
  throw new Error(`Unknown runtime: ${runtime}`);
}

function runtimeLabel(runtime) {
  if (runtime === 'node') return 'Node/V8';
  if (runtime === 'bun') return 'Bun/JSC';
  if (runtime === 'deno') return 'Deno/V8';
  return runtime;
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
      parity: summarizeParity(runtimeSamples, options.variants),
      variants: options.variants.map(variantId => summarizeVariant(variantId, runtimeSamples)),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    objective: 'event-reader-byte-batch-cross-process',
    contract: 'independent-process-public-event-object-full-string-checksum',
    note: 'Each sample invokes event-reader-byte-batch.mjs in a fresh process with --runs=1. All selected rows preserve the public event-object full-string checksum contract and demand-driven source consumption.',
    options: {
      runtimes: options.runtimes,
      processRuns: options.processRuns,
      childWarmups: options.childWarmups,
      sizeGiB: options.sizeGiB,
      fixtureShape: options.fixtureShape,
      corpusFile: options.corpusFile,
      corpusChunkKiB: options.corpusChunkKiB,
      diverseCycleSize: options.diverseCycleSize,
      batchSize: options.batchSize,
      boundedRssMiB: options.boundedRssMiB,
      variants: options.variants,
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
      family: entry.family,
      mibPerSec: entry.mibPerSec,
      eventCount: entry.eventCount,
      checksum: entry.checksum,
      sourceReads: entry.sourceReads,
      sourceBatches: entry.sourceBatches,
      fullStringParity: entry.fullStringParity,
      boundedMemory: entry.boundedMemory,
      maxRssBytes: entry.memory.maxRssBytes,
      maxHeapUsedBytes: entry.memory.maxHeapUsedBytes,
    })),
  };
}

function summarizeParity(samples, variantIds) {
  const rows = new Map();
  for (const sample of samples) {
    for (const variantId of variantIds) {
      const row = findVariant(sample, variantId);
      const values = rows.get(variantId) ?? [];
      values.push({ eventCount: row.eventCount, checksum: row.checksum });
      rows.set(variantId, values);
    }
  }
  return {
    fullRowsStable: [...rows.values()].every(values => uniquePairs(values).length === 1),
    rowIds: [...rows.keys()],
  };
}

function summarizeVariant(variantId, samples) {
  const rows = samples.map(sample => findVariant(sample, variantId));
  const mibPerSecSamples = rows.map(row => row.mibPerSec);
  const avgMiBPerSec = average(mibPerSecSamples);
  const minMiBPerSec = Math.min(...mibPerSecSamples);
  const maxMiBPerSec = Math.max(...mibPerSecSamples);
  const eventCounts = uniqueNumbers(rows.map(row => row.eventCount));
  const checksums = uniqueNumbers(rows.map(row => row.checksum));
  const sourceReads = uniqueNumbers(rows.map(row => row.sourceReads));
  const sourceBatches = uniqueNumbers(rows.map(row => row.sourceBatches));
  return {
    id: variantId,
    family: rows[0].family,
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
    sourceReads,
    sourceBatches,
    stableResult: eventCounts.length === 1 && checksums.length === 1,
    boundedMemoryAll: rows.every(row => row.boundedMemory),
    maxRssBytes: Math.max(...rows.map(row => row.memory.maxRssBytes)),
    maxHeapUsedBytes: Math.max(...rows.map(row => row.memory.maxHeapUsedBytes)),
    counterexampleFound: rows.some(row => row.fullStringParity && row.boundedMemory && row.mibPerSec >= 200),
  };
}

function findVariant(sample, variantId) {
  const row = sample.report.variants.find(entry => entry.id === variantId);
  if (!row) throw new Error(`Missing variant ${variantId} in ${sample.runtime} run ${sample.runIndex}.`);
  return row;
}

function createFindings(runtimeReports) {
  const syncRows = runtimeReports.flatMap(report =>
    report.variants
      .filter(row => row.id.startsWith('syncIterableBatch'))
      .map(row => `${report.runtime}: ${row.id} avg=${formatRate(row.avgMiBPerSec)} spread=${formatPercent(row.spreadRatio)}`),
  );
  const foundCounterexamples = runtimeReports.flatMap(report =>
    report.variants
      .filter(row => row.counterexampleFound)
      .map(row => `${report.runtime}: ${row.id} avg=${formatRate(row.avgMiBPerSec)}`),
  );
  return [
    {
      id: 'independent-process-rerun',
      classification: 'BENCH_FACT',
      summary: 'Each sample was measured by a separate runtime process.',
      evidence: runtimeReports.map(report => `${report.runtime}: processRuns=${report.sampleCount}`),
    },
    {
      id: 'sync-iterable-source-headroom',
      classification: 'BENCH_FACT',
      summary: 'Sync iterable byte batches isolate async source overhead while keeping the same public event-object checksum contract.',
      evidence: syncRows,
    },
    {
      id: 'full-stax-counterexample-search',
      classification: 'BENCH_FACT',
      summary: foundCounterexamples.length > 0
        ? 'At least one selected row reported a 200 MiB/s bounded-memory counterexample in a fresh process sample.'
        : 'No selected row reported a 200 MiB/s bounded-memory counterexample in these fresh process samples.',
      evidence: foundCounterexamples.length > 0 ? foundCounterexamples : ['counterexample=not-found'],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# EventReader Byte-Batch Cross-Process Stability',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report repeats selected EventReader byte-batch source rows in fresh runtime processes.',
    'All selected rows preserve the public event-object full-string checksum contract and demand-driven source consumption.',
    'It is cross-process timing evidence for the recorded machine, not a proof that JavaScript runtimes have no further headroom.',
    '',
    '## Options',
    '',
    `- Runtimes: ${report.options.runtimes.join(', ')}`,
    `- Process runs: ${report.options.processRuns}`,
    `- Child warmups: ${report.options.childWarmups}`,
    `- Fixture shape: ${report.options.fixtureShape}`,
    `- Corpus file: ${report.options.corpusFile}`,
    `- Corpus chunk: ${report.options.corpusChunkKiB} KiB`,
    `- Size GiB: ${report.options.sizeGiB}`,
    `- Batch size: ${report.options.batchSize}`,
    `- Bounded RSS gate: ${report.options.boundedRssMiB.toFixed(1)} MiB`,
    `- Variants: ${report.options.variants.join(', ')}`,
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
    if (runtime.environment.denoVersion) lines.push(`- Deno: ${runtime.environment.denoVersion}`);
    lines.push(`- Platform: ${runtime.environment.platform}`);
    lines.push(`- CPU: ${runtime.environment.cpuName}`);
    lines.push(`- Fixture bytes: ${runtime.fixture.actualBytes}`);
    lines.push('');
    lines.push('| Variant | Family | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |');
    lines.push('| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |');
    for (const row of runtime.variants) {
      lines.push(
        `| ${row.id} | ${row.family} | ${formatRate(row.avgMiBPerSec)} | ${formatRate(row.minMiBPerSec)} | `
        + `${formatRate(row.maxMiBPerSec)} | ${formatPercent(row.spreadRatio)} | ${formatSamples(row.mibPerSecSamples)} | `
        + `${row.stableResult ? 'yes' : 'no'} | ${row.boundedMemoryAll ? 'yes' : 'no'} | `
        + `${row.counterexampleFound ? 'found' : 'not-found'} | ${formatBytes(row.maxRssBytes)} |`,
      );
    }
    lines.push('');
    lines.push('### Parity');
    lines.push('');
    lines.push(`- Full rows stable across processes: ${runtime.parity.fullRowsStable ? 'yes' : 'no'}`);
    lines.push(`- Rows: ${runtime.parity.rowIds.join(', ')}`);
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
  console.log('EventReader byte-batch cross-process stability');
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
  if (Math.abs(value) >= MIB) return `${(value / MIB).toFixed(1)} MiB`;
  if (Math.abs(value) >= 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${value} B`;
}

function writeOutput(path, content) {
  const resolved = resolve(process.cwd(), path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content, 'utf8');
  console.log(`Wrote ${resolved}`);
}

main();
