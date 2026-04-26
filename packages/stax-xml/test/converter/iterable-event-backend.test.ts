import { describe, expect, it } from 'vitest';
import {
  IterableEventBackendIterator,
  createIterableParserFromChunks,
  materializeIterableEventBatch,
  readReadableStreamChunks
} from '../../src/converter/IterableEventBackend.js';
import { XmlEventType } from '../../src/types.js';

const encoder = new TextEncoder();

describe('IterableEventBackendIterator', () => {
  it('materializes iterable parser frames as async XML event batches', async () => {
    const xml = '<ns:root xmlns="urn:default" xmlns:ns="urn:test" ns:label="Tom &amp; Jerry"><child>plain</child><![CDATA[raw <xml>]]></ns:root>';
    const reader = new IterableEventBackendIterator(streamFrom(xml, 5), { decodeEntities: true });
    const events = [];

    expect(reader[Symbol.asyncIterator]()).toBe(reader);

    for await (const batch of reader.batchedIterator()) {
      events.push(...batch);
    }

    expect(events.map((event) => event.type)).toEqual([
      XmlEventType.START_DOCUMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.CHARACTERS,
      XmlEventType.END_ELEMENT,
      XmlEventType.CDATA,
      XmlEventType.END_ELEMENT,
      XmlEventType.END_DOCUMENT
    ]);
    expect(events[1]).toMatchObject({
      name: 'ns:root',
      localName: 'root',
      prefix: 'ns',
      attributes: {
        xmlns: 'urn:default',
        'xmlns:ns': 'urn:test',
        'ns:label': 'Tom & Jerry'
      },
      attributesWithPrefix: {
        'ns:label': {
          value: 'Tom & Jerry',
          localName: 'label',
          prefix: 'ns'
        }
      }
    });
    expect(events[3]).toMatchObject({ value: 'plain' });
    expect(events[5]).toMatchObject({ value: 'raw <xml>' });
  });

  it('keeps invalid iterable attribute indices defensive', () => {
    const parser = createIterableParserFromChunks([encoder.encode('<root attr="value"/>')]);
    let startElementIndex = -1;

    while (parser.nextBatch()) {
      for (let index = 0; index < parser.eventCount(); index++) {
        if (parser.attrCount(index) > 0) {
          startElementIndex = index;
          break;
        }
      }
      if (startElementIndex !== -1) {
        break;
      }
    }

    expect(startElementIndex).toBeGreaterThanOrEqual(0);
    expect(parser.isImplicitAttributeValue(startElementIndex, -1)).toBe(false);
    expect(parser.isImplicitAttributeValue(startElementIndex, 1)).toBe(false);
  });

  it('supports next(), done, and return() iterator control flow', async () => {
    const reader = new IterableEventBackendIterator(streamFrom('<root/>', 2));

    await expect(reader.next()).resolves.toMatchObject({
      value: { type: XmlEventType.START_DOCUMENT },
      done: false
    });
    await expect(reader.return()).resolves.toEqual({ value: undefined, done: true });

    const drained = new IterableEventBackendIterator(streamFrom('<root/>', 2));
    let result = await drained.next();
    while (!result.done) {
      result = await drained.next();
    }
    expect(result).toEqual({ value: undefined, done: true });

    await expect(new IterableEventBackendIterator(streamFrom('<root/>', 2)).return()).resolves.toEqual({
      value: undefined,
      done: true
    });
  });

  it('remembers backend parse errors across pull APIs', async () => {
    const reader = new IterableEventBackendIterator(streamFrom('<root', 2));

    await expect(reader.nextBatch()).rejects.toThrow('Unclosed start tag');
    await expect(reader.nextBatch()).rejects.toThrow('Unclosed start tag');
    await expect(reader.next()).rejects.toThrow('Unclosed start tag');
  });

  it('applies event filters without changing structural events', () => {
    const parser = createIterableParserFromChunks([
      encoder.encode('<root attr="value">skip<![CDATA[cdata]]><child/></root>')
    ]);
    const events = [];

    while (parser.nextBatch()) {
      events.push(...materializeIterableEventBatch(
        parser,
        { decodeEntities: true },
        { includeAttributes: false, includeCharacters: false, includeCdata: false }
      ));
    }

    expect(events.map((event) => event.type)).toEqual([
      XmlEventType.START_DOCUMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.END_ELEMENT,
      XmlEventType.END_ELEMENT,
      XmlEventType.END_DOCUMENT
    ]);
    expect(events[1]).toMatchObject({ name: 'root', attributes: {} });
    expect(events[2]).toMatchObject({ name: 'child', attributes: {} });
  });

  it('reads stream chunks and preserves undecoded text when entity decoding is disabled', async () => {
    const chunks = await readReadableStreamChunks(streamFrom('<root>A &amp; B</root>', 4));
    expect(chunks.length).toBeGreaterThan(1);

    const parser = createIterableParserFromChunks(chunks);
    const events = [];
    while (parser.nextBatch()) {
      events.push(...materializeIterableEventBatch(parser, { decodeEntities: false }));
    }

    expect(events.find((event) => event.type === XmlEventType.CHARACTERS)).toMatchObject({
      value: 'A &amp; B'
    });
  });

  it('does not drain the entire stream before yielding the first event batch', async () => {
    const chunks = [
      encoder.encode('<root><item>one</item>'),
      encoder.encode('<item>two</item>'),
      encoder.encode('<item>three</item></root>')
    ];
    let pulls = 0;
    let index = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++;
        if (index < chunks.length) {
          controller.enqueue(chunks[index++]!);
          return;
        }
        controller.close();
      }
    }, { highWaterMark: 0 });
    const reader = new IterableEventBackendIterator(stream, { batchSize: 1 });

    const batch = await reader.nextBatch();

    expect(batch.length).toBeGreaterThan(0);
    expect(batch[0]?.type).toBe(XmlEventType.START_DOCUMENT);
    expect(pulls).toBeLessThan(chunks.length);
    await reader.return();
  });
});

function streamFrom(xml: string, chunkSize: number): ReadableStream<Uint8Array> {
  const bytes = encoder.encode(xml);
  return new ReadableStream({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        controller.enqueue(bytes.slice(offset, offset + chunkSize));
      }
      controller.close();
    }
  });
}
