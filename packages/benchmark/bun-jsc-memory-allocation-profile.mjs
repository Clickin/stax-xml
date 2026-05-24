import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const candidateScript = join(__dirname, 'candidate-headroom-large.mjs');
const defaultOutputDir = join(__dirname, 'results', 'bun-jsc-memory-allocation-profile', `profile-${Date.now()}`);
const defaultJsonOut = join(__dirname, 'results', 'release', 'bun-jsc-memory-allocation-profile.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'bun-jsc-memory-allocation-profile.md');
const defaultCases = ['scanAllNoDecode', 'stringFull', 'eventObjectFull', 'rawFrameNameId'];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sizeGiB: 0.0625,
    fixtureShape: 'diverse-cycle',
    diverseCycleSize: 4096,
    cases: [...defaultCases],
    runs: 3,
    warmups: 0,
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
      case '--size-gib':
        options.sizeGiB = parsePositiveNumber(readValue(), name);
        break;
      case '--fixture-shape':
        options.fixtureShape = readValue();
        break;
      case '--diverse-cycle-size':
        options.diverseCycleSize = parsePositiveInteger(readValue(), name);
        break;
      case '--cases':
        options.cases = parseCaseList(readValue());
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), name);
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
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

  if (!['repeated-person', 'diverse-cycle', 'projection-cycle', 'corpus-cycle'].includes(options.fixtureShape)) {
    throw new Error('--fixture-shape must be one of repeated-person, diverse-cycle, projection-cycle, corpus-cycle.');
  }
  return options;
}

function parsePositiveNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive number.`);
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

function parseCaseList(value) {
  const parsed = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (parsed.length === 0) throw new Error('--cases must contain at least one case id.');
  return parsed;
}

function main() {
  const options = parseArgs();
  const runtimeProbe = readBunRuntime();
  if (existsSync(options.outputDir)) {
    rmSync(options.outputDir, { recursive: true, force: true });
  }
  mkdirSync(options.outputDir, { recursive: true });

  const cases = options.cases.map((caseId) => runMemoryCase(options, caseId));
  const report = createReport({ options, runtimeProbe, cases });
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report, options);
}

function readBunRuntime() {
  const revisionResult = spawnSync('bun', ['--revision'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (revisionResult.status !== 0) {
    throw new Error(`bun revision probe failed: ${revisionResult.stderr || revisionResult.stdout}`);
  }
  const result = spawnSync('bun', ['--no-install', '-e', "console.log(JSON.stringify({runtimeName:'bun', javascriptEngine:'JavaScriptCore', bunVersion:process.versions.bun, webkitCommit:process.versions.webkit, processVersions:process.versions, memoryApi:{memoryUsage:typeof process.memoryUsage, availableMemory:typeof process.availableMemory, constrainedMemory:typeof process.constrainedMemory, gc:typeof globalThis.gc}}))"], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(`bun runtime probe failed: ${result.stderr || result.stdout}`);
  }
  return {
    ...JSON.parse(result.stdout),
    bunRevision: revisionResult.stdout.trim(),
  };
}

function runMemoryCase(options, caseId) {
  const benchmarkJson = join(options.outputDir, `${caseId}-benchmark.json`);
  const benchmarkMd = join(options.outputDir, `${caseId}-benchmark.md`);
  const args = [
    '--no-install',
    candidateScript,
    `--size-gib=${options.sizeGiB}`,
    `--fixture-shape=${options.fixtureShape}`,
    `--diverse-cycle-size=${options.diverseCycleSize}`,
    `--cases=${caseId}`,
    `--runs=${options.runs}`,
    `--warmups=${options.warmups}`,
    `--json-out=${benchmarkJson}`,
    `--md-out=${benchmarkMd}`,
  ];

  const startedAt = Date.now();
  const result = spawnSync('bun', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const elapsedMs = Date.now() - startedAt;
  const runLog = join(options.outputDir, `${caseId}-run.log`);
  writeFileSync(runLog, [
    `$ ${['bun', ...args].join(' ')}`,
    `cwd=${repoRoot}`,
    `exit=${result.status} elapsedMs=${elapsedMs}`,
    '',
    '--- stdout ---',
    result.stdout ?? '',
    '',
    '--- stderr ---',
    result.stderr ?? '',
  ].join('\n'));

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Bun memory profile case failed for ${caseId}. See ${runLog}`);
  }

  const benchmark = JSON.parse(readFileSync(benchmarkJson, 'utf8'));
  const variant = benchmark.variants.find((entry) => entry.id === caseId);
  if (!variant) {
    throw new Error(`Bun benchmark output for ${caseId} did not contain the requested variant.`);
  }

  return {
    caseId,
    command: ['bun', ...args],
    elapsedMs,
    rawFiles: {
      benchmarkJson,
      benchmarkMd,
      runLog,
    },
    fixture: benchmark.fixture,
    result: summarizeVariant(variant),
    memoryProfile: summarizeMemoryProfile(variant.memory),
  };
}

function summarizeVariant(variant) {
  return {
    id: variant.id,
    family: variant.family,
    implementation: variant.implementation,
    contractScope: variant.contractScope,
    fullStringParity: variant.fullStringParity,
    mibPerSec: variant.mibPerSec,
    eventCount: variant.eventCount,
    checksum: variant.checksum,
    boundedMemory: variant.boundedMemory,
    memory: variant.memory,
    materializationCounters: variant.materializationCounters,
  };
}

function summarizeMemoryProfile(memory) {
  const samples = memory.samples ?? [];
  const deltas = samples.map((sample) => sample.delta);
  return {
    sampleCount: samples.length,
    maxRssBytes: memory.maxRssBytes,
    maxHeapUsedBytes: memory.maxHeapUsedBytes,
    maxHeapTotalBytes: memory.maxHeapTotalBytes,
    maxExternalBytes: maxSampleValue(samples, 'externalBytes'),
    maxArrayBuffersBytes: maxSampleValue(samples, 'arrayBuffersBytes'),
    avgRssDeltaBytes: memory.avgRssDeltaBytes,
    avgHeapUsedDeltaBytes: memory.avgHeapUsedDeltaBytes,
    avgHeapTotalDeltaBytes: memory.avgHeapTotalDeltaBytes,
    avgExternalDeltaBytes: memory.avgExternalDeltaBytes,
    avgArrayBuffersDeltaBytes: memory.avgArrayBuffersDeltaBytes,
    minHeapUsedDeltaBytes: minBy(deltas, (delta) => delta.heapUsedBytes)?.heapUsedBytes ?? null,
    maxHeapUsedDeltaBytes: maxBy(deltas, (delta) => delta.heapUsedBytes)?.heapUsedBytes ?? null,
    minRssDeltaBytes: minBy(deltas, (delta) => delta.rssBytes)?.rssBytes ?? null,
    maxRssDeltaBytes: maxBy(deltas, (delta) => delta.rssBytes)?.rssBytes ?? null,
  };
}

function maxSampleValue(samples, key) {
  if (samples.length === 0) return null;
  return Math.max(...samples.flatMap((sample) => [sample.before[key], sample.after[key]].filter(Number.isFinite)));
}

function createReport({ options, runtimeProbe, cases }) {
  const fullRows = cases.filter((entry) => entry.result.fullStringParity);
  const firstFull = fullRows[0]?.result;
  const fullStringParity = fullRows.length === 0
    ? { status: 'not-applicable', rowIds: [] }
    : {
        status: fullRows.every((entry) => entry.result.eventCount === firstFull.eventCount && entry.result.checksum === firstFull.checksum) ? 'ok' : 'mismatch',
        rowIds: fullRows.map((entry) => entry.caseId),
        eventCount: firstFull.eventCount,
        checksum: firstFull.checksum,
      };
  const fixture = cases[0]?.fixture ?? null;

  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'bun-jsc-memory-allocation-profile',
    contract: 'process-memory-usage-endpoint-profile',
    note: 'Bun/JSC process.memoryUsage endpoint profile for selected same-contract candidate rows. This is not a JavaScriptCore allocation census, heap snapshot, or codegen proof.',
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
    },
    runtime: runtimeProbe,
    options: {
      sizeGiB: options.sizeGiB,
      fixtureShape: options.fixtureShape,
      diverseCycleSize: options.diverseCycleSize,
      cases: options.cases,
      runs: options.runs,
      warmups: options.warmups,
    },
    fixture,
    rawArtifacts: {
      outputDir: options.outputDir,
      committed: false,
      reason: 'Per-case benchmark JSON/MD and run logs are generated evidence files; the release artifact keeps the curated memory summary.',
    },
    fullStringParity,
    cases: cases.map((entry) => ({
      caseId: entry.caseId,
      elapsedMs: entry.elapsedMs,
      rawFiles: entry.rawFiles,
      result: entry.result,
      memoryProfile: entry.memoryProfile,
    })),
  };
  report.findings = createFindings(report);
  return report;
}

function createFindings(report) {
  const fastestFull = report.cases
    .filter((entry) => entry.result.fullStringParity)
    .toSorted((a, b) => b.result.mibPerSec - a.result.mibPerSec)[0];
  return [
    {
      id: 'bun-memory-endpoint-profile-visible',
      classification: 'ALLOCATION_FACT',
      summary: 'Bun/JSC exposed process.memoryUsage endpoint samples for selected candidate rows.',
      evidence: [
        `cases=${report.cases.map((entry) => entry.caseId).join(',')}`,
        `runs=${report.options.runs}`,
        `memoryApi=${report.runtime.memoryApi.memoryUsage}`,
        fastestFull ? `fastestFull=${fastestFull.caseId} ${formatNumber(fastestFull.result.mibPerSec)} MiB/s` : 'fastestFull=n/a',
      ],
    },
    {
      id: 'full-string-parity-preserved',
      classification: 'BENCH_FACT',
      summary: 'The profiled full-string rows preserved the same event count and checksum.',
      evidence: [
        `status=${report.fullStringParity.status}`,
        `rows=${report.fullStringParity.rowIds.join(',')}`,
        `eventCount=${formatInteger(report.fullStringParity.eventCount)}`,
        `checksum=${report.fullStringParity.checksum}`,
      ],
    },
    {
      id: 'endpoint-profile-not-census',
      classification: 'SCOPE_GUARD',
      summary: 'process.memoryUsage endpoints are coarse process snapshots, not a JavaScriptCore allocation census or heap object lifetime proof.',
      evidence: [
        'Samples are before/after measured runs, not per-allocation events.',
        'RSS includes runtime and allocator behavior outside JavaScript heap objects.',
        'A future 200 MiB/s bounded-memory full-string row would still be a counterexample.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Bun/JSC Memory Allocation Profile',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Scope',
    '',
    'This is an `ALLOCATION_FACT` for selected Bun/JSC candidate rows using `process.memoryUsage()` endpoints. It is not a JavaScriptCore allocation census, not a heap snapshot, not a codegen trace, and not a 200 MiB/s ceiling proof.',
    '',
    '## Runtime',
    '',
    `- Runtime: ${report.runtime.runtimeName} / ${report.runtime.javascriptEngine}`,
    `- Bun: ${report.runtime.bunVersion}`,
    `- Bun revision: ${report.runtime.bunRevision}`,
    `- WebKit commit: ${report.runtime.webkitCommit}`,
    `- process.memoryUsage: ${report.runtime.memoryApi.memoryUsage}`,
    `- globalThis.gc: ${report.runtime.memoryApi.gc}`,
    `- Fixture: ${report.options.fixtureShape}, ${formatNumber(report.options.sizeGiB * 1024, 1)} MiB target`,
    `- Runs: ${report.options.runs}`,
    `- Cases: ${report.options.cases.join(', ')}`,
    '',
    '## Raw Artifacts',
    '',
    `- Output dir: ${report.rawArtifacts.outputDir}`,
    `- Committed: ${report.rawArtifacts.committed ? 'yes' : 'no'}`,
    `- Reason: ${report.rawArtifacts.reason}`,
    '',
    '## Cases',
    '',
    '| Case | MiB/s | Events | Checksum | Strings | Max RSS | Max heap used | Avg RSS delta | Avg heap delta | External max | ArrayBuffer max |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const entry of report.cases) {
    lines.push([
      `| \`${entry.caseId}\``,
      formatNumber(entry.result.mibPerSec),
      formatInteger(entry.result.eventCount),
      entry.result.checksum,
      formatInteger(entry.result.materializationCounters?.stringFieldReads ?? 0),
      formatBytes(entry.memoryProfile.maxRssBytes),
      formatBytes(entry.memoryProfile.maxHeapUsedBytes),
      formatSignedBytes(entry.memoryProfile.avgRssDeltaBytes),
      formatSignedBytes(entry.memoryProfile.avgHeapUsedDeltaBytes),
      formatBytes(entry.memoryProfile.maxExternalBytes),
      `${formatBytes(entry.memoryProfile.maxArrayBuffersBytes)} |`,
    ].join(' | '));
  }

  lines.push('', '## Full String Parity', '');
  lines.push(`- Status: ${report.fullStringParity.status}`);
  lines.push(`- Rows: ${report.fullStringParity.rowIds.join(', ') || 'n/a'}`);
  if (report.fullStringParity.status === 'ok') {
    lines.push(`- Event count: ${formatInteger(report.fullStringParity.eventCount)}`);
    lines.push(`- Checksum: ${report.fullStringParity.checksum}`);
  }

  lines.push('', '## Findings');
  for (const finding of report.findings) {
    lines.push('', `### ${finding.id}`, '', `Classification: ${finding.classification}`, '', finding.summary, '');
    for (const item of finding.evidence) {
      lines.push(`- ${item}`);
    }
  }

  lines.push(
    '',
    '## Interpretation',
    '',
    'This artifact narrows the Bun/JSC allocation/profile gap by recording process memory endpoint behavior for the same partial/full candidate row vocabulary. It still cannot prove JavaScriptCore object allocation counts, string lifetime, or an optimized-code ceiling.'
  );

  return `${lines.join('\n')}\n`;
}

function minBy(values, score) {
  let best = null;
  let bestScore = Infinity;
  for (const value of values) {
    const current = score(value);
    if (Number.isFinite(current) && current < bestScore) {
      best = value;
      bestScore = current;
    }
  }
  return best;
}

function maxBy(values, score) {
  let best = null;
  let bestScore = -Infinity;
  for (const value of values) {
    const current = score(value);
    if (Number.isFinite(current) && current > bestScore) {
      best = value;
      bestScore = current;
    }
  }
  return best;
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report, options) {
  console.log('Bun/JSC memory allocation profile');
  console.log(`runtime: Bun ${report.runtime.bunVersion} / WebKit ${report.runtime.webkitCommit}`);
  for (const entry of report.cases) {
    console.log(`${entry.caseId.padEnd(24)} ${formatNumber(entry.result.mibPerSec).padStart(8)} MiB/s rss=${formatBytes(entry.memoryProfile.maxRssBytes)} heap=${formatBytes(entry.memoryProfile.maxHeapUsedBytes)}`);
  }
  console.log(`wrote ${options.jsonOut}`);
  console.log(`wrote ${options.mdOut}`);
}

function formatInteger(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : 'n/a';
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return 'n/a';
  const abs = Math.abs(value);
  if (abs >= MIB) return `${formatNumber(value / MIB, 1)} MiB`;
  if (abs >= 1024) return `${formatNumber(value / 1024, 1)} KiB`;
  return `${Math.round(value)} B`;
}

function formatSignedBytes(value) {
  if (!Number.isFinite(value)) return 'n/a';
  return `${value >= 0 ? '+' : ''}${formatBytes(value)}`;
}

main();
