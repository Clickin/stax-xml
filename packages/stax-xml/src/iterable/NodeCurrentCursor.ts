import { Buffer } from 'node:buffer';
export type NodeCurrentCursorMaterializationPolicy =
  | 'none'
  | 'current-event'
  | 'eager-touch';

export interface NodeCurrentCursorOptions {
  materialization?: NodeCurrentCursorMaterializationPolicy;
  implicitAttributeValue?: 'true' | 'name';
}

const EMPTY_BUFFER = Buffer.alloc(0);

const enum CursorState {
  INITIAL = 0,
  PARSING = 1,
  DONE = 2,
}

const enum CursorEventType {
  START_DOCUMENT = 0,
  END_DOCUMENT = 1,
  START_ELEMENT = 2,
  END_ELEMENT = 3,
  CHARACTERS = 4,
  CDATA = 5,
}

export class NodeCurrentCursor {
  private readonly iterator: Iterator<readonly Uint8Array[]>;
  private currentBuffer: Buffer = EMPTY_BUFFER;
  private pendingTail: Buffer = EMPTY_BUFFER;
  private state: CursorState = CursorState.INITIAL;
  private sourceDone = false;
  private currentDepth = 0;
  private eventId = 0;
  private pos = 0;

  private readonly elementStack: string[] = [];
  private pendingEndStart = -1;
  private pendingEndEnd = -1;
  private pendingEndDepth = 0;

  private currentType = CursorEventType.START_DOCUMENT;
  private currentNameStart = -1;
  private currentNameEnd = -1;
  private currentTextStart = -1;
  private currentTextEnd = -1;
  private attrCount = 0;
  private attrNameStarts = new Int32Array(16);
  private attrNameEnds = new Int32Array(16);
  private attrValueStarts = new Int32Array(16);
  private attrValueEnds = new Int32Array(16);
  private attrImplicit = new Uint8Array(16);

  private memoNameEventId = -1;
  private memoName: string | undefined;
  private memoTextEventId = -1;
  private memoText: string | undefined;
  private memoAttrNameEventId = -1;
  private memoAttrNameIndex = -1;
  private memoAttrName: string | undefined;
  private memoAttrValueEventId = -1;
  private memoAttrValueIndex = -1;
  private memoAttrValue: string | undefined;

  private eagerEventId = -1;
  private eagerName: string | undefined;
  private eagerText: string | undefined;
  private eagerAttrNames: string[] | undefined;
  private eagerAttrValues: string[] | undefined;

  private readonly materialization: NodeCurrentCursorMaterializationPolicy;
  private readonly implicitAttributeValue: 'true' | 'name';

  constructor(
    source: Iterable<readonly Uint8Array[]>,
    options: NodeCurrentCursorOptions = {},
  ) {
    this.iterator = source[Symbol.iterator]();
    this.materialization = options.materialization ?? 'none';
    this.implicitAttributeValue = options.implicitAttributeValue ?? 'true';
  }

  next(): boolean {
    if (this.pendingEndStart >= 0) {
      this.beginEvent(CursorEventType.END_ELEMENT);
      this.currentNameStart = this.pendingEndStart;
      this.currentNameEnd = this.pendingEndEnd;
      this.currentDepth = this.pendingEndDepth;
      this.pendingEndStart = -1;
      this.pendingEndEnd = -1;
      this.pendingEndDepth = 0;
      return true;
    }

    if (this.state === CursorState.INITIAL) {
      this.state = CursorState.PARSING;
      this.beginEvent(CursorEventType.START_DOCUMENT);
      this.currentDepth = 0;
      return true;
    }
    if (this.state === CursorState.DONE) {
      return false;
    }

    while (true) {
      const emitted = this.scanCurrentBuffer(this.sourceDone);
      if (emitted) {
        return true;
      }

      if (this.sourceDone) {
        if (this.pendingTail.byteLength > 0) {
          this.currentBuffer = this.pendingTail;
          this.pendingTail = EMPTY_BUFFER;
          this.pos = 0;
          continue;
        }
        this.state = CursorState.DONE;
        this.beginEvent(CursorEventType.END_DOCUMENT);
        this.currentDepth = 0;
        return true;
      }

      const result = this.iterator.next();
      if (result.done) {
        this.sourceDone = true;
        continue;
      }
      this.currentBuffer = this.prepareBuffer(result.value);
      this.pos = 0;
    }
  }

  eventType(): number {
    return this.currentType;
  }

  depth(): number {
    return this.currentDepth;
  }

  name(): string | undefined {
    if (this.currentNameStart < 0) return undefined;
    if (this.materialization === 'none') {
      return this.currentBuffer.toString('utf8', this.currentNameStart, this.currentNameEnd);
    }
    if (this.materialization === 'eager-touch') {
      this.hydrateCurrentEvent();
      return this.eagerName;
    }
    if (this.memoNameEventId === this.eventId) {
      return this.memoName;
    }
    this.memoName = this.currentBuffer.toString('utf8', this.currentNameStart, this.currentNameEnd);
    this.memoNameEventId = this.eventId;
    return this.memoName;
  }

  text(): string | undefined {
    if (this.currentTextStart < 0) return undefined;
    if (this.materialization === 'none') {
      return this.currentBuffer.toString('utf8', this.currentTextStart, this.currentTextEnd);
    }
    if (this.materialization === 'eager-touch') {
      this.hydrateCurrentEvent();
      return this.eagerText;
    }
    if (this.memoTextEventId === this.eventId) {
      return this.memoText;
    }
    this.memoText = this.currentBuffer.toString('utf8', this.currentTextStart, this.currentTextEnd);
    this.memoTextEventId = this.eventId;
    return this.memoText;
  }

  textNeedsTrim(): boolean {
    if (this.currentTextStart < 0 || this.currentTextStart >= this.currentTextEnd) {
      return false;
    }
    return textBoundaryNeedsTrim(this.currentBuffer[this.currentTextStart]!)
      || textBoundaryNeedsTrim(this.currentBuffer[this.currentTextEnd - 1]!);
  }

  getAttributeCount(): number {
    return this.attrCount;
  }

  hasNamespaceDeclaration(): boolean {
    for (let index = 0; index < this.attrCount; index++) {
      if (isXmlnsAttributeName(this.currentBuffer, this.attrNameStarts[index]!, this.attrNameEnds[index]!)) {
        return true;
      }
    }
    return false;
  }

  getAttributeName(index: number): string | undefined {
    if (index < 0 || index >= this.attrCount) return undefined;
    if (this.materialization === 'none') {
      return this.currentBuffer.toString('utf8', this.attrNameStarts[index]!, this.attrNameEnds[index]!);
    }
    if (this.materialization === 'eager-touch') {
      this.hydrateCurrentEvent();
      return this.eagerAttrNames?.[index];
    }
    if (this.memoAttrNameEventId === this.eventId && this.memoAttrNameIndex === index) {
      return this.memoAttrName;
    }
    this.memoAttrName = this.currentBuffer.toString('utf8', this.attrNameStarts[index]!, this.attrNameEnds[index]!);
    this.memoAttrNameEventId = this.eventId;
    this.memoAttrNameIndex = index;
    return this.memoAttrName;
  }

  getAttributeValue(indexOrName: number | string): string | undefined {
    if (typeof indexOrName === 'number') {
      return this.getAttributeValueByIndex(indexOrName);
    }
    return this.getAttributeValueByName(indexOrName);
  }

  private getAttributeValueByIndex(index: number): string | undefined {
    if (index < 0 || index >= this.attrCount) return undefined;
    if (this.materialization === 'none') {
      return this.sliceAttributeValue(index);
    }
    if (this.materialization === 'eager-touch') {
      this.hydrateCurrentEvent();
      return this.eagerAttrValues?.[index];
    }
    if (this.memoAttrValueEventId === this.eventId && this.memoAttrValueIndex === index) {
      return this.memoAttrValue;
    }
    this.memoAttrValue = this.sliceAttributeValue(index);
    this.memoAttrValueEventId = this.eventId;
    this.memoAttrValueIndex = index;
    return this.memoAttrValue;
  }

  private getAttributeValueByName(name: string): string | undefined {
    if (this.materialization === 'eager-touch') {
      this.hydrateCurrentEvent();
      const names = this.eagerAttrNames;
      if (!names) return undefined;
      for (let index = 0; index < names.length; index++) {
        if (names[index] === name) {
          return this.eagerAttrValues?.[index];
        }
      }
      return undefined;
    }
    for (let index = 0; index < this.attrCount; index++) {
      if (this.getAttributeName(index) === name) {
        return this.getAttributeValueByIndex(index);
      }
    }
    return undefined;
  }

  private scanCurrentBuffer(isFinal: boolean): boolean {
    while (this.pos < this.currentBuffer.byteLength) {
      const lt = this.currentBuffer.indexOf(60, this.pos);
      if (lt === -1) {
        if (isFinal) {
          if (this.emitText(this.pos, this.currentBuffer.byteLength)) {
            this.pos = this.currentBuffer.byteLength;
            return true;
          }
        } else {
          this.pendingTail = this.currentBuffer.subarray(this.pos);
        }
        this.pos = this.currentBuffer.byteLength;
        return false;
      }

      if (lt > this.pos) {
        const start = this.pos;
        this.pos = lt;
        if (this.emitText(start, lt)) {
          return true;
        }
      }

      const next = this.parseTag(lt, isFinal);
      if (next < 0) {
        this.pendingTail = this.currentBuffer.subarray(lt);
        this.pos = this.currentBuffer.byteLength;
        return false;
      }
      if (next === 0) {
        return true;
      }
      this.pos = next;
    }

    return false;
  }

  private emitText(start: number, end: number): boolean {
    if (start >= end || isWhitespaceOnly(this.currentBuffer, start, end)) {
      return false;
    }
    this.beginEvent(CursorEventType.CHARACTERS);
    this.currentTextStart = start;
    this.currentTextEnd = end;
    this.currentDepth = this.elementStack.length;
    return true;
  }

  private parseTag(position: number, isFinal: boolean): number {
    if (position + 1 >= this.currentBuffer.byteLength) {
      if (isFinal) throw new Error('Unclosed start tag');
      return -1;
    }

    const next = this.currentBuffer[position + 1]!;
    if (next === 47) return this.parseEndTag(position, isFinal);
    if (next === 33) return this.parseBangTag(position, isFinal);
    if (next === 63) return this.parseProcessingInstruction(position, isFinal);
    return this.parseStartTag(position, isFinal);
  }

  private parseBangTag(position: number, isFinal: boolean): number {
    if (startsWithAscii(this.currentBuffer, position, '<![CDATA[')) {
      const end = indexOfAscii(this.currentBuffer, ']]>', position + 9);
      if (end === -1) {
        if (isFinal) throw new Error('Unclosed CDATA section');
        return -1;
      }
      this.beginEvent(CursorEventType.CDATA);
      this.currentTextStart = position + 9;
      this.currentTextEnd = end;
      this.currentDepth = this.elementStack.length;
      this.pos = end + 3;
      return 0;
    }
    if (startsWithAscii(this.currentBuffer, position, '<!--')) {
      const end = indexOfAscii(this.currentBuffer, '-->', position + 4);
      if (end === -1) {
        if (isFinal) throw new Error('Unclosed comment');
        return -1;
      }
      return end + 3;
    }
    if (startsWithAscii(this.currentBuffer, position, '<!DOCTYPE')) {
      const end = findDoctypeEnd(this.currentBuffer, position + 2);
      if (end === -1) {
        if (isFinal) throw new Error('Unclosed DOCTYPE declaration');
        return -1;
      }
      return end + 1;
    }
    const end = findGt(this.currentBuffer, position + 2);
    if (end === -1) {
      if (isFinal) throw new Error('Unclosed markup');
      return -1;
    }
    return end + 1;
  }

  private parseProcessingInstruction(position: number, isFinal: boolean): number {
    const end = indexOfAscii(this.currentBuffer, '?>', position + 2);
    if (end === -1) {
      if (isFinal) throw new Error(startsWithAscii(this.currentBuffer, position, '<?xml') ? 'Unclosed XML declaration' : 'Unclosed processing instruction');
      return -1;
    }
    return end + 2;
  }

  private parseEndTag(position: number, isFinal: boolean): number {
    const end = findGt(this.currentBuffer, position + 2);
    if (end === -1) {
      if (isFinal) throw new Error('Unclosed end tag');
      return -1;
    }

    let nameStart = position + 2;
    let nameEnd = end;
    while (nameStart < nameEnd && isWhitespace(this.currentBuffer[nameStart]!)) nameStart++;
    while (nameEnd > nameStart && isWhitespace(this.currentBuffer[nameEnd - 1]!)) nameEnd--;

    if (this.elementStack.length === 0) {
      throw new Error(`Mismatched closing tag: </${this.currentBuffer.toString('utf8', nameStart, nameEnd)}>. No open elements.`);
    }

    const found = this.currentBuffer.toString('utf8', nameStart, nameEnd);
    const expected = this.elementStack.pop()!;
    if (found !== expected) {
      throw new Error(`Mismatched closing tag: </${found}>. Expected </${expected}>.`);
    }

    this.beginEvent(CursorEventType.END_ELEMENT);
    this.currentNameStart = nameStart;
    this.currentNameEnd = nameEnd;
    this.currentDepth = this.elementStack.length;
    this.pos = end + 1;
    return 0;
  }

  private parseStartTag(position: number, isFinal: boolean): number {
    const tagEnd = findTagEnd(this.currentBuffer, position + 1);
    if (tagEnd === -1) {
      if (isFinal) throw new Error('Unclosed start tag');
      return -1;
    }

    let actualEnd = tagEnd;
    while (actualEnd > position + 1 && isWhitespace(this.currentBuffer[actualEnd - 1]!)) actualEnd--;

    let selfClosing = false;
    if (actualEnd > position + 1 && this.currentBuffer[actualEnd - 1] === 47) {
      selfClosing = true;
      actualEnd--;
      while (actualEnd > position + 1 && isWhitespace(this.currentBuffer[actualEnd - 1]!)) actualEnd--;
    }

    let nameStart = position + 1;
    let nameEnd = nameStart;
    while (nameEnd < actualEnd) {
      const byte = this.currentBuffer[nameEnd]!;
      if (isWhitespace(byte) || byte === 47 || byte === 62) break;
      nameEnd++;
    }

    this.beginEvent(CursorEventType.START_ELEMENT);
    const nextAttrCapacity = this.countAttributes(nameEnd, actualEnd);
    this.ensureAttrCapacity(nextAttrCapacity);
    this.attrCount = this.parseAttributeSpans(nameEnd, actualEnd);
    this.currentNameStart = nameStart;
    this.currentNameEnd = nameEnd;
    this.currentDepth = this.elementStack.length + 1;
    this.pos = tagEnd + 1;

    const name = this.currentBuffer.toString('utf8', nameStart, nameEnd);
    if (selfClosing) {
      this.pendingEndStart = nameStart;
      this.pendingEndEnd = nameEnd;
      this.pendingEndDepth = this.elementStack.length;
    } else {
      this.elementStack.push(name);
    }
    return 0;
  }

  private countAttributes(start: number, end: number): number {
    let cursor = start;
    let count = 0;
    while (cursor < end) {
      while (cursor < end && isWhitespace(this.currentBuffer[cursor]!)) cursor++;
      if (cursor >= end) break;
      count++;
      while (cursor < end) {
        const byte = this.currentBuffer[cursor]!;
        if (isWhitespace(byte) || byte === 61) break;
        cursor++;
      }
      while (cursor < end && isWhitespace(this.currentBuffer[cursor]!)) cursor++;
      if (cursor >= end || this.currentBuffer[cursor] !== 61) {
        continue;
      }
      cursor++;
      while (cursor < end && isWhitespace(this.currentBuffer[cursor]!)) cursor++;
      if (cursor >= end) break;
      const quote = this.currentBuffer[cursor]!;
      if (quote !== 34 && quote !== 39) break;
      cursor++;
      while (cursor < end && this.currentBuffer[cursor] !== quote) cursor++;
      cursor++;
    }
    return count;
  }

  private parseAttributeSpans(start: number, end: number): number {
    let cursor = start;
    let count = 0;
    while (cursor < end) {
      while (cursor < end && isWhitespace(this.currentBuffer[cursor]!)) cursor++;
      if (cursor >= end) break;

      const nameStart = cursor;
      while (cursor < end) {
        const byte = this.currentBuffer[cursor]!;
        if (isWhitespace(byte) || byte === 61) break;
        cursor++;
      }
      if (cursor === nameStart) {
        break;
      }
      this.attrNameStarts[count] = nameStart;
      this.attrNameEnds[count] = cursor;

      while (cursor < end && isWhitespace(this.currentBuffer[cursor]!)) cursor++;
      if (cursor >= end || this.currentBuffer[cursor] !== 61) {
        this.attrValueStarts[count] = nameStart;
        this.attrValueEnds[count] = this.attrNameEnds[count]!;
        this.attrImplicit[count] = 1;
        count++;
        continue;
      }

      cursor++;
      while (cursor < end && isWhitespace(this.currentBuffer[cursor]!)) cursor++;
      if (cursor >= end) {
        break;
      }

      const quote = this.currentBuffer[cursor]!;
      if (quote !== 34 && quote !== 39) {
        break;
      }
      cursor++;
      const valueStart = cursor;
      while (cursor < end && this.currentBuffer[cursor] !== quote) cursor++;
      this.attrValueStarts[count] = valueStart;
      this.attrValueEnds[count] = cursor;
      this.attrImplicit[count] = 0;
      count++;
      cursor++;
    }
    return count;
  }

  private sliceAttributeValue(index: number): string {
    if (this.attrImplicit[index] === 1) {
      return this.implicitAttributeValue === 'name'
        ? this.currentBuffer.toString('utf8', this.attrNameStarts[index]!, this.attrNameEnds[index]!)
        : 'true';
    }
    return this.currentBuffer.toString('utf8', this.attrValueStarts[index]!, this.attrValueEnds[index]!);
  }

  private hydrateCurrentEvent(): void {
    if (this.eagerEventId === this.eventId) {
      return;
    }
    this.eagerEventId = this.eventId;
    this.eagerName = this.currentNameStart < 0
      ? undefined
      : this.currentBuffer.toString('utf8', this.currentNameStart, this.currentNameEnd);
    this.eagerText = this.currentTextStart < 0
      ? undefined
      : this.currentBuffer.toString('utf8', this.currentTextStart, this.currentTextEnd);
    this.eagerAttrNames = undefined;
    this.eagerAttrValues = undefined;
    if (this.attrCount === 0) {
      return;
    }

    const attrNames = new Array<string>(this.attrCount);
    const attrValues = new Array<string>(this.attrCount);
    for (let index = 0; index < this.attrCount; index++) {
      attrNames[index] = this.currentBuffer.toString('utf8', this.attrNameStarts[index]!, this.attrNameEnds[index]!);
      attrValues[index] = this.attrImplicit[index] === 1
        ? (this.implicitAttributeValue === 'name' ? attrNames[index]! : 'true')
        : this.currentBuffer.toString('utf8', this.attrValueStarts[index]!, this.attrValueEnds[index]!);
    }
    this.eagerAttrNames = attrNames;
    this.eagerAttrValues = attrValues;
  }

  private ensureAttrCapacity(required: number): void {
    if (required <= this.attrNameStarts.length) return;
    let nextSize = this.attrNameStarts.length;
    while (nextSize < required) nextSize *= 2;
    this.attrNameStarts = growInt32(this.attrNameStarts, nextSize);
    this.attrNameEnds = growInt32(this.attrNameEnds, nextSize);
    this.attrValueStarts = growInt32(this.attrValueStarts, nextSize);
    this.attrValueEnds = growInt32(this.attrValueEnds, nextSize);
    this.attrImplicit = growUint8(this.attrImplicit, nextSize);
  }

  private prepareBuffer(batch: readonly Uint8Array[]): Buffer {
    const hasTail = this.pendingTail.byteLength > 0;
    if (!hasTail && batch.length === 1) {
      return asBuffer(batch[0]!);
    }

    let total = hasTail ? this.pendingTail.byteLength : 0;
    for (let index = 0; index < batch.length; index++) {
      total += batch[index]!.byteLength;
    }

    const buffers = batch.map(asBuffer);
    if (!hasTail) {
      return Buffer.concat(buffers, total);
    }

    const chunks: Buffer[] = [this.pendingTail];
    for (let index = 0; index < buffers.length; index++) {
      chunks.push(buffers[index]!);
    }
    this.pendingTail = EMPTY_BUFFER;
    return Buffer.concat(chunks, total);
  }

  private beginEvent(type: number): void {
    this.eventId = (this.eventId + 1) | 0;
    this.currentType = type;
    this.currentNameStart = -1;
    this.currentNameEnd = -1;
    this.currentTextStart = -1;
    this.currentTextEnd = -1;
    this.attrCount = 0;
  }
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

function asBuffer(source: Uint8Array): Buffer {
  return Buffer.isBuffer(source)
    ? source
    : Buffer.from(source.buffer, source.byteOffset, source.byteLength);
}

function isWhitespace(byte: number): boolean {
  return byte === 32 || byte === 9 || byte === 10 || byte === 13;
}

function textBoundaryNeedsTrim(byte: number): boolean {
  return isWhitespace(byte) || byte >= 128 || byte === 38 || byte === 59;
}

function isWhitespaceOnly(buffer: Buffer, start: number, end: number): boolean {
  for (let index = start; index < end; index++) {
    if (!isWhitespace(buffer[index]!)) {
      return false;
    }
  }
  return true;
}

function isXmlnsAttributeName(buffer: Buffer, start: number, end: number): boolean {
  const length = end - start;
  if (length < 5) {
    return false;
  }
  if (
    buffer[start] !== 120 ||
    buffer[start + 1] !== 109 ||
    buffer[start + 2] !== 108 ||
    buffer[start + 3] !== 110 ||
    buffer[start + 4] !== 115
  ) {
    return false;
  }
  return length === 5 || (length > 6 && buffer[start + 5] === 58);
}

function startsWithAscii(buffer: Buffer, offset: number, value: string): boolean {
  if (offset + value.length > buffer.byteLength) return false;
  for (let index = 0; index < value.length; index++) {
    if (buffer[offset + index] !== value.charCodeAt(index)) {
      return false;
    }
  }
  return true;
}

function indexOfAscii(buffer: Buffer, value: string, offset: number): number {
  return buffer.indexOf(value, offset, 'utf8');
}

function findGt(buffer: Buffer, start: number): number {
  return buffer.indexOf(62, start);
}

function findTagEnd(buffer: Buffer, start: number): number {
  let inQuote = false;
  let quote = 0;
  for (let index = start; index < buffer.byteLength; index++) {
    const byte = buffer[index]!;
    if (byte === 34 || byte === 39) {
      if (!inQuote) {
        inQuote = true;
        quote = byte;
      } else if (quote === byte) {
        inQuote = false;
        quote = 0;
      }
    } else if (byte === 62 && !inQuote) {
      return index;
    }
  }
  return -1;
}

function findDoctypeEnd(buffer: Buffer, start: number): number {
  let depth = 0;
  let quote = 0;
  for (let index = start; index < buffer.byteLength; index++) {
    const byte = buffer[index]!;
    if (quote !== 0) {
      if (byte === quote) quote = 0;
      continue;
    }
    if (byte === 34 || byte === 39) {
      quote = byte;
      continue;
    }
    if (byte === 91) {
      depth++;
      continue;
    }
    if (byte === 93 && depth > 0) {
      depth--;
      continue;
    }
    if (byte === 62 && depth === 0) {
      return index;
    }
  }
  return -1;
}
