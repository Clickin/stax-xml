import { describe, expect, it } from "vitest";
import {
  EventReaderSync,
  TokenCursorWasm,
  XmlEventType,
  initWasm,
  jsTokenBackendFactory,
  withWasmBackend,
  wasmTokenBackendFactory,
} from "@stax-xml/wasm";
import { x } from "stax-xml/converter";
import {
  runBackendContract,
  runDifferentialFuzz,
  collectBytes,
} from "../../stax-xml/test/backend-contract.js";

const variants = ["scalar", "simd"] as const;
const encoder = new TextEncoder();

interface RawTokenizer {
  memory: WebAssembly.Memory;
  initialize(documentMode: number, namespaceAware: number, autoDecode: number): void;
  reserve(length: number): number;
  commit(length: number, final: number): number;
  next(): number;
  tokenView(): number;
  lookupNamespace(ptr: number, length: number): void;
  scratch(length: number): number;
  dispose(): void;
}

function rawSpan(raw: RawTokenizer, field: number, index: number): string | undefined {
  const header = raw.tokenView();
  const view = new DataView(raw.memory.buffer);
  const word = (index: number) => view.getUint32(header + index * 4, true);
  const u32 = (pointer: number, index: number) =>
    view.getUint32(pointer + index * 4, true);
  const i32 = (pointer: number, index: number) =>
    view.getInt32(pointer + index * 4, true);
  const fieldPtrs = word(0);
  const fieldLens = word(1);
  const inputPtr = word(2);
  const attributeCount = word(3);
  if (index < 0 || (field >= 5 && field <= 9 && index >= attributeCount))
    return undefined;
  let pointer: number;
  let length: number;
  if (field >= 5 && field <= 9) {
    const attrNames = word(6);
    const attrNameLens = word(7);
    const attrValues = word(8);
    const attrValueLens = word(9);
    const attrColons = word(10);
    const attrUris = word(11);
    const attrUriLens = word(12);
    switch (field) {
      case 5:
        pointer = inputPtr + u32(attrNames, index);
        length = i32(attrNameLens, index);
        break;
      case 6: {
        const nameOffset = u32(attrNames, index);
        const nameLength = i32(attrNameLens, index);
        const colon = i32(attrColons, index);
        pointer = inputPtr + (colon < 0 ? nameOffset : colon + 1);
        length = colon < 0 ? nameLength : nameLength - (colon - nameOffset) - 1;
        break;
      }
      case 7: {
        const nameOffset = u32(attrNames, index);
        const colon = i32(attrColons, index);
        pointer = inputPtr + nameOffset;
        length = colon < 0 ? 0 : colon - nameOffset;
        break;
      }
      case 8:
        pointer = u32(attrUris, index);
        length = i32(attrUriLens, index);
        break;
      default:
        pointer = u32(attrValues, index);
        length = i32(attrValueLens, index);
        break;
    }
  } else {
    if (field < 0 || (field > 4 && field < 10) || field > 12)
      return undefined;
    pointer = u32(fieldPtrs, field);
    length = i32(fieldLens, field);
  }
  if (length < 0) return undefined;
  return new TextDecoder().decode(
    new Uint8Array(raw.memory.buffer, pointer, length),
  );
}

function rawAttributeCount(raw: RawTokenizer): number {
  return new Int32Array(raw.memory.buffer, raw.tokenView() + 12, 1)[0]!;
}

function rawSelfClosing(raw: RawTokenizer): boolean {
  return new Int32Array(raw.memory.buffer, raw.tokenView() + 16, 1)[0]! !== 0;
}

function rawDeclarationStandalone(raw: RawTokenizer): number {
  return new Int32Array(raw.memory.buffer, raw.tokenView() + 20, 1)[0]!;
}

it("switches scalar/SIMD assets while caching each compiled variant", async () => {
  const scalar = await initWasm({ variant: "scalar" });
  const simd = await initWasm({ variant: "simd" });
  expect(await initWasm({ variant: "scalar" })).toBe(scalar);
  expect(await initWasm({ variant: "simd" })).toBe(simd);
});

describe.each(variants)("compiled WASM %s backend", (variant) => {
  it("keeps the raw ABI incremental and exposes tokenView spans", async () => {
    const module = await initWasm({ variant });
    const raw = new WebAssembly.Instance(module, {
      env: { abort() { throw new Error("AssemblyScript abort"); } },
    }).exports as unknown as RawTokenizer;
    try {
      raw.initialize(0, 1, 1);
      const first = encoder.encode("<r");
      let pointer = raw.reserve(first.byteLength);
      new Uint8Array(raw.memory.buffer).set(first, pointer);
      expect(raw.commit(first.byteLength, 0)).toBe(0);
      expect(raw.next()).toBe(1);
      expect(rawDeclarationStandalone(raw)).toBe(-1);
      expect(raw.next()).toBe(-1);

      const second = encoder.encode(
        ' xmlns:p="urn:p" p:id="7"/>',
      );
      pointer = raw.reserve(second.byteLength);
      new Uint8Array(raw.memory.buffer).set(second, pointer);
      expect(raw.commit(second.byteLength, 1)).toBe(0);
      expect(raw.next()).toBe(3);
      expect(rawAttributeCount(raw)).toBe(2);
      expect(rawSelfClosing(raw)).toBe(true);
      expect(rawSpan(raw, 0, 0)).toBe("r");
      expect(rawSpan(raw, 5, 0)).toBe("xmlns:p");
      expect(rawSpan(raw, 9, 1)).toBe("7");

      const prefix = encoder.encode("p");
      const scratch = raw.scratch(prefix.byteLength);
      new Uint8Array(raw.memory.buffer).set(prefix, scratch);
      raw.lookupNamespace(scratch, prefix.byteLength);
      expect(rawSpan(raw, 12, 0)).toBe("urn:p");
      expect(raw.next()).toBe(4);
      expect(raw.next()).toBe(2);
      expect(raw.next()).toBe(0);
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
    const cursor = new TokenCursorWasm();
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
    const cursor = new TokenCursorWasm();
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
