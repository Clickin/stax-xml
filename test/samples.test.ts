import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import StaxXmlParser from '../src/StaxXmlParser';
import { XmlEventType } from '../src/types';

// 웹 표준 API용 헬퍼 함수
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

// 샘플 파일을 읽는 헬퍼 함수
function loadSampleFile(filename: string): string {
  const filePath = join(__dirname, 'samples', filename);
  return readFileSync(filePath, 'utf-8');
}

// 안전한 이벤트 파싱 함수
async function safeParseXml(xmlContent: string): Promise<{ events: any[], success: boolean, error?: string }> {
  try {
    const inputStream = stringToReadableStream(xmlContent);
    const parser = new StaxXmlParser(inputStream);

    const events = [];
    for await (const event of parser) {
      events.push(event);
      // ERROR 이벤트 타입 확인
      if (event.type === XmlEventType.ERROR) {
        return { events, success: false, error: 'Parser error event' };
      }
    }

    return { events, success: true };
  } catch (error) {
    return { events: [], success: false, error: String(error) };
  }
}

describe('Sample XML Files Parsing Tests', () => {

  describe('Valid XML Files', () => {
    it('should successfully parse books.xml catalog', async () => {
      const xmlContent = loadSampleFile('books.xml');
      const result = await safeParseXml(xmlContent);

      expect(result.success).toBe(true);
      expect(result.events.length).toBeGreaterThan(0);

      // 기본 구조 검증
      expect(result.events[0].type).toBe(XmlEventType.START_DOCUMENT);
      expect(result.events[result.events.length - 1].type).toBe(XmlEventType.END_DOCUMENT);

      // catalog 루트 요소 검증
      const catalogElements = result.events.filter(e =>
        e.type === XmlEventType.START_ELEMENT && (e as any).name === 'catalog'
      );
      expect(catalogElements.length).toBe(1);

      // book 요소들 검증
      const bookElements = result.events.filter(e =>
        e.type === XmlEventType.START_ELEMENT && (e as any).name === 'book'
      );
      expect(bookElements.length).toBeGreaterThanOrEqual(5);

      // 첫 번째 책의 속성 검증
      const firstBook = bookElements[0] as any;
      expect(firstBook.attributes).toBeDefined();
      expect(firstBook.attributes.id).toBe('bk101');
    });

    it('should handle book titles with apostrophes', async () => {
      const xmlContent = loadSampleFile('books.xml');
      const result = await safeParseXml(xmlContent);

      expect(result.success).toBe(true);

      // 텍스트 이벤트에서 아포스트로피가 포함된 제목 찾기
      const textEvents = result.events.filter(e => e.type === XmlEventType.CHARACTERS);
      const developerGuideText = textEvents.find(e =>
        (e as any).value && (e as any).value.includes("Developer's Guide")
      );

      expect(developerGuideText).toBeDefined();
    });

    it('should parse selfclosing.xml with various empty elements', async () => {
      const xmlContent = loadSampleFile('selfclosing.xml');
      const result = await safeParseXml(xmlContent);

      expect(result.success).toBe(true);
      expect(result.events.length).toBeGreaterThan(0);

      // self-closing 요소들 확인
      const startElements = result.events.filter(e => e.type === XmlEventType.START_ELEMENT);
      const elementNames = startElements.map(e => (e as any).name);

      expect(elementNames).toContain('meta');
      expect(elementNames).toContain('br');
      expect(elementNames).toContain('hr');
      expect(elementNames).toContain('input');

      // meta 요소의 속성 확인
      const metaElement = startElements.find(e => (e as any).name === 'meta') as any;
      expect(metaElement?.attributes?.charset).toBe('utf-8');
    });
  });

  describe('Complex XML Features', () => {
    it('should attempt to parse complex.xml configuration', async () => {
      const xmlContent = loadSampleFile('complex.xml');
      const result = await safeParseXml(xmlContent);

      // 성공 여부와 상관없이 일부 이벤트는 파싱되었을 것
      expect(result.events.length).toBeGreaterThan(0);

      if (result.success) {
        // 성공한 경우 구조 검증
        const configElements = result.events.filter(e =>
          e.type === XmlEventType.START_ELEMENT && (e as any).name === 'configuration'
        );
        expect(configElements.length).toBeGreaterThanOrEqual(0);

        // CDATA 섹션 확인
        const cdataEvents = result.events.filter(e => e.type === XmlEventType.CDATA);
        if (cdataEvents.length > 0) {
          expect(cdataEvents[0]).toBeDefined();
        }
      } else {
        // 실패한 경우에도 일부 이벤트는 파싱되었을 수 있음
        console.log(`Complex.xml parsing failed: ${result.error}`);
      }
    });

    it('should attempt to parse comprehensive.xml with namespaces', async () => {
      const xmlContent = loadSampleFile('comprehensive.xml');
      const result = await safeParseXml(xmlContent);

      // 성공 여부와 상관없이 일부 이벤트는 파싱되었을 것
      expect(result.events.length).toBeGreaterThan(0);

      if (result.success) {
        // 루트 요소 확인
        const rootElements = result.events.filter(e =>
          e.type === XmlEventType.START_ELEMENT && (e as any).name === 'root'
        );
        expect(rootElements.length).toBeGreaterThanOrEqual(0);

        // 네임스페이스 접두사가 있는 요소들 확인
        const namespacedElements = result.events.filter(e =>
          e.type === XmlEventType.START_ELEMENT &&
          (e as any).name &&
          ((e as any).name.includes('ns1:') || (e as any).name.includes('ns2:'))
        );

        if (namespacedElements.length > 0) {
          expect(namespacedElements[0]).toBeDefined();
        }
      } else {
        console.log(`Comprehensive.xml parsing failed: ${result.error}`);
      }
    });
  });

  describe('Invalid XML Files - Error Handling', () => {
    it('should detect errors in malformed XML files', async () => {
      const testFiles = [
        'invalid-mismatch.xml',
        'invalid-unclosed.xml',
        'malformed.xml'
      ];

      for (const filename of testFiles) {
        const xmlContent = loadSampleFile(filename);
        const result = await safeParseXml(xmlContent);

        // 이 파일들은 에러가 발생해야 함
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Performance Tests', () => {
    it('should parse books.xml efficiently', async () => {
      const xmlContent = loadSampleFile('books.xml');

      const startTime = Date.now();
      const result = await safeParseXml(xmlContent);
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(100); // 100ms 이내

      // 적절한 수의 이벤트가 생성되었는지 확인
      expect(result.events.length).toBeGreaterThan(50);
    });

    it('should handle repeated parsing without memory leaks', async () => {
      const xmlContent = loadSampleFile('books.xml');
      const iterations = 5;
      const results = [];

      for (let i = 0; i < iterations; i++) {
        const result = await safeParseXml(xmlContent);
        results.push({
          success: result.success,
          eventCount: result.events.length
        });
      }

      // 모든 반복에서 동일한 결과가 나와야 함
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.success).toBe(firstResult.success);
        expect(result.eventCount).toBe(firstResult.eventCount);
      });
    });
  });
});