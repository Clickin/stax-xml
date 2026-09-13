import { describe, expect, it } from "vitest";
import {
  EventReader,
  EventReaderSync,
  XmlEventType,
  type AnyXmlEvent,
  type EventReaderOptions,
  type EventReaderSyncOptions,
  type StartElementEvent,
} from "stax-xml";

const encoder = new TextEncoder();

function bytes(value: string): Uint8Array {
  return encoder.encode(value);
}

async function* chunks(
  value: string,
  size = 1,
): AsyncGenerator<Uint8Array> {
  const input = bytes(value);
  for (let offset = 0; offset < input.length; offset += size)
    yield input.slice(offset, offset + size);
}

function startEvents(events: AnyXmlEvent[]): StartElementEvent[] {
  return events.filter(
    (event): event is StartElementEvent =>
      event.type === XmlEventType.START_ELEMENT,
  );
}

function eventDigest(event: AnyXmlEvent): string {
  if (event.type === XmlEventType.START_ELEMENT) {
    return JSON.stringify([
      event.type,
      event.name,
      event.localName,
      event.prefix,
      event.namespaceURI,
      event.selfClosing,
      Array.from(event.attributes?.values() ?? [], (attribute) => [
        attribute.name,
        attribute.localName,
        attribute.prefix,
        attribute.namespaceURI,
        attribute.value,
      ]),
    ]);
  }
  if (event.type === XmlEventType.END_ELEMENT)
    return JSON.stringify([
      event.type,
      event.name,
      event.localName,
      event.prefix,
      event.namespaceURI,
    ]);
  if (
    event.type === XmlEventType.CHARACTERS ||
    event.type === XmlEventType.CDATA ||
    event.type === XmlEventType.COMMENT ||
    event.type === XmlEventType.DTD
  )
    return JSON.stringify([event.type, event.value]);
  if (event.type === XmlEventType.PROCESSING_INSTRUCTION)
    return JSON.stringify([event.type, event.target, event.data]);
  if (event.type === XmlEventType.START_DOCUMENT)
    return JSON.stringify([
      event.type,
      event.version,
      event.encoding,
      event.standalone,
    ]);
  return JSON.stringify([event.type]);
}

describe("materialized event and attribute lifetimes", () => {
  it("keeps a synchronous event, its Map, and attributes stable through thousands of later tokens and close", () => {
    const tail = Array.from(
      { length: 2500 },
      (_, index) => `<small n="${index}">v${index}</small>`,
    ).join("");
    const reader = new EventReaderSync(
      `<root><large id="first" empty="">&amp;😀</large>${tail}</root>`,
    );
    let saved!: StartElementEvent;
    let savedAttribute!: { value: string };
    let savedMap!: NonNullable<StartElementEvent["attributes"]>;
    const all: AnyXmlEvent[] = [];

    while (true) {
      const result = reader.next();
      if (result.done) break;
      all.push(result.value);
      if (
        result.value.type === XmlEventType.START_ELEMENT &&
        result.value.name === "large"
      ) {
        saved = result.value;
        savedMap = result.value.attributes!;
        savedAttribute = savedMap.get("id")!;
      }
    }
    reader.close();

    expect(saved).toBeDefined();
    expect(savedMap).toBeDefined();
    expect(savedAttribute).toEqual({
      name: "id",
      localName: "id",
      prefix: "",
      namespaceURI: "",
      value: "first",
    });
    expect(savedMap.get("empty")?.value).toBe("");
    expect(saved.attributes).toBe(savedMap);
    expect(savedMap.get("id")).toBe(savedAttribute);
    expect(eventDigest(saved)).toContain("first");
    expect(all.length).toBeGreaterThan(5000);
  });

  it("does not reuse async event objects or attribute Maps", async () => {
    const reader = new EventReader(
      chunks("<root><item id='one'/><item id='two'/></root>", 1),
    );
    const saved: StartElementEvent[] = [];
    for await (const event of reader) {
      if (event.type === XmlEventType.START_ELEMENT && event.name === "item")
        saved.push(event);
    }

    expect(saved).toHaveLength(2);
    expect(saved[0]).not.toBe(saved[1]);
    expect(saved[0]?.attributes).not.toBe(saved[1]?.attributes);
    expect(saved[0]?.attributes?.get("id")?.value).toBe("one");
    expect(saved[1]?.attributes?.get("id")?.value).toBe("two");
  });

  it("keeps retained async events unchanged after later advancement and close", async () => {
    const reader = new EventReader(
      chunks("<root><item id='first'>one</item><item id='second'>two</item></root>", 1),
    );
    let saved!: IteratorYieldResult<AnyXmlEvent>;
    while (true) {
      const result = await reader.next();
      if (result.done) throw new Error("missing item");
      if (
        result.value.type === XmlEventType.START_ELEMENT &&
        result.value.name === "item"
      ) {
        saved = result;
        break;
      }
    }
    const before = eventDigest(saved.value);
    const map =
      saved.value.type === XmlEventType.START_ELEMENT
        ? saved.value.attributes
        : undefined;
    const attribute = map?.get("id");

    while (!(await reader.next()).done) {
      /* exhaust */
    }
    await reader.close();

    expect(eventDigest(saved.value)).toBe(before);
    expect(saved.value).toMatchObject({
      type: XmlEventType.START_ELEMENT,
      name: "item",
    });
    expect(map?.get("id")).toBe(attribute);
    expect(attribute?.value).toBe("first");
  });

  it("honors non-enumerable option properties and evaluates option getters on the original object", async () => {
    const definitions = [{ entity: "empty", value: "" }];
    let syncReads = 0;
    const syncOptions = {} as EventReaderSyncOptions;
    Object.defineProperty(syncOptions, "addEntities", {
      configurable: true,
      enumerable: false,
      get() {
        syncReads++;
        return definitions;
      },
    });
    const sync = Array.from(
      new EventReaderSync('<root value="&empty;"/>', syncOptions),
    ).find((event) => event.type === XmlEventType.START_ELEMENT);
    if (sync?.type !== XmlEventType.START_ELEMENT)
      throw new Error("expected sync start element");
    expect(sync.attributes?.get("value")?.value).toBe("");
    expect(syncReads).toBeGreaterThan(0);

    let asyncReads = 0;
    const asyncOptions = {} as EventReaderOptions;
    Object.defineProperty(asyncOptions, "autoDecodeEntities", {
      configurable: true,
      enumerable: false,
      get() {
        asyncReads++;
        return false;
      },
    });
    const asyncReader = new EventReader(
      chunks('<root value="&amp;"/>', 1),
      asyncOptions,
    );
    let asyncStart!: StartElementEvent;
    for await (const event of asyncReader) {
      if (event.type === XmlEventType.START_ELEMENT) asyncStart = event;
    }
    expect(asyncStart.attributes?.get("value")?.value).toBe("&amp;");
    expect(asyncReads).toBeGreaterThan(0);
  });

  it("retries a partial start tag without mixing values from the previous attempt", async () => {
    const xml = '<root first="before&amp;after" second="😀"/>';
    const expected = Array.from(new EventReaderSync(xml)).map(eventDigest);
    const actual: string[] = [];
    for await (const event of new EventReader(chunks(xml, 1)))
      actual.push(eventDigest(event));
    expect(actual).toEqual(expected);

    const starts = actual.filter((value) => value.includes("START_ELEMENT"));
    expect(starts).toHaveLength(1);
    expect(starts[0]).toContain("before&after");
    expect(starts[0]).toContain("😀");
  });

  it("handles a large attribute set followed by a small token without stale normalized values", () => {
    const attributes = Array.from(
      { length: 256 },
      (_, index) => `a${index}="${"v".repeat(512)}"`,
    ).join(" ");
    const reader = new EventReaderSync(
      `<root ${attributes}><small value="&amp;"/></root>`,
    );
    const starts = startEvents(Array.from(reader));
    const large = starts.find((event) => event.name === "root")!;
    const small = starts.find((event) => event.name === "small")!;

    expect(large.attributes).toBeDefined();
    expect(large.attributes?.size).toBe(256);
    expect(large.attributes?.get("a0")?.value).toBe("v".repeat(512));
    expect(large.attributes?.get("a255")?.value).toBe("v".repeat(512));
    expect(small.attributes?.size).toBe(1);
    expect(small.attributes?.get("value")?.value).toBe("&");
    expect(large.attributes?.get("a0")?.value).toBe("v".repeat(512));
  });
});

describe("EventReader close, failure, and pending-input lifecycle", () => {
  it("closes an async source exactly once after first-next close", async () => {
    let returned = 0;
    async function* source(): AsyncGenerator<Uint8Array> {
      try {
        yield bytes("<root><child/></root>");
      } finally {
        returned++;
      }
    }
    const reader = new EventReader(source());
    await reader.next();
    await reader.close();
    await reader.close();
    expect(returned).toBe(1);
    await expect(reader.next()).resolves.toEqual({
      value: undefined,
      done: true,
    });
  });

  it("resolves a pending next as done when close interrupts input", async () => {
    let returned = 0;
    let resolvePending!: (
      result: IteratorResult<Uint8Array>,
    ) => void;
    const pending = new Promise<IteratorResult<Uint8Array>>((resolve) => {
      resolvePending = resolve;
    });
    const source: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator]() {
        let first = true;
        return {
          next: () => {
            if (first) {
              first = false;
              return Promise.resolve({
                value: bytes("<root/>"),
                done: false,
              });
            }
            return pending;
          },
          return: () => {
            returned++;
            resolvePending({ value: undefined, done: true });
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    };
    const reader = new EventReader(source);
    await reader.next();
    await reader.next();
    expect((await reader.next()).value).toMatchObject({ type: XmlEventType.END_ELEMENT });
    const next = reader.next();
    await reader.close();
    await expect(next).resolves.toEqual({ value: undefined, done: true });
    expect(returned).toBe(1);
  });

  it("preserves a primary parse error when iterator cleanup also throws", async () => {
    let returned = 0;
    const source: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator]() {
        let yielded = false;
        return {
          next: () => {
            if (yielded)
              return Promise.resolve({ value: undefined, done: true });
            yielded = true;
            return Promise.resolve({
              value: bytes('<root value="&unknown;"/>'),
              done: false,
            });
          },
          return: () => {
            returned++;
            throw new Error("cleanup failed");
          },
        };
      },
    };
    const reader = new EventReader(source);
    await reader.next();
    await expect(reader.next()).rejects.toThrow(/unknown or invalid entity/i);
    expect(returned).toBe(1);
    await expect(reader.next()).resolves.toEqual({
      value: undefined,
      done: true,
    });
  });

  it("exposes a cleanup error from iterator.return when no primary parse error exists", async () => {
    const source: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator]() {
        return {
          next: () =>
            Promise.resolve({
              value: bytes("<root/>"),
              done: false,
            }),
          return: () => {
            throw new Error("close failed");
          },
        };
      },
    };
    const reader = new EventReader(source);
    await reader.next();
    await expect(reader.return()).rejects.toThrow("close failed");
  });

  it("can recreate a parser after close without retaining the previous event state", () => {
    const first = Array.from(new EventReaderSync("<root a='one'/>"));
    const second = Array.from(new EventReaderSync("<root a='two'/>"));
    const firstStart = first.find(
      (event): event is StartElementEvent =>
        event.type === XmlEventType.START_ELEMENT,
    );
    const secondStart = second.find(
      (event): event is StartElementEvent =>
        event.type === XmlEventType.START_ELEMENT,
    );
    expect(firstStart?.attributes?.get("a")?.value).toBe("one");
    expect(secondStart?.attributes?.get("a")?.value).toBe("two");
  });
});
