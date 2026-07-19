import { describe, expect, it } from "vitest";
import { NEED_INPUT, TokenCursor, XmlEventType } from "@stax-xml/core";

describe("TokenCursor option and accessor coverage", () => {
  it("resumes an initially empty cursor across a BOM boundary", () => {
    const cursor = new TokenCursor("", false);
    expect(cursor.next()).toBe(NEED_INPUT);
    cursor.push("\uFEFF<root/>", true);
    expect(cursor.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
    expect(cursor.next()).toBe(XmlEventType.END_ELEMENT);
    expect(cursor.next()).toBe(XmlEventType.END_DOCUMENT);
    expect(cursor.next()).toBeNull();
    expect(() => cursor.push("x")).toThrow(/end of input/i);
  });

  it("exposes raw namespace declarations when namespace processing is disabled", () => {
    const cursor = new TokenCursor('<p:root xmlns:p="urn:p" p:id="7"/>', true, {
      namespaceAware: false,
    });
    expect(cursor.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
    expect(cursor.name()).toBe("p:root");
    expect(cursor.localName()).toBe("root");
    expect(cursor.prefix()).toBe("p");
    expect(cursor.namespaceURI()).toBe("");
    expect(cursor.attributeCount()).toBe(2);
    expect(cursor.attribute("xmlns:p")).toMatchObject({
      value: "urn:p",
      namespaceURI: "",
    });
    expect(cursor.attribute("p:id")).toMatchObject({
      value: "7",
      namespaceURI: "",
    });

    const aware = new TokenCursor('<root xmlns:p="urn:p" p:id="7"/>', true);
    expect(aware.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(aware.next()).toBe(XmlEventType.START_ELEMENT);
    expect(aware.attribute(0)).toMatchObject({ name: "xmlns:p" });
    expect(aware.attribute(1)).toMatchObject({
      name: "p:id",
      namespaceURI: "urn:p",
    });
    expect(aware.namespaceURIForPrefix("missing")).toBe("");
  });

  it("preserves entity syntax when decoding is disabled", () => {
    const cursor = new TokenCursor('<root value="&amp;">&amp;</root>', true, {
      autoDecodeEntities: false,
    });
    expect(cursor.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
    expect(cursor.attributeValue(0)).toBe("&amp;");
    expect(cursor.attribute(-1)).toBeUndefined();
    expect(cursor.attribute(9)).toBeUndefined();
    expect(cursor.attribute("missing")).toBeUndefined();
    expect(cursor.attribute("", "missing")).toBeUndefined();
    expect(cursor.next()).toBe(XmlEventType.CHARACTERS);
    expect(cursor.text()).toBe("&amp;");
  });

  it("decodes custom entities and validates their definitions", () => {
    const cursor = new TokenCursor('<root value="&word;">&word;</root>', true, {
      addEntities: [{ entity: "&word;", value: "hello" }],
    });
    expect(cursor.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
    expect(cursor.attributeValue(0)).toBe("hello");
    expect(cursor.next()).toBe(XmlEventType.CHARACTERS);
    expect(cursor.text()).toBe("hello");

    expect(
      () =>
        new TokenCursor("", true, {
          addEntities: [{ entity: "1bad", value: "x" }],
        }),
    ).toThrow(/invalid custom entity/i);
    expect(
      () =>
        new TokenCursor("", true, {
          addEntities: [{ entity: "amp", value: "x" }],
        }),
    ).toThrow(/predefined/i);
    expect(
      () =>
        new TokenCursor("", true, {
          addEntities: [
            { entity: "word", value: "x" },
            { entity: "&word;", value: "y" },
          ],
        }),
    ).toThrow(/duplicate/i);
    expect(
      () =>
        new TokenCursor("", true, {
          addEntities: [{ entity: "word", value: "\u0000" }],
        }),
    ).toThrow(/invalid XML character/i);
    expect(
      () =>
        new TokenCursor("", true, {
          addEntities: [{ entity: "word", value: "\uE000" }],
        }),
    ).not.toThrow();
  });

  it("returns neutral accessor values outside an element and for invalid indices", () => {
    const cursor = new TokenCursor("<root/>", true);
    expect(cursor.text()).toBeUndefined();
    expect(cursor.localName()).toBeUndefined();
    expect(cursor.prefix()).toBe("");
    expect(cursor.namespaceURI()).toBe("");
    expect(cursor.namespaceURIForPrefix("missing")).toBe("");
    expect(cursor.attributeLocalName(-1)).toBeUndefined();
    expect(cursor.attributeLocalName(0)).toBeUndefined();
    expect(cursor.attributeValue(-1)).toBeUndefined();
    expect(cursor.attributeValue(0)).toBeUndefined();

    const fragment = new TokenCursor("outside<root/>", true);
    expect(collectTypes(fragment)).toContain(XmlEventType.CHARACTERS);
  });

  it.each([
    [
      "unsupported declaration",
      '<!ENTITY x "y">',
      /unsupported XML declaration/i,
    ],
    ["CDATA outside document root", "<![CDATA[x]]><root/>", /CDATA.*outside/i],
    ["attribute without equals", "<root id />", /requires a value/i],
    ["unquoted attribute", "<root id=value/>", /must be quoted/i],
    ["invalid element colon", "<a:b:c/>", /invalid XML name/i],
    ["invalid attribute colon", '<root a:b:c="x"/>', /invalid XML name/i],
    ["invalid attribute start", '<root 1bad="x"/>', /invalid XML name/i],
    ["unfinished slash", "<root /", /unterminated start tag/i],
    [
      "DOCTYPE mismatch without namespaces",
      "<!DOCTYPE expected><actual/>",
      /does not match/i,
    ],
    ["second root without namespaces", "<a/><b/>", /exactly one root/i],
    [
      "non-whitespace before root without namespaces",
      "x<root/>",
      /exactly one root|outside/i,
    ],
  ] as const)("reports %s", (_name, xml, error) => {
    expect(() =>
      drain(
        new TokenCursor(xml, true, {
          documentMode:
            _name.includes("without namespaces") ||
            _name.includes("outside document root")
              ? "document"
              : "fragment",
          namespaceAware: !_name.includes("without namespaces"),
        }),
      ),
    ).toThrow(error);
  });

  it("retains a discovered incremental delimiter while compacting input", () => {
    const cursor = new TokenCursor("<root><!--", false);
    expect(cursor.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
    expect(cursor.next()).toBe(NEED_INPUT);
    cursor.push("comment-->");
    cursor.push("</root>", true);
    expect(cursor.next()).toBe(XmlEventType.COMMENT);
    expect(cursor.text()).toBe("comment");
    expect(cursor.next()).toBe(XmlEventType.END_ELEMENT);
    expect(cursor.next()).toBe(XmlEventType.END_DOCUMENT);
  });

  it("handles partial declarations, attribute whitespace, and end-tag whitespace", () => {
    const declaration = new TokenCursor("<?xml", false);
    expect(declaration.next()).toBe(NEED_INPUT);
    declaration.push(' version="1.0"?><root a = "x"></root   >', true);
    expect(collectTypes(declaration)).toEqual([
      XmlEventType.START_DOCUMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.END_ELEMENT,
      XmlEventType.END_DOCUMENT,
    ]);

    const emoji = new TokenCursor("<root>😀</root>", true);
    expect(collectTypes(emoji)).toContain(XmlEventType.CHARACTERS);

    const startTag = new TokenCursor('<root value="', false);
    expect(startTag.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(startTag.next()).toBe(NEED_INPUT);
    startTag.push('continued">', false);
    expect(startTag.next()).toBe(XmlEventType.START_ELEMENT);
    startTag.push("</root>", true);
    expect(collectTypes(startTag)).toEqual([
      XmlEventType.END_ELEMENT,
      XmlEventType.END_DOCUMENT,
    ]);

    const invalidDeclaration = new TokenCursor("<!X", false);
    expect(invalidDeclaration.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(() => invalidDeclaration.next()).toThrow(
      /unsupported XML declaration/i,
    );

    const attributeWhitespace = new TokenCursor("<root attr ", false);
    expect(attributeWhitespace.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(attributeWhitespace.next()).toBe(NEED_INPUT);
    attributeWhitespace.push('= "x"/>', true);
    expect(collectTypes(attributeWhitespace)).toEqual([
      XmlEventType.START_ELEMENT,
      XmlEventType.END_ELEMENT,
      XmlEventType.END_DOCUMENT,
    ]);

    const unterminated = new TokenCursor('<root value="', false);
    expect(unterminated.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(unterminated.next()).toBe(NEED_INPUT);
    unterminated.push("still-open", true);
    expect(() => unterminated.next()).toThrow(/unterminated start tag/i);

    const laterAttribute = new TokenCursor(
      '<root first="closed" second="',
      false,
    );
    expect(laterAttribute.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(laterAttribute.next()).toBe(NEED_INPUT);
    laterAttribute.push('open"/>', true);
    expect(collectTypes(laterAttribute)).toEqual([
      XmlEventType.START_ELEMENT,
      XmlEventType.END_ELEMENT,
      XmlEventType.END_DOCUMENT,
    ]);

    const incompleteDoctype = new TokenCursor("<!DOCTYPE root [", true);
    expect(incompleteDoctype.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(() => incompleteDoctype.next()).toThrow(/unterminated DOCTYPE/i);

    for (const xml of [
      "<root><!--",
      "<root><![CDATA[",
      "<root><?pi ",
      "<root></root",
    ]) {
      const incomplete = new TokenCursor(xml, false);
      while (incomplete.next() !== NEED_INPUT) {
        /* reach the incomplete token */
      }
      incomplete.push("", true);
      expect(() => incomplete.next()).toThrow(/unterminated|incomplete/i);
    }

    const outsideWhitespace = new TokenCursor(" ", false, {
      documentMode: "document",
    });
    expect(outsideWhitespace.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(outsideWhitespace.next()).toBe(NEED_INPUT);
    outsideWhitespace.push(" <root/>", true);
    expect(collectTypes(outsideWhitespace)).toContain(
      XmlEventType.START_ELEMENT,
    );
  });

  it("validates entity and Unicode edge cases in text, attributes, and lexical nodes", () => {
    const entities = new TokenCursor(
      "<root>&lt;&gt;&amp;&quot;&apos;&#65;&#x42;</root>",
      true,
    );
    expect(entities.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(entities.next()).toBe(XmlEventType.START_ELEMENT);
    expect(entities.next()).toBe(XmlEventType.CHARACTERS);
    expect(entities.text()).toBe("<>&\"'AB");

    expect(() =>
      drain(
        new TokenCursor('<root value="&less;"/>', true, {
          addEntities: [{ entity: "less", value: "<" }],
        }),
      ),
    ).toThrow(/cannot expand to </i);

    for (const xml of [
      "<root>\uDC00</root>",
      "<root>\uD800x</root>",
      "<root>\uFFFE</root>",
      "<root>\uFFFF</root>",
      '<root value="\uDC00"/>',
      '<root value="\uD800x"/>',
      '<root value="\uFFFE"/>',
      '<root value="\uFFFF"/>',
      "<!--\uDC00--><root/>",
      "<!--\uD800x--><root/>",
      "<!--\uFFFE--><root/>",
      "<!--\uFFFF--><root/>",
      "<?pi \uD800?><root/>",
      "<!DOCTYPE \uDC00><root/>",
      "<\uDC00/>",
      "<!DOCTYPE ><root/>",
    ]) {
      expect(() => drain(new TokenCursor(xml, true))).toThrow();
    }

    expect(collectTypes(new TokenCursor("<!--😀--><root/>", true))).toContain(
      XmlEventType.COMMENT,
    );
    expect(
      collectTypes(new TokenCursor("<!--\uE000--><root>\uE000</root>", true)),
    ).toEqual([
      XmlEventType.START_DOCUMENT,
      XmlEventType.COMMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.CHARACTERS,
      XmlEventType.END_ELEMENT,
      XmlEventType.END_DOCUMENT,
    ]);
    expect(
      collectTypes(new TokenCursor('<root value="\uE000"/>', true)),
    ).toContain(XmlEventType.START_ELEMENT);

    for (const name of [
      "A\u0300",
      "A\u203F",
      String.fromCodePoint(0xfdf0),
      String.fromCodePoint(0x10000),
    ]) {
      expect(collectTypes(new TokenCursor(`<${name}/>`, true))).toContain(
        XmlEventType.START_ELEMENT,
      );
    }
  });

  it.each([
    "<!DOCTYPE root [<X>]><root/>",
    "<!DOCTYPE root [<!X>]><root/>",
    "<!DOCTYPE root [<!-X>]><root/>",
    "<!DOCTYPE root [<!--a-x-->]><root/>",
    "<!DOCTYPE root [<!--a--x-->]><root/>",
    "<!DOCTYPE root [<!--a---x-->]><root/>",
  ])("scans non-comment and near-comment DTD markup: %s", (xml) => {
    expect(collectTypes(new TokenCursor(xml, true))).toContain(
      XmlEventType.DTD,
    );
  });

  it("resumes a DOCTYPE containing quotes, brackets, and comments", () => {
    const xml = '<!DOCTYPE root [<!ENTITY x "a>b"><!-- c -->]><root/>';
    const expected = collectTypes(new TokenCursor(xml, true));
    for (let split = 1; split < xml.length; split++) {
      const cursor = new TokenCursor(xml.slice(0, split), false);
      const types: unknown[] = [];
      while (true) {
        const type = cursor.next();
        if (type === NEED_INPUT) break;
        types.push(type);
      }
      cursor.push(xml.slice(split), true);
      types.push(...collectTypes(cursor));
      expect(types).toEqual(expected);
    }
  });
});

function drain(cursor: TokenCursor): void {
  while (cursor.next() !== null) {
    /* exhaust */
  }
}

function collectTypes(cursor: TokenCursor): unknown[] {
  const types: unknown[] = [];
  while (true) {
    const type = cursor.next();
    if (type === null || type === NEED_INPUT) return types;
    types.push(type);
  }
}
