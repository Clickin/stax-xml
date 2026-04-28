import {
  IterableEventMaterializer,
  type EntityDefinition,
  type MaterializableEventSource,
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
import {
  getStaxXmlRuntimeForSyncApi,
  type StaxXmlRuntimeBackendPreference,
} from './runtime/native-backend.js';
import { StaxXmlStructuralIndexParser } from './runtime/structural-index-parser.js';

export interface StaxXmlParserSyncOptions {
  autoDecodeEntities?: boolean;
  addEntities?: EntityDefinition[];
  eventFilter?: ParserEventFilter;
  documentMode?: DocumentMode;
  backend?: StaxXmlRuntimeBackendPreference;
  fallbackOnLoadError?: boolean;
  fallbackOnParseError?: boolean;
}

const textEncoder = new TextEncoder();

export class StaxXmlParserSync implements Iterable<AnyXmlEvent>, Iterator<AnyXmlEvent> {
  private readonly parser: (MaterializableEventSource & { nextBatch(): boolean });
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

    const runtime = getStaxXmlRuntimeForSyncApi(options.backend);
    if (
      runtime
      && runtime.backend.kind !== 'js'
      && !runtime.capabilities.structuralIndexUtf16
      && options.backend !== undefined
      && options.backend !== 'auto'
      && options.fallbackOnLoadError !== true
    ) {
      throw new Error(`Initialized ${options.backend} backend does not provide structuralIndexUtf16 capability.`);
    }

    const acceleratedParser = this.tryCreateStructuralIndexParser(xml, runtime, options);
    this.parser = acceleratedParser ?? new StaxXmlIterableParser(
      toByteBatches([textEncoder.encode(xml)], { batchSize: 1 }),
      { documentMode: options.documentMode, backend: 'js' }
    );
    this.materializer = new IterableEventMaterializer({
      autoDecodeEntities: options.autoDecodeEntities ?? true,
      addEntities: options.addEntities,
      eventFilter: options.eventFilter,
      trimText: true
    });
  }

  private tryCreateStructuralIndexParser(
    xml: string,
    runtime: ReturnType<typeof getStaxXmlRuntimeForSyncApi>,
    options: StaxXmlParserSyncOptions,
  ): StaxXmlStructuralIndexParser | undefined {
    const buildTable = runtime?.capabilities.structuralIndexUtf16;
    if (!runtime || runtime.backend.kind === 'js' || !buildTable) {
      return undefined;
    }

    try {
      return new StaxXmlStructuralIndexParser(xml, buildTable(xml), {
        decodeEntities: false,
        sourceKind: 'utf16',
      });
    } catch (error) {
      if (options.fallbackOnParseError === true) {
        return undefined;
      }
      throw error;
    }
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
