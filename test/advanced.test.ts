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

describe('StaxXmlParser Edge Cases and Error Handling', () => {
  it('should handle empty XML document', async () => {
    const emptyXml = `<?xml version="1.0"?>`;
    const inputStream = stringToReadableStream(emptyXml);
    const reader = new StaxXmlParser(inputStream);

    const events = [];
    for await (const event of reader) {
      events.push(event);
    }

    expect(events.length).toBe(2); // START_DOCUMENT, END_DOCUMENT
    expect(events[0].type).toBe(XmlEventType.START_DOCUMENT);
    expect(events[1].type).toBe(XmlEventType.END_DOCUMENT);
  });

  it('should handle XML with only root element', async () => {
    const simpleXml = `<?xml version="1.0"?><root></root>`;
    const inputStream = stringToReadableStream(simpleXml);
    const reader = new StaxXmlParser(inputStream);

    const events = [];
    for await (const event of reader) {
      events.push(event);
    }

    expect(events.length).toBe(4); // START_DOCUMENT, START_ELEMENT, END_ELEMENT, END_DOCUMENT
    expect(events[0].type).toBe(XmlEventType.START_DOCUMENT);
    expect(events[1].type).toBe(XmlEventType.START_ELEMENT);
    expect(events[2].type).toBe(XmlEventType.END_ELEMENT);
    expect(events[3].type).toBe(XmlEventType.END_DOCUMENT);
  });

  it('should throw error for unclosed tags', async () => {
    const unclosedXml = `<?xml version="1.0"?><root><element>content`;
    const inputStream = stringToReadableStream(unclosedXml);
    const reader = new StaxXmlParser(inputStream);

    let errorThrown = false;
    try {
      for await (const event of reader) {
        if (event.type === XmlEventType.ERROR) {
          errorThrown = true;
          break;
        }
      }
    } catch (err) {
      errorThrown = true;
    }

    expect(errorThrown).toBe(true);
  });

  it('should handle XML with special characters in attribute values', async () => {
    const xmlWithSpecialAttrs = `<?xml version="1.0"?>
<element attr1="value with &amp; ampersand" attr2="value with &lt; &gt; brackets" attr3="value with &quot;quotes&quot;">
</element>`;

    const inputStream = stringToReadableStream(xmlWithSpecialAttrs);
    const reader = new StaxXmlParser(inputStream);

    const events = [];
    for await (const event of reader) {
      events.push(event);
    }

    const startElement = events.find(e => e.type === XmlEventType.START_ELEMENT) as any;
    expect(startElement.attributes.attr1).toBe('value with & ampersand');
    expect(startElement.attributes.attr2).toBe('value with < > brackets');
    expect(startElement.attributes.attr3).toBe('value with "quotes"');
  });

  it('should handle very long content', async () => {
    const longContent = 'A'.repeat(10000);
    const xmlWithLongContent = `<?xml version="1.0"?><root><content>${longContent}</content></root>`;

    const inputStream = stringToReadableStream(xmlWithLongContent);
    const reader = new StaxXmlParser(inputStream);

    const events = [];
    for await (const event of reader) {
      events.push(event);
    }

    const charEvent = events.find(e => e.type === XmlEventType.CHARACTERS) as any;
    expect(charEvent.value).toBe(longContent);
  });

  it('should handle XML with multiple CDATA sections', async () => {
    const xmlWithMultipleCdata = `<?xml version="1.0"?>
<document>
  <script><![CDATA[
    var x = 1;
  ]]></script>
  <style><![CDATA[
    body { color: red; }
  ]]></style>
</document>`;

    const inputStream = stringToReadableStream(xmlWithMultipleCdata);
    const reader = new StaxXmlParser(inputStream);

    const events = [];
    for await (const event of reader) {
      events.push(event);
    }

    const cdataEvents = events.filter(e => e.type === XmlEventType.CDATA);
    expect(cdataEvents.length).toBe(2);
    expect((cdataEvents[0] as any).value).toContain('var x = 1;');
    expect((cdataEvents[1] as any).value).toContain('body { color: red; }');
  });
});

describe('StaxXmlWriter Advanced Features', () => {
  it('should write complex nested structure with pretty print', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  ',
    });

    await writer.writeStartDocument('1.0', 'utf-8');
    await writer.writeComment('Generated by StaxXmlWriter');

    await writer.writeStartElement('catalog');
    await writer.writeAttribute('version', '2.0');
    await writer.writeAttribute('xmlns', 'http://example.com/catalog');

    // First book
    await writer.writeStartElement('book');
    await writer.writeAttribute('id', 'book1');
    await writer.writeAttribute('category', 'fiction');

    await writer.writeStartElement('title');
    await writer.writeCharacters('The Great Adventure');
    await writer.writeEndElement(); // title

    await writer.writeStartElement('author');
    await writer.writeAttribute('nationality', 'American');
    await writer.writeCharacters('John Doe');
    await writer.writeEndElement(); // author

    await writer.writeStartElement('metadata');
    await writer.writeStartElement('published', {
      attributes: { 'year': '2020', 'month': 'March' },
      selfClosing: true
    });
    await writer.writeStartElement('isbn', {
      attributes: { 'format': 'paperback' },
      selfClosing: true
    });
    await writer.writeEndElement(); // metadata

    await writer.writeEndElement(); // book

    // Second book with self-closing elements
    await writer.writeStartElement('book');
    await writer.writeAttribute('id', 'book2');
    await writer.writeAttribute('category', 'technical');

    await writer.writeStartElement('title');
    await writer.writeCharacters('XML Processing Guide');
    await writer.writeEndElement(); // title

    await writer.writeStartElement('rating', {
      attributes: { stars: '5' },
      selfClosing: true
    }); // rating as self-closing

    await writer.writeEndElement(); // book
    await writer.writeEndElement(); // catalog

    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('<!-- Generated by StaxXmlWriter -->');
    expect(result).toContain('<catalog version="2.0" xmlns="http://example.com/catalog">');
    expect(result).toContain('<book id="book1" category="fiction">');
    expect(result).toContain('<title>The Great Adventure</title>');
    expect(result).toContain('<author nationality="American">John Doe</author>');
    expect(result).toContain('<published year="2020" month="March"/>');
    expect(result).toContain('<isbn format="paperback"/>');
    expect(result).toContain('<rating stars="5"/>');
  });

  it('should handle writing with different encodings', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
    });

    await writer.writeStartDocument('1.0', 'ISO-8859-1');
    await writer.writeStartElement('test');
    await writer.writeCharacters('Hello World');
    await writer.writeEndElement();

    await writer.writeEndDocument();

    const result = outputStream.getResult();
    expect(result).toContain('encoding="ISO-8859-1"');
    expect(result).toContain('<test>Hello World</test>');
  });

  it('should handle CDATA with special content', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
    });

    await writer.writeStartDocument();
    await writer.writeStartElement('script');
    await writer.writeAttribute('type', 'text/javascript');

    const jsCode = `
    function test() {
      if (x < y && y > z) {
        console.log("Hello & goodbye <world>");
        return a && b || c;
      }
    }
    `;

    await writer.writeCData(jsCode);
    await writer.writeEndElement(); // script

    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('<script type="text/javascript"><![CDATA[');
    expect(result).toContain(']]></script>');
    expect(result).toContain('if (x < y && y > z)');
    expect(result).toContain('console.log("Hello & goodbye <world>");');
  });

  it('should handle processing instructions', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
    });

    await writer.writeStartDocument();
    await writer.writeProcessingInstruction('xml-stylesheet', 'type="text/xsl" href="style.xsl"');
    await writer.writeProcessingInstruction('php', 'echo "Hello World"; ');

    await writer.writeStartElement('document');
    await writer.writeCharacters('Content');
    await writer.writeEndElement();

    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('<?xml-stylesheet type="text/xsl" href="style.xsl"?>');
    expect(result).toContain('<?php echo "Hello World"; ?>');
    expect(result).toContain('<document>Content</document>');
  });

  it('should handle method chaining', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
    });
    await writer.writeStartDocument();
    await writer.writeStartElement('chaining');
    await writer.writeAttribute('test', 'true');
    await writer.writeStartElement('nested');
    await writer.writeCharacters('Method chaining works!');
    await writer.writeEndElement();
    await writer.writeStartElement('empty', {
      attributes: { attr: 'value' },
      selfClosing: true
    });
    await writer.writeEndElement();
    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('<chaining test="true">');
    expect(result).toContain('<nested>Method chaining works!</nested>');
    expect(result).toContain('<empty attr="value"/>');
    expect(result).toContain('</chaining>');
  });

  it('should validate state transitions and throw appropriate errors', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: false,
    });

    // Test: Can't write attribute without start element
    await expect(writer.writeAttribute('attr', 'value')).rejects.toThrow('writeAttribute can only be called after writeStartElement');

    // Test: Can't write namespace without start element
    await expect(writer.writeNamespace('ns', 'http://example.com')).rejects.toThrow('writeNamespace can only be called after writeStartElement');

    // Test: Can't end element that's not opened
    await expect(writer.writeEndElement()).rejects.toThrow('No open element to close');

    // Test: Can't write start document twice
    await writer.writeStartDocument();
    await expect(writer.writeStartDocument()).rejects.toThrow('writeStartDocument can only be called once at the beginning');
  });
});
