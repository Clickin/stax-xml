import {
  IterableEventMaterializer,
  type EntityDefinition
} from './IterableEventBackend.js';
import {
  StaxXmlIterableParser,
  toByteBatches
} from './StaxXmlIterableParser.js';
import {
  type AnyXmlEvent,
  type DocumentMode,
  type ParserEventFilter
} from './types.js';

export interface StaxXmlParserSyncOptions {
  autoDecodeEntities?: boolean;
  addEntities?: EntityDefinition[];
  eventFilter?: ParserEventFilter;
  documentMode?: DocumentMode;
}

const textEncoder = new TextEncoder();

export class StaxXmlParserSync implements Iterable<AnyXmlEvent>, Iterator<AnyXmlEvent> {
  private readonly parser: StaxXmlIterableParser;
  private readonly materializer: IterableEventMaterializer;
  private currentBatch: AnyXmlEvent[] = [];
  private batchIndex = 0;
  private done = false;

  private readonly iteratorResult: IteratorResult<AnyXmlEvent> = {
    value: undefined as unknown as AnyXmlEvent,
    done: false
  };
  private readonly doneResult: IteratorResult<AnyXmlEvent> = {
    value: undefined,
    done: true
  };

  constructor(xml: string, options: StaxXmlParserSyncOptions = {}) {
    if (typeof xml !== 'string') {
      throw new Error('xml must be a string.');
    }

    this.parser = new StaxXmlIterableParser(
      toByteBatches([textEncoder.encode(xml)], { batchSize: 1 }),
      { documentMode: options.documentMode }
    );
    this.materializer = new IterableEventMaterializer({
      autoDecodeEntities: options.autoDecodeEntities ?? true,
      addEntities: options.addEntities,
      eventFilter: options.eventFilter,
      trimText: true
    });
  }

  [Symbol.iterator](): Iterator<AnyXmlEvent> {
    return this;
  }

  next(): IteratorResult<AnyXmlEvent> {
    if (this.batchIndex >= this.currentBatch.length && !this.readNextNonEmptyBatch()) {
      return this.doneResult;
    }

    this.iteratorResult.value = this.currentBatch[this.batchIndex++]!;
    this.iteratorResult.done = false;
    return this.iteratorResult;
  }

  return(): IteratorResult<AnyXmlEvent> {
    this.done = true;
    this.currentBatch = [];
    this.batchIndex = 0;
    return this.doneResult;
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
    return false;
  }
}
