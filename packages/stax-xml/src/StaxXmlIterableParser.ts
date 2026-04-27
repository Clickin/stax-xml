import type { DocumentMode } from './types.js';

export const IterableEventType = {
  START_DOCUMENT: 0,
  END_DOCUMENT: 1,
  START_ELEMENT: 2,
  END_ELEMENT: 3,
  CHARACTERS: 4,
  CDATA: 5,
} as const;

export type IterableEventType = typeof IterableEventType[keyof typeof IterableEventType];

export type ByteBatch = readonly Uint8Array[];

export interface ByteBatchOptions {
  batchSize?: number;
}

export interface StaxXmlIterableParserOptions {
  encoding?: string;
  incompleteFinalMarkupMessage?: string;
  emitStartDocumentBatchImmediately?: boolean;
  documentMode?: DocumentMode;
}

/**
 * Reusable low-level view over the current iterable parser batch.
 *
 * The object and typed-array fields are owned by the parser and are only valid
 * until the next nextBatch()/nextBatchFrame() call.
 */
export interface StaxXmlIterableBatchFrame<BufferType extends Uint8Array = Uint8Array> {
  eventCount: number;
  attrCount: number;
  buffer: BufferType;
  eventTypes: Uint8Array;
  nameStarts: Int32Array;
  nameEnds: Int32Array;
  nameIds: Int32Array;
  textStarts: Int32Array;
  textEnds: Int32Array;
  attrStarts: Int32Array;
  attrCounts: Int32Array;
  attrNameStarts: Int32Array;
  attrNameEnds: Int32Array;
  attrNameIds: Int32Array;
  attrValueStarts: Int32Array;
  attrValueEnds: Int32Array;
}

const DEFAULT_BATCH_SIZE = 16;
const EMPTY_BUFFER = new Uint8Array(0);
const XML_NAME_RE = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}][\-.0-9:A-Z_a-z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0300-\u036F\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}]*$/u;
const XML_CHAR_RE = /^[\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]*$/u;

export function* toByteBatches(
  source: Iterable<Uint8Array>,
  options: ByteBatchOptions = {},
): Iterable<ByteBatch> {
  const batchSize = normalizeBatchSize(options.batchSize);
  let batch: Uint8Array[] = [];

  for (const chunk of source) {
    batch.push(chunk);
    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }

  if (batch.length > 0) {
    yield batch;
  }
}

export async function* toAsyncByteBatches(
  source: AsyncIterable<Uint8Array>,
  options: ByteBatchOptions = {},
): AsyncIterable<ByteBatch> {
  const batchSize = normalizeBatchSize(options.batchSize);
  let batch: Uint8Array[] = [];

  for await (const chunk of source) {
    batch.push(chunk);
    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }

  if (batch.length > 0) {
    yield batch;
  }
}

export class StaxXmlIterableParser {
  private readonly iterator: Iterator<ByteBatch>;
  private readonly decoder: TextDecoder;
  private readonly incompleteFinalMarkupMessage?: string;
  private readonly emitStartDocumentBatchImmediately: boolean;
  private readonly documentMode: DocumentMode;

  private currentBuffer: Uint8Array = EMPTY_BUFFER;
  private pendingTail: Uint8Array = EMPTY_BUFFER;
  private started = false;
  private pendingStartDocument = false;
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

  private elementNameIds = new Int32Array(1024);
  private elementNameBuffers: Uint8Array[] = createSparseSlots(1024);
  private elementNameStarts = new Int32Array(1024);
  private elementNameEnds = new Int32Array(1024);
  private elementDepth = 0;
  private rootElementCount = 0;
  private hasDoctype = false;
  private readonly declaredEntities = new Set<string>();
  private readonly nameIds = new Map<number, number>();
  private readonly nameStrings: Array<string | undefined> = [];

  private readonly frame: StaxXmlIterableBatchFrame = {
    eventCount: 0,
    attrCount: 0,
    buffer: EMPTY_BUFFER,
    eventTypes: this.eventTypes,
    nameStarts: this.nameStarts,
    nameEnds: this.nameEnds,
    nameIds: this.nameIdsForEvents,
    textStarts: this.textStarts,
    textEnds: this.textEnds,
    attrStarts: this.attrStarts,
    attrCounts: this.attrCounts,
    attrNameStarts: this.attrNameStarts,
    attrNameEnds: this.attrNameEnds,
    attrNameIds: this.attrNameIds,
    attrValueStarts: this.attrValueStarts,
    attrValueEnds: this.attrValueEnds,
  };

  constructor(source: Iterable<ByteBatch>, options: StaxXmlIterableParserOptions = {}) {
    this.iterator = source[Symbol.iterator]();
    this.documentMode = options.documentMode ?? 'fragment';
    this.decoder = new TextDecoder(options.encoding ?? 'utf-8', {
      fatal: this.documentMode === 'document',
      ignoreBOM: true
    });
    this.incompleteFinalMarkupMessage = options.incompleteFinalMarkupMessage;
    this.emitStartDocumentBatchImmediately = options.emitStartDocumentBatchImmediately ?? false;
  }

  nextBatch(): boolean {
    if (this.finished) {
      return false;
    }

    this.resetFrames();
    const startedThisBatch = !this.started;
    if (!this.started) {
      this.started = true;
      this.addEvent(IterableEventType.START_DOCUMENT);
      if (this.emitStartDocumentBatchImmediately) {
        return true;
      }
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

  nextBatchFrame(): StaxXmlIterableBatchFrame | undefined {
    return this.nextBatch() ? this.batchFrame() : undefined;
  }

  /** @internal Feed one byte batch without marking the source as exhausted. */
  pushByteBatch(batch: ByteBatch, isFinal = false): boolean {
    if (this.finished) {
      return false;
    }

    this.resetFrames();
    if (!this.started) {
      this.started = true;
      this.pendingStartDocument = true;
    }
    if (this.pendingStartDocument) {
      this.addEvent(IterableEventType.START_DOCUMENT);
    }

    if (batch.length > 0) {
      const buffer = this.prepareBuffer(batch);
      this.currentBuffer = buffer;
      this.parseBuffer(buffer, false);
    }

    if (isFinal) {
      this.sourceDone = true;
      this.finish();
    }

    if (
      this.pendingStartDocument
      && !this.emitStartDocumentBatchImmediately
      && !isFinal
      && this.eventCursor === 1
    ) {
      this.resetFrames();
      return false;
    }

    const hasEvents = this.eventCursor > 0;
    if (hasEvents) {
      this.pendingStartDocument = false;
    }
    return hasEvents;
  }

  eventCount(): number {
    return this.eventCursor;
  }

  batchFrame(): StaxXmlIterableBatchFrame {
    this.refreshFrame();
    return this.frame;
  }

  buffer(): Uint8Array {
    return this.currentBuffer;
  }

  eventType(index: number): IterableEventType {
    return this.eventTypes[index] as IterableEventType;
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
    return this.attrNameStarts[this.attrStarts[eventIndex]! + attrIndex]!;
  }

  attrNameEnd(eventIndex: number, attrIndex: number): number {
    return this.attrNameEnds[this.attrStarts[eventIndex]! + attrIndex]!;
  }

  attrValueStart(eventIndex: number, attrIndex: number): number {
    return this.attrValueStarts[this.attrStarts[eventIndex]! + attrIndex]!;
  }

  attrValueEnd(eventIndex: number, attrIndex: number): number {
    return this.attrValueEnds[this.attrStarts[eventIndex]! + attrIndex]!;
  }

  decodeSpan(start: number, end: number): string {
    const ascii = decodeShortAsciiSpan(this.currentBuffer, start, end);
    if (ascii !== undefined) {
      return ascii;
    }
    return this.decoder.decode(this.currentBuffer.subarray(start, end));
  }

  copyName(index: number): string | undefined {
    const nameId = this.nameIdsForEvents[index]!;
    if (nameId < 0) {
      return undefined;
    }
    return this.materializeName(nameId, this.currentBuffer, this.nameStarts[index]!, this.nameEnds[index]!);
  }

  copyText(index: number): string | undefined {
    const start = this.textStarts[index]!;
    return start < 0 ? undefined : this.decodeSpan(start, this.textEnds[index]!);
  }

  copyAttrName(eventIndex: number, attrIndex: number): string | undefined {
    if (attrIndex < 0 || attrIndex >= this.attrCount(eventIndex)) {
      return undefined;
    }
    const index = this.attrStarts[eventIndex]! + attrIndex;
    const nameId = this.attrNameIds[index]!;
    return this.materializeName(nameId, this.currentBuffer, this.attrNameStarts[index]!, this.attrNameEnds[index]!);
  }

  copyAttrValue(eventIndex: number, attrIndex: number): string | undefined {
    if (attrIndex < 0 || attrIndex >= this.attrCount(eventIndex)) {
      return undefined;
    }
    return this.decodeSpan(this.attrValueStart(eventIndex, attrIndex), this.attrValueEnd(eventIndex, attrIndex));
  }

  isImplicitAttributeValue(eventIndex: number, attrIndex: number): boolean {
    if (attrIndex < 0 || attrIndex >= this.attrCount(eventIndex)) {
      return false;
    }
    const index = this.attrStarts[eventIndex]! + attrIndex;
    return this.attrNameStarts[index] === this.attrValueStarts[index]
      && this.attrNameEnds[index] === this.attrValueEnds[index];
  }

  copyAttributesObject(eventIndex: number): Record<string, string> {
    const count = this.attrCounts[eventIndex]!;
    if (count === 0) {
      return {};
    }

    const attributes: Record<string, string> = {};
    let attrIndex = this.attrStarts[eventIndex]!;
    const attrEnd = attrIndex + count;
    while (attrIndex < attrEnd) {
      const nameId = this.attrNameIds[attrIndex]!;
      const name = this.materializeName(
        nameId,
        this.currentBuffer,
        this.attrNameStarts[attrIndex]!,
        this.attrNameEnds[attrIndex]!,
      );
      attributes[name] = this.decodeSpan(this.attrValueStarts[attrIndex]!, this.attrValueEnds[attrIndex]!);
      attrIndex++;
    }
    return attributes;
  }

  private resetFrames(): void {
    this.eventCursor = 0;
    this.attrCursor = 0;
  }

  private refreshFrame(): void {
    this.frame.eventCount = this.eventCursor;
    this.frame.attrCount = this.attrCursor;
    this.frame.buffer = this.currentBuffer;
    this.frame.eventTypes = this.eventTypes;
    this.frame.nameStarts = this.nameStarts;
    this.frame.nameEnds = this.nameEnds;
    this.frame.nameIds = this.nameIdsForEvents;
    this.frame.textStarts = this.textStarts;
    this.frame.textEnds = this.textEnds;
    this.frame.attrStarts = this.attrStarts;
    this.frame.attrCounts = this.attrCounts;
    this.frame.attrNameStarts = this.attrNameStarts;
    this.frame.attrNameEnds = this.attrNameEnds;
    this.frame.attrNameIds = this.attrNameIds;
    this.frame.attrValueStarts = this.attrValueStarts;
    this.frame.attrValueEnds = this.attrValueEnds;
  }

  private prepareBuffer(batch: ByteBatch): Uint8Array {
    const hasTail = this.pendingTail.byteLength > 0;
    if (!hasTail && batch.length === 1) {
      return asPlainUint8Array(batch[0]!);
    }

    let total = hasTail ? this.pendingTail.byteLength : 0;
    for (let index = 0; index < batch.length; index++) {
      total += batch[index]!.byteLength;
    }

    const buffer = new Uint8Array(total);
    let offset = 0;
    if (hasTail) {
      buffer.set(this.pendingTail, offset);
      offset += this.pendingTail.byteLength;
      this.pendingTail = EMPTY_BUFFER;
    }
    for (let index = 0; index < batch.length; index++) {
      const chunk = batch[index]!;
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return buffer;
  }

  private finish(): void {
    if (this.pendingTail.byteLength > 0) {
      this.currentBuffer = this.pendingTail;
      this.pendingTail = EMPTY_BUFFER;
      this.parseBuffer(this.currentBuffer, true);
    } else {
      this.currentBuffer = EMPTY_BUFFER;
    }

    if (this.elementDepth > 0) {
      throw new Error('Unexpected end of document. Not all elements were closed.');
    }
    if (this.documentMode === 'document' && this.rootElementCount === 0) {
      throw new Error('XML document must contain exactly one root element.');
    }

    this.addEvent(IterableEventType.END_DOCUMENT);
    this.finished = true;
  }

  private parseBuffer(buffer: Uint8Array, isFinal: boolean): void {
    let position = 0;
    while (position < buffer.byteLength) {
      const ltPos = buffer.indexOf(60, position);
      if (ltPos === -1) {
        if (isFinal) {
          this.addText(position, buffer.byteLength);
        } else {
          this.pendingTail = buffer.slice(position);
        }
        return;
      }

      if (ltPos > position) {
        this.addText(position, ltPos);
      }

      const next = this.parseTag(buffer, ltPos, isFinal);
      if (next < 0) {
        this.pendingTail = buffer.slice(ltPos);
        return;
      }
      position = next;
    }
  }

  private parseTag(buffer: Uint8Array, position: number, isFinal: boolean): number {
    if (position + 1 >= buffer.byteLength) {
      if (isFinal) {
        throw new Error(this.incompleteFinalMarkupMessage ?? 'Unclosed start tag');
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

  private parseBangTag(buffer: Uint8Array, position: number, isFinal: boolean): number {
    if (startsWithAscii(buffer, position, '<![CDATA[')) {
      const end = indexOfAscii(buffer, ']]>', position + 9);
      if (end === -1) {
        if (isFinal) {
          throw new Error('Unclosed CDATA section');
        }
        return -1;
      }
      if (this.documentMode === 'document' && this.elementDepth === 0) {
        this.assertTextAllowedOutsideDocumentElement();
      }
      this.assertValidXmlCharactersOnly(buffer, position + 9, end, 'CDATA section');
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
      if (this.documentMode === 'document' && indexOfAscii(buffer, '--', position + 4) < end) {
        throw new Error('XML comments must not contain "--".');
      }
      this.assertValidXmlCharactersOnly(buffer, position + 4, end, 'comment');
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
      if (this.documentMode === 'document') {
        this.hasDoctype = true;
        this.recordEntityDeclarations(buffer, position, end);
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
    if (this.documentMode === 'document') {
      throw new Error('Unsupported markup declaration.');
    }
    return end + 1;
  }

  private parseProcessingInstruction(buffer: Uint8Array, position: number, isFinal: boolean): number {
    const end = indexOfAscii(buffer, '?>', position + 2);
    if (end === -1) {
      if (isFinal) {
        throw new Error(startsWithAscii(buffer, position, '<?xml') ? 'Unclosed XML declaration' : 'Unclosed processing instruction');
      }
      return -1;
    }
    if (this.documentMode === 'document') {
      let targetStart = position + 2;
      while (targetStart < end && isWhitespace(buffer[targetStart]!)) targetStart++;
      let targetEnd = targetStart;
      while (targetEnd < end && !isWhitespace(buffer[targetEnd]!)) targetEnd++;
      if (targetEnd === targetStart) {
        throw new Error('Processing instruction target is required.');
      }
      this.assertValidName(buffer, targetStart, targetEnd, 'processing instruction target');
      const target = this.decoder.decode(buffer.subarray(targetStart, targetEnd));
      if (target.toLowerCase() === 'xml' && !startsWithAscii(buffer, position, '<?xml')) {
        throw new Error('Processing instruction target "xml" is reserved.');
      }
      this.assertValidXmlCharactersOnly(buffer, targetEnd, end, 'processing instruction');
    }
    return end + 2;
  }

  private parseEndTag(buffer: Uint8Array, position: number, isFinal: boolean): number {
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
    this.assertValidName(buffer, nameStart, nameEnd, 'end tag name');

    if (this.elementDepth === 0) {
      throw new Error(`Mismatched closing tag: </${this.decoder.decode(buffer.subarray(nameStart, nameEnd))}>. No open elements.`);
    }

    const foundId = this.lookupNameId(buffer, nameStart, nameEnd);
    const expectedDepth = --this.elementDepth;
    const expectedId = this.elementNameIds[expectedDepth]!;
    const expectedBuffer = this.elementNameBuffers[expectedDepth]!;
    const expectedStart = this.elementNameStarts[expectedDepth]!;
    const expectedEnd = this.elementNameEnds[expectedDepth]!;
    this.elementNameBuffers[expectedDepth] = EMPTY_BUFFER;
    if (foundId !== expectedId) {
      const found = this.decoder.decode(buffer.subarray(nameStart, nameEnd));
      const expected = this.materializeName(expectedId, expectedBuffer, expectedStart, expectedEnd);
      throw new Error(`Mismatched closing tag: </${found}>. Expected </${expected}>.`);
    }

    this.addEvent(IterableEventType.END_ELEMENT, nameStart, nameEnd, -1, -1, foundId);
    return end + 1;
  }

  private parseStartTag(buffer: Uint8Array, position: number, isFinal: boolean): number {
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
    this.assertValidName(buffer, nameStart, nameEnd, 'start tag name');

    const nameId = this.internName(buffer, nameStart, nameEnd);
    this.registerStartElement();
    const eventIndex = this.addEvent(IterableEventType.START_ELEMENT, nameStart, nameEnd, -1, -1, nameId);
    const attrStart = this.attrCursor;
    this.parseAttributes(buffer, nameEnd, actualEnd);
    this.attrStarts[eventIndex] = attrStart;
    this.attrCounts[eventIndex] = this.attrCursor - attrStart;

    if (selfClosing) {
      this.addEvent(IterableEventType.END_ELEMENT, nameStart, nameEnd, -1, -1, nameId);
    } else {
      this.ensureElementCapacity(this.elementDepth + 1);
      const depth = this.elementDepth++;
      this.elementNameIds[depth] = nameId;
      this.elementNameBuffers[depth] = buffer;
      this.elementNameStarts[depth] = nameStart;
      this.elementNameEnds[depth] = nameEnd;
    }
    return tagEnd + 1;
  }

  private parseAttributes(buffer: Uint8Array, start: number, end: number): void {
    const limit = end;
    let index = start;
    const seen = this.documentMode === 'document' ? new Set<string>() : undefined;
    while (index < limit) {
      while (index < limit) {
        const byte = buffer[index]!;
        if (!isWhitespace(byte)) break;
        index++;
      }

      const nameStart = index;
      while (index < limit) {
        const byte = buffer[index]!;
        if (byte === 61) break;
        if (isWhitespace(byte)) break;
        index++;
      }
      const nameEnd = index;
      if (nameEnd === nameStart) {
        if (this.documentMode === 'document') {
          throw new Error('Invalid XML attribute name: name is empty.');
        }
        break;
      }
      this.assertValidName(buffer, nameStart, nameEnd, 'attribute name');

      while (index < limit) {
        const byte = buffer[index]!;
        if (!isWhitespace(byte)) break;
        index++;
      }
      if (index >= limit) {
        if (this.documentMode === 'document') {
          throw new Error('Attribute value is required.');
        }
        this.addAttribute(buffer, nameStart, nameEnd, nameStart, nameEnd);
        continue;
      }
      if (buffer[index] !== 61) {
        if (this.documentMode === 'document') {
          throw new Error('Attribute value must be assigned with "=".');
        }
        this.addAttribute(buffer, nameStart, nameEnd, nameStart, nameEnd);
        continue;
      }

      index++;
      while (index < limit) {
        const byte = buffer[index]!;
        if (!isWhitespace(byte)) break;
        index++;
      }
      if (index >= limit) {
        if (this.documentMode === 'document') {
          throw new Error('Attribute values must be quoted.');
        }
        break;
      }

      const quote = buffer[index]!;
      if (quote !== 34 && quote !== 39) {
        if (this.documentMode === 'document') {
          throw new Error('Attribute values must be quoted.');
        }
        break;
      }
      index++;
      const valueStart = index;
      while (index < limit) {
        const byte = buffer[index]!;
        if (byte === quote) break;
        index++;
      }
      const valueEnd = index;
      if (this.documentMode === 'document') {
        this.assertValidAttributeValue(buffer, valueStart, valueEnd);
        const name = this.decoder.decode(buffer.subarray(nameStart, nameEnd));
        if (seen!.has(name)) {
          throw new Error(`Duplicate attribute: ${name}.`);
        }
        seen!.add(name);
      }
      this.addAttribute(buffer, nameStart, nameEnd, valueStart, valueEnd);
      index++;
    }
  }

  private addText(start: number, end: number): void {
    if (this.rootElementCount === 0 && this.elementDepth === 0 && hasUtf8Bom(this.currentBuffer, start)) {
      start += 3;
    }
    if (start < end && !isWhitespaceOnly(this.currentBuffer, start, end)) {
      this.assertTextAllowedOutsideDocumentElement();
      this.assertValidCharacterData(this.currentBuffer, start, end, 'character data');
      this.addTextEvent(IterableEventType.CHARACTERS, start, end);
    }
  }

  private assertValidName(buffer: Uint8Array, start: number, end: number, label: string): void {
    if (this.documentMode !== 'document') {
      return;
    }
    if (start >= end) {
      throw new Error(`Invalid XML ${label}: name is empty.`);
    }
    const name = this.decoder.decode(buffer.subarray(start, end));
    if (!isXmlName(name)) {
      throw new Error(`Invalid XML ${label}: ${name}.`);
    }
  }

  private assertValidAttributeValue(buffer: Uint8Array, start: number, end: number): void {
    for (let index = start; index < end; index++) {
      if (buffer[index] === 60) {
        throw new Error('Attribute values must not contain "<".');
      }
    }
    this.assertValidCharacterData(buffer, start, end, 'attribute value');
  }

  private assertValidCharacterData(buffer: Uint8Array, start: number, end: number, label: string): void {
    if (this.documentMode !== 'document') {
      return;
    }
    const value = this.decoder.decode(buffer.subarray(start, end));
    assertValidXmlCharacters(value, label);
    assertValidEntityReferences(value, this.declaredEntities, this.hasDoctype);
  }

  private assertValidXmlCharactersOnly(buffer: Uint8Array, start: number, end: number, label: string): void {
    if (this.documentMode !== 'document') {
      return;
    }
    assertValidXmlCharacters(this.decoder.decode(buffer.subarray(start, end)), label);
  }

  private recordEntityDeclarations(buffer: Uint8Array, start: number, end: number): void {
    const declaration = this.decoder.decode(buffer.subarray(start, end));
    const entityRegex = /<!ENTITY\s+([A-Za-z_:][A-Za-z0-9._:\-\u00B7\u0300-\u036F\u203F-\u2040]*)\b/g;
    let match: RegExpExecArray | null;
    while ((match = entityRegex.exec(declaration))) {
      this.declaredEntities.add(match[1]!);
    }
  }

  private registerStartElement(): void {
    if (this.elementDepth !== 0) {
      return;
    }
    this.rootElementCount++;
    if (this.documentMode === 'document' && this.rootElementCount > 1) {
      throw new Error('XML document must contain exactly one root element.');
    }
  }

  private assertTextAllowedOutsideDocumentElement(): void {
    if (this.documentMode !== 'document' || this.elementDepth > 0) {
      return;
    }
    throw new Error('Non-whitespace text is not allowed outside the document element.');
  }

  private internName(buffer: Uint8Array, start: number, end: number): number {
    const key = nameKey(buffer, start, end);
    const existing = this.nameIds.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const id = this.nameStrings.length;
    this.nameIds.set(key, id);
    this.nameStrings.push(undefined);
    return id;
  }

  private materializeName(nameId: number, buffer: Uint8Array, start: number, end: number): string {
    const existing = this.nameStrings[nameId];
    if (existing !== undefined) {
      return existing;
    }

    const ascii = decodeShortAsciiSpan(buffer, start, end);
    const name = ascii ?? this.decoder.decode(buffer.subarray(start, end));
    this.nameStrings[nameId] = name;
    return name;
  }

  private lookupNameId(buffer: Uint8Array, start: number, end: number): number {
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

  private addAttribute(buffer: Uint8Array, nameStart: number, nameEnd: number, valueStart: number, valueEnd: number): void {
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

  private ensureElementCapacity(size: number): void {
    if (size <= this.elementNameIds.length) return;
    const nextSize = this.elementNameIds.length * 2;
    this.elementNameIds = growInt32(this.elementNameIds, nextSize);
    this.elementNameStarts = growInt32(this.elementNameStarts, nextSize);
    this.elementNameEnds = growInt32(this.elementNameEnds, nextSize);
    const nextBuffers = createSparseSlots<Uint8Array>(nextSize);
    for (let index = 0; index < this.elementNameBuffers.length; index++) {
      nextBuffers[index] = this.elementNameBuffers[index]!;
    }
    this.elementNameBuffers = nextBuffers;
  }
}

function normalizeBatchSize(value: number | undefined): number {
  const batchSize = value ?? DEFAULT_BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new RangeError('batchSize must be a positive integer.');
  }
  return batchSize;
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

function createSparseSlots<T>(size: number): T[] {
  const slots: T[] = [];
  slots.length = size;
  return slots;
}

function asPlainUint8Array(source: Uint8Array): Uint8Array {
  if (Object.getPrototypeOf(source) === Uint8Array.prototype) {
    return source;
  }
  return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

function isWhitespace(byte: number): boolean {
  return byte === 32 || byte === 9 || byte === 10 || byte === 13;
}

function isWhitespaceOnly(buffer: Uint8Array, start: number, end: number): boolean {
  for (let index = start; index < end; index++) {
    if (!isWhitespace(buffer[index]!)) {
      return false;
    }
  }
  return true;
}

function hasUtf8Bom(buffer: Uint8Array, start: number): boolean {
  return start === 0
    && buffer.byteLength >= 3
    && buffer[0] === 0xef
    && buffer[1] === 0xbb
    && buffer[2] === 0xbf;
}

function isXmlName(value: string): boolean {
  return XML_NAME_RE.test(value);
}

function assertValidXmlCharacters(value: string, label: string): void {
  if (!XML_CHAR_RE.test(value)) {
    throw new Error(`Invalid XML character in ${label}.`);
  }
}

function isXmlChar(codePoint: number): boolean {
  return Number.isInteger(codePoint)
    && codePoint >= 0
    && codePoint <= 0x10ffff
    && XML_CHAR_RE.test(String.fromCodePoint(codePoint));
}

function assertValidEntityReferences(
  value: string,
  declaredEntities: ReadonlySet<string>,
  hasDoctype: boolean
): void {
  let index = value.indexOf('&');
  while (index !== -1) {
    const semi = value.indexOf(';', index + 1);
    if (semi === -1) {
      throw new Error('Entity references must end with ";".');
    }
    const body = value.slice(index + 1, semi);
    if (body.startsWith('#x')) {
      if (!/^[\da-fA-F]+$/.test(body.slice(2))) {
        throw new Error('Invalid XML character reference.');
      }
      const codePoint = Number.parseInt(body.slice(2), 16);
      if (!Number.isInteger(codePoint) || !isXmlChar(codePoint)) {
        throw new Error('Invalid XML character reference.');
      }
    } else if (body.startsWith('#X')) {
      throw new Error('Invalid XML character reference.');
    } else if (body.startsWith('#')) {
      const codePoint = Number.parseInt(body.slice(1), 10);
      if (!/^\d+$/.test(body.slice(1)) || !Number.isInteger(codePoint) || !isXmlChar(codePoint)) {
        throw new Error('Invalid XML character reference.');
      }
    } else {
      if (!isXmlName(body)) {
        throw new Error('Invalid XML entity reference.');
      }
      if (!isPredefinedEntity(body) && !declaredEntities.has(body) && !hasDoctype) {
        throw new Error(`Undeclared XML entity reference: ${body}.`);
      }
    }
    index = value.indexOf('&', semi + 1);
  }
}

function isPredefinedEntity(value: string): boolean {
  return value === 'lt'
    || value === 'gt'
    || value === 'amp'
    || value === 'apos'
    || value === 'quot';
}

function decodeShortAsciiSpan(buffer: Uint8Array, start: number, end: number): string | undefined {
  switch (end - start) {
    case 0:
      return '';
    case 1: {
      const b0 = buffer[start]!;
      return b0 <= 0x7f ? String.fromCharCode(b0) : undefined;
    }
    case 2: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      return (b0 | b1) <= 0x7f ? String.fromCharCode(b0, b1) : undefined;
    }
    case 3: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      return (b0 | b1 | b2) <= 0x7f ? String.fromCharCode(b0, b1, b2) : undefined;
    }
    case 4: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      const b3 = buffer[start + 3]!;
      return (b0 | b1 | b2 | b3) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3) : undefined;
    }
    case 5: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      const b3 = buffer[start + 3]!;
      const b4 = buffer[start + 4]!;
      return (b0 | b1 | b2 | b3 | b4) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4) : undefined;
    }
    case 6: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      const b3 = buffer[start + 3]!;
      const b4 = buffer[start + 4]!;
      const b5 = buffer[start + 5]!;
      return (b0 | b1 | b2 | b3 | b4 | b5) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5) : undefined;
    }
    case 7: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      const b3 = buffer[start + 3]!;
      const b4 = buffer[start + 4]!;
      const b5 = buffer[start + 5]!;
      const b6 = buffer[start + 6]!;
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6) : undefined;
    }
    case 8: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      const b3 = buffer[start + 3]!;
      const b4 = buffer[start + 4]!;
      const b5 = buffer[start + 5]!;
      const b6 = buffer[start + 6]!;
      const b7 = buffer[start + 7]!;
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7) : undefined;
    }
    case 9: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      const b3 = buffer[start + 3]!;
      const b4 = buffer[start + 4]!;
      const b5 = buffer[start + 5]!;
      const b6 = buffer[start + 6]!;
      const b7 = buffer[start + 7]!;
      const b8 = buffer[start + 8]!;
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8) : undefined;
    }
    case 10: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      const b3 = buffer[start + 3]!;
      const b4 = buffer[start + 4]!;
      const b5 = buffer[start + 5]!;
      const b6 = buffer[start + 6]!;
      const b7 = buffer[start + 7]!;
      const b8 = buffer[start + 8]!;
      const b9 = buffer[start + 9]!;
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9) : undefined;
    }
    case 11: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      const b3 = buffer[start + 3]!;
      const b4 = buffer[start + 4]!;
      const b5 = buffer[start + 5]!;
      const b6 = buffer[start + 6]!;
      const b7 = buffer[start + 7]!;
      const b8 = buffer[start + 8]!;
      const b9 = buffer[start + 9]!;
      const b10 = buffer[start + 10]!;
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10) : undefined;
    }
    case 12: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      const b3 = buffer[start + 3]!;
      const b4 = buffer[start + 4]!;
      const b5 = buffer[start + 5]!;
      const b6 = buffer[start + 6]!;
      const b7 = buffer[start + 7]!;
      const b8 = buffer[start + 8]!;
      const b9 = buffer[start + 9]!;
      const b10 = buffer[start + 10]!;
      const b11 = buffer[start + 11]!;
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11) : undefined;
    }
    default:
      return undefined;
  }
}

function nameKey(buffer: Uint8Array, start: number, end: number): number {
  let hash = 2166136261;
  for (let index = start; index < end; index++) {
    hash ^= buffer[index]!;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash + ((end - start) * 0x1_0000_0000);
}

function startsWithAscii(buffer: Uint8Array, position: number, value: string): boolean {
  if (position + value.length > buffer.byteLength) return false;
  for (let index = 0; index < value.length; index++) {
    if (buffer[position + index] !== value.charCodeAt(index)) return false;
  }
  return true;
}

function indexOfAscii(buffer: Uint8Array, value: string, from: number): number {
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

function findGt(buffer: Uint8Array, from: number): number {
  return buffer.indexOf(62, from);
}

function findDoctypeEnd(buffer: Uint8Array, from: number): number {
  const length = buffer.byteLength;
  let quote = 0;
  let inSubset = false;
  for (let index = from; index < length; index++) {
    if (quote === 0 && startsWithAscii(buffer, index, '<!--')) {
      const commentEnd = indexOfAscii(buffer, '-->', index + 4);
      if (commentEnd === -1) {
        return -1;
      }
      index = commentEnd + 2;
      continue;
    }
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

function findTagEnd(buffer: Uint8Array, from: number): number {
  const length = buffer.byteLength;
  let quote = 0;
  for (let index = from; index < length; index++) {
    const byte = buffer[index]!;
    if (byte === 34 || byte === 39) {
      if (quote === 0) {
        quote = byte;
        continue;
      } else if (quote === byte) {
        quote = 0;
        continue;
      }
      continue;
    }
    if (byte !== 62) {
      continue;
    }
    if (quote === 0) {
      return index;
    }
  }
  return -1;
}
