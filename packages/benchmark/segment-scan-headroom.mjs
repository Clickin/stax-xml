import { closeSync, existsSync, mkdirSync, openSync, readSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultFile = join(__dirname, 'test-data', 'node-string-return-1024mib.xml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'segment-scan-headroom.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'segment-scan-headroom.md');
const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const variants = [
  'singleton-segment-scan',
  'grouped-concat-scan',
  'grouped-segment-scan',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    chunkKiB: 32,
    batchSize: 8,
    runs: 3,
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
      case '--file':
        options.file = resolve(process.cwd(), readValue());
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
  const report = runProbe(options);
  mkdirSync(dirname(options.jsonOut), { recursive: true });
  writeFileSync(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(options.mdOut, renderMarkdown(report), 'utf8');
  console.log(`segment-scan-headroom: rows=${report.rows.length} fastest=${report.summary.fastest.id} ${formatNumber(report.summary.fastest.mibPerSec)} MiB/s`);
}

function runProbe(options) {
  const fileStats = statSync(options.file);
  const rows = variants.map(id => measureVariant(id, options, fileStats.size / MIB));
  assertSameChecksum(rows);
  const fastest = maxBy(rows, row => row.mibPerSec);
  const concat = rows.find(row => row.id === 'grouped-concat-scan');
  const segmented = rows.find(row => row.id === 'grouped-segment-scan');
  const singleton = rows.find(row => row.id === 'singleton-segment-scan');
  return {
    generatedAt: new Date().toISOString(),
    objective: 'segment-scan-headroom',
    contract: 'file-backed-delimiter-scan-headroom',
    note: 'Benchmark-only probe for the parser-core no-concat hypothesis. Rows consume demand-driven synchronous Iterable<Uint8Array[]> file batches and scan delimiter bytes without XML parsing or string materialization, so these rows are partial headroom evidence and not full StAX counterexamples.',
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
      batchSize: options.batchSize,
      runs: options.runs,
      warmups: options.warmups,
      boundedRssMiB: options.boundedRssMiB,
    },
    rows,
    summary: {
      rowCount: rows.length,
      fastest: summarizeRow(fastest),
      groupedSegmentVsConcatRatio: segmented && concat ? segmented.mibPerSec / concat.mibPerSec : null,
      singletonVsGroupedSegmentRatio: singleton && segmented ? singleton.mibPerSec / segmented.mibPerSec : null,
      counterexamples200MiB: rows.filter(row => row.fullStringParity && row.boundedMemory && row.mibPerSec >= 200).length,
    },
    findings: createFindings(rows, concat, segmented, singleton),
  };
}

function measureVariant(id, options, fileSizeMiB) {
  const chunkBytes = options.chunkKiB * 1024;
  for (let index = 0; index < options.warmups; index++) {
    consumeVariant(id, options.file, chunkBytes, options.batchSize);
  }

  const samplesMs = [];
  const memorySamples = [];
  let first;
  for (let index = 0; index < options.runs; index++) {
    gcNow();
    const before = takeMemorySnapshot();
    const startedAt = performance.now();
    const result = consumeVariant(id, options.file, chunkBytes, options.batchSize);
    const elapsedMs = performance.now() - startedAt;
    const after = takeMemorySnapshot();
    if (first && (result.delimiterCount !== first.delimiterCount || result.checksum !== first.checksum)) {
      throw new Error(`${id} produced unstable delimiter count or checksum.`);
    }
    first ??= result;
    samplesMs.push(elapsedMs);
    memorySamples.push({ before, after });
  }

  const avgMs = average(samplesMs);
  const maxRssBytes = Math.max(...memorySamples.map(sample => sample.after.rssBytes));
  return {
    id,
    tool: id,
    implementation: describeImplementation(id),
    family: 'partial-segment-scan-headroom',
    contractScope: 'delimiter-byte-scan-no-xml-parse-no-string-materialization',
    fullStringParity: false,
    sourceMode: id === 'singleton-segment-scan'
      ? 'file-backed-sync-iterable-byte-batches-singleton'
      : 'file-backed-sync-iterable-byte-batches',
    parserInput: 'synchronous Iterable<Uint8Array[]>',
    demandDrivenSource: true,
    directReadableStream: false,
    fullArrayBufferParserInput: false,
    chunkKiB: options.chunkKiB,
    batchSize: id === 'singleton-segment-scan' ? 1 : options.batchSize,
    concatBeforeScan: id === 'grouped-concat-scan',
    segmentAwareScan: id !== 'grouped-concat-scan',
    mibPerSec: fileSizeMiB / (avgMs / 1000),
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    sampleCount: samplesMs.length,
    sampleSpreadRatio: samplesMs.length > 1 ? (Math.max(...samplesMs) - Math.min(...samplesMs)) / avgMs : 0,
    samplesMs,
    eventCount: first.delimiterCount,
    delimiterCount: first.delimiterCount,
    checksum: first.checksum,
    boundedMemory: maxRssBytes <= options.boundedRssMiB * MIB,
    memory: {
      maxRssBytes,
      maxHeapUsedBytes: Math.max(...memorySamples.map(sample => sample.after.heapUsedBytes)),
      samples: memorySamples,
    },
  };
}

function consumeVariant(id, filePath, chunkBytes, batchSize) {
  if (id === 'singleton-segment-scan') {
    return consumeSegmented(createFileByteBatches(filePath, chunkBytes, 1));
  }
  if (id === 'grouped-segment-scan') {
    return consumeSegmented(createFileByteBatches(filePath, chunkBytes, batchSize));
  }
  if (id === 'grouped-concat-scan') {
    return consumeConcat(createFileByteBatches(filePath, chunkBytes, batchSize));
  }
  throw new Error(`Unknown variant: ${id}`);
}

function consumeSegmented(batches) {
  const state = createScanState();
  for (const batch of batches) {
    for (const chunk of batch) {
      scanDelimiterBytes(chunk, state);
    }
  }
  return finalizeScanState(state);
}

function consumeConcat(batches) {
  const state = createScanState();
  for (const batch of batches) {
    const buffer = batch.length === 1 ? batch[0] : concatUint8Arrays(batch);
    scanDelimiterBytes(buffer, state);
  }
  return finalizeScanState(state);
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

function concatUint8Arrays(chunks) {
  let total = 0;
  for (const chunk of chunks) total += chunk.byteLength;
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
}

function createScanState() {
  return {
    delimiterCount: 0,
    checksum: 0,
  };
}

function scanDelimiterBytes(buffer, state) {
  let checksum = state.checksum;
  let delimiterCount = state.delimiterCount;
  for (let index = 0; index < buffer.length; index++) {
    const byte = buffer[index];
    if (
      byte === 60
      || byte === 62
      || byte === 47
      || byte === 61
      || byte === 34
      || byte === 39
      || byte === 38
      || byte === 63
      || byte === 33
    ) {
      delimiterCount++;
      checksum = mixChecksum(checksum, byte);
    }
  }
  state.checksum = checksum;
  state.delimiterCount = delimiterCount;
}

function finalizeScanState(state) {
  return {
    delimiterCount: state.delimiterCount,
    checksum: mixChecksum(state.checksum, state.delimiterCount),
  };
}

function mixChecksum(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function assertSameChecksum(rows) {
  const first = rows[0];
  for (const row of rows) {
    if (row.delimiterCount !== first.delimiterCount || row.checksum !== first.checksum) {
      throw new Error(`${row.id} does not match ${first.id} delimiter count/checksum.`);
    }
  }
}

function createFindings(rows, concat, segmented, singleton) {
  return [
    {
      id: 'same-byte-scan-contract',
      classification: 'CONTRACT_FACT',
      summary: 'All rows scan the same file-backed bytes and preserve delimiter count plus checksum parity.',
      evidence: unique(rows.map(row => `${row.delimiterCount}:${row.checksum}`)),
    },
    {
      id: 'segment-scan-headroom',
      classification: 'BENCH_FACT',
      summary: concat && segmented
        ? `Grouped segment-aware scan reached ${formatNumber(segmented.mibPerSec)} MiB/s versus grouped concat scan at ${formatNumber(concat.mibPerSec)} MiB/s (${formatNumber(segmented.mibPerSec / concat.mibPerSec)}x).`
        : 'Grouped concat and segment-aware rows were not both measured.',
      evidence: rows.map(row => `${row.id}: ${formatNumber(row.mibPerSec)} MiB/s, concatBeforeScan=${row.concatBeforeScan}`),
    },
    {
      id: 'partial-not-stax-counterexample',
      classification: 'SCOPE_GUARD',
      summary: 'These rows do not parse XML, do not materialize strings, and do not preserve full StAX event semantics; they are no-concat parser-core headroom evidence only.',
      evidence: rows.map(row => `${row.id}: fullStringParity=${row.fullStringParity}, contractScope=${row.contractScope}`),
    },
    {
      id: 'source-contract',
      classification: 'CONTRACT_FACT',
      summary: 'Rows use demand-driven synchronous Iterable<Uint8Array[]> parser-input shape, not direct ReadableStream and not one full ArrayBuffer parser input.',
      evidence: [
        `singletonBatchSize=${singleton?.batchSize ?? 'n/a'}`,
        `groupedBatchSize=${segmented?.batchSize ?? 'n/a'}`,
        'directReadableStream=false',
        'fullArrayBufferParserInput=false',
      ],
    },
  ];
}

function describeImplementation(id) {
  if (id === 'singleton-segment-scan') {
    return 'File-backed sync Iterable<Uint8Array[]> singleton batches scanned as direct segments';
  }
  if (id === 'grouped-concat-scan') {
    return 'File-backed sync Iterable<Uint8Array[]> grouped batches concatenated before delimiter scan';
  }
  if (id === 'grouped-segment-scan') {
    return 'File-backed sync Iterable<Uint8Array[]> grouped batches scanned segment-by-segment without concat';
  }
  return id;
}

function renderMarkdown(report) {
  const lines = [
    '# Segment Scan Headroom',
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
    `- Grouped batch size: ${report.options.batchSize}`,
    `- Fastest row: ${report.summary.fastest.id} ${formatNumber(report.summary.fastest.mibPerSec)} MiB/s`,
    `- Grouped segment / concat ratio: ${formatNullableNumber(report.summary.groupedSegmentVsConcatRatio)}x`,
    `- Singleton / grouped segment ratio: ${formatNullableNumber(report.summary.singletonVsGroupedSegmentRatio)}x`,
    `- 200 MiB/s bounded full-string counterexamples: ${report.summary.counterexamples200MiB}`,
    '',
    '## Rows',
    '',
    '| Row | MiB/s | Samples | Spread | Bounded | Max RSS | Delimiters | Checksum | Batch size | Concat before scan | Segment-aware |',
    '| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- |',
  ];
  for (const row of report.rows) {
    lines.push(`| \`${row.id}\` | ${formatNumber(row.mibPerSec)} | ${row.sampleCount} | ${formatPercent(row.sampleSpreadRatio)} | ${row.boundedMemory ? 'yes' : 'no'} | ${formatBytes(row.memory.maxRssBytes)} | ${row.delimiterCount} | ${row.checksum} | ${row.batchSize} | ${row.concatBeforeScan ? 'yes' : 'no'} | ${row.segmentAwareScan ? 'yes' : 'no'} |`);
  }
  lines.push(
    '',
    '## Findings',
    '',
  );
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push(
    '',
    '## Limits',
    '',
    '- This is a delimiter byte-scan probe only. It does not parse XML, preserve full StAX event semantics, or materialize JavaScript strings.',
    '- A positive segment-scan ratio is implementation headroom, not a full-string runtime counterexample.',
    '- A negative segment-scan ratio does not rule out a full segmented parser; it only rejects this byte-scan shape on this fixture/runtime.',
    '',
  );
  return `${lines.join('\n')}\n`;
}

function summarizeRow(row) {
  return {
    id: row.id,
    mibPerSec: row.mibPerSec,
    boundedMemory: row.boundedMemory,
    memoryKind: 'process-rss',
  };
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

function gcNow() {
  if (globalThis.gc) globalThis.gc();
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxBy(values, selector) {
  return values.reduce((best, value) => best === undefined || selector(value) > selector(best) ? value : best, undefined);
}

function unique(values) {
  return [...new Set(values)];
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function formatNullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function formatPercent(value) {
  return `${formatNumber(value * 100)}%`;
}

function formatBytes(bytes) {
  return typeof bytes === 'number' ? `${formatNumber(bytes / MIB)} MiB` : 'n/a';
}

main();
