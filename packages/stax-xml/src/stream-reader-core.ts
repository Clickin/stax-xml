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

  constructor(
    private readonly source: TableBackedEventSource,
    private readonly generation: number,
    private readonly generations: GenerationSource,
  ) {}

  get eventCount(): number {
    this.assertActive();
    return this.source.eventCount();
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
    for (let index = 0; index < this.eventCount; index++) {
      yield this.event(index);
    }
  }

  assertActive(): void {
    if (this.generations.currentGeneration() !== this.generation) {
      throw new Error(INACTIVE_BATCH_MESSAGE);
    }
  }

  private assertEventIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.source.eventCount()) {
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
