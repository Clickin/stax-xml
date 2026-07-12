/**
 * Converter catalog benchmark — cases and fixture.
 *
 * Produces a book-catalog XML using the same schema as
 * the original converter-compiled-batch-plan.mjs.
 */

import { StreamReaderSync, XmlEventType } from 'stax-xml';
import { x } from 'stax-xml/converter';

const textEncoder = new TextEncoder();

// ── Shared schema ───────────────────────────────────────────────

const bookSchema = x.object({
  id: x.string().xpath('./@id'),
  title: x.string().xpath('./title'),
  author: x.string().xpath('./author'),
  price: x.number().xpath('./price'),
  featured: x.string().xpath('./featured').optional(),
});

const catalogSchema = x.object({
  books: x.array(bookSchema, '/catalog/book'),
  firstTitle: x.string().xpath('/catalog/book/title').optional(),
});
// v1 compiles schemas lazily on the first parse; retain one shared schema for
// the explicit-plan compatibility row without exposing an obsolete compile API.
const compiledCatalogSchema = catalogSchema;

// ── Fixture generator ───────────────────────────────────────────

/**
 * Create a catalog XML fixture of approximately the given byte size.
 * @param {number} targetBytes
 * @returns {{ bytes: Uint8Array, bookCount: number }}
 */
export function createCatalogFixture(targetBytes) {
  const rows = [];
  let byteLength = '<catalog></catalog>'.length;
  let index = 0;
  while (byteLength < targetBytes) {
    const row = [
      `<book id="book-${index}">`,
      `<title>Compiled Batch Plan ${index}</title>`,
      `<author>Author ${index % 97}</author>`,
      `<price>${(10 + (index % 500) / 10).toFixed(2)}</price>`,
      index % 5 === 0 ? `<featured>true</featured>` : '',
      '</book>',
    ].join('');
    rows.push(row);
    byteLength += row.length;
    index++;
  }
  const xml = `<catalog>${rows.join('')}</catalog>`;
  return {
    bytes: textEncoder.encode(xml),
    bookCount: rows.length,
  };
}

// ── Parity helpers ──────────────────────────────────────────────

function fold(seed, value) {
  let hash = seed | 0;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash | 0;
}

export function summarize(value) {
  let checksum = 0;
  for (const book of value.books) {
    checksum = fold(checksum, book.id);
    checksum = fold(checksum, book.title);
    checksum = fold(checksum, book.author);
    checksum = fold(checksum, String(book.price));
    checksum = fold(checksum, book.featured ?? '');
  }
  return {
    books: value.books.length,
    firstTitle: value.firstTitle,
    checksum,
  };
}

export function sameSummary(left, right) {
  return left.books === right.books
    && left.firstTitle === right.firstTitle
    && left.checksum === right.checksum;
}

// ── Variant runners ─────────────────────────────────────────────

/**
 * Create the three converter benchmark cases.
 *
 * @param {Uint8Array} bytes  — the catalog XML
 * @returns {import('../run.js').BenchmarkCase[]}
 */
export function createConverterCases(bytes) {
  const parseOptions = { maxEvents: 20_000_000 };

  function wrap(rawFn) {
    return () => {
      const raw = rawFn();
      return {
        eventCount: raw.books.length,
        checksum: summarize(raw).checksum,
      };
    };
  }

  return [
    {
      id: 'manual-cursor-reader-sync',
      family: 'converter',
      implementation: 'manual StreamReaderSync object projection',
      contractScope: 'catalog-records',
      fullStringParity: true,
      eventCountKind: 'parsed-elements',
      run: wrap(() => consumeManualCursorReader(bytes)),
    },
    {
      id: 'converter-auto-compiled-batch-plan',
      family: 'converter',
      implementation: 'converter parseSync (auto-compiled)',
      contractScope: 'catalog-records',
      fullStringParity: true,
      eventCountKind: 'parsed-elements',
      run: wrap(() => catalogSchema.parseSync(bytes, parseOptions)),
    },
    {
      id: 'converter-explicit-compiled-batch-plan',
      family: 'converter',
      implementation: 'converter compiled parseSync (explicit)',
      contractScope: 'catalog-records',
      fullStringParity: true,
      eventCountKind: 'parsed-elements',
      run: wrap(() => compiledCatalogSchema.parseSync(bytes, parseOptions)),
    },
  ];
}

export { compiledCatalogSchema, catalogSchema };

// ── Manual consumer (parity reference) ──────────────────────────

function consumeManualCursorReader(bytes) {
  const result = { books: [], firstTitle: undefined };
  let currentBook;
  let currentElement = '';
  const reader = new StreamReaderSync(bytes);

  while (reader.next()) {
    const type = reader.eventType();
    if (type === XmlEventType.START_ELEMENT) {
      const name = reader.name();
      if (name === 'book') {
        currentBook = {
          id: reader.attributeValue('id') ?? '',
          title: '',
          author: '',
          price: 0,
          featured: undefined,
        };
      } else if (currentBook) {
        currentElement = name ?? '';
      }
      continue;
    }
    if (type === XmlEventType.CHARACTERS && currentBook) {
      const text = reader.text()?.trim();
      if (!text) continue;
      if (currentElement === 'title') {
        currentBook.title += text;
        result.firstTitle ??= currentBook.title;
      } else if (currentElement === 'author') {
        currentBook.author += text;
      } else if (currentElement === 'price') {
        currentBook.price = Number(text);
      } else if (currentElement === 'featured') {
        currentBook.featured = text;
      }
      continue;
    }
    if (type === XmlEventType.END_ELEMENT) {
      const name = reader.name();
      if (name === 'book' && currentBook) {
        result.books.push(currentBook);
        currentBook = undefined;
      }
      currentElement = '';
    }
  }

  return result;
}
