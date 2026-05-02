import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EventReader,
  EventReaderSync,
  StreamEventType,
  XmlEventType,
  initStaxXml,
} from '../src/index.js';
import { resetStaxXmlRuntimeForTests } from '../src/runtime/index.js';
import {
  attr,
  encodeStructuralIndex,
  event,
  none,
  simpleRuntimeBatches,
  span,
} from './test-support/streaming-runtime-fixture.js';

afterEach(() => {
  vi.restoreAllMocks();
  resetStaxXmlRuntimeForTests();
});

describe('zero-base event reader adapters', () => {
  it('uses internal JavaScript fallback only before runtime initialization', () => {
    const reader = new EventReaderSync('<root id="r1">  hello  </root>');
    const batch = reader.nextBatch();

    expect(batch?.map(event => event.type)).toEqual([
      XmlEventType.START_DOCUMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.CHARACTERS,
      XmlEventType.END_ELEMENT,
    ]);
    expect(batch?.[1]).toMatchObject({
      type: XmlEventType.START_ELEMENT,
      name: 'root',
      attributes: { id: 'r1' },
    });
    expect(batch?.[2]).toMatchObject({
      type: XmlEventType.CHARACTERS,
      value: '  hello  ',
    });
    expect(reader.nextBatch()?.map(event => event.type)).toEqual([XmlEventType.END_DOCUMENT]);
    expect(reader.nextBatch()).toBeNull();
  });

  it('materializes sync adapter batches from the streaming core once runtime is initialized', async () => {
    const xml = Buffer.from('<root id="r1">hello</root>');
    const pushed: Array<{ chunk: string; isFinal: boolean }> = [];

    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushChunk(chunk: Uint8Array, isFinal: boolean) {
            pushed.push({ chunk: Buffer.from(chunk).toString('utf8'), isFinal });
            if (isFinal) {
              return {
                buffer: chunk,
                table: simpleRuntimeBatches().nativeBatches[3]!.table,
              };
            }
            return {
              buffer: xml,
              table: encodeStructuralIndex(xml, [
                event(StreamEventType.START_DOCUMENT),
                event(StreamEventType.START_ELEMENT, span(xml, 'root'), none(), 0, 1),
                event(StreamEventType.CHARACTERS, none(), span(xml, 'hello')),
                event(StreamEventType.END_ELEMENT, span(xml, 'root')),
              ], [
                attr(span(xml, 'id'), span(xml, 'r1')),
              ]),
            };
          },
        }),
      }),
    });

    const reader = new EventReaderSync('<root id="r1">hello</root>');
    const firstBatch = reader.nextBatch();
    const secondBatch = reader.nextBatch();

    expect(firstBatch?.map(event => event.type)).toEqual([
      XmlEventType.START_DOCUMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.CHARACTERS,
      XmlEventType.END_ELEMENT,
    ]);
    expect(firstBatch?.[1]).toMatchObject({
      type: XmlEventType.START_ELEMENT,
      name: 'root',
      attributes: { id: 'r1' },
    });
    expect(secondBatch?.map(event => event.type)).toEqual([XmlEventType.END_DOCUMENT]);
    expect(reader.nextBatch()).toBeNull();
    expect(pushed.at(0)).toEqual({ chunk: '<root id="r1">hello</root>', isFinal: false });
  });

  it('returns null batches on the async adapter and respects maxChunkBytes splitting', async () => {
    const { first, second, third, nativeBatches } = simpleRuntimeBatches();
    const pushed: Array<{ chunk: Uint8Array; isFinal: boolean }> = [];
    let nativeIndex = 0;

    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushChunk(chunk: Uint8Array, isFinal: boolean) {
            pushed.push({ chunk, isFinal });
            if (isFinal) {
              return nativeBatches[3]!;
            }
            return nativeIndex++ === 0
              ? nativeBatches[0]!
              : {
                  buffer: chunk,
                  table: encodeStructuralIndex(chunk, [
                    event(StreamEventType.CHARACTERS, none(), span(chunk, 'hello')),
                    event(StreamEventType.END_ELEMENT, span(chunk, 'root')),
                  ], []),
                };
          },
        }),
      }),
    });

    const source = Buffer.concat([first, second, third]);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(source);
        controller.close();
      },
    });

    const reader = new EventReader(stream, { maxChunkBytes: first.byteLength });
    const seen = [];
    let batch = await reader.nextBatch();
    while (batch !== null) {
      seen.push(batch.map(event => event.type));
      batch = await reader.nextBatch();
    }

    expect(seen).toEqual([
      [XmlEventType.START_DOCUMENT, XmlEventType.START_ELEMENT],
      [XmlEventType.CHARACTERS, XmlEventType.END_ELEMENT],
      [XmlEventType.END_DOCUMENT],
    ]);
    expect(pushed.filter(entry => !entry.isFinal)).toHaveLength(2);
    expect(pushed.filter(entry => !entry.isFinal).every(entry => entry.chunk.buffer === source.buffer)).toBe(true);
  });

  it('does not fall back to JavaScript after runtime initialization without streaming support', async () => {
    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        parseStructuralIndexUint8Array: () => new Uint8Array(),
      }),
    });

    expect(() => new EventReaderSync('<root/>')).toThrow(/JavaScript fallback is only used before initStaxXml/i);
    expect(() => new EventReader(new ReadableStream())).toThrow(/JavaScript fallback is only used before initStaxXml/i);
  });
});
