import { describe, expect, it } from "vitest";
import { StreamReader, Writer } from "stax-xml-async";
import { StreamReaderSync, WriterSyncSink } from "stax-xml-sync";
import { XmlEventType } from "stax-xml-core";

describe("reader and writer I/O coverage", () => {
  it("rejects invalid async reader chunks and exposes namespace lookup", async () => {
    async function* invalid(): AsyncGenerator<Uint8Array> {
      yield "bad" as never;
    }
    await expect(new StreamReader(invalid()).next()).rejects.toThrow(
      /Uint8Array/,
    );

    async function* valid(): AsyncGenerator<Uint8Array> {
      yield new TextEncoder().encode('<p:root xmlns:p="urn:p"/>');
    }
    const reader = new StreamReader(valid());
    expect(await reader.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(await reader.next()).toBe(XmlEventType.START_ELEMENT);
    expect(reader.namespaceURIForPrefix("p")).toBe("urn:p");
    await reader.close();
  });

  it("releases an already completed ReadableStream reader", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("<root/>"));
        controller.close();
      },
    });
    const reader = new StreamReader(stream);
    while ((await reader.next()) !== null) {
      /* exhaust */
    }
    await reader.close();
    await reader.close();
  });

  it("covers sync reader batching and accessors", () => {
    const bytes = new TextEncoder().encode(
      `<root xmlns:p="urn:p" p:id="1">${"x".repeat(70_000)}</root>`,
    );
    const reader = new StreamReaderSync([new Uint8Array(), bytes]);
    expect(reader.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(reader.next()).toBe(XmlEventType.START_ELEMENT);
    expect(reader.attributeName(0)).toBe("xmlns:p");
    expect(reader.attributeLocalName(1)).toBe("id");
    expect(reader.attributePrefix(1)).toBe("p");
    expect(reader.attributeNamespaceURI(1)).toBe("urn:p");
    expect(reader.attributeValue(1)).toBe("1");
    expect(reader.attributeValue("urn:p", "id")).toBe("1");
    expect(reader.namespaceURIForPrefix("p")).toBe("urn:p");
    reader.close();
    expect(reader.next()).toBeNull();
  });

  it("covers async attribute, namespace, tiny-buffer, and idempotent close paths", async () => {
    const chunks: Uint8Array[] = [];
    const writer = new Writer(
      new WritableStream<Uint8Array>({ write: (chunk) => chunks.push(chunk) }),
      { bufferSize: 1 },
    );
    await writer.writeStartElement("root");
    await writer.writeNamespace("p", "urn:p");
    await writer.writeAttribute("id", "1", "p");
    await writer.writeCharacters("😀");
    await writer.writeEndElement();
    await writer.close();
    await writer.close();
    expect(new TextDecoder().decode(concat(chunks))).toContain(
      'p:id="1">😀</root>',
    );

    const boundary = new Writer(
      new WritableStream<Uint8Array>({ write() {} }),
      { bufferSize: 4, enableAutoFlush: false },
    );
    await boundary.writeRaw("abcd");
    await boundary.writeRaw("e");
    await boundary.close();
  });

  it("marks async text sinks failed on flush and close errors", async () => {
    expect(() => new Writer({ encoding: "UTF-8" } as never)).toThrow(
      /write must be a function/,
    );

    const flush = new Writer({
      encoding: "UTF-8",
      write() {},
      flush() {
        throw new Error("flush failed");
      },
    });
    await expect(flush.flush()).rejects.toThrow("flush failed");
    await expect(flush.flush()).rejects.toThrow(/error state/);

    const close = new Writer({
      encoding: "UTF-8",
      write() {},
      close() {
        throw new Error("close failed");
      },
    });
    await expect(close.close()).rejects.toThrow("close failed");
    await expect(close.close()).resolves.toBeUndefined();

    const write = new Writer(
      {
        encoding: "UTF-8",
        write() {
          throw new Error("write failed");
        },
      },
      { bufferSize: 1 },
    );
    await expect(write.writeRaw("x")).rejects.toThrow("write failed");
    await expect(write.flush()).rejects.toThrow(/error state/);
  });

  it("marks sync sinks failed and covers closing an already finalized sink", () => {
    const failed = new WriterSyncSink({
      write() {},
      flush() {
        throw new Error("flush failed");
      },
    });
    expect(() => failed.flush()).toThrow("flush failed");
    expect(() => failed.flush()).toThrow(/error state/);

    const writeFailed = new WriterSyncSink(
      {
        write() {
          throw new Error("write failed");
        },
      },
      { bufferSize: 1 },
    );
    expect(() => writeFailed.writeRaw("x")).toThrow("write failed");
    expect(() => writeFailed.flush()).toThrow(/error state/);

    const closeFailed = new WriterSyncSink({
      write() {},
      close() {
        throw new Error("close failed");
      },
    });
    expect(() => closeFailed.close()).toThrow("close failed");
    expect(() => closeFailed.flush()).toThrow(/error state/);

    const lifecycle: string[] = [];
    const closed = new WriterSyncSink(
      {
        write() {},
        flush() {
          lifecycle.push("flush");
        },
        close() {
          lifecycle.push("close");
        },
      },
      { flushOnClose: true },
    );
    closed.writeEndDocument();
    closed.close();
    expect(lifecycle).toEqual(["flush", "flush", "close"]);

    const rawChunks: string[] = [];
    const raw = new WriterSyncSink(
      { write: (chunk) => rawChunks.push(chunk) },
      { bufferSize: 1 },
    );
    raw.writeRaw("<raw/>");
    raw.writeEndDocument();
    expect(rawChunks.join("")).toBe("<raw/>");

    const absoluteThreshold = new WriterSyncSink(
      { write() {} },
      { bufferSize: 4, flushThreshold: 2 },
    );
    absoluteThreshold.writeRaw("ab");
    absoluteThreshold.close();

    const emptyReader = new StreamReaderSync([]);
    expect(emptyReader.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(emptyReader.next()).toBe(XmlEventType.END_DOCUMENT);
    expect(emptyReader.next()).toBeNull();
  });
});

function concat(chunks: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    chunks.reduce((length, chunk) => length + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}
