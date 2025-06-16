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
  const writer = new StaxXmlWriter(outputStream, 'utf-8', prettyPrint, indentString);

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
  <body>Don't forget me this weekend!</body>
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
    <title>XML Developer's Guide</title>
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
  <text>Ampersand &amp; quotes "hello"</text>
  <text>Apostrophe 'world'</text>
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
    expect(result).toContain(`<title>XML Developer's Guide</title>`);

    expect(result).toContain('<book id="bk102">');
    expect(result).toContain('<author>Ralls, Kim</author>');
    expect(result).toContain('<title>Midnight Rain</title>');

    expect(result).toContain('<book id="bk110">');
    expect(result).toContain(`<author>O'Brien, Tim</author>`);
    expect(result).toContain('<title>Microsoft .NET: The Programming Bible</title>');

    // 설명 필드 검증
    expect(result).toContain('An in-depth look at creating applications with XML.');
    expect(result).toContain("Microsoft's .NET initiative is explored in detail");
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
    const writer = new StaxXmlWriter(outputStream, 'utf-8', true, '  ');

    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('document');

    // writeEndElementSelfClosing 사용
    writer.writeStartElement('input');
    writer.writeAttribute('type', 'text');
    writer.writeAttribute('name', 'username');
    writer.writeEndElementSelfClosing();

    // writeStartElementWithAttributes 사용
    writer.writeStartElementWithAttributes('img', {
      src: 'image.jpg',
      alt: 'A beautiful image',
      width: '100'
    });

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
    const writer = new StaxXmlWriter(outputStream, 'utf-8', true);

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
});
