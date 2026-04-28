import {
  IterableEventBackendIterator,
  STAX_XML_EVENT_BACKEND,
  type EntityDefinition,
  type IterableEventBackendOptions
} from './IterableEventBackend.js';
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
  private readonly backend: IterableEventBackendIterator;
  private error: Error | undefined;

  constructor(xmlStream: ReadableStream<Uint8Array>, options: EventReaderOptions = {}) {
    if (!(xmlStream instanceof ReadableStream)) {
      throw new Error('xmlStream must be a web standard ReadableStream.');
    }

    this.backend = new IterableEventBackendIterator(xmlStream, toBackendOptions(options));
  }

  [Symbol.asyncIterator](): AsyncIterator<AnyXmlEvent> {
    return this as unknown as AsyncIterator<AnyXmlEvent>;
  }

  /** @internal */
  [STAX_XML_EVENT_BACKEND](): IterableEventBackendIterator {
    return this.backend;
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
    documentMode: options.documentMode,
    fallbackOnParseError: options.fallbackOnParseError
  };
}

export default EventReader;
