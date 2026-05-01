import { bench } from 'mitata';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventReaderSync, XmlEventType, initStaxXml } from 'stax-xml';
import { x } from 'stax-xml/converter';
import { ProjectionReader } from 'stax-xml/projection';
import { parseMitataCliArgs, runMitataWithCli } from './common/mitata-cli.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cli = parseMitataCliArgs();

const catalogSchema = x.object({
  summary: x.object({
    totalBooks: x.number().xpath('./totalBooks').int(),
    source: x.string().xpath('./source')
  }).xpath('/catalog/summary'),
  featured: x.array(
    x.object({
      id: x.string().xpath('./@id'),
      title: x.string().xpath('./title')
    }).transform((item) => ({
      ...item,
      slug: item.title.toLowerCase().replace(/\s+/g, '-')
    })),
    '/catalog/featured'
  ),
  books: x.array(
    x.object({
      id: x.string().xpath('./@id'),
      title: x.string().xpath('./title'),
      author: x.string().xpath('./author').optional(),
      meta: x.object({
        pages: x.number().xpath('./pages').int(),
        rating: x.number().xpath('./rating').int()
      }).xpath('./meta')
    }).transform((book) => ({
      ...book,
      score: book.meta.pages + book.meta.rating
    })),
    '/catalog/book'
  ),
  averageRating: x.array(x.number(), '/catalog/book/meta/rating').transform((ratings) =>
    ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
  ),
  sourceName: x.string().xpath('/catalog/summary/source')
});

function buildCatalogXml(count) {
  const featured = Array.from({ length: count }, (_, i) =>
    `<featured id="f${i}"><title>Featured ${i}</title></featured>`
  ).join('');

  const books = Array.from({ length: count }, (_, i) =>
    `<book id="b${i}">
      <title>Book ${i}</title>
      <author>Author ${i}</author>
      <meta>
        <pages>${100 + i}</pages>
        <rating>${(i % 5) + 1}</rating>
      </meta>
    </book>`
  ).join('');

  return `<catalog>
    <summary>
      <totalBooks>${count}</totalBooks>
      <source>benchmark</source>
    </summary>
    ${featured}
    ${books}
  </catalog>`;
}

function buildProjectionXml(count) {
  const entries = Array.from({ length: count }, (_, i) =>
    `<entry code="entry-${i}"><title>Entry ${i}</title><score>${i % 100}</score></entry>`
  ).join('');

  return `<root>${entries}</root>`;
}

function parsePlainCatalogSync(xml) {
  const parser = new EventReaderSync(xml);
  const elementStack = [];
  const featured = [];
  const books = [];
  const ratings = [];
  const summary = { totalBooks: 0, source: '' };
  let currentFeatured = null;
  let currentBook = null;
  let currentText = '';

  const flushText = () => {
    const text = currentText.trim();
    currentText = '';
    if (!text) return;

    const currentElement = elementStack[elementStack.length - 1];
    const parentElement = elementStack[elementStack.length - 2];

    if (parentElement === 'summary') {
      if (currentElement === 'totalBooks') {
        summary.totalBooks = parseInt(text, 10);
      } else if (currentElement === 'source') {
        summary.source = text;
      }
      return;
    }

    if (parentElement === 'featured' && currentFeatured && currentElement === 'title') {
      currentFeatured.title += text;
      return;
    }

    if (currentBook) {
      if (parentElement === 'book' && currentElement === 'title') {
        currentBook.title += text;
      } else if (parentElement === 'book' && currentElement === 'author') {
        currentBook.author = (currentBook.author ?? '') + text;
      } else if (parentElement === 'meta' && currentElement === 'pages') {
        currentBook.meta.pages = parseInt(text, 10);
      } else if (parentElement === 'meta' && currentElement === 'rating') {
        currentBook.meta.rating = parseInt(text, 10);
      }
    }
  };

  for (const event of parser) {
    switch (event.type) {
      case XmlEventType.START_ELEMENT: {
        const name = event.name ?? event.localName;
        flushText();
        elementStack.push(name);

        if (name === 'featured') {
          currentFeatured = {
            id: event.attributes?.id ?? '',
            title: ''
          };
        } else if (name === 'book') {
          currentBook = {
            id: event.attributes?.id ?? '',
            title: '',
            author: undefined,
            meta: { pages: 0, rating: 0 }
          };
        }
        break;
      }

      case XmlEventType.CHARACTERS:
      case XmlEventType.CDATA:
        if (event.value) {
          currentText += event.value;
        }
        break;

      case XmlEventType.END_ELEMENT: {
        const name = event.name ?? event.localName;
        flushText();
        if (name === 'featured' && currentFeatured) {
          featured.push({
            ...currentFeatured,
            slug: currentFeatured.title.toLowerCase().replace(/\s+/g, '-')
          });
          currentFeatured = null;
        } else if (name === 'book' && currentBook) {
          ratings.push(currentBook.meta.rating);
          books.push({
            ...currentBook,
            score: currentBook.meta.pages + currentBook.meta.rating
          });
          currentBook = null;
        }
        elementStack.pop();
        break;
      }

      case XmlEventType.ERROR:
        throw event.error;
    }
  }

  return {
    summary,
    featured,
    books,
    averageRating: ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length,
    sourceName: summary.source
  };
}

function assertSameOutput(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Plain parser and converter API produced different outputs: ${describeOutputDifference(actual, expected)}`);
  }
}

function describeOutputDifference(actual, expected, path = '$') {
  if (Object.is(actual, expected)) {
    return 'unknown mismatch';
  }
  if (typeof actual !== typeof expected || actual === null || expected === null) {
    return `${path}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`;
  }
  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) {
      return `${path}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`;
    }
    if (actual.length !== expected.length) {
      return `${path}.length: ${actual.length} !== ${expected.length}`;
    }
    for (let index = 0; index < actual.length; index++) {
      const diff = describeOutputDifference(actual[index], expected[index], `${path}[${index}]`);
      if (diff !== 'unknown mismatch') {
        return diff;
      }
    }
    return 'unknown mismatch';
  }
  if (typeof actual === 'object') {
    const actualKeys = Object.keys(actual);
    const expectedKeys = Object.keys(expected);
    if (actualKeys.length !== expectedKeys.length) {
      return `${path} keys: ${actualKeys.join(',')} !== ${expectedKeys.join(',')}`;
    }
    for (const key of expectedKeys) {
      if (!Object.prototype.hasOwnProperty.call(actual, key)) {
        return `${path}.${key}: missing actual key`;
      }
      const diff = describeOutputDifference(actual[key], expected[key], `${path}.${key}`);
      if (diff !== 'unknown mismatch') {
        return diff;
      }
    }
    return 'unknown mismatch';
  }
  return `${path}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`;
}

function assertProjectionRows(result, expectedRowCount) {
  const rowCount = result.rowCount ?? result.row_count;
  if (rowCount !== expectedRowCount) {
    throw new Error(`ProjectionReader returned ${rowCount} rows; expected ${expectedRowCount}`);
  }
  if (!Array.isArray(result.columns) || result.columns.length !== 3) {
    throw new Error('ProjectionReader returned an invalid column shape');
  }
}

function assertProjectionRecords(result, expectedRowCount) {
  const rowCount = result.rowCount ?? result.row_count;
  if (rowCount !== expectedRowCount) {
    throw new Error(`ProjectionReader returned ${rowCount} records; expected ${expectedRowCount}`);
  }
  if (!Array.isArray(result.rows) || result.rows.length !== expectedRowCount) {
    throw new Error('ProjectionReader returned an invalid record shape');
  }
}

async function initializeNativeProjection() {
  try {
    const runtime = await initStaxXml({ backend: 'native', fallbackOnLoadError: false });
    return runtime.backend.kind === 'native'
      && typeof runtime.capabilities.objectRowsProjection === 'function'
      && typeof runtime.capabilities.objectRecordsProjection === 'function';
  } catch (error) {
    console.warn(`Native projection benchmark unavailable: ${error instanceof Error ? error.message : String(error)}`);
    await initStaxXml({ backend: 'js' });
    return false;
  }
}

const fixtureSize = 800;
const xml = buildCatalogXml(fixtureSize);
const compiledSchema = catalogSchema.compile();
const projectionFixtureSize = 10000;
const projectionXml = buildProjectionXml(projectionFixtureSize);
const projectionBytes = Buffer.from(projectionXml);
const projectionSpec = {
  itemName: 'entry',
  fields: [
    { outputName: 'code', valueKind: 'string', sourceKind: 'attribute', sourceName: 'code', textMode: 'direct' },
    { outputName: 'title', valueKind: 'string', sourceKind: 'element', sourceName: 'title', textMode: 'subtree' },
    { outputName: 'score', valueKind: 'number', sourceKind: 'element', sourceName: 'score', textMode: 'subtree' }
  ]
};
const projectionSchema = x.array(
  x.object({
    code: x.string().xpath('./@code'),
    title: x.string().xpath('./title'),
    score: x.number().xpath('./score').int()
  }),
  '//entry'
).compile();
const projectionReader = new ProjectionReader();
const nativeProjectionAvailable = await initializeNativeProjection();

const plainOutput = parsePlainCatalogSync(xml);
const converterOutput = catalogSchema.parseSync(xml);
const compiledOutput = compiledSchema.parseSync(xml);
const projectionJsOutput = projectionSchema.parseSync(projectionBytes, {
  acceleration: { backend: 'js' }
});

assertSameOutput(plainOutput, converterOutput);
assertSameOutput(plainOutput, compiledOutput);
assertSameOutput(projectionJsOutput, Array.from({ length: projectionFixtureSize }, (_, i) => ({
  code: `entry-${i}`,
  title: `Entry ${i}`,
  score: i % 100
})));

if (nativeProjectionAvailable) {
  const projectionNativeOutput = projectionSchema.parseSync(projectionBytes, {
    acceleration: { backend: 'native' }
  });
  assertSameOutput(projectionNativeOutput, projectionJsOutput);
  assertProjectionRows(
    projectionReader.projectObjectRowsSync(projectionBytes, projectionSpec, { backend: 'native' }),
    projectionFixtureSize
  );
  assertProjectionRecords(
    projectionReader.projectObjectRecordsSync(projectionBytes, projectionSpec, { backend: 'native' }),
    projectionFixtureSize
  );
}

const samples = [];

function measure(label, fn) {
  const start = performance.now();
  fn();
  const durationMs = performance.now() - start;
  samples.push({ label, durationMs });
}

measure('plain-parser', () => parsePlainCatalogSync(xml));
measure('converter-api', () => catalogSchema.parseSync(xml));
measure('converter-api-compiled', () => compiledSchema.parseSync(xml));
measure('converter-api-compiled-js-byte-projection', () =>
  projectionSchema.parseSync(projectionBytes, { acceleration: { backend: 'js' } })
);
if (nativeProjectionAvailable) {
  measure('converter-api-compiled-native-byte-projection', () =>
    projectionSchema.parseSync(projectionBytes, { acceleration: { backend: 'native' } })
  );
  measure('projection-reader-native-object-rows', () =>
    projectionReader.projectObjectRowsSync(projectionBytes, projectionSpec, { backend: 'native' })
  );
  measure('projection-reader-native-object-records', () =>
    projectionReader.projectObjectRecordsSync(projectionBytes, projectionSpec, { backend: 'native' })
  );
}

bench('plain parser', () => parsePlainCatalogSync(xml));
bench('converter api', () => catalogSchema.parseSync(xml));
bench('converter api compiled', () => compiledSchema.parseSync(xml));
bench('converter api compiled js byte projection', () =>
  projectionSchema.parseSync(projectionBytes, { acceleration: { backend: 'js' } })
);
if (nativeProjectionAvailable) {
  bench('converter api compiled native byte projection', () =>
    projectionSchema.parseSync(projectionBytes, { acceleration: { backend: 'native' } })
  );
  bench('ProjectionReader native object rows', () =>
    projectionReader.projectObjectRowsSync(projectionBytes, projectionSpec, { backend: 'native' })
  );
  bench('ProjectionReader native object records', () =>
    projectionReader.projectObjectRecordsSync(projectionBytes, projectionSpec, { backend: 'native' })
  );
}

await runMitataWithCli(cli);

const markdown = `# Converter API vs Plain Parser Benchmark

- Fixture: catalog document with ${fixtureSize} featured items and ${fixtureSize} books
- Projection fixture: byte input document with ${projectionFixtureSize} entry rows
- Guarantee: converter implementations are verified to produce identical JSON output before benchmarking; ProjectionReader is verified against the same row count and column shape
- Focus: compare a handwritten plain-parser implementation, declarative converter API, compiled converter API, and the public native projection fast path

## One-shot local timings

| Implementation | Single run |
| --- | ---: |
${samples.map((sample) => `| ${sample.label} | ${sample.durationMs.toFixed(2)} ms |`).join('\n')}
`;

const outDir = join(__dirname, 'results');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'converter-plain-output-benchmark.md');
writeFileSync(outPath, markdown, 'utf8');

console.log(`\nSaved markdown summary to ${outPath}`);
