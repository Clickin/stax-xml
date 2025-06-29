import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import StaxXmlParser from '../src/StaxXmlParser';
import StaxXmlWriter from '../src/StaxXmlWriter';
import { EndElementEvent, StartElementEvent, XmlEventType } from '../src/types';

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

// WritableStream을 문자열로 변환하는 헬퍼 함수
function createStringWritableStream(): { stream: WritableStream<Uint8Array>, getString: () => string } {
  let result = '';
  const decoder = new TextDecoder();

  const stream = new WritableStream<Uint8Array>({
    write(chunk) {
      result += decoder.decode(chunk, { stream: true });
    },
    close() {
      result += decoder.decode(); // flush
    }
  });

  return {
    stream,
    getString: () => result
  };
}

// 샘플 파일을 읽는 헬퍼 함수
function loadSampleFile(filename: string): string {
  const filePath = join(__dirname, 'samples', filename);
  return readFileSync(filePath, 'utf-8');
}

describe('Namespace XML Parsing and Writing Tests', () => {
  describe('simple-namespace.xml Parsing Tests', () => {
    it('should correctly parse namespace prefixes in simple-namespace.xml', async () => {
      const xmlContent = loadSampleFile('simple-namespace.xml');
      const inputStream = stringToReadableStream(xmlContent);
      const parser = new StaxXmlParser(inputStream);

      const events = [];
      for await (const event of parser) {
        events.push(event);
      }

      // 파싱이 성공적으로 완료되어야 함
      expect(events.length).toBeGreaterThan(0);
      expect(events[events.length - 1].type).toBe(XmlEventType.END_DOCUMENT);

      // START_ELEMENT 이벤트들만 필터링
      const startElements = events.filter(e => e.type === XmlEventType.START_ELEMENT) as StartElementEvent[];

      // root 요소 확인
      const rootElement = startElements.find(e => e.name === 'root');
      expect(rootElement).toBeDefined();
      expect(rootElement!.localName).toBe('root');
      expect(rootElement!.prefix).toBeUndefined();

      // h:table 요소 확인 (HTML 네임스페이스)
      const hTableElement = startElements.find(e => e.name === 'h:table');
      expect(hTableElement).toBeDefined();
      expect(hTableElement!.localName).toBe('table');
      expect(hTableElement!.prefix).toBe('h');
      expect(hTableElement!.uri).toBe('http://www.w3.org/TR/html4/');
      expect(hTableElement!.attributes['xmlns:h']).toBe('http://www.w3.org/TR/html4/');

      // h:tr 요소 확인
      const hTrElement = startElements.find(e => e.name === 'h:tr');
      expect(hTrElement).toBeDefined();
      expect(hTrElement!.localName).toBe('tr');
      expect(hTrElement!.prefix).toBe('h');
      expect(hTrElement!.uri).toBe('http://www.w3.org/TR/html4/');

      // h:td 요소들 확인
      const hTdElements = startElements.filter(e => e.name === 'h:td');
      expect(hTdElements).toHaveLength(2);
      hTdElements.forEach(element => {
        expect(element.localName).toBe('td');
        expect(element.prefix).toBe('h');
        expect(element.uri).toBe('http://www.w3.org/TR/html4/');
      });

      // f:table 요소 확인 (Furniture 네임스페이스)
      const fTableElement = startElements.find(e => e.name === 'f:table');
      expect(fTableElement).toBeDefined();
      expect(fTableElement!.localName).toBe('table');
      expect(fTableElement!.prefix).toBe('f');
      expect(fTableElement!.uri).toBe('https://www.w3schools.com/furniture');
      expect(fTableElement!.attributes['xmlns:f']).toBe('https://www.w3schools.com/furniture');

      // f:name, f:width, f:length 요소들 확인
      const fNameElement = startElements.find(e => e.name === 'f:name');
      expect(fNameElement).toBeDefined();
      expect(fNameElement!.localName).toBe('name');
      expect(fNameElement!.prefix).toBe('f');
      expect(fNameElement!.uri).toBe('https://www.w3schools.com/furniture');

      const fWidthElement = startElements.find(e => e.name === 'f:width');
      expect(fWidthElement).toBeDefined();
      expect(fWidthElement!.localName).toBe('width');
      expect(fWidthElement!.prefix).toBe('f');
      expect(fWidthElement!.uri).toBe('https://www.w3schools.com/furniture');

      const fLengthElement = startElements.find(e => e.name === 'f:length');
      expect(fLengthElement).toBeDefined();
      expect(fLengthElement!.localName).toBe('length');
      expect(fLengthElement!.prefix).toBe('f');
      expect(fLengthElement!.uri).toBe('https://www.w3schools.com/furniture');
    });

    it('should distinguish between h:table and f:table elements', async () => {
      const xmlContent = loadSampleFile('simple-namespace.xml');
      const inputStream = stringToReadableStream(xmlContent);
      const parser = new StaxXmlParser(inputStream);

      const events = [];
      for await (const event of parser) {
        events.push(event);
      }

      const startElements = events.filter(e => e.type === XmlEventType.START_ELEMENT) as StartElementEvent[];

      // h:table과 f:table은 모두 localName이 'table'이지만 다른 네임스페이스를 가짐
      const hTableElement = startElements.find(e => e.name === 'h:table');
      const fTableElement = startElements.find(e => e.name === 'f:table');

      expect(hTableElement).toBeDefined();
      expect(fTableElement).toBeDefined();

      // 같은 localName을 가지지만 다른 네임스페이스
      expect(hTableElement!.localName).toBe('table');
      expect(fTableElement!.localName).toBe('table');

      // 하지만 다른 prefix와 URI를 가짐
      expect(hTableElement!.prefix).toBe('h');
      expect(fTableElement!.prefix).toBe('f');
      expect(hTableElement!.uri).toBe('http://www.w3.org/TR/html4/');
      expect(fTableElement!.uri).toBe('https://www.w3schools.com/furniture');

      // 전체 이름(QName)은 다름
      expect(hTableElement!.name).toBe('h:table');
      expect(fTableElement!.name).toBe('f:table');
    });

    it('should correctly parse text content within namespaced elements', async () => {
      const xmlContent = loadSampleFile('simple-namespace.xml');
      const inputStream = stringToReadableStream(xmlContent);
      const parser = new StaxXmlParser(inputStream);

      const events = [];
      for await (const event of parser) {
        events.push(event);
      }

      // CHARACTERS 이벤트들에서 텍스트 콘텐츠 확인
      const charactersEvents = events.filter(e => e.type === XmlEventType.CHARACTERS);
      const textContents = charactersEvents.map((e: any) => e.value.trim()).filter(text => text.length > 0);

      // 예상되는 텍스트 콘텐츠들
      expect(textContents).toContain('Apples');
      expect(textContents).toContain('Bananas');
      expect(textContents).toContain('African Coffee Table');
      expect(textContents).toContain('80');
      expect(textContents).toContain('120');
    });

    it('should correctly handle END_ELEMENT events with namespace information', async () => {
      const xmlContent = loadSampleFile('simple-namespace.xml');
      const inputStream = stringToReadableStream(xmlContent);
      const parser = new StaxXmlParser(inputStream);

      const events = [];
      for await (const event of parser) {
        events.push(event);
      }

      const endElements = events.filter(e => e.type === XmlEventType.END_ELEMENT) as EndElementEvent[];

      // h:table 종료 요소 확인
      const hTableEndElement = endElements.find(e => e.name === 'h:table');
      expect(hTableEndElement).toBeDefined();
      expect(hTableEndElement!.localName).toBe('table');
      expect(hTableEndElement!.prefix).toBe('h');
      expect(hTableEndElement!.uri).toBe('http://www.w3.org/TR/html4/');

      // f:table 종료 요소 확인
      const fTableEndElement = endElements.find(e => e.name === 'f:table');
      expect(fTableEndElement).toBeDefined();
      expect(fTableEndElement!.localName).toBe('table');
      expect(fTableEndElement!.prefix).toBe('f');
      expect(fTableEndElement!.uri).toBe('https://www.w3schools.com/furniture');
    });
  });

  describe('StaxXmlWriter Namespace Writing Tests', () => {
    it('should write elements with namespace prefixes correctly', async () => {
      const { stream, getString } = createStringWritableStream();
      const writer = new StaxXmlWriter(stream);

      writer.writeStartDocument();
      writer.writeStartElement('root');

      // HTML 네임스페이스를 가진 table 작성
      writer.writeStartElement('table', { prefix: 'h', uri: 'http://www.w3.org/TR/html4/' });
      writer.writeStartElement('tr', { prefix: 'h' });
      writer.writeStartElement('td', { prefix: 'h' });
      writer.writeCharacters('Apples');
      writer.writeEndElement(); // h:td
      writer.writeStartElement('td', { prefix: 'h' });
      writer.writeCharacters('Bananas');
      writer.writeEndElement(); // h:td
      writer.writeEndElement(); // h:tr
      writer.writeEndElement(); // h:table

      // Furniture 네임스페이스를 가진 table 작성
      writer.writeStartElement('table', { prefix: 'f', uri: 'https://www.w3schools.com/furniture' });
      writer.writeStartElement('name', { prefix: 'f' });
      writer.writeCharacters('African Coffee Table');
      writer.writeEndElement(); // f:name
      writer.writeStartElement('width', { prefix: 'f' });
      writer.writeCharacters('80');
      writer.writeEndElement(); // f:width
      writer.writeStartElement('length', { prefix: 'f' });
      writer.writeCharacters('120');
      writer.writeEndElement(); // f:length
      writer.writeEndElement(); // f:table

      writer.writeEndElement(); // root
      await writer.writeEndDocument();

      const result = getString();

      // 네임스페이스 선언이 올바르게 포함되었는지 확인
      expect(result).toContain('xmlns:h="http://www.w3.org/TR/html4/"');
      expect(result).toContain('xmlns:f="https://www.w3schools.com/furniture"');

      // 네임스페이스 접두사가 올바르게 사용되었는지 확인
      expect(result).toContain('<h:table');
      expect(result).toContain('<h:tr>');
      expect(result).toContain('<h:td>');
      expect(result).toContain('</h:table>');
      expect(result).toContain('</h:tr>');
      expect(result).toContain('</h:td>');

      expect(result).toContain('<f:table');
      expect(result).toContain('<f:name>');
      expect(result).toContain('<f:width>');
      expect(result).toContain('<f:length>');
      expect(result).toContain('</f:table>');
      expect(result).toContain('</f:name>');
      expect(result).toContain('</f:width>');
      expect(result).toContain('</f:length>');

      // 텍스트 콘텐츠 확인
      expect(result).toContain('Apples');
      expect(result).toContain('Bananas');
      expect(result).toContain('African Coffee Table');
      expect(result).toContain('80');
      expect(result).toContain('120');
    });

    it('should write namespace declarations using writeNamespace method', async () => {
      const { stream, getString } = createStringWritableStream();
      const writer = new StaxXmlWriter(stream);

      writer.writeStartDocument();
      writer.writeStartElement('root');

      // writeNamespace를 사용하여 네임스페이스 선언
      writer.writeStartElement('table', { prefix: 'h' });
      writer.writeNamespace('h', 'http://www.w3.org/TR/html4/');
      writer.writeEndElement();

      writer.writeStartElement('table', { prefix: 'f' });
      writer.writeNamespace('f', 'https://www.w3schools.com/furniture');
      writer.writeEndElement();

      writer.writeEndElement(); // root
      await writer.writeEndDocument();

      const result = getString();

      // 네임스페이스 선언이 올바르게 작성되었는지 확인
      expect(result).toContain('xmlns:h="http://www.w3.org/TR/html4/"');
      expect(result).toContain('xmlns:f="https://www.w3schools.com/furniture"');

      // 네임스페이스 접두사가 올바르게 사용되었는지 확인
      expect(result).toContain('<h:table');
      expect(result).toContain('</h:table>');
      expect(result).toContain('<f:table');
      expect(result).toContain('</f:table>');
    });

    it('should create XML structure similar to simple-namespace.xml', async () => {
      const { stream, getString } = createStringWritableStream();
      const writer = new StaxXmlWriter(stream);

      // simple-namespace.xml과 유사한 구조 생성
      writer.writeStartDocument();
      writer.writeStartElement('root');

      // h:table 구조
      writer.writeStartElement('table', { prefix: 'h', uri: 'http://www.w3.org/TR/html4/' });
      writer.writeStartElement('tr', { prefix: 'h' });
      writer.writeStartElement('td', { prefix: 'h' });
      writer.writeCharacters('Apples');
      writer.writeEndElement();
      writer.writeStartElement('td', { prefix: 'h' });
      writer.writeCharacters('Bananas');
      writer.writeEndElement();
      writer.writeEndElement();
      writer.writeEndElement();

      // f:table 구조
      writer.writeStartElement('table', { prefix: 'f', uri: 'https://www.w3schools.com/furniture' });
      writer.writeStartElement('name', { prefix: 'f' });
      writer.writeCharacters('African Coffee Table');
      writer.writeEndElement();
      writer.writeStartElement('width', { prefix: 'f' });
      writer.writeCharacters('80');
      writer.writeEndElement();
      writer.writeStartElement('length', { prefix: 'f' });
      writer.writeCharacters('120');
      writer.writeEndElement();
      writer.writeEndElement();

      writer.writeEndElement(); // root
      await writer.writeEndDocument();

      const result = getString();

      // 생성된 XML을 파싱하여 검증
      const inputStream = stringToReadableStream(result);
      const parser = new StaxXmlParser(inputStream);

      const events = [];
      for await (const event of parser) {
        events.push(event);
      }

      const startElements = events.filter(e => e.type === XmlEventType.START_ELEMENT) as StartElementEvent[];

      // h:table과 f:table이 모두 존재하는지 확인
      const hTableElement = startElements.find(e => e.name === 'h:table');
      const fTableElement = startElements.find(e => e.name === 'f:table');

      expect(hTableElement).toBeDefined();
      expect(fTableElement).toBeDefined();

      // 네임스페이스 정보가 올바른지 확인
      expect(hTableElement!.prefix).toBe('h');
      expect(hTableElement!.uri).toBe('http://www.w3.org/TR/html4/');
      expect(fTableElement!.prefix).toBe('f');
      expect(fTableElement!.uri).toBe('https://www.w3schools.com/furniture');
    });

    it('should handle round-trip parsing and writing correctly', async () => {
      // 원본 XML을 파싱
      const originalXmlContent = loadSampleFile('simple-namespace.xml');
      const inputStream = stringToReadableStream(originalXmlContent);
      const parser = new StaxXmlParser(inputStream);

      // 파싱된 이벤트로부터 새로운 XML 생성
      const { stream, getString } = createStringWritableStream();
      const writer = new StaxXmlWriter(stream);

      const elementStack: Array<{ name: string, prefix?: string }> = [];

      for await (const event of parser) {
        switch (event.type) {
          case XmlEventType.START_DOCUMENT:
            writer.writeStartDocument();
            break;
          case XmlEventType.END_DOCUMENT:
            await writer.writeEndDocument();
            break;
          case XmlEventType.START_ELEMENT:
            const startEvent = event as StartElementEvent;
            if (startEvent.prefix && startEvent.uri) {
              writer.writeStartElement(startEvent.localName || startEvent.name, { prefix: startEvent.prefix, uri: startEvent.uri });
            } else {
              writer.writeStartElement(startEvent.localName || startEvent.name);
            }
            elementStack.push({ name: startEvent.name, prefix: startEvent.prefix });
            break;
          case XmlEventType.END_ELEMENT:
            writer.writeEndElement();
            elementStack.pop();
            break;
          case XmlEventType.CHARACTERS:
            const textEvent = event as any;
            const text = textEvent.value.trim();
            if (text.length > 0) {
              writer.writeCharacters(text);
            }
            break;
        }
      }

      const regeneratedXml = getString();

      // 재생성된 XML을 다시 파싱하여 구조가 유지되었는지 확인
      const inputStream2 = stringToReadableStream(regeneratedXml);
      const parser2 = new StaxXmlParser(inputStream2);

      const events = [];
      for await (const event of parser2) {
        events.push(event);
      }

      const startElements = events.filter(e => e.type === XmlEventType.START_ELEMENT) as StartElementEvent[];

      // h:table과 f:table이 여전히 올바른 네임스페이스 정보를 가지는지 확인
      const hTableElement = startElements.find(e => e.name === 'h:table');
      const fTableElement = startElements.find(e => e.name === 'f:table');

      expect(hTableElement).toBeDefined();
      expect(hTableElement!.prefix).toBe('h');
      expect(hTableElement!.uri).toBe('http://www.w3.org/TR/html4/');

      expect(fTableElement).toBeDefined();
      expect(fTableElement!.prefix).toBe('f');
      expect(fTableElement!.uri).toBe('https://www.w3schools.com/furniture');
    });
  });
});
