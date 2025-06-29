import { describe, expect, it } from 'bun:test';
import StaxXmlWriter from '../src/StaxXmlWriter';

// 웹 표준 API용 헬퍼 함수들
class StringWritableStream extends WritableStream<Uint8Array> {
  private result: string = '';

  constructor() {
    const decoder = new TextDecoder();
    super({
      write: (chunk: Uint8Array) => {
        this.result += decoder.decode(chunk, { stream: true });
      },
      close: () => {
        // 스트림이 닫힐 때 최종 디코딩
        this.result += decoder.decode();
      }
    });
  }

  getResult(): string {
    return this.result;
  }
}

describe('StaxXmlWriter Self-Closing Tag Tests', () => {
  it('should write self-closing tag with writeEndElementSelfClosing', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument();
    writer.writeStartElement('root');
    writer.writeStartElement('empty-element');
    writer.writeAttribute('attr1', 'value1');
    writer.writeAttribute('attr2', 'value2');
    writer.writeEndElementSelfClosing(); // self-closing tag로 닫기
    writer.writeEndElement(); // root 닫기

    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('<empty-element attr1="value1" attr2="value2"/>');
  });

  it('should write self-closing tag with writeStartElement and attributes', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument();
    writer.writeStartElement('root');
    writer.writeStartElement('img', undefined, undefined, {
      'src': 'image.jpg',
      'alt': 'A beautiful image',
      'width': '100',
      'height': '200'
    });
    writer.writeEndElementSelfClosing();
    writer.writeEndElement(); // root 닫기

    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('<img src="image.jpg" alt="A beautiful image" width="100" height="200"/>');
  });

  it('should write mixed content with self-closing tags', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument();
    writer.writeStartElement('document');

    writer.writeStartElement('paragraph');
    writer.writeCharacters('This is some text with ');
    writer.writeStartElement('br', undefined, undefined, {});
    writer.writeEndElementSelfClosing();
    writer.writeCharacters(' a line break.');
    writer.writeEndElement(); // paragraph 닫기

    writer.writeStartElement('input');
    writer.writeAttribute('type', 'text');
    writer.writeAttribute('name', 'username');
    writer.writeAttribute('value', 'john_doe');
    writer.writeEndElementSelfClosing(); // input을 self-closing으로 닫기

    writer.writeEndElement(); // document 닫기

    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('<br/>');
    expect(result).toContain('<input type="text" name="username" value="john_doe"/>');
  });
});
