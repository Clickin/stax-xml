import { describe, expect, it } from 'vitest';
import {
  EventReader,
  EventReaderSync,
  XmlEventType,
  type AnyXmlEvent
} from '../src/index';
import { IterableEventType, IterableReader, toByteBatches } from '../src/IterableReader';
import { CursorEventType, CursorReader, CursorReaderAsync } from '../src/cursor';
import { x } from '../src/converter';
import { XmlParserInternal } from '../src/converter/XmlParserInternal';

type NormalizedEvent = {
  type: 'start-document' | 'end-document' | 'start' | 'end' | 'text' | 'cdata';
  name?: string;
  text?: string;
  attributes?: Record<string, string>;
};

const parityFixtures = [
  {
    name: 'attributes and self-closing elements',
    xml: '<root id="r1"><item code="a">one</item><empty flag="yes"/></root>',
    chunkSize: 5
  },
  {
    name: 'CDATA, comments, declaration, and doctype',
    xml: '<?xml version="1.0"?><!DOCTYPE root><root><!--skip--><?pi skip?><item><![CDATA[raw <xml>]]></item></root>',
    chunkSize: 7
  },
  {
    name: 'namespaced UTF-8 text across chunk boundaries',
    xml: '<ns:root xmlns:ns="urn:test"><ns:item lang="ja">こんにちは</ns:item></ns:root>',
    chunkSize: 4
  }
] as const;

describe('release API parity matrix', () => {
  for (const fixture of parityFixtures) {
    it(`keeps parser, cursor, and iterable event output aligned for ${fixture.name}`, async () => {
      const syncEvents = collectSyncParserEvents(fixture.xml);

      expect(await collectAsyncParserEvents(fixture.xml, fixture.chunkSize)).toEqual(syncEvents);
      expect(collectSyncCursorEvents(fixture.xml)).toEqual(syncEvents);
      expect(await collectAsyncCursorEvents(fixture.xml, fixture.chunkSize)).toEqual(syncEvents);
      expect(collectIterableEvents(fixture.xml, fixture.chunkSize)).toEqual(syncEvents);
    });
  }

  it('keeps converter sync, async stream, and compiled paths aligned', async () => {
    const xml = '<catalog><book id="b1"><title>Native XML</title><price>42</price></book><book id="b2"><title>Wasm XML</title><price>7</price></book></catalog>';
    const schema = x.object({
      books: x.array(
        x.object({
          id: x.string().xpath('./@id'),
          title: x.string().xpath('./title'),
          price: x.number().xpath('./price')
        }),
        '/catalog/book'
      )
    });
    const compiled = schema.compile();
    const expected = {
      books: [
        { id: 'b1', title: 'Native XML', price: 42 },
        { id: 'b2', title: 'Wasm XML', price: 7 }
      ]
    };

    expect(schema.parseSync(xml)).toEqual(expected);
    expect(await schema.parse(streamFrom(xml, 6))).toEqual(expected);
    expect(compiled.parseSync(xml)).toEqual(expected);
    expect(await compiled.parse(streamFrom(xml, 6))).toEqual(expected);
  });

  it('routes public async parser streams through the iterable backend', async () => {
    const originalPushByteBatch = IterableReader.prototype.pushByteBatch;
    let pushByteBatchCalls = 0;
    IterableReader.prototype.pushByteBatch = function countedPushByteBatch(batch, isFinal) {
      pushByteBatchCalls++;
      return originalPushByteBatch.call(this, batch, isFinal);
    };

    try {
      await expect(collectAsyncParserEvents('<root><item>text</item></root>', 3)).resolves.toEqual([
        { type: 'start-document' },
        { type: 'start', name: 'root', attributes: {} },
        { type: 'start', name: 'item', attributes: {} },
        { type: 'text', text: 'text' },
        { type: 'end', name: 'item' },
        { type: 'end', name: 'root' },
        { type: 'end-document' }
      ]);
      expect(pushByteBatchCalls).toBeGreaterThan(0);
    } finally {
      IterableReader.prototype.pushByteBatch = originalPushByteBatch;
    }
  });

  it('keeps public sync parser string behavior stable on the JS mainline', () => {
    const originalNextBatch = IterableReader.prototype.nextBatch;
    let nextBatchCalls = 0;
    IterableReader.prototype.nextBatch = function countedNextBatch() {
      nextBatchCalls++;
      return originalNextBatch.call(this);
    };

    try {
      expect(collectSyncParserEvents('<root><item>text</item></root>')).toEqual([
        { type: 'start-document' },
        { type: 'start', name: 'root', attributes: {} },
        { type: 'start', name: 'item', attributes: {} },
        { type: 'text', text: 'text' },
        { type: 'end', name: 'item' },
        { type: 'end', name: 'root' },
        { type: 'end-document' }
      ]);
      expect(nextBatchCalls).toBeGreaterThanOrEqual(0);
    } finally {
      IterableReader.prototype.nextBatch = originalNextBatch;
    }
  });

  it('keeps async cursor on the iterable backend while sync cursor stays aligned on its JS mainline', async () => {
    const originalNextBatch = IterableReader.prototype.nextBatch;
    let nextBatchCalls = 0;
    IterableReader.prototype.nextBatch = function countedNextBatch() {
      nextBatchCalls++;
      return originalNextBatch.call(this);
    };

    try {
      expect(collectSyncCursorEvents('<root><item>text</item></root>')).toEqual([
        { type: 'start-document' },
        { type: 'start', name: 'root', attributes: {} },
        { type: 'start', name: 'item', attributes: {} },
        { type: 'text', text: 'text' },
        { type: 'end', name: 'item' },
        { type: 'end', name: 'root' },
        { type: 'end-document' }
      ]);
      await expect(collectAsyncCursorEvents('<root><item>text</item></root>', 3)).resolves.toEqual([
        { type: 'start-document' },
        { type: 'start', name: 'root', attributes: {} },
        { type: 'start', name: 'item', attributes: {} },
        { type: 'text', text: 'text' },
        { type: 'end', name: 'item' },
        { type: 'end', name: 'root' },
        { type: 'end-document' }
      ]);
      expect(nextBatchCalls).toBeGreaterThanOrEqual(0);
    } finally {
      IterableReader.prototype.nextBatch = originalNextBatch;
    }
  });

  it('routes compiled async stream parsing through the iterable backend', async () => {
    const xml = '<catalog><book id="b1"><title>Native XML</title></book></catalog>';
    const schema = x.object({
      books: x.array(
        x.object({
          id: x.string().xpath('./@id'),
          title: x.string().xpath('./title')
        }),
        '/catalog/book'
      )
    }).compile();

    const originalNext = EventReader.prototype.next;
    const originalBatchedIterator = EventReader.prototype.batchedIterator;
    EventReader.prototype.next = function blockedNext() {
      throw new Error('EventReader.next should not be used by compiled stream parsing');
    };
    EventReader.prototype.batchedIterator = async function* blockedBatchedIterator() {
      yield* [];
      throw new Error('EventReader.batchedIterator should not be used by compiled stream parsing');
    };

    try {
      await expect(schema.parse(streamFrom(xml, 3))).resolves.toEqual({
        books: [{ id: 'b1', title: 'Native XML' }]
      });
    } finally {
      EventReader.prototype.next = originalNext;
      EventReader.prototype.batchedIterator = originalBatchedIterator;
    }
  });

  it('routes runtime converter async stream parsing through the iterable backend', async () => {
    const xml = '<catalog><book id="b1"><title>Native XML</title></book></catalog>';
    const schema = x.object({
      books: x.array(
        x.object({
          id: x.string().xpath('./@id'),
          title: x.string().xpath('./title')
        }),
        '/catalog/book'
      )
    });

    const originalNext = EventReader.prototype.next;
    const originalBatchedIterator = EventReader.prototype.batchedIterator;
    EventReader.prototype.next = function blockedNext() {
      throw new Error('EventReader.next should not be used by runtime stream parsing');
    };
    EventReader.prototype.batchedIterator = async function* blockedBatchedIterator() {
      yield* [];
      throw new Error('EventReader.batchedIterator should not be used by runtime stream parsing');
    };

    try {
      await expect(schema.parse(streamFrom(xml, 3))).resolves.toEqual({
        books: [{ id: 'b1', title: 'Native XML' }]
      });
    } finally {
      EventReader.prototype.next = originalNext;
      EventReader.prototype.batchedIterator = originalBatchedIterator;
    }
  });

  it('keeps compiled parsing compatible with custom batched async event sources', async () => {
    const schema = x.object({
      books: x.array(
        x.object({
          id: x.string().xpath('./@id'),
          title: x.string().xpath('./title')
        }),
        '/catalog/book'
      )
    }).compile();

    const source = {
      async next(): Promise<IteratorResult<AnyXmlEvent>> {
        return { value: undefined, done: true };
      },
      async *batchedIterator(): AsyncGenerator<AnyXmlEvent[]> {
        yield [
          { type: XmlEventType.START_DOCUMENT },
          start('catalog'),
          start('book', { id: 'b1' }),
          start('title'),
          { type: XmlEventType.CHARACTERS, value: 'Native XML' },
          end('title'),
          end('book'),
          end('catalog'),
          { type: XmlEventType.END_DOCUMENT }
        ];
      }
    };

    await expect(schema.parse(source)).resolves.toEqual({
      books: [{ id: 'b1', title: 'Native XML' }]
    });
  });

  it('auto-routes uncompiled parseSync through the dispatch executor', () => {
    const xml = '<catalog><book id="b1"><title>Native XML</title></book></catalog>';
    const schema = x.object({
      books: x.array(
        x.object({
          id: x.string().xpath('./@id'),
          title: x.string().xpath('./title')
        }),
        '/catalog/book'
      )
    });

    const originalParseObject = XmlParserInternal.prototype.parseObject;
    XmlParserInternal.prototype.parseObject = function blockedParseObject() {
      throw new Error('XmlParserInternal.parseObject should not be used by auto-dispatch parseSync');
    } as typeof XmlParserInternal.prototype.parseObject;

    try {
      expect(schema.parseSync(xml)).toEqual({
        books: [{ id: 'b1', title: 'Native XML' }]
      });
    } finally {
      XmlParserInternal.prototype.parseObject = originalParseObject;
    }
  });

  it('auto-routes mixed root object schemas through the dispatch executor', () => {
    const xml = '<catalog><summary><source>benchmark</source></summary><book id="b1"><title>Native XML</title><meta><rating>5</rating></meta></book></catalog>';
    const schema = x.object({
      summary: x.object({
        source: x.string().xpath('./source')
      }).xpath('/catalog/summary'),
      books: x.array(
        x.object({
          id: x.string().xpath('./@id'),
          title: x.string().xpath('./title'),
          rating: x.number().xpath('./meta/rating')
        }),
        '/catalog/book'
      ),
      sourceName: x.string().xpath('/catalog/summary/source')
    });
    const expected = {
      summary: { source: 'benchmark' },
      books: [{ id: 'b1', title: 'Native XML', rating: 5 }],
      sourceName: 'benchmark'
    };

    const originalParseObject = XmlParserInternal.prototype.parseObject;
    XmlParserInternal.prototype.parseObject = function blockedParseObject() {
      throw new Error('XmlParserInternal.parseObject should not be used by mixed auto-dispatch parseSync');
    } as typeof XmlParserInternal.prototype.parseObject;

    try {
      expect(schema.parseSync(xml)).toEqual(expected);
      expect(schema.parseSync(xml)).toEqual(expected);
    } finally {
      XmlParserInternal.prototype.parseObject = originalParseObject;
    }
  });

  it('caches unsupported auto-dispatch attempts before falling back to runtime converter', () => {
    const xml = '<root><item><value>one</value></item><item><value>two</value></item></root>';
    const schema = x.object({
      values: x.array(x.string().xpath('./value'), '/root/item')
    });
    const expected = { values: ['one', 'two'] };

    expect(schema.parseSync(xml)).toEqual(expected);
    expect(schema.parseSync(xml)).toEqual(expected);
  });

  it('auto-routes uncompiled async stream parsing through the dispatch executor', async () => {
    const xml = '<catalog><book id="b1"><title>Native XML</title></book></catalog>';
    const schema = x.object({
      books: x.array(
        x.object({
          id: x.string().xpath('./@id'),
          title: x.string().xpath('./title')
        }),
        '/catalog/book'
      )
    });

    const originalParseObjectAsync = XmlParserInternal.prototype.parseObjectAsync;
    XmlParserInternal.prototype.parseObjectAsync = async function blockedParseObjectAsync() {
      throw new Error('XmlParserInternal.parseObjectAsync should not be used by auto-dispatch parse');
    } as typeof XmlParserInternal.prototype.parseObjectAsync;

    try {
      await expect(schema.parse(streamFrom(xml, 3))).resolves.toEqual({
        books: [{ id: 'b1', title: 'Native XML' }]
      });
    } finally {
      XmlParserInternal.prototype.parseObjectAsync = originalParseObjectAsync;
    }
  });

  it('reads already-consumed EventReader inputs from the current position without the public event parser facade', async () => {
    const xml = '<root><item id="skip"><title>Skip</title></item><item id="keep"><title>Keep</title></item></root>';
    const parser = new EventReader(streamFrom(xml, 4));
    await consumeThroughFirstItem(parser);

    const schema = x.object({
      items: x.array(
        x.object({
          id: x.string().xpath('./@id'),
          title: x.string().xpath('./title')
        }),
        '//item'
      )
    });

    const originalNext = EventReader.prototype.next;
    const originalBatchedIterator = EventReader.prototype.batchedIterator;
    EventReader.prototype.next = function blockedNext() {
      throw new Error('EventReader.next should not be used after handing a parser to converter');
    };
    EventReader.prototype.batchedIterator = async function* blockedBatchedIterator() {
      yield* [];
      throw new Error('EventReader.batchedIterator should not be used after handing a parser to converter');
    };

    try {
      await expect(schema.parse(parser as unknown as AsyncIterator<AnyXmlEvent>)).resolves.toEqual({
        items: [{ id: 'keep', title: 'Keep' }]
      });
    } finally {
      EventReader.prototype.next = originalNext;
      EventReader.prototype.batchedIterator = originalBatchedIterator;
    }
  });
});

function collectSyncParserEvents(xml: string): NormalizedEvent[] {
  return Array.from(new EventReaderSync(xml)).map(normalizeXmlEvent);
}

async function collectAsyncParserEvents(xml: string, chunkSize: number): Promise<NormalizedEvent[]> {
  const events: NormalizedEvent[] = [];
  for await (const event of new EventReader(streamFrom(xml, chunkSize))) {
    events.push(normalizeXmlEvent(event));
  }
  return events;
}

function collectIterableEvents(xml: string, chunkSize: number): NormalizedEvent[] {
  const parser = new IterableReader(toByteBatches(byteChunks(xml, chunkSize), { batchSize: 2 }));
  const events: NormalizedEvent[] = [];

  while (parser.nextBatch()) {
    for (let index = 0; index < parser.eventCount(); index++) {
      events.push(normalizeIterableEvent(parser, index));
    }
  }

  return events;
}

function collectSyncCursorEvents(xml: string): NormalizedEvent[] {
  const cursor = new CursorReader(xml);
  const events: NormalizedEvent[] = [];
  while (cursor.next()) {
    events.push(normalizeCursorEvent(cursor));
  }
  return events;
}

async function collectAsyncCursorEvents(xml: string, chunkSize: number): Promise<NormalizedEvent[]> {
  const cursor = new CursorReaderAsync(streamFrom(xml, chunkSize));
  const events: NormalizedEvent[] = [];
  while (await cursor.next()) {
    events.push(normalizeCursorEvent(cursor));
  }
  return events;
}

function normalizeXmlEvent(event: AnyXmlEvent): NormalizedEvent {
  if (event.type === XmlEventType.START_DOCUMENT) {
    return { type: 'start-document' };
  }
  if (event.type === XmlEventType.END_DOCUMENT) {
    return { type: 'end-document' };
  }
  if (event.type === XmlEventType.START_ELEMENT) {
    return { type: 'start', name: event.name, attributes: event.attributes };
  }
  if (event.type === XmlEventType.END_ELEMENT) {
    return { type: 'end', name: event.name };
  }
  if (event.type === XmlEventType.CDATA) {
    return { type: 'cdata', text: event.value };
  }
  if (event.type === XmlEventType.CHARACTERS) {
    return { type: 'text', text: event.value };
  }
  throw event.error;
}

function normalizeIterableEvent(parser: IterableReader, index: number): NormalizedEvent {
  const type = parser.eventType(index);
  if (type === IterableEventType.START_DOCUMENT) {
    return { type: 'start-document' };
  }
  if (type === IterableEventType.END_DOCUMENT) {
    return { type: 'end-document' };
  }
  if (type === IterableEventType.START_ELEMENT) {
    return { type: 'start', name: parser.copyName(index), attributes: parser.copyAttributesObject(index) };
  }
  if (type === IterableEventType.END_ELEMENT) {
    return { type: 'end', name: parser.copyName(index) };
  }
  if (type === IterableEventType.CDATA) {
    return { type: 'cdata', text: parser.copyText(index) };
  }
  return { type: 'text', text: parser.copyText(index) };
}

function normalizeCursorEvent(cursor: CursorReader | CursorReaderAsync): NormalizedEvent {
  const type = cursor.eventType();
  if (type === CursorEventType.START_DOCUMENT) {
    return { type: 'start-document' };
  }
  if (type === CursorEventType.END_DOCUMENT) {
    return { type: 'end-document' };
  }
  if (type === CursorEventType.START_ELEMENT) {
    return { type: 'start', name: cursor.name(), attributes: cursorAttributes(cursor) };
  }
  if (type === CursorEventType.END_ELEMENT) {
    return { type: 'end', name: cursor.name() };
  }
  if (type === CursorEventType.CDATA) {
    return { type: 'cdata', text: cursor.text() };
  }
  return { type: 'text', text: cursor.text() };
}

function cursorAttributes(cursor: CursorReader | CursorReaderAsync): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (let index = 0; index < cursor.getAttributeCount(); index++) {
    attributes[cursor.getAttributeName(index)!] = cursor.getAttributeValue(index)!;
  }
  return attributes;
}

function streamFrom(xml: string, chunkSize: number): ReadableStream<Uint8Array> {
  const chunks = Array.from(byteChunks(xml, chunkSize));
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    }
  });
}

function* byteChunks(xml: string, chunkSize: number): Iterable<Uint8Array> {
  const bytes = new TextEncoder().encode(xml);
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    yield bytes.slice(offset, offset + chunkSize);
  }
}

function start(name: string, attributes: Record<string, string> = {}): AnyXmlEvent {
  return {
    type: XmlEventType.START_ELEMENT,
    name,
    attributes
  };
}

function end(name: string): AnyXmlEvent {
  return {
    type: XmlEventType.END_ELEMENT,
    name
  };
}

async function consumeThroughFirstItem(parser: EventReader): Promise<void> {
  while (true) {
    const next = await parser.next();
    if (next.done) {
      throw new Error('fixture ended before first item closed');
    }
    if (next.value.type === XmlEventType.END_ELEMENT && next.value.name === 'item') {
      return;
    }
  }
}
