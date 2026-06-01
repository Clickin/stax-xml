import {
  IterableEventBackendIterator,
  IterableEventMaterializer,
  STAX_XML_EVENT_BACKEND,
  type EntityDefinition,
} from './IterableEventBackend.js';
import { IterableReader, type ByteBatch } from './IterableReader.js';
import { XmlEventType, type AnyXmlEvent, type DocumentMode, type ParserEventFilter } from './types.js';

/**
 * Asynchronous event reader options.
 *
 * @public
 */
export interface EventReaderOptions {
  autoDecodeEntities?: boolean;
  addEntities?: EntityDefinition[];
  eventFilter?: ParserEventFilter;
  documentMode?: DocumentMode;
  namespaceAware?: boolean;
  maxChunkBytes?: number;
  batchSize?: number;
}

export interface EventReaderLike extends AsyncIterable<AnyXmlEvent>, AsyncIterator<AnyXmlEvent> {
  [STAX_XML_EVENT_BACKEND](): IterableEventBackendIterator;
  nextBatch(): Promise<AnyXmlEvent[] | null>;
  batchedIterator(): AsyncGenerator<AnyXmlEvent[]>;
  readonly XmlEventType: typeof XmlEventType;
}

const DEFAULT_READABLE_STREAM_BATCH_SIZE = 16;

/**
 * Event-object adapter over the batch-first async stream core.
 *
 * @public
 */
export class EventReader implements AsyncIterable<AnyXmlEvent>, AsyncIterator<AnyXmlEvent> {
  private readonly backend: EventReaderBackend;

  constructor(xmlStream: ReadableStream<Uint8Array>, options: EventReaderOptions = {}) {
    if (!(xmlStream instanceof ReadableStream)) {
      throw new Error('xmlStream must be a web standard ReadableStream');
    }

    const source = new ReadableStreamEventSource(xmlStream, {
        autoDecodeEntities: options.autoDecodeEntities ?? true,
        addEntities: options.addEntities,
        eventFilter: options.eventFilter,
        documentMode: options.documentMode,
        namespaceAware: options.namespaceAware ?? true,
        trimText: false,
        maxChunkBytes: options.maxChunkBytes,
        batchSize: options.batchSize,
      });

    this.backend = new EventReaderBackend(source);
  }

  [Symbol.asyncIterator](): AsyncIterator<AnyXmlEvent> {
    return this;
  }

  /** @internal */
  [STAX_XML_EVENT_BACKEND](): IterableEventBackendIterator {
    return this.backend as unknown as IterableEventBackendIterator;
  }

  next(): Promise<IteratorResult<AnyXmlEvent>> {
    return this.backend.next();
  }

  return(): Promise<IteratorResult<AnyXmlEvent>> {
    return this.backend.return();
  }

  nextBatch(): Promise<AnyXmlEvent[] | null> {
    return this.backend.nextBatch();
  }

  batchedIterator(): AsyncGenerator<AnyXmlEvent[]> {
    return this.backend.batchedIterator();
  }

  get XmlEventType(): typeof XmlEventType {
    return XmlEventType;
  }
}

export function createEventReader(
  xmlStream: ReadableStream<Uint8Array>,
  options: EventReaderOptions = {},
): EventReader {
  return new EventReader(xmlStream, options);
}

export function createEventReaderFromAsyncByteBatches(
  source: AsyncIterable<ByteBatch>,
  options: Omit<EventReaderOptions, 'maxChunkBytes' | 'batchSize'> = {},
): EventReaderLike {
  return new EventReaderBackendAdapter(new AsyncByteBatchEventSource(source, options));
}

class EventReaderBackendAdapter implements EventReaderLike {
  private readonly backend: EventReaderBackend;

  constructor(source: AsyncEventBatchSource) {
    this.backend = new EventReaderBackend(source);
  }

  [Symbol.asyncIterator](): AsyncIterator<AnyXmlEvent> {
    return this;
  }

  [STAX_XML_EVENT_BACKEND](): IterableEventBackendIterator {
    return this.backend as unknown as IterableEventBackendIterator;
  }

  next(): Promise<IteratorResult<AnyXmlEvent>> {
    return this.backend.next();
  }

  return(): Promise<IteratorResult<AnyXmlEvent>> {
    return this.backend.return();
  }

  nextBatch(): Promise<AnyXmlEvent[] | null> {
    return this.backend.nextBatch();
  }

  batchedIterator(): AsyncGenerator<AnyXmlEvent[]> {
    return this.backend.batchedIterator();
  }

  get XmlEventType(): typeof XmlEventType {
    return XmlEventType;
  }
}

class EventReaderBackend implements AsyncIterable<AnyXmlEvent>, AsyncIterator<AnyXmlEvent> {
  private bufferedEvents: AnyXmlEvent[] = [];
  private bufferedIndex = 0;
  private finished = false;
  private error: Error | undefined;

  constructor(private readonly source: AsyncEventBatchSource) {}

  [Symbol.asyncIterator](): AsyncIterator<AnyXmlEvent> {
    return this;
  }

  async next(): Promise<IteratorResult<AnyXmlEvent>> {
    if (this.error) {
      throw this.error;
    }
    if (this.finished) {
      return { value: undefined, done: true };
    }

    if (this.bufferedIndex >= this.bufferedEvents.length) {
      const batch = await this.loadNextBatch();
      if (batch === null) {
        this.finished = true;
        return { value: undefined, done: true };
      }
      this.bufferedEvents = batch;
      this.bufferedIndex = 0;
    }

    const value = this.bufferedEvents[this.bufferedIndex]!;
    this.bufferedIndex++;
    return { value, done: false };
  }

  async return(): Promise<IteratorResult<AnyXmlEvent>> {
    this.finished = true;
    this.bufferedEvents = [];
    this.bufferedIndex = 0;
    await this.source.return();
    return { value: undefined, done: true };
  }

  async nextBatch(): Promise<AnyXmlEvent[] | null> {
    if (this.error) {
      throw this.error;
    }
    if (this.finished) {
      return null;
    }
    if (this.bufferedIndex < this.bufferedEvents.length) {
      const remaining = this.bufferedEvents.slice(this.bufferedIndex);
      this.bufferedEvents = [];
      this.bufferedIndex = 0;
      return remaining;
    }
    const batch = await this.loadNextBatch();
    if (batch === null) {
      this.finished = true;
      return null;
    }
    return batch;
  }

  async *batchedIterator(): AsyncGenerator<AnyXmlEvent[]> {
    while (true) {
      const batch = await this.nextBatch();
      if (batch === null) {
        return;
      }
      yield batch;
    }
  }

  private async loadNextBatch(): Promise<AnyXmlEvent[] | null> {
    try {
      return await this.source.nextBatch();
    } catch (error) {
      this.error = error as Error;
      throw this.error;
    }
  }
}

interface AsyncEventBatchSource {
  nextBatch(): Promise<AnyXmlEvent[] | null>;
  return(): Promise<void>;
}

class ReadableStreamEventSource implements AsyncEventBatchSource {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly parser: IterableReader;
  private readonly materializer: IterableEventMaterializer;
  private readonly batchSize: number;
  private readonly maxChunkBytes: number | undefined;
  private pendingChunk: Uint8Array | undefined;
  private pendingOffset = 0;
  private sourceDone = false;
  private finished = false;
  private lockReleased = false;

  constructor(
    stream: ReadableStream<Uint8Array>,
    options: EventReaderOptions & { trimText?: boolean },
  ) {
    this.reader = stream.getReader();
    this.parser = new IterableReader([], {
      documentMode: options.documentMode,
    });
    this.materializer = new IterableEventMaterializer({
      autoDecodeEntities: options.autoDecodeEntities ?? true,
      addEntities: options.addEntities,
      eventFilter: options.eventFilter,
      namespaceAware: options.namespaceAware ?? true,
      trimText: options.trimText ?? false,
    });
    this.batchSize = normalizeReadableStreamBatchSize(options.batchSize);
    this.maxChunkBytes = options.maxChunkBytes && options.maxChunkBytes > 0
      ? options.maxChunkBytes
      : undefined;
  }

  async nextBatch(): Promise<AnyXmlEvent[] | null> {
    while (!this.finished) {
      const byteBatch = await this.readNextByteBatch();
      if (byteBatch.length > 0 && this.parser.pushByteBatch(byteBatch, false)) {
        const batch = this.materializer.materializeBatch(this.parser);
        if (batch.length > 0) {
          return batch;
        }
      }

      if (this.sourceDone) {
        this.finished = true;
        this.parser.pushByteBatch([], true);
        this.releaseLock();
        const finalBatch = this.materializer.materializeBatch(this.parser);
        return finalBatch.length > 0 ? finalBatch : null;
      }
    }
    return null;
  }

  async return(): Promise<void> {
    this.finished = true;
    this.releaseLock();
  }

  private async readNextByteBatch(): Promise<ByteBatch> {
    const byteBatch: Uint8Array[] = [];
    while (!this.sourceDone && byteBatch.length < this.batchSize) {
      const chunk = await this.readNextChunk();
      if (!chunk) {
        break;
      }
      byteBatch.push(chunk);
    }
    return byteBatch;
  }

  private async readNextChunk(): Promise<Uint8Array | undefined> {
    if (this.pendingChunk) {
      return this.readPendingChunkSegment();
    }

    let result: ReadableStreamReadResult<Uint8Array>;
    try {
      result = await this.reader.read();
    } catch (error) {
      this.finished = true;
      this.releaseLock();
      throw error;
    }

    if (result.done) {
      this.sourceDone = true;
      return undefined;
    }

    const chunk = result.value;
    if (!this.maxChunkBytes || chunk.byteLength <= this.maxChunkBytes) {
      return chunk;
    }

    this.pendingChunk = chunk;
    this.pendingOffset = 0;
    return this.readPendingChunkSegment();
  }

  private readPendingChunkSegment(): Uint8Array {
    const chunk = this.pendingChunk!;
    const nextOffset = Math.min(this.pendingOffset + this.maxChunkBytes!, chunk.byteLength);
    const segment = chunk.subarray(this.pendingOffset, nextOffset);
    this.pendingOffset = nextOffset;
    if (this.pendingOffset >= chunk.byteLength) {
      this.pendingChunk = undefined;
      this.pendingOffset = 0;
    }
    return segment;
  }

  private releaseLock(): void {
    if (this.lockReleased) {
      return;
    }
    this.lockReleased = true;
    this.reader.releaseLock();
  }
}

class AsyncByteBatchEventSource implements AsyncEventBatchSource {
  private readonly iterator: AsyncIterator<ByteBatch>;
  private readonly parser: IterableReader;
  private readonly materializer: IterableEventMaterializer;
  private finished = false;

  constructor(
    source: AsyncIterable<ByteBatch>,
    options: Omit<EventReaderOptions, 'maxChunkBytes' | 'batchSize'>,
  ) {
    this.iterator = source[Symbol.asyncIterator]();
    this.parser = new IterableReader([], {
      documentMode: options.documentMode,
    });
    this.materializer = new IterableEventMaterializer({
      autoDecodeEntities: options.autoDecodeEntities ?? true,
      addEntities: options.addEntities,
      eventFilter: options.eventFilter,
      namespaceAware: options.namespaceAware ?? true,
      trimText: false,
    });
  }

  async nextBatch(): Promise<AnyXmlEvent[] | null> {
    while (!this.finished) {
      const next = await this.iterator.next();
      if (next.done) {
        this.finished = true;
        this.parser.pushByteBatch([], true);
        const finalBatch = this.materializer.materializeBatch(this.parser);
        return finalBatch.length > 0 ? finalBatch : null;
      }

      if (!this.parser.pushByteBatch(next.value, false)) {
        continue;
      }
      const batch = this.materializer.materializeBatch(this.parser);
      if (batch.length > 0) {
        return batch;
      }
    }
    return null;
  }

  async return(): Promise<void> {
    this.finished = true;
    if (typeof this.iterator.return === 'function') {
      await this.iterator.return();
    }
  }
}

function normalizeReadableStreamBatchSize(value: number | undefined): number {
  const batchSize = value ?? DEFAULT_READABLE_STREAM_BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new RangeError('batchSize must be a positive integer.');
  }
  return batchSize;
}

export default EventReader;
