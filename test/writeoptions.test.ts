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

    await writer.writeStartDocument();
    await writer.writeStartElement('root');
    await writer.writeStartElement('child', {
      attributes: {
        id: '1',
        name: 'test',
        type: 'example'
      }
    });
    await writer.writeCharacters('Content');
    await writer.writeEndElement(); // child
    await writer.writeEndElement(); // root
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

    await writer.writeStartDocument();
    await writer.writeStartElement('root');
    await writer.writeStartElement('img', {
      attributes: {
        src: 'image.jpg',
        alt: 'Test image',
        width: '100'
      },
      selfClosing: true
    });
    await writer.writeEndElement(); // root
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

    await writer.writeStartDocument();
    await writer.writeStartElement('root');
    await writer.writeStartElement('meta', {
      prefix: 'ns',
      uri: 'http://example.com/namespace',
      attributes: {
        version: '1.0',
        type: 'test'
      },
      selfClosing: true
    });
    await writer.writeEndElement(); // root
    await writer.writeEndDocument();

    const result = outputStream.getResult();
    expect(result).toContain('<ns:meta xmlns:ns="http://example.com/namespace" version="1.0" type="test"/>');
  });

  it('should maintain backward compatibility with legacy API', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      prettyPrint: true,
      indentString: '  '
    });

    await writer.writeStartDocument();
    await writer.writeStartElement('root');
    await writer.writeStartElement('old', {
      prefix: 'ns', uri: 'http://example.com/ns', attributes: {
        id: '123',
        type: 'legacy'
      }
    });
    await writer.writeCharacters('Legacy content');
    await writer.writeEndElement(); // old
    await writer.writeEndElement(); // root
    await writer.writeEndDocument();

    const result = outputStream.getResult();
    expect(result).toContain('<ns:old xmlns:ns="http://example.com/ns" id="123" type="legacy">Legacy content</ns:old>');
  });

  it('should handle mixed new and legacy API usage', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      prettyPrint: true,
      indentString: '  '
    });

    await writer.writeStartDocument();
    await writer.writeStartElement('catalog', {
      attributes: { version: '2.0' }
    });

    // New API
    await writer.writeStartElement('product', {
      attributes: { id: '001', featured: 'true' }
    });
    await writer.writeStartElement('name');
    await writer.writeCharacters('Premium Laptop');
    await writer.writeEndElement();

    // Self-closing with new API
    await writer.writeStartElement('thumbnail', {
      attributes: {
        src: 'image.jpg',
        alt: 'Product Image'
      },
      selfClosing: true
    });

    // Legacy API
    await writer.writeStartElement('legacy', {
      prefix: 'old', uri: 'http://example.com/old', attributes: {
        test: 'value'
      }
    });
    await writer.writeCharacters('Legacy element');
    await writer.writeEndElement(); // legacy

    await writer.writeEndElement(); // product
    await writer.writeEndElement(); // catalog
    await writer.writeEndDocument();

    const result = outputStream.getResult();
    expect(result).toContain('<catalog version="2.0">');
    expect(result).toContain('<product id="001" featured="true">');
    expect(result).toContain('<thumbnail src="image.jpg" alt="Product Image"/>');
    expect(result).toContain('<old:legacy xmlns:old="http://example.com/old" test="value">Legacy element</old:legacy>');
  });

  it('should handle empty WriteElementOptions', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      prettyPrint: true,
      indentString: '  '
    });

    await writer.writeStartDocument();
    await writer.writeStartElement('root');
    await writer.writeStartElement('empty', {});
    await writer.writeCharacters('Content');
    await writer.writeEndElement(); // empty
    await writer.writeEndElement(); // root
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

    await writer.writeStartDocument();
    await writer.writeStartElement('root');
    await writer.writeStartElement('br', { selfClosing: true });
    await writer.writeEndElement(); // root
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

    await writer.writeStartDocument();
    await writer.writeStartElement('document', {
      prefix: 'doc',
      uri: 'http://example.com/document',
      attributes: { version: '2.0' }
    });

    await writer.writeStartElement('header', {
      attributes: { id: 'main-header' }
    });
    await writer.writeStartElement('title');
    await writer.writeCharacters('Test Document');
    await writer.writeEndElement(); // title

    await writer.writeStartElement('meta', {
      attributes: {
        name: 'author',
        content: 'Test Author'
      },
      selfClosing: true
    });

    await writer.writeEndElement(); // header

    await writer.writeStartElement('content');
    await writer.writeStartElement('section', {
      attributes: { class: 'main' }
    });
    await writer.writeCharacters('Main content');
    await writer.writeEndElement(); // section
    await writer.writeEndElement(); // content

    await writer.writeEndElement(); // document
    await writer.writeEndDocument();

    const result = outputStream.getResult();
    expect(result).toContain('<doc:document xmlns:doc="http://example.com/document" version="2.0">');
    expect(result).toContain('<header id="main-header">');
    expect(result).toContain('<meta name="author" content="Test Author"/>');
    expect(result).toContain('<section class="main">Main content</section>');
  });
});
