import { existsSync, mkdirSync, openSync, closeSync, writeSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { initStaxXml, StreamEventType, StreamReaderSync } from 'stax-xml';
import { nodeFileByteBatchesSync } from 'stax-xml/adapters/node';
import {
  collectFullStringArenaFile,
  collectFullStringValuesFile,
  parseAggregateFile,
} from '@stax-xml/native-aggregate-probe';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_FILE = join(__dirname, 'test-data', 'runtime-comparison-16mib.xml');
const DEFAULT_RUNS = 3;
const DEFAULT_WARMUPS = 1;
const DEFAULT_CHUNK_SIZE = 1024 * 1024;
const DEFAULT_BATCH_SIZE = 1;
const utf8Decoder = new TextDecoder();

function parseArgs(argv) {
  const options = {
    file: DEFAULT_FILE,
    runs: DEFAULT_RUNS,
    warmups: DEFAULT_WARMUPS,
    chunkSize: DEFAULT_CHUNK_SIZE,
    batchSize: DEFAULT_BATCH_SIZE,
    jsonOut: undefined,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;
    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error(`${arg} requires a value.`);
      }
      index++;
      return value;
    };

    switch (name) {
      case '--file':
        options.file = resolve(process.cwd(), readValue());
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), '--runs');
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), '--warmups');
        break;
      case '--chunk-size':
        options.chunkSize = parsePositiveInteger(readValue(), '--chunk-size');
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), '--batch-size');
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!existsSync(options.file) && options.file === DEFAULT_FILE) {
    generateXmlFile(options.file, 16 * 1024 * 1024);
  }
  if (!existsSync(options.file)) {
    throw new Error(`Benchmark fixture does not exist: ${options.file}`);
  }

  return options;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }
  return parsed;
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
      const element = Buffer.from(
        `  <book id="book-${id}" lang="en" code="${id % 97}">` +
          `<title>Runtime Benchmark ${id}</title>` +
          `<author>Author ${id % 4096}</author>` +
          `<description>Full string checksum text payload ${id} with stable words and numbers.</description>` +
          `<chapter number="1">Intro ${id}</chapter>` +
          `<chapter number="2">Body ${id}</chapter>` +
        '</book>\n',
      );
      if (written + pendingBytes + element.byteLength + footer.byteLength > targetBytes) {
        break;
      }
      pending.push(element);
      pendingBytes += element.byteLength;
      id++;
      if (pendingBytes >= 1024 * 1024) {
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

function mixChecksum(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function foldString(seed, value) {
  if (!value) {
    return seed;
  }
  let next = seed;
  for (let index = 0; index < value.length; index++) {
    next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  }
  return next;
}

function streamEventTypeId(type) {
  switch (type) {
    case StreamEventType.START_DOCUMENT:
      return 1;
    case StreamEventType.END_DOCUMENT:
      return 2;
    case StreamEventType.START_ELEMENT:
      return 3;
    case StreamEventType.END_ELEMENT:
      return 4;
    case StreamEventType.CHARACTERS:
      return 5;
    case StreamEventType.CDATA:
      return 6;
    default:
      throw new Error(`Unsupported stream event type: ${type}`);
  }
}

function makeStreamReader(filePath, options) {
  return new StreamReaderSync(
    nodeFileByteBatchesSync(filePath, {
      chunkSize: options.chunkSize,
      batchSize: options.batchSize,
    }),
  );
}

function consumeNativeAggregate(filePath, tier) {
  const result = parseAggregateFile(filePath, tier);
  return {
    eventCount: result.eventCount,
    checksum: result.checksum,
    attrCountTotal: result.attrCountTotal,
    objectCount: result.objectCount,
  };
}

function consumeNativeStringTransfer(filePath) {
  const result = collectFullStringValuesFile(filePath);
  let stringChecksum = 0;
  for (const value of result.strings) {
    stringChecksum = foldString(stringChecksum, value);
  }
  return {
    eventCount: result.eventCount,
    checksum: result.checksum,
    stringChecksum,
    attrCountTotal: result.attrCountTotal,
    objectCount: result.objectCount,
    stringCount: result.stringCount,
    stringUnits: result.stringUnits,
  };
}

function consumeNativeStringArena(filePath) {
  const result = collectFullStringArenaFile(filePath);
  const offsets = uint32View(result.offsets);
  const expectedOffsetCount = result.stringCount * 2;
  if (offsets.length !== expectedOffsetCount) {
    throw new Error(
      `Native string arena offset count mismatch: expected ${expectedOffsetCount}, got ${offsets.length}.`,
    );
  }

  let stringChecksum = 0;
  for (let offsetIndex = 0; offsetIndex < offsets.length; offsetIndex += 2) {
    stringChecksum = foldString(
      stringChecksum,
      result.arena.slice(offsets[offsetIndex], offsets[offsetIndex + 1]),
    );
  }

  return {
    eventCount: result.eventCount,
    checksum: result.checksum,
    stringChecksum,
    attrCountTotal: result.attrCountTotal,
    objectCount: result.objectCount,
    stringCount: result.stringCount,
    stringUnits: result.stringUnits,
    arenaCount: 1,
  };
}

function uint32View(buffer) {
  if (buffer.byteLength % 4 !== 0) {
    throw new Error(
      `Native string arena offsets must be 4-byte aligned, got ${buffer.byteLength} bytes.`,
    );
  }
  if (buffer.byteOffset % 4 === 0) {
    return new Uint32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  }
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return new Uint32Array(copy.buffer);
}

function consumeRawPerSpan(parser) {
  return consumeRaw(parser, createBatchSpanDecoder);
}

function consumeRawJsStringArena(parser) {
  return consumeRaw(parser, createAsciiArenaDecoder);
}

function consumeRawSoaStringArenaDirect(parser) {
  return consumeRaw(parser, createBatchSpanDecoder, true);
}

function consumeRaw(parser, decoderFactory, preferSoaArena = false) {
  let eventCount = 0;
  let checksum = 0;
  let attrCountTotal = 0;
  let stringCount = 0;
  let stringUnits = 0;
  let arenaCount = 0;
  let skipped = false;

  for (;;) {
    const batch = parser.nextRawBatch();
    if (batch === null) {
      break;
    }
    if (preferSoaArena && batch.kind !== 'soa-string-arena') {
      skipped = true;
      break;
    }
    const decodeSpan = decoderFactory(batch.buffer);
    if (decodeSpan === undefined) {
      skipped = true;
      break;
    }
    arenaCount++;
    const count = batch.eventCount;
    for (let eventIndex = 0; eventIndex < count; eventIndex++) {
      const type = rawEventType(batch, eventIndex);
      eventCount++;
      checksum = mixChecksum(checksum, streamEventTypeId(type));

      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        const value = rawName(batch, eventIndex, decodeSpan, preferSoaArena);
        checksum = foldString(checksum, value);
        if (value !== undefined) {
          stringCount++;
          stringUnits += value.length;
        }
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        const value = rawText(batch, eventIndex, decodeSpan, preferSoaArena)?.trim();
        checksum = foldString(checksum, value);
        if (value !== undefined) {
          stringCount++;
          stringUnits += value.length;
        }
      }

      const attrCount = type === StreamEventType.START_ELEMENT ? rawAttrCount(batch, eventIndex) : 0;
      checksum = mixChecksum(checksum, attrCount);
      attrCountTotal += attrCount;
      for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
        const name = rawAttrName(batch, eventIndex, attrIndex, decodeSpan, preferSoaArena);
        const value = rawAttrValue(batch, eventIndex, attrIndex, decodeSpan, preferSoaArena);
        checksum = foldString(checksum, name);
        checksum = foldString(checksum, value);
        if (name !== undefined) {
          stringCount++;
          stringUnits += name.length;
        }
        if (value !== undefined) {
          stringCount++;
          stringUnits += value.length;
        }
      }
    }
  }

  return {
    status: skipped ? 'skipped' : 'ok',
    eventCount,
    checksum,
    attrCountTotal,
    stringCount,
    stringUnits,
    arenaCount,
    reason: skipped
      ? preferSoaArena
        ? 'StreamReaderSync raw batch did not expose the soa-string-arena layout.'
        : 'JS string arena approximation requires ASCII byte offsets to match UTF-16 offsets.'
      : undefined,
  };
}

function createBatchSpanDecoder(buffer) {
  if (Buffer.isBuffer(buffer) && typeof buffer.toString === 'function') {
    return (start, end) => start < 0 || end < 0 ? undefined : buffer.toString('utf8', start, end);
  }
  return (start, end) => start < 0 || end < 0 ? undefined : utf8Decoder.decode(buffer.subarray(start, end));
}

function createAsciiArenaDecoder(buffer) {
  if (!isAscii(buffer)) {
    return undefined;
  }
  const arena = Buffer.isBuffer(buffer) && typeof buffer.toString === 'function'
    ? buffer.toString('utf8')
    : utf8Decoder.decode(buffer);
  return (start, end) => start < 0 || end < 0 ? undefined : arena.slice(start, end);
}

function decodeSoaArenaSpan(batch, start, end) {
  return start < 0 || end < 0 ? undefined : batch.stringArena.slice(start, end);
}

function isAscii(buffer) {
  for (let index = 0; index < buffer.byteLength; index++) {
    if (buffer[index] >= 0x80) {
      return false;
    }
  }
  return true;
}

function rawEventBase(batch, eventIndex) {
  return batch.eventWordOffset + eventIndex * batch.eventStrideWords;
}

function rawAttrBase(batch, eventIndex, attrIndex) {
  if (batch.kind === 'word-table') {
    const eventBase = rawEventBase(batch, eventIndex);
    const attrTableIndex = batch.eventWords[eventBase + 5] + attrIndex;
    return batch.attrWordOffset + attrTableIndex * batch.attrStrideWords;
  }
  return batch.attrStarts[eventIndex] + attrIndex;
}

function rawEventType(batch, eventIndex) {
  if (batch.kind === 'word-table') {
    return batch.eventWords[rawEventBase(batch, eventIndex)];
  }
  return batch.eventTypes[eventIndex];
}

function rawAttrCount(batch, eventIndex) {
  if (batch.kind === 'word-table') {
    return batch.eventWords[rawEventBase(batch, eventIndex) + 6];
  }
  return batch.attrCounts[eventIndex];
}

function rawName(batch, eventIndex, decodeSpan, preferSoaArena = false) {
  if (batch.kind === 'word-table') {
    const base = rawEventBase(batch, eventIndex);
    return decodeSpan(batch.spanWords[base + 1], batch.spanWords[base + 2]);
  }
  if (preferSoaArena && batch.kind === 'soa-string-arena') {
    return decodeSoaArenaSpan(batch, batch.eventNameArenaStarts[eventIndex], batch.eventNameArenaEnds[eventIndex])
      ?? decodeSpan(batch.nameStarts[eventIndex], batch.nameEnds[eventIndex]);
  }
  return decodeSpan(batch.nameStarts[eventIndex], batch.nameEnds[eventIndex]);
}

function rawText(batch, eventIndex, decodeSpan, preferSoaArena = false) {
  if (batch.kind === 'word-table') {
    const base = rawEventBase(batch, eventIndex);
    return decodeSpan(batch.spanWords[base + 3], batch.spanWords[base + 4]);
  }
  if (preferSoaArena && batch.kind === 'soa-string-arena') {
    return decodeSoaArenaSpan(batch, batch.eventTextArenaStarts[eventIndex], batch.eventTextArenaEnds[eventIndex])
      ?? decodeSpan(batch.textStarts[eventIndex], batch.textEnds[eventIndex]);
  }
  return decodeSpan(batch.textStarts[eventIndex], batch.textEnds[eventIndex]);
}

function rawAttrName(batch, eventIndex, attrIndex, decodeSpan, preferSoaArena = false) {
  const base = rawAttrBase(batch, eventIndex, attrIndex);
  if (batch.kind === 'word-table') {
    return decodeSpan(batch.spanWords[base], batch.spanWords[base + 1]);
  }
  if (preferSoaArena && batch.kind === 'soa-string-arena') {
    return decodeSoaArenaSpan(batch, batch.attrNameArenaStarts[base], batch.attrNameArenaEnds[base])
      ?? decodeSpan(batch.attrNameStarts[base], batch.attrNameEnds[base]);
  }
  return decodeSpan(batch.attrNameStarts[base], batch.attrNameEnds[base]);
}

function rawAttrValue(batch, eventIndex, attrIndex, decodeSpan, preferSoaArena = false) {
  const base = rawAttrBase(batch, eventIndex, attrIndex);
  if (batch.kind === 'word-table') {
    return decodeSpan(batch.spanWords[base + 2], batch.spanWords[base + 3]);
  }
  if (preferSoaArena && batch.kind === 'soa-string-arena') {
    return decodeSoaArenaSpan(batch, batch.attrValueArenaStarts[base], batch.attrValueArenaEnds[base])
      ?? decodeSpan(batch.attrValueStarts[base], batch.attrValueEnds[base]);
  }
  return decodeSpan(batch.attrValueStarts[base], batch.attrValueEnds[base]);
}

function measure(id, create, run, fileSizeMiB, options) {
  for (let index = 0; index < options.warmups; index++) {
    run(create());
  }

  const samplesMs = [];
  let reference;
  for (let index = 0; index < options.runs; index++) {
    if (globalThis.gc) {
      globalThis.gc();
    }
    const startedAt = performance.now();
    const result = run(create());
    const elapsedMs = performance.now() - startedAt;
    if (result.status === 'skipped') {
      return { id, status: 'skipped', reason: result.reason };
    }
    if (
      reference
      && (
        result.eventCount !== reference.eventCount
        || result.checksum !== reference.checksum
      )
    ) {
      throw new Error(`${id} produced unstable event count/checksum.`);
    }
    reference = result;
    samplesMs.push(elapsedMs);
  }

  const avgMs = samplesMs.reduce((sum, value) => sum + value, 0) / samplesMs.length;
  return {
    id,
    status: 'ok',
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    mibPerSec: fileSizeMiB / (avgMs / 1000),
    samplesMs,
    ...reference,
  };
}

function formatRate(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} MiB/s` : 'n/a';
}

function formatMs(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)} ms` : 'n/a';
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  await initStaxXml({ backend: 'native', fallbackOnLoadError: false });
  const fileSizeMiB = statSync(options.file).size / 1024 / 1024;

  const scenarios = [
    measure(
      'native-full-string-direct-no-transfer',
      () => options.file,
      (filePath) => consumeNativeAggregate(filePath, 'full-string-direct'),
      fileSizeMiB,
      options,
    ),
    measure(
      'native-event-object-full-rust-strings-no-transfer',
      () => options.file,
      (filePath) => consumeNativeAggregate(filePath, 'event-object-full'),
      fileSizeMiB,
      options,
    ),
    measure(
      'native-full-string-values-js-string-transfer',
      () => options.file,
      consumeNativeStringTransfer,
      fileSizeMiB,
      options,
    ),
    measure(
      'native-full-string-arena-js-slice',
      () => options.file,
      consumeNativeStringArena,
      fileSizeMiB,
      options,
    ),
    measure(
      'stream-raw-arraybuffer-per-span-decode',
      () => makeStreamReader(options.file, options),
      consumeRawPerSpan,
      fileSizeMiB,
      options,
    ),
    measure(
      'stream-raw-soa-string-arena-direct',
      () => makeStreamReader(options.file, options),
      consumeRawSoaStringArenaDirect,
      fileSizeMiB,
      options,
    ),
    measure(
      'stream-raw-js-string-arena-ascii',
      () => makeStreamReader(options.file, options),
      consumeRawJsStringArena,
      fileSizeMiB,
      options,
    ),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    file: options.file,
    fileSizeMiB,
    options,
    scenarios,
  };

  console.log('Full-string transfer hypothesis benchmark');
  console.log(`File: ${options.file} (${fileSizeMiB.toFixed(2)} MiB)`);
  console.log(`Runs: warmups=${options.warmups}, runs=${options.runs}, chunkSize=${options.chunkSize}, batchSize=${options.batchSize}`);
  for (const scenario of scenarios) {
    if (scenario.status !== 'ok') {
      console.log(`  ${scenario.id}: ${scenario.status} (${scenario.reason})`);
      continue;
    }
    console.log(
      `  ${scenario.id}: ${formatRate(scenario.mibPerSec)}, ${formatMs(scenario.avgMs)}, ` +
      `events=${scenario.eventCount}, checksum=${scenario.checksum}, strings=${scenario.stringCount ?? 'n/a'}, ` +
      `arenas=${scenario.arenaCount ?? 'n/a'}, objects=${scenario.objectCount ?? 'n/a'}, ` +
      `stringChecksum=${scenario.stringChecksum ?? 'n/a'}`,
    );
  }

  if (options.jsonOut) {
    mkdirSync(dirname(options.jsonOut), { recursive: true });
    writeFileSync(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Saved JSON report to ${options.jsonOut}`);
  }
}

if (resolve(process.argv[1] ?? '') === __filename) {
  void main();
}
