import { describe, expect, it } from 'bun:test';
import { StaxXmlWriter } from '../src/StaxXmlWriter';

// WritableStream을 메모리에서 구현하는 헬퍼 함수
function createMemoryWritableStream(): { stream: WritableStream<Uint8Array>; getOutput: () => string } {
  const chunks: Uint8Array[] = [];
  const decoder = new TextDecoder();

  const stream = new WritableStream<Uint8Array>({
    write(chunk) {
      chunks.push(chunk);
    },
    close() {
      // Stream closed
    }
  });

  const getOutput = () => {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return decoder.decode(combined);
  };

  return { stream, getOutput };
}

// JavaScript 객체를 XML로 변환하는 async 헬퍼 함수
async function objectToXmlAsync(obj: any, prettyPrint: boolean = true, indentString: string = '  '): Promise<string> {
  const { stream, getOutput } = createMemoryWritableStream();

  const writer = new StaxXmlWriter(stream, {
    encoding: 'utf-8',
    prettyPrint: prettyPrint,
    indentString: indentString
  });

  await writer.writeStartDocument('1.0', 'utf-8');
  await writeElementAsync(writer, obj);
  await writer.writeEndDocument();

  return getOutput();
}

// 재귀적으로 요소를 작성하는 async 헬퍼 함수
async function writeElementAsync(writer: StaxXmlWriter, element: any): Promise<void> {
  await writer.writeStartElement(element.name);

  // 속성 작성
  if (element.attributes) {
    for (const [key, value] of Object.entries(element.attributes)) {
      // attributes는 writeStartElement 옵션에서 처리
    }
  }

  // 텍스트 콘텐츠가 있는 경우
  if (element.text && element.text.trim()) {
    if (element.cdata) {
      await writer.writeCData(element.text);
    } else {
      await writer.writeCharacters(element.text);
    }
  }

  // 자식 요소들 작성
  if (element.children && element.children.length > 0) {
    for (const child of element.children) {
      await writeElementAsync(writer, child);
    }
  }

  await writer.writeEndElement();
}

describe('StaxXmlWriter Basic Functionality Tests', () => {
  it('should write simple XML with elements and text', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    await writer.writeStartDocument('1.0', 'utf-8');
    await writer.writeStartElement('note');

    await writer.writeStartElement('to');
    await writer.writeCharacters('Tove');
    await writer.writeEndElement(); // to

    await writer.writeStartElement('from');
    await writer.writeCharacters('Jani');
    await writer.writeEndElement(); // from

    await writer.writeStartElement('heading');
    await writer.writeCharacters('Reminder');
    await writer.writeEndElement(); // heading

    await writer.writeStartElement('body');
    await writer.writeCharacters("Don't forget me this weekend!");
    await writer.writeEndElement(); // body

    await writer.writeEndElement(); // note
    await writer.writeEndDocument();

    const result = getOutput();
    const expectedXml = `<?xml version="1.0" encoding="UTF-8"?>
<note>
  <to>Tove</to>
  <from>Jani</from>
  <heading>Reminder</heading>
  <body>Don&apos;t forget me this weekend!</body>
</note>`;

    expect(result.trim()).toBe(expectedXml.trim());
  });

  it('should write XML with attributes', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    await writer.writeStartDocument('1.0', 'utf-8');
    await writer.writeStartElement('catalog');

    await writer.writeStartElement('book', {
      attributes: { id: 'bk101', category: 'Computer' }
    });

    await writer.writeStartElement('author');
    await writer.writeCharacters('Gambardella, Matthew');
    await writer.writeEndElement(); // author

    await writer.writeStartElement('title');
    await writer.writeCharacters("XML Developer's Guide");
    await writer.writeEndElement(); // title

    await writer.writeStartElement('genre');
    await writer.writeCharacters('Computer');
    await writer.writeEndElement(); // genre

    await writer.writeStartElement('price', {
      attributes: { currency: 'USD' }
    });
    await writer.writeCharacters('44.95');
    await writer.writeEndElement(); // price

    await writer.writeEndElement(); // book
    await writer.writeEndElement(); // catalog
    await writer.writeEndDocument();

    const result = getOutput();
    const expectedXml = `<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <book id="bk101" category="Computer">
    <author>Gambardella, Matthew</author>
    <title>XML Developer&apos;s Guide</title>
    <genre>Computer</genre>
    <price currency="USD">44.95</price>
  </book>
</catalog>`;

    expect(result.trim()).toBe(expectedXml.trim());
  });

  it('should write nested XML structure', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    await writer.writeStartDocument('1.0', 'utf-8');
    await writer.writeStartElement('library', {
      attributes: { name: 'Central Library', location: 'Downtown' }
    });

    await writer.writeStartElement('section', {
      attributes: { type: 'Fiction', floor: '2' }
    });

    await writer.writeStartElement('book', {
      attributes: { isbn: '123-456-789', available: 'true' }
    });

    await writer.writeStartElement('title');
    await writer.writeCharacters('The Great Adventure');
    await writer.writeEndElement(); // title

    await writer.writeStartElement('author', {
      attributes: { nationality: 'American' }
    });
    await writer.writeCharacters('John Doe');
    await writer.writeEndElement(); // author

    await writer.writeEndElement(); // book
    await writer.writeEndElement(); // section

    await writer.writeStartElement('section', {
      attributes: { type: 'Non-Fiction', floor: '3' }
    });

    await writer.writeStartElement('book', {
      attributes: { isbn: '987-654-321', available: 'false' }
    });

    await writer.writeStartElement('title');
    await writer.writeCharacters('Science Today');
    await writer.writeEndElement(); // title

    await writer.writeStartElement('author', {
      attributes: { nationality: 'British' }
    });
    await writer.writeCharacters('Jane Smith');
    await writer.writeEndElement(); // author

    await writer.writeEndElement(); // book
    await writer.writeEndElement(); // section

    await writer.writeEndElement(); // library
    await writer.writeEndDocument();

    const result = getOutput();
    const expectedXml = `<?xml version="1.0" encoding="UTF-8"?>
<library name="Central Library" location="Downtown">
  <section type="Fiction" floor="2">
    <book isbn="123-456-789" available="true">
      <title>The Great Adventure</title>
      <author nationality="American">John Doe</author>
    </book>
  </section>
  <section type="Non-Fiction" floor="3">
    <book isbn="987-654-321" available="false">
      <title>Science Today</title>
      <author nationality="British">Jane Smith</author>
    </book>
  </section>
</library>`;

    expect(result.trim()).toBe(expectedXml.trim());
  });

  it('should write XML with CDATA sections', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    await writer.writeStartDocument('1.0', 'utf-8');
    await writer.writeStartElement('document');

    await writer.writeStartElement('script', {
      attributes: { type: 'text/javascript' }
    });

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

    await writer.writeStartElement('text');
    await writer.writeCharacters('Regular text');
    await writer.writeEndElement(); // text

    await writer.writeEndElement(); // document
    await writer.writeEndDocument();

    const result = getOutput();
    const expectedXml = `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <script type="text/javascript"><![CDATA[
    function test() {
      if (x < y && y > z) {
        console.log("Hello & goodbye <world>");
        return a && b || c;
      }
    }
  ]]></script>
  <text>Regular text</text>
</document>`;

    expect(result.trim()).toBe(expectedXml.trim());
  });

  it('should write XML with special characters (properly escaped)', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    await writer.writeStartDocument('1.0', 'utf-8');
    await writer.writeStartElement('document');

    await writer.writeStartElement('text');
    await writer.writeCharacters('Less than < greater than >');
    await writer.writeEndElement(); // text

    await writer.writeStartElement('text');
    await writer.writeCharacters('Ampersand & quotes "hello"');
    await writer.writeEndElement(); // text

    await writer.writeStartElement('text');
    await writer.writeCharacters("Apostrophe 'world'");
    await writer.writeEndElement(); // text

    await writer.writeStartElement('attribute-test', {
      attributes: { attr: 'value with & ampersand' }
    });
    await writer.writeEndElement(); // attribute-test

    await writer.writeEndElement(); // document
    await writer.writeEndDocument();

    const result = getOutput();
    const expectedXml = `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <text>Less than &lt; greater than &gt;</text>
  <text>Ampersand &amp; quotes &quot;hello&quot;</text>
  <text>Apostrophe &apos;world&apos;</text>
  <attribute-test attr="value with &amp; ampersand"></attribute-test>
</document>`;

    expect(result.trim()).toBe(expectedXml.trim());
  });

  it('should write self-closing elements', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    await writer.writeStartDocument('1.0', 'utf-8');
    await writer.writeStartElement('document');

    // Self-closing element with attributes
    await writer.writeStartElement('input', {
      attributes: {
        type: 'text',
        name: 'username'
      },
      selfClosing: true
    });

    // Self-closing element with more attributes
    await writer.writeStartElement('img', {
      attributes: {
        src: 'image.jpg',
        alt: 'A beautiful image',
        width: '100'
      },
      selfClosing: true
    });

    await writer.writeEndElement(); // document
    await writer.writeEndDocument();

    const result = getOutput();

    expect(result).toContain('<document>');
    expect(result).toContain('</document>');
    expect(result).toContain('<input type="text" name="username"/>');
    expect(result).toContain('<img src="image.jpg" alt="A beautiful image" width="100"/>');
  });

  it('should write XML without pretty print (compact)', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: false
    });

    await writer.writeStartDocument('1.0', 'utf-8');
    await writer.writeStartElement('note');

    await writer.writeStartElement('to');
    await writer.writeCharacters('Tove');
    await writer.writeEndElement(); // to

    await writer.writeStartElement('from');
    await writer.writeCharacters('Jani');
    await writer.writeEndElement(); // from

    await writer.writeEndElement(); // note
    await writer.writeEndDocument();

    const result = getOutput();

    // 줄바꿈이나 들여쓰기가 없어야 함 (XML 선언 후 제외)
    const lines = result.split('\n');
    expect(lines.length).toBeLessThanOrEqual(2); // XML 선언 + 모든 내용이 한 줄에
    expect(result).toContain('<note><to>Tove</to><from>Jani</from></note>');
  });

  it('should handle processing instructions and comments', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    await writer.writeStartDocument('1.0', 'utf-8');
    await writer.writeComment('This is a document comment');

    await writer.writeStartElement('document');
    await writer.writeComment('This is an element comment');

    await writer.writeStartElement('content');
    await writer.writeCharacters('Hello World');
    await writer.writeEndElement(); // content

    await writer.writeEndElement(); // document
    await writer.writeEndDocument();

    const result = getOutput();

    expect(result).toContain('<!-- This is a document comment -->');
    expect(result).toContain('<!-- This is an element comment -->');
    expect(result).toContain('<content>Hello World</content>');
  });

  // XML 기본 엔티티 5종 이스케이프 테스트
  it('should escape XML basic entities in text content', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    await writer.writeStartDocument('1.0', 'utf-8');
    await writer.writeStartElement('data');

    // 기본 XML 엔티티 5종 테스트: & < > " '
    await writer.writeCharacters('5 < 10 & 20 > 15 "quoted" \'apostrophe\'');

    await writer.writeEndElement(); // data
    await writer.writeEndDocument();

    const result = getOutput();

    expect(result).toContain('<data>5 &lt; 10 &amp; 20 &gt; 15 &quot;quoted&quot; &apos;apostrophe&apos;</data>');
  });

  // 속성에서의 엔티티 이스케이프 테스트
  it('should escape XML entities in attributes', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    await writer.writeStartDocument('1.0', 'utf-8');
    await writer.writeStartElement('element', {
      attributes: {
        'attr1': 'He said "Hello"',
        'attr2': "It's fine",
        'attr3': 'Less than < and greater than >',
        'attr4': 'Ampersand & symbol'
      },
      selfClosing: true
    });
    await writer.writeEndDocument();

    const result = getOutput();

    expect(result).toContain('attr1="He said &quot;Hello&quot;"');
    expect(result).toContain('attr2="It&apos;s fine"');
    expect(result).toContain('attr3="Less than &lt; and greater than &gt;"');
    expect(result).toContain('attr4="Ampersand &amp; symbol"');
  });

  // 사용자 정의 엔티티 테스트
  it('should handle custom entities', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  ',
      addEntities: [
        { entity: '©', value: '&copy;' },
        { entity: '®', value: '&reg;' },
        { entity: '™', value: '&trade;' },
        { entity: '€', value: '&euro;' }
      ]
    });

    await writer.writeStartDocument('1.0', 'utf-8');
    await writer.writeStartElement('document');

    // 사용자 정의 엔티티 포함 텍스트
    await writer.writeCharacters('Copyright © 2024, Registered ® Trademark ™, Price: 100€');

    await writer.writeEndElement(); // document
    await writer.writeEndDocument();

    const result = getOutput();

    expect(result).toContain('Copyright &copy; 2024, Registered &reg; Trademark &trade;, Price: 100&euro;');
  });

  // 엔티티 자동 인코딩 비활성화 테스트
  it('should not escape entities when autoEncodeEntities is disabled', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  ',
      autoEncodeEntities: false
    });

    await writer.writeStartDocument('1.0', 'utf-8');
    await writer.writeStartElement('data');

    // 자동 인코딩이 비활성화되어 있으므로 원본 그대로 출력되어야 함
    await writer.writeCharacters('5 < 10 & 20 > 15');

    await writer.writeEndElement(); // data
    await writer.writeEndDocument();

    const result = getOutput();

    expect(result).toContain('<data>5 < 10 & 20 > 15</data>');
  });
});

describe('StaxXmlWriter Async-Specific Tests', () => {
  it('should handle buffer management and auto flush', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: false,
      bufferSize: 100,        // 작은 버퍼 크기
      flushThreshold: 80,     // 80바이트에서 플러시
      enableAutoFlush: true
    });

    await writer.writeStartDocument('1.0', 'utf-8');
    await writer.writeStartElement('data');

    // 버퍼 크기를 초과하는 긴 텍스트 작성
    const longText = 'A'.repeat(150);
    await writer.writeCharacters(longText);

    await writer.writeEndElement(); // data
    await writer.writeEndDocument();

    const result = getOutput();
    expect(result).toContain(`<data>${longText}</data>`);

    // 메트릭 확인
    const metrics = writer.getMetrics();
    expect(metrics.totalBytesWritten).toBeGreaterThan(0);
    expect(metrics.flushCount).toBeGreaterThan(0);
  });

  it('should handle manual flush', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: false,
      bufferSize: 1000,
      enableAutoFlush: false  // 자동 플러시 비활성화
    });

    await writer.writeStartDocument('1.0', 'utf-8');
    await writer.writeStartElement('test');
    await writer.writeCharacters('Some content');

    // 수동 플러시
    await writer.flush();

    const partialResult = getOutput();
    expect(partialResult).toContain('<test>Some content');

    await writer.writeEndElement(); // test
    await writer.writeEndDocument();

    const finalResult = getOutput();
    expect(finalResult).toContain('<test>Some content</test>');
  });

  it('should handle large data chunks that exceed buffer size', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: false,
      bufferSize: 50  // 매우 작은 버퍼
    });

    await writer.writeStartDocument('1.0', 'utf-8');
    await writer.writeStartElement('large');

    // 버퍼보다 훨씬 큰 단일 청크
    const veryLongText = 'X'.repeat(200);
    await writer.writeCharacters(veryLongText);

    await writer.writeEndElement(); // large
    await writer.writeEndDocument();

    const result = getOutput();
    expect(result).toContain(`<large>${veryLongText}</large>`);

    // 큰 청크가 직접 스트림에 쓰여졌는지 메트릭으로 확인
    const metrics = writer.getMetrics();
    expect(metrics.totalBytesWritten).toBeGreaterThan(200);
  });

  it('should track metrics correctly', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true,
      bufferSize: 100,
      flushThreshold: 50
    });

    // 초기 메트릭
    let metrics = writer.getMetrics();
    expect(metrics.totalBytesWritten).toBe(0);
    expect(metrics.flushCount).toBe(0);
    expect(metrics.bufferUtilization).toBe(0);

    await writer.writeStartDocument('1.0', 'utf-8');
    await writer.writeStartElement('metrics');
    await writer.writeCharacters('Testing metrics');
    await writer.writeEndElement();
    await writer.writeEndDocument();

    // 최종 메트릭
    metrics = writer.getMetrics();
    expect(metrics.totalBytesWritten).toBeGreaterThan(0);
    expect(metrics.flushCount).toBeGreaterThan(0);
    expect(metrics.averageFlushSize).toBeGreaterThan(0);
  });

  it('should handle different buffer configurations', async () => {
    // 높은 flushThreshold 테스트
    const { stream: stream1, getOutput: getOutput1 } = createMemoryWritableStream();
    const writer1 = new StaxXmlWriter(stream1, {
      encoding: 'utf-8',
      prettyPrint: false,
      bufferSize: 200,
      flushThreshold: 0.9, // 90% 차면 플러시
      enableAutoFlush: true
    });

    await writer1.writeStartDocument();
    await writer1.writeStartElement('test');
    await writer1.writeCharacters('A'.repeat(100)); // 50% 채움
    await writer1.writeEndElement();
    await writer1.writeEndDocument();

    const result1 = getOutput1();
    expect(result1).toContain('<test>' + 'A'.repeat(100) + '</test>');

    // 낮은 flushThreshold 테스트
    const { stream: stream2, getOutput: getOutput2 } = createMemoryWritableStream();
    const writer2 = new StaxXmlWriter(stream2, {
      encoding: 'utf-8',
      prettyPrint: false,
      bufferSize: 200,
      flushThreshold: 100, // 절대값으로 100바이트
      enableAutoFlush: true
    });

    await writer2.writeStartDocument();
    await writer2.writeStartElement('test');
    await writer2.writeCharacters('B'.repeat(150));
    await writer2.writeEndElement();
    await writer2.writeEndDocument();

    const result2 = getOutput2();
    expect(result2).toContain('<test>' + 'B'.repeat(150) + '</test>');
  });
});

describe('StaxXmlWriter Namespace and Advanced Tests', () => {
  it('should write elements with namespaces', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    await writer.writeStartDocument();
    await writer.writeStartElement('root');

    // Element with namespace prefix
    await writer.writeStartElement('item', {
      prefix: 'ns1',
      uri: 'http://example.com/ns1'
    });
    await writer.writeCharacters('Content with namespace');
    await writer.writeEndElement(); // Should close as </ns1:item>

    // Element without namespace
    await writer.writeStartElement('simple');
    await writer.writeCharacters('Simple content');
    await writer.writeEndElement(); // Should close as </simple>

    // Nested namespaced elements
    await writer.writeStartElement('section', {
      prefix: 'ns2',
      uri: 'http://example.com/ns2'
    });
    await writer.writeStartElement('title', {
      prefix: 'ns2',
      uri: 'http://example.com/ns2'
    });
    await writer.writeCharacters('Nested title');
    await writer.writeEndElement(); // Should close as </ns2:title>
    await writer.writeEndElement(); // Should close as </ns2:section>

    await writer.writeEndElement(); // Close root
    await writer.writeEndDocument();

    const result = getOutput();

    expect(result).toContain('<ns1:item xmlns:ns1="http://example.com/ns1">Content with namespace</ns1:item>');
    expect(result).toContain('<simple>Simple content</simple>');
    expect(result).toContain('<ns2:section xmlns:ns2="http://example.com/ns2">');
    expect(result).toContain('<ns2:title xmlns:ns2="http://example.com/ns2">Nested title</ns2:title>');
    expect(result).toContain('</ns2:section>');
    expect(result).toContain('</root>');
  });

  it('should write self-closing element with namespace and attributes', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    await writer.writeStartDocument('1.0', 'utf-8');
    await writer.writeStartElement('root');

    // self-closing 요소 테스트 (prefix, uri, attributes 포함)
    await writer.writeStartElement('emptyTag', {
      prefix: 'ns',
      uri: 'http://example.com/namespace',
      attributes: {
        attr1: 'value1',
        attr2: { value: 'value2', prefix: 'ns' }
      },
      selfClosing: true
    });

    await writer.writeEndElement(); // root
    await writer.writeEndDocument();

    const result = getOutput();

    expect(result).toContain('<ns:emptyTag xmlns:ns="http://example.com/namespace"');
    expect(result).toContain('attr1="value1"');
    expect(result).toContain('ns:attr2="value2"');
    expect(result).toContain('/>');
  });

  it('should handle complex attributes with prefixes', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    await writer.writeStartDocument();
    await writer.writeStartElement('root');

    await writer.writeStartElement('element', {
      prefix: 'test',
      uri: 'http://test.com',
      attributes: {
        'normal': 'normalValue',
        'prefixed': { value: 'prefixedValue', prefix: 'test' },
        'another': { value: 'anotherValue', prefix: 'test' }
      }
    });

    await writer.writeCharacters('Content');
    await writer.writeEndElement();
    await writer.writeEndElement();
    await writer.writeEndDocument();

    const result = getOutput();

    expect(result).toContain('<test:element xmlns:test="http://test.com"');
    expect(result).toContain('normal="normalValue"');
    expect(result).toContain('test:prefixed="prefixedValue"');
    expect(result).toContain('test:another="anotherValue"');
    expect(result).toContain('>Content</test:element>');
  });
});

describe('StaxXmlWriter Error Handling Tests', () => {
  it('should throw error when CDATA contains ]]>', async () => {
    const { stream } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true
    });

    await writer.writeStartDocument();
    await writer.writeStartElement('test');

    await expect(writer.writeCData('Invalid ]]> sequence')).rejects.toThrow(
      'CDATA section cannot contain "]]>" sequence'
    );
  });

  it('should throw error when comment contains --', async () => {
    const { stream } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true
    });

    await writer.writeStartDocument();

    await expect(writer.writeComment('Invalid -- sequence')).rejects.toThrow(
      'XML comment cannot contain "--" sequence'
    );
  });

  it('should throw error when writeStartDocument is called twice', async () => {
    const { stream } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true
    });

    await writer.writeStartDocument();

    await expect(writer.writeStartDocument()).rejects.toThrow(
      'writeStartDocument can only be called once at the beginning'
    );
  });

  it('should throw error when no element to close', async () => {
    const { stream } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true
    });

    await writer.writeStartDocument();

    await expect(writer.writeEndElement()).rejects.toThrow(
      'No open element to close'
    );
  });

  it('should throw error when writing to closed writer', async () => {
    const { stream } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true
    });

    await writer.writeStartDocument();
    await writer.writeStartElement('root');
    await writer.writeEndElement();
    await writer.writeEndDocument(); // Writer is now closed

    await expect(writer.writeStartElement('test')).rejects.toThrow(
      'Cannot writeStartElement: Writer is closed or in error state'
    );
  });

  it('should throw error when undefined namespace prefix is used in attributes', async () => {
    const { stream } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: true
    });

    await writer.writeStartDocument();
    await writer.writeStartElement('root');

    await expect(writer.writeStartElement('element', {
      attributes: {
        'test': { value: 'value', prefix: 'undefined_prefix' }
      }
    })).rejects.toThrow(
      'Namespace prefix \'undefined_prefix\' is not defined'
    );
  });
});

describe('StaxXmlWriter Performance Tests', () => {
  it('should handle large XML documents efficiently', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: false,
      bufferSize: 1024 * 16 // 16KB buffer
    });

    await writer.writeStartDocument();
    await writer.writeStartElement('large-document');

    const startTime = Date.now();

    // 대량의 요소 생성
    for (let i = 0; i < 1000; i++) {
      await writer.writeStartElement('item', {
        attributes: { id: i.toString(), type: 'test' }
      });
      await writer.writeCharacters(`Content for item ${i}`);
      await writer.writeEndElement();
    }

    await writer.writeEndElement();
    await writer.writeEndDocument();

    const endTime = Date.now();
    const result = getOutput();

    // 성능 검증
    expect(endTime - startTime).toBeLessThan(5000); // 5초 이내
    expect(result).toContain('<item id="0" type="test">Content for item 0</item>');
    expect(result).toContain('<item id="999" type="test">Content for item 999</item>');

    // 메트릭 검증
    const metrics = writer.getMetrics();
    expect(metrics.totalBytesWritten).toBeGreaterThan(10000); // 최소 10KB
    expect(metrics.flushCount).toBeGreaterThan(1); // 여러 번 플러시됨
  });

  it('should handle very large text content', async () => {
    const { stream, getOutput } = createMemoryWritableStream();
    const writer = new StaxXmlWriter(stream, {
      encoding: 'utf-8',
      prettyPrint: false,
      bufferSize: 1024 // 1KB buffer
    });

    await writer.writeStartDocument();
    await writer.writeStartElement('large-text');

    // 1MB 텍스트 생성
    const largeText = 'A'.repeat(1024 * 1024);
    await writer.writeCharacters(largeText);

    await writer.writeEndElement();
    await writer.writeEndDocument();

    const result = getOutput();
    expect(result).toContain(`<large-text>${largeText}</large-text>`);

    // 메트릭 검증
    const metrics = writer.getMetrics();
    expect(metrics.totalBytesWritten).toBeGreaterThan(1024 * 1024); // 1MB 이상
  });
});