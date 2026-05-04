export type StringCurrentCursorMaterializationPolicy =
  | 'none'
  | 'current-event'
  | 'eager-touch';

export interface StringCurrentCursorSyncOptions {
  materialization?: StringCurrentCursorMaterializationPolicy;
  implicitAttributeValue?: 'true' | 'name';
}

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

export class StringCurrentCursorSync {
  private pos = 0;
  private state: CursorState = CursorState.INITIAL;
  private elementDepth = 0;
  private currentDepth = 0;
  private currentEventId = 0;

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

  private readonly materialization: StringCurrentCursorMaterializationPolicy;
  private readonly implicitAttributeValue: 'true' | 'name';

  constructor(
    private readonly xml: string,
    options: StringCurrentCursorSyncOptions = {},
  ) {
    this.materialization = options.materialization ?? 'current-event';
    this.implicitAttributeValue = options.implicitAttributeValue ?? 'true';
  }

  next(): boolean {
    if (this.pendingEndStart >= 0) {
      this.beginEvent(CursorEventType.END_ELEMENT);
      this.currentNameStart = this.pendingEndStart;
      this.currentNameEnd = this.pendingEndEnd;
      this.currentDepth = this.pendingEndDepth;
      this.elementDepth = this.pendingEndDepth;
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

    return this.cursorParseNext();
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
      return this.xml.slice(this.currentNameStart, this.currentNameEnd);
    }
    if (this.materialization === 'eager-touch') {
      this.cursorHydrateCurrentEventStrings();
      return this.eagerName;
    }
    if (this.memoNameEventId === this.currentEventId) {
      return this.memoName;
    }
    this.memoName = this.xml.slice(this.currentNameStart, this.currentNameEnd);
    this.memoNameEventId = this.currentEventId;
    return this.memoName;
  }

  text(): string | undefined {
    if (this.currentTextStart < 0) return undefined;
    if (this.materialization === 'none') {
      return this.xml.slice(this.currentTextStart, this.currentTextEnd);
    }
    if (this.materialization === 'eager-touch') {
      this.cursorHydrateCurrentEventStrings();
      return this.eagerText;
    }
    if (this.memoTextEventId === this.currentEventId) {
      return this.memoText;
    }
    this.memoText = this.xml.slice(this.currentTextStart, this.currentTextEnd);
    this.memoTextEventId = this.currentEventId;
    return this.memoText;
  }

  getAttributeCount(): number {
    return this.attrCount;
  }

  getAttributeName(index: number): string | undefined {
    if (index < 0 || index >= this.attrCount) return undefined;
    if (this.materialization === 'none') {
      return this.xml.slice(this.attrNameStarts[index]!, this.attrNameEnds[index]!);
    }
    if (this.materialization === 'eager-touch') {
      this.cursorHydrateCurrentEventStrings();
      return this.eagerAttrNames?.[index];
    }
    if (this.memoAttrNameEventId === this.currentEventId && this.memoAttrNameIndex === index) {
      return this.memoAttrName;
    }
    this.memoAttrName = this.xml.slice(this.attrNameStarts[index]!, this.attrNameEnds[index]!);
    this.memoAttrNameEventId = this.currentEventId;
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
      return this.sliceAttrValue(index);
    }
    if (this.materialization === 'eager-touch') {
      this.cursorHydrateCurrentEventStrings();
      return this.eagerAttrValues?.[index];
    }
    if (this.memoAttrValueEventId === this.currentEventId && this.memoAttrValueIndex === index) {
      return this.memoAttrValue;
    }
    this.memoAttrValue = this.sliceAttrValue(index);
    this.memoAttrValueEventId = this.currentEventId;
    this.memoAttrValueIndex = index;
    return this.memoAttrValue;
  }

  private getAttributeValueByName(name: string): string | undefined {
    if (this.materialization === 'eager-touch') {
      this.cursorHydrateCurrentEventStrings();
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
      const attrName = this.getAttributeName(index);
      if (attrName === name) {
        return this.getAttributeValueByIndex(index);
      }
    }
    return undefined;
  }

  private sliceAttrValue(index: number): string {
    if (this.attrImplicit[index] === 1) {
      return this.implicitAttributeValue === 'name'
        ? this.xml.slice(this.attrNameStarts[index]!, this.attrNameEnds[index]!)
        : 'true';
    }
    return this.xml.slice(this.attrValueStarts[index]!, this.attrValueEnds[index]!);
  }

  private cursorParseNext(): boolean {
    while (this.pos < this.xml.length) {
      const lt = this.xml.indexOf('<', this.pos);
      if (lt === -1) {
        if (this.pos < this.xml.length) {
          const start = this.pos;
          this.pos = this.xml.length;
          if (start < this.pos) {
            this.beginEvent(CursorEventType.CHARACTERS);
            this.currentTextStart = start;
            this.currentTextEnd = this.pos;
            this.currentDepth = this.elementDepth;
            return true;
          }
        }
        this.state = CursorState.DONE;
        this.beginEvent(CursorEventType.END_DOCUMENT);
        this.currentDepth = 0;
        return true;
      }

      if (lt > this.pos) {
        const start = this.pos;
        this.pos = lt;
        if (start < lt) {
          this.beginEvent(CursorEventType.CHARACTERS);
          this.currentTextStart = start;
          this.currentTextEnd = lt;
          this.currentDepth = this.elementDepth;
          return true;
        }
      }

      const nextCode = this.xml.charCodeAt(lt + 1);
      if (nextCode === 47) {
        return this.cursorParseEndTag(lt);
      }
      if (nextCode === 33) {
        if (this.xml.startsWith('<![CDATA[', lt)) {
          const end = this.xml.indexOf(']]>', lt + 9);
          this.beginEvent(CursorEventType.CDATA);
          this.currentTextStart = lt + 9;
          this.currentTextEnd = end === -1 ? this.xml.length : end;
          this.currentDepth = this.elementDepth;
          this.pos = end === -1 ? this.xml.length : end + 3;
          return true;
        }
        if (this.xml.startsWith('<!--', lt)) {
          const end = this.xml.indexOf('-->', lt + 4);
          this.pos = end === -1 ? this.xml.length : end + 3;
          continue;
        }
        if (this.xml.startsWith('<!DOCTYPE', lt)) {
          const end = this.xml.indexOf('>', lt + 9);
          this.pos = end === -1 ? this.xml.length : end + 1;
          continue;
        }
      }
      if (nextCode === 63) {
        const end = this.xml.indexOf('?>', lt + 2);
        this.pos = end === -1 ? this.xml.length : end + 2;
        continue;
      }
      return this.cursorParseStartTag(lt);
    }

    this.state = CursorState.DONE;
    this.beginEvent(CursorEventType.END_DOCUMENT);
    this.currentDepth = 0;
    return true;
  }

  private cursorParseStartTag(lt: number): boolean {
    const gt = this.findTagEnd(lt + 1);
    const selfClosing = this.xml.charCodeAt(gt - 1) === 47;
    const actualEnd = selfClosing ? gt - 1 : gt;
    let cursor = lt + 1;
    while (cursor < actualEnd && isAsciiWhitespace(this.xml.charCodeAt(cursor))) cursor++;
    const nameStart = cursor;
    while (cursor < actualEnd) {
      const code = this.xml.charCodeAt(cursor);
      if (isAsciiWhitespace(code) || code === 47 || code === 62) break;
      cursor++;
    }

    this.beginEvent(CursorEventType.START_ELEMENT);
    const nextAttrCapacity = this.cursorCountAttributes(cursor, actualEnd);
    this.ensureAttrCapacity(nextAttrCapacity);
    this.attrCount = this.cursorParseAttributeSpans(cursor, actualEnd);
    this.currentNameStart = nameStart;
    this.currentNameEnd = cursor;
    this.elementDepth = (this.elementDepth + 1) | 0;
    this.currentDepth = this.elementDepth;
    this.pos = gt + 1;

    if (selfClosing) {
      this.pendingEndStart = nameStart;
      this.pendingEndEnd = cursor;
      this.pendingEndDepth = this.elementDepth > 0 ? this.elementDepth - 1 : 0;
    }
    return true;
  }

  private cursorParseEndTag(lt: number): boolean {
    const gt = this.xml.indexOf('>', lt + 2);
    let start = lt + 2;
    while (start < gt && isAsciiWhitespace(this.xml.charCodeAt(start))) start++;
    let end = gt;
    while (end > start && isAsciiWhitespace(this.xml.charCodeAt(end - 1))) end--;

    this.beginEvent(CursorEventType.END_ELEMENT);
    this.currentNameStart = start;
    this.currentNameEnd = end;
    this.currentDepth = this.elementDepth > 0 ? this.elementDepth - 1 : 0;
    this.elementDepth = this.currentDepth;
    this.pos = gt + 1;
    return true;
  }

  private cursorCountAttributes(start: number, end: number): number {
    let cursor = start;
    let count = 0;
    while (cursor < end) {
      while (cursor < end && isAsciiWhitespace(this.xml.charCodeAt(cursor))) cursor++;
      if (cursor >= end) break;
      count++;
      while (cursor < end) {
        const code = this.xml.charCodeAt(cursor);
        if (isAsciiWhitespace(code) || code === 61) break;
        cursor++;
      }
      while (cursor < end && isAsciiWhitespace(this.xml.charCodeAt(cursor))) cursor++;
      if (cursor >= end || this.xml.charCodeAt(cursor) !== 61) {
        continue;
      }
      cursor++;
      while (cursor < end && isAsciiWhitespace(this.xml.charCodeAt(cursor))) cursor++;
      if (cursor >= end) break;
      const quote = this.xml.charCodeAt(cursor);
      if (quote !== 34 && quote !== 39) break;
      cursor++;
      while (cursor < end && this.xml.charCodeAt(cursor) !== quote) cursor++;
      cursor++;
    }
    return count;
  }

  private cursorParseAttributeSpans(start: number, end: number): number {
    let cursor = start;
    let count = 0;

    while (cursor < end) {
      while (cursor < end && isAsciiWhitespace(this.xml.charCodeAt(cursor))) cursor++;
      if (cursor >= end) break;

      const nameStart = cursor;
      while (cursor < end) {
        const code = this.xml.charCodeAt(cursor);
        if (isAsciiWhitespace(code) || code === 61) break;
        cursor++;
      }

      this.attrNameStarts[count] = nameStart;
      this.attrNameEnds[count] = cursor;

      while (cursor < end && isAsciiWhitespace(this.xml.charCodeAt(cursor))) cursor++;
      if (cursor >= end || this.xml.charCodeAt(cursor) !== 61) {
        this.attrValueStarts[count] = nameStart;
        this.attrValueEnds[count] = cursor;
        this.attrImplicit[count] = 1;
        count++;
        continue;
      }

      cursor++;
      while (cursor < end && isAsciiWhitespace(this.xml.charCodeAt(cursor))) cursor++;
      if (cursor >= end) {
        this.attrValueStarts[count] = nameStart;
        this.attrValueEnds[count] = this.attrNameEnds[count]!;
        this.attrImplicit[count] = 1;
        count++;
        break;
      }

      const quote = this.xml.charCodeAt(cursor);
      if (quote !== 34 && quote !== 39) {
        this.attrValueStarts[count] = nameStart;
        this.attrValueEnds[count] = this.attrNameEnds[count]!;
        this.attrImplicit[count] = 1;
        count++;
        continue;
      }
      cursor++;
      const valueStart = cursor;
      while (cursor < end && this.xml.charCodeAt(cursor) !== quote) cursor++;
      this.attrValueStarts[count] = valueStart;
      this.attrValueEnds[count] = cursor;
      this.attrImplicit[count] = 0;
      count++;
      cursor++;
    }

    return count;
  }

  private cursorHydrateCurrentEventStrings(): void {
    if (this.eagerEventId === this.currentEventId) {
      return;
    }

    this.eagerEventId = this.currentEventId;
    this.eagerName = this.currentNameStart < 0
      ? undefined
      : this.xml.slice(this.currentNameStart, this.currentNameEnd);
    this.eagerText = this.currentTextStart < 0
      ? undefined
      : this.xml.slice(this.currentTextStart, this.currentTextEnd);
    this.eagerAttrNames = undefined;
    this.eagerAttrValues = undefined;

    if (this.attrCount === 0) {
      return;
    }

    const attrNames = new Array<string>(this.attrCount);
    const attrValues = new Array<string>(this.attrCount);
    for (let index = 0; index < this.attrCount; index++) {
      attrNames[index] = this.xml.slice(this.attrNameStarts[index]!, this.attrNameEnds[index]!);
      attrValues[index] = this.attrImplicit[index] === 1
        ? (this.implicitAttributeValue === 'name' ? attrNames[index]! : 'true')
        : this.xml.slice(this.attrValueStarts[index]!, this.attrValueEnds[index]!);
    }
    this.eagerAttrNames = attrNames;
    this.eagerAttrValues = attrValues;
  }

  private ensureAttrCapacity(required: number): void {
    if (required <= this.attrNameStarts.length) {
      return;
    }
    let nextSize = this.attrNameStarts.length;
    while (nextSize < required) {
      nextSize *= 2;
    }

    this.attrNameStarts = copyInt32(this.attrNameStarts, nextSize);
    this.attrNameEnds = copyInt32(this.attrNameEnds, nextSize);
    this.attrValueStarts = copyInt32(this.attrValueStarts, nextSize);
    this.attrValueEnds = copyInt32(this.attrValueEnds, nextSize);
    this.attrImplicit = copyUint8(this.attrImplicit, nextSize);
  }

  private findTagEnd(start: number): number {
    let inQuote = false;
    let quote = 0;
    for (let index = start; index < this.xml.length; index++) {
      const code = this.xml.charCodeAt(index);
      if (code === 34 || code === 39) {
        if (!inQuote) {
          inQuote = true;
          quote = code;
        } else if (quote === code) {
          inQuote = false;
        }
      } else if (code === 62 && !inQuote) {
        return index;
      }
    }
    return this.xml.length - 1;
  }

  private beginEvent(type: number): void {
    this.currentEventId = (this.currentEventId + 1) | 0;
    this.currentType = type;
    this.currentNameStart = -1;
    this.currentNameEnd = -1;
    this.currentTextStart = -1;
    this.currentTextEnd = -1;
    this.attrCount = 0;
  }
}

function copyInt32(source: Int32Array<ArrayBufferLike>, size: number): Int32Array<ArrayBuffer> {
  const copy = new Int32Array(size);
  copy.set(source);
  return copy;
}

function copyUint8(source: Uint8Array<ArrayBufferLike>, size: number): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(size);
  copy.set(source);
  return copy;
}

function isAsciiWhitespace(code: number): boolean {
  return code === 32 || code === 9 || code === 10 || code === 13;
}
