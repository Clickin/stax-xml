import type {
  IterableEventType,
  IterableReaderBatchFrame,
} from '../IterableReader.js';
import type { StreamReaderSyncRawBatch } from '../stream-reader-core.js';
import type { StaxXmlStreamingEventBatchParser } from './native-backend.js';
import {
  byteSpanKey,
  decodeShortAsciiSpan,
  rememberNumericIdString,
  ShortValueStringCache,
  VALUE_ID_CACHE_MAX_ENTRIES,
} from './string-materialization.js';

const STRUCTURAL_INDEX_MAGIC = 0x31545053;
const STRUCTURAL_INDEX_HEADER_BYTES = 28;
const STRUCTURAL_INDEX_EVENT_BYTES = 28;
const STRUCTURAL_INDEX_ATTR_BYTES = 16;
const STRUCTURAL_INDEX_HEADER_WORDS = 7;
const STRUCTURAL_INDEX_EVENT_WORDS = 7;
const STRUCTURAL_INDEX_ATTR_WORDS = 4;
const STRUCTURAL_INDEX_SOURCE_KIND_UTF8 = 1;
const STRUCTURAL_INDEX_FLAG_NAME_IDS = 1 << 8;
const STRUCTURAL_INDEX_FLAG_VALUE_IDS = 1 << 9;
const SOA_STRING_ARENA_MAGIC = 0x31414f53;
const SOA_STRING_ARENA_VERSION = 1;
const SOA_STRING_ARENA_SOURCE_KIND_UTF8 = 1;
const SOA_STRING_ARENA_HEADER_WORDS = 32;
const EMPTY_BUFFER = new Uint8Array(0);
const utf8Decoder = new TextDecoder();
const IS_LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

export type StreamingByteBatch = readonly Uint8Array[];

export interface TableBackedEventSource {
  eventCount(): number;
  eventType(index: number): IterableEventType;
  buffer(): Uint8Array;
  nameStart(index: number): number;
  nameEnd(index: number): number;
  textStart(index: number): number;
  textEnd(index: number): number;
  attrCount(index: number): number;
  attrNameStart(eventIndex: number, attrIndex: number): number;
  attrNameEnd(eventIndex: number, attrIndex: number): number;
  attrValueStart(eventIndex: number, attrIndex: number): number;
  attrValueEnd(eventIndex: number, attrIndex: number): number;
  copyName(index: number): string | undefined;
  copyText(index: number): string | undefined;
  copyAttrName(eventIndex: number, attrIndex: number): string | undefined;
  copyAttrValue(eventIndex: number, attrIndex: number): string | undefined;
  copyAttrValueByName(eventIndex: number, name: string): string | undefined;
  isImplicitAttributeValue(eventIndex: number, attrIndex: number): boolean;
  copyAttributesObject(eventIndex: number): Record<string, string>;
  batchFrame(): IterableReaderBatchFrame;
  rawBatch(): StreamReaderSyncRawBatch;
}

type StreamingNativeBatch = {
  buffer: ArrayBuffer | ArrayBufferView;
  table?: ArrayBuffer | ArrayBufferView;
  soaTable?: ArrayBuffer | ArrayBufferView;
  stringArena?: string;
};

export class StreamingSpanTableAdapter implements TableBackedEventSource {
  readonly eventCountValue: number;
  readonly attrCountValue: number;

  private readonly attrBase: number;
  private readonly attrBaseWord: number;
  private readonly eventNamesBase: number | undefined;
  private readonly eventNamesBaseWord: number;
  private readonly attrNamesBase: number | undefined;
  private readonly attrNamesBaseWord: number;
  private readonly eventTextValuesBase: number | undefined;
  private readonly eventTextValuesBaseWord: number;
  private readonly attrValuesBase: number | undefined;
  private readonly attrValuesBaseWord: number;
  private readonly view: DataView;
  private readonly u32: Uint32Array | undefined;
  private readonly i32: Int32Array | undefined;
  private readonly decodeUtf8Span: (start: number, end: number) => string;
  private frame: IterableReaderBatchFrame | undefined;
  private consumed = false;

  constructor(
    private readonly source: Uint8Array,
    table: ArrayBuffer | ArrayBufferView,
    private readonly label = 'streaming structural index',
    private readonly nameIdCache = new Map<number, string>(),
    private readonly valueIdCache = new Map<number, string>(),
    private readonly nameHashCache = new Map<number, string>(),
    private readonly shortValueCache = new ShortValueStringCache(),
    private readonly nameIdReverseCache = new Map<string, number>(),
  ) {
    this.view = table instanceof ArrayBuffer
      ? new DataView(table)
      : new DataView(table.buffer, table.byteOffset, table.byteLength);
    if (IS_LITTLE_ENDIAN && this.view.byteOffset % 4 === 0 && this.view.byteLength % 4 === 0) {
      this.u32 = new Uint32Array(this.view.buffer, this.view.byteOffset, this.view.byteLength / 4);
      this.i32 = new Int32Array(this.view.buffer, this.view.byteOffset, this.view.byteLength / 4);
    }
    this.decodeUtf8Span = createUtf8SpanDecoder(this.source);
    const magic = this.view.getUint32(0, true);
    if (magic !== STRUCTURAL_INDEX_MAGIC) {
      throw new Error(`Invalid ${this.label} magic: 0x${magic.toString(16)}`);
    }

    this.eventCountValue = this.view.getUint32(4, true);
    this.attrCountValue = this.view.getUint32(8, true);
    const sourceUnits = this.view.getUint32(12, true);
    const eventStride = this.view.getUint32(16, true);
    const attrStride = this.view.getUint32(20, true);
    const flags = this.view.getUint32(24, true);
    if (sourceUnits !== source.byteLength) {
      throw new Error(`${capitalize(this.label)} input length mismatch: ${sourceUnits}/${source.byteLength}`);
    }
    if (eventStride !== STRUCTURAL_INDEX_EVENT_BYTES || attrStride !== STRUCTURAL_INDEX_ATTR_BYTES) {
      throw new Error(`Unsupported ${this.label} strides: ${eventStride}/${attrStride}`);
    }
    if ((flags & 0xff) !== STRUCTURAL_INDEX_SOURCE_KIND_UTF8) {
      throw new Error(`${capitalize(this.label)} source kind mismatch: utf16/utf8`);
    }

    this.attrBase = STRUCTURAL_INDEX_HEADER_BYTES + this.eventCountValue * STRUCTURAL_INDEX_EVENT_BYTES;
    this.attrBaseWord = this.attrBase >> 2;
    const attrBytes = this.attrCountValue * STRUCTURAL_INDEX_ATTR_BYTES;
    let cursor = this.attrBase + attrBytes;
    if ((flags & STRUCTURAL_INDEX_FLAG_NAME_IDS) !== 0) {
      this.eventNamesBase = cursor;
      this.eventNamesBaseWord = cursor >> 2;
      cursor += this.eventCountValue * 4;
      this.attrNamesBase = cursor;
      this.attrNamesBaseWord = cursor >> 2;
      cursor += this.attrCountValue * 4;
    } else {
      this.eventNamesBaseWord = 0;
      this.attrNamesBaseWord = 0;
    }
    if ((flags & STRUCTURAL_INDEX_FLAG_VALUE_IDS) !== 0) {
      this.eventTextValuesBase = cursor;
      this.eventTextValuesBaseWord = cursor >> 2;
      cursor += this.eventCountValue * 4;
      this.attrValuesBase = cursor;
      this.attrValuesBaseWord = cursor >> 2;
      cursor += this.attrCountValue * 4;
    } else {
      this.eventTextValuesBaseWord = 0;
      this.attrValuesBaseWord = 0;
    }

    const expectedBytes = cursor;
    if (this.view.byteLength !== expectedBytes) {
      throw new Error(`${capitalize(this.label)} table length mismatch`);
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
    const type = this.readEventU32(index, 0);
    if (type >= 0 && type <= 5) {
      return type as IterableEventType;
    }
    throw new Error(`Unsupported ${this.label} event type: ${type}`);
  }

  buffer(): Uint8Array {
    return this.source;
  }

  nameStart(index: number): number {
    return this.readEventI32(index, 1);
  }

  nameEnd(index: number): number {
    return this.readEventI32(index, 2);
  }

  textStart(index: number): number {
    return this.readEventI32(index, 3);
  }

  textEnd(index: number): number {
    return this.readEventI32(index, 4);
  }

  attrCount(index: number): number {
    return this.readEventU32(index, 6);
  }

  attrNameStart(eventIndex: number, attrIndex: number): number {
    return this.readAttrI32(this.attrTableIndex(eventIndex, attrIndex), 0);
  }

  attrNameEnd(eventIndex: number, attrIndex: number): number {
    return this.readAttrI32(this.attrTableIndex(eventIndex, attrIndex), 1);
  }

  attrValueStart(eventIndex: number, attrIndex: number): number {
    return this.readAttrI32(this.attrTableIndex(eventIndex, attrIndex), 2);
  }

  attrValueEnd(eventIndex: number, attrIndex: number): number {
    return this.readAttrI32(this.attrTableIndex(eventIndex, attrIndex), 3);
  }

  copyName(index: number): string | undefined {
    return this.copyNameSpan(this.nameStart(index), this.nameEnd(index), this.eventNameId(index));
  }

  copyText(index: number): string | undefined {
    return this.copyValueSpan(
      this.textStart(index),
      this.textEnd(index),
      this.eventTextValueId(index),
    );
  }

  copyAttrName(eventIndex: number, attrIndex: number): string | undefined {
    if (attrIndex < 0 || attrIndex >= this.attrCount(eventIndex)) {
      return undefined;
    }
    return this.copyNameSpan(
      this.attrNameStart(eventIndex, attrIndex),
      this.attrNameEnd(eventIndex, attrIndex),
      this.attrNameId(eventIndex, attrIndex),
    );
  }

  copyAttrValue(eventIndex: number, attrIndex: number): string | undefined {
    if (attrIndex < 0 || attrIndex >= this.attrCount(eventIndex)) {
      return undefined;
    }
    return this.copyValueSpan(
      this.attrValueStart(eventIndex, attrIndex),
      this.attrValueEnd(eventIndex, attrIndex),
      this.attrValueId(eventIndex, attrIndex),
    );
  }

  copyAttrValueByName(eventIndex: number, name: string): string | undefined {
    const count = this.attrCount(eventIndex);
    const cachedNameId = this.nameIdReverseCache.get(name);
    if (cachedNameId !== undefined && cachedNameId > 0) {
      for (let attrIndex = 0; attrIndex < count; attrIndex++) {
        if (this.attrNameId(eventIndex, attrIndex) === cachedNameId) {
          return this.copyAttrValue(eventIndex, attrIndex);
        }
      }
    }

    for (let attrIndex = 0; attrIndex < count; attrIndex++) {
      if (this.copyAttrName(eventIndex, attrIndex) === name) {
        const nameId = this.attrNameId(eventIndex, attrIndex);
        if (nameId > 0) {
          this.nameIdReverseCache.set(name, nameId);
        }
        return this.copyAttrValue(eventIndex, attrIndex);
      }
    }
    return undefined;
  }

  isImplicitAttributeValue(_eventIndex: number, _attrIndex: number): boolean {
    return false;
  }

  copyAttributesObject(eventIndex: number): Record<string, string> {
    const count = this.attrCount(eventIndex);
    if (count === 0) {
      return {};
    }
    const attributes: Record<string, string> = {};
    for (let attrIndex = 0; attrIndex < count; attrIndex++) {
      const name = this.copyAttrName(eventIndex, attrIndex);
      const value = this.copyAttrValue(eventIndex, attrIndex);
      if (name !== undefined && value !== undefined) {
        attributes[name] = value;
      }
    }
    return attributes;
  }

  batchFrame(): IterableReaderBatchFrame {
    if (this.frame) {
      return this.frame;
    }

    const eventTypes = new Uint8Array(this.eventCountValue);
    const nameStarts = new Int32Array(this.eventCountValue);
    const nameEnds = new Int32Array(this.eventCountValue);
    const nameIds = new Int32Array(this.eventCountValue);
    const textStarts = new Int32Array(this.eventCountValue);
    const textEnds = new Int32Array(this.eventCountValue);
    const attrStarts = new Int32Array(this.eventCountValue);
    const attrCounts = new Int32Array(this.eventCountValue);
    const attrNameStarts = new Int32Array(this.attrCountValue);
    const attrNameEnds = new Int32Array(this.attrCountValue);
    const attrNameIds = new Int32Array(this.attrCountValue);
    const attrValueStarts = new Int32Array(this.attrCountValue);
    const attrValueEnds = new Int32Array(this.attrCountValue);

    nameIds.fill(-1);
    attrNameIds.fill(-1);
    for (let eventIndex = 0; eventIndex < this.eventCountValue; eventIndex++) {
      eventTypes[eventIndex] = this.readEventU32(eventIndex, 0);
      nameStarts[eventIndex] = this.readEventI32(eventIndex, 1);
      nameEnds[eventIndex] = this.readEventI32(eventIndex, 2);
      textStarts[eventIndex] = this.readEventI32(eventIndex, 3);
      textEnds[eventIndex] = this.readEventI32(eventIndex, 4);
      attrStarts[eventIndex] = this.readEventU32(eventIndex, 5);
      attrCounts[eventIndex] = this.readEventU32(eventIndex, 6);
      nameIds[eventIndex] = this.eventNameId(eventIndex) > 0 ? this.eventNameId(eventIndex) : -1;
    }
    for (let attrIndex = 0; attrIndex < this.attrCountValue; attrIndex++) {
      attrNameStarts[attrIndex] = this.readAttrI32(attrIndex, 0);
      attrNameEnds[attrIndex] = this.readAttrI32(attrIndex, 1);
      attrValueStarts[attrIndex] = this.readAttrI32(attrIndex, 2);
      attrValueEnds[attrIndex] = this.readAttrI32(attrIndex, 3);
      attrNameIds[attrIndex] = this.attrNameIdFromTable(attrIndex) > 0 ? this.attrNameIdFromTable(attrIndex) : -1;
    }

    this.frame = {
      eventCount: this.eventCountValue,
      attrCount: this.attrCountValue,
      buffer: this.source,
      eventTypes,
      nameStarts,
      nameEnds,
      nameIds,
      textStarts,
      textEnds,
      attrStarts,
      attrCounts,
      attrNameStarts,
      attrNameEnds,
      attrNameIds,
      attrValueStarts,
      attrValueEnds,
    };
    return this.frame;
  }

  rawBatch(): StreamReaderSyncRawBatch {
    if (this.u32 && this.i32) {
      return {
        kind: 'word-table',
        eventCount: this.eventCountValue,
        attrCount: this.attrCountValue,
        buffer: this.source,
        eventWords: this.u32,
        spanWords: this.i32,
        eventWordOffset: STRUCTURAL_INDEX_HEADER_WORDS,
        eventStrideWords: STRUCTURAL_INDEX_EVENT_WORDS,
        attrWordOffset: this.attrBaseWord,
        attrStrideWords: STRUCTURAL_INDEX_ATTR_WORDS,
      };
    }

    const frame = this.batchFrame();
    return {
      kind: 'frame',
      eventCount: frame.eventCount,
      attrCount: frame.attrCount,
      buffer: frame.buffer,
      eventTypes: frame.eventTypes,
      nameStarts: frame.nameStarts,
      nameEnds: frame.nameEnds,
      nameIds: frame.nameIds,
      textStarts: frame.textStarts,
      textEnds: frame.textEnds,
      attrStarts: frame.attrStarts,
      attrCounts: frame.attrCounts,
      attrNameStarts: frame.attrNameStarts,
      attrNameEnds: frame.attrNameEnds,
      attrNameIds: frame.attrNameIds,
      attrValueStarts: frame.attrValueStarts,
      attrValueEnds: frame.attrValueEnds,
    };
  }

  private eventOffset(index: number): number {
    return STRUCTURAL_INDEX_HEADER_BYTES + index * STRUCTURAL_INDEX_EVENT_BYTES;
  }

  private eventWord(index: number): number {
    return STRUCTURAL_INDEX_HEADER_WORDS + index * STRUCTURAL_INDEX_EVENT_WORDS;
  }

  private readEventU32(index: number, fieldWord: number): number {
    return this.u32?.[this.eventWord(index) + fieldWord]
      ?? this.view.getUint32(this.eventOffset(index) + fieldWord * 4, true);
  }

  private readEventI32(index: number, fieldWord: number): number {
    return this.i32?.[this.eventWord(index) + fieldWord]
      ?? this.view.getInt32(this.eventOffset(index) + fieldWord * 4, true);
  }

  private attrTableIndex(eventIndex: number, attrIndex: number): number {
    return this.readEventU32(eventIndex, 5) + attrIndex;
  }

  private attrWord(attrIndex: number): number {
    return this.attrBaseWord + attrIndex * STRUCTURAL_INDEX_ATTR_WORDS;
  }

  private readAttrI32(attrIndex: number, fieldWord: number): number {
    return this.i32?.[this.attrWord(attrIndex) + fieldWord]
      ?? this.view.getInt32(this.attrBase + attrIndex * STRUCTURAL_INDEX_ATTR_BYTES + fieldWord * 4, true);
  }

  private copyValueSpan(start: number, end: number, valueId: number): string | undefined {
    if (start < 0 || end < 0) {
      return undefined;
    }
    if (valueId > 0) {
      return rememberNumericIdString(
        this.valueIdCache,
        valueId,
        () => this.decodeSpan(start, end),
        VALUE_ID_CACHE_MAX_ENTRIES,
      );
    }
    return this.shortValueCache.rememberBytes(this.source, start, end, () => this.decodeSpan(start, end));
  }

  private decodeSpan(start: number, end: number): string {
    const ascii = decodeShortAsciiSpan(this.source, start, end);
    if (ascii !== undefined) {
      return ascii;
    }
    return this.decodeUtf8Span(start, end);
  }

  private copyNameSpan(start: number, end: number, nameId: number): string | undefined {
    if (start < 0 || end < 0) {
      return undefined;
    }
    if (nameId > 0) {
      const cachedById = this.nameIdCache.get(nameId);
      if (cachedById !== undefined) {
        return cachedById;
      }
      const value = this.decodeSpan(start, end);
      this.nameIdCache.set(nameId, value);
      this.nameIdReverseCache.set(value, nameId);
      return value;
    }

    const key = byteSpanKey(this.source, start, end);
    const cached = this.nameHashCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const value = this.decodeSpan(start, end);
    this.nameHashCache.set(key, value);
    return value;
  }

  private eventNameId(index: number): number {
    return this.eventNamesBase === undefined
      ? 0
      : this.u32?.[this.eventNamesBaseWord + index]
        ?? this.view.getUint32(this.eventNamesBase + index * 4, true);
  }

  private attrNameId(eventIndex: number, attrIndex: number): number {
    return this.attrNameIdFromTable(this.attrTableIndex(eventIndex, attrIndex));
  }

  private attrNameIdFromTable(attrIndex: number): number {
    return this.attrNamesBase === undefined
      ? 0
      : this.u32?.[this.attrNamesBaseWord + attrIndex]
        ?? this.view.getUint32(this.attrNamesBase + attrIndex * 4, true);
  }

  private eventTextValueId(index: number): number {
    return this.eventTextValuesBase === undefined
      ? 0
      : this.u32?.[this.eventTextValuesBaseWord + index]
        ?? this.view.getUint32(this.eventTextValuesBase + index * 4, true);
  }

  private attrValueId(eventIndex: number, attrIndex: number): number {
    return this.attrValueIdFromTable(this.attrTableIndex(eventIndex, attrIndex));
  }

  private attrValueIdFromTable(attrIndex: number): number {
    return this.attrValuesBase === undefined
      ? 0
      : this.u32?.[this.attrValuesBaseWord + attrIndex]
        ?? this.view.getUint32(this.attrValuesBase + attrIndex * 4, true);
  }
}

export class StreamingSoaStringArenaAdapter implements TableBackedEventSource {
  readonly eventCountValue: number;
  readonly attrCountValue: number;

  private readonly view: DataView;
  private readonly u32: Uint32Array;
  private readonly i32: Int32Array;
  private readonly eventTypes: Uint32Array;
  private readonly nameStarts: Int32Array;
  private readonly nameEnds: Int32Array;
  private readonly textStarts: Int32Array;
  private readonly textEnds: Int32Array;
  private readonly attrStarts: Uint32Array;
  private readonly attrCounts: Uint32Array;
  private readonly eventNameIds: Uint32Array;
  private readonly eventTextValueIds: Uint32Array;
  private readonly eventNameArenaStarts: Int32Array;
  private readonly eventNameArenaEnds: Int32Array;
  private readonly eventTextArenaStarts: Int32Array;
  private readonly eventTextArenaEnds: Int32Array;
  private readonly attrNameStarts: Int32Array;
  private readonly attrNameEnds: Int32Array;
  private readonly attrValueStarts: Int32Array;
  private readonly attrValueEnds: Int32Array;
  private readonly attrNameIds: Uint32Array;
  private readonly attrValueIds: Uint32Array;
  private readonly attrNameArenaStarts: Int32Array;
  private readonly attrNameArenaEnds: Int32Array;
  private readonly attrValueArenaStarts: Int32Array;
  private readonly attrValueArenaEnds: Int32Array;
  private readonly decodeUtf8Span: (start: number, end: number) => string;
  private frame: IterableReaderBatchFrame | undefined;

  constructor(
    private readonly source: Uint8Array,
    table: ArrayBuffer | ArrayBufferView,
    private readonly stringArena: string,
    private readonly label = 'streaming SoA string arena',
    private readonly nameIdCache = new Map<number, string>(),
    private readonly valueIdCache = new Map<number, string>(),
    private readonly nameHashCache = new Map<number, string>(),
    private readonly shortValueCache = new ShortValueStringCache(),
    private readonly nameIdReverseCache = new Map<string, number>(),
  ) {
    this.view = createAlignedDataView(table);
    this.u32 = new Uint32Array(this.view.buffer, this.view.byteOffset, this.view.byteLength / 4);
    this.i32 = new Int32Array(this.view.buffer, this.view.byteOffset, this.view.byteLength / 4);
    this.decodeUtf8Span = createUtf8SpanDecoder(this.source);

    if (this.u32.length < SOA_STRING_ARENA_HEADER_WORDS) {
      throw new Error(`${capitalize(this.label)} table is shorter than the header`);
    }
    const magic = this.u32[0]!;
    if (magic !== SOA_STRING_ARENA_MAGIC) {
      throw new Error(`Invalid ${this.label} magic: 0x${magic.toString(16)}`);
    }
    const version = this.u32[1]!;
    if (version !== SOA_STRING_ARENA_VERSION) {
      throw new Error(`Unsupported ${this.label} version: ${version}`);
    }

    this.eventCountValue = this.u32[2]!;
    this.attrCountValue = this.u32[3]!;
    const sourceUnits = this.u32[4]!;
    const sourceKind = this.u32[5]!;
    const totalWords = this.u32[29]!;
    if (sourceUnits !== source.byteLength) {
      throw new Error(`${capitalize(this.label)} input length mismatch: ${sourceUnits}/${source.byteLength}`);
    }
    if (sourceKind !== SOA_STRING_ARENA_SOURCE_KIND_UTF8) {
      throw new Error(`${capitalize(this.label)} source kind mismatch: ${sourceKind}`);
    }
    if (totalWords !== this.u32.length) {
      throw new Error(`${capitalize(this.label)} table length mismatch`);
    }

    this.eventTypes = this.columnU32(6, this.eventCountValue);
    this.nameStarts = this.columnI32(7, this.eventCountValue);
    this.nameEnds = this.columnI32(8, this.eventCountValue);
    this.textStarts = this.columnI32(9, this.eventCountValue);
    this.textEnds = this.columnI32(10, this.eventCountValue);
    this.attrStarts = this.columnU32(11, this.eventCountValue);
    this.attrCounts = this.columnU32(12, this.eventCountValue);
    this.eventNameIds = this.columnU32(13, this.eventCountValue);
    this.eventTextValueIds = this.columnU32(14, this.eventCountValue);
    this.eventNameArenaStarts = this.columnI32(15, this.eventCountValue);
    this.eventNameArenaEnds = this.columnI32(16, this.eventCountValue);
    this.eventTextArenaStarts = this.columnI32(17, this.eventCountValue);
    this.eventTextArenaEnds = this.columnI32(18, this.eventCountValue);
    this.attrNameStarts = this.columnI32(19, this.attrCountValue);
    this.attrNameEnds = this.columnI32(20, this.attrCountValue);
    this.attrValueStarts = this.columnI32(21, this.attrCountValue);
    this.attrValueEnds = this.columnI32(22, this.attrCountValue);
    this.attrNameIds = this.columnU32(23, this.attrCountValue);
    this.attrValueIds = this.columnU32(24, this.attrCountValue);
    this.attrNameArenaStarts = this.columnI32(25, this.attrCountValue);
    this.attrNameArenaEnds = this.columnI32(26, this.attrCountValue);
    this.attrValueArenaStarts = this.columnI32(27, this.attrCountValue);
    this.attrValueArenaEnds = this.columnI32(28, this.attrCountValue);
  }

  eventCount(): number {
    return this.eventCountValue;
  }

  eventType(index: number): IterableEventType {
    const type = this.eventTypes[index]!;
    if (type >= 0 && type <= 5) {
      return type as IterableEventType;
    }
    throw new Error(`Unsupported ${this.label} event type: ${type}`);
  }

  buffer(): Uint8Array {
    return this.source;
  }

  nameStart(index: number): number {
    return this.nameStarts[index]!;
  }

  nameEnd(index: number): number {
    return this.nameEnds[index]!;
  }

  textStart(index: number): number {
    return this.textStarts[index]!;
  }

  textEnd(index: number): number {
    return this.textEnds[index]!;
  }

  attrCount(index: number): number {
    return this.attrCounts[index]!;
  }

  attrNameStart(eventIndex: number, attrIndex: number): number {
    return this.attrNameStarts[this.attrTableIndex(eventIndex, attrIndex)]!;
  }

  attrNameEnd(eventIndex: number, attrIndex: number): number {
    return this.attrNameEnds[this.attrTableIndex(eventIndex, attrIndex)]!;
  }

  attrValueStart(eventIndex: number, attrIndex: number): number {
    return this.attrValueStarts[this.attrTableIndex(eventIndex, attrIndex)]!;
  }

  attrValueEnd(eventIndex: number, attrIndex: number): number {
    return this.attrValueEnds[this.attrTableIndex(eventIndex, attrIndex)]!;
  }

  copyName(index: number): string | undefined {
    return this.copyNameSpan(
      this.nameStarts[index]!,
      this.nameEnds[index]!,
      this.eventNameArenaStarts[index]!,
      this.eventNameArenaEnds[index]!,
      this.eventNameIds[index]!,
    );
  }

  copyText(index: number): string | undefined {
    return this.copyValueSpan(
      this.textStarts[index]!,
      this.textEnds[index]!,
      this.eventTextArenaStarts[index]!,
      this.eventTextArenaEnds[index]!,
      this.eventTextValueIds[index]!,
    );
  }

  copyAttrName(eventIndex: number, attrIndex: number): string | undefined {
    if (attrIndex < 0 || attrIndex >= this.attrCount(eventIndex)) {
      return undefined;
    }
    const tableIndex = this.attrTableIndex(eventIndex, attrIndex);
    return this.copyNameSpan(
      this.attrNameStarts[tableIndex]!,
      this.attrNameEnds[tableIndex]!,
      this.attrNameArenaStarts[tableIndex]!,
      this.attrNameArenaEnds[tableIndex]!,
      this.attrNameIds[tableIndex]!,
    );
  }

  copyAttrValue(eventIndex: number, attrIndex: number): string | undefined {
    if (attrIndex < 0 || attrIndex >= this.attrCount(eventIndex)) {
      return undefined;
    }
    const tableIndex = this.attrTableIndex(eventIndex, attrIndex);
    return this.copyValueSpan(
      this.attrValueStarts[tableIndex]!,
      this.attrValueEnds[tableIndex]!,
      this.attrValueArenaStarts[tableIndex]!,
      this.attrValueArenaEnds[tableIndex]!,
      this.attrValueIds[tableIndex]!,
    );
  }

  copyAttrValueByName(eventIndex: number, name: string): string | undefined {
    const count = this.attrCount(eventIndex);
    const cachedNameId = this.nameIdReverseCache.get(name);
    if (cachedNameId !== undefined && cachedNameId > 0) {
      for (let attrIndex = 0; attrIndex < count; attrIndex++) {
        if (this.attrNameId(eventIndex, attrIndex) === cachedNameId) {
          return this.copyAttrValue(eventIndex, attrIndex);
        }
      }
    }

    for (let attrIndex = 0; attrIndex < count; attrIndex++) {
      if (this.copyAttrName(eventIndex, attrIndex) === name) {
        const nameId = this.attrNameId(eventIndex, attrIndex);
        if (nameId > 0) {
          this.nameIdReverseCache.set(name, nameId);
        }
        return this.copyAttrValue(eventIndex, attrIndex);
      }
    }
    return undefined;
  }

  isImplicitAttributeValue(_eventIndex: number, _attrIndex: number): boolean {
    return false;
  }

  copyAttributesObject(eventIndex: number): Record<string, string> {
    const count = this.attrCount(eventIndex);
    if (count === 0) {
      return {};
    }
    const attributes: Record<string, string> = {};
    for (let attrIndex = 0; attrIndex < count; attrIndex++) {
      const name = this.copyAttrName(eventIndex, attrIndex);
      const value = this.copyAttrValue(eventIndex, attrIndex);
      if (name !== undefined && value !== undefined) {
        attributes[name] = value;
      }
    }
    return attributes;
  }

  batchFrame(): IterableReaderBatchFrame {
    if (this.frame) {
      return this.frame;
    }

    const eventTypes = new Uint8Array(this.eventCountValue);
    const nameIds = new Int32Array(this.eventCountValue);
    const attrNameIds = new Int32Array(this.attrCountValue);
    for (let index = 0; index < this.eventCountValue; index++) {
      eventTypes[index] = this.eventTypes[index]!;
      nameIds[index] = this.eventNameIds[index]! > 0 ? this.eventNameIds[index]! : -1;
    }
    for (let index = 0; index < this.attrCountValue; index++) {
      attrNameIds[index] = this.attrNameIds[index]! > 0 ? this.attrNameIds[index]! : -1;
    }

    this.frame = {
      eventCount: this.eventCountValue,
      attrCount: this.attrCountValue,
      buffer: this.source,
      eventTypes,
      nameStarts: new Int32Array(this.nameStarts),
      nameEnds: new Int32Array(this.nameEnds),
      nameIds,
      textStarts: new Int32Array(this.textStarts),
      textEnds: new Int32Array(this.textEnds),
      attrStarts: new Int32Array(this.attrStarts),
      attrCounts: new Int32Array(this.attrCounts),
      attrNameStarts: new Int32Array(this.attrNameStarts),
      attrNameEnds: new Int32Array(this.attrNameEnds),
      attrNameIds,
      attrValueStarts: new Int32Array(this.attrValueStarts),
      attrValueEnds: new Int32Array(this.attrValueEnds),
    };
    return this.frame;
  }

  rawBatch(): StreamReaderSyncRawBatch {
    return {
      kind: 'soa-string-arena',
      eventCount: this.eventCountValue,
      attrCount: this.attrCountValue,
      buffer: this.source,
      stringArena: this.stringArena,
      eventTypes: this.eventTypes,
      nameStarts: this.nameStarts,
      nameEnds: this.nameEnds,
      textStarts: this.textStarts,
      textEnds: this.textEnds,
      attrStarts: this.attrStarts,
      attrCounts: this.attrCounts,
      eventNameIds: this.eventNameIds,
      eventTextValueIds: this.eventTextValueIds,
      eventNameArenaStarts: this.eventNameArenaStarts,
      eventNameArenaEnds: this.eventNameArenaEnds,
      eventTextArenaStarts: this.eventTextArenaStarts,
      eventTextArenaEnds: this.eventTextArenaEnds,
      attrNameStarts: this.attrNameStarts,
      attrNameEnds: this.attrNameEnds,
      attrValueStarts: this.attrValueStarts,
      attrValueEnds: this.attrValueEnds,
      attrNameIds: this.attrNameIds,
      attrValueIds: this.attrValueIds,
      attrNameArenaStarts: this.attrNameArenaStarts,
      attrNameArenaEnds: this.attrNameArenaEnds,
      attrValueArenaStarts: this.attrValueArenaStarts,
      attrValueArenaEnds: this.attrValueArenaEnds,
    };
  }

  private columnU32(headerWord: number, length: number): Uint32Array {
    const start = this.u32[headerWord]!;
    const end = start + length;
    if (start < SOA_STRING_ARENA_HEADER_WORDS || end > this.u32.length) {
      throw new Error(`${capitalize(this.label)} column ${headerWord} is out of range`);
    }
    return this.u32.subarray(start, end);
  }

  private columnI32(headerWord: number, length: number): Int32Array {
    const start = this.u32[headerWord]!;
    const end = start + length;
    if (start < SOA_STRING_ARENA_HEADER_WORDS || end > this.i32.length) {
      throw new Error(`${capitalize(this.label)} column ${headerWord} is out of range`);
    }
    return this.i32.subarray(start, end);
  }

  private attrTableIndex(eventIndex: number, attrIndex: number): number {
    return this.attrStarts[eventIndex]! + attrIndex;
  }

  private attrNameId(eventIndex: number, attrIndex: number): number {
    return this.attrNameIds[this.attrTableIndex(eventIndex, attrIndex)]!;
  }

  private copyNameSpan(
    byteStart: number,
    byteEnd: number,
    arenaStart: number,
    arenaEnd: number,
    nameId: number,
  ): string | undefined {
    if (!hasStringSpan(byteStart, byteEnd, arenaStart, arenaEnd)) {
      return undefined;
    }
    if (nameId > 0) {
      const cachedById = this.nameIdCache.get(nameId);
      if (cachedById !== undefined) {
        return cachedById;
      }
      const value = this.materializeSpanString(byteStart, byteEnd, arenaStart, arenaEnd);
      if (value === undefined) {
        return undefined;
      }
      this.nameIdCache.set(nameId, value);
      this.nameIdReverseCache.set(value, nameId);
      return value;
    }

    if (byteStart < 0 || byteEnd < 0) {
      return this.materializeSpanString(byteStart, byteEnd, arenaStart, arenaEnd);
    }
    const key = byteSpanKey(this.source, byteStart, byteEnd);
    const cached = this.nameHashCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const value = this.materializeSpanString(byteStart, byteEnd, arenaStart, arenaEnd);
    if (value !== undefined) {
      this.nameHashCache.set(key, value);
    }
    return value;
  }

  private copyValueSpan(
    byteStart: number,
    byteEnd: number,
    arenaStart: number,
    arenaEnd: number,
    valueId: number,
  ): string | undefined {
    if (!hasStringSpan(byteStart, byteEnd, arenaStart, arenaEnd)) {
      return undefined;
    }
    if (valueId > 0) {
      return rememberNumericIdString(
        this.valueIdCache,
        valueId,
        () => this.materializeSpanString(byteStart, byteEnd, arenaStart, arenaEnd) ?? '',
        VALUE_ID_CACHE_MAX_ENTRIES,
      );
    }
    if (arenaStart >= 0 && arenaEnd >= 0) {
      return this.shortValueCache.rememberString(
        this.stringArena,
        arenaStart,
        arenaEnd,
        () => this.stringArena.slice(arenaStart, arenaEnd),
      );
    }
    return this.shortValueCache.rememberBytes(
      this.source,
      byteStart,
      byteEnd,
      () => this.decodeSpan(byteStart, byteEnd),
    );
  }

  private materializeSpanString(
    byteStart: number,
    byteEnd: number,
    arenaStart: number,
    arenaEnd: number,
  ): string | undefined {
    if (arenaStart >= 0 && arenaEnd >= 0) {
      return this.stringArena.slice(arenaStart, arenaEnd);
    }
    if (byteStart < 0 || byteEnd < 0) {
      return undefined;
    }
    return this.decodeSpan(byteStart, byteEnd);
  }

  private decodeSpan(start: number, end: number): string {
    const ascii = decodeShortAsciiSpan(this.source, start, end);
    if (ascii !== undefined) {
      return ascii;
    }
    return this.decodeUtf8Span(start, end);
  }
}

export class StreamingEventBatchReader implements TableBackedEventSource {
  private readonly pendingChunks: Uint8Array[] = [];
  private readonly pendingTables: TableBackedEventSource[] = [];
  private readonly nameIdCache = new Map<number, string>();
  private readonly valueIdCache = new Map<number, string>();
  private readonly nameHashCache = new Map<number, string>();
  private readonly shortValueCache = new ShortValueStringCache();
  private readonly nameIdReverseCache = new Map<string, number>();
  private pendingChunkCursor = 0;
  private pendingTableCursor = 0;
  private currentTable: TableBackedEventSource | undefined;
  private sourceDone = false;
  private finalPushed = false;
  private finished = false;

  constructor(
    private readonly streamingParser: StaxXmlStreamingEventBatchParser,
    private readonly sourceIterator?: Iterator<StreamingByteBatch>,
  ) {}

  activatePendingBatch(): boolean {
    if (this.finished) {
      return false;
    }
    return this.activatePendingTable();
  }

  nextBatch(): boolean {
    return this.nextTable() !== null;
  }

  nextTable(): TableBackedEventSource | null {
    if (this.finished) {
      return null;
    }
    if (this.activatePendingTable()) {
      return this.currentTable!;
    }
    if (this.drainPendingChunks()) {
      return this.currentTable!;
    }

    while (!this.sourceDone && this.sourceIterator) {
      const result = this.sourceIterator.next();
      if (result.done) {
        this.sourceDone = true;
        break;
      }
      if (this.pushStreamingByteBatch(result.value, false)) {
        return this.currentTable!;
      }
    }

    if (this.sourceDone && this.pushFinalChunk()) {
      return this.currentTable!;
    }

    this.finished = true;
    return null;
  }

  pushByteBatch(batch: StreamingByteBatch, isFinal = false): boolean {
    if (this.finished) {
      return false;
    }
    if (this.activatePendingTable()) {
      return true;
    }
    return this.pushStreamingByteBatch(batch, isFinal);
  }

  eventCount(): number {
    return this.requireCurrentTable().eventCount();
  }

  eventType(index: number): IterableEventType {
    return this.requireCurrentTable().eventType(index);
  }

  buffer(): Uint8Array {
    return this.currentTable?.buffer() ?? EMPTY_BUFFER;
  }

  nameStart(index: number): number {
    return this.requireCurrentTable().nameStart(index);
  }

  nameEnd(index: number): number {
    return this.requireCurrentTable().nameEnd(index);
  }

  textStart(index: number): number {
    return this.requireCurrentTable().textStart(index);
  }

  textEnd(index: number): number {
    return this.requireCurrentTable().textEnd(index);
  }

  attrCount(index: number): number {
    return this.requireCurrentTable().attrCount(index);
  }

  attrNameStart(eventIndex: number, attrIndex: number): number {
    return this.requireCurrentTable().attrNameStart(eventIndex, attrIndex);
  }

  attrNameEnd(eventIndex: number, attrIndex: number): number {
    return this.requireCurrentTable().attrNameEnd(eventIndex, attrIndex);
  }

  attrValueStart(eventIndex: number, attrIndex: number): number {
    return this.requireCurrentTable().attrValueStart(eventIndex, attrIndex);
  }

  attrValueEnd(eventIndex: number, attrIndex: number): number {
    return this.requireCurrentTable().attrValueEnd(eventIndex, attrIndex);
  }

  copyName(index: number): string | undefined {
    return this.requireCurrentTable().copyName(index);
  }

  copyText(index: number): string | undefined {
    return this.requireCurrentTable().copyText(index);
  }

  copyAttrName(eventIndex: number, attrIndex: number): string | undefined {
    return this.requireCurrentTable().copyAttrName(eventIndex, attrIndex);
  }

  copyAttrValue(eventIndex: number, attrIndex: number): string | undefined {
    return this.requireCurrentTable().copyAttrValue(eventIndex, attrIndex);
  }

  copyAttrValueByName(eventIndex: number, name: string): string | undefined {
    return this.requireCurrentTable().copyAttrValueByName(eventIndex, name);
  }

  isImplicitAttributeValue(eventIndex: number, attrIndex: number): boolean {
    return this.requireCurrentTable().isImplicitAttributeValue(eventIndex, attrIndex);
  }

  copyAttributesObject(eventIndex: number): Record<string, string> {
    return this.requireCurrentTable().copyAttributesObject(eventIndex);
  }

  batchFrame(): IterableReaderBatchFrame {
    return this.requireCurrentTable().batchFrame();
  }

  rawBatch(): StreamReaderSyncRawBatch {
    return this.requireCurrentTable().rawBatch();
  }

  private enqueueChunks(batch: StreamingByteBatch): void {
    for (let index = 0; index < batch.length; index++) {
      this.pendingChunks.push(batch[index]!);
    }
  }

  private drainPendingChunks(): boolean {
    while (this.pendingChunkCursor < this.pendingChunks.length) {
      const chunk = this.pendingChunks[this.pendingChunkCursor++]!;
      this.enqueueNativeBatch(this.streamingParser.pushChunk(chunk, false));
      if (this.activatePendingTable()) {
        this.compactPendingChunks();
        return true;
      }
    }
    this.compactPendingChunks();
    return false;
  }

  private pushFinalChunk(): boolean {
    if (this.finalPushed) {
      return false;
    }
    this.finalPushed = true;
    if (this.streamingParser.pushBatch) {
      this.enqueueNativeBatch(this.streamingParser.pushBatch([], true));
    } else {
      this.enqueueNativeBatch(this.streamingParser.pushChunk(EMPTY_BUFFER, true));
    }
    return this.activatePendingTable();
  }

  private pushStreamingByteBatch(batch: StreamingByteBatch, isFinal: boolean): boolean {
    if (this.streamingParser.pushBatch) {
      if (isFinal) {
        this.sourceDone = true;
        this.finalPushed = true;
      }
      this.enqueueNativeBatch(this.streamingParser.pushBatch(batch, isFinal));
      const activated = this.activatePendingTable();
      if (isFinal && !activated) {
        this.finished = true;
      }
      return activated;
    }

    if (batch.length > 0) {
      this.enqueueChunks(batch);
      if (this.drainPendingChunks()) {
        return true;
      }
    }

    if (isFinal) {
      this.sourceDone = true;
      if (this.pushFinalChunk()) {
        return true;
      }
      this.finished = true;
    }

    return false;
  }

  private enqueueNativeBatch(batch: StreamingNativeBatch): void {
    const source = toUint8Array(batch.buffer);
    const table = batch.soaTable !== undefined && batch.stringArena !== undefined
      ? new StreamingSoaStringArenaAdapter(
          source,
          batch.soaTable,
          batch.stringArena,
          'streaming SoA string arena',
          this.nameIdCache,
          this.valueIdCache,
          this.nameHashCache,
          this.shortValueCache,
          this.nameIdReverseCache,
        )
      : batch.table !== undefined
        ? new StreamingSpanTableAdapter(
            source,
            batch.table,
            'streaming structural index',
            this.nameIdCache,
            this.valueIdCache,
            this.nameHashCache,
            this.shortValueCache,
            this.nameIdReverseCache,
          )
        : undefined;
    if (table === undefined) {
      throw new Error('Native streaming event batch did not include a supported table layout.');
    }
    if (table.eventCount() > 0) {
      this.pendingTables.push(table);
    }
  }

  private activatePendingTable(): boolean {
    if (this.pendingTableCursor >= this.pendingTables.length) {
      this.compactPendingTables();
      return false;
    }
    const table = this.pendingTables[this.pendingTableCursor++]!;
    if (!table) {
      return false;
    }
    this.currentTable = table;
    this.compactPendingTables();
    return true;
  }

  private compactPendingChunks(): void {
    if (this.pendingChunkCursor === 0) {
      return;
    }
    if (this.pendingChunkCursor >= this.pendingChunks.length) {
      this.pendingChunks.length = 0;
      this.pendingChunkCursor = 0;
      return;
    }
    if (this.pendingChunkCursor >= 64) {
      this.pendingChunks.splice(0, this.pendingChunkCursor);
      this.pendingChunkCursor = 0;
    }
  }

  private compactPendingTables(): void {
    if (this.pendingTableCursor === 0) {
      return;
    }
    if (this.pendingTableCursor >= this.pendingTables.length) {
      this.pendingTables.length = 0;
      this.pendingTableCursor = 0;
      return;
    }
    if (this.pendingTableCursor >= 64) {
      this.pendingTables.splice(0, this.pendingTableCursor);
      this.pendingTableCursor = 0;
    }
  }

  private requireCurrentTable(): TableBackedEventSource {
    if (!this.currentTable) {
      throw new Error('No active native streaming event batch.');
    }
    return this.currentTable;
  }
}

export function toUint8Array(input: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (input instanceof Uint8Array) {
    const bufferCtor = (globalThis as {
      Buffer?: {
        isBuffer(value: unknown): boolean;
        from(buffer: ArrayBufferLike, byteOffset?: number, length?: number): Uint8Array;
      };
    }).Buffer;
    if (bufferCtor && !bufferCtor.isBuffer(input)) {
      return bufferCtor.from(input.buffer, input.byteOffset, input.byteLength);
    }
    return input;
  }
  return input instanceof ArrayBuffer
    ? new Uint8Array(input)
    : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}

function createAlignedDataView(input: ArrayBuffer | ArrayBufferView): DataView {
  const view = input instanceof ArrayBuffer
    ? new DataView(input)
    : new DataView(input.buffer, input.byteOffset, input.byteLength);
  if (view.byteLength % 4 !== 0) {
    throw new Error(`SoA string arena table length must be 4-byte aligned: ${view.byteLength}`);
  }
  if (view.byteOffset % 4 === 0) {
    return view;
  }
  const copy = new Uint8Array(view.byteLength);
  copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return new DataView(copy.buffer);
}

function hasStringSpan(
  byteStart: number,
  byteEnd: number,
  arenaStart: number,
  arenaEnd: number,
): boolean {
  return (arenaStart >= 0 && arenaEnd >= 0) || (byteStart >= 0 && byteEnd >= 0);
}

function createUtf8SpanDecoder(source: Uint8Array): (start: number, end: number) => string {
  const bufferCtor = (globalThis as { Buffer?: { isBuffer(value: unknown): boolean } }).Buffer;
  if (bufferCtor?.isBuffer(source) && typeof (source as { toString?: unknown }).toString === 'function') {
    return (start: number, end: number) => (
      source as { toString(encoding: string, start: number, end: number): string }
    ).toString('utf8', start, end);
  }
  return (start: number, end: number) => utf8Decoder.decode(source.subarray(start, end));
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0]!.toUpperCase()}${value.slice(1)}`;
}
