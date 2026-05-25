import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultFile = join(__dirname, 'test-data', 'node-string-return-1024mib.xml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'file-backed-core-decomposition.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'file-backed-core-decomposition.md');
const defaultTmpDir = join(__dirname, 'results', 'tmp', 'file-backed-core-decomposition');
const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

const defaultTools = [
  'stax-scan-all-no-decode',
  'stax-raw-frame-semantic-checksum',
  'stax-stream',
  'stax-raw-frame-name-id',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    tools: defaultTools,
    chunkKiB: 32,
    batchSize: 4,
    runs: 1,
    warmups: 0,
    boundedRssMiB: 512,
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
      case '--tools':
        options.tools = readValue().split(',').map(value => value.trim()).filter(Boolean);
        break;
      case '--chunk-kib':
        options.chunkKiB = parsePositiveInteger(readValue(), name);
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), name);
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
  const report = runDecomposition(options);
  mkdirSync(dirname(options.jsonOut), { recursive: true });
  writeFileSync(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(options.mdOut, renderMarkdown(report), 'utf8');
  console.log(`file-backed-core-decomposition: rows=${report.rows.length} fastest=${report.summary.fastest?.id ?? 'n/a'} ${formatNumber(report.summary.fastest?.throughputMiBPerSec)} MiB/s`);
}

function runDecomposition(options) {
  rmSync(options.tmpDir, { recursive: true, force: true });
  mkdirSync(options.tmpDir, { recursive: true });
  const fileStats = statSync(options.file);
  const baselineScript = join(__dirname, 'external-baseline.mjs');
  const rows = [];

  for (const tool of options.tools) {
    const jsonOut = join(options.tmpDir, `${tool}.json`);
    const mdOut = join(options.tmpDir, `${tool}.md`);
    const result = spawnSync(process.execPath, [
      '--expose-gc',
      baselineScript,
      '--file',
      options.file,
      '--tools',
      tool,
      '--runs',
      String(options.runs),
      '--warmups',
      String(options.warmups),
      '--skip-build',
      '--stax-stream-source',
      'file-sync-batches',
      '--chunk-kib',
      String(options.chunkKiB),
      '--batch-size',
      String(options.batchSize),
      '--bounded-rss-mib',
      String(options.boundedRssMiB),
      '--json-out',
      jsonOut,
      '--md-out',
      mdOut,
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      throw new Error(`external-baseline failed for ${tool}: ${result.stderr || result.stdout}`);
    }
    const child = JSON.parse(readFileSync(jsonOut, 'utf8'));
    const row = child.results.find(entry => entry.status === 'ok');
    if (!row) {
      throw new Error(`No ok result emitted for ${tool}`);
    }
    rows.push({
      id: tool,
      tool,
      implementation: row.implementation,
      family: classifyFamily(row),
      contractScope: row.contractScope ?? row.workload,
      fullStringParity: classifyFullStringParity(row),
      chunkKiB: options.chunkKiB,
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

  const fastest = maxBy(rows, row => row.mibPerSec);
  const fullStringRows = rows.filter(row => row.fullStringParity);
  const fastestFullString = maxBy(fullStringRows, row => row.mibPerSec);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'file-backed-core-decomposition',
    contract: 'file-backed-parser-core-materialization-decomposition',
    note: 'Runs each parser-core consumption shape in a fresh Node process over the same demand-driven file-backed byte batches. Partial rows expose parser/frame headroom but are not full-string StAX counterexamples.',
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
      tools: options.tools,
      chunkKiB: options.chunkKiB,
      batchSize: options.batchSize,
      runs: options.runs,
      warmups: options.warmups,
      boundedRssMiB: options.boundedRssMiB,
    },
    rows,
    summary: {
      rowCount: rows.length,
      fastest: summarizeRow(fastest),
      fastestFullString: summarizeRow(fastestFullString),
      partialThresholdRows: rows
        .filter(row => !row.fullStringParity && row.boundedMemory && row.mibPerSec >= 200)
        .map(summarizeRow),
      counterexamples200MiB: rows.filter(row => row.fullStringParity && row.boundedMemory && row.mibPerSec >= 200).length,
    },
    findings: createFindings(rows, fastest, fastestFullString),
  };
}

function classifyFamily(row) {
  if (classifyFullStringParity(row)) return 'full-string-materialization';
  if (/scan/i.test(row.contractScope ?? row.workload ?? '')) return 'partial-scan';
  return 'same-fields-no-string-materialization';
}

function classifyFullStringParity(row) {
  if (row.fullStringParity === true) return true;
  if (row.fullStringParity === false) return false;
  return row.workload === 'full-string-checksum';
}

function createFindings(rows, fastest, fastestFullString) {
  return [
    {
      id: 'fresh-process-parser-core-decomposition',
      classification: 'BENCH_FACT',
      summary: 'Parser-core consumption shapes were measured in separate Node processes over the same file-backed source contract.',
      evidence: rows.map(row => `${row.id}=${formatNumber(row.mibPerSec)} MiB/s fullString=${row.fullStringParity}`),
    },
    {
      id: 'same-fields-without-string-materialization',
      classification: 'HEADROOM_EVIDENCE',
      summary: 'The semantic byte-fold row preserves event count and checksum of the full-string row while avoiding JavaScript string materialization on ASCII spans.',
      evidence: rows
        .filter(row => row.id === 'stax-raw-frame-semantic-checksum' || row.fullStringParity)
        .map(row => `${row.id}: events=${row.eventCount}, checksum=${row.checksum}, mibPerSec=${formatNumber(row.mibPerSec)}`),
    },
    {
      id: 'bounded-counterexample-search',
      classification: rows.some(row => row.fullStringParity && row.boundedMemory && row.mibPerSec >= 200)
        ? 'COUNTEREXAMPLE_FOUND'
        : 'COUNTEREXAMPLE_NOT_FOUND',
      summary: fastestFullString
        ? `Fastest bounded full-string row was ${fastestFullString.id} at ${formatNumber(fastestFullString.mibPerSec)} MiB/s.`
        : 'No full-string row was measured.',
      evidence: [
        `fastest=${fastest?.id ?? 'n/a'} ${formatNumber(fastest?.mibPerSec)} MiB/s`,
        `fastestFullString=${fastestFullString?.id ?? 'n/a'} ${formatNumber(fastestFullString?.mibPerSec)} MiB/s`,
      ],
    },
  ];
}

function summarizeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    family: row.family,
    throughputMiBPerSec: round(row.mibPerSec),
    eventCount: row.eventCount,
    checksum: row.checksum,
    boundedMemory: row.boundedMemory,
    maxRssMiB: round(bytesToMiB(row.memory?.maxRssBytes)),
  };
}

function renderMarkdown(report) {
  const lines = [
    '# File-Backed Core Decomposition',
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
    `- Batch size: ${report.options.batchSize}`,
    `- Fastest row: ${formatSummaryRow(report.summary.fastest)}`,
    `- Fastest full-string row: ${formatSummaryRow(report.summary.fastestFullString)}`,
    `- 200 MiB/s bounded full-string counterexamples: ${report.summary.counterexamples200MiB}`,
    `- 200 MiB/s bounded partial/headroom rows: ${report.summary.partialThresholdRows.length}`,
    '',
    '## Rows',
    '',
    '| Row | Family | MiB/s | Full string | Bounded | Max RSS | Events | Checksum |',
    '| --- | --- | ---: | --- | --- | ---: | ---: | ---: |',
  ];

  for (const row of report.rows) {
    lines.push(`| \`${row.id}\` | ${row.family} | ${formatNumber(row.mibPerSec)} | ${row.fullStringParity ? 'yes' : 'no'} | ${row.boundedMemory ? 'yes' : 'no'} | ${formatBytes(row.memory?.maxRssBytes)} | ${row.eventCount} | ${row.checksum} |`);
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
    '- Partial and semantic byte-fold rows are headroom evidence, not full-string materialization counterexamples.',
    '- This isolates parser consumption shape over file-backed byte batches, not OS-cache-neutral disk throughput.',
    '- A missing counterexample in this artifact is not a JavaScript runtime ceiling proof.',
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

main();
