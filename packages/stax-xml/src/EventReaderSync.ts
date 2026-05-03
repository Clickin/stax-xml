import {
  IterableEventMaterializer,
  type EntityDefinition,
  type MaterializableEventSource,
} from './IterableEventBackend.js';
import { StreamReaderSync, type StreamBatch } from './StreamReaderSync.js';
import { StringEventParserSync } from './StringEventParserSync.js';
import { XmlEventType, type AnyXmlEvent, type DocumentMode, type ParserEventFilter } from './types.js';

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
  private readonly source: SyncEventSource;
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

    const useLegacyStringParser = (options.documentMode ?? 'fragment') === 'fragment';
    if (useLegacyStringParser) {
      this.source = new StringSyncEventSource(
        new StringEventParserSync(xml, {
          autoDecodeEntities: options.autoDecodeEntities,
          addEntities: options.addEntities,
          eventFilter: options.eventFilter,
          namespaceAware: options.namespaceAware,
        }),
      );
      return;
    }

    this.source = new CoreSyncEventSource(
      new StreamReaderSync(textEncoder.encode(xml), { documentMode: options.documentMode }),
      materializer,
    );
  }

  nextBatch(): AnyXmlEvent[] | null {
    if (this.finished) {
      return null;
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

    const event = this.source.nextEvent();
    if (event === null) {
      this.finished = true;
      return this.doneResult;
    }
    this.iteratorResult.value = event;
    this.iteratorResult.done = false;
    return this.iteratorResult;
  }

  return(): IteratorResult<AnyXmlEvent> {
    this.finished = true;
    return this.doneResult;
  }
}

interface SyncEventSource {
  nextBatch(): AnyXmlEvent[] | null;
  nextEvent(): AnyXmlEvent | null;
}

class CoreSyncEventSource implements SyncEventSource {
  private bufferedEvents: AnyXmlEvent[] = [];
  private bufferedIndex = 0;

  constructor(
    private readonly reader: StreamReaderSync,
    private readonly materializer: IterableEventMaterializer,
  ) {}

  nextBatch(): AnyXmlEvent[] | null {
    if (this.bufferedIndex < this.bufferedEvents.length) {
      const remaining = this.bufferedEvents.slice(this.bufferedIndex);
      this.bufferedEvents = [];
      this.bufferedIndex = 0;
      return remaining;
    }

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

  nextEvent(): AnyXmlEvent | null {
    if (this.bufferedIndex >= this.bufferedEvents.length) {
      const batch = this.nextBatch();
      if (batch === null) {
        return null;
      }
      this.bufferedEvents = batch;
      this.bufferedIndex = 0;
    }
    const event = this.bufferedEvents[this.bufferedIndex]!;
    this.bufferedIndex++;
    if (this.bufferedIndex >= this.bufferedEvents.length) {
      this.bufferedEvents = [];
      this.bufferedIndex = 0;
    }
    return event;
  }
}

class StringSyncEventSource implements SyncEventSource {
  private bufferedEvent: AnyXmlEvent | null = null;
  private finished = false;

  constructor(private readonly parser: Iterator<AnyXmlEvent>) {}

  nextBatch(): AnyXmlEvent[] | null {
    if (this.finished) {
      return null;
    }

    const batch: AnyXmlEvent[] = [];
    if (this.bufferedEvent) {
      batch.push(this.bufferedEvent);
      this.bufferedEvent = null;
    }
    for (;;) {
      const result = this.parser.next();
      if (result.done) {
        this.finished = true;
        return batch.length > 0 ? batch : null;
      }
      if (result.value.type === XmlEventType.END_DOCUMENT) {
        if (batch.length === 0) {
          this.finished = true;
          return [result.value];
        }
        this.bufferedEvent = result.value;
        return batch;
      }
      batch.push(result.value);
    }
  }

  nextEvent(): AnyXmlEvent | null {
    if (this.finished) {
      return null;
    }
    if (this.bufferedEvent) {
      const event = this.bufferedEvent;
      this.bufferedEvent = null;
      if (event.type === XmlEventType.END_DOCUMENT) {
        this.finished = true;
      }
      return event;
    }

    const result = this.parser.next();
    if (result.done) {
      this.finished = true;
      return null;
    }
    if (result.value.type === XmlEventType.END_DOCUMENT) {
      this.finished = true;
    }
    return result.value;
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
