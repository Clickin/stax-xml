import { describe, expect, it } from "vitest";
import {
  XML_NAMESPACE_URI,
  XMLNS_NAMESPACE_URI,
  assertNamespaceBinding,
  assertXmlChars,
  assertXmlEncodingName,
  assertXmlName,
  assertXmlQName,
  isEndDocument,
  isStartDocument,
  planStartElement,
  XmlEventType,
} from "stax-xml-core";

const resolveNone = (): undefined => undefined;
const identity = (value: string): string => value;

describe("XML validation branch coverage", () => {
  it("identifies document boundary events", () => {
    expect(isStartDocument({ type: XmlEventType.START_DOCUMENT })).toBe(true);
    expect(isStartDocument({ type: XmlEventType.END_DOCUMENT })).toBe(false);
    expect(isEndDocument({ type: XmlEventType.END_DOCUMENT })).toBe(true);
    expect(isEndDocument({ type: XmlEventType.START_DOCUMENT })).toBe(false);
  });

  it("accepts every XML NameStartChar and NameChar range represented by the validator", () => {
    const starts = [
      ":",
      "_",
      "A",
      "z",
      "\u00c0",
      "\u00d8",
      "\u00f8",
      "\u0370",
      "\u037f",
      "\u200c",
      "\u2070",
      "\u2c00",
      "\u3001",
      "\uf900",
      "\ufdf0",
      "\u{10000}",
    ];
    const parts = ["0", "-", ".", "\u00b7", "\u0300", "\u203f"];

    for (const value of starts)
      expect(() => assertXmlName(value, "name")).not.toThrow();
    for (const value of parts)
      expect(() => assertXmlName(`a${value}`, "name")).not.toThrow();
    expect(() => assertXmlName("", "name")).toThrow(/invalid/i);
    expect(() => assertXmlName("0name", "name")).toThrow(/invalid/i);
    expect(() => assertXmlQName("a:b:c", "name")).toThrow(/invalid/i);
  });

  it("validates encoding labels, characters, and reserved namespace bindings", () => {
    expect(() => assertXmlEncodingName(7 as never)).toThrow(/encoding/i);
    expect(() => assertXmlChars("\u{10000}", "text")).not.toThrow();
    for (const value of ["\u0001", "\ud800", "\ufffe"]) {
      expect(() => assertXmlChars(value, "text")).toThrow(/character/i);
    }

    expect(() => assertNamespaceBinding("xmlns", "urn:x")).toThrow(/reserved/i);
    expect(() => assertNamespaceBinding("p", "")).toThrow(/undeclared/i);
    expect(() => assertNamespaceBinding("", XMLNS_NAMESPACE_URI)).toThrow(
      /reserved/i,
    );
    expect(() => assertNamespaceBinding("xml", "urn:wrong")).toThrow(
      /must be bound/i,
    );
    expect(() => assertNamespaceBinding("p", XML_NAMESPACE_URI)).toThrow(
      /only be bound/i,
    );
    expect(() =>
      assertNamespaceBinding("xml", XML_NAMESPACE_URI),
    ).not.toThrow();
  });

  it("plans comments, undefined attributes, and namespace declarations", () => {
    const plan = planStartElement(
      "root",
      {
        uri: "urn:default",
        comment: "ok",
        attributes: {
          skipped: undefined as never,
          plain: "value",
          id: { value: "7", prefix: "p", uri: "urn:p" },
          lang: { value: "en", prefix: "xml" },
          local: { value: "x" },
        },
      },
      resolveNone,
      identity,
    );

    expect(plan.startTag).toContain('xmlns="urn:default"');
    expect(plan.startTag).toContain('xmlns:p="urn:p" p:id="7"');
    expect(plan.startTag).not.toContain("skipped");
  });

  it("rejects every invalid start-element namespace and attribute combination", () => {
    expect(() =>
      planStartElement("root", { prefix: "p" }, resolveNone, identity),
    ).toThrow(/not defined/);
    expect(() =>
      planStartElement("root", { prefix: "xmlns" }, resolveNone, identity),
    ).toThrow(/reserved/);
    expect(() =>
      planStartElement(
        "root",
        { comment: "bad--comment" },
        resolveNone,
        identity,
      ),
    ).toThrow(/comment/);
    expect(() =>
      planStartElement(
        "root",
        { attributes: { xmlns: "x" } },
        resolveNone,
        identity,
      ),
    ).toThrow(/reserved/);
    expect(() =>
      planStartElement(
        "root",
        { attributes: { id: { value: "7", prefix: "xmlns" } } },
        resolveNone,
        identity,
      ),
    ).toThrow(/reserved/);
    expect(() =>
      planStartElement(
        "root",
        { attributes: { id: { value: "7", prefix: "p" } } },
        resolveNone,
        identity,
      ),
    ).toThrow(/not defined/);
    expect(() =>
      planStartElement(
        "root",
        { attributes: { id: { value: "7", uri: "urn:id" } } },
        resolveNone,
        identity,
      ),
    ).toThrow(/no prefix/);
    expect(() =>
      planStartElement(
        "root",
        {
          prefix: "p",
          uri: "urn:one",
          attributes: { id: { value: "7", prefix: "p", uri: "urn:two" } },
        },
        resolveNone,
        identity,
      ),
    ).toThrow(/conflicting namespace/i);
  });
});
