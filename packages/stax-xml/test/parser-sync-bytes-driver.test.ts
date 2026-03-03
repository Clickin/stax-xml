import { describe, it, expect } from 'vitest';
import { XmlParserSyncBytes } from '../src/internal';
import { StaxXmlParser } from '../src/StaxXmlParser';
function toChunks(str: string): Uint8Array[] {
  const enc = new TextEncoder();
  const parts = [str.slice(0, 12), str.slice(12, 28), str.slice(28)];
  return parts.map((p) => enc.encode(p));
}

describe('XmlParserSyncBytes driver', () => {
  it('produces the same event sequence as StaxXmlParser over same chunks', async () => {
    const xml = '<root><child attr="v">text</child></root>';
    const chunks = toChunks(xml);

    // Sync driver over chunks
    const driver = new XmlParserSyncBytes(chunks);
    const eventsSync: any[] = [];
    while (true) {
      const e = driver.nextEvent();
      if (e === null) break;
      eventsSync.push(e);
    }

    // Async parser over a ReadableStream built from the same chunks
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(c);
        controller.close();
      }
    });

    const stax = new StaxXmlParser(stream);
    const eventsStream: any[] = [];
    for await (const ev of stax) {
      eventsStream.push(ev);
    }

    expect(eventsSync.length).toBe(eventsStream.length);
    expect(eventsSync).toEqual(eventsStream);
  });
});
