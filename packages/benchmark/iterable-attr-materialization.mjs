import { closeSync, existsSync, mkdirSync, openSync, statSync, writeSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { IterableEventType, StaxXmlIterableParser } from 'stax-xml/iterable';
import {
  nodeFileByteBatchesSync,
  StaxXmlNodeIterableParser,
} from '../stax-xml/dist/iterable/node.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCENARIO_IDS = ['neutral', 'node', 'node-simple-attrs'];
const TIER_IDS = [
  'count-only',
  'attr-object-loop',
  'attr-object-batch',
  'attr-direct-loop',
  'attr-frame-loop',
  'full-string-loop',
  'full-string-batch',
  'full-string-direct',
];
const FIXTURE_IDS = ['attribute-heavy', 'mixed-utf8', 'high-cardinality', 'shuffled-attribute-order'];
const DEFAULT_FIXTURES = ['attribute-heavy', 'mixed-utf8'];
const DEFAULT_SIZES_MIB = [128];
const DEFAULT_CHUNK_SIZE = 1024 * 1024;
const DEFAULT_BATCH_SIZE = 1;
const DEFAULT_RUNS = 3;
const DEFAULT_WARMUPS = 1;
const GENERATED_DIR = join(__dirname, 'test-data');
const ATTR_OBJECT_SINK_SIZE = 1024;
const attrObjectSink = createSparseSlots(ATTR_OBJECT_SINK_SIZE);
const frameChecksumDecoder = new TextDecoder('utf-8');

function createSparseSlots(size) {
  const slots = [];
  slots.length = size;
  return slots;
}

function parseArgs(argv) {
  const options = {
    sizesMiB: [],
    fixtures: [...DEFAULT_FIXTURES],
    scenarios: [...SCENARIO_IDS],
    tiers: [...TIER_IDS],
    runs: DEFAULT_RUNS,
    warmups: DEFAULT_WARMUPS,
    chunkSize: DEFAULT_CHUNK_SIZE,
    batchSize: DEFAULT_BATCH_SIZE,
    generatedDir: GENERATED_DIR,
    jsonOut: undefined,
    quick: false,
    profileRepeat: 0,
    progress: true,
    materializationStats: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;
    if (arg === '--quick') {
      options.quick = true;
      options.runs = 1;
      options.warmups = 0;
      if (options.sizesMiB.length === 0) {
        options.sizesMiB.push(1);
      }
      continue;
    }
    if (arg === '--no-progress') {
      options.progress = false;
      continue;
    }
    if (arg === '--materialization-stats') {
      options.materializationStats = true;
      continue;
    }

    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${arg} requires a value.`);
      index++;
      return value;
    };

    switch (name) {
      case '--size-mib':
        options.sizesMiB.push(parsePositiveNumber(readValue(), name));
        break;
      case '--sizes-mib':
        options.sizesMiB.push(...readValue().split(',').filter(Boolean).map(value => parsePositiveNumber(value, name)));
        break;
      case '--fixtures':
        options.fixtures = parseList(readValue(), FIXTURE_IDS, name);
        break;
      case '--scenarios':
        options.scenarios = parseList(readValue(), SCENARIO_IDS, name);
        break;
      case '--tiers':
        options.tiers = parseList(readValue(), TIER_IDS, name);
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), name);
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--chunk-size':
        options.chunkSize = parsePositiveInteger(readValue(), name);
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), name);
        break;
      case '--generated-dir':
        options.generatedDir = resolve(process.cwd(), readValue());
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--profile-repeat':
        options.profileRepeat = parsePositiveInteger(readValue(), name);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.sizesMiB.length === 0) {
    options.sizesMiB.push(...DEFAULT_SIZES_MIB);
  }
  options.sizesMiB = [...new Set(options.sizesMiB)];
  return options;
}

function parseList(value, allowed, flag) {
  if (value === 'all') return [...allowed];
  const ids = value.split(',').map(entry => entry.trim()).filter(Boolean);
  if (ids.length === 0) throw new Error(`${flag} must not be empty.`);
  for (const id of ids) {
    if (!allowed.includes(id)) throw new Error(`${flag} contains unknown id ${id}. Expected: ${allowed.join(', ')}`);
  }
  return ids;
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

function ensureGeneratedFile(sizeMiB, fixtureId, generatedDir) {
  mkdirSync(generatedDir, { recursive: true });
  const filePath = join(generatedDir, `iterable-attr-${fixtureId}-${formatSizeName(sizeMiB)}.xml`);
  const targetBytes = Math.floor(sizeMiB * 1024 * 1024);
  if (existsSync(filePath)) {
    const actual = statSync(filePath).size;
    if (Math.abs(actual - targetBytes) / targetBytes < 0.01) return filePath;
  }
  generateXmlFile(filePath, targetBytes, fixtureId);
  return filePath;
}

function formatSizeName(sizeMiB) {
  return Number.isInteger(sizeMiB) ? `${sizeMiB}mib` : `${String(sizeMiB).replace('.', '_')}mib`;
}

function generateXmlFile(filePath, targetBytes, fixtureId) {
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
      const element = Buffer.from(createFixtureElement(fixtureId, id));
      if (written + pendingBytes + element.byteLength + footer.byteLength > targetBytes) break;
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
    if (pendingBytes > 0) writeSync(fd, Buffer.concat(pending, pendingBytes));
    writeSync(fd, footer);
  } finally {
    closeSync(fd);
  }
}

function createFixtureElement(fixtureId, id) {
  switch (fixtureId) {
    case 'attribute-heavy':
      return createAttributeHeavyElement(id);
    case 'mixed-utf8':
      return createMixedUtf8Element(id);
    case 'high-cardinality':
      return createHighCardinalityElement(id);
    case 'shuffled-attribute-order':
      return createShuffledAttributeOrderElement(id);
    default:
      throw new Error(`Unknown fixture: ${fixtureId}`);
  }
}

function createAttributeHeavyElement(id) {
  const hex = id.toString(16).padStart(8, '0');
  return (
    `  <item id="item-${hex}" a0="${id}" a1="${id % 97}" a2="state-${id % 11}" a3="${hex}" ` +
    `a4="group-${id % 101}" a5="flag-${id % 2}" a6="region-${id % 17}" a7="code-${id % 65535}" ` +
    `a8="kind-${id % 23}" a9="owner-${hex}" a10="serial-${id}-${hex}" a11="active">` +
      `<name>Name ${hex}</name>` +
      `<value>${id % 4096}</value>` +
    '</item>\n'
  );
}

function createMixedUtf8Element(id) {
  const word = ['한글', '日本語', 'café', 'δelta'][id % 4];
  return (
    `  <book id="book-${id}" lang="${word}" code="${id % 97}" status="mixed-${id % 7}">` +
      `<title>${word} Sample Book ${id}</title>` +
      `<author>Author ${word} ${id % 4096}</author>` +
      `<description>Mixed UTF-8 payload ${word} with ascii and non-ascii text ${id}.</description>` +
      `<chapter number="1">Intro ${word}</chapter>` +
      `<chapter number="2">Body ${id}</chapter>` +
    '</book>\n'
  );
}

function createHighCardinalityElement(id) {
  const hex = id.toString(16).padStart(8, '0');
  const tenant = id % 2048;
  return (
    `  <event tenant_${tenant}="t-${tenant}" metric_${id % 8192}="${id}" code_${hex.slice(0, 4)}="${hex}" ` +
    `trace_${id % 4096}="trace-${hex}" shard_${id % 31}="${id % 31}">` +
      `<payload key_${id % 16384}="value-${hex}">High cardinality payload ${id}</payload>` +
    '</event>\n'
  );
}

function createShuffledAttributeOrderElement(id) {
  const hex = id.toString(16).padStart(8, '0');
  const attrs = [
    ['id', `item-${hex}`],
    ['a0', String(id)],
    ['a1', String(id % 97)],
    ['a2', `state-${id % 11}`],
    ['a3', hex],
    ['a4', `group-${id % 101}`],
    ['a5', `flag-${id % 2}`],
    ['a6', `region-${id % 17}`],
    ['a7', `code-${id % 65535}`],
    ['a8', `kind-${id % 23}`],
    ['a9', `owner-${hex}`],
    ['a10', `serial-${id}-${hex}`],
    ['a11', 'active'],
  ];
  const offset = id % attrs.length;
  const ordered = attrs.slice(offset).concat(attrs.slice(0, offset));
  const attrText = ordered.map(([name, value]) => `${name}="${value}"`).join(' ');
  return (
    `  <item ${attrText}>` +
      `<name>Name ${hex}</name>` +
      `<value>${id % 4096}</value>` +
    '</item>\n'
  );
}

function makeParser(scenario, filePath, options) {
  const source = nodeFileByteBatchesSync(filePath, {
    chunkSize: options.chunkSize,
    batchSize: options.batchSize,
  });
  if (scenario === 'neutral') return new StaxXmlIterableParser(source);
  if (scenario === 'node-simple-attrs') {
    return new StaxXmlNodeIterableParser(source, { attributeScanner: 'simple' });
  }
  return new StaxXmlNodeIterableParser(source);
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

function capturePeak(peak) {
  const current = process.memoryUsage();
  peak.rssBytes = Math.max(peak.rssBytes, current.rss);
  peak.heapUsedBytes = Math.max(peak.heapUsedBytes, current.heapUsed);
}

function logProgress(options, message) {
  if (options.progress) {
    console.log(`[progress] ${new Date().toISOString()} ${message}`);
  }
}

function consumeParser(parser, tier, sampleEvery, collectMaterializationStats = false) {
  let eventCount = 0;
  let checksum = 0;
  let attrObjects = 0;
  let attrStrings = 0;
  let attrCountTotal = 0;
  const peak = { rssBytes: 0, heapUsedBytes: 0 };
  const materializationStats = collectMaterializationStats ? createMaterializationStats() : undefined;

  capturePeak(peak);
  while (parser.nextBatch()) {
    if (tier === 'attr-frame-loop') {
      const frame = typeof parser.batchFrame === 'function' ? parser.batchFrame() : undefined;
      const result = frame
        ? consumeAttrFrameLoop(frame, eventCount, checksum, attrCountTotal, peak, sampleEvery)
        : consumeAttrOffsetLoop(parser, eventCount, checksum, attrCountTotal, peak, sampleEvery);
      eventCount = result.eventCount;
      checksum = result.checksum;
      attrCountTotal = result.attrCountTotal;
      continue;
    }

    for (let index = 0; index < parser.eventCount(); index++) {
      const type = parser.eventType(index);
      const attrCount = parser.attrCount(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);

      if (tier === 'count-only') {
        attrCountTotal += attrCount;
        checksum = mixChecksum(checksum, attrCount);
      } else if (tier === 'attr-object-loop') {
        if (type === IterableEventType.START_ELEMENT) {
          const attributes = {};
          for (let attr = 0; attr < attrCount; attr++) {
            attributes[copyAttrNameTracked(parser, index, attr, materializationStats)] =
              copyAttrValueTracked(parser, index, attr, materializationStats);
            attrStrings += 2;
          }
          attrObjectSink[attrObjects & (ATTR_OBJECT_SINK_SIZE - 1)] = attributes;
          attrObjects++;
          attrCountTotal += attrCount;
          checksum = checksumAttributesObject(checksum, attributes);
        }
      } else if (tier === 'attr-object-batch') {
        if (type === IterableEventType.START_ELEMENT) {
          recordCopyAttributesObject(parser, index, attrCount, materializationStats);
          const attributes = parser.copyAttributesObject(index);
          attrObjectSink[attrObjects & (ATTR_OBJECT_SINK_SIZE - 1)] = attributes;
          attrObjects++;
          attrCountTotal += attrCount;
          attrStrings += attrCount * 2;
          checksum = checksumAttributesObject(checksum, attributes);
        }
      } else if (tier === 'attr-direct-loop') {
        if (type === IterableEventType.START_ELEMENT) {
          attrCountTotal += attrCount;
          checksum = checksumAttributesDirect(parser, index, attrCount, checksum, true, materializationStats);
        }
      } else if (tier === 'full-string-loop') {
        checksum = consumeFullStringLoop(parser, index, type, attrCount, checksum, materializationStats);
      } else if (tier === 'full-string-batch') {
        checksum = consumeFullStringBatch(parser, index, type, attrCount, checksum, materializationStats);
      } else if (tier === 'full-string-direct') {
        checksum = consumeFullStringDirect(parser, index, type, attrCount, checksum, materializationStats);
      } else {
        throw new Error(`Unknown tier: ${tier}`);
      }

      if (tier === 'full-string-loop' || tier === 'full-string-batch' || tier === 'full-string-direct') {
        attrCountTotal += attrCount;
      }

      if (eventCount % sampleEvery === 0) capturePeak(peak);
    }
  }
  capturePeak(peak);
  return { eventCount, checksum, attrObjects, attrStrings, attrCountTotal, peak, materializationStats };
}

function consumeAttrFrameLoop(frame, eventCount, checksum, attrCountTotal, peak, sampleEvery) {
  const eventTypes = frame.eventTypes;
  const attrCounts = frame.attrCounts;
  const count = frame.eventCount;
  for (let index = 0; index < count; index++) {
    const type = eventTypes[index];
    const attrCount = attrCounts[index];
    eventCount++;
    checksum = mixChecksum(checksum, type);
    if (type === IterableEventType.START_ELEMENT) {
      attrCountTotal += attrCount;
      checksum = checksumAttributesFrame(frame, index, attrCount, checksum, true);
    }
    if (eventCount % sampleEvery === 0) capturePeak(peak);
  }
  return { eventCount, checksum, attrCountTotal };
}

function consumeAttrOffsetLoop(parser, eventCount, checksum, attrCountTotal, peak, sampleEvery) {
  const buffer = parser.buffer();
  const count = parser.eventCount();
  for (let index = 0; index < count; index++) {
    const type = parser.eventType(index);
    const attrCount = parser.attrCount(index);
    eventCount++;
    checksum = mixChecksum(checksum, type);
    if (type === IterableEventType.START_ELEMENT) {
      attrCountTotal += attrCount;
      checksum = checksumAttributesOffsetSpans(parser, buffer, index, attrCount, checksum, true);
    }
    if (eventCount % sampleEvery === 0) capturePeak(peak);
  }
  return { eventCount, checksum, attrCountTotal };
}

function consumeFullStringLoop(parser, index, type, attrCount, checksum, materializationStats) {
  if (type === IterableEventType.START_ELEMENT || type === IterableEventType.END_ELEMENT) {
    checksum = foldString(checksum, copyNameTracked(parser, index, materializationStats));
  }
  if (type === IterableEventType.CHARACTERS || type === IterableEventType.CDATA) {
    checksum = foldString(checksum, copyTextTracked(parser, index, materializationStats)?.trim());
  }
  checksum = mixChecksum(checksum, attrCount);
  if (type === IterableEventType.START_ELEMENT) {
    const attributes = {};
    for (let attr = 0; attr < attrCount; attr++) {
      attributes[copyAttrNameTracked(parser, index, attr, materializationStats)] =
        copyAttrValueTracked(parser, index, attr, materializationStats);
    }
    checksum = checksumAttributesObject(checksum, attributes, false);
  }
  return checksum;
}

function consumeFullStringBatch(parser, index, type, attrCount, checksum, materializationStats) {
  if (type === IterableEventType.START_ELEMENT || type === IterableEventType.END_ELEMENT) {
    checksum = foldString(checksum, copyNameTracked(parser, index, materializationStats));
  }
  if (type === IterableEventType.CHARACTERS || type === IterableEventType.CDATA) {
    checksum = foldString(checksum, copyTextTracked(parser, index, materializationStats)?.trim());
  }
  checksum = mixChecksum(checksum, attrCount);
  if (type === IterableEventType.START_ELEMENT) {
    recordCopyAttributesObject(parser, index, attrCount, materializationStats);
    checksum = checksumAttributesObject(checksum, parser.copyAttributesObject(index), false);
  }
  return checksum;
}

function consumeFullStringDirect(parser, index, type, attrCount, checksum, materializationStats) {
  if (type === IterableEventType.START_ELEMENT || type === IterableEventType.END_ELEMENT) {
    checksum = foldString(checksum, copyNameTracked(parser, index, materializationStats));
  }
  if (type === IterableEventType.CHARACTERS || type === IterableEventType.CDATA) {
    checksum = foldString(checksum, copyTextTracked(parser, index, materializationStats)?.trim());
  }
  checksum = mixChecksum(checksum, attrCount);
  if (type === IterableEventType.START_ELEMENT) {
    checksum = checksumAttributesDirect(parser, index, attrCount, checksum, false, materializationStats);
  }
  return checksum;
}

function checksumAttributesObject(seed, attributes, includeCount = true) {
  let checksum = includeCount ? mixChecksum(seed, Object.keys(attributes).length) : seed;
  for (const name of Object.keys(attributes)) {
    checksum = foldString(checksum, name);
    checksum = foldString(checksum, attributes[name]);
  }
  return checksum;
}

function checksumAttributesDirect(parser, eventIndex, attrCount, seed, includeCount = true, materializationStats) {
  let checksum = includeCount ? mixChecksum(seed, attrCount) : seed;
  for (let attr = 0; attr < attrCount; attr++) {
    checksum = foldString(checksum, copyAttrNameTracked(parser, eventIndex, attr, materializationStats));
    checksum = foldString(checksum, copyAttrValueTracked(parser, eventIndex, attr, materializationStats));
  }
  return checksum;
}

function checksumAttributesFrame(frame, eventIndex, attrCount, seed, includeCount = true) {
  let checksum = includeCount ? mixChecksum(seed, attrCount) : seed;
  const buffer = frame.buffer;
  const attrNameStarts = frame.attrNameStarts;
  const attrNameEnds = frame.attrNameEnds;
  const attrValueStarts = frame.attrValueStarts;
  const attrValueEnds = frame.attrValueEnds;
  let attrIndex = frame.attrStarts[eventIndex];
  const attrEnd = attrIndex + attrCount;
  while (attrIndex < attrEnd) {
    checksum = foldSpanBytes(checksum, buffer, attrNameStarts[attrIndex], attrNameEnds[attrIndex]);
    checksum = foldSpanBytes(checksum, buffer, attrValueStarts[attrIndex], attrValueEnds[attrIndex]);
    attrIndex++;
  }
  return checksum;
}

function checksumAttributesOffsetSpans(parser, buffer, eventIndex, attrCount, seed, includeCount = true) {
  let checksum = includeCount ? mixChecksum(seed, attrCount) : seed;
  for (let attr = 0; attr < attrCount; attr++) {
    checksum = foldSpanBytes(checksum, buffer, parser.attrNameStart(eventIndex, attr), parser.attrNameEnd(eventIndex, attr));
    checksum = foldSpanBytes(checksum, buffer, parser.attrValueStart(eventIndex, attr), parser.attrValueEnd(eventIndex, attr));
  }
  return checksum;
}

function foldSpanBytes(seed, buffer, start, end) {
  let next = seed;
  for (let index = start; index < end; index++) {
    const byte = buffer[index];
    if (byte > 0x7f) {
      return foldString(seed, frameChecksumDecoder.decode(buffer.subarray(start, end)));
    }
    next = ((next << 5) - next + byte) | 0;
  }
  return next;
}

function createMaterializationStats() {
  return {
    copyNameCalls: 0,
    copyNameSpanBytes: 0,
    copyTextCalls: 0,
    copyTextSpanBytes: 0,
    copyAttrNameCalls: 0,
    copyAttrNameSpanBytes: 0,
    copyAttrValueCalls: 0,
    copyAttrValueSpanBytes: 0,
    copyAttributesObjectCalls: 0,
    copyAttributesObjectAttrs: 0,
    copyAttributesObjectNameSpanBytes: 0,
    copyAttributesObjectValueSpanBytes: 0,
  };
}

function copyNameTracked(parser, eventIndex, stats) {
  if (stats) {
    const start = parser.nameStart(eventIndex);
    if (start >= 0) {
      stats.copyNameCalls++;
      stats.copyNameSpanBytes += parser.nameEnd(eventIndex) - start;
    }
  }
  return parser.copyName(eventIndex);
}

function copyTextTracked(parser, eventIndex, stats) {
  if (stats) {
    const start = parser.textStart(eventIndex);
    if (start >= 0) {
      stats.copyTextCalls++;
      stats.copyTextSpanBytes += parser.textEnd(eventIndex) - start;
    }
  }
  return parser.copyText(eventIndex);
}

function copyAttrNameTracked(parser, eventIndex, attrIndex, stats) {
  if (stats) {
    stats.copyAttrNameCalls++;
    stats.copyAttrNameSpanBytes += parser.attrNameEnd(eventIndex, attrIndex) - parser.attrNameStart(eventIndex, attrIndex);
  }
  return parser.copyAttrName(eventIndex, attrIndex);
}

function copyAttrValueTracked(parser, eventIndex, attrIndex, stats) {
  if (stats) {
    stats.copyAttrValueCalls++;
    stats.copyAttrValueSpanBytes += parser.attrValueEnd(eventIndex, attrIndex) - parser.attrValueStart(eventIndex, attrIndex);
  }
  return parser.copyAttrValue(eventIndex, attrIndex);
}

function recordCopyAttributesObject(parser, eventIndex, attrCount, stats) {
  if (!stats) return;
  stats.copyAttributesObjectCalls++;
  stats.copyAttributesObjectAttrs += attrCount;
  for (let attr = 0; attr < attrCount; attr++) {
    stats.copyAttributesObjectNameSpanBytes += parser.attrNameEnd(eventIndex, attr) - parser.attrNameStart(eventIndex, attr);
    stats.copyAttributesObjectValueSpanBytes += parser.attrValueEnd(eventIndex, attr) - parser.attrValueStart(eventIndex, attr);
  }
}

function measureScenario(scenario, tier, filePath, fileSizeMiB, fixtureId, options) {
  for (let index = 0; index < options.warmups; index++) {
    logProgress(options, `${fixtureId} ${fileSizeMiB.toFixed(2)}MiB ${scenario}/${tier} warmup ${index + 1}/${options.warmups} start`);
    consumeParser(makeParser(scenario, filePath, options), tier, options.sampleEvery, false);
    logProgress(options, `${fixtureId} ${fileSizeMiB.toFixed(2)}MiB ${scenario}/${tier} warmup ${index + 1}/${options.warmups} end`);
  }
  const samplesMs = [];
  let eventCount = 0;
  let checksum = 0;
  let attrObjects = 0;
  let attrStrings = 0;
  let attrCountTotal = 0;
  const peak = { rssBytes: 0, heapUsedBytes: 0 };
  let materializationStats;
  for (let index = 0; index < options.runs; index++) {
    if (globalThis.gc) globalThis.gc();
    logProgress(options, `${fixtureId} ${fileSizeMiB.toFixed(2)}MiB ${scenario}/${tier} run ${index + 1}/${options.runs} start`);
    const startedAt = performance.now();
    const result = consumeParser(
      makeParser(scenario, filePath, options),
      tier,
      options.sampleEvery,
      options.materializationStats,
    );
    const elapsedMs = performance.now() - startedAt;
    logProgress(
      options,
      `${fixtureId} ${fileSizeMiB.toFixed(2)}MiB ${scenario}/${tier} run ${index + 1}/${options.runs} end ` +
      `${elapsedMs.toFixed(2)}ms ${(fileSizeMiB / (elapsedMs / 1000)).toFixed(1)}MiB/s events=${result.eventCount} checksum=${result.checksum}`,
    );
    if (index > 0 && (result.eventCount !== eventCount || result.checksum !== checksum)) {
      throw new Error(`${scenario}/${tier} produced unstable event count/checksum`);
    }
    eventCount = result.eventCount;
    checksum = result.checksum;
    attrObjects = result.attrObjects;
    attrStrings = result.attrStrings;
    attrCountTotal = result.attrCountTotal;
    materializationStats = result.materializationStats;
    peak.rssBytes = Math.max(peak.rssBytes, result.peak.rssBytes);
    peak.heapUsedBytes = Math.max(peak.heapUsedBytes, result.peak.heapUsedBytes);
    samplesMs.push(elapsedMs);
  }
  const avgMs = average(samplesMs);
  return {
    scenario,
    tier,
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    mibPerSec: fileSizeMiB / (avgMs / 1000),
    eventCount,
    checksum,
    attrObjects,
    attrStrings,
    attrCountTotal,
    peakRssBytes: peak.rssBytes,
    peakHeapUsedBytes: peak.heapUsedBytes,
    samplesMs,
    materializationStats,
  };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function bytesToMiB(bytes) {
  return bytes / 1024 / 1024;
}

function formatMiB(bytes) {
  return (bytesToMiB(bytes)).toFixed(1);
}

function printReport(report) {
  console.log('Iterable attribute materialization benchmark');
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`);
  if (report.options.materializationStats) {
    console.log('Materialization stats: enabled (string access candidates, not exact internal TextDecoder calls)');
  }
  for (const file of report.files) {
    console.log(`\n${file.path} (${file.sizeMiB.toFixed(2)} MiB, fixture=${file.fixtureId})`);
    for (const tierReport of file.tiers) {
      console.log(`  ${tierReport.id}`);
      const baseline = tierReport.scenarios.find(entry => entry.scenario === 'node');
      for (const result of tierReport.scenarios) {
        const ratio = baseline && result.scenario !== baseline.scenario
          ? `, vs node=${(result.avgMs / baseline.avgMs).toFixed(2)}x time`
          : '';
        console.log(
          `    ${result.scenario}: ${result.mibPerSec.toFixed(1)} MiB/s, ${result.avgMs.toFixed(2)} ms, ` +
          `events=${result.eventCount}, attrs=${result.attrCountTotal}, checksum=${result.checksum}, ` +
          `rss=${formatMiB(result.peakRssBytes)} MiB, heap=${formatMiB(result.peakHeapUsedBytes)} MiB${ratio}`,
        );
        if (result.materializationStats) {
          console.log(`      materialization: ${formatMaterializationStats(result.materializationStats)}`);
        }
      }
    }
  }
}

function formatMaterializationStats(stats) {
  const directCalls = stats.copyNameCalls + stats.copyTextCalls + stats.copyAttrNameCalls + stats.copyAttrValueCalls;
  const directBytes = stats.copyNameSpanBytes + stats.copyTextSpanBytes +
    stats.copyAttrNameSpanBytes + stats.copyAttrValueSpanBytes;
  const batchBytes = stats.copyAttributesObjectNameSpanBytes + stats.copyAttributesObjectValueSpanBytes;
  return (
    `directCalls=${directCalls}, directSpanBytes=${directBytes}, ` +
    `batchObjectCalls=${stats.copyAttributesObjectCalls}, batchAttrs=${stats.copyAttributesObjectAttrs}, ` +
    `batchSpanBytes=${batchBytes}, attrValueCalls=${stats.copyAttrValueCalls}, ` +
    `attrValueSpanBytes=${stats.copyAttrValueSpanBytes}, textCalls=${stats.copyTextCalls}, ` +
    `textSpanBytes=${stats.copyTextSpanBytes}`
  );
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.profileRepeat > 0) {
    runProfileMode(options);
    return;
  }
  const report = {
    generatedAt: new Date().toISOString(),
    contract: [
      'same parser events and checksum for loop and batch materialization',
      'count-only parses events and attribute spans without materializing strings',
      'attr-object-loop builds Record<string,string> through copyAttrName/copyAttrValue',
      'attr-object-batch builds Record<string,string> through copyAttributesObject',
      'attr-frame-loop reads attribute spans from batchFrame when available, with an offset-span fallback for comparison parsers',
      'full-string tiers include name/text plus attr object checksum',
    ],
    options: {
      runs: options.runs,
      warmups: options.warmups,
      sizesMiB: options.sizesMiB,
      fixtures: options.fixtures,
      scenarios: options.scenarios,
      tiers: options.tiers,
      chunkSize: options.chunkSize,
      batchSize: options.batchSize,
      progress: options.progress,
      materializationStats: options.materializationStats,
    },
    files: [],
  };

  for (const sizeMiB of options.sizesMiB) {
    for (const fixtureId of options.fixtures) {
      const filePath = ensureGeneratedFile(sizeMiB, fixtureId, options.generatedDir);
      const fileSizeMiB = bytesToMiB(statSync(filePath).size);
      const tiers = [];
      for (const tier of options.tiers) {
        const scenarios = [];
        for (const scenario of options.scenarios) {
          scenarios.push(measureScenario(scenario, tier, filePath, fileSizeMiB, fixtureId, options));
        }
        const first = scenarios[0];
        for (const result of scenarios.slice(1)) {
          if (result.eventCount !== first.eventCount || result.checksum !== first.checksum) {
            throw new Error(`${fixtureId}/${tier}: ${result.scenario} mismatch against ${first.scenario}`);
          }
        }
        tiers.push({ id: tier, scenarios });
      }
      report.files.push({
        path: filePath,
        fixtureId,
        sizeMiB: fileSizeMiB,
        tiers,
      });
    }
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
}

function runProfileMode(options) {
  if (options.sizesMiB.length !== 1 || options.fixtures.length !== 1 || options.scenarios.length !== 1 || options.tiers.length !== 1) {
    throw new Error('--profile-repeat requires exactly one size, fixture, scenario, and tier.');
  }
  const sizeMiB = options.sizesMiB[0];
  const fixtureId = options.fixtures[0];
  const scenario = options.scenarios[0];
  const tier = options.tiers[0];
  const filePath = ensureGeneratedFile(sizeMiB, fixtureId, options.generatedDir);
  let finalResult;
  for (let index = 0; index < options.profileRepeat; index++) {
    finalResult = consumeParser(makeParser(scenario, filePath, options), tier, Number.MAX_SAFE_INTEGER);
  }
  console.log(JSON.stringify({
    mode: 'profile',
    scenario,
    tier,
    fixtureId,
    sizeMiB,
    repeat: options.profileRepeat,
    eventCount: finalResult.eventCount,
    checksum: finalResult.checksum,
    attrObjects: finalResult.attrObjects,
    attrStrings: finalResult.attrStrings,
    attrCountTotal: finalResult.attrCountTotal,
  }));
}

void main();
