import { describe, expect, it } from "vitest";
import {
  EventReaderSync,
  XmlEventType,
  type AnyXmlEvent,
  type EventAttribute,
  type EventReaderSyncOptions,
  type StartElementEvent,
} from "stax-xml";
import { validateAndNormalizeAttributeSpan } from "../src/core/internal/entity-normalizer.js";

function normalize(
  value: string,
  customEntities?: ReadonlyMap<string, string>,
): string | undefined {
  return validateAndNormalizeAttributeSpan(
    value,
    0,
    value.length,
    customEntities,
  );
}

function startEvent(
  xml: string,
  options: EventReaderSyncOptions = {},
): StartElementEvent {
  const event = Array.from(new EventReaderSync(xml, options)).find(
    (candidate) => candidate.type === XmlEventType.START_ELEMENT,
  );
  if (event?.type !== XmlEventType.START_ELEMENT)
    throw new Error("expected START_ELEMENT");
  return event;
}

function events(xml: string, options: EventReaderSyncOptions = {}): AnyXmlEvent[] {
  return Array.from(new EventReaderSync(xml, options));
}

function attributeValues(event: StartElementEvent): Array<[string, string]> {
  return Array.from(
    event.attributes?.values() ?? [],
    (attribute): [string, string] => [attribute.name, attribute.value],
  );
}

describe("single-evaluation entity normalization", () => {
  it("distinguishes a validated entity-free span from an empty replacement", () => {
    const custom = new Map([
      ["empty", ""],
      ["wrapped", "&amp;"],
    ]);

    expect(normalize("plain text", custom)).toBeUndefined();
    expect(normalize("&empty;", custom)).toBe("");
    expect(normalize("&wrapped;", custom)).toBe("&amp;");
  });

  it("normalizes predefined, decimal, hexadecimal, and astral references", () => {
    expect(
      normalize("&lt;&gt;&amp;&quot;&apos;&#65;&#x41;&#x1F600;"),
    ).toBe('<>&"\'AA😀');
    expect(normalize("&#00065;&#x00041;")).toBe("AA");
    expect(normalize("000 plain 001")).toBeUndefined();
  });

  it.each([
    ["tab", "&#9;", "\t"],
    ["line feed", "&#10;", "\n"],
    ["carriage return", "&#13;", "\r"],
    ["space", "&#32;", " "],
    ["last BMP before surrogate", "&#xD7FF;", "\uD7FF"],
    ["first BMP after surrogate", "&#xE000;", "\uE000"],
    ["last valid BMP", "&#xFFFD;", "\uFFFD"],
    ["first valid astral", "&#x10000;", "\u{10000}"],
    ["last valid code point", "&#x10FFFF;", "\u{10FFFF}"],
  ] as const)("accepts the XML 1.0 boundary %s", (_name, reference, value) => {
    expect(normalize(reference)).toBe(value);
  });

  it.each([
    "&#0;",
    "&#8;",
    "&#11;",
    "&#xB;",
    "&#xD800;",
    "&#xDFFF;",
    "&#x110000;",
    "&unknown;",
    "&missing",
  ])("rejects invalid or incomplete reference %s", (value) => {
    expect(() => normalize(value)).toThrow();
  });

  it("performs one non-recursive replacement pass", () => {
    const custom = new Map([
      ["word", "StAX"],
      ["wrapped", "&amp;"],
      ["empty", ""],
    ]);

    expect(normalize("&amp;lt;&amp;#65;&wrapped;", custom)).toBe(
      "&lt;&#65;&amp;",
    );
    expect(normalize("&word;&empty;", custom)).toBe("StAX");
  });

  it("retains Unicode validation for direct strings, including lone surrogates", () => {
    expect(normalize("한글\uE000\u{1F600}")).toBeUndefined();
    expect(() => normalize("\uD800")).toThrow(/invalid XML character/i);
    expect(() => normalize("\uDC00")).toThrow(/invalid XML character/i);
  });

  it("uses attribute-specific validation for literal less-than and custom expansion", () => {
    expect(() => normalize("literal <")).toThrow(
      /attribute values cannot contain </i,
    );
    expect(normalize("&lt;")).toBe("<");
    expect(normalize("&#60;")).toBe("<");

    const custom = new Map([["less", "<"]]);
    expect(() => normalize("&less;", custom)).toThrow(
      /cannot expand to </i,
    );
  });

  it("returns complete decoded values for both quote styles and preserves source order", () => {
    const event = startEvent(
      `<root first="&amp;lt;" empty="" second='&quot;&apos;&#65;' third="한글😀"/>`,
    );

    expect(attributeValues(event)).toEqual([
      ["first", "&lt;"],
      ["empty", ""],
      ["second", "\"'A"],
      ["third", "한글😀"],
    ]);
    expect(event.attributes?.get("empty")?.value).toBe("");
  });

  it("keeps raw values when decoding is disabled while resolving namespaces", () => {
    const event = startEvent(
      '<p:root xmlns:p="urn:one&amp;two" p:value="&amp;lt;" plain="&amp;"/>',
      { autoDecodeEntities: false },
    );

    expect(event.name).toBe("p:root");
    expect(event.namespaceURI).toBe("urn:one&two");
    expect(attributeValues(event)).toEqual([
      ["xmlns:p", "urn:one&amp;two"],
      ["p:value", "&amp;lt;"],
      ["plain", "&amp;"],
    ]);
    expect(event.attributes?.get("p:value")?.namespaceURI).toBe("urn:one&two");
    expect(() =>
      events('<root value="&unknown;"/>', { autoDecodeEntities: false }),
    ).toThrow(/unknown or invalid entity/i);
  });

  it("uses an empty custom replacement for both an attribute and a default namespace", () => {
    const event = startEvent(
      '<root xmlns="&empty;" value="&empty;"/>',
      { addEntities: [{ entity: "empty", value: "" }] },
    );
    expect(event.namespaceURI).toBe("");
    expect(event.attributes?.get("value")?.value).toBe("");
  });

  it("resolves default namespaces, shadowing, and undeclaration in materialized events", () => {
    const parsed = events(
      '<root xmlns="urn:base" xmlns:p="urn:one"><p:outer p:id="1"><p:inner xmlns:p="urn:two" p:id="2"/><inner xmlns=""><leaf/></inner></p:outer></root>',
    );
    const starts = parsed.filter(
      (event): event is StartElementEvent =>
        event.type === XmlEventType.START_ELEMENT,
    );

    expect(
      starts.map((event) => [event.name, event.namespaceURI]),
    ).toEqual([
      ["root", "urn:base"],
      ["p:outer", "urn:one"],
      ["p:inner", "urn:two"],
      ["inner", ""],
      ["leaf", ""],
    ]);
    expect(starts[1]?.attributes?.get("p:id")).toMatchObject({
      namespaceURI: "urn:one",
      value: "1",
    });
    expect(starts[2]?.attributes?.get("p:id")).toMatchObject({
      namespaceURI: "urn:two",
      value: "2",
    });
  });

  it("keeps namespace declarations in source order and serializes reserved names safely", () => {
    const event = startEvent(
      '<root first="1" __proto__="safe" xmlns:p="urn:p" constructor="safe-too" p:id="7"/>',
    );
    const attributes = event.attributes;
    if (!attributes) throw new Error("expected attributes");

    expect(Array.from(attributes.keys())).toEqual([
      "first",
      "__proto__",
      "xmlns:p",
      "constructor",
      "p:id",
    ]);
    expect(attributes.get("__proto__")).toMatchObject({
      name: "__proto__",
      value: "safe",
      namespaceURI: "",
    });
    expect(attributes.get("constructor")?.value).toBe("safe-too");

    const json = JSON.parse(JSON.stringify(event)) as {
      attributes: Record<string, EventAttribute>;
    };
    expect(Object.keys(json.attributes)).toEqual([
      "first",
      "__proto__",
      "xmlns:p",
      "constructor",
      "p:id",
    ]);
    expect(Object.hasOwn(json.attributes, "__proto__")).toBe(true);
    expect(json.attributes.__proto__?.value).toBe("safe");
    expect(json.attributes.constructor?.value).toBe("safe-too");
  });

  it.each([
    ["duplicate raw name", '<root id="1" id="2"/>', /duplicate attribute/i],
    [
      "duplicate expanded name",
      '<root xmlns:x="urn" xmlns:y="urn" x:id="1" y:id="2"/>',
      /duplicate expanded attribute/i,
    ],
    [
      "undeclared prefix",
      '<root p:id="1"/>',
      /undeclared namespace prefix/i,
    ],
    [
      "prefixed undeclaration",
      '<root xmlns:p=""/>',
      /cannot be undeclared/i,
    ],
  ] as const)("rejects %s before returning its START_ELEMENT", (_name, xml, error) => {
    expect(() => events(xml)).toThrow(error);
  });

  it("does not decode entity syntax in CDATA, comments, processing instructions, or DTD", () => {
    const parsed = events(
      '<!DOCTYPE root><!--&amp;--><?work &amp;?><root><![CDATA[&amp;]]><!--&name;--><?inner &name;?></root>',
    );

    expect(
      parsed
        .filter(
          (event) =>
            event.type === XmlEventType.CDATA ||
            event.type === XmlEventType.COMMENT ||
            event.type === XmlEventType.DTD,
        )
        .map((event) => event.type === XmlEventType.PROCESSING_INSTRUCTION ? "" : event.value),
    ).toEqual(["DOCTYPE root", "&amp;", "&amp;", "&name;"]);
    expect(
      parsed.filter(
        (event): event is Extract<AnyXmlEvent, { type: "PROCESSING_INSTRUCTION" }> =>
          event.type === XmlEventType.PROCESSING_INSTRUCTION,
      ).map((event) => [event.target, event.data]),
    ).toEqual([
      ["work", "&amp;"],
      ["inner", "&name;"],
    ]);
  });

  it("preserves the canonical event property order and undefined/empty distinctions", () => {
    const parsed = events("<root empty=''/>");
    const document = parsed[0];
    const root = parsed.find(
      (event): event is StartElementEvent =>
        event.type === XmlEventType.START_ELEMENT,
    );
    if (!document || !root) throw new Error("expected document and root events");

    expect(Object.keys(document)).toEqual([
      "type",
      "name",
      "localName",
      "prefix",
      "namespaceURI",
      "attributes",
      "selfClosing",
      "value",
      "target",
      "data",
      "version",
      "encoding",
      "standalone",
    ]);
    expect(root.attributes).toBeDefined();
    expect(root.attributes?.get("empty")?.value).toBe("");
    expect(
      Array.from(new EventReaderSync("<root/>")).find(
        (event) => event.type === XmlEventType.START_ELEMENT,
      ),
    ).toMatchObject({ attributes: undefined });
  });
});
