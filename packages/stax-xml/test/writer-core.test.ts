import { describe, expect, it } from "vitest";
import { XmlEventType, type AnyXmlEvent } from "stax-xml-core";
import { WriterCore } from "../src/WriterCore.js";

describe("WriterCore", () => {
  it("covers configuration, custom entities, and pretty-print document branches", () => {
    const core = new WriterCore({
      encoding: "UTF-8",
      prettyPrint: true,
      addEntities: [
        { entity: "", value: "ignored" },
        { entity: "@", value: "&at;" },
      ],
    });
    core.setIndentString("\t");
    core.setPrettyPrint(true);
    expect(core.getIndentString()).toBe("\t");
    expect(core.isPrettyPrintEnabled()).toBe(true);

    core.writeStartDocument("1.0", "UTF-8", false);
    core.writeStartElement("root", { comment: "before" });
    core.writeCharacters("plain");
    core.writeCharacters("@");
    core.writeEndDocument();

    expect(core.takeChunks().join("")).toContain('standalone="no"');
    expect(core.takeChunks()).toEqual([]);
    core.writeEndDocument();
  });

  it("covers direct attribute and namespace guards", () => {
    const initial = new WriterCore({ encoding: "UTF-8" });
    expect(() => initial.writeAttribute("id", "1")).toThrow(
      /after writeStartElement/,
    );
    expect(() => initial.writeNamespace("p", "urn:p")).toThrow(
      /after writeStartElement/,
    );

    const core = new WriterCore({ encoding: "UTF-8" });
    core.writeStartElement("root");
    expect(() => core.writeAttribute("xmlns", "x")).toThrow(/reserved/);
    expect(() => core.writeAttribute("id", "1", "xmlns")).toThrow(/reserved/);
    core.writeNamespace("", "urn:default");
    core.writeNamespace("p", "urn:p");
    core.writeAttribute("id", "1", "p");
    core.writeAttribute("lang", "en", "xml");
    core.writeEndElement();
    expect(core.takeChunks().join("")).toContain('xml:lang="en"');
  });

  it("rejects invalid direct content and document placement", () => {
    const core = new WriterCore({ encoding: "UTF-8" });
    expect(() => core.writeCData("bad]]>")).toThrow(/CDATA/);
    expect(() => core.writeProcessingInstruction("xml")).toThrow(/reserved/);
    expect(() => core.writeProcessingInstruction("ok", "bad?>")).toThrow(
      /processing instruction/i,
    );
    expect(() => core.writeDTD("root")).toThrow(/begin with DOCTYPE/);
    core.writeStartElement("root");
    expect(() => core.writeDTD("DOCTYPE root")).toThrow(/DOCTYPE/);
  });

  it("writes valid lexical events and rejects an unbound self-closing prefix", () => {
    const core = new WriterCore({ encoding: "UTF-8" });
    core.writeDTD("DOCTYPE root");
    core.writeProcessingInstruction("before");
    core.writeStartElement("root");
    core.writeCData("data");
    core.writeProcessingInstruction("inside", "value");
    core.writeEndElement();
    core.writeEndDocument();
    expect(core.takeChunks().join("")).toBe(
      "<!DOCTYPE root><?before?><root><![CDATA[data]]><?inside value?></root>",
    );

    const topLevel = new WriterCore({ encoding: "UTF-8" });
    topLevel.writeCData("top");
    expect(topLevel.takeChunks().join("")).toBe("<![CDATA[top]]>");

    const unbound = new WriterCore({ encoding: "UTF-8" });
    expect(() =>
      unbound.writeStartElement("root", { prefix: "p", selfClosing: true }),
    ).toThrow(/not defined/i);

    const xml = new WriterCore({ encoding: "UTF-8" });
    xml.writeStartElement("lang", { prefix: "xml" });
    xml.writeEndElement();
    expect(xml.takeChunks().join("")).toBe("<xml:lang></xml:lang>");
  });

  it("writes materialized namespace and attribute event combinations", () => {
    const core = new WriterCore({ encoding: "UTF-8" });
    core.writeEvent({
      type: XmlEventType.START_ELEMENT,
      name: "p:root",
      localName: "root",
      prefix: "p",
      namespaceURI: "urn:p",
      selfClosing: false,
      attributes: new Map([
        [
          "xmlns:p",
          {
            name: "xmlns:p",
            localName: "p",
            prefix: "xmlns",
            namespaceURI: "http://www.w3.org/2000/xmlns/",
            value: "urn:p",
          },
        ],
        [
          "xmlns",
          {
            name: "xmlns",
            localName: "xmlns",
            prefix: "",
            namespaceURI: "http://www.w3.org/2000/xmlns/",
            value: "urn:default",
          },
        ],
        [
          "p:id",
          {
            name: "p:id",
            localName: "id",
            prefix: "p",
            namespaceURI: "urn:p",
            value: "7",
          },
        ],
        [
          "plain",
          {
            name: "plain",
            localName: "plain",
            prefix: "",
            namespaceURI: "",
            value: "x",
          },
        ],
      ]),
    });
    core.writeEvent({
      type: XmlEventType.END_ELEMENT,
      name: "p:root",
      localName: "root",
      prefix: "p",
      namespaceURI: "urn:p",
    });
    expect(core.takeChunks().join("")).toContain(
      '<p:root xmlns:p="urn:p" xmlns="urn:default" p:id="7" plain="x">',
    );

    const empty = new WriterCore({ encoding: "UTF-8" });
    empty.writeEvent({
      type: XmlEventType.START_ELEMENT,
      name: "empty",
      localName: "empty",
      prefix: "",
      namespaceURI: "",
      selfClosing: true,
    });
    empty.writeEvent({
      type: XmlEventType.END_ELEMENT,
      name: "empty",
      localName: "empty",
      prefix: "",
      namespaceURI: "",
    });
    expect(empty.takeChunks().join("")).toBe("<empty/>");

    const unexpected = new WriterCore({ encoding: "UTF-8" });
    expect(() =>
      unexpected.writeEvent({
        type: XmlEventType.END_ELEMENT,
        name: "root",
        localName: "root",
        prefix: "",
        namespaceURI: "",
      }),
    ).toThrow(/mismatched/i);
  });

  it("returns each produced chunk once and rejects writes after failure", () => {
    const core = new WriterCore({ encoding: "UTF-8" });
    core.writeStartElement("root");

    expect(core.takeChunks().join("")).toBe("<root");
    expect(core.takeChunks()).toEqual([]);

    core.fail();
    expect(() => core.writeCharacters("value")).toThrow(/error state/i);
  });

  it("emits sync chunks directly without retaining them", () => {
    const chunks: string[] = [];
    const core = new WriterCore({ encoding: "UTF-8" }, (chunk) =>
      chunks.push(chunk),
    );

    core.writeStartElement("root");
    core.writeCharacters("value");
    core.writeEndElement();

    expect(chunks.join("")).toBe("<root>value</root>");
    expect(core.takeChunks()).toEqual([]);
  });

  it("does not silently accept an unsupported event type", () => {
    const core = new WriterCore({ encoding: "UTF-8" });
    const event = { type: "RAW", value: "<raw/>" } as unknown as AnyXmlEvent;

    expect(() => core.writeEvent(event)).toThrow(
      /unsupported XML event type: RAW/i,
    );
  });

  it("closes through an END_DOCUMENT event", () => {
    const core = new WriterCore({ encoding: "UTF-8" });

    core.writeEvent({ type: XmlEventType.END_DOCUMENT });

    expect(core.closed).toBe(true);
  });

  it("requires event elements, including suppressed self-closing ends, to finish before the document", () => {
    const open = new WriterCore({ encoding: "UTF-8" });
    open.writeEvent({
      type: XmlEventType.START_ELEMENT,
      name: "root",
      localName: "root",
      prefix: "",
      namespaceURI: "",
      selfClosing: false,
    });
    expect(() => open.writeEndDocument()).toThrow(
      /event elements were closed/i,
    );

    const empty = new WriterCore({ encoding: "UTF-8" });
    empty.writeEvent({
      type: XmlEventType.START_ELEMENT,
      name: "empty",
      localName: "empty",
      prefix: "",
      namespaceURI: "",
      selfClosing: true,
    });
    expect(() => empty.writeEndDocument()).toThrow(
      /event elements were closed/i,
    );

    empty.writeEvent({
      type: XmlEventType.END_ELEMENT,
      name: "empty",
      localName: "empty",
      prefix: "",
      namespaceURI: "",
    });
    empty.writeEndDocument();
    expect(empty.closed).toBe(true);
  });
});
