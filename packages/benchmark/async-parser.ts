import { barplot, bench, summary } from 'mitata';
import { StaxXmlParser, StaxXmlParserSync, XmlEventType } from 'stax-xml';
import { parseMitataCliArgs, runMitataWithCli, shouldPrintHumanReadableBanner } from './common/mitata-cli.js';
import { createLargeXMLStream, type LargeStreamConfig } from './common/large-file-generator.js';

const cli = parseMitataCliArgs();
const verboseStreams = shouldPrintHumanReadableBanner(cli);

// Async StAX XML Parser 테스트
async function testAsyncStaxParser(stream: ReadableStream<Uint8Array>): Promise<number> {
  let eventsProcessed = 0;

  const parser = new StaxXmlParser(stream);

  // 이벤트 처리
  for await (const event of parser) {
    eventsProcessed++;

    switch (event.type) {
      case XmlEventType.START_DOCUMENT:
      case XmlEventType.END_DOCUMENT:
        break;
      case XmlEventType.START_ELEMENT:
      case XmlEventType.CHARACTERS:
      case XmlEventType.CDATA:
      case XmlEventType.END_ELEMENT:
        // 실제 사용 케이스를 시뮬레이션 - 메모리에 모든 이벤트를 저장하지 않음
        break;
      case XmlEventType.ERROR:
        throw event.error;
    }

    // 주기적으로 가비지 컬렉션이 일어날 수 있도록 yield
    if (eventsProcessed % 10000 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  return eventsProcessed;
}


// Async StAX XML Parser 테스트 (batched)
async function testAsyncStaxParserBatch(stream: ReadableStream<Uint8Array>): Promise<number> {
  let eventsProcessed = 0;

  const parser = new StaxXmlParser(stream);

  // 이벤트 처리
  for await (const events of parser.batchedIterator()) {
    for await (const event of events) {
      eventsProcessed++;

      switch (event.type) {
        case XmlEventType.START_DOCUMENT:
        case XmlEventType.END_DOCUMENT:
          break;
        case XmlEventType.START_ELEMENT:
        case XmlEventType.CHARACTERS:
        case XmlEventType.CDATA:
        case XmlEventType.END_ELEMENT:
          // 실제 사용 케이스를 시뮬레이션 - 메모리에 모든 이벤트를 저장하지 않음
          break;
        case XmlEventType.ERROR:
          throw event.error;
      }

      // 주기적으로 가비지 컬렉션이 일어날 수 있도록 yield
      if (eventsProcessed % 10000 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
  }

  return eventsProcessed;
}

// Sync StAX XML Parser 테스트 (비교용)
function testSyncStaxParser(xmlContent: string): number {
  let eventsProcessed = 0;

  const parser = new StaxXmlParserSync(xmlContent);

  for (const event of parser) {
    eventsProcessed++;

    switch (event.type) {
      case XmlEventType.START_DOCUMENT:
      case XmlEventType.END_DOCUMENT:
        break;
      case XmlEventType.START_ELEMENT:
      case XmlEventType.CHARACTERS:
      case XmlEventType.CDATA:
      case XmlEventType.END_ELEMENT:
        // 실제 사용 케이스를 시뮬레이션
        break;
      case XmlEventType.ERROR:
        throw event.error;
    }
  }

  return eventsProcessed;
}

async function main() {
  if (shouldPrintHumanReadableBanner(cli)) {
    console.log('🚀 Async XML Parser Benchmark - Performance Test with mitata');
    console.log('============================================================');
    console.log('\n📊 Running mitata benchmarks...');
  }

  // mitata 벤치마크 실행
  barplot(() => {
    summary(() => {
      // 1MB 스트림 테스트
      bench('async parser (1MB)', async () => {
        const stream = createLargeXMLStream({ sizeGB: 0.001, verbose: verboseStreams });
        const events = await testAsyncStaxParser(stream);
        return events;
      }).gc('inner');

      bench('sync parser (1MB)', async () => {
        // For sync parser, we need to collect all data first
        const stream = createLargeXMLStream({ sizeGB: 0.001, verbose: verboseStreams });
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];

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
        const events = testSyncStaxParser(content);
        return events;
      }).gc('inner');

      // 10MB 스트림 테스트
      bench('async parser (10MB)', async () => {
        const stream = createLargeXMLStream({ sizeGB: 0.01, verbose: verboseStreams });
        const events = await testAsyncStaxParser(stream);
        return events;
      }).gc('inner');

      bench('sync parser (10MB)', async () => {
        const stream = createLargeXMLStream({ sizeGB: 0.01, verbose: verboseStreams });
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];

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
        const events = testSyncStaxParser(content);
        return events;
      }).gc('inner');

      // 100MB 스트림 테스트
      bench('async parser (100MB)', async () => {
        const stream = createLargeXMLStream({ sizeGB: 0.1, verbose: verboseStreams });
        const events = await testAsyncStaxParser(stream);
        return events;
      }).gc('inner');

      bench('sync parser (100MB)', async () => {
        const stream = createLargeXMLStream({ sizeGB: 0.1, verbose: verboseStreams });
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];

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
        const events = testSyncStaxParser(content);
        return events;
      }).gc('inner');

      // 1GB 스트림 테스트 (async만 - sync는 메모리 한계로 제외)
      // javascript max string length가 2^53 - 1(약 900MB) 이므로 1GB xml을 string으로 읽을 수 없음
      bench('async parser (1GB)', async () => {
        const stream = createLargeXMLStream({ sizeGB: 1.0, verbose: verboseStreams });
        const events = await testAsyncStaxParser(stream);
        return events;
      }).gc('inner');
    });
  });

  await runMitataWithCli(cli);

  if (shouldPrintHumanReadableBanner(cli)) {
    console.log('\n✅ Benchmark completed!');
    console.log('📝 Note: Streams are generated on-the-fly without disk I/O');
    console.log('📝 Note: Sync parser tested up to 100MB due to memory limitations');
    console.log('🚀 1GB stream test demonstrates the streaming capability of async parser');
  }
}

// 메인 실행
main().catch(console.error);
