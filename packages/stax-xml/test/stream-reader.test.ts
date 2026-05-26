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

  it('rejects invalid byte batch sizes', () => {
    expect(() => new StreamReader(chunkedReadableStream(['<root/>']), { batchSize: 0 }))
      .toThrow('batchSize must be a positive integer.');
    expect(() => new StreamReader(chunkedReadableStream(['<root/>']), { batchSize: 1.5 }))
      .toThrow('batchSize must be a positive integer.');
  });
});
