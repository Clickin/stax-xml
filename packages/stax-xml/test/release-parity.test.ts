import { describe, expect, it } from 'vitest';
import {
  IterableEventType,
  StaxXmlIterableParser,
  StaxXmlParser,
  StaxXmlParserSync,
  toByteBatches,
  XmlEventType,
  type AnyXmlEvent
} from '../src/index';
import { CursorEventType, StaxXmlCursorReader, StaxXmlCursorReaderAsync } from '../src/cursor';
import { x } from '../src/converter';

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
});

function collectSyncParserEvents(xml: string): NormalizedEvent[] {
  return Array.from(new StaxXmlParserSync(xml)).map(normalizeXmlEvent);
}

async function collectAsyncParserEvents(xml: string, chunkSize: number): Promise<NormalizedEvent[]> {
  const events: NormalizedEvent[] = [];
  for await (const event of new StaxXmlParser(streamFrom(xml, chunkSize))) {
    events.push(normalizeXmlEvent(event));
  }
  return events;
}

function collectIterableEvents(xml: string, chunkSize: number): NormalizedEvent[] {
  const parser = new StaxXmlIterableParser(toByteBatches(byteChunks(xml, chunkSize), { batchSize: 2 }));
  const events: NormalizedEvent[] = [];

  while (parser.nextBatch()) {
    for (let index = 0; index < parser.eventCount(); index++) {
      events.push(normalizeIterableEvent(parser, index));
    }
  }

  return events;
}

function collectSyncCursorEvents(xml: string): NormalizedEvent[] {
  const cursor = new StaxXmlCursorReader(xml);
  const events: NormalizedEvent[] = [];
  while (cursor.next()) {
    events.push(normalizeCursorEvent(cursor));
  }
  return events;
}

async function collectAsyncCursorEvents(xml: string, chunkSize: number): Promise<NormalizedEvent[]> {
  const cursor = new StaxXmlCursorReaderAsync(streamFrom(xml, chunkSize));
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

function normalizeIterableEvent(parser: StaxXmlIterableParser, index: number): NormalizedEvent {
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

function normalizeCursorEvent(cursor: StaxXmlCursorReader | StaxXmlCursorReaderAsync): NormalizedEvent {
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

function cursorAttributes(cursor: StaxXmlCursorReader | StaxXmlCursorReaderAsync): Record<string, string> {
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
