import { StreamingEventBatchReader } from './runtime/event-table.js';
import { getStaxXmlRuntimeForSyncApi } from './runtime/native-backend.js';
import {
  createStreamBatchView,
  type StreamBatch,
} from './stream-reader-core.js';
import type { DocumentMode } from './types.js';

export type { StreamBatch, StreamEventView } from './stream-reader-core.js';

/**
 * Asynchronous stream reader options.
 *
 * @public
 */
export interface StreamReaderOptions {
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
 * Batch-first asynchronous StAX core over `ReadableStream<Uint8Array>`.
 *
 * @public
 */
export class StreamReader implements AsyncIterable<StreamBatch> {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly streamingBatches: StreamingEventBatchReader;
  private generation = 0;
  private sourceDone = false;
  private finished = false;
  private lockReleased = false;
  private nextBatchInFlight: Promise<StreamBatch | null> | undefined;

  constructor(stream: ReadableStream<Uint8Array>, options: StreamReaderOptions = {}) {
    if (!(stream instanceof ReadableStream)) {
      throw new Error('stream must be a web standard ReadableStream.');
    }

    const runtime = requireStreamingRuntime();
    const createStreamingParser = runtime.capabilities.streamingEventBatches!;

    this.reader = stream.getReader();
    this.streamingBatches = new StreamingEventBatchReader(
      createStreamingParser({
        encoding: options.encoding,
        documentMode: options.documentMode,
      }),
    );
  }

  async nextBatch(): Promise<StreamBatch | null> {
    if (this.nextBatchInFlight) {
      throw new Error('Concurrent nextBatch() calls are not allowed on StreamReader.');
    }

    this.generation++;
    if (this.finished) {
      return null;
    }

    const operation = this.readNextBatch();
    this.nextBatchInFlight = operation;
    try {
      return await operation;
    } finally {
      this.nextBatchInFlight = undefined;
    }
  }

  async return(): Promise<void> {
    this.generation++;
    if (this.finished) {
      return;
    }
    this.finished = true;
    try {
      await this.reader.cancel('StreamReader.return()');
    } finally {
      this.releaseLock();
    }
  }

  async *batchedIterator(): AsyncGenerator<StreamBatch> {
    try {
      while (true) {
        const batch = await this.nextBatch();
        if (batch === null) {
          return;
        }
        yield batch;
      }
    } finally {
      if (!this.finished) {
        await this.return();
      }
    }
  }

  [Symbol.asyncIterator](): AsyncGenerator<StreamBatch> {
    return this.batchedIterator();
  }

  currentGeneration(): number {
    return this.generation;
  }

  private async readNextBatch(): Promise<StreamBatch | null> {
    if (this.streamingBatches.activatePendingBatch()) {
      return createStreamBatchView(this.streamingBatches, this.generation, this);
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
        if (this.streamingBatches.pushByteBatch([], true)) {
          this.releaseLock();
          return createStreamBatchView(this.streamingBatches, this.generation, this);
        }
        if (this.streamingBatches.activatePendingBatch()) {
          this.releaseLock();
          return createStreamBatchView(this.streamingBatches, this.generation, this);
        }
        this.finished = true;
        this.releaseLock();
        return null;
      }

      if (this.streamingBatches.pushByteBatch([readResult.value], false)) {
        return createStreamBatchView(this.streamingBatches, this.generation, this);
      }
    }

    this.finished = true;
    return null;
  }

  private releaseLock(): void {
    if (this.lockReleased) {
      return;
    }
    this.lockReleased = true;
    this.reader.releaseLock();
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
    'StreamReader requires an initialized native or wasm streaming event batch backend. ' +
      'Call initStaxXml({ backend: "native" }) or initStaxXml({ backend: "wasm" }) before constructing StreamReader.',
  );
  if (cause !== undefined) {
    (error as Error & { cause?: unknown }).cause = cause;
  }
  return error;
}
