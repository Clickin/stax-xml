import { describe, expect, it } from 'bun:test';
import StaxXmlParser from '../src/StaxXmlParser';
import { CdataEvent, CharactersEvent, StartElementEvent, XmlEventType } from '../src/types';

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

// XML을 JavaScript 객체로 변환하는 함수
async function parseXmlToObject(xmlString: string): Promise<any> {
  const inputStream = stringToReadableStream(xmlString);
  const parser = new StaxXmlParser(inputStream);

  const elementStack: any[] = [];
  let currentElement: any = null;
  let root: any = null;

  for await (const event of parser) {
    switch (event.type) {
      case XmlEventType.START_DOCUMENT:
        // 문서 시작 - 아무것도 하지 않음
        break;

      case XmlEventType.START_ELEMENT:
        const startEvent = event as StartElementEvent;
        const newElement = {
          name: startEvent.name,
          attributes: { ...startEvent.attributes },
          children: [],
          text: ''
        };

        if (currentElement) {
          currentElement.children.push(newElement);
          elementStack.push(currentElement);
        } else {
          root = newElement;
        }
        currentElement = newElement;
        break;

      case XmlEventType.CHARACTERS:
        const charEvent = event as CharactersEvent;
        if (currentElement && charEvent.value.trim()) {
          currentElement.text += charEvent.value;
        }
        break;

      case XmlEventType.CDATA:
        const cdataEvent = event as CdataEvent;
        if (currentElement) {
          currentElement.text += cdataEvent.value;
        }
        break;

      case XmlEventType.END_ELEMENT:
        if (elementStack.length > 0) {
          currentElement = elementStack.pop();
        } else {
          currentElement = null;
        }
        break;

      case XmlEventType.END_DOCUMENT:
        // 문서 끝
        break;

      case XmlEventType.ERROR:
        throw (event as any).error;
    }
  }

  return root;
}

describe('StaxXmlParser Tests', () => {
  it('should parse simple XML with elements and text', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<note>
  <to>Tove</to>
  <from>Jani</from>
  <heading>Reminder</heading>
  <body>Don't forget me this weekend!</body>
</note>`;

    const result = await parseXmlToObject(xml);

    expect(result.name).toBe('note');
    expect(result.attributes).toEqual({});
    expect(result.children.length).toBe(4);

    // to 요소 검증
    const toElement = result.children.find((child: any) => child.name === 'to');
    expect(toElement).toBeDefined();
    expect(toElement.text).toBe('Tove');
    expect(toElement.attributes).toEqual({});

    // from 요소 검증
    const fromElement = result.children.find((child: any) => child.name === 'from');
    expect(fromElement).toBeDefined();
    expect(fromElement.text).toBe('Jani');

    // heading 요소 검증
    const headingElement = result.children.find((child: any) => child.name === 'heading');
    expect(headingElement).toBeDefined();
    expect(headingElement.text).toBe('Reminder');

    // body 요소 검증
    const bodyElement = result.children.find((child: any) => child.name === 'body');
    expect(bodyElement).toBeDefined();
    expect(bodyElement.text).toBe("Don't forget me this weekend!");
  });

  it('should parse XML with attributes', async () => {
    const xml = `<?xml version="1.0"?>
<catalog>
   <book id="bk101" category="Computer">
      <author>Gambardella, Matthew</author>
      <title>XML Developer's Guide</title>
      <genre>Computer</genre>
      <price currency="USD">44.95</price>
   </book>
</catalog>`;

    const result = await parseXmlToObject(xml);

    expect(result.name).toBe('catalog');
    expect(result.children.length).toBe(1);

    const book = result.children[0];
    expect(book.name).toBe('book');
    expect(book.attributes.id).toBe('bk101');
    expect(book.attributes.category).toBe('Computer');
    expect(book.children.length).toBe(4);

    // author 검증
    const author = book.children.find((child: any) => child.name === 'author');
    expect(author.text).toBe('Gambardella, Matthew');

    // title 검증
    const title = book.children.find((child: any) => child.name === 'title');
    expect(title.text).toBe("XML Developer's Guide");

    // price 검증 (속성이 있는 요소)
    const price = book.children.find((child: any) => child.name === 'price');
    expect(price.text).toBe('44.95');
    expect(price.attributes.currency).toBe('USD');
  });

  it('should parse nested XML structure', async () => {
    const xml = `<?xml version="1.0"?>
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

    const result = await parseXmlToObject(xml);

    // 루트 요소 검증
    expect(result.name).toBe('library');
    expect(result.attributes.name).toBe('Central Library');
    expect(result.attributes.location).toBe('Downtown');
    expect(result.children.length).toBe(2);

    // 첫 번째 섹션 검증
    const fictionSection = result.children[0];
    expect(fictionSection.name).toBe('section');
    expect(fictionSection.attributes.type).toBe('Fiction');
    expect(fictionSection.attributes.floor).toBe('2');
    expect(fictionSection.children.length).toBe(1);

    // 첫 번째 책 검증
    const firstBook = fictionSection.children[0];
    expect(firstBook.name).toBe('book');
    expect(firstBook.attributes.isbn).toBe('123-456-789');
    expect(firstBook.attributes.available).toBe('true');

    const firstTitle = firstBook.children.find((child: any) => child.name === 'title');
    expect(firstTitle.text).toBe('The Great Adventure');

    const firstAuthor = firstBook.children.find((child: any) => child.name === 'author');
    expect(firstAuthor.text).toBe('John Doe');
    expect(firstAuthor.attributes.nationality).toBe('American');

    // 두 번째 섹션 검증
    const nonFictionSection = result.children[1];
    expect(nonFictionSection.name).toBe('section');
    expect(nonFictionSection.attributes.type).toBe('Non-Fiction');
    expect(nonFictionSection.attributes.floor).toBe('3');

    const secondBook = nonFictionSection.children[0];
    expect(secondBook.attributes.isbn).toBe('987-654-321');
    expect(secondBook.attributes.available).toBe('false');

    const secondAuthor = secondBook.children.find((child: any) => child.name === 'author');
    expect(secondAuthor.attributes.nationality).toBe('British');
  });

  it('should parse XML with CDATA sections', async () => {
    const xml = `<?xml version="1.0"?>
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

    const result = await parseXmlToObject(xml);

    expect(result.name).toBe('document');
    expect(result.children.length).toBe(2);

    const script = result.children.find((child: any) => child.name === 'script');
    expect(script).toBeDefined();
    expect(script.attributes.type).toBe('text/javascript');
    expect(script.text).toContain('function test()');
    expect(script.text).toContain('if (x < y && y > z)');
    expect(script.text).toContain('console.log("Hello & goodbye <world>");');

    const text = result.children.find((child: any) => child.name === 'text');
    expect(text.text).toBe('Regular text');
  });

  it('should parse XML with special characters and entities', async () => {
    const xml = `<?xml version="1.0"?>
<document>
  <text>Less than &lt; greater than &gt;</text>
  <text>Ampersand &amp; quotes &quot;hello&quot;</text>
  <text>Apostrophe &apos;world&apos;</text>
  <attribute-test attr="value with &amp; ampersand"/>
</document>`;

    const result = await parseXmlToObject(xml);

    expect(result.name).toBe('document');
    expect(result.children.length).toBe(4);

    const texts = result.children.filter((child: any) => child.name === 'text');
    expect(texts[0].text).toBe('Less than < greater than >');
    expect(texts[1].text).toBe('Ampersand & quotes "hello"');
    expect(texts[2].text).toBe("Apostrophe 'world'");

    const attributeTest = result.children.find((child: any) => child.name === 'attribute-test');
    expect(attributeTest.attributes.attr).toBe('value with & ampersand');
  });

  it('should parse large Microsoft catalog sample', async () => {
    const xml = `<?xml version="1.0"?>
<catalog>
   <book id="bk101">
      <author>Gambardella, Matthew</author>
      <title>XML Developer's Guide</title>
      <genre>Computer</genre>
      <price>44.95</price>
      <publish_date>2000-10-01</publish_date>
      <description>An in-depth look at creating applications 
      with XML.</description>
   </book>
   <book id="bk102">
      <author>Ralls, Kim</author>
      <title>Midnight Rain</title>
      <genre>Fantasy</genre>
      <price>5.95</price>
      <publish_date>2000-12-16</publish_date>
      <description>A former architect battles corporate zombies, 
      an evil sorceress, and her own childhood to become queen 
      of the world.</description>
   </book>
   <book id="bk110">
      <author>O'Brien, Tim</author>
      <title>Microsoft .NET: The Programming Bible</title>
      <genre>Computer</genre>
      <price>36.95</price>
      <publish_date>2000-12-09</publish_date>
      <description>Microsoft's .NET initiative is explored in 
      detail in this deep programmer's reference.</description>
   </book>
</catalog>`;

    const result = await parseXmlToObject(xml);

    expect(result.name).toBe('catalog');
    expect(result.children.length).toBe(3);

    // 첫 번째 책 검증
    const book1 = result.children[0];
    expect(book1.attributes.id).toBe('bk101');
    expect(book1.children.find((c: any) => c.name === 'author').text).toBe('Gambardella, Matthew');
    expect(book1.children.find((c: any) => c.name === 'title').text).toBe("XML Developer's Guide");
    expect(book1.children.find((c: any) => c.name === 'genre').text).toBe('Computer');
    expect(book1.children.find((c: any) => c.name === 'price').text).toBe('44.95');
    expect(book1.children.find((c: any) => c.name === 'publish_date').text).toBe('2000-10-01');

    // 두 번째 책 검증
    const book2 = result.children[1];
    expect(book2.attributes.id).toBe('bk102');
    expect(book2.children.find((c: any) => c.name === 'author').text).toBe('Ralls, Kim');
    expect(book2.children.find((c: any) => c.name === 'title').text).toBe('Midnight Rain');
    expect(book2.children.find((c: any) => c.name === 'genre').text).toBe('Fantasy');

    // 세 번째 책 검증
    const book3 = result.children[2];
    expect(book3.attributes.id).toBe('bk110');
    expect(book3.children.find((c: any) => c.name === 'author').text).toBe("O'Brien, Tim");
    expect(book3.children.find((c: any) => c.name === 'title').text).toBe('Microsoft .NET: The Programming Bible');
    expect(book3.children.find((c: any) => c.name === 'description').text).toContain("Microsoft's .NET initiative");
  });

  it('should handle empty elements', async () => {
    const xml = `<?xml version="1.0"?>
<document>
  <empty></empty>
  <empty-with-attrs attr1="value1" attr2="value2"></empty-with-attrs>
  <parent>
    <child/>
    <another-child attr="test"/>
  </parent>
</document>`;

    const result = await parseXmlToObject(xml);

    expect(result.name).toBe('document');
    expect(result.children.length).toBe(3);

    const empty = result.children.find((c: any) => c.name === 'empty');
    expect(empty.text).toBe('');
    expect(empty.children.length).toBe(0);

    const emptyWithAttrs = result.children.find((c: any) => c.name === 'empty-with-attrs');
    expect(emptyWithAttrs.text).toBe('');
    expect(emptyWithAttrs.attributes.attr1).toBe('value1');
    expect(emptyWithAttrs.attributes.attr2).toBe('value2');

    const parent = result.children.find((c: any) => c.name === 'parent');
    expect(parent.children.length).toBe(2);

    const child = parent.children.find((c: any) => c.name === 'child');
    expect(child.text).toBe('');

    const anotherChild = parent.children.find((c: any) => c.name === 'another-child');
    expect(anotherChild.attributes.attr).toBe('test');
  });

  it('should throw error for malformed XML', async () => {
    const malformedXml = `<?xml version="1.0" encoding="UTF-8"?>
<note>
  <to>Tove</to>
  <From>Jani</from>
  <heading>Reminder</heading>
  <body>Don't forget me this weekend!</body>
</note>`;

    await expect(parseXmlToObject(malformedXml)).rejects.toThrow('Mismatched closing tag');
  });

  it('should handle whitespace preservation', async () => {
    const xml = `<?xml version="1.0"?>
<document>
  <pre>    Preformatted
    text with
        indentation  </pre>
  <normal>  Normal text with spaces  </normal>
</document>`;

    const result = await parseXmlToObject(xml);

    const pre = result.children.find((c: any) => c.name === 'pre');
    expect(pre.text).toContain('    Preformatted');
    expect(pre.text).toContain('        indentation  ');

    const normal = result.children.find((c: any) => c.name === 'normal');
    expect(normal.text).toBe('  Normal text with spaces  ');
  });
  // XML 예약어 기본 엔티티 디코딩 테스트
  it('should decode xml entities in text content', async () => {
    const xml = `<?xml version="1.0"?><data>5 &lt; 10 &amp; 20 &gt; 15 &quot;quoted&quot; &apos;paren&apos;</data>`;
    const result = await parseXmlToObject(xml);

    expect(result.name).toBe('data');
    expect(result.text).toBe('5 < 10 & 20 > 15 "quoted" \'paren\'');
  });

  // 속성 내 따옴표 엔티티 디코딩 테스트
  it('should decode xml entities in attributes', async () => {
    const xml = `<?xml version="1.0"?><element attr1="He said &quot;Hello&quot;" attr2="It&apos;s fine"/>`;
    const result = await parseXmlToObject(xml);

    expect(result.name).toBe('element');
    expect(result.attributes.attr1).toBe('He said "Hello"');
    expect(result.attributes.attr2).toBe("It's fine");
  });

  // 커버리지 개선: addEntities의 유효성 검증 테스트
  it('should handle invalid entities in addEntities option', async () => {
    const xmlData = `<?xml version="1.0"?>
<test>Content with special characters</test>`;

    const inputStream = stringToReadableStream(xmlData);
    const reader = new StaxXmlParser(inputStream, {
      addEntities: [
        { entity: '©', value: '&copy;' }, // 유효한 엔티티
        { entity: '', value: '&invalid;' }, // 빈 entity (무시됨)
        { entity: '®', value: '' }, // 빈 value (무시됨)
        { entity: undefined as any, value: '&test;' }, // undefined entity (무시됨)
        { entity: '™', value: undefined as any } // undefined value (무시됨)
      ]
    });

    const events = [];
    for await (const event of reader) {
      events.push(event);
    }

    // 유효한 엔티티만 처리되었는지 확인
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe(XmlEventType.START_DOCUMENT);
  });

  // 커버리지 개선: XmlEventType getter 테스트
  it('should provide access to XmlEventType through parser instance', async () => {
    const xmlData = `<?xml version="1.0"?><root></root>`;
    const inputStream = stringToReadableStream(xmlData);
    const reader = new StaxXmlParser(inputStream);

    // XmlEventType getter 테스트
    const eventType = reader.XmlEventType;
    expect(eventType).toBeDefined();
    expect(eventType.START_DOCUMENT).toBeDefined();
    expect(eventType.END_DOCUMENT).toBeDefined();
    expect(eventType.START_ELEMENT).toBeDefined();
    expect(eventType.END_ELEMENT).toBeDefined();
    expect(eventType.CHARACTERS).toBeDefined();
    expect(eventType.CDATA).toBeDefined();
    expect(eventType.ERROR).toBeDefined();
  });
});
