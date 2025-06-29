import { describe, expect, it } from 'bun:test';
import { createReadStream } from 'fs';
import StaxXmlParser from '../src/StaxXmlParser';
import StaxXmlWriter from '../src/StaxXmlWriter';
import { XmlEventType } from '../src/types';

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

// 웹 표준 API용 헬퍼 함수들
function stringToReadableStream(str: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);

  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
}

// 청크 단위로 스트리밍하는 ReadableStream
function createChunkedStream(str: string, chunkSize: number = 100): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let position = 0;

  return new ReadableStream({
    start(controller) {
      const pushChunk = () => {
        if (position >= bytes.length) {
          controller.close();
          return;
        }

        const end = Math.min(position + chunkSize, bytes.length);
        const chunk = bytes.slice(position, end);
        controller.enqueue(chunk);
        position = end;

        // 비동기적으로 다음 청크 처리
        setTimeout(pushChunk, 1);
      };

      pushChunk();
    }
  });
}

class StringWritableStream extends WritableStream<Uint8Array> {
  private result: string = '';

  constructor() {
    const decoder = new TextDecoder();
    super({
      write: (chunk: Uint8Array) => {
        this.result += decoder.decode(chunk, { stream: true });
      },
      close: () => {
        this.result += decoder.decode();
      }
    });
  }

  getResult(): string {
    return this.result;
  }
}

describe('StaxXmlParser Streaming and Performance Tests', () => {
  it('should handle chunked streaming data', async () => {
    const xmlData = `<?xml version="1.0"?>
<books>
  <book id="1">
    <title>First Book</title>
    <author>Author One</author>
  </book>
  <book id="2">
    <title>Second Book</title>
    <author>Author Two</author>
  </book>
</books>`;

    // 작은 청크로 스트리밍
    const inputStream = createChunkedStream(xmlData, 20);
    const reader = new StaxXmlParser(inputStream);

    const events = [];
    for await (const event of reader) {
      events.push(event);
    }

    // 모든 이벤트가 올바르게 파싱되었는지 확인
    const startElements = events.filter(e => e.type === XmlEventType.START_ELEMENT);
    const endElements = events.filter(e => e.type === XmlEventType.END_ELEMENT);

    expect(startElements.length).toBe(endElements.length);
    expect(startElements.map((e: any) => e.name)).toEqual(['books', 'book', 'title', 'author', 'book', 'title', 'author']);
  });

  it('should handle large XML documents efficiently', async () => {
    // 큰 XML 문서 생성 (1000개의 책)
    let largeXml = '<?xml version="1.0"?>\n<catalog>\n';

    for (let i = 1; i <= 1000; i++) {
      largeXml += `  <book id="bk${i.toString().padStart(3, '0')}">\n`;
      largeXml += `    <title>Book Title ${i}</title>\n`;
      largeXml += `    <author>Author ${i}</author>\n`;
      largeXml += `    <price>${(Math.random() * 50 + 10).toFixed(2)}</price>\n`;
      largeXml += `    <description>This is the description for book number ${i}. It contains some sample text to make the document larger.</description>\n`;
      largeXml += `  </book>\n`;
    }
    largeXml += '</catalog>';

    console.log(`Testing with large XML document (${largeXml.length} characters)`);

    const startTime = Date.now();
    const inputStream = stringToReadableStream(largeXml);
    const reader = new StaxXmlParser(inputStream);

    let eventCount = 0;
    let bookCount = 0;

    for await (const event of reader) {
      eventCount++;
      if (event.type === XmlEventType.START_ELEMENT && (event as any).name === 'book') {
        bookCount++;
      }
    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    console.log(`Processed ${eventCount} events in ${processingTime}ms`);
    console.log(`Found ${bookCount} books`);

    expect(bookCount).toBe(1000);
    expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it('should handle concurrent parsing of multiple streams', async () => {
    const createTestXml = (id: number) => `<?xml version="1.0"?>
<document id="${id}">
  <data>Content for document ${id}</data>
</document>`;

    // 여러 스트림을 동시에 파싱
    const promises = [];
    for (let i = 1; i <= 10; i++) {
      const xml = createTestXml(i);
      const inputStream = stringToReadableStream(xml);
      const reader = new StaxXmlParser(inputStream);

      const promise = (async () => {
        const events = [];
        for await (const event of reader) {
          events.push(event);
        }
        return { id: i, events };
      })();

      promises.push(promise);
    }

    const results = await Promise.all(promises);

    // 모든 스트림이 올바르게 파싱되었는지 확인
    expect(results.length).toBe(10);
    results.forEach((result, index) => {
      expect(result.id).toBe(index + 1);
      expect(result.events.length).toBeGreaterThan(0);

      const startElement = result.events.find(e => e.type === XmlEventType.START_ELEMENT && (e as any).name === 'document');
      expect((startElement as any).attributes.id).toBe((index + 1).toString());
    });
  });

  it('should handle mixed content with whitespace preservation', async () => {
    const xmlWithMixedContent = `<?xml version="1.0"?>
<document>
  <paragraph>
    This is some text
    <emphasis>with emphasis</emphasis>
    and more text after.
  </paragraph>
  <pre>    Preformatted
    text with
        indentation
  </pre>
</document>`;

    const inputStream = stringToReadableStream(xmlWithMixedContent);
    const reader = new StaxXmlParser(inputStream);

    const events = [];
    for await (const event of reader) {
      events.push(event);
    }

    const textEvents = events.filter(e => e.type === XmlEventType.CHARACTERS);

    // 텍스트 이벤트가 공백을 보존하는지 확인
    expect(textEvents.length).toBeGreaterThan(0);

    // preformatted 텍스트의 공백이 보존되는지 확인
    const preText = textEvents.find((e: any) => e.value.includes('Preformatted'));
    expect((preText as any).value).toContain('    Preformatted');
    expect((preText as any).value).toContain('        indentation');
  });

  it('should handle incremental parsing correctly', async () => {
    const xml = `<?xml version="1.0"?>
<stream>
  <item id="1">First item</item>
  <item id="2">Second item</item>
  <item id="3">Third item</item>
</stream>`;

    // 매우 작은 청크로 파싱하여 증분 파싱 테스트
    const inputStream = createChunkedStream(xml, 5);
    const reader = new StaxXmlParser(inputStream);

    const items = [];
    let currentItem: any = null;

    for await (const event of reader) {
      switch (event.type) {
        case XmlEventType.START_ELEMENT:
          if ((event as any).name === 'item') {
            currentItem = { id: (event as any).attributes.id, content: '' };
          }
          break;
        case XmlEventType.CHARACTERS:
          if (currentItem) {
            currentItem.content += (event as any).value;
          }
          break;
        case XmlEventType.END_ELEMENT:
          if ((event as any).name === 'item' && currentItem) {
            items.push(currentItem);
            currentItem = null;
          }
          break;
      }
    }

    expect(items.length).toBe(3);
    expect(items[0]).toEqual({ id: '1', content: 'First item' });
    expect(items[1]).toEqual({ id: '2', content: 'Second item' });
    expect(items[2]).toEqual({ id: '3', content: 'Third item' });
  });
});

describe('StaxXmlWriter Performance and Edge Cases', () => {
  it('should handle writing large documents efficiently', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: false, // 성능을 위해 pretty print 비활성화
    });

    const startTime = Date.now();

    writer.writeStartDocument();
    writer.writeStartElement('catalog');

    // 1200개의 책 작성 (100,000자 이상을 보장하기 위해)
    for (let i = 1; i <= 1200; i++) {
      writer.writeStartElement('book');
      writer.writeAttribute('id', `bk${i.toString().padStart(3, '0')}`);

      writer.writeStartElement('title');
      writer.writeCharacters(`Book Title ${i}`);
      writer.writeEndElement();

      writer.writeStartElement('author');
      writer.writeCharacters(`Author ${i}`);
      writer.writeEndElement();

      writer.writeStartElement('price');
      writer.writeCharacters((Math.random() * 50 + 10).toFixed(2));
      writer.writeEndElement();

      writer.writeEndElement(); // book
    }

    writer.writeEndElement(); // catalog
    await writer.writeEndDocument();

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    const result = outputStream.getResult();

    console.log(`Generated XML document with ${result.length} characters in ${processingTime}ms`);

    expect(result.length).toBeGreaterThan(100000); // 큰 문서여야 함
    expect(processingTime).toBeLessThan(1000); // 1초 내에 완료되어야 함
    expect(result).toContain('<book id="bk001">');
    expect(result).toContain('<book id="bk999">');
    expect(result).toContain('<book id="bk1200">');
  });

  it('should handle multiple writer instances concurrently', async () => {
    const promises = [];

    for (let i = 1; i <= 5; i++) {
      const promise = (async () => {
        const outputStream = new StringWritableStream();
        const writer = new StaxXmlWriter(outputStream, {
          encoding: 'utf-8',
          prettyPrint: true,
        });

        writer.writeStartDocument();
        writer.writeStartElement('document');
        writer.writeAttribute('id', i.toString());

        for (let j = 1; j <= 10; j++) {
          writer.writeStartElement('item');
          writer.writeAttribute('num', j.toString());
          writer.writeCharacters(`Content ${i}-${j}`);
          writer.writeEndElement();
        }

        writer.writeEndElement();
        await writer.writeEndDocument();

        return { id: i, result: outputStream.getResult() };
      })();

      promises.push(promise);
    }

    const results = await Promise.all(promises);

    expect(results.length).toBe(5);
    results.forEach((result, index) => {
      expect(result.id).toBe(index + 1);
      expect(result.result).toContain(`<document id="${index + 1}">`);
      expect(result.result).toContain('<item num="1">');
      expect(result.result).toContain('<item num="10">');
      expect(result.result).toContain(`Content ${index + 1}-1`);
      expect(result.result).toContain(`Content ${index + 1}-10`);
    });
  });

  it('should handle memory efficiently with large content', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: false, // 성능을 위해 pretty print 비활성화
    });

    writer.writeStartDocument();
    writer.writeStartElement('data');

    // 큰 텍스트 콘텐츠 작성 (메모리 효율성 테스트)
    const largeText = 'A'.repeat(100000); // 100KB of 'A's
    writer.writeCharacters(largeText);

    // CDATA로도 큰 콘텐츠 작성
    writer.writeStartElement('script');
    const largeCData = 'console.log("test");'.repeat(10000);
    writer.writeCData(largeCData);
    writer.writeEndElement();

    writer.writeEndElement();
    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain(largeText);
    expect(result).toContain('<![CDATA[');
    expect(result).toContain('console.log("test");');
    expect(result.length).toBeGreaterThan(200000); // Should be over 200KB
  });
});

describe('Large File Performance Tests with SwissProt.xml', () => {
  it('should parse SwissProt.xml efficiently with memory monitoring', async () => {
    const { heapStats } = await import('bun:jsc');

    // fs.createReadStream 사용 (Safari 엔진의 file.stream() 메모리 문제 및 HTTP 서버 부하 해결)
    const filePath = 'test/samples/SwissProt.xml';

    console.log(`\n🧬 SwissProt.xml Performance Test (fs.createReadStream)`);
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

    /* HTTP 스트리밍 방식 (서버 부하 문제로 인해 주석처리)
    const swissProtUrl = 'https://aiweb.cs.washington.edu/research/projects/xmltk/xmldata/data/SwissProt/SwissProt.xml';
    const headResponse = await fetch(swissProtUrl, { method: 'HEAD' });
    const fileSize = parseInt(headResponse.headers.get('content-length') || '0');
    const response = await fetch(swissProtUrl);
    const inputStream = response.body;
    const reader = new StaxXmlParser(inputStream);
    */

    /* 기존 파일 기반 코드 (Safari 엔진 file.stream() 메모리 문제로 인해 주석처리)
    const filePath = 'test/samples/SwissProt.xml';
    const file = Bun.file(filePath);
    const fileSize = file.size;
    const inputStream = file.stream();
    const reader = new StaxXmlParser(inputStream);
    */

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
        if (elementName === 'Entry') {
          entryCount++;
        } else if (elementName === 'protein') {
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

        console.log(`⏱️  ${elapsedSeconds.toFixed(1)}s: ${eventCount.toLocaleString()} events (${eventsPerSecond}/s), ${entryCount.toLocaleString()} entries, heap: ${(currentHeapStats.heapSize / 1024 / 1024).toFixed(2)} MB`);
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
    console.log(`🧪 Entries found: ${entryCount.toLocaleString()}`);
    console.log(`🧬 Proteins found: ${proteinCount.toLocaleString()}`);
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
    expect(eventCount).toBeGreaterThan(0);
    expect(entryCount).toBeGreaterThan(0);
    expect(totalTime).toBeLessThan(300000); // 5분 내에 완료되어야 함

    // 메모리 효율성 테스트 - 피크 힙 크기가 파일 크기의 50배를 넘지 않아야 함
    const heapToFileRatio = peakHeapSize / fileSize;
    console.log(`📊 Heap to file ratio: ${heapToFileRatio.toFixed(2)}x`);
    expect(heapToFileRatio).toBeLessThan(50);

    console.log(`✅ Performance test completed successfully!`);
  }, 600000); // 10분 타임아웃

  it('should handle SwissProt.xml with chunked streaming', async () => {
    const { heapStats } = await import('bun:jsc');

    console.log(`\n🌊 SwissProt.xml Chunked Streaming Test (fs.createReadStream)`);

    // 초기 메모리 상태
    Bun.gc(true);
    const initialHeapStats = heapStats();

    // fs.createReadStream 방식 사용
    const filePath = 'test/samples/SwissProt.xml';
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

      if (event.type === XmlEventType.START_ELEMENT && (event as any).name === 'Entry') {
        entryCount++;

        // 1000개의 entry마다 메모리 사용량 체크
        if (entryCount % 1000 === 0) {
          const currentHeapStats = heapStats();
          memoryPeakSize = Math.max(memoryPeakSize, currentHeapStats.heapSize);

          const currentTime = performance.now();
          const elapsedSeconds = (currentTime - startTime) / 1000;
          console.log(`📊 Processed ${entryCount.toLocaleString()} entries in ${elapsedSeconds.toFixed(1)}s, heap: ${(currentHeapStats.heapSize / 1024 / 1024).toFixed(2)} MB`);
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

    expect(eventCount).toBeGreaterThan(0);
    expect(entryCount).toBeGreaterThan(0);
    expect(totalTime).toBeLessThan(300000); // 5분 내

    console.log(`✅ fs.createReadStream chunked streaming test completed!`);
  }, 600000);

  it('should benchmark parsing speed comparison', async () => {
    console.log(`\n🏁 SwissProt.xml Speed Benchmark (fs.createReadStream)`);

    const filePath = 'test/samples/SwissProt.xml';

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
        if (event.type === XmlEventType.START_ELEMENT && (event as any).name === 'Entry') {
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

      console.log(`⏱️  Run ${run}: ${(runTime / 1000).toFixed(2)}s, ${eventCount.toLocaleString()} events, ${entryCount.toLocaleString()} entries`);
    }

    // 평균 성능 계산
    const avgTime = results.reduce((sum, r) => sum + r.time, 0) / runs;
    const avgEvents = Math.round(results.reduce((sum, r) => sum + r.events, 0) / runs);
    const avgEntries = Math.round(results.reduce((sum, r) => sum + r.entries, 0) / runs);
    const avgMemory = results.reduce((sum, r) => sum + r.memoryUsed, 0) / runs;

    console.log(`\n📊 Benchmark Results (Average of ${runs} runs):`);
    console.log(`⚡ Average parsing time: ${(avgTime / 1000).toFixed(2)} seconds`);
    console.log(`📈 Average events: ${avgEvents.toLocaleString()}`);
    console.log(`🧪 Average entries: ${avgEntries.toLocaleString()}`);
    console.log(`💾 Average memory usage: ${(avgMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📈 Average throughput: ${Math.round(avgEvents / (avgTime / 1000)).toLocaleString()} events/sec`);
    console.log(`💾 Average processing rate: ${((fileSize / 1024 / 1024) / (avgTime / 1000)).toFixed(2)} MB/sec`);

    // 성능 일관성 체크
    const timeVariance = results.reduce((sum, r) => sum + Math.pow(r.time - avgTime, 2), 0) / runs;
    const timeStdDev = Math.sqrt(timeVariance);
    const coefficientOfVariation = (timeStdDev / avgTime) * 100;

    console.log(`📊 Performance consistency: ${coefficientOfVariation.toFixed(1)}% CV (lower is better)`);

    // 어설션
    expect(avgEvents).toBeGreaterThan(0);
    expect(avgEntries).toBeGreaterThan(0);
    expect(avgTime).toBeLessThan(300000); // 5분 내
    expect(coefficientOfVariation).toBeLessThan(20); // 성능 일관성 체크

    console.log(`✅ Benchmark completed successfully!`);
  }, 900000); // 15분 타임아웃
});

describe('SwissProt.xml Performance Summary', () => {
  it('should provide comprehensive performance summary with native heap stats', async () => {
    const { heapStats } = await import('bun:jsc');

    console.log(`\n🧬 SwissProt.xml 성능 테스트 종합 요약 (fs.createReadStream)`);
    console.log(`===========================================`);

    // fs.createReadStream 방식으로 파일 정보 확인
    const filePath = 'test/samples/SwissProt.xml';
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
        if ((event as any).name === 'Entry') {
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
        console.log(`   ⏱️  ${elapsed.toFixed(1)}s: ${eventCount.toLocaleString()} 이벤트, ${entryCount.toLocaleString()} 엔트리, 힙: ${(currentHeap.heapSize / 1024 / 1024).toFixed(2)} MB`);
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
    console.log(`🧪 Entry 엘리먼트: ${entryCount.toLocaleString()}개`);
    console.log(`📦 전체 엘리먼트: ${elementCount.toLocaleString()}개`);
    console.log(`📝 텍스트 데이터: ${(textLength / 1024 / 1024).toFixed(2)} MB`);
    console.log(`⏱️  최대 이벤트 시간: ${maxEventTime.toFixed(4)} ms`);
    console.log(`⏱️  평균 이벤트 시간: ${(totalTime / eventCount).toFixed(4)} ms`);

    console.log(`\n⚡ 성능 지표:`);
    const eventsPerSec = Math.round(eventCount / (totalTime / 1000));
    const mbPerSec = (fileSize / 1024 / 1024) / (totalTime / 1000);
    const entriesPerSec = Math.round(entryCount / (totalTime / 1000));
    console.log(`📈 이벤트 처리율: ${eventsPerSec.toLocaleString()} 이벤트/초`);
    console.log(`🧪 엔트리 처리율: ${entriesPerSec.toLocaleString()} 엔트리/초`);
    console.log(`💾 파일 처리율: ${mbPerSec.toFixed(2)} MB/초`);
    console.log(`📊 엔트리 밀도: ${Math.round(entryCount / (fileSize / 1024 / 1024))} 엔트리/MB`);
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
    console.log(`🎉 SwissProt.xml 성능 테스트 완료!`);
    console.log(`💡 네이티브 힙 통계는 아래에 표시됩니다.`);

    // 어설션
    expect(eventCount).toBeGreaterThan(7000000);
    expect(entryCount).toBe(50000);
    expect(totalTime).toBeLessThan(120000); // 2분 내
    expect(eventsPerSec).toBeGreaterThan(500000);
    expect(memoryRatio).toBeLessThan(50);
    expect(mbPerSec).toBeGreaterThan(5);

  }, 180000); // 3분 타임아웃
});
