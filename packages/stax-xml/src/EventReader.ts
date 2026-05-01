import {
  IterableEventBackendIterator,
  IterableEventMaterializer,
  readReadableStreamByteBatches,
  readReadableStreamChunksIncrementally,
  STAX_XML_EVENT_BACKEND,
  type EntityDefinition,
  type IterableEventBackendOptions
} from './IterableEventBackend.js';
import {
  createJavaScriptIterableReader,
} from './IterableReader.js';
import {
  getStaxXmlRuntimeForSyncApi,
  type StaxXmlStreamingEventBatchParser,
} from './runtime/native-backend.js';
import {
  StreamingSpanTableAdapter,
  toUint8Array,
} from './runtime/event-table.js';
import {
  XmlEventType,
  type AnyXmlEvent,
  type DocumentMode,
  type ParserEventFilter
} from './types.js';

/**
 * Configuration options for the EventReader
 *
 * @public
 */
export interface EventReaderOptions {
  /**
   * Text encoding for the input stream
   * @defaultValue 'utf-8'
   */
  encoding?: string;

  /**
   * Additional custom entities to decode
   * @defaultValue []
   */
  addEntities?: EntityDefinition[];

  /**
   * Whether to automatically decode XML entities
   * @defaultValue true
   */
  autoDecodeEntities?: boolean;

  /**
   * Maximum buffer size in bytes
   * @defaultValue 65536
   *
   * @remarks
   * Retained for API compatibility. The iterable backend owns chunk buffering.
   */
  maxBufferSize?: number;

  /**
   * Whether to enable buffer compaction for memory efficiency
   * @defaultValue true
   *
   * @remarks
   * Retained for API compatibility. The iterable backend owns chunk buffering.
   */
  enableBufferCompaction?: boolean;

  /**
   * Initial event queue capacity
   * @defaultValue 1024
   *
   * @remarks
   * Retained for API compatibility. The iterable backend exposes materialized batches directly.
   */
  initialQueueCapacity?: number;

  /**
   * Maximum source chunk size passed to the active reader backend.
   *
   * @remarks
   * Oversized Uint8Array chunks are split with subarray views so the reader does
   * not copy source bytes before handing them to the native streaming backend.
   */
  maxChunkBytes?: number;

  eventFilter?: ParserEventFilter;

  /**
   * XML document conformance mode.
   *
   * @defaultValue 'fragment'
   */
  documentMode?: DocumentMode;

  fallbackOnParseError?: boolean;
}

export class EventReader implements AsyncIterable<AnyXmlEvent> {
  private readonly backend: EventReaderImpl;
  private error: Error | undefined;

  constructor(xmlStream: ReadableStream<Uint8Array>, options: EventReaderOptions = {}) {
    if (!(xmlStream instanceof ReadableStream)) {
      throw new Error('xmlStream must be a web standard ReadableStream.');
    }

    this.backend = createEventReaderImpl(xmlStream, toBackendOptions(options));
  }

  [Symbol.asyncIterator](): AsyncIterator<AnyXmlEvent> {
    return this as unknown as AsyncIterator<AnyXmlEvent>;
  }

  /** @internal */
  [STAX_XML_EVENT_BACKEND](): IterableEventBackendIterator {
    return this.backend as unknown as IterableEventBackendIterator;
  }

  next(): IteratorResult<AnyXmlEvent> | Promise<IteratorResult<AnyXmlEvent>> {
    if (this.error) {
      throw this.error;
    }

    return this.backend.next().catch((error: Error) => {
      this.error = error;
      throw error;
    });
  }

  async return(): Promise<IteratorResult<AnyXmlEvent>> {
    return this.backend.return();
  }

  async nextBatch(): Promise<AnyXmlEvent[]> {
    if (this.error) {
      throw this.error;
    }

    try {
      return await this.backend.nextBatch();
    } catch (error) {
      this.error = error as Error;
      throw this.error;
    }
  }

  async *batchedIterator(): AsyncGenerator<AnyXmlEvent[]> {
    while (true) {
      const batch = await this.nextBatch();
      if (batch.length === 0) {
        break;
      }
      yield batch;
    }
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

function toBackendOptions(options: EventReaderOptions): IterableEventBackendOptions {
  return {
    encoding: options.encoding ?? 'utf-8',
    batchSize: 1,
    autoDecodeEntities: options.autoDecodeEntities ?? true,
    addEntities: options.addEntities,
    eventFilter: options.eventFilter,
    maxChunkBytes: options.maxChunkBytes,
    documentMode: options.documentMode,
    fallbackOnParseError: options.fallbackOnParseError
  };
}

interface EventReaderImpl extends AsyncIterator<AnyXmlEvent>, AsyncIterable<AnyXmlEvent> {
  return(): Promise<IteratorResult<AnyXmlEvent>>;
  nextBatch(): Promise<AnyXmlEvent[]>;
  batchedIterator(): AsyncGenerator<AnyXmlEvent[]>;
}

abstract class EventReaderImplBase implements EventReaderImpl {
  private sourceBatchIterator?: AsyncGenerator<AnyXmlEvent[]>;
  private bufferedEvents: AnyXmlEvent[] = [];
  private bufferedIndex = 0;
  private error: Error | undefined;
  private finished = false;

  [Symbol.asyncIterator](): AsyncIterator<AnyXmlEvent> {
    return this;
  }

  async next(): Promise<IteratorResult<AnyXmlEvent>> {
    if (this.error) {
      throw this.error;
    }

    if (this.bufferedIndex >= this.bufferedEvents.length) {
      const batch = await this.nextBatch();
      if (batch.length === 0) {
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
    if (this.sourceBatchIterator) {
      await this.sourceBatchIterator.return(undefined);
    }
    return { value: undefined, done: true };
  }

  async nextBatch(): Promise<AnyXmlEvent[]> {
    if (this.error) {
      throw this.error;
    }
    if (this.finished) {
      return [];
    }

    if (this.bufferedIndex < this.bufferedEvents.length) {
      const remaining = this.bufferedEvents.slice(this.bufferedIndex);
      this.bufferedEvents = [];
      this.bufferedIndex = 0;
      return remaining;
    }

    try {
      const nextBatch = await this.ensureSourceBatchIterator().next();
      if (nextBatch.done) {
        this.finished = true;
        return [];
      }
      return nextBatch.value;
    } catch (error) {
      this.error = error as Error;
      throw this.error;
    }
  }

  async *batchedIterator(): AsyncGenerator<AnyXmlEvent[]> {
    while (true) {
      const batch = await this.nextBatch();
      if (batch.length === 0) {
        break;
      }
      yield batch;
    }
  }

  protected abstract readMaterializedBatches(): AsyncGenerator<AnyXmlEvent[]>;

  private ensureSourceBatchIterator(): AsyncGenerator<AnyXmlEvent[]> {
    this.sourceBatchIterator ??= this.readMaterializedBatches();
    return this.sourceBatchIterator;
  }
}

class EventReaderNative extends EventReaderImplBase {
  private readonly streamingParser: StaxXmlStreamingEventBatchParser;

  constructor(
    private readonly stream: ReadableStream<Uint8Array>,
    private readonly options: IterableEventBackendOptions,
  ) {
    super();
    const runtime = getStaxXmlRuntimeForSyncApi(options.backend);
    const createStreamingParser = runtime?.capabilities.streamingEventBatches;
    if (!createStreamingParser) {
      throw new Error('EventReaderNative requires an initialized streaming event batch backend.');
    }
    this.streamingParser = createStreamingParser({
      encoding: options.encoding,
      documentMode: options.documentMode,
    });
  }

  protected async *readMaterializedBatches(): AsyncGenerator<AnyXmlEvent[]> {
    const materializer = new IterableEventMaterializer(this.options);
    for await (const chunk of readReadableStreamChunksIncrementally(this.stream, this.options.maxChunkBytes)) {
      yield* materializeNativeStreamingBatch(
        this.streamingParser.pushChunk(chunk, false),
        materializer,
      );
    }
    yield* materializeNativeStreamingBatch(
      this.streamingParser.pushChunk(new Uint8Array(0), true),
      materializer,
    );
  }
}

class EventReaderJs extends EventReaderImplBase {
  constructor(
    private readonly stream: ReadableStream<Uint8Array>,
    private readonly options: IterableEventBackendOptions,
  ) {
    super();
  }

  protected async *readMaterializedBatches(): AsyncGenerator<AnyXmlEvent[]> {
    const parser = createJavaScriptIterableReader([], {
      encoding: this.options.encoding,
      incompleteFinalMarkupMessage: this.options.incompleteFinalMarkupMessage,
      emitStartDocumentBatchImmediately: this.options.emitStartDocumentBatchImmediately,
      documentMode: this.options.documentMode
    });
    const materializer = new IterableEventMaterializer(this.options);

    if (this.options.emitStartDocumentBatchImmediately && parser.pushByteBatch([], false)) {
      const batch = materializer.materializeBatch(parser);
      yield batch;
    }

    for await (const byteBatch of readReadableStreamByteBatches(this.stream, this.options)) {
      if (!parser.pushByteBatch(byteBatch, false)) {
        continue;
      }
      const batch = materializer.materializeBatch(parser);
      if (batch.length > 0) {
        yield batch;
      }
    }

    parser.pushByteBatch([], true);

    const finalBatch = materializer.materializeBatch(parser);
    yield finalBatch;
  }
}

function createEventReaderImpl(
  stream: ReadableStream<Uint8Array>,
  options: IterableEventBackendOptions,
): EventReaderImpl {
  const runtime = getStaxXmlRuntimeForSyncApi(options.backend);
  if (runtime?.capabilities.streamingEventBatches) {
    return new EventReaderNative(stream, options);
  }
  return new EventReaderJs(stream, options);
}

function* materializeNativeStreamingBatch(
  batch: { buffer: ArrayBuffer | ArrayBufferView; table: ArrayBuffer | ArrayBufferView },
  materializer: IterableEventMaterializer,
): Generator<AnyXmlEvent[]> {
  const source = toUint8Array(batch.buffer);
  const parser = new StreamingSpanTableAdapter(source, batch.table);
  while (parser.nextBatch()) {
    const events = materializer.materializeBatch(parser);
    if (events.length > 0) {
      yield events;
    }
  }
}

export default EventReader;
