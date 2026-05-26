import { createJavaScriptIterableReader } from './IterableReader.js';
import {
  createStreamBatchView,
  type StreamBatch,
  type StreamReaderSyncByteBatch,
  type StreamReaderSyncRawBatch,
} from './stream-reader-core.js';
import type { DocumentMode } from './types.js';

export type { StreamBatch, StreamEventView, StreamReaderSyncRawBatch } from './stream-reader-core.js';

export type StreamReaderSource =
  | ReadableStream<Uint8Array>
  | AsyncIterable<StreamReaderSyncByteBatch>;

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
 * Batch-first asynchronous StAX core over `ReadableStream<Uint8Array>` or
 * pre-grouped async byte batches.
 *
 * @public
 */
export class StreamReader implements AsyncIterable<StreamBatch> {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  private readonly byteBatchIterator: AsyncIterator<StreamReaderSyncByteBatch> | undefined;
  private readonly streamingBatches: ReturnType<typeof createJavaScriptIterableReader>;
  private generation = 0;
  private sourceDone = false;
  private finished = false;
  private lockReleased = false;
  private nextBatchInFlight: Promise<StreamBatch | null> | undefined;
  private readonly batchSize: number;

  constructor(source: StreamReaderSource, options: StreamReaderOptions = {}) {
    if (source instanceof ReadableStream) {
      this.reader = source.getReader();
    } else if (isAsyncIterableByteBatches(source)) {
      this.byteBatchIterator = source[Symbol.asyncIterator]();
    } else {
      throw new Error('source must be a web standard ReadableStream or AsyncIterable<Uint8Array[]>.');
    }

    this.batchSize = normalizeBatchSize(options.batchSize);
    this.streamingBatches = createJavaScriptIterableReader([], {
      encoding: options.encoding,
      documentMode: options.documentMode,
    });
  }

  async nextBatch(): Promise<StreamBatch | null> {
    return await this.runExclusiveRead(async () => {
      this.generation++;
      if (this.finished) {
        return null;
      }

      return await this.readNextBatch();
    });
  }

  /**
   * Return an experimental low-level batch view without creating per-event
   * wrapper objects.
   *
   * This API is intended for benchmark and scanner-style traversal paths. The
   * existing {@link nextBatch} API remains the stable ergonomic surface.
   *
   * @experimental
   */
  async nextRawBatch(): Promise<StreamReaderSyncRawBatch | null> {
    return await this.runExclusiveRead(async () => {
      this.generation++;
      if (this.finished) {
        return null;
      }

      return await this.readNextRawBatch();
    });
  }

  private async runExclusiveRead<T>(read: () => Promise<T>): Promise<T> {
    if (this.nextBatchInFlight) {
      throw new Error('Concurrent nextBatch() calls are not allowed on StreamReader.');
    }

    const operation = read();
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
      if (this.reader) {
        await this.reader.cancel('StreamReader.return()');
      } else if (typeof this.byteBatchIterator?.return === 'function') {
        await this.byteBatchIterator.return();
      }
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
      const byteBatch = await this.readNextByteBatch();

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

  private async readNextRawBatch(): Promise<StreamReaderSyncRawBatch | null> {
    while (true) {
      const byteBatch = await this.readNextByteBatch();

      if (byteBatch.length > 0 && this.streamingBatches.pushByteBatch(byteBatch, false)) {
        return createRawBatch(this.streamingBatches.batchFrame());
      }

      if (this.sourceDone) {
        if (this.streamingBatches.pushByteBatch([], true)) {
          this.releaseLock();
          return createRawBatch(this.streamingBatches.batchFrame());
        }
        this.finished = true;
        this.releaseLock();
        return null;
      }
    }
  }

  private async readNextByteBatch(): Promise<StreamReaderSyncByteBatch> {
    if (this.sourceDone) {
      return [];
    }
    if (this.reader) {
      return await this.readNextReadableStreamByteBatch();
    }
    return await this.readNextAsyncIterableByteBatch();
  }

  private async readNextReadableStreamByteBatch(): Promise<StreamReaderSyncByteBatch> {
    const byteBatch: Uint8Array[] = [];
    while (!this.sourceDone && byteBatch.length < this.batchSize) {
      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await this.reader!.read();
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
    return byteBatch;
  }

  private async readNextAsyncIterableByteBatch(): Promise<StreamReaderSyncByteBatch> {
    let readResult: IteratorResult<StreamReaderSyncByteBatch>;
    try {
      readResult = await this.byteBatchIterator!.next();
    } catch (error) {
      this.finished = true;
      throw error;
    }

    if (readResult.done) {
      this.sourceDone = true;
      return [];
    }
    return readResult.value;
  }

  private releaseLock(): void {
    if (this.lockReleased) {
      return;
    }
    this.lockReleased = true;
    this.reader?.releaseLock();
  }
}

function isAsyncIterableByteBatches(value: unknown): value is AsyncIterable<StreamReaderSyncByteBatch> {
  return typeof (value as { [Symbol.asyncIterator]?: unknown })?.[Symbol.asyncIterator] === 'function';
}

function createRawBatch(frame: ReturnType<ReturnType<typeof createJavaScriptIterableReader>['batchFrame']>): StreamReaderSyncRawBatch {
  return {
    kind: 'frame',
    eventCount: frame.eventCount,
    attrCount: frame.attrCount,
    buffer: frame.buffer,
    eventTypes: frame.eventTypes,
    nameStarts: frame.nameStarts,
    nameEnds: frame.nameEnds,
    nameIds: frame.nameIds,
    textStarts: frame.textStarts,
    textEnds: frame.textEnds,
    attrStarts: frame.attrStarts,
    attrCounts: frame.attrCounts,
    attrNameStarts: frame.attrNameStarts,
    attrNameEnds: frame.attrNameEnds,
    attrNameIds: frame.attrNameIds,
    attrValueStarts: frame.attrValueStarts,
    attrValueEnds: frame.attrValueEnds,
  } satisfies StreamReaderSyncRawBatch;
}

function normalizeBatchSize(value: number | undefined): number {
  const batchSize = value ?? 1;
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new RangeError('batchSize must be a positive integer.');
  }
  return batchSize;
}
