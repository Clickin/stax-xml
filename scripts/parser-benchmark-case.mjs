import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { getGitMetadata, resolveBuiltDistEntrypoint } from './compare-runner-lib.mjs';

const [, , repoRootArg, suiteArg, caseNameArg, comparisonBaselineArg = 'none'] = process.argv;

if (!repoRootArg || !suiteArg || !caseNameArg) {
  console.error(
    'Usage: node scripts/parser-benchmark-case.mjs <repoRoot> <suite> <caseName> [comparisonBaseline]'
  );
  process.exit(1);
}

const repoRoot = path.resolve(repoRootArg);
const suite = suiteArg;
const caseName = caseNameArg;
const comparisonBaseline = comparisonBaselineArg;
const timestamp = new Date().toISOString();
const entrypoint = resolveBuiltDistEntrypoint(repoRoot);
const api = await import(pathToFileURL(entrypoint).href);
const git = await getGitMetadata(repoRoot);

const cases = getCaseDefinitions(repoRoot);
const suiteCases = cases[suite];
const selected = suiteCases?.[caseName];

if (!selected) {
  console.error(`Unknown suite/case combination: ${suite}/${caseName}`);
  console.error(
    `Supported cases: ${Object.entries(cases)
      .flatMap(([suiteName, suiteEntries]) => Object.keys(suiteEntries).map((name) => `${suiteName}/${name}`))
      .join(', ')}`
  );
  process.exit(1);
}

const fixture = selected.load();
const correctness = await selected.verify(api, fixture);
await selected.measure(api, fixture);

const timings = [];
let unitsProcessed = 0;
for (let iteration = 0; iteration < selected.iterations; iteration++) {
  maybeGc();
  const startedAt = performance.now();
  unitsProcessed = await selected.measure(api, fixture);
  timings.push(performance.now() - startedAt);
}

const summary = {
  repoRoot,
  git,
  comparisonBaseline,
  suite,
  caseName,
  label: selected.label,
  entrypoint,
  timestamp,
  entrySurface: selected.entrySurface,
  fixture: fixture.metadata,
  iterations: selected.iterations,
  unitsProcessed,
  minMs: Math.min(...timings),
  maxMs: Math.max(...timings),
  meanMs: average(timings),
  timingsMs: timings,
  correctness,
  completed: true,
};

console.log(JSON.stringify(summary, null, 2));

function getCaseDefinitions(root) {
  return {
    cursor: {
      'sync-cursor-consume': {
        label: 'synthetic token-dense XML',
        entrySurface: 'cursor',
        iterations: 8,
        load: () => ({
          xml: createTokenDenseXml(20_000),
          metadata: {
            type: 'synthetic',
            description: 'Token-dense XML with repeated item/id/value triplets',
          },
        }),
        verify: ({ StaxXmlCursorSync, XmlEventType }, fixture) =>
          verifySyncCursor(StaxXmlCursorSync, XmlEventType, fixture.xml),
        measure: ({ StaxXmlCursorSync, XmlEventType }, fixture) =>
          measureSyncCursor(StaxXmlCursorSync, XmlEventType, fixture.xml),
      },
      'sync-cursor-attr-unused': {
        label: 'synthetic attribute-dense XML without attribute access',
        entrySurface: 'cursor',
        iterations: 10,
        load: () => ({
          xml: createAttributeDenseXml(2_500, 48),
          metadata: {
            type: 'synthetic',
            description: 'Attribute-dense XML without calling cursor attribute accessors',
          },
        }),
        verify: ({ StaxXmlCursorSync, XmlEventType }, fixture) =>
          verifySyncCursor(StaxXmlCursorSync, XmlEventType, fixture.xml),
        measure: ({ StaxXmlCursorSync, XmlEventType }, fixture) =>
          measureSyncCursor(StaxXmlCursorSync, XmlEventType, fixture.xml),
      },
      'async-cursor-midsize-4kb': {
        label: 'midsize.xml via async cursor with 4KB chunks',
        entrySurface: 'cursor',
        iterations: 6,
        load: () => loadXmlFixture(root, 'midsize.xml', 4 * 1024),
        verify: ({ StaxXmlCursor, XmlEventType }, fixture) =>
          verifyAsyncCursor(StaxXmlCursor, XmlEventType, fixture.xml, fixture.chunkSize),
        measure: ({ StaxXmlCursor, XmlEventType }, fixture) =>
          measureAsyncCursor(StaxXmlCursor, XmlEventType, fixture.xml, fixture.chunkSize),
      },
      'async-cursor-midsize-64kb': {
        label: 'midsize.xml via async cursor with 64KB chunks',
        entrySurface: 'cursor',
        iterations: 6,
        load: () => loadXmlFixture(root, 'midsize.xml', 64 * 1024),
        verify: ({ StaxXmlCursor, XmlEventType }, fixture) =>
          verifyAsyncCursor(StaxXmlCursor, XmlEventType, fixture.xml, fixture.chunkSize),
        measure: ({ StaxXmlCursor, XmlEventType }, fixture) =>
          measureAsyncCursor(StaxXmlCursor, XmlEventType, fixture.xml, fixture.chunkSize),
      },
    },
    wrapper: {
      'sync-parser-books': {
        label: 'books.xml via public sync parser',
        entrySurface: 'wrapper',
        iterations: 12,
        load: () => loadXmlFixture(root, 'books.xml'),
        verify: ({ StaxXmlParserSync, XmlEventType }, fixture) =>
          verifySyncParser(StaxXmlParserSync, XmlEventType, fixture.xml),
        measure: ({ StaxXmlParserSync, XmlEventType }, fixture) =>
          measureSyncParser(StaxXmlParserSync, XmlEventType, fixture.xml),
      },
      'sync-parser-complex': {
        label: 'complex.xml via public sync parser',
        entrySurface: 'wrapper',
        iterations: 12,
        load: () => loadXmlFixture(root, 'complex.xml'),
        verify: ({ StaxXmlParserSync, XmlEventType }, fixture) =>
          verifySyncParser(StaxXmlParserSync, XmlEventType, fixture.xml),
        measure: ({ StaxXmlParserSync, XmlEventType }, fixture) =>
          measureSyncParser(StaxXmlParserSync, XmlEventType, fixture.xml),
      },
      'async-parser-midsize-4kb': {
        label: 'midsize.xml via public async parser with 4KB chunks',
        entrySurface: 'wrapper',
        iterations: 6,
        load: () => loadXmlFixture(root, 'midsize.xml', 4 * 1024),
        verify: ({ StaxXmlParser, XmlEventType }, fixture) =>
          verifyAsyncParser(StaxXmlParser, XmlEventType, fixture.xml, fixture.chunkSize),
        measure: ({ StaxXmlParser, XmlEventType }, fixture) =>
          measureAsyncParser(StaxXmlParser, XmlEventType, fixture.xml, fixture.chunkSize),
      },
      'async-parser-midsize-64kb': {
        label: 'midsize.xml via public async parser with 64KB chunks',
        entrySurface: 'wrapper',
        iterations: 6,
        load: () => loadXmlFixture(root, 'midsize.xml', 64 * 1024),
        verify: ({ StaxXmlParser, XmlEventType }, fixture) =>
          verifyAsyncParser(StaxXmlParser, XmlEventType, fixture.xml, fixture.chunkSize),
        measure: ({ StaxXmlParser, XmlEventType }, fixture) =>
          measureAsyncParser(StaxXmlParser, XmlEventType, fixture.xml, fixture.chunkSize),
      },
      'async-parser-mixed-256b': {
        label: 'mixed.xml via public async parser with 256B chunks',
        entrySurface: 'wrapper',
        iterations: 8,
        load: () => loadXmlFixture(root, 'mixed.xml', 256),
        verify: ({ StaxXmlParser, XmlEventType }, fixture) =>
          verifyAsyncParser(StaxXmlParser, XmlEventType, fixture.xml, fixture.chunkSize),
        measure: ({ StaxXmlParser, XmlEventType }, fixture) =>
          measureAsyncParser(StaxXmlParser, XmlEventType, fixture.xml, fixture.chunkSize),
      },
    },
    stress: {
      'async-parser-single-chunk': {
        label: 'midsize.xml via public async parser in one chunk',
        entrySurface: 'wrapper',
        iterations: 4,
        load: () => loadXmlFixture(root, 'midsize.xml', 'single-chunk'),
        verify: ({ StaxXmlParser, XmlEventType }, fixture) =>
          verifyAsyncParser(StaxXmlParser, XmlEventType, fixture.xml, fixture.chunkSize),
        measure: ({ StaxXmlParser, XmlEventType }, fixture) =>
          measureAsyncParser(StaxXmlParser, XmlEventType, fixture.xml, fixture.chunkSize),
      },
    },
  };
}

function maybeGc() {
  if (typeof global.gc === 'function') {
    global.gc();
  }
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function loadXmlFixture(repoRoot, assetName, chunkSize) {
  const xml = readFileSync(path.join(repoRoot, 'packages/benchmark/assets', assetName), 'utf8');
  return {
    xml,
    chunkSize,
    metadata: {
      type: 'asset',
      asset: assetName,
      chunkSize: describeChunkSize(chunkSize, xml),
    },
  };
}

function describeChunkSize(chunkSize, xml) {
  if (chunkSize === undefined) {
    return null;
  }
  if (chunkSize === 'single-chunk') {
    return new TextEncoder().encode(xml).length;
  }
  return chunkSize;
}

function createAttributeDenseXml(itemCount, attributeCount) {
  const items = [];
  for (let index = 0; index < itemCount; index++) {
    const attributes = [];
    for (let attributeIndex = 0; attributeIndex < attributeCount; attributeIndex++) {
      attributes.push(`a${attributeIndex}="value-${index}-${attributeIndex}"`);
    }
    items.push(`<item ${attributes.join(' ')} />`);
  }
  return `<root>${items.join('')}</root>`;
}

function createTokenDenseXml(itemCount) {
  const items = [];
  for (let index = 0; index < itemCount; index++) {
    items.push(`<item><id>${index}</id><value>value-${index}</value><flag/></item>`);
  }
  return `<root>${items.join('')}</root>`;
}

function measureSyncCursor(CursorSync, EventType, xml) {
  assertExport(CursorSync, 'StaxXmlCursorSync');
  let unitsProcessed = 0;
  const cursor = new CursorSync(xml);
  while (cursor.hasNext()) {
    const tokenType = cursor.next();
    unitsProcessed++;
    if (tokenType === EventType.ERROR) {
      throw new Error('Cursor emitted unexpected ERROR token.');
    }
  }
  return unitsProcessed;
}

async function measureAsyncCursor(CursorAsync, EventType, xml, chunkSize) {
  assertExport(CursorAsync, 'StaxXmlCursor');
  let unitsProcessed = 0;
  const cursor = new CursorAsync(createChunkedStream(xml, chunkSize));
  while (cursor.hasNext()) {
    const tokenType = await cursor.next();
    unitsProcessed++;
    if (tokenType === EventType.ERROR) {
      throw new Error('Cursor emitted unexpected ERROR token.');
    }
  }
  return unitsProcessed;
}

function measureSyncParser(ParserSync, EventType, xml) {
  assertExport(ParserSync, 'StaxXmlParserSync');
  let unitsProcessed = 0;
  const parser = new ParserSync(xml);
  for (const event of parser) {
    unitsProcessed++;
    if (event.type === EventType.ERROR) {
      throw event.error;
    }
  }
  return unitsProcessed;
}

async function measureAsyncParser(ParserAsync, EventType, xml, chunkSize) {
  assertExport(ParserAsync, 'StaxXmlParser');
  let unitsProcessed = 0;
  const parser = new ParserAsync(createChunkedStream(xml, chunkSize));
  for await (const event of parser) {
    unitsProcessed++;
    if (event.type === EventType.ERROR) {
      throw event.error;
    }
  }
  return unitsProcessed;
}

function verifySyncCursor(CursorSync, EventType, xml) {
  assertExport(CursorSync, 'StaxXmlCursorSync');
  const trace = createTraceSummary();
  let unitsProcessed = 0;
  const cursor = new CursorSync(xml);
  while (cursor.hasNext()) {
    const tokenType = cursor.next();
    unitsProcessed++;
    if (tokenType === EventType.ERROR) {
      throw new Error('Cursor emitted unexpected ERROR token.');
    }
    trace.push(normalizeCursorToken(cursor, tokenType, EventType));
  }
  return {
    unitsProcessed,
    trace: trace.finish(),
  };
}

async function verifyAsyncCursor(CursorAsync, EventType, xml, chunkSize) {
  assertExport(CursorAsync, 'StaxXmlCursor');
  const trace = createTraceSummary();
  let unitsProcessed = 0;
  const cursor = new CursorAsync(createChunkedStream(xml, chunkSize));
  while (cursor.hasNext()) {
    const tokenType = await cursor.next();
    unitsProcessed++;
    if (tokenType === EventType.ERROR) {
      throw new Error('Cursor emitted unexpected ERROR token.');
    }
    trace.push(normalizeCursorToken(cursor, tokenType, EventType));
  }
  return {
    unitsProcessed,
    trace: trace.finish(),
  };
}

function verifySyncParser(ParserSync, EventType, xml) {
  assertExport(ParserSync, 'StaxXmlParserSync');
  const trace = createTraceSummary();
  let unitsProcessed = 0;
  const parser = new ParserSync(xml);
  for (const event of parser) {
    unitsProcessed++;
    if (event.type === EventType.ERROR) {
      throw event.error;
    }
    trace.push(normalizeEvent(event));
  }
  return {
    unitsProcessed,
    trace: trace.finish(),
  };
}

async function verifyAsyncParser(ParserAsync, EventType, xml, chunkSize) {
  assertExport(ParserAsync, 'StaxXmlParser');
  const trace = createTraceSummary();
  let unitsProcessed = 0;
  const parser = new ParserAsync(createChunkedStream(xml, chunkSize));
  for await (const event of parser) {
    unitsProcessed++;
    if (event.type === EventType.ERROR) {
      throw event.error;
    }
    trace.push(normalizeEvent(event));
  }
  return {
    unitsProcessed,
    trace: trace.finish(),
  };
}

function normalizeCursorToken(cursor, tokenType, EventType) {
  const normalized = {
    type: tokenType,
    name: cursor.name,
    localName: cursor.localName,
    prefix: cursor.prefix,
    uri: cursor.uri,
    text: tokenType === EventType.CHARACTERS || tokenType === EventType.CDATA
      ? cursor.getText()
      : undefined,
  };
  return stripUndefined(normalized);
}

function normalizeEvent(event) {
  const normalized = {
    type: event.type,
    name: 'name' in event ? event.name : undefined,
    localName: 'localName' in event ? event.localName : undefined,
    prefix: 'prefix' in event ? event.prefix : undefined,
    uri: 'uri' in event ? event.uri : undefined,
    text: 'value' in event ? event.value : undefined,
    attributes: 'attributes' in event ? sortRecord(event.attributes) : undefined,
    attributesWithPrefix: 'attributesWithPrefix' in event
      ? normalizeAttributesWithPrefix(event.attributesWithPrefix)
      : undefined,
  };
  return stripUndefined(normalized);
}

function createTraceSummary() {
  const countsByType = {};
  const hash = createHash('sha256');
  let totalRecords = 0;
  let firstStartElement = null;
  let lastEndElement = null;

  return {
    push(record) {
      totalRecords++;
      countsByType[record.type] = (countsByType[record.type] ?? 0) + 1;
      if (!firstStartElement && record.type === 'START_ELEMENT') {
        firstStartElement = record.name ?? record.localName ?? null;
      }
      if (record.type === 'END_ELEMENT') {
        lastEndElement = record.name ?? record.localName ?? null;
      }
      hash.update(`${JSON.stringify(record)}\n`);
    },
    finish() {
      return {
        totalRecords,
        countsByType,
        firstStartElement,
        lastEndElement,
        checksum: hash.digest('hex'),
      };
    },
  };
}

function normalizeAttributesWithPrefix(value) {
  if (!value) {
    return undefined;
  }

  return Object.entries(value)
    .map(([key, info]) => normalizeAttributeEntry(key, info))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeAttributeEntry(key, info) {
  const localName = info.localName ?? key;
  const name = info.prefix
    ? `${info.prefix}:${localName}`
    : localName;

  return stripUndefined({
    name,
    localName,
    prefix: info.prefix,
    uri: info.uri,
    value: info.value,
  });
}

function sortRecord(value) {
  if (!value) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  );
}

function stripUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
}

function createChunkedStream(xml, chunkSize) {
  const bytes = new TextEncoder().encode(xml);
  const actualChunkSize = chunkSize === 'single-chunk'
    ? bytes.length
    : chunkSize;
  let offset = 0;

  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }

      const nextOffset = Math.min(offset + actualChunkSize, bytes.length);
      controller.enqueue(bytes.slice(offset, nextOffset));
      offset = nextOffset;
    }
  });
}

function assertExport(value, exportName) {
  if (typeof value !== 'function') {
    throw new Error(`Built dist is missing required export: ${exportName}`);
  }
}
