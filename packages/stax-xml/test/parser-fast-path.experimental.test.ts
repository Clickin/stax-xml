import { describe, expect, it } from 'vitest';

import {
  StaxXmlParserFastPathExperimental,
  XmlEventType,
  type AnyXmlEvent,
} from '../src/index';

function chunksToReadableStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

function xmlToChunkedStream(xml: string, chunkSizes: number[]): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(xml);
  const chunks: Uint8Array[] = [];

  let offset = 0;
  let chunkIndex = 0;
  while (offset < bytes.length) {
    const size = chunkSizes[Math.min(chunkIndex, chunkSizes.length - 1)] ?? bytes.length;
    const end = Math.min(offset + size, bytes.length);
    chunks.push(bytes.slice(offset, end));
    offset = end;
    chunkIndex++;
  }

  return chunksToReadableStream(chunks);
}

function summarizeEvents(events: AnyXmlEvent[]) {
  return events.map((event) => {
    switch (event.type) {
      case XmlEventType.START_ELEMENT:
        return {
          type: event.type,
          name: event.name,
          attributes: event.attributes,
        };
      case XmlEventType.END_ELEMENT:
        return {
          type: event.type,
          name: event.name,
        };
      case XmlEventType.CHARACTERS:
      case XmlEventType.CDATA:
        return {
          type: event.type,
          value: event.value,
        };
      default:
        return { type: event.type };
    }
  });
}

async function collectEvents(input: ReadableStream<Uint8Array>): Promise<AnyXmlEvent[]> {
  const parser = new StaxXmlParserFastPathExperimental(input);
  const events: AnyXmlEvent[] = [];

  for await (const event of parser) {
    events.push(event);
  }

  return events;
}

describe('StaxXmlParserFastPathExperimental', () => {
  it('parses start tags split across chunk boundaries and preserves quoted > characters', async () => {
    const xml = '<root note="a > b" plain="1"><child>ok</child></root>';

    const events = await collectEvents(
      xmlToChunkedStream(xml, [3, 12, 9, 5, 4, 2, 100]),
    );

    expect(summarizeEvents(events)).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      {
        type: XmlEventType.START_ELEMENT,
        name: 'root',
        attributes: {
          note: 'a > b',
          plain: '1',
        },
      },
      {
        type: XmlEventType.START_ELEMENT,
        name: 'child',
        attributes: {},
      },
      { type: XmlEventType.CHARACTERS, value: 'ok' },
      { type: XmlEventType.END_ELEMENT, name: 'child' },
      { type: XmlEventType.END_ELEMENT, name: 'root' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('handles split declarations, comments, CDATA, and processing instructions', async () => {
    const xml = '<?xml version="1.0"?><root><!--x--><![CDATA[a<b]]><?pi ok?><item/></root>';

    const events = await collectEvents(
      xmlToChunkedStream(xml, [5, 4, 7, 3, 2, 6, 5, 4, 100]),
    );

    expect(summarizeEvents(events)).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      {
        type: XmlEventType.START_ELEMENT,
        name: 'root',
        attributes: {},
      },
      { type: XmlEventType.CDATA, value: 'a<b' },
      {
        type: XmlEventType.START_ELEMENT,
        name: 'item',
        attributes: {},
      },
      { type: XmlEventType.END_ELEMENT, name: 'item' },
      { type: XmlEventType.END_ELEMENT, name: 'root' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('decodes UTF-8 across byte chunk boundaries and emits one text event', async () => {
    const xml = '<root>한글😀 tail</root>';

    const events = await collectEvents(
      xmlToChunkedStream(xml, [8, 1, 2, 1, 3, 2, 100]),
    );

    expect(summarizeEvents(events)).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      {
        type: XmlEventType.START_ELEMENT,
        name: 'root',
        attributes: {},
      },
      { type: XmlEventType.CHARACTERS, value: '한글😀 tail' },
      { type: XmlEventType.END_ELEMENT, name: 'root' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });
});
