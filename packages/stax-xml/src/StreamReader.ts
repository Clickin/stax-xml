import { createJavaScriptIterableReader } from './IterableReader.js';
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
   * Text encoding used when materializing text from byte batches.
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

  /**
   * Maximum number of stream chunks grouped into one parser byte batch.
   *
   * The default preserves the historical one-read-per-parser-push behavior.
   * Larger values reduce async read/push overhead while keeping production
   * bounded by consumer demand.
   *
   * @defaultValue 1
   */
  batchSize?: number;
}

/**
 * Batch-first asynchronous StAX core over `ReadableStream<Uint8Array>`.
 *
 * @public
 */
export class StreamReader implements AsyncIterable<StreamBatch> {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly streamingBatches: ReturnType<typeof createJavaScriptIterableReader>;
  private generation = 0;
  private sourceDone = false;
  private finished = false;
  private lockReleased = false;
  private nextBatchInFlight: Promise<StreamBatch | null> | undefined;
  private readonly batchSize: number;

  constructor(stream: ReadableStream<Uint8Array>, options: StreamReaderOptions = {}) {
    if (!(stream instanceof ReadableStream)) {
      throw new Error('stream must be a web standard ReadableStream.');
    }

    this.reader = stream.getReader();
    this.batchSize = normalizeBatchSize(options.batchSize);
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
    while (true) {
      const byteBatch: Uint8Array[] = [];
      while (!this.sourceDone && byteBatch.length < this.batchSize) {
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
          break;
        }

        byteBatch.push(readResult.value);
      }

      if (byteBatch.length > 0 && this.streamingBatches.pushByteBatch(byteBatch, false)) {
        return createStreamBatchView(this.streamingBatches, this.generation, this);
      }

      if (this.sourceDone) {
        if (this.streamingBatches.pushByteBatch([], true)) {
          this.releaseLock();
          return createStreamBatchView(this.streamingBatches, this.generation, this);
        }
        this.finished = true;
        this.releaseLock();
        return null;
      }
    }
  }

  private releaseLock(): void {
    if (this.lockReleased) {
      return;
    }
    this.lockReleased = true;
    this.reader.releaseLock();
  }
}

function normalizeBatchSize(value: number | undefined): number {
  const batchSize = value ?? 1;
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new RangeError('batchSize must be a positive integer.');
  }
  return batchSize;
}
