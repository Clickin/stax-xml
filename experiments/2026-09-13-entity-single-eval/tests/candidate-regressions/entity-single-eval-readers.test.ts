import { describe, expect, it } from "vitest";
import {
  EventReader,
  EventReaderSync,
  XmlEventType,
  type AnyXmlEvent,
  type EventReaderOptions,
} from "stax-xml";

const encoder = new TextEncoder();

function bytes(xml: string): Uint8Array {
  return encoder.encode(xml);
}

function fixedChunks(input: Uint8Array, size: number): Uint8Array[] {
  const result: Uint8Array[] = [];
  for (let offset = 0; offset < input.length; offset += size)
    result.push(input.slice(offset, offset + size));
  return result;
}

async function* asyncChunks(
  xml: string,
  size: number,
): AsyncGenerator<Uint8Array> {
  yield* fixedChunks(bytes(xml), size);
}

function eventShape(event: AnyXmlEvent): unknown {
  if (event.type === XmlEventType.START_ELEMENT) {
    return [
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
    ];
  }
  if (event.type === XmlEventType.END_ELEMENT) {
    return [
      event.type,
      event.name,
      event.localName,
      event.prefix,
      event.namespaceURI,
    ];
  }
  if (
    event.type === XmlEventType.CHARACTERS ||
    event.type === XmlEventType.CDATA ||
    event.type === XmlEventType.COMMENT ||
    event.type === XmlEventType.DTD
  ) {
    return [event.type, event.value];
  }
  if (event.type === XmlEventType.PROCESSING_INSTRUCTION)
    return [event.type, event.target, event.data];
  if (event.type === XmlEventType.START_DOCUMENT)
    return [
      event.type,
      event.version,
      event.encoding,
      event.standalone,
    ];
  return [event.type];
}

function transcript(events: AnyXmlEvent[]): string {
  return JSON.stringify(events.map(eventShape));
}

function collectSync(
  xml: string,
  options: EventReaderOptions = {},
): AnyXmlEvent[] {
  return Array.from(new EventReaderSync(xml, options));
}

async function collectAsync(
  xml: string,
  size: number,
  options: EventReaderOptions = {},
): Promise<AnyXmlEvent[]> {
  const result: AnyXmlEvent[] = [];
  for await (const event of new EventReader(asyncChunks(xml, size), options))
    result.push(event);
  return result;
}

function byteOffset(xml: string, codeUnitOffset: number): number {
  return bytes(xml.slice(0, codeUnitOffset)).length;
}

async function* markerChunks(xml: string): AsyncGenerator<Uint8Array> {
  const input = bytes(xml);
  const cuts = new Set<number>([0, input.length]);
  for (const marker of ["&amp;", "&#x1F600;", "]]>", "\"", "'"]) {
    let from = 0;
    while (true) {
      const index = xml.indexOf(marker, from);
      if (index < 0) break;
      const start = byteOffset(xml, index);
      const end = byteOffset(xml, index + marker.length);
      for (const cut of [start - 1, start, start + 1, end - 1, end, end + 1])
        if (cut > 0 && cut < input.length) cuts.add(cut);
      from = index + marker.length;
    }
  }
  const ordered = Array.from(cuts).sort((left, right) => left - right);
  for (let index = 1; index < ordered.length; index++)
    yield input.slice(ordered[index - 1]!, ordered[index]!);
}

interface ParseFailure {
  prefix: string;
  name: string;
  message: string;
}

function syncFailure(xml: string): ParseFailure {
  const prefix: AnyXmlEvent[] = [];
  try {
    const reader = new EventReaderSync(xml);
    while (true) {
      const result = reader.next();
      if (result.done) break;
      prefix.push(result.value);
    }
  } catch (error) {
    const failure = error as Error;
    return {
      prefix: transcript(prefix),
      name: failure.constructor.name,
      message: failure.message,
    };
  }
  throw new Error("expected synchronous parse failure");
}

async function asyncFailure(
  xml: string,
  size: number,
): Promise<ParseFailure> {
  const prefix: AnyXmlEvent[] = [];
  const reader = new EventReader(asyncChunks(xml, size));
  try {
    while (true) {
      const result = await reader.next();
      if (result.done) break;
      prefix.push(result.value);
    }
  } catch (error) {
    const failure = error as Error;
    return {
      prefix: transcript(prefix),
      name: failure.constructor.name,
      message: failure.message,
    };
  }
  throw new Error("expected asynchronous parse failure");
}

describe("single-evaluation reader parity", () => {
  it("matches complete synchronous event output across 1, 2, and 3 byte chunks", async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE root><!--&amp;--><?work &amp;?><root xmlns:p="urn:one&amp;two" p:id="&#x1F600;" plain="&amp;lt;">한글😀&amp;lt;<![CDATA[&amp;]]><?inner &name;?><item empty=""/></root>';
    const expected = transcript(collectSync(xml));

    for (const size of [1, 2, 3]) {
      const actual = await collectAsync(xml, size);
      // R0 publishes START_DOCUMENT before a split declaration is complete.
      expect(eventShape(actual[0]!)).toEqual(["START_DOCUMENT", undefined, undefined, undefined]);
      expect(transcript(actual.slice(1))).toBe(transcript(collectSync(xml).slice(1)));
    }
    expect(transcript(await (async () => {
      const result: AnyXmlEvent[] = [];
      for await (const event of new EventReader(markerChunks(xml))) result.push(event);
      return result;
    })())).toBe(expected);
  });

  it("keeps the full raw event output equivalent when entity decoding is disabled", async () => {
    const xml =
      '<root xmlns:p="urn:one&amp;two" p:id="&amp;lt;" plain="&amp;"><p:item>&amp;lt;</p:item></root>';
    const options = { autoDecodeEntities: false };
    const expected = transcript(collectSync(xml, options));
    expect(transcript(await collectAsync(xml, 1, options))).toBe(expected);
    expect(collectSync(xml, options).find(
      (event) => event.type === XmlEventType.CHARACTERS,
    )).toMatchObject({ value: "&amp;lt;" });
  });

  it("preserves declaration, BOM, fragment, self-closing, and mixed token semantics", async () => {
    const xml =
      "\uFEFF<?xml version=\"1.0\" standalone=\"yes\"?><root><empty/><text>before&amp;after</text><![CDATA[&amp;]]><!--note--><?pi &amp;?></root>";
    const actual = await collectAsync(xml, 1);
    expect(eventShape(actual[0]!)).toEqual(["START_DOCUMENT", undefined, undefined, undefined]);
    expect(transcript(actual.slice(1))).toBe(transcript(collectSync(xml).slice(1)));

    const types = collectSync(xml).map((event) => event.type);
    expect(types).toEqual([
      XmlEventType.START_DOCUMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.END_ELEMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.CHARACTERS,
      XmlEventType.END_ELEMENT,
      XmlEventType.CDATA,
      XmlEventType.COMMENT,
      XmlEventType.PROCESSING_INSTRUCTION,
      XmlEventType.END_ELEMENT,
      XmlEventType.END_DOCUMENT,
    ]);
  });

  it("keeps document-mode root and trailing-whitespace rules distinct from fragments", async () => {
    const document = '<?xml version="1.0"?><root/> \n\t';
    const options = { documentMode: "document" as const };
    const actual = await collectAsync(document, 1, options);
    expect(eventShape(actual[0]!)).toEqual(["START_DOCUMENT", undefined, undefined, undefined]);
    expect(transcript(actual.slice(1))).toBe(transcript(collectSync(document, options).slice(1)));
    expect(
      collectSync("<one/><two/>").filter(
        (event) => event.type === XmlEventType.START_ELEMENT,
      ),
    ).toHaveLength(2);
    expect(() => collectSync("<root/>tail", options)).toThrow(
      /outside the root|exactly one root/i,
    );
  });

  it.each([
    ["unknown attribute entity", '<root value="&unknown;"/>', /unknown or invalid entity/i],
    ["invalid numeric attribute entity", '<root value="&#0;"/>', /unknown or invalid entity/i],
    ["unterminated attribute entity", '<root value="&amp"/>', /unterminated entity/i],
    ["unknown text entity", "<root>&unknown;</root>", /unknown or invalid entity/i],
    ["unterminated text entity", "<root>&amp</root>", /unterminated entity/i],
    ["literal less-than attribute", '<root value="literal <"/>', /attribute values cannot contain </i],
  ] as const)(
    "reports %s at the same event boundary for sync and async readers",
    async (_name, xml, error) => {
      const sync = syncFailure(xml);
      expect(sync.message).toMatch(error);

      for (const size of [1, 2, 3]) {
        const asyncResult = await asyncFailure(xml, size);
        expect(asyncResult).toEqual(sync);
      }
    },
  );

  it("does not return a START_ELEMENT before rejecting its malformed attribute", async () => {
    const reader = new EventReader(asyncChunks('<root value="&unknown;"/>', 1));
    await expect(reader.next()).resolves.toMatchObject({
      done: false,
      value: { type: XmlEventType.START_DOCUMENT },
    });
    await expect(reader.next()).rejects.toThrow(/unknown or invalid entity/i);
  });

  it("does not turn a decoded ]]> into a lexical CDATA error", async () => {
    const xml = "<root>left]]&gt;right</root>";
    const expected = collectSync(xml);
    expect(
      expected.find((event) => event.type === XmlEventType.CHARACTERS),
    ).toMatchObject({ value: "left]]>right" });
    expect(transcript(await collectAsync(xml, 1))).toBe(transcript(expected));
    expect(() => collectSync("<root>left]]>right</root>")).toThrow(
      /cannot contain \]\]>/i,
    );
  });

  it("keeps the last valid event before a malformed fragment tail", async () => {
    const xml = "<root><ok/></root>&unknown;";
    const sync = syncFailure(xml);
    expect(sync.prefix).toBe(
      JSON.stringify([
        [XmlEventType.START_DOCUMENT, null, null, null],
        [XmlEventType.START_ELEMENT, "root", "root", "", "", false, []],
        [XmlEventType.START_ELEMENT, "ok", "ok", "", "", true, []],
        [XmlEventType.END_ELEMENT, "ok", "ok", "", ""],
        [XmlEventType.END_ELEMENT, "root", "root", "", ""],
      ]),
    );
    expect(sync.message).toMatch(/unknown or invalid entity/i);
    expect(await asyncFailure(xml, 1)).toEqual(sync);
  });

  it("keeps a valid result after a large entity-bearing value is followed by a small token", async () => {
    const large = `${"a".repeat(1024 * 1024 - 32)}😀&amp;tail`;
    const xml = `<root><large value="${large}"/><small value="&empty;"/></root>`;
    const options = {
      addEntities: [{ entity: "empty", value: "" }],
    };
    const expected = transcript(collectSync(xml, options));
    for (const size of [1024, 64 * 1024, 1024 * 1024])
      expect(transcript(await collectAsync(xml, size, options))).toBe(expected);
  });
});

describe("single-evaluation async reader coordination", () => {
  it("rejects concurrent next calls without changing the successful result", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    async function* source(): AsyncGenerator<Uint8Array> {
      await gate;
      yield bytes("<root/>");
    }
    const reader = new EventReader(source());
    const first = reader.next();
    await expect(reader.next()).rejects.toThrow(/concurrent|pending|progress/i);
    release();
    await expect(first).resolves.toMatchObject({
      done: false,
      value: { type: XmlEventType.START_DOCUMENT },
    });
  });

  it("does not read beyond the event that is needed from an async source", async () => {
    let pulls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    async function* source(): AsyncGenerator<Uint8Array> {
      pulls++;
      yield bytes("<root><item/></root>");
      await gate;
      pulls++;
      yield bytes("");
    }
    const reader = new EventReader(source());
    await reader.next();
    await reader.next();
    await reader.next();
    await reader.next();
    expect(pulls).toBe(1);
    const pending = reader.next();
    await Promise.resolve();
    expect(pulls).toBe(1);
    release();
    await expect(pending).resolves.toMatchObject({
      value: { type: XmlEventType.END_ELEMENT, name: "root" },
    });
  });
});
