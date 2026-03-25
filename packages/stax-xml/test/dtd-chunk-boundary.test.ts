import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { StaxXmlCursor } from '../src/StaxXmlCursor';
import { XmlEventType } from '../src/types';
import {
  collectAsyncTrace,
  collectSyncTrace,
} from './helpers/parser-trace';

const mixedFixture = readFileSync(
  new URL('../../benchmark/assets/mixed.xml', import.meta.url),
  'utf8'
);
const compactDtdFixture =
  '<?xml version="1.0"?><!DOCTYPE foo [<!ELEMENT foo (#PCDATA)><!--internal--><!ELEMENT bar (#PCDATA)>]><foo>before<![CDATA[<bar/>]]>after</foo>';

describe('DTD Chunk Boundary Regressions', () => {
  it('should parse the mixed benchmark fixture synchronously', () => {
    expect(() => collectSyncTrace(mixedFixture)).not.toThrow();
  });

  it('should match the sync trace for a compact DTD fixture across representative chunk sizes', async () => {
    const expected = collectSyncTrace(compactDtdFixture);

    for (const chunkSize of [1, 4, 16, 256]) {
      await expect(collectAsyncTrace(compactDtdFixture, chunkSize)).resolves.toEqual(expected);
    }
  });

  it('should tolerate empty chunks while parsing a compact DTD fixture', async () => {
    const expected = collectSyncTrace(compactDtdFixture);
    const parser = new StaxXmlCursor(createChunkedStreamWithEmptyChunks(compactDtdFixture, 16));
    const actualTypes: string[] = [];

    while (parser.hasNext()) {
      actualTypes.push(await parser.next());
    }

    expect(actualTypes).toEqual(expected.map((record) => record.type));
  });

  it('should preserve the mixed benchmark fixture event structure with 256-byte chunks', async () => {
    const expected = collectSyncTrace(mixedFixture);
    const actual = await collectAsyncTrace(mixedFixture, 256);

    expect(actual.map((record) => record.type)).toEqual(expected.map((record) => record.type));
    expect(actual[1]?.name).toBe(expected[1]?.name);
    expect(actual.at(-2)?.name).toBe(expected.at(-2)?.name);
  });
});

function createChunkedStreamWithEmptyChunks(xml: string, chunkSize: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(xml);
  let offset = 0;
  let emitEmptyChunk = false;

  return new ReadableStream({
    pull(controller) {
      if (emitEmptyChunk) {
        emitEmptyChunk = false;
        controller.enqueue(new Uint8Array(0));
        return;
      }

      if (offset >= bytes.length) {
        controller.close();
        return;
      }

      const nextOffset = Math.min(offset + chunkSize, bytes.length);
      controller.enqueue(bytes.slice(offset, nextOffset));
      offset = nextOffset;
      emitEmptyChunk = true;
    }
  });
}
