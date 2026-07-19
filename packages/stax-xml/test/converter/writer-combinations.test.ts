import { describe, expect, it } from "vitest";
import { Writer } from "stax-xml-async";
import { WriterSync, WriterSyncSink } from "stax-xml-sync";
import { x } from "../../src/converter/converter/index.js";

describe("converter writer combinations", () => {
  it("writes nested empty schema kinds as self-closing elements in sync and async modes", async () => {
    const schema = x.object({
      text: x.string().writer({ element: "text", selfClosing: true }),
      list: x
        .array(x.string().writer({ element: "item" }))
        .writer({ element: "list", selfClosing: true }),
      record: x
        .object({
          id: x.string().writer({ asAttribute: "id" }),
        })
        .writer({ element: "record", selfClosing: true }),
    });
    const data = { text: "", list: [], record: { id: "7" } };
    const options = { rootElement: "root", includeDeclaration: false } as const;
    const expected = '<root><text/><list/><record id="7"/></root>';

    expect(schema.writeSync(data, options)).toBe(expected);
    await expect(schema.write(data, options)).resolves.toBe(expected);
  });

  it("self-closes empty top-level array and object roots", async () => {
    const array = x
      .array(x.string().writer({ element: "item" }))
      .writer({ selfClosing: true });
    const object = x
      .object({ value: x.string().optional() })
      .writer({ selfClosing: true });
    const options = { rootElement: "root", includeDeclaration: false } as const;

    expect(array.writeSync([], options)).toBe("<root/>");
    await expect(array.write([], options)).resolves.toBe("<root/>");
    expect(object.writeSync({ value: undefined }, options)).toBe("<root/>");
    await expect(object.write({ value: undefined }, options)).resolves.toBe(
      "<root/>",
    );

    const ownedArray = x
      .array(x.string().writer({ element: "item" }))
      .writer({ element: "list", selfClosing: true });
    expect(ownedArray.writeSync([], { includeDeclaration: false })).toBe(
      "<list/>",
    );
    await expect(
      ownedArray.write([], { includeDeclaration: false }),
    ).resolves.toBe("<list/>");
    expect(ownedArray.writeSync(["x"], { includeDeclaration: false })).toBe(
      "<list><item>x</item></list>",
    );

    const ownedObject = x
      .object({ value: x.string().optional() })
      .writer({ element: "record", selfClosing: true });
    expect(
      ownedObject.writeSync(
        { value: undefined },
        { includeDeclaration: false },
      ),
    ).toBe("<record/>");
    await expect(
      ownedObject.write({ value: undefined }, { includeDeclaration: false }),
    ).resolves.toBe("<record/>");
    expect(
      ownedObject.writeSync({ value: "x" }, { includeDeclaration: false }),
    ).toBe("<record><value>x</value></record>");
  });

  it("supports injected sync, sink, and async writers", async () => {
    const schema = x.object({
      value: x.string(),
      count: x.number(),
    });
    const data = { value: "A", count: 2 };

    const sync = new WriterSync();
    sync.writeStartElement("root");
    expect(schema.writeSync(data, { writer: sync })).toBe(
      "<root><value>A</value><count>2</count>",
    );
    sync.writeEndElement();

    const sinkChunks: string[] = [];
    const sink = new WriterSyncSink(
      { write: (chunk) => sinkChunks.push(chunk) },
      { bufferSize: 1 },
    );
    sink.writeStartElement("root");
    expect(schema.writeSync(data, { writer: sink })).toBe("");
    sink.writeEndElement();
    sink.writeEndDocument();
    expect(sinkChunks.join("")).toBe(
      "<root><value>A</value><count>2</count></root>",
    );

    const chunks: Uint8Array[] = [];
    const stream = new WritableStream<Uint8Array>({
      write: (chunk) => chunks.push(chunk),
    });
    const asyncWriter = new Writer(stream, { bufferSize: 1 });
    await asyncWriter.writeStartElement("root");
    await schema.writeToStream(data, stream, { writer: asyncWriter });
    await asyncWriter.writeEndElement();
    await asyncWriter.writeEndDocument();
    expect(new TextDecoder().decode(concat(chunks))).toBe(
      "<root><value>A</value><count>2</count></root>",
    );
  });

  it("returns empty strings from injected sinks for every schema kind", () => {
    const chunks: string[] = [];
    const sink = new WriterSyncSink(
      { write: (chunk) => chunks.push(chunk) },
      { bufferSize: 1 },
    );
    sink.writeStartElement("root");
    expect(x.string().writeSync("text", { writer: sink })).toBe("");
    expect(x.number().writeSync(2, { writer: sink })).toBe("");
    expect(
      x
        .array(x.string().writer({ element: "item" }))
        .writeSync(["value"], { writer: sink }),
    ).toBe("");
    expect(
      x
        .object({ value: x.string() })
        .writeSync({ value: "object" }, { writer: sink }),
    ).toBe("");
    sink.writeEndElement();
    sink.writeEndDocument();
    expect(chunks.join("")).toBe(
      "<root>text2<item>value</item><value>object</value></root>",
    );

    expect(x.string().writer({ element: "value" }).writeSync("x")).toMatch(
      /^<\?xml/,
    );
    expect(x.number().writer({ element: "value" }).writeSync(1)).toMatch(
      /^<\?xml/,
    );
    expect(
      x
        .array(x.string().writer({ element: "item" }))
        .writer({ element: "values" })
        .writeSync([]),
    ).toMatch(/^<\?xml/);
  });

  it("wraps injected arrays and primitive numbers without taking ownership of writers", async () => {
    const array = x.array(x.string().writer({ element: "item" }));
    const sync = new WriterSync();
    sync.writeStartElement("outer");
    array.writeSync(["A"], { writer: sync, rootElement: "list" });
    sync.writeEndElement();
    expect(sync.getXmlString()).toBe(
      "<outer><list><item>A</item></list></outer>",
    );

    const chunks: Uint8Array[] = [];
    const stream = new WritableStream<Uint8Array>({
      write: (chunk) => chunks.push(chunk),
    });
    const writer = new Writer(stream, { bufferSize: 1 });
    await writer.writeStartElement("outer");
    await array.writeToStream(["A"], stream, { writer, rootElement: "list" });
    await writer.writeEndElement();
    await writer.writeEndDocument();
    expect(new TextDecoder().decode(concat(chunks))).toBe(
      "<outer><list><item>A</item></list></outer>",
    );

    const number = x.number().writer({ element: "count" });
    expect(number.writeSync(2, { includeDeclaration: false })).toBe(
      "<count>2</count>",
    );
    await expect(number.write(2, { includeDeclaration: false })).resolves.toBe(
      "<count>2</count>",
    );
    expect(x.number().writeSync(2)).toBe("2");
    await expect(x.number().write(2)).resolves.toBe("2");
  });

  it("skips nullish optional and object values in sync and async modes", async () => {
    const optional = x.string().optional().writer({ element: "value" });
    expect(optional.writeSync(undefined)).toBe("");
    expect(optional.writeSync(null as never)).toBe("");
    await expect(optional.write(undefined)).resolves.toBe("");
    await expect(optional.write(null as never)).resolves.toBe("");

    const object = x.object({
      absent: x.string().writer({ element: "absent" }),
      nil: x.string().writer({ element: "nil" }),
      attribute: x.string().writer({ asAttribute: "attribute" }),
    });
    const data = { absent: undefined, nil: null, attribute: null } as never;
    expect(
      object.writeSync(data, {
        rootElement: "root",
        includeDeclaration: false,
      }),
    ).toBe("<root></root>");
    await expect(
      object.write(data, { rootElement: "root", includeDeclaration: false }),
    ).resolves.toBe("<root></root>");

    expect(
      (
        x.object({}).optional() as { _parseText(text: string): unknown }
      )._parseText("ignored"),
    ).toBeUndefined();
    expect(
      (
        x.string().optional() as { _parseText(text: string): unknown }
      )._parseText(""),
    ).toBeUndefined();
    expect(
      (
        x.number().optional() as { _parseText(text: string): unknown }
      )._parseText("invalid"),
    ).toBeUndefined();
  });

  it("rejects missing array element configuration and invalid object writers", async () => {
    const array = x.array(x.string());
    expect(() => array.writeSync(["x"])).toThrow(/require writer/);
    await expect(array.write(["x"])).rejects.toThrow(/require writer/);

    const object = x.object({ value: x.string() });
    const invalid = {} as never;
    expect(() => object.writeSync({ value: "x" }, { writer: invalid })).toThrow(
      /requires WriterSync/,
    );
    await expect(
      object.write({ value: "x" }, { writer: invalid }),
    ).rejects.toThrow(/requires Writer/);

    const attributeOnly = x.object({
      id: x.string().writer({ asAttribute: "id" }),
    });
    expect(() =>
      attributeOnly.writeSync({ id: "7" }, { includeDeclaration: false }),
    ).toThrow(/require a root/);
    await expect(
      attributeOnly.write({ id: "7" }, { includeDeclaration: false }),
    ).rejects.toThrow(/require a root/);

    expect(() => x.number().writeSync(Number.NaN)).toThrow(/finite number/);
    await expect(x.number().write(Number.POSITIVE_INFINITY)).rejects.toThrow(
      /finite number/,
    );
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
