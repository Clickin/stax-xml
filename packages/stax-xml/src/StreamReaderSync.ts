import { CursorStreamBatchSource } from './cursor-stream-batch.js';
import { CursorEventType } from './cursor/types.js';
import { DocumentModeStreamReaderSyncCore } from './document-mode-stream-core.js';
import { Uint8ArrayCurrentCursor } from './iterable/Uint8ArrayCurrentCursor.js';
import {
  createStreamBatchView,
  StreamEventType,
  type StreamBatch,
  type StreamEventView,
  type StreamReaderSyncRawBatch,
  type StreamReaderSyncByteBatch,
} from './stream-reader-core.js';
import type { DocumentMode } from './types.js';

export { StreamEventType };
export type { StreamBatch, StreamEventView, StreamReaderSyncByteBatch, StreamReaderSyncRawBatch };

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
  private readonly cursor: Uint8ArrayCurrentCursor | undefined;
  private readonly documentCore: DocumentModeStreamReaderSyncCore | undefined;
  private generation = 0;
  private finished = false;
  private pendingEndDocument = false;

  constructor(source: Iterable<StreamReaderSyncByteBatch>, options?: StreamReaderSyncOptions);
  constructor(source: Uint8Array, options?: StreamReaderSyncOptions);
  constructor(
    source: Iterable<StreamReaderSyncByteBatch> | Uint8Array,
    options: StreamReaderSyncOptions = {},
  ) {
    const batches = source instanceof Uint8Array ? singleByteBatch(source) : source;
    if (options.documentMode === 'document') {
      this.documentCore = new DocumentModeStreamReaderSyncCore(source, options);
      return;
    }
    void options.encoding;
    this.cursor = new Uint8ArrayCurrentCursor(batches, {
      implicitAttributeValue: 'true',
    });
  }

  nextBatch(): StreamBatch | null {
    this.generation++;
    if (this.finished) {
      return null;
    }

    if (this.documentCore) {
      const batch = this.documentCore.nextBatch(this.generation, this);
      if (batch === null) {
        this.finished = true;
      }
      return batch;
    }

    const source = this.readCursorBatch();
    if (source === null) {
      this.finished = true;
      return null;
    }
    return createStreamBatchView(source, this.generation, this);
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
  nextRawBatch(): StreamReaderSyncRawBatch | null {
    if (this.finished) {
      return null;
    }
    this.generation++;
    if (this.documentCore) {
      const batch = this.documentCore.nextRawBatch();
      if (batch === null) {
        this.finished = true;
      }
      return batch;
    }
    throw new Error('StreamReaderSync.nextRawBatch is not available on the cursor-backed stream reader.');
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

  private readCursorBatch(): CursorStreamBatchSource | null {
    const source = new CursorStreamBatchSource();
    if (this.pendingEndDocument) {
      this.pendingEndDocument = false;
      source.appendEvent(CursorEventType.END_DOCUMENT);
      return source;
    }
    const cursor = this.cursor!;
    while (source.eventCount() < 64 && cursor.next()) {
      if (cursor.eventType() === CursorEventType.END_DOCUMENT && source.eventCount() > 0) {
        this.pendingEndDocument = true;
        break;
      }
      source.append(cursor);
    }
    return source.eventCount() === 0 ? null : source;
  }
}

function* singleByteBatch(source: Uint8Array): Iterable<StreamReaderSyncByteBatch> {
  yield [source];
}
