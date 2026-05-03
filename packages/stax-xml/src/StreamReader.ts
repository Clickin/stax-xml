import { createJavaScriptIterableReader } from './IterableReader.js';
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
  private readonly streamingBatches: StreamingEventBatchReader | ReturnType<typeof createJavaScriptIterableReader>;
  private readonly nativeReader: boolean;
  private generation = 0;
  private sourceDone = false;
  private finished = false;
  private lockReleased = false;
  private nextBatchInFlight: Promise<StreamBatch | null> | undefined;

  constructor(stream: ReadableStream<Uint8Array>, options: StreamReaderOptions = {}) {
    if (!(stream instanceof ReadableStream)) {
      throw new Error('stream must be a web standard ReadableStream.');
    }

    this.reader = stream.getReader();
    const runtime = getStaxXmlRuntimeForSyncApi(undefined);
    if (runtime?.capabilities.streamingEventBatches) {
      const createStreamingParser = runtime.capabilities.streamingEventBatches;
      this.nativeReader = true;
      this.streamingBatches = new StreamingEventBatchReader(
        createStreamingParser({
          encoding: options.encoding,
          documentMode: options.documentMode,
        }),
      );
      return;
    }

    this.nativeReader = false;
    this.streamingBatches = createJavaScriptIterableReader([], {
      encoding: options.encoding,
      documentMode: options.documentMode,
    });
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
    if (this.nativeReader && (this.streamingBatches as StreamingEventBatchReader).activatePendingBatch()) {
      return createStreamBatchView(this.streamingBatches as StreamingEventBatchReader, this.generation, this);
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
        if ((this.streamingBatches as ReturnType<typeof createJavaScriptIterableReader> | StreamingEventBatchReader).pushByteBatch([], true)) {
          this.releaseLock();
          return createStreamBatchView(this.streamingBatches as ReturnType<typeof createJavaScriptIterableReader>, this.generation, this);
        }
        if (this.nativeReader && (this.streamingBatches as StreamingEventBatchReader).activatePendingBatch()) {
          this.releaseLock();
          return createStreamBatchView(this.streamingBatches as StreamingEventBatchReader, this.generation, this);
        }
        this.finished = true;
        this.releaseLock();
        return null;
      }

      if ((this.streamingBatches as ReturnType<typeof createJavaScriptIterableReader> | StreamingEventBatchReader).pushByteBatch([readResult.value], false)) {
        return createStreamBatchView(this.streamingBatches as ReturnType<typeof createJavaScriptIterableReader>, this.generation, this);
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
