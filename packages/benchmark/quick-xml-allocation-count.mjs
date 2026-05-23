import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const quickXmlDir = join(__dirname, 'external', 'quick-xml');
const quickXmlExe = join(quickXmlDir, 'target', 'release', process.platform === 'win32' ? 'quick_xml_baseline.exe' : 'quick_xml_baseline');
const defaultFile = join(__dirname, 'test-data', 'runtime-comparison-16mib.xml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'quick-xml-allocation-count.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'quick-xml-allocation-count.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    runs: 1,
    warmups: 4,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    fileExplicit: false,
    skipBuild: false,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || arg === '--') continue;
    if (arg === '--self-test') {
      options.selfTest = true;
      continue;
    }
    if (arg === '--skip-build') {
      options.skipBuild = true;
      continue;
    }

    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${arg} requires a value.`);
      index++;
      return value;
    };

    switch (name) {
      case '--file':
        options.file = resolve(process.cwd(), readValue());
        options.fileExplicit = true;
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), name);
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
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

  return options;
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

function main() {
  const options = parseArgs();
  const report = options.selfTest ? createSelfTestReport(options) : runAllocationCount(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function createSelfTestReport(options) {
  const benchmark = {
    runtime: '1.0.0',
    avgMs: 50,
    minMs: 49,
    maxMs: 51,
    mibPerSec: 320,
    eventCount: 967967,
    checksum: -746772258,
    samplesMs: [50],
    allocationSamples: [
      {
        allocCount: 8,
        allocBytes: 1146880,
        deallocCount: 8,
        deallocBytes: 1146880,
        reallocCount: 2,
        reallocBytesIn: 768,
        reallocBytesOut: 1536,
        allocationOperations: 10,
        totalAllocatedBytes: 1148416,
        totalReleasedBytes: 1147648,
        netAllocatedBytes: 768,
      },
    ],
    allocationSummary: {
      allocCount: 8,
      allocBytes: 1146880,
      deallocCount: 8,
      deallocBytes: 1146880,
      reallocCount: 2,
      reallocBytesIn: 768,
      reallocBytesOut: 1536,
      allocationOperations: 10,
      totalAllocatedBytes: 1148416,
      totalReleasedBytes: 1147648,
      netAllocatedBytes: 768,
    },
  };
  return createReport({
    options,
    environment: {
      rustc: 'rustc self-test',
      cargo: 'cargo self-test',
      cpuName: 'self-test',
      platform: 'self-test',
    },
    fixture: {
      path: null,
      sizeBytes: 16 * MIB,
      sizeMiB: 16,
      source: 'self-test',
    },
    command: ['quick_xml_baseline', '--count-allocations'],
    elapsedMs: 0,
    benchmark,
  });
}

function runAllocationCount(options) {
  ensureFixture(options);
  ensureQuickXmlBinary(options);
  const stats = statSync(options.file);
  const environment = {
    rustc: firstLine(runCommandChecked('rustc', ['--version'], repoRoot)),
    cargo: firstLine(runCommandChecked('cargo', ['--version'], repoRoot)),
    cpuName: cpus()[0]?.model ?? 'unknown',
    platform: `${process.platform}-${process.arch}`,
  };
  const args = [
    '--file',
    options.file,
    '--runs',
    String(options.runs),
    '--warmups',
    String(options.warmups),
    '--count-allocations',
  ];
  const startedAt = Date.now();
  const result = runCommand(quickXmlExe, args, repoRoot);
  const elapsedMs = Date.now() - startedAt;
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`quick-xml allocation count run failed: ${trimSpawnOutput(result)}`);
  }
  const benchmark = JSON.parse(String(result.stdout ?? '').trim());
  return createReport({
    options,
    environment,
    fixture: {
      path: options.file,
      sizeBytes: stats.size,
      sizeMiB: stats.size / MIB,
      source: 'file',
    },
    command: [quickXmlExe, ...args],
    elapsedMs,
    benchmark,
  });
}

function createReport({ options, environment, fixture, command, elapsedMs, benchmark }) {
  validateBenchmark(benchmark, options.runs);
  const allocation = analyzeAllocations(benchmark, fixture);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'quick-xml-allocation-count',
    contract: 'measured-consume-global-allocator-count',
    note: 'Global allocator counters for Rust + quick-xml measured consume runs after warmup. This is allocation-call evidence for this binary, not stack attribution, type attribution, object-lifetime proof, or a speed baseline.',
    environment,
    fixture,
    options: {
      runs: options.runs,
      warmups: options.warmups,
      countAllocations: true,
    },
    command: {
      cwd: repoRoot,
      argv: command,
      elapsedMs,
    },
    benchmark,
    allocation,
    findings: createFindings(benchmark, allocation),
  };
}

function validateBenchmark(benchmark, expectedRuns) {
  if (!Array.isArray(benchmark.samplesMs) || benchmark.samplesMs.length !== expectedRuns) {
    throw new Error(`quick-xml emitted ${benchmark.samplesMs?.length ?? 0} samples, expected ${expectedRuns}.`);
  }
  if (!Array.isArray(benchmark.allocationSamples) || benchmark.allocationSamples.length !== expectedRuns) {
    throw new Error(`quick-xml emitted ${benchmark.allocationSamples?.length ?? 0} allocation samples, expected ${expectedRuns}.`);
  }
  for (const field of ['eventCount', 'checksum', 'mibPerSec', 'allocationSummary']) {
    if (benchmark[field] === undefined || benchmark[field] === null) {
      throw new Error(`quick-xml output is missing ${field}.`);
    }
  }
}

function analyzeAllocations(benchmark, fixture) {
  const samples = benchmark.allocationSamples;
  const summary = benchmark.allocationSummary;
  const average = divideAllocationStats(summary, samples.length);
  return {
    samples,
    summary,
    averagePerRun: average,
    operationsPerEvent: average.allocationOperations / benchmark.eventCount,
    totalAllocatedBytesPerMiB: average.totalAllocatedBytes / fixture.sizeMiB,
    caveats: [
      'Counters start after warmup and immediately before the measured consume call, then stop immediately after consume returns.',
      'The counter is process-global inside this single-threaded comparator binary, so it counts allocator calls made by Rust/quick-xml during the measured window.',
      'The counter has no stack attribution, type attribution, borrowed-vs-owned Cow frequency, or object lifetime information.',
      'The timed throughput row includes allocator counter overhead and must not replace the non-instrumented quick-xml speed baseline.',
    ],
  };
}

function divideAllocationStats(stats, divisor) {
  const copy = {};
  for (const [key, value] of Object.entries(stats)) {
    copy[key] = typeof value === 'number' ? value / divisor : value;
  }
  return copy;
}

function createFindings(benchmark, allocation) {
  return [
    {
      id: 'same-contract-result',
      classification: 'BENCH_FACT',
      summary: 'The allocation-count run preserved the shared full-string checksum contract.',
      evidence: [
        `events=${benchmark.eventCount}`,
        `checksum=${benchmark.checksum}`,
        `instrumentedThroughput=${benchmark.mibPerSec.toFixed(1)} MiB/s`,
      ],
    },
    {
      id: 'measured-allocation-counters',
      classification: 'TRACE_FACT',
      summary: 'The comparator emitted exact global allocator call counters for each measured consume run.',
      evidence: [
        `allocationSamples=${allocation.samples.length}`,
        `avgAllocationOperations=${allocation.averagePerRun.allocationOperations.toFixed(1)}`,
        `avgTotalAllocatedBytes=${formatBytes(allocation.averagePerRun.totalAllocatedBytes)}`,
        `avgNetAllocatedBytes=${formatBytes(allocation.averagePerRun.netAllocatedBytes)}`,
      ],
    },
    {
      id: 'not-js-object-shape',
      classification: 'SOURCE_FACT_LINK',
      summary: 'The measured binary still uses the Rust quick-xml comparator shape, not JavaScript public event objects.',
      evidence: [
        'Pair this report with quick-xml-shape-audit.md for Event lifetime, Cow byte/string, and attribute Vec source facts.',
      ],
    },
    {
      id: 'not-stack-or-lifetime-proof',
      classification: 'LIMITATION',
      summary: 'The counter does not prove allocation stacks, object types, object lifetimes, or borrowed-vs-owned Cow frequency.',
      evidence: allocation.caveats,
    },
  ];
}

function ensureFixture(options) {
  if (!existsSync(options.file) && !options.fileExplicit) {
    generateXmlFile(options.file, 16 * MIB);
  }
  if (!existsSync(options.file)) {
    throw new Error(`Benchmark fixture does not exist: ${options.file}`);
  }
}

function ensureQuickXmlBinary(options) {
  if (options.skipBuild && existsSync(quickXmlExe)) return;
  const result = runCommand('cargo', [
    'build',
    '--release',
    '--features',
    'count-allocations',
    '--manifest-path',
    join(quickXmlDir, 'Cargo.toml'),
  ], repoRoot);
  if (result.error) throw result.error;
  if (result.status !== 0 || !existsSync(quickXmlExe)) {
    throw new Error(`cargo build failed for quick-xml comparator: ${trimSpawnOutput(result)}`);
  }
}

function generateXmlFile(filePath, targetBytes) {
  mkdirSync(dirname(filePath), { recursive: true });
  const fd = openSync(filePath, 'w');
  const header = Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<root>\n');
  const footer = Buffer.from('</root>\n');
  const pending = [];
  let pendingBytes = 0;
  let written = 0;
  let id = 0;

  try {
    writeSync(fd, header);
    written += header.byteLength;
    while (written + pendingBytes + footer.byteLength < targetBytes) {
      const element = Buffer.from(makeBookElement(id));
      if (written + pendingBytes + element.byteLength + footer.byteLength > targetBytes) break;
      pending.push(element);
      pendingBytes += element.byteLength;
      id++;
      if (pendingBytes >= MIB) {
        writeSync(fd, Buffer.concat(pending, pendingBytes));
        written += pendingBytes;
        pending.length = 0;
        pendingBytes = 0;
      }
    }
    if (pendingBytes > 0) {
      writeSync(fd, Buffer.concat(pending, pendingBytes));
    }
    writeSync(fd, footer);
  } finally {
    closeSync(fd);
  }
}

function makeBookElement(id) {
  return `  <book id="book-${id}" lang="en" code="${id % 97}">`
    + `<title>Runtime Benchmark ${id}</title>`
    + `<author>Author ${id % 4096}</author>`
    + `<description>Full string checksum text payload ${id} with stable words and numbers.</description>`
    + `<chapter number="1">Intro ${id}</chapter>`
    + `<chapter number="2">Body ${id}</chapter>`
    + '</book>\n';
}

function renderMarkdown(report) {
  const lines = [
    '# quick-xml Measured Allocation Count',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report is a TRACE_FACT for one Rust + quick-xml binary and one XML fixture.',
    'It counts Rust global allocator calls only inside measured `consume()` windows after warmup.',
    'It preserves the same high-level data/checksum contract, but it is not a JavaScript object-shape row and not a speed baseline.',
    '',
    '## Environment',
    '',
    `- Rust: ${report.environment.rustc}`,
    `- Cargo: ${report.environment.cargo}`,
    `- Platform: ${report.environment.platform}`,
    `- CPU: ${report.environment.cpuName}`,
    `- Fixture: ${report.fixture.path ?? report.fixture.source}`,
    `- Fixture size: ${report.fixture.sizeMiB.toFixed(2)} MiB`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    '',
    '## Benchmark Result',
    '',
    '| Runtime | Instrumented throughput | Average | Events | Checksum |',
    '| --- | ---: | ---: | ---: | ---: |',
    `| ${escapePipe(report.benchmark.runtime)} | ${report.benchmark.mibPerSec.toFixed(1)} MiB/s | ${report.benchmark.avgMs.toFixed(2)} ms | ${report.benchmark.eventCount} | ${report.benchmark.checksum} |`,
    '',
    '## Allocation Counts',
    '',
    '| Metric | Total | Average per run |',
    '| --- | ---: | ---: |',
    allocationRow('allocCount', report),
    allocationRow('allocBytes', report, formatBytes),
    allocationRow('deallocCount', report),
    allocationRow('deallocBytes', report, formatBytes),
    allocationRow('reallocCount', report),
    allocationRow('reallocBytesIn', report, formatBytes),
    allocationRow('reallocBytesOut', report, formatBytes),
    allocationRow('allocationOperations', report),
    allocationRow('totalAllocatedBytes', report, formatBytes),
    allocationRow('totalReleasedBytes', report, formatBytes),
    allocationRow('netAllocatedBytes', report, formatBytes),
    '',
    `Average allocation operations per event: ${report.allocation.operationsPerEvent.toExponential(3)}.`,
    `Average allocated bytes per fixture MiB: ${formatBytes(report.allocation.totalAllocatedBytesPerMiB)}.`,
    '',
    '## Caveats',
    '',
    ...report.allocation.caveats.map(caveat => `- ${caveat}`),
    '',
    '## Findings',
    '',
    ...report.findings.flatMap(finding => [
      `- ${finding.id} (${finding.classification}): ${finding.summary}`,
      ...finding.evidence.map(entry => `  - ${entry}`),
    ]),
    '',
  ];
  return lines.join('\n');
}

function allocationRow(key, report, formatter = formatNumber) {
  return `| ${key} | ${formatter(report.allocation.summary[key])} | ${formatter(report.allocation.averagePerRun[key])} |`;
}

function runCommandChecked(command, args, cwd) {
  const result = runCommand(command, args, cwd);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${trimSpawnOutput(result)}`);
  return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
}

function runCommand(command, args, cwd) {
  if (process.platform === 'win32' && command === 'cargo') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', formatWindowsCommand(command, args)], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 256 * 1024 * 1024,
    });
  }
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  });
}

function formatWindowsCommand(command, args) {
  return [command, ...args].map(quoteWindowsArg).join(' ');
}

function quoteWindowsArg(value) {
  if (/^[A-Za-z0-9_./:=\\+\-]+$/.test(value)) {
    return value;
  }
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function writeOutput(path, content) {
  const resolved = resolve(process.cwd(), path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content, 'utf8');
}

function firstLine(text) {
  return String(text).split(/\r?\n/).find(Boolean) ?? 'unknown';
}

function formatBytes(bytes) {
  const sign = bytes < 0 ? '-' : '';
  const absBytes = Math.abs(bytes);
  if (absBytes >= MIB) return `${sign}${(absBytes / MIB).toFixed(2)} MiB`;
  if (absBytes >= 1024) return `${sign}${(absBytes / 1024).toFixed(1)} KiB`;
  return `${sign}${absBytes.toFixed(0)} B`;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return 'n/a';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

function trimSpawnOutput(result) {
  return String(result.stderr || result.stdout || result.error?.message || '').trim();
}

function escapePipe(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function printSummary(report) {
  console.log('quick-xml allocation count');
  console.log(`throughput=${report.benchmark.mibPerSec.toFixed(1)} MiB/s events=${report.benchmark.eventCount} checksum=${report.benchmark.checksum}`);
  console.log(`allocationOperations=${formatNumber(report.allocation.summary.allocationOperations)} totalAllocated=${formatBytes(report.allocation.summary.totalAllocatedBytes)} netAllocated=${formatBytes(report.allocation.summary.netAllocatedBytes)}`);
}

main();
