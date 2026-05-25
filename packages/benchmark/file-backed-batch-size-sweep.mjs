import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultFile = join(__dirname, 'test-data', 'node-string-return-1024mib.xml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'file-backed-batch-size-sweep.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'file-backed-batch-size-sweep.md');
const defaultTmpDir = join(__dirname, 'results', 'tmp', 'file-backed-batch-size-sweep');
const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    chunkKiB: 64,
    batchSizes: [1, 2, 4, 8, 16],
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
      case '--chunk-kib':
        options.chunkKiB = parsePositiveInteger(readValue(), name);
        break;
      case '--batch-sizes':
        options.batchSizes = parsePositiveIntegerList(readValue(), name);
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
  console.log(`file-backed-batch-size-sweep: rows=${report.rows.length} fastest=${report.summary.fastest?.id ?? 'n/a'} ${formatNumber(report.summary.fastest?.throughputMiBPerSec)} MiB/s`);
}

function runSweep(options) {
  rmSync(options.tmpDir, { recursive: true, force: true });
  mkdirSync(options.tmpDir, { recursive: true });
  const fileStats = statSync(options.file);
  const rows = [];
  const baselineScript = join(__dirname, 'external-baseline.mjs');

  for (const batchSize of options.batchSizes) {
    const jsonOut = join(options.tmpDir, `external-baseline-batch-${batchSize}.json`);
    const mdOut = join(options.tmpDir, `external-baseline-batch-${batchSize}.md`);
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
      String(options.chunkKiB),
      '--batch-size',
      String(batchSize),
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
      throw new Error(`external-baseline failed for batchSize=${batchSize}: ${result.stderr || result.stdout}`);
    }
    const child = JSON.parse(readFileSync(jsonOut, 'utf8'));
    for (const row of child.results.filter(entry => entry.status === 'ok')) {
      rows.push({
        id: `${row.tool}-batch-${batchSize}`,
        tool: row.tool,
        implementation: row.implementation,
        family: 'file-backed-batch-size-sweep',
        contractScope: row.workload,
        fullStringParity: row.workload === 'full-string-checksum',
        chunkKiB: options.chunkKiB,
        batchSize,
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
    objective: 'file-backed-batch-size-sweep',
    contract: 'same-full-string-checksum-file-backed-byte-batch-size',
    note: 'Sweeps the number of Uint8Array chunks yielded per demand-driven Iterable<Uint8Array[]> batch at a fixed file chunk size. This tests whether array batching itself exposes headroom without switching to direct ReadableStream consumption or pre-materializing the XML file.',
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
      chunkKiB: options.chunkKiB,
      batchSizes: options.batchSizes,
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
      summary: 'All batch-size rows preserve a full-string checksum contract.',
      evidence: unique(rows.map(row => `${row.eventCount}:${row.checksum}`)),
    },
    {
      id: 'batch-size-headroom',
      classification: 'BENCH_FACT',
      summary: fastest && slowest
        ? `The fastest batch size in this sweep was ${fastest.batchSize} at ${formatNumber(fastest.mibPerSec)} MiB/s; the slowest was ${slowest.batchSize} at ${formatNumber(slowest.mibPerSec)} MiB/s.`
        : 'No rows were measured.',
      evidence: rows.map(row => `${row.id}=${formatNumber(row.mibPerSec)} MiB/s rss=${formatBytes(row.memory?.maxRssBytes)}`),
    },
    {
      id: 'bounded-counterexample-search',
      classification: rows.some(row => row.fullStringParity && row.boundedMemory && row.mibPerSec >= 200)
        ? 'COUNTEREXAMPLE_FOUND'
        : 'COUNTEREXAMPLE_NOT_FOUND',
      summary: 'The file-backed batch-size sweep applies the same 200 MiB/s bounded full-string counterexample rule to its rows.',
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
    '# File-Backed Batch Size Sweep',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Fixture: ${report.fixture.path}`,
    `- Fixture size: ${formatNumber(report.fixture.sizeMiB)} MiB`,
    `- Chunk KiB: ${report.options.chunkKiB}`,
    `- Batch sizes: ${report.options.batchSizes.join(', ')}`,
    `- Rows: ${report.summary.rowCount}`,
    `- Fastest: ${formatSummaryRow(report.summary.fastest)}`,
    `- Slowest: ${formatSummaryRow(report.summary.slowest)}`,
    `- Fastest/slowest ratio: ${formatNumber(report.summary.fastestSlowestRatio)}x`,
    `- 200 MiB/s bounded counterexamples: ${report.summary.counterexamples200MiB}`,
    '',
    '## Rows',
    '',
    '| Row | Tool | Batch Size | MiB/s | Bounded | Max RSS | Events | Checksum |',
    '| --- | --- | ---: | ---: | --- | ---: | ---: | ---: |',
  ];

  for (const row of report.rows) {
    lines.push(`| \`${row.id}\` | ${row.tool} | ${row.batchSize} | ${formatNumber(row.mibPerSec)} | ${row.boundedMemory ? 'yes' : 'no'} | ${formatBytes(row.memory?.maxRssBytes)} | ${row.eventCount} | ${row.checksum} |`);
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
    '- Rows are demand-driven file-backed `Iterable<Uint8Array[]>` parser inputs; each yielded array contains at most the configured number of chunks.',
    '- This is not a direct Web `ReadableStream` row and does not pre-materialize the full XML file.',
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
