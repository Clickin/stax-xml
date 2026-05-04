import { createJavaScriptIterableReader } from './IterableReader.js';
import {
  createStreamBatchView,
  type StreamBatch,
  type StreamReaderSyncByteBatch,
  type StreamReaderSyncRawBatch,
} from './stream-reader-core.js';
import type { DocumentMode } from './types.js';

type GenerationSource = {
  currentGeneration(): number;
};

export class DocumentModeStreamReaderSyncCore {
  private readonly reader: ReturnType<typeof createJavaScriptIterableReader>;
  private finished = false;

  constructor(source: Iterable<StreamReaderSyncByteBatch> | Uint8Array, options: { encoding?: string; documentMode?: DocumentMode }) {
    const batches = source instanceof Uint8Array ? singleByteBatch(source) : source;
    this.reader = createJavaScriptIterableReader(batches, {
      encoding: options.encoding,
      documentMode: options.documentMode,
    });
  }

  nextBatch(generation: number, generations: GenerationSource): StreamBatch | null {
    if (this.finished) {
      return null;
    }
    if (!this.reader.nextBatch()) {
      this.finished = true;
      return null;
    }
    return createStreamBatchView(this.reader, generation, generations);
  }

  nextRawBatch(): StreamReaderSyncRawBatch | null {
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
    };
  }
}

export class DocumentModeStreamReaderAsyncCore {
  private readonly reader: ReturnType<typeof createJavaScriptIterableReader>;
  private sourceDone = false;
  private finished = false;

  constructor(
    private readonly streamReader: ReadableStreamDefaultReader<Uint8Array>,
    private readonly releaseLock: () => void,
    private readonly options: { encoding?: string; documentMode?: DocumentMode },
  ) {
    this.reader = createJavaScriptIterableReader([], {
      encoding: options.encoding,
      documentMode: options.documentMode,
    });
  }

  async nextBatch(generation: number, generations: GenerationSource): Promise<StreamBatch | null> {
    if (this.finished) {
      return null;
    }
    while (!this.sourceDone) {
      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await this.streamReader.read();
      } catch (error) {
        this.finished = true;
        this.releaseLock();
        throw error;
      }
      if (readResult.done) {
        this.sourceDone = true;
        if (this.reader.pushByteBatch([], true)) {
          this.releaseLock();
          return createStreamBatchView(this.reader, generation, generations);
        }
        this.finished = true;
        this.releaseLock();
        return null;
      }
      if (this.reader.pushByteBatch([readResult.value], false)) {
        return createStreamBatchView(this.reader, generation, generations);
      }
    }
    this.finished = true;
    return null;
  }
}

function* singleByteBatch(source: Uint8Array): Iterable<StreamReaderSyncByteBatch> {
  yield [source];
}
