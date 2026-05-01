import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initStaxXml } from '../src/index';
import { IterableEventType, IterableReader, toByteBatches } from '../src/IterableReader';
import {
  nodeFileByteBatchesSync,
  NodeIterableReader,
} from '../src/iterable/node';
import { resetStaxXmlRuntimeForTests } from '../src/runtime';

interface RawIterableParser {
  nextBatch(): boolean;
  eventCount(): number;
  eventType(index: number): number;
  copyName(index: number): string | undefined;
  copyText(index: number): string | undefined;
  attrCount(index: number): number;
  copyAttrName(eventIndex: number, attrIndex: number): string | undefined;
  copyAttrValue(eventIndex: number, attrIndex: number): string | undefined;
  copyAttributesObject(eventIndex: number): Record<string, string>;
}

function bufferChunks(xml: string, chunkSize: number): Buffer[] {
  const bytes = Buffer.from(xml);
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(bytes.subarray(offset, offset + chunkSize));
  }
  return chunks;
}

function bufferBatches(xml: string, chunkSize: number, batchSize: number): readonly Buffer[][] {
  const chunks = bufferChunks(xml, chunkSize);
  const batches: Buffer[][] = [];
  for (let offset = 0; offset < chunks.length; offset += batchSize) {
    batches.push(chunks.slice(offset, offset + batchSize));
  }
  return batches;
}

function byteBatches(xml: string, chunkSize: number, batchSize: number): readonly Uint8Array[][] {
  return Array.from(toByteBatches(bufferChunks(xml, chunkSize), { batchSize }));
}

class SinglePendingBatchSource implements Iterable<readonly Buffer[]> {
  nextCalls = 0;
  private current: readonly Buffer[] | undefined;
  private closed = false;

  constructor(batch: readonly Buffer[]) {
    this.current = batch;
  }

  [Symbol.iterator](): Iterator<readonly Buffer[]> {
    return this;
  }

  next(): IteratorResult<readonly Buffer[]> {
    this.nextCalls++;
    if (this.current) {
      const value = this.current;
      this.current = undefined;
      return { value, done: false };
    }
    if (this.closed) {
      return { value: undefined, done: true };
    }
    throw new Error('parser requested a second batch before the caller provided one');
  }

  close(): void {
    this.closed = true;
  }
}

function collect(parser: RawIterableParser): Array<{
  type: number;
  name?: string;
  text?: string;
  attrs?: Record<string, string>;
}> {
  const events: Array<{ type: number; name?: string; text?: string; attrs?: Record<string, string> }> = [];
  while (parser.nextBatch()) {
    for (let index = 0; index < parser.eventCount(); index++) {
      const event = { type: parser.eventType(index) } as {
        type: number;
        name?: string;
        text?: string;
        attrs?: Record<string, string>;
      };
      const name = parser.copyName(index);
      if (name !== undefined) event.name = name;
      const text = parser.copyText(index);
      if (text !== undefined) event.text = text;

      const attrs: Record<string, string> = {};
      for (let attr = 0; attr < parser.attrCount(index); attr++) {
        attrs[parser.copyAttrName(index, attr)!] = parser.copyAttrValue(index, attr)!;
      }
      if (Object.keys(attrs).length > 0) event.attrs = attrs;
      events.push(event);
    }
  }
  return events;
}

afterEach(() => {
  vi.restoreAllMocks();
  resetStaxXmlRuntimeForTests();
});

describe('NodeIterableReader raw batch cursor', () => {
  it('matches the neutral iterable parser for basic events, text, and attributes', () => {
    const xml = '<root><item id="1" title="node">text</item><empty/></root>';
    const neutral = collect(new IterableReader(byteBatches(xml, 64, 1)));
    const node = collect(new NodeIterableReader(bufferBatches(xml, 64, 1)));

    expect(node).toEqual(neutral);
    expect(node).toEqual([
      { type: IterableEventType.START_DOCUMENT },
      { type: IterableEventType.START_ELEMENT, name: 'root' },
      { type: IterableEventType.START_ELEMENT, name: 'item', attrs: { id: '1', title: 'node' } },
      { type: IterableEventType.CHARACTERS, text: 'text' },
      { type: IterableEventType.END_ELEMENT, name: 'item' },
      { type: IterableEventType.START_ELEMENT, name: 'empty' },
      { type: IterableEventType.END_ELEMENT, name: 'empty' },
      { type: IterableEventType.END_ELEMENT, name: 'root' },
      { type: IterableEventType.END_DOCUMENT },
    ]);
  });

  it('keeps Buffer spans and returns strings from copy helpers across split buffers', () => {
    const xml = '<root><item title="안녕">🌊</item><![CDATA[<raw>]]x value</raw>]]></root>';
    const parser = new NodeIterableReader(bufferBatches(xml, 3, 2));
    const events = collect(parser);

    expect(events).toContainEqual({
      type: IterableEventType.START_ELEMENT,
      name: 'item',
      attrs: { title: '안녕' },
    });
    expect(events).toContainEqual({ type: IterableEventType.CHARACTERS, text: '🌊' });
    expect(events).toContainEqual({ type: IterableEventType.CDATA, text: '<raw>]]x value</raw>' });
  });

  it('exposes raw offsets against a Buffer batch', () => {
    const parser = new NodeIterableReader(bufferBatches('<root attr="value">body</root>', 64, 1));

    expect(parser.nextBatch()).toBe(true);
    expect(Buffer.isBuffer(parser.buffer())).toBe(true);

    const rootIndex = Array.from({ length: parser.eventCount() })
      .findIndex((_, index) => parser.eventType(index) === IterableEventType.START_ELEMENT);

    expect(parser.buffer().toString('utf8', parser.nameStart(rootIndex), parser.nameEnd(rootIndex))).toBe('root');
    expect(parser.copyAttrName(rootIndex, 0)).toBe('attr');
    expect(parser.copyAttrValue(rootIndex, 0)).toBe('value');
    expect(parser.copyAttrName(rootIndex, -1)).toBeUndefined();
    expect(parser.copyAttrName(rootIndex, 1)).toBeUndefined();
    expect(parser.copyAttrValue(rootIndex, -1)).toBeUndefined();
    expect(parser.copyAttrValue(rootIndex, 1)).toBeUndefined();
    expect(parser.copyText(rootIndex)).toBeUndefined();
  });

  it('materializes all attributes for an event in one object', () => {
    const parser = new NodeIterableReader(bufferBatches('<root a="1" b="two" c="한글"/>', 64, 1));

    expect(parser.nextBatch()).toBe(true);
    const rootIndex = Array.from({ length: parser.eventCount() })
      .findIndex((_, index) => parser.eventType(index) === IterableEventType.START_ELEMENT);

    expect(parser.copyAttributesObject(rootIndex)).toEqual({
      a: '1',
      b: 'two',
      c: '한글',
    });
    expect(parser.copyAttributesObject(rootIndex + 1)).toEqual({});
  });

  it('covers permissive attribute edge cases and skipped unknown markup', () => {
    const xml = '<root    ><item trailing bare other spaced = "ok" numeric=1 /><solo bare></solo><!SKIP><empty a= /></root>';
    const events = collect(new NodeIterableReader(bufferBatches(xml, 128, 1)));

    expect(events).toContainEqual({
      type: IterableEventType.START_ELEMENT,
      name: 'item',
      attrs: {
        trailing: 'trailing',
        bare: 'bare',
        other: 'other',
        spaced: 'ok',
      },
    });
    expect(events).toContainEqual({
      type: IterableEventType.START_ELEMENT,
      name: 'solo',
      attrs: { bare: 'bare' },
    });
    expect(events).toContainEqual({
      type: IterableEventType.START_ELEMENT,
      name: 'empty',
    });
  });

  it('grows event and attribute buffers under large batches', () => {
    const manyElements = `<root>${'<item/>'.repeat(1100)}</root>`;
    const elementEvents = collect(new NodeIterableReader(bufferBatches(manyElements, manyElements.length, 1)));
    expect(elementEvents.filter(event => event.name === 'item')).toHaveLength(2200);

    const attrs = Array.from({ length: 1100 }, (_, index) => `a${index}="${index}"`).join(' ');
    const attrParser = new NodeIterableReader(bufferBatches(`<root ${attrs}/>`, attrs.length + 16, 1));
    expect(attrParser.nextBatch()).toBe(true);
    const rootIndex = Array.from({ length: attrParser.eventCount() })
      .findIndex((_, index) => attrParser.copyName(index) === 'root');
    expect(attrParser.attrCount(rootIndex)).toBe(1100);
  });

  it('covers final text, whitespace-only text, and unicode names', () => {
    expect(collect(new NodeIterableReader(bufferBatches('text', 64, 1))))
      .toEqual([
        { type: IterableEventType.START_DOCUMENT },
        { type: IterableEventType.CHARACTERS, text: 'text' },
        { type: IterableEventType.END_DOCUMENT },
      ]);

    expect(collect(new NodeIterableReader(bufferBatches('<root>   </root>', 64, 1))).map(event => event.name ?? event.text ?? event.type))
      .toEqual([
        IterableEventType.START_DOCUMENT,
        'root',
        'root',
        IterableEventType.END_DOCUMENT,
      ]);

    expect(collect(new NodeIterableReader(bufferBatches('<루트 속성="값">본문</루트>', 128, 1))))
      .toContainEqual({
        type: IterableEventType.START_ELEMENT,
        name: '루트',
        attrs: { '속성': '값' },
      });
  });

  it('can parse simple quoted attributes through the experimental fast scanner', () => {
    const xml = '<root><item a="1" b=\'two\' c="한글" h="double\'quote" i=\'single"quote\'/><fallback spaced = "ok" bare /><empty    /></root>';

    expect(collect(new NodeIterableReader(bufferBatches(xml, 64, 1), { attributeScanner: 'simple' })))
      .toEqual(collect(new IterableReader(byteBatches(xml, 64, 1))));
  });

  it('falls back from the simple scanner for malformed attribute shapes', () => {
    const cases = [
      '<root><item bare/></root>',
      '<root><item = "value"/></root>',
      '<root><item value=1/></root>',
      '<root><item value= /></root>',
    ];

    for (const xml of cases) {
      expect(collect(new NodeIterableReader(bufferBatches(xml, 64, 1), { attributeScanner: 'simple' })))
        .toEqual(collect(new IterableReader(byteBatches(xml, 64, 1))));
    }
  });

  it('rejects unknown experimental attribute scanners', () => {
    expect(() => new NodeIterableReader(bufferBatches('<root/>', 64, 1), {
      attributeScanner: 'unknown',
    } as never)).toThrow('attributeScanner');
  });

  it('uses the automatic backend by default and keeps the simple scanner on JavaScript', () => {
    const auto = new NodeIterableReader(bufferBatches('<root><item/></root>', 64, 1));
    expect(auto.backendKind()).toBe('pending');
    expect(collect(auto).map(event => event.name ?? event.type)).toEqual([
      IterableEventType.START_DOCUMENT,
      'root',
      'item',
      'item',
      'root',
      IterableEventType.END_DOCUMENT,
    ]);
    expect(['native', 'js']).toContain(auto.backendKind());

    const js = new NodeIterableReader(bufferBatches('<root/>', 64, 1), { attributeScanner: 'simple' });
    expect(js.backendKind()).toBe('pending');
    expect(collect(js).map(event => event.name ?? event.type)).toEqual([
      IterableEventType.START_DOCUMENT,
      'root',
      'root',
      IterableEventType.END_DOCUMENT,
    ]);
    expect(js.backendKind()).toBe('js');
  });

  it('prefers the zero-copy structural table for a single complete native Buffer', async () => {
    const xml = '<root><item id="1">text</item></root>';
    const input = Buffer.from(xml);
    const parseStructuralIndexUint8Array = vi.fn((actual: Uint8Array) => {
      expect(actual).toBe(input);
      return encodeNativeStructuralIndex(actual, [
        nativeEvent(IterableEventType.START_DOCUMENT),
        nativeEvent(IterableEventType.START_ELEMENT, nativeSpan(actual, 'root')),
        nativeEvent(IterableEventType.START_ELEMENT, nativeSpan(actual, 'item'), nativeNone(), 0, 1),
        nativeEvent(IterableEventType.CHARACTERS, nativeNone(), nativeSpan(actual, 'text')),
        nativeEvent(IterableEventType.END_ELEMENT, nativeSpan(actual, 'item')),
        nativeEvent(IterableEventType.END_ELEMENT, nativeSpan(actual, 'root')),
        nativeEvent(IterableEventType.END_DOCUMENT),
      ], [
        nativeAttr(nativeSpan(actual, 'id'), nativeSpan(actual, '1')),
      ]);
    });
    const createStreamingEventBatchParser = vi.fn(() => ({
      pushChunk() {
        throw new Error('single complete Buffer should not use the streaming parser');
      },
    }));
    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        parseStructuralIndexUint8Array,
        createStreamingEventBatchParser,
      }),
    });

    const parser = new NodeIterableReader([[input]]);

    expect(collect(parser)).toEqual([
      { type: IterableEventType.START_DOCUMENT },
      { type: IterableEventType.START_ELEMENT, name: 'root' },
      { type: IterableEventType.START_ELEMENT, name: 'item', attrs: { id: '1' } },
      { type: IterableEventType.CHARACTERS, text: 'text' },
      { type: IterableEventType.END_ELEMENT, name: 'item' },
      { type: IterableEventType.END_ELEMENT, name: 'root' },
      { type: IterableEventType.END_DOCUMENT },
    ]);
    expect(parser.backendKind()).toBe('native');
    expect(parseStructuralIndexUint8Array).toHaveBeenCalledOnce();
    expect(createStreamingEventBatchParser).not.toHaveBeenCalled();
  });

  it('does not prefetch another source batch before native streaming consumes the current one', async () => {
    const input = Buffer.from('<root/>');
    const source = new SinglePendingBatchSource([input]);
    const parseStructuralIndexUint8Array = vi.fn(() => {
      throw new Error('non-array streaming sources should not use the complete-buffer structural path');
    });
    const pushChunk = vi.fn((actual: Uint8Array, isFinal: boolean) => {
      expect(actual).toBe(input);
      expect(isFinal).toBe(false);
      return {
        buffer: actual,
        table: encodeNativeStructuralIndex(actual, [
          nativeEvent(IterableEventType.START_DOCUMENT),
        ], []),
      };
    });
    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        parseStructuralIndexUint8Array,
        createStreamingEventBatchParser: () => ({ pushChunk }),
      }),
    });

    const parser = new NodeIterableReader(source);

    expect(parser.nextBatch()).toBe(true);
    expect(parser.eventCount()).toBe(1);
    expect(parser.backendKind()).toBe('native');
    expect(source.nextCalls).toBe(1);
    expect(parseStructuralIndexUint8Array).not.toHaveBeenCalled();
    expect(pushChunk).toHaveBeenCalledOnce();
  });

  it('interns native structural names across repeated Buffer spans', async () => {
    const input = Buffer.from('<root><item/><item/></root>');
    const firstItem = nativeNthSpan(input, 'item', 0);
    const secondItem = nativeNthSpan(input, 'item', 1);
    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        parseStructuralIndexUint8Array: (actual: Uint8Array) => encodeNativeStructuralIndex(actual, [
          nativeEvent(IterableEventType.START_DOCUMENT),
          nativeEvent(IterableEventType.START_ELEMENT, nativeSpan(actual, 'root')),
          nativeEvent(IterableEventType.START_ELEMENT, firstItem),
          nativeEvent(IterableEventType.END_ELEMENT, firstItem),
          nativeEvent(IterableEventType.START_ELEMENT, secondItem),
          nativeEvent(IterableEventType.END_ELEMENT, secondItem),
          nativeEvent(IterableEventType.END_ELEMENT, nativeSpan(actual, 'root')),
          nativeEvent(IterableEventType.END_DOCUMENT),
        ], []),
        createStreamingEventBatchParser: () => ({
          pushChunk() {
            throw new Error('single complete Buffer should not use the streaming parser');
          },
        }),
      }),
    });
    const parser = new NodeIterableReader([[input]]);
    const toStringSpy = vi.spyOn(input, 'toString');
    expect(parser.nextBatch()).toBe(true);

    expect(parser.copyName(2)).toBe('item');
    expect(parser.copyName(3)).toBe('item');
    expect(parser.copyName(4)).toBe('item');
    expect(parser.copyName(5)).toBe('item');

    const itemDecodeCalls = toStringSpy.mock.calls.filter(call =>
      call[0] === 'utf8'
      && (call[1] === firstItem.start || call[1] === secondItem.start)
    );
    expect(itemDecodeCalls.length).toBeLessThanOrEqual(1);
  });

  it('skips XML declaration, comments, processing instructions, and doctype', () => {
    const xml = '<?xml version="1.0"?><!DOCTYPE root><root><!-- hidden --><?pi hidden?><item/></root>';

    expect(collect(new NodeIterableReader(bufferBatches(xml, 7, 1))).map(event => event.name ?? event.text ?? event.type))
      .toEqual([
        IterableEventType.START_DOCUMENT,
        'root',
        'item',
        'item',
        'root',
        IterableEventType.END_DOCUMENT,
      ]);
  });

  it('skips quoted greater-than signs inside DOCTYPE entity declarations', () => {
    const xml = '<!DOCTYPE root [<!ENTITY foo "bar>baz"><!ENTITY single \'x>y\'>]><root><item/></root>';

    expect(collect(new NodeIterableReader(bufferBatches(xml, 5, 1))).map(event => event.name ?? event.text ?? event.type))
      .toEqual([
        IterableEventType.START_DOCUMENT,
        'root',
        'item',
        'item',
        'root',
        IterableEventType.END_DOCUMENT,
      ]);
  });

  it('reports the same malformed XML errors as the neutral parser', () => {
    const cases = [
      ['<root><item></root>', 'Mismatched closing tag: </root>. Expected </item>.'],
      ['<root><item></unknown></root>', 'Mismatched closing tag: </unknown>. Expected </item>.'],
      ['<root><item>', 'Unexpected end of document. Not all elements were closed.'],
      ['<root attr="value>', 'Unclosed start tag'],
      ['<root><![CDATA[text', 'Unclosed CDATA section'],
      ['<root><!-- comment', 'Unclosed comment'],
      ['<!DOCTYPE root', 'Unclosed DOCTYPE declaration'],
      ['<!BROKEN', 'Unclosed markup'],
      ['<?xml version="1.0"', 'Unclosed XML declaration'],
      ['<?pi data', 'Unclosed processing instruction'],
      ['</root', 'Unclosed end tag'],
      ['<', 'Unclosed start tag'],
      ['</root>', 'Mismatched closing tag: </root>. No open elements.'],
    ] as const;

    for (const [xml, message] of cases) {
      expect(() => collect(new NodeIterableReader(bufferBatches(xml, 4, 1)))).toThrow(message);
    }
  });

  it('groups sync file reads into Buffer batches', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stax-node-iterable-'));
    const filePath = join(dir, 'fixture.xml');
    const tinyFilePath = join(dir, 'tiny.xml');
    try {
      writeFileSync(filePath, '<root><item id="1">text</item></root>');
      const batches = Array.from(nodeFileByteBatchesSync(filePath, { chunkSize: 5, batchSize: 2 }));

      expect(batches.length).toBeGreaterThan(1);
      expect(batches.every(batch => batch.every(Buffer.isBuffer))).toBe(true);
      expect(collect(new NodeIterableReader(batches))).toEqual(
        collect(new IterableReader(byteBatches('<root><item id="1">text</item></root>', 5, 2))),
      );

      writeFileSync(tinyFilePath, '<root/>');
      expect(Array.from(nodeFileByteBatchesSync(tinyFilePath)).map(batch => batch.length)).toEqual([1]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects invalid file batch options', () => {
    expect(() => Array.from(nodeFileByteBatchesSync('missing.xml', { chunkSize: 0 })))
      .toThrow('chunkSize must be a positive integer.');
    expect(() => Array.from(nodeFileByteBatchesSync('missing.xml', { batchSize: 0 })))
      .toThrow('batchSize must be a positive integer.');
  });
});

type NativeSpan = { start: number; end: number };
type NativeEventRecord = {
  type: number;
  name: NativeSpan;
  text: NativeSpan;
  attrStart: number;
  attrCount: number;
};
type NativeAttrRecord = { name: NativeSpan; value: NativeSpan };

function nativeNone(): NativeSpan {
  return { start: -1, end: -1 };
}

function nativeSpan(input: Uint8Array, value: string): NativeSpan {
  return nativeNthSpan(input, value, 0);
}

function nativeNthSpan(input: Uint8Array, value: string, occurrence: number): NativeSpan {
  const needle = Buffer.from(value);
  let matchedCount = 0;
  for (let start = 0; start <= input.byteLength - needle.byteLength; start++) {
    let matched = true;
    for (let index = 0; index < needle.byteLength; index++) {
      if (input[start + index] !== needle[index]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      if (matchedCount === occurrence) {
        return { start, end: start + needle.byteLength };
      }
      matchedCount++;
    }
  }
  throw new Error(`Missing native span value: ${value}#${occurrence}`);
}

function nativeEvent(
  type: number,
  name: NativeSpan = nativeNone(),
  text: NativeSpan = nativeNone(),
  attrStart = 0,
  attrCount = 0,
): NativeEventRecord {
  return { type, name, text, attrStart, attrCount };
}

function nativeAttr(name: NativeSpan, value: NativeSpan): NativeAttrRecord {
  return { name, value };
}

function encodeNativeStructuralIndex(
  input: Uint8Array,
  events: NativeEventRecord[],
  attrs: NativeAttrRecord[],
): Uint8Array {
  const eventBytes = 28;
  const attrBytes = 16;
  const headerBytes = 28;
  const buffer = new ArrayBuffer(headerBytes + events.length * eventBytes + attrs.length * attrBytes);
  const view = new DataView(buffer);
  view.setUint32(0, 0x31545053, true);
  view.setUint32(4, events.length, true);
  view.setUint32(8, attrs.length, true);
  view.setUint32(12, input.byteLength, true);
  view.setUint32(16, eventBytes, true);
  view.setUint32(20, attrBytes, true);
  view.setUint32(24, 1, true);

  let offset = headerBytes;
  for (const record of events) {
    view.setUint32(offset, record.type, true);
    view.setInt32(offset + 4, record.name.start, true);
    view.setInt32(offset + 8, record.name.end, true);
    view.setInt32(offset + 12, record.text.start, true);
    view.setInt32(offset + 16, record.text.end, true);
    view.setUint32(offset + 20, record.attrStart, true);
    view.setUint32(offset + 24, record.attrCount, true);
    offset += eventBytes;
  }

  for (const record of attrs) {
    view.setInt32(offset, record.name.start, true);
    view.setInt32(offset + 4, record.name.end, true);
    view.setInt32(offset + 8, record.value.start, true);
    view.setInt32(offset + 12, record.value.end, true);
    offset += attrBytes;
  }

  return new Uint8Array(buffer);
}
