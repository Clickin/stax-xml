import { Buffer } from 'node:buffer';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  initStaxXml,
  StreamEventType,
  StreamReaderSync,
} from '../src/index';
import { nodeFileByteBatchesSync } from '../src/adapters/node';
import { ShortValueStringCache } from '../src/runtime/string-materialization';
import { resetStaxXmlRuntimeForTests } from '../src/runtime';

const encoder = new TextEncoder();
const EVENT_BYTES = 28;
const ATTR_BYTES = 16;
const HEADER_BYTES = 28;
const NAME_IDS_FLAG = 1 << 8;
const VALUE_IDS_FLAG = 1 << 9;

afterEach(() => {
  vi.restoreAllMocks();
  resetStaxXmlRuntimeForTests();
});

describe('StreamReaderSync', () => {
  it('pulls native streaming byte batches through cursor-style accessors', async () => {
    const chunks = [
      Buffer.from('<r a="x">'),
      encoder.encode('ok'),
      encoder.encode('</r>'),
    ];
    const pushed: Array<{ chunk: string; isFinal: boolean }> = [];

    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushChunk(chunk: Uint8Array, isFinal: boolean) {
            pushed.push({ chunk: new TextDecoder().decode(chunk), isFinal });
            if (isFinal) {
              return {
                buffer: chunk,
                table: encodeStructuralIndex(chunk, [event(StreamEventType.END_DOCUMENT)], []),
              };
            }
            if (pushed.length === 1) {
              return {
                buffer: chunk,
                table: encodeStructuralIndex(chunk, [
                  event(StreamEventType.START_DOCUMENT),
                  event(StreamEventType.START_ELEMENT, span(chunk, 'r'), none(), 0, 1),
                ], [
                  attr(span(chunk, 'a'), span(chunk, 'x')),
                ]),
              };
            }
            if (pushed.length === 2) {
              return {
                buffer: chunk,
                table: encodeStructuralIndex(chunk, [
                  event(StreamEventType.CHARACTERS, none(), span(chunk, 'ok')),
                ], []),
              };
            }
            return {
              buffer: chunk,
              table: encodeStructuralIndex(chunk, [
                event(StreamEventType.END_ELEMENT, span(chunk, 'r')),
              ], []),
            };
          },
        }),
      }),
    });

    const reader = new StreamReaderSync([[chunks[0]!], [chunks[1]!, chunks[2]!]], { backend: 'native' });

    expect(reader.next()).toBe(StreamEventType.START_DOCUMENT);
    expect(reader.eventType()).toBe(StreamEventType.START_DOCUMENT);
    expect(reader.name()).toBeUndefined();
    expect(reader.getAttributeCount()).toBe(0);

    expect(reader.next()).toBe(StreamEventType.START_ELEMENT);
    expect(reader.name()).toBe('r');
    expect(reader.getAttributeCount()).toBe(1);
    expect(reader.getAttributeName(0)).toBe('a');
    expect(reader.getAttributeValue(0)).toBe('x');
    expect(reader.getAttributeValue('a')).toBe('x');
    expect(reader.getAttributeValue('missing')).toBeUndefined();

    expect(reader.next()).toBe(StreamEventType.CHARACTERS);
    expect(reader.text()).toBe('ok');

    expect(reader.next()).toBe(StreamEventType.END_ELEMENT);
    expect(reader.name()).toBe('r');

    expect(reader.next()).toBe(StreamEventType.END_DOCUMENT);
    expect(reader.next()).toBeNull();
    expect(reader.next()).toBeNull();

    expect(pushed).toEqual([
      { chunk: '<r a="x">', isFinal: false },
      { chunk: 'ok', isFinal: false },
      { chunk: '</r>', isFinal: false },
      { chunk: '', isFinal: true },
    ]);
  });

  it('accepts Uint8Array convenience input as one byte batch', async () => {
    const pushed: Array<{ chunk: string; isFinal: boolean }> = [];
    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushChunk(chunk: Uint8Array, isFinal: boolean) {
            pushed.push({ chunk: new TextDecoder().decode(chunk), isFinal });
            return {
              buffer: chunk,
              table: encodeStructuralIndex(chunk, isFinal
                ? [event(StreamEventType.END_DOCUMENT)]
                : [
                    event(StreamEventType.START_DOCUMENT),
                    event(StreamEventType.START_ELEMENT, span(chunk, 'r')),
                    event(StreamEventType.END_ELEMENT, span(chunk, 'r')),
                  ], []),
            };
          },
        }),
      }),
    });

    const reader = new StreamReaderSync(encoder.encode('<r/>'), { backend: 'native' });

    expect([reader.next(), reader.next(), reader.next(), reader.next(), reader.next()]).toEqual([
      StreamEventType.START_DOCUMENT,
      StreamEventType.START_ELEMENT,
      StreamEventType.END_ELEMENT,
      StreamEventType.END_DOCUMENT,
      null,
    ]);
    expect(pushed).toEqual([
      { chunk: '<r/>', isFinal: false },
      { chunk: '', isFinal: true },
    ]);
  });

  it('prefers native pushBatch when the backend exposes batched chunk ingestion', async () => {
    const pushedBatches: Array<{ chunks: string[]; isFinal: boolean }> = [];
    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushChunk() {
            throw new Error('pushChunk should not be used when pushBatch is available');
          },
          pushBatch(chunks: readonly Uint8Array[], isFinal: boolean) {
            pushedBatches.push({
              chunks: chunks.map(chunk => new TextDecoder().decode(chunk)),
              isFinal,
            });

            const buffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
            return {
              buffer,
              table: encodeStructuralIndex(buffer, isFinal
                ? [event(StreamEventType.END_DOCUMENT)]
                : [
                    event(StreamEventType.START_DOCUMENT),
                    event(StreamEventType.START_ELEMENT, span(buffer, 'r')),
                    event(StreamEventType.CHARACTERS, none(), span(buffer, 'ok')),
                    event(StreamEventType.END_ELEMENT, span(buffer, 'r')),
                  ], []),
            };
          },
        }),
      }),
    });

    const reader = new StreamReaderSync([[encoder.encode('<r>'), encoder.encode('ok'), encoder.encode('</r>')]], {
      backend: 'native',
    });

    expect([
      reader.next(),
      reader.next(),
      reader.next(),
      reader.next(),
      reader.next(),
      reader.next(),
    ]).toEqual([
      StreamEventType.START_DOCUMENT,
      StreamEventType.START_ELEMENT,
      StreamEventType.CHARACTERS,
      StreamEventType.END_ELEMENT,
      StreamEventType.END_DOCUMENT,
      null,
    ]);
    expect(pushedBatches).toEqual([
      { chunks: ['<r>', 'ok', '</r>'], isFinal: false },
      { chunks: [], isFinal: true },
    ]);
  });

  it('memoizes current-event strings and reuses parser-lifetime name/value strings across batches', async () => {
    const first = Buffer.from('<catalogEntryX attributeNameX="attributeValueX">');
    const second = Buffer.from('</catalogEntryX><catalogEntryX attributeNameX="attributeValueX">');
    const third = Buffer.from('</catalogEntryX>');
    const firstToString = vi.fn((encoding: string, start: number, end: number) =>
      Buffer.prototype.toString.call(first, encoding, start, end),
    );
    const secondToString = vi.fn((encoding: string, start: number, end: number) =>
      Buffer.prototype.toString.call(second, encoding, start, end),
    );
    const thirdToString = vi.fn((encoding: string, start: number, end: number) =>
      Buffer.prototype.toString.call(third, encoding, start, end),
    );
    Object.defineProperty(first, 'toString', { value: firstToString });
    Object.defineProperty(second, 'toString', { value: secondToString });
    Object.defineProperty(third, 'toString', { value: thirdToString });

    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushChunk(chunk: Uint8Array, isFinal: boolean) {
            if (isFinal) {
              return {
                buffer: chunk,
                table: encodeStructuralIndex(chunk, [event(StreamEventType.END_DOCUMENT)], []),
              };
            }
            if (chunk === first) {
              return {
                buffer: chunk,
                table: encodeStructuralIndex(chunk, [
                  event(StreamEventType.START_DOCUMENT),
                  event(StreamEventType.START_ELEMENT, span(chunk, 'catalogEntryX'), none(), 0, 1),
                ], [
                  attr(span(chunk, 'attributeNameX'), span(chunk, 'attributeValueX')),
                ]),
              };
            }
            if (chunk === second) {
              return {
                buffer: chunk,
                table: encodeStructuralIndex(chunk, [
                  event(StreamEventType.END_ELEMENT, span(chunk, 'catalogEntryX')),
                  event(StreamEventType.START_ELEMENT, span(chunk, 'catalogEntryX'), none(), 0, 1),
                ], [
                  attr(span(chunk, 'attributeNameX'), span(chunk, 'attributeValueX')),
                ]),
              };
            }
            return {
              buffer: chunk,
              table: encodeStructuralIndex(chunk, [
                event(StreamEventType.END_ELEMENT, span(chunk, 'catalogEntryX')),
              ], []),
            };
          },
        }),
      }),
    });

    const reader = new StreamReaderSync([[first], [second], [third]], { backend: 'native' });

    expect(reader.next()).toBe(StreamEventType.START_DOCUMENT);
    expect(reader.next()).toBe(StreamEventType.START_ELEMENT);
    expect(reader.name()).toBe('catalogEntryX');
    expect(reader.name()).toBe('catalogEntryX');
    expect(reader.getAttributeName(0)).toBe('attributeNameX');
    expect(reader.getAttributeName(0)).toBe('attributeNameX');
    expect(reader.getAttributeValue(0)).toBe('attributeValueX');
    expect(reader.getAttributeValue(0)).toBe('attributeValueX');
    expect(reader.getAttributeValue('attributeNameX')).toBe('attributeValueX');
    expect(reader.getAttributeValue('attributeNameX')).toBe('attributeValueX');

    expect(reader.next()).toBe(StreamEventType.END_ELEMENT);
    expect(reader.name()).toBe('catalogEntryX');
    expect(reader.name()).toBe('catalogEntryX');

    expect(reader.next()).toBe(StreamEventType.START_ELEMENT);
    expect(reader.name()).toBe('catalogEntryX');
    expect(reader.getAttributeName(0)).toBe('attributeNameX');
    expect(reader.getAttributeValue(0)).toBe('attributeValueX');
    expect(reader.getAttributeValue('attributeNameX')).toBe('attributeValueX');

    expect(firstToString).toHaveBeenCalledTimes(3);
    expect(secondToString).toHaveBeenCalledTimes(0);
    expect(thirdToString).toHaveBeenCalledTimes(0);
  });

  it('uses value-id caches for repeated byte-backed short values before the hash fallback', async () => {
    const first = Buffer.from('<root><item attr="attributeValueX">payloadValueX</item>');
    const second = Buffer.from('<item attr="attributeValueX">payloadValueX</item></root>');
    const rememberBytesSpy = vi.spyOn(ShortValueStringCache.prototype, 'rememberBytes')
      .mockImplementation(() => {
        throw new Error('rememberBytes should not be used when value ids are present');
      });

    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushChunk(chunk: Uint8Array, isFinal: boolean) {
            if (isFinal) {
              return {
                buffer: chunk,
                table: encodeStructuralIndex(chunk, [event(StreamEventType.END_DOCUMENT)], [], {
                  includeValueIds: true,
                }),
              };
            }
            if (chunk === first) {
              return {
                buffer: chunk,
                table: encodeStructuralIndex(chunk, [
                  event(StreamEventType.START_DOCUMENT),
                  event(StreamEventType.START_ELEMENT, span(chunk, 'root')),
                  event(StreamEventType.START_ELEMENT, span(chunk, 'item'), none(), 0, 1),
                  event(StreamEventType.CHARACTERS, none(), span(chunk, 'payloadValueX')),
                  event(StreamEventType.END_ELEMENT, span(chunk, 'item')),
                ], [
                  attr(span(chunk, 'attr'), span(chunk, 'attributeValueX')),
                ], {
                  includeValueIds: true,
                }),
              };
            }
            return {
              buffer: chunk,
              table: encodeStructuralIndex(chunk, [
                event(StreamEventType.START_ELEMENT, span(chunk, 'item'), none(), 0, 1),
                event(StreamEventType.CHARACTERS, none(), span(chunk, 'payloadValueX')),
                event(StreamEventType.END_ELEMENT, span(chunk, 'item')),
                event(StreamEventType.END_ELEMENT, span(chunk, 'root')),
              ], [
                attr(span(chunk, 'attr'), span(chunk, 'attributeValueX')),
              ], {
                includeValueIds: true,
              }),
            };
          },
        }),
      }),
    });

    const reader = new StreamReaderSync([[first], [second]], { backend: 'native' });

    expect(reader.next()).toBe(StreamEventType.START_DOCUMENT);
    expect(reader.next()).toBe(StreamEventType.START_ELEMENT);
    expect(reader.name()).toBe('root');

    expect(reader.next()).toBe(StreamEventType.START_ELEMENT);
    expect(reader.name()).toBe('item');
    expect(reader.getAttributeValue(0)).toBe('attributeValueX');
    expect(reader.getAttributeValue(0)).toBe('attributeValueX');

    expect(reader.next()).toBe(StreamEventType.CHARACTERS);
    expect(reader.text()).toBe('payloadValueX');
    expect(reader.text()).toBe('payloadValueX');

    expect(reader.next()).toBe(StreamEventType.END_ELEMENT);
    expect(reader.next()).toBe(StreamEventType.START_ELEMENT);
    expect(reader.getAttributeValue(0)).toBe('attributeValueX');
    expect(reader.next()).toBe(StreamEventType.CHARACTERS);
    expect(reader.text()).toBe('payloadValueX');
    expect(reader.next()).toBe(StreamEventType.END_ELEMENT);
    expect(reader.next()).toBe(StreamEventType.END_ELEMENT);
    expect(reader.next()).toBe(StreamEventType.END_DOCUMENT);
    expect(reader.next()).toBeNull();
    expect(rememberBytesSpy).not.toHaveBeenCalled();
  });

  it('surfaces CDATA and propagates native parser errors', async () => {
    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushChunk(chunk: Uint8Array, isFinal: boolean) {
            const xml = new TextDecoder().decode(chunk);
            if (xml.includes('<broken')) {
              throw new Error('native malformed XML');
            }
            return {
              buffer: chunk,
              table: encodeStructuralIndex(chunk, isFinal
                ? [event(StreamEventType.END_DOCUMENT)]
                : [
                    event(StreamEventType.START_DOCUMENT),
                    event(StreamEventType.START_ELEMENT, span(chunk, 'r')),
                    event(StreamEventType.CDATA, none(), span(chunk, 'x')),
                    event(StreamEventType.END_ELEMENT, span(chunk, 'r')),
                  ], []),
            };
          },
        }),
      }),
    });

    const cdata = new StreamReaderSync(encoder.encode('<r><![CDATA[x]]></r>'), { backend: 'native' });
    expect([cdata.next(), cdata.next(), cdata.next()]).toEqual([
      StreamEventType.START_DOCUMENT,
      StreamEventType.START_ELEMENT,
      StreamEventType.CDATA,
    ]);
    expect(cdata.text()).toBe('x');
    expect([cdata.next(), cdata.next(), cdata.next()]).toEqual([
      StreamEventType.END_ELEMENT,
      StreamEventType.END_DOCUMENT,
      null,
    ]);

    const broken = new StreamReaderSync(encoder.encode('<broken'), { backend: 'native' });
    expect(() => broken.next()).toThrow(/native malformed XML/);
  });

  it('fails clearly when no native or wasm streaming backend is initialized', async () => {
    expect(() => new StreamReaderSync([[encoder.encode('<r/>')]])).toThrow(
      /StreamReaderSync requires an initialized native or wasm streaming event batch backend/,
    );

    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        parseStructuralIndexUint8Array: () => new Uint8Array(),
      }),
    });

    expect(() => new StreamReaderSync([[encoder.encode('<r/>')]], { backend: 'native' })).toThrow(
      /StreamReaderSync requires an initialized native or wasm streaming event batch backend/,
    );
  });

  it('exposes the sync Node file byte-batch helper from the node adapter', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stax-stream-reader-'));
    try {
      const filePath = join(dir, 'sample.xml');
      writeFileSync(filePath, '<root><item/></root>');

      expect(Array.from(nodeFileByteBatchesSync(filePath, { chunkSize: 6, batchSize: 2 }))
        .map(batch => batch.map(chunk => chunk.toString('utf8'))))
        .toEqual([
          ['<root>', '<item/'],
          ['></roo', 't>'],
        ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

type Span = { start: number; end: number };
type EventRecord = {
  type: number;
  name: Span;
  text: Span;
  attrStart: number;
  attrCount: number;
};
type AttrRecord = { name: Span; value: Span };

function none(): Span {
  return { start: -1, end: -1 };
}

function span(input: Uint8Array, value: string): Span {
  const needle = encoder.encode(value);
  for (let start = 0; start <= input.byteLength - needle.byteLength; start++) {
    let matched = true;
    for (let index = 0; index < needle.byteLength; index++) {
      if (input[start + index] !== needle[index]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return { start, end: start + needle.byteLength };
    }
  }
  throw new Error(`Missing byte span value: ${value}`);
}

function event(
  type: number,
  name: Span = none(),
  text: Span = none(),
  attrStart = 0,
  attrCount = 0,
): EventRecord {
  return { type, name, text, attrStart, attrCount };
}

function attr(name: Span, value: Span): AttrRecord {
  return { name, value };
}

function encodeStructuralIndex(
  input: Uint8Array,
  events: EventRecord[],
  attrs: AttrRecord[],
  options: { includeValueIds?: boolean } = {},
): Uint8Array {
  const allNameIds = internNameIds(
    input,
    [...events.map(record => record.name), ...attrs.map(record => record.name)],
    value => spanBytes(input, value.start, value.end),
  );
  const eventNameIds = allNameIds.slice(0, events.length);
  const attrNameIds = allNameIds.slice(events.length);
  const allValueIds = options.includeValueIds
    ? internValueIds(
        input,
        [...events.map(record => record.text), ...attrs.map(record => record.value)],
        value => spanBytes(input, value.start, value.end),
      )
    : [];
  const eventValueIds = allValueIds.slice(0, events.length);
  const attrValueIds = allValueIds.slice(events.length);
  const buffer = new ArrayBuffer(
    HEADER_BYTES
      + events.length * EVENT_BYTES
      + attrs.length * ATTR_BYTES
      + eventNameIds.length * 4
      + attrNameIds.length * 4
      + (options.includeValueIds ? (eventValueIds.length + attrValueIds.length) * 4 : 0),
  );
  const view = new DataView(buffer);
  view.setUint32(0, 0x31545053, true);
  view.setUint32(4, events.length, true);
  view.setUint32(8, attrs.length, true);
  view.setUint32(12, input.byteLength, true);
  view.setUint32(16, EVENT_BYTES, true);
  view.setUint32(20, ATTR_BYTES, true);
  view.setUint32(24, 1 | NAME_IDS_FLAG | (options.includeValueIds ? VALUE_IDS_FLAG : 0), true);

  let offset = HEADER_BYTES;
  for (const record of events) {
    view.setUint32(offset, record.type, true);
    view.setInt32(offset + 4, record.name.start, true);
    view.setInt32(offset + 8, record.name.end, true);
    view.setInt32(offset + 12, record.text.start, true);
    view.setInt32(offset + 16, record.text.end, true);
    view.setUint32(offset + 20, record.attrStart, true);
    view.setUint32(offset + 24, record.attrCount, true);
    offset += EVENT_BYTES;
  }

  for (const record of attrs) {
    view.setInt32(offset, record.name.start, true);
    view.setInt32(offset + 4, record.name.end, true);
    view.setInt32(offset + 8, record.value.start, true);
    view.setInt32(offset + 12, record.value.end, true);
    offset += ATTR_BYTES;
  }

  for (const nameId of eventNameIds) {
    view.setUint32(offset, nameId, true);
    offset += 4;
  }
  for (const nameId of attrNameIds) {
    view.setUint32(offset, nameId, true);
    offset += 4;
  }
  if (options.includeValueIds) {
    for (const valueId of eventValueIds) {
      view.setUint32(offset, valueId, true);
      offset += 4;
    }
    for (const valueId of attrValueIds) {
      view.setUint32(offset, valueId, true);
      offset += 4;
    }
  }

  return new Uint8Array(buffer);
}

function internNameIds<T extends Span>(
  input: Uint8Array,
  spans: T[],
  readBytes: (span: T) => Uint8Array,
): number[] {
  const ids = new Map<string, number>();
  let nextId = 1;
  return spans.map((span) => {
    if (span.start < 0 || span.end < 0) {
      return 0;
    }
    const key = Buffer.from(readBytes(span)).toString('latin1');
    const cached = ids.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const id = nextId++;
    ids.set(key, id);
    return id;
  });
}

function internValueIds<T extends Span>(
  input: Uint8Array,
  spans: T[],
  readBytes: (span: T) => Uint8Array,
): number[] {
  const ids = new Map<string, number>();
  let nextId = 1;
  return spans.map((span) => {
    const length = span.end - span.start;
    if (span.start < 0 || span.end < 0 || length <= 0 || length > 32) {
      return 0;
    }
    const key = Buffer.from(readBytes(span)).toString('latin1');
    const cached = ids.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const id = nextId++;
    ids.set(key, id);
    return id;
  });
}

function spanBytes(input: Uint8Array, start: number, end: number): Uint8Array {
  return input.subarray(start, end);
}
