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

  it('handles split tags, split attributes, split UTF-8, and CDATA', () => {
    const xml = '<root><item title="안녕">🌊</item><![CDATA[<raw>value</raw>]]></root>';
    const parser = new StaxXmlIterableParser(byteBatches(xml, 3, 2));

    const events = collect(parser);

    expect(events).toContainEqual({
      type: IterableEventType.START_ELEMENT,
      name: 'item',
      attrs: { title: '안녕' },
    });
    expect(events).toContainEqual({ type: IterableEventType.CHARACTERS, text: '🌊' });
    expect(events).toContainEqual({ type: IterableEventType.CDATA, text: '<raw>value</raw>' });
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
      ['<root><item>', 'Unexpected end of document. Not all elements were closed.'],
      ['<root attr="value>', 'Unclosed start tag'],
      ['<root><![CDATA[text', 'Unclosed CDATA section'],
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
