import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  initStaxXml,
  StreamEventType,
  StreamReader,
} from '../src/index.js';
import { resetStaxXmlRuntimeForTests } from '../src/runtime/index.js';
import { simpleRuntimeBatches } from './test-support/streaming-runtime-fixture.js';

afterEach(() => {
  vi.restoreAllMocks();
  resetStaxXmlRuntimeForTests();
});

describe('StreamReader async batch core', () => {
  it('reads one source chunk per requested batch and flushes EOF once', async () => {
    const { first, second, third, nativeBatches } = simpleRuntimeBatches();
    const pushed: Array<{ chunk: string; isFinal: boolean }> = [];
    let nativeIndex = 0;

    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushChunk(chunk: Uint8Array, isFinal: boolean) {
            pushed.push({ chunk: Buffer.from(chunk).toString('utf8'), isFinal });
            return nativeBatches[nativeIndex++]!;
          },
        }),
      }),
    });

    const { stream, readerHandle } = createStubReadableStream([
      { done: false, value: first },
      { done: false, value: second },
      { done: false, value: third },
      { done: true, value: undefined },
    ]);

    const reader = new StreamReader(stream);

    const batch1 = await reader.nextBatch();
    expect(batch1?.eventCount).toBe(2);
    expect(readerHandle.read).toHaveBeenCalledTimes(1);

    const batch2 = await reader.nextBatch();
    expect(batch2?.textAt(0)).toBe('hello');
    expect(readerHandle.read).toHaveBeenCalledTimes(2);

    const batch3 = await reader.nextBatch();
    expect(batch3?.nameAt(0)).toBe('root');
    expect(readerHandle.read).toHaveBeenCalledTimes(3);

    const batch4 = await reader.nextBatch();
    expect(batch4?.typeAt(0)).toBe(StreamEventType.END_DOCUMENT);
    expect(readerHandle.read).toHaveBeenCalledTimes(4);
    expect(readerHandle.releaseLock).toHaveBeenCalledTimes(1);

    expect(await reader.nextBatch()).toBeNull();
    expect(await reader.nextBatch()).toBeNull();

    expect(pushed).toEqual([
      { chunk: '<root id="r1">', isFinal: false },
      { chunk: 'hello', isFinal: false },
      { chunk: '</root>', isFinal: false },
      { chunk: '', isFinal: true },
    ]);
  });

  it('cancels the stream reader without final flush on return()', async () => {
    const { first, nativeBatches } = simpleRuntimeBatches();
    const pushed: Array<{ chunk: string; isFinal: boolean }> = [];
    let nativeIndex = 0;

    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushChunk(chunk: Uint8Array, isFinal: boolean) {
            pushed.push({ chunk: Buffer.from(chunk).toString('utf8'), isFinal });
            return nativeBatches[nativeIndex++]!;
          },
        }),
      }),
    });

    const { stream, readerHandle } = createStubReadableStream([
      { done: false, value: first },
      { done: false, value: first },
    ]);
    const reader = new StreamReader(stream);

    expect((await reader.nextBatch())?.eventCount).toBe(2);
    await reader.return();

    expect(readerHandle.cancel).toHaveBeenCalledTimes(1);
    expect(readerHandle.releaseLock).toHaveBeenCalledTimes(1);
    expect(await reader.nextBatch()).toBeNull();
    expect(pushed).toEqual([
      { chunk: '<root id="r1">', isFinal: false },
    ]);
  });

  it('rejects concurrent nextBatch calls', async () => {
    const { first, nativeBatches } = simpleRuntimeBatches();
    let nativeIndex = 0;
    let resolveRead!: (value: { done: false; value: Uint8Array }) => void;

    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushChunk() {
            return nativeBatches[nativeIndex++]!;
          },
        }),
      }),
    });

    const readerHandle = {
      read: vi.fn(() => new Promise<{ done: false; value: Uint8Array }>((resolve) => {
        resolveRead = resolve;
      })),
      cancel: vi.fn(async () => undefined),
      releaseLock: vi.fn(() => undefined),
    };
    const stream = new ReadableStream<Uint8Array>();
    Object.defineProperty(stream, 'getReader', {
      value: () => readerHandle,
    });

    const reader = new StreamReader(stream);
    const firstCall = reader.nextBatch();
    const secondCall = reader.nextBatch();

    await expect(secondCall).rejects.toThrow(/concurrent nextBatch/i);

    resolveRead({ done: false, value: first });
    expect((await firstCall)?.eventCount).toBe(2);
  });
});

function createStubReadableStream(
  reads: Array<{ done: boolean; value: Uint8Array | undefined }>,
): {
  stream: ReadableStream<Uint8Array>;
  readerHandle: {
    read: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    releaseLock: ReturnType<typeof vi.fn>;
  };
} {
  let readIndex = 0;
  const readerHandle = {
    read: vi.fn(async () => reads[readIndex++] ?? { done: true, value: undefined }),
    cancel: vi.fn(async () => undefined),
    releaseLock: vi.fn(() => undefined),
  };
  const stream = new ReadableStream<Uint8Array>();
  Object.defineProperty(stream, 'getReader', {
    value: () => readerHandle,
  });
  return { stream, readerHandle };
}
