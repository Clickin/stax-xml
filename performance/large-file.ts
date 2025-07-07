import { createReadStream } from 'fs';
import { dirname } from 'path';
import StaxXmlParser from '../src/StaxXmlParser';
import { StaxXmlParserSync } from '../src/StaxXmlParserSync'; // Add this import
import { XmlEventType } from '../src/types';

// 어설션 헬퍼 함수
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// 테스트 섹션 헬퍼 함수
function section(title: string, fn: () => Promise<void> | void): Promise<void> {
  console.log(`\n📋 ${title}`);
  console.log('='.repeat(50));
  return Promise.resolve(fn());
}

// 개별 테스트 헬퍼 함수  
function test(name: string, fn: () => Promise<void> | void, timeout?: number): Promise<void> {
  console.log(`\n🔍 ${name}`);
  const startTime = Date.now();

  return Promise.resolve(fn()).then(() => {
    const elapsed = Date.now() - startTime;
    console.log(`✅ 완료 (${elapsed}ms)`);
  }).catch((error) => {
    const elapsed = Date.now() - startTime;
    console.error(`❌ 실패 (${elapsed}ms): ${error.message}`);
    throw error;
  });
}

// Node.js ReadableStream을 Web Streams API ReadableStream으로 변환
function nodeStreamToWebStream(nodeStream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
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
    },

    cancel() {
      if ('destroy' in nodeStream && typeof nodeStream.destroy === 'function') {
        nodeStream.destroy();
      }
    }
  });
}


// 메인 성능 테스트 함수들
async function parseTreebankWithMemoryMonitoring() {
  const { heapStats } = await import('bun:jsc');

  // fs.createReadStream 사용 (Safari 엔진의 file.stream() 메모리 문제 및 HTTP 서버 부하 해결
  const cwd = dirname(".");
  const filePath = `${cwd}/performance/samples/treebank_e.xml`;

  console.log(`\n🌳 treebank_e.xml Performance Test (fs.createReadStream)`);
  console.log(`📁 File path: ${filePath}`);

  // 파일 크기 확인
  const file = Bun.file(filePath);
  const fileSize = file.size;
  console.log(`📁 File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

  // 초기 메모리 상태 측정
  Bun.gc(true); // 강제 가비지 컬렉션
  await new Promise(resolve => setTimeout(resolve, 100)); // GC 완료 대기
  const initialHeapStats = heapStats();
  console.log(`📊 Initial heap size: ${(initialHeapStats.heapSize / 1024 / 1024).toFixed(2)} MB`);

  // fs.createReadStream으로 파싱 시작
  const startTime = performance.now();
  const nodeStream = createReadStream(filePath);
  const inputStream = nodeStreamToWebStream(nodeStream);
  const reader = new StaxXmlParser(inputStream);

  let eventCount = 0;
  let entryCount = 0;
  let proteinCount = 0;
  let maxEventProcessingTime = 0;
  let totalTextLength = 0;
  let peakHeapSize = initialHeapStats.heapSize;

  // 중간 성능 측정을 위한 변수들
  let lastReportTime = startTime;
  const reportInterval = 15000; // 15초마다 리포트

  for await (const event of reader) {
    const eventStartTime = performance.now();
    eventCount++;

    if (event.type === XmlEventType.START_ELEMENT) {
      const elementName = (event as any).name;
      if (elementName === 'S') { // treebank_e.xml의 주요 구조 단위는 문장(S)
        entryCount++;
      } else if (elementName === 'NP' || elementName === 'VP') { // 명사구(NP), 동사구(VP) 등도 카운트
        proteinCount++;
      }
    } else if (event.type === XmlEventType.CHARACTERS) {
      totalTextLength += (event as any).value.length;
    }

    const eventEndTime = performance.now();
    const eventProcessingTime = eventEndTime - eventStartTime;
    maxEventProcessingTime = Math.max(maxEventProcessingTime, eventProcessingTime);

    // 주기적으로 진행 상황 및 메모리 사용량 보고
    if (eventEndTime - lastReportTime > reportInterval) {
      const currentHeapStats = heapStats();
      peakHeapSize = Math.max(peakHeapSize, currentHeapStats.heapSize);
      const currentTime = performance.now();
      const elapsedSeconds = (currentTime - startTime) / 1000;
      const eventsPerSecond = Math.round(eventCount / elapsedSeconds);

      console.log(`⏱️  ${elapsedSeconds.toFixed(1)}s: ${eventCount.toLocaleString()} events (${eventsPerSecond}/s), ${entryCount.toLocaleString()} sentences, heap: ${(currentHeapStats.heapSize / 1024 / 1024).toFixed(2)} MB`);
      lastReportTime = currentTime;
    }
  }

  const endTime = performance.now();
  const totalTime = endTime - startTime;

  // 최종 메모리 상태 측정
  const finalHeapStats = heapStats();

  // 성능 리포트 출력
  console.log(`\n🎯 Parsing Results:`);
  console.log(`⚡ Total parsing time: ${(totalTime / 1000).toFixed(2)} seconds`);
  console.log(`📈 Total events processed: ${eventCount.toLocaleString()}`);
  console.log(`📝 Sentences found: ${entryCount.toLocaleString()}`);
  console.log(`🌿 Phrases found: ${proteinCount.toLocaleString()}`);
  console.log(`📝 Total text content: ${(totalTextLength / 1024 / 1024).toFixed(2)} MB`);
  console.log(`⚡ Events per second: ${Math.round(eventCount / (totalTime / 1000)).toLocaleString()}`);
  console.log(`💾 Processing rate: ${((fileSize / 1024 / 1024) / (totalTime / 1000)).toFixed(2)} MB/s`);
  console.log(`⏱️  Max single event time: ${maxEventProcessingTime.toFixed(4)} ms`);

  console.log(`\n📊 Memory Usage:`);
  console.log(`🏁 Initial heap: ${(initialHeapStats.heapSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`🔚 Final heap: ${(finalHeapStats.heapSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📈 Peak heap: ${(peakHeapSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📈 Net heap growth: ${((finalHeapStats.heapSize - initialHeapStats.heapSize) / 1024 / 1024).toFixed(2)} MB`);
  console.log(`💱 Memory efficiency: ${((fileSize / peakHeapSize) * 100).toFixed(1)}% (file size vs peak heap)`);

  // 성능 어설션
  assert(eventCount > 0, 'eventCount should be greater than 0');
  assert(entryCount > 0, 'entryCount should be greater than 0');
  assert(totalTime < 300000, 'totalTime should be less than 300000ms (5 minutes)');

  // 메모리 효율성 테스트 - 피크 힙 크기가 파일 크기의 50배를 넘지 않아야 함
  const heapToFileRatio = peakHeapSize / fileSize;
  console.log(`📊 Heap to file ratio: ${heapToFileRatio.toFixed(2)}x`);
  assert(heapToFileRatio < 50, `heapToFileRatio should be less than 50, but was ${heapToFileRatio.toFixed(2)}`);

  console.log(`✅ Performance test completed successfully!`);
}

async function runTests() {
  await test('should handle treebank_e.xml performance test with memory monitoring', parseTreebankWithMemoryMonitoring, 600000);

  await test('should handle treebank_e.xml with chunked streaming', async () => {
    const { heapStats } = await import('bun:jsc');

    console.log(`\n🌊 treebank_e.xml Chunked Streaming Test (fs.createReadStream)`);

    // 초기 메모리 상태
    Bun.gc(true);
    const initialHeapStats = heapStats();

    // fs.createReadStream 방식 사용
    const cwd = dirname(".");
    const filePath = `${cwd}/performance/samples/treebank_e.xml`;
    console.log(`📁 Reading from: ${filePath}`);

    const startTime = performance.now();
    const nodeStream = createReadStream(filePath, {
      highWaterMark: 64 * 1024 // 64KB 청크 크기
    });
    const inputStream = nodeStreamToWebStream(nodeStream);
    const reader = new StaxXmlParser(inputStream);


    console.log(`📦 fs.createReadStream with 64KB chunks`);

    let eventCount = 0;
    let entryCount = 0;
    let memoryPeakSize = initialHeapStats.heapSize;

    // 스트리밍 처리
    for await (const event of reader) {
      eventCount++;

      if (event.type === XmlEventType.START_ELEMENT && (event as any).name === 'S') {
        entryCount++;

        // 1000개의 문장마다 메모리 사용량 체크
        if (entryCount % 1000 === 0) {
          const currentHeapStats = heapStats();
          memoryPeakSize = Math.max(memoryPeakSize, currentHeapStats.heapSize);

          const currentTime = performance.now();
          const elapsedSeconds = (currentTime - startTime) / 1000;
          console.log(`📊 Processed ${entryCount.toLocaleString()} sentences in ${elapsedSeconds.toFixed(1)}s, heap: ${(currentHeapStats.heapSize / 1024 / 1024).toFixed(2)} MB`);
        }
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    const finalHeapStats = heapStats();

    console.log(`\n🎯 Chunked Streaming Results:`);
    console.log(`⚡ Total time: ${(totalTime / 1000).toFixed(2)} seconds`);
    console.log(`📈 Events processed: ${eventCount.toLocaleString()}`);
    console.log(`🧪 Entries processed: ${entryCount.toLocaleString()}`);
    console.log(`💾 Peak memory usage: ${(memoryPeakSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📊 Final heap size: ${(finalHeapStats.heapSize / 1024 / 1024).toFixed(2)} MB`);

    // fs.createReadStream 메모리 효율성 계산
    const file = Bun.file(filePath);
    const fileSize = file.size;
    const memoryEfficiency = (fileSize / memoryPeakSize) * 100;
    console.log(`💱 Memory efficiency: ${memoryEfficiency.toFixed(1)}% (file size vs peak memory)`);

    assert(eventCount > 0, 'eventCount should be greater than 0');
    assert(entryCount > 0, 'entryCount should be greater than 0');
    assert(totalTime < 300000, 'totalTime should be less than 300000ms (5 minutes)');

    console.log(`✅ fs.createReadStream chunked streaming test completed!`);
  }, 600000);

  await test('should benchmark parsing speed comparison', async () => {
    console.log(`\n🏁 treebank_e.xml Speed Benchmark (fs.createReadStream)`);
    const cwd = dirname(".");
    const filePath = `${cwd}/performance/samples/treebank_e.xml`;

    // 파일 크기 확인
    const file = Bun.file(filePath);
    const fileSize = file.size;
    console.log(`📁 File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);


    // 3번 실행해서 평균 성능 측정
    const runs = 3;
    const results: Array<{
      time: number;
      events: number;
      entries: number;
      memoryUsed: number;
    }> = [];

    for (let run = 1; run <= runs; run++) {
      console.log(`\n🔄 Run ${run}/${runs}`);

      Bun.gc(true); // 각 실행 전 가비지 컬렉션
      const { heapStats } = await import('bun:jsc');
      const initialHeap = heapStats().heapSize;

      const startTime = performance.now();

      // fs.createReadStream으로 각 실행
      const nodeStream = createReadStream(filePath);
      const inputStream = nodeStreamToWebStream(nodeStream);
      const reader = new StaxXmlParser(inputStream);


      let eventCount = 0;
      let entryCount = 0;

      for await (const event of reader) {
        eventCount++;
        if (event.type === XmlEventType.START_ELEMENT && (event as any).name === 'S') {
          entryCount++;
        }
      }

      const endTime = performance.now();
      const runTime = endTime - startTime;
      const finalHeap = heapStats().heapSize;

      results.push({
        time: runTime,
        events: eventCount,
        entries: entryCount,
        memoryUsed: finalHeap - initialHeap
      });

      console.log(`⏱️  Run ${run}: ${(runTime / 1000).toFixed(2)}s, ${eventCount.toLocaleString()} events, ${entryCount.toLocaleString()} sentences`);
    }

    // 평균 성능 계산
    const avgTime = results.reduce((sum, r) => sum + r.time, 0) / runs;
    const avgEvents = Math.round(results.reduce((sum, r) => sum + r.events, 0) / runs);
    const avgEntries = Math.round(results.reduce((sum, r) => sum + r.entries, 0) / runs);
    const avgMemory = results.reduce((sum, r) => sum + r.memoryUsed, 0) / runs;

    console.log(`\n📊 Benchmark Results (Average of ${runs} runs):`);
    console.log(`⚡ Average parsing time: ${(avgTime / 1000).toFixed(2)} seconds`);
    console.log(`📈 Average events: ${avgEvents.toLocaleString()}`);
    console.log(`📝 Average sentences: ${avgEntries.toLocaleString()}`);
    console.log(`💾 Average memory usage: ${(avgMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📈 Average throughput: ${Math.round(avgEvents / (avgTime / 1000)).toLocaleString()} events/sec`);
    console.log(`💾 Average processing rate: ${((fileSize / 1024 / 1024) / (avgTime / 1000)).toFixed(2)} MB/sec`);

    // 성능 일관성 체크
    const timeVariance = results.reduce((sum, r) => sum + Math.pow(r.time - avgTime, 2), 0) / runs;
    const timeStdDev = Math.sqrt(timeVariance);
    const coefficientOfVariation = (timeStdDev / avgTime) * 100;

    console.log(`📊 Performance consistency: ${coefficientOfVariation.toFixed(1)}% CV (lower is better)`);

    // 어설션
    assert(avgEvents > 0, 'avgEvents should be greater than 0');
    assert(avgEntries > 0, 'avgEntries should be greater than 0');
    assert(avgTime < 300000, 'avgTime should be less than 300000ms (5 minutes)');
    assert(coefficientOfVariation < 50, `coefficientOfVariation should be less than 50, but was ${coefficientOfVariation.toFixed(1)}`);

    console.log(`✅ Benchmark completed successfully!`);
  }, 900000);

  // New benchmark for StaxXmlParserSync
  await test('should handle treebank_e.xml with synchronous parsing', async () => {
    const { heapStats } = await import('bun:jsc');

    console.log(`\n⚡ treebank_e.xml Synchronous Parsing Test (StaxXmlParserSync)`);

    const cwd = dirname(".");
    const filePath = `${cwd}/performance/samples/treebank_e.xml`;
    console.log(`📁 Reading from: ${filePath}`);

    // Read the entire file into a string
    const xmlString = await Bun.file(filePath).text();
    const fileSize = xmlString.length; // Use string length for file size in this context
    console.log(`📁 File size (string length): ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    // Initial memory state
    Bun.gc(true);
    const initialHeapStats = heapStats();
    console.log(`📊 Initial heap size: ${(initialHeapStats.heapSize / 1024 / 1024).toFixed(2)} MB`);

    const startTime = performance.now();
    const parser = new StaxXmlParserSync(xmlString);

    let eventCount = 0;
    let entryCount = 0;
    let memoryPeakSize = initialHeapStats.heapSize;

    for (const event of parser) {
      eventCount++;

      if (event.type === XmlEventType.START_ELEMENT && (event as any).name === 'S') {
        entryCount++;
      }
      // Update peak memory usage periodically or after a certain number of events
      const currentHeapStats = heapStats();
      memoryPeakSize = Math.max(memoryPeakSize, currentHeapStats.heapSize);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    const finalHeapStats = heapStats();

    console.log(`\n🎯 Synchronous Parsing Results:`);
    console.log(`⚡ Total time: ${(totalTime / 1000).toFixed(2)} seconds`);
    console.log(`📈 Events processed: ${eventCount.toLocaleString()}`);
    console.log(`🧪 Entries processed: ${entryCount.toLocaleString()}`);
    console.log(`💾 Peak memory usage: ${(memoryPeakSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📊 Final heap size: ${(finalHeapStats.heapSize / 1024 / 1024).toFixed(2)} MB`);

    const memoryEfficiency = (fileSize / memoryPeakSize) * 100;
    console.log(`💱 Memory efficiency: ${memoryEfficiency.toFixed(1)}% (file size vs peak memory)`);

    assert(eventCount > 0, 'eventCount should be greater than 0');
    assert(entryCount > 0, 'entryCount should be greater than 0');
    assert(totalTime < 300000, 'totalTime should be less than 300000ms (5 minutes)');

    // For synchronous parsing, heap to file ratio will be higher
    const heapToFileRatio = memoryPeakSize / fileSize;
    console.log(`📊 Heap to file ratio: ${heapToFileRatio.toFixed(2)}x`);
    // Adjust assertion for synchronous parsing which loads entire file into memory
    assert(heapToFileRatio < 20, `heapToFileRatio should be less than 20, but was ${heapToFileRatio.toFixed(2)}`);

    console.log(`✅ StaxXmlParserSync test completed!`);
  }, 600000);

}

async function main() {
  await section('treebank_e.xml Performance Tests', runTests);

  await section('treebank_e.xml Performance Summary', async () => {
    await test('should provide comprehensive performance summary with native heap stats', async () => {
      const { heapStats } = await import('bun:jsc');

      console.log(`\n🌳 treebank_e.xml 성능 테스트 종합 요약 (fs.createReadStream)`);
      console.log(`===========================================`);

      // fs.createReadStream 방식으로 파일 정보 확인
      const cwd = dirname(".");
      const filePath = `${cwd}/performance/samples/treebank_e.xml`;
      console.log(`📁 File path: ${filePath}`);

      const file = Bun.file(filePath);
      const fileSize = file.size;
      console.log(`📁 파일 크기: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`📊 네이티브 힙 통계는 테스트 완료 후 표시됩니다`);


      // 초기 메모리 정리 및 측정
      Bun.gc(true);
      await new Promise(resolve => setTimeout(resolve, 100));
      const initialHeap = heapStats();

      // 성능 측정 시작
      console.log(`\n🚀 파싱 시작...`);
      const startTime = performance.now();

      // fs.createReadStream으로 파싱
      const nodeStream = createReadStream(filePath);
      const inputStream = nodeStreamToWebStream(nodeStream);
      const reader = new StaxXmlParser(inputStream);

      let eventCount = 0;
      let entryCount = 0;
      let elementCount = 0;
      let textLength = 0;
      let maxEventTime = 0;

      // 진행 상황 추적
      let lastReportTime = startTime;

      // 파싱 실행
      for await (const event of reader) {
        const eventStart = performance.now();
        eventCount++;

        if (event.type === XmlEventType.START_ELEMENT) {
          elementCount++;
          if ((event as any).name === 'S') {
            entryCount++;
          }
        } else if (event.type === XmlEventType.CHARACTERS) {
          textLength += (event as any).value.length;
        }

        const eventTime = performance.now() - eventStart;
        maxEventTime = Math.max(maxEventTime, eventTime);

        // 진행 상황 보고 (매 20초)
        const currentTime = performance.now();
        if (currentTime - lastReportTime > 20000) {
          const elapsed = (currentTime - startTime) / 1000;
          const currentHeap = heapStats();
          console.log(`   ⏱️  ${elapsed.toFixed(1)}s: ${eventCount.toLocaleString()} 이벤트, ${entryCount.toLocaleString()} 문장, 힙: ${(currentHeap.heapSize / 1024 / 1024).toFixed(2)} MB`);
          lastReportTime = currentTime;
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const finalHeap = heapStats();

      // 상세 결과 출력
      console.log(`\n📊 파싱 완료 - 상세 결과:`);
      console.log(`⏱️  총 파싱 시간: ${(totalTime / 1000).toFixed(2)}초`);
      console.log(`📈 총 XML 이벤트: ${eventCount.toLocaleString()}개`);
      console.log(`📝 문장(S) 엘리먼트: ${entryCount.toLocaleString()}개`);
      console.log(`📦 전체 엘리먼트: ${elementCount.toLocaleString()}개`);
      console.log(`📝 텍스트 데이터: ${(textLength / 1024 / 1024).toFixed(2)} MB`);
      console.log(`⏱️  최대 이벤트 시간: ${maxEventTime.toFixed(4)} ms`);
      console.log(`⏱️  평균 이벤트 시간: ${(totalTime / eventCount).toFixed(4)} ms`);

      console.log(`\n⚡ 성능 지표:`);
      const eventsPerSec = Math.round(eventCount / (totalTime / 1000));
      const mbPerSec = (fileSize / 1024 / 1024) / (totalTime / 1000);
      const entriesPerSec = Math.round(entryCount / (totalTime / 1000));
      console.log(`📈 이벤트 처리율: ${eventsPerSec.toLocaleString()} 이벤트/초`);
      console.log(`📝 문장 처리율: ${entriesPerSec.toLocaleString()} 문장/초`);
      console.log(`💾 파일 처리율: ${mbPerSec.toFixed(2)} MB/초`);
      console.log(`📊 문장 밀도: ${Math.round(entryCount / (fileSize / 1024 / 1024))} 문장/MB`);
      console.log(`📊 이벤트당 바이트: ${(fileSize / eventCount).toFixed(2)} 바이트`);

      console.log(`\n💾 JavaScript 힙 메모리:`);
      console.log(`🏁 초기 힙 크기: ${(initialHeap.heapSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`🏁 초기 힙 용량: ${(initialHeap.heapCapacity / 1024 / 1024).toFixed(2)} MB`);
      console.log(`🔚 최종 힙 크기: ${(finalHeap.heapSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`🔚 최종 힙 용량: ${(finalHeap.heapCapacity / 1024 / 1024).toFixed(2)} MB`);
      console.log(`📈 힙 크기 증가: ${((finalHeap.heapSize - initialHeap.heapSize) / 1024 / 1024).toFixed(2)} MB`);
      console.log(`📈 힙 용량 증가: ${((finalHeap.heapCapacity - initialHeap.heapCapacity) / 1024 / 1024).toFixed(2)} MB`);

      const memoryRatio = finalHeap.heapSize / fileSize;
      const capacityRatio = finalHeap.heapCapacity / fileSize;
      console.log(`💱 힙/파일 비율: ${memoryRatio.toFixed(1)}x`);
      console.log(`💱 용량/파일 비율: ${capacityRatio.toFixed(1)}x`);

      console.log(`\n🎯 성능 등급 평가:`);

      // 성능 등급 계산
      const speedGrade = eventsPerSec > 1000000 ? 'A+' : eventsPerSec > 500000 ? 'A' : eventsPerSec > 100000 ? 'B' : 'C';
      const memoryGrade = memoryRatio < 10 ? 'A+' : memoryRatio < 25 ? 'A' : memoryRatio < 50 ? 'B' : 'C';
      const timeGrade = totalTime < 10000 ? 'A+' : totalTime < 30000 ? 'A' : totalTime < 60000 ? 'B' : 'C';
      const throughputGrade = mbPerSec > 20 ? 'A+' : mbPerSec > 10 ? 'A' : mbPerSec > 5 ? 'B' : 'C';

      console.log(`⚡ 처리 속도: ${speedGrade} (${eventsPerSec.toLocaleString()} 이벤트/초)`);
      console.log(`💾 메모리 효율: ${memoryGrade} (${memoryRatio.toFixed(1)}x 비율)`);
      console.log(`⏱️  파싱 시간: ${timeGrade} (${(totalTime / 1000).toFixed(2)}초)`);
      console.log(`📈 처리량: ${throughputGrade} (${mbPerSec.toFixed(2)} MB/초)`);

      // 종합 등급
      const grades = [speedGrade, memoryGrade, timeGrade, throughputGrade];
      const hasAPlus = grades.includes('A+');
      const allAOrBetter = grades.every(g => g === 'A+' || g === 'A');
      const mostlyGood = grades.filter(g => g === 'A+' || g === 'A' || g === 'B').length >= 3;

      const overallGrade = hasAPlus && allAOrBetter ? 'A+' : allAOrBetter ? 'A' : mostlyGood ? 'B' : 'C';
      console.log(`🏆 종합 성능 등급: ${overallGrade}`);

      // 벤치마크 결과
      console.log(`\n🚀 벤치마크 달성 현황:`);
      console.log(`✅ 파싱 시간 < 2분: ${totalTime < 120000 ? '달성' : '미달성'} (${(totalTime / 1000).toFixed(2)}초)`);
      console.log(`✅ 처리율 > 50만/초: ${eventsPerSec > 500000 ? '달성' : '미달성'} (${eventsPerSec.toLocaleString()}/초)`);
      console.log(`✅ 파일 처리 > 5MB/초: ${mbPerSec > 5 ? '달성' : '미달성'} (${mbPerSec.toFixed(2)}MB/초)`);
      console.log(`✅ 메모리 < 50배: ${memoryRatio < 50 ? '달성' : '미달성'} (${memoryRatio.toFixed(1)}배)`);

      console.log(`\n===========================================`);
      console.log(`🎉 treebank_e.xml 성능 테스트 완료!`);
      console.log(`💡 네이티브 힙 통계는 아래에 표시됩니다.`);

      // 어설션 - treebank_e.xml은 다른 구조이므로 적절히 조정
      assert(eventCount > 1000000, `eventCount should be greater than 1000000, but was ${eventCount}`);
      assert(entryCount > 1000, `entryCount should be greater than 1000, but was ${entryCount}`);
      assert(totalTime < 120000, `totalTime should be less than 120000ms (2 minutes), but was ${totalTime}ms`);
      assert(eventsPerSec > 100000, `eventsPerSec should be greater than 100000, but was ${eventsPerSec}`);
      assert(memoryRatio < 50, `memoryRatio should be less than 50, but was ${memoryRatio.toFixed(1)}`);
      assert(mbPerSec > 2, `mbPerSec should be greater than 2, but was ${mbPerSec.toFixed(2)}`);

    }, 180000);
  });
}

// 메인 함수 실행
main().catch(console.error);