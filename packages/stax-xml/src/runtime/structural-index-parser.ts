import { IterableEventType } from '../StaxXmlIterableParser.js';
import {
  STAX_XML_EVENT_TABLE,
  type IterableEventTable,
} from '../IterableEventBackend.js';
import {
  XmlEventType,
  type AnyXmlEvent,
} from '../types.js';

export type StructuralIndexSource = string | ArrayBufferView;
export type StructuralIndexTable = ArrayBuffer | ArrayBufferView;
export type StructuralIndexSourceKind = 'utf16' | 'utf8';

export interface StaxXmlStructuralIndexParserOptions {
  decodeEntities?: boolean;
  sourceKind?: StructuralIndexSourceKind;
}

const STRUCTURAL_INDEX_MAGIC = 0x31545053;
const HEADER_WORDS = 7;
const HEADER_BYTES = HEADER_WORDS * 4;
const EVENT_STRIDE_BYTES = 28;
const ATTR_STRIDE_BYTES = 16;
const SOURCE_KIND_UTF8 = 1;
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
  byteLength: number;
};

export class StaxXmlStructuralIndexParser implements IterableIterator<AnyXmlEvent>, IterableEventTable {
  readonly eventCount: number;
  readonly attrCount: number;
  readonly indexBytes: number;
  readonly sourceKind: StructuralIndexSourceKind;

  private readonly decodeEntities: boolean;
  private readonly table: ParsedStructuralTable;
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
    const offset = this.eventOffset(index);
    return this.copySpan(
      this.table.view.getInt32(offset + 4, true),
      this.table.view.getInt32(offset + 8, true),
    );
  }

  copyText(index: number): string | undefined {
    const offset = this.eventOffset(index);
    return this.copySpan(
      this.table.view.getInt32(offset + 12, true),
      this.table.view.getInt32(offset + 16, true),
    );
  }

  eventAttrCount(index: number): number {
    return this.table.view.getUint32(this.eventOffset(index) + 24, true);
  }

  copyAttrName(eventIndex: number, attrIndex: number): string | undefined {
    const offset = this.attrOffset(eventIndex, attrIndex);
    return this.copySpan(
      this.table.view.getInt32(offset, true),
      this.table.view.getInt32(offset + 4, true),
    );
  }

  copyAttrValue(eventIndex: number, attrIndex: number): string | undefined {
    const offset = this.attrOffset(eventIndex, attrIndex);
    return this.copySpan(
      this.table.view.getInt32(offset + 8, true),
      this.table.view.getInt32(offset + 12, true),
    );
  }

  copyAttrValueByName(eventIndex: number, name: string): string | undefined {
    const attrCount = this.eventAttrCount(eventIndex);
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      const offset = this.attrOffset(eventIndex, attrIndex);
      if (this.copySpan(
        this.table.view.getInt32(offset, true),
        this.table.view.getInt32(offset + 4, true),
      ) === name) {
        return this.copySpan(
          this.table.view.getInt32(offset + 8, true),
          this.table.view.getInt32(offset + 12, true),
        );
      }
    }
    return undefined;
  }

  private readEvent(index: number): AnyXmlEvent {
    const offset = this.eventOffset(index);
    const type = this.table.view.getUint32(offset, true);
    const name = this.copySpan(
      this.table.view.getInt32(offset + 4, true),
      this.table.view.getInt32(offset + 8, true),
    );
    const text = this.copySpan(
      this.table.view.getInt32(offset + 12, true),
      this.table.view.getInt32(offset + 16, true),
    );
    const attrStart = this.table.view.getUint32(offset + 20, true);
    const attrCount = this.table.view.getUint32(offset + 24, true);

    if (type === 0) return { type: XmlEventType.START_DOCUMENT };
    if (type === 1) return { type: XmlEventType.END_DOCUMENT };
    if (type === 2) {
      return {
        type: XmlEventType.START_ELEMENT,
        name: name!,
        attributes: this.readAttributes(attrStart, attrCount),
      };
    }
    if (type === 3) {
      return { type: XmlEventType.END_ELEMENT, name: name! };
    }
    if (type === 4) {
      return { type: XmlEventType.CHARACTERS, value: this.decode(text!) };
    }
    if (type === 5) {
      return { type: XmlEventType.CDATA, value: text! };
    }

    return {
      type: XmlEventType.ERROR,
      error: new Error(`Unsupported structural index event type: ${type}`),
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

  private readAttributes(attrStart: number, attrCount: number): Record<string, string> {
    const attributes: Record<string, string> = {};
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      const offset = this.table.attrBase + (attrStart + attrIndex) * ATTR_STRIDE_BYTES;
      const name = this.copySpan(
        this.table.view.getInt32(offset, true),
        this.table.view.getInt32(offset + 4, true),
      );
      const value = this.copySpan(
        this.table.view.getInt32(offset + 8, true),
        this.table.view.getInt32(offset + 12, true),
      );
      if (name !== undefined && value !== undefined) {
        attributes[name] = this.decode(value);
      }
    }
    return attributes;
  }

  private copySpan(start: number, end: number): string | undefined {
    if (start < 0) {
      return undefined;
    }
    if (typeof this.source === 'string') {
      return this.source.slice(start, end);
    }

    const view = toUint8Array(this.source);
    const bufferCtor = (globalThis as { Buffer?: { isBuffer(value: unknown): boolean } }).Buffer;
    if (bufferCtor?.isBuffer(this.source) && typeof (this.source as { toString?: unknown }).toString === 'function') {
      return (this.source as { toString(encoding: string, start: number, end: number): string })
        .toString('utf8', start, end);
    }
    return utf8Decoder.decode(view.subarray(start, end));
  }

  private decode(value: string): string {
    if (!this.decodeEntities || value.indexOf('&') === -1) {
      return value;
    }
    DEFAULT_ENTITY_REGEX.lastIndex = 0;
    return value.replace(DEFAULT_ENTITY_REGEX, (_match, entity: string) => DEFAULT_ENTITY_MAP[entity]!);
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
  const expectedBytes = attrBase + attrCount * ATTR_STRIDE_BYTES;
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
    byteLength: view.byteLength,
  };
}

function toUint8Array(source: ArrayBufferView): Uint8Array {
  return source instanceof Uint8Array
    ? source
    : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}
