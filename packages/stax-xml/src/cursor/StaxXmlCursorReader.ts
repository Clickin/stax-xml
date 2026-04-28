import {
  IterableEventMaterializer,
  type EntityDefinition
} from '../IterableEventBackend.js';
import {
  StaxXmlIterableParser,
  toByteBatches
} from '../StaxXmlIterableParser.js';
import type { AnyXmlEvent } from '../types.js';
import { CursorEventView } from './CursorEventView.js';
import { CursorEventType, type CursorEventType as CursorEventTypeValue, type StaxXmlCursorReaderOptions } from './types.js';

const textEncoder = new TextEncoder();

export class StaxXmlCursorReader {
  private readonly parser: StaxXmlIterableParser;
  private readonly materializer: IterableEventMaterializer;
  private readonly view = new CursorEventView();
  private currentBatch: AnyXmlEvent[] = [];
  private batchIndex = 0;
  private done = false;

  constructor(xml: string, options: StaxXmlCursorReaderOptions = {}) {
    if (typeof xml !== 'string') {
      throw new Error('xml must be a string.');
    }

    this.parser = new StaxXmlIterableParser(
      toByteBatches(byteChunks(textEncoder.encode(xml), 8), { batchSize: 1 }),
      {
        emitStartDocumentBatchImmediately: true,
        backend: options.backend,
        fallbackOnLoadError: options.fallbackOnLoadError,
        fallbackOnParseError: options.fallbackOnParseError
      }
    );
    this.materializer = new IterableEventMaterializer({
      autoDecodeEntities: options.autoDecodeEntities ?? true,
      addEntities: options.addEntities as EntityDefinition[] | undefined,
      trimText: true,
      implicitAttributeValue: 'name'
    });
  }

  next(): boolean {
    if (this.batchIndex >= this.currentBatch.length && !this.readNextNonEmptyBatch()) {
      return false;
    }

    this.view.moveTo(this.currentBatch[this.batchIndex++]!);
    return true;
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

  private readNextNonEmptyBatch(): boolean {
    if (this.done) {
      return false;
    }

    while (this.parser.nextBatch()) {
      const batch = this.materializer.materializeBatch(this.parser);
      if (batch.length > 0) {
        this.currentBatch = batch;
        this.batchIndex = 0;
        return true;
      }
    }

    this.done = true;
    this.currentBatch = [];
    this.batchIndex = 0;
    this.view.reset();
    return false;
  }
}

export { CursorEventType };

function* byteChunks(bytes: Uint8Array, chunkSize: number): Iterable<Uint8Array> {
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    yield bytes.slice(offset, Math.min(offset + chunkSize, bytes.byteLength));
  }
}
