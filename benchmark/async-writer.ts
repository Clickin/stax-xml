import { createWriteStream } from 'fs';
import { Writable } from 'stream';
import { barplot, bench, run, summary } from 'mitata';
import { tmpdir } from 'os';
import { join } from 'path';
import { StaxXmlWriter, StaxXmlWriterSync } from '../dist/index.js';
import { formatMemoryUsage, getMemoryUsage, measurePerformance, type MemoryUsage } from './common/utils.js';

interface WriterBenchmarkResult {
  duration: number;
  memoryBefore: MemoryUsage;
  memoryAfter: MemoryUsage;
  memoryPeak: MemoryUsage;
  elementsWritten: number;
  fileSizeBytes: number;
}

// Node.js Writable을 Web WritableStream으로 변환
function nodeStreamToWritableStream(nodeStream: Writable): WritableStream<Uint8Array> {
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
        nodeStream.end((error: any) => {
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

// 대용량 노드 생성 및 Async Writer 테스트
async function testAsyncStaxWriter(outputPath: string, numElements: number): Promise<WriterBenchmarkResult> {
  const memoryBefore = getMemoryUsage();
  let memoryPeak = memoryBefore;
  let elementsWritten = 0;

  const fileStream = createWriteStream(outputPath);
  const writableStream = nodeStreamToWritableStream(fileStream);
  const writer = new StaxXmlWriter(writableStream, {
    prettyPrint: true,
    indentString: '  ',
    bufferSize: 64 * 1024, // 64KB buffer
    enableAutoFlush: true,
  });

  const startTime = performance.now();

  // 메모리 모니터링을 위한 인터벌
  const memoryMonitor = setInterval(() => {
    const current = getMemoryUsage();
    if (current.heapUsed > memoryPeak.heapUsed) {
      memoryPeak = current;
    }
  }, 100);

  try {
    await writer.writeStartDocument();

    await writer.writeStartElement('books');

    for (let i = 0; i < numElements; i++) {
      const bookId = i + 1;
      const isbn = `978${Math.floor(Math.random() * 900000000) + 100000000}`;
      const year = 2020 + (i % 5);
      const month = (i % 12) + 1;
      const day = (i % 28) + 1;

      await writer.writeStartElement('book', {
        attributes: { id: `book-${bookId}` }
      });

      await writer.writeStartElement('title');
      await writer.writeCharacters(`Sample Book Title Number ${bookId} - Lorem ipsum dolor sit amet, consectetur adipiscing elit`);
      await writer.writeEndElement(); // title

      await writer.writeStartElement('author');
      await writer.writeCharacters(`Author Name ${bookId}`);
      await writer.writeEndElement(); // author

      await writer.writeStartElement('isbn');
      await writer.writeCharacters(isbn);
      await writer.writeEndElement(); // isbn

      await writer.writeStartElement('publisher');
      await writer.writeCharacters(`Sample Publisher ${bookId}`);
      await writer.writeEndElement(); // publisher

      await writer.writeStartElement('publishDate');
      await writer.writeCharacters(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
      await writer.writeEndElement(); // publishDate

      await writer.writeStartElement('description');
      await writer.writeCharacters(
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
        'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ' +
        'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.'
      );
      await writer.writeEndElement(); // description

      await writer.writeStartElement('chapters');

      for (let j = 1; j <= 3; j++) {
        await writer.writeStartElement('chapter', {
          attributes: { number: j.toString() }
        });
        await writer.writeCharacters(`${j === 1 ? 'Introduction' : j === 2 ? 'Main Content' : 'Conclusion'} Chapter for Book ${bookId}`);
        await writer.writeEndElement(); // chapter
      }

      await writer.writeEndElement(); // chapters
      await writer.writeEndElement(); // book

      elementsWritten++;

      // 주기적으로 메모리 체크 및 yield
      if (elementsWritten % 1000 === 0) {
        await new Promise(resolve => setImmediate(resolve));

        const current = getMemoryUsage();
        if (current.heapUsed > memoryPeak.heapUsed) {
          memoryPeak = current;
        }
      }
    }

    await writer.writeEndElement(); // books
    await writer.writeEndDocument();
    await writer.flush();

  } finally {
    clearInterval(memoryMonitor);
  }

  const duration = performance.now() - startTime;
  const memoryAfter = getMemoryUsage();

  // 파일 크기 확인
  const fs = await import('fs/promises');
  const stats = await fs.stat(outputPath);

  return {
    duration,
    memoryBefore,
    memoryAfter,
    memoryPeak,
    elementsWritten,
    fileSizeBytes: stats.size
  };
}

// Sync Writer 테스트 (비교용)
async function testSyncStaxWriter(outputPath: string, numElements: number): Promise<WriterBenchmarkResult> {
  const memoryBefore = getMemoryUsage();
  let memoryPeak = memoryBefore;
  let elementsWritten = 0;

  const { result, duration } = measurePerformance(() => {
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

      writer.writeStartElement('book', {
        attributes: { id: `book-${bookId}` }
      });

      writer.writeStartElement('title');
      writer.writeCharacters(`Sample Book Title Number ${bookId} - Lorem ipsum dolor sit amet, consectetur adipiscing elit`);
      writer.writeEndElement(); // title

      writer.writeStartElement('author');
      writer.writeCharacters(`Author Name ${bookId}`);
      writer.writeEndElement(); // author

      writer.writeStartElement('isbn');
      writer.writeCharacters(isbn);
      writer.writeEndElement(); // isbn

      writer.writeStartElement('publisher');
      writer.writeCharacters(`Sample Publisher ${bookId}`);
      writer.writeEndElement(); // publisher

      writer.writeStartElement('publishDate');
      writer.writeCharacters(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
      writer.writeEndElement(); // publishDate

      writer.writeStartElement('description');
      writer.writeCharacters(
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
        'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ' +
        'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.'
      );
      writer.writeEndElement(); // description

      writer.writeStartElement('chapters');

      for (let j = 1; j <= 3; j++) {
        writer.writeStartElement('chapter', {
          attributes: { number: j.toString() }
        });
        writer.writeCharacters(`${j === 1 ? 'Introduction' : j === 2 ? 'Main Content' : 'Conclusion'} Chapter for Book ${bookId}`);
        writer.writeEndElement(); // chapter
      }

      writer.writeEndElement(); // chapters
      writer.writeEndElement(); // book

      elementsWritten++;

      // 메모리 모니터링
      if (elementsWritten % 1000 === 0) {
        const current = getMemoryUsage();
        if (current.heapUsed > memoryPeak.heapUsed) {
          memoryPeak = current;
        }
      }
    }

    writer.writeEndElement(); // books
    writer.writeEndDocument();

    return writer.getXmlString();
  });

  const memoryAfter = getMemoryUsage();

  // 파일에 결과 쓰기
  const fs = await import('fs/promises');
  await fs.writeFile(outputPath, result, 'utf8');
  const stats = await fs.stat(outputPath);

  return {
    duration,
    memoryBefore,
    memoryAfter,
    memoryPeak,
    elementsWritten,
    fileSizeBytes: stats.size
  };
}

function printWriterBenchmarkResult(name: string, result: WriterBenchmarkResult): void {
  console.log(`\n📊 ${name} Results:`);
  console.log(`   ⏱️  Duration: ${result.duration.toFixed(2)}ms`);
  console.log(`   📝 Elements written: ${result.elementsWritten.toLocaleString()}`);
  console.log(`   📊 Throughput: ${(result.elementsWritten / (result.duration / 1000)).toFixed(0)} elements/sec`);
  console.log(`   📄 File size: ${(result.fileSizeBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   🧠 Memory before: ${formatMemoryUsage(result.memoryBefore)}`);
  console.log(`   🧠 Memory peak:   ${formatMemoryUsage(result.memoryPeak)}`);
  console.log(`   🧠 Memory after:  ${formatMemoryUsage(result.memoryAfter)}`);
  console.log(`   📈 Memory delta:  ${((result.memoryAfter.heapUsed - result.memoryBefore.heapUsed) / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   📈 Peak increase: ${((result.memoryPeak.heapUsed - result.memoryBefore.heapUsed) / 1024 / 1024).toFixed(2)} MB`);
}

async function main() {
  console.log('🚀 Async XML Writer Benchmark - Large File Generation Test');
  console.log('===========================================================');

  const tempDir = tmpdir();

  // 1GB 대상 파일 생성을 위한 엘리먼트 수 계산
  // 각 book 엘리먼트는 대략 1KB 정도
  const elementsFor1GB = 1000000; // 1M elements ≈ 1GB
  const elementsFor100MB = 100000; // 100K elements ≈ 100MB

  console.log('\n📊 Starting benchmark tests...');

  // Async Writer 테스트 (1GB)
  const asyncOutputPath = join(tempDir, 'async-output-1gb.xml');
  console.log('\n🔄 Testing Async StAX Writer (1GB target)...');
  console.log(`📁 Output file: ${asyncOutputPath}`);

  const asyncResult = await testAsyncStaxWriter(asyncOutputPath, elementsFor1GB);
  printWriterBenchmarkResult('Async StAX Writer', asyncResult);

  // Sync Writer 테스트 (100MB - 메모리 제한)
  const syncOutputPath = join(tempDir, 'sync-output-100mb.xml');
  console.log('\n🔄 Testing Sync StAX Writer (100MB - memory limited)...');
  console.log(`📁 Output file: ${syncOutputPath}`);
  console.log('⚠️  Note: Sync writer builds entire XML in memory before writing');

  const syncResult = await testSyncStaxWriter(syncOutputPath, elementsFor100MB);
  printWriterBenchmarkResult('Sync StAX Writer (100MB)', syncResult);

  console.log('\n📈 Performance Comparison:');
  console.log('==========================');

  const memoryEfficiencyRatio = (syncResult.memoryPeak.heapUsed - syncResult.memoryBefore.heapUsed) /
    (asyncResult.memoryPeak.heapUsed - asyncResult.memoryBefore.heapUsed);

  console.log(`📊 Async writer generated: ${(asyncResult.fileSizeBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📊 Sync writer generated: ${(syncResult.fileSizeBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📊 Memory efficiency (Sync vs Async): ${memoryEfficiencyRatio.toFixed(2)}x more memory used by Sync`);

  const throughputRatio = (asyncResult.elementsWritten / (asyncResult.duration / 1000)) /
    (syncResult.elementsWritten / (syncResult.duration / 1000));

  console.log(`📊 Throughput comparison (Async vs Sync): ${throughputRatio.toFixed(2)}x`);

  if (asyncResult.memoryPeak.heapUsed < syncResult.memoryPeak.heapUsed) {
    console.log('✅ Async writer uses less memory while generating larger files!');
  }

  console.log('\n🔧 Running mitata micro-benchmarks (smaller datasets)...');

  // 작은 데이터셋으로 mitata 벤치마크 실행
  const smallElements = 10000; // 10K elements ≈ 10MB
  const microAsyncPath = join(tempDir, 'micro-async.xml');
  const microSyncPath = join(tempDir, 'micro-sync.xml');

  barplot(() => {
    summary(() => {
      bench('async stax-xml writer (10K elements)', async () => {
        await testAsyncStaxWriter(microAsyncPath, smallElements);
      }).gc('inner');

      bench('sync stax-xml writer (10K elements)', async () => {
        await testSyncStaxWriter(microSyncPath, smallElements);
      }).gc('inner');
    });
  });

  await run();

  console.log('\n📁 Generated files:');
  console.log(`   📄 Async (1GB): ${asyncOutputPath}`);
  console.log(`   📄 Sync (100MB): ${syncOutputPath}`);
  console.log('\n💡 Tip: You can inspect these files to verify the output quality');
}

// 메인 실행
main().catch(console.error);