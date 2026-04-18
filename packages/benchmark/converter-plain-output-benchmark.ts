import { bench } from 'mitata';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StaxXmlParserSync, XmlEventType, type StartElementEvent } from '../stax-xml/src/index.ts';
import { x, type Infer } from '../stax-xml/src/converter/index.ts';
import { parseMitataCliArgs, runMitataWithCli } from './common/mitata-cli.js';

const cli = parseMitataCliArgs();

const __dirname = dirname(fileURLToPath(import.meta.url));

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

type CatalogOutput = Infer<typeof catalogSchema>;

function buildCatalogXml(count: number): string {
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

function parsePlainCatalogSync(xml: string): CatalogOutput {
  const parser = new StaxXmlParserSync(xml);
  const elementStack: string[] = [];
  const featured: CatalogOutput['featured'] = [];
  const books: CatalogOutput['books'] = [];
  const ratings: number[] = [];
  let summary: CatalogOutput['summary'] = { totalBooks: 0, source: '' };
  let currentFeatured: { id: string; title: string } | null = null;
  let currentBook: { id: string; title: string; author?: string; meta: { pages: number; rating: number } } | null = null;
  let currentText = '';

  const flushText = () => {
    const text = currentText.trim();
    currentText = '';
    if (!text) return;

    const currentElement = elementStack[elementStack.length - 1];
    const parentElement = elementStack[elementStack.length - 2];

    if (parentElement === 'summary') {
      if (currentElement === 'totalbooks') {
        summary.totalBooks = parseInt(text, 10);
      } else if (currentElement === 'totalBooks') {
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
        flushText();
        const startEvent = event as StartElementEvent;
        elementStack.push(startEvent.localName!);

        if (startEvent.localName === 'featured') {
          currentFeatured = {
            id: startEvent.attributes?.id ?? '',
            title: ''
          };
        } else if (startEvent.localName === 'book') {
          currentBook = {
            id: startEvent.attributes?.id ?? '',
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
        flushText();
        const localName = event.localName;
        if (localName === 'featured' && currentFeatured) {
          featured.push({
            ...currentFeatured,
            slug: currentFeatured.title.toLowerCase().replace(/\s+/g, '-')
          });
          currentFeatured = null;
        } else if (localName === 'book' && currentBook) {
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

function assertSameOutput(actual: CatalogOutput, expected: CatalogOutput): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error('Plain parser and converter API produced different outputs');
  }
}

const fixtureSize = 800;
const xml = buildCatalogXml(fixtureSize);
const compiledSchema = catalogSchema.compile();

const plainOutput = parsePlainCatalogSync(xml);
const converterOutput = catalogSchema.parseSync(xml);
const compiledOutput = compiledSchema.parseSync(xml);

assertSameOutput(plainOutput, converterOutput);
assertSameOutput(plainOutput, compiledOutput);

const samples: Array<{ label: string; durationMs: number }> = [];

function measure(label: string, fn: () => unknown) {
  const start = performance.now();
  fn();
  const durationMs = performance.now() - start;
  samples.push({ label, durationMs });
}

measure('plain-parser', () => parsePlainCatalogSync(xml));
measure('converter-api', () => catalogSchema.parseSync(xml));
measure('converter-api-compiled', () => compiledSchema.parseSync(xml));

bench('plain parser', () => parsePlainCatalogSync(xml));
bench('converter api', () => catalogSchema.parseSync(xml));
bench('converter api compiled', () => compiledSchema.parseSync(xml));

await runMitataWithCli(cli);

const markdown = `# Converter API vs Plain Parser Benchmark

- Fixture: catalog document with ${fixtureSize} featured items and ${fixtureSize} books
- Guarantee: all implementations are verified to produce identical JSON output before benchmarking
- Focus: compare a handwritten plain-parser implementation, declarative converter API, and compiled converter API

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
