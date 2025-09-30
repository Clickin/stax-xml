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


// Async StAX XML Parser 테스트
async function testAsyncStaxParserBatch(filePath: string): Promise<number> {
  let eventsProcessed = 0;

  const fileStream = createReadStream(filePath);
  const readableStream = nodeStreamToReadableStream(fileStream);
  const parser = new StaxXmlParser(readableStream);

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
  console.log('🚀 Async XML Parser Benchmark - Performance Test with mitata');
  console.log('============================================================');

  // 테스트 파일들 준비
  console.log('\n🔧 Preparing test files...');

  // 1MB, 10MB, 100MB, 1GB 파일 생성
  const configs: Array<{ size: number, name: string }> = [
    { size: 0.001, name: '1mb' },    // 1MB
    { size: 0.01, name: '10mb' },    // 10MB
    { size: 0.1, name: '100mb' },    // 100MB
    { size: 0.8, name: '800mb' },   // 800MB
    { size: 1.0, name: '1gb' }       // 1GB
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
      // 1MB 파일 테스트
      const file1mb = testFiles.find(f => f.name === '1mb')!;
      bench('async parser (1MB)', async () => {
        const events = await testAsyncStaxParser(file1mb.path);
        return events;
      }).gc('inner');

      bench('sync parser (1MB)', async () => {
        const fs = await import('fs/promises');
        const content = await fs.readFile(file1mb.path, 'utf8');
        const events = testSyncStaxParser(content);
        return events;
      }).gc('inner');

      // 10MB 파일 테스트
      const file10mb = testFiles.find(f => f.name === '10mb')!;
      bench('async parser (10MB)', async () => {
        const events = await testAsyncStaxParser(file10mb.path);
        return events;
      }).gc('inner');

      bench('sync parser (10MB)', async () => {
        const fs = await import('fs/promises');
        const content = await fs.readFile(file10mb.path, 'utf8');
        const events = testSyncStaxParser(content);
        return events;
      }).gc('inner');

      // 100MB 파일 테스트
      const file100mb = testFiles.find(f => f.name === '100mb')!;
      bench('async parser (100MB)', async () => {
        const events = await testAsyncStaxParser(file100mb.path);
        return events;
      }).gc('inner');

      bench('sync parser (100MB)', async () => {
        const fs = await import('fs/promises');
        const content = await fs.readFile(file100mb.path, 'utf8');
        const events = testSyncStaxParser(content);
        return events;
      }).gc('inner');
      const file1gb = testFiles.find(f => f.name === '1gb')!;
      // 1GB 파일 테스트 (async만 - sync는 메모리 한계로 제외)
      // javascript max string length가 2^53 - 1(약 900MB) 이므로 1GB xml을 string으로 읽을 수 없음
      bench('async parser (1GB)', async () => {
        const events = await testAsyncStaxParser(file1gb.path);
        return events;
      }).gc('inner');
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