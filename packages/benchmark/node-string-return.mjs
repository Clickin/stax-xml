import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { EventReaderSync, initStaxXml, StreamEventType, StreamReaderSync, XmlEventType } from 'stax-xml';
import { nodeFileByteBatchesSync } from 'stax-xml/adapters/node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TIER_IDS = [
  'count-only',
  'name-string-only',
  'text-string-only',
  'attr-value-string-only',
  'full-string',
];

const DEFAULT_SIZES_MIB = [512, 1024];
const DEFAULT_CHUNK_SIZE = 1024 * 1024;
const DEFAULT_BATCH_SIZE = 1;
const DEFAULT_RUNS = 3;
const DEFAULT_WARMUPS = 1;
const QUICK_FILE = join(__dirname, 'assets', 'midsize.xml');
const GENERATED_DIR = join(__dirname, 'test-data');
const COUNT_REGRESSION_LIMIT = 0.03;
const FULL_STRING_MIN_IMPROVEMENT = 0.10;
const FULL_STRING_MIN_MIB_PER_SEC = 190;
const DEFAULT_SIMDXML_MAX_MIB = 64;
const NATIVE_ADDON_FULL_SPEC_MIN_RATIO = 0.9;
const NATIVE_ADDON_FULL_SPEC_ID = 'native-addon-full-spec';
const PUBLIC_NATIVE_WRAPPER_ID = 'stream-reader-native';
const PUBLIC_NATIVE_INDEXED_ID = 'stream-reader-native-indexed';
const PUBLIC_NATIVE_RAW_ID = 'stream-reader-native-raw';
const EVENT_READER_NATIVE_REFERENCE_ID = 'event-reader-native';
const NATIVE_ADDON_FULL_SPEC_TIER_BY_PUBLIC_TIER = new Map([
  ['count-only', 'count-only'],
  ['name-string-only', 'name-string-only'],
  ['text-string-only', 'text-string-only'],
  ['attr-value-string-only', 'attr-value-string-only'],
  ['full-string', 'full-string-direct'],
]);
const utf8Decoder = new TextDecoder();

function parseArgs(argv) {
  const options = {
    files: [],
    sizesMiB: [],
    quick: false,
    runs: DEFAULT_RUNS,
    warmups: DEFAULT_WARMUPS,
    chunkSize: DEFAULT_CHUNK_SIZE,
    batchSize: DEFAULT_BATCH_SIZE,
    generatedDir: GENERATED_DIR,
    jsonOut: undefined,
    failGate: false,
    sampleEvery: 65_536,
    woodstoxCmd: undefined,
    quickXmlCmd: undefined,
    simdxmlCmd: undefined,
    simdxmlMaxMiB: DEFAULT_SIMDXML_MAX_MIB,
    tiers: TIER_IDS,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;
    if (arg === '--') continue;

    if (arg === '--quick') {
      options.quick = true;
      options.runs = 1;
      options.warmups = 0;
      continue;
    }
    if (arg === '--fail-gate') {
      options.failGate = true;
      continue;
    }

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
        options.files.push(resolve(process.cwd(), readValue()));
        break;
      case '--size-mib':
        options.sizesMiB.push(parsePositiveNumber(readValue(), '--size-mib'));
        break;
      case '--sizes-mib':
        options.sizesMiB.push(...readValue().split(',').filter(Boolean).map(value => parsePositiveNumber(value, '--sizes-mib')));
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
      case '--generated-dir':
        options.generatedDir = resolve(process.cwd(), readValue());
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--sample-every':
        options.sampleEvery = parsePositiveInteger(readValue(), '--sample-every');
        break;
      case '--tiers': {
        const tiers = readValue().split(',').map(value => value.trim()).filter(Boolean);
        for (const tier of tiers) {
          if (!TIER_IDS.includes(tier)) {
            throw new Error(`Unknown tier: ${tier}`);
          }
        }
        options.tiers = tiers;
        break;
      }
      case '--woodstox-cmd':
        options.woodstoxCmd = readValue();
        break;
      case '--quick-xml-cmd':
        options.quickXmlCmd = readValue();
        break;
      case '--simdxml-cmd':
        options.simdxmlCmd = readValue();
        break;
      case '--simdxml-max-mib':
        options.simdxmlMaxMiB = parsePositiveNumber(readValue(), '--simdxml-max-mib');
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.quick && options.files.length === 0 && options.sizesMiB.length === 0 && existsSync(QUICK_FILE)) {
    options.files.push(QUICK_FILE);
  }
  if (options.files.length === 0 && options.sizesMiB.length === 0) {
    options.sizesMiB.push(...DEFAULT_SIZES_MIB);
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

function parsePositiveNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive number.`);
  }
  return parsed;
}

function ensureGeneratedFile(sizeMiB, generatedDir) {
  mkdirSync(generatedDir, { recursive: true });
  const filePath = join(generatedDir, `node-string-return-${formatSizeName(sizeMiB)}.xml`);
  const targetBytes = Math.floor(sizeMiB * 1024 * 1024);

  if (existsSync(filePath)) {
    const actual = statSync(filePath).size;
    if (Math.abs(actual - targetBytes) / targetBytes < 0.01) {
      return filePath;
    }
  }

  generateXmlFile(filePath, targetBytes);
  return filePath;
}

function formatSizeName(sizeMiB) {
  return Number.isInteger(sizeMiB) ? `${sizeMiB}mib` : `${String(sizeMiB).replace('.', '_')}mib`;
}

function generateXmlFile(filePath, targetBytes) {
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
          `<title>Sample Book ${id}</title>` +
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

function makeNeutralParser(filePath, options) {
  return new EventReaderSync(readFileSync(filePath, 'utf8'), {
    autoDecodeEntities: false,
  }, 'js');
}

function makeEventReaderNativeParser(filePath, options) {
  return new EventReaderSync(readFileSync(filePath, 'utf8'), {
    autoDecodeEntities: false,
  }, 'native');
}

function makeStreamReaderNativeParser(filePath, options) {
  return new StreamReaderSync(
    nodeFileByteBatchesSync(filePath, {
      chunkSize: options.chunkSize,
      batchSize: options.batchSize,
    }),
  );
}

async function loadNativeAddonFullSpec() {
  try {
    const nativeAddon = await import('@stax-xml/native-aggregate-probe');
    if (typeof nativeAddon.parseAggregateFile !== 'function') {
      return {
        status: 'skipped',
        reason: 'native addon full spec parseAggregateFile export is unavailable',
      };
    }
    return { status: 'ok', nativeAddon };
  } catch (error) {
    return {
      status: 'skipped',
      reason: error instanceof Error ? error.message : String(error),
    };
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

function eventTypeId(type) {
  switch (type) {
    case XmlEventType.START_DOCUMENT:
      return 1;
    case XmlEventType.END_DOCUMENT:
      return 2;
    case XmlEventType.START_ELEMENT:
      return 3;
    case XmlEventType.END_ELEMENT:
      return 4;
    case XmlEventType.CHARACTERS:
      return 5;
    case XmlEventType.CDATA:
      return 6;
    default:
      throw new Error(`Unsupported parser event type: ${type}`);
  }
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

function captureMemoryPeak(peak) {
  const current = process.memoryUsage();
  peak.rssBytes = Math.max(peak.rssBytes, current.rss);
  peak.heapUsedBytes = Math.max(peak.heapUsedBytes, current.heapUsed);
}

function consumeParser(parser, tier, sampleEvery) {
  let eventCount = 0;
  let checksum = 0;
  const peak = { rssBytes: 0, heapUsedBytes: 0 };

  captureMemoryPeak(peak);
  for (const event of parser) {
    const type = eventTypeId(event.type);
    const attrs = event.type === XmlEventType.START_ELEMENT ? Object.entries(event.attributes ?? {}) : [];
    eventCount++;
    checksum = mixChecksum(checksum, type);

    if (tier === 'count-only') {
      checksum = mixChecksum(checksum, attrs.length);
    } else if (tier === 'name-string-only') {
      if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
        checksum = foldString(checksum, event.name);
      }
    } else if (tier === 'text-string-only') {
      if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
        checksum = foldString(checksum, event.value?.trim());
      }
    } else if (tier === 'attr-value-string-only') {
      checksum = mixChecksum(checksum, attrs.length);
      for (const [, value] of attrs) {
        checksum = foldString(checksum, value);
      }
    } else {
      if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
        checksum = foldString(checksum, event.name);
      }
      if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
        checksum = foldString(checksum, event.value?.trim());
      }
      checksum = mixChecksum(checksum, attrs.length);
      for (const [name, value] of attrs) {
        checksum = foldString(checksum, name);
        checksum = foldString(checksum, value);
      }
    }

    if (eventCount % sampleEvery === 0) {
      captureMemoryPeak(peak);
    }
  }
  captureMemoryPeak(peak);
  return { eventCount, checksum, peak };
}

function consumeStreamReader(parser, tier, sampleEvery) {
  let eventCount = 0;
  let checksum = 0;
  const peak = { rssBytes: 0, heapUsedBytes: 0 };

  captureMemoryPeak(peak);
  for (const batch of parser) {
    for (const event of batch) {
      const type = event.type;
      eventCount++;
      checksum = mixChecksum(checksum, streamEventTypeId(type));
      const attrCount = type === StreamEventType.START_ELEMENT ? event.getAttributeCount() : 0;

      if (tier === 'count-only') {
        checksum = mixChecksum(checksum, attrCount);
      } else if (tier === 'name-string-only') {
        if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
          checksum = foldString(checksum, event.name());
        }
      } else if (tier === 'text-string-only') {
        if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
          checksum = foldString(checksum, event.text()?.trim());
        }
      } else if (tier === 'attr-value-string-only') {
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          checksum = foldString(checksum, event.getAttributeValue(attrIndex));
        }
      } else {
        if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
          checksum = foldString(checksum, event.name());
        }
        if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
          checksum = foldString(checksum, event.text()?.trim());
        }
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          checksum = foldString(checksum, event.getAttributeName(attrIndex));
          checksum = foldString(checksum, event.getAttributeValue(attrIndex));
        }
      }

      if (eventCount % sampleEvery === 0) {
        captureMemoryPeak(peak);
      }
    }
  }
  captureMemoryPeak(peak);
  return { eventCount, checksum, peak };
}

function consumeStreamReaderIndexed(parser, tier, sampleEvery) {
  let eventCount = 0;
  let checksum = 0;
  const peak = { rssBytes: 0, heapUsedBytes: 0 };

  captureMemoryPeak(peak);
  for (const batch of parser) {
    const count = batch.eventCount;
    for (let eventIndex = 0; eventIndex < count; eventIndex++) {
      const type = batch.typeAt(eventIndex);
      eventCount++;
      checksum = mixChecksum(checksum, streamEventTypeId(type));
      const attrCount = type === StreamEventType.START_ELEMENT ? batch.attributeCountAt(eventIndex) : 0;

      if (tier === 'count-only') {
        checksum = mixChecksum(checksum, attrCount);
      } else if (tier === 'name-string-only') {
        if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
          checksum = foldString(checksum, batch.nameAt(eventIndex));
        }
      } else if (tier === 'text-string-only') {
        if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
          checksum = foldString(checksum, batch.textAt(eventIndex)?.trim());
        }
      } else if (tier === 'attr-value-string-only') {
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          checksum = foldString(checksum, batch.attributeValueAt(eventIndex, attrIndex));
        }
      } else {
        if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
          checksum = foldString(checksum, batch.nameAt(eventIndex));
        }
        if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
          checksum = foldString(checksum, batch.textAt(eventIndex)?.trim());
        }
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          checksum = foldString(checksum, batch.attributeNameAt(eventIndex, attrIndex));
          checksum = foldString(checksum, batch.attributeValueAt(eventIndex, attrIndex));
        }
      }

      if (eventCount % sampleEvery === 0) {
        captureMemoryPeak(peak);
      }
    }
  }
  captureMemoryPeak(peak);
  return { eventCount, checksum, peak };
}

function consumeStreamReaderRaw(parser, tier, sampleEvery) {
  let eventCount = 0;
  let checksum = 0;
  const peak = { rssBytes: 0, heapUsedBytes: 0 };

  captureMemoryPeak(peak);
  for (;;) {
    const batch = parser.nextRawBatch();
    if (batch === null) {
      break;
    }
    const decodeSpan = createBatchSpanDecoder(batch.buffer);
    const count = batch.eventCount;
    for (let eventIndex = 0; eventIndex < count; eventIndex++) {
      const type = rawEventType(batch, eventIndex);
      eventCount++;
      checksum = mixChecksum(checksum, streamEventTypeId(type));
      const attrCount = type === StreamEventType.START_ELEMENT ? rawAttrCount(batch, eventIndex) : 0;

      if (tier === 'count-only') {
        checksum = mixChecksum(checksum, attrCount);
      } else if (tier === 'name-string-only') {
        if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
          checksum = foldString(checksum, rawName(batch, eventIndex, decodeSpan));
        }
      } else if (tier === 'text-string-only') {
        if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
          checksum = foldString(checksum, rawText(batch, eventIndex, decodeSpan)?.trim());
        }
      } else if (tier === 'attr-value-string-only') {
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          checksum = foldString(checksum, rawAttrValue(batch, eventIndex, attrIndex, decodeSpan));
        }
      } else {
        if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
          checksum = foldString(checksum, rawName(batch, eventIndex, decodeSpan));
        }
        if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
          checksum = foldString(checksum, rawText(batch, eventIndex, decodeSpan)?.trim());
        }
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          checksum = foldString(checksum, rawAttrName(batch, eventIndex, attrIndex, decodeSpan));
          checksum = foldString(checksum, rawAttrValue(batch, eventIndex, attrIndex, decodeSpan));
        }
      }

      if (eventCount % sampleEvery === 0) {
        captureMemoryPeak(peak);
      }
    }
  }
  captureMemoryPeak(peak);
  return { eventCount, checksum, peak };
}

function createBatchSpanDecoder(buffer) {
  if (Buffer.isBuffer(buffer) && typeof buffer.toString === 'function') {
    return (start, end) => buffer.toString('utf8', start, end);
  }
  return (start, end) => utf8Decoder.decode(buffer.subarray(start, end));
}

function decodeRawSpan(decodeSpan, start, end) {
  return start < 0 || end < 0 ? undefined : decodeSpan(start, end);
}

function decodeRawArenaSpan(batch, start, end) {
  return start < 0 || end < 0 ? undefined : batch.stringArena.slice(start, end);
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

function rawName(batch, eventIndex, decodeSpan) {
  if (batch.kind === 'word-table') {
    const base = rawEventBase(batch, eventIndex);
    return decodeRawSpan(decodeSpan, batch.spanWords[base + 1], batch.spanWords[base + 2]);
  }
  if (batch.kind === 'soa-string-arena') {
    return decodeRawArenaSpan(batch, batch.eventNameArenaStarts[eventIndex], batch.eventNameArenaEnds[eventIndex])
      ?? decodeRawSpan(decodeSpan, batch.nameStarts[eventIndex], batch.nameEnds[eventIndex]);
  }
  return decodeRawSpan(decodeSpan, batch.nameStarts[eventIndex], batch.nameEnds[eventIndex]);
}

function rawText(batch, eventIndex, decodeSpan) {
  if (batch.kind === 'word-table') {
    const base = rawEventBase(batch, eventIndex);
    return decodeRawSpan(decodeSpan, batch.spanWords[base + 3], batch.spanWords[base + 4]);
  }
  if (batch.kind === 'soa-string-arena') {
    return decodeRawArenaSpan(batch, batch.eventTextArenaStarts[eventIndex], batch.eventTextArenaEnds[eventIndex])
      ?? decodeRawSpan(decodeSpan, batch.textStarts[eventIndex], batch.textEnds[eventIndex]);
  }
  return decodeRawSpan(decodeSpan, batch.textStarts[eventIndex], batch.textEnds[eventIndex]);
}

function rawAttrName(batch, eventIndex, attrIndex, decodeSpan) {
  const base = rawAttrBase(batch, eventIndex, attrIndex);
  if (batch.kind === 'word-table') {
    return decodeRawSpan(decodeSpan, batch.spanWords[base], batch.spanWords[base + 1]);
  }
  if (batch.kind === 'soa-string-arena') {
    return decodeRawArenaSpan(batch, batch.attrNameArenaStarts[base], batch.attrNameArenaEnds[base])
      ?? decodeRawSpan(decodeSpan, batch.attrNameStarts[base], batch.attrNameEnds[base]);
  }
  return decodeRawSpan(decodeSpan, batch.attrNameStarts[base], batch.attrNameEnds[base]);
}

function rawAttrValue(batch, eventIndex, attrIndex, decodeSpan) {
  const base = rawAttrBase(batch, eventIndex, attrIndex);
  if (batch.kind === 'word-table') {
    return decodeRawSpan(decodeSpan, batch.spanWords[base + 2], batch.spanWords[base + 3]);
  }
  if (batch.kind === 'soa-string-arena') {
    return decodeRawArenaSpan(batch, batch.attrValueArenaStarts[base], batch.attrValueArenaEnds[base])
      ?? decodeRawSpan(decodeSpan, batch.attrValueStarts[base], batch.attrValueEnds[base]);
  }
  return decodeRawSpan(decodeSpan, batch.attrValueStarts[base], batch.attrValueEnds[base]);
}

function measureScenario(id, createParser, fileSizeMiB, tier, options, consume = consumeParser) {
  for (let index = 0; index < options.warmups; index++) {
    consume(createParser(), tier, options.sampleEvery);
  }

  const samplesMs = [];
  let eventCount = 0;
  let checksum = 0;
  const peak = { rssBytes: 0, heapUsedBytes: 0 };

  for (let index = 0; index < options.runs; index++) {
    if (globalThis.gc) {
      globalThis.gc();
    }
    const startedAt = performance.now();
    const result = consume(createParser(), tier, options.sampleEvery);
    const elapsedMs = performance.now() - startedAt;

    if (index > 0 && (result.eventCount !== eventCount || result.checksum !== checksum)) {
      throw new Error(`${id} ${tier} produced unstable event count or checksum between runs.`);
    }

    eventCount = result.eventCount;
    checksum = result.checksum;
    peak.rssBytes = Math.max(peak.rssBytes, result.peak.rssBytes);
    peak.heapUsedBytes = Math.max(peak.heapUsedBytes, result.peak.heapUsedBytes);
    samplesMs.push(elapsedMs);
  }

  const avgMs = average(samplesMs);
  return {
    id,
    status: 'ok',
    tier,
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    mibPerSec: fileSizeMiB / (avgMs / 1000),
    eventCount,
    checksum,
    peakRssBytes: peak.rssBytes,
    peakHeapUsedBytes: peak.heapUsedBytes,
    samplesMs,
  };
}

function measureExternal(id, command, filePath, fileSizeMiB, tier, options, extraEnv = {}) {
  if (!command) {
    return {
      id,
      status: 'skipped',
      tier,
      reason: `No --${externalCommandFlag(id)} was provided.`,
    };
  }
  if (id.startsWith('simdxml') && fileSizeMiB > options.simdxmlMaxMiB) {
    return {
      id,
      status: 'skipped',
      tier,
      reason: `simdxml capped at ${options.simdxmlMaxMiB} MiB to avoid excessive structural-index memory use; fixture is ${fileSizeMiB.toFixed(2)} MiB.`,
    };
  }

  const child = spawnSync(command, [], {
    shell: true,
    encoding: 'utf8',
    env: {
      ...process.env,
      STAX_XML_BENCH_FILE: filePath,
      STAX_XML_BENCH_TIER: tier,
      STAX_XML_BENCH_RUNS: String(options.runs),
      STAX_XML_BENCH_WARMUPS: String(options.warmups),
      STAX_XML_BENCH_MAX_MIB: String(options.simdxmlMaxMiB),
      STAX_XML_BENCH_CONTRACT: 'namespace-off,skip-decl-comment-pi-doctype,cdata-event,skip-whitespace-text,trim-text-checksum,entity-decode-off',
      ...extraEnv,
    },
  });

  if (child.status !== 0) {
    return {
      id,
      status: 'failed',
      tier,
      reason: trimSpawnOutput(child) || `external command exited ${child.status}`,
    };
  }

  const parsed = JSON.parse(child.stdout);
  return {
    id,
    status: 'ok',
    tier,
    avgMs: parsed.avgMs,
    minMs: parsed.minMs ?? parsed.avgMs,
    maxMs: parsed.maxMs ?? parsed.avgMs,
    mibPerSec: parsed.mibPerSec ?? fileSizeMiB / (parsed.avgMs / 1000),
    eventCount: parsed.eventCount,
    checksum: parsed.checksum,
    peakRssBytes: parsed.peakRssBytes,
    peakHeapUsedBytes: parsed.peakHeapUsedBytes,
    samplesMs: parsed.samplesMs ?? [parsed.avgMs],
  };
}

function measureNativeAddonFullSpecScenario(nativeAddonFullSpec, filePath, fileSizeMiB, tier, options) {
  if (nativeAddonFullSpec.status !== 'ok') {
    return {
      id: NATIVE_ADDON_FULL_SPEC_ID,
      status: 'skipped',
      tier,
      reason: nativeAddonFullSpec.reason,
    };
  }

  for (let index = 0; index < options.warmups; index++) {
    consumeNativeAddonFullSpec(nativeAddonFullSpec.nativeAddon, filePath, tier);
  }

  const samplesMs = [];
  let eventCount = 0;
  let checksum = 0;
  const peak = { rssBytes: 0, heapUsedBytes: 0 };

  for (let index = 0; index < options.runs; index++) {
    if (globalThis.gc) {
      globalThis.gc();
    }
    const startedAt = performance.now();
    const result = consumeNativeAddonFullSpec(nativeAddonFullSpec.nativeAddon, filePath, tier);
    const elapsedMs = performance.now() - startedAt;

    if (index > 0 && (result.eventCount !== eventCount || result.checksum !== checksum)) {
      throw new Error(`${NATIVE_ADDON_FULL_SPEC_ID} ${tier} produced unstable event count or checksum between runs.`);
    }

    eventCount = result.eventCount;
    checksum = result.checksum;
    peak.rssBytes = Math.max(peak.rssBytes, result.peak.rssBytes);
    peak.heapUsedBytes = Math.max(peak.heapUsedBytes, result.peak.heapUsedBytes);
    samplesMs.push(elapsedMs);
  }

  const avgMs = average(samplesMs);
  return {
    id: NATIVE_ADDON_FULL_SPEC_ID,
    status: 'ok',
    tier,
    nativeTier: nativeAddonFullSpecTier(tier),
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    mibPerSec: fileSizeMiB / (avgMs / 1000),
    eventCount,
    checksum,
    peakRssBytes: peak.rssBytes,
    peakHeapUsedBytes: peak.heapUsedBytes,
    samplesMs,
  };
}


function consumeNativeAddonFullSpec(nativeAddon, filePath, tier) {
  const peak = { rssBytes: 0, heapUsedBytes: 0 };
  captureMemoryPeak(peak);
  const result = nativeAddon.parseAggregateFile(filePath, nativeAddonFullSpecTier(tier));
  captureMemoryPeak(peak);
  return {
    eventCount: result.eventCount,
    checksum: result.checksum,
    peak,
  };
}


function nativeAddonFullSpecTier(tier) {
  const nativeTier = NATIVE_ADDON_FULL_SPEC_TIER_BY_PUBLIC_TIER.get(tier);
  if (!nativeTier) {
    throw new Error(`No native addon full-spec tier mapping for ${tier}.`);
  }
  return nativeTier;
}

function trimSpawnOutput(result) {
  return String(result.stderr ?? '').trim() || String(result.stdout ?? '').trim();
}

function externalCommandFlag(id) {
  if (id === 'woodstox') return 'woodstox-cmd';
  if (id === 'quick-xml') return 'quick-xml-cmd';
  if (id.startsWith('simdxml')) return 'simdxml-cmd';
  return `${id}-cmd`;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function bytesToMiB(bytes) {
  return bytes / 1024 / 1024;
}

function formatMs(value) {
  return value.toFixed(2);
}

function formatRate(value) {
  return value.toFixed(1);
}

function formatRatio(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}x` : 'n/a';
}

function formatMiB(bytes) {
  if (!Number.isFinite(bytes)) {
    return 'n/a';
  }
  return (bytes / 1024 / 1024).toFixed(1);
}

function pct(value) {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

export function buildNodeStringReturnGate(fileReport) {
  const tiers = new Map(fileReport.tiers.map(tier => [tier.id, tier]));
  const count = tiers.get('count-only');
  const full = tiers.get('full-string');
  const failures = [];
  const performanceFailures = [];
  const nativeAddonFullSpecRatios = [];

  for (const tier of fileReport.tiers) {
    const neutral = tier.scenarios.find(scenario => scenario.id === 'neutral');
    const publicNativeWrapper = tier.scenarios.find(scenario => scenario.id === PUBLIC_NATIVE_WRAPPER_ID);
    const nativeAddonFullSpec = tier.scenarios.find(scenario => scenario.id === NATIVE_ADDON_FULL_SPEC_ID);
    if (!neutral || !publicNativeWrapper || neutral.status !== 'ok' || publicNativeWrapper.status !== 'ok') {
      failures.push(`${tier.id}: missing JS/StreamReaderSync native result`);
      continue;
    }
    if (neutral.eventCount !== publicNativeWrapper.eventCount || neutral.checksum !== publicNativeWrapper.checksum) {
      failures.push(`${tier.id}: JS/StreamReaderSync native event count or checksum mismatch`);
    }
    for (const decompositionId of [PUBLIC_NATIVE_INDEXED_ID, PUBLIC_NATIVE_RAW_ID]) {
      const decomposition = tier.scenarios.find(scenario => scenario.id === decompositionId);
      if (
        decomposition?.status === 'ok'
        && (
          decomposition.eventCount !== publicNativeWrapper.eventCount
          || decomposition.checksum !== publicNativeWrapper.checksum
        )
      ) {
        failures.push(`${tier.id}: ${decompositionId} event count or checksum mismatch`);
      }
    }
    if (!nativeAddonFullSpec || nativeAddonFullSpec.status !== 'ok') {
      failures.push(`${tier.id}: missing native addon full-spec result`);
      continue;
    }
    if (nativeAddonFullSpec.eventCount !== publicNativeWrapper.eventCount) {
      failures.push(`${tier.id}: native addon full-spec event count mismatch`);
      continue;
    }

    const ratioToFullSpec = publicNativeWrapper.mibPerSec / nativeAddonFullSpec.mibPerSec;
    nativeAddonFullSpecRatios.push({ tier: tier.id, ratio: ratioToFullSpec });
    if (
      Number.isFinite(ratioToFullSpec) &&
      ratioToFullSpec < NATIVE_ADDON_FULL_SPEC_MIN_RATIO
    ) {
      failures.push(
        `${tier.id}: public StreamReaderSync native wrapper ${formatRatio(ratioToFullSpec)} is below ` +
          `${formatRatio(NATIVE_ADDON_FULL_SPEC_MIN_RATIO)} native addon full spec`,
      );
    }
  }

  const countNeutral = count?.scenarios.find(scenario => scenario.id === 'neutral');
  const countNativeWrapper = count?.scenarios.find(scenario => scenario.id === PUBLIC_NATIVE_WRAPPER_ID);
  const fullNeutral = full?.scenarios.find(scenario => scenario.id === 'neutral');
  const fullNativeWrapper = full?.scenarios.find(scenario => scenario.id === PUBLIC_NATIVE_WRAPPER_ID);

  const countOnlyRegression = countNeutral && countNativeWrapper
    ? (countNativeWrapper.avgMs - countNeutral.avgMs) / countNeutral.avgMs
    : Number.NaN;
  const fullStringImprovement = fullNeutral && fullNativeWrapper
    ? (fullNeutral.avgMs - fullNativeWrapper.avgMs) / fullNeutral.avgMs
    : Number.NaN;

  if (Number.isFinite(countOnlyRegression) && countOnlyRegression >= COUNT_REGRESSION_LIMIT) {
    performanceFailures.push(`count-only regression ${pct(countOnlyRegression)} exceeds ${pct(COUNT_REGRESSION_LIMIT)}`);
  }
  if (Number.isFinite(fullStringImprovement) && fullNativeWrapper) {
    const passesFullStringGate = fullStringImprovement >= FULL_STRING_MIN_IMPROVEMENT ||
      fullNativeWrapper.mibPerSec >= FULL_STRING_MIN_MIB_PER_SEC;
    if (!passesFullStringGate) {
      performanceFailures.push(
        `full-string improvement ${pct(fullStringImprovement)} and ${formatRate(fullNativeWrapper.mibPerSec)} MiB/s miss gate`,
      );
    }
  }

  return {
    status: failures.length === 0 ? 'pass' : 'fail',
    countOnlyRegression,
    fullStringImprovement,
    nativeAddonFullSpecMinRatio: nativeAddonFullSpecRatios.length > 0
      ? Math.min(...nativeAddonFullSpecRatios.map(entry => entry.ratio))
      : Number.NaN,
    nativeAddonFullSpecRatios,
    failures,
    performanceStatus: performanceFailures.length === 0 ? 'pass' : 'warn',
    performanceFailures,
  };
}

function printReport(report) {
  console.log('Node string-return StreamReaderSync benchmark');
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Contract: ${report.contract.join(', ')}`);
  console.log(`Runs: warmups=${report.options.warmups}, runs=${report.options.runs}, chunkSize=${report.options.chunkSize}, batchSize=${report.options.batchSize}`);

  for (const file of report.files) {
    console.log('');
    console.log(`${file.path} (${file.sizeMiB.toFixed(2)} MiB)`);
    for (const tier of file.tiers) {
      console.log(`  ${tier.id}`);
      for (const scenario of tier.scenarios) {
        if (scenario.status !== 'ok') {
          console.log(`    ${scenario.id}: ${scenario.status} (${scenario.reason})`);
          continue;
        }
        console.log(
          `    ${scenario.id}: ${formatRate(scenario.mibPerSec)} MiB/s, ` +
          `${formatMs(scenario.avgMs)} ms, events=${scenario.eventCount}, checksum=${scenario.checksum}, ` +
          `rss=${formatMiB(scenario.peakRssBytes)} MiB, heap=${formatMiB(scenario.peakHeapUsedBytes)} MiB`,
        );
      }
    }

    console.log(
      `  gate: ${file.gate.status}, count-only regression=${pct(file.gate.countOnlyRegression)}, ` +
      `full-string improvement=${pct(file.gate.fullStringImprovement)}, ` +
      `wrapper/full-spec min=${formatRatio(file.gate.nativeAddonFullSpecMinRatio)}, ` +
      `performance=${file.gate.performanceStatus}`,
    );
    for (const failure of file.gate.failures) {
      console.log(`    - ${failure}`);
    }
    for (const failure of file.gate.performanceFailures ?? []) {
      console.log(`    - performance: ${failure}`);
    }
  }
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  await initStaxXml({ backend: 'native', fallbackOnLoadError: false });
  const nativeAddonFullSpec = await loadNativeAddonFullSpec();
  const files = [
    ...options.files,
    ...options.sizesMiB.map(sizeMiB => ensureGeneratedFile(sizeMiB, options.generatedDir)),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    contract: [
      'namespace off',
      'XML declaration/comment/PI/DOCTYPE skipped',
      'CDATA remains a separate event',
      'whitespace-only text skipped',
      'text trimmed before checksum',
      'entity decode off',
      'public StreamReaderSync native wrapper must stay >= 0.90x the native addon full-spec file-input control row; EventReaderSync native remains a reference row',
      'StreamReaderSync indexed and raw rows are wrapper-overhead decomposition rows and must preserve the public wrapper checksum',
    ],
    options: {
      runs: options.runs,
      warmups: options.warmups,
      chunkSize: options.chunkSize,
      batchSize: options.batchSize,
      sampleEvery: options.sampleEvery,
      simdxmlMaxMiB: options.simdxmlMaxMiB,
      tiers: options.tiers,
    },
    files: [],
  };

  for (const filePath of files) {
    const stat = statSync(filePath);
    const fileSizeMiB = bytesToMiB(stat.size);
    const fileReport = {
      path: filePath,
      sizeBytes: stat.size,
      sizeMiB: fileSizeMiB,
      tiers: [],
      gate: undefined,
    };

    for (const tierId of options.tiers) {
      const scenarios = [
        measureScenario('neutral', () => makeNeutralParser(filePath, options), fileSizeMiB, tierId, options),
        measureScenario(
          PUBLIC_NATIVE_WRAPPER_ID,
          () => makeStreamReaderNativeParser(filePath, options),
          fileSizeMiB,
          tierId,
          options,
          consumeStreamReader,
        ),
        measureScenario(
          PUBLIC_NATIVE_INDEXED_ID,
          () => makeStreamReaderNativeParser(filePath, options),
          fileSizeMiB,
          tierId,
          options,
          consumeStreamReaderIndexed,
        ),
        measureScenario(
          PUBLIC_NATIVE_RAW_ID,
          () => makeStreamReaderNativeParser(filePath, options),
          fileSizeMiB,
          tierId,
          options,
          consumeStreamReaderRaw,
        ),
        measureScenario(
          EVENT_READER_NATIVE_REFERENCE_ID,
          () => makeEventReaderNativeParser(filePath, options),
          fileSizeMiB,
          tierId,
          options,
        ),
        measureNativeAddonFullSpecScenario(nativeAddonFullSpec, filePath, fileSizeMiB, tierId, options),
        measureExternal('woodstox', options.woodstoxCmd, filePath, fileSizeMiB, tierId, options),
        measureExternal('quick-xml', options.quickXmlCmd, filePath, fileSizeMiB, tierId, options),
        measureExternal('simdxml', options.simdxmlCmd, filePath, fileSizeMiB, tierId, options),
        measureExternal('simdxml-memory', options.simdxmlCmd, filePath, fileSizeMiB, tierId, options, {
          STAX_XML_BENCH_INPUT_MODE: 'memory',
        }),
      ];
      fileReport.tiers.push({ id: tierId, scenarios });
    }

    fileReport.gate = buildNodeStringReturnGate(fileReport);
    report.files.push(fileReport);
  }

  printReport(report);

  if (options.jsonOut) {
    mkdirSync(dirname(options.jsonOut), { recursive: true });
    const fd = openSync(options.jsonOut, 'w');
    try {
      writeSync(fd, `${JSON.stringify(report, null, 2)}\n`, undefined, 'utf8');
    } finally {
      closeSync(fd);
    }
    console.log(`Saved JSON report to ${options.jsonOut}`);
  }

  if (options.failGate) {
    const failures = report.files.flatMap(file => file.gate.failures.map(failure => `${file.path}: ${failure}`));
    if (failures.length > 0) {
      process.exitCode = 1;
    }
  }
}

if (resolve(process.argv[1] ?? '') === __filename) {
  void main();
}
