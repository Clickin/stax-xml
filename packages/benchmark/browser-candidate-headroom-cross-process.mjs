import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const browserHarnessPath = join(__dirname, 'browser-candidate-headroom.mjs');
const firefoxBidiHarnessPath = join(__dirname, 'firefox-bidi-candidate-headroom.mjs');
const firefoxBidiTextDecoderHarnessPath = join(__dirname, 'firefox-bidi-textdecoder-span-variants.mjs');
const defaultJsonOut = join(__dirname, 'results', 'release', 'browser-candidate-headroom-cross-process-projection.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'browser-candidate-headroom-cross-process-projection.md');
const defaultOutputDir = join(__dirname, 'results', 'cross-process', 'browser-candidate-headroom-projection');
const defaultCorpusFile = resolve(__dirname, '../stax-xml/performance/samples/treebank_e.xml');
const defaultCases = [
  'stringFull',
  'eventObjectFull',
  'rawFrameNameId',
  'projectionLowSelectivity',
  'projectionHighSelectivity',
];
const textDecoderCases = [
  'subarraySharedDecoder',
  'viewSharedDecoder',
  'sliceCopySharedDecoder',
  'subarrayNewDecoder',
  'shortAsciiSubarraySharedDecoder',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    processRuns: 3,
    harness: 'browser',
    childWarmups: 0,
    sizeGiB: 1,
    fixtureShape: 'projection-cycle',
    diverseCycleSize: 4096,
    corpusFile: defaultCorpusFile,
    batchSize: 16,
    boundedJsHeapMiB: 512,
    cases: null,
    browserExecutable: null,
    browserTimeoutMs: 20 * 60 * 1000,
    collectHostProcessMemory: true,
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
      case '--process-runs':
        options.processRuns = parsePositiveInteger(readValue(), '--process-runs');
        break;
      case '--harness':
        options.harness = readValue();
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
      case '--bounded-js-heap-mib':
        options.boundedJsHeapMiB = parsePositiveNumber(readValue(), '--bounded-js-heap-mib');
        break;
      case '--cases':
        options.cases = parseList(readValue(), '--cases');
        break;
      case '--browser-executable':
        options.browserExecutable = resolve(process.cwd(), readValue());
        break;
      case '--browser-timeout-ms':
        options.browserTimeoutMs = parsePositiveInteger(readValue(), '--browser-timeout-ms');
        break;
      case '--no-host-process-memory':
        options.collectHostProcessMemory = false;
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
  if (!['browser', 'firefox-bidi', 'firefox-bidi-textdecoder'].includes(options.harness)) {
    throw new Error('--harness must be one of browser, firefox-bidi, firefox-bidi-textdecoder.');
  }
  if (options.cases === null) {
    options.cases = options.harness === 'firefox-bidi-textdecoder'
      ? [...textDecoderCases]
      : [...defaultCases];
  }
  if (options.harness === 'firefox-bidi-textdecoder' && options.fixtureShape === 'projection-cycle') {
    throw new Error('--fixture-shape projection-cycle is not supported by the Firefox TextDecoder span harness.');
  }
  if (!options.browserExecutable) {
    options.browserExecutable = options.harness.startsWith('firefox-bidi')
      ? process.env.FIREFOX_PATH || findFirefoxExecutable()
      : process.env.CHROME_PATH || process.env.EDGE_PATH || findBrowserExecutable();
  }
  if (!options.browserExecutable || !existsSync(options.browserExecutable)) {
    const message = options.harness.startsWith('firefox-bidi')
      ? 'Firefox executable was not found. Pass --browser-executable or set FIREFOX_PATH.'
      : 'Chrome or Edge executable was not found. Pass --browser-executable or set CHROME_PATH/EDGE_PATH.';
    throw new Error(message);
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

  for (let runIndex = 0; runIndex < options.processRuns; runIndex++) {
    samples.push(runChildProcess(runIndex, options));
  }

  const report = createReport(options, samples);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function runChildProcess(runIndex, options) {
  const childJsonOut = join(options.outputDir, `browser-run-${runIndex + 1}.json`);
  const childMdOut = join(options.outputDir, `browser-run-${runIndex + 1}.md`);
  const args = createChildArgs(options, childJsonOut, childMdOut);
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.browserTimeoutMs + 30_000,
  });

  if (result.error) {
    throw new Error(`browser run ${runIndex + 1} failed to spawn: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`browser run ${runIndex + 1} failed with exit ${result.status}:\n${trimSpawnOutput(result)}`);
  }

  const childReport = JSON.parse(readFileSync(childJsonOut, 'utf8'));
  return {
    runIndex: runIndex + 1,
    startedAt,
    jsonPath: childJsonOut,
    mdPath: childMdOut,
    stdout: String(result.stdout ?? '').trim(),
    stderr: String(result.stderr ?? '').trim(),
    report: childReport,
  };
}

function createChildArgs(options, jsonOut, mdOut) {
  const harnessPath = options.harness === 'firefox-bidi'
    ? firefoxBidiHarnessPath
    : options.harness === 'firefox-bidi-textdecoder'
      ? firefoxBidiTextDecoderHarnessPath
      : browserHarnessPath;
  const args = [
    harnessPath,
    '--browser-executable',
    options.browserExecutable,
    '--browser-timeout-ms',
    String(options.browserTimeoutMs),
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
    '--bounded-js-heap-mib',
    String(options.boundedJsHeapMiB),
    '--runs',
    '1',
    '--warmups',
    String(options.childWarmups),
    '--json-out',
    jsonOut,
    '--md-out',
    mdOut,
  ];
  if (options.harness !== 'firefox-bidi-textdecoder') {
    args.push('--cases', options.cases.join(','));
  }
  if (!options.collectHostProcessMemory) {
    args.push('--no-host-process-memory');
  }
  return args;
}

function trimSpawnOutput(result) {
  return String(result.stderr ?? '').trim() || String(result.stdout ?? '').trim();
}

function createReport(options, samples) {
  const first = samples[0]?.report;
  if (!first) {
    throw new Error('No browser samples were recorded.');
  }
  const variants = options.cases.map(caseId => summarizeVariant(caseId, samples));
  const report = {
    generatedAt: new Date().toISOString(),
    objective: options.harness === 'firefox-bidi-textdecoder'
      ? 'firefox-bidi-textdecoder-span-cross-process'
      : 'browser-candidate-headroom-cross-process',
    contract: options.harness === 'firefox-bidi-textdecoder'
      ? 'independent-firefox-bidi-textdecoder-span-stability'
      : 'independent-browser-process-candidate-headroom-stability',
    note: options.harness === 'firefox-bidi-textdecoder'
      ? 'Each sample invokes firefox-bidi-textdecoder-span-variants.mjs, which launches a fresh Firefox process with --runs=1. Firefox page JS heap is unavailable; host process-tree memory is summarized separately.'
      : 'Each sample invokes browser-candidate-headroom.mjs, which launches a fresh browser process with --runs=1. Variant memory is browser JS heap; host process-tree memory is summarized separately.',
    environment: {
      ...first.environment,
      hostCpuName: cpus()[0]?.model ?? 'unknown',
      hostPlatform: `${process.platform}-${process.arch}`,
    },
    fixture: first.fixture,
    options: {
      processRuns: options.processRuns,
      harness: options.harness,
      childWarmups: options.childWarmups,
      sizeGiB: options.sizeGiB,
      fixtureShape: options.fixtureShape,
      diverseCycleSize: options.diverseCycleSize,
      batchSize: options.batchSize,
      boundedJsHeapMiB: options.boundedJsHeapMiB,
      cases: options.cases,
      browserExecutable: options.browserExecutable,
      browserTimeoutMs: options.browserTimeoutMs,
      collectHostProcessMemory: options.collectHostProcessMemory,
    },
    rawArtifacts: {
      outputDir: options.outputDir,
      committed: false,
    },
    sampleCount: samples.length,
    childReports: samples.map(sample => createChildSummary(sample)),
    parity: summarizeParity(samples),
    hostProcessMemory: summarizeHostProcessMemory(samples),
    variants,
  };
  return {
    ...report,
    findings: createFindings(report),
  };
}

function createChildSummary(sample) {
  return {
    runIndex: sample.runIndex,
    jsonPath: sample.jsonPath,
    mdPath: sample.mdPath,
    environment: sample.report.environment,
    hostProcessMemory: sample.report.hostProcessMemory,
    variants: sample.report.variants.map(entry => ({
      id: entry.id,
      mibPerSec: entry.mibPerSec,
      eventCount: entry.eventCount,
      checksum: entry.checksum,
      eventCountKind: entry.eventCountKind,
      fullStringParity: entry.fullStringParity,
      boundedMemory: entry.boundedMemory,
      counterexampleStatus: entry.counterexampleStatus,
      maxJsHeapUsedBytes: entry.memory.maxJsHeapUsedBytes,
      maxJsHeapTotalBytes: entry.memory.maxJsHeapTotalBytes,
      jsHeapSizeLimitBytes: entry.memory.jsHeapSizeLimitBytes,
      materializationCounters: entry.materializationCounters,
    })),
  };
}

function summarizeParity(samples) {
  const streamRows = new Map();
  const projectionRows = new Map();

  for (const sample of samples) {
    for (const variant of sample.report.variants) {
      const target = variant.eventCountKind === 'projected-records' ? projectionRows : streamRows;
      const values = target.get(variant.id) ?? [];
      values.push({ eventCount: variant.eventCount, checksum: variant.checksum });
      target.set(variant.id, values);
    }
  }

  return {
    streamAndFullRowsStable: [...streamRows.values()].every(values => uniquePairs(values).length === 1),
    projectionRowsStable: [...projectionRows.values()].every(values => uniquePairs(values).length === 1),
    streamAndFullRowIds: [...streamRows.keys()],
    projectionRowIds: [...projectionRows.keys()],
  };
}

function summarizeHostProcessMemory(samples) {
  const childRows = samples.map(sample => ({
    runIndex: sample.runIndex,
    scope: sample.report.hostProcessMemory?.scope ?? 'disabled',
    maxWorkingSetBytes: sample.report.hostProcessMemory?.maxWorkingSetBytes ?? null,
    maxPrivateBytes: sample.report.hostProcessMemory?.maxPrivateBytes ?? null,
    maxProcessCount: sample.report.hostProcessMemory?.maxProcessCount ?? null,
  }));
  const workingSetValues = childRows.map(row => row.maxWorkingSetBytes).filter(isFiniteNumber);
  const privateValues = childRows.map(row => row.maxPrivateBytes).filter(isFiniteNumber);
  const processCountValues = childRows.map(row => row.maxProcessCount).filter(isFiniteNumber);
  return {
    scope: childRows.some(row => row.scope === 'windows-process-tree')
      ? 'windows-process-tree'
      : uniqueStrings(childRows.map(row => row.scope)).join(',') || 'unknown',
    note: 'Host process-tree memory is inherited from each child report and is process-level browser memory, not a portable per-variant JS heap measurement.',
    childRows,
    maxWorkingSetBytes: workingSetValues.length > 0 ? Math.max(...workingSetValues) : null,
    maxPrivateBytes: privateValues.length > 0 ? Math.max(...privateValues) : null,
    maxProcessCount: processCountValues.length > 0 ? Math.max(...processCountValues) : null,
  };
}

function summarizeVariant(caseId, samples) {
  const rows = samples.map((sample) => {
    const row = sample.report.variants.find(entry => entry.id === caseId);
    if (!row) {
      throw new Error(`Missing case ${caseId} in browser run ${sample.runIndex}.`);
    }
    return row;
  });
  const mibPerSecSamples = rows.map(row => row.mibPerSec);
  const eventCounts = uniqueNumbers(rows.map(row => row.eventCount));
  const checksums = uniqueNumbers(rows.map(row => row.checksum));
  const avgMiBPerSec = average(mibPerSecSamples);
  const minMiBPerSec = Math.min(...mibPerSecSamples);
  const maxMiBPerSec = Math.max(...mibPerSecSamples);
  const maxJsHeapUsedBytes = maxNullable(rows.map(row => row.memory.maxJsHeapUsedBytes));
  const maxJsHeapTotalBytes = maxNullable(rows.map(row => row.memory.maxJsHeapTotalBytes));
  const jsHeapSizeLimitBytes = maxNullable(rows.map(row => row.memory.jsHeapSizeLimitBytes));
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
    maxJsHeapUsedBytes,
    maxJsHeapTotalBytes,
    jsHeapSizeLimitBytes,
    counterexampleFound: rows.some(row => row.counterexampleStatus === 'found'),
  };
}

function createFindings(report) {
  const foundCounterexamples = report.variants
    .filter(row => row.fullStringParity && row.counterexampleFound)
    .map(row => `${row.id} avg=${formatRate(row.avgMiBPerSec)}`);
  return [
    {
      id: 'independent-browser-process-rerun',
      classification: 'BENCH_FACT',
      summary: `Each sample launched a fresh browser process through the ${report.options.harness} harness.`,
      evidence: [`processRuns=${report.sampleCount}`, `browser=${report.environment.browserName} ${report.environment.browserVersion}`],
    },
    {
      id: 'browser-memory-scope',
      classification: 'BENCH_FACT',
      summary: report.environment.javascriptEngine === 'SpiderMonkey'
        ? 'Firefox does not expose Chromium performance.memory, so variant JS heap is unavailable. Host process-tree memory is reported separately and is not mixed with Node/Bun RSS evidence.'
        : 'Variant memory is browser JS heap. Host process-tree memory is reported separately and is not mixed with Node/Bun RSS evidence.',
      evidence: report.variants.map(row => `${row.id}: maxJsHeap=${formatBytes(row.maxJsHeapUsedBytes)}`),
    },
    {
      id: 'projection-contract-separated',
      classification: 'BENCH_FACT',
      summary: report.parity.projectionRowIds.length > 0
        ? 'Projection rows are selected-field projected-record workloads, not full StAX event-parity rows.'
        : 'No projection rows were selected; all reported variants are full-string StAX parity rows.',
      evidence: report.parity.projectionRowIds.length > 0 ? report.parity.projectionRowIds : ['projection rows not selected'],
    },
    {
      id: 'full-stax-counterexample-search',
      classification: 'BENCH_FACT',
      summary: foundCounterexamples.length > 0
        ? 'At least one full-string row reported a 200 MiB/s bounded-memory browser counterexample in a fresh process sample.'
        : 'No full-string row reported a 200 MiB/s bounded-memory browser counterexample in these fresh process samples.',
      evidence: foundCounterexamples.length > 0 ? foundCounterexamples : ['counterexample=not-found'],
    },
    {
      id: 'browser-v8-scope',
      classification: 'BENCH_FACT',
      summary: report.environment.javascriptEngine === 'SpiderMonkey'
        ? 'This report is browser evidence for the recorded Firefox/SpiderMonkey build only; it is not Chromium/V8, Safari/JSC, codegen, or allocation evidence.'
        : 'This report is browser evidence for the recorded Chromium/V8 build only; it is not JSC/SpiderMonkey browser evidence.',
      evidence: [`engine=${report.environment.javascriptEngine}`, `userAgent=${report.environment.userAgent}`],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Browser Candidate Headroom Cross-Process Stability',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.options.harness === 'firefox-bidi-textdecoder'
      ? 'This report repeats Firefox TextDecoder span rows in fresh Firefox browser processes.'
      : 'This report repeats selected browser candidate-headroom rows in fresh browser processes.',
    'It is browser-runtime timing evidence for the recorded machine, not proof that JavaScript runtimes have no further headroom.',
    report.parity.projectionRowIds.length > 0
      ? 'Projection rows report projected record counts and selected-field checksums; they are workload headroom rows, not full StAX parity rows.'
      : 'All selected rows preserve full-string StAX parity; no projection rows are included.',
    report.environment.javascriptEngine === 'SpiderMonkey'
      ? 'Firefox does not expose Chromium performance.memory, so variant JS heap is unavailable. Host process-tree memory is summarized separately and must not be mixed with Node/Bun RSS rows as the same memory proof.'
      : 'Variant memory is browser JS heap. Host process-tree memory is summarized separately and must not be mixed with Node/Bun RSS rows as the same memory proof.',
    '',
    '## Options',
    '',
    `- Process runs: ${report.options.processRuns}`,
    `- Harness: ${report.options.harness}`,
    `- Child warmups: ${report.options.childWarmups}`,
    `- Fixture shape: ${report.options.fixtureShape}`,
    `- Size GiB: ${report.options.sizeGiB}`,
    `- Diverse cycle size: ${report.options.diverseCycleSize}`,
    `- Batch size: ${report.options.batchSize}`,
    `- Bounded JS heap gate: ${report.options.boundedJsHeapMiB.toFixed(1)} MiB`,
    `- Cases: ${report.options.cases.join(', ')}`,
    `- Browser executable: ${report.options.browserExecutable}`,
    '',
    '## Raw Artifacts',
    '',
    `- Output dir: ${report.rawArtifacts.outputDir}`,
    `- Committed: ${report.rawArtifacts.committed ? 'yes' : 'no'}`,
    '',
    '## Environment',
    '',
    `- Browser: ${report.environment.browserName} ${report.environment.browserVersion}`,
    `- Engine: ${report.environment.javascriptEngine}`,
    `- Platform: ${report.environment.platform}`,
    `- Host platform: ${report.environment.hostPlatform}`,
    `- CPU: ${report.environment.hostCpuName}`,
    `- User agent: ${report.environment.userAgent}`,
    '',
    '## Fixture',
    '',
    `- Source: ${report.fixture.source}`,
    `- Shape: ${report.fixture.shape}`,
    `- Actual bytes: ${report.fixture.actualBytes}`,
    `- Size GiB: ${report.fixture.sizeGiB}`,
    `- Row cycle size: ${report.fixture.rowCycleSize}`,
    '',
    '## Results',
    '',
    '| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded JS heap all | Counterexample | Max JS heap |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |',
  ];

  for (const row of report.variants) {
    lines.push(
      `| ${row.id} | ${row.eventCountKind} | ${formatRate(row.avgMiBPerSec)} | ${formatRate(row.minMiBPerSec)} | `
      + `${formatRate(row.maxMiBPerSec)} | ${formatPercent(row.spreadRatio)} | ${formatSamples(row.mibPerSecSamples)} | `
      + `${row.stableResult ? 'yes' : 'no'} | ${row.boundedMemoryAll ? 'yes' : 'no'} | `
      + `${row.counterexampleFound ? 'found' : 'not-found'} | ${formatBytes(row.maxJsHeapUsedBytes)} |`,
    );
  }

  lines.push('');
  lines.push('## Parity');
  lines.push('');
  lines.push(`- Stream/full rows stable across processes: ${report.parity.streamAndFullRowsStable ? 'yes' : 'no'}`);
  lines.push(`- Stream/full rows: ${report.parity.streamAndFullRowIds.join(', ') || 'n/a'}`);
  lines.push(`- Projection rows stable across processes: ${report.parity.projectionRowsStable ? 'yes' : 'no'}`);
  lines.push(`- Projection rows: ${report.parity.projectionRowIds.join(', ') || 'n/a'}`);
  lines.push('');
  lines.push('## Host Process Memory');
  lines.push('');
  lines.push(report.hostProcessMemory.note);
  lines.push('');
  lines.push(`- Scope: ${report.hostProcessMemory.scope}`);
  lines.push(`- Max working set: ${formatBytes(report.hostProcessMemory.maxWorkingSetBytes)}`);
  lines.push(`- Max private bytes: ${formatBytes(report.hostProcessMemory.maxPrivateBytes)}`);
  lines.push(`- Max process count: ${report.hostProcessMemory.maxProcessCount ?? 'n/a'}`);
  lines.push('');
  lines.push('| Browser run | Scope | Max working set | Max private bytes | Max process count |');
  lines.push('| ---: | --- | ---: | ---: | ---: |');
  for (const row of report.hostProcessMemory.childRows) {
    lines.push(
      `| ${row.runIndex} | ${row.scope} | ${formatBytes(row.maxWorkingSetBytes)} | `
      + `${formatBytes(row.maxPrivateBytes)} | ${row.maxProcessCount ?? 'n/a'} |`,
    );
  }
  lines.push('');
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
  console.log('Browser candidate headroom cross-process stability');
  console.log(`browser: ${report.environment.browserName} ${report.environment.browserVersion}, samples=${report.sampleCount}`);
  for (const row of report.variants) {
    console.log(`${row.id.padEnd(28)} avg=${formatRate(row.avgMiBPerSec)} spread=${formatPercent(row.spreadRatio)} counterexample=${row.counterexampleFound ? 'found' : 'not-found'}`);
  }
}

function uniquePairs(values) {
  return [...new Set(values.map(value => `${value.eventCount}:${value.checksum}`))];
}

function uniqueNumbers(values) {
  return [...new Set(values)];
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxNullable(values) {
  const finiteValues = values.filter(isFiniteNumber);
  return finiteValues.length > 0 ? Math.max(...finiteValues) : null;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
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
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'n/a';
  }
  const abs = Math.abs(value);
  if (abs >= 1024 * MIB) return `${(value / (1024 * MIB)).toFixed(2)} GiB`;
  if (abs >= MIB) return `${(value / MIB).toFixed(1)} MiB`;
  if (abs >= 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${value.toFixed(0)} B`;
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  console.log(`Wrote ${filePath}`);
}

function findBrowserExecutable() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return candidates.find(candidate => existsSync(candidate));
}

function findFirefoxExecutable() {
  const candidates = [
    'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
    'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
  ];
  return candidates.find(candidate => existsSync(candidate));
}

main();
