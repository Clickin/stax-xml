import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StreamReaderSync } from '../stax-xml/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultFile = join(__dirname, 'test-data', 'node-string-return-1024mib.xml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'file-backed-materialization-category-drop-sweep.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'file-backed-materialization-category-drop-sweep.md');
const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

const START_ELEMENT = 2;
const END_ELEMENT = 3;
const CHARACTERS = 4;
const CDATA = 5;

const allVariants = [
  'stringFull',
  'withoutElementNameStrings',
  'withoutTextStrings',
  'withoutAttributeNameStrings',
  'withoutAttributeValueStrings',
];

const variantFields = {
  stringFull: {
    name: true,
    text: true,
    attrName: true,
    attrValue: true,
    contractScope: 'full-string-materialization',
  },
  withoutElementNameStrings: {
    name: false,
    text: true,
    attrName: true,
    attrValue: true,
    contractScope: 'full-materialization-minus-element-names',
  },
  withoutTextStrings: {
    name: true,
    text: false,
    attrName: true,
    attrValue: true,
    contractScope: 'full-materialization-minus-text-cdata',
  },
  withoutAttributeNameStrings: {
    name: true,
    text: true,
    attrName: false,
    attrValue: true,
    contractScope: 'full-materialization-minus-attribute-names',
  },
  withoutAttributeValueStrings: {
    name: true,
    text: true,
    attrName: true,
    attrValue: false,
    contractScope: 'full-materialization-minus-attribute-values',
  },
};

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    mode: 'driver',
    file: defaultFile,
    variants: allVariants,
    variant: 'stringFull',
    chunkKiB: 64,
    batchSize: 1,
    runs: 1,
    warmups: 0,
    boundedRssMiB: 512,
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
      case '--mode':
        options.mode = parseChoice(readValue(), ['driver', 'run'], name);
        break;
      case '--file':
        options.file = resolve(process.cwd(), readValue());
        break;
      case '--variants':
        options.variants = parseList(readValue(), allVariants, name);
        break;
      case '--variant':
        options.variant = parseChoice(readValue(), allVariants, name);
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
  return options;
}

function parseChoice(value, allowed, flag) {
  if (!allowed.includes(value)) throw new Error(`${flag} must be one of: ${allowed.join(', ')}`);
  return value;
}

function parseList(value, allowed, flag) {
  if (value === 'all') return [...allowed];
  const entries = value.split(',').map(entry => entry.trim()).filter(Boolean);
  if (entries.length === 0) throw new Error(`${flag} must not be empty.`);
  for (const entry of entries) {
    if (!allowed.includes(entry)) throw new Error(`${flag} contains unknown id ${entry}.`);
  }
  return entries;
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
  if (options.mode === 'run') {
    console.log(JSON.stringify(runVariantProcess(options)));
    return;
  }
  const report = runDriver(options);
  mkdirSync(dirname(options.jsonOut), { recursive: true });
  writeFileSync(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(options.mdOut, renderMarkdown(report), 'utf8');
  console.log(`file-backed-materialization-category-drop-sweep: rows=${report.rows.length} fastest=${report.summary.fastest?.id ?? 'n/a'} ${formatNumber(report.summary.fastest?.throughputMiBPerSec)} MiB/s`);
}

function runDriver(options) {
  const fileStats = statSync(options.file);
  const rows = [];
  for (const variant of options.variants) {
    const result = spawnSync(process.execPath, [
      '--expose-gc',
      fileURLToPath(import.meta.url),
      '--mode=run',
      `--file=${options.file}`,
      `--variant=${variant}`,
      `--chunk-kib=${options.chunkKiB}`,
      `--batch-size=${options.batchSize}`,
      `--runs=${options.runs}`,
      `--warmups=${options.warmups}`,
      `--bounded-rss-mib=${options.boundedRssMiB}`,
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      throw new Error(`Variant ${variant} failed: ${result.stderr || result.stdout}`);
    }
    const lines = result.stdout.trim().split(/\r?\n/);
    rows.push(JSON.parse(lines[lines.length - 1]));
  }

  const fastest = maxBy(rows, row => row.mibPerSec);
  const fullRows = rows.filter(row => row.fullStringParity);
  const fastestFullString = maxBy(fullRows, row => row.mibPerSec);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'file-backed-materialization-category-drop-sweep',
    contract: 'file-backed-full-materialization-category-drop-headroom',
    note: 'Measures the cost of each string materialization category over the same file-backed synchronous Iterable<Uint8Array[]> source. Near-full rows intentionally omit one category and are headroom evidence, not full StAX counterexamples.',
    environment: {
      node: process.version,
      v8: process.versions.v8,
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
    },
    fixture: {
      source: 'file-backed',
      path: options.file,
      sizeBytes: fileStats.size,
      sizeMiB: fileStats.size / MIB,
      sizeGiB: fileStats.size / GIB,
    },
    options: {
      variants: options.variants,
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
      counterexamples200MiB: rows.filter(row => row.fullStringParity && row.boundedMemory && row.mibPerSec >= 200).length,
      partialThresholdRows: rows
        .filter(row => !row.fullStringParity && row.boundedMemory && row.mibPerSec >= 200)
        .map(summarizeRow),
      checksumSet: [...new Set(rows.map(row => row.checksum))],
      eventCountSet: [...new Set(rows.map(row => row.eventCount))],
    },
    findings: createFindings(rows, fastest, fastestFullString),
  };
}

function runVariantProcess(options) {
  const fileStats = statSync(options.file);
  for (let index = 0; index < options.warmups; index++) runVariant(options.variant, options);
  const samplesMs = [];
  const memorySamples = [];
  let eventCount = 0;
  let checksum = 0;
  let materializationCounters = null;
  for (let index = 0; index < options.runs; index++) {
    gcNow();
    const before = takeMemorySnapshot();
    const startedAt = performance.now();
    const result = runVariant(options.variant, options);
    const elapsedMs = performance.now() - startedAt;
    const after = takeMemorySnapshot();
    if (index > 0 && (eventCount !== result.eventCount || checksum !== result.checksum)) {
      throw new Error(`${options.variant} produced unstable event count or checksum.`);
    }
    eventCount = result.eventCount;
    checksum = result.checksum;
    materializationCounters = result.materializationCounters;
    samplesMs.push(elapsedMs);
    memorySamples.push({ before, after });
  }
  const avgMs = samplesMs.reduce((sum, value) => sum + value, 0) / samplesMs.length;
  const maxRssBytes = Math.max(...memorySamples.map(sample => sample.after.rssBytes));
  const maxHeapUsedBytes = Math.max(...memorySamples.map(sample => sample.after.heapUsedBytes));
  const fields = variantFields[options.variant];
  return {
    id: options.variant,
    tool: options.variant,
    implementation: describeVariant(options.variant),
    family: fields.name && fields.text && fields.attrName && fields.attrValue ? 'full-stax-js' : 'near-full-upper-bound',
    sourceMode: 'file-backed-sync-iterable-byte-batches',
    contractScope: fields.contractScope,
    fullStringParity: fields.contractScope === 'full-string-materialization',
    chunkKiB: options.chunkKiB,
    batchSize: options.batchSize,
    mibPerSec: (fileStats.size / MIB) / (avgMs / 1000),
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    samplesMs,
    eventCount,
    checksum,
    materializationCounters,
    boundedMemory: maxRssBytes <= options.boundedRssMiB * 1024 * 1024,
    memory: {
      maxRssBytes,
      maxHeapUsedBytes,
      samples: memorySamples,
    },
  };
}

function runVariant(variant, options) {
  return consumeSelective(
    createFileByteBatches(options.file, options.chunkKiB * 1024, options.batchSize),
    variantFields[variant],
  );
}

function consumeSelective(bytes, fields) {
  const materializationCounters = createMaterializationCounters();
  let eventCount = 0;
  let checksum = 0;
  for (const batch of new StreamReaderSync(bytes)) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const type = batch.typeAt(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);
      if ((type === START_ELEMENT || type === END_ELEMENT) && fields.name) {
        materializationCounters.nameStrings++;
        materializationCounters.stringFieldReads++;
        checksum = foldString(checksum, batch.nameAt(index));
      }
      if ((type === CHARACTERS || type === CDATA) && fields.text) {
        materializationCounters.textStrings++;
        materializationCounters.stringFieldReads++;
        checksum = foldString(checksum, batch.textAt(index)?.trim());
      }
      if (type === START_ELEMENT) {
        const attrCount = batch.attributeCountAt(index);
        materializationCounters.attributePairs += attrCount;
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          if (fields.attrName) {
            materializationCounters.attributeNameStrings++;
            materializationCounters.stringFieldReads++;
            checksum = foldString(checksum, batch.attributeNameAt(index, attrIndex));
          }
          if (fields.attrValue) {
            materializationCounters.attributeValueStrings++;
            materializationCounters.stringFieldReads++;
            checksum = foldString(checksum, batch.attributeValueAt(index, attrIndex));
          }
        }
      }
    }
  }
  return { eventCount, checksum, materializationCounters };
}

function createMaterializationCounters() {
  return {
    stringFieldReads: 0,
    nameStrings: 0,
    textStrings: 0,
    attributeNameStrings: 0,
    attributeValueStrings: 0,
    attributePairs: 0,
  };
}

function* createFileByteBatches(filePath, chunkBytes, batchSize) {
  const fd = openSync(filePath, 'r');
  try {
    while (true) {
      const batch = [];
      for (let index = 0; index < batchSize; index++) {
        const buffer = new Uint8Array(chunkBytes);
        const bytesRead = readSync(fd, buffer, 0, chunkBytes, null);
        if (bytesRead === 0) break;
        batch.push(bytesRead === chunkBytes ? buffer : buffer.subarray(0, bytesRead));
      }
      if (batch.length === 0) return;
      yield batch;
    }
  } finally {
    closeSync(fd);
  }
}

function createFindings(rows, fastest, fastestFullString) {
  const partialRows = rows.filter(row => !row.fullStringParity);
  return [
    {
      id: 'same-source-contract',
      classification: 'CONTRACT_FACT',
      summary: 'All rows consume the same file-backed synchronous Iterable<Uint8Array[]> source shape.',
      evidence: [...new Set(rows.map(row => `${row.sourceMode} chunk=${row.chunkKiB}KiB batch=${row.batchSize}`))],
    },
    {
      id: 'category-drop-headroom',
      classification: partialRows.some(row => row.mibPerSec >= 200) ? 'HEADROOM_EVIDENCE' : 'BENCH_FACT',
      summary: fastest
        ? `Fastest category row was ${fastest.id} at ${formatNumber(fastest.mibPerSec)} MiB/s; fastest full-string row was ${fastestFullString?.id ?? 'n/a'} at ${formatNumber(fastestFullString?.mibPerSec)} MiB/s.`
        : 'No rows were measured.',
      evidence: rows.map(row => `${row.id}=${formatNumber(row.mibPerSec)} MiB/s fullString=${row.fullStringParity} strings=${row.materializationCounters.stringFieldReads}`),
    },
    {
      id: 'bounded-counterexample-search',
      classification: rows.some(row => row.fullStringParity && row.boundedMemory && row.mibPerSec >= 200)
        ? 'COUNTEREXAMPLE_FOUND'
        : 'COUNTEREXAMPLE_NOT_FOUND',
      summary: 'The file-backed category-drop sweep applies the same 200 MiB/s bounded full-string counterexample rule.',
      evidence: rows.map(row => `${row.id}: bounded=${row.boundedMemory}, mibPerSec=${formatNumber(row.mibPerSec)}`),
    },
  ];
}

function summarizeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    throughputMiBPerSec: row.mibPerSec,
    maxRssBytes: row.memory?.maxRssBytes ?? null,
    eventCount: row.eventCount,
    checksum: row.checksum,
    fullStringParity: row.fullStringParity,
    contractScope: row.contractScope,
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# File-Backed Materialization Category Drop Sweep');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(report.note);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Fixture: ${report.fixture.path}`);
  lines.push(`- Fixture size: ${formatNumber(report.fixture.sizeMiB)} MiB`);
  lines.push(`- Source shape: file-backed sync Iterable<Uint8Array[]>`);
  lines.push(`- Chunk KiB: ${report.options.chunkKiB}`);
  lines.push(`- Batch size: ${report.options.batchSize}`);
  lines.push(`- Fastest row: ${formatSummaryRow(report.summary.fastest)}`);
  lines.push(`- Fastest full-string row: ${formatSummaryRow(report.summary.fastestFullString)}`);
  lines.push(`- 200 MiB/s bounded full-string counterexamples: ${report.summary.counterexamples200MiB}`);
  lines.push(`- 200 MiB/s bounded partial/headroom rows: ${report.summary.partialThresholdRows.length}`);
  lines.push('');
  lines.push('## Rows');
  lines.push('');
  lines.push('| Row | Contract scope | MiB/s | Full string | Bounded | Max RSS | String fields | Events | Checksum |');
  lines.push('| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: |');
  for (const row of report.rows) {
    lines.push(`| \`${row.id}\` | ${row.contractScope} | ${formatNumber(row.mibPerSec)} | ${row.fullStringParity ? 'yes' : 'no'} | ${row.boundedMemory ? 'yes' : 'no'} | ${formatBytes(row.memory?.maxRssBytes)} | ${row.materializationCounters.stringFieldReads} | ${row.eventCount} | ${row.checksum} |`);
  }
  lines.push('');
  lines.push('## Materialization Counters');
  lines.push('');
  lines.push('| Row | Name | Text | Attr name | Attr value | Attribute pairs |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
  for (const row of report.rows) {
    const counters = row.materializationCounters;
    lines.push(`| \`${row.id}\` | ${counters.nameStrings} | ${counters.textStrings} | ${counters.attributeNameStrings} | ${counters.attributeValueStrings} | ${counters.attributePairs} |`);
  }
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) lines.push(`  - ${evidence}`);
  }
  lines.push('');
  lines.push('## Limits');
  lines.push('');
  lines.push('- Near-full rows intentionally omit one string category and cannot be used as StAX full-materialization counterexamples.');
  lines.push('- This is a file-backed source-shape artifact, not a direct ReadableStream row and not an OS-cache-neutral disk benchmark.');
  lines.push('- A missing counterexample in this artifact is not a JavaScript runtime ceiling proof.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function describeVariant(variant) {
  switch (variant) {
    case 'stringFull':
      return 'public StreamBatch full string materialization from file-backed byte batches';
    case 'withoutElementNameStrings':
      return 'file-backed full materialization minus element name string reads';
    case 'withoutTextStrings':
      return 'file-backed full materialization minus text/CDATA string reads';
    case 'withoutAttributeNameStrings':
      return 'file-backed full materialization minus attribute name string reads';
    case 'withoutAttributeValueStrings':
      return 'file-backed full materialization minus attribute value string reads';
    default:
      return variant;
  }
}

function mixChecksum(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function foldString(seed, value) {
  if (!value) return seed;
  let next = seed;
  for (let index = 0; index < value.length; index++) {
    next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  }
  return next;
}

function gcNow() {
  if (globalThis.gc) globalThis.gc();
}

function takeMemorySnapshot() {
  const usage = process.memoryUsage();
  return {
    rssBytes: usage.rss,
    heapUsedBytes: usage.heapUsed,
    externalBytes: usage.external,
    arrayBuffersBytes: usage.arrayBuffers,
  };
}

function maxBy(values, score) {
  let best = null;
  let bestScore = -Infinity;
  for (const value of values) {
    const nextScore = score(value);
    if (nextScore > bestScore) {
      best = value;
      bestScore = nextScore;
    }
  }
  return best;
}

function formatSummaryRow(row) {
  if (!row) return 'n/a';
  return `${row.id} ${formatNumber(row.throughputMiBPerSec)} MiB/s, RSS ${formatBytes(row.maxRssBytes)}`;
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function formatBytes(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${formatNumber(value / MIB)} MiB` : 'n/a';
}

main();
