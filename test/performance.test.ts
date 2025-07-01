import { describe, expect, it } from 'bun:test';
import StaxXmlParser from '../src/StaxXmlParser';
import StaxXmlWriter from '../src/StaxXmlWriter';
import { XmlEventType } from '../src/types';

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

    await writer.writeStartDocument();
    await writer.writeStartElement('catalog');

    // 1200개의 책 작성 (100,000자 이상을 보장하기 위해)
    for (let i = 1; i <= 1200; i++) {
      await writer.writeStartElement('book');
      await writer.writeAttribute('id', `bk${i.toString().padStart(3, '0')}`);

      await writer.writeStartElement('title');
      await writer.writeCharacters(`Book Title ${i}`);
      await writer.writeEndElement();

      await writer.writeStartElement('author');
      await writer.writeCharacters(`Author ${i}`);
      await writer.writeEndElement();

      await writer.writeStartElement('price');
      await writer.writeCharacters((Math.random() * 50 + 10).toFixed(2));
      await writer.writeEndElement();

      await writer.writeEndElement(); // book
    }

    await writer.writeEndElement(); // catalog
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

        await writer.writeStartDocument();
        await writer.writeStartElement('document');
        await writer.writeAttribute('id', i.toString());

        for (let j = 1; j <= 10; j++) {
          await writer.writeStartElement('item');
          await writer.writeAttribute('num', j.toString());
          await writer.writeCharacters(`Content ${i}-${j}`);
          await writer.writeEndElement();
        }

        await writer.writeEndElement();
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

    await writer.writeStartDocument();
    await writer.writeStartElement('data');

    // 큰 텍스트 콘텐츠 작성 (메모리 효율성 테스트)
    const largeText = 'A'.repeat(100000); // 100KB of 'A's
    await writer.writeCharacters(largeText);

    // CDATA로도 큰 콘텐츠 작성
    await writer.writeStartElement('script');
    const largeCData = 'console.log("test");'.repeat(10000);
    await writer.writeCData(largeCData);
    await writer.writeEndElement();

    await writer.writeEndElement();
    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain(largeText);
    expect(result).toContain('<![CDATA[');
    expect(result).toContain('console.log("test");');
    expect(result.length).toBeGreaterThan(200000); // Should be over 200KB
  });
});
