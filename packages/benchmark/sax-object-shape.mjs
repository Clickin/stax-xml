import sax from 'sax';
import { Parser as HtmlParser } from 'htmlparser2';
import { createReadStream, closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { SaxesParser } from 'saxes';
import Saxophone from 'saxophone';
import * as txml from 'txml';
import {
  IterableEventType,
  nodeFileByteBatchesSync,
  StaxXmlNodeIterableParser,
} from '../stax-xml/dist/iterable/node.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCENARIO_IDS = [
  'stax-node',
  'sax-stream',
  'sax-string',
  'saxes-stream',
  'saxes-string',
  'saxophone-stream',
  'saxophone-string',
  'htmlparser2-stream',
  'htmlparser2-string',
  'txml-dom-walk',
  'xml-stream',
];
const FIXTURE_IDS = ['repeated-ascii', 'high-cardinality', 'mixed-utf8', 'cross-chunk-long-text'];
const DEFAULT_FIXTURES = ['mixed-utf8'];
const DEFAULT_SIZES_MIB = [128];
const DEFAULT_RUNS = 3;
const DEFAULT_WARMUPS = 1;
const DEFAULT_CHUNK_SIZE = 1024 * 1024;
const DEFAULT_BATCH_SIZE = 1;
const GENERATED_DIR = join(__dirname, 'test-data');
const EVENT_OBJECT_SINK_SIZE = 1024;

const eventObjectSink = new Array(EVENT_OBJECT_SINK_SIZE);

function parseArgs(argv) {
  const options = {
    sizesMiB: [],
    fixtures: [...DEFAULT_FIXTURES],
    scenarios: [...SCENARIO_IDS],
    runs: DEFAULT_RUNS,
    warmups: DEFAULT_WARMUPS,
    chunkSize: DEFAULT_CHUNK_SIZE,
    batchSize: DEFAULT_BATCH_SIZE,
    generatedDir: GENERATED_DIR,
    jsonOut: undefined,
    quick: false,
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
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.sizesMiB.length === 0) {
    options.sizesMiB.push(...DEFAULT_SIZES_MIB);
  }
  return options;
}

function parseList(value, allowed, flag) {
  if (value === 'all') return [...allowed];
  const ids = value.split(',').map(entry => entry.trim()).filter(Boolean);
  for (const id of ids) {
    if (!allowed.includes(id)) {
      throw new Error(`${flag} contains unknown id ${id}. Expected: ${allowed.join(', ')}`);
    }
  }
  if (ids.length === 0) {
    throw new Error(`${flag} must not be empty.`);
  }
  return ids;
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

function ensureGeneratedFile(sizeMiB, fixtureId, generatedDir) {
  mkdirSync(generatedDir, { recursive: true });
  const filePath = join(generatedDir, `sax-object-shape-${fixtureId}-${formatSizeName(sizeMiB)}.xml`);
  const targetBytes = Math.floor(sizeMiB * 1024 * 1024);
  if (existsSync(filePath)) {
    const actual = statSync(filePath).size;
    if (Math.abs(actual - targetBytes) / targetBytes < 0.01) {
      return filePath;
    }
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

function createFixtureElement(fixtureId, id) {
  switch (fixtureId) {
    case 'repeated-ascii':
      return createRepeatedAsciiElement(id);
    case 'high-cardinality':
      return createHighCardinalityElement(id);
    case 'mixed-utf8':
      return createMixedUtf8Element(id);
    case 'cross-chunk-long-text':
      return createCrossChunkLongTextElement(id);
    default:
      throw new Error(`Unknown fixture: ${fixtureId}`);
  }
}

function createRepeatedAsciiElement(id) {
  const title = ['Alpha Guide', 'Beta Guide', 'Gamma Guide', 'Delta Guide'][id % 4];
  const author = ['A. Smith', 'B. Jones', 'C. Brown', 'D. Davis'][id % 4];
  const status = ['new', 'used', 'held', 'archived'][id % 4];
  return (
    `  <book bucket="${id % 16}" lang="en" code="${id % 32}" status="${status}">` +
      `<title>${title}</title>` +
      `<author>${author}</author>` +
      '<description>Repeated ascii payload with stable vocabulary and short values.</description>' +
      `<chapter number="${(id % 3) + 1}">Intro chapter</chapter>` +
      `<chapter number="${(id % 5) + 1}">Body chapter</chapter>` +
    '</book>\n'
  );
}

function createHighCardinalityElement(id) {
  const hex = id.toString(16).padStart(8, '0');
  return (
    `  <book id="book-${hex}" lang="en-${hex}" code="${id}-${hex}" status="state-${id % 997}-${hex}">` +
      `<title>Unique Sample Book ${id} ${hex}</title>` +
      `<author>Author ${id} ${hex}</author>` +
      `<description>High cardinality payload ${id} ${hex} with distinct attribute and text values.</description>` +
      `<chapter number="${id}">Intro ${id} ${hex}</chapter>` +
      `<chapter number="${id + 1}">Body ${id + 1} ${hex}</chapter>` +
    '</book>\n'
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

const CROSS_CHUNK_TEXT_PAYLOAD =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.repeat(192);

function createCrossChunkLongTextElement(id) {
  const hex = id.toString(16).padStart(8, '0');
  return (
    `  <book id="book-${hex}" lang="en" code="${id % 97}" status="long-text">` +
      '<title>Cross chunk text sample</title>' +
      `<description>${CROSS_CHUNK_TEXT_PAYLOAD}${hex}</description>` +
    '</book>\n'
  );
}

function createStartObject(type, name, attrs, stats) {
  const object = { type, name, attrs };
  eventObjectSink[stats.objects & (EVENT_OBJECT_SINK_SIZE - 1)] = object;
  stats.objects++;
  return object;
}

function createTextObject(type, text, stats) {
  const object = { type, text };
  eventObjectSink[stats.objects & (EVENT_OBJECT_SINK_SIZE - 1)] = object;
  stats.objects++;
  return object;
}

function createStats() {
  return {
    events: 0,
    objects: 0,
    strings: 0,
    attrs: 0,
    checksum: 0,
    peakRssBytes: 0,
    peakHeapUsedBytes: 0,
  };
}

function recordString(stats, value) {
  if (value !== undefined) {
    stats.strings++;
  }
  return value;
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

function visitEvent(stats, type) {
  stats.events++;
  stats.checksum = mixChecksum(stats.checksum, type);
}

function visitStartObject(stats, object) {
  stats.checksum = foldString(stats.checksum, object.name);
  stats.checksum = mixChecksum(stats.checksum, object.attrs.length);
  for (const attr of object.attrs) {
    stats.checksum = foldString(stats.checksum, attr.name);
    stats.checksum = foldString(stats.checksum, attr.value);
  }
}

function visitTextObject(stats, object) {
  stats.checksum = foldString(stats.checksum, object.text);
}

function createTextState() {
  return { pending: '' };
}

function appendPendingText(textState, value) {
  textState.pending += value;
}

function flushPendingText(stats, textState) {
  if (textState.pending.length === 0) {
    return;
  }
  const value = textState.pending;
  textState.pending = '';
  if (isWhitespaceOnly(value)) {
    return;
  }
  visitEvent(stats, IterableEventType.CHARACTERS);
  visitTextObject(stats, createTextObject(
    IterableEventType.CHARACTERS,
    recordString(stats, value.trim()),
    stats,
  ));
}

function emitCdataObject(stats, textState, value) {
  flushPendingText(stats, textState);
  visitEvent(stats, IterableEventType.CDATA);
  visitTextObject(stats, createTextObject(
    IterableEventType.CDATA,
    recordString(stats, value.trim()),
    stats,
  ));
}

function capturePeak(stats) {
  const current = process.memoryUsage();
  stats.peakRssBytes = Math.max(stats.peakRssBytes, current.rss);
  stats.peakHeapUsedBytes = Math.max(stats.peakHeapUsedBytes, current.heapUsed);
}

function parseStaxNode(filePath, options) {
  const parser = new StaxXmlNodeIterableParser(nodeFileByteBatchesSync(filePath, {
    chunkSize: options.chunkSize,
    batchSize: options.batchSize,
  }));
  const stats = createStats();
  capturePeak(stats);
  while (parser.nextBatch()) {
    for (let index = 0; index < parser.eventCount(); index++) {
      const type = parser.eventType(index);
      visitEvent(stats, type);
      if (type === IterableEventType.START_ELEMENT) {
        const attrs = [];
        const attrCount = parser.attrCount(index);
        stats.attrs += attrCount;
        for (let attr = 0; attr < attrCount; attr++) {
          attrs.push({
            name: recordString(stats, parser.copyAttrName(index, attr) ?? ''),
            value: recordString(stats, parser.copyAttrValue(index, attr) ?? ''),
          });
        }
        visitStartObject(stats, createStartObject(
          type,
          recordString(stats, parser.copyName(index) ?? ''),
          attrs,
          stats,
        ));
      } else if (type === IterableEventType.CHARACTERS || type === IterableEventType.CDATA) {
        const text = recordString(stats, parser.copyText(index)?.trim() ?? '');
        visitTextObject(stats, createTextObject(type, text, stats));
      }
      if ((stats.events & 0xffff) === 0) {
        capturePeak(stats);
      }
    }
  }
  capturePeak(stats);
  return stats;
}

function parseSaxStream(filePath) {
  return new Promise((resolve, reject) => {
    const stats = createStats();
    const textState = createTextState();
    const parser = sax.createStream(true, {
      lowercase: false,
      normalize: false,
      trim: false,
      xmlns: false,
    });

    visitEvent(stats, IterableEventType.START_DOCUMENT);
    capturePeak(stats);
    parser.on('opentag', (node) => {
      flushPendingText(stats, textState);
      visitEvent(stats, IterableEventType.START_ELEMENT);
      const attrEntries = Object.keys(node.attributes).map(name => ({
        name: recordString(stats, name),
        value: recordString(stats, String(node.attributes[name])),
      }));
      stats.attrs += attrEntries.length;
      visitStartObject(stats, createStartObject(
        IterableEventType.START_ELEMENT,
        recordString(stats, node.name),
        attrEntries,
        stats,
      ));
    });
    parser.on('text', (value) => {
      appendPendingText(textState, value);
    });
    parser.on('cdata', (value) => {
      emitCdataObject(stats, textState, value);
    });
    parser.on('closetag', () => {
      flushPendingText(stats, textState);
      visitEvent(stats, IterableEventType.END_ELEMENT);
      if ((stats.events & 0xffff) === 0) {
        capturePeak(stats);
      }
    });
    parser.on('error', reject);
    parser.on('end', () => {
      flushPendingText(stats, textState);
      visitEvent(stats, IterableEventType.END_DOCUMENT);
      capturePeak(stats);
      resolve(stats);
    });

    createReadStream(filePath, { highWaterMark: DEFAULT_CHUNK_SIZE }).pipe(parser);
  });
}

function parseSaxString(filePath) {
  const stats = createStats();
  const textState = createTextState();
  const parser = sax.parser(true, {
    lowercase: false,
    normalize: false,
    trim: false,
    xmlns: false,
  });
  visitEvent(stats, IterableEventType.START_DOCUMENT);
  parser.onopentag = (node) => {
    flushPendingText(stats, textState);
    visitEvent(stats, IterableEventType.START_ELEMENT);
    const attrEntries = Object.keys(node.attributes).map(name => ({
      name: recordString(stats, name),
      value: recordString(stats, String(node.attributes[name])),
    }));
    stats.attrs += attrEntries.length;
    visitStartObject(stats, createStartObject(
      IterableEventType.START_ELEMENT,
      recordString(stats, node.name),
      attrEntries,
      stats,
    ));
  };
  parser.ontext = (value) => {
    appendPendingText(textState, value);
  };
  parser.oncdata = (value) => {
    emitCdataObject(stats, textState, value);
  };
  parser.onclosetag = () => {
    flushPendingText(stats, textState);
    visitEvent(stats, IterableEventType.END_ELEMENT);
    if ((stats.events & 0xffff) === 0) {
      capturePeak(stats);
    }
  };
  parser.onerror = (error) => {
    throw error;
  };
  capturePeak(stats);
  parser.write(readFileSync(filePath, 'utf8')).close();
  flushPendingText(stats, textState);
  visitEvent(stats, IterableEventType.END_DOCUMENT);
  capturePeak(stats);
  return stats;
}

function parseSaxesStream(filePath) {
  return new Promise((resolve, reject) => {
    const stats = createStats();
    const textState = createTextState();
    const parser = createSaxesParser(stats, textState, reject);
    const stream = createReadStream(filePath, { highWaterMark: DEFAULT_CHUNK_SIZE, encoding: 'utf8' });
    stream.on('data', chunk => parser.write(chunk));
    stream.on('error', reject);
    stream.on('end', () => {
      parser.close();
      flushPendingText(stats, textState);
      visitEvent(stats, IterableEventType.END_DOCUMENT);
      capturePeak(stats);
      resolve(stats);
    });
    visitEvent(stats, IterableEventType.START_DOCUMENT);
    capturePeak(stats);
  });
}

function parseSaxesString(filePath) {
  const stats = createStats();
  const textState = createTextState();
  const parser = createSaxesParser(stats, textState, error => {
    throw error;
  });
  visitEvent(stats, IterableEventType.START_DOCUMENT);
  capturePeak(stats);
  parser.write(readFileSync(filePath, 'utf8')).close();
  flushPendingText(stats, textState);
  visitEvent(stats, IterableEventType.END_DOCUMENT);
  capturePeak(stats);
  return stats;
}

function createSaxesParser(stats, textState, onError) {
  const parser = new SaxesParser({
    xmlns: false,
    position: false,
  });
  parser.on('error', onError);
  parser.on('opentag', (node) => {
    flushPendingText(stats, textState);
    visitEvent(stats, IterableEventType.START_ELEMENT);
    const attrEntries = Object.keys(node.attributes).map(name => ({
      name: recordString(stats, name),
      value: recordString(stats, String(node.attributes[name])),
    }));
    stats.attrs += attrEntries.length;
    visitStartObject(stats, createStartObject(
      IterableEventType.START_ELEMENT,
      recordString(stats, node.name),
      attrEntries,
      stats,
    ));
  });
  parser.on('text', (value) => {
    appendPendingText(textState, value);
  });
  parser.on('cdata', (value) => {
    emitCdataObject(stats, textState, value);
  });
  parser.on('closetag', () => {
    flushPendingText(stats, textState);
    visitEvent(stats, IterableEventType.END_ELEMENT);
    if ((stats.events & 0xffff) === 0) {
      capturePeak(stats);
    }
  });
  return parser;
}

function parseSaxophoneStream(filePath) {
  return new Promise((resolve, reject) => {
    const stats = createStats();
    const textState = createTextState();
    const parser = createSaxophoneParser(stats, textState);
    visitEvent(stats, IterableEventType.START_DOCUMENT);
    capturePeak(stats);
    parser.on('error', reject);
    parser.on('finish', () => {
      flushPendingText(stats, textState);
      visitEvent(stats, IterableEventType.END_DOCUMENT);
      capturePeak(stats);
      resolve(stats);
    });
    createReadStream(filePath, { highWaterMark: DEFAULT_CHUNK_SIZE }).pipe(parser);
  });
}

function parseSaxophoneString(filePath) {
  const stats = createStats();
  const textState = createTextState();
  const parser = createSaxophoneParser(stats, textState);
  visitEvent(stats, IterableEventType.START_DOCUMENT);
  capturePeak(stats);
  parser.parse(readFileSync(filePath));
  flushPendingText(stats, textState);
  visitEvent(stats, IterableEventType.END_DOCUMENT);
  capturePeak(stats);
  return stats;
}

function createSaxophoneParser(stats, textState) {
  const parser = new Saxophone();
  parser.on('tagopen', tag => {
    flushPendingText(stats, textState);
    visitEvent(stats, IterableEventType.START_ELEMENT);
    const parsedAttrs = Saxophone.parseAttrs(tag.attrs);
    const attrEntries = Object.keys(parsedAttrs).map(name => ({
      name: recordString(stats, name),
      value: recordString(stats, String(parsedAttrs[name])),
    }));
    stats.attrs += attrEntries.length;
    visitStartObject(stats, createStartObject(
      IterableEventType.START_ELEMENT,
      recordString(stats, tag.name),
      attrEntries,
      stats,
    ));
    if (tag.isSelfClosing) {
      visitEvent(stats, IterableEventType.END_ELEMENT);
    }
  });
  parser.on('tagclose', () => {
    flushPendingText(stats, textState);
    visitEvent(stats, IterableEventType.END_ELEMENT);
    if ((stats.events & 0xffff) === 0) {
      capturePeak(stats);
    }
  });
  parser.on('text', text => {
    appendPendingText(textState, text.contents);
  });
  parser.on('cdata', cdata => {
    emitCdataObject(stats, textState, cdata.contents);
  });
  return parser;
}

function parseHtmlparser2Stream(filePath) {
  return new Promise((resolve, reject) => {
    const stats = createStats();
    const textState = createTextState();
    const parser = createHtmlparser2Parser(stats, textState, reject);
    const stream = createReadStream(filePath, { highWaterMark: DEFAULT_CHUNK_SIZE, encoding: 'utf8' });
    stream.on('data', chunk => parser.write(chunk));
    stream.on('error', reject);
    stream.on('end', () => {
      parser.end();
      flushPendingText(stats, textState);
      visitEvent(stats, IterableEventType.END_DOCUMENT);
      capturePeak(stats);
      resolve(stats);
    });
    visitEvent(stats, IterableEventType.START_DOCUMENT);
    capturePeak(stats);
  });
}

function parseHtmlparser2String(filePath) {
  const stats = createStats();
  const textState = createTextState();
  const parser = createHtmlparser2Parser(stats, textState, error => {
    throw error;
  });
  visitEvent(stats, IterableEventType.START_DOCUMENT);
  capturePeak(stats);
  parser.write(readFileSync(filePath, 'utf8'));
  parser.end();
  flushPendingText(stats, textState);
  visitEvent(stats, IterableEventType.END_DOCUMENT);
  capturePeak(stats);
  return stats;
}

function parseTxmlDomWalk(filePath) {
  const stats = createStats();
  visitEvent(stats, IterableEventType.START_DOCUMENT);
  capturePeak(stats);
  const nodes = txml.parse(readFileSync(filePath, 'utf8'), {
    keepWhitespace: false,
    noChildNodes: [],
  });
  walkTxmlNodes(stats, nodes);
  visitEvent(stats, IterableEventType.END_DOCUMENT);
  capturePeak(stats);
  return stats;
}

function walkTxmlNodes(stats, nodes) {
  for (const node of nodes) {
    if (typeof node === 'string') {
      if (isWhitespaceOnly(node)) continue;
      visitEvent(stats, IterableEventType.CHARACTERS);
      visitTextObject(stats, createTextObject(
        IterableEventType.CHARACTERS,
        recordString(stats, node.trim()),
        stats,
      ));
      continue;
    }
    if (!node || typeof node !== 'object') continue;
    if (typeof node.tagName === 'string' && node.tagName.startsWith('?')) {
      walkTxmlNodes(stats, node.children ?? []);
      continue;
    }
    visitEvent(stats, IterableEventType.START_ELEMENT);
    const attributes = node.attributes ?? {};
    const attrEntries = Object.keys(attributes).map(name => ({
      name: recordString(stats, name),
      value: recordString(stats, attributes[name] == null ? '' : String(attributes[name])),
    }));
    stats.attrs += attrEntries.length;
    visitStartObject(stats, createStartObject(
      IterableEventType.START_ELEMENT,
      recordString(stats, node.tagName ?? ''),
      attrEntries,
      stats,
    ));
    walkTxmlNodes(stats, node.children ?? []);
    visitEvent(stats, IterableEventType.END_ELEMENT);
    if ((stats.events & 0xffff) === 0) {
      capturePeak(stats);
    }
  }
}

function createHtmlparser2Parser(stats, textState, onError) {
  return new HtmlParser({
    onopentag(name, attributes) {
      flushPendingText(stats, textState);
      visitEvent(stats, IterableEventType.START_ELEMENT);
      const attrEntries = Object.keys(attributes).map(attrName => ({
        name: recordString(stats, attrName),
        value: recordString(stats, String(attributes[attrName])),
      }));
      stats.attrs += attrEntries.length;
      visitStartObject(stats, createStartObject(
        IterableEventType.START_ELEMENT,
        recordString(stats, name),
        attrEntries,
        stats,
      ));
    },
    ontext(value) {
      appendPendingText(textState, value);
    },
    oncdata(value) {
      emitCdataObject(stats, textState, value);
    },
    onclosetag() {
      flushPendingText(stats, textState);
      visitEvent(stats, IterableEventType.END_ELEMENT);
      if ((stats.events & 0xffff) === 0) {
        capturePeak(stats);
      }
    },
    onerror: onError,
  }, {
    xmlMode: true,
    decodeEntities: true,
    lowerCaseTags: false,
    lowerCaseAttributeNames: false,
    recognizeSelfClosing: true,
    recognizeCDATA: true,
  });
}

function isWhitespaceOnly(value) {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code !== 32 && code !== 9 && code !== 10 && code !== 13) {
      return false;
    }
  }
  return true;
}

async function measureScenario(id, filePath, fileSizeMiB, options) {
  try {
    for (let index = 0; index < options.warmups; index++) {
      await runScenario(id, filePath, options);
    }
    const samplesMs = [];
    let eventCount = 0;
    let checksum = 0;
    let objectCount = 0;
    let stringCount = 0;
    let attrCount = 0;
    let peakRssBytes = 0;
    let peakHeapUsedBytes = 0;
    for (let index = 0; index < options.runs; index++) {
      if (globalThis.gc) {
        globalThis.gc();
      }
      const startedAt = performance.now();
      const stats = await runScenario(id, filePath, options);
      const elapsedMs = performance.now() - startedAt;
      if (index > 0 && (stats.events !== eventCount || stats.checksum !== checksum)) {
        throw new Error(`${id} produced unstable event count/checksum`);
      }
      eventCount = stats.events;
      checksum = stats.checksum;
      objectCount = stats.objects;
      stringCount = stats.strings;
      attrCount = stats.attrs;
      peakRssBytes = Math.max(peakRssBytes, stats.peakRssBytes);
      peakHeapUsedBytes = Math.max(peakHeapUsedBytes, stats.peakHeapUsedBytes);
      samplesMs.push(elapsedMs);
    }
    const avgMs = average(samplesMs);
    return {
      id,
      status: 'ok',
      avgMs,
      minMs: Math.min(...samplesMs),
      maxMs: Math.max(...samplesMs),
      mibPerSec: fileSizeMiB / (avgMs / 1000),
      eventCount,
      checksum,
      objectCount,
      stringCount,
      attrCount,
      peakRssBytes,
      peakHeapUsedBytes,
      samplesMs,
    };
  } catch (error) {
    return {
      id,
      status: 'failed',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function runScenario(id, filePath, options) {
  switch (id) {
    case 'stax-node':
      return parseStaxNode(filePath, options);
    case 'sax-stream':
      return parseSaxStream(filePath);
    case 'sax-string':
      return parseSaxString(filePath);
    case 'saxes-stream':
      return parseSaxesStream(filePath);
    case 'saxes-string':
      return parseSaxesString(filePath);
    case 'saxophone-stream':
      return parseSaxophoneStream(filePath);
    case 'saxophone-string':
      return parseSaxophoneString(filePath);
    case 'htmlparser2-stream':
      return parseHtmlparser2Stream(filePath);
    case 'htmlparser2-string':
      return parseHtmlparser2String(filePath);
    case 'txml-dom-walk':
      return parseTxmlDomWalk(filePath);
    case 'xml-stream':
      return parseXmlStream(filePath);
    default:
      throw new Error(`Unknown scenario ${id}`);
  }
}

async function parseXmlStream(filePath) {
  const { default: XmlStream } = await import('xml-stream');
  return new Promise((resolve, reject) => {
    const stats = createStats();
    const textState = createTextState();
    const xml = new XmlStream(createReadStream(filePath, { highWaterMark: DEFAULT_CHUNK_SIZE }));
    visitEvent(stats, IterableEventType.START_DOCUMENT);
    capturePeak(stats);
    xml.on('startElement', (name, attributes) => {
      flushPendingText(stats, textState);
      visitEvent(stats, IterableEventType.START_ELEMENT);
      const attrEntries = Object.keys(attributes ?? {}).map(attrName => ({
        name: recordString(stats, attrName),
        value: recordString(stats, String(attributes[attrName])),
      }));
      stats.attrs += attrEntries.length;
      visitStartObject(stats, createStartObject(
        IterableEventType.START_ELEMENT,
        recordString(stats, name),
        attrEntries,
        stats,
      ));
    });
    xml.on('text', (value) => {
      const text = typeof value === 'string' ? value : value?.$text ?? '';
      appendPendingText(textState, text);
    });
    xml.on('endElement', () => {
      flushPendingText(stats, textState);
      visitEvent(stats, IterableEventType.END_ELEMENT);
      if ((stats.events & 0xffff) === 0) {
        capturePeak(stats);
      }
    });
    xml.on('error', reject);
    xml.on('end', () => {
      flushPendingText(stats, textState);
      visitEvent(stats, IterableEventType.END_DOCUMENT);
      capturePeak(stats);
      resolve(stats);
    });
  });
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

function formatRate(value) {
  return value.toFixed(1);
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = {
    generatedAt: new Date().toISOString(),
    contract: [
      'same generated XML fixture',
      'start document/end document included in event checksum',
      'START_ELEMENT materializes { type, name, attrs: [{ name, value }] }',
      'CHARACTERS/CDATA materializes { type, text } after skipping whitespace-only text',
      'text trimmed before checksum',
      'objects escape through a fixed ring buffer',
    ],
    options: {
      runs: options.runs,
      warmups: options.warmups,
      sizesMiB: options.sizesMiB,
      fixtures: options.fixtures,
      scenarios: options.scenarios,
      chunkSize: options.chunkSize,
      batchSize: options.batchSize,
    },
    files: [],
  };

  for (const sizeMiB of options.sizesMiB) {
    for (const fixtureId of options.fixtures) {
      const filePath = ensureGeneratedFile(sizeMiB, fixtureId, options.generatedDir);
      const fileSizeMiB = bytesToMiB(statSync(filePath).size);
      const scenarios = [];
      for (const scenario of options.scenarios) {
        scenarios.push(await measureScenario(scenario, filePath, fileSizeMiB, options));
      }
      report.files.push({
        path: filePath,
        fixtureId,
        sizeMiB: fileSizeMiB,
        scenarios,
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

function printReport(report) {
  console.log('SAX object-shape benchmark');
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`);
  console.log(`Fixtures: ${report.options.fixtures.join(', ')}`);
  console.log(`Scenarios: ${report.options.scenarios.join(', ')}`);
  for (const file of report.files) {
    console.log(`\n${file.path} (${file.sizeMiB.toFixed(2)} MiB, fixture=${file.fixtureId})`);
    const baseline = file.scenarios.find(scenario => scenario.id === 'stax-node');
    for (const scenario of file.scenarios) {
      if (scenario.status !== 'ok') {
        console.log(`  ${scenario.id}: failed (${scenario.reason})`);
        continue;
      }
      const ratio = baseline && scenario.id !== baseline.id
        ? `, vs stax=${(scenario.avgMs / baseline.avgMs).toFixed(2)}x time`
        : '';
      console.log(
        `  ${scenario.id}: ${formatRate(scenario.mibPerSec)} MiB/s, ` +
        `${scenario.avgMs.toFixed(2)} ms, events=${scenario.eventCount}, ` +
        `objects=${scenario.objectCount}, strings=${scenario.stringCount}, attrs=${scenario.attrCount}, ` +
        `checksum=${scenario.checksum}, rss=${formatMiB(scenario.peakRssBytes)} MiB, ` +
        `heap=${formatMiB(scenario.peakHeapUsedBytes)} MiB${ratio}`,
      );
    }
  }
}

void main();
