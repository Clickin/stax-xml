import { closeSync, existsSync, mkdirSync, openSync, readSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultFile = join(__dirname, 'test-data', 'node-string-return-1024mib.xml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'segment-tokenizer-headroom.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'segment-tokenizer-headroom.md');
const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const variants = [
  'singleton-segment-tokenize',
  'grouped-concat-tokenize',
  'grouped-segment-tokenize',
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
  console.log(`segment-tokenizer-headroom: rows=${report.rows.length} fastest=${report.summary.fastest.id} ${formatNumber(report.summary.fastest.mibPerSec)} MiB/s`);
}

function runProbe(options) {
  const fileStats = statSync(options.file);
  const rows = variants.map(id => measureVariant(id, options, fileStats.size / MIB));
  assertSameTokenContract(rows);
  const fastest = maxBy(rows, row => row.mibPerSec);
  const concat = rows.find(row => row.id === 'grouped-concat-tokenize');
  const segmented = rows.find(row => row.id === 'grouped-segment-tokenize');
  const singleton = rows.find(row => row.id === 'singleton-segment-tokenize');
  return {
    generatedAt: new Date().toISOString(),
    objective: 'segment-tokenizer-headroom',
    contract: 'file-backed-xml-token-boundary-headroom',
    note: 'Benchmark-only probe for the parser-core no-concat hypothesis after XML token-boundary work is added. Rows consume demand-driven synchronous Iterable<Uint8Array[]> file batches and fold start/end/text/attribute-count events without JavaScript string materialization, so these rows are partial headroom evidence and not full StAX counterexamples.',
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
    if (first && !sameTokenResult(first, result)) {
      throw new Error(`${id} produced unstable token counters or checksum.`);
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
    family: 'partial-segment-tokenizer-headroom',
    contractScope: 'xml-token-boundary-no-string-materialization',
    fullStringParity: false,
    sourceMode: id === 'singleton-segment-tokenize'
      ? 'file-backed-sync-iterable-byte-batches-singleton'
      : 'file-backed-sync-iterable-byte-batches',
    parserInput: 'synchronous Iterable<Uint8Array[]>',
    demandDrivenSource: true,
    directReadableStream: false,
    fullArrayBufferParserInput: false,
    chunkKiB: options.chunkKiB,
    batchSize: id === 'singleton-segment-tokenize' ? 1 : options.batchSize,
    concatBeforeTokenize: id === 'grouped-concat-tokenize',
    segmentAwareTokenize: id !== 'grouped-concat-tokenize',
    mibPerSec: fileSizeMiB / (avgMs / 1000),
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    sampleCount: samplesMs.length,
    sampleSpreadRatio: samplesMs.length > 1 ? (Math.max(...samplesMs) - Math.min(...samplesMs)) / avgMs : 0,
    samplesMs,
    eventCount: first.eventCount,
    startElementCount: first.startElementCount,
    endElementCount: first.endElementCount,
    textEventCount: first.textEventCount,
    attributeCount: first.attributeCount,
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
  if (id === 'singleton-segment-tokenize') {
    return consumeSegmented(createFileByteBatches(filePath, chunkBytes, 1));
  }
  if (id === 'grouped-segment-tokenize') {
    return consumeSegmented(createFileByteBatches(filePath, chunkBytes, batchSize));
  }
  if (id === 'grouped-concat-tokenize') {
    return consumeConcat(createFileByteBatches(filePath, chunkBytes, batchSize));
  }
  throw new Error(`Unknown variant: ${id}`);
}

function consumeSegmented(batches) {
  const tokenizer = new ByteTokenizer();
  for (const batch of batches) {
    for (const chunk of batch) {
      tokenizer.scan(chunk);
    }
  }
  return tokenizer.finish();
}

function consumeConcat(batches) {
  const tokenizer = new ByteTokenizer();
  for (const batch of batches) {
    const buffer = batch.length === 1 ? batch[0] : concatUint8Arrays(batch);
    tokenizer.scan(buffer);
  }
  return tokenizer.finish();
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

class ByteTokenizer {
  constructor() {
    this.inTag = false;
    this.tagParts = null;
    this.textHasNonWhitespace = false;
    this.textLength = 0;
    this.eventCount = 0;
    this.startElementCount = 0;
    this.endElementCount = 0;
    this.textEventCount = 0;
    this.attributeCount = 0;
    this.checksum = 0;
  }

  scan(buffer) {
    let offset = 0;
    while (offset < buffer.length) {
      if (this.inTag) {
        const gt = buffer.indexOf(62, offset);
        if (gt === -1) {
          this.appendTagPart(buffer.subarray(offset));
          return;
        }
        const current = buffer.subarray(offset, gt);
        this.processTagWithCurrent(current);
        this.inTag = false;
        offset = gt + 1;
        continue;
      }

      const lt = buffer.indexOf(60, offset);
      const end = lt === -1 ? buffer.length : lt;
      this.scanText(buffer, offset, end);
      if (lt === -1) return;
      this.flushText();
      this.inTag = true;
      this.tagParts = null;
      offset = lt + 1;
    }
  }

  finish() {
    if (this.inTag) {
      throw new Error('Unexpected end of file while scanning an XML tag.');
    }
    this.flushText();
    return {
      eventCount: this.eventCount,
      startElementCount: this.startElementCount,
      endElementCount: this.endElementCount,
      textEventCount: this.textEventCount,
      attributeCount: this.attributeCount,
      checksum: mixChecksum(this.checksum, this.eventCount),
    };
  }

  scanText(buffer, start, end) {
    if (start >= end) return;
    this.textLength += end - start;
    if (this.textHasNonWhitespace) return;
    for (let index = start; index < end; index++) {
      if (!isXmlWhitespace(buffer[index])) {
        this.textHasNonWhitespace = true;
        return;
      }
    }
  }

  flushText() {
    if (!this.textHasNonWhitespace) {
      this.textLength = 0;
      return;
    }
    this.eventCount++;
    this.textEventCount++;
    this.checksum = mixChecksum(this.checksum, 4);
    this.checksum = mixChecksum(this.checksum, this.textLength);
    this.textLength = 0;
    this.textHasNonWhitespace = false;
  }

  appendTagPart(part) {
    if (part.length === 0) return;
    this.tagParts ??= [];
    this.tagParts.push(part);
  }

  processTagWithCurrent(current) {
    if (this.tagParts === null) {
      processTag(current, this);
      return;
    }
    this.appendTagPart(current);
    processTag(concatUint8Arrays(this.tagParts), this);
    this.tagParts = null;
  }
}

function processTag(bytes, state) {
  let start = skipWhitespace(bytes, 0, bytes.length);
  let end = trimTrailingWhitespace(bytes, start, bytes.length);
  if (start >= end) return;

  const first = bytes[start];
  if (first === 63) return;
  if (first === 33) {
    if (startsWithAscii(bytes, start + 1, '[CDATA[')) {
      const textStart = start + 8;
      const textEnd = trimCdataEnd(bytes, textStart, end);
      if (textEnd > textStart) {
        state.eventCount++;
        state.textEventCount++;
        state.checksum = mixChecksum(state.checksum, 4);
        state.checksum = mixChecksum(state.checksum, textEnd - textStart);
      }
    }
    return;
  }
  if (first === 47) {
    const nameStart = skipWhitespace(bytes, start + 1, end);
    const nameEnd = scanNameEnd(bytes, nameStart, end);
    emitElement(state, 3, hashBytes(bytes, nameStart, nameEnd), 0);
    state.endElementCount++;
    return;
  }

  const nameStart = start;
  const nameEnd = scanNameEnd(bytes, nameStart, end);
  const selfClosing = trimTrailingSlash(bytes, nameEnd, end);
  const tagEnd = selfClosing ? end - 1 : end;
  const attrCount = countAttributes(bytes, nameEnd, tagEnd);
  const nameHash = hashBytes(bytes, nameStart, nameEnd);
  emitElement(state, 2, nameHash, attrCount);
  state.startElementCount++;
  state.attributeCount += attrCount;
  if (selfClosing) {
    emitElement(state, 3, nameHash, 0);
    state.endElementCount++;
  }
}

function emitElement(state, type, nameHash, attrCount) {
  state.eventCount++;
  state.checksum = mixChecksum(state.checksum, type);
  state.checksum = mixChecksum(state.checksum, nameHash);
  state.checksum = mixChecksum(state.checksum, attrCount);
}

function countAttributes(bytes, start, end) {
  let count = 0;
  let quote = 0;
  for (let index = start; index < end; index++) {
    const byte = bytes[index];
    if (quote !== 0) {
      if (byte === quote) quote = 0;
      continue;
    }
    if (byte === 34 || byte === 39) {
      quote = byte;
    } else if (byte === 61) {
      count++;
    }
  }
  return count;
}

function skipWhitespace(bytes, index, end) {
  while (index < end && isXmlWhitespace(bytes[index])) index++;
  return index;
}

function trimTrailingWhitespace(bytes, start, end) {
  while (end > start && isXmlWhitespace(bytes[end - 1])) end--;
  return end;
}

function trimTrailingSlash(bytes, start, end) {
  let index = trimTrailingWhitespace(bytes, start, end);
  return index > start && bytes[index - 1] === 47;
}

function trimCdataEnd(bytes, start, end) {
  if (end - start >= 2 && bytes[end - 1] === 93 && bytes[end - 2] === 93) return end - 2;
  return end;
}

function scanNameEnd(bytes, index, end) {
  while (index < end) {
    const byte = bytes[index];
    if (isXmlWhitespace(byte) || byte === 47) return index;
    index++;
  }
  return index;
}

function hashBytes(bytes, start, end) {
  let hash = 2166136261 | 0;
  for (let index = start; index < end; index++) {
    hash = mixChecksum(hash, bytes[index]);
  }
  return hash;
}

function startsWithAscii(bytes, offset, value) {
  if (offset + value.length > bytes.length) return false;
  for (let index = 0; index < value.length; index++) {
    if (bytes[offset + index] !== value.charCodeAt(index)) return false;
  }
  return true;
}

function isXmlWhitespace(byte) {
  return byte === 32 || byte === 10 || byte === 13 || byte === 9;
}

function mixChecksum(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function sameTokenResult(left, right) {
  return left.eventCount === right.eventCount
    && left.startElementCount === right.startElementCount
    && left.endElementCount === right.endElementCount
    && left.textEventCount === right.textEventCount
    && left.attributeCount === right.attributeCount
    && left.checksum === right.checksum;
}

function assertSameTokenContract(rows) {
  const first = rows[0];
  for (const row of rows) {
    if (
      row.eventCount !== first.eventCount
      || row.startElementCount !== first.startElementCount
      || row.endElementCount !== first.endElementCount
      || row.textEventCount !== first.textEventCount
      || row.attributeCount !== first.attributeCount
      || row.checksum !== first.checksum
    ) {
      throw new Error(`${row.id} does not match ${first.id} token counters/checksum.`);
    }
  }
}

function createFindings(rows, concat, segmented, singleton) {
  return [
    {
      id: 'same-token-boundary-contract',
      classification: 'CONTRACT_FACT',
      summary: 'All rows scan the same file-backed bytes and preserve start/end/text/attribute counters plus checksum parity.',
      evidence: unique(rows.map(row => `${row.eventCount}:${row.startElementCount}:${row.endElementCount}:${row.textEventCount}:${row.attributeCount}:${row.checksum}`)),
    },
    {
      id: 'segment-tokenizer-headroom',
      classification: 'BENCH_FACT',
      summary: concat && segmented
        ? `Grouped segment-aware tokenization reached ${formatNumber(segmented.mibPerSec)} MiB/s versus grouped concat tokenization at ${formatNumber(concat.mibPerSec)} MiB/s (${formatNumber(segmented.mibPerSec / concat.mibPerSec)}x).`
        : 'Grouped concat and segment-aware rows were not both measured.',
      evidence: rows.map(row => `${row.id}: ${formatNumber(row.mibPerSec)} MiB/s, concatBeforeTokenize=${row.concatBeforeTokenize}`),
    },
    {
      id: 'partial-not-stax-counterexample',
      classification: 'SCOPE_GUARD',
      summary: 'These rows fold XML token boundaries and attribute counts, but they do not materialize names/text strings, validate all XML productions, expose public event objects, or preserve the full StAX checksum.',
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
  if (id === 'singleton-segment-tokenize') {
    return 'File-backed sync Iterable<Uint8Array[]> singleton batches tokenized as direct segments';
  }
  if (id === 'grouped-concat-tokenize') {
    return 'File-backed sync Iterable<Uint8Array[]> grouped batches concatenated before token-boundary folding';
  }
  if (id === 'grouped-segment-tokenize') {
    return 'File-backed sync Iterable<Uint8Array[]> grouped batches tokenized segment-by-segment without concat';
  }
  return id;
}

function renderMarkdown(report) {
  const lines = [
    '# Segment Tokenizer Headroom',
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
    '| Row | MiB/s | Samples | Spread | Bounded | Max RSS | Events | Start | End | Text | Attrs | Checksum | Batch size | Concat before tokenize | Segment-aware |',
    '| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
  ];
  for (const row of report.rows) {
    lines.push(`| \`${row.id}\` | ${formatNumber(row.mibPerSec)} | ${row.sampleCount} | ${formatPercent(row.sampleSpreadRatio)} | ${row.boundedMemory ? 'yes' : 'no'} | ${formatBytes(row.memory.maxRssBytes)} | ${row.eventCount} | ${row.startElementCount} | ${row.endElementCount} | ${row.textEventCount} | ${row.attributeCount} | ${row.checksum} | ${row.batchSize} | ${row.concatBeforeTokenize ? 'yes' : 'no'} | ${row.segmentAwareTokenize ? 'yes' : 'no'} |`);
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
    '- This is an XML token-boundary probe only. It does not validate every XML production, materialize JavaScript strings, preserve full StAX event semantics, or expose public event objects.',
    '- A positive segment-tokenizer ratio is implementation headroom, not a full-string runtime counterexample.',
    '- A negative segment-tokenizer ratio does not rule out a full segmented parser; it only rejects this token-boundary shape on this fixture/runtime.',
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
