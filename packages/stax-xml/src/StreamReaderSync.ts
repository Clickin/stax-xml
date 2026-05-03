import { createJavaScriptIterableReader } from './IterableReader.js';
import { StreamingEventBatchReader } from './runtime/event-table.js';
import { getStaxXmlRuntimeForSyncApi } from './runtime/native-backend.js';
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
  private readonly reader: StreamingEventBatchReader | ReturnType<typeof createJavaScriptIterableReader>;
  private readonly nativeReader: boolean;
  private generation = 0;
  private finished = false;

  constructor(source: Iterable<StreamReaderSyncByteBatch>, options?: StreamReaderSyncOptions);
  constructor(source: Uint8Array, options?: StreamReaderSyncOptions);
  constructor(
    source: Iterable<StreamReaderSyncByteBatch> | Uint8Array,
    options: StreamReaderSyncOptions = {},
  ) {
    const batches = source instanceof Uint8Array ? singleByteBatch(source) : source;
    const runtime = getStaxXmlRuntimeForSyncApi(undefined);
    if (runtime?.capabilities.streamingEventBatches) {
      const createStreamingParser = runtime.capabilities.streamingEventBatches;
      this.nativeReader = true;
      this.reader = new StreamingEventBatchReader(
        createStreamingParser({
          encoding: options.encoding,
          documentMode: options.documentMode,
          batchLayout: 'soa-string-arena',
        }),
        batches[Symbol.iterator](),
      );
      return;
    }

    this.nativeReader = false;
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
    if (this.nativeReader) {
      const table = (this.reader as StreamingEventBatchReader).nextTable();
      if (!table) {
        this.finished = true;
        return null;
      }
      return createStreamBatchView(table, this.generation, this);
    }

    const parser = this.reader as ReturnType<typeof createJavaScriptIterableReader>;
    if (!parser.nextBatch()) {
      this.finished = true;
      return null;
    }
    return createStreamBatchView(parser, this.generation, this);
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
    if (this.nativeReader) {
      const table = (this.reader as StreamingEventBatchReader).nextTable();
      if (!table) {
        this.finished = true;
        return null;
      }
      return table.rawBatch();
    }

    const parser = this.reader as ReturnType<typeof createJavaScriptIterableReader>;
    const frame = parser.nextBatchFrame();
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
