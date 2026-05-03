import {
  readReadableStreamByteBatches,
  readReadableStreamChunksIncrementally,
  type EntityDefinition
} from '../IterableEventBackend.js';
import { getStaxXmlRuntimeForSyncApi } from '../runtime/native-backend.js';
import { StreamingEventBatchReader } from '../runtime/event-table.js';
import { ByteCursorFacadeAsync } from './ByteCursorFacadeAsync.js';
import { CursorEventView } from './CursorEventView.js';
import { CursorEventType, type CursorEventType as CursorEventTypeValue, type CursorReaderAsyncOptions } from './types.js';

export class CursorReaderAsync {
  private readonly byteCursor?: ByteCursorFacadeAsync;
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

  constructor(stream: ReadableStream<Uint8Array>, options: CursorReaderAsyncOptions = {}) {
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
    if ((options.namespaceAware ?? true) !== false && runtime?.backend.kind !== 'js' && createStreamingParser) {
      this.nativeReader = new StreamingEventBatchReader(createStreamingParser({
        encoding: options.encoding ?? 'utf-8',
      }));
      this.nativeChunks = readReadableStreamChunksIncrementally(stream);
      return;
    }

    this.byteCursor = new ByteCursorFacadeAsync(
      readReadableStreamByteBatches(stream, { batchSize: 1 }),
      options,
    );
  }

  async next(): Promise<boolean> {
    if (this.closed) {
      return false;
    }

    if (this.nativeReader) {
      return this.nextNativeEvent();
    }

    const moved = await this.byteCursor!.next();
    if (!moved) {
      this.closed = true;
      return false;
    }
    return true;
  }

  async close(): Promise<void> {
    this.closed = true;
    this.view.reset();
    if (this.nativeChunks) {
      await this.nativeChunks.return(undefined);
    }
  }

  eventType(): CursorEventTypeValue {
    if (!this.nativeReader) {
      return this.byteCursor!.eventType();
    }
    return this.view.eventType();
  }

  name(): string | undefined {
    if (!this.nativeReader) {
      return this.byteCursor!.name();
    }
    return this.view.name();
  }

  localName(): string | undefined {
    if (!this.nativeReader) {
      return this.byteCursor!.localName();
    }
    return this.view.localName();
  }

  prefix(): string | undefined {
    if (!this.nativeReader) {
      return this.byteCursor!.prefix();
    }
    return this.view.prefix();
  }

  uri(): string | undefined {
    if (!this.nativeReader) {
      return this.byteCursor!.uri();
    }
    return this.view.uri();
  }

  text(): string | undefined {
    if (!this.nativeReader) {
      return this.byteCursor!.text();
    }
    return this.view.text();
  }

  getAttributeCount(): number {
    if (!this.nativeReader) {
      return this.byteCursor!.getAttributeCount();
    }
    return this.view.getAttributeCount();
  }

  getAttributeName(index: number): string | undefined {
    if (!this.nativeReader) {
      return this.byteCursor!.getAttributeName(index);
    }
    return this.view.getAttributeName(index);
  }

  getAttributeLocalName(index: number): string | undefined {
    if (!this.nativeReader) {
      return this.byteCursor!.getAttributeLocalName(index);
    }
    return this.view.getAttributeLocalName(index);
  }

  getAttributePrefix(index: number): string | undefined {
    if (!this.nativeReader) {
      return this.byteCursor!.getAttributePrefix(index);
    }
    return this.view.getAttributePrefix(index);
  }

  getAttributeValue(indexOrName: number | string): string | undefined {
    if (!this.nativeReader) {
      return this.byteCursor!.getAttributeValue(indexOrName);
    }
    return this.view.getAttributeValue(indexOrName);
  }

  getAttributeUri(index: number): string | undefined {
    if (!this.nativeReader) {
      return this.byteCursor!.getAttributeUri(index);
    }
    return this.view.getAttributeUri(index);
  }

  depth(): number {
    if (!this.nativeReader) {
      return this.byteCursor!.depth();
    }
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
