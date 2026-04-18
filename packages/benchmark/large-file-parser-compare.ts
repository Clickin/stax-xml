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

// BatchAsync StAX XML Parser 테스트
async function testBatchAsyncStaxParser(stream: ReadableStream<Uint8Array>): Promise<number> {
  let eventsProcessed = 0;

  const parser = new StaxXmlParser(stream);

  // 이벤트 처리
  for await (const events of parser.batchedIterator()) {
    for (const event of events) {
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
      // 500MB 스트림 테스트
      bench('async stax parser (500MB)', async () => {
        const stream = createLargeXMLStream({ sizeGB: 0.5, verbose: verboseStreams });
        const events = await testAsyncStaxParser(stream);
        return events;
      }).gc('inner');

      bench('batch async stax parser (500MB)', async () => {
        const stream = createLargeXMLStream({ sizeGB: 0.5, verbose: verboseStreams });
        const events = await testBatchAsyncStaxParser(stream);
        return events;
      }).gc('inner');

      bench('sync stax parser (500MB)', async () => {
        const stream = createLargeXMLStream({ sizeGB: 0.5, verbose: verboseStreams });
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
        return testSyncStaxParser(content);
      }).gc('inner');

      bench('fast-xml-parser (500MB)', async () => {
        const { XMLParser } = await import('fast-xml-parser');
        const stream = createLargeXMLStream({ sizeGB: 0.5, verbose: verboseStreams });
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
        const parser = new XMLParser();
        parser.parse(content);
        return 0; // 이벤트 수 반환 불가
      }).gc('inner');

      bench('txml (500MB)', async () => {
        //@ts-ignore
        const txml = await import('txml');
        const stream = createLargeXMLStream({ sizeGB: 0.5, verbose: verboseStreams });
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
        txml.parse(content);
        return 0; // 이벤트 수 반환 불가
      }).gc('inner');

      bench('xml2js (500MB)', async () => {
        const xml2js = await import('xml2js');
        const stream = createLargeXMLStream({ sizeGB: 0.5, verbose: verboseStreams });
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
        await new Promise((resolve, reject) => {
          xml2js.parseString(content, function (err: Error | null) {
            if (err) {
              reject(err);
            } else {
              resolve(undefined);
            }
          });
        });
        return 0; // 이벤트 수 반환 불가
      }).gc('inner');
    });
  });

  await runMitataWithCli(cli);

  if (shouldPrintHumanReadableBanner(cli)) {
    console.log('\n✅ Benchmark completed!');
    console.log('📝 Note: Streams are generated on-the-fly without disk I/O');
    console.log('📝 Note: All parsers compared with 500MB stream data');
    console.log('🚀 Demonstrates the streaming capability of async parser vs DOM-based parsers');
  }
}

// 메인 실행
main().catch(console.error);
