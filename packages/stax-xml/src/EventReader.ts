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

    const source = new IterableBackendEventBatchSource(
      new IterableEventBackendIterator(xmlStream, {
        autoDecodeEntities: options.autoDecodeEntities ?? true,
        addEntities: options.addEntities,
        eventFilter: options.eventFilter,
        documentMode: options.documentMode,
        namespaceAware: options.namespaceAware ?? true,
        trimText: false,
        maxChunkBytes: options.maxChunkBytes,
        batchSize: options.batchSize,
      }),
    );

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

class IterableBackendEventBatchSource implements AsyncEventBatchSource {
  constructor(private readonly iterator: IterableEventBackendIterator) {}

  async nextBatch(): Promise<AnyXmlEvent[] | null> {
    const batch = await this.iterator.nextBatch();
    return batch.length > 0 ? batch : null;
  }

  async return(): Promise<void> {
    await this.iterator.return();
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

export default EventReader;
