import { barplot, bench, summary } from 'mitata';
import { StaxXmlWriter, StaxXmlWriterSync } from 'stax-xml';
import { parseMitataCliArgs, runMitataWithCli, shouldPrintHumanReadableBanner } from './common/mitata-cli.js';

const cli = parseMitataCliArgs();

function createCountingWritableStream(): { stream: WritableStream<Uint8Array>; getBytesWritten: () => number } {
  let bytesWritten = 0;

  return {
    stream: new WritableStream<Uint8Array>({
      write(chunk) {
        bytesWritten += chunk.length;
      }
    }),
    getBytesWritten: () => bytesWritten
  };
}

function writeSyncCatalog(bookCount: number, prettyPrint: boolean): number {
  const writer = new StaxXmlWriterSync({
    prettyPrint,
    indentString: '  '
  });

  writer.writeStartDocument();
  writer.writeStartElement('catalog');

  for (let index = 0; index < bookCount; index++) {
    const bookId = index + 1;
    writer.writeStartElement('book', {
      attributes: {
        id: `book-${bookId}`,
        category: 'reference'
      }
    });

    writer.writeStartElement('title');
    writer.writeCharacters(`Writer Core Title ${bookId}`);
    writer.writeEndElement();

    writer.writeStartElement('author');
    writer.writeCharacters(`Author ${bookId}`);
    writer.writeEndElement();

    writer.writeStartElement('summary');
    writer.writeCharacters('Compact direct writer workload for hot-path benchmarking.');
    writer.writeEndElement();

    writer.writeEndElement();
  }

  writer.writeEndElement();
  writer.writeEndDocument();
  return writer.getXmlString().length;
}

async function writeAsyncCatalog(bookCount: number, prettyPrint: boolean): Promise<number> {
  const { stream, getBytesWritten } = createCountingWritableStream();
  const writer = new StaxXmlWriter(stream, {
    prettyPrint,
    indentString: '  ',
    bufferSize: 64 * 1024,
    flushThreshold: 0.8,
    enableAutoFlush: true
  });

  await writer.writeStartDocument();
  await writer.writeStartElement('catalog');

  for (let index = 0; index < bookCount; index++) {
    const bookId = index + 1;
    await writer.writeStartElement('book', {
      attributes: {
        id: `book-${bookId}`,
        category: 'reference'
      }
    });

    await writer.writeStartElement('title');
    await writer.writeCharacters(`Writer Core Title ${bookId}`);
    await writer.writeEndElement();

    await writer.writeStartElement('author');
    await writer.writeCharacters(`Author ${bookId}`);
    await writer.writeEndElement();

    await writer.writeStartElement('summary');
    await writer.writeCharacters('Compact direct writer workload for hot-path benchmarking.');
    await writer.writeEndElement();

    await writer.writeEndElement();
  }

  await writer.writeEndElement();
  await writer.writeEndDocument();
  return getBytesWritten();
}

if (shouldPrintHumanReadableBanner(cli)) {
  console.log('📊 XML Writer Core Benchmark - direct writer method workload');
}

barplot(() => {
  summary(() => {
    bench('sync writer core (pretty, 250 books)', () => writeSyncCatalog(250, true)).gc('inner');
    bench('async writer core (pretty, 250 books)', async () => writeAsyncCatalog(250, true)).gc('inner');
    bench('sync writer core (compact, 5000 books)', () => writeSyncCatalog(5000, false)).gc('inner');
    bench('async writer core (compact, 5000 books)', async () => writeAsyncCatalog(5000, false)).gc('inner');
  });
});

await runMitataWithCli(cli);
