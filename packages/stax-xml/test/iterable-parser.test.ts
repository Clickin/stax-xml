import { describe, expect, it } from 'vitest';
import {
  IterableEventType,
  StaxXmlIterableParser,
  toAsyncByteBatches,
  toByteBatches,
} from '../src/index';
import { StaxXmlIterableParser as SubpathIterableParser } from '../src/iterable/index';

function byteChunks(xml: string, chunkSize: number): Uint8Array[] {
  const bytes = new TextEncoder().encode(xml);
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(bytes.slice(offset, offset + chunkSize));
  }
  return chunks;
}

function byteBatches(xml: string, chunkSize: number, batchSize: number): readonly Uint8Array[][] {
  return Array.from(toByteBatches(byteChunks(xml, chunkSize), { batchSize }));
}

function rawByteBatches(bytes: Uint8Array, chunkSize: number, batchSize: number): readonly Uint8Array[][] {
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(bytes.slice(offset, offset + chunkSize));
  }
  return Array.from(toByteBatches(chunks, { batchSize }));
}

function rawInvalidAttributeXml(valueLength: number): Uint8Array {
  const prefix = new TextEncoder().encode('<root a="');
  const suffix = new TextEncoder().encode('"/>');
  const value = new Uint8Array(valueLength);
  value.fill(65);
  value[0] = 0xff;

  const bytes = new Uint8Array(prefix.byteLength + value.byteLength + suffix.byteLength);
  bytes.set(prefix, 0);
  bytes.set(value, prefix.byteLength);
  bytes.set(suffix, prefix.byteLength + value.byteLength);
  return bytes;
}

function collect(parser: StaxXmlIterableParser): Array<{
  type: number;
  name?: string;
  text?: string;
  attrs?: Record<string, string>;
}> {
  const events: Array<{ type: number; name?: string; text?: string; attrs?: Record<string, string> }> = [];
  while (parser.nextBatch()) {
    for (let i = 0; i < parser.eventCount(); i++) {
      const event = { type: parser.eventType(i) } as {
        type: number;
        name?: string;
        text?: string;
        attrs?: Record<string, string>;
      };
      const name = parser.copyName(i);
      if (name !== undefined) event.name = name;
      const text = parser.copyText(i);
      if (text !== undefined) event.text = text;

      const attrs: Record<string, string> = {};
      for (let attr = 0; attr < parser.attrCount(i); attr++) {
        attrs[parser.copyAttrName(i, attr)!] = parser.copyAttrValue(i, attr)!;
      }
      if (Object.keys(attrs).length > 0) event.attrs = attrs;
      events.push(event);
    }
  }
  return events;
}

describe('StaxXmlIterableParser raw batch cursor', () => {
  it('exposes raw event frames without AnyXmlEvent objects', () => {
    const parser = new StaxXmlIterableParser(byteBatches('<root><item id="1">text</item><empty/></root>', 64, 1));

    expect(collect(parser)).toEqual([
      { type: IterableEventType.START_DOCUMENT },
      { type: IterableEventType.START_ELEMENT, name: 'root' },
      { type: IterableEventType.START_ELEMENT, name: 'item', attrs: { id: '1' } },
      { type: IterableEventType.CHARACTERS, text: 'text' },
      { type: IterableEventType.END_ELEMENT, name: 'item' },
      { type: IterableEventType.START_ELEMENT, name: 'empty' },
      { type: IterableEventType.END_ELEMENT, name: 'empty' },
      { type: IterableEventType.END_ELEMENT, name: 'root' },
      { type: IterableEventType.END_DOCUMENT },
    ]);
  });

  it('keeps spans relative to one batch buffer and exposes offset accessors', () => {
    const parser = new StaxXmlIterableParser(byteBatches('<root attr="value">body</root>', 8, 2));

    expect(parser.nextBatch()).toBe(true);
    const buffer = parser.buffer();
    const decoder = new TextDecoder();
    const rootIndex = Array.from({ length: parser.eventCount() })
      .findIndex((_, index) => parser.eventType(index) === IterableEventType.START_ELEMENT);

    expect(rootIndex).toBeGreaterThanOrEqual(0);
    expect(decoder.decode(buffer.subarray(parser.nameStart(rootIndex), parser.nameEnd(rootIndex)))).toBe('root');
    expect(decoder.decode(buffer.subarray(
      parser.attrNameStart(rootIndex, 0),
      parser.attrNameEnd(rootIndex, 0),
    ))).toBe('attr');
    expect(decoder.decode(buffer.subarray(
      parser.attrValueStart(rootIndex, 0),
      parser.attrValueEnd(rootIndex, 0),
    ))).toBe('value');
  });

  it('exposes a reusable direct batch frame with typed-array fields', () => {
    const parser = new StaxXmlIterableParser(byteBatches('<root attr="value">body</root>', 64, 1));

    const frame = parser.nextBatchFrame();

    expect(frame).toBeDefined();
    expect(frame).toBe(parser.batchFrame());
    expect(frame!.eventCount).toBe(parser.eventCount());
    expect(frame!.eventTypes).toBeInstanceOf(Uint8Array);
    expect(frame!.nameStarts).toBeInstanceOf(Int32Array);
    expect(frame!.attrValueEnds).toBeInstanceOf(Int32Array);

    const decoder = new TextDecoder();
    const rootIndex = Array.from({ length: frame!.eventCount })
      .findIndex((_, index) => frame!.eventTypes[index] === IterableEventType.START_ELEMENT);
    const attrStart = frame!.attrStarts[rootIndex]!;

    expect(decoder.decode(frame!.buffer.subarray(
      frame!.nameStarts[rootIndex]!,
      frame!.nameEnds[rootIndex]!,
    ))).toBe('root');
    expect(frame!.attrCounts[rootIndex]).toBe(1);
    expect(decoder.decode(frame!.buffer.subarray(
      frame!.attrNameStarts[attrStart]!,
      frame!.attrNameEnds[attrStart]!,
    ))).toBe('attr');
    expect(decoder.decode(frame!.buffer.subarray(
      frame!.attrValueStarts[attrStart]!,
      frame!.attrValueEnds[attrStart]!,
    ))).toBe('value');
  });

  it('reuses the batch frame object and refreshes it after each nextBatch call', () => {
    const parser = new StaxXmlIterableParser(byteBatches('<root><a>one</a><b>two</b></root>', 8, 1));

    const firstFrame = parser.nextBatchFrame();
    const firstBuffer = firstFrame?.buffer;
    const secondFrame = parser.nextBatchFrame();

    expect(firstFrame).toBeDefined();
    expect(secondFrame).toBe(firstFrame);
    expect(secondFrame!.buffer).not.toBe(firstBuffer);
    expect(secondFrame!.eventCount).toBe(parser.eventCount());

    while (parser.nextBatchFrame()) {
      // drain
    }
    expect(parser.nextBatchFrame()).toBeUndefined();
  });

  it('materializes all attributes for an event in one object', () => {
    const parser = new StaxXmlIterableParser(byteBatches('<root a="1" b="two" c="한글"/>', 64, 1));

    expect(parser.nextBatch()).toBe(true);
    const rootIndex = Array.from({ length: parser.eventCount() })
      .findIndex((_, index) => parser.eventType(index) === IterableEventType.START_ELEMENT);

    expect(parser.copyAttributesObject(rootIndex)).toEqual({
      a: '1',
      b: 'two',
      c: '한글',
    });
    expect(parser.copyAttrName(rootIndex, -1)).toBeUndefined();
    expect(parser.copyAttrName(rootIndex, 3)).toBeUndefined();
    expect(parser.copyAttrValue(rootIndex, -1)).toBeUndefined();
    expect(parser.copyAttrValue(rootIndex, 3)).toBeUndefined();
    expect(parser.copyAttributesObject(rootIndex + 1)).toEqual({});
  });

  it('covers permissive attribute edge cases and skipped unknown markup', () => {
    const xml = '<root    ><item trailing bare other spaced = "ok" numeric=1 /><solo bare></solo><!SKIP><empty a= /></root>';
    const events = collect(new StaxXmlIterableParser(byteBatches(xml, 128, 1)));

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

  it('grows event, attribute, and element buffers under large batches', () => {
    const manyElements = `<root>${'<item/>'.repeat(1100)}</root>`;
    const elementEvents = collect(new StaxXmlIterableParser(byteBatches(manyElements, manyElements.length, 1)));
    expect(elementEvents.filter(event => event.name === 'item')).toHaveLength(2200);

    const attrs = Array.from({ length: 1100 }, (_, index) => `a${index}="${index}"`).join(' ');
    const attrParser = new StaxXmlIterableParser(byteBatches(`<root ${attrs}/>`, attrs.length + 16, 1));
    expect(attrParser.nextBatch()).toBe(true);
    const rootIndex = Array.from({ length: attrParser.eventCount() })
      .findIndex((_, index) => attrParser.copyName(index) === 'root');
    expect(attrParser.attrCount(rootIndex)).toBe(1100);

    const deepOpen = Array.from({ length: 1030 }, (_, index) => `<n${index}>`).join('');
    const deepClose = Array.from({ length: 1030 }, (_, index) => `</n${1029 - index}>`).join('');
    expect(collect(new StaxXmlIterableParser(byteBatches(`${deepOpen}${deepClose}`, 64 * 1024, 1))))
      .toHaveLength(2062);
  });

  it('covers final text, whitespace-only text, unicode names, and invalid single-byte decode fallback', () => {
    expect(collect(new StaxXmlIterableParser(byteBatches('text', 64, 1))))
      .toEqual([
        { type: IterableEventType.START_DOCUMENT },
        { type: IterableEventType.CHARACTERS, text: 'text' },
        { type: IterableEventType.END_DOCUMENT },
      ]);

    expect(collect(new StaxXmlIterableParser(byteBatches('<root>   </root>', 64, 1))).map(event => event.name ?? event.text ?? event.type))
      .toEqual([
        IterableEventType.START_DOCUMENT,
        'root',
        'root',
        IterableEventType.END_DOCUMENT,
      ]);

    expect(collect(new StaxXmlIterableParser(byteBatches('<루트 속성="값">본문</루트>', 128, 1))))
      .toContainEqual({
        type: IterableEventType.START_ELEMENT,
        name: '루트',
        attrs: { '속성': '값' },
      });

    const invalidBytes = new Uint8Array([60, 114, 111, 111, 116, 32, 97, 61, 34, 255, 34, 47, 62]);
    const invalidParser = new StaxXmlIterableParser(rawByteBatches(invalidBytes, 64, 1));
    expect(collect(invalidParser)).toContainEqual({
      type: IterableEventType.START_ELEMENT,
      name: 'root',
      attrs: { a: '\uFFFD' },
    });

    for (const valueLength of [2, 7, 8, 9, 10, 11, 12]) {
      const parser = new StaxXmlIterableParser(rawByteBatches(rawInvalidAttributeXml(valueLength), 64, 1));
      expect(collect(parser)).toContainEqual({
        type: IterableEventType.START_ELEMENT,
        name: 'root',
        attrs: { a: `${'\uFFFD'}${'A'.repeat(valueLength - 1)}` },
      });
    }
  });

  it('defers interned name string materialization until string helpers are called', () => {
    const parser = new StaxXmlIterableParser(byteBatches('<root alpha="1"><child beta="2"/></root>', 128, 1));
    const internals = parser as unknown as { nameStrings: Array<string | undefined> };

    expect(parser.nextBatch()).toBe(true);
    expect(internals.nameStrings.length).toBeGreaterThanOrEqual(4);
    expect(internals.nameStrings.every(name => name === undefined)).toBe(true);

    const rootIndex = Array.from({ length: parser.eventCount() })
      .findIndex((_, index) => parser.eventType(index) === IterableEventType.START_ELEMENT);
    expect(parser.copyName(rootIndex)).toBe('root');
    expect(internals.nameStrings).toContain('root');
    expect(internals.nameStrings).not.toContain('alpha');

    expect(parser.copyAttrName(rootIndex, 0)).toBe('alpha');
    expect(internals.nameStrings).toContain('alpha');
  });

  it('normalizes Uint8Array subclasses to plain Uint8Array buffers', () => {
    class SubclassedBytes extends Uint8Array {}

    const xml = '<root><item id="1">text</item></root>';
    const bytes = new TextEncoder().encode(`!${xml}?`);
    const chunk = new SubclassedBytes(bytes.buffer, 1, xml.length);
    const parser = new StaxXmlIterableParser([[chunk]]);

    expect(parser.nextBatch()).toBe(true);
    expect(Object.getPrototypeOf(parser.buffer())).toBe(Uint8Array.prototype);
    expect(parser.buffer()[0]).toBe(60);
    expect(Array.from({ length: parser.eventCount() }, (_, index) => parser.copyName(index) ?? parser.copyText(index) ?? parser.eventType(index)))
      .toEqual([IterableEventType.START_DOCUMENT, 'root', 'item', 'text', 'item', 'root']);
  });

  it('handles split tags, split attributes, split UTF-8, and CDATA', () => {
    const xml = '<root><item title="안녕">🌊</item><![CDATA[<raw>]]x value</raw>]]></root>';
    const parser = new StaxXmlIterableParser(byteBatches(xml, 3, 2));

    const events = collect(parser);

    expect(events).toContainEqual({
      type: IterableEventType.START_ELEMENT,
      name: 'item',
      attrs: { title: '안녕' },
    });
    expect(events).toContainEqual({ type: IterableEventType.CHARACTERS, text: '🌊' });
    expect(events).toContainEqual({ type: IterableEventType.CDATA, text: '<raw>]]x value</raw>' });
  });

  it('skips XML declaration, comments, processing instructions, and doctype', () => {
    const xml = '<?xml version="1.0"?><!DOCTYPE root><root><!-- hidden --><?pi hidden?><item/></root>';

    expect(collect(new StaxXmlIterableParser(byteBatches(xml, 7, 1))).map(event => event.name ?? event.text ?? event.type))
      .toEqual([
        IterableEventType.START_DOCUMENT,
        'root',
        'item',
        'item',
        'root',
        IterableEventType.END_DOCUMENT,
      ]);
  });

  it('reports malformed XML errors', () => {
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
      expect(() => collect(new StaxXmlIterableParser(byteBatches(xml, 4, 1)))).toThrow(message);
    }
  });

  it('supports explicit decode helpers without automatic entity decoding', () => {
    const parser = new StaxXmlIterableParser(byteBatches('<root attr="a&amp;b">&lt;text&gt;</root>', 64, 1));

    const events = collect(parser);

    expect(events).toContainEqual({
      type: IterableEventType.START_ELEMENT,
      name: 'root',
      attrs: { attr: 'a&amp;b' },
    });
    expect(events).toContainEqual({ type: IterableEventType.CHARACTERS, text: '&lt;text&gt;' });
  });

  it('decodes empty, short ASCII, longer ASCII, and UTF-8 spans correctly', () => {
    const parser = new StaxXmlIterableParser(byteBatches('<root a="" b="ascii8!!" c="ascii-nine" d="ascii-twelve" e="café" f="ascii-11!!!" g="123456789" h="double\'quote" i=\'single"quote\'>한글</root>', 192, 1));

    expect(parser.nextBatch()).toBe(true);
    const rootIndex = Array.from({ length: parser.eventCount() })
      .findIndex((_, index) => parser.eventType(index) === IterableEventType.START_ELEMENT);

    expect(parser.decodeSpan(0, 0)).toBe('');
    expect(parser.copyAttrValue(rootIndex, 0)).toBe('');
    expect(parser.copyAttrValue(rootIndex, 1)).toBe('ascii8!!');
    expect(parser.copyAttrValue(rootIndex, 2)).toBe('ascii-nine');
    expect(parser.copyAttrValue(rootIndex, 3)).toBe('ascii-twelve');
    expect(parser.copyAttrValue(rootIndex, 4)).toBe('café');
    expect(parser.copyAttrValue(rootIndex, 5)).toBe('ascii-11!!!');
    expect(parser.copyAttrValue(rootIndex, 6)).toBe('123456789');
    expect(parser.copyAttrValue(rootIndex, 7)).toBe('double\'quote');
    expect(parser.copyAttrValue(rootIndex, 8)).toBe('single"quote');

    const textIndex = Array.from({ length: parser.eventCount() })
      .findIndex((_, index) => parser.eventType(index) === IterableEventType.CHARACTERS);
    expect(parser.copyText(textIndex)).toBe('한글');
  });

  it('is exported from the iterable subpath source entry', () => {
    const parser = new SubpathIterableParser(byteBatches('<root/>', 64, 1));

    expect(collect(parser).map(event => event.type)).toEqual([
      IterableEventType.START_DOCUMENT,
      IterableEventType.START_ELEMENT,
      IterableEventType.END_ELEMENT,
      IterableEventType.END_DOCUMENT,
    ]);
  });
});

describe('byte batch helpers', () => {
  it('groups sync chunks into monomorphic byte batches', () => {
    const batches = Array.from(toByteBatches(byteChunks('<root>abc</root>', 2), { batchSize: 3 }));

    expect(batches.map(batch => batch.length)).toEqual([3, 3, 2]);
    expect(Array.from(toByteBatches(byteChunks('<root/>', 4))).map(batch => batch.length)).toEqual([2]);
  });

  it('groups async chunks into monomorphic byte batches', async () => {
    async function* chunks(): AsyncIterable<Uint8Array> {
      yield* byteChunks('<root>abc</root>', 2);
    }

    const batches: readonly Uint8Array[][] = [];
    for await (const batch of toAsyncByteBatches(chunks(), { batchSize: 4 })) {
      batches.push(batch);
    }

    expect(batches.map(batch => batch.length)).toEqual([4, 4]);
  });

  it('emits the final partial async byte batch', async () => {
    async function* chunks(): AsyncIterable<Uint8Array> {
      yield* byteChunks('<root/>', 4);
    }

    const batches: readonly Uint8Array[][] = [];
    for await (const batch of toAsyncByteBatches(chunks(), { batchSize: 16 })) {
      batches.push(batch);
    }

    expect(batches.map(batch => batch.length)).toEqual([2]);
  });

  it('rejects invalid batch sizes', async () => {
    expect(() => Array.from(toByteBatches(byteChunks('<root/>', 1), { batchSize: 0 })))
      .toThrow('batchSize must be a positive integer.');

    async function* chunks(): AsyncIterable<Uint8Array> {
      yield* byteChunks('<root/>', 1);
    }

    const invalidAsync = async () => {
      for await (const _batch of toAsyncByteBatches(chunks(), { batchSize: 1.5 })) {
        // drain
      }
    };

    await expect(invalidAsync()).rejects.toThrow('batchSize must be a positive integer.');
  });
});
