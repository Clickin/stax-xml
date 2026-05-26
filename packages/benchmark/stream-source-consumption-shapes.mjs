import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  StreamEventType,
  StreamReader,
  StreamReaderSync,
} from '../stax-xml/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultFile = join(__dirname, 'test-data', 'node-string-return-1024mib.xml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'stream-source-consumption-shapes.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'stream-source-consumption-shapes.md');
const staxSrcDir = join(__dirname, '..', 'stax-xml', 'src');
const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

const allShapes = [
  'sync-iterable-byte-batches',
  'async-iterable-byte-batches',
  'async-iterable-raw-frame',
  'web-readable-stream-pull',
  'web-readable-stream-raw-frame',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    shapes: allShapes,
    chunkKiB: 64,
    batchSize: 1,
    syncBatchSizes: null,
    asyncBatchSizes: null,
    readableBatchSizes: null,
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
      case '--file':
        options.file = resolve(process.cwd(), readValue());
        break;
      case '--shapes':
        options.shapes = parseShapes(readValue());
        break;
      case '--chunk-kib':
        options.chunkKiB = parsePositiveInteger(readValue(), name);
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), name);
        break;
      case '--sync-batch-sizes':
        options.syncBatchSizes = parsePositiveIntegerList(readValue(), name);
        break;
      case '--async-batch-sizes':
        options.asyncBatchSizes = parsePositiveIntegerList(readValue(), name);
        break;
      case '--readable-batch-sizes':
        options.readableBatchSizes = parsePositiveIntegerList(readValue(), name);
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
  if (options.shapes.length === 0) {
    throw new Error('--shapes must contain at least one shape.');
  }
  options.syncBatchSizes = options.syncBatchSizes ?? [options.batchSize];
  options.asyncBatchSizes = options.asyncBatchSizes ?? [options.batchSize];
  options.readableBatchSizes = options.readableBatchSizes ?? [options.batchSize];
  return options;
}

function parseShapes(value) {
  const shapes = value.split(',').map(entry => entry.trim()).filter(Boolean);
  for (const shape of shapes) {
    if (!allShapes.includes(shape)) {
      throw new Error(`Unknown shape: ${shape}`);
    }
  }
  return shapes;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
}

function parsePositiveIntegerList(value, flag) {
  const values = value.split(',').map(entry => parsePositiveInteger(entry.trim(), flag));
  if (values.length === 0) throw new Error(`${flag} must contain at least one integer.`);
  return [...new Set(values)];
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

async function main() {
  const options = parseArgs();
  const report = await runComparison(options);
  mkdirSync(dirname(options.jsonOut), { recursive: true });
  writeFileSync(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(options.mdOut, renderMarkdown(report), 'utf8');
  console.log(`stream-source-consumption-shapes: rows=${report.rows.length} fastest=${report.summary.fastest?.id ?? 'n/a'} ${formatNumber(report.summary.fastest?.mibPerSec)} MiB/s`);
}

async function runComparison(options) {
  const fileStats = statSync(options.file);
  const rows = [];
  for (const shape of options.shapes) {
    if (shape === 'sync-iterable-byte-batches') {
      for (const batchSize of options.syncBatchSizes) {
        const rowId = syncRowId(batchSize);
        rows.push(measureSyncShape(rowId, () => consumeSyncStreamReader(
          createFileByteBatches(options.file, options.chunkKiB * 1024, batchSize),
        ), fileStats.size / MIB, { ...options, batchSize }));
      }
      continue;
    }
    if (shape === 'async-iterable-byte-batches') {
      for (const batchSize of options.asyncBatchSizes) {
        const rowId = asyncIterableRowId(batchSize);
        rows.push(await measureAsyncShape(rowId, () => consumeAsyncStreamReader(
          createAsyncFileByteBatches(options.file, options.chunkKiB * 1024, batchSize),
        ), fileStats.size / MIB, { ...options, batchSize }));
      }
      continue;
    }
    if (shape === 'async-iterable-raw-frame') {
      for (const batchSize of options.asyncBatchSizes) {
        const rowId = asyncRawFrameRowId(batchSize);
        rows.push(await measureAsyncShape(rowId, () => consumeAsyncRawFrameReader(
          createAsyncFileByteBatches(options.file, options.chunkKiB * 1024, batchSize),
        ), fileStats.size / MIB, { ...options, batchSize }));
      }
      continue;
    }
    if (shape === 'web-readable-stream-pull') {
      for (const batchSize of options.readableBatchSizes) {
        const rowId = readableRowId(batchSize);
        rows.push(await measureAsyncShape(rowId, () => consumeAsyncStreamReader(
          createBackpressureReadableStream(options.file, options.chunkKiB * 1024),
          batchSize,
        ), fileStats.size / MIB, { ...options, batchSize }));
      }
      continue;
    }
    if (shape === 'web-readable-stream-raw-frame') {
      for (const batchSize of options.readableBatchSizes) {
        const rowId = readableRawFrameRowId(batchSize);
        rows.push(await measureAsyncShape(rowId, () => consumeAsyncRawFrameReader(
          createBackpressureReadableStream(options.file, options.chunkKiB * 1024),
          batchSize,
        ), fileStats.size / MIB, { ...options, batchSize }));
      }
      continue;
    }
    throw new Error(`Unhandled shape: ${shape}`);
  }

  const fastest = maxBy(rows, row => row.mibPerSec);
  const slowest = minBy(rows, row => row.mibPerSec);
  const syncRow = rows.find(row => row.id === 'sync-iterable-byte-batches');
  const syncRows = rows.filter(row => row.sourceMode === 'sync-iterable-byte-batches');
  const fastestSyncRow = maxBy(syncRows, row => row.mibPerSec);
  const asyncRows = rows.filter(row => row.sourceMode === 'async-iterable-byte-batches');
  const asyncRow = rows.find(row => row.id === 'async-iterable-byte-batches');
  const fastestAsyncRow = maxBy(asyncRows, row => row.mibPerSec);
  const readableRows = rows.filter(row => row.sourceMode === 'web-readable-stream-pull');
  const readableRow = rows.find(row => row.id === 'web-readable-stream-pull');
  const fastestReadableRow = maxBy(readableRows, row => row.mibPerSec);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'stream-source-consumption-shapes',
    contract: 'same-full-string-checksum-source-consumption-shapes',
    note: 'Compares demand-driven sync Iterable<Uint8Array[]>, async Iterable<Uint8Array[]>, and direct Web ReadableStream<Uint8Array> consumption under the same full-string checksum contract. The ReadableStream source reads only from pull(), and StreamReader groups at most the configured batch size per nextBatch() operation, so it stays bounded by consumer demand and does not pre-materialize the file.',
    sourceContract: createSourceContract(options),
    sourceFacts: createSourceFacts(),
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
      shapes: options.shapes,
      chunkKiB: options.chunkKiB,
      batchSize: options.batchSize,
      syncBatchSizes: options.syncBatchSizes,
      asyncBatchSizes: options.asyncBatchSizes,
      readableBatchSizes: options.readableBatchSizes,
      runs: options.runs,
      warmups: options.warmups,
      boundedRssMiB: options.boundedRssMiB,
    },
    rows,
    summary: {
      rowCount: rows.length,
      fastest: summarizeRow(fastest),
      slowest: summarizeRow(slowest),
      fastestSyncIterable: summarizeRow(fastestSyncRow),
      fastestAsyncIterable: summarizeRow(fastestAsyncRow),
      fastestReadableStream: summarizeRow(fastestReadableRow),
      readableStreamRatioToSyncIterable: syncRow && readableRow ? readableRow.mibPerSec / syncRow.mibPerSec : null,
      readableStreamRatioToFastestSyncIterable: fastestSyncRow && readableRow ? readableRow.mibPerSec / fastestSyncRow.mibPerSec : null,
      fastestReadableStreamRatioToFastestSyncIterable: fastestSyncRow && fastestReadableRow ? fastestReadableRow.mibPerSec / fastestSyncRow.mibPerSec : null,
      asyncIterableRatioToSyncIterable: syncRow && asyncRow ? asyncRow.mibPerSec / syncRow.mibPerSec : null,
      fastestAsyncIterableRatioToFastestSyncIterable: fastestSyncRow && fastestAsyncRow ? fastestAsyncRow.mibPerSec / fastestSyncRow.mibPerSec : null,
      counterexamples200MiB: rows.filter(row => row.fullStringParity && row.boundedMemory && row.mibPerSec >= 200).length,
    },
    findings: createFindings(rows, syncRow, fastestSyncRow, asyncRow, fastestAsyncRow, readableRow, fastestReadableRow),
  };
}

function createSourceContract(options) {
  return {
    fullChecksumConsumer: 'All rows preserve event count plus full-string checksum parity before throughput is compared. StreamBatch and raw-frame rows use different access surfaces but the same checksum contract.',
    syncIterableInput: 'sync-iterable-byte-batches uses StreamReaderSync over a synchronous Iterable<Uint8Array[]> and yields one grouped batch per parser pull.',
    asyncIterableInput: 'async-iterable-byte-batches uses StreamReader over an AsyncIterable<Uint8Array[]> and awaits one pre-grouped byte batch per parser pull.',
    primaryLargeComparisonInput: 'The file-backed release comparison rows call external-baseline with --stax-stream-source file-sync-batches, which records synchronous Iterable<Uint8Array[]> parser input and directReadableStream=false.',
    readableStreamInput: 'web-readable-stream-pull uses StreamReader over a Web ReadableStream<Uint8Array> pull source.',
    readableStreamAsyncBoundary: 'The direct ReadableStream rows include the public StreamReader await reader.read() boundary; batchSize controls how many chunks are grouped per bounded nextBatch() operation. Throughput is source-shape evidence, not a parser/runtime ceiling for sync byte batches.',
    readableStreamBackpressure: 'The ReadableStream source reads only inside pull(); StreamReader consumes at most the configured readable batch size per nextBatch() operation, so production remains bounded by consumer demand.',
    arrayBufferConsumption: 'Neither measured row constructs one full XML string or one repeated 1 GiB ArrayBuffer parser input; file chunks are read on demand for the selected source shape.',
    chunkBytes: options.chunkKiB * 1024,
    syncBatchSize: options.batchSize,
    syncBatchSizes: options.syncBatchSizes,
    asyncBatchSizes: options.asyncBatchSizes,
    readableBatchSizes: options.readableBatchSizes,
  };
}

function createSourceFacts() {
  const files = [
    readSourceFile('packages/benchmark/stream-source-consumption-shapes.mjs', resolve(__dirname, 'stream-source-consumption-shapes.mjs')),
    readSourceFile('packages/stax-xml/src/StreamReaderSync.ts', join(staxSrcDir, 'StreamReaderSync.ts')),
    readSourceFile('packages/stax-xml/src/StreamReader.ts', join(staxSrcDir, 'StreamReader.ts')),
    readSourceFile('packages/stax-xml/src/IterableEventBackend.ts', join(staxSrcDir, 'IterableEventBackend.ts')),
    readSourceFile('packages/benchmark/file-backed-core-decomposition.mjs', resolve(__dirname, 'file-backed-core-decomposition.mjs')),
    readSourceFile('packages/benchmark/external-baseline.mjs', resolve(__dirname, 'external-baseline.mjs')),
  ];
  const facts = [
    sourceFact(files, {
      id: 'sync-iterable-byte-batches',
      classification: 'SOURCE_FACT',
      summary: 'The sync comparison row feeds StreamReaderSync with demand-driven Iterable<Uint8Array[]> batches, not a full-file string or full-file ArrayBuffer.',
      patterns: [
        { file: 'packages/benchmark/stream-source-consumption-shapes.mjs', text: 'for (const batch of new StreamReaderSync(byteBatches))' },
        { file: 'packages/benchmark/stream-source-consumption-shapes.mjs', text: 'function* createFileByteBatches(filePath, chunkBytes, batchSize)' },
        { file: 'packages/benchmark/stream-source-consumption-shapes.mjs', text: 'yield batch' },
      ],
    }),
    sourceFact(files, {
      id: 'single-arraybuffer-direct-batch',
      classification: 'SOURCE_FACT',
      summary: 'A direct Uint8Array StreamReaderSync input is wrapped as one single-item byte batch.',
      patterns: [
        { file: 'packages/stax-xml/src/StreamReaderSync.ts', text: 'const batches = source instanceof Uint8Array ? singleByteBatch(source) : source' },
        { file: 'packages/stax-xml/src/StreamReaderSync.ts', text: 'yield [source]' },
      ],
    }),
    sourceFact(files, {
      id: 'stream-reader-single-chunk-push',
      classification: 'SOURCE_FACT',
      summary: 'The public StreamReader ReadableStream path awaits reader.read() and pushes bounded byte batches into the parser core.',
      patterns: [
        { file: 'packages/stax-xml/src/StreamReader.ts', text: 'readResult = await this.reader!.read()' },
        { file: 'packages/stax-xml/src/StreamReader.ts', text: 'byteBatch.length < this.batchSize' },
        { file: 'packages/stax-xml/src/StreamReader.ts', text: 'this.streamingBatches.pushByteBatch(byteBatch, false)' },
      ],
    }),
    sourceFact(files, {
      id: 'stream-reader-async-byte-batches',
      classification: 'SOURCE_FACT',
      summary: 'The public StreamReader can consume demand-driven AsyncIterable<Uint8Array[]> batches without routing through ReadableStream.',
      patterns: [
        { file: 'packages/stax-xml/src/StreamReader.ts', text: 'AsyncIterable<StreamReaderSyncByteBatch>' },
        { file: 'packages/stax-xml/src/StreamReader.ts', text: 'this.byteBatchIterator = source[Symbol.asyncIterator]()' },
        { file: 'packages/stax-xml/src/StreamReader.ts', text: 'return await this.readNextAsyncIterableByteBatch()' },
      ],
    }),
    sourceFact(files, {
      id: 'stream-reader-async-raw-batches',
      classification: 'SOURCE_FACT',
      summary: 'The public StreamReader can return raw frame batches from async sources without creating StreamBatch event wrapper objects.',
      patterns: [
        { file: 'packages/stax-xml/src/StreamReader.ts', text: 'async nextRawBatch(): Promise<StreamReaderSyncRawBatch | null>' },
        { file: 'packages/stax-xml/src/StreamReader.ts', text: 'return await this.readNextRawBatch()' },
        { file: 'packages/stax-xml/src/StreamReader.ts', text: 'return createRawBatch(this.streamingBatches.batchFrame())' },
      ],
    }),
    sourceFact(files, {
      id: 'event-reader-async-byte-batches',
      classification: 'SOURCE_FACT',
      summary: 'The public EventReader ReadableStream adapter converts stream chunks into AsyncIterable<Uint8Array[]> batches before materializing events.',
      patterns: [
        { file: 'packages/stax-xml/src/IterableEventBackend.ts', text: 'yield* toAsyncByteBatches(readReadableStreamChunksIncrementally(stream, options.maxChunkBytes)' },
        { file: 'packages/stax-xml/src/IterableEventBackend.ts', text: 'const result = await reader.read()' },
        { file: 'packages/stax-xml/src/IterableEventBackend.ts', text: 'yield chunk' },
      ],
    }),
    sourceFact(files, {
      id: 'benchmark-readable-stream-backpressure',
      classification: 'SOURCE_FACT',
      summary: 'The direct ReadableStream benchmark source reads exactly one file chunk inside pull(), and StreamReader caps grouped consumption by configured batch size.',
      patterns: [
        { file: 'packages/benchmark/stream-source-consumption-shapes.mjs', text: 'pull(controller)' },
        { file: 'packages/benchmark/stream-source-consumption-shapes.mjs', text: 'const bytesRead = readSync(fd, buffer, 0, chunkBytes, null)' },
        { file: 'packages/benchmark/stream-source-consumption-shapes.mjs', text: 'controller.enqueue(bytesRead === chunkBytes ? buffer : buffer.subarray(0, bytesRead))' },
        { file: 'packages/benchmark/stream-source-consumption-shapes.mjs', text: 'new StreamReader(stream, { batchSize })' },
      ],
    }),
    sourceFact(files, {
      id: 'file-backed-release-sync-batches',
      classification: 'SOURCE_FACT',
      summary: 'The current file-backed core decomposition invokes external-baseline in file-sync-batches mode, so large release rows use demand-driven synchronous Iterable<Uint8Array[]> input rather than direct ReadableStream consumption.',
      patterns: [
        { file: 'packages/benchmark/file-backed-core-decomposition.mjs', text: '--stax-stream-source' },
        { file: 'packages/benchmark/file-backed-core-decomposition.mjs', text: 'file-sync-batches' },
        { file: 'packages/benchmark/external-baseline.mjs', text: "parserInput: 'synchronous Iterable<Uint8Array[]>'" },
        { file: 'packages/benchmark/external-baseline.mjs', text: 'directReadableStream: false' },
      ],
    }),
  ];
  return {
    status: facts.every(fact => fact.missingPatterns.length === 0) ? 'source-facts-confirmed' : 'source-facts-incomplete',
    files: files.map(file => ({
      path: file.label,
      lineCount: file.lines.length,
    })),
    facts,
  };
}

function readSourceFile(label, path) {
  const text = readFileSync(path, 'utf8');
  return {
    label,
    path,
    text,
    lines: text.split(/\r?\n/),
  };
}

function sourceFact(files, options) {
  const evidence = [];
  const missingPatterns = [];
  for (const pattern of options.patterns) {
    const text = typeof pattern === 'string' ? pattern : pattern.text;
    const candidateFiles = typeof pattern === 'string'
      ? files
      : files.filter(file => file.label === pattern.file);
    const matches = candidateFiles.flatMap(file => findPattern(file, text));
    if (matches.length === 0) {
      missingPatterns.push(typeof pattern === 'string' ? pattern : `${pattern.file}: ${pattern.text}`);
      continue;
    }
    evidence.push(...matches.map(match => `${match.label}:${match.line}: ${text}`));
  }
  return {
    id: options.id,
    classification: options.classification,
    summary: options.summary,
    evidence,
    missingPatterns,
  };
}

function findPattern(file, pattern) {
  const matches = [];
  for (let index = 0; index < file.lines.length; index++) {
    const trimmed = file.lines[index].trimStart();
    if (file.label === 'packages/benchmark/stream-source-consumption-shapes.mjs') {
      if (trimmed.startsWith("'") || trimmed.startsWith('"') || trimmed.startsWith('`')) {
        continue;
      }
      if (trimmed.includes(' text: ') || trimmed.startsWith('patterns:')) {
        continue;
      }
    }
    if (file.lines[index].includes(pattern)) {
      matches.push({ label: file.label, line: index + 1 });
    }
  }
  return matches;
}

function consumeSyncStreamReader(byteBatches) {
  let eventCount = 0;
  let checksum = 0;
  for (const batch of new StreamReaderSync(byteBatches)) {
    const result = consumeBatch(batch, eventCount, checksum);
    eventCount = result.eventCount;
    checksum = result.checksum;
  }
  return { eventCount, checksum };
}

async function consumeAsyncStreamReader(stream, batchSize) {
  let eventCount = 0;
  let checksum = 0;
  for await (const batch of new StreamReader(stream, { batchSize })) {
    const result = consumeBatch(batch, eventCount, checksum);
    eventCount = result.eventCount;
    checksum = result.checksum;
  }
  return { eventCount, checksum };
}

async function consumeAsyncRawFrameReader(source, batchSize) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const nameCache = [];
  let eventCount = 0;
  let checksum = 0;
  const reader = typeof batchSize === 'number'
    ? new StreamReader(source, { batchSize })
    : new StreamReader(source);
  let frame;
  while ((frame = await reader.nextRawBatch()) !== null) {
    const result = consumeRawFrame(frame, checksum, eventCount, decoder, nameCache);
    checksum = result.checksum;
    eventCount = result.eventCount;
  }
  return { eventCount, checksum };
}

function consumeRawFrame(frame, checksum, eventCount, decoder, nameCache) {
  if (frame.kind !== 'frame') {
    throw new Error(`Unsupported raw batch kind in source consumption benchmark: ${frame.kind}`);
  }

  const eventTypes = frame.eventTypes;
  const nameStarts = frame.nameStarts;
  const nameEnds = frame.nameEnds;
  const nameIds = frame.nameIds;
  const textStarts = frame.textStarts;
  const textEnds = frame.textEnds;
  const attrStarts = frame.attrStarts;
  const attrCounts = frame.attrCounts;
  const attrNameStarts = frame.attrNameStarts;
  const attrNameEnds = frame.attrNameEnds;
  const attrNameIds = frame.attrNameIds;
  const attrValueStarts = frame.attrValueStarts;
  const attrValueEnds = frame.attrValueEnds;
  const buffer = frame.buffer;

  for (let index = 0; index < frame.eventCount; index++) {
    const type = eventTypes[index];
    eventCount++;
    checksum = mixChecksum(checksum, type);

    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      checksum = foldString(checksum, materializeName(buffer, nameStarts[index], nameEnds[index], nameIds[index], decoder, nameCache));
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      const start = textStarts[index];
      if (start >= 0) {
        checksum = foldString(checksum, decoder.decode(buffer.subarray(start, textEnds[index])).trim());
      }
    }
    if (type === StreamEventType.START_ELEMENT) {
      const attrStart = attrStarts[index];
      const attrCount = attrCounts[index];
      checksum = mixChecksum(checksum, attrCount);
      const attrEnd = attrStart + attrCount;
      for (let attrIndex = attrStart; attrIndex < attrEnd; attrIndex++) {
        checksum = foldString(checksum, materializeName(
          buffer,
          attrNameStarts[attrIndex],
          attrNameEnds[attrIndex],
          attrNameIds[attrIndex],
          decoder,
          nameCache,
        ));
        checksum = foldString(checksum, isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, attrIndex)
          ? 'true'
          : decoder.decode(buffer.subarray(attrValueStarts[attrIndex], attrValueEnds[attrIndex])));
      }
    }
  }
  return { eventCount, checksum };
}

function materializeName(buffer, start, end, nameId, decoder, nameCache) {
  if (nameId >= 0) {
    const cached = nameCache[nameId];
    if (cached !== undefined) return cached;
    const value = decoder.decode(buffer.subarray(start, end));
    nameCache[nameId] = value;
    return value;
  }
  return decoder.decode(buffer.subarray(start, end));
}

function isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, index) {
  return attrNameStarts[index] === attrValueStarts[index] && attrNameEnds[index] === attrValueEnds[index];
}

function consumeBatch(batch, eventCount, checksum) {
  const count = batch.eventCount;
  for (let index = 0; index < count; index++) {
    const type = batch.typeAt(index);
    eventCount++;
    checksum = mixChecksum(checksum, type);

    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      checksum = foldString(checksum, batch.nameAt(index));
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      checksum = foldString(checksum, batch.textAt(index)?.trim());
    }
    if (type === StreamEventType.START_ELEMENT) {
      const attrCount = batch.attributeCountAt(index);
      checksum = mixChecksum(checksum, attrCount);
      for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
        checksum = foldString(checksum, batch.attributeNameAt(index, attrIndex));
        checksum = foldString(checksum, batch.attributeValueAt(index, attrIndex));
      }
    }
  }
  return { eventCount, checksum };
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

async function* createAsyncFileByteBatches(filePath, chunkBytes, batchSize) {
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

function createBackpressureReadableStream(filePath, chunkBytes) {
  let fd;
  let closed = false;
  const closeFile = () => {
    if (!closed && fd !== undefined) {
      closed = true;
      closeSync(fd);
    }
  };
  return new ReadableStream({
    start() {
      fd = openSync(filePath, 'r');
    },
    pull(controller) {
      const buffer = new Uint8Array(chunkBytes);
      const bytesRead = readSync(fd, buffer, 0, chunkBytes, null);
      if (bytesRead === 0) {
        closeFile();
        controller.close();
        return;
      }
      controller.enqueue(bytesRead === chunkBytes ? buffer : buffer.subarray(0, bytesRead));
    },
    cancel() {
      closeFile();
    },
  });
}

function measureSyncShape(id, run, fileSizeMiB, options) {
  for (let index = 0; index < options.warmups; index++) run();
  const samplesMs = [];
  const memorySamples = [];
  let eventCount = 0;
  let checksum = 0;
  for (let index = 0; index < options.runs; index++) {
    gcNow();
    const before = takeMemorySnapshot();
    const startedAt = performance.now();
    const result = run();
    const elapsedMs = performance.now() - startedAt;
    const after = takeMemorySnapshot();
    assertStableResult(id, index, eventCount, checksum, result);
    eventCount = result.eventCount;
    checksum = result.checksum;
    samplesMs.push(elapsedMs);
    memorySamples.push({ before, after });
  }
  return createRow(id, fileSizeMiB, samplesMs, memorySamples, eventCount, checksum, options);
}

async function measureAsyncShape(id, run, fileSizeMiB, options) {
  for (let index = 0; index < options.warmups; index++) await run();
  const samplesMs = [];
  const memorySamples = [];
  let eventCount = 0;
  let checksum = 0;
  for (let index = 0; index < options.runs; index++) {
    gcNow();
    const before = takeMemorySnapshot();
    const startedAt = performance.now();
    const result = await run();
    const elapsedMs = performance.now() - startedAt;
    const after = takeMemorySnapshot();
    assertStableResult(id, index, eventCount, checksum, result);
    eventCount = result.eventCount;
    checksum = result.checksum;
    samplesMs.push(elapsedMs);
    memorySamples.push({ before, after });
  }
  return createRow(id, fileSizeMiB, samplesMs, memorySamples, eventCount, checksum, options);
}

function assertStableResult(id, sampleIndex, eventCount, checksum, result) {
  if (sampleIndex > 0 && (eventCount !== result.eventCount || checksum !== result.checksum)) {
    throw new Error(`${id} produced unstable event count or checksum.`);
  }
}

function createRow(id, fileSizeMiB, samplesMs, memorySamples, eventCount, checksum, options) {
  const syncRow = id.startsWith('sync-iterable-byte-batches');
  const asyncRow = id.startsWith('async-iterable-byte-batches');
  const asyncRawRow = id.startsWith('async-iterable-raw-frame');
  const readableRow = id.startsWith('web-readable-stream-pull');
  const readableRawRow = id.startsWith('web-readable-stream-raw-frame');
  const avgMs = samplesMs.reduce((sum, value) => sum + value, 0) / samplesMs.length;
  const maxRssBytes = Math.max(...memorySamples.map(sample => sample.after.rssBytes));
  const maxHeapUsedBytes = Math.max(...memorySamples.map(sample => sample.after.heapUsedBytes));
  return {
    id,
    tool: id,
    implementation: describeImplementation(id, options),
    family: 'source-consumption-shape',
    sourceMode: syncRow
      ? 'sync-iterable-byte-batches'
      : asyncRow || asyncRawRow
        ? 'async-iterable-byte-batches'
        : readableRow || readableRawRow
          ? 'web-readable-stream-pull'
          : id,
    parserInput: syncRow
      ? 'synchronous Iterable<Uint8Array[]>'
      : asyncRow || asyncRawRow
        ? 'async Iterable<Uint8Array[]>'
      : 'Web ReadableStream<Uint8Array>',
    accessMode: asyncRawRow || readableRawRow ? 'raw-frame' : 'stream-batch',
    contractScope: 'full-string-checksum',
    fullStringParity: true,
    chunkKiB: options.chunkKiB,
    batchSize: syncRow || asyncRow || asyncRawRow || readableRow || readableRawRow ? options.batchSize : null,
    demandDrivenSource: true,
    directReadableStream: readableRow || readableRawRow,
    fullArrayBufferParserInput: false,
    respectsBackpressure: asyncRow || asyncRawRow || readableRow || readableRawRow ? true : null,
    mibPerSec: fileSizeMiB / (avgMs / 1000),
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    sampleCount: samplesMs.length,
    sampleSpreadRatio: samplesMs.length > 1 ? (Math.max(...samplesMs) - Math.min(...samplesMs)) / avgMs : 0,
    samplesMs,
    eventCount,
    checksum,
    boundedMemory: maxRssBytes <= options.boundedRssMiB * 1024 * 1024,
    memory: {
      maxRssBytes,
      maxHeapUsedBytes,
      samples: memorySamples,
    },
  };
}

function syncRowId(batchSize) {
  return batchSize === 1
    ? 'sync-iterable-byte-batches'
    : `sync-iterable-byte-batches-batch-${batchSize}`;
}

function asyncIterableRowId(batchSize) {
  return batchSize === 1
    ? 'async-iterable-byte-batches'
    : `async-iterable-byte-batches-batch-${batchSize}`;
}

function asyncRawFrameRowId(batchSize) {
  return batchSize === 1
    ? 'async-iterable-raw-frame'
    : `async-iterable-raw-frame-batch-${batchSize}`;
}

function readableRowId(batchSize) {
  return batchSize === 1
    ? 'web-readable-stream-pull'
    : `web-readable-stream-pull-batch-${batchSize}`;
}

function readableRawFrameRowId(batchSize) {
  return batchSize === 1
    ? 'web-readable-stream-raw-frame'
    : `web-readable-stream-raw-frame-batch-${batchSize}`;
}

function describeImplementation(id, options) {
  if (id.startsWith('sync-iterable-byte-batches')) {
    return `Node + stax-xml StreamReaderSync over demand-driven Iterable<Uint8Array[]> file batches (batchSize=${options.batchSize})`;
  }
  if (id.startsWith('async-iterable-byte-batches')) {
    return `Node + stax-xml StreamReader over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=${options.batchSize})`;
  }
  if (id.startsWith('async-iterable-raw-frame')) {
    return `Node + stax-xml StreamReader.nextRawBatch over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=${options.batchSize})`;
  }
  if (id === 'web-readable-stream-pull') {
    return 'Node + stax-xml StreamReader over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=1)';
  }
  if (id.startsWith('web-readable-stream-pull')) {
    return `Node + stax-xml StreamReader over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=${options.batchSize})`;
  }
  if (id.startsWith('web-readable-stream-raw-frame')) {
    return `Node + stax-xml StreamReader.nextRawBatch over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=${options.batchSize})`;
  }
  return id;
}

function createFindings(rows, syncRow, fastestSyncRow, asyncRow, fastestAsyncRow, readableRow, fastestReadableRow) {
  const syncRows = rows.filter(row => row.sourceMode === 'sync-iterable-byte-batches');
  const asyncRows = rows.filter(row => row.sourceMode === 'async-iterable-byte-batches');
  const asyncRawRows = rows.filter(row => row.id.startsWith('async-iterable-raw-frame'));
  const readableRows = rows.filter(row => row.sourceMode === 'web-readable-stream-pull');
  const readableRawRows = rows.filter(row => row.id.startsWith('web-readable-stream-raw-frame'));
  return [
    {
      id: 'same-contract-preserved',
      classification: 'CONTRACT_FACT',
      summary: 'All source-shape rows preserve the same full-string checksum contract.',
      evidence: unique(rows.map(row => `${row.eventCount}:${row.checksum}`)),
    },
    {
      id: 'current-release-source-shape',
      classification: 'CONTRACT_FACT',
      summary: 'The current file-backed release comparison uses the sync Iterable<Uint8Array[]> shape, not direct Web ReadableStream consumption; grouped sync rows remain demand-driven parser pulls.',
      evidence: syncRows.map(row => `${row.id}: batchSize=${row.batchSize}, ${formatNumber(row.mibPerSec)} MiB/s`),
    },
    {
      id: 'sync-batch-size-headroom',
      classification: 'BENCH_FACT',
      summary: fastestSyncRow
        ? `The fastest sync Iterable<Uint8Array[]> row was ${fastestSyncRow.id} at ${formatNumber(fastestSyncRow.mibPerSec)} MiB/s; this isolates grouped byte-batch source shape from direct ReadableStream async overhead.`
        : 'No sync Iterable<Uint8Array[]> rows were measured.',
      evidence: syncRows.map(row => `${row.id}: batchSize=${row.batchSize}, rss=${formatBytes(row.memory?.maxRssBytes)}, checksum=${row.checksum}`),
    },
    {
      id: 'async-byte-batch-source-shape',
      classification: 'BENCH_FACT',
      summary: fastestAsyncRow && fastestSyncRow
        ? `The fastest AsyncIterable<Uint8Array[]> row was ${fastestAsyncRow.id} at ${formatNumber(fastestAsyncRow.mibPerSec)} MiB/s (${formatNumber(fastestAsyncRow.mibPerSec / fastestSyncRow.mibPerSec)}x of the fastest sync row); this isolates an async batch boundary without direct ReadableStream reads.`
        : 'AsyncIterable<Uint8Array[]> and sync Iterable rows were not both measured.',
      evidence: asyncRows.map(row => `${row.id}: batchSize=${row.batchSize}, rss=${formatBytes(row.memory?.maxRssBytes)}, checksum=${row.checksum}`),
    },
    {
      id: 'async-raw-frame-source-shape',
      classification: 'BENCH_FACT',
      summary: asyncRawRows.length > 0
        ? `The fastest AsyncIterable nextRawBatch row was ${maxBy(asyncRawRows, row => row.mibPerSec).id} at ${formatNumber(maxBy(asyncRawRows, row => row.mibPerSec).mibPerSec)} MiB/s; this tests the async source with wrapper-free raw frame traversal.`
        : 'No AsyncIterable nextRawBatch rows were measured.',
      evidence: asyncRawRows.map(row => `${row.id}: batchSize=${row.batchSize}, rss=${formatBytes(row.memory?.maxRssBytes)}, checksum=${row.checksum}`),
    },
    {
      id: 'readable-stream-direct-source-shape',
      classification: 'BENCH_FACT',
      summary: fastestSyncRow && readableRow
        ? `Direct ReadableStream consumption reached ${formatNumber(readableRow.mibPerSec)} MiB/s (${formatNumber(readableRow.mibPerSec / fastestSyncRow.mibPerSec)}x of the fastest sync Iterable<Uint8Array[]> row); this is a separate source-shape row, not the current release comparison source.`
        : 'ReadableStream and sync Iterable rows were not both measured.',
      evidence: rows.map(row => `${row.id}=${formatNumber(row.mibPerSec)} MiB/s rss=${formatBytes(row.memory?.maxRssBytes)}`),
    },
    {
      id: 'readable-stream-batch-size-headroom',
      classification: 'BENCH_FACT',
      summary: fastestReadableRow
        ? `The fastest bounded ReadableStream batch row was ${fastestReadableRow.id} at ${formatNumber(fastestReadableRow.mibPerSec)} MiB/s; this tests whether grouping chunks behind the ReadableStream async boundary exposes headroom.`
        : 'No ReadableStream batch rows were measured.',
      evidence: readableRows.map(row => `${row.id}: batchSize=${row.batchSize}, rss=${formatBytes(row.memory?.maxRssBytes)}, checksum=${row.checksum}`),
    },
    {
      id: 'readable-stream-raw-frame-source-shape',
      classification: 'BENCH_FACT',
      summary: readableRawRows.length > 0
        ? `The fastest ReadableStream nextRawBatch row was ${maxBy(readableRawRows, row => row.mibPerSec).id} at ${formatNumber(maxBy(readableRawRows, row => row.mibPerSec).mibPerSec)} MiB/s; this tests whether direct ReadableStream rows gain from wrapper-free raw frame traversal.`
        : 'No ReadableStream nextRawBatch rows were measured.',
      evidence: readableRawRows.map(row => `${row.id}: batchSize=${row.batchSize}, rss=${formatBytes(row.memory?.maxRssBytes)}, checksum=${row.checksum}`),
    },
    {
      id: 'backpressure-respected',
      classification: 'CONTRACT_FACT',
      summary: 'The async byte-batch rows advance the source iterator only from StreamReader.nextBatch(), and the ReadableStream rows read from the file only in pull().',
      evidence: [...asyncRows, ...readableRows].map(row => `${row.id}: demandDrivenSource=${row.demandDrivenSource}, respectsBackpressure=${row.respectsBackpressure}, batchSize=${row.batchSize}`),
    },
  ];
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Stream Source Consumption Shapes');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(report.note);
  lines.push('');
  lines.push('## Source Contract');
  lines.push('');
  lines.push(`- Full checksum consumer: ${report.sourceContract.fullChecksumConsumer}`);
  lines.push(`- Sync Iterable input: ${report.sourceContract.syncIterableInput}`);
  lines.push(`- Async Iterable input: ${report.sourceContract.asyncIterableInput}`);
  lines.push(`- Primary large comparison input: ${report.sourceContract.primaryLargeComparisonInput}`);
  lines.push(`- ReadableStream input: ${report.sourceContract.readableStreamInput}`);
  lines.push(`- ReadableStream async boundary: ${report.sourceContract.readableStreamAsyncBoundary}`);
  lines.push(`- ReadableStream backpressure: ${report.sourceContract.readableStreamBackpressure}`);
  lines.push(`- ArrayBuffer consumption: ${report.sourceContract.arrayBufferConsumption}`);
  lines.push(`- Chunk bytes: ${report.sourceContract.chunkBytes}`);
  lines.push(`- Sync batch sizes: ${report.sourceContract.syncBatchSizes.join(', ')}`);
  lines.push(`- Async batch sizes: ${report.sourceContract.asyncBatchSizes.join(', ')}`);
  lines.push(`- ReadableStream batch sizes: ${report.sourceContract.readableBatchSizes.join(', ')}`);
  lines.push('');
  lines.push('## Source Facts');
  lines.push('');
  lines.push(`- Status: ${report.sourceFacts.status}`);
  lines.push('- Files:');
  for (const file of report.sourceFacts.files) {
    lines.push(`  - ${file.path} (${file.lineCount} lines)`);
  }
  for (const fact of report.sourceFacts.facts) {
    lines.push(`- ${fact.id} (${fact.classification}): ${fact.summary}`);
    for (const evidence of fact.evidence) {
      lines.push(`  - ${evidence}`);
    }
    for (const missing of fact.missingPatterns) {
      lines.push(`  - missing: ${missing}`);
    }
  }
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Fixture: ${report.fixture.path}`);
  lines.push(`- Fixture size: ${formatNumber(report.fixture.sizeMiB)} MiB`);
  lines.push(`- Chunk KiB: ${report.options.chunkKiB}`);
  lines.push(`- Sync Iterable batch sizes: ${report.options.syncBatchSizes.join(', ')}`);
  lines.push(`- Async Iterable batch sizes: ${report.options.asyncBatchSizes.join(', ')}`);
  lines.push(`- Fastest row: ${formatSummaryRow(report.summary.fastest)}`);
  lines.push(`- Fastest sync Iterable row: ${formatSummaryRow(report.summary.fastestSyncIterable)}`);
  lines.push(`- Fastest async Iterable row: ${formatSummaryRow(report.summary.fastestAsyncIterable)}`);
  lines.push(`- Fastest ReadableStream row: ${formatSummaryRow(report.summary.fastestReadableStream)}`);
  lines.push(`- Async Iterable / batch-1 sync Iterable ratio: ${formatNullableNumber(report.summary.asyncIterableRatioToSyncIterable)}x`);
  lines.push(`- Fastest async Iterable / fastest sync Iterable ratio: ${formatNullableNumber(report.summary.fastestAsyncIterableRatioToFastestSyncIterable)}x`);
  lines.push(`- ReadableStream / batch-1 sync Iterable ratio: ${formatNullableNumber(report.summary.readableStreamRatioToSyncIterable)}x`);
  lines.push(`- ReadableStream / fastest sync Iterable ratio: ${formatNullableNumber(report.summary.readableStreamRatioToFastestSyncIterable)}x`);
  lines.push(`- Fastest ReadableStream / fastest sync Iterable ratio: ${formatNullableNumber(report.summary.fastestReadableStreamRatioToFastestSyncIterable)}x`);
  lines.push(`- 200 MiB/s bounded full-string counterexamples: ${report.summary.counterexamples200MiB}`);
  lines.push('');
  lines.push('## Rows');
  lines.push('');
  lines.push('| Row | Source shape | Batch size | MiB/s | Samples | Spread | Bounded | Max RSS | Events | Checksum | Demand-driven | Stream backpressure |');
  lines.push('| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- | --- |');
  for (const row of report.rows) {
    lines.push(`| \`${row.id}\` | ${row.implementation} | ${row.batchSize ?? 'n/a'} | ${formatNumber(row.mibPerSec)} | ${row.sampleCount} | ${formatPercent(row.sampleSpreadRatio)} | ${row.boundedMemory ? 'yes' : 'no'} | ${formatBytes(row.memory?.maxRssBytes)} | ${row.eventCount} | ${row.checksum} | ${row.demandDrivenSource ? 'yes' : 'no'} | ${row.respectsBackpressure === null ? 'n/a' : row.respectsBackpressure ? 'yes' : 'no'} |`);
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
  lines.push('');
  lines.push('## Limits');
  lines.push('');
  lines.push('- This compares source consumption shapes inside Node/V8; it does not cover browser File/Blob stream implementations.');
  lines.push('- The ReadableStream row is direct source-shape evidence, not the current release comparison source and not a JavaScript runtime ceiling proof. If it is faster or slower than the sync row in a given run, keep that as a benchmark fact rather than a global async-overhead conclusion.');
  lines.push('- Rows preserve the same full-string checksum contract, but StreamBatch and raw-frame rows use different access surfaces; this does not isolate parser tokenization cost.');
  lines.push('');
  return `${lines.join('\n')}\n`;
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

function minBy(values, score) {
  let best = null;
  let bestScore = Infinity;
  for (const value of values) {
    const nextScore = score(value);
    if (nextScore < bestScore) {
      best = value;
      bestScore = nextScore;
    }
  }
  return best;
}

function summarizeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    mibPerSec: row.mibPerSec,
    maxRssBytes: row.memory?.maxRssBytes ?? null,
    eventCount: row.eventCount,
    checksum: row.checksum,
  };
}

function formatSummaryRow(row) {
  if (!row) return 'n/a';
  return `${row.id} ${formatNumber(row.mibPerSec)} MiB/s, RSS ${formatBytes(row.maxRssBytes)}`;
}

function formatNullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? formatNumber(value) : 'n/a';
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function formatPercent(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function formatBytes(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${formatNumber(value / MIB)} MiB` : 'n/a';
}

function unique(values) {
  return [...new Set(values)];
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
