import { createWriteStream, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { barplot, bench, summary } from 'mitata';
import { StaxXmlWriter, StaxXmlWriterSync } from 'stax-xml';
import { parseMitataCliArgs, runMitataWithCli, shouldPrintHumanReadableBanner } from './common/mitata-cli.mjs';

const cli = parseMitataCliArgs();

function nodeStreamToWritableStream(nodeStream) {
  return new WritableStream({
    write(chunk) {
      return new Promise((resolve, reject) => {
        nodeStream.write(chunk, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        nodeStream.end((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
    abort(reason) {
      nodeStream.destroy(reason);
    }
  });
}

async function generateXmlWithAsyncWriter(outputPath, numElements) {
  const fileStream = createWriteStream(outputPath);
  const writableStream = nodeStreamToWritableStream(fileStream);
  const writer = new StaxXmlWriter(writableStream, {
    prettyPrint: true,
    indentString: '  ',
    bufferSize: 64 * 1024,
    enableAutoFlush: true,
  });

  await writer.writeStartDocument();
  await writer.writeStartElement('books');

  for (let i = 0; i < numElements; i++) {
    const bookId = i + 1;
    const isbn = `978${Math.floor(Math.random() * 900000000) + 100000000}`;
    const year = 2020 + (i % 5);
    const month = (i % 12) + 1;
    const day = (i % 28) + 1;

    await writer.writeStartElement('book', { attributes: { id: `book-${bookId}` } });
    await writer.writeStartElement('title');
    await writer.writeCharacters(`Sample Book Title Number ${bookId} - Lorem ipsum dolor sit amet, consectetur adipiscing elit`);
    await writer.writeEndElement();
    await writer.writeStartElement('author');
    await writer.writeCharacters(`Author Name ${bookId}`);
    await writer.writeEndElement();
    await writer.writeStartElement('isbn');
    await writer.writeCharacters(isbn);
    await writer.writeEndElement();
    await writer.writeStartElement('publisher');
    await writer.writeCharacters(`Sample Publisher ${bookId}`);
    await writer.writeEndElement();
    await writer.writeStartElement('publishDate');
    await writer.writeCharacters(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
    await writer.writeEndElement();
    await writer.writeStartElement('description');
    await writer.writeCharacters(
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ' +
      'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.'
    );
    await writer.writeEndElement();
    await writer.writeStartElement('chapters');
    for (let j = 1; j <= 3; j++) {
      await writer.writeStartElement('chapter', { attributes: { number: j.toString() } });
      await writer.writeCharacters(`${j === 1 ? 'Introduction' : j === 2 ? 'Main Content' : 'Conclusion'} Chapter for Book ${bookId}`);
      await writer.writeEndElement();
    }
    await writer.writeEndElement();
    await writer.writeEndElement();

    if (bookId % 1000 === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  await writer.writeEndElement();
  await writer.writeEndDocument();
  await writer.flush();
}

function generateXmlWithSyncWriter(numElements) {
  const writer = new StaxXmlWriterSync({
    prettyPrint: true,
    indentString: '  ',
  });

  writer.writeStartDocument();
  writer.writeStartElement('books');

  for (let i = 0; i < numElements; i++) {
    const bookId = i + 1;
    const isbn = `978${Math.floor(Math.random() * 900000000) + 100000000}`;
    const year = 2020 + (i % 5);
    const month = (i % 12) + 1;
    const day = (i % 28) + 1;

    writer.writeStartElement('book', { attributes: { id: `book-${bookId}` } });
    writer.writeStartElement('title');
    writer.writeCharacters(`Sample Book Title Number ${bookId} - Lorem ipsum dolor sit amet, consectetur adipiscing elit`);
    writer.writeEndElement();
    writer.writeStartElement('author');
    writer.writeCharacters(`Author Name ${bookId}`);
    writer.writeEndElement();
    writer.writeStartElement('isbn');
    writer.writeCharacters(isbn);
    writer.writeEndElement();
    writer.writeStartElement('publisher');
    writer.writeCharacters(`Sample Publisher ${bookId}`);
    writer.writeEndElement();
    writer.writeStartElement('publishDate');
    writer.writeCharacters(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
    writer.writeEndElement();
    writer.writeStartElement('description');
    writer.writeCharacters(
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ' +
      'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.'
    );
    writer.writeEndElement();
    writer.writeStartElement('chapters');
    for (let j = 1; j <= 3; j++) {
      writer.writeStartElement('chapter', { attributes: { number: j.toString() } });
      writer.writeCharacters(`${j === 1 ? 'Introduction' : j === 2 ? 'Main Content' : 'Conclusion'} Chapter for Book ${bookId}`);
      writer.writeEndElement();
    }
    writer.writeEndElement();
    writer.writeEndElement();
  }

  writer.writeEndElement();
  writer.writeEndDocument();
  return writer.getXmlString();
}

if (shouldPrintHumanReadableBanner(cli)) {
  console.log('📊 XML Writer Benchmark - Async vs Sync Comparison');
}

const tempDir = tmpdir();
const asyncPath1k = join(tempDir, 'async-1k.xml');
const syncPath1k = join(tempDir, 'sync-1k.xml');
const asyncPath5k = join(tempDir, 'async-5k.xml');
const syncPath5k = join(tempDir, 'sync-5k.xml');
const asyncPath10k = join(tempDir, 'async-10k.xml');
const syncPath10k = join(tempDir, 'sync-10k.xml');

barplot(() => {
  summary(() => {
    bench('async writer (1K elements)', async () => {
      await generateXmlWithAsyncWriter(asyncPath1k, 1000);
    }).gc('inner');

    bench('sync writer (1K elements)', () => {
      writeFileSync(syncPath1k, generateXmlWithSyncWriter(1000));
    }).gc('inner');

    bench('async writer (5K elements)', async () => {
      await generateXmlWithAsyncWriter(asyncPath5k, 5000);
    }).gc('inner');

    bench('sync writer (5K elements)', () => {
      writeFileSync(syncPath5k, generateXmlWithSyncWriter(5000));
    }).gc('inner');

    bench('async writer (10K elements)', async () => {
      await generateXmlWithAsyncWriter(asyncPath10k, 10000);
    }).gc('inner');

    bench('sync writer (10K elements)', () => {
      writeFileSync(syncPath10k, generateXmlWithSyncWriter(10000));
    }).gc('inner');
  });
});

await runMitataWithCli(cli);
