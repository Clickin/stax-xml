import { describe, expect, it } from 'bun:test';
import StaxXmlWriter from '../src/StaxXmlWriter';

// 웹 표준 API용 헬퍼 함수들


describe('StaxXmlWriter Self-Closing Tag Tests', () => {
  it('should write self-closing tag with attributes', async () => {
    const writer = new StaxXmlWriter({
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument();
    writer.writeStartElement('root');
    writer.writeStartElement('empty-element', {
      attributes: {
        attr1: 'value1',
        attr2: 'value2'
      },
      selfClosing: true
    });
    writer.writeEndElement(); // root 닫기

    writer.writeEndDocument();

    const result = writer.getXmlString();

    expect(result).toContain('<empty-element attr1="value1" attr2="value2"/>');
  });

  it('should write self-closing tag with writeStartElement and attributes', async () => {
    const writer = new StaxXmlWriter({
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument();
    writer.writeStartElement('root');
    writer.writeStartElement('img', {
      attributes: {
        'src': 'image.jpg',
        'alt': 'A beautiful image',
        'width': '100',
        'height': '200'
      },
      selfClosing: true
    });
    writer.writeEndElement(); // root 닫기

    writer.writeEndDocument();

    const result = writer.getXmlString();

    expect(result).toContain('<img src="image.jpg" alt="A beautiful image" width="100" height="200"/>');
  });

  it('should write mixed content with self-closing tags', async () => {
    const writer = new StaxXmlWriter({
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument();
    writer.writeStartElement('document');

    writer.writeStartElement('paragraph');
    writer.writeCharacters('This is some text with ');
    writer.writeStartElement('br', { selfClosing: true });
    writer.writeCharacters(' a line break.');
    writer.writeEndElement(); // paragraph 닫기

    writer.writeStartElement('input', {
      attributes: {
        type: 'text',
        name: 'username',
        value: 'john_doe'
      },
      selfClosing: true
    });

    writer.writeEndElement(); // document 닫기

    writer.writeEndDocument();

    const result = writer.getXmlString();

    expect(result).toContain('<br/>');
    expect(result).toContain('<input type="text" name="username" value="john_doe"/>');
  });
});
