import { describe, expect, it } from "vitest";
import {
  EventReader,
  EventReaderSync,
  StreamReader,
  StreamReaderSync,
  WasmTokenCursor,
  WasmTokenInputSession,
  initWasm,
} from "@stax-xml/wasm";

const encoder = new TextEncoder();
const variants = ["scalar", "simd"] as const;

async function* byteChunks(bytes: Uint8Array): AsyncGenerator<Uint8Array> {
  yield bytes.subarray(0, 3);
  yield bytes.subarray(3, 11);
  yield bytes.subarray(11);
}

function* syncByteChunks(bytes: Uint8Array): Generator<Uint8Array> {
  yield bytes.subarray(0, 3);
  yield bytes.subarray(3, 11);
  yield bytes.subarray(11);
}

function collectNames(reader: StreamReaderSync): string[] {
  const names: string[] = [];
  try {
    while (reader.next() !== null) {
      if (reader.name() !== undefined) names.push(reader.name()!);
    }
    return names;
  } finally {
    reader.close();
  }
}

async function collectAsyncNames(reader: StreamReader): Promise<string[]> {
  const names: string[] = [];
  try {
    while ((await reader.next()) !== null) {
      if (reader.name() !== undefined) names.push(reader.name()!);
    }
    return names;
  } finally {
    await reader.close();
  }
}

describe.each(variants)("WASM public readers (%s)", (variant) => {
  it("parses real UTF-8 bytes through all sync and async reader roles", async () => {
    await initWasm({ variant });
    const bytes = encoder.encode(
      '<root xmlns:p="urn:root"><p:item id="7">value</p:item></root>',
    );

    expect(collectNames(new StreamReaderSync(bytes))).toEqual([
      "root",
      "p:item",
      "p:item",
      "root",
    ]);
    expect(
      collectNames(new StreamReaderSync(syncByteChunks(bytes))),
    ).toEqual(["root", "p:item", "p:item", "root"]);

    expect(await collectAsyncNames(new StreamReader(byteChunks(bytes)))).toEqual([
      "root",
      "p:item",
      "p:item",
      "root",
    ]);

    const events: unknown[] = [];
    const eventReader = new EventReaderSync(syncByteChunks(bytes));
    try {
      for (const event of eventReader) events.push(event);
    } finally {
      eventReader.close();
    }
    expect(events).toHaveLength(7);
    const retained = events[1] as {
      name: string;
      namespaceURI: string;
      attributes?: Map<string, { value: string }>;
    };
    expect(retained).toMatchObject({ name: "root", namespaceURI: "" });
    expect(retained.attributes?.get("xmlns:p")?.value).toBe("urn:root");

    const asyncEvents: unknown[] = [];
    const asyncEventReader = new EventReader(byteChunks(bytes));
    try {
      for await (const event of asyncEventReader) asyncEvents.push(event);
    } finally {
      await asyncEventReader.close();
    }
    expect(asyncEvents).toHaveLength(events.length);
    expect(asyncEvents[1]).toEqual(events[1]);
  });

  it("uses the JS fallback for non-UTF-8 encodings after initialization", async () => {
    await initWasm({ variant });
    const value = "<root>utf16</root>";
    const bytes = new Uint8Array(2 + value.length * 2);
    bytes[0] = 0xff;
    bytes[1] = 0xfe;
    for (let index = 0; index < value.length; index++) {
      const codeUnit = value.charCodeAt(index);
      bytes[2 + index * 2] = codeUnit & 0xff;
      bytes[3 + index * 2] = codeUnit >>> 8;
    }

    expect(
      collectNames(new StreamReaderSync(bytes, { encoding: "utf-16le" })),
    ).toEqual(["root", "root"]);
    expect(
      await collectAsyncNames(
        new StreamReader(byteChunks(bytes), { encoding: "utf-16le" }),
      ),
    ).toEqual(["root", "root"]);
  });

  it("releases sessions and rejects use after disposal", async () => {
    await initWasm({ variant });
    const bytes = encoder.encode("<r/>");
    expect(
      () => new WasmTokenInputSession({ encoding: "utf-16le" }),
    ).toThrow(/UTF-8/i);
    const session = new WasmTokenInputSession({});
    session.dispose();
    session.dispose();
    expect(session.cursor.next()).toBeNull();
    expect(() => session.pushBytes(bytes)).toThrow(/disposed|closed/i);

    const cursor = new WasmTokenCursor();
    cursor.dispose();
    cursor.dispose();
    expect(cursor.next()).toBeNull();
    expect(() => cursor.pushBytes(bytes)).toThrow(/disposed|closed/i);
  });

  it("returns input iterators on explicit close and parse failure", async () => {
    await initWasm({ variant });
    const bytes = encoder.encode("<r/>");
    const pending = new Uint8Array(64 * 1024 + 1);
    pending.fill(0x20);
    pending.set(encoder.encode("<r>"));
    const malformed = new Uint8Array(64 * 1024 + 1);
    malformed.fill(0x20);
    malformed.set(encoder.encode("</wrong>"));
    let syncReturned = false;
    function* trackedSync(): Generator<Uint8Array> {
      try {
        yield pending;
        yield bytes;
      } finally {
        syncReturned = true;
      }
    }
    const syncReader = new StreamReaderSync(trackedSync());
    syncReader.next();
    syncReader.close();
    expect(syncReturned).toBe(true);

    let asyncReturned = false;
    async function* trackedAsync(): AsyncGenerator<Uint8Array> {
      try {
        yield bytes;
        yield bytes;
      } finally {
        asyncReturned = true;
      }
    }
    const asyncReader = new StreamReader(trackedAsync());
    await asyncReader.next();
    await asyncReader.close();
    expect(asyncReturned).toBe(true);

    let syncErrorReturned = false;
    function* malformedSync(): Generator<Uint8Array> {
      try {
        yield pending;
        yield malformed;
      } finally {
        syncErrorReturned = true;
      }
    }
    const malformedSyncReader = new StreamReaderSync(malformedSync());
    expect(() => {
      while (malformedSyncReader.next() !== null) {
        // Consume until the mismatched end tag is observed.
      }
    }).toThrow();
    expect(syncErrorReturned).toBe(true);

    let asyncErrorReturned = false;
    async function* malformedAsync(): AsyncGenerator<Uint8Array> {
      try {
        yield encoder.encode("<r>");
        yield encoder.encode("</wrong>");
      } finally {
        asyncErrorReturned = true;
      }
    }
    const malformedAsyncReader = new StreamReader(malformedAsync());
    await expect(collectAsyncNames(malformedAsyncReader)).rejects.toThrow();
    expect(asyncErrorReturned).toBe(true);
  });
});
