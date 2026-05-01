import { StreamingEventBatchReader } from './runtime/event-table.js';
import {
  getStaxXmlRuntimeForSyncApi,
  type StaxXmlRuntimeBackendPreference,
} from './runtime/native-backend.js';
import type { DocumentMode } from './types.js';

/**
 * Event type constants returned by {@link StreamReaderSync.next}.
 *
 * @public
 */
export const StreamEventType = {
  START_DOCUMENT: 0,
  END_DOCUMENT: 1,
  START_ELEMENT: 2,
  END_ELEMENT: 3,
  CHARACTERS: 4,
  CDATA: 5,
} as const;

/**
 * Numeric XML stream event type returned by {@link StreamReaderSync.next}.
 *
 * @public
 */
export type StreamEventType = typeof StreamEventType[keyof typeof StreamEventType];

/**
 * One synchronous input batch consumed by {@link StreamReaderSync}.
 *
 * @public
 */
export type StreamReaderSyncByteBatch = readonly Uint8Array[];

/**
 * Native sync pull-reader options.
 *
 * @public
 */
export interface StreamReaderSyncOptions {
  /**
   * Runtime backend to require from the initialized stax-xml runtime.
   *
   * @defaultValue 'auto'
   */
  backend?: StaxXmlRuntimeBackendPreference;

  /**
   * Text encoding passed to the native streaming backend when it supports it.
   *
   * @defaultValue 'utf-8'
   */
  encoding?: string;

  /**
   * XML document conformance mode passed to the native streaming backend.
   *
   * @defaultValue 'fragment'
   */
  documentMode?: DocumentMode;
}

/**
 * Native-only synchronous pull parser over byte batches.
 *
 * @remarks
 * `StreamReaderSync` is the lean StAX-style surface for hot pull loops. It
 * consumes `Iterable<readonly Uint8Array[]>` byte batches, or a single
 * `Uint8Array`/Node `Buffer` as a convenience one-batch input. Accessor values
 * are views over the current native event batch and are only valid until the
 * next {@link StreamReaderSync.next} call.
 *
 * This class intentionally has no public JavaScript parser fallback. Call
 * {@link initStaxXml} first with a native or wasm backend that exposes streaming
 * event batches.
 *
 * @public
 */
export class StreamReaderSync {
  private readonly reader: StreamingEventBatchReader;
  private sourceEventCount = 0;
  private sourceEventIndex = 0;
  private currentEventIndex = -1;
  private currentEventType: StreamEventType | null = null;
  private currentName: string | undefined | typeof UNSET = UNSET;
  private currentText: string | undefined | typeof UNSET = UNSET;
  private currentAttrNames: Array<string | undefined> | undefined;
  private currentAttrValues: Array<string | undefined> | undefined;
  private done = false;

  constructor(source: Iterable<StreamReaderSyncByteBatch>, options?: StreamReaderSyncOptions);
  constructor(source: Uint8Array, options?: StreamReaderSyncOptions);
  constructor(
    source: Iterable<StreamReaderSyncByteBatch> | Uint8Array,
    options: StreamReaderSyncOptions = {},
  ) {
    const runtime = getRequiredStreamingRuntime(options.backend);
    const factory = runtime.capabilities.streamingEventBatches!;
    const batches = source instanceof Uint8Array ? singleByteBatch(source) : source;
    this.reader = new StreamingEventBatchReader(
      factory({
        encoding: options.encoding,
        documentMode: options.documentMode,
      }),
      batches[Symbol.iterator](),
    );
  }

  /**
   * Advances to the next event and returns its type, or `null` after EOF.
   */
  next(): StreamEventType | null {
    if (this.done) {
      return null;
    }

    while (this.sourceEventIndex >= this.sourceEventCount) {
      if (!this.reader.nextBatch()) {
        this.done = true;
        this.currentEventIndex = -1;
        this.currentEventType = null;
        this.resetCurrentMemo();
        this.sourceEventCount = 0;
        this.sourceEventIndex = 0;
        return null;
      }

      this.sourceEventCount = this.reader.eventCount();
      this.sourceEventIndex = 0;
    }

    const eventIndex = this.sourceEventIndex++;
    const eventType = this.reader.eventType(eventIndex) as StreamEventType;
    this.currentEventIndex = eventIndex;
    this.currentEventType = eventType;
    this.resetCurrentMemo();
    return eventType;
  }

  /**
   * Returns the current event type, or `null` before the first event and after EOF.
   */
  eventType(): StreamEventType | null {
    return this.currentEventType;
  }

  /**
   * Returns the current element name for `START_ELEMENT` and `END_ELEMENT`.
   */
  name(): string | undefined {
    if (this.currentEventIndex < 0) {
      return undefined;
    }
    if (this.currentName !== UNSET) {
      return this.currentName;
    }
    this.currentName = this.reader.copyName(this.currentEventIndex);
    return this.currentName;
  }

  /**
   * Returns the current text for `CHARACTERS` and `CDATA`.
   */
  text(): string | undefined {
    if (this.currentEventIndex < 0) {
      return undefined;
    }
    if (this.currentText !== UNSET) {
      return this.currentText;
    }
    this.currentText = this.reader.copyText(this.currentEventIndex);
    return this.currentText;
  }

  /**
   * Returns the attribute count for the current `START_ELEMENT`.
   */
  getAttributeCount(): number {
    if (this.currentEventIndex < 0 || this.currentEventType !== StreamEventType.START_ELEMENT) {
      return 0;
    }
    return this.reader.attrCount(this.currentEventIndex);
  }

  /**
   * Returns the attribute name at `index` for the current `START_ELEMENT`.
   */
  getAttributeName(index: number): string | undefined {
    if (this.currentEventIndex < 0 || this.currentEventType !== StreamEventType.START_ELEMENT) {
      return undefined;
    }
    const attrNames = this.ensureCurrentAttrNames();
    if (index < 0 || index >= attrNames.length) {
      return undefined;
    }
    const cached = attrNames[index];
    if (cached !== undefined) {
      return cached;
    }
    const value = this.reader.copyAttrName(this.currentEventIndex, index);
    attrNames[index] = value;
    return value;
  }

  /**
   * Returns an attribute value by index or by name for the current `START_ELEMENT`.
   */
  getAttributeValue(indexOrName: number | string): string | undefined {
    if (this.currentEventIndex < 0 || this.currentEventType !== StreamEventType.START_ELEMENT) {
      return undefined;
    }
    if (typeof indexOrName === 'number') {
      const attrValues = this.ensureCurrentAttrValues();
      if (indexOrName < 0 || indexOrName >= attrValues.length) {
        return undefined;
      }
      const cached = attrValues[indexOrName];
      if (cached !== undefined) {
        return cached;
      }
      const value = this.reader.copyAttrValue(this.currentEventIndex, indexOrName);
      attrValues[indexOrName] = value;
      return value;
    }

    const attrCount = this.getAttributeCount();
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      if (this.getAttributeName(attrIndex) === indexOrName) {
        return this.getAttributeValue(attrIndex);
      }
    }
    return undefined;
  }

  private ensureCurrentAttrNames(): Array<string | undefined> {
    if (!this.currentAttrNames) {
      this.currentAttrNames = new Array<string | undefined>(this.getAttributeCount());
    }
    return this.currentAttrNames;
  }

  private ensureCurrentAttrValues(): Array<string | undefined> {
    if (!this.currentAttrValues) {
      this.currentAttrValues = new Array<string | undefined>(this.getAttributeCount());
    }
    return this.currentAttrValues;
  }

  private resetCurrentMemo(): void {
    this.currentName = UNSET;
    this.currentText = UNSET;
    this.currentAttrNames = undefined;
    this.currentAttrValues = undefined;
  }
}

function getRequiredStreamingRuntime(backend: StaxXmlRuntimeBackendPreference | undefined) {
  try {
    const runtime = getStaxXmlRuntimeForSyncApi(backend);
    if (runtime?.capabilities.streamingEventBatches) {
      return runtime;
    }
  } catch (cause) {
    throw streamReaderCapabilityError(cause);
  }
  throw streamReaderCapabilityError();
}

function streamReaderCapabilityError(cause?: unknown): Error {
  const error = new Error(
    'StreamReaderSync requires an initialized native or wasm streaming event batch backend. ' +
      'Call initStaxXml({ backend: "native" }) or initStaxXml({ backend: "wasm" }) before constructing StreamReaderSync; ' +
      'no JavaScript fallback is used for this API.',
  );
  if (cause !== undefined) {
    (error as Error & { cause?: unknown }).cause = cause;
  }
  return error;
}

function* singleByteBatch(source: Uint8Array): Iterable<StreamReaderSyncByteBatch> {
  yield [source];
}

const UNSET = Symbol('stream-reader-unset');
