import { createJavaScriptIterableReader } from './IterableReader.js';
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
}

/**
 * Batch-first synchronous StAX core over bytes.
 *
 * @public
 */
export class StreamReaderSync implements Iterable<StreamBatch> {
  private readonly reader: ReturnType<typeof createJavaScriptIterableReader>;
  private generation = 0;
  private finished = false;

  constructor(source: Iterable<StreamReaderSyncByteBatch>, options?: StreamReaderSyncOptions);
  constructor(source: Uint8Array, options?: StreamReaderSyncOptions);
  constructor(
    source: Iterable<StreamReaderSyncByteBatch> | Uint8Array,
    options: StreamReaderSyncOptions = {},
  ) {
    const batches = source instanceof Uint8Array ? singleByteBatch(source) : source;
    this.reader = createJavaScriptIterableReader(batches, {
      encoding: options.encoding,
      documentMode: options.documentMode,
    });
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
    this.generation++;
    if (this.finished) {
      return null;
    }

    const frame = this.reader.nextBatchFrame();
    if (!frame) {
      this.finished = true;
      return null;
    }
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

function* singleByteBatch(source: Uint8Array): Iterable<StreamReaderSyncByteBatch> {
  yield [source];
}
