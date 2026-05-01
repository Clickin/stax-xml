import {
  IterableEventMaterializer,
  materializableEventCount,
  type EntityDefinition,
  type MaterializableEventSource,
} from './IterableEventBackend.js';
import {
  createJavaScriptIterableReader,
  toByteBatches
} from './IterableReader.js';
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

export interface EventReaderSyncOptions {
  autoDecodeEntities?: boolean;
  addEntities?: EntityDefinition[];
  eventFilter?: ParserEventFilter;
  documentMode?: DocumentMode;
  fallbackOnParseError?: boolean;
  /**
   * Include namespace-expanded event fields (`localName`, `prefix`, `uri`, and
   * `attributesWithPrefix`).
   *
   * @remarks
   * Disabled by default so the native sync reader can stay on the lean
   * structural-table materialization path. Enable this when namespace metadata
   * is part of the consumer contract.
   */
  namespaceAware?: boolean;
}

const textEncoder = new TextEncoder();

export class EventReaderSync implements Iterable<AnyXmlEvent>, Iterator<AnyXmlEvent> {
  private readonly parser: (MaterializableEventSource & { nextBatch(): boolean });
  private readonly materializer: IterableEventMaterializer;
  private readonly directIterator?: IterableIterator<AnyXmlEvent>;
  private sourceEventCount = 0;
  private sourceEventIndex = 0;
  private done = false;

  private readonly iteratorResult: IteratorResult<AnyXmlEvent> = {
    value: undefined as unknown as AnyXmlEvent,
    done: false
  };
  private readonly doneResult: IteratorResult<AnyXmlEvent> = {
    value: undefined,
    done: true
  };

  constructor(xml: string, options?: EventReaderSyncOptions);
  constructor(
    xml: string,
    options: EventReaderSyncOptions = {},
    runtimeBackendPreference?: StaxXmlRuntimeBackendPreference,
  ) {
    if (typeof xml !== 'string') {
      throw new Error('xml must be a string.');
    }

    const runtime = getStaxXmlRuntimeForSyncApi(runtimeBackendPreference);
    const xmlBytes = textEncoder.encode(xml);

    const directStructuralEvents = canUseDirectStructuralEvents(options);
    const acceleratedParser = this.tryCreateStructuralIndexParser(xmlBytes, runtime, options, {
      decodeEntities: directStructuralEvents ? options.autoDecodeEntities ?? true : false,
      trimText: directStructuralEvents,
    });
    this.directIterator = directStructuralEvents ? acceleratedParser : undefined;
    this.parser = acceleratedParser ?? createJavaScriptIterableReader(
      toByteBatches([xmlBytes], { batchSize: 1 }),
      { documentMode: options.documentMode }
    );
    this.materializer = new IterableEventMaterializer({
      autoDecodeEntities: options.autoDecodeEntities ?? true,
      addEntities: options.addEntities,
      eventFilter: options.eventFilter,
      namespaceAware: options.namespaceAware ?? false,
      trimText: true
    });
  }

  private tryCreateStructuralIndexParser(
    xmlBytes: Uint8Array,
    runtime: ReturnType<typeof getStaxXmlRuntimeForSyncApi>,
    options: EventReaderSyncOptions,
    parserOptions: { decodeEntities: boolean; trimText: boolean },
  ): StaxXmlStructuralIndexParser | undefined {
    const buildTable = runtime?.capabilities.structuralIndexUtf8;
    if (!runtime || runtime.backend.kind === 'js' || !buildTable) {
      return undefined;
    }

    try {
      return new StaxXmlStructuralIndexParser(xmlBytes, buildTable(xmlBytes), {
        decodeEntities: parserOptions.decodeEntities,
        sourceKind: 'utf8',
        trimText: parserOptions.trimText,
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
    if (this.done) {
      return this.doneResult;
    }

    if (this.directIterator) {
      return this.nextDirect();
    }

    for (;;) {
      if (this.sourceEventIndex >= this.sourceEventCount && !this.readNextNonEmptyBatch()) {
        return this.doneResult;
      }

      const event = this.materializer.materializeEvent(this.parser, this.sourceEventIndex++);
      if (event) {
        this.iteratorResult.value = event;
        this.iteratorResult.done = false;
        return this.iteratorResult;
      }
    }
  }

  return(): IteratorResult<AnyXmlEvent> {
    this.done = true;
    this.directIterator?.return?.();
    this.sourceEventCount = 0;
    this.sourceEventIndex = 0;
    return this.doneResult;
  }

  private nextDirect(): IteratorResult<AnyXmlEvent> {
    for (;;) {
      const result = this.directIterator!.next();
      if (result.done) {
        this.done = true;
        return this.doneResult;
      }
      const event = result.value;
      if (event.type === 'CHARACTERS' && !event.value) {
        continue;
      }
      this.iteratorResult.value = event;
      this.iteratorResult.done = false;
      return this.iteratorResult;
    }
  }

  private readNextNonEmptyBatch(): boolean {
    if (this.done) {
      return false;
    }

    while (this.parser.nextBatch()) {
      const count = materializableEventCount(this.parser);
      if (count > 0) {
        this.sourceEventCount = count;
        this.sourceEventIndex = 0;
        return true;
      }
    }

    this.done = true;
    this.sourceEventCount = 0;
    this.sourceEventIndex = 0;
    return false;
  }
}

function canUseDirectStructuralEvents(options: EventReaderSyncOptions): boolean {
  return options.namespaceAware !== true
    && options.eventFilter === undefined
    && (!options.addEntities || options.addEntities.length === 0);
}
