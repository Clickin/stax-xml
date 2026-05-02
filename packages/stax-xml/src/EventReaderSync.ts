import {
  IterableEventMaterializer,
  type EntityDefinition,
  type MaterializableEventSource,
} from './IterableEventBackend.js';
import { createJavaScriptIterableReader, toByteBatches } from './IterableReader.js';
import { getInitializedStaxXmlRuntime } from './runtime/index.js';
import { StreamReaderSync, type StreamBatch } from './StreamReaderSync.js';
import type { AnyXmlEvent, DocumentMode, ParserEventFilter } from './types.js';

const textEncoder = new TextEncoder();

/**
 * Synchronous event reader options.
 *
 * @public
 */
export interface EventReaderSyncOptions {
  autoDecodeEntities?: boolean;
  addEntities?: EntityDefinition[];
  eventFilter?: ParserEventFilter;
  documentMode?: DocumentMode;
  namespaceAware?: boolean;
}

/**
 * Event-object adapter over the batch-first sync stream core.
 *
 * @public
 */
export class EventReaderSync implements Iterable<AnyXmlEvent>, Iterator<AnyXmlEvent> {
  private readonly source: SyncEventBatchSource;
  private bufferedEvents: AnyXmlEvent[] = [];
  private bufferedIndex = 0;
  private finished = false;

  private readonly iteratorResult: IteratorResult<AnyXmlEvent> = {
    value: undefined as unknown as AnyXmlEvent,
    done: false,
  };
  private readonly doneResult: IteratorResult<AnyXmlEvent> = {
    value: undefined,
    done: true,
  };

  constructor(xml: string, options: EventReaderSyncOptions = {}) {
    if (typeof xml !== 'string') {
      throw new Error('xml must be a string.');
    }

    const materializer = new IterableEventMaterializer({
      autoDecodeEntities: options.autoDecodeEntities ?? true,
      addEntities: options.addEntities,
      eventFilter: options.eventFilter,
      namespaceAware: options.namespaceAware ?? true,
      trimText: false,
    });
    const bytes = textEncoder.encode(xml);
    const runtime = getInitializedStaxXmlRuntime();

    if (!runtime) {
      const parser = createJavaScriptIterableReader(
        toByteBatches([bytes], { batchSize: 1 }),
        { documentMode: options.documentMode },
      );
      this.source = new JavaScriptSyncEventBatchSource(parser, materializer);
      return;
    }

    if (!runtime.capabilities.streamingEventBatches) {
      throw new Error(
        'EventReaderSync requires a streaming event batch runtime once stax-xml has been initialized. ' +
          'JavaScript fallback is only used before initStaxXml().',
      );
    }

    this.source = new CoreSyncEventBatchSource(
      new StreamReaderSync(bytes, { documentMode: options.documentMode }),
      materializer,
    );
  }

  nextBatch(): AnyXmlEvent[] | null {
    if (this.finished) {
      return null;
    }
    if (this.bufferedIndex < this.bufferedEvents.length) {
      const remaining = this.bufferedEvents.slice(this.bufferedIndex);
      this.bufferedEvents = [];
      this.bufferedIndex = 0;
      return remaining;
    }
    const batch = this.source.nextBatch();
    if (batch === null) {
      this.finished = true;
      return null;
    }
    return batch;
  }

  *batchedIterator(): IterableIterator<AnyXmlEvent[]> {
    while (true) {
      const batch = this.nextBatch();
      if (batch === null) {
        return;
      }
      yield batch;
    }
  }

  [Symbol.iterator](): Iterator<AnyXmlEvent> {
    return this;
  }

  next(): IteratorResult<AnyXmlEvent> {
    if (this.finished) {
      return this.doneResult;
    }

    if (this.bufferedIndex >= this.bufferedEvents.length) {
      const batch = this.source.nextBatch();
      if (batch === null) {
        this.finished = true;
        return this.doneResult;
      }
      this.bufferedEvents = batch;
      this.bufferedIndex = 0;
    }

    this.iteratorResult.value = this.bufferedEvents[this.bufferedIndex]!;
    this.bufferedIndex++;
    this.iteratorResult.done = false;
    return this.iteratorResult;
  }

  return(): IteratorResult<AnyXmlEvent> {
    this.finished = true;
    this.bufferedEvents = [];
    this.bufferedIndex = 0;
    return this.doneResult;
  }
}

interface SyncEventBatchSource {
  nextBatch(): AnyXmlEvent[] | null;
}

class CoreSyncEventBatchSource implements SyncEventBatchSource {
  constructor(
    private readonly reader: StreamReaderSync,
    private readonly materializer: IterableEventMaterializer,
  ) {}

  nextBatch(): AnyXmlEvent[] | null {
    while (true) {
      const batch = this.reader.nextBatch();
      if (batch === null) {
        return null;
      }
      const events = this.materializer.materializeBatch(toMaterializableEventSource(batch));
      if (events.length > 0) {
        return events;
      }
    }
  }
}

class JavaScriptSyncEventBatchSource implements SyncEventBatchSource {
  constructor(
    private readonly parser: MaterializableEventSource & { nextBatch(): boolean },
    private readonly materializer: IterableEventMaterializer,
  ) {}

  nextBatch(): AnyXmlEvent[] | null {
    while (this.parser.nextBatch()) {
      const events = this.materializer.materializeBatch(this.parser);
      if (events.length > 0) {
        return events;
      }
    }
    return null;
  }
}

function toMaterializableEventSource(batch: StreamBatch): MaterializableEventSource {
  return {
    eventCount: () => batch.eventCount,
    attrCount: (eventIndex: number) => batch.attributeCountAt(eventIndex),
    eventType: (index: number) => batch.typeAt(index),
    copyName: (index: number) => batch.nameAt(index),
    copyText: (index: number) => batch.textAt(index),
    copyAttrName: (eventIndex: number, attrIndex: number) => batch.attributeNameAt(eventIndex, attrIndex),
    copyAttrValue: (eventIndex: number, attrIndex: number) => {
      return batch.attributeValueAt(eventIndex, attrIndex);
    },
  };
}
