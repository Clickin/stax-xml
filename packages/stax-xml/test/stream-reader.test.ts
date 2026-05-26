import { describe, expect, it, vi } from 'vitest';
import { IterableReader } from '../src/IterableReader';
import { StreamReader } from '../src/StreamReader';
import { StreamEventType } from '../src/stream-reader-core';

function chunkedReadableStream(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index++]));
    },
  });
}

function asyncByteBatches(chunks: readonly (readonly string[])[]): AsyncIterable<readonly Uint8Array[]> {
  const encoder = new TextEncoder();
  return {
    async *[Symbol.asyncIterator]() {
      for (const batch of chunks) {
        yield batch.map(chunk => encoder.encode(chunk));
      }
    },
  };
}

describe('StreamReader', () => {
  it('groups ReadableStream chunks into bounded parser byte batches', async () => {
    const pushedBatchLengths: number[] = [];
    const originalPushByteBatch = IterableReader.prototype.pushByteBatch;
    const pushSpy = vi.spyOn(IterableReader.prototype, 'pushByteBatch')
      .mockImplementation(function countedPushByteBatch(batch, isFinal) {
        pushedBatchLengths.push(batch.length);
        return originalPushByteBatch.call(this, batch, isFinal);
      });

    try {
      const reader = new StreamReader(chunkedReadableStream([
        '<ro',
        'ot>',
        '<it',
        'em',
        '/>',
        '</',
        'ro',
        'ot>',
      ]), { batchSize: 3 });

      const names: string[] = [];
      for await (const batch of reader) {
        for (let index = 0; index < batch.eventCount; index++) {
          if (batch.typeAt(index) === StreamEventType.START_ELEMENT) {
            names.push(batch.nameAt(index)!);
          }
        }
      }

      expect(names).toEqual(['root', 'item']);
      expect(pushedBatchLengths).toContain(3);
      expect(Math.max(...pushedBatchLengths)).toBeLessThanOrEqual(3);
      expect(pushedBatchLengths.at(-1)).toBe(0);
    } finally {
      pushSpy.mockRestore();
    }
  });

  it('consumes async Iterable<Uint8Array[]> batches without pre-reading the source', async () => {
    const yieldedBatchIndexes: number[] = [];
    const encoder = new TextEncoder();
    const source = {
      async *[Symbol.asyncIterator]() {
        for (const [index, batch] of [
          ['<ro', 'ot>'],
          ['<item/>'],
          ['</root>'],
        ].entries()) {
          yieldedBatchIndexes.push(index);
          yield batch.map(chunk => encoder.encode(chunk));
        }
      },
    } satisfies AsyncIterable<readonly Uint8Array[]>;

    const reader = new StreamReader(source);
    const firstBatch = await reader.nextBatch();
    expect(firstBatch).not.toBeNull();
    expect(yieldedBatchIndexes.length).toBe(1);

    const names: string[] = [];
    if (firstBatch) {
      collectStartNames(firstBatch, names);
    }
    for await (const batch of reader) {
      collectStartNames(batch, names);
    }

    expect(names).toEqual(['root', 'item']);
    expect(yieldedBatchIndexes).toEqual([0, 1, 2]);
  });

  it('returns async byte-batch sources when iteration stops early', async () => {
    let returned = false;
    const source = asyncByteBatches([
      ['<root>'],
      ['<item/>'],
      ['</root>'],
    ])[Symbol.asyncIterator]();
    const reader = new StreamReader({
      [Symbol.asyncIterator]() {
        return {
          next: () => source.next(),
          return: async () => {
            returned = true;
            return typeof source.return === 'function'
              ? source.return()
              : { value: undefined, done: true };
          },
        };
      },
    });

    for await (const batch of reader) {
      expect(batch.eventCount).toBeGreaterThan(0);
      break;
    }

    expect(returned).toBe(true);
  });

  it('rejects invalid byte batch sizes', () => {
    expect(() => new StreamReader(chunkedReadableStream(['<root/>']), { batchSize: 0 }))
      .toThrow('batchSize must be a positive integer.');
    expect(() => new StreamReader(chunkedReadableStream(['<root/>']), { batchSize: 1.5 }))
      .toThrow('batchSize must be a positive integer.');
  });
});

function collectStartNames(batch: { eventCount: number; typeAt(index: number): StreamEventType; nameAt(index: number): string | undefined }, names: string[]): void {
  for (let index = 0; index < batch.eventCount; index++) {
    if (batch.typeAt(index) === StreamEventType.START_ELEMENT) {
      names.push(batch.nameAt(index)!);
    }
  }
}
