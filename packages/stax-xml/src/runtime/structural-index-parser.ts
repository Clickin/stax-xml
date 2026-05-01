import { IterableEventType } from '../IterableReader.js';
import {
  STAX_XML_EVENT_TABLE,
  type IterableEventTable,
} from '../IterableEventBackend.js';
import {
  XmlEventType,
  type AnyXmlEvent,
} from '../types.js';
import {
  byteSpanKey,
  decodeShortAsciiSpan,
  rememberNumericIdString,
  ShortValueStringCache,
  stringSpanKey,
  VALUE_ID_CACHE_MAX_ENTRIES,
} from './string-materialization.js';

export type StructuralIndexSource = string | ArrayBufferView;
export type StructuralIndexTable = ArrayBuffer | ArrayBufferView;
export type StructuralIndexSourceKind = 'utf16' | 'utf8';

export interface StaxXmlStructuralIndexParserOptions {
  decodeEntities?: boolean;
  sourceKind?: StructuralIndexSourceKind;
  trimText?: boolean;
}

const STRUCTURAL_INDEX_MAGIC = 0x31545053;
const HEADER_WORDS = 7;
const HEADER_BYTES = HEADER_WORDS * 4;
const EVENT_STRIDE_BYTES = 28;
const ATTR_STRIDE_BYTES = 16;
const SOURCE_KIND_UTF8 = 1;
const STRUCTURAL_INDEX_FLAG_NAME_IDS = 1 << 8;
const STRUCTURAL_INDEX_FLAG_VALUE_IDS = 1 << 9;
const DEFAULT_ENTITY_REGEX = /&(lt|gt|quot|apos|amp);/g;
const DEFAULT_ENTITY_MAP: Record<string, string> = {
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  amp: '&',
};
const utf8Decoder = new TextDecoder();

type ParsedStructuralTable = {
  view: DataView;
  eventCount: number;
  attrCount: number;
  sourceUnits: number;
  sourceKind: StructuralIndexSourceKind;
  eventBase: number;
  attrBase: number;
  eventNamesBase?: number;
  attrNamesBase?: number;
  eventTextValuesBase?: number;
  attrValuesBase?: number;
  byteLength: number;
};

export class StaxXmlStructuralIndexParser implements IterableIterator<AnyXmlEvent>, IterableEventTable {
  readonly eventCount: number;
  readonly attrCount: number;
  readonly indexBytes: number;
  readonly sourceKind: StructuralIndexSourceKind;

  private readonly decodeEntities: boolean;
  private readonly trimText: boolean;
  private readonly table: ParsedStructuralTable;
  private readonly nameIdCache = new Map<number, string>();
  private readonly valueIdCache = new Map<number, string>();
  private readonly nameHashCache = new Map<number, string>();
  private readonly shortValueCache = new ShortValueStringCache();
  private index = 0;
  private tableBatchConsumed = false;

  constructor(
    private readonly source: StructuralIndexSource,
    table: StructuralIndexTable,
    options: StaxXmlStructuralIndexParserOptions = {},
  ) {
    this.table = readStructuralTable(source, table, options.sourceKind);
    this.eventCount = this.table.eventCount;
    this.attrCount = this.table.attrCount;
    this.indexBytes = this.table.byteLength;
    this.sourceKind = this.table.sourceKind;
    this.decodeEntities = options.decodeEntities ?? true;
    this.trimText = options.trimText ?? false;
  }

  static fromTable(
    source: StructuralIndexSource,
    table: StructuralIndexTable,
    options?: StaxXmlStructuralIndexParserOptions,
  ): StaxXmlStructuralIndexParser {
    return new StaxXmlStructuralIndexParser(source, table, options);
  }

  [Symbol.iterator](): IterableIterator<AnyXmlEvent> {
    return this;
  }

  [STAX_XML_EVENT_TABLE](): IterableEventTable | undefined {
    if (this.index !== 0 || this.tableBatchConsumed) {
      return undefined;
    }
    return this;
  }

  next(): IteratorResult<AnyXmlEvent> {
    if (this.index >= this.eventCount) {
      return { value: undefined, done: true };
    }

    const value = this.readEvent(this.index);
    this.index++;
    return { value, done: false };
  }

  return(): IteratorResult<AnyXmlEvent> {
    this.index = this.eventCount;
    return { value: undefined, done: true };
  }

  nextBatch(): boolean {
    if (this.index !== 0 || this.tableBatchConsumed || this.eventCount === 0) {
      return false;
    }
    this.tableBatchConsumed = true;
    this.index = this.eventCount;
    return true;
  }

  eventType(index: number): IterableEventType {
    const type = this.table.view.getUint32(this.eventOffset(index), true);
    if (type === 0) return IterableEventType.START_DOCUMENT;
    if (type === 1) return IterableEventType.END_DOCUMENT;
    if (type === 2) return IterableEventType.START_ELEMENT;
    if (type === 3) return IterableEventType.END_ELEMENT;
    if (type === 4) return IterableEventType.CHARACTERS;
    if (type === 5) return IterableEventType.CDATA;
    throw new Error(`Unsupported structural index event type: ${type}`);
  }

  buffer(): Uint8Array {
    if (typeof this.source === 'string') {
      return new TextEncoder().encode(this.source);
    }
    return toUint8Array(this.source);
  }

  nameStart(index: number): number {
    return this.table.view.getInt32(this.eventOffset(index) + 4, true);
  }

  nameEnd(index: number): number {
    return this.table.view.getInt32(this.eventOffset(index) + 8, true);
  }

  textStart(index: number): number {
    return this.table.view.getInt32(this.eventOffset(index) + 12, true);
  }

  textEnd(index: number): number {
    return this.table.view.getInt32(this.eventOffset(index) + 16, true);
  }

  attrNameStart(eventIndex: number, attrIndex: number): number {
    return this.table.view.getInt32(this.attrOffset(eventIndex, attrIndex), true);
  }

  attrNameEnd(eventIndex: number, attrIndex: number): number {
    return this.table.view.getInt32(this.attrOffset(eventIndex, attrIndex) + 4, true);
  }

  attrValueStart(eventIndex: number, attrIndex: number): number {
    return this.table.view.getInt32(this.attrOffset(eventIndex, attrIndex) + 8, true);
  }

  attrValueEnd(eventIndex: number, attrIndex: number): number {
    return this.table.view.getInt32(this.attrOffset(eventIndex, attrIndex) + 12, true);
  }

  copyName(index: number): string | undefined {
    return this.copyNameSpan(this.nameStart(index), this.nameEnd(index), this.eventNameId(index));
  }

  copyText(index: number): string | undefined {
    const offset = this.eventOffset(index);
    return this.copyValueSpan(
      this.table.view.getInt32(offset + 12, true),
      this.table.view.getInt32(offset + 16, true),
      this.eventTextValueId(index),
    );
  }

  eventAttrCount(index: number): number {
    return this.table.view.getUint32(this.eventOffset(index) + 24, true);
  }

  copyAttrName(eventIndex: number, attrIndex: number): string | undefined {
    return this.copyNameSpan(
      this.attrNameStart(eventIndex, attrIndex),
      this.attrNameEnd(eventIndex, attrIndex),
      this.attrNameId(eventIndex, attrIndex),
    );
  }

  copyAttrValue(eventIndex: number, attrIndex: number): string | undefined {
    const offset = this.attrOffset(eventIndex, attrIndex);
    return this.copyValueSpan(
      this.table.view.getInt32(offset + 8, true),
      this.table.view.getInt32(offset + 12, true),
      this.attrValueId(eventIndex, attrIndex),
    );
  }

  copyAttrValueByName(eventIndex: number, name: string): string | undefined {
    const attrCount = this.eventAttrCount(eventIndex);
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      const offset = this.attrOffset(eventIndex, attrIndex);
      if (this.copyNameSpan(
        this.table.view.getInt32(offset, true),
        this.table.view.getInt32(offset + 4, true),
        this.attrNameId(eventIndex, attrIndex),
      ) === name) {
        return this.copyAttrValue(eventIndex, attrIndex);
      }
    }
    return undefined;
  }

  private readEvent(index: number): AnyXmlEvent {
    let type: IterableEventType;
    try {
      type = this.eventType(index);
    } catch (error) {
      return {
        type: XmlEventType.ERROR,
        error: error as Error,
      };
    }
    const name = this.copyName(index);

    if (type === IterableEventType.START_DOCUMENT) return { type: XmlEventType.START_DOCUMENT };
    if (type === IterableEventType.END_DOCUMENT) return { type: XmlEventType.END_DOCUMENT };
    if (type === IterableEventType.START_ELEMENT) {
      return {
        type: XmlEventType.START_ELEMENT,
        name: name!,
        attributes: this.readAttributes(index),
      };
    }
    if (type === IterableEventType.END_ELEMENT) {
      return { type: XmlEventType.END_ELEMENT, name: name! };
    }
    if (type === IterableEventType.CHARACTERS) {
      return { type: XmlEventType.CHARACTERS, value: this.materializeText(this.copyText(index)!) };
    }
    if (type === IterableEventType.CDATA) {
      return { type: XmlEventType.CDATA, value: this.decode(this.copyText(index)!) };
    }

    return {
      type: XmlEventType.ERROR,
      error: new Error(`Unsupported structural index event type: ${String(type)}`),
    };
  }

  private eventOffset(index: number): number {
    return this.table.eventBase + index * EVENT_STRIDE_BYTES;
  }

  private attrOffset(eventIndex: number, attrIndex: number): number {
    const eventOffset = this.eventOffset(eventIndex);
    const attrStart = this.table.view.getUint32(eventOffset + 20, true);
    return this.table.attrBase + (attrStart + attrIndex) * ATTR_STRIDE_BYTES;
  }

  private readAttributes(eventIndex: number): Record<string, string> {
    const attributes: Record<string, string> = {};
    const attrCount = this.eventAttrCount(eventIndex);
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      const name = this.copyAttrName(eventIndex, attrIndex);
      const value = this.copyAttrValue(eventIndex, attrIndex);
      if (name !== undefined && value !== undefined) {
        attributes[name] = this.decode(value);
      }
    }
    return attributes;
  }

  private copyNameSpan(start: number, end: number, nameId: number): string | undefined {
    if (start < 0) {
      return undefined;
    }
    if (nameId > 0) {
      const cachedById = this.nameIdCache.get(nameId);
      if (cachedById !== undefined) {
        return cachedById;
      }
      const value = this.decodeSpan(start, end);
      this.nameIdCache.set(nameId, value);
      return value;
    }

    const key = typeof this.source === 'string'
      ? stringSpanKey(this.source, start, end)
      : byteSpanKey(toUint8Array(this.source), start, end);
    const cached = this.nameHashCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const value = this.decodeSpan(start, end);
    this.nameHashCache.set(key, value);
    return value;
  }

  private copyValueSpan(start: number, end: number, valueId: number): string | undefined {
    if (start < 0) {
      return undefined;
    }
    if (typeof this.source === 'string' || this.sourceKind !== 'utf8') {
      return this.decodeSpan(start, end);
    }
    if (valueId > 0) {
      return rememberNumericIdString(
        this.valueIdCache,
        valueId,
        () => this.decodeSpan(start, end),
        VALUE_ID_CACHE_MAX_ENTRIES,
      );
    }
    return this.shortValueCache.rememberBytes(
      toUint8Array(this.source),
      start,
      end,
      () => this.decodeSpan(start, end),
    );
  }

  private decodeSpan(start: number, end: number): string {
    if (typeof this.source === 'string') {
      return this.source.slice(start, end);
    }

    const view = toUint8Array(this.source);
    const ascii = decodeShortAsciiSpan(view, start, end);
    if (ascii !== undefined) {
      return ascii;
    }
    const bufferCtor = (globalThis as { Buffer?: { isBuffer(value: unknown): boolean } }).Buffer;
    if (bufferCtor?.isBuffer(this.source) && typeof (this.source as { toString?: unknown }).toString === 'function') {
      return (this.source as { toString(encoding: string, start: number, end: number): string })
        .toString('utf8', start, end);
    }
    return utf8Decoder.decode(view.subarray(start, end));
  }

  private eventNameId(index: number): number {
    return this.table.eventNamesBase === undefined
      ? 0
      : this.table.view.getUint32(this.table.eventNamesBase + index * 4, true);
  }

  private attrNameId(eventIndex: number, attrIndex: number): number {
    const attrStart = this.table.view.getUint32(this.eventOffset(eventIndex) + 20, true);
    return this.attrNameIdFromTable(attrStart + attrIndex);
  }

  private attrNameIdFromTable(attrIndex: number): number {
    return this.table.attrNamesBase === undefined
      ? 0
      : this.table.view.getUint32(this.table.attrNamesBase + attrIndex * 4, true);
  }

  private eventTextValueId(index: number): number {
    return this.table.eventTextValuesBase === undefined
      ? 0
      : this.table.view.getUint32(this.table.eventTextValuesBase + index * 4, true);
  }

  private attrValueId(eventIndex: number, attrIndex: number): number {
    const attrStart = this.table.view.getUint32(this.eventOffset(eventIndex) + 20, true);
    return this.attrValueIdFromTable(attrStart + attrIndex);
  }

  private attrValueIdFromTable(attrIndex: number): number {
    return this.table.attrValuesBase === undefined
      ? 0
      : this.table.view.getUint32(this.table.attrValuesBase + attrIndex * 4, true);
  }

  private decode(value: string): string {
    if (!this.decodeEntities || value.indexOf('&') === -1) {
      return value;
    }
    DEFAULT_ENTITY_REGEX.lastIndex = 0;
    return value.replace(DEFAULT_ENTITY_REGEX, (_match, entity: string) => DEFAULT_ENTITY_MAP[entity]!);
  }

  private materializeText(value: string): string {
    const decoded = this.decode(value);
    return this.trimText ? decoded.trim() : decoded;
  }
}

function readStructuralTable(
  source: StructuralIndexSource,
  table: StructuralIndexTable,
  expectedSourceKind?: StructuralIndexSourceKind,
): ParsedStructuralTable {
  const view = table instanceof ArrayBuffer
    ? new DataView(table)
    : new DataView(table.buffer, table.byteOffset, table.byteLength);

  const magic = view.getUint32(0, true);
  if (magic !== STRUCTURAL_INDEX_MAGIC) {
    throw new Error(`Invalid structural index magic: 0x${magic.toString(16)}`);
  }

  const eventCount = view.getUint32(4, true);
  const attrCount = view.getUint32(8, true);
  const sourceUnits = view.getUint32(12, true);
  const eventStrideBytes = view.getUint32(16, true);
  const attrStrideBytes = view.getUint32(20, true);
  const flags = view.getUint32(24, true);
  const sourceKind = (flags & 0xff) === SOURCE_KIND_UTF8 ? 'utf8' : 'utf16';
  const actualSourceUnits = typeof source === 'string' ? source.length : source.byteLength;

  if (expectedSourceKind && sourceKind !== expectedSourceKind) {
    throw new Error(`Structural index source kind mismatch: ${sourceKind}/${expectedSourceKind}`);
  }
  if (sourceUnits !== actualSourceUnits) {
    throw new Error(`Structural index input length mismatch: ${sourceUnits}/${actualSourceUnits}`);
  }
  if (eventStrideBytes !== EVENT_STRIDE_BYTES || attrStrideBytes !== ATTR_STRIDE_BYTES) {
    throw new Error(`Unsupported structural index strides: ${eventStrideBytes}/${attrStrideBytes}`);
  }

  const eventBase = HEADER_BYTES;
  const attrBase = eventBase + eventCount * EVENT_STRIDE_BYTES;
  let cursor = attrBase + attrCount * ATTR_STRIDE_BYTES;
  const eventNamesBase = (flags & STRUCTURAL_INDEX_FLAG_NAME_IDS) !== 0 ? cursor : undefined;
  if (eventNamesBase !== undefined) {
    cursor += eventCount * 4;
  }
  const attrNamesBase = eventNamesBase === undefined ? undefined : cursor;
  if (attrNamesBase !== undefined) {
    cursor += attrCount * 4;
  }
  const eventTextValuesBase = (flags & STRUCTURAL_INDEX_FLAG_VALUE_IDS) !== 0 ? cursor : undefined;
  if (eventTextValuesBase !== undefined) {
    cursor += eventCount * 4;
  }
  const attrValuesBase = eventTextValuesBase === undefined ? undefined : cursor;
  if (attrValuesBase !== undefined) {
    cursor += attrCount * 4;
  }
  const expectedBytes = cursor;
  if (expectedBytes !== view.byteLength) {
    throw new Error(`Structural index length mismatch: ${expectedBytes}/${view.byteLength}`);
  }

  return {
    view,
    eventCount,
    attrCount,
    sourceUnits,
    sourceKind,
    eventBase,
    attrBase,
    eventNamesBase,
    attrNamesBase,
    eventTextValuesBase,
    attrValuesBase,
    byteLength: view.byteLength,
  };
}

function toUint8Array(source: ArrayBufferView): Uint8Array {
  return source instanceof Uint8Array
    ? source
    : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}
