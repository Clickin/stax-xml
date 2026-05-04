import {
  readReadableStreamByteBatches,
} from '../IterableEventBackend.js';
import { ByteCursorFacadeAsync } from './ByteCursorFacadeAsync.js';
import { CursorEventType, type CursorEventType as CursorEventTypeValue, type CursorReaderAsyncOptions } from './types.js';

const FALSE_PROMISE = Promise.resolve(false);

export class CursorReaderAsync {
  private readonly byteCursor: ByteCursorFacadeAsync;
  private closed = false;

  constructor(stream: ReadableStream<Uint8Array>, options: CursorReaderAsyncOptions = {}) {
    if (!(stream instanceof ReadableStream)) {
      throw new Error('stream must be a web standard ReadableStream.');
    }

    this.byteCursor = new ByteCursorFacadeAsync(
      readReadableStreamByteBatches(stream, { batchSize: 1 }),
      options,
    );
  }

  next(): Promise<boolean> {
    if (this.closed) {
      return FALSE_PROMISE;
    }

    try {
      return this.byteCursor.next();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  eventType(): CursorEventTypeValue {
    return this.byteCursor.eventType();
  }

  name(): string | undefined {
    return this.byteCursor.name();
  }

  localName(): string | undefined {
    return this.byteCursor.localName();
  }

  prefix(): string | undefined {
    return this.byteCursor.prefix();
  }

  uri(): string | undefined {
    return this.byteCursor.uri();
  }

  text(): string | undefined {
    return this.byteCursor.text();
  }

  getAttributeCount(): number {
    return this.byteCursor.getAttributeCount();
  }

  getAttributeName(index: number): string | undefined {
    return this.byteCursor.getAttributeName(index);
  }

  getAttributeLocalName(index: number): string | undefined {
    return this.byteCursor.getAttributeLocalName(index);
  }

  getAttributePrefix(index: number): string | undefined {
    return this.byteCursor.getAttributePrefix(index);
  }

  getAttributeValue(indexOrName: number | string): string | undefined {
    return this.byteCursor.getAttributeValue(indexOrName);
  }

  getAttributeUri(index: number): string | undefined {
    return this.byteCursor.getAttributeUri(index);
  }

  depth(): number {
    return this.byteCursor.depth();
  }
}

export { CursorEventType };
