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

  it('keeps the sync event reader on the string-parser mainline even when a native runtime is initialized', async () => {
    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushChunk() {
            throw new Error('sync EventReaderSync should stay on the string parser mainline');
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
  });

  it('keeps the lean namespace-unaware sync event reader on the string-parser mainline', async () => {
    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushChunk() {
            throw new Error('namespace-unaware EventReaderSync should stay on the string parser mainline');
          },
        }),
      }),
    });

    const reader = new EventReaderSync('<root id="r1">hello</root>', { namespaceAware: false });
    const firstBatch = reader.nextBatch();
    const secondBatch = reader.nextBatch();

    expect(firstBatch?.map(event => event.type)).toEqual([
      XmlEventType.START_DOCUMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.CHARACTERS,
      XmlEventType.END_ELEMENT,
    ]);
    expect(firstBatch?.[1]).toEqual({
      type: XmlEventType.START_ELEMENT,
      name: 'root',
      attributes: { id: 'r1' },
    });
    expect(firstBatch?.[2]).toMatchObject({
      type: XmlEventType.CHARACTERS,
      value: 'hello',
    });
    expect(firstBatch?.[3]).toEqual({
      type: XmlEventType.END_ELEMENT,
      name: 'root',
    });
    expect(secondBatch?.map(event => event.type)).toEqual([XmlEventType.END_DOCUMENT]);
    expect(reader.nextBatch()).toBeNull();
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

  it('continues to operate through the JavaScript path when no streaming backend is available', async () => {
    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        parseStructuralIndexUint8Array: () => new Uint8Array(),
      }),
    });

    expect(() => new EventReaderSync('<root/>')).not.toThrow();
    expect(() => new EventReader(new ReadableStream())).not.toThrow();
  });
});
