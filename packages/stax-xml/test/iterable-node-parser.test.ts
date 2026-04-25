import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IterableEventType, StaxXmlIterableParser, toByteBatches } from '../src/index';
import {
  nodeFileByteBatchesSync,
  StaxXmlNodeIterableParser,
} from '../src/iterable/node';

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

describe('StaxXmlNodeIterableParser raw batch cursor', () => {
  it('matches the neutral iterable parser for basic events, text, and attributes', () => {
    const xml = '<root><item id="1" title="node">text</item><empty/></root>';
    const neutral = collect(new StaxXmlIterableParser(byteBatches(xml, 64, 1)));
    const node = collect(new StaxXmlNodeIterableParser(bufferBatches(xml, 64, 1)));

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
    const parser = new StaxXmlNodeIterableParser(bufferBatches(xml, 3, 2));
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
    const parser = new StaxXmlNodeIterableParser(bufferBatches('<root attr="value">body</root>', 64, 1));

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
    const parser = new StaxXmlNodeIterableParser(bufferBatches('<root a="1" b="two" c="한글"/>', 64, 1));

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
    const events = collect(new StaxXmlNodeIterableParser(bufferBatches(xml, 128, 1)));

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
    const elementEvents = collect(new StaxXmlNodeIterableParser(bufferBatches(manyElements, manyElements.length, 1)));
    expect(elementEvents.filter(event => event.name === 'item')).toHaveLength(2200);

    const attrs = Array.from({ length: 1100 }, (_, index) => `a${index}="${index}"`).join(' ');
    const attrParser = new StaxXmlNodeIterableParser(bufferBatches(`<root ${attrs}/>`, attrs.length + 16, 1));
    expect(attrParser.nextBatch()).toBe(true);
    const rootIndex = Array.from({ length: attrParser.eventCount() })
      .findIndex((_, index) => attrParser.copyName(index) === 'root');
    expect(attrParser.attrCount(rootIndex)).toBe(1100);
  });

  it('covers final text, whitespace-only text, and unicode names', () => {
    expect(collect(new StaxXmlNodeIterableParser(bufferBatches('text', 64, 1))))
      .toEqual([
        { type: IterableEventType.START_DOCUMENT },
        { type: IterableEventType.CHARACTERS, text: 'text' },
        { type: IterableEventType.END_DOCUMENT },
      ]);

    expect(collect(new StaxXmlNodeIterableParser(bufferBatches('<root>   </root>', 64, 1))).map(event => event.name ?? event.text ?? event.type))
      .toEqual([
        IterableEventType.START_DOCUMENT,
        'root',
        'root',
        IterableEventType.END_DOCUMENT,
      ]);

    expect(collect(new StaxXmlNodeIterableParser(bufferBatches('<루트 속성="값">본문</루트>', 128, 1))))
      .toContainEqual({
        type: IterableEventType.START_ELEMENT,
        name: '루트',
        attrs: { '속성': '값' },
      });
  });

  it('can parse simple quoted attributes through the experimental fast scanner', () => {
    const xml = '<root><item a="1" b=\'two\' c="한글" h="double\'quote" i=\'single"quote\'/><fallback spaced = "ok" bare /><empty    /></root>';

    expect(collect(new StaxXmlNodeIterableParser(bufferBatches(xml, 64, 1), { attributeScanner: 'simple' })))
      .toEqual(collect(new StaxXmlIterableParser(byteBatches(xml, 64, 1))));
  });

  it('falls back from the simple scanner for malformed attribute shapes', () => {
    const cases = [
      '<root><item bare/></root>',
      '<root><item = "value"/></root>',
      '<root><item value=1/></root>',
      '<root><item value= /></root>',
    ];

    for (const xml of cases) {
      expect(collect(new StaxXmlNodeIterableParser(bufferBatches(xml, 64, 1), { attributeScanner: 'simple' })))
        .toEqual(collect(new StaxXmlIterableParser(byteBatches(xml, 64, 1))));
    }
  });

  it('rejects unknown experimental attribute scanners', () => {
    expect(() => new StaxXmlNodeIterableParser(bufferBatches('<root/>', 64, 1), {
      attributeScanner: 'unknown',
    } as never)).toThrow('attributeScanner');
  });

  it('skips XML declaration, comments, processing instructions, and doctype', () => {
    const xml = '<?xml version="1.0"?><!DOCTYPE root><root><!-- hidden --><?pi hidden?><item/></root>';

    expect(collect(new StaxXmlNodeIterableParser(bufferBatches(xml, 7, 1))).map(event => event.name ?? event.text ?? event.type))
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
      expect(() => collect(new StaxXmlNodeIterableParser(bufferBatches(xml, 4, 1)))).toThrow(message);
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
      expect(collect(new StaxXmlNodeIterableParser(batches))).toEqual(
        collect(new StaxXmlIterableParser(byteBatches('<root><item id="1">text</item></root>', 5, 2))),
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
