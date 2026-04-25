import {
  IterableEventBackendIterator,
  type EntityDefinition
} from '../IterableEventBackend.js';
import { CursorEventView } from './CursorEventView.js';
import { CursorEventType, type CursorEventType as CursorEventTypeValue, type StaxXmlCursorReaderAsyncOptions } from './types.js';

export class StaxXmlCursorReaderAsync {
  private readonly backend: IterableEventBackendIterator;
  private readonly view = new CursorEventView();
  private closed = false;

  constructor(stream: ReadableStream<Uint8Array>, options: StaxXmlCursorReaderAsyncOptions = {}) {
    if (!(stream instanceof ReadableStream)) {
      throw new Error('stream must be a web standard ReadableStream.');
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
      maxChunkBytes: 8
    });
  }

  async next(): Promise<boolean> {
    if (this.closed) {
      return false;
    }

    const result = await this.backend.next();
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
    await this.backend.return();
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
}

export { CursorEventType };
