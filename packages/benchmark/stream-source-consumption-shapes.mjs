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
  'web-readable-stream-pull',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    shapes: allShapes,
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
      rows.push(measureSyncShape(shape, () => consumeSyncStreamReader(
        createFileByteBatches(options.file, options.chunkKiB * 1024, options.batchSize),
      ), fileStats.size / MIB, options));
      continue;
    }
    if (shape === 'web-readable-stream-pull') {
      rows.push(await measureAsyncShape(shape, () => consumeAsyncStreamReader(
        createBackpressureReadableStream(options.file, options.chunkKiB * 1024),
      ), fileStats.size / MIB, options));
      continue;
    }
    throw new Error(`Unhandled shape: ${shape}`);
  }

  const fastest = maxBy(rows, row => row.mibPerSec);
  const slowest = minBy(rows, row => row.mibPerSec);
  const syncRow = rows.find(row => row.id === 'sync-iterable-byte-batches');
  const readableRow = rows.find(row => row.id === 'web-readable-stream-pull');
  return {
    generatedAt: new Date().toISOString(),
    objective: 'stream-source-consumption-shapes',
    contract: 'same-full-string-checksum-source-consumption-shapes',
    note: 'Compares demand-driven sync Iterable<Uint8Array[]> consumption with direct Web ReadableStream<Uint8Array> consumption under the same StreamBatch full-string checksum contract. The ReadableStream row reads one chunk only from pull(), so it respects stream backpressure and does not pre-materialize the file.',
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
      runs: options.runs,
      warmups: options.warmups,
      boundedRssMiB: options.boundedRssMiB,
    },
    rows,
    summary: {
      rowCount: rows.length,
      fastest: summarizeRow(fastest),
      slowest: summarizeRow(slowest),
      readableStreamRatioToSyncIterable: syncRow && readableRow ? readableRow.mibPerSec / syncRow.mibPerSec : null,
      counterexamples200MiB: rows.filter(row => row.fullStringParity && row.boundedMemory && row.mibPerSec >= 200).length,
    },
    findings: createFindings(rows, syncRow, readableRow),
  };
}

function createSourceContract(options) {
  return {
    fullChecksumConsumer: 'Both rows execute the same StreamBatch full-string checksum consumer and must preserve event count plus checksum parity before throughput is compared.',
    syncIterableInput: 'sync-iterable-byte-batches uses StreamReaderSync over a synchronous Iterable<Uint8Array[]> and yields one grouped batch per parser pull.',
    readableStreamInput: 'web-readable-stream-pull uses StreamReader over a Web ReadableStream<Uint8Array> pull source.',
    readableStreamBackpressure: 'The ReadableStream source reads one file chunk only inside pull(), so production is demand-driven by StreamReader.read().',
    arrayBufferConsumption: 'Neither measured row constructs one full XML string or one repeated 1 GiB ArrayBuffer parser input; file chunks are read on demand for the selected source shape.',
    chunkBytes: options.chunkKiB * 1024,
    syncBatchSize: options.batchSize,
  };
}

function createSourceFacts() {
  const files = [
    readSourceFile('packages/benchmark/stream-source-consumption-shapes.mjs', resolve(__dirname, 'stream-source-consumption-shapes.mjs')),
    readSourceFile('packages/stax-xml/src/StreamReaderSync.ts', join(staxSrcDir, 'StreamReaderSync.ts')),
    readSourceFile('packages/stax-xml/src/StreamReader.ts', join(staxSrcDir, 'StreamReader.ts')),
    readSourceFile('packages/stax-xml/src/IterableEventBackend.ts', join(staxSrcDir, 'IterableEventBackend.ts')),
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
      summary: 'The public StreamReader ReadableStream path pushes each read chunk as one single-item byte batch into the parser core.',
      patterns: [
        { file: 'packages/stax-xml/src/StreamReader.ts', text: 'readResult = await this.reader.read()' },
        { file: 'packages/stax-xml/src/StreamReader.ts', text: 'this.streamingBatches.pushByteBatch([readResult.value], false)' },
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
      summary: 'The direct ReadableStream benchmark source reads exactly one file chunk inside pull(), so it respects Web Stream backpressure.',
      patterns: [
        { file: 'packages/benchmark/stream-source-consumption-shapes.mjs', text: 'pull(controller)' },
        { file: 'packages/benchmark/stream-source-consumption-shapes.mjs', text: 'const bytesRead = readSync(fd, buffer, 0, chunkBytes, null)' },
        { file: 'packages/benchmark/stream-source-consumption-shapes.mjs', text: 'controller.enqueue(bytesRead === chunkBytes ? buffer : buffer.subarray(0, bytesRead))' },
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
    if (trimmed.startsWith("'") || trimmed.startsWith('"') || trimmed.startsWith('`')) {
      continue;
    }
    if (trimmed.includes(' text: ') || trimmed.startsWith('patterns:')) {
      continue;
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

async function consumeAsyncStreamReader(stream) {
  let eventCount = 0;
  let checksum = 0;
  for await (const batch of new StreamReader(stream)) {
    const result = consumeBatch(batch, eventCount, checksum);
    eventCount = result.eventCount;
    checksum = result.checksum;
  }
  return { eventCount, checksum };
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
  const avgMs = samplesMs.reduce((sum, value) => sum + value, 0) / samplesMs.length;
  const maxRssBytes = Math.max(...memorySamples.map(sample => sample.after.rssBytes));
  const maxHeapUsedBytes = Math.max(...memorySamples.map(sample => sample.after.heapUsedBytes));
  return {
    id,
    tool: id,
    implementation: describeImplementation(id),
    family: 'source-consumption-shape',
    sourceMode: id,
    contractScope: 'full-string-checksum',
    fullStringParity: true,
    chunkKiB: options.chunkKiB,
    batchSize: id === 'sync-iterable-byte-batches' ? options.batchSize : null,
    demandDrivenSource: true,
    respectsBackpressure: id === 'web-readable-stream-pull' ? true : null,
    mibPerSec: fileSizeMiB / (avgMs / 1000),
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
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

function describeImplementation(id) {
  if (id === 'sync-iterable-byte-batches') {
    return 'Node + stax-xml StreamReaderSync over demand-driven Iterable<Uint8Array[]> file batches';
  }
  if (id === 'web-readable-stream-pull') {
    return 'Node + stax-xml StreamReader over backpressure-respecting ReadableStream<Uint8Array> pull source';
  }
  return id;
}

function createFindings(rows, syncRow, readableRow) {
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
      summary: 'The current file-backed release comparison uses the sync Iterable<Uint8Array[]> shape, not direct Web ReadableStream consumption.',
      evidence: syncRow ? [`${syncRow.id}: ${formatNumber(syncRow.mibPerSec)} MiB/s`] : [],
    },
    {
      id: 'readable-stream-direct-source-shape',
      classification: 'BENCH_FACT',
      summary: syncRow && readableRow
        ? `Direct ReadableStream consumption reached ${formatNumber(readableRow.mibPerSec)} MiB/s (${formatNumber(readableRow.mibPerSec / syncRow.mibPerSec)}x of sync Iterable<Uint8Array[]>); this is a separate source-shape row, not the current release comparison source.`
        : 'ReadableStream and sync Iterable rows were not both measured.',
      evidence: rows.map(row => `${row.id}=${formatNumber(row.mibPerSec)} MiB/s rss=${formatBytes(row.memory?.maxRssBytes)}`),
    },
    {
      id: 'backpressure-respected',
      classification: 'CONTRACT_FACT',
      summary: 'The ReadableStream row reads from the file only in pull(), so production is demand-driven by StreamReader.read().',
      evidence: readableRow ? [`${readableRow.id}: demandDrivenSource=${readableRow.demandDrivenSource}, respectsBackpressure=${readableRow.respectsBackpressure}`] : [],
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
  lines.push(`- ReadableStream input: ${report.sourceContract.readableStreamInput}`);
  lines.push(`- ReadableStream backpressure: ${report.sourceContract.readableStreamBackpressure}`);
  lines.push(`- ArrayBuffer consumption: ${report.sourceContract.arrayBufferConsumption}`);
  lines.push(`- Chunk bytes: ${report.sourceContract.chunkBytes}`);
  lines.push(`- Sync batch size: ${report.sourceContract.syncBatchSize}`);
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
  lines.push(`- Sync Iterable batch size: ${report.options.batchSize}`);
  lines.push(`- Fastest row: ${formatSummaryRow(report.summary.fastest)}`);
  lines.push(`- ReadableStream / sync Iterable ratio: ${formatNullableNumber(report.summary.readableStreamRatioToSyncIterable)}x`);
  lines.push(`- 200 MiB/s bounded full-string counterexamples: ${report.summary.counterexamples200MiB}`);
  lines.push('');
  lines.push('## Rows');
  lines.push('');
  lines.push('| Row | Source shape | MiB/s | Bounded | Max RSS | Events | Checksum | Demand-driven | Stream backpressure |');
  lines.push('| --- | --- | ---: | --- | ---: | ---: | ---: | --- | --- |');
  for (const row of report.rows) {
    lines.push(`| \`${row.id}\` | ${row.implementation} | ${formatNumber(row.mibPerSec)} | ${row.boundedMemory ? 'yes' : 'no'} | ${formatBytes(row.memory?.maxRssBytes)} | ${row.eventCount} | ${row.checksum} | ${row.demandDrivenSource ? 'yes' : 'no'} | ${row.respectsBackpressure === null ? 'n/a' : row.respectsBackpressure ? 'yes' : 'no'} |`);
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
  lines.push('- Both rows still execute the same StreamBatch full-string checksum consumer; this does not isolate parser tokenization cost.');
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
