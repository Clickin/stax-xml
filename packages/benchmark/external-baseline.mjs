import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EventReaderSync,
  StreamEventType,
  StreamReaderSync,
  XmlEventType,
} from '../stax-xml/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultFile = join(__dirname, 'test-data', 'runtime-comparison-16mib.xml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'external-baseline.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'external-baseline.md');
const woodstoxDir = join(__dirname, 'external', 'woodstox');
const quickXmlDir = join(__dirname, 'external', 'quick-xml');
const woodstoxJar = join(woodstoxDir, 'target', 'woodstox-baseline-1.0.0-bench.jar');
const quickXmlExe = join(quickXmlDir, 'target', 'release', process.platform === 'win32' ? 'quick_xml_baseline.exe' : 'quick_xml_baseline');
const allTools = [
  'stax-scan-all-no-decode',
  'stax-raw-frame-semantic-checksum',
  'stax-stream',
  'stax-raw-frame-name-id',
  'stax-raw-frame-name-id-fold-trim',
  'stax-raw-frame-string-cache',
  'stax-event',
  'woodstox',
  'quick-xml',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    runs: 3,
    warmups: 1,
    tools: allTools,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    allowMissing: false,
    skipBuild: false,
    fileExplicit: false,
    staxStreamSource: 'preloaded',
    chunkKiB: 64,
    batchSize: 1,
    boundedRssMiB: 512,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;
    if (arg === '--') continue;
    if (arg === '--allow-missing') {
      options.allowMissing = true;
      continue;
    }
    if (arg === '--skip-build') {
      options.skipBuild = true;
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
        options.file = resolve(process.cwd(), readValue());
        options.fileExplicit = true;
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), '--runs');
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), '--warmups');
        break;
      case '--tools':
        options.tools = parseTools(readValue());
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      case '--stax-stream-source':
        options.staxStreamSource = parseStaxStreamSource(readValue(), name);
        break;
      case '--chunk-kib':
        options.chunkKiB = parsePositiveInteger(readValue(), name);
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), name);
        break;
      case '--bounded-rss-mib':
        options.boundedRssMiB = parsePositiveNumber(readValue(), name);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!existsSync(options.file) && !options.fileExplicit) {
    generateXmlFile(options.file, 16 * 1024 * 1024);
  }
  if (!existsSync(options.file)) {
    throw new Error(`Benchmark fixture does not exist: ${options.file}`);
  }

  return options;
}

function parseStaxStreamSource(value, flag) {
  if (value === 'preloaded' || value === 'file-sync-batches') {
    return value;
  }
  throw new Error(`${flag} must be one of preloaded, file-sync-batches.`);
}

function parseTools(value) {
  const tools = value.split(',').map(entry => entry.trim()).filter(Boolean);
  for (const tool of tools) {
    if (!allTools.includes(tool)) {
      throw new Error(`Unknown tool: ${tool}`);
    }
  }
  if (tools.length === 0) {
    throw new Error('--tools must include at least one tool.');
  }
  return tools;
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
      return 6;
  }
}

function consumeStaxEvent(xml) {
  let eventCount = 0;
  let checksum = 0;

  for (const event of new EventReaderSync(xml)) {
    const typeCode = publicEventTypeCode(event.type);
    eventCount++;
    checksum = mixChecksum(checksum, typeCode);

    if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
      checksum = foldString(checksum, event.name);
    }
    if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
      checksum = foldString(checksum, event.value?.trim());
    }
    if (event.type === XmlEventType.START_ELEMENT) {
      const entries = Object.entries(event.attributes);
      checksum = mixChecksum(checksum, entries.length);
      for (const [name, value] of entries) {
        checksum = foldString(checksum, name);
        checksum = foldString(checksum, value);
      }
    }
  }

  return { eventCount, checksum };
}

function consumeStaxStream(bytes) {
  let eventCount = 0;
  let checksum = 0;

  for (const batch of new StreamReaderSync(bytes)) {
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
  }

  return { eventCount, checksum };
}

function consumeStaxScanAllNoDecode(bytes) {
  let eventCount = 0;
  let checksum = 0;

  for (const batch of new StreamReaderSync(bytes)) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const type = batch.typeAt(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);
      if (type === StreamEventType.START_ELEMENT) {
        checksum = mixChecksum(checksum, batch.attributeCountAt(index));
      }
    }
  }

  return { eventCount, checksum };
}

function consumeStaxRawFrameSemanticChecksum(bytes) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const parser = new StreamReaderSync(bytes);
  let eventCount = 0;
  let checksum = 0;
  let frame;

  while ((frame = parser.nextRawBatch()) !== null) {
    if (frame.kind !== 'frame') {
      throw new Error(`Unsupported raw batch kind: ${frame.kind}`);
    }
    const buffer = frame.buffer;
    const eventTypes = frame.eventTypes;
    const nameStarts = frame.nameStarts;
    const nameEnds = frame.nameEnds;
    const textStarts = frame.textStarts;
    const textEnds = frame.textEnds;
    const attrStarts = frame.attrStarts;
    const attrCounts = frame.attrCounts;
    const attrNameStarts = frame.attrNameStarts;
    const attrNameEnds = frame.attrNameEnds;
    const attrValueStarts = frame.attrValueStarts;
    const attrValueEnds = frame.attrValueEnds;
    const count = frame.eventCount;

    for (let index = 0; index < count; index++) {
      const type = eventTypes[index];
      eventCount++;
      checksum = mixChecksum(checksum, type);

      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        checksum = foldSemanticSpan(checksum, buffer, nameStarts[index], nameEnds[index], decoder);
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        const start = textStarts[index];
        if (start >= 0) {
          checksum = foldSemanticSpan(checksum, buffer, start, textEnds[index], decoder, true);
        }
      }
      if (type === StreamEventType.START_ELEMENT) {
        const attrStart = attrStarts[index];
        const attrCount = attrCounts[index];
        checksum = mixChecksum(checksum, attrCount);
        const attrEnd = attrStart + attrCount;
        for (let attrIndex = attrStart; attrIndex < attrEnd; attrIndex++) {
          checksum = foldSemanticSpan(checksum, buffer, attrNameStarts[attrIndex], attrNameEnds[attrIndex], decoder);
          checksum = foldSemanticSpan(checksum, buffer, attrValueStarts[attrIndex], attrValueEnds[attrIndex], decoder);
        }
      }
    }
  }

  return { eventCount, checksum };
}

function foldSemanticSpan(seed, buffer, start, end, decoder, trim = false) {
  const [trimmedStart, trimmedEnd] = trim ? trimAsciiWhitespace(buffer, start, end) : [start, end];
  if (canFoldAsciiSpan(buffer, trimmedStart, trimmedEnd)) {
    return foldAsciiSpan(seed, buffer, trimmedStart, trimmedEnd);
  }
  const value = decodeSpan(buffer, start, end, decoder);
  return foldString(seed, trim ? value.trim() : value);
}

function canFoldAsciiSpan(buffer, start, end) {
  for (let index = start; index < end; index++) {
    if (buffer[index] > 0x7f) {
      return false;
    }
  }
  return true;
}

function foldAsciiSpan(seed, buffer, start, end) {
  let next = seed;
  for (let index = start; index < end; index++) {
    next = ((next << 5) - next + buffer[index]) | 0;
  }
  return next;
}

function trimAsciiWhitespace(buffer, start, end) {
  let trimmedStart = start;
  let trimmedEnd = end;
  while (trimmedStart < trimmedEnd && isAsciiXmlWhitespace(buffer[trimmedStart])) {
    trimmedStart++;
  }
  while (trimmedEnd > trimmedStart && isAsciiXmlWhitespace(buffer[trimmedEnd - 1])) {
    trimmedEnd--;
  }
  return [trimmedStart, trimmedEnd];
}

function isAsciiXmlWhitespace(value) {
  return value === 0x20 || value === 0x09 || value === 0x0a || value === 0x0d;
}

function consumeStaxRawFrameNameId(bytes, options = {}) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const parser = new StreamReaderSync(bytes);
  const nameCache = [];
  const valueCache = options.valueCache === true ? new SpanStringCache() : undefined;
  let eventCount = 0;
  let checksum = 0;
  let frame;

  while ((frame = parser.nextRawBatch()) !== null) {
    if (frame.kind !== 'frame') {
      throw new Error(`Unsupported raw batch kind: ${frame.kind}`);
    }
    const buffer = frame.buffer;
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
    const count = frame.eventCount;

    for (let index = 0; index < count; index++) {
      const type = eventTypes[index];
      eventCount++;
      checksum = mixChecksum(checksum, type);

      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        checksum = foldString(
          checksum,
          materializeName(buffer, nameStarts[index], nameEnds[index], nameIds[index], decoder, nameCache),
        );
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        const start = textStarts[index];
        if (start >= 0) {
          const value = materializeValue(buffer, start, textEnds[index], decoder, valueCache);
          checksum = options.foldTrimmedText ? foldTrimmedString(checksum, value) : foldString(checksum, value.trim());
        }
      }
      if (type === StreamEventType.START_ELEMENT) {
        const attrStart = attrStarts[index];
        const attrCount = attrCounts[index];
        checksum = mixChecksum(checksum, attrCount);
        const attrEnd = attrStart + attrCount;
        for (let attrIndex = attrStart; attrIndex < attrEnd; attrIndex++) {
          checksum = foldString(
            checksum,
            materializeName(
              buffer,
              attrNameStarts[attrIndex],
              attrNameEnds[attrIndex],
              attrNameIds[attrIndex],
              decoder,
              nameCache,
            ),
          );
          checksum = foldString(checksum, materializeValue(buffer, attrValueStarts[attrIndex], attrValueEnds[attrIndex], decoder, valueCache));
        }
      }
    }
  }

  return { eventCount, checksum };
}

function materializeValue(buffer, start, end, decoder, valueCache) {
  if (!valueCache) {
    return decodeSpan(buffer, start, end, decoder);
  }
  const cached = valueCache.get(buffer, start, end);
  if (cached !== undefined) {
    return cached;
  }
  const value = decodeSpan(buffer, start, end, decoder);
  valueCache.set(buffer, start, end, value);
  return value;
}

class SpanStringCache {
  constructor(maxStoredBytes = 4 * 1024 * 1024) {
    this.maxStoredBytes = maxStoredBytes;
  }

  buckets = new Map();
  maxStoredBytes;
  storedBytes = 0;

  get(buffer, start, end) {
    const length = end - start;
    const hash = hashSpan(buffer, start, end);
    const bucket = this.buckets.get(`${length}:${hash}`);
    if (bucket === undefined) {
      return undefined;
    }
    for (const entry of bucket) {
      if (spanEquals(buffer, start, end, entry.bytes)) {
        return entry.value;
      }
    }
    return undefined;
  }

  set(buffer, start, end, value) {
    const length = end - start;
    if (this.storedBytes + length > this.maxStoredBytes) {
      return;
    }
    const hash = hashSpan(buffer, start, end);
    const key = `${length}:${hash}`;
    const bytes = buffer.slice(start, end);
    this.storedBytes += bytes.byteLength;
    const bucket = this.buckets.get(key);
    if (bucket === undefined) {
      this.buckets.set(key, [{ bytes, value }]);
      return;
    }
    bucket.push({ bytes, value });
  }
}

function hashSpan(buffer, start, end) {
  let hash = 2166136261;
  for (let index = start; index < end; index++) {
    hash = Math.imul((hash ^ buffer[index]) >>> 0, 16777619) >>> 0;
  }
  return hash;
}

function spanEquals(buffer, start, end, bytes) {
  const length = end - start;
  if (bytes.byteLength !== length) {
    return false;
  }
  for (let index = 0; index < length; index++) {
    if (buffer[start + index] !== bytes[index]) {
      return false;
    }
  }
  return true;
}

function foldTrimmedString(seed, value) {
  if (!value) {
    return seed;
  }
  let start = 0;
  let end = value.length;
  while (start < end && isXmlWhitespaceCodeUnit(value.charCodeAt(start))) {
    start++;
  }
  while (end > start && isXmlWhitespaceCodeUnit(value.charCodeAt(end - 1))) {
    end--;
  }
  let next = seed;
  for (let index = start; index < end; index++) {
    next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  }
  return next;
}

function isXmlWhitespaceCodeUnit(value) {
  return value === 0x20 || value === 0x09 || value === 0x0a || value === 0x0d;
}

function materializeName(buffer, start, end, nameId, decoder, nameCache) {
  if (nameId < 0 || start < 0) {
    return undefined;
  }
  const cached = nameCache[nameId];
  if (cached !== undefined) {
    return cached;
  }
  const value = decodeSpan(buffer, start, end, decoder);
  nameCache[nameId] = value;
  return value;
}

function decodeSpan(buffer, start, end, decoder) {
  const ascii = decodeShortAsciiSpan(buffer, start, end);
  return ascii ?? decoder.decode(buffer.subarray(start, end));
}

function decodeShortAsciiSpan(buffer, start, end) {
  switch (end - start) {
    case 0:
      return '';
    case 1: {
      const b0 = buffer[start];
      return b0 <= 0x7f ? String.fromCharCode(b0) : undefined;
    }
    case 2: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      return (b0 | b1) <= 0x7f ? String.fromCharCode(b0, b1) : undefined;
    }
    case 3: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      return (b0 | b1 | b2) <= 0x7f ? String.fromCharCode(b0, b1, b2) : undefined;
    }
    case 4: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      return (b0 | b1 | b2 | b3) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3) : undefined;
    }
    case 5: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      return (b0 | b1 | b2 | b3 | b4) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4) : undefined;
    }
    case 6: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      return (b0 | b1 | b2 | b3 | b4 | b5) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5) : undefined;
    }
    case 7: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6) : undefined;
    }
    case 8: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7)
        : undefined;
    }
    case 9: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8)
        : undefined;
    }
    case 10: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      const b9 = buffer[start + 9];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9)
        : undefined;
    }
    case 11: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      const b9 = buffer[start + 9];
      const b10 = buffer[start + 10];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10)
        : undefined;
    }
    case 12: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      const b9 = buffer[start + 9];
      const b10 = buffer[start + 10];
      const b11 = buffer[start + 11];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11)
        : undefined;
    }
    default:
      return undefined;
  }
}

function* createFileByteBatches(filePath, chunkBytes, batchSize) {
  const fd = openSync(filePath, 'r');
  try {
    while (true) {
      const batch = [];
      for (let index = 0; index < batchSize; index++) {
        const buffer = new Uint8Array(chunkBytes);
        const bytesRead = readSync(fd, buffer, 0, chunkBytes, null);
        if (bytesRead === 0) {
          break;
        }
        batch.push(bytesRead === chunkBytes ? buffer : buffer.subarray(0, bytesRead));
      }
      if (batch.length === 0) {
        return;
      }
      yield batch;
    }
  } finally {
    closeSync(fd);
  }
}

function gcNow() {
  if (globalThis.gc) {
    globalThis.gc();
  }
}

function measureLocal(tool, implementation, run, fileSizeMiB, options, rowOptions = {}) {
  for (let index = 0; index < options.warmups; index++) {
    run();
  }

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
    if (index > 0 && (eventCount !== result.eventCount || checksum !== result.checksum)) {
      throw new Error(`${tool} produced unstable event count or checksum.`);
    }
    eventCount = result.eventCount;
    checksum = result.checksum;
    samplesMs.push(elapsedMs);
    memorySamples.push({ before, after });
  }

  const avgMs = samplesMs.reduce((sum, value) => sum + value, 0) / samplesMs.length;
  const maxRssBytes = Math.max(...memorySamples.map(sample => sample.after.rssBytes));
  const maxHeapUsedBytes = Math.max(...memorySamples.map(sample => sample.after.heapUsedBytes));
  return {
    tool,
    implementation,
    workload: rowOptions.workload ?? 'full-string-checksum',
    fullStringParity: rowOptions.fullStringParity,
    contractScope: rowOptions.contractScope,
    status: 'ok',
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    mibPerSec: fileSizeMiB / (avgMs / 1000),
    eventCount,
    checksum,
    samplesMs,
    boundedMemory: maxRssBytes <= options.boundedRssMiB * 1024 * 1024,
    memory: {
      maxRssBytes,
      maxHeapUsedBytes,
      samples: memorySamples,
    },
  };
}

function takeMemorySnapshot() {
  const memory = process.memoryUsage();
  return {
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    externalBytes: memory.external,
    arrayBuffersBytes: memory.arrayBuffers,
  };
}

function runCommand(command, args, cwd) {
  if (process.platform === 'win32' && (command === 'mvn' || command === 'cargo')) {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', formatWindowsCommand(command, args)], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function runMeasuredCommand(command, args, cwd) {
  const commandSpec = normalizeCommand(command, args);
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(commandSpec.command, commandSpec.args, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const sampler = startPeakRssSampler(child.pid);

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr?.on('data', chunk => {
      stderr += chunk;
    });
    child.on('error', async (error) => {
      resolve({
        error,
        stdout,
        stderr,
        memory: await sampler.stop(),
      });
    });
    child.on('close', async (status, signal) => {
      resolve({
        status,
        signal,
        stdout,
        stderr,
        memory: await sampler.stop(),
      });
    });
  });
}

function normalizeCommand(command, args) {
  if (process.platform === 'win32' && (command === 'mvn' || command === 'cargo')) {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', formatWindowsCommand(command, args)],
    };
  }
  return { command, args };
}

function startPeakRssSampler(pid, intervalMs = 100) {
  if (!pid) {
    return { stop: async () => null };
  }
  if (process.platform === 'win32') {
    return startWindowsPeakRssSampler(pid, intervalMs);
  }

  let stopped = false;
  let timer = null;
  let maxRssBytes = null;
  const sample = () => {
    const rssBytes = readProcessRssBytes(pid);
    if (typeof rssBytes === 'number') {
      maxRssBytes = Math.max(maxRssBytes ?? 0, rssBytes);
    }
    if (!stopped) {
      timer = setTimeout(sample, intervalMs);
      timer.unref?.();
    }
  };
  sample();

  return {
    stop: async () => {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
      }
      const rssBytes = readProcessRssBytes(pid);
      if (typeof rssBytes === 'number') {
        maxRssBytes = Math.max(maxRssBytes ?? 0, rssBytes);
      }
      return typeof maxRssBytes === 'number'
        ? {
          scope: 'process-rss',
          maxRssBytes,
          sampler: {
            source: process.platform === 'linux' ? 'procfs' : 'ps',
            intervalMs,
          },
        }
        : null;
    },
  };
}

function startWindowsPeakRssSampler(pid, intervalMs) {
  const script = [
    `$pidToWatch = ${pid}`,
    '$max = 0',
    'while ($true) {',
    '  $p = Get-Process -Id $pidToWatch -ErrorAction SilentlyContinue',
    '  if ($null -eq $p) { break }',
    '  if ($p.WorkingSet64 -gt $max) { $max = $p.WorkingSet64 }',
    `  Start-Sleep -Milliseconds ${intervalMs}`,
    '}',
    '[Console]::Out.Write($max)',
  ].join('; ');
  const sampler = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  let stdout = '';
  let samplerError = null;
  const closed = new Promise(resolve => {
    sampler.stdout?.setEncoding('utf8');
    sampler.stdout?.on('data', chunk => {
      stdout += chunk;
    });
    sampler.on('error', error => {
      samplerError = error;
      resolve();
    });
    sampler.on('close', () => resolve());
  });

  return {
    stop: async () => {
      await closed;
      if (samplerError) {
        return null;
      }
      const maxRssBytes = Number(stdout.trim());
      return Number.isFinite(maxRssBytes) && maxRssBytes > 0
        ? {
          scope: 'process-rss',
          maxRssBytes,
          sampler: {
            source: 'powershell-get-process',
            intervalMs,
          },
        }
        : null;
    },
  };
}

function readProcessRssBytes(pid) {
  if (process.platform === 'linux') {
    return readLinuxProcessRssBytes(pid);
  }
  return readPsProcessRssBytes(pid);
}

function readLinuxProcessRssBytes(pid) {
  try {
    const status = readFileSync(`/proc/${pid}/status`, 'utf8');
    const match = /^VmRSS:\s+(\d+)\s+kB$/m.exec(status);
    return match ? Number(match[1]) * 1024 : null;
  } catch {
    return null;
  }
}

function readPsProcessRssBytes(pid) {
  const result = spawnSync('ps', ['-o', 'rss=', '-p', String(pid)], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.status !== 0) {
    return null;
  }
  const kib = Number(String(result.stdout).trim());
  return Number.isFinite(kib) && kib > 0 ? kib * 1024 : null;
}

function formatWindowsCommand(command, args) {
  return [command, ...args].map(quoteWindowsArg).join(' ');
}

function quoteWindowsArg(value) {
  if (/^[A-Za-z0-9_./:=\\-]+$/.test(value)) {
    return value;
  }
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function trimSpawnOutput(result) {
  return String(result.stderr ?? '').trim() || String(result.stdout ?? '').trim();
}

function skipped(tool, implementation, reason) {
  return {
    tool,
    implementation,
    workload: 'full-string-checksum',
    status: 'skipped',
    reason,
  };
}

function buildWoodstox(options) {
  if (options.skipBuild && existsSync(woodstoxJar)) {
    return undefined;
  }
  const result = runCommand('mvn', ['-q', '-DskipTests', 'package'], woodstoxDir);
  if (result.error) {
    return result.error.message;
  }
  if (result.status === 0 && existsSync(woodstoxJar)) {
    return undefined;
  }
  return trimSpawnOutput(result) || `mvn package failed with exit ${result.status}`;
}

function buildQuickXml(options) {
  if (options.skipBuild && existsSync(quickXmlExe)) {
    return undefined;
  }
  const result = runCommand('cargo', ['build', '--release', '--manifest-path', join(quickXmlDir, 'Cargo.toml')], repoRoot);
  if (result.error) {
    return result.error.message;
  }
  if (result.status === 0 && existsSync(quickXmlExe)) {
    return undefined;
  }
  return trimSpawnOutput(result) || `cargo build failed with exit ${result.status}`;
}

async function runExternalTool(tool, implementation, command, args, options) {
  const result = await runMeasuredCommand(command, args, repoRoot);
  if (result.error) {
    if (options.allowMissing) {
      return skipped(tool, implementation, result.error.message);
    }
    throw result.error;
  }
  if (result.status !== 0) {
    const reason = trimSpawnOutput(result) || `${command} exited with ${result.status}`;
    if (options.allowMissing) {
      return skipped(tool, implementation, reason);
    }
    throw new Error(`${tool} failed: ${reason}`);
  }
  try {
    const row = JSON.parse(result.stdout);
    const memory = result.memory;
    return {
      tool,
      implementation,
      workload: 'full-string-checksum',
      status: 'ok',
      ...row,
      ...(memory ? {
        boundedMemory: memory.maxRssBytes <= options.boundedRssMiB * 1024 * 1024,
        memory,
      } : {}),
    };
  } catch (error) {
    throw new Error(`${tool} emitted invalid JSON: ${error.message}\n${result.stdout}`);
  }
}

async function runWoodstox(options) {
  const implementation = 'Java + Woodstox 7.2.0';
  const buildError = buildWoodstox(options);
  if (buildError) {
    if (options.allowMissing) {
      return skipped('woodstox', implementation, buildError);
    }
    throw new Error(`woodstox build failed: ${buildError}`);
  }
  return runExternalTool('woodstox', implementation, 'java', [
    '-jar',
    woodstoxJar,
    '--file',
    options.file,
    '--runs',
    String(options.runs),
    '--warmups',
    String(options.warmups),
  ], options);
}

async function runQuickXml(options) {
  const implementation = 'Rust + quick-xml 0.40.1';
  const buildError = buildQuickXml(options);
  if (buildError) {
    if (options.allowMissing) {
      return skipped('quick-xml', implementation, buildError);
    }
    throw new Error(`quick-xml build failed: ${buildError}`);
  }
  return runExternalTool('quick-xml', implementation, quickXmlExe, [
    '--file',
    options.file,
    '--runs',
    String(options.runs),
    '--warmups',
    String(options.warmups),
  ], options);
}

function annotateTarget(results) {
  const woodstox = results.find(result => result.tool === 'woodstox' && result.status === 'ok');
  const targetThroughputMiB = woodstox ? woodstox.mibPerSec * 0.9 : null;

  return {
    target: {
      baselineTool: 'woodstox',
      goalRatio: 0.9,
      targetThroughputMiB,
    },
    results: results.map((result) => {
      if (result.status !== 'ok' || !woodstox) {
        return {
          ...result,
          woodstoxRatio: null,
          targetStatus: result.status === 'ok' ? 'unknown' : result.status,
        };
      }
      const woodstoxRatio = result.mibPerSec / woodstox.mibPerSec;
      return {
        ...result,
        woodstoxRatio,
        targetStatus: woodstoxRatio >= 0.9 ? 'met' : 'below',
      };
    }),
  };
}

function formatMs(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)} ms` : 'n/a';
}

function formatRate(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} MiB/s` : 'n/a';
}

function formatRatio(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}x` : 'n/a';
}

function formatMemory(value) {
  return Number.isFinite(value) ? `${(value / 1024 / 1024).toFixed(1)} MiB` : 'n/a';
}

function escapePipe(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function createMarkdown(report) {
  const lines = [
    '# External Parser Baseline Matrix',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This benchmark compares full string-return checksum consumers against external parser baselines.',
    'Rows are comparable only because they share the same generated XML fixture and checksum contract.',
    '',
    '## Environment',
    '',
    `- CPU: ${report.environment.cpuName}`,
    `- Fixture: ${report.fixture.path}`,
    `- Fixture size: ${report.fixture.sizeMiB.toFixed(2)} MiB`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    `- Bounded RSS gate: ${report.options.boundedRssMiB.toFixed(1)} MiB`,
    '',
    '## Woodstox Target',
    '',
    `Target: reach at least ${report.target.goalRatio.toFixed(1)}x Woodstox throughput on the same full-string checksum workload.`,
  ];

  if (report.target.targetThroughputMiB) {
    lines.push(`Current target throughput: ${formatRate(report.target.targetThroughputMiB)}.`);
  } else {
    lines.push('Current target throughput: n/a until the Woodstox row is available.');
  }

  lines.push('');
  lines.push('| Tool | Implementation | Throughput | Peak RSS | Woodstox ratio | 0.9x target | Average | Events | Checksum | Status |');
  lines.push('| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |');

  for (const result of report.results) {
    lines.push(
      `| ${result.tool} | ${escapePipe(result.implementation)} | ${formatRate(result.mibPerSec)} | ` +
      `${formatMemory(result.memory?.maxRssBytes)} | ${formatRatio(result.woodstoxRatio)} | ${result.targetStatus} | ${formatMs(result.avgMs)} | ` +
      `${result.eventCount ?? 'n/a'} | ${result.checksum ?? 'n/a'} | ${formatStatus(result)} |`,
    );
  }

  lines.push('');
  lines.push('## Contract');
  lines.push('');
  lines.push('- Workload: full-string checksum over event type, element names, trimmed text, attribute names, and attribute values.');
  lines.push('- `stax-scan-all-no-decode` is a partial row: event types plus start-element attribute counts only.');
  lines.push('- `stax-raw-frame-semantic-checksum` is a same-fields checksum row that avoids JavaScript string materialization on ASCII spans; it is not a full-string materialization row.');
  lines.push(`- \`stax-stream\`, \`stax-raw-frame-name-id\`, \`stax-raw-frame-name-id-fold-trim\`, and \`stax-raw-frame-string-cache\` use \`stax-xml\` \`StreamReaderSync\` byte batches; source mode: \`${report.options.staxStreamSource}\`, chunkKiB=${report.options.chunkKiB}, batchSize=${report.options.batchSize}.`);
  lines.push('- `stax-event` uses `stax-xml` `EventReaderSync` public event objects.');
  lines.push('- `woodstox` uses Java `XMLStreamReader` from Woodstox with namespace awareness off, coalescing on, DTD and external entities disabled, and whitespace-only text skipped.');
  lines.push('- `quick-xml` uses Rust `quick-xml` reader events and folds UTF-8 string views into the same UTF-16-code-unit checksum.');
  lines.push('- Comparable rows should preserve event count and checksum. A mismatch means the row is not a valid speed comparison.');
  lines.push('- External parser rows record child-process peak RSS when the platform sampler can observe the process for long enough; missing RSS is not bounded-memory evidence.');
  if (report.options.staxStreamSource === 'file-sync-batches') {
    lines.push('- In file-sync-batches mode, `stax-stream` reads the next chunk with `readSync` only when `StreamReaderSync` pulls the next `Uint8Array[]` batch; it does not pre-materialize the full XML file.');
  }

  return `${lines.join('\n')}\n`;
}

function formatStatus(result) {
  if (result.status === 'ok') return 'ok';
  return `${result.status}: ${escapePipe(result.reason)}`;
}

async function main() {
  const options = parseArgs();
  const needsStaxEvent = options.tools.includes('stax-event');
  const needsPreloadedStaxStream = (
    options.tools.includes('stax-scan-all-no-decode')
    || options.tools.includes('stax-raw-frame-semantic-checksum')
    || options.tools.includes('stax-stream')
    || options.tools.includes('stax-raw-frame-name-id')
    || options.tools.includes('stax-raw-frame-name-id-fold-trim')
    || options.tools.includes('stax-raw-frame-string-cache')
  ) && options.staxStreamSource === 'preloaded';
  const xml = needsStaxEvent ? readTextFile(options.file) : null;
  const bytes = needsPreloadedStaxStream ? readFileSync(options.file) : null;
  const fileSizeBytes = statSync(options.file).size;
  const fileSizeMiB = fileSizeBytes / 1024 / 1024;
  const chunkBytes = options.chunkKiB * 1024;

  const results = [];
  for (const tool of options.tools) {
    if (tool === 'stax-scan-all-no-decode') {
      const implementation = options.staxStreamSource === 'file-sync-batches'
        ? 'Node + stax-xml StreamReaderSync scan-only file-backed Iterable<Uint8Array[]>'
        : 'Node + stax-xml StreamReaderSync scan-only preloaded Uint8Array';
      const run = options.staxStreamSource === 'file-sync-batches'
        ? () => consumeStaxScanAllNoDecode(createFileByteBatches(options.file, chunkBytes, options.batchSize))
        : () => consumeStaxScanAllNoDecode(bytes);
      results.push(measureLocal('stax-scan-all-no-decode', implementation, run, fileSizeMiB, options, {
        workload: 'event-types-and-attribute-counts-only',
        contractScope: 'partial-scan-no-string-materialization',
        fullStringParity: false,
      }));
    } else if (tool === 'stax-raw-frame-semantic-checksum') {
      const implementation = options.staxStreamSource === 'file-sync-batches'
        ? 'Node + stax-xml nextRawBatch semantic byte-fold file-backed Iterable<Uint8Array[]>'
        : 'Node + stax-xml nextRawBatch semantic byte-fold preloaded Uint8Array';
      const run = options.staxStreamSource === 'file-sync-batches'
        ? () => consumeStaxRawFrameSemanticChecksum(createFileByteBatches(options.file, chunkBytes, options.batchSize))
        : () => consumeStaxRawFrameSemanticChecksum(bytes);
      results.push(measureLocal('stax-raw-frame-semantic-checksum', implementation, run, fileSizeMiB, options, {
        workload: 'same-fields-checksum-no-string-materialization',
        contractScope: 'same-fields-checksum-no-string-materialization',
        fullStringParity: false,
      }));
    } else if (tool === 'stax-stream') {
      const implementation = options.staxStreamSource === 'file-sync-batches'
        ? 'Node + stax-xml StreamReaderSync file-backed Iterable<Uint8Array[]>'
        : 'Node + stax-xml StreamReaderSync preloaded Uint8Array';
      const run = options.staxStreamSource === 'file-sync-batches'
        ? () => consumeStaxStream(createFileByteBatches(options.file, chunkBytes, options.batchSize))
        : () => consumeStaxStream(bytes);
      results.push(measureLocal('stax-stream', implementation, run, fileSizeMiB, options));
    } else if (tool === 'stax-raw-frame-name-id') {
      const implementation = options.staxStreamSource === 'file-sync-batches'
        ? 'Node + stax-xml nextRawBatch name-id cache file-backed Iterable<Uint8Array[]>'
        : 'Node + stax-xml nextRawBatch name-id cache preloaded Uint8Array';
      const run = options.staxStreamSource === 'file-sync-batches'
        ? () => consumeStaxRawFrameNameId(createFileByteBatches(options.file, chunkBytes, options.batchSize))
        : () => consumeStaxRawFrameNameId(bytes);
      results.push(measureLocal('stax-raw-frame-name-id', implementation, run, fileSizeMiB, options));
    } else if (tool === 'stax-raw-frame-name-id-fold-trim') {
      const implementation = options.staxStreamSource === 'file-sync-batches'
        ? 'Node + stax-xml nextRawBatch name-id cache fold-trim file-backed Iterable<Uint8Array[]>'
        : 'Node + stax-xml nextRawBatch name-id cache fold-trim preloaded Uint8Array';
      const run = options.staxStreamSource === 'file-sync-batches'
        ? () => consumeStaxRawFrameNameId(createFileByteBatches(options.file, chunkBytes, options.batchSize), { foldTrimmedText: true })
        : () => consumeStaxRawFrameNameId(bytes, { foldTrimmedText: true });
      results.push(measureLocal('stax-raw-frame-name-id-fold-trim', implementation, run, fileSizeMiB, options));
    } else if (tool === 'stax-raw-frame-string-cache') {
      const implementation = options.staxStreamSource === 'file-sync-batches'
        ? 'Node + stax-xml nextRawBatch name-id cache plus bounded value string cache file-backed Iterable<Uint8Array[]>'
        : 'Node + stax-xml nextRawBatch name-id cache plus bounded value string cache preloaded Uint8Array';
      const run = options.staxStreamSource === 'file-sync-batches'
        ? () => consumeStaxRawFrameNameId(createFileByteBatches(options.file, chunkBytes, options.batchSize), { valueCache: true })
        : () => consumeStaxRawFrameNameId(bytes, { valueCache: true });
      results.push(measureLocal('stax-raw-frame-string-cache', implementation, run, fileSizeMiB, options));
    } else if (tool === 'stax-event') {
      results.push(measureLocal('stax-event', 'Node + stax-xml EventReaderSync', () => consumeStaxEvent(xml), fileSizeMiB, options));
    } else if (tool === 'woodstox') {
      results.push(await runWoodstox(options));
    } else if (tool === 'quick-xml') {
      results.push(await runQuickXml(options));
    }
  }

  const annotated = annotateTarget(results);
  const report = {
    generatedAt: new Date().toISOString(),
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
    },
    fixture: {
      path: options.file,
      sizeBytes: fileSizeBytes,
      sizeMiB: fileSizeMiB,
    },
    options: {
      runs: options.runs,
      warmups: options.warmups,
      tools: options.tools,
      staxStreamSource: options.staxStreamSource,
      chunkKiB: options.chunkKiB,
      batchSize: options.batchSize,
      boundedRssMiB: options.boundedRssMiB,
    },
    target: annotated.target,
    results: annotated.results,
  };

  mkdirSync(dirname(options.jsonOut), { recursive: true });
  writeFileSync(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(options.mdOut, createMarkdown(report), 'utf8');
  console.log(`Wrote ${options.jsonOut}`);
  console.log(`Wrote ${options.mdOut}`);
}

function readTextFile(filePath) {
  return readFileSync(filePath, 'utf8');
}

void main();
