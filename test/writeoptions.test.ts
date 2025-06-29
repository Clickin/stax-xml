import { describe, expect, it } from 'bun:test';
import StaxXmlWriter from '../src/StaxXmlWriter';

// 웹 표준 API용 헬퍼 함수들
class StringWritableStream extends WritableStream<Uint8Array> {
  private _data: string = '';

  constructor() {
    super({
      write: (chunk) => {
        this._data += new TextDecoder().decode(chunk);
      }
    });
  }

  getResult(): string {
    return this._data;
  }
}

describe('StaxXmlWriter WriteElementOptions API Tests', () => {
  it('should write element with attributes using WriteElementOptions', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument();
    writer.writeStartElement('root');
    writer.writeStartElement('child', {
      attributes: {
        id: '1',
        name: 'test',
        type: 'example'
      }
    });
    writer.writeCharacters('Content');
    writer.writeEndElement(); // child
    writer.writeEndElement(); // root
    await writer.writeEndDocument();

    const result = outputStream.getResult();
    expect(result).toContain('<child id="1" name="test" type="example">Content</child>');
  });

  it('should write self-closing element using WriteElementOptions', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument();
    writer.writeStartElement('root');
    writer.writeStartElement('img', {
      attributes: {
        src: 'image.jpg',
        alt: 'Test image',
        width: '100'
      },
      selfClosing: true
    });
    writer.writeEndElement(); // root
    await writer.writeEndDocument();

    const result = outputStream.getResult();
    expect(result).toContain('<img src="image.jpg" alt="Test image" width="100"/>');
    expect(result).not.toContain('</img>');
  });

  it('should write element with namespace and self-closing using WriteElementOptions', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument();
    writer.writeStartElement('root');
    writer.writeStartElement('meta', {
      prefix: 'ns',
      uri: 'http://example.com/namespace',
      attributes: {
        version: '1.0',
        type: 'test'
      },
      selfClosing: true
    });
    writer.writeEndElement(); // root
    await writer.writeEndDocument();

    const result = outputStream.getResult();
    expect(result).toContain('<ns:meta version="1.0" type="test" xmlns:ns="http://example.com/namespace"/>');
  });

  it('should maintain backward compatibility with legacy API', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument();
    writer.writeStartElement('root');
    writer.writeStartElement('old', {
      prefix: 'ns', uri: 'http://example.com/ns', attributes: {
        id: '123',
        type: 'legacy'
      }
    });
    writer.writeCharacters('Legacy content');
    writer.writeEndElement(); // old
    writer.writeEndElement(); // root
    await writer.writeEndDocument();

    const result = outputStream.getResult();
    expect(result).toContain('<ns:old id="123" type="legacy" xmlns:ns="http://example.com/ns">Legacy content</ns:old>');
  });

  it('should handle mixed new and legacy API usage', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument();
    writer.writeStartElement('catalog', {
      attributes: { version: '2.0' }
    });

    // New API
    writer.writeStartElement('product', {
      attributes: { id: '001', featured: 'true' }
    });
    writer.writeStartElement('name');
    writer.writeCharacters('Premium Laptop');
    writer.writeEndElement();

    // Self-closing with new API
    writer.writeStartElement('thumbnail', {
      attributes: {
        src: 'image.jpg',
        alt: 'Product Image'
      },
      selfClosing: true
    });

    // Legacy API
    writer.writeStartElement('legacy', {
      prefix: 'old', uri: 'http://example.com/old', attributes: {
        test: 'value'
      }
    });
    writer.writeCharacters('Legacy element');
    writer.writeEndElement(); // legacy

    writer.writeEndElement(); // product
    writer.writeEndElement(); // catalog
    await writer.writeEndDocument();

    const result = outputStream.getResult();
    expect(result).toContain('<catalog version="2.0">');
    expect(result).toContain('<product id="001" featured="true">');
    expect(result).toContain('<thumbnail src="image.jpg" alt="Product Image"/>');
    expect(result).toContain('<old:legacy test="value" xmlns:old="http://example.com/old">Legacy element</old:legacy>');
  });

  it('should handle empty WriteElementOptions', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument();
    writer.writeStartElement('root');
    writer.writeStartElement('empty', {});
    writer.writeCharacters('Content');
    writer.writeEndElement(); // empty
    writer.writeEndElement(); // root
    await writer.writeEndDocument();

    const result = outputStream.getResult();
    expect(result).toContain('<empty>Content</empty>');
  });

  it('should handle only selfClosing option', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument();
    writer.writeStartElement('root');
    writer.writeStartElement('br', { selfClosing: true });
    writer.writeEndElement(); // root
    await writer.writeEndDocument();

    const result = outputStream.getResult();
    expect(result).toContain('<br/>');
  });

  it('should handle complex nested structure with WriteElementOptions', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument();
    writer.writeStartElement('document', {
      prefix: 'doc',
      uri: 'http://example.com/document',
      attributes: { version: '2.0' }
    });

    writer.writeStartElement('header', {
      attributes: { id: 'main-header' }
    });
    writer.writeStartElement('title');
    writer.writeCharacters('Test Document');
    writer.writeEndElement(); // title

    writer.writeStartElement('meta', {
      attributes: {
        name: 'author',
        content: 'Test Author'
      },
      selfClosing: true
    });

    writer.writeEndElement(); // header

    writer.writeStartElement('content');
    writer.writeStartElement('section', {
      attributes: { class: 'main' }
    });
    writer.writeCharacters('Main content');
    writer.writeEndElement(); // section
    writer.writeEndElement(); // content

    writer.writeEndElement(); // document
    await writer.writeEndDocument();

    const result = outputStream.getResult();
    expect(result).toContain('<doc:document version="2.0" xmlns:doc="http://example.com/document">');
    expect(result).toContain('<header id="main-header">');
    expect(result).toContain('<meta name="author" content="Test Author"/>');
    expect(result).toContain('<section class="main">Main content</section>');
  });
});
