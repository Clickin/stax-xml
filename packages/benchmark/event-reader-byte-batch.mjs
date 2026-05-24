import { closeSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EventReader,
  StreamEventType,
  StreamReaderSync,
  XmlEventType,
  createEventReaderFromAsyncByteBatches,
} from 'stax-xml';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'event-reader-byte-batch.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'event-reader-byte-batch.md');
const packageVersion = JSON.parse(readFileSync(resolve(__dirname, '../stax-xml/package.json'), 'utf8')).version;
const encoder = new TextEncoder();

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sizeGiB: 1,
    runs: 1,
    warmups: 0,
    fixtureShape: 'diverse-cycle',
    corpusFile: null,
    corpusChunkKiB: 64,
    diverseCycleSize: 4096,
    batchSizes: [1, 16, 64],
    boundedRssMiB: 512,
    runtimeLabel: null,
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
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), name);
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--fixture-shape':
        options.fixtureShape = parseFixtureShape(readValue(), name);
        break;
      case '--corpus-file':
        options.corpusFile = resolve(process.cwd(), readValue());
        break;
      case '--corpus-chunk-kib':
        options.corpusChunkKiB = parsePositiveInteger(readValue(), name);
        break;
      case '--diverse-cycle-size':
        options.diverseCycleSize = parsePositiveInteger(readValue(), name);
        break;
      case '--batch-sizes':
        options.batchSizes = parsePositiveIntegerList(readValue(), name);
        break;
      case '--bounded-rss-mib':
        options.boundedRssMiB = parsePositiveNumber(readValue(), name);
        break;
      case '--runtime-label':
        options.runtimeLabel = readValue();
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

function parsePositiveNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive number.`);
  return parsed;
}

function parseFixtureShape(value, flag) {
  if (value === 'diverse-cycle' || value === 'corpus-cycle') return value;
  throw new Error(`${flag} must be diverse-cycle or corpus-cycle.`);
}

function parsePositiveIntegerList(value, flag) {
  const parsed = value.split(',').map(entry => parsePositiveInteger(entry.trim(), flag));
  if (parsed.length === 0) throw new Error(`${flag} must contain at least one value.`);
  return parsed;
}

async function main() {
  const options = parseArgs();
  const fixture = createFixture(options);
  const variants = [
    ...options.batchSizes.map(batchSize => ({
      id: `readableStreamBatch${batchSize}`,
      family: 'readable-stream',
      batchSize,
      implementation: `EventReader over ReadableStream with internal byte batch size ${batchSize}`,
      run: () => consumeReadableStream(fixture, batchSize),
    })),
    ...options.batchSizes.filter(batchSize => batchSize > 1).map(batchSize => ({
      id: `asyncByteBatch${batchSize}`,
      family: 'async-byte-batch',
      batchSize,
      implementation: `createEventReaderFromAsyncByteBatches with ${batchSize} chunks yielded per await`,
      run: () => consumeAsyncByteBatches(fixture, batchSize),
    })),
    ...options.batchSizes.map(batchSize => ({
      id: `syncIterableBatch${batchSize}`,
      family: 'sync-iterable-byte-batch',
      batchSize,
      implementation: `StreamReaderSync over Iterable<Uint8Array[]> with ${batchSize} chunks yielded per batch, materialized as public event objects`,
      run: () => consumeSyncByteBatches(fixture, batchSize),
    })),
    ...(fixture.corpusFile ? options.batchSizes.map(batchSize => ({
      id: `syncFileIterableBatch${batchSize}`,
      family: 'sync-file-iterable-byte-batch',
      batchSize,
      implementation: `StreamReaderSync over file-backed Iterable<Uint8Array[]> with ${batchSize} chunks read per batch, materialized as public event objects`,
      run: () => consumeSyncFileByteBatches(fixture, batchSize),
    })) : []),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'event-reader-byte-batch',
    contract: 'public-event-object-full-string-checksum',
    note: 'Compares direct ReadableStream chunk consumption with AsyncIterable<Uint8Array[]> and Iterable<Uint8Array[]> sources that yield already-grouped byte batches. All sources are demand-driven and do not enqueue/read the next batch until the reader asks for it.',
    sourceContract: {
      readableStream: 'ReadableStream<Uint8Array> enqueues one chunk from pull().',
      asyncByteBatch: 'AsyncIterable<Uint8Array[]> yields one grouped batch only when next() is awaited.',
      syncIterable: 'Iterable<Uint8Array[]> yields one grouped batch per synchronous parser pull.',
      syncFileIterable: fixture.corpusFile
        ? 'File-backed Iterable<Uint8Array[]> reads corpus chunks with readSync only when the parser pulls the next batch.'
        : 'File-backed Iterable<Uint8Array[]> rows are available only for corpus-cycle fixtures.',
      scope: fixture.corpusFile
        ? 'Prepared rows replay generated or pre-chunked corpus bytes. File-backed rows read corpus chunks with readSync on demand and replay complete corpus cycles to the target byte count; this is still a synchronous file-source benchmark, not a browser fetch streaming proof.'
        : 'The fixture rows are generated before timing and replayed to the target byte count. This isolates parser/source API overhead; it is not an OS, network, or browser fetch streaming proof.',
    },
    environment: createEnvironment(options.runtimeLabel),
    options: {
      sizeGiB: options.sizeGiB,
      runs: options.runs,
      warmups: options.warmups,
      fixtureShape: options.fixtureShape,
      corpusFile: options.corpusFile,
      corpusChunkKiB: options.corpusChunkKiB,
      diverseCycleSize: options.diverseCycleSize,
      batchSizes: options.batchSizes,
      boundedRssMiB: options.boundedRssMiB,
      runtimeLabel: options.runtimeLabel,
    },
    fixture: {
      source: fixture.source,
      targetBytes: fixture.targetBytes,
      actualBytes: fixture.actualBytes,
      sourceBytes: fixture.sourceBytes,
      chunkBytes: fixture.chunkBytes,
      corpusFile: fixture.corpusFile,
      sizeGiB: fixture.actualBytes / GIB,
      rows: fixture.rows.length,
    },
    variants: [],
    findings: [],
  };

  for (const variant of variants) {
    report.variants.push(await measureVariant(variant, fixture, options));
  }
  report.parity = computeParity(report.variants);
  report.findings = createFindings(report);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

async function measureVariant(variant, fixture, options) {
  for (let index = 0; index < options.warmups; index++) {
    await variant.run();
  }

  const samplesMs = [];
  const memorySamples = [];
  let first;
  for (let index = 0; index < options.runs; index++) {
    forceGc();
    const before = takeMemorySnapshot();
    const startedAt = performance.now();
    const result = await variant.run();
    const elapsedMs = performance.now() - startedAt;
    const after = takeMemorySnapshot();
    if (first && (first.eventCount !== result.eventCount || first.checksum !== result.checksum)) {
      throw new Error(`${variant.id} produced unstable event count or checksum.`);
    }
    first ??= result;
    samplesMs.push(elapsedMs);
    memorySamples.push({ before, after });
  }

  const avgMs = average(samplesMs);
  const maxRssBytes = Math.max(...memorySamples.map(sample => sample.after.rssBytes));
  const maxHeapUsedBytes = Math.max(...memorySamples.map(sample => sample.after.heapUsedBytes));
  return {
    id: variant.id,
    family: variant.family,
    implementation: variant.implementation,
    batchSize: variant.batchSize,
    fullStringParity: true,
    eventCountKind: 'stream-events',
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    mibPerSec: bytesToMiB(fixture.actualBytes) / (avgMs / 1000),
    samplesMs,
    eventCount: first.eventCount,
    checksum: first.checksum,
    sourceReads: first.sourceReads,
    sourceBatches: first.sourceBatches,
    boundedMemory: maxRssBytes <= options.boundedRssMiB * MIB,
    memory: {
      maxRssBytes,
      maxHeapUsedBytes,
    },
  };
}

async function consumeReadableStream(fixture, batchSize) {
  const counters = { reads: 0, batches: 0 };
  return consumeEventReader(
    new EventReader(createBackpressuredReadableStream(fixture, counters), { batchSize }),
    counters,
  );
}

async function consumeAsyncByteBatches(fixture, batchSize) {
  const counters = { reads: 0, batches: 0 };
  return consumeEventReader(
    createEventReaderFromAsyncByteBatches(createAsyncByteBatchSource(fixture, batchSize, counters)),
    counters,
  );
}

async function consumeSyncByteBatches(fixture, batchSize) {
  const counters = { reads: 0, batches: 0 };
  let eventCount = 0;
  let checksum = 0;
  for (const batch of new StreamReaderSync(createSyncByteBatchSource(fixture, batchSize, counters))) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const event = materializeStreamBatchEvent(batch, index);
      eventCount++;
      checksum = foldEvent(checksum, event);
    }
  }
  return {
    eventCount,
    checksum,
    sourceReads: counters.reads,
    sourceBatches: counters.batches,
  };
}

async function consumeSyncFileByteBatches(fixture, batchSize) {
  const counters = { reads: 0, batches: 0 };
  let eventCount = 0;
  let checksum = 0;
  for (const batch of new StreamReaderSync(createSyncFileByteBatchSource(fixture, batchSize, counters))) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const event = materializeStreamBatchEvent(batch, index);
      eventCount++;
      checksum = foldEvent(checksum, event);
    }
  }
  return {
    eventCount,
    checksum,
    sourceReads: counters.reads,
    sourceBatches: counters.batches,
  };
}

async function consumeEventReader(reader, counters) {
  let eventCount = 0;
  let checksum = 0;
  for await (const event of reader) {
    eventCount++;
    checksum = foldEvent(checksum, event);
  }
  return {
    eventCount,
    checksum,
    sourceReads: counters.reads,
    sourceBatches: counters.batches,
  };
}

function createBackpressuredReadableStream(fixture, counters) {
  let emittedBytes = 0;
  let rowIndex = 0;
  return new ReadableStream({
    pull(controller) {
      counters.reads++;
      if (emittedBytes >= fixture.actualBytes) {
        controller.close();
        return;
      }
      const row = fixture.rows[rowIndex % fixture.rows.length];
      rowIndex++;
      emittedBytes += row.byteLength;
      counters.batches++;
      controller.enqueue(row);
    },
  });
}

async function* createAsyncByteBatchSource(fixture, batchSize, counters) {
  let emittedBytes = 0;
  let rowIndex = 0;
  while (emittedBytes < fixture.actualBytes) {
    const batch = [];
    for (let index = 0; index < batchSize && emittedBytes < fixture.actualBytes; index++) {
      const row = fixture.rows[rowIndex % fixture.rows.length];
      rowIndex++;
      emittedBytes += row.byteLength;
      counters.reads++;
      batch.push(row);
    }
    counters.batches++;
    yield batch;
  }
}

function* createSyncByteBatchSource(fixture, batchSize, counters) {
  let emittedBytes = 0;
  let rowIndex = 0;
  while (emittedBytes < fixture.actualBytes) {
    const batch = [];
    for (let index = 0; index < batchSize && emittedBytes < fixture.actualBytes; index++) {
      const row = fixture.rows[rowIndex % fixture.rows.length];
      rowIndex++;
      emittedBytes += row.byteLength;
      counters.reads++;
      batch.push(row);
    }
    counters.batches++;
    yield batch;
  }
}

function* createSyncFileByteBatchSource(fixture, batchSize, counters) {
  if (!fixture.corpusFile) {
    throw new Error('sync file byte batches require a corpus-cycle fixture.');
  }
  const fd = openSync(fixture.corpusFile, 'r');
  let emittedBytes = 0;
  let offset = 0;
  try {
    while (emittedBytes < fixture.actualBytes) {
      const batch = [];
      for (let index = 0; index < batchSize && emittedBytes < fixture.actualBytes; index++) {
        const remainingInCycle = fixture.sourceBytes - offset;
        const remainingTarget = fixture.actualBytes - emittedBytes;
        const bytesToRead = Math.min(fixture.chunkBytes, remainingInCycle, remainingTarget);
        const buffer = new Uint8Array(bytesToRead);
        const bytesRead = readSync(fd, buffer, 0, bytesToRead, offset);
        if (bytesRead !== bytesToRead) {
          throw new Error(`Expected to read ${bytesToRead} bytes from ${fixture.corpusFile}, read ${bytesRead}.`);
        }
        batch.push(buffer);
        offset += bytesRead;
        emittedBytes += bytesRead;
        counters.reads++;
        if (offset >= fixture.sourceBytes) {
          offset = 0;
        }
      }
      counters.batches++;
      yield batch;
    }
  } finally {
    closeSync(fd);
  }
}

function foldEvent(checksum, event) {
  checksum = mix(checksum, publicEventTypeCode(event.type));
  if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
    checksum = foldString(checksum, event.name);
  }
  if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
    checksum = foldString(checksum, event.value?.trim());
  }
  if (event.type === XmlEventType.START_ELEMENT) {
    const entries = Object.entries(event.attributes);
    checksum = mix(checksum, entries.length);
    for (const [name, value] of entries) {
      checksum = foldString(checksum, name);
      checksum = foldString(checksum, value);
    }
  }
  return checksum;
}

function materializeStreamBatchEvent(batch, index) {
  const type = batch.typeAt(index);
  switch (type) {
    case StreamEventType.START_DOCUMENT:
      return { type: XmlEventType.START_DOCUMENT };
    case StreamEventType.END_DOCUMENT:
      return { type: XmlEventType.END_DOCUMENT };
    case StreamEventType.START_ELEMENT: {
      const attributes = {};
      const attrCount = batch.attributeCountAt(index);
      for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
        const name = batch.attributeNameAt(index, attrIndex);
        if (name !== undefined) {
          attributes[name] = batch.attributeValueAt(index, attrIndex) ?? '';
        }
      }
      return {
        type: XmlEventType.START_ELEMENT,
        name: batch.nameAt(index) ?? '',
        attributes,
      };
    }
    case StreamEventType.END_ELEMENT:
      return {
        type: XmlEventType.END_ELEMENT,
        name: batch.nameAt(index) ?? '',
      };
    case StreamEventType.CHARACTERS:
      return {
        type: XmlEventType.CHARACTERS,
        value: batch.textAt(index) ?? '',
      };
    case StreamEventType.CDATA:
      return {
        type: XmlEventType.CDATA,
        value: batch.textAt(index) ?? '',
      };
    default:
      throw new Error(`Unsupported StreamEventType: ${type}`);
  }
}

function publicEventTypeCode(type) {
  switch (type) {
    case XmlEventType.START_DOCUMENT:
      return 0;
    case XmlEventType.END_DOCUMENT:
      return 1;
    case XmlEventType.START_ELEMENT:
      return 2;
    case XmlEventType.END_ELEMENT:
      return 3;
    case XmlEventType.CHARACTERS:
      return 4;
    case XmlEventType.CDATA:
      return 5;
    default:
      return 99;
  }
}

function foldString(checksum, value) {
  if (!value) return mix(checksum, 0);
  let next = mix(checksum, value.length);
  for (let index = 0; index < value.length; index++) {
    next = mix(next, value.charCodeAt(index));
  }
  return next;
}

function mix(checksum, value) {
  return ((checksum * 31 + value) | 0);
}

function createFixture(options) {
  const targetBytes = Math.floor(options.sizeGiB * GIB);
  const rows = options.fixtureShape === 'corpus-cycle'
    ? createCorpusRows(options)
    : Array.from({ length: options.diverseCycleSize }, (_, id) => encoder.encode(makeDiverseRow(id)));
  const cycleBytes = rows.reduce((sum, row) => sum + row.byteLength, 0);
  let actualBytes;
  if (options.fixtureShape === 'corpus-cycle') {
    actualBytes = Math.ceil(targetBytes / cycleBytes) * cycleBytes;
  } else {
    actualBytes = Math.floor(targetBytes / cycleBytes) * cycleBytes;
    for (let index = 0; actualBytes < targetBytes; index++) {
      actualBytes += rows[index % rows.length].byteLength;
    }
  }
  return {
    rows,
    targetBytes,
    actualBytes,
    source: options.fixtureShape === 'corpus-cycle' ? 'corpus-cycle' : 'generated-diverse-cycle',
    sourceBytes: cycleBytes,
    chunkBytes: options.fixtureShape === 'corpus-cycle' ? options.corpusChunkKiB * 1024 : null,
    corpusFile: options.fixtureShape === 'corpus-cycle' ? options.corpusFile : null,
  };
}

function createCorpusRows(options) {
  if (!options.corpusFile) throw new Error('--corpus-file is required for --fixture-shape=corpus-cycle.');
  const corpus = readFileSync(options.corpusFile);
  if (corpus.byteLength === 0) throw new Error(`Corpus file is empty: ${options.corpusFile}`);
  const chunkBytes = options.corpusChunkKiB * 1024;
  const rows = [];
  for (let offset = 0; offset < corpus.byteLength; offset += chunkBytes) {
    rows.push(new Uint8Array(corpus.subarray(offset, Math.min(offset + chunkBytes, corpus.byteLength))));
  }
  return rows;
}

function makeDiverseRow(id) {
  const rootNames = ['person', 'record', 'entry', 'invoice', 'profile', 'asset', 'sample'];
  const childNames = ['name', 'title', 'summary', 'note', 'group', 'bucket', 'payload'];
  const rootName = `${rootNames[id % rootNames.length]}${id % 257}`;
  const childA = `${childNames[id % childNames.length]}${(id * 3) % 193}`;
  const childB = `${childNames[(id + 2) % childNames.length]}${(id * 5) % 197}`;
  const attrA = `data${id % 997}`;
  const attrB = `code${(id * 11) % 991}`;
  return `<${rootName} id="item-${id}" ${attrA}="value-${(id * 31) % 65521}" ${attrB}="group-${id % 4093}">`
    + `<${childA}>Runtime Benchmark ${id}</${childA}>`
    + `<${childB} rank="${id % 29}">Full string checksum payload ${(id * 8191) % 104729}</${childB}>`
    + `</${rootName}>`;
}

function createEnvironment(runtimeLabel) {
  const runtimeName = typeof Bun !== 'undefined' ? 'bun' : globalThis.Deno ? 'deno' : 'node';
  const denoVersion = globalThis.Deno?.version;
  return {
    packageVersion,
    runtimeName,
    runtimeLabel: runtimeLabel ?? (runtimeName === 'bun' ? 'Bun/JSC' : runtimeName === 'deno' ? 'Deno/V8' : 'Node/V8'),
    nodeVersion: process.version,
    bunVersion: typeof Bun !== 'undefined' ? Bun.version : null,
    denoVersion: denoVersion?.deno ?? null,
    v8Version: denoVersion?.v8 ?? process.versions.v8 ?? null,
    webkitVersion: process.versions.webkit ?? null,
    platform: `${process.platform}-${process.arch}`,
    cpu: cpus()[0]?.model ?? 'unknown',
  };
}

function createFindings(report) {
  const comparedBatchSize = report.options.batchSizes.find(batchSize =>
    batchSize > 1
    && report.variants.some(row => row.id === `readableStreamBatch${batchSize}`)
    && report.variants.some(row => row.id === `asyncByteBatch${batchSize}`)
    && report.variants.some(row => row.id === `syncIterableBatch${batchSize}`)
  );
  const readable = comparedBatchSize
    ? report.variants.find(row => row.id === `readableStreamBatch${comparedBatchSize}`)
    : undefined;
  const asyncBatch = comparedBatchSize
    ? report.variants.find(row => row.id === `asyncByteBatch${comparedBatchSize}`)
    : undefined;
  const syncBatch = comparedBatchSize
    ? report.variants.find(row => row.id === `syncIterableBatch${comparedBatchSize}`)
    : undefined;
  const asyncRatio = readable && asyncBatch ? asyncBatch.mibPerSec / readable.mibPerSec : undefined;
  const syncRatio = readable && syncBatch ? syncBatch.mibPerSec / readable.mibPerSec : undefined;
  return [
    {
      id: 'full-string-parity',
      classification: 'CONTRACT_FACT',
      summary: 'All selected source-consumption rows preserve the same public event-object full-string checksum contract.',
      evidence: [
        `status=${report.parity.status}`,
        `events=${report.parity.eventCount}`,
        `checksum=${report.parity.checksum}`,
        `rows=${report.parity.rowIds.join(', ')}`,
      ],
    },
    {
      id: 'backpressure-preserved',
      classification: 'SOURCE_FACT',
      summary: 'All benchmark sources are demand-driven. The ReadableStream source enqueues in pull(), the async byte-batch source yields one batch only when next() is awaited, and the sync iterable source yields one batch per parser pull.',
      evidence: report.variants.map(row => `${row.id}: sourceReads=${row.sourceReads}, sourceBatches=${row.sourceBatches}`),
    },
    {
      id: 'fixture-cycle-source-scope',
      classification: 'SOURCE_FACT',
      summary: report.fixture.corpusFile
        ? 'Prepared rows replay fixture chunks; file-backed rows read corpus chunks from the OS file source on demand while preserving the same parser/checksum contract.'
        : 'The benchmark isolates parser/source API overhead by replaying prepared fixture rows, not by streaming the full target size from OS, network, or browser fetch.',
      evidence: [
        `fixtureSource=${report.fixture.source}`,
        `fixtureRows=${report.fixture.rows}`,
        `sourceBytes=${report.fixture.sourceBytes}`,
        `actualBytes=${report.fixture.actualBytes}`,
        `fileBackedRows=${report.variants.filter(row => row.family === 'sync-file-iterable-byte-batch').map(row => row.id).join(', ') || 'none'}`,
      ],
    },
    readable && asyncBatch
      ? {
          id: 'async-byte-batch-headroom',
          classification: 'BENCH_FACT',
          summary: `At batch size ${comparedBatchSize}, async byte batches were ${asyncRatio.toFixed(2)}x the ReadableStream row on this run; this row avoids direct ReadableStream consumption but still crosses an AsyncIterator source boundary.`,
          evidence: [
            `readableStreamBatch${comparedBatchSize}=${readable.mibPerSec.toFixed(2)} MiB/s`,
            `asyncByteBatch${comparedBatchSize}=${asyncBatch.mibPerSec.toFixed(2)} MiB/s`,
          ],
        }
      : null,
    readable && syncBatch
      ? {
          id: 'sync-iterable-byte-batch-headroom',
          classification: 'BENCH_FACT',
          summary: `At batch size ${comparedBatchSize}, sync iterable byte batches were ${syncRatio.toFixed(2)}x the ReadableStream row on this run; this is the row that removes the ReadableStream and AsyncIterator source boundary while preserving demand-driven pulls.`,
          evidence: [
            `readableStreamBatch${comparedBatchSize}=${readable.mibPerSec.toFixed(2)} MiB/s`,
            `syncIterableBatch${comparedBatchSize}=${syncBatch.mibPerSec.toFixed(2)} MiB/s`,
          ],
        }
      : null,
  ].filter(Boolean);
}

function computeParity(variants) {
  if (variants.length === 0) {
    return {
      status: 'not-applicable',
      eventCount: null,
      checksum: null,
      rowIds: [],
    };
  }
  const first = variants[0];
  const mismatch = variants.find(row => row.eventCount !== first.eventCount || row.checksum !== first.checksum);
  if (mismatch) {
    throw new Error(`${mismatch.id} does not preserve event count/checksum parity with ${first.id}.`);
  }
  return {
    status: 'ok',
    eventCount: first.eventCount,
    checksum: first.checksum,
    rowIds: variants.map(row => row.id),
  };
}

function renderMarkdown(report) {
  const lines = [
    '# EventReader Byte Batch Benchmark',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Options',
    '',
    `- Size GiB: ${report.options.sizeGiB}`,
    `- Runs: ${report.options.runs}`,
    `- Warmups: ${report.options.warmups}`,
    `- Runtime: ${report.environment.runtimeLabel}`,
    `- Fixture shape: ${report.options.fixtureShape}`,
    report.options.corpusFile ? `- Corpus file: ${report.options.corpusFile}` : null,
    report.options.fixtureShape === 'corpus-cycle' ? `- Corpus chunk KiB: ${report.options.corpusChunkKiB}` : null,
    `- Diverse cycle size: ${report.options.diverseCycleSize}`,
    `- Fixture source bytes: ${formatMiB(report.fixture.sourceBytes)}`,
    report.fixture.chunkBytes ? `- Fixture chunk bytes: ${report.fixture.chunkBytes}` : null,
    `- Batch sizes: ${report.options.batchSizes.join(', ')}`,
    `- Bounded RSS gate: ${formatMiB(report.options.boundedRssMiB * MIB)}`,
    '',
    '## Source Contract',
    '',
    `- ReadableStream: ${report.sourceContract.readableStream}`,
    `- Async byte batch: ${report.sourceContract.asyncByteBatch}`,
    `- Sync iterable: ${report.sourceContract.syncIterable}`,
    `- Sync file iterable: ${report.sourceContract.syncFileIterable}`,
    `- Scope: ${report.sourceContract.scope}`,
    '',
    '## Parity',
    '',
    `- Full-string parity: ${report.parity.status}`,
    `- Events: ${report.parity.eventCount}`,
    `- Checksum: ${report.parity.checksum}`,
    `- Rows: ${report.parity.rowIds.join(', ')}`,
    '',
    '## Results',
    '',
    '| Variant | Family | Batch size | Throughput | Events | Checksum | Source reads | Source batches | Bounded | Max RSS |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |',
  ].filter(line => line !== null);
  for (const row of report.variants) {
    lines.push(`| ${row.id} | ${row.family} | ${row.batchSize} | ${row.mibPerSec.toFixed(2)} MiB/s | ${row.eventCount} | ${row.checksum} | ${row.sourceReads} | ${row.sourceBatches} | ${row.boundedMemory ? 'yes' : 'no'} | ${formatMiB(row.memory.maxRssBytes)} |`);
  }
  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const item of finding.evidence) {
      lines.push(`  - ${item}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function printSummary(report) {
  console.log('EventReader byte batch benchmark');
  for (const row of report.variants) {
    console.log(`${row.id.padEnd(24)} ${row.mibPerSec.toFixed(2)} MiB/s reads=${row.sourceReads} batches=${row.sourceBatches}`);
  }
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  console.log(`Wrote ${filePath}`);
}

function forceGc() {
  if (typeof globalThis.gc === 'function') globalThis.gc();
}

function takeMemorySnapshot() {
  const memory = process.memoryUsage();
  return {
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
  };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function bytesToMiB(value) {
  return value / MIB;
}

function formatMiB(value) {
  return `${bytesToMiB(value).toFixed(1)} MiB`;
}

void main();
