import {
  IterableEventMaterializer,
  STAX_XML_EVENT_BACKEND,
  type EntityDefinition,
  type IterableEventBackendIterator,
  type MaterializableEventSource,
} from './IterableEventBackend.js';
import { createJavaScriptIterableReader } from './IterableReader.js';
import { getInitializedStaxXmlRuntime } from './runtime/index.js';
import { StreamReader, type StreamBatch } from './StreamReader.js';
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

    const stream = maybeSplitReadableStream(xmlStream, options.maxChunkBytes);
    const materializer = new IterableEventMaterializer({
      autoDecodeEntities: options.autoDecodeEntities ?? true,
      addEntities: options.addEntities,
      eventFilter: options.eventFilter,
      namespaceAware: options.namespaceAware ?? true,
      trimText: false,
    });
    const runtime = getInitializedStaxXmlRuntime();
    const source = !runtime
      ? new JavaScriptAsyncEventBatchSource(stream, options.documentMode, materializer)
      : runtime.capabilities.streamingEventBatches
        ? new CoreAsyncEventBatchSource(
            new StreamReader(stream, { documentMode: options.documentMode }),
            materializer,
          )
        : unsupportedInitializedRuntime();

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

class CoreAsyncEventBatchSource implements AsyncEventBatchSource {
  constructor(
    private readonly reader: StreamReader,
    private readonly materializer: IterableEventMaterializer,
  ) {}

  async nextBatch(): Promise<AnyXmlEvent[] | null> {
    while (true) {
      const batch = await this.reader.nextBatch();
      if (batch === null) {
        return null;
      }
      const events = this.materializer.materializeBatch(toMaterializableEventSource(batch));
      if (events.length > 0) {
        return events;
      }
    }
  }

  async return(): Promise<void> {
    await this.reader.return();
  }
}

class JavaScriptAsyncEventBatchSource implements AsyncEventBatchSource {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly parser: ReturnType<typeof createJavaScriptIterableReader>;
  private released = false;
  private sourceDone = false;
  private finished = false;

  constructor(
    stream: ReadableStream<Uint8Array>,
    documentMode: DocumentMode | undefined,
    private readonly materializer: IterableEventMaterializer,
  ) {
    this.reader = stream.getReader();
    this.parser = createJavaScriptIterableReader([], { documentMode });
  }

  async nextBatch(): Promise<AnyXmlEvent[] | null> {
    if (this.finished) {
      return null;
    }

    while (!this.sourceDone) {
      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await this.reader.read();
      } catch (error) {
        this.finished = true;
        this.releaseLock();
        throw error;
      }

      if (readResult.done) {
        this.sourceDone = true;
        this.releaseLock();
        this.parser.pushByteBatch([], true);
        return this.finalizeCurrentBatch();
      }

      if (!this.parser.pushByteBatch([readResult.value], false)) {
        continue;
      }

      const events = this.materializer.materializeBatch(this.parser);
      if (events.length > 0) {
        return events;
      }
    }

    this.finished = true;
    return null;
  }

  async return(): Promise<void> {
    this.finished = true;
    try {
      await this.reader.cancel('EventReader.return()');
    } finally {
      this.releaseLock();
    }
  }

  private finalizeCurrentBatch(): AnyXmlEvent[] | null {
    const finalEvents = this.materializer.materializeBatch(this.parser);
    if (finalEvents.length > 0) {
      return finalEvents;
    }
    this.finished = true;
    return null;
  }

  private releaseLock(): void {
    if (this.released) {
      return;
    }
    this.released = true;
    this.reader.releaseLock();
  }
}

function toMaterializableEventSource(batch: StreamBatch): MaterializableEventSource {
  return {
    eventCount: () => batch.eventCount,
    attrCount: (eventIndex: number) => batch.attributeCountAt(eventIndex),
    eventType: (index: number) => batch.typeAt(index),
    copyName: (index: number) => batch.nameAt(index),
    copyText: (index: number) => batch.textAt(index),
    copyAttrName: (eventIndex: number, attrIndex: number) => batch.attributeNameAt(eventIndex, attrIndex),
    copyAttrValue: (eventIndex: number, attrIndex: number) => batch.attributeValueAt(eventIndex, attrIndex),
  };
}

function maybeSplitReadableStream(
  stream: ReadableStream<Uint8Array>,
  maxChunkBytes: number | undefined,
): ReadableStream<Uint8Array> {
  if (!maxChunkBytes || maxChunkBytes <= 0) {
    return stream;
  }

  const sourceReader = stream.getReader();
  let pendingChunk: Uint8Array | undefined;
  let pendingOffset = 0;
  let sourceClosed = false;
  let released = false;

  const releaseLock = () => {
    if (released) {
      return;
    }
    released = true;
    sourceReader.releaseLock();
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        if (pendingChunk && pendingOffset < pendingChunk.byteLength) {
          const end = Math.min(pendingOffset + maxChunkBytes, pendingChunk.byteLength);
          const chunk = pendingChunk.subarray(pendingOffset, end);
          pendingOffset = end;
          if (pendingOffset >= pendingChunk.byteLength) {
            pendingChunk = undefined;
            pendingOffset = 0;
          }
          controller.enqueue(chunk);
          return;
        }

        if (sourceClosed) {
          releaseLock();
          controller.close();
          return;
        }

        const result = await sourceReader.read();
        if (result.done) {
          sourceClosed = true;
          continue;
        }

        if (result.value.byteLength <= maxChunkBytes) {
          controller.enqueue(result.value);
          return;
        }

        pendingChunk = result.value;
        pendingOffset = 0;
      }
    },
    async cancel(reason) {
      try {
        await sourceReader.cancel(reason);
      } finally {
        releaseLock();
      }
    },
  });
}

function unsupportedInitializedRuntime(): never {
  throw new Error(
    'EventReader requires a streaming event batch runtime once stax-xml has been initialized. ' +
      'JavaScript fallback is only used before initStaxXml().',
  );
}

export default EventReader;
