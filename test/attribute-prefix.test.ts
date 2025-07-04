import { describe, expect, it } from 'bun:test';
import StaxXmlParser from '../src/StaxXmlParser';
import StaxXmlWriter from '../src/StaxXmlWriter';
import { StartElementEvent, XmlEventType } from '../src/types';

// 헬퍼 함수들
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

describe('Attribute Prefix Support Tests', () => {
  it('should parse attributes with prefix correctly', async () => {
    const xmlWithPrefixedAttrs = `<?xml version="1.0" encoding="UTF-8"?>
<doc
  xmlns="http://www.example.com/documents"
  xmlns:html="http://www.w3.org/1999/xhtml"
  xmlns:meta="http://www.example.com/metadata"
>
  <page id="p1" meta:author="김민준" meta:status="draft">
    <title>XML 네임스페이스</title>
    <content>
      <p>
        이 예제는 일반 속성에서 접두사 사용법을 보여줍니다.
        외부 링크는 <a html:href="http://www.w3.org/TR/REC-xml-names/" html:target="_blank">여기</a>를 참고하세요.
      </p>
    </content>
  </page>
</doc>`;

    const inputStream = stringToReadableStream(xmlWithPrefixedAttrs);
    const reader = new StaxXmlParser(inputStream);

    const events = [];
    for await (const event of reader) {
      events.push(event);
    }

    // page 요소의 이벤트 찾기
    const pageEvent = events.find(e =>
      e.type === XmlEventType.START_ELEMENT &&
      (e as any).name === 'page'
    ) as any;

    expect(pageEvent).toBeDefined();
    expect(pageEvent.attributes.id).toBe('p1');
    expect(pageEvent.attributes['meta:author']).toBe('김민준');
    expect(pageEvent.attributes['meta:status']).toBe('draft');

    // attributesWithPrefix 확인
    expect(pageEvent.attributesWithPrefix).toBeDefined();
    expect(pageEvent.attributesWithPrefix.id).toEqual({
      value: 'p1',
      prefix: undefined,
      uri: undefined
    });
    expect(pageEvent.attributesWithPrefix.author).toEqual({
      value: '김민준',
      prefix: 'meta',
      uri: 'http://www.example.com/metadata'
    });
    expect(pageEvent.attributesWithPrefix.status).toEqual({
      value: 'draft',
      prefix: 'meta',
      uri: 'http://www.example.com/metadata'
    });

    // a 요소의 이벤트 찾기
    const aEvent = events.find(e =>
      e.type === XmlEventType.START_ELEMENT &&
      (e as any).name === 'a'
    ) as any;

    expect(aEvent).toBeDefined();
    expect(aEvent.attributes['html:href']).toBe('http://www.w3.org/TR/REC-xml-names/');
    expect(aEvent.attributes['html:target']).toBe('_blank');

    // attributesWithPrefix 확인
    expect(aEvent.attributesWithPrefix.href).toEqual({
      value: 'http://www.w3.org/TR/REC-xml-names/',
      prefix: 'html',
      uri: 'http://www.w3.org/1999/xhtml'
    });
    expect(aEvent.attributesWithPrefix.target).toEqual({
      value: '_blank',
      prefix: 'html',
      uri: 'http://www.w3.org/1999/xhtml'
    });
  });

  it('should write attributes with prefix correctly', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    await writer.writeStartDocument('1.0', 'utf-8');

    // 루트 요소와 네임스페이스 선언
    await writer.writeStartElement('doc', {
      attributes: {
        xmlns: 'http://www.example.com/documents'
      }
    });
    await writer.writeNamespace('html', 'http://www.w3.org/1999/xhtml');
    await writer.writeNamespace('meta', 'http://www.example.com/metadata');

    // prefix가 있는 속성을 가진 요소
    await writer.writeStartElement('page', {
      attributes: {
        id: 'p1',
        author: { value: '김민준', prefix: 'meta' },
        status: { value: 'draft', prefix: 'meta' }
      }
    });

    await writer.writeStartElement('title');
    await writer.writeCharacters('XML 네임스페이스');
    await writer.writeEndElement();

    await writer.writeStartElement('content');
    await writer.writeStartElement('p');
    await writer.writeCharacters('이 예제는 일반 속성에서 접두사 사용법을 보여줍니다. 외부 링크는 ');

    await writer.writeStartElement('a', {
      attributes: {
        href: { value: 'http://www.w3.org/TR/REC-xml-names/', prefix: 'html' },
        target: { value: '_blank', prefix: 'html' }
      }
    });
    await writer.writeCharacters('여기');
    await writer.writeEndElement(); // a

    await writer.writeCharacters('를 참고하세요.');
    await writer.writeEndElement(); // p
    await writer.writeEndElement(); // content
    await writer.writeEndElement(); // page
    await writer.writeEndElement(); // doc

    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('xmlns="http://www.example.com/documents"');
    expect(result).toContain('xmlns:html="http://www.w3.org/1999/xhtml"');
    expect(result).toContain('xmlns:meta="http://www.example.com/metadata"');
    expect(result).toContain('<page id="p1" meta:author="김민준" meta:status="draft">');
    expect(result).toContain('<a html:href="http://www.w3.org/TR/REC-xml-names/" html:target="_blank">여기</a>');
  });

  it('should throw error when using undefined namespace prefix in attributes', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true
    });

    await writer.writeStartDocument();
    await writer.writeStartElement('root');

    // 정의되지 않은 prefix 사용 시 오류 발생해야 함
    await expect(writer.writeStartElement('element', {
      attributes: {
        attr: { value: 'test', prefix: 'undefined' }
      }
    })).rejects.toThrow("Namespace prefix 'undefined' is not defined for attribute 'attr'");
  });

  it('should handle mixed simple and prefixed attributes', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: false
    });

    await writer.writeStartDocument();
    await writer.writeStartElement('root');
    await writer.writeNamespace('ns', 'http://example.com/namespace');

    await writer.writeStartElement('element', {
      attributes: {
        simpleAttr: 'simple value',
        prefixedAttr: { value: 'prefixed value', prefix: 'ns' },
        anotherSimple: 'another simple'
      }
    });
    await writer.writeEndElement(); // element
    await writer.writeEndElement(); // root

    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('simpleAttr="simple value"');
    expect(result).toContain('ns:prefixedAttr="prefixed value"');
    expect(result).toContain('anotherSimple="another simple"');
  });

  it('should round-trip parse and write attributes with prefixes', async () => {
    const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<root xmlns:test="http://test.com">
  <item id="1" test:name="Test Item" test:enabled="true">Content</item>
</root>`;

    // Parse the XML
    const inputStream = stringToReadableStream(originalXml);
    const parser = new StaxXmlParser(inputStream);

    const events = [];
    for await (const event of parser) {
      events.push(event);
    }

    // Find the item element
    const itemEvent = events.find(e =>
      e.type === XmlEventType.START_ELEMENT && (e as StartElementEvent).name === 'item'
    ) as StartElementEvent;

    // Write it back using the parsed information
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, { prettyPrint: false });

    await writer.writeStartDocument();
    await writer.writeStartElement('root');
    await writer.writeNamespace('test', 'http://test.com');

    // Use attributesWithPrefix to recreate the element
    const attributes: Record<string, string | any> = {};
    if (itemEvent.attributesWithPrefix) {
      for (const [localName, attrInfo] of Object.entries(itemEvent.attributesWithPrefix)) {
        if (attrInfo.prefix) {
          attributes[localName] = { value: attrInfo.value, prefix: attrInfo.prefix };
        } else {
          attributes[localName] = attrInfo.value;
        }
      }
    }

    await writer.writeStartElement('item', { attributes });
    await writer.writeCharacters('Content');
    await writer.writeEndElement(); // item
    await writer.writeEndElement(); // root

    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('xmlns:test="http://test.com"');
    expect(result).toContain('id="1"');
    expect(result).toContain('test:name="Test Item"');
    expect(result).toContain('test:enabled="true"');
    expect(result).toContain('<item');
    expect(result).toContain('>Content</item>');
  });
});
