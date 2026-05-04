import { CursorStreamBatchSource } from './cursor-stream-batch.js';
import { CursorEventType } from './cursor/types.js';
import { DocumentModeStreamReaderAsyncCore } from './document-mode-stream-core.js';
import { Uint8ArrayCurrentCursorAsync } from './iterable/Uint8ArrayCurrentCursorAsync.js';
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
  private readonly cursor: Uint8ArrayCurrentCursorAsync | undefined;
  private readonly documentCore: DocumentModeStreamReaderAsyncCore | undefined;
  private generation = 0;
  private finished = false;
  private lockReleased = false;
  private pendingEndDocument = false;
  private nextBatchInFlight: Promise<StreamBatch | null> | undefined;

  constructor(stream: ReadableStream<Uint8Array>, options: StreamReaderOptions = {}) {
    if (!(stream instanceof ReadableStream)) {
      throw new Error('stream must be a web standard ReadableStream.');
    }

    this.reader = stream.getReader();
    if (options.documentMode === 'document') {
      this.documentCore = new DocumentModeStreamReaderAsyncCore(this.reader, () => this.releaseLock(), options);
      return;
    }
    void options.encoding;
    this.cursor = new Uint8ArrayCurrentCursorAsync(readableStreamByteBatches(this.reader, () => this.releaseLock()), {
      implicitAttributeValue: 'true',
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
    if (this.documentCore) {
      const batch = await this.documentCore.nextBatch(this.generation, this);
      if (batch === null) {
        this.finished = true;
      }
      return batch;
    }

    const source = new CursorStreamBatchSource();
    if (this.pendingEndDocument) {
      this.pendingEndDocument = false;
      source.appendEvent(CursorEventType.END_DOCUMENT);
      return createStreamBatchView(source, this.generation, this);
    }
    const cursor = this.cursor!;
    while (source.eventCount() < 64) {
      while (source.eventCount() < 64 && cursor.tryNextBuffered()) {
        if (cursor.eventType() === CursorEventType.END_DOCUMENT && source.eventCount() > 0) {
          this.pendingEndDocument = true;
          break;
        }
        source.append(cursor);
      }
      if (this.pendingEndDocument) {
        break;
      }
      if (source.eventCount() >= 64) {
        break;
      }
      if (!await cursor.next()) {
        if (source.eventCount() === 0) {
          this.finished = true;
          this.releaseLock();
          return null;
        }
        break;
      }
      if (cursor.eventType() === CursorEventType.END_DOCUMENT && source.eventCount() > 0) {
        this.pendingEndDocument = true;
        break;
      }
      source.append(cursor);
    }
    if (source.eventCount() > 0) {
      return createStreamBatchView(source, this.generation, this);
    }
    this.finished = true;
    this.releaseLock();
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

async function* readableStreamByteBatches(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  releaseLock: () => void,
): AsyncIterable<readonly Uint8Array[]> {
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        return;
      }
      yield [result.value];
    }
  } finally {
    releaseLock();
  }
}
