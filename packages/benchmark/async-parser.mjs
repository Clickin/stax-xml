import { barplot, bench, summary } from 'mitata';
import { EventReader, EventReaderSync, XmlEventType } from 'stax-xml';
import { parseMitataCliArgs, runMitataWithCli, shouldPrintHumanReadableBanner } from './common/mitata-cli.mjs';
import { createLargeXMLStream } from './common/large-file-generator.mjs';

const cli = parseMitataCliArgs();
const verboseStreams = shouldPrintHumanReadableBanner(cli);

async function consumeAsync(stream) {
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

async function consumeSync(stream) {
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

  const content = new TextDecoder().decode(combined);
  let eventsProcessed = 0;
  for (const event of new EventReaderSync(content)) {
    eventsProcessed++;
    if (event.type === XmlEventType.ERROR) {
      throw event.error;
    }
  }
  return eventsProcessed;
}

if (shouldPrintHumanReadableBanner(cli)) {
  console.log('🚀 Async XML Parser Benchmark - Performance Test with mitata');
  console.log('============================================================');
  console.log('\n📊 Running mitata benchmarks...');
}

barplot(() => {
  summary(() => {
    bench('async parser (1MB)', async () => consumeAsync(createLargeXMLStream({ sizeGB: 0.001, verbose: verboseStreams }))).gc('inner');
    bench('sync parser (1MB)', async () => consumeSync(createLargeXMLStream({ sizeGB: 0.001, verbose: verboseStreams }))).gc('inner');
    bench('async parser (10MB)', async () => consumeAsync(createLargeXMLStream({ sizeGB: 0.01, verbose: verboseStreams }))).gc('inner');
    bench('sync parser (10MB)', async () => consumeSync(createLargeXMLStream({ sizeGB: 0.01, verbose: verboseStreams }))).gc('inner');
    bench('async parser (100MB)', async () => consumeAsync(createLargeXMLStream({ sizeGB: 0.1, verbose: verboseStreams }))).gc('inner');
    bench('sync parser (100MB)', async () => consumeSync(createLargeXMLStream({ sizeGB: 0.1, verbose: verboseStreams }))).gc('inner');
    bench('async parser (1GB)', async () => consumeAsync(createLargeXMLStream({ sizeGB: 1.0, verbose: verboseStreams }))).gc('inner');
  });
});

await runMitataWithCli(cli);

if (shouldPrintHumanReadableBanner(cli)) {
  console.log('\n✅ Benchmark completed!');
  console.log('📝 Note: Streams are generated on-the-fly without disk I/O');
  console.log('📝 Note: Sync parser tested up to 100MB due to memory limitations');
  console.log('🚀 1GB stream test demonstrates the streaming capability of async parser');
}
