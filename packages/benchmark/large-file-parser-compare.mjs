import { barplot, bench, summary } from 'mitata';
import { EventReader, EventReaderSync, XmlEventType } from 'stax-xml';
import { parseMitataCliArgs, runMitataWithCli, shouldPrintHumanReadableBanner } from './common/mitata-cli.mjs';
import { createLargeXMLStream } from './common/large-file-generator.mjs';

const cli = parseMitataCliArgs();
const verboseStreams = shouldPrintHumanReadableBanner(cli);

async function testAsyncStaxParser(stream) {
  let eventsProcessed = 0;
  const parser = new EventReader(stream);

  for await (const event of parser) {
    eventsProcessed++;
    switch (event.type) {
      case XmlEventType.START_DOCUMENT:
      case XmlEventType.END_DOCUMENT:
      case XmlEventType.START_ELEMENT:
      case XmlEventType.CHARACTERS:
      case XmlEventType.CDATA:
      case XmlEventType.END_ELEMENT:
        break;
      case XmlEventType.ERROR:
        throw event.error;
    }

    if (eventsProcessed % 10000 === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  return eventsProcessed;
}

async function testBatchAsyncStaxParser(stream) {
  let eventsProcessed = 0;
  const parser = new EventReader(stream);

  for await (const events of parser.batchedIterator()) {
    for (const event of events) {
      eventsProcessed++;
      switch (event.type) {
        case XmlEventType.START_DOCUMENT:
        case XmlEventType.END_DOCUMENT:
        case XmlEventType.START_ELEMENT:
        case XmlEventType.CHARACTERS:
        case XmlEventType.CDATA:
        case XmlEventType.END_ELEMENT:
          break;
        case XmlEventType.ERROR:
          throw event.error;
      }
      if (eventsProcessed % 10000 === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
  }

  return eventsProcessed;
}

function testSyncStaxParser(xmlContent) {
  let eventsProcessed = 0;
  const parser = new EventReaderSync(xmlContent);
  for (const event of parser) {
    eventsProcessed++;
    if (event.type === XmlEventType.ERROR) {
      throw event.error;
    }
  }
  return eventsProcessed;
}

async function consumeIntoString(stream) {
  const reader = stream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(combined);
}

async function parseDomParser(kind) {
  const stream = createLargeXMLStream({ sizeGB: 0.5, verbose: verboseStreams });
  const content = await consumeIntoString(stream);
  if (kind === 'fxp') {
    const { XMLParser } = await import('fast-xml-parser');
    new XMLParser().parse(content);
    return 0;
  }
  if (kind === 'txml') {
    const txml = await import('txml');
    txml.parse(content);
    return 0;
  }
  const xml2js = await import('xml2js');
  await new Promise((resolve, reject) => {
    xml2js.parseString(content, (err) => (err ? reject(err) : resolve(undefined)));
  });
  return 0;
}

if (shouldPrintHumanReadableBanner(cli)) {
  console.log('🚀 Async XML Parser Benchmark - Performance Test with mitata');
  console.log('============================================================');
  console.log('\n📊 Running mitata benchmarks...');
}

barplot(() => {
  summary(() => {
    bench('async stax parser (500MB)', async () => testAsyncStaxParser(createLargeXMLStream({ sizeGB: 0.5, verbose: verboseStreams }))).gc('inner');
    bench('batch async stax parser (500MB)', async () => testBatchAsyncStaxParser(createLargeXMLStream({ sizeGB: 0.5, verbose: verboseStreams }))).gc('inner');
    bench('sync stax parser (500MB)', async () => testSyncStaxParser(await consumeIntoString(createLargeXMLStream({ sizeGB: 0.5, verbose: verboseStreams })))).gc('inner');
    bench('fast-xml-parser (500MB)', async () => parseDomParser('fxp')).gc('inner');
    bench('txml (500MB)', async () => parseDomParser('txml')).gc('inner');
    bench('xml2js (500MB)', async () => parseDomParser('xml2js')).gc('inner');
  });
});

await runMitataWithCli(cli);

if (shouldPrintHumanReadableBanner(cli)) {
  console.log('\n✅ Benchmark completed!');
  console.log('📝 Note: Streams are generated on-the-fly without disk I/O');
  console.log('📝 Note: All parsers compared with 500MB stream data');
}
