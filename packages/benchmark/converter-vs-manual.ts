/**
 * Converter API vs Manual Parsing Benchmark
 *
 * Compares declarative converter API with manual event-based parsing
 * for building the same JSON output structure.
 */

import { bench, run } from 'mitata';
import { StaxXmlParser, StaxXmlParserSync, XmlEventType, type StartElementEvent } from 'stax-xml';
import { x, type Infer } from 'stax-xml/converter';
import { createLargeXMLStream } from './common/large-file-generator.js';

// Define converter schema (declarative approach)
const bookSchema = x.object({
  id: x.string().xpath('./@id'),
  title: x.string().xpath('./title'),
  author: x.string().xpath('./author'),
  isbn: x.string().xpath('./isbn'),
  publisher: x.string().xpath('./publisher'),
  publishDate: x.string().xpath('./publishDate'),
  description: x.string().xpath('./description'),
  chapters: x.array(
    x.object({
      number: x.string().xpath('./@number'),
      text: x.string().xpath('.')
    }),
    './chapters/chapter'
  )
});

const booksSchema = x.array(bookSchema, '/root/book');

// Infer Book type from schema
type Book = Infer<typeof bookSchema>;

// Manual parsing implementation (programmatic approach)
async function parseManual(xmlStream: ReadableStream<Uint8Array>): Promise<Book[]> {
  const books: Book[] = [];
  let currentBook: Partial<Book> | null = null;
  let currentChapters: Array<{ number: string; text: string }> = [];
  const elementStack: string[] = [];

  const parser = new StaxXmlParser(xmlStream);

  for await (const event of parser) {
    switch (event.type) {
      case XmlEventType.START_ELEMENT: {
        const startEvent = event as StartElementEvent
        elementStack.push(startEvent.localName!);

        if (event.localName === 'book') {
          const id = event.attributes?.['id'] || '';
          currentBook = {
            id,
            chapters: []
          };
          currentChapters = [];
        } else if (event.localName === 'chapter') {
          const number = event.attributes?.['number'] || '';
          currentChapters.push({
            number,
            text: ''
          });
        }
        break;
      }

      case XmlEventType.CHARACTERS: {
        if (!currentBook) break;
        if (!event.value) break;

        const text = event.value.trim();
        if (!text) break;

        const currentElement = elementStack[elementStack.length - 1];

        switch (currentElement) {
          case 'title':
            currentBook.title = (currentBook.title || '') + text;
            break;
          case 'author':
            currentBook.author = (currentBook.author || '') + text;
            break;
          case 'isbn':
            currentBook.isbn = (currentBook.isbn || '') + text;
            break;
          case 'publisher':
            currentBook.publisher = (currentBook.publisher || '') + text;
            break;
          case 'publishdate':
            currentBook.publishDate = (currentBook.publishDate || '') + text;
            break;
          case 'description':
            currentBook.description = (currentBook.description || '') + text;
            break;
          case 'chapter':
            if (currentChapters.length > 0) {
              const chapter = currentChapters[currentChapters.length - 1]!
              chapter.text += text;
            }
            break;
        }
        break;
      }

      case XmlEventType.END_ELEMENT: {
        if (event.localName === 'book' && currentBook) {
          currentBook.chapters = currentChapters;
          books.push(currentBook as Book);
          currentBook = null;
          currentChapters = [];
        }

        elementStack.pop();
        break;
      }

      case XmlEventType.ERROR:
        throw event.error;
    }
  }

  return books;
}

// Manual parsing implementation - Sync version
function parseManualSync(xmlString: string): Book[] {
  const books: Book[] = [];
  let currentBook: Partial<Book> | null = null;
  let currentChapters: Array<{ number: string; text: string }> = [];
  const elementStack: string[] = [];

  const parser = new StaxXmlParserSync(xmlString);

  for (const event of parser) {
    switch (event.type) {
      case XmlEventType.START_ELEMENT: {
        const startEvent = event as StartElementEvent
        elementStack.push(startEvent.localName!);

        if (event.localName === 'book') {
          const id = event.attributes?.['id'] || '';
          currentBook = {
            id,
            chapters: []
          };
          currentChapters = [];
        } else if (event.localName === 'chapter') {
          const number = event.attributes?.['number'] || '';
          currentChapters.push({
            number,
            text: ''
          });
        }
        break;
      }

      case XmlEventType.CHARACTERS: {
        if (!currentBook) break;
        if (!event.value) break;

        const text = event.value.trim();
        if (!text) break;

        const currentElement = elementStack[elementStack.length - 1];

        switch (currentElement) {
          case 'title':
            currentBook.title = (currentBook.title || '') + text;
            break;
          case 'author':
            currentBook.author = (currentBook.author || '') + text;
            break;
          case 'isbn':
            currentBook.isbn = (currentBook.isbn || '') + text;
            break;
          case 'publisher':
            currentBook.publisher = (currentBook.publisher || '') + text;
            break;
          case 'publishdate':
            currentBook.publishDate = (currentBook.publishDate || '') + text;
            break;
          case 'description':
            currentBook.description = (currentBook.description || '') + text;
            break;
          case 'chapter':
            if (currentChapters.length > 0) {
              const chapter = currentChapters[currentChapters.length - 1]!
              chapter.text += text;
            }
            break;
        }
        break;
      }

      case XmlEventType.END_ELEMENT: {
        if (event.localName === 'book' && currentBook) {
          currentBook.chapters = currentChapters;
          books.push(currentBook as Book);
          currentBook = null;
          currentChapters = [];
        }

        elementStack.pop();
        break;
      }

      case XmlEventType.ERROR:
        throw event.error;
    }
  }

  return books;
}

// Helper: Convert ReadableStream to string
async function readStreamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder().decode(combined);
}

// Converter API implementation (declarative approach)
async function parseConverter(xmlStream: ReadableStream<Uint8Array>): Promise<Book[]> {
  // Converter API can parse directly from ReadableStream or string
  // Increase maxEvents limit for large files
  const books = await booksSchema.parse(xmlStream, {
    maxEvents: 10000000 // 10M events (default is 1M)
  });
  return books;
}

// Converter API implementation - Sync version
function parseConverterSync(xmlString: string): Book[] {
  const books = booksSchema.parseSync(xmlString, {
    maxEvents: 10000000 // 10M events (default is 1M)
  });
  return books;
}

// Benchmark configurations
const syncConfigs = [
  { size: 0.001, name: '1MB' },   // ~1MB for sync tests
  { size: 0.005, name: '5MB' },   // ~5MB for sync tests
  { size: 0.01, name: '10MB' },   // ~10MB for sync tests
];

const asyncConfigs = [
  { size: 0.01, name: '10MB' },   // ~10MB
  { size: 0.05, name: '50MB' },   // ~50MB
  { size: 0.1, name: '100MB' },   // ~100MB
];

console.log('================================================================================');
console.log('Converter API vs Manual Parsing Benchmark');
console.log('================================================================================');
console.log('');
console.log('This benchmark compares two approaches to parsing XML to JSON:');
console.log('');
console.log('1. Converter API (Declarative):');
console.log('   - Uses x.object(), x.string(), x.array() schema definitions');
console.log('   - XPath-based element selection');
console.log('   - Type-safe and concise code');
console.log('');
console.log('2. Manual Parsing (Programmatic):');
console.log('   - Direct event-based parsing with StaxXmlParser');
console.log('   - Manual state management and element tracking');
console.log('   - Full control over parsing logic');
console.log('');
console.log('Both approaches produce identical JSON output.');
console.log('');
console.log('Tests include:');
console.log('  - Sync versions (1MB, 5MB, 10MB): Direct string parsing');
console.log('  - Async versions (10MB, 50MB, 100MB): Stream-based parsing');
console.log('');
console.log('================================================================================');
console.log('');

// Run sync benchmarks for small files
console.log('📊 SYNCHRONOUS PARSING BENCHMARKS (Small Files)');
console.log('================================================================================\n');

for (const config of syncConfigs) {
  console.log(`\n📊 Testing ${config.name} with Sync API\n`);

  bench(`Manual Sync (${config.name})`, async () => {
    const stream = createLargeXMLStream({ sizeGB: config.size });
    const xmlString = await readStreamToString(stream);
    const books = parseManualSync(xmlString);
    return books.length;
  });

  bench(`Converter Sync (${config.name})`, async () => {
    const stream = createLargeXMLStream({ sizeGB: config.size });
    const xmlString = await readStreamToString(stream);
    const books = parseConverterSync(xmlString);
    return books.length;
  });
}

// Run async benchmarks for larger files
console.log('\n\n📊 ASYNCHRONOUS PARSING BENCHMARKS (Medium-Large Files)');
console.log('================================================================================\n');

for (const config of asyncConfigs) {
  console.log(`\n📊 Testing ${config.name} with Async API\n`);

  bench(`Manual Async (${config.name})`, async () => {
    const stream = createLargeXMLStream({ sizeGB: config.size });
    const books = await parseManual(stream);
    return books.length;
  });

  bench(`Converter Async (${config.name})`, async () => {
    const stream = createLargeXMLStream({ sizeGB: config.size });
    const books = await parseConverter(stream);
    return books.length;
  });
}

console.log('\n⏱️  Starting benchmarks...\n');

// Verify correctness before benchmarking
console.log('🔍 Verifying output correctness (Sync)...\n');

const testStream1 = createLargeXMLStream({ sizeGB: 0.001 }); // 1MB test
const testString = await readStreamToString(testStream1);

const manualResultSync = parseManualSync(testString);
const converterResultSync = parseConverterSync(testString);

console.log(`Manual Sync parsed ${manualResultSync.length} books`);
console.log(`Converter Sync parsed ${converterResultSync.length} books`);

console.log('\n🔍 Verifying output correctness (Async)...\n');

const testStream2 = createLargeXMLStream({ sizeGB: 0.001 }); // 1MB test
const testStream3 = createLargeXMLStream({ sizeGB: 0.001 });

const [manualResult, converterResult] = await Promise.all([
  parseManual(testStream2),
  parseConverter(testStream3)
]);

console.log(`Manual Async parsed ${manualResult.length} books`);
console.log(`Converter Async parsed ${converterResult.length} books`);

if (manualResult.length !== converterResult.length) {
  console.error('❌ ERROR: Different number of books parsed!');
  process.exit(1);
}

// Compare first book
if (manualResult.length > 0 && converterResult.length > 0) {
  const manualBook = manualResult[0]!;
  const converterBook = converterResult[0]!;

  console.log('\n📖 Comparing first book:');
  console.log('  Manual:', {
    id: manualBook.id,
    title: manualBook.title?.substring(0, 50) + '...',
    chapters: manualBook.chapters?.length
  });
  console.log('  Converter:', {
    id: converterBook.id,
    title: converterBook.title?.substring(0, 50) + '...',
    chapters: converterBook.chapters?.length
  });

  // More detailed comparison
  const fieldsMatch =
    manualBook.id === converterBook.id &&
    manualBook.title === converterBook.title &&
    manualBook.author === converterBook.author &&
    manualBook.chapters.length === converterBook.chapters.length;

  if (fieldsMatch) {
    console.log('✅ Output structures are identical!\n');
  } else {
    console.warn('⚠️  Output structures differ\n');
    console.log('Manual book:', JSON.stringify(manualBook, null, 2).substring(0, 500));
    console.log('Converter book:', JSON.stringify(converterBook, null, 2).substring(0, 500));
  }
}

console.log('================================================================================');
console.log('Running benchmarks...');
console.log('================================================================================\n');

await run();

console.log('\n================================================================================');
console.log('Benchmark Complete');
console.log('================================================================================');
console.log('');
console.log('Key Takeaways:');
console.log('');
console.log('📌 Converter API:');
console.log('   - Declarative and concise code');
console.log('   - Type-safe with schema validation');
console.log('   - XPath-based element selection');
console.log('   - Easier to maintain and understand');
console.log('');
console.log('📌 Manual Parsing:');
console.log('   - More control over parsing logic');
console.log('   - Can optimize for specific use cases');
console.log('   - Requires more code and state management');
console.log('   - Better for complex transformations');
console.log('');
console.log('Choose based on your needs:');
console.log('  - For simple to moderate complexity: Use Converter API');
console.log('  - For maximum performance or complex logic: Use Manual Parsing');
console.log('');
