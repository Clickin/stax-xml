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
    const xml = '<root><item title="안녕">🌊</item><![CDATA[<raw>value</raw>]]></root>';
    const parser = new StaxXmlNodeIterableParser(bufferBatches(xml, 3, 2));
    const events = collect(parser);

    expect(events).toContainEqual({
      type: IterableEventType.START_ELEMENT,
      name: 'item',
      attrs: { title: '안녕' },
    });
    expect(events).toContainEqual({ type: IterableEventType.CHARACTERS, text: '🌊' });
    expect(events).toContainEqual({ type: IterableEventType.CDATA, text: '<raw>value</raw>' });
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
    expect(parser.copyText(rootIndex)).toBeUndefined();
  });

  it('reports the same malformed XML errors as the neutral parser', () => {
    const cases = [
      ['<root><item></root>', 'Mismatched closing tag: </root>. Expected </item>.'],
      ['<root><item>', 'Unexpected end of document. Not all elements were closed.'],
      ['<root attr="value>', 'Unclosed start tag'],
      ['<root><![CDATA[text', 'Unclosed CDATA section'],
      ['</root>', 'Mismatched closing tag: </root>. No open elements.'],
    ] as const;

    for (const [xml, message] of cases) {
      expect(() => collect(new StaxXmlNodeIterableParser(bufferBatches(xml, 4, 1)))).toThrow(message);
    }
  });

  it('groups sync file reads into Buffer batches', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stax-node-iterable-'));
    const filePath = join(dir, 'fixture.xml');
    try {
      writeFileSync(filePath, '<root><item id="1">text</item></root>');
      const batches = Array.from(nodeFileByteBatchesSync(filePath, { chunkSize: 5, batchSize: 2 }));

      expect(batches.length).toBeGreaterThan(1);
      expect(batches.every(batch => batch.every(Buffer.isBuffer))).toBe(true);
      expect(collect(new StaxXmlNodeIterableParser(batches))).toEqual(
        collect(new StaxXmlIterableParser(byteBatches('<root><item id="1">text</item></root>', 5, 2))),
      );
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
