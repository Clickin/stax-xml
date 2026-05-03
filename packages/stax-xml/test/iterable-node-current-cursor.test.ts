import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { NodeCurrentCursor } from '../src/iterable/NodeCurrentCursor';

function byteBatches(xml: string, chunkSize: number): readonly Buffer[][] {
  const bytes = Buffer.from(xml, 'utf8');
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    chunks.push(bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength)));
  }
  return chunks.map((chunk) => [chunk]);
}

describe('NodeCurrentCursor', () => {
  it('parses split byte batches without materializing event arrays', () => {
    const cursor = new NodeCurrentCursor(byteBatches('<root><item id="1">text</item><empty/></root>', 3));
    const events: Array<{ type: number; name?: string; text?: string }> = [];

    while (cursor.next()) {
      events.push({
        type: cursor.eventType(),
        name: cursor.name() ?? undefined,
        text: cursor.text() ?? undefined,
      });
    }

    expect(events).toEqual([
      { type: 0, name: undefined, text: undefined },
      { type: 2, name: 'root', text: undefined },
      { type: 2, name: 'item', text: undefined },
      { type: 4, name: undefined, text: 'text' },
      { type: 3, name: 'item', text: undefined },
      { type: 2, name: 'empty', text: undefined },
      { type: 3, name: 'empty', text: undefined },
      { type: 3, name: 'root', text: undefined },
      { type: 1, name: undefined, text: undefined },
    ]);
  });

  it('keeps attribute lookup stable on the active event', () => {
    const cursor = new NodeCurrentCursor(byteBatches('<root a="1" checked bare="x"/>', 4));

    expect(cursor.next()).toBe(true);
    expect(cursor.eventType()).toBe(0);
    expect(cursor.next()).toBe(true);
    expect(cursor.eventType()).toBe(2);
    expect(cursor.name()).toBe('root');
    expect(cursor.getAttributeCount()).toBe(3);
    expect(cursor.getAttributeName(0)).toBe('a');
    expect(cursor.getAttributeValue(0)).toBe('1');
    expect(cursor.getAttributeValue('a')).toBe('1');
    expect(cursor.getAttributeValue('checked')).toBe('true');
    expect(cursor.getAttributeValue('bare')).toBe('x');
    expect(cursor.getAttributeValue('missing')).toBeUndefined();
  });
});
