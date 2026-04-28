import {
  IterableEventBackendIterator,
  readReadableStreamChunksIncrementally,
  type EntityDefinition
} from '../IterableEventBackend.js';
import { getStaxXmlRuntimeForSyncApi } from '../runtime/native-backend.js';
import { StreamingEventBatchReader } from '../runtime/event-table.js';
import { CursorEventView } from './CursorEventView.js';
import { CursorEventType, type CursorEventType as CursorEventTypeValue, type StaxXmlCursorReaderAsyncOptions } from './types.js';

export class StaxXmlCursorReaderAsync {
  private readonly backend?: IterableEventBackendIterator;
  private readonly nativeReader?: StreamingEventBatchReader;
  private readonly nativeChunks?: AsyncGenerator<Uint8Array>;
  private readonly view = new CursorEventView();
  private nativeIndex = 0;
  private closed = false;
  private readonly viewOptions: {
    autoDecodeEntities: boolean;
    addEntities?: EntityDefinition[];
    implicitAttributeValue: 'name';
  };

  constructor(stream: ReadableStream<Uint8Array>, options: StaxXmlCursorReaderAsyncOptions = {}) {
    if (!(stream instanceof ReadableStream)) {
      throw new Error('stream must be a web standard ReadableStream.');
    }

    this.viewOptions = {
      autoDecodeEntities: options.autoDecodeEntities ?? true,
      addEntities: options.addEntities as EntityDefinition[] | undefined,
      implicitAttributeValue: 'name',
    };

    const runtime = getStaxXmlRuntimeForSyncApi(undefined);
    const createStreamingParser = runtime?.capabilities.streamingEventBatches;
    if (runtime?.backend.kind !== 'js' && createStreamingParser) {
      this.nativeReader = new StreamingEventBatchReader(createStreamingParser({
        encoding: options.encoding ?? 'utf-8',
      }));
      this.nativeChunks = readReadableStreamChunksIncrementally(stream, 8);
      return;
    }

    this.backend = new IterableEventBackendIterator(stream, {
      encoding: options.encoding ?? 'utf-8',
      batchSize: 1,
      autoDecodeEntities: options.autoDecodeEntities ?? true,
      addEntities: options.addEntities as EntityDefinition[] | undefined,
      trimText: true,
      implicitAttributeValue: 'name',
      incompleteFinalMarkupMessage: 'Unexpected end of document. Incomplete markup at end of stream.',
      emitStartDocumentBatchImmediately: true,
      maxChunkBytes: 8,
      fallbackOnLoadError: options.fallbackOnLoadError,
      fallbackOnParseError: options.fallbackOnParseError
    });
  }

  async next(): Promise<boolean> {
    if (this.closed) {
      return false;
    }

    if (this.nativeReader) {
      return this.nextNativeEvent();
    }

    const result = await this.backend!.next();
    if (result.done) {
      this.closed = true;
      this.view.reset();
      return false;
    }

    this.view.moveTo(result.value);
    return true;
  }

  async close(): Promise<void> {
    this.closed = true;
    this.view.reset();
    if (this.backend) {
      await this.backend.return();
    }
    if (this.nativeChunks) {
      await this.nativeChunks.return(undefined);
    }
  }

  eventType(): CursorEventTypeValue {
    return this.view.eventType();
  }

  name(): string | undefined {
    return this.view.name();
  }

  localName(): string | undefined {
    return this.view.localName();
  }

  prefix(): string | undefined {
    return this.view.prefix();
  }

  uri(): string | undefined {
    return this.view.uri();
  }

  text(): string | undefined {
    return this.view.text();
  }

  getAttributeCount(): number {
    return this.view.getAttributeCount();
  }

  getAttributeName(index: number): string | undefined {
    return this.view.getAttributeName(index);
  }

  getAttributeLocalName(index: number): string | undefined {
    return this.view.getAttributeLocalName(index);
  }

  getAttributePrefix(index: number): string | undefined {
    return this.view.getAttributePrefix(index);
  }

  getAttributeValue(indexOrName: number | string): string | undefined {
    return this.view.getAttributeValue(indexOrName);
  }

  getAttributeUri(index: number): string | undefined {
    return this.view.getAttributeUri(index);
  }

  depth(): number {
    return this.view.depth();
  }

  private async nextNativeEvent(): Promise<boolean> {
    while (true) {
      while (this.nativeIndex < this.nativeReader!.eventCount()) {
        if (this.view.moveToTable(this.nativeReader!, this.nativeIndex++, this.viewOptions)) {
          return true;
        }
      }

      if (this.nativeReader!.pushByteBatch([], false)) {
        this.nativeIndex = 0;
        continue;
      }

      const result = await this.nativeChunks!.next();
      if (result.done) {
        if (this.nativeReader!.pushByteBatch([], true)) {
          this.nativeIndex = 0;
          continue;
        }
        this.closed = true;
        this.view.reset();
        return false;
      }

      if (this.nativeReader!.pushByteBatch([result.value], false)) {
        this.nativeIndex = 0;
      }
    }
  }
}

export { CursorEventType };
