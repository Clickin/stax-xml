import { describe, expect, it } from "vitest";
import {
  EventReaderSync,
  WasmTokenCursor,
  XmlEventType,
  initWasm,
  jsTokenBackendFactory,
  withWasmBackend,
  wasmTokenBackendFactory,
} from "@stax-xml/wasm";
import { x } from "stax-xml/converter";
import { TokenCursorConsumer } from "@stax-xml/core";
import {
  runBackendContract,
  runDifferentialFuzz,
  collectBytes,
} from "../../stax-xml/test/backend-contract.js";

const variants = ["scalar", "simd"] as const;
const encoder = new TextEncoder();

it("switches scalar/SIMD assets while caching each compiled variant", async () => {
  const scalar = await initWasm({ variant: "scalar" });
  const simd = await initWasm({ variant: "simd" });
  expect(await initWasm({ variant: "scalar" })).toBe(scalar);
  expect(await initWasm({ variant: "simd" })).toBe(simd);
});

describe.each(variants)("compiled WASM %s backend", (variant) => {
  it("exposes the numeric batch ABI and control block", async () => {
    const module = await initWasm({ variant });
    const raw = new WebAssembly.Instance(module, {
      env: { abort() { throw new Error("AssemblyScript abort"); } },
    }).exports as Record<string, any>;
    try {
      expect(raw.abiVersion()).toBe(2);
      const control = raw.initialize(0, 1, 1);
      const first = encoder.encode("<r>text</r>");
      const pointer = raw.reserve(first.byteLength);
      new Uint8Array(raw.memory.buffer).set(first, pointer);
      expect(raw.commit(first.byteLength, 1)).toBe(0);
      expect(raw.nextBatch(0, 1, 1024, 65536, 262144)).toBe(1);
      const view = new DataView(raw.memory.buffer);
      const tokenPtr = view.getUint32(control + 32, true);
      expect(view.getUint32(tokenPtr, true)).toBe(1);
      expect(raw.nextBatch(1, 128, 1024, 65536, 262144)).toBe(4);
      expect(view.getUint32(control + 24, true)).toBe(4);
    } finally {
      raw.dispose();
    }
  });

  it("passes the shared byte-ingress/token accessor contract", async () => {
    await initWasm({ variant });
    runBackendContract(wasmTokenBackendFactory);
  });

  it("matches the JS backend for the recorded deterministic fuzz seed", async () => {
    await initWasm({ variant });
    runDifferentialFuzz(wasmTokenBackendFactory, 0x5a17c0de, 300);
  });

  it("restores namespace bindings and retains materialized events", async () => {
    await initWasm({ variant });
    const reader = new EventReaderSync(
      encoder.encode(
        '<root xmlns:p="urn:outer" p:id="outer"><p:child xmlns:p="urn:inner"/><p:child p:id="outer"/></root>',
      ),
    );
    const events: unknown[] = [];
    try {
      for (const event of reader) events.push(event);
    } finally {
      reader.close();
    }

    const root = events.find(
      (event): event is {
        name: string;
        namespaceURI: string;
        attributes?: Map<string, { value: string; namespaceURI: string }>;
      } =>
        typeof event === "object" &&
        event !== null &&
        "name" in event &&
        (event as { name?: unknown }).name === "root",
    );
    const children = events.filter(
      (event): event is {
        name: string;
        namespaceURI: string;
        attributes?: Map<string, { value: string; namespaceURI: string }>;
      } =>
        typeof event === "object" &&
        event !== null &&
        "type" in event &&
        event.type === XmlEventType.START_ELEMENT &&
        "name" in event &&
        (event as { name?: unknown }).name === "p:child",
    );

    expect(root).toMatchObject({
      name: "root",
      namespaceURI: "",
    });
    expect(root?.attributes?.get("p:id")).toMatchObject({
      value: "outer",
      namespaceURI: "urn:outer",
    });
    expect(children).toHaveLength(2);
    expect(children[0]?.namespaceURI).toBe("urn:inner");
    expect(children[1]?.namespaceURI).toBe("urn:outer");
    expect(children[1]?.attributes?.get("p:id")?.namespaceURI).toBe("urn:outer");
  });

  it("keeps changing attribute layouts and namespace aliases coherent", async () => {
    await initWasm({ variant });
    const cursor = new WasmTokenCursor();
    const consumer = new TokenCursorConsumer(cursor);

    const xml =
      '<root xmlns:p="urn:outer" p:wide="wide" p:empty="" plain="">' +
      '<p:inner xmlns:p="urn:inner"><p:none/><p:leaf p:id=""/></p:inner>' +
      '<p:restored p:id="outer"/></root>';
    try {
      cursor.pushBytes(encoder.encode(xml), true);
      expect(cursor.next()).toBe(XmlEventType.START_DOCUMENT);

      expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
      expect(cursor.name()).toBe("root");
      expect(cursor.localName()).toBe("root");
      expect(cursor.attributeCount()).toBe(4);
      expect(cursor.attributeValue(2)).toBe("");
      expect(cursor.attributeName(3)).toBe("plain");
      expect(cursor.attributeLocalName(3)).toBe("plain");
      expect(cursor.attributePrefix(3)).toBe("");
      expect(cursor.attributeNamespaceURI(3)).toBe("");
      expect(cursor.attributeName(1)).toBe("p:wide");
      expect(cursor.attributeLocalName(1)).toBe("wide");
      expect(cursor.attributePrefix(1)).toBe("p");
      expect(cursor.attributeNamespaceURI(1)).toBe("urn:outer");
      expect(cursor.attributeValue(1)).toBe("wide");
      expect(cursor.namespaceURIForPrefix("p")).toBe("urn:outer");

      expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
      expect(cursor.name()).toBe("p:inner");
      expect(cursor.localName()).toBe("inner");
      expect(cursor.prefix()).toBe("p");
      expect(cursor.namespaceURI()).toBe("urn:inner");
      expect(cursor.attributeCount()).toBe(1);
      expect(cursor.attributeName(0)).toBe("xmlns:p");
      expect(cursor.attributeLocalName(0)).toBe("p");
      expect(cursor.attributePrefix(0)).toBe("xmlns");
      expect(cursor.attributeNamespaceURI(0)).toBe("http://www.w3.org/2000/xmlns/");
      expect(cursor.attributeValue(0)).toBe("urn:inner");
      expect(cursor.namespaceURIForPrefix("p")).toBe("urn:inner");

      expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
      expect(cursor.name()).toBe("p:none");
      expect(cursor.localName()).toBe("none");
      expect(cursor.attributeCount()).toBe(0);
      expect(cursor.attributeName(0)).toBeUndefined();
      expect(cursor.attributeValue(0)).toBeUndefined();
      expect(cursor.namespaceURI()).toBe("urn:inner");
      expect(cursor.next()).toBe(XmlEventType.END_ELEMENT);

      expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
      expect(cursor.name()).toBe("p:leaf");
      expect(cursor.localName()).toBe("leaf");
      expect(cursor.attributeCount()).toBe(1);
      expect(cursor.attributeValue(0)).toBe("");
      expect(cursor.attributeName(0)).toBe("p:id");
      expect(cursor.attributeLocalName(0)).toBe("id");
      expect(cursor.attributePrefix(0)).toBe("p");
      expect(cursor.attributeNamespaceURI(0)).toBe("urn:inner");
      expect(cursor.next()).toBe(XmlEventType.END_ELEMENT);
      expect(cursor.next()).toBe(XmlEventType.END_ELEMENT);

      expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
      expect(cursor.name()).toBe("p:restored");
      expect(cursor.localName()).toBe("restored");
      expect(cursor.namespaceURI()).toBe("urn:outer");
      expect(cursor.attributeName(0)).toBe("p:id");
      expect(cursor.attributeNamespaceURI(0)).toBe("urn:outer");
      expect(cursor.namespaceURIForPrefix("p")).toBe("urn:outer");
    } finally {
      cursor.dispose();
    }
  });

  it("retains long names and expanded values across input compaction", async () => {
    await initWasm({ variant });
    const root = `é${"a".repeat(2048)}`;
    const inner = `é${"b".repeat(2048)}`;
    const leaf = `é${"c".repeat(1024)}`;
    const prefix = `p${"x".repeat(256)}`;
    const attribute = `a${"d".repeat(1024)}`;
    const outerUri = `urn:${"한".repeat(2048)}`;
    const innerUri = `urn:${"글".repeat(2048)}`;
    const expanded = "한😀".repeat(10_000);
    const xml =
      `<${root} xmlns:${prefix}="${outerUri}">` +
      `<${prefix}:${inner} xmlns:${prefix}="${innerUri}">` +
      `<${prefix}:${leaf} ${prefix}:${attribute}="&large;">value</${prefix}:${leaf}>` +
      `</${prefix}:${inner}></${root}>`;
    const bytes = encoder.encode(xml);
    const cuts: number[] = [];
    let offset = 0;
    for (const width of [1, 2, 3, 15, 16, 17, 257]) {
      offset = Math.min(bytes.length, offset + width);
      cuts.push(offset);
    }
    while (offset < bytes.length) {
      offset = Math.min(bytes.length, offset + 4096);
      cuts.push(offset);
    }
    const options = {
      addEntities: [{ entity: "large", value: expanded }],
    };
    const expected = collectBytes(jsTokenBackendFactory, bytes, [], options);
    const actual = collectBytes(wasmTokenBackendFactory, bytes, cuts, options);
    expect(actual, JSON.stringify({ xmlLength: bytes.length, cuts })).toEqual(expected);
  });

  it("validates custom entities on the real WASM byte session", async () => {
    await initWasm({ variant });
    const invalid = [
      { entities: [{ entity: "bad name", value: "x" }], message: /invalid custom entity/i },
      { entities: [{ entity: "amp", value: "override" }], message: /predefined/i },
      {
        entities: [
          { entity: "copy", value: "©" },
          { entity: "&copy;", value: "duplicate" },
        ],
        message: /duplicate/i,
      },
      { entities: [{ entity: "bad", value: "\u0000" }], message: /invalid XML character/i },
    ] as const;

    for (const { entities, message } of invalid) {
      expect(() =>
        wasmTokenBackendFactory.createByteSession({
          addEntities: entities,
          encoding: "utf-8",
        }),
      ).toThrow(message);
    }
  });

  it("injects the backend into sync and async compiled converter parses", async () => {
    await initWasm({ variant });
    const schema = x.object({
      title: x.string("/book/title"),
      count: x.number("/book/count"),
    });
    const xml = '<book><title>WASM</title><count>7</count></book>';
    const bytes = encoder.encode(xml);

    expect(schema.parseSync(bytes, withWasmBackend({}))).toEqual({
      title: "WASM",
      count: 7,
    });

    async function* chunks(): AsyncGenerator<Uint8Array> {
      yield bytes.subarray(0, 5);
      yield bytes.subarray(5, 17);
      yield bytes.subarray(17);
    }
    await expect(
      schema.parse(chunks(), withWasmBackend({})),
    ).resolves.toEqual({ title: "WASM", count: 7 });
  });

  it("keeps stale memory views valid after linear-memory growth", async () => {
    await initWasm({ variant });
    const cursor = new WasmTokenCursor();
    const text = "é".repeat(1_000_000);
    const input = encoder.encode(`<r>${text}</r>`);
    try {
      const before = cursor.memoryStats();
      cursor.pushBytes(input, true);
      let sawText = false;
      for (;;) {
        if (cursor.next() === null) break;
        // Read accessors after any memory growth, including the large text span.
        sawText ||= cursor.text() === text;
        void cursor.name();
        void cursor.attributeCount();
      }
      const after = cursor.memoryStats();

      expect(after.pages).toBeGreaterThan(before.pages);
      expect(sawText).toBe(true);
    } finally {
      cursor.dispose();
    }
  });
});
