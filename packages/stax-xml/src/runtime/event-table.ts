import type {
  IterableEventType,
  IterableReaderBatchFrame,
} from '../IterableReader.js';
import type { StaxXmlStreamingEventBatchParser } from './native-backend.js';

const STRUCTURAL_INDEX_MAGIC = 0x31545053;
const STRUCTURAL_INDEX_HEADER_BYTES = 28;
const STRUCTURAL_INDEX_EVENT_BYTES = 28;
const STRUCTURAL_INDEX_ATTR_BYTES = 16;
const STRUCTURAL_INDEX_SOURCE_KIND_UTF8 = 1;
const EMPTY_BUFFER = new Uint8Array(0);
const utf8Decoder = new TextDecoder();

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
}

export class StreamingSpanTableAdapter implements TableBackedEventSource {
  readonly eventCountValue: number;
  readonly attrCountValue: number;

  private readonly attrBase: number;
  private readonly view: DataView;
  private frame: IterableReaderBatchFrame | undefined;
  private consumed = false;

  constructor(
    private readonly source: Uint8Array,
    table: ArrayBuffer | ArrayBufferView,
    private readonly label = 'streaming structural index',
  ) {
    this.view = table instanceof ArrayBuffer
      ? new DataView(table)
      : new DataView(table.buffer, table.byteOffset, table.byteLength);
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
    const expectedBytes = this.attrBase + this.attrCountValue * STRUCTURAL_INDEX_ATTR_BYTES;
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
    const type = this.view.getUint32(this.eventOffset(index), true);
    if (type >= 0 && type <= 5) {
      return type as IterableEventType;
    }
    throw new Error(`Unsupported ${this.label} event type: ${type}`);
  }

  buffer(): Uint8Array {
    return this.source;
  }

  nameStart(index: number): number {
    return this.view.getInt32(this.eventOffset(index) + 4, true);
  }

  nameEnd(index: number): number {
    return this.view.getInt32(this.eventOffset(index) + 8, true);
  }

  textStart(index: number): number {
    return this.view.getInt32(this.eventOffset(index) + 12, true);
  }

  textEnd(index: number): number {
    return this.view.getInt32(this.eventOffset(index) + 16, true);
  }

  attrCount(index: number): number {
    return this.view.getUint32(this.eventOffset(index) + 24, true);
  }

  attrNameStart(eventIndex: number, attrIndex: number): number {
    return this.view.getInt32(this.attrOffset(eventIndex, attrIndex), true);
  }

  attrNameEnd(eventIndex: number, attrIndex: number): number {
    return this.view.getInt32(this.attrOffset(eventIndex, attrIndex) + 4, true);
  }

  attrValueStart(eventIndex: number, attrIndex: number): number {
    return this.view.getInt32(this.attrOffset(eventIndex, attrIndex) + 8, true);
  }

  attrValueEnd(eventIndex: number, attrIndex: number): number {
    return this.view.getInt32(this.attrOffset(eventIndex, attrIndex) + 12, true);
  }

  copyName(index: number): string | undefined {
    return this.copySpan(this.nameStart(index), this.nameEnd(index));
  }

  copyText(index: number): string | undefined {
    return this.copySpan(this.textStart(index), this.textEnd(index));
  }

  copyAttrName(eventIndex: number, attrIndex: number): string | undefined {
    if (attrIndex < 0 || attrIndex >= this.attrCount(eventIndex)) {
      return undefined;
    }
    return this.copySpan(this.attrNameStart(eventIndex, attrIndex), this.attrNameEnd(eventIndex, attrIndex));
  }

  copyAttrValue(eventIndex: number, attrIndex: number): string | undefined {
    if (attrIndex < 0 || attrIndex >= this.attrCount(eventIndex)) {
      return undefined;
    }
    return this.copySpan(this.attrValueStart(eventIndex, attrIndex), this.attrValueEnd(eventIndex, attrIndex));
  }

  copyAttrValueByName(eventIndex: number, name: string): string | undefined {
    const count = this.attrCount(eventIndex);
    for (let attrIndex = 0; attrIndex < count; attrIndex++) {
      if (this.copyAttrName(eventIndex, attrIndex) === name) {
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
      const eventOffset = this.eventOffset(eventIndex);
      eventTypes[eventIndex] = this.view.getUint32(eventOffset, true);
      nameStarts[eventIndex] = this.view.getInt32(eventOffset + 4, true);
      nameEnds[eventIndex] = this.view.getInt32(eventOffset + 8, true);
      textStarts[eventIndex] = this.view.getInt32(eventOffset + 12, true);
      textEnds[eventIndex] = this.view.getInt32(eventOffset + 16, true);
      attrStarts[eventIndex] = this.view.getUint32(eventOffset + 20, true);
      attrCounts[eventIndex] = this.view.getUint32(eventOffset + 24, true);
    }
    for (let attrIndex = 0; attrIndex < this.attrCountValue; attrIndex++) {
      const attrOffset = this.attrBase + attrIndex * STRUCTURAL_INDEX_ATTR_BYTES;
      attrNameStarts[attrIndex] = this.view.getInt32(attrOffset, true);
      attrNameEnds[attrIndex] = this.view.getInt32(attrOffset + 4, true);
      attrValueStarts[attrIndex] = this.view.getInt32(attrOffset + 8, true);
      attrValueEnds[attrIndex] = this.view.getInt32(attrOffset + 12, true);
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
    const bufferCtor = (globalThis as { Buffer?: { isBuffer(value: unknown): boolean } }).Buffer;
    if (bufferCtor?.isBuffer(this.source) && typeof (this.source as { toString?: unknown }).toString === 'function') {
      return (this.source as { toString(encoding: string, start: number, end: number): string })
        .toString('utf8', start, end);
    }
    return utf8Decoder.decode(this.source.subarray(start, end));
  }
}

export class StreamingEventBatchReader implements TableBackedEventSource {
  private readonly pendingChunks: Uint8Array[] = [];
  private readonly pendingTables: StreamingSpanTableAdapter[] = [];
  private currentTable: StreamingSpanTableAdapter | undefined;
  private sourceDone = false;
  private finalPushed = false;
  private finished = false;

  constructor(
    private readonly streamingParser: StaxXmlStreamingEventBatchParser,
    private readonly sourceIterator?: Iterator<StreamingByteBatch>,
  ) {}

  nextBatch(): boolean {
    if (this.finished) {
      return false;
    }
    if (this.activatePendingTable()) {
      return true;
    }
    if (this.drainPendingChunks()) {
      return true;
    }

    while (!this.sourceDone && this.sourceIterator) {
      const result = this.sourceIterator.next();
      if (result.done) {
        this.sourceDone = true;
        break;
      }
      this.enqueueChunks(result.value);
      if (this.drainPendingChunks()) {
        return true;
      }
    }

    if (this.sourceDone && this.pushFinalChunk()) {
      return true;
    }

    this.finished = true;
    return false;
  }

  pushByteBatch(batch: StreamingByteBatch, isFinal = false): boolean {
    if (this.finished) {
      return false;
    }
    if (this.activatePendingTable()) {
      return true;
    }
    this.enqueueChunks(batch);
    if (isFinal) {
      this.sourceDone = true;
    }
    if (this.drainPendingChunks()) {
      return true;
    }
    if (isFinal && this.pushFinalChunk()) {
      return true;
    }
    if (isFinal) {
      this.finished = true;
    }
    return false;
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

  private enqueueChunks(batch: StreamingByteBatch): void {
    for (let index = 0; index < batch.length; index++) {
      this.pendingChunks.push(batch[index]!);
    }
  }

  private drainPendingChunks(): boolean {
    while (this.pendingChunks.length > 0) {
      const chunk = this.pendingChunks.shift()!;
      this.enqueueNativeBatch(this.streamingParser.pushChunk(chunk, false));
      if (this.activatePendingTable()) {
        return true;
      }
    }
    return false;
  }

  private pushFinalChunk(): boolean {
    if (this.finalPushed) {
      return false;
    }
    this.finalPushed = true;
    this.enqueueNativeBatch(this.streamingParser.pushChunk(EMPTY_BUFFER, true));
    return this.activatePendingTable();
  }

  private enqueueNativeBatch(batch: { buffer: ArrayBuffer | ArrayBufferView; table: ArrayBuffer | ArrayBufferView }): void {
    const table = new StreamingSpanTableAdapter(toUint8Array(batch.buffer), batch.table);
    if (table.eventCount() > 0) {
      this.pendingTables.push(table);
    }
  }

  private activatePendingTable(): boolean {
    const table = this.pendingTables.shift();
    if (!table) {
      return false;
    }
    this.currentTable = table;
    return true;
  }

  private requireCurrentTable(): StreamingSpanTableAdapter {
    if (!this.currentTable) {
      throw new Error('No active native streaming event batch.');
    }
    return this.currentTable;
  }
}

export function toUint8Array(input: ArrayBuffer | ArrayBufferView): Uint8Array {
  return input instanceof Uint8Array
    ? input
    : input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0]!.toUpperCase()}${value.slice(1)}`;
}
