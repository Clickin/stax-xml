import { describe, expect, it } from "vitest";
import { EventReaderSync } from "stax-xml-sync";
import { WriterSync, WriterSyncSink } from "stax-xml-sync";
import { EventReader, Writer } from "stax-xml-async";
import { XmlEventType } from "stax-xml-core";

const source =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><?before value?><!DOCTYPE root><!--note--><root xmlns:p="urn:p"><p:empty xmlns:q="urn:q" q:attr="value"/><text><![CDATA[value]]></text></root><?after?>';

describe("event writer pipeline", () => {
  it("keeps one runtime shape across event types", () => {
    const events = Array.from(
      new EventReaderSync(
        '<?xml version="1.0"?><!DOCTYPE root><root>text</root><!--note--><?done?>',
      ),
    );
    const keys = Object.keys(events[0]!);

    for (const event of events) expect(Object.keys(event)).toEqual(keys);
  });

  it("uses undefined for an element without attributes", () => {
    const start = Array.from(new EventReaderSync("<root/>")).find(
      (event) => event.type === XmlEventType.START_ELEMENT,
    );

    expect(start?.attributes).toBeUndefined();
  });

  it("preserves declarations, DTD, namespaces, PI, CDATA, and self-closing elements synchronously", () => {
    const writer = new WriterSync();
    for (const event of new EventReaderSync(source)) writer.writeEvent(event);

    expect(writer.getXmlString()).toBe(source);
  });

  it("writes the same event stream to sync sinks and async writers", async () => {
    const events = Array.from(new EventReaderSync(source));
    const syncChunks: string[] = [];
    const sync = new WriterSyncSink({
      write: (chunk) => syncChunks.push(chunk),
    });
    for (const event of events) sync.writeEvent(event);
    expect(syncChunks.join("")).toBe(source);

    const asyncChunks: string[] = [];
    const async = new Writer({
      encoding: "UTF-8",
      write: (chunk) => asyncChunks.push(chunk),
    });
    for (const event of events) await async.writeEvent(event);
    expect(asyncChunks.join("")).toBe(source);
  });

  it("preserves an XML declaration split across async input chunks", async () => {
    const encoder = new TextEncoder();
    async function* input(): AsyncGenerator<Uint8Array> {
      yield encoder.encode(source.slice(0, 24));
      yield encoder.encode(source.slice(24));
    }
    const chunks: string[] = [];
    const writer = new Writer({
      encoding: "UTF-8",
      write: (chunk) => chunks.push(chunk),
    });
    for await (const event of new EventReader(input()))
      await writer.writeEvent(event);

    expect(chunks.join("")).toBe(source);
  });

  it("supports filtering and replacing events in a pipeline", () => {
    const writer = new WriterSync();
    for (const event of new EventReaderSync(
      "<root><!--discard--><item>old</item></root>",
    )) {
      if (event.type === XmlEventType.COMMENT) continue;
      writer.writeEvent(
        event.type === XmlEventType.CHARACTERS
          ? { ...event, value: "new" }
          : event,
      );
    }

    expect(writer.getXmlString()).toBe("<root><item>new</item></root>");
  });

  it("requires the suppressed end event for a self-closing element to match", () => {
    const events = Array.from(new EventReaderSync("<root/>"));
    const end = events.find((event) => event.type === XmlEventType.END_ELEMENT);
    if (end?.type !== XmlEventType.END_ELEMENT)
      throw new Error("expected END_ELEMENT");
    const writer = new WriterSync();

    for (const event of events) {
      if (event === end) break;
      writer.writeEvent(event);
    }
    expect(() =>
      writer.writeEvent({ ...end, name: "other", localName: "other" }),
    ).toThrow(/self-closing|matching/i);
  });

  it("enforces DTD placement and uniqueness", () => {
    const writer = new WriterSync();
    writer.writeProcessingInstruction("before");
    writer.writeDTD("DOCTYPE root");
    writer.writeComment("after");
    expect(() => writer.writeDTD("DOCTYPE root")).toThrow(/DOCTYPE/i);

    const afterRoot = new WriterSync();
    afterRoot.writeStartElement("root");
    expect(() => afterRoot.writeDTD("DOCTYPE root")).toThrow(/DOCTYPE/i);
  });
});
