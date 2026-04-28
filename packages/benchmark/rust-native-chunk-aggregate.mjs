import { Buffer } from 'node:buffer';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { EventReaderSync, XmlEventType } from 'stax-xml';
import { IterableEventType, IterableReader } from 'stax-xml/iterable';
import {
  nodeFileByteBatchesSync,
  NodeIterableReader,
} from '../stax-xml/dist/iterable/node.js';
import {
  parse_aggregate_buffer,
  parse_aggregate_file,
  parse_aggregate_uint8array,
  parse_span_table_string_utf16,
  parse_aggregate_string_utf16,
  parse_aggregate_string_utf8,
} from '@stax-xml/native-aggregate-probe';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_IDS = ['quoted-gt', 'attr-heavy', 'high-cardinality', 'mixed-utf8'];
const TIER_IDS = ['count-only', 'full-string-direct', 'event-object-full'];
const DEFAULT_SIZES_MIB = [16, 128];
const DEFAULT_CHUNK_SIZE = 1024 * 1024;
const DEFAULT_BATCH_SIZE = 1;
const DEFAULT_RUNS = 3;
const DEFAULT_WARMUPS = 1;
const GENERATED_DIR = join(__dirname, 'test-data');
const REPORT_DIR = join(__dirname, 'knowledge', 'reports', 'iterable');
const EVENT_OBJECT_SINK_SIZE = 1024;
const SPAN_TABLE_MAGIC = 0x31545053;
const SPAN_TABLE_HEADER_WORDS = 7;
const SCENARIO_IDS = [
  'js-neutral',
  'js-node',
  'js-sync-string',
  'native-buffer',
  'native-uint8array',
  'native-file',
  'native-string-utf8',
  'native-string-utf16',
  'native-span-table-string-utf16',
];
const eventObjectSink = createSparseSlots(EVENT_OBJECT_SINK_SIZE);

function createSparseSlots(size) {
  const slots = [];
  slots.length = size;
  return slots;
}

function parseArgs(argv) {
  const options = {
    sizesMiB: [],
    fixtures: [...FIXTURE_IDS],
    tiers: [...TIER_IDS],
    scenarios: ['js-neutral', 'js-node', 'native-buffer', 'native-file'],
    runs: DEFAULT_RUNS,
    warmups: DEFAULT_WARMUPS,
    chunkSize: DEFAULT_CHUNK_SIZE,
    batchSize: DEFAULT_BATCH_SIZE,
    generatedDir: GENERATED_DIR,
    jsonOut: undefined,
    markdownOut: undefined,
    quick: false,
    progress: true,
    sampleEvery: 65_536,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;
    if (arg === '--') continue;
    if (arg === '--quick') {
      options.quick = true;
      options.runs = 1;
      options.warmups = 0;
      options.sizesMiB = [1];
      continue;
    }
    if (arg === '--no-progress') {
      options.progress = false;
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
      case '--tiers':
        options.tiers = parseList(readValue(), TIER_IDS, name);
        break;
      case '--scenarios':
        options.scenarios = parseList(readValue(), SCENARIO_IDS, name);
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
      case '--markdown-out':
        options.markdownOut = resolve(process.cwd(), readValue());
        break;
      case '--sample-every':
        options.sampleEvery = parsePositiveInteger(readValue(), name);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.sizesMiB.length === 0) {
    options.sizesMiB.push(...DEFAULT_SIZES_MIB);
  }
  options.sizesMiB = [...new Set(options.sizesMiB)];
  options.scenarios = ensurePublicParserComparators(options.scenarios);
  return options;
}

function ensurePublicParserComparators(scenarios) {
  if (!scenarios.some(scenario => scenario.startsWith('native-'))) {
    return scenarios;
  }
  const withComparators = [...scenarios];
  if (!withComparators.includes('js-neutral')) {
    withComparators.unshift('js-neutral');
  }
  if (!withComparators.includes('js-node')) {
    withComparators.splice(1, 0, 'js-node');
  }
  return withComparators;
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
  const filePath = join(generatedDir, `rust-native-aggregate-v2-${fixtureId}-${formatSizeName(sizeMiB)}.xml`);
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
  const header = Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE root>\n<root>\n');
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
  const structuralNoise = id % 257 === 0
    ? `  <!-- comment ${id} --><?bench tick="${id}"?>\n`
    : '';
  const cdata = id % 131 === 0 ? `<![CDATA[<raw id="${id}">value > marker</raw>]]>` : '';
  switch (fixtureId) {
    case 'quoted-gt':
      return structuralNoise +
        `  <item id="item-${id}" expr="left > right" single='alpha > beta' code="${id % 97}">` +
          `<name>Quoted ${id}</name>${cdata}<value>${id % 4096}</value>` +
        '</item>\n';
    case 'attr-heavy':
      return structuralNoise + createAttrHeavyElement(id, cdata);
    case 'high-cardinality':
      return structuralNoise + createHighCardinalityElement(id, cdata);
    case 'mixed-utf8':
      return structuralNoise + createMixedUtf8Element(id, cdata);
    default:
      throw new Error(`Unknown fixture: ${fixtureId}`);
  }
}

function createAttrHeavyElement(id, cdata) {
  const hex = id.toString(16).padStart(8, '0');
  return (
    `  <item id="item-${hex}" a0="${id}" a1="${id % 97}" a2="state-${id % 11}" a3="${hex}" ` +
    `a4="group-${id % 101}" a5="flag-${id % 2}" a6="region-${id % 17}" a7="code-${id % 65535}" ` +
    `a8="kind-${id % 23}" a9="owner-${hex}" a10="serial-${id}-${hex}" a11="active">` +
      `<name>Name ${hex}</name>${cdata}<value>${id % 4096}</value>` +
    '</item>\n'
  );
}

function createHighCardinalityElement(id, cdata) {
  const hex = id.toString(16).padStart(8, '0');
  const tenant = id % 2048;
  return (
    `  <event tenant_${tenant}="t-${tenant}" metric_${id % 8192}="${id}" code_${hex.slice(0, 4)}="${hex}" ` +
    `trace_${id % 4096}="trace-${hex}" shard_${id % 31}="${id % 31}">` +
      `<payload key_${id % 16384}="value-${hex}">High cardinality payload ${id}</payload>${cdata}` +
    '</event>\n'
  );
}

function createMixedUtf8Element(id, cdata) {
  const word = ['한글', '日本語', 'café', 'δelta', 'emoji-🌊'][id % 5];
  return (
    `  <book id="book-${id}" lang="${word}" code="${id % 97}" status="mixed-${id % 7}">` +
      `<title>${word} Title ${id}</title>${cdata}` +
      `<description>본문 ${id} with café and emoji 🌊 ${word}</description>` +
    '</book>\n'
  );
}

function makeJsParser(scenario, filePath, options) {
  const source = nodeFileByteBatchesSync(filePath, {
    chunkSize: options.chunkSize,
    batchSize: options.batchSize,
  });
  if (scenario === 'js-neutral') return new IterableReader(source);
  if (scenario === 'js-node') return new NodeIterableReader(source);
  throw new Error(`Unknown JS parser scenario: ${scenario}`);
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

function consumeJsParser(parser, tier, sampleEvery) {
  let eventCount = 0;
  let checksum = 0;
  let attrCountTotal = 0;
  let objectCount = 0;
  const peak = { rssBytes: 0, heapUsedBytes: 0 };
  capturePeak(peak);

  while (parser.nextBatch()) {
    for (let index = 0; index < parser.eventCount(); index++) {
      const type = parser.eventType(index);
      const attrCount = parser.attrCount(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);

      if (tier === 'count-only') {
        checksum = mixChecksum(checksum, attrCount);
        attrCountTotal += attrCount;
      } else if (tier === 'full-string-direct') {
        checksum = consumeJsFullStringDirect(parser, index, type, attrCount, checksum);
        attrCountTotal += attrCount;
      } else if (tier === 'event-object-full') {
        const result = consumeJsEventObjectFull(parser, index, type, attrCount, checksum, objectCount);
        checksum = result.checksum;
        objectCount = result.objectCount;
        attrCountTotal += attrCount;
      } else {
        throw new Error(`Unknown tier: ${tier}`);
      }

      if (eventCount % sampleEvery === 0) capturePeak(peak);
    }
  }

  capturePeak(peak);
  return { eventCount, checksum, attrCountTotal, objectCount, peak };
}

function consumeSyncStringParser(input, tier, sampleEvery) {
  let eventCount = 0;
  let checksum = 0;
  let attrCountTotal = 0;
  let objectCount = 0;
  const peak = { rssBytes: 0, heapUsedBytes: 0 };
  capturePeak(peak);

  for (const event of new EventReaderSync(input)) {
    const type = syncEventTypeId(event.type);
    const attrs = event.type === XmlEventType.START_ELEMENT ? Object.entries(event.attributes ?? {}) : [];
    eventCount++;
    checksum = mixChecksum(checksum, type);

    if (tier === 'count-only') {
      checksum = mixChecksum(checksum, attrs.length);
      attrCountTotal += attrs.length;
    } else if (tier === 'full-string-direct') {
      checksum = consumeSyncFullStringDirect(event, type, attrs, checksum);
      attrCountTotal += attrs.length;
    } else if (tier === 'event-object-full') {
      const result = consumeSyncEventObjectFull(event, type, attrs, checksum, objectCount);
      checksum = result.checksum;
      objectCount = result.objectCount;
      attrCountTotal += attrs.length;
    } else {
      throw new Error(`Unknown tier: ${tier}`);
    }

    if (eventCount % sampleEvery === 0) capturePeak(peak);
  }

  capturePeak(peak);
  return { eventCount, checksum, attrCountTotal, objectCount, peak };
}

function consumeJsFullStringDirect(parser, index, type, attrCount, checksum) {
  if (type === IterableEventType.START_ELEMENT || type === IterableEventType.END_ELEMENT) {
    checksum = foldString(checksum, parser.copyName(index));
  }
  if (type === IterableEventType.CHARACTERS || type === IterableEventType.CDATA) {
    checksum = foldString(checksum, parser.copyText(index)?.trim());
  }
  checksum = mixChecksum(checksum, attrCount);
  if (type === IterableEventType.START_ELEMENT) {
    for (let attr = 0; attr < attrCount; attr++) {
      checksum = foldString(checksum, parser.copyAttrName(index, attr));
      checksum = foldString(checksum, parser.copyAttrValue(index, attr));
    }
  }
  return checksum;
}

function consumeSyncFullStringDirect(event, type, attrs, checksum) {
  if (type === IterableEventType.START_ELEMENT || type === IterableEventType.END_ELEMENT) {
    checksum = foldString(checksum, event.name);
  }
  if (type === IterableEventType.CHARACTERS || type === IterableEventType.CDATA) {
    checksum = foldString(checksum, event.value?.trim());
  }
  checksum = mixChecksum(checksum, attrs.length);
  if (type === IterableEventType.START_ELEMENT) {
    for (const [name, value] of attrs) {
      checksum = foldString(checksum, name);
      checksum = foldString(checksum, value);
    }
  }
  return checksum;
}

function consumeJsEventObjectFull(parser, index, type, attrCount, checksum, objectCount) {
  const event = {
    type,
    name: undefined,
    text: undefined,
    attributes: [],
  };
  if (type === IterableEventType.START_ELEMENT || type === IterableEventType.END_ELEMENT) {
    event.name = parser.copyName(index);
    checksum = foldString(checksum, event.name);
  }
  if (type === IterableEventType.CHARACTERS || type === IterableEventType.CDATA) {
    event.text = parser.copyText(index);
    checksum = foldString(checksum, event.text?.trim());
  }
  checksum = mixChecksum(checksum, attrCount);
  if (type === IterableEventType.START_ELEMENT) {
    for (let attr = 0; attr < attrCount; attr++) {
      const name = parser.copyAttrName(index, attr);
      const value = parser.copyAttrValue(index, attr);
      event.attributes.push({ name, value });
      checksum = foldString(checksum, name);
      checksum = foldString(checksum, value);
    }
  }
  eventObjectSink[objectCount & (EVENT_OBJECT_SINK_SIZE - 1)] = event;
  return { checksum, objectCount: objectCount + 1 };
}

function consumeSyncEventObjectFull(event, type, attrs, checksum, objectCount) {
  const projected = {
    type,
    name: undefined,
    text: undefined,
    attributes: [],
  };
  if (type === IterableEventType.START_ELEMENT || type === IterableEventType.END_ELEMENT) {
    projected.name = event.name;
    checksum = foldString(checksum, projected.name);
  }
  if (type === IterableEventType.CHARACTERS || type === IterableEventType.CDATA) {
    projected.text = event.value;
    checksum = foldString(checksum, projected.text?.trim());
  }
  checksum = mixChecksum(checksum, attrs.length);
  if (type === IterableEventType.START_ELEMENT) {
    for (const [name, value] of attrs) {
      projected.attributes.push({ name, value });
      checksum = foldString(checksum, name);
      checksum = foldString(checksum, value);
    }
  }
  eventObjectSink[objectCount & (EVENT_OBJECT_SINK_SIZE - 1)] = projected;
  return { checksum, objectCount: objectCount + 1 };
}

function consumeNativeSpanTableString(input, table, tier, sampleEvery) {
  if (!Buffer.isBuffer(table)) {
    throw new TypeError('native span table did not return a Buffer');
  }
  if ((table.byteOffset & 3) !== 0 || (table.byteLength & 3) !== 0) {
    return consumeNativeSpanTableStringDataView(input, table, tier, sampleEvery);
  }

  const words = new Int32Array(table.buffer, table.byteOffset, table.byteLength >>> 2);
  const magic = words[0] >>> 0;
  if (magic !== SPAN_TABLE_MAGIC) {
    throw new Error(`Invalid span table magic: 0x${magic.toString(16)}`);
  }
  const eventCount = words[1] >>> 0;
  const attrCount = words[2] >>> 0;
  const inputUnits = words[3] >>> 0;
  const eventStrideBytes = words[4] >>> 0;
  const attrStrideBytes = words[5] >>> 0;
  if (inputUnits !== input.length) {
    throw new Error(`Span table input length mismatch: ${inputUnits}/${input.length}`);
  }
  if (eventStrideBytes !== 28 || attrStrideBytes !== 16) {
    throw new Error(`Unsupported span table strides: ${eventStrideBytes}/${attrStrideBytes}`);
  }

  const eventStride = eventStrideBytes >>> 2;
  const attrStride = attrStrideBytes >>> 2;
  const eventBase = SPAN_TABLE_HEADER_WORDS;
  const attrBase = eventBase + eventCount * eventStride;
  const expectedWords = attrBase + attrCount * attrStride;
  if (expectedWords !== words.length) {
    throw new Error(`Span table length mismatch: ${expectedWords * 4}/${table.byteLength}`);
  }

  let checksum = 0;
  let attrCountTotal = 0;
  let objectCount = 0;
  const peak = { rssBytes: 0, heapUsedBytes: 0 };
  capturePeak(peak);

  for (let index = 0, offset = eventBase; index < eventCount; index++, offset += eventStride) {
    const type = words[offset] >>> 0;
    const nameStart = words[offset + 1];
    const nameEnd = words[offset + 2];
    const textStart = words[offset + 3];
    const textEnd = words[offset + 4];
    const eventAttrStart = words[offset + 5] >>> 0;
    const eventAttrCount = words[offset + 6] >>> 0;
    checksum = mixChecksum(checksum, type);

    if (tier === 'count-only') {
      checksum = mixChecksum(checksum, eventAttrCount);
      attrCountTotal += eventAttrCount;
    } else if (tier === 'full-string-direct') {
      if (nameStart >= 0) checksum = foldString(checksum, input.slice(nameStart, nameEnd));
      if (textStart >= 0) checksum = foldString(checksum, input.slice(textStart, textEnd).trim());
      checksum = mixChecksum(checksum, eventAttrCount);
      attrCountTotal += eventAttrCount;
      for (let attr = 0, attrOffset = attrBase + eventAttrStart * attrStride; attr < eventAttrCount; attr++, attrOffset += attrStride) {
        checksum = foldString(checksum, input.slice(words[attrOffset], words[attrOffset + 1]));
        checksum = foldString(checksum, input.slice(words[attrOffset + 2], words[attrOffset + 3]));
      }
    } else if (tier === 'event-object-full') {
      const event = {
        type,
        name: undefined,
        text: undefined,
        attributes: [],
      };
      if (nameStart >= 0) {
        event.name = input.slice(nameStart, nameEnd);
        checksum = foldString(checksum, event.name);
      }
      if (textStart >= 0) {
        event.text = input.slice(textStart, textEnd);
        checksum = foldString(checksum, event.text.trim());
      }
      checksum = mixChecksum(checksum, eventAttrCount);
      attrCountTotal += eventAttrCount;
      for (let attr = 0, attrOffset = attrBase + eventAttrStart * attrStride; attr < eventAttrCount; attr++, attrOffset += attrStride) {
        const name = input.slice(words[attrOffset], words[attrOffset + 1]);
        const value = input.slice(words[attrOffset + 2], words[attrOffset + 3]);
        event.attributes.push({ name, value });
        checksum = foldString(checksum, name);
        checksum = foldString(checksum, value);
      }
      eventObjectSink[objectCount & (EVENT_OBJECT_SINK_SIZE - 1)] = event;
      objectCount++;
    } else {
      throw new Error(`Unknown tier: ${tier}`);
    }

    if (index % sampleEvery === 0) capturePeak(peak);
  }

  capturePeak(peak);
  return { eventCount, checksum, attrCountTotal, objectCount, peak };
}

function consumeNativeSpanTableStringDataView(input, table, tier, sampleEvery) {
  const view = new DataView(table.buffer, table.byteOffset, table.byteLength);
  const readI32 = offset => view.getInt32(offset, true);
  const readU32 = offset => view.getUint32(offset, true);
  const magic = readU32(0);
  if (magic !== SPAN_TABLE_MAGIC) {
    throw new Error(`Invalid span table magic: 0x${magic.toString(16)}`);
  }
  const eventCount = readU32(4);
  const attrCount = readU32(8);
  const inputUnits = readU32(12);
  const eventStride = readU32(16);
  const attrStride = readU32(20);
  if (inputUnits !== input.length) {
    throw new Error(`Span table input length mismatch: ${inputUnits}/${input.length}`);
  }
  const eventBase = SPAN_TABLE_HEADER_WORDS * 4;
  const attrBase = eventBase + eventCount * eventStride;
  const expectedBytes = attrBase + attrCount * attrStride;
  if (expectedBytes !== table.byteLength) {
    throw new Error(`Span table length mismatch: ${expectedBytes}/${table.byteLength}`);
  }

  let checksum = 0;
  let attrCountTotal = 0;
  let objectCount = 0;
  const peak = { rssBytes: 0, heapUsedBytes: 0 };
  capturePeak(peak);

  for (let index = 0, offset = eventBase; index < eventCount; index++, offset += eventStride) {
    const type = readU32(offset);
    const nameStart = readI32(offset + 4);
    const nameEnd = readI32(offset + 8);
    const textStart = readI32(offset + 12);
    const textEnd = readI32(offset + 16);
    const eventAttrStart = readU32(offset + 20);
    const eventAttrCount = readU32(offset + 24);
    checksum = mixChecksum(checksum, type);

    if (tier === 'count-only') {
      checksum = mixChecksum(checksum, eventAttrCount);
      attrCountTotal += eventAttrCount;
    } else if (tier === 'full-string-direct') {
      if (nameStart >= 0) checksum = foldString(checksum, input.slice(nameStart, nameEnd));
      if (textStart >= 0) checksum = foldString(checksum, input.slice(textStart, textEnd).trim());
      checksum = mixChecksum(checksum, eventAttrCount);
      attrCountTotal += eventAttrCount;
      for (let attr = 0, attrOffset = attrBase + eventAttrStart * attrStride; attr < eventAttrCount; attr++, attrOffset += attrStride) {
        checksum = foldString(checksum, input.slice(readI32(attrOffset), readI32(attrOffset + 4)));
        checksum = foldString(checksum, input.slice(readI32(attrOffset + 8), readI32(attrOffset + 12)));
      }
    } else if (tier === 'event-object-full') {
      const event = {
        type,
        name: undefined,
        text: undefined,
        attributes: [],
      };
      if (nameStart >= 0) {
        event.name = input.slice(nameStart, nameEnd);
        checksum = foldString(checksum, event.name);
      }
      if (textStart >= 0) {
        event.text = input.slice(textStart, textEnd);
        checksum = foldString(checksum, event.text.trim());
      }
      checksum = mixChecksum(checksum, eventAttrCount);
      attrCountTotal += eventAttrCount;
      for (let attr = 0, attrOffset = attrBase + eventAttrStart * attrStride; attr < eventAttrCount; attr++, attrOffset += attrStride) {
        const name = input.slice(readI32(attrOffset), readI32(attrOffset + 4));
        const value = input.slice(readI32(attrOffset + 8), readI32(attrOffset + 12));
        event.attributes.push({ name, value });
        checksum = foldString(checksum, name);
        checksum = foldString(checksum, value);
      }
      eventObjectSink[objectCount & (EVENT_OBJECT_SINK_SIZE - 1)] = event;
      objectCount++;
    } else {
      throw new Error(`Unknown tier: ${tier}`);
    }

    if (index % sampleEvery === 0) capturePeak(peak);
  }

  capturePeak(peak);
  return { eventCount, checksum, attrCountTotal, objectCount, peak };
}

function syncEventTypeId(type) {
  switch (type) {
    case XmlEventType.START_DOCUMENT:
      return IterableEventType.START_DOCUMENT;
    case XmlEventType.END_DOCUMENT:
      return IterableEventType.END_DOCUMENT;
    case XmlEventType.START_ELEMENT:
      return IterableEventType.START_ELEMENT;
    case XmlEventType.END_ELEMENT:
      return IterableEventType.END_ELEMENT;
    case XmlEventType.CHARACTERS:
      return IterableEventType.CHARACTERS;
    case XmlEventType.CDATA:
      return IterableEventType.CDATA;
    default:
      throw new Error(`Unsupported sync event type: ${type}`);
  }
}

function normalizeNativeResult(result) {
  return {
    eventCount: result.eventCount ?? result.event_count,
    checksum: result.checksum,
    attrCountTotal: result.attrCountTotal ?? result.attr_count_total,
    objectCount: result.objectCount ?? result.object_count ?? 0,
  };
}

function measureScenario(scenario, tier, filePath, fileSizeMiB, options, preloadedBuffer, preloadedUint8Array, preloadedString) {
  const run = () => {
    if (scenario === 'native-buffer') {
      return {
        ...normalizeNativeResult(parse_aggregate_buffer(preloadedBuffer, tier)),
        peak: captureCurrentPeak(),
      };
    }
    if (scenario === 'native-uint8array') {
      return {
        ...normalizeNativeResult(parse_aggregate_uint8array(preloadedUint8Array, tier)),
        peak: captureCurrentPeak(),
      };
    }
    if (scenario === 'native-file') {
      return {
        ...normalizeNativeResult(parse_aggregate_file(filePath, tier)),
        peak: captureCurrentPeak(),
      };
    }
    if (scenario === 'native-string-utf8') {
      return {
        ...normalizeNativeResult(parse_aggregate_string_utf8(preloadedString, tier)),
        peak: captureCurrentPeak(),
      };
    }
    if (scenario === 'native-string-utf16') {
      return {
        ...normalizeNativeResult(parse_aggregate_string_utf16(preloadedString, tier)),
        peak: captureCurrentPeak(),
      };
    }
    if (scenario === 'native-span-table-string-utf16') {
      const table = parse_span_table_string_utf16(preloadedString);
      const result = consumeNativeSpanTableString(preloadedString, table, tier, options.sampleEvery);
      capturePeak(result.peak);
      return result;
    }
    if (scenario === 'js-sync-string') {
      return consumeSyncStringParser(preloadedString, tier, options.sampleEvery);
    }
    return consumeJsParser(makeJsParser(scenario, filePath, options), tier, options.sampleEvery);
  };

  for (let index = 0; index < options.warmups; index++) {
    logProgress(options, `${scenario}/${tier} warmup ${index + 1}/${options.warmups}`);
    run();
  }

  const samplesMs = [];
  let eventCount = 0;
  let checksum = 0;
  let attrCountTotal = 0;
  let objectCount = 0;
  const peak = { rssBytes: 0, heapUsedBytes: 0 };
  for (let index = 0; index < options.runs; index++) {
    if (globalThis.gc) globalThis.gc();
    logProgress(options, `${scenario}/${tier} run ${index + 1}/${options.runs} start`);
    const startedAt = performance.now();
    const result = run();
    const elapsedMs = performance.now() - startedAt;
    logProgress(
      options,
      `${scenario}/${tier} run ${index + 1}/${options.runs} end ${elapsedMs.toFixed(2)}ms ` +
        `${(fileSizeMiB / (elapsedMs / 1000)).toFixed(1)}MiB/s events=${result.eventCount} checksum=${result.checksum}`,
    );

    if (index > 0 && (result.eventCount !== eventCount || result.checksum !== checksum)) {
      throw new Error(`${scenario}/${tier} produced unstable event count/checksum`);
    }
    eventCount = result.eventCount;
    checksum = result.checksum;
    attrCountTotal = result.attrCountTotal;
    objectCount = result.objectCount;
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
    attrCountTotal,
    objectCount,
    peakRssBytes: peak.rssBytes,
    peakHeapUsedBytes: peak.heapUsedBytes,
    samplesMs,
  };
}

function captureCurrentPeak() {
  const peak = { rssBytes: 0, heapUsedBytes: 0 };
  capturePeak(peak);
  return peak;
}

function capturePeak(peak) {
  const usage = process.memoryUsage();
  peak.rssBytes = Math.max(peak.rssBytes, usage.rss);
  peak.heapUsedBytes = Math.max(peak.heapUsedBytes, usage.heapUsed);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function logProgress(options, message) {
  if (options.progress) console.log(`[rust-native-aggregate] ${message}`);
}

function evaluateGate(report) {
  const size128 = report.files.filter(file => Math.abs(file.sizeMiB - 128) < 0.01);
  if (size128.length === 0) {
    return {
      representativeSizeMiB: 128,
      status: 'not-evaluated',
      fullString: { tier: 'full-string-direct', minimumImprovement: 0.20, nativeWins: 0, fixtures: [] },
      eventObject: { tier: 'event-object-full', minimumImprovement: 0.10, nativeWins: 0, fixtures: [] },
      countOnlyDiagnostic: { tier: 'count-only', minimumImprovement: 0, nativeWins: 0, fixtures: [] },
      rejectionRules: ['128MiB representative size was not included in this run'],
    };
  }
  const fullString = evaluateTierGate(size128, 'full-string-direct', 0.20);
  const eventObject = evaluateTierGate(size128, 'event-object-full', 0.10);
  const countOnly = evaluateTierGate(size128, 'count-only', 0);

  return {
    representativeSizeMiB: 128,
    status: fullString.nativeWins >= 3 ? 'pass' : 'reject',
    fullString,
    eventObject,
    countOnlyDiagnostic: countOnly,
    rejectionRules: [
      fullString.nativeWins >= 3 ? undefined : 'full-string-direct did not beat best JS by 20% on at least 3/4 fixtures at 128MiB',
      countOnly.nativeWins > 0 && fullString.nativeWins < 3 ? 'count-only wins are diagnostic only and cannot carry the decision' : undefined,
    ].filter(Boolean),
  };
}

function evaluateTierGate(files, tierId, minimumImprovement) {
  const fixtures = [];
  for (const file of files) {
    const tier = file.tiers.find(entry => entry.id === tierId);
    if (!tier) continue;
    const js = tier.scenarios.filter(scenario => scenario.scenario.startsWith('js-'));
    const native = tier.scenarios.filter(scenario => scenario.scenario.startsWith('native-'));
    const bestJs = maxBy(js, scenario => scenario.mibPerSec);
    const bestNative = maxBy(native, scenario => scenario.mibPerSec);
    const improvement = bestJs && bestNative
      ? (bestNative.mibPerSec - bestJs.mibPerSec) / bestJs.mibPerSec
      : Number.NaN;
    fixtures.push({
      fixtureId: file.fixtureId,
      bestJs: bestJs?.scenario,
      bestJsMiBPerSec: bestJs?.mibPerSec,
      bestNative: bestNative?.scenario,
      bestNativeMiBPerSec: bestNative?.mibPerSec,
      improvement,
      pass: Number.isFinite(improvement) && improvement >= minimumImprovement,
    });
  }
  return {
    tier: tierId,
    minimumImprovement,
    nativeWins: fixtures.filter(fixture => fixture.pass).length,
    fixtures,
  };
}

function maxBy(values, score) {
  let best;
  let bestScore = -Infinity;
  for (const value of values) {
    const current = score(value);
    if (current > bestScore) {
      best = value;
      bestScore = current;
    }
  }
  return best;
}

function ensureScenarioParity(tier, fixtureId) {
  const first = tier.scenarios[0];
  for (const scenario of tier.scenarios.slice(1)) {
    if (
      scenario.eventCount !== first.eventCount ||
      scenario.checksum !== first.checksum ||
      scenario.attrCountTotal !== first.attrCountTotal
    ) {
      throw new Error(
        `${fixtureId}/${tier.id}: ${scenario.scenario} mismatch against ${first.scenario} ` +
          `(events ${scenario.eventCount}/${first.eventCount}, checksum ${scenario.checksum}/${first.checksum}, ` +
          `attrs ${scenario.attrCountTotal}/${first.attrCountTotal})`,
      );
    }
  }
}

function defaultOutputPath(kind) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ext = kind === 'json' ? 'json' : 'md';
  return join(REPORT_DIR, `RUST_NATIVE_CHUNK_AGGREGATE_${stamp}.${ext}`);
}

function writeReports(report, options) {
  mkdirSync(REPORT_DIR, { recursive: true });
  const jsonOut = options.jsonOut ?? defaultOutputPath('json');
  const markdownOut = options.markdownOut ?? jsonOut.replace(/\.json$/i, '.md');
  writeFileSync(jsonOut, JSON.stringify(report, null, 2));
  writeFileSync(markdownOut, renderMarkdown(report, jsonOut));
  return { jsonOut, markdownOut };
}

function renderMarkdown(report, jsonOut) {
  const lines = [
    '# Rust Native Chunk-Aggregate Spike',
    '',
    `Generated: ${report.generatedAt}`,
    `JSON: ${jsonOut}`,
    '',
    '## Contract',
    '',
    '- Benchmark-only native Rust/N-API lab under packages/native-aggregate.',
    '- Public package exports and browser parser paths are untouched.',
    '- Native boundary is coarse: one call per Buffer or file, never per tag/event.',
    '- count-only is diagnostic only; full-string-direct is the primary gate.',
    '',
    '## Gate',
    '',
    `Status: ${report.gate.status}`,
    `Representative size: ${report.gate.representativeSizeMiB} MiB`,
    `full-string-direct wins: ${report.gate.fullString.nativeWins}/4 fixtures at >=20%`,
    `event-object-full wins: ${report.gate.eventObject.nativeWins}/4 fixtures at >=10%`,
    '',
  ];

  if (report.gate.rejectionRules.length > 0) {
    lines.push('## Reject/Pass Reasons', '');
    for (const reason of report.gate.rejectionRules) lines.push(`- ${reason}`);
    lines.push('');
  }

  lines.push('## 128 MiB Full-String Results', '');
  lines.push('| Fixture | Best JS | MiB/s | Best Native | MiB/s | Improvement | Pass |');
  lines.push('| --- | --- | ---: | --- | ---: | ---: | --- |');
  for (const fixture of report.gate.fullString.fixtures) {
    lines.push(
      `| ${fixture.fixtureId} | ${fixture.bestJs ?? '-'} | ${formatNumber(fixture.bestJsMiBPerSec)} | ` +
        `${fixture.bestNative ?? '-'} | ${formatNumber(fixture.bestNativeMiBPerSec)} | ` +
        `${formatPercent(fixture.improvement)} | ${fixture.pass ? 'yes' : 'no'} |`,
    );
  }
  lines.push('');

  lines.push('## Full-String Buffer Vs File', '');
  lines.push('| Size MiB | Fixture | Best JS MiB/s | Native Buffer MiB/s | Native File MiB/s | Buffer Improvement | File Improvement |');
  lines.push('| ---: | --- | ---: | ---: | ---: | ---: | ---: |');
  for (const file of [...report.files].sort((left, right) => left.sizeMiB - right.sizeMiB || left.fixtureId.localeCompare(right.fixtureId))) {
    const tier = file.tiers.find(entry => entry.id === 'full-string-direct');
    if (!tier) continue;
    const bestJs = maxBy(tier.scenarios.filter(scenario => scenario.scenario.startsWith('js-')), scenario => scenario.mibPerSec);
    const nativeBuffer = tier.scenarios.find(scenario => scenario.scenario === 'native-buffer');
    const nativeFile = tier.scenarios.find(scenario => scenario.scenario === 'native-file');
    const bufferImprovement = bestJs && nativeBuffer ? (nativeBuffer.mibPerSec - bestJs.mibPerSec) / bestJs.mibPerSec : Number.NaN;
    const fileImprovement = bestJs && nativeFile ? (nativeFile.mibPerSec - bestJs.mibPerSec) / bestJs.mibPerSec : Number.NaN;
    lines.push(
      `| ${file.sizeMiB.toFixed(2)} | ${file.fixtureId} | ${formatNumber(bestJs?.mibPerSec)} | ` +
        `${formatNumber(nativeBuffer?.mibPerSec)} | ${formatNumber(nativeFile?.mibPerSec)} | ` +
        `${formatPercent(bufferImprovement)} | ${formatPercent(fileImprovement)} |`,
    );
  }
  lines.push('');

  lines.push('## Copy And Boundary Notes', '');
  lines.push('- native-buffer uses one preloaded Node Buffer and one N-API call per measured run.');
  lines.push('- native-uint8array uses one preloaded plain Uint8Array and one N-API call per measured run.');
  lines.push('- native-file reads the file inside Rust and includes native file ingestion in the measured run.');
  lines.push('- native-string-utf8 receives a JS string through napi-rs String, which copies/transcodes it to UTF-8 before Rust scans it.');
  lines.push('- native-string-utf16 receives a JS string through napi-rs Utf16String, which copies UTF-16 code units once and scans u16 without UTF-8 re-encoding.');
  lines.push('- native-span-table-string-utf16 receives a JS string through napi-rs Utf16String, scans UTF-16 in Rust, returns one packed span-table Buffer, and materializes through JS string.slice on the original input.');
  lines.push('- js-sync-string uses the public EventReaderSync string parser over the same preloaded JS string.');
  lines.push('- Bun FFI can call the same Rust UTF-16 scanner through a C ABI symbol only after JS has provided a TypedArray pointer; normal JS string input still needs a string-to-Uint16Array copy on the Bun side.');
  lines.push('- JS baselines use the existing iterable full parser over file byte batches.');
  lines.push('- checksum parity is enforced for every fixture, tier, and scenario before report emission.');
  lines.push('');

  lines.push('## String Boundary Results', '');
  lines.push('| Size MiB | Fixture | JS Sync String MiB/s | Native UTF-8 String MiB/s | Native UTF-16 String MiB/s | UTF-16 vs JS Sync |');
  lines.push('| ---: | --- | ---: | ---: | ---: | ---: |');
  for (const file of [...report.files].sort((left, right) => left.sizeMiB - right.sizeMiB || left.fixtureId.localeCompare(right.fixtureId))) {
    const tier = file.tiers.find(entry => entry.id === 'full-string-direct');
    if (!tier) continue;
    const jsSync = tier.scenarios.find(scenario => scenario.scenario === 'js-sync-string');
    const nativeUtf8 = tier.scenarios.find(scenario => scenario.scenario === 'native-string-utf8');
    const nativeUtf16 = tier.scenarios.find(scenario => scenario.scenario === 'native-string-utf16');
    const improvement = jsSync && nativeUtf16 ? (nativeUtf16.mibPerSec - jsSync.mibPerSec) / jsSync.mibPerSec : Number.NaN;
    lines.push(
      `| ${file.sizeMiB.toFixed(2)} | ${file.fixtureId} | ${formatNumber(jsSync?.mibPerSec)} | ` +
        `${formatNumber(nativeUtf8?.mibPerSec)} | ${formatNumber(nativeUtf16?.mibPerSec)} | ${formatPercent(improvement)} |`,
    );
  }
  lines.push('');

  lines.push('## Span Table String Results', '');
  lines.push('| Size MiB | Fixture | JS Sync MiB/s | Native UTF-16 Aggregate MiB/s | Span Table MiB/s | Span Table MiB | Span vs JS Sync | Span vs Aggregate |');
  lines.push('| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const file of [...report.files].sort((left, right) => left.sizeMiB - right.sizeMiB || left.fixtureId.localeCompare(right.fixtureId))) {
    const tier = file.tiers.find(entry => entry.id === 'full-string-direct');
    if (!tier) continue;
    const jsSync = tier.scenarios.find(scenario => scenario.scenario === 'js-sync-string');
    const nativeUtf16 = tier.scenarios.find(scenario => scenario.scenario === 'native-string-utf16');
    const spanTable = tier.scenarios.find(scenario => scenario.scenario === 'native-span-table-string-utf16');
    if (!spanTable) continue;
    const spanTableBytes = SPAN_TABLE_HEADER_WORDS * 4 + spanTable.eventCount * 28 + spanTable.attrCountTotal * 16;
    const spanVsJs = jsSync ? (spanTable.mibPerSec - jsSync.mibPerSec) / jsSync.mibPerSec : Number.NaN;
    const spanVsAggregate = nativeUtf16 ? (spanTable.mibPerSec - nativeUtf16.mibPerSec) / nativeUtf16.mibPerSec : Number.NaN;
    lines.push(
      `| ${file.sizeMiB.toFixed(2)} | ${file.fixtureId} | ${formatNumber(jsSync?.mibPerSec)} | ` +
        `${formatNumber(nativeUtf16?.mibPerSec)} | ${formatNumber(spanTable.mibPerSec)} | ${formatMiB(spanTableBytes)} | ` +
        `${formatPercent(spanVsJs)} | ${formatPercent(spanVsAggregate)} |`,
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(1) : '-';
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '-';
}

function formatMiB(bytes) {
  return Number.isFinite(bytes) ? (bytes / 1024 / 1024).toFixed(1) : '-';
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = {
    generatedAt: new Date().toISOString(),
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    nativeApi: [
      'parse_aggregate_buffer(input: Buffer, tier: string)',
      'parse_aggregate_uint8array(input: Uint8Array, tier: string)',
      'parse_aggregate_file(path: string, tier: string)',
      'parse_aggregate_string_utf8(input: string, tier: string)',
      'parse_aggregate_string_utf16(input: string, tier: string)',
      'parse_span_table_string_utf16(input: string)',
      'stax_xml_parse_aggregate_utf16_units(input: *const u16, len: usize, tier_id: u32, out: *mut FfiAggregateResult)',
    ],
    contract: [
      'quoted > inside single and double quoted attributes is not a tag end',
      'comments, CDATA, processing instructions, and simple DOCTYPE are handled with JS parser parity',
      'incomplete quoted tail fails instead of producing a false aggregate',
      'count-only is diagnostic and cannot pass the spike alone',
    ],
    options: {
      sizesMiB: options.sizesMiB,
      fixtures: options.fixtures,
      tiers: options.tiers,
      scenarios: options.scenarios,
      runs: options.runs,
      warmups: options.warmups,
      chunkSize: options.chunkSize,
      batchSize: options.batchSize,
    },
    files: [],
    gate: undefined,
  };

  for (const sizeMiB of options.sizesMiB) {
    for (const fixtureId of options.fixtures) {
      const filePath = ensureGeneratedFile(sizeMiB, fixtureId, options.generatedDir);
      const actualSizeMiB = statSync(filePath).size / 1024 / 1024;
      const preloadedBuffer = readFileSync(filePath);
      const preloadedUint8Array = new Uint8Array(preloadedBuffer);
      const preloadedString = preloadedBuffer.toString('utf8');
      console.log(`\n${fixtureId} ${actualSizeMiB.toFixed(2)} MiB`);
      const fileReport = {
        path: filePath,
        fixtureId,
        requestedSizeMiB: sizeMiB,
        sizeMiB: actualSizeMiB,
        tiers: [],
      };

      for (const tierId of options.tiers) {
        console.log(`  ${tierId}`);
        const tier = { id: tierId, scenarios: [] };
        for (const scenario of options.scenarios) {
          const result = measureScenario(scenario, tierId, filePath, actualSizeMiB, options, preloadedBuffer, preloadedUint8Array, preloadedString);
          tier.scenarios.push(result);
          console.log(
            `    ${scenario}: ${result.mibPerSec.toFixed(1)} MiB/s, ${result.avgMs.toFixed(2)} ms, ` +
              `events=${result.eventCount}, attrs=${result.attrCountTotal}, checksum=${result.checksum}`,
          );
        }
        ensureScenarioParity(tier, fixtureId);
        fileReport.tiers.push(tier);
      }
      report.files.push(fileReport);
    }
  }

  report.gate = evaluateGate(report);
  const outputs = writeReports(report, options);
  console.log(`\nreport json: ${outputs.jsonOut}`);
  console.log(`report markdown: ${outputs.markdownOut}`);
  console.log(`gate: ${report.gate.status}`);
}

void main();
