import { Buffer } from 'node:buffer';
import { closeSync, openSync, readSync, type PathLike } from 'node:fs';
import { getStaxXmlRuntimeForSyncApi } from '../runtime/native-backend.js';
import { StreamingEventBatchReader } from '../runtime/event-table.js';

export const IterableEventType = {
  START_DOCUMENT: 0,
  END_DOCUMENT: 1,
  START_ELEMENT: 2,
  END_ELEMENT: 3,
  CHARACTERS: 4,
  CDATA: 5,
} as const;

export type IterableEventType = typeof IterableEventType[keyof typeof IterableEventType];

export type NodeByteBatch = readonly Buffer[];

export type NodeAttributeScanner = 'general' | 'simple';
export type NodeIterableReaderBackendKind = 'pending' | 'native' | 'wasm' | 'js';

export interface NodeByteBatchOptions {
  batchSize?: number;
}

export interface NodeFileByteBatchOptions extends NodeByteBatchOptions {
  chunkSize?: number;
}

export interface NodeIterableReaderOptions {
  attributeScanner?: NodeAttributeScanner;
  fallbackOnParseError?: boolean;
}

const DEFAULT_BATCH_SIZE = 16;
const DEFAULT_CHUNK_SIZE = 64 * 1024;
const EMPTY_BUFFER = Buffer.alloc(0);
const STRUCTURAL_INDEX_MAGIC = 0x31545053;
const STRUCTURAL_INDEX_HEADER_WORDS = 7;
const STRUCTURAL_INDEX_EVENT_WORDS = 7;
const STRUCTURAL_INDEX_ATTR_WORDS = 4;
const STRUCTURAL_INDEX_EVENT_BYTES = STRUCTURAL_INDEX_EVENT_WORDS * 4;
const STRUCTURAL_INDEX_ATTR_BYTES = STRUCTURAL_INDEX_ATTR_WORDS * 4;
const STRUCTURAL_INDEX_SOURCE_KIND_UTF8 = 1;

export function* nodeFileByteBatchesSync(
  path: PathLike,
  options: NodeFileByteBatchOptions = {},
): Iterable<NodeByteBatch> {
  const chunkSize = normalizeChunkSize(options.chunkSize);
  const batchSize = normalizeBatchSize(options.batchSize);
  const fd = openSync(path, 'r');
  let batch: Buffer[] = [];

  try {
    while (true) {
      const chunk = Buffer.allocUnsafe(chunkSize);
      const bytesRead = readSync(fd, chunk, 0, chunkSize, null);
      if (bytesRead === 0) {
        break;
      }

      batch.push(bytesRead === chunkSize ? chunk : chunk.subarray(0, bytesRead));
      if (batch.length >= batchSize) {
        yield batch;
        batch = [];
      }
    }

    if (batch.length > 0) {
      yield batch;
    }
  } finally {
    closeSync(fd);
  }
}

export class NodeIterableReader {
  private iterator: Iterator<NodeByteBatch>;
  private readonly useSimpleAttributeScanner: boolean;
  private readonly fallbackOnParseError: boolean | undefined;
  private backendInitialized = false;
  private nativeParser: NativeNodeIterableBackend | StreamingEventBatchReader | undefined;
  private backendKindValue: NodeIterableReaderBackendKind = 'pending';

  private currentBuffer: Buffer = EMPTY_BUFFER;
  private pendingTail: Buffer = EMPTY_BUFFER;
  private started = false;
  private sourceDone = false;
  private finished = false;

  private eventTypes = new Uint8Array(1024);
  private nameStarts = new Int32Array(1024);
  private nameEnds = new Int32Array(1024);
  private nameIdsForEvents = new Int32Array(1024);
  private textStarts = new Int32Array(1024);
  private textEnds = new Int32Array(1024);
  private attrStarts = new Int32Array(1024);
  private attrCounts = new Int32Array(1024);
  private eventCursor = 0;

  private attrNameStarts = new Int32Array(1024);
  private attrNameEnds = new Int32Array(1024);
  private attrNameIds = new Int32Array(1024);
  private attrValueStarts = new Int32Array(1024);
  private attrValueEnds = new Int32Array(1024);
  private attrCursor = 0;

  private readonly elementNameIds: number[] = [];
  private readonly nameIds = new Map<number, number>();
  private readonly nameStrings: string[] = [];

  constructor(source: Iterable<NodeByteBatch>, options: NodeIterableReaderOptions = {}) {
    this.iterator = source[Symbol.iterator]();
    this.fallbackOnParseError = options.fallbackOnParseError;
    const attributeScanner = options.attributeScanner ?? 'general';
    if (attributeScanner !== 'general' && attributeScanner !== 'simple') {
      throw new RangeError(`Unknown attributeScanner: ${String(attributeScanner)}.`);
    }
    this.useSimpleAttributeScanner = attributeScanner === 'simple';
  }

  nextBatch(): boolean {
    this.initializeBackend();
    if (this.nativeParser) {
      return this.nativeParser.nextBatch();
    }

    if (this.finished) {
      return false;
    }

    this.resetFrames();
    const startedThisBatch = !this.started;
    if (!this.started) {
      this.started = true;
      this.addEvent(IterableEventType.START_DOCUMENT);
    }
    const minEventsToReturn = startedThisBatch ? 2 : 1;

    while (!this.sourceDone) {
      const result = this.iterator.next();
      if (result.done) {
        this.sourceDone = true;
        this.finish();
        break;
      }

      const buffer = this.prepareBuffer(result.value);
      this.currentBuffer = buffer;
      this.parseBuffer(buffer, false);
      if (this.eventCursor >= minEventsToReturn) {
        return true;
      }
    }

    return this.eventCursor > 0;
  }

  eventCount(): number {
    if (this.nativeParser) {
      return this.nativeParser.eventCount();
    }
    return this.eventCursor;
  }

  buffer(): Buffer {
    if (this.nativeParser) {
      return asNodeBuffer(this.nativeParser.buffer());
    }
    return this.currentBuffer;
  }

  eventType(index: number): IterableEventType {
    if (this.nativeParser) {
      return this.nativeParser.eventType(index);
    }
    return this.eventTypes[index] as IterableEventType;
  }

  nameStart(index: number): number {
    if (this.nativeParser) {
      return this.nativeParser.nameStart(index);
    }
    return this.nameStarts[index]!;
  }

  nameEnd(index: number): number {
    if (this.nativeParser) {
      return this.nativeParser.nameEnd(index);
    }
    return this.nameEnds[index]!;
  }

  textStart(index: number): number {
    if (this.nativeParser) {
      return this.nativeParser.textStart(index);
    }
    return this.textStarts[index]!;
  }

  textEnd(index: number): number {
    if (this.nativeParser) {
      return this.nativeParser.textEnd(index);
    }
    return this.textEnds[index]!;
  }

  attrCount(index: number): number {
    if (this.nativeParser) {
      return this.nativeParser.attrCount(index);
    }
    return this.attrCounts[index]!;
  }

  attrNameStart(eventIndex: number, attrIndex: number): number {
    if (this.nativeParser) {
      return this.nativeParser.attrNameStart(eventIndex, attrIndex);
    }
    return this.attrNameStarts[this.attrStarts[eventIndex]! + attrIndex]!;
  }

  attrNameEnd(eventIndex: number, attrIndex: number): number {
    if (this.nativeParser) {
      return this.nativeParser.attrNameEnd(eventIndex, attrIndex);
    }
    return this.attrNameEnds[this.attrStarts[eventIndex]! + attrIndex]!;
  }

  attrValueStart(eventIndex: number, attrIndex: number): number {
    if (this.nativeParser) {
      return this.nativeParser.attrValueStart(eventIndex, attrIndex);
    }
    return this.attrValueStarts[this.attrStarts[eventIndex]! + attrIndex]!;
  }

  attrValueEnd(eventIndex: number, attrIndex: number): number {
    if (this.nativeParser) {
      return this.nativeParser.attrValueEnd(eventIndex, attrIndex);
    }
    return this.attrValueEnds[this.attrStarts[eventIndex]! + attrIndex]!;
  }

  decodeSpan(start: number, end: number): string {
    if (this.nativeParser) {
      const buffer = this.nativeParser.buffer();
      return Buffer.isBuffer(buffer)
        ? buffer.toString('utf8', start, end)
        : new TextDecoder().decode(buffer.subarray(start, end));
    }
    return this.currentBuffer.toString('utf8', start, end);
  }

  copyName(index: number): string | undefined {
    if (this.nativeParser) {
      return this.nativeParser.copyName(index);
    }
    const nameId = this.nameIdsForEvents[index]!;
    if (nameId < 0) {
      return undefined;
    }
    return this.nameStrings[nameId];
  }

  copyText(index: number): string | undefined {
    if (this.nativeParser) {
      return this.nativeParser.copyText(index);
    }
    const start = this.textStarts[index]!;
    return start < 0 ? undefined : this.decodeSpan(start, this.textEnds[index]!);
  }

  copyAttrName(eventIndex: number, attrIndex: number): string | undefined {
    if (this.nativeParser) {
      if (attrIndex < 0 || attrIndex >= this.nativeParser.attrCount(eventIndex)) {
        return undefined;
      }
      return this.nativeParser.copyAttrName(eventIndex, attrIndex);
    }
    if (attrIndex < 0 || attrIndex >= this.attrCount(eventIndex)) {
      return undefined;
    }
    const index = this.attrStarts[eventIndex]! + attrIndex;
    const nameId = this.attrNameIds[index]!;
    return this.nameStrings[nameId];
  }

  copyAttrValue(eventIndex: number, attrIndex: number): string | undefined {
    if (this.nativeParser) {
      if (attrIndex < 0 || attrIndex >= this.nativeParser.attrCount(eventIndex)) {
        return undefined;
      }
      return this.nativeParser.copyAttrValue(eventIndex, attrIndex);
    }
    if (attrIndex < 0 || attrIndex >= this.attrCount(eventIndex)) {
      return undefined;
    }
    return this.decodeSpan(this.attrValueStart(eventIndex, attrIndex), this.attrValueEnd(eventIndex, attrIndex));
  }

  copyAttributesObject(eventIndex: number): Record<string, string> {
    if (this.nativeParser) {
      const count = this.nativeParser.attrCount(eventIndex);
      if (count === 0) {
        return {};
      }
      const attributes: Record<string, string> = {};
      for (let attrIndex = 0; attrIndex < count; attrIndex++) {
        const name = this.nativeParser.copyAttrName(eventIndex, attrIndex);
        const value = this.nativeParser.copyAttrValue(eventIndex, attrIndex);
        if (name !== undefined && value !== undefined) {
          attributes[name] = value;
        }
      }
      return attributes;
    }
    const count = this.attrCounts[eventIndex]!;
    if (count === 0) {
      return {};
    }

    const attributes: Record<string, string> = {};
    let attrIndex = this.attrStarts[eventIndex]!;
    const attrEnd = attrIndex + count;
    while (attrIndex < attrEnd) {
      const nameId = this.attrNameIds[attrIndex]!;
      const name = this.nameStrings[nameId]!;
      attributes[name] = this.decodeSpan(this.attrValueStarts[attrIndex]!, this.attrValueEnds[attrIndex]!);
      attrIndex++;
    }
    return attributes;
  }

  backendKind(): NodeIterableReaderBackendKind {
    return this.backendKindValue;
  }

  private initializeBackend(): void {
    if (this.backendInitialized) {
      return;
    }
    this.backendInitialized = true;

    if (this.useSimpleAttributeScanner) {
      this.backendKindValue = 'js';
      return;
    }

    const runtime = getStaxXmlRuntimeForSyncApi(undefined);
    if (!runtime || runtime.backend.kind === 'js') {
      this.backendKindValue = 'js';
      return;
    }

    const createStreamingParser = runtime.capabilities.streamingEventBatches;
    if (createStreamingParser) {
      this.nativeParser = new StreamingEventBatchReader(createStreamingParser(), this.iterator);
      this.backendKindValue = runtime.backend.kind;
      return;
    }

    const buildTable = runtime.capabilities.structuralIndexUtf8;
    if (!buildTable) {
      this.backendKindValue = 'js';
      return;
    }

    const first = this.iterator.next();
    if (first.done) {
      this.iterator = [][Symbol.iterator]();
      this.backendKindValue = 'js';
      return;
    }
    const firstBatch = Array.from(first.value);
    const second = this.iterator.next();
    if (!second.done || firstBatch.length !== 1) {
      this.iterator = replayNodeBatches(firstBatch, second, this.iterator);
      this.backendKindValue = 'js';
      return;
    }

    const input = firstBatch[0]!;
    try {
      const table = buildTable(input);
      this.nativeParser = new NativeNodeIterableBackend(input, table);
      this.backendKindValue = runtime.backend.kind;
      return;
    } catch {
      if (this.fallbackOnParseError !== true) {
        throw new Error(`Unable to parse XML with initialized ${runtime.backend.kind} backend.`);
      }
      // Fall through to the JavaScript parser to preserve existing permissive behavior.
    }

    this.iterator = [firstBatch][Symbol.iterator]();
    this.backendKindValue = 'js';
  }

  private resetFrames(): void {
    this.eventCursor = 0;
    this.attrCursor = 0;
  }

  private prepareBuffer(batch: NodeByteBatch): Buffer {
    const hasTail = this.pendingTail.byteLength > 0;
    if (!hasTail && batch.length === 1) {
      return batch[0]!;
    }

    let total = hasTail ? this.pendingTail.byteLength : 0;
    for (let index = 0; index < batch.length; index++) {
      total += batch[index]!.byteLength;
    }

    if (!hasTail) {
      return Buffer.concat(batch, total);
    }

    const chunks: Buffer[] = [this.pendingTail];
    for (let index = 0; index < batch.length; index++) {
      chunks.push(batch[index]!);
    }
    this.pendingTail = EMPTY_BUFFER;
    return Buffer.concat(chunks, total);
  }

  private finish(): void {
    if (this.pendingTail.byteLength > 0) {
      this.currentBuffer = this.pendingTail;
      this.pendingTail = EMPTY_BUFFER;
      this.parseBuffer(this.currentBuffer, true);
    } else {
      this.currentBuffer = EMPTY_BUFFER;
    }

    if (this.elementNameIds.length > 0) {
      throw new Error('Unexpected end of document. Not all elements were closed.');
    }

    this.addEvent(IterableEventType.END_DOCUMENT);
    this.finished = true;
  }

  private parseBuffer(buffer: Buffer, isFinal: boolean): void {
    let position = 0;
    while (position < buffer.byteLength) {
      const ltPos = buffer.indexOf(60, position);
      if (ltPos === -1) {
        if (isFinal) {
          this.addText(position, buffer.byteLength);
        } else {
          this.pendingTail = buffer.subarray(position);
        }
        return;
      }

      if (ltPos > position) {
        this.addText(position, ltPos);
      }

      const next = this.parseTag(buffer, ltPos, isFinal);
      if (next < 0) {
        this.pendingTail = buffer.subarray(ltPos);
        return;
      }
      position = next;
    }
  }

  private parseTag(buffer: Buffer, position: number, isFinal: boolean): number {
    if (position + 1 >= buffer.byteLength) {
      if (isFinal) {
        throw new Error('Unclosed start tag');
      }
      return -1;
    }

    const next = buffer[position + 1]!;
    if (next === 47) {
      return this.parseEndTag(buffer, position, isFinal);
    }
    if (next === 33) {
      return this.parseBangTag(buffer, position, isFinal);
    }
    if (next === 63) {
      return this.parseProcessingInstruction(buffer, position, isFinal);
    }
    return this.parseStartTag(buffer, position, isFinal);
  }

  private parseBangTag(buffer: Buffer, position: number, isFinal: boolean): number {
    if (startsWithAscii(buffer, position, '<![CDATA[')) {
      const end = indexOfAscii(buffer, ']]>', position + 9);
      if (end === -1) {
        if (isFinal) {
          throw new Error('Unclosed CDATA section');
        }
        return -1;
      }
      this.addTextEvent(IterableEventType.CDATA, position + 9, end);
      return end + 3;
    }
    if (startsWithAscii(buffer, position, '<!--')) {
      const end = indexOfAscii(buffer, '-->', position + 4);
      if (end === -1) {
        if (isFinal) {
          throw new Error('Unclosed comment');
        }
        return -1;
      }
      return end + 3;
    }
    if (startsWithAscii(buffer, position, '<!DOCTYPE')) {
      const end = findDoctypeEnd(buffer, position + 2);
      if (end === -1) {
        if (isFinal) {
          throw new Error('Unclosed DOCTYPE declaration');
        }
        return -1;
      }
      return end + 1;
    }

    const end = findGt(buffer, position + 2);
    if (end === -1) {
      if (isFinal) {
        throw new Error('Unclosed markup');
      }
      return -1;
    }
    return end + 1;
  }

  private parseProcessingInstruction(buffer: Buffer, position: number, isFinal: boolean): number {
    const end = indexOfAscii(buffer, '?>', position + 2);
    if (end === -1) {
      if (isFinal) {
        throw new Error(startsWithAscii(buffer, position, '<?xml') ? 'Unclosed XML declaration' : 'Unclosed processing instruction');
      }
      return -1;
    }
    return end + 2;
  }

  private parseEndTag(buffer: Buffer, position: number, isFinal: boolean): number {
    const end = findGt(buffer, position + 2);
    if (end === -1) {
      if (isFinal) {
        throw new Error('Unclosed end tag');
      }
      return -1;
    }

    let nameStart = position + 2;
    let nameEnd = end;
    while (nameStart < nameEnd && isWhitespace(buffer[nameStart]!)) nameStart++;
    while (nameEnd > nameStart && isWhitespace(buffer[nameEnd - 1]!)) nameEnd--;

    if (this.elementNameIds.length === 0) {
      throw new Error(`Mismatched closing tag: </${buffer.toString('utf8', nameStart, nameEnd)}>. No open elements.`);
    }

    const foundId = this.lookupNameId(buffer, nameStart, nameEnd);
    const expectedId = this.elementNameIds.pop()!;
    if (foundId !== expectedId) {
      const found = buffer.toString('utf8', nameStart, nameEnd);
      const expected = this.nameStrings[expectedId]!;
      throw new Error(`Mismatched closing tag: </${found}>. Expected </${expected}>.`);
    }

    this.addEvent(IterableEventType.END_ELEMENT, nameStart, nameEnd, -1, -1, foundId);
    return end + 1;
  }

  private parseStartTag(buffer: Buffer, position: number, isFinal: boolean): number {
    const tagEnd = findTagEnd(buffer, position + 1);
    if (tagEnd === -1) {
      if (isFinal) {
        throw new Error('Unclosed start tag');
      }
      return -1;
    }

    let actualEnd = tagEnd;
    while (actualEnd > position + 1 && isWhitespace(buffer[actualEnd - 1]!)) actualEnd--;

    let selfClosing = false;
    if (actualEnd > position + 1 && buffer[actualEnd - 1] === 47) {
      selfClosing = true;
      actualEnd--;
      while (actualEnd > position + 1 && isWhitespace(buffer[actualEnd - 1]!)) actualEnd--;
    }

    let nameStart = position + 1;
    let nameEnd = nameStart;
    while (nameEnd < actualEnd) {
      const byte = buffer[nameEnd]!;
      if (isWhitespace(byte) || byte === 47 || byte === 62) break;
      nameEnd++;
    }

    const nameId = this.internName(buffer, nameStart, nameEnd);
    const eventIndex = this.addEvent(IterableEventType.START_ELEMENT, nameStart, nameEnd, -1, -1, nameId);
    const attrStart = this.attrCursor;
    this.parseAttributes(buffer, nameEnd, actualEnd);
    this.attrStarts[eventIndex] = attrStart;
    this.attrCounts[eventIndex] = this.attrCursor - attrStart;

    if (selfClosing) {
      this.addEvent(IterableEventType.END_ELEMENT, nameStart, nameEnd, -1, -1, nameId);
    } else {
      this.elementNameIds.push(nameId);
    }
    return tagEnd + 1;
  }

  private parseAttributes(buffer: Buffer, start: number, end: number): void {
    if (this.useSimpleAttributeScanner && this.tryParseSimpleQuotedAttributes(buffer, start, end)) {
      return;
    }
    this.parseAttributesGeneral(buffer, start, end);
  }

  private tryParseSimpleQuotedAttributes(buffer: Buffer, start: number, end: number): boolean {
    const initialAttrCursor = this.attrCursor;
    let index = start;
    while (index < end) {
      while (index < end) {
        const byte = buffer[index]!;
        if (byte !== 32 && byte !== 9 && byte !== 10 && byte !== 13) break;
        index++;
      }

      const nameStart = index;
      while (index < end) {
        const byte = buffer[index]!;
        if (byte === 61) break;
        if (byte === 32 || byte === 9 || byte === 10 || byte === 13 || byte === 34 || byte === 39) {
          this.attrCursor = initialAttrCursor;
          return false;
        }
        index++;
      }
      if (index >= end || index === nameStart || buffer[index] !== 61) {
        this.attrCursor = initialAttrCursor;
        return false;
      }
      const nameEnd = index;

      index++;
      if (index >= end) {
        this.attrCursor = initialAttrCursor;
        return false;
      }
      const quote = buffer[index]!;
      if (quote !== 34 && quote !== 39) {
        this.attrCursor = initialAttrCursor;
        return false;
      }
      index++;
      const valueStart = index;
      while (index < end && buffer[index] !== quote) index++;
      const valueEnd = index;
      this.addAttribute(buffer, nameStart, nameEnd, valueStart, valueEnd);
      index++;
    }
    return true;
  }

  private parseAttributesGeneral(buffer: Buffer, start: number, end: number): void {
    let index = start;
    while (index < end) {
      while (index < end && isWhitespace(buffer[index]!)) index++;

      const nameStart = index;
      while (index < end) {
        const byte = buffer[index]!;
        if (byte === 61 || isWhitespace(byte)) break;
        index++;
      }
      const nameEnd = index;
      if (nameEnd === nameStart) {
        break;
      }

      while (index < end && isWhitespace(buffer[index]!)) index++;
      if (index >= end || buffer[index] !== 61) {
        this.addAttribute(buffer, nameStart, nameEnd, nameStart, nameEnd);
        continue;
      }

      index++;
      while (index < end && isWhitespace(buffer[index]!)) index++;
      if (index >= end) break;

      const quote = buffer[index]!;
      if (quote !== 34 && quote !== 39) break;
      index++;
      const valueStart = index;
      while (index < end && buffer[index] !== quote) index++;
      const valueEnd = index;
      this.addAttribute(buffer, nameStart, nameEnd, valueStart, valueEnd);
      index++;
    }
  }

  private addText(start: number, end: number): void {
    if (start < end && !isWhitespaceOnly(this.currentBuffer, start, end)) {
      this.addTextEvent(IterableEventType.CHARACTERS, start, end);
    }
  }

  private internName(buffer: Buffer, start: number, end: number): number {
    const key = nameKey(buffer, start, end);
    const existing = this.nameIds.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const id = this.nameStrings.length;
    this.nameIds.set(key, id);
    this.nameStrings.push(buffer.toString('utf8', start, end));
    return id;
  }

  private lookupNameId(buffer: Buffer, start: number, end: number): number {
    return this.nameIds.get(nameKey(buffer, start, end)) ?? -1;
  }

  private addTextEvent(type: IterableEventType, start: number, end: number): void {
    this.addEvent(type, -1, -1, start, end);
  }

  private addEvent(
    type: IterableEventType,
    nameStart = -1,
    nameEnd = -1,
    textStart = -1,
    textEnd = -1,
    nameId = -1,
  ): number {
    this.ensureEventCapacity(this.eventCursor + 1);
    const index = this.eventCursor++;
    this.eventTypes[index] = type;
    this.nameStarts[index] = nameStart;
    this.nameEnds[index] = nameEnd;
    this.nameIdsForEvents[index] = nameId;
    this.textStarts[index] = textStart;
    this.textEnds[index] = textEnd;
    this.attrStarts[index] = this.attrCursor;
    this.attrCounts[index] = 0;
    return index;
  }

  private addAttribute(buffer: Buffer, nameStart: number, nameEnd: number, valueStart: number, valueEnd: number): void {
    this.ensureAttrCapacity(this.attrCursor + 1);
    const index = this.attrCursor++;
    this.attrNameStarts[index] = nameStart;
    this.attrNameEnds[index] = nameEnd;
    this.attrNameIds[index] = this.internName(buffer, nameStart, nameEnd);
    this.attrValueStarts[index] = valueStart;
    this.attrValueEnds[index] = valueEnd;
  }

  private ensureEventCapacity(size: number): void {
    if (size <= this.eventTypes.length) return;
    const nextSize = this.eventTypes.length * 2;
    this.eventTypes = growUint8(this.eventTypes, nextSize);
    this.nameStarts = growInt32(this.nameStarts, nextSize);
    this.nameEnds = growInt32(this.nameEnds, nextSize);
    this.nameIdsForEvents = growInt32(this.nameIdsForEvents, nextSize);
    this.textStarts = growInt32(this.textStarts, nextSize);
    this.textEnds = growInt32(this.textEnds, nextSize);
    this.attrStarts = growInt32(this.attrStarts, nextSize);
    this.attrCounts = growInt32(this.attrCounts, nextSize);
  }

  private ensureAttrCapacity(size: number): void {
    if (size <= this.attrNameStarts.length) return;
    const nextSize = this.attrNameStarts.length * 2;
    this.attrNameStarts = growInt32(this.attrNameStarts, nextSize);
    this.attrNameEnds = growInt32(this.attrNameEnds, nextSize);
    this.attrNameIds = growInt32(this.attrNameIds, nextSize);
    this.attrValueStarts = growInt32(this.attrValueStarts, nextSize);
    this.attrValueEnds = growInt32(this.attrValueEnds, nextSize);
  }
}

function normalizeBatchSize(value: number | undefined): number {
  const batchSize = value ?? DEFAULT_BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new RangeError('batchSize must be a positive integer.');
  }
  return batchSize;
}

class NativeNodeIterableBackend {
  readonly eventCountValue: number;
  readonly attrCountValue: number;

  private readonly table: Int32Array;
  private readonly eventBaseWords = STRUCTURAL_INDEX_HEADER_WORDS;
  private readonly attrBaseWords: number;
  private consumed = false;

  constructor(
    private readonly input: Buffer,
    table: ArrayBuffer | ArrayBufferView,
  ) {
    const tableBytes = toBuffer(table);
    const view = new DataView(tableBytes.buffer, tableBytes.byteOffset, tableBytes.byteLength);
    const magic = view.getUint32(0, true);
    if (magic !== STRUCTURAL_INDEX_MAGIC) {
      throw new Error(`Invalid structural index magic: 0x${magic.toString(16)}`);
    }

    this.eventCountValue = view.getUint32(4, true);
    this.attrCountValue = view.getUint32(8, true);
    const sourceUnits = view.getUint32(12, true);
    const eventStrideBytes = view.getUint32(16, true);
    const attrStrideBytes = view.getUint32(20, true);
    const flags = view.getUint32(24, true);
    if (sourceUnits !== input.byteLength) {
      throw new Error(`Structural index input length mismatch: ${sourceUnits}/${input.byteLength}`);
    }
    if (eventStrideBytes !== STRUCTURAL_INDEX_EVENT_BYTES || attrStrideBytes !== STRUCTURAL_INDEX_ATTR_BYTES) {
      throw new Error(`Unsupported structural index strides: ${eventStrideBytes}/${attrStrideBytes}`);
    }
    if ((flags & 0xff) !== STRUCTURAL_INDEX_SOURCE_KIND_UTF8) {
      throw new Error('Structural index source kind mismatch: utf16/utf8');
    }
    if ((tableBytes.byteOffset & 3) !== 0 || (tableBytes.byteLength & 3) !== 0) {
      throw new Error('Structural index table is not 32-bit aligned.');
    }

    this.table = new Int32Array(tableBytes.buffer, tableBytes.byteOffset, tableBytes.byteLength / 4);
    this.attrBaseWords = this.eventBaseWords + this.eventCountValue * STRUCTURAL_INDEX_EVENT_WORDS;
  }

  nextBatch(): boolean {
    if (this.consumed || this.eventCountValue === 0) {
      return false;
    }
    this.consumed = true;
    return true;
  }

  eventCount(): number {
    return this.eventCountValue;
  }

  buffer(): Buffer {
    return this.input;
  }

  eventType(index: number): IterableEventType {
    return this.table[this.eventOffset(index)] as IterableEventType;
  }

  nameStart(index: number): number {
    return this.table[this.eventOffset(index) + 1]!;
  }

  nameEnd(index: number): number {
    return this.table[this.eventOffset(index) + 2]!;
  }

  textStart(index: number): number {
    return this.table[this.eventOffset(index) + 3]!;
  }

  textEnd(index: number): number {
    return this.table[this.eventOffset(index) + 4]!;
  }

  attrCount(index: number): number {
    return this.table[this.eventOffset(index) + 6]!;
  }

  attrNameStart(eventIndex: number, attrIndex: number): number {
    return this.table[this.attrOffset(eventIndex, attrIndex)]!;
  }

  attrNameEnd(eventIndex: number, attrIndex: number): number {
    return this.table[this.attrOffset(eventIndex, attrIndex) + 1]!;
  }

  attrValueStart(eventIndex: number, attrIndex: number): number {
    return this.table[this.attrOffset(eventIndex, attrIndex) + 2]!;
  }

  attrValueEnd(eventIndex: number, attrIndex: number): number {
    return this.table[this.attrOffset(eventIndex, attrIndex) + 3]!;
  }

  copyName(index: number): string | undefined {
    return this.copySpan(this.nameStart(index), this.nameEnd(index));
  }

  copyText(index: number): string | undefined {
    return this.copySpan(this.textStart(index), this.textEnd(index));
  }

  copyAttrName(eventIndex: number, attrIndex: number): string | undefined {
    return this.copySpan(this.attrNameStart(eventIndex, attrIndex), this.attrNameEnd(eventIndex, attrIndex));
  }

  copyAttrValue(eventIndex: number, attrIndex: number): string | undefined {
    return this.copySpan(this.attrValueStart(eventIndex, attrIndex), this.attrValueEnd(eventIndex, attrIndex));
  }

  private eventOffset(index: number): number {
    return this.eventBaseWords + index * STRUCTURAL_INDEX_EVENT_WORDS;
  }

  private attrOffset(eventIndex: number, attrIndex: number): number {
    const attrStart = this.table[this.eventOffset(eventIndex) + 5]!;
    return this.attrBaseWords + (attrStart + attrIndex) * STRUCTURAL_INDEX_ATTR_WORDS;
  }

  private copySpan(start: number, end: number): string | undefined {
    if (start < 0) {
      return undefined;
    }
    return this.input.toString('utf8', start, end);
  }
}

function toBuffer(table: ArrayBuffer | ArrayBufferView): Buffer {
  if (Buffer.isBuffer(table)) {
    return table;
  }
  if (table instanceof ArrayBuffer) {
    return Buffer.from(table);
  }
  return Buffer.from(table.buffer, table.byteOffset, table.byteLength);
}

function asNodeBuffer(buffer: Uint8Array): Buffer {
  return Buffer.isBuffer(buffer)
    ? buffer
    : Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

function* replayNodeBatches(
  firstBatch: Buffer[],
  second: IteratorResult<NodeByteBatch>,
  rest: Iterator<NodeByteBatch>,
): IterableIterator<NodeByteBatch> {
  yield firstBatch;
  if (!second.done) {
    yield second.value;
  }
  while (true) {
    const result = rest.next();
    if (result.done) {
      return;
    }
    yield result.value;
  }
}

function normalizeChunkSize(value: number | undefined): number {
  const chunkSize = value ?? DEFAULT_CHUNK_SIZE;
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new RangeError('chunkSize must be a positive integer.');
  }
  return chunkSize;
}

function growInt32(source: Int32Array<ArrayBufferLike>, size: number): Int32Array<ArrayBuffer> {
  const next = new Int32Array(size);
  next.set(source);
  return next;
}

function growUint8(source: Uint8Array<ArrayBufferLike>, size: number): Uint8Array<ArrayBuffer> {
  const next = new Uint8Array(size);
  next.set(source);
  return next;
}

function isWhitespace(byte: number): boolean {
  return byte === 32 || byte === 9 || byte === 10 || byte === 13;
}

function isWhitespaceOnly(buffer: Buffer, start: number, end: number): boolean {
  for (let index = start; index < end; index++) {
    if (!isWhitespace(buffer[index]!)) {
      return false;
    }
  }
  return true;
}

function nameKey(buffer: Buffer, start: number, end: number): number {
  let hash = 2166136261;
  for (let index = start; index < end; index++) {
    hash ^= buffer[index]!;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash + ((end - start) * 0x1_0000_0000);
}

function startsWithAscii(buffer: Buffer, position: number, value: string): boolean {
  if (position + value.length > buffer.byteLength) return false;
  for (let index = 0; index < value.length; index++) {
    if (buffer[position + index] !== value.charCodeAt(index)) return false;
  }
  return true;
}

function indexOfAscii(buffer: Buffer, value: string, from: number): number {
  const first = value.charCodeAt(0);
  const max = buffer.byteLength - value.length;
  for (let index = from; index <= max; index++) {
    if (buffer[index] !== first) continue;
    let matched = true;
    for (let offset = 1; offset < value.length; offset++) {
      if (buffer[index + offset] !== value.charCodeAt(offset)) {
        matched = false;
        break;
      }
    }
    if (matched) return index;
  }
  return -1;
}

function findGt(buffer: Buffer, from: number): number {
  return buffer.indexOf(62, from);
}

function findDoctypeEnd(buffer: Buffer, from: number): number {
  let quote = 0;
  let inSubset = false;
  for (let index = from; index < buffer.byteLength; index++) {
    const byte = buffer[index]!;
    if (quote !== 0) {
      if (byte === quote) {
        quote = 0;
      }
      continue;
    }
    if (byte === 34 || byte === 39) {
      quote = byte;
    } else if (byte === 91) {
      inSubset = true;
    } else if (byte === 93) {
      inSubset = false;
    } else if (byte === 62 && !inSubset) {
      return index;
    }
  }
  return -1;
}

function findTagEnd(buffer: Buffer, from: number): number {
  let quote = 0;
  for (let index = from; index < buffer.byteLength; index++) {
    const byte = buffer[index]!;
    if (byte === 34 || byte === 39) {
      if (quote === 0) quote = byte;
      else if (quote === byte) quote = 0;
    } else if (byte === 62 && quote === 0) {
      return index;
    }
  }
  return -1;
}
