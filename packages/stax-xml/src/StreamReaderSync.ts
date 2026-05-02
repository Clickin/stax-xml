import { StreamingEventBatchReader } from './runtime/event-table.js';
import { getStaxXmlRuntimeForSyncApi } from './runtime/native-backend.js';
import {
  createStreamBatchView,
  StreamEventType,
  type StreamBatch,
  type StreamEventView,
  type StreamReaderSyncByteBatch,
} from './stream-reader-core.js';
import type { DocumentMode } from './types.js';

export { StreamEventType };
export type { StreamBatch, StreamEventView, StreamReaderSyncByteBatch };

/**
 * Synchronous stream reader options.
 *
 * @public
 */
export interface StreamReaderSyncOptions {
  /**
   * Text encoding passed to the active streaming backend.
   *
   * @defaultValue 'utf-8'
   */
  encoding?: string;

  /**
   * XML document conformance mode.
   *
   * @defaultValue 'fragment'
   */
  documentMode?: DocumentMode;
}

/**
 * Batch-first synchronous StAX core over bytes.
 *
 * @public
 */
export class StreamReaderSync implements Iterable<StreamBatch> {
  private readonly reader: StreamingEventBatchReader;
  private generation = 0;
  private finished = false;

  constructor(source: Iterable<StreamReaderSyncByteBatch>, options?: StreamReaderSyncOptions);
  constructor(source: Uint8Array, options?: StreamReaderSyncOptions);
  constructor(
    source: Iterable<StreamReaderSyncByteBatch> | Uint8Array,
    options: StreamReaderSyncOptions = {},
  ) {
    const runtime = requireStreamingRuntime();
    const createStreamingParser = runtime.capabilities.streamingEventBatches!;
    const batches = source instanceof Uint8Array ? singleByteBatch(source) : source;

    this.reader = new StreamingEventBatchReader(
      createStreamingParser({
        encoding: options.encoding,
        documentMode: options.documentMode,
      }),
      batches[Symbol.iterator](),
    );
  }

  nextBatch(): StreamBatch | null {
    this.generation++;
    if (this.finished) {
      return null;
    }
    if (!this.reader.nextBatch()) {
      this.finished = true;
      return null;
    }
    return createStreamBatchView(this.reader, this.generation, this);
  }

  *batchedIterator(): IterableIterator<StreamBatch> {
    while (true) {
      const batch = this.nextBatch();
      if (batch === null) {
        return;
      }
      yield batch;
    }
  }

  [Symbol.iterator](): IterableIterator<StreamBatch> {
    return this.batchedIterator();
  }

  currentGeneration(): number {
    return this.generation;
  }
}

function requireStreamingRuntime() {
  try {
    const runtime = getStaxXmlRuntimeForSyncApi(undefined);
    if (runtime?.capabilities.streamingEventBatches) {
      return runtime;
    }
  } catch (cause) {
    throw streamReaderCapabilityError(cause);
  }
  throw streamReaderCapabilityError();
}

function streamReaderCapabilityError(cause?: unknown): Error {
  const error = new Error(
    'StreamReaderSync requires an initialized native or wasm streaming event batch backend. ' +
      'Call initStaxXml({ backend: "native" }) or initStaxXml({ backend: "wasm" }) before constructing StreamReaderSync.',
  );
  if (cause !== undefined) {
    (error as Error & { cause?: unknown }).cause = cause;
  }
  return error;
}

function* singleByteBatch(source: Uint8Array): Iterable<StreamReaderSyncByteBatch> {
  yield [source];
}
