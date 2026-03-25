import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const [, , repoRootArg, caseNameArg] = process.argv;

if (!repoRootArg || !caseNameArg) {
  console.error('Usage: node scripts/parser-benchmark-case.mjs <repoRoot> <caseName>');
  process.exit(1);
}

const repoRoot = path.resolve(repoRootArg);
const caseName = caseNameArg;
const distCandidates = [
  path.join(repoRoot, 'packages/stax-xml/dist/index.js'),
  path.join(repoRoot, 'packages/stax-xml/dist/index.mjs'),
];
const sourceEntry = path.join(repoRoot, 'packages/stax-xml/src/index.ts');
const distEntry = distCandidates.find((candidate) => existsSync(candidate));

if (!distEntry && !existsSync(sourceEntry)) {
  console.error(`Missing parser entrypoints: ${distCandidates.join(', ')} and ${sourceEntry}`);
  process.exit(1);
}

const entrypoint = distEntry ?? sourceEntry;
const {
  StaxXmlCursor,
  StaxXmlCursorSync,
  StaxXmlParser,
  StaxXmlParserSync,
  XmlEventType,
} = await import(pathToFileURL(entrypoint).href);

const midsizeXml = readFileSync(path.join(repoRoot, 'packages/benchmark/assets/midsize.xml'), 'utf8');
const syncConsumeXml = createSyncConsumeXml(20000);
const attrHeavyXml = createAttributeHeavyXml(2500, 48);

const cases = {
  'sync-consume': {
    iterations: 8,
    run: async () => consumeSync(StaxXmlCursorSync, StaxXmlParserSync, XmlEventType, syncConsumeXml),
  },
  'sync-attr-heavy': {
    iterations: 10,
    run: async () => consumeSync(StaxXmlCursorSync, StaxXmlParserSync, XmlEventType, attrHeavyXml),
  },
  'async-consume-single-chunk': {
    iterations: 6,
    run: async () => consumeAsync(StaxXmlParser, XmlEventType, midsizeXml, midsizeXml.length),
  },
  'async-consume-64kb-chunk': {
    iterations: 6,
    run: async () => consumeAsync(StaxXmlParser, XmlEventType, midsizeXml, 64 * 1024),
  },
};

const selected = cases[caseName];
if (!selected) {
  console.error(`Unknown case: ${caseName}`);
  console.error(`Supported cases: ${Object.keys(cases).join(', ')}`);
  process.exit(1);
}

await selected.run();

const timings = [];
let eventsProcessed = 0;
for (let i = 0; i < selected.iterations; i++) {
  maybeGc();
  const startedAt = performance.now();
  eventsProcessed = await selected.run();
  timings.push(performance.now() - startedAt);
}

const summary = {
  caseName,
  repoRoot,
  entrypoint,
  iterations: selected.iterations,
  eventsProcessed,
  minMs: Math.min(...timings),
  maxMs: Math.max(...timings),
  meanMs: average(timings),
  timingsMs: timings,
};

console.log(JSON.stringify(summary, null, 2));

function maybeGc() {
  if (typeof global.gc === 'function') {
    global.gc();
  }
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function createAttributeHeavyXml(itemCount, attributeCount) {
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

function createSyncConsumeXml(itemCount) {
  const items = [];
  for (let index = 0; index < itemCount; index++) {
    items.push(`<item><id>${index}</id><value>value-${index}</value></item>`);
  }
  return `<root>${items.join('')}</root>`;
}

function consumeSync(CursorSync, ParserSync, EventType, xml) {
  let eventsProcessed = 0;

  if (typeof CursorSync === 'function') {
    const cursor = new CursorSync(xml);
    while (cursor.hasNext()) {
      const tokenType = cursor.next();
      eventsProcessed++;
      if (tokenType === EventType.ERROR) {
        throw new Error('Cursor emitted unexpected ERROR token.');
      }
    }
    return eventsProcessed;
  }

  const parser = new ParserSync(xml);
  for (const event of parser) {
    eventsProcessed++;
    if (event.type === EventType.ERROR) {
      throw event.error;
    }
  }
  return eventsProcessed;
}

async function consumeAsync(ParserAsync, EventType, xml, chunkSize) {
  let eventsProcessed = 0;
  const parser = new ParserAsync(createChunkedStream(xml, chunkSize));
  for await (const event of parser) {
    eventsProcessed++;
    if (event.type === EventType.ERROR) {
      throw event.error;
    }
  }
  return eventsProcessed;
}

function createChunkedStream(xml, chunkSize) {
  const bytes = new TextEncoder().encode(xml);
  let offset = 0;

  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }

      const nextOffset = Math.min(offset + chunkSize, bytes.length);
      controller.enqueue(bytes.slice(offset, nextOffset));
      offset = nextOffset;
    }
  });
}
