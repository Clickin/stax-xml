import { describe, expect, test } from "bun:test";
import StaxXmlParser from "../src/StaxXmlParser";

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
import { CharactersEvent, XmlEventType } from "../src/types";

describe("Empty Elements and Self-Closing Tags - CharactersEvent Suppression (Updated)", () => {
  test("should not emit CharactersEvent for self-closing tags", async () => {
    const xmlString = `<root><item/><empty/></root>`;
    const parser = new StaxXmlParser(stringToReadableStream(xmlString));
    const events = [];

    for await (const event of parser) {
      events.push(event);
    }

    // CharactersEvent가 발생하지 않아야 함
    const charactersEvents = events.filter(e => e.type === XmlEventType.CHARACTERS);
    expect(charactersEvents).toHaveLength(0);

    // 예상되는 이벤트 구조 확인
    expect(events).toHaveLength(8); // START_DOCUMENT, START_ELEMENT(root), START_ELEMENT(item), END_ELEMENT(item), START_ELEMENT(empty), END_ELEMENT(empty), END_ELEMENT(root), END_DOCUMENT
  });

  test("should not emit CharactersEvent for empty paired tags", async () => {
    const xmlString = `<root><item></item><empty></empty></root>`;
    const parser = new StaxXmlParser(stringToReadableStream(xmlString));
    const events = [];

    for await (const event of parser) {
      events.push(event);
    }

    // CharactersEvent가 발생하지 않아야 함
    const charactersEvents = events.filter(e => e.type === XmlEventType.CHARACTERS);
    expect(charactersEvents).toHaveLength(0);

    // 예상되는 이벤트 구조 확인 (root의 END_ELEMENT 포함)
    expect(events).toHaveLength(8);
  });

  test("should emit CharactersEvent only for elements with actual text content", async () => {
    const xmlString = `<root><empty></empty><with-text>Hello</with-text><another-empty/></root>`;
    const parser = new StaxXmlParser(stringToReadableStream(xmlString));
    const events = [];

    for await (const event of parser) {
      events.push(event);
    }

    // CharactersEvent가 정확히 1개만 발생해야 함 (with-text 요소의 "Hello" 텍스트)
    const charactersEvents = events.filter(e => e.type === XmlEventType.CHARACTERS);
    expect(charactersEvents).toHaveLength(1);
    expect((charactersEvents[0] as CharactersEvent).value).toBe("Hello");

    // 전체 이벤트 구조 확인 (root의 END_ELEMENT 포함)
    const eventTypes = events.map(e => e.type);
    expect(eventTypes).toEqual([
      XmlEventType.START_DOCUMENT,
      XmlEventType.START_ELEMENT, // root
      XmlEventType.START_ELEMENT, // empty
      XmlEventType.END_ELEMENT,   // empty
      XmlEventType.START_ELEMENT, // with-text
      XmlEventType.CHARACTERS,    // "Hello"
      XmlEventType.END_ELEMENT,   // with-text
      XmlEventType.START_ELEMENT, // another-empty
      XmlEventType.END_ELEMENT,   // another-empty
      XmlEventType.END_ELEMENT,   // root
      XmlEventType.END_DOCUMENT
    ]);
  });

  test("should not emit CharactersEvent for whitespace-only content between empty elements", async () => {
    const xmlString = `<root>
  <empty></empty>
  <self-closing/>
  <another-empty></another-empty>
</root>`;
    const parser = new StaxXmlParser(stringToReadableStream(xmlString));
    const events = [];

    for await (const event of parser) {
      events.push(event);
    }

    // 공백만 있는 텍스트에 대한 CharactersEvent는 발생하지 않아야 함
    const charactersEvents = events.filter(e => e.type === XmlEventType.CHARACTERS);
    expect(charactersEvents).toHaveLength(0);

    // 요소 이벤트만 확인
    const elementEvents = events.filter(e =>
      e.type === XmlEventType.START_ELEMENT || e.type === XmlEventType.END_ELEMENT
    );

    expect(elementEvents).toHaveLength(8); // root(start), empty(start/end), self-closing(start/end), another-empty(start/end), root(end)
  });

  test("should not emit CharactersEvent for elements with only whitespace", async () => {
    // 이 테스트는 현재 구현에 맞게 수정됨
    // 요소 내부의 공백도 trim() 후 빈 문자열이면 CharactersEvent가 발생하지 않음
    const xmlString = `<root><text> </text><text2>content</text2></root>`;
    const parser = new StaxXmlParser(stringToReadableStream(xmlString));
    const events = [];

    for await (const event of parser) {
      events.push(event);
    }

    // 공백만 있는 text 요소는 CharactersEvent가 발생하지 않고, content가 있는 text2만 발생
    const charactersEvents = events.filter(e => e.type === XmlEventType.CHARACTERS);
    expect(charactersEvents).toHaveLength(1);
    expect((charactersEvents[0] as CharactersEvent).value).toBe("content");
  });

  test("should handle mixed content correctly", async () => {
    const xmlString = `<root><empty-with-attrs id="1" name="test"/><container><empty></empty><text>Hello World</text></container></root>`;

    const parser = new StaxXmlParser(stringToReadableStream(xmlString));
    const events = [];

    for await (const event of parser) {
      events.push(event);
    }

    // CharactersEvent는 실제 텍스트 내용이 있는 경우에만 발생해야 함
    const charactersEvents = events.filter(e => e.type === XmlEventType.CHARACTERS);
    expect(charactersEvents).toHaveLength(1); // "Hello World"만
    expect((charactersEvents[0] as CharactersEvent).value).toBe("Hello World");

    // empty 요소들과 공백은 CharactersEvent를 생성하지 않아야 함
    const startElements = events.filter(e => e.type === XmlEventType.START_ELEMENT);
    const endElements = events.filter(e => e.type === XmlEventType.END_ELEMENT);

    expect(startElements).toHaveLength(5); // root, empty-with-attrs, container, empty, text
    expect(endElements).toHaveLength(5);   // 같은 요소들의 종료 태그
  });

  test("should preserve meaningful whitespace in text content", async () => {
    // 텍스트 내용에서 앞뒤 공백이 있어도 trim() 후 내용이 있으면 CharactersEvent 발생
    const xmlString = `<root><text>  hello world  </text></root>`;
    const parser = new StaxXmlParser(stringToReadableStream(xmlString));
    const events = [];

    for await (const event of parser) {
      events.push(event);
    }

    const charactersEvents = events.filter(e => e.type === XmlEventType.CHARACTERS);
    expect(charactersEvents).toHaveLength(1);
    // 원본 공백이 보존되어야 함
    expect((charactersEvents[0] as CharactersEvent).value).toBe("  hello world  ");
  });
});