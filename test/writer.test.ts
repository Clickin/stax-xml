import { describe, expect, it } from 'bun:test';
import StaxXmlWriter from '../src/StaxXmlWriter';

// 웹 표준 API용 헬퍼 함수
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

// JavaScript 객체를 XML로 변환하는 함수
async function objectToXml(obj: any, prettyPrint: boolean = true, indentString: string = '  '): Promise<string> {
  const outputStream = new StringWritableStream();
  const writer = new StaxXmlWriter(outputStream, {
    encoding: 'utf-8',
    prettyPrint: prettyPrint,
    indentString: indentString
  });

  writer.writeStartDocument('1.0', 'utf-8');

  await writeElement(writer, obj);

  await writer.writeEndDocument();
  return outputStream.getResult();
}

// 재귀적으로 요소를 작성하는 헬퍼 함수
async function writeElement(writer: StaxXmlWriter, element: any): Promise<void> {
  writer.writeStartElement(element.name);

  // 속성 작성
  if (element.attributes) {
    for (const [key, value] of Object.entries(element.attributes)) {
      writer.writeAttribute(key, value as string);
    }
  }

  // 텍스트 콘텐츠가 있는 경우
  if (element.text && element.text.trim()) {
    if (element.cdata) {
      writer.writeCData(element.text);
    } else {
      writer.writeCharacters(element.text);
    }
  }

  // 자식 요소들 작성
  if (element.children && element.children.length > 0) {
    for (const child of element.children) {
      await writeElement(writer, child);
    }
  }

  writer.writeEndElement();
}

describe('StaxXmlWriter Tests', () => {
  it('should write simple XML with elements and text', async () => {
    const obj = {
      name: 'note',
      attributes: {},
      children: [
        { name: 'to', attributes: {}, text: 'Tove', children: [] },
        { name: 'from', attributes: {}, text: 'Jani', children: [] },
        { name: 'heading', attributes: {}, text: 'Reminder', children: [] },
        { name: 'body', attributes: {}, text: "Don't forget me this weekend!", children: [] }
      ],
      text: ''
    };

    const expectedXml = `<?xml version="1.0" encoding="UTF-8"?>
<note>
  <to>Tove</to>
  <from>Jani</from>
  <heading>Reminder</heading>
  <body>Don&apos;t forget me this weekend!</body>
</note>`;

    const result = await objectToXml(obj);

    expect(result.trim()).toBe(expectedXml.trim());
  });

  it('should write XML with attributes', async () => {
    const obj = {
      name: 'catalog',
      attributes: {},
      children: [
        {
          name: 'book',
          attributes: { id: 'bk101', category: 'Computer' },
          children: [
            { name: 'author', attributes: {}, text: 'Gambardella, Matthew', children: [] },
            { name: 'title', attributes: {}, text: "XML Developer's Guide", children: [] },
            { name: 'genre', attributes: {}, text: 'Computer', children: [] },
            { name: 'price', attributes: { currency: 'USD' }, text: '44.95', children: [] }
          ],
          text: ''
        }
      ],
      text: ''
    };

    const expectedXml = `<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <book id="bk101" category="Computer">
    <author>Gambardella, Matthew</author>
    <title>XML Developer&apos;s Guide</title>
    <genre>Computer</genre>
    <price currency="USD">44.95</price>
  </book>
</catalog>`;

    const result = await objectToXml(obj);

    expect(result.trim()).toBe(expectedXml.trim());
  });

  it('should write nested XML structure', async () => {
    const obj = {
      name: 'library',
      attributes: { name: 'Central Library', location: 'Downtown' },
      children: [
        {
          name: 'section',
          attributes: { type: 'Fiction', floor: '2' },
          children: [
            {
              name: 'book',
              attributes: { isbn: '123-456-789', available: 'true' },
              children: [
                { name: 'title', attributes: {}, text: 'The Great Adventure', children: [] },
                { name: 'author', attributes: { nationality: 'American' }, text: 'John Doe', children: [] }
              ],
              text: ''
            }
          ],
          text: ''
        },
        {
          name: 'section',
          attributes: { type: 'Non-Fiction', floor: '3' },
          children: [
            {
              name: 'book',
              attributes: { isbn: '987-654-321', available: 'false' },
              children: [
                { name: 'title', attributes: {}, text: 'Science Today', children: [] },
                { name: 'author', attributes: { nationality: 'British' }, text: 'Jane Smith', children: [] }
              ],
              text: ''
            }
          ],
          text: ''
        }
      ],
      text: ''
    };

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

    const result = await objectToXml(obj);

    expect(result.trim()).toBe(expectedXml.trim());
  });

  it('should write XML with CDATA sections', async () => {
    const obj = {
      name: 'document',
      attributes: {},
      children: [
        {
          name: 'script',
          attributes: { type: 'text/javascript' },
          text: `
    function test() {
      if (x < y && y > z) {
        console.log("Hello & goodbye <world>");
        return a && b || c;
      }
    }
  `,
          cdata: true,
          children: []
        },
        { name: 'text', attributes: {}, text: 'Regular text', children: [] }
      ],
      text: ''
    };

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

    const result = await objectToXml(obj);

    expect(result.trim()).toBe(expectedXml.trim());
  });

  it('should write XML with special characters (properly escaped)', async () => {
    const obj = {
      name: 'document',
      attributes: {},
      children: [
        { name: 'text', attributes: {}, text: 'Less than < greater than >', children: [] },
        { name: 'text', attributes: {}, text: 'Ampersand & quotes "hello"', children: [] },
        { name: 'text', attributes: {}, text: "Apostrophe 'world'", children: [] },
        { name: 'attribute-test', attributes: { attr: 'value with & ampersand' }, text: '', children: [] }
      ],
      text: ''
    };

    const expectedXml = `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <text>Less than &lt; greater than &gt;</text>
  <text>Ampersand &amp; quotes &quot;hello&quot;</text>
  <text>Apostrophe &apos;world&apos;</text>
  <attribute-test attr="value with &amp; ampersand"></attribute-test>
</document>`;

    const result = await objectToXml(obj);

    expect(result.trim()).toBe(expectedXml.trim());
  });

  it('should write large Microsoft catalog sample', async () => {
    const obj = {
      name: 'catalog',
      attributes: {},
      children: [
        {
          name: 'book',
          attributes: { id: 'bk101' },
          children: [
            { name: 'author', attributes: {}, text: 'Gambardella, Matthew', children: [] },
            { name: 'title', attributes: {}, text: "XML Developer's Guide", children: [] },
            { name: 'genre', attributes: {}, text: 'Computer', children: [] },
            { name: 'price', attributes: {}, text: '44.95', children: [] },
            { name: 'publish_date', attributes: {}, text: '2000-10-01', children: [] },
            { name: 'description', attributes: {}, text: 'An in-depth look at creating applications with XML.', children: [] }
          ],
          text: ''
        },
        {
          name: 'book',
          attributes: { id: 'bk102' },
          children: [
            { name: 'author', attributes: {}, text: 'Ralls, Kim', children: [] },
            { name: 'title', attributes: {}, text: 'Midnight Rain', children: [] },
            { name: 'genre', attributes: {}, text: 'Fantasy', children: [] },
            { name: 'price', attributes: {}, text: '5.95', children: [] },
            { name: 'publish_date', attributes: {}, text: '2000-12-16', children: [] },
            { name: 'description', attributes: {}, text: 'A former architect battles corporate zombies, an evil sorceress, and her own childhood to become queen of the world.', children: [] }
          ],
          text: ''
        },
        {
          name: 'book',
          attributes: { id: 'bk110' },
          children: [
            { name: 'author', attributes: {}, text: "O'Brien, Tim", children: [] },
            { name: 'title', attributes: {}, text: 'Microsoft .NET: The Programming Bible', children: [] },
            { name: 'genre', attributes: {}, text: 'Computer', children: [] },
            { name: 'price', attributes: {}, text: '36.95', children: [] },
            { name: 'publish_date', attributes: {}, text: '2000-12-09', children: [] },
            { name: 'description', attributes: {}, text: "Microsoft's .NET initiative is explored in detail in this deep programmer's reference.", children: [] }
          ],
          text: ''
        }
      ],
      text: ''
    };

    const result = await objectToXml(obj);

    // 구조 검증
    expect(result).toContain('<catalog>');
    expect(result).toContain('</catalog>');

    // 각 책 검증
    expect(result).toContain('<book id="bk101">');
    expect(result).toContain('<author>Gambardella, Matthew</author>');
    expect(result).toContain(`<title>XML Developer&apos;s Guide</title>`);

    expect(result).toContain('<book id="bk102">');
    expect(result).toContain('<author>Ralls, Kim</author>');
    expect(result).toContain('<title>Midnight Rain</title>');

    expect(result).toContain('<book id="bk110">');
    expect(result).toContain(`<author>O&apos;Brien, Tim</author>`);
    expect(result).toContain('<title>Microsoft .NET: The Programming Bible</title>');

    // 설명 필드 검증
    expect(result).toContain('An in-depth look at creating applications with XML.');
    expect(result).toContain("Microsoft&apos;s .NET initiative is explored in detail");
  });

  it('should write empty elements', async () => {
    const obj = {
      name: 'document',
      attributes: {},
      children: [
        { name: 'empty', attributes: {}, text: '', children: [] },
        { name: 'empty-with-attrs', attributes: { attr1: 'value1', attr2: 'value2' }, text: '', children: [] },
        {
          name: 'parent',
          attributes: {},
          children: [
            { name: 'child', attributes: {}, text: '', children: [] },
            { name: 'another-child', attributes: { attr: 'test' }, text: '', children: [] }
          ],
          text: ''
        }
      ],
      text: ''
    };

    const expectedXml = `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <empty></empty>
  <empty-with-attrs attr1="value1" attr2="value2"></empty-with-attrs>
  <parent>
    <child></child>
    <another-child attr="test"></another-child>
  </parent>
</document>`;

    const result = await objectToXml(obj);

    expect(result.trim()).toBe(expectedXml.trim());
  });

  it('should write self-closing elements using writer methods', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('document');

    // writeEndElementSelfClosing 사용
    writer.writeStartElement('input');
    writer.writeAttribute('type', 'text');
    writer.writeAttribute('name', 'username');
    writer.writeEndElementSelfClosing();

    // writeStartElement with attributes 사용
    writer.writeStartElement('img', undefined, undefined, {
      src: 'image.jpg',
      alt: 'A beautiful image',
      width: '100'
    });
    writer.writeEndElementSelfClosing();

    writer.writeEndElement(); // document
    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('<document>');
    expect(result).toContain('</document>');
    expect(result).toContain('<input type="text" name="username"/>');
    expect(result).toContain('<img src="image.jpg" alt="A beautiful image" width="100"/>');
  });

  it('should write XML without pretty print (compact)', async () => {
    const obj = {
      name: 'note',
      attributes: {},
      children: [
        { name: 'to', attributes: {}, text: 'Tove', children: [] },
        { name: 'from', attributes: {}, text: 'Jani', children: [] }
      ],
      text: ''
    };

    const result = await objectToXml(obj, false); // pretty print 비활성화

    // 줄바꿈이나 들여쓰기가 없어야 함 (XML 선언 후 제외)
    const lines = result.split('\n');
    expect(lines.length).toBeLessThanOrEqual(2); // XML 선언 + 모든 내용이 한 줄에
    expect(result).toContain('<note><to>Tove</to><from>Jani</from></note>');
  });

  it('should write XML with custom indentation', async () => {
    const obj = {
      name: 'root',
      attributes: {},
      children: [
        {
          name: 'child',
          attributes: {},
          children: [
            { name: 'grandchild', attributes: {}, text: 'content', children: [] }
          ],
          text: ''
        }
      ],
      text: ''
    };

    const result = await objectToXml(obj, true, '\t'); // 탭으로 들여쓰기

    expect(result).toContain('<root>');
    expect(result).toContain('\t<child>');
    expect(result).toContain('\t\t<grandchild>content</grandchild>');
    expect(result).toContain('\t</child>');
    expect(result).toContain('</root>');
  });

  it('should handle processing instructions and comments', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeComment('This is a document comment');
    writer.writeProcessingInstruction('xml-stylesheet', 'type="text/xsl" href="style.xsl"');

    writer.writeStartElement('document');
    writer.writeComment('This is an element comment');
    writer.writeStartElement('content');
    writer.writeCharacters('Hello World');
    writer.writeEndElement(); // content
    writer.writeEndElement(); // document

    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('<!-- This is a document comment -->');
    expect(result).toContain('<?xml-stylesheet type="text/xsl" href="style.xsl"?>');
    expect(result).toContain('<!-- This is an element comment -->');
    expect(result).toContain('<content>Hello World</content>');
  });

  // XML 기본 엔티티 5종 이스케이프 테스트
  it('should escape XML basic entities in text content', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('data');

    // 기본 XML 엔티티 5종 테스트: & < > " '
    writer.writeCharacters('5 < 10 & 20 > 15 "quoted" \'apostrophe\'');

    writer.writeEndElement(); // data
    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('<data>5 &lt; 10 &amp; 20 &gt; 15 &quot;quoted&quot; &apos;apostrophe&apos;</data>');
  });

  // 속성에서의 엔티티 이스케이프 테스트
  it('should escape XML entities in attributes', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('element');

    // 속성에서 따옴표와 앰퍼샌드 테스트
    writer.writeAttribute('attr1', 'He said "Hello"');
    writer.writeAttribute('attr2', "It's fine");
    writer.writeAttribute('attr3', 'Less than < and greater than >');
    writer.writeAttribute('attr4', 'Ampersand & symbol');

    writer.writeEndElementSelfClosing();
    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('attr1="He said &quot;Hello&quot;"');
    expect(result).toContain('attr2="It&apos;s fine"');
    expect(result).toContain('attr3="Less than &lt; and greater than &gt;"');
    expect(result).toContain('attr4="Ampersand &amp; symbol"');
  });

  // 사용자 정의 엔티티 테스트
  it('should handle custom entities', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
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

    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('document');

    // 사용자 정의 엔티티 포함 텍스트
    writer.writeCharacters('Copyright © 2024, Registered ® Trademark ™, Price: 100€');

    writer.writeEndElement(); // document
    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('Copyright &copy; 2024, Registered &reg; Trademark &trade;, Price: 100&euro;');
  });

  // 사용자 정의 엔티티를 속성에서 테스트
  it('should handle custom entities in attributes', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  ',
      addEntities: [
        { entity: '©', value: '&copy;' },
        { entity: '™', value: '&trade;' }
      ]
    });

    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('product');

    // 속성에서 사용자 정의 엔티티 테스트
    writer.writeAttribute('name', 'MyProduct™');
    writer.writeAttribute('copyright', 'Company© 2024');

    writer.writeEndElementSelfClosing();
    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('name="MyProduct&trade;"');
    expect(result).toContain('copyright="Company&copy; 2024"');
  });

  // 엔티티 자동 인코딩 비활성화 테스트
  it('should not escape entities when autoEncodeEntities is disabled', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  ',
      autoEncodeEntities: false
    });

    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('data');

    // 자동 인코딩이 비활성화되어 있으므로 원본 그대로 출력되어야 함
    writer.writeCharacters('5 < 10 & 20 > 15');

    writer.writeEndElement(); // data
    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('<data>5 < 10 & 20 > 15</data>');
  });

  // 복합 엔티티 테스트 (기본 + 사용자 정의)
  it('should handle mixed basic and custom entities', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  ',
      addEntities: [
        { entity: '©', value: '&copy;' },
        { entity: '→', value: '&rarr;' }
      ]
    });

    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('mixed');

    // 기본 엔티티와 사용자 정의 엔티티 혼합
    writer.writeCharacters('Text with "quotes" & ampersand → arrow © copyright');

    writer.writeEndElement(); // mixed
    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('<mixed>Text with &quot;quotes&quot; &amp; ampersand &rarr; arrow &copy; copyright</mixed>');
  });

  // 커버리지 개선: writeEmptyElement 메서드 테스트 (네임스페이스 및 속성 포함)
  it('should write empty element with namespace and attributes', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('root');

    // writeEmptyElement 메서드 테스트 (prefix, uri, attributes, namespaces 포함)
    writer.writeEmptyElement(
      'emptyTag',
      'ns',
      'http://example.com/namespace',
      [
        { localName: 'attr1', value: 'value1', prefix: undefined },
        { localName: 'attr2', value: 'value2', prefix: 'ns' }
      ],
      [
        { prefix: 'ns2', uri: 'http://example.com/ns2' },
        { prefix: '', uri: 'http://example.com/default' }
      ]
    );

    writer.writeEndElement(); // root
    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('<ns:emptyTag xmlns:ns="http://example.com/namespace"');
    expect(result).toContain('xmlns:ns2="http://example.com/ns2"');
    expect(result).toContain('xmlns="http://example.com/default"');
    expect(result).toContain('attr1="value1"');
    expect(result).toContain('ns:attr2="value2"');
    expect(result).toContain('/>');
  });

  // 커버리지 개선: Pretty print 설정 메서드들 테스트
  it('should support dynamic pretty print configuration', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: false,
      indentString: '  '
    });

    // 초기 설정 확인
    expect(writer.isPrettyPrintEnabled()).toBe(false);

    // Pretty print 활성화
    writer.setPrettyPrint(true);
    expect(writer.isPrettyPrintEnabled()).toBe(true);

    // 들여쓰기 문자열 변경
    writer.setIndentString('\t');

    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('root');
    writer.writeStartElement('child');
    writer.writeCharacters('content');
    writer.writeEndElement(); // child
    writer.writeEndElement(); // root
    await writer.writeEndDocument();

    const result = outputStream.getResult();

    // Pretty print가 활성화되어 탭으로 들여쓰기되었는지 확인
    expect(result).toContain('<root>');
    expect(result).toContain('\t<child>content</child>');
    expect(result).toContain('</root>');
  });

  // 커버리지 개선: Writer 상태가 CLOSED/ERROR일 때 writeEmptyElement 오류 테스트
  it('should throw error when writeEmptyElement is called on closed writer', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('root');
    writer.writeEndElement(); // root
    await writer.writeEndDocument();

    // Writer가 닫힌 후 writeEmptyElement 호출 시 오류 발생해야 함
    expect(() => {
      writer.writeEmptyElement('test');
    }).toThrow('Cannot writeEmptyElement: Writer is closed or in error state.');
  });

  // 커버리지 개선: getIndentString 메서드 테스트
  it('should return current indent string configuration', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    // 초기 들여쓰기 문자열 확인
    expect(writer.getIndentString()).toBe('  ');

    // 들여쓰기 문자열 변경 후 확인
    writer.setIndentString('\t\t');
    expect(writer.getIndentString()).toBe('\t\t');

    // 다른 문자열로 변경
    writer.setIndentString('    ');
    expect(writer.getIndentString()).toBe('    ');
  });

  // 커버리지 개선: writeNamespace 메서드 테스트
  it('should write namespace declarations', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('root');

    // writeNamespace 메서드 테스트
    writer.writeNamespace('ns1', 'http://example.com/ns1');
    writer.writeNamespace('ns2', 'http://example.com/ns2');

    writer.writeCharacters('content');
    writer.writeEndElement(); // root
    await writer.writeEndDocument();

    const result = outputStream.getResult();

    expect(result).toContain('xmlns:ns1="http://example.com/ns1"');
    expect(result).toContain('xmlns:ns2="http://example.com/ns2"');
    expect(result).toContain('<root xmlns:ns1="http://example.com/ns1" xmlns:ns2="http://example.com/ns2">content</root>');
  });

  // 커버리지 개선: writeNamespace 에러 상태 테스트
  it('should throw error when writeNamespace is called without start element', async () => {
    const outputStream = new StringWritableStream();
    const writer = new StaxXmlWriter(outputStream, {
      encoding: 'utf-8',
      prettyPrint: true,
      indentString: '  '
    });

    writer.writeStartDocument('1.0', 'utf-8');

    // writeStartElement 없이 writeNamespace 호출 시 오류 발생해야 함
    expect(() => {
      writer.writeNamespace('ns', 'http://example.com/namespace');
    }).toThrow('writeNamespace can only be called after writeStartElement');
  });
});
