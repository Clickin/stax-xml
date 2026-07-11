import { describe, expect, it } from 'vitest';

import { EventReader } from 'stax-xml-async';
import { XmlEventType, type AnyXmlEvent, type StartElementEvent } from 'stax-xml-core';

function stringToReadableStream(xml: string, chunkSizes: number[] = [xml.length]): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(xml);

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let offset = 0;
      let chunkIndex = 0;
      while (offset < bytes.length) {
        const size = chunkSizes[Math.min(chunkIndex, chunkSizes.length - 1)] ?? bytes.length;
        const end = Math.min(offset + size, bytes.length);
        controller.enqueue(bytes.slice(offset, end));
        offset = end;
        chunkIndex++;
      }
      controller.close();
    },
  });
}

async function collectEvents(xml: string, chunkSizes?: number[]): Promise<AnyXmlEvent[]> {
  const parser = new EventReader(stringToReadableStream(xml, chunkSizes));
  const events: AnyXmlEvent[] = [];

  for await (const event of parser) {
    events.push(event);
  }

  return events;
}

describe('EventReader async regressions', () => {
  it('parses attributes and namespace URIs on async start elements', async () => {
    const events = await collectEvents(
      '<root xmlns:h="http://www.w3.org/TR/html4/" h:id="bk101" category="Computer"><h:item/></root>',
    );

    const root = events.find((event): event is StartElementEvent =>
      event.type === XmlEventType.START_ELEMENT && event.name === 'root',
    );
    const item = events.find((event): event is StartElementEvent =>
      event.type === XmlEventType.START_ELEMENT && event.name === 'h:item',
    );

    expect(root).toBeDefined();
    expect(root!.attributes).toEqual([
      { name: 'h:id', localName: 'id', prefix: 'h', namespaceURI: 'http://www.w3.org/TR/html4/', value: 'bk101' },
      { name: 'category', localName: 'category', prefix: '', namespaceURI: '', value: 'Computer' },
    ]);
    expect(item).toBeDefined();
    expect(item!.prefix).toBe('h');
    expect(item!.localName).toBe('item');
    expect(item!.namespaceURI).toBe('http://www.w3.org/TR/html4/');
  });

  it('does not treat quoted > as the end of a start tag', async () => {
    const events = await collectEvents(
      '<root note="a > b"><child value="x"/></root>',
      [10, 3, 5, 100],
    );

    const root = events.find((event): event is StartElementEvent =>
      event.type === XmlEventType.START_ELEMENT && event.name === 'root',
    );
    const child = events.find((event): event is StartElementEvent =>
      event.type === XmlEventType.START_ELEMENT && event.name === 'child',
    );

    expect(root).toBeDefined();
    expect(root!.attributes.find(attribute => attribute.name === 'note')?.value).toBe('a > b');
    expect(child).toBeDefined();
    expect(child!.attributes.find(attribute => attribute.name === 'value')?.value).toBe('x');
  });
});
