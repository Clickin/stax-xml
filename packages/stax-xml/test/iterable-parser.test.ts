import { describe, expect, it } from 'vitest';
import {
  StaxXmlAsyncIterableParser,
  StaxXmlIterableParser,
  toAsyncByteBatches,
  toByteBatches,
  XmlEventType,
} from '../src/index';
import { StaxXmlIterableParser as SubpathIterableParser } from '../src/iterable/index';
import { StaxXmlParserSync } from '../src/StaxXmlParserSync';
import type { AnyXmlEvent } from '../src/types';

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

async function* asyncBatches(batches: readonly Uint8Array[][]): AsyncIterable<readonly Uint8Array[]> {
  for (const batch of batches) {
    yield batch;
  }
}

async function collectAsyncEvents(parser: StaxXmlAsyncIterableParser): Promise<AnyXmlEvent[]> {
  const events: AnyXmlEvent[] = [];
  while (true) {
    const batch = await parser.nextBatch();
    if (batch.length === 0) {
      break;
    }
    events.push(...batch);
  }
  return events;
}

function collectSyncEvents(parser: StaxXmlIterableParser): AnyXmlEvent[] {
  const events: AnyXmlEvent[] = [];
  while (true) {
    const batch = parser.nextBatch();
    if (batch.length === 0) {
      break;
    }
    events.push(...batch);
  }
  return events;
}

describe('StaxXmlIterableParser', () => {
  it('matches StaxXmlParserSync events through sync event batches', () => {
    const xml = [
      '<?xml version="1.0"?>',
      '<root xmlns="urn:root" xmlns:ns="urn:ns" attr="a&amp;b">',
      '<ns:item ns:id="42">안녕 🌊</ns:item>',
      '<![CDATA[<raw>value</raw>]]>',
      '<!-- skipped -->',
      '<?pi skipped?>',
      '<empty checked/>',
      '</root>',
    ].join('');

    const expected = Array.from(new StaxXmlParserSync(xml));
    const actual = collectSyncEvents(new StaxXmlIterableParser(byteBatches(xml, 1, 3)));

    expect(actual).toEqual(expected);
  });

  it('is exported from the iterable subpath source entry', () => {
    const xml = '<root><item>value</item></root>';
    const events = collectSyncEvents(new SubpathIterableParser(byteBatches(xml, 4, 2)));

    expect(events.map(event => event.type)).toEqual([
      XmlEventType.START_DOCUMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.CHARACTERS,
      XmlEventType.END_ELEMENT,
      XmlEventType.END_ELEMENT,
      XmlEventType.END_DOCUMENT,
    ]);
  });

  it('throws malformed XML errors instead of emitting error events', () => {
    const parser = new StaxXmlIterableParser(byteBatches('<root><item></root>', 3, 1));

    expect(() => collectSyncEvents(parser)).toThrow('Mismatched closing tag: </root>. Expected </item>.');
  });

  it('does not return an empty sync event batch before end of input', () => {
    const xml = `<root>${'x'.repeat(128)}</root>`;
    const parser = new StaxXmlIterableParser(byteBatches(xml, 8, 1));
    const eventBatches: AnyXmlEvent[][] = [];

    while (true) {
      const batch = parser.nextBatch();
      if (batch.length === 0) {
        break;
      }
      eventBatches.push(batch);
    }

    expect(eventBatches.length).toBeGreaterThan(1);
    expect(eventBatches.every(batch => batch.length > 0)).toBe(true);
    expect(eventBatches.flat().map(event => event.type)).toEqual([
      XmlEventType.START_DOCUMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.CHARACTERS,
      XmlEventType.END_ELEMENT,
      XmlEventType.END_DOCUMENT,
    ]);
  });

  it('iterates over sync event batches, not individual events', () => {
    const xml = '<root><a/><b/></root>';
    const parser = new StaxXmlIterableParser(byteBatches(xml, 3, 2));
    const events: AnyXmlEvent[] = [];

    for (const batch of parser) {
      expect(Array.isArray(batch)).toBe(true);
      events.push(...batch);
    }

    expect(events).toEqual(Array.from(new StaxXmlParserSync(xml)));
  });
});

describe('StaxXmlAsyncIterableParser', () => {
  it('matches sync parser events while exposing batched async pull output', async () => {
    const xml = '<root><item id="1">alpha</item><item id="2">beta</item></root>';
    const expected = Array.from(new StaxXmlParserSync(xml));
    const parser = new StaxXmlAsyncIterableParser(asyncBatches(byteBatches(xml, 5, 2)));

    await expect(collectAsyncEvents(parser)).resolves.toEqual(expected);
  });

  it('does not return an empty event batch before end of input', async () => {
    const xml = `<root>${'x'.repeat(128)}</root>`;
    const parser = new StaxXmlAsyncIterableParser(asyncBatches(byteBatches(xml, 8, 1)));
    const eventBatches: AnyXmlEvent[][] = [];

    while (true) {
      const batch = await parser.nextBatch();
      if (batch.length === 0) {
        break;
      }
      eventBatches.push(batch);
    }

    expect(eventBatches.length).toBeGreaterThan(1);
    expect(eventBatches.every(batch => batch.length > 0)).toBe(true);
    expect(eventBatches.flat().map(event => event.type)).toEqual([
      XmlEventType.START_DOCUMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.CHARACTERS,
      XmlEventType.END_ELEMENT,
      XmlEventType.END_DOCUMENT,
    ]);
  });

  it('supports async iteration over event batches', async () => {
    const xml = '<root><a/><b/></root>';
    const parser = new StaxXmlAsyncIterableParser(asyncBatches(byteBatches(xml, 3, 2)));
    const events: AnyXmlEvent[] = [];

    for await (const batch of parser) {
      events.push(...batch);
    }

    expect(events).toEqual(Array.from(new StaxXmlParserSync(xml)));
  });

  it('rejects malformed XML errors instead of returning error events', async () => {
    const parser = new StaxXmlAsyncIterableParser(asyncBatches(byteBatches('<root><![CDATA[text', 2, 2)));

    await expect(collectAsyncEvents(parser)).rejects.toThrow('Unclosed CDATA section');
  });
});

describe('byte batch helpers', () => {
  it('groups sync Uint8Array chunks without changing byte contents', () => {
    const chunks = byteChunks('<root>abc</root>', 2);
    const batches = Array.from(toByteBatches(chunks, { batchSize: 3 }));

    expect(batches.map(batch => batch.length)).toEqual([3, 3, 2]);
    expect(new TextDecoder().decode(concatBatches(batches))).toBe('<root>abc</root>');
  });

  it('groups async Uint8Array chunks without changing byte contents', async () => {
    async function* chunks(): AsyncIterable<Uint8Array> {
      yield* byteChunks('<root>abc</root>', 2);
    }

    const batches: readonly Uint8Array[][] = [];
    for await (const batch of toAsyncByteBatches(chunks(), { batchSize: 4 })) {
      batches.push(batch);
    }

    expect(batches.map(batch => batch.length)).toEqual([4, 4]);
    expect(new TextDecoder().decode(concatBatches(batches))).toBe('<root>abc</root>');
  });
});

function concatBatches(batches: readonly (readonly Uint8Array[])[]): Uint8Array {
  const total = batches.reduce(
    (sum, batch) => sum + batch.reduce((batchSum, chunk) => batchSum + chunk.byteLength, 0),
    0,
  );
  const output = new Uint8Array(total);
  let offset = 0;
  for (const batch of batches) {
    for (const chunk of batch) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
  }
  return output;
}
