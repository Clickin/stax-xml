import { describe, expect, it } from 'vitest';

import { StaxXmlParserFastPathExperimental, XmlEventType } from '../src/browser';

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

describe('browser subpath export', () => {
  it('exports the fast-path experimental parser through the ./browser entrypoint', async () => {
    const parser = new StaxXmlParserFastPathExperimental(
      stringToReadableStream('<root note="a > b"><child/></root>', [6, 5, 4, 100]),
    );

    const eventTypes: string[] = [];
    const startNames: string[] = [];

    for await (const event of parser) {
      eventTypes.push(event.type);
      if (event.type === XmlEventType.START_ELEMENT) {
        startNames.push(event.name);
      }
    }

    expect(eventTypes).toEqual([
      XmlEventType.START_DOCUMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.END_ELEMENT,
      XmlEventType.END_ELEMENT,
      XmlEventType.END_DOCUMENT,
    ]);
    expect(startNames).toEqual(['root', 'child']);
  });
});
