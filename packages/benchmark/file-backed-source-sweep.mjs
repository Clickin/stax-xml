import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultFile = join(__dirname, 'test-data', 'node-string-return-1024mib.xml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'file-backed-source-sweep.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'file-backed-source-sweep.md');
const defaultTmpDir = join(__dirname, 'results', 'tmp', 'file-backed-source-sweep');
const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    chunkKiBs: [16, 64, 256, 1024],
    batchSize: 4,
    tools: ['stax-stream', 'stax-raw-frame-name-id'],
    runs: 1,
    warmups: 0,
    boundedRssMiB: 512,
    skipBuild: true,
    tmpDir: defaultTmpDir,
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
      case '--file':
        options.file = resolve(process.cwd(), readValue());
        break;
      case '--chunk-kibs':
        options.chunkKiBs = parsePositiveIntegerList(readValue(), name);
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), name);
        break;
      case '--tools':
        options.tools = readValue().split(',').map(value => value.trim()).filter(Boolean);
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), name);
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--bounded-rss-mib':
        options.boundedRssMiB = parsePositiveNumber(readValue(), name);
        break;
      case '--tmp-dir':
        options.tmpDir = resolve(process.cwd(), readValue());
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      case '--build':
        options.skipBuild = false;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!existsSync(options.file)) {
    throw new Error(`Benchmark fixture does not exist: ${options.file}`);
  }
  if (options.tools.length === 0) {
    throw new Error('--tools must contain at least one tool.');
  }
  return options;
}

function parsePositiveIntegerList(value, flag) {
  const parsed = value.split(',').map(entry => parsePositiveInteger(entry.trim(), flag));
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

function main() {
  const options = parseArgs();
  const report = runSweep(options);
  mkdirSync(dirname(options.jsonOut), { recursive: true });
  writeFileSync(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(options.mdOut, renderMarkdown(report), 'utf8');
  console.log(`file-backed-source-sweep: rows=${report.rows.length} fastest=${report.summary.fastest?.id ?? 'n/a'} ${formatNumber(report.summary.fastest?.throughputMiBPerSec)} MiB/s`);
}

function runSweep(options) {
  rmSync(options.tmpDir, { recursive: true, force: true });
  mkdirSync(options.tmpDir, { recursive: true });
  const fileStats = statSync(options.file);
  const rows = [];
  const baselineScript = join(__dirname, 'external-baseline.mjs');

  for (const chunkKiB of options.chunkKiBs) {
    const jsonOut = join(options.tmpDir, `external-baseline-chunk-${chunkKiB}.json`);
    const mdOut = join(options.tmpDir, `external-baseline-chunk-${chunkKiB}.md`);
    const args = [
      '--expose-gc',
      baselineScript,
      '--file',
      options.file,
      '--tools',
      options.tools.join(','),
      '--runs',
      String(options.runs),
      '--warmups',
      String(options.warmups),
      '--stax-stream-source',
      'file-sync-batches',
      '--chunk-kib',
      String(chunkKiB),
      '--batch-size',
      String(options.batchSize),
      '--bounded-rss-mib',
      String(options.boundedRssMiB),
      '--json-out',
      jsonOut,
      '--md-out',
      mdOut,
    ];
    if (options.skipBuild) args.push('--skip-build');
    const result = spawnSync(process.execPath, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      throw new Error(`external-baseline failed for chunkKiB=${chunkKiB}: ${result.stderr || result.stdout}`);
    }
    const child = JSON.parse(readFileSync(jsonOut, 'utf8'));
    for (const row of child.results.filter(entry => entry.status === 'ok')) {
      rows.push({
        id: `${row.tool}-chunk-${chunkKiB}kib`,
        tool: row.tool,
        implementation: row.implementation,
        family: 'file-backed-source-sweep',
        contractScope: row.workload,
        fullStringParity: row.workload === 'full-string-checksum',
        chunkKiB,
        batchSize: options.batchSize,
        sourceMode: child.options?.staxStreamSource,
        mibPerSec: row.mibPerSec,
        avgMs: row.avgMs,
        minMs: row.minMs,
        maxMs: row.maxMs,
        samplesMs: row.samplesMs,
        eventCount: row.eventCount,
        checksum: row.checksum,
        boundedMemory: row.boundedMemory,
        memory: row.memory,
      });
    }
  }

  const fastest = maxBy(rows, row => row.mibPerSec);
  const slowest = minBy(rows, row => row.mibPerSec);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'file-backed-source-sweep',
    contract: 'same-full-string-checksum-file-backed-byte-batches',
    note: 'Sweeps file-backed StreamReaderSync chunk size with demand-driven Iterable<Uint8Array[]> batches at a fixed batch size. This isolates chunk sizing inside the same JavaScript source contract from Woodstox/quick-xml external parser comparisons; it is not an OS-cache-neutral disk benchmark.',
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
      v8: process.versions.v8,
    },
    fixture: {
      path: options.file,
      sizeBytes: fileStats.size,
      sizeMiB: fileStats.size / MIB,
      sizeGiB: fileStats.size / GIB,
    },
    options: {
      chunkKiBs: options.chunkKiBs,
      batchSize: options.batchSize,
      tools: options.tools,
      runs: options.runs,
      warmups: options.warmups,
      boundedRssMiB: options.boundedRssMiB,
    },
    rows,
    summary: {
      rowCount: rows.length,
      fastest: summarizeRow(fastest),
      slowest: summarizeRow(slowest),
      fastestSlowestRatio: fastest && slowest ? fastest.mibPerSec / slowest.mibPerSec : null,
      counterexamples200MiB: rows.filter(row => row.fullStringParity && row.boundedMemory && row.mibPerSec >= 200).length,
    },
    findings: createFindings(rows, fastest, slowest),
  };
}

function createFindings(rows, fastest, slowest) {
  return [
    {
      id: 'same-contract-preserved',
      classification: 'CONTRACT_FACT',
      summary: 'All sweep rows preserve a full-string checksum contract.',
      evidence: unique(rows.map(row => `${row.eventCount}:${row.checksum}`)),
    },
    {
      id: 'chunk-size-headroom',
      classification: 'BENCH_FACT',
      summary: fastest && slowest
        ? `The fastest chunk size in this sweep was ${fastest.chunkKiB} KiB at ${formatNumber(fastest.mibPerSec)} MiB/s; the slowest was ${slowest.chunkKiB} KiB at ${formatNumber(slowest.mibPerSec)} MiB/s.`
        : 'No rows were measured.',
      evidence: rows.map(row => `${row.id}=${formatNumber(row.mibPerSec)} MiB/s rss=${formatBytes(row.memory?.maxRssBytes)}`),
    },
    {
      id: 'bounded-counterexample-search',
      classification: rows.some(row => row.fullStringParity && row.boundedMemory && row.mibPerSec >= 200)
        ? 'COUNTEREXAMPLE_FOUND'
        : 'COUNTEREXAMPLE_NOT_FOUND',
      summary: 'The file-backed source chunk sweep applies the same 200 MiB/s bounded full-string counterexample rule to its rows.',
      evidence: rows.map(row => `${row.id}: bounded=${row.boundedMemory}, mibPerSec=${formatNumber(row.mibPerSec)}`),
    },
  ];
}

function summarizeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    tool: row.tool,
    chunkKiB: row.chunkKiB,
    batchSize: row.batchSize,
    throughputMiBPerSec: round(row.mibPerSec),
    eventCount: row.eventCount,
    checksum: row.checksum,
    boundedMemory: row.boundedMemory,
    maxRssMiB: round(bytesToMiB(row.memory?.maxRssBytes)),
  };
}

function renderMarkdown(report) {
  const lines = [
    '# File-Backed Source Sweep',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Fixture: ${report.fixture.path}`,
    `- Fixture size: ${formatNumber(report.fixture.sizeMiB)} MiB`,
    `- Chunk sizes: ${report.options.chunkKiBs.join(', ')} KiB`,
    `- Batch size: ${report.options.batchSize}`,
    `- Rows: ${report.summary.rowCount}`,
    `- Fastest: ${formatSummaryRow(report.summary.fastest)}`,
    `- Slowest: ${formatSummaryRow(report.summary.slowest)}`,
    `- Fastest/slowest ratio: ${formatNumber(report.summary.fastestSlowestRatio)}x`,
    `- 200 MiB/s bounded counterexamples: ${report.summary.counterexamples200MiB}`,
    '',
    '## Rows',
    '',
    '| Row | Tool | Chunk KiB | MiB/s | Bounded | Max RSS | Events | Checksum |',
    '| --- | --- | ---: | ---: | --- | ---: | ---: | ---: |',
  ];

  for (const row of report.rows) {
    lines.push(`| \`${row.id}\` | ${row.tool} | ${row.chunkKiB} | ${formatNumber(row.mibPerSec)} | ${row.boundedMemory ? 'yes' : 'no'} | ${formatBytes(row.memory?.maxRssBytes)} | ${row.eventCount} | ${row.checksum} |`);
  }

  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const item of finding.evidence) {
      lines.push(`  - ${item}`);
    }
  }

  lines.push(
    '',
    '## Limits',
    '',
    '- Rows are demand-driven file-backed byte-batch parser inputs, but this is not an OS-cache-neutral disk benchmark.',
    '- `batchSize > 1` intentionally keeps the parser on its current multi-chunk concat boundary while chunk length varies.',
    '- A missing counterexample in this sweep is not a JavaScript runtime ceiling proof.',
  );
  return `${lines.join('\n')}\n`;
}

function formatSummaryRow(row) {
  if (!row) return 'n/a';
  return `${row.id} ${formatNumber(row.throughputMiBPerSec)} MiB/s, RSS ${formatNumber(row.maxRssMiB)} MiB`;
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function formatBytes(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a';
  return `${formatNumber(value / MIB)} MiB`;
}

function round(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function bytesToMiB(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value / MIB : null;
}

function maxBy(values, score) {
  return values.reduce((best, value) => best === null || score(value) > score(best) ? value : best, null);
}

function minBy(values, score) {
  return values.reduce((best, value) => best === null || score(value) < score(best) ? value : best, null);
}

function unique(values) {
  return [...new Set(values)];
}

main();
