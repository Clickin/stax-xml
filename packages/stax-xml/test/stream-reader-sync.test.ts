import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  initStaxXml,
  StreamEventType,
  StreamReaderSync,
} from '../src/index.js';
import { resetStaxXmlRuntimeForTests } from '../src/runtime/index.js';
import {
  attr,
  buffer,
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

describe('StreamReaderSync batch core', () => {
  it('reads byte input as batch-only core views', async () => {
    const { first, second, third, nativeBatches } = simpleRuntimeBatches();
    const pushed: Array<{ chunk: string; isFinal: boolean }> = [];
    let batchIndex = 0;

    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushChunk(chunk: Uint8Array, isFinal: boolean) {
            pushed.push({ chunk: Buffer.from(chunk).toString('utf8'), isFinal });
            return nativeBatches[batchIndex++]!;
          },
        }),
      }),
    });

    const reader = new StreamReaderSync([[first], [second, third]]);

    const firstBatch = reader.nextBatch();
    expect(firstBatch?.eventCount).toBe(2);
    expect(firstBatch?.typeAt(0)).toBe(StreamEventType.START_DOCUMENT);
    expect(firstBatch?.typeAt(1)).toBe(StreamEventType.START_ELEMENT);
    expect(firstBatch?.nameAt(1)).toBe('root');
    expect(firstBatch?.attributeCountAt(1)).toBe(1);
    expect(firstBatch?.attributeNameAt(1, 0)).toBe('id');
    expect(firstBatch?.attributeValueAt(1, 0)).toBe('r1');
    expect(firstBatch?.attributeValueAt(1, 'id')).toBe('r1');
    expect(firstBatch?.attributeValueAt(1, 'missing')).toBeUndefined();

    const start = firstBatch?.event(1);
    expect(start).toBe(firstBatch?.event(1));
    expect(start?.type).toBe(StreamEventType.START_ELEMENT);
    expect(start?.name()).toBe('root');
    expect(start?.getAttributeCount()).toBe(1);
    expect(start?.getAttributeName(0)).toBe('id');
    expect(start?.getAttributeValue(0)).toBe('r1');
    expect(start?.getAttributeValue('id')).toBe('r1');

    const secondBatch = reader.nextBatch();
    expect(secondBatch?.eventCount).toBe(1);
    expect(secondBatch?.textAt(0)).toBe('hello');
    expect(secondBatch?.event(0).text()).toBe('hello');

    const thirdBatch = reader.nextBatch();
    expect(thirdBatch?.eventCount).toBe(1);
    expect(thirdBatch?.nameAt(0)).toBe('root');

    const fourthBatch = reader.nextBatch();
    expect(fourthBatch?.eventCount).toBe(1);
    expect(fourthBatch?.typeAt(0)).toBe(StreamEventType.END_DOCUMENT);

    expect(reader.nextBatch()).toBeNull();
    expect(reader.nextBatch()).toBeNull();

    expect(pushed).toEqual([
      { chunk: '<root id="r1">', isFinal: false },
      { chunk: 'hello', isFinal: false },
      { chunk: '</root>', isFinal: false },
      { chunk: '', isFinal: true },
    ]);
  });

  it('invalidates previous batch and event views after advancing', async () => {
    const { first, second, third, nativeBatches } = simpleRuntimeBatches();
    let batchIndex = 0;

    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushChunk() {
            return nativeBatches[batchIndex++]!;
          },
        }),
      }),
    });

    const reader = new StreamReaderSync([[first], [second], [third]]);
    const batch = reader.nextBatch()!;
    const event = batch.event(1);

    expect(event.name()).toBe('root');
    expect(reader.nextBatch()?.textAt(0)).toBe('hello');

    expect(() => batch.eventCount).toThrow(/inactive batch/i);
    expect(() => batch.nameAt(1)).toThrow(/inactive batch/i);
    expect(() => event.name()).toThrow(/inactive batch/i);
  });

  it('exposes raw word-table batches for wrapper-overhead benchmarks', async () => {
    const { first, second, third, nativeBatches } = simpleRuntimeBatches();
    let batchIndex = 0;

    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushChunk() {
            return nativeBatches[batchIndex++]!;
          },
        }),
      }),
    });

    const reader = new StreamReaderSync([[first], [second], [third]]);
    const raw = reader.nextRawBatch();
    expect(raw?.kind).toBe('word-table');
    if (!raw || raw.kind !== 'word-table') {
      throw new Error('expected aligned raw word-table batch');
    }

    expect(raw.eventCount).toBe(2);
    const eventBase = raw.eventWordOffset + raw.eventStrideWords;
    expect(raw.eventWords[eventBase]).toBe(StreamEventType.START_ELEMENT);
    expect(raw.eventWords[eventBase + 6]).toBe(1);

    const attrBase = raw.attrWordOffset + raw.eventWords[eventBase + 5]! * raw.attrStrideWords;
    const nameStart = raw.spanWords[eventBase + 1]!;
    const nameEnd = raw.spanWords[eventBase + 2]!;
    const attrValueStart = raw.spanWords[attrBase + 2]!;
    const attrValueEnd = raw.spanWords[attrBase + 3]!;
    expect(Buffer.from(raw.buffer.subarray(nameStart, nameEnd)).toString('utf8')).toBe('root');
    expect(Buffer.from(raw.buffer.subarray(attrValueStart, attrValueEnd)).toString('utf8')).toBe('r1');

    expect(reader.nextRawBatch()?.kind).toBe('word-table');
  });

  it('reads pushBatch results and falls back for unaligned table views', async () => {
    const input = buffer('<root id="r1">hello</root>');
    const table = encodeStructuralIndex(input, [
      event(StreamEventType.START_DOCUMENT),
      event(StreamEventType.START_ELEMENT, span(input, 'root'), none(), 0, 1),
      event(StreamEventType.CHARACTERS, none(), span(input, 'hello')),
      event(StreamEventType.END_ELEMENT, span(input, 'root')),
      event(StreamEventType.END_DOCUMENT),
    ], [
      attr(span(input, 'id'), span(input, 'r1')),
    ], { includeValueIds: true });
    const unaligned = new Uint8Array(table.byteLength + 1);
    unaligned.set(table, 1);
    const unalignedTable = new DataView(unaligned.buffer, 1, table.byteLength);
    const pushed: Array<{ count: number; isFinal: boolean }> = [];

    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushBatch(chunks: readonly Uint8Array[], isFinal: boolean) {
            pushed.push({ count: chunks.length, isFinal });
            return { buffer: input, table: isFinal ? unalignedTable : encodeStructuralIndex(input, [], []) };
          },
          pushChunk() {
            throw new Error('pushChunk should not be used when pushBatch is present');
          },
        }),
      }),
    });

    const reader = new StreamReaderSync([[input]]);

    const batch = reader.nextBatch();
    expect(batch?.eventCount).toBe(5);
    expect(batch?.nameAt(1)).toBe('root');
    expect(batch?.textAt(2)).toBe('hello');
    expect(batch?.attributeValueAt(1, 'id')).toBe('r1');
    expect(batch?.attributeValueAt(1, 'id')).toBe('r1');
    expect(reader.nextBatch()).toBeNull();
    expect(pushed).toEqual([
      { count: 1, isFinal: false },
      { count: 0, isFinal: true },
    ]);
  });

  it('falls back to frame raw batches for unaligned table views', async () => {
    const input = buffer('<root id="r1">hello</root>');
    const table = encodeStructuralIndex(input, [
      event(StreamEventType.START_DOCUMENT),
      event(StreamEventType.START_ELEMENT, span(input, 'root'), none(), 0, 1),
      event(StreamEventType.END_DOCUMENT),
    ], [
      attr(span(input, 'id'), span(input, 'r1')),
    ]);
    const unaligned = new Uint8Array(table.byteLength + 1);
    unaligned.set(table, 1);
    const unalignedTable = new DataView(unaligned.buffer, 1, table.byteLength);

    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushBatch(_chunks: readonly Uint8Array[], isFinal: boolean) {
            return { buffer: input, table: isFinal ? encodeStructuralIndex(input, [], []) : unalignedTable };
          },
          pushChunk() {
            throw new Error('pushChunk should not be used when pushBatch is present');
          },
        }),
      }),
    });

    const raw = new StreamReaderSync([[input]]).nextRawBatch();
    expect(raw?.kind).toBe('frame');
    if (!raw || raw.kind !== 'frame') {
      throw new Error('expected unaligned raw frame fallback');
    }
    expect(raw.eventCount).toBe(3);
    expect(raw.eventTypes[1]).toBe(StreamEventType.START_ELEMENT);
    expect(raw.attrCounts[1]).toBe(1);
    expect(Buffer.from(raw.buffer.subarray(raw.nameStarts[1]!, raw.nameEnds[1]!)).toString('utf8')).toBe('root');
  });

  it('iterates batches directly from the reader iterator', async () => {
    const { first, second, third, nativeBatches } = simpleRuntimeBatches();
    let batchIndex = 0;

    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushChunk() {
            return nativeBatches[batchIndex++]!;
          },
        }),
      }),
    });

    const reader = new StreamReaderSync([[first], [second], [third]]);
    const seen: Array<Array<string | number>> = [];

    for (const batch of reader) {
      const values: Array<string | number> = [];
      for (const event of batch) {
        values.push(event.name() ?? event.text() ?? event.type);
      }
      seen.push(values);
    }

    expect(seen).toEqual([
      [StreamEventType.START_DOCUMENT, 'root'],
      ['hello'],
      ['root'],
      [StreamEventType.END_DOCUMENT],
    ]);
  });

  it('requires an initialized native or wasm streaming runtime', () => {
    expect(() => new StreamReaderSync([])).toThrow(
      /StreamReaderSync requires an initialized native or wasm streaming event batch backend/i,
    );
  });
});
