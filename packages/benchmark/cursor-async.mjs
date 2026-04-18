import { createReadStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { barplot, bench, run, summary } from 'mitata';
import { StaxXmlParser, XmlEventType } from 'stax-xml';
import { CursorEventType, XmlCursorReaderAsync } from 'stax-xml/cursor';

const __dirname = dirname(fileURLToPath(import.meta.url));
const booksPath = join(__dirname, 'assets/books.xml');

function createWebStream(filePath) {
  const nodeStream = createReadStream(filePath);
  return Readable.toWeb(nodeStream);
}

async function staxAsyncCursorConsume() {
  const stream = createWebStream(booksPath);
  const cursor = new XmlCursorReaderAsync(stream);
  while (await cursor.next()) {
    const t = cursor.eventType();
    switch (t) {
      case CursorEventType.START_ELEMENT: {
        cursor.localName();
        const ac = cursor.getAttributeCount();
        for (let i = 0; i < ac; i++) {
          cursor.getAttributeLocalName(i);
          cursor.getAttributeValue(i);
        }
        break;
      }
      case CursorEventType.CHARACTERS:
      case CursorEventType.CDATA:
        cursor.text();
        break;
    }
  }
  await cursor.close();
}

async function staxAsyncCursorMinimal() {
  const stream = createWebStream(booksPath);
  const cursor = new XmlCursorReaderAsync(stream);
  while (await cursor.next()) {
    // just advance
  }
  await cursor.close();
}

async function staxAsyncEventConsume() {
  const stream = createWebStream(booksPath);
  const parser = new StaxXmlParser(stream);
  for await (const event of parser) {
    switch (event.type) {
      case XmlEventType.START_ELEMENT:
      case XmlEventType.CHARACTERS:
      case XmlEventType.CDATA:
      case XmlEventType.END_ELEMENT:
        break;
      case XmlEventType.ERROR:
        throw event.error;
    }
  }
}

console.log('📊 Async Cursor vs Async Event Parser — 4KB (books.xml)');
console.log('   (Includes stream I/O overhead)\n');

barplot(() => {
  summary(() => {
    bench('async cursor (consume)', async () => { await staxAsyncCursorConsume(); }).gc('inner');
    bench('async cursor (minimal)', async () => { await staxAsyncCursorMinimal(); }).gc('inner');
    bench('async event parser', async () => { await staxAsyncEventConsume(); }).gc('inner');
  });
});

await run({ format: 'mitata', throw: true });
