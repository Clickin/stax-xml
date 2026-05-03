import type { TableBackedEventSource } from './runtime/event-table.js';

/**
 * Event type constants exposed by stream readers.
 *
 * @public
 */
export const StreamEventType = {
  START_DOCUMENT: 0,
  END_DOCUMENT: 1,
  START_ELEMENT: 2,
  END_ELEMENT: 3,
  CHARACTERS: 4,
  CDATA: 5,
} as const;

/**
 * Numeric XML stream event type.
 *
 * @public
 */
export type StreamEventType = typeof StreamEventType[keyof typeof StreamEventType];

/**
 * One synchronous byte batch consumed by {@link StreamReaderSync}.
 *
 * @public
 */
export type StreamReaderSyncByteBatch = readonly Uint8Array[];

/**
 * Batch-local event view.
 *
 * @public
 */
export interface StreamEventView {
  readonly type: StreamEventType;
  name(): string | undefined;
  text(): string | undefined;
  getAttributeCount(): number;
  getAttributeName(index: number): string | undefined;
  getAttributeValue(indexOrName: number | string): string | undefined;
}

/**
 * Batch view exposed by stream readers.
 *
 * @public
 */
export interface StreamBatch extends Iterable<StreamEventView> {
  readonly eventCount: number;
  event(index: number): StreamEventView;
  typeAt(index: number): StreamEventType;
  nameAt(index: number): string | undefined;
  textAt(index: number): string | undefined;
  attributeCountAt(index: number): number;
  attributeNameAt(eventIndex: number, attrIndex: number): string | undefined;
  attributeValueAt(eventIndex: number, attrIndexOrName: number | string): string | undefined;
}

/**
 * Experimental low-level word-table view over a synchronous stream batch.
 *
 * The fields expose the native structural table layout directly. They are
 * intended for benchmark and scanner-style traversal paths that need to avoid
 * per-event wrapper allocation.
 *
 * @experimental
 */
export interface StreamReaderSyncWordTableBatch {
  readonly kind: 'word-table';
  readonly eventCount: number;
  readonly attrCount: number;
  readonly buffer: Uint8Array;
  readonly eventWords: Uint32Array;
  readonly spanWords: Int32Array;
  readonly eventWordOffset: number;
  readonly eventStrideWords: 7;
  readonly attrWordOffset: number;
  readonly attrStrideWords: 4;
}

/**
 * Experimental SoA fallback view for synchronous stream batches whose native
 * table cannot be exposed as aligned word arrays.
 *
 * @experimental
 */
export interface StreamReaderSyncFrameBatch {
  readonly kind: 'frame';
  readonly eventCount: number;
  readonly attrCount: number;
  readonly buffer: Uint8Array;
  readonly eventTypes: Uint8Array;
  readonly nameStarts: Int32Array;
  readonly nameEnds: Int32Array;
  readonly nameIds: Int32Array;
  readonly textStarts: Int32Array;
  readonly textEnds: Int32Array;
  readonly attrStarts: Int32Array;
  readonly attrCounts: Int32Array;
  readonly attrNameStarts: Int32Array;
  readonly attrNameEnds: Int32Array;
  readonly attrNameIds: Int32Array;
  readonly attrValueStarts: Int32Array;
  readonly attrValueEnds: Int32Array;
}

/**
 * Experimental direct SoA view with a batch-local UTF-16 string arena.
 *
 * Arena offsets are JavaScript UTF-16 code-unit offsets, suitable for
 * `stringArena.slice(start, end)`. A `-1` arena offset means consumers should
 * fall back to the corresponding byte span in `buffer`.
 *
 * @experimental
 */
export interface StreamReaderSyncSoaStringArenaBatch {
  readonly kind: 'soa-string-arena';
  readonly eventCount: number;
  readonly attrCount: number;
  readonly buffer: Uint8Array;
  readonly stringArena: string;
  readonly eventTypes: Uint32Array;
  readonly nameStarts: Int32Array;
  readonly nameEnds: Int32Array;
  readonly textStarts: Int32Array;
  readonly textEnds: Int32Array;
  readonly attrStarts: Uint32Array;
  readonly attrCounts: Uint32Array;
  readonly eventNameIds: Uint32Array;
  readonly eventTextValueIds: Uint32Array;
  readonly eventNameArenaStarts: Int32Array;
  readonly eventNameArenaEnds: Int32Array;
  readonly eventTextArenaStarts: Int32Array;
  readonly eventTextArenaEnds: Int32Array;
  readonly attrNameStarts: Int32Array;
  readonly attrNameEnds: Int32Array;
  readonly attrValueStarts: Int32Array;
  readonly attrValueEnds: Int32Array;
  readonly attrNameIds: Uint32Array;
  readonly attrValueIds: Uint32Array;
  readonly attrNameArenaStarts: Int32Array;
  readonly attrNameArenaEnds: Int32Array;
  readonly attrValueArenaStarts: Int32Array;
  readonly attrValueArenaEnds: Int32Array;
}

/**
 * Experimental raw batch traversal view returned by
 * {@link StreamReaderSync.nextRawBatch}.
 *
 * @experimental
 */
export type StreamReaderSyncRawBatch =
  | StreamReaderSyncWordTableBatch
  | StreamReaderSyncFrameBatch
  | StreamReaderSyncSoaStringArenaBatch;

type GenerationSource = {
  currentGeneration(): number;
};

export function createStreamBatchView(
  source: TableBackedEventSource,
  generation: number,
  generations: GenerationSource,
): StreamBatch {
  return new StreamBatchView(source, generation, generations);
}

class StreamBatchView implements StreamBatch {
  private readonly events: Array<StreamEventView | undefined> = [];
  private readonly eventCountValue: number;

  constructor(
    private readonly source: TableBackedEventSource,
    private readonly generation: number,
    private readonly generations: GenerationSource,
  ) {
    this.eventCountValue = source.eventCount();
  }

  get eventCount(): number {
    this.assertActive();
    return this.eventCountValue;
  }

  event(index: number): StreamEventView {
    this.assertActive();
    this.assertEventIndex(index);
    const cached = this.events[index];
    if (cached) {
      return cached;
    }
    const view = new StreamEventViewImpl(this, index);
    this.events[index] = view;
    return view;
  }

  typeAt(index: number): StreamEventType {
    this.assertActive();
    this.assertEventIndex(index);
    return this.source.eventType(index) as StreamEventType;
  }

  nameAt(index: number): string | undefined {
    this.assertActive();
    this.assertEventIndex(index);
    return this.source.copyName(index);
  }

  textAt(index: number): string | undefined {
    this.assertActive();
    this.assertEventIndex(index);
    return this.source.copyText(index);
  }

  attributeCountAt(eventIndex: number): number {
    this.assertActive();
    this.assertEventIndex(eventIndex);
    return this.source.attrCount(eventIndex);
  }

  attributeNameAt(eventIndex: number, attrIndex: number): string | undefined {
    this.assertActive();
    this.assertEventIndex(eventIndex);
    return this.source.copyAttrName(eventIndex, attrIndex);
  }

  attributeValueAt(eventIndex: number, attrIndexOrName: number | string): string | undefined {
    this.assertActive();
    this.assertEventIndex(eventIndex);
    if (typeof attrIndexOrName === 'string') {
      return this.source.copyAttrValueByName(eventIndex, attrIndexOrName);
    }
    return this.source.copyAttrValue(eventIndex, attrIndexOrName);
  }

  *[Symbol.iterator](): IterableIterator<StreamEventView> {
    this.assertActive();
    for (let index = 0; index < this.eventCountValue; index++) {
      yield this.event(index);
    }
  }

  assertActive(): void {
    if (this.generations.currentGeneration() !== this.generation) {
      throw new Error(INACTIVE_BATCH_MESSAGE);
    }
  }

  private assertEventIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.eventCountValue) {
      throw new RangeError(`event index out of range: ${index}`);
    }
  }
}

class StreamEventViewImpl implements StreamEventView {
  constructor(
    private readonly batch: StreamBatchView,
    private readonly index: number,
  ) {}

  get type(): StreamEventType {
    return this.batch.typeAt(this.index);
  }

  name(): string | undefined {
    return this.batch.nameAt(this.index);
  }

  text(): string | undefined {
    return this.batch.textAt(this.index);
  }

  getAttributeCount(): number {
    return this.batch.attributeCountAt(this.index);
  }

  getAttributeName(index: number): string | undefined {
    return this.batch.attributeNameAt(this.index, index);
  }

  getAttributeValue(indexOrName: number | string): string | undefined {
    return this.batch.attributeValueAt(this.index, indexOrName);
  }
}

export const INACTIVE_BATCH_MESSAGE =
  'Cannot access an inactive batch view after advancing the stream reader.';
