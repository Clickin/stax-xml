import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CursorEventType } from '../../src/cursor/index';
import { Uint8ArrayCurrentCursor } from '../../src/iterable/Uint8ArrayCurrentCursor';

function byteBatches(xml: string, chunkSize: number): readonly Uint8Array[][] {
  const bytes = new TextEncoder().encode(xml);
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    chunks.push(bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength)));
  }
  return chunks.map((chunk) => [chunk]);
}

describe('Uint8ArrayCurrentCursor', () => {
  it('parses split byte batches without Buffer', () => {
    const cursor = new Uint8ArrayCurrentCursor(byteBatches('<root><item id="1">text</item><empty/></root>', 3));
    const events: Array<{ type: number; name?: string; text?: string }> = [];

    while (cursor.next()) {
      events.push({
        type: cursor.eventType(),
        name: cursor.name() ?? undefined,
        text: cursor.text() ?? undefined,
      });
    }

    expect(events).toEqual([
      { type: CursorEventType.START_DOCUMENT, name: undefined, text: undefined },
      { type: CursorEventType.START_ELEMENT, name: 'root', text: undefined },
      { type: CursorEventType.START_ELEMENT, name: 'item', text: undefined },
      { type: CursorEventType.CHARACTERS, name: undefined, text: 'text' },
      { type: CursorEventType.END_ELEMENT, name: 'item', text: undefined },
      { type: CursorEventType.START_ELEMENT, name: 'empty', text: undefined },
      { type: CursorEventType.END_ELEMENT, name: 'empty', text: undefined },
      { type: CursorEventType.END_ELEMENT, name: 'root', text: undefined },
      { type: CursorEventType.END_DOCUMENT, name: undefined, text: undefined },
    ]);
  });

  it('keeps the public cursor facade free of node:buffer imports', () => {
    const files = [
      'packages/stax-xml/src/cursor/ByteCursorFacadeSync.ts',
      'packages/stax-xml/src/cursor/ByteCursorFacadeAsync.ts',
      'packages/stax-xml/src/iterable/Uint8ArrayCurrentCursor.ts',
      'packages/stax-xml/src/iterable/Uint8ArrayCurrentCursorAsync.ts',
    ];

    for (const file of files) {
      const source = readFileSync(resolve(process.cwd(), '..', '..', file), 'utf8');
      expect(source, file).not.toContain('node:buffer');
      expect(source, file).not.toMatch(/\bBuffer\./);
    }
  });

});
