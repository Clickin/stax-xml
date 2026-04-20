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

  it('handles parser options, filters, and namespace edge cases', () => {
    const xml = [
      '<root xmlns="urn:default" xmlns:ns="urn:ns" attr="a&gt;b">',
      '<ns:item bare ns:flag attr="&copy;">text</ns:item>',
      '<![CDATA[cdata]]>',
      '<pfxOnly/>',
      '</root>',
    ].join('');

    const allEvents = collectSyncEvents(new StaxXmlIterableParser(byteBatches(xml, 17, 2), {
      addEntities: [{ entity: 'copy', value: 'C' }],
    }));
    const root = allEvents.find(event => event.type === XmlEventType.START_ELEMENT && event.name === 'root') as Extract<AnyXmlEvent, { type: typeof XmlEventType.START_ELEMENT }>;
    const item = allEvents.find(event => event.type === XmlEventType.START_ELEMENT && event.name === 'ns:item') as Extract<AnyXmlEvent, { type: typeof XmlEventType.START_ELEMENT }>;

    expect(root.uri).toBe('urn:default');
    expect(root.attributes.attr).toBe('a>b');
    expect(item.uri).toBe('urn:ns');
    expect(item.attributes.bare).toBe('true');
    expect(item.attributes['ns:flag']).toBe('true');
    expect(item.attributes.attr).toBe('C');
    expect(allEvents.some(event => event.type === XmlEventType.CDATA)).toBe(true);

    const filteredEvents = collectSyncEvents(new StaxXmlIterableParser(byteBatches(xml, 17, 2), {
      eventFilter: {
        includeAttributes: false,
        includeCharacters: false,
        includeCdata: false,
      },
    }));
    const filteredRoot = filteredEvents.find(event => event.type === XmlEventType.START_ELEMENT && event.name === 'root') as Extract<AnyXmlEvent, { type: typeof XmlEventType.START_ELEMENT }>;

    expect(filteredRoot.attributes).toEqual({});
    expect(filteredEvents.some(event => event.type === XmlEventType.CHARACTERS)).toBe(false);
    expect(filteredEvents.some(event => event.type === XmlEventType.CDATA)).toBe(false);
  });

  it('covers namespace and attribute parser boundary branches', () => {
    const xml = [
      '<root xmlns="urn:first" xmlns="urn:second" xmlns:ns="urn:ns" xdata="x">',
      '<ns:child attr="a\'b" ns:attr="value" />',
      '<onlyPrefix xmlns:only="urn:only" only:name="value"></onlyPrefix>',
      '<trailing attr="value"   />',
      '</root>',
    ].join('');

    const events = collectSyncEvents(new StaxXmlIterableParser(byteBatches(xml, 13, 2)));
    const root = events.find(event => event.type === XmlEventType.START_ELEMENT && event.name === 'root') as Extract<AnyXmlEvent, { type: typeof XmlEventType.START_ELEMENT }>;
    const child = events.find(event => event.type === XmlEventType.START_ELEMENT && event.name === 'ns:child') as Extract<AnyXmlEvent, { type: typeof XmlEventType.START_ELEMENT }>;
    const onlyPrefix = events.find(event => event.type === XmlEventType.START_ELEMENT && event.name === 'onlyPrefix') as Extract<AnyXmlEvent, { type: typeof XmlEventType.START_ELEMENT }>;

    expect(root.uri).toBe('urn:second');
    expect(child.uri).toBe('urn:ns');
    expect(child.attributes.attr).toBe("a'b");
    expect(child.attributes['ns:attr']).toBe('value');
    expect(onlyPrefix.attributes['only:name']).toBe('value');
  });

  it('keeps entity decoding optional', () => {
    const xml = '<root attr="a&amp;b">&lt;text&gt;</root>';
    const events = collectSyncEvents(new StaxXmlIterableParser(byteBatches(xml, 64, 1), {
      autoDecodeEntities: false,
    }));

    const root = events.find(event => event.type === XmlEventType.START_ELEMENT) as Extract<AnyXmlEvent, { type: typeof XmlEventType.START_ELEMENT }>;
    const text = events.find(event => event.type === XmlEventType.CHARACTERS) as Extract<AnyXmlEvent, { type: typeof XmlEventType.CHARACTERS }>;

    expect(root.attributes.attr).toBe('a&amp;b');
    expect(text.value).toBe('&lt;text&gt;');
  });

  it('supports delimited custom entities and ignores invalid custom entity declarations', () => {
    const options = {
      addEntities: [
        { entity: '&copy;', value: 'C' },
        { entity: '', value: 'ignored' },
        { entity: 'ignored', value: '' },
      ],
    };
    const xml = '<root>&copy;</root>';

    const first = collectSyncEvents(new StaxXmlIterableParser(byteBatches(xml, 64, 1), options));
    const second = collectSyncEvents(new StaxXmlIterableParser(byteBatches(xml, 64, 1), options));
    const firstText = first.find(event => event.type === XmlEventType.CHARACTERS) as Extract<AnyXmlEvent, { type: typeof XmlEventType.CHARACTERS }>;
    const secondText = second.find(event => event.type === XmlEventType.CHARACTERS) as Extract<AnyXmlEvent, { type: typeof XmlEventType.CHARACTERS }>;

    expect(firstText.value).toBe('C');
    expect(secondText.value).toBe('C');
  });

  it('reports final malformed markup errors', () => {
    const cases = [
      ['<?xml version="1.0"', 'Unclosed XML declaration'],
      ['<root><!-- comment', 'Unclosed comment'],
      ['<root><?pi value', 'Unclosed processing instruction'],
      ['<root', 'Unclosed start tag'],
      ['<root></', 'Unclosed end tag'],
      ['<root><item>', 'Unexpected end of document. Not all elements were closed.'],
      ['</root>', 'Mismatched closing tag: </root>. No open elements.'],
    ] as const;

    for (const [xml, message] of cases) {
      expect(() => collectSyncEvents(new StaxXmlIterableParser(byteBatches(xml, 2, 1))))
        .toThrow(message);
    }
  });

  it('tolerates malformed attribute fragments consistently with existing parser behavior', () => {
    const cases = [
      '<root = "value"/>',
      '<root attr=/>',
      '<root attr=value/>',
    ];

    for (const xml of cases) {
      expect(collectSyncEvents(new StaxXmlIterableParser(byteBatches(xml, 3, 1))))
        .toEqual(Array.from(new StaxXmlParserSync(xml)));
    }
  });

  it('skips whitespace-only text segments', () => {
    const events = collectSyncEvents(new StaxXmlIterableParser(byteBatches('<root> \u00A0 \n </root>', 2, 1)));

    expect(events.map(event => event.type)).toEqual([
      XmlEventType.START_DOCUMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.END_ELEMENT,
      XmlEventType.END_DOCUMENT,
    ]);
  });

  it('handles simple non-self-closing tags and padded text/end tags', () => {
    const xml = '<root ><child attr = "value" > text \n</ child ></root>';
    const events = collectSyncEvents(new StaxXmlIterableParser(byteBatches(xml, 4, 1)));
    const childStart = events.find(event => event.type === XmlEventType.START_ELEMENT && event.name === 'child');
    const childEnd = events.find(event => event.type === XmlEventType.END_ELEMENT && event.name === 'child');
    const text = events.find(event => event.type === XmlEventType.CHARACTERS) as Extract<AnyXmlEvent, { type: typeof XmlEventType.CHARACTERS }>;

    expect(childStart).toBeDefined();
    expect(childEnd).toBeDefined();
    expect((childStart as Extract<AnyXmlEvent, { type: typeof XmlEventType.START_ELEMENT }>).attributes.attr).toBe('value');
    expect(text.value).toBe('text');
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
  it('uses the default batch size for sync and async helpers', async () => {
    const chunks = byteChunks('abcdefghijklmnopq', 1);

    expect(Array.from(toByteBatches(chunks)).map(batch => batch.length)).toEqual([16, 1]);

    async function* asyncChunks(): AsyncIterable<Uint8Array> {
      yield* chunks;
    }

    const asyncBatchLengths: number[] = [];
    for await (const batch of toAsyncByteBatches(asyncChunks())) {
      asyncBatchLengths.push(batch.length);
    }

    expect(asyncBatchLengths).toEqual([16, 1]);
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
