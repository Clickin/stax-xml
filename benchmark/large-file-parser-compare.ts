import { createReadStream } from 'fs';
import { barplot, bench, run, summary } from 'mitata';
import { Readable } from 'stream';
import { StaxXmlParser, StaxXmlParserSync, XmlEventType } from '../dist/index.js';
import { cleanupTempFiles, generateLargeXML, type LargeFileConfig } from './common/large-file-generator.js';


// Node.js 스트림을 ReadableStream<Uint8Array>로 변환하는 헬퍼 함수
function nodeStreamToReadableStream(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });

      nodeStream.on('end', () => {
        controller.close();
      });

      nodeStream.on('error', (error) => {
        controller.error(error);
      });
    }
  });
}

// Async StAX XML Parser 테스트
async function testAsyncStaxParser(filePath: string): Promise<number> {
  let eventsProcessed = 0;

  const fileStream = createReadStream(filePath);
  const readableStream = nodeStreamToReadableStream(fileStream);
  const parser = new StaxXmlParser(readableStream);

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
async function testBatchAsyncStaxParser(filePath: string): Promise<number> {
  let eventsProcessed = 0;

  const fileStream = createReadStream(filePath);
  const readableStream = nodeStreamToReadableStream(fileStream);
  const parser = new StaxXmlParser(readableStream);

  // 이벤트 처리
  for await (const events of parser.batchedIterator(100)) {
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
  console.log('🚀 Async XML Parser Benchmark - Performance Test with mitata');
  console.log('============================================================');

  // 테스트 파일들 준비
  console.log('\n🔧 Preparing test files...');

  // 1MB, 10MB, 100MB, 1GB 파일 생성
  const configs: Array<{ size: number, name: string }> = [
    { size: 0.5, name: '500MB' },   // 500MB
  ];

  const testFiles: Array<{ path: string, name: string }> = [];
  const filePaths: string[] = []; // 정리용 파일 경로 목록

  for (const config of configs) {
    const fileConfig: LargeFileConfig = {
      sizeGB: config.size,
      filename: `test-${config.name}.xml`
    };
    const filePath = await generateLargeXML(fileConfig);
    filePaths.push(filePath); // 정리 목록에 추가

    testFiles.push({
      path: filePath,
      name: config.name
    });
  }

  console.log('\n📊 Running mitata benchmarks...');

  // mitata 벤치마크 실행
  barplot(() => {
    summary(() => {

      const file500MB = testFiles.find(f => f.name === '500MB')!;
      bench('async stax parser (500MB)', async () => {
        const events = await testAsyncStaxParser(file500MB.path);
        return events;
      }).gc('inner');
      bench('batch async stax parser (500MB)', async () => {
        const events = await testBatchAsyncStaxParser(file500MB.path);
        return events;
      }).gc('inner');
      /*
      bench('sync stax parser (500MB)', async () => {
        const fs = await import('fs/promises');
        const content = await fs.readFile(file500MB.path, 'utf8');
        return testSyncStaxParser(content);
      }).gc('inner');
      // 1GB sync 버전은 invalid string length 에러 발생
      bench('fast-xml-parser (500MB)', async () => {
        const { XMLParser } = await import('fast-xml-parser');
        const fs = await import('fs/promises');
        const content = await fs.readFile(file500MB.path, 'utf8');
        const parser = new XMLParser();
        parser.parse(content);
        return 0; // 이벤트 수 반환 불가
      }).gc('inner');
      bench('txml (500MB)', async () => {
        //@ts-ignore
        const txml = await import('txml');
        const fs = await import('fs/promises');
        const content = await fs.readFile(file500MB.path, 'utf8');
        txml.parse(content);
        return 0; // 이벤트 수 반환 불가
      }).gc('inner');
      bench('xml2js (500MB)', async () => {
        const xml2js = await import('xml2js');
        const fs = await import('fs/promises');
        const content = await fs.readFile(file500MB.path, 'utf8');
        xml2js.parseString(content, function (err) {
          if (err) {
            throw err;
          }
        });
        return 0; // 이벤트 수 반환 불가
      }).gc('inner');
      */
    });
  });

  await run();

  console.log('\n✅ Benchmark completed!');
  console.log('📝 Note: All benchmarks now include file reading time for fair comparison');
  console.log('📝 Note: Sync parser tested up to 100MB due to memory limitations');
  console.log('🚀 1GB file test demonstrates the streaming capability of async parser');

  // 임시 파일 정리
  console.log('\n🗑️ Cleaning up temporary files...');
  await cleanupTempFiles(filePaths);
  console.log('✅ Cleanup completed!');
}

// 메인 실행
main().catch(console.error);