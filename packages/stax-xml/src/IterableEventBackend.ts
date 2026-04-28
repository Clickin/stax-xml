import {
  IterableEventType,
  StaxXmlIterableParser,
  toAsyncByteBatches,
  toByteBatches,
  type ByteBatch,
  type ByteBatchOptions
} from './StaxXmlIterableParser.js';
import {
  XmlEventType,
  type AnyXmlEvent,
  type AttributeInfo,
  type DocumentMode,
  type ParserEventFilter
} from './types.js';
import {
  getStaxXmlRuntimeForSyncApi,
  type StaxXmlRuntimeBackendPreference,
} from './runtime/native-backend.js';

export interface EntityDefinition {
  entity: string;
  value: string;
}

export interface IterableEventBackendOptions {
  encoding?: string;
  incompleteFinalMarkupMessage?: string;
  emitStartDocumentBatchImmediately?: boolean;
  maxChunkBytes?: number;
  batchSize?: number;
  autoDecodeEntities?: boolean;
  decodeEntities?: boolean;
  addEntities?: EntityDefinition[];
  eventFilter?: ParserEventFilter;
  trimText?: boolean;
  implicitAttributeValue?: 'true' | 'name';
  documentMode?: DocumentMode;
  backend?: StaxXmlRuntimeBackendPreference;
  fallbackOnLoadError?: boolean;
  fallbackOnParseError?: boolean;
}

export const STAX_XML_EVENT_BACKEND: unique symbol = Symbol.for('stax-xml.eventBackend') as never;
export const STAX_XML_EVENT_TABLE: unique symbol = Symbol.for('stax-xml.eventTable') as never;

export interface IterableEventTable {
  nextBatch(): boolean;
  eventCount: number;
  eventType(index: number): IterableEventType;
  copyName(index: number): string | undefined;
  copyText(index: number): string | undefined;
  eventAttrCount(eventIndex: number): number;
  copyAttrName(eventIndex: number, attrIndex: number): string | undefined;
  copyAttrValue(eventIndex: number, attrIndex: number): string | undefined;
  copyAttrValueByName?(eventIndex: number, name: string): string | undefined;
}

export interface IterableEventBackendProvider {
  [STAX_XML_EVENT_BACKEND](): IterableEventBackendIterator;
}

export interface IterableEventTableProvider {
  [STAX_XML_EVENT_TABLE](): IterableEventTable | undefined;
}

export function getIterableEventBackend(input: unknown): IterableEventBackendIterator | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const provider = input as Partial<IterableEventBackendProvider>;
  const getBackend = provider[STAX_XML_EVENT_BACKEND];
  if (typeof getBackend !== 'function') {
    return undefined;
  }
  return getBackend.call(input);
}

export function getIterableEventTable(input: unknown): IterableEventTable | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const provider = input as Partial<IterableEventTableProvider>;
  const getTable = provider[STAX_XML_EVENT_TABLE];
  if (typeof getTable !== 'function') {
    return undefined;
  }
  return getTable.call(input);
}

const DEFAULT_ENTITY_REGEX = /&(lt|gt|quot|apos|amp);/g;
const DEFAULT_ENTITY_MAP: Record<string, string> = {
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  amp: '&'
};
const ENTITY_REGEX_CACHE = new Map<string, RegExp>();
const EMPTY_NAMESPACES = new Map<string, string>();
const utf8Decoder = new TextDecoder();
const STRUCTURAL_INDEX_MAGIC = 0x31545053;
const STRUCTURAL_INDEX_HEADER_BYTES = 28;
const STRUCTURAL_INDEX_EVENT_BYTES = 28;
const STRUCTURAL_INDEX_ATTR_BYTES = 16;

type ElementContext = {
  name: string;
  localName: string;
  prefix: string | undefined;
  uri: string | undefined;
  namespaces: Map<string, string>;
};

export class IterableEventBackendIterator implements AsyncIterator<AnyXmlEvent>, AsyncIterable<AnyXmlEvent> {
  private sourceBatchIterator?: AsyncGenerator<AnyXmlEvent[]>;
  private bufferedEvents: AnyXmlEvent[] = [];
  private bufferedIndex = 0;
  private error: Error | undefined;
  private finished = false;

  constructor(
    private readonly stream: ReadableStream<Uint8Array>,
    private readonly options: IterableEventBackendOptions = {}
  ) {
    const runtime = getStaxXmlRuntimeForSyncApi(options.backend);
    if (
      runtime
      && runtime.backend.kind !== 'js'
      && !runtime.capabilities.streamingEventBatches
      && options.backend !== undefined
      && options.backend !== 'auto'
      && options.fallbackOnLoadError !== true
    ) {
      throw new Error(`Initialized ${options.backend} backend does not provide streamingEventBatches capability.`);
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<AnyXmlEvent> {
    return this;
  }

  async next(): Promise<IteratorResult<AnyXmlEvent>> {
    if (this.error) {
      throw this.error;
    }

    if (this.bufferedIndex >= this.bufferedEvents.length) {
      const batch = await this.nextBatch();
      if (batch.length === 0) {
        return { value: undefined, done: true };
      }
      this.bufferedEvents = batch;
      this.bufferedIndex = 0;
    }

    const value = this.bufferedEvents[this.bufferedIndex]!;
    this.bufferedIndex++;
    return { value, done: false };
  }

  async return(): Promise<IteratorResult<AnyXmlEvent>> {
    this.finished = true;
    this.bufferedEvents = [];
    this.bufferedIndex = 0;
    if (this.sourceBatchIterator) {
      await this.sourceBatchIterator.return(undefined);
    }
    return { value: undefined, done: true };
  }

  async nextBatch(): Promise<AnyXmlEvent[]> {
    if (this.error) {
      throw this.error;
    }
    if (this.finished) {
      return [];
    }

    if (this.bufferedIndex < this.bufferedEvents.length) {
      const remaining = this.bufferedEvents.slice(this.bufferedIndex);
      this.bufferedEvents = [];
      this.bufferedIndex = 0;
      return remaining;
    }

    try {
      const nextBatch = await this.ensureSourceBatchIterator().next();
      if (nextBatch.done) {
        this.finished = true;
        return [];
      }
      return nextBatch.value;
    } catch (error) {
      this.error = error as Error;
      throw this.error;
    }
  }

  async *batchedIterator(): AsyncGenerator<AnyXmlEvent[]> {
    while (true) {
      const batch = await this.nextBatch();
      if (batch.length === 0) {
        break;
      }
      yield batch;
    }
  }

  private ensureSourceBatchIterator(): AsyncGenerator<AnyXmlEvent[]> {
    this.sourceBatchIterator ??= this.readMaterializedBatches();
    return this.sourceBatchIterator;
  }

  private async *readMaterializedBatches(): AsyncGenerator<AnyXmlEvent[]> {
    const nativeBatches = this.readNativeStreamingBatches();
    if (nativeBatches) {
      yield* nativeBatches;
      return;
    }

    const parser = new StaxXmlIterableParser([], {
      encoding: this.options.encoding,
      incompleteFinalMarkupMessage: this.options.incompleteFinalMarkupMessage,
      emitStartDocumentBatchImmediately: this.options.emitStartDocumentBatchImmediately,
      documentMode: this.options.documentMode
    });
    const materializer = new IterableEventMaterializer(this.options);

    if (this.options.emitStartDocumentBatchImmediately && parser.pushByteBatch([], false)) {
      const batch = materializer.materializeBatch(parser);
      yield batch;
    }

    for await (const byteBatch of readReadableStreamByteBatches(this.stream, this.options)) {
      if (!parser.pushByteBatch(byteBatch, false)) {
        continue;
      }
      const batch = materializer.materializeBatch(parser);
      if (batch.length > 0) {
        yield batch;
      }
    }

    parser.pushByteBatch([], true);

    const finalBatch = materializer.materializeBatch(parser);
    yield finalBatch;
  }

  private readNativeStreamingBatches(): AsyncGenerator<AnyXmlEvent[]> | undefined {
    const runtime = getStaxXmlRuntimeForSyncApi(this.options.backend);
    const createStreamingParser = runtime?.capabilities.streamingEventBatches;
    if (!createStreamingParser) {
      return undefined;
    }
    const streamingParser = createStreamingParser({
      encoding: this.options.encoding,
      documentMode: this.options.documentMode,
    });
    const stream = this.stream;
    const options = this.options;

    return (async function* (): AsyncGenerator<AnyXmlEvent[]> {
      const materializer = new IterableEventMaterializer(options);
      for await (const chunk of readReadableStreamChunksIncrementally(stream, options.maxChunkBytes)) {
        const batch = streamingParser.pushChunk(chunk, false);
        yield* materializeNativeStreamingBatch(batch.buffer, batch.table, materializer, options);
      }
      const finalBatch = streamingParser.pushChunk(new Uint8Array(0), true);
      yield* materializeNativeStreamingBatch(finalBatch.buffer, finalBatch.table, materializer, options);
    })();
  }
}

function* materializeNativeStreamingBatch(
  buffer: ArrayBuffer | ArrayBufferView,
  table: ArrayBuffer | ArrayBufferView,
  materializer: IterableEventMaterializer,
  options: IterableEventBackendOptions,
): Generator<AnyXmlEvent[]> {
  const source = toUint8Array(buffer);
  const parser = new StreamingSpanTableAdapter(source, table);
  while (parser.nextBatch()) {
    const batch = materializer.materializeBatch(parser as unknown as StaxXmlIterableParser);
    if (batch.length > 0) {
      yield batch;
    }
  }
}

class StreamingSpanTableAdapter {
  readonly eventCountValue: number;
  private readonly attrBase: number;
  private readonly view: DataView;
  private consumed = false;

  constructor(
    private readonly source: Uint8Array,
    table: ArrayBuffer | ArrayBufferView,
  ) {
    this.view = table instanceof ArrayBuffer
      ? new DataView(table)
      : new DataView(table.buffer, table.byteOffset, table.byteLength);
    const magic = this.view.getUint32(0, true);
    if (magic !== STRUCTURAL_INDEX_MAGIC) {
      throw new Error(`Invalid streaming structural index magic: 0x${magic.toString(16)}`);
    }
    this.eventCountValue = this.view.getUint32(4, true);
    const attrCount = this.view.getUint32(8, true);
    const sourceUnits = this.view.getUint32(12, true);
    const eventStride = this.view.getUint32(16, true);
    const attrStride = this.view.getUint32(20, true);
    if (sourceUnits !== source.byteLength) {
      throw new Error(`Streaming structural index input length mismatch: ${sourceUnits}/${source.byteLength}`);
    }
    if (eventStride !== STRUCTURAL_INDEX_EVENT_BYTES || attrStride !== STRUCTURAL_INDEX_ATTR_BYTES) {
      throw new Error(`Unsupported streaming structural index strides: ${eventStride}/${attrStride}`);
    }
    this.attrBase = STRUCTURAL_INDEX_HEADER_BYTES + this.eventCountValue * STRUCTURAL_INDEX_EVENT_BYTES;
    const expectedBytes = this.attrBase + attrCount * STRUCTURAL_INDEX_ATTR_BYTES;
    if (this.view.byteLength !== expectedBytes) {
      throw new Error('Streaming structural index table length mismatch');
    }
  }

  eventCount(): number {
    return this.eventCountValue;
  }

  nextBatch(): boolean {
    if (this.consumed || this.eventCountValue === 0) {
      return false;
    }
    this.consumed = true;
    return true;
  }

  eventType(index: number): IterableEventType {
    const type = this.view.getUint32(this.eventOffset(index), true);
    if (type === 0) return IterableEventType.START_DOCUMENT;
    if (type === 1) return IterableEventType.END_DOCUMENT;
    if (type === 2) return IterableEventType.START_ELEMENT;
    if (type === 3) return IterableEventType.END_ELEMENT;
    if (type === 4) return IterableEventType.CHARACTERS;
    if (type === 5) return IterableEventType.CDATA;
    throw new Error(`Unsupported streaming structural index event type: ${type}`);
  }

  copyName(index: number): string | undefined {
    return this.copySpan(
      this.view.getInt32(this.eventOffset(index) + 4, true),
      this.view.getInt32(this.eventOffset(index) + 8, true),
    );
  }

  copyText(index: number): string | undefined {
    return this.copySpan(
      this.view.getInt32(this.eventOffset(index) + 12, true),
      this.view.getInt32(this.eventOffset(index) + 16, true),
    );
  }

  attrCount(index: number): number {
    return this.view.getUint32(this.eventOffset(index) + 24, true);
  }

  copyAttrName(eventIndex: number, attrIndex: number): string | undefined {
    return this.copySpan(
      this.view.getInt32(this.attrOffset(eventIndex, attrIndex), true),
      this.view.getInt32(this.attrOffset(eventIndex, attrIndex) + 4, true),
    );
  }

  copyAttrValue(eventIndex: number, attrIndex: number): string | undefined {
    return this.copySpan(
      this.view.getInt32(this.attrOffset(eventIndex, attrIndex) + 8, true),
      this.view.getInt32(this.attrOffset(eventIndex, attrIndex) + 12, true),
    );
  }

  isImplicitAttributeValue(): boolean {
    return false;
  }

  private eventOffset(index: number): number {
    return STRUCTURAL_INDEX_HEADER_BYTES + index * STRUCTURAL_INDEX_EVENT_BYTES;
  }

  private attrOffset(eventIndex: number, attrIndex: number): number {
    const attrStart = this.view.getUint32(this.eventOffset(eventIndex) + 20, true);
    return this.attrBase + (attrStart + attrIndex) * STRUCTURAL_INDEX_ATTR_BYTES;
  }

  private copySpan(start: number, end: number): string | undefined {
    if (start < 0 || end < 0) {
      return undefined;
    }
    return utf8Decoder.decode(this.source.subarray(start, end));
  }
}

function toUint8Array(input: ArrayBuffer | ArrayBufferView): Uint8Array {
  return input instanceof Uint8Array
    ? input
    : input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}

export async function* readReadableStreamByteBatches(
  stream: ReadableStream<Uint8Array>,
  options: ByteBatchOptions & { maxChunkBytes?: number } = {}
): AsyncGenerator<ByteBatch> {
  yield* toAsyncByteBatches(readReadableStreamChunksIncrementally(stream, options.maxChunkBytes), {
    batchSize: options.batchSize
  });
}

export async function* readReadableStreamChunksIncrementally(
  stream: ReadableStream<Uint8Array>,
  maxChunkBytes?: number
): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader();
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      const chunk = result.value;
      if (!maxChunkBytes || maxChunkBytes <= 0 || chunk.byteLength <= maxChunkBytes) {
        yield chunk;
        continue;
      }
      for (let offset = 0; offset < chunk.byteLength; offset += maxChunkBytes) {
        yield chunk.slice(offset, Math.min(offset + maxChunkBytes, chunk.byteLength));
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function readReadableStreamChunks(stream: ReadableStream<Uint8Array>): Promise<Uint8Array[]> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  return chunks;
}

export function createIterableParserFromChunks(
  chunks: Iterable<Uint8Array>,
  options: ByteBatchOptions & {
    encoding?: string;
    incompleteFinalMarkupMessage?: string;
    emitStartDocumentBatchImmediately?: boolean;
    documentMode?: DocumentMode;
  } = { batchSize: 1 }
): StaxXmlIterableParser {
  return new StaxXmlIterableParser(
    toByteBatches(chunks, { batchSize: options.batchSize }),
    {
      encoding: options.encoding,
      incompleteFinalMarkupMessage: options.incompleteFinalMarkupMessage,
      emitStartDocumentBatchImmediately: options.emitStartDocumentBatchImmediately,
      documentMode: options.documentMode
    }
  );
}

export function materializeIterableEventBatch(
  parser: StaxXmlIterableParser,
  options: IterableEventBackendOptions = {},
  eventFilter?: ParserEventFilter
): AnyXmlEvent[] {
  return new IterableEventMaterializer(
    eventFilter ? { ...options, eventFilter } : options
  ).materializeBatch(parser);
}

export class IterableEventMaterializer {
  private readonly namespaceStack: Map<string, string>[] = [EMPTY_NAMESPACES];
  private readonly elementStack: ElementContext[] = [];
  private readonly entityDecoder: (value: string) => string;

  constructor(private readonly options: IterableEventBackendOptions = {}) {
    this.entityDecoder = compileEntityDecoder(options);
  }

  materializeBatch(parser: StaxXmlIterableParser): AnyXmlEvent[] {
    const events: AnyXmlEvent[] = [];
    for (let index = 0; index < parser.eventCount(); index++) {
      const event = this.materializeEvent(parser, index);
      if (event) {
        events.push(event);
      }
    }
    return events;
  }

  private materializeEvent(parser: StaxXmlIterableParser, index: number): AnyXmlEvent | undefined {
    const type = parser.eventType(index);

    if (type === IterableEventType.START_DOCUMENT) {
      return { type: XmlEventType.START_DOCUMENT };
    }
    if (type === IterableEventType.END_DOCUMENT) {
      return { type: XmlEventType.END_DOCUMENT };
    }
    if (type === IterableEventType.START_ELEMENT) {
      return this.materializeStartElement(parser, index);
    }
    if (type === IterableEventType.END_ELEMENT) {
      return this.materializeEndElement(parser, index);
    }
    if (type === IterableEventType.CHARACTERS) {
      if (this.options.eventFilter?.includeCharacters === false) {
        return undefined;
      }
      const value = this.materializeText(parser.copyText(index)!);
      if (!value) {
        return undefined;
      }
      return {
        type: XmlEventType.CHARACTERS,
        value
      };
    }
    if (this.options.eventFilter?.includeCdata === false) {
      return undefined;
    }
    return {
      type: XmlEventType.CDATA,
      value: this.entityDecoder(parser.copyText(index)!)
    };
  }

  private materializeText(value: string): string {
    const decoded = this.entityDecoder(value);
    return this.options.trimText ? decoded.trim() : decoded;
  }

  private materializeStartElement(parser: StaxXmlIterableParser, index: number): AnyXmlEvent {
    const name = parser.copyName(index)!;
    const parentNamespaces = this.namespaceStack[this.namespaceStack.length - 1]!;
    const parsedAttributes = this.copyAttributes(parser, index, parentNamespaces);
    const namespaces = parsedAttributes.namespaces;
    const qname = splitQName(name, namespaces);
    const attributes = this.options.eventFilter?.includeAttributes === false
      ? {}
      : parsedAttributes.attributes;
    const attributesWithPrefix = this.options.eventFilter?.includeAttributes === false
      ? {}
      : parsedAttributes.attributesWithPrefix;

    this.namespaceStack.push(namespaces);
    this.elementStack.push({
      name,
      localName: qname.localName,
      prefix: qname.prefix,
      uri: qname.uri,
      namespaces
    });

    return {
      type: XmlEventType.START_ELEMENT,
      name,
      localName: qname.localName,
      prefix: qname.prefix,
      uri: qname.uri,
      attributes,
      attributesWithPrefix
    };
  }

  private materializeEndElement(parser: StaxXmlIterableParser, index: number): AnyXmlEvent {
    const name = parser.copyName(index)!;
    const context = this.elementStack.pop();
    this.namespaceStack.pop();
    if (context && context.name === name) {
      return {
        type: XmlEventType.END_ELEMENT,
        name,
        localName: context.localName,
        prefix: context.prefix,
        uri: context.uri
      };
    }

    const namespaces = context?.namespaces ?? this.namespaceStack[this.namespaceStack.length - 1];
    const qname = splitQName(name, namespaces);
    return {
      type: XmlEventType.END_ELEMENT,
      name,
      localName: qname.localName,
      prefix: qname.prefix,
      uri: qname.uri
    };
  }

  private copyAttributes(
    parser: StaxXmlIterableParser,
    eventIndex: number,
    parentNamespaces: Map<string, string>
  ): {
    attributes: Record<string, string>;
    attributesWithPrefix: Record<string, AttributeInfo>;
    namespaces: Map<string, string>;
  } {
    const count = parser.attrCount(eventIndex);
    if (count === 0) {
      return { attributes: {}, attributesWithPrefix: {}, namespaces: parentNamespaces };
    }

    const rawAttributes: Array<{ name: string; value: string }> = [];
    let namespaces = parentNamespaces;
    let namespaceCopied = false;

    for (let attrIndex = 0; attrIndex < count; attrIndex++) {
      const name = parser.copyAttrName(eventIndex, attrIndex)!;
      const implicitValue = this.options.implicitAttributeValue ?? 'true';
      const value = parser.isImplicitAttributeValue(eventIndex, attrIndex)
        ? (implicitValue === 'name' ? name : 'true')
        : this.entityDecoder(parser.copyAttrValue(eventIndex, attrIndex)!);
      rawAttributes.push({ name, value });

      if (name === 'xmlns' || (name.length >= 6 && name.charCodeAt(5) === 58 && name.slice(0, 5) === 'xmlns')) {
        if (!namespaceCopied) {
          namespaces = new Map(parentNamespaces);
          namespaceCopied = true;
        }
        namespaces.set(name === 'xmlns' ? '' : name.slice(6), value);
      }
    }

    const attributes: Record<string, string> = nullRecord();
    const attributesWithPrefix: Record<string, AttributeInfo> = nullRecord();
    for (const attribute of rawAttributes) {
      defineData(attributes, attribute.name, attribute.value);
      defineData(attributesWithPrefix, attribute.name, attributeInfo(attribute.name, attribute.value, namespaces));
    }

    return { attributes, attributesWithPrefix, namespaces };
  }
}

function nullRecord<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

function defineData<T>(target: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(target, key, {
    value,
    configurable: true,
    enumerable: true,
    writable: true,
  });
}

function compileEntityDecoder(options: IterableEventBackendOptions): (value: string) => string {
  const shouldDecode = options.autoDecodeEntities ?? options.decodeEntities ?? true;
  if (!shouldDecode) {
    return (value) => value;
  }

  if (options.addEntities && options.addEntities.length > 0) {
    const entityMap: Record<string, string> = { ...DEFAULT_ENTITY_MAP };
    const patterns: string[] = ['lt', 'gt', 'quot', 'apos'];

    for (const { entity, value } of options.addEntities) {
      if (entity && value) {
        const key = entity.startsWith('&') && entity.endsWith(';')
          ? entity.slice(1, -1)
          : entity;
        entityMap[key] = value;
        patterns.push(key);
      }
    }
    patterns.push('amp');

    const cacheKey = patterns.join(',');
    let regex = ENTITY_REGEX_CACHE.get(cacheKey);
    if (!regex) {
      const pattern = patterns
        .sort((left, right) => right.length - left.length)
        .map((entity) => entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
      regex = new RegExp(`&(${pattern});`, 'g');
      ENTITY_REGEX_CACHE.set(cacheKey, regex);
    }

    return (value: string) => {
      if (!value || value.indexOf('&') === -1) {
        return value;
      }
      regex!.lastIndex = 0;
      return value.replace(regex!, (_match, entity: string) => entityMap[entity]!);
    };
  }

  return (value: string) => {
    if (!value || value.indexOf('&') === -1) {
      return value;
    }
    DEFAULT_ENTITY_REGEX.lastIndex = 0;
    return value.replace(DEFAULT_ENTITY_REGEX, (_match, entity: string) => DEFAULT_ENTITY_MAP[entity]!);
  };
}

function attributeInfo(name: string, value: string, namespaces: Map<string, string>): AttributeInfo {
  const xmlnsInfo = xmlnsAttributeInfo(name, value);
  if (xmlnsInfo) {
    return xmlnsInfo;
  }

  const qname = splitQName(name, namespaces, false);
  return {
    value,
    localName: qname.localName,
    prefix: qname.prefix,
    uri: qname.uri
  };
}

function xmlnsAttributeInfo(name: string, value: string): AttributeInfo | undefined {
  if (name === 'xmlns') {
    return { value, localName: 'xmlns', prefix: undefined, uri: undefined };
  }
  if (name.length >= 6 && name.charCodeAt(5) === 58 && name.slice(0, 5) === 'xmlns') {
    return { value, localName: name.slice(6), prefix: 'xmlns', uri: undefined };
  }
  return undefined;
}

function splitQName(
  name: string,
  namespaces?: Map<string, string>,
  useDefaultNamespace = true
): { localName: string; prefix: string | undefined; uri: string | undefined } {
  const colon = name.indexOf(':');
  if (colon === -1) {
    return {
      localName: name,
      prefix: undefined,
      uri: useDefaultNamespace ? namespaces?.get('') : undefined
    };
  }
  const prefix = name.slice(0, colon);
  return {
    localName: name.slice(colon + 1),
    prefix,
    uri: namespaces?.get(prefix)
  };
}
