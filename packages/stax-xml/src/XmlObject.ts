import {
  IterableEventBackendIterator,
  IterableEventMaterializer,
  type EntityDefinition,
} from './IterableEventBackend.js';
import {
  StaxXmlIterableParser,
  toAsyncByteBatches,
  toByteBatches,
} from './StaxXmlIterableParser.js';
import { getStaxXmlRuntimeForSyncApi } from './runtime/native-backend.js';
import { StaxXmlStructuralIndexParser } from './runtime/structural-index-parser.js';
import {
  XmlEventType,
  type AnyXmlEvent,
  type DocumentMode,
  type ErrorEvent,
} from './types.js';

/** XML inputs that can be parsed without crossing an async boundary. */
export type XmlSyncInput = string | Uint8Array | Iterable<Uint8Array>;

/** XML inputs accepted by the convenience tree/object helpers. */
export type XmlAsyncInput = XmlSyncInput | AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>;

/** Options shared by XML tree and compact object helper parsers. */
export interface ParseXmlTreeOptions {
  encoding?: string;
  documentMode?: DocumentMode;
  autoDecodeEntities?: boolean;
  addEntities?: EntityDefinition[];
  trimText?: boolean;
  batchSize?: number;
  fallbackOnLoadError?: boolean;
  fallbackOnParseError?: boolean;
}

/** Options for compact object projection. */
export interface ParseXmlObjectOptions extends ParseXmlTreeOptions {
  /** Prefix applied to XML attributes. Defaults to `@`, so `id` becomes `@id`. */
  attributePrefix?: string;
  /** Key used for text in mixed-content objects. Defaults to `#text`. */
  textKey?: string;
  /** Key used for CDATA in compact objects. Defaults to `#cdata`. */
  cdataKey?: string;
  /** When true, element children are always represented as arrays. */
  alwaysArray?: boolean;
}

/** Document wrapper returned by `parseXmlTree()` and `parseXmlTreeSync()`. */
export interface XmlTreeDocument {
  type: 'document';
  children: XmlTreeNode[];
}

export type XmlTreeNode = XmlTreeElement | XmlTreeText | XmlTreeCdata;

/** Order-preserving XML element node. */
export interface XmlTreeElement {
  type: 'element';
  name: string;
  attributes: XmlObjectRecord<string>;
  children: XmlTreeNode[];
}

/** Text node in an order-preserving XML tree. */
export interface XmlTreeText {
  type: 'text';
  value: string;
}

/** CDATA node in an order-preserving XML tree. */
export interface XmlTreeCdata {
  type: 'cdata';
  value: string;
}

/** Value stored in the compact object projection. */
export type XmlObjectValue = string | XmlObjectRecord | XmlObjectArray;

/** Array of compact object values used for repeated elements. */
export interface XmlObjectArray extends Array<XmlObjectValue> {}

/** Null-prototype record used by tree attributes and compact object nodes. */
export interface XmlObjectRecord<T = XmlObjectValue> {
  [key: string]: T;
}

type TreeXmlEvent = Exclude<AnyXmlEvent, ErrorEvent>;

const DEFAULT_BATCH_SIZE = 16;
const textEncoder = new TextEncoder();

/** Parse XML into an order-preserving tree using a synchronous input. */
export function parseXmlTreeSync(input: XmlSyncInput, options: ParseXmlTreeOptions = {}): XmlTreeDocument {
  return buildTreeFromEvents(iterateSyncEvents(input, treeOptions(options)));
}

/** Parse XML into an order-preserving tree. */
export async function parseXmlTree(input: XmlAsyncInput, options: ParseXmlTreeOptions = {}): Promise<XmlTreeDocument> {
  if (isSyncInput(input)) {
    return parseXmlTreeSync(input, options);
  }
  return buildTreeFromAsyncEvents(iterateAsyncEvents(input, treeOptions(options)));
}

/** Parse XML into a compact JavaScript object using a synchronous input. */
export function parseXmlObjectSync(
  input: XmlSyncInput,
  options: ParseXmlObjectOptions = {},
): XmlObjectRecord {
  return treeToObject(parseXmlTreeSync(input, objectTreeOptions(options)), objectOptions(options));
}

/** Parse XML into a compact JavaScript object. */
export async function parseXmlObject(
  input: XmlAsyncInput,
  options: ParseXmlObjectOptions = {},
): Promise<XmlObjectRecord> {
  return treeToObject(await parseXmlTree(input, objectTreeOptions(options)), objectOptions(options));
}

function treeOptions(options: ParseXmlTreeOptions): RequiredTreeOptions {
  return {
    encoding: options.encoding ?? 'utf-8',
    documentMode: options.documentMode,
    autoDecodeEntities: options.autoDecodeEntities ?? true,
    addEntities: options.addEntities,
    trimText: options.trimText ?? false,
    batchSize: normalizeBatchSize(options.batchSize),
    fallbackOnLoadError: options.fallbackOnLoadError,
    fallbackOnParseError: options.fallbackOnParseError,
  };
}

function objectTreeOptions(options: ParseXmlObjectOptions): ParseXmlTreeOptions {
  return {
    ...options,
    trimText: options.trimText ?? true,
  };
}

function objectOptions(options: ParseXmlObjectOptions): RequiredObjectOptions {
  return {
    attributePrefix: options.attributePrefix ?? '@',
    textKey: options.textKey ?? '#text',
    cdataKey: options.cdataKey ?? '#cdata',
    alwaysArray: options.alwaysArray ?? false,
  };
}

interface RequiredTreeOptions {
  encoding: string;
  documentMode: DocumentMode | undefined;
  autoDecodeEntities: boolean;
  addEntities: EntityDefinition[] | undefined;
  trimText: boolean;
  batchSize: number;
  fallbackOnLoadError: boolean | undefined;
  fallbackOnParseError: boolean | undefined;
}

interface RequiredObjectOptions {
  attributePrefix: string;
  textKey: string;
  cdataKey: string;
  alwaysArray: boolean;
}

function* iterateSyncEvents(input: XmlSyncInput, options: RequiredTreeOptions): Iterable<TreeXmlEvent> {
  const structuralParser = tryCreateStructuralSyncParser(input, options);
  const materializer = new IterableEventMaterializer({
    autoDecodeEntities: options.autoDecodeEntities,
    addEntities: options.addEntities,
    trimText: options.trimText,
  });
  if (structuralParser) {
    while (structuralParser.nextBatch()) {
      yield* materializer.materializeBatch(structuralParser) as TreeXmlEvent[];
    }
    return;
  }

  const parser = new StaxXmlIterableParser(
    toByteBatches(syncInputChunks(input), { batchSize: options.batchSize }),
    {
      encoding: options.encoding,
      documentMode: options.documentMode,
      fallbackOnLoadError: options.fallbackOnLoadError,
      fallbackOnParseError: options.fallbackOnParseError,
    },
  );

  while (parser.nextBatch()) {
    yield* materializer.materializeBatch(parser) as TreeXmlEvent[];
  }
}

function tryCreateStructuralSyncParser(
  input: XmlSyncInput,
  options: RequiredTreeOptions,
): StaxXmlStructuralIndexParser | undefined {
  if (options.documentMode === 'document') {
    return undefined;
  }
  if (typeof input !== 'string' && !(input instanceof Uint8Array)) {
    return undefined;
  }

  const runtime = getStaxXmlRuntimeForSyncApi(undefined);
  if (!runtime || runtime.backend.kind === 'js') {
    return undefined;
  }
  const sourceKind = typeof input === 'string' ? 'utf16' : 'utf8';
  const missingCapability = (): undefined => {
    if (options.fallbackOnLoadError !== true) {
      throw new Error(`Initialized backend does not provide structuralIndex${sourceKind === 'utf16' ? 'Utf16' : 'Utf8'} capability.`);
    }
    return undefined;
  };

  if (typeof input === 'string') {
    const buildTable = runtime.capabilities.structuralIndexUtf16;
    if (!buildTable) {
      return missingCapability();
    }
    try {
      return new StaxXmlStructuralIndexParser(input, buildTable(input), {
        decodeEntities: false,
        sourceKind,
      });
    } catch (error) {
      if (options.fallbackOnParseError === true) {
        return undefined;
      }
      throw error;
    }
  }

  const buildTable = runtime.capabilities.structuralIndexUtf8;
  if (!buildTable) {
    return missingCapability();
  }
  try {
    return new StaxXmlStructuralIndexParser(input, buildTable(input), {
      decodeEntities: false,
      sourceKind,
    });
  } catch (error) {
    if (options.fallbackOnParseError === true) {
      return undefined;
    }
    throw error;
  }
}

async function* iterateAsyncEvents(input: Exclude<XmlAsyncInput, XmlSyncInput>, options: RequiredTreeOptions): AsyncIterable<TreeXmlEvent> {
  if (input instanceof ReadableStream) {
    const backend = new IterableEventBackendIterator(input, {
      encoding: options.encoding,
      documentMode: options.documentMode,
      autoDecodeEntities: options.autoDecodeEntities,
      addEntities: options.addEntities,
      trimText: options.trimText,
      batchSize: options.batchSize,
      fallbackOnLoadError: options.fallbackOnLoadError,
      fallbackOnParseError: options.fallbackOnParseError,
    });
    for await (const event of backend) {
      yield event as TreeXmlEvent;
    }
    return;
  }

  const parser = new StaxXmlIterableParser([], {
    encoding: options.encoding,
    documentMode: options.documentMode,
    fallbackOnLoadError: options.fallbackOnLoadError,
    fallbackOnParseError: options.fallbackOnParseError,
  });
  const materializer = new IterableEventMaterializer({
    autoDecodeEntities: options.autoDecodeEntities,
    addEntities: options.addEntities,
    trimText: options.trimText,
  });

  for await (const byteBatch of toAsyncByteBatches(input, { batchSize: options.batchSize })) {
    if (parser.pushByteBatch(byteBatch, false)) {
      yield* materializer.materializeBatch(parser) as TreeXmlEvent[];
    }
  }
  parser.pushByteBatch([], true);
  yield* materializer.materializeBatch(parser) as TreeXmlEvent[];
}

function buildTreeFromEvents(events: Iterable<TreeXmlEvent>): XmlTreeDocument {
  const document = createDocument();
  const stack: XmlTreeElement[] = [];
  for (const event of events) {
    applyEventToTree(document, stack, event);
  }
  return document;
}

async function buildTreeFromAsyncEvents(events: AsyncIterable<TreeXmlEvent>): Promise<XmlTreeDocument> {
  const document = createDocument();
  const stack: XmlTreeElement[] = [];
  for await (const event of events) {
    applyEventToTree(document, stack, event);
  }
  return document;
}

function applyEventToTree(document: XmlTreeDocument, stack: XmlTreeElement[], event: TreeXmlEvent): void {
  if (event.type === XmlEventType.START_DOCUMENT || event.type === XmlEventType.END_DOCUMENT) {
    return;
  }
  if (event.type === XmlEventType.START_ELEMENT) {
    const node: XmlTreeElement = {
      type: 'element',
      name: event.name,
      attributes: copyNullRecord(event.attributes),
      children: [],
    };
    appendTreeNode(document, stack, node);
    stack.push(node);
    return;
  }
  if (event.type === XmlEventType.END_ELEMENT) {
    stack.pop();
    return;
  }
  if (event.type === XmlEventType.CHARACTERS) {
    appendTreeNode(document, stack, { type: 'text', value: event.value });
    return;
  }
  appendTreeNode(document, stack, { type: 'cdata', value: event.value });
}

function appendTreeNode(document: XmlTreeDocument, stack: XmlTreeElement[], node: XmlTreeNode): void {
  const parent = stack[stack.length - 1];
  if (parent) {
    parent.children.push(node);
  } else {
    document.children.push(node);
  }
}

function treeToObject(document: XmlTreeDocument, options: RequiredObjectOptions): XmlObjectRecord {
  const result = nullRecord();
  for (const child of document.children) {
    if (child.type === 'element') {
      addObjectValue(result, child.name, elementToObjectValue(child, options), options.alwaysArray);
    } else if (child.type === 'text') {
      addObjectValue(result, options.textKey, child.value, false);
    } else {
      addObjectValue(result, options.cdataKey, child.value, false);
    }
  }
  return result;
}

function elementToObjectValue(element: XmlTreeElement, options: RequiredObjectOptions): XmlObjectValue {
  const hasAttributes = Object.keys(element.attributes).length > 0;
  const elementChildren = element.children.filter((child) => child.type === 'element');
  const textChildren = element.children.filter((child) => child.type === 'text');
  const cdataChildren = element.children.filter((child) => child.type === 'cdata');

  if (!hasAttributes && elementChildren.length === 0 && cdataChildren.length === 0) {
    if (textChildren.length === 0) {
      return '';
    }
    return textChildren.map((child) => child.value).join('');
  }

  const result = nullRecord();
  for (const [name, value] of Object.entries(element.attributes)) {
    addObjectValue(result, `${options.attributePrefix}${name}`, value, false);
  }
  for (const child of element.children) {
    if (child.type === 'element') {
      addObjectValue(result, child.name, elementToObjectValue(child, options), options.alwaysArray);
    } else if (child.type === 'text') {
      addObjectValue(result, options.textKey, child.value, false);
    } else {
      addObjectValue(result, options.cdataKey, child.value, false);
    }
  }
  return result;
}

function addObjectValue(
  target: XmlObjectRecord,
  key: string,
  value: XmlObjectValue,
  forceArray: boolean,
): void {
  if (!Object.hasOwn(target, key)) {
    defineData(target, key, forceArray ? [value] : value);
    return;
  }

  const current = target[key]!;
  if (Array.isArray(current)) {
    current.push(value);
    return;
  }
  defineData(target, key, [current, value]);
}

function defineData(target: XmlObjectRecord, key: string, value: XmlObjectValue): void {
  Object.defineProperty(target, key, {
    value,
    configurable: true,
    enumerable: true,
    writable: true,
  });
}

function createDocument(): XmlTreeDocument {
  return { type: 'document', children: [] };
}

function copyNullRecord(source: Record<string, string>): XmlObjectRecord<string> {
  const target = nullRecord<string>();
  for (const [key, value] of Object.entries(source)) {
    defineStringData(target, key, value);
  }
  return target;
}

function defineStringData(target: XmlObjectRecord<string>, key: string, value: string): void {
  Object.defineProperty(target, key, {
    value,
    configurable: true,
    enumerable: true,
    writable: true,
  });
}

function nullRecord<T = XmlObjectValue>(): XmlObjectRecord<T> {
  return Object.create(null) as XmlObjectRecord<T>;
}

function* syncInputChunks(input: XmlSyncInput): Iterable<Uint8Array> {
  if (typeof input === 'string') {
    yield textEncoder.encode(input);
    return;
  }
  if (input instanceof Uint8Array) {
    yield input;
    return;
  }
  yield* input;
}

function isSyncInput(input: XmlAsyncInput): input is XmlSyncInput {
  return typeof input === 'string'
    || input instanceof Uint8Array
    || (!(input instanceof ReadableStream) && Symbol.iterator in Object(input));
}

function normalizeBatchSize(value: number | undefined): number {
  const batchSize = value ?? DEFAULT_BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new RangeError('batchSize must be a positive integer.');
  }
  return batchSize;
}
