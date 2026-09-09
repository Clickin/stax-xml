import { describe, expect, it } from "vitest";
import {
  EventReaderSync,
  TokenCursorWasm,
  XmlEventType,
  initWasm,
  withWasmBackend,
  wasmTokenBackendFactory,
} from "@stax-xml/wasm";
import { x } from "stax-xml/converter";
import {
  runBackendContract,
  runDifferentialFuzz,
} from "../../stax-xml/test/backend-contract.js";

const variants = ["scalar", "simd"] as const;
const encoder = new TextEncoder();

interface RawTokenizer {
  memory: WebAssembly.Memory;
  initialize(documentMode: number, namespaceAware: number, autoDecode: number): void;
  reserve(length: number): number;
  commit(length: number, final: number): number;
  next(): number;
  fieldPtr(field: number, index: number): number;
  fieldLen(field: number, index: number): number;
  lookupNamespace(ptr: number, length: number): void;
  scratch(length: number): number;
  dispose(): void;
}

function rawSpan(raw: RawTokenizer, field: number, index: number): string | undefined {
  const length = raw.fieldLen(field, index);
  if (length < 0) return undefined;
  const pointer = raw.fieldPtr(field, index);
  return new TextDecoder().decode(
    new Uint8Array(raw.memory.buffer, pointer, length),
  );
}

it("switches scalar/SIMD assets while caching each compiled variant", async () => {
  const scalar = await initWasm({ variant: "scalar" });
  const simd = await initWasm({ variant: "simd" });
  expect(await initWasm({ variant: "scalar" })).toBe(scalar);
  expect(await initWasm({ variant: "simd" })).toBe(simd);
});

describe.each(variants)("compiled WASM %s backend", (variant) => {
  it("keeps the raw ABI incremental and exposes pointer/length spans", async () => {
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
      expect(raw.next()).toBe(-1);

      const second = encoder.encode(
        ' xmlns:p="urn:p" p:id="7"/>',
      );
      pointer = raw.reserve(second.byteLength);
      new Uint8Array(raw.memory.buffer).set(second, pointer);
      expect(raw.commit(second.byteLength, 1)).toBe(0);
      expect(raw.next()).toBe(3);
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
