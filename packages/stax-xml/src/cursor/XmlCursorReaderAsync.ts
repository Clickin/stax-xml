/**
 * XmlCursorReaderAsync — Async cursor-based XML reader for ReadableStream.
 *
 * Reads chunks via the Web Standard ReadableStream API, decodes with TextDecoder,
 * and advances a mutable cursor one event at a time. Incomplete elements at chunk
 * boundaries are carried over and merged with the next chunk (carry-tail pattern).
 *
 * Same zero-allocation cursor design as the sync reader: all mutable integer
 * state uses SMI values to skip V8 write barriers.
 *
 * @public
 */

import { CursorEventType, type XmlCursorReaderAsyncOptions } from './types.js';
import { compileEntityDecoder } from './XmlCursorReader.js';

// ── Static helpers (shared with sync, duplicated for tree-shake) ────

const ASCII_TABLE = /* @__PURE__ */ (() => {
  const t = new Uint8Array(128);
  t[9] = 1; t[10] = 1; t[13] = 1; t[32] = 1;
  return t;
})();

const UNICODE_WS = /* @__PURE__ */ new Set([
  0x00A0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003,
  0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009,
  0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF,
]);

function isWS(code: number): boolean {
  return code < 128 ? ASCII_TABLE[code] === 1 : code <= 32 || UNICODE_WS.has(code);
}

// ── Attribute span ──────────────────────────────────────────────────

interface AttrSpan {
  nameStart: number;
  nameEnd: number;
  colonPos: number;
  valueStart: number;
  valueEnd: number;
}

// ── Parser state (SMI) ──────────────────────────────────────────────

const S_INITIAL = 0;
const S_READING = 1;
const S_DONE    = 2;

export class XmlCursorReaderAsync {
  // ── Stream ───────────────────────────────────────────────────────
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly decoder: TextDecoder;

  // ── Buffer: current decoded window + carry-tail ──────────────────
  private window: string = '';
  private windowLen: number = 0;
  private pos: number = 0;
  private streamDone: boolean = false;

  // ── Parser state (SMI) ───────────────────────────────────────────
  private state: number = S_INITIAL;

  // ── Current event (SMI + lazy strings) ───────────────────────────
  private _eventType: number = -1;
  private _nameStart: number = 0;
  private _nameEnd: number = 0;
  private _colonPos: number = -1;
  private _valueStart: number = 0;
  private _valueEnd: number = 0;
  private _pendingSelfClose: number = 0;

  // ── Attribute spans ──────────────────────────────────────────────
  private readonly _attrs: AttrSpan[] = [];
  private _attrCount: number = 0;

  // ── Element stack ────────────────────────────────────────────────
  private readonly _elemStack: string[] = [];
  private _elemStackLen: number = 0;

  // ── Namespace stack ──────────────────────────────────────────────
  private readonly _nsStack: Map<string, string>[] = [new Map()];
  private _nsStackLen: number = 1;

  // ── Entity decoder ───────────────────────────────────────────────
  private readonly entityDecode: (text: string) => string;

  // ── Name cache ───────────────────────────────────────────────────
  private _cachedName: string | undefined = undefined;
  private _cachedLocalName: string | undefined = undefined;
  private _cachedPrefix: string | undefined = undefined;

  constructor(stream: ReadableStream<Uint8Array>, options: XmlCursorReaderAsyncOptions = {}) {
    if (!(stream instanceof ReadableStream)) {
      throw new Error('stream must be a web standard ReadableStream.');
    }
    this.reader = stream.getReader();
    this.decoder = new TextDecoder(options.encoding ?? 'utf-8', {
      fatal: false,
      ignoreBOM: true,
    });
    this.entityDecode = compileEntityDecoder(options);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Public async cursor API
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Advance the cursor to the next event.
   * @returns `true` if there is a current event, `false` when exhausted.
   */
  async next(): Promise<boolean> {
    // Pending self-close END_ELEMENT
    if (this._pendingSelfClose === 1) {
      this._pendingSelfClose = 0;
      this._eventType = CursorEventType.END_ELEMENT;
      this._attrCount = 0;
      this._elemStackLen--;
      this._nsStackLen--;
      return true;
    }

    this._cachedName = undefined;
    this._cachedLocalName = undefined;
    this._cachedPrefix = undefined;

    switch (this.state) {
      case S_INITIAL:
        this.state = S_READING;
        this._eventType = CursorEventType.START_DOCUMENT;
        this._attrCount = 0;
        return true;

      case S_READING:
        return this.parseNextAsync();

      case S_DONE:
        return false;
    }
    return false;
  }

  /** Release the underlying stream reader. */
  async close(): Promise<void> {
    this.state = S_DONE;
    await this.reader.cancel();
  }

  // ── Accessor methods (identical interface to sync) ────────────────

  eventType(): CursorEventType { return this._eventType as CursorEventType; }

  name(): string | undefined {
    const et = this._eventType;
    if (et !== CursorEventType.START_ELEMENT && et !== CursorEventType.END_ELEMENT) return undefined;
    if (this._cachedName === undefined) {
      this._cachedName = this.window.slice(this._nameStart, this._nameEnd);
    }
    return this._cachedName;
  }

  localName(): string | undefined {
    const et = this._eventType;
    if (et !== CursorEventType.START_ELEMENT && et !== CursorEventType.END_ELEMENT) return undefined;
    if (this._cachedLocalName === undefined) {
      this._cachedLocalName = this._colonPos === -1
        ? this.window.slice(this._nameStart, this._nameEnd)
        : this.window.slice(this._colonPos + 1, this._nameEnd);
    }
    return this._cachedLocalName;
  }

  prefix(): string | undefined {
    const et = this._eventType;
    if (et !== CursorEventType.START_ELEMENT && et !== CursorEventType.END_ELEMENT) return undefined;
    if (this._cachedPrefix === undefined && this._colonPos !== -1) {
      this._cachedPrefix = this.window.slice(this._nameStart, this._colonPos);
    }
    return this._colonPos === -1 ? undefined : this._cachedPrefix;
  }

  uri(): string | undefined {
    const et = this._eventType;
    if (et !== CursorEventType.START_ELEMENT && et !== CursorEventType.END_ELEMENT) return undefined;
    const ns = this._nsStack[this._nsStackLen - 1];
    if (this._colonPos === -1) return ns?.get('');
    return ns?.get(this.prefix()!);
  }

  text(): string | undefined {
    const et = this._eventType;
    if (et !== CursorEventType.CHARACTERS && et !== CursorEventType.CDATA) return undefined;
    const raw = this.window.slice(this._valueStart, this._valueEnd);
    return et === CursorEventType.CHARACTERS ? this.entityDecode(raw) : raw;
  }

  getAttributeCount(): number { return this._attrCount; }

  getAttributeName(i: number): string | undefined {
    if (i < 0 || i >= this._attrCount) return undefined;
    const s = this._attrs[i]!;
    return this.window.slice(s.nameStart, s.nameEnd);
  }

  getAttributeLocalName(i: number): string | undefined {
    if (i < 0 || i >= this._attrCount) return undefined;
    const s = this._attrs[i]!;
    return s.colonPos === -1
      ? this.window.slice(s.nameStart, s.nameEnd)
      : this.window.slice(s.colonPos + 1, s.nameEnd);
  }

  getAttributePrefix(i: number): string | undefined {
    if (i < 0 || i >= this._attrCount) return undefined;
    const s = this._attrs[i]!;
    return s.colonPos === -1 ? undefined : this.window.slice(s.nameStart, s.colonPos);
  }

  getAttributeValue(indexOrName: number | string): string | undefined {
    if (typeof indexOrName === 'number') {
      if (indexOrName < 0 || indexOrName >= this._attrCount) return undefined;
      const s = this._attrs[indexOrName]!;
      return this.entityDecode(this.window.slice(s.valueStart, s.valueEnd));
    }
    for (let i = 0; i < this._attrCount; i++) {
      const s = this._attrs[i]!;
      if (this.window.slice(s.nameStart, s.nameEnd) === indexOrName) {
        return this.entityDecode(this.window.slice(s.valueStart, s.valueEnd));
      }
    }
    return undefined;
  }

  getAttributeUri(i: number): string | undefined {
    if (i < 0 || i >= this._attrCount) return undefined;
    const s = this._attrs[i]!;
    if (s.colonPos === -1) return undefined;
    const p = this.window.slice(s.nameStart, s.colonPos);
    return this._nsStack[this._nsStackLen - 1]?.get(p);
  }

  depth(): number { return this._elemStackLen; }

  // ═══════════════════════════════════════════════════════════════════
  // Internal async parsing
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Try to parse the next event from the current window.
   * If the window is exhausted or contains an incomplete element, read more chunks.
   */
  private async parseNextAsync(): Promise<boolean> {
    while (true) {
      const result = this.tryParseFromWindow();
      if (result !== null) return result;

      // Need more data
      if (this.streamDone) {
        // Check for remaining text
        if (this.pos < this.windowLen) {
          const trimmed = this.trimSpan(this.pos, this.windowLen);
          this.pos = this.windowLen;
          if (trimmed[0] < trimmed[1]) {
            this._eventType = CursorEventType.CHARACTERS;
            this._valueStart = trimmed[0];
            this._valueEnd = trimmed[1];
            this._attrCount = 0;
            // After yielding this text, next call will reach END_DOCUMENT
            return true;
          }
        }

        if (this._elemStackLen > 0) {
          throw new Error('Unexpected end of document. Not all elements were closed.');
        }

        this.state = S_DONE;
        this._eventType = CursorEventType.END_DOCUMENT;
        this._attrCount = 0;
        return true;
      }

      await this.readMoreChunks();
    }
  }

  /**
   * Try to parse one event from the current window.
   * Returns true/false if event produced, null if more data is needed.
   */
  private tryParseFromWindow(): boolean | null {
    const win = this.window;
    const len = this.windowLen;

    while (this.pos < len) {
      const ltPos = win.indexOf('<', this.pos);

      if (ltPos === -1) {
        // No '<' in remaining window
        if (this.streamDone) {
          // All remaining is text
          if (this.pos < len) {
            const trimmed = this.trimSpan(this.pos, len);
            this.pos = len;
            if (trimmed[0] < trimmed[1]) {
              this._eventType = CursorEventType.CHARACTERS;
              this._valueStart = trimmed[0];
              this._valueEnd = trimmed[1];
              this._attrCount = 0;
              return true;
            }
          }
          return null; // will hit END_DOCUMENT path
        }
        // Need more data — text might continue in next chunk
        return null;
      }

      // Text before '<'
      if (ltPos > this.pos) {
        const trimmed = this.trimSpan(this.pos, ltPos);
        this.pos = ltPos;
        if (trimmed[0] < trimmed[1]) {
          this._eventType = CursorEventType.CHARACTERS;
          this._valueStart = trimmed[0];
          this._valueEnd = trimmed[1];
          this._attrCount = 0;
          return true;
        }
        // whitespace-only text, continue
      }

      // Try to parse tag
      this.pos = ltPos;
      const tagResult = this.tryParseTag();
      if (tagResult === null) return null; // incomplete tag, need more data
      if (tagResult) return true; // event produced
      // tagResult === false: skipped (comment/PI/DOCTYPE), continue loop
    }

    if (this.streamDone) return null; // will produce END_DOCUMENT
    return null; // need more data
  }

  /**
   * Attempt to parse a tag. Returns:
   * - true: event produced
   * - false: skipped (comment/PI/DOCTYPE)
   * - null: incomplete, need more data
   */
  private tryParseTag(): boolean | null {
    const win = this.window;
    if (this.pos + 1 >= this.windowLen) {
      return this.streamDone ? this.forceParseTag() : null;
    }

    const nextCode = win.charCodeAt(this.pos + 1);

    switch (nextCode) {
      case 47: return this.tryParseEndTag();
      case 33: return this.tryParseBangTag();
      case 63: return this.tryParsePI();
      default: return this.tryParseStartTag();
    }
  }

  private forceParseTag(): boolean {
    throw new Error('Unexpected end of document. Incomplete markup at end of stream.');
  }

  private tryParseEndTag(): boolean | null {
    const win = this.window;
    const closePos = win.indexOf('>', this.pos + 2);
    if (closePos === -1) {
      return this.streamDone
        ? (() => { throw new Error('Unclosed end tag'); })()
        : null;
    }

    let nameS = this.pos + 2;
    let nameE = closePos;
    while (nameS < nameE && isWS(win.charCodeAt(nameS))) nameS++;
    while (nameE > nameS && isWS(win.charCodeAt(nameE - 1))) nameE--;

    let colon = -1;
    for (let i = nameS; i < nameE; i++) {
      if (win.charCodeAt(i) === 58) { colon = i; break; }
    }

    const tagName = win.slice(nameS, nameE);
    if (this._elemStackLen === 0) {
      throw new Error(`Mismatched closing tag: </${tagName}>. No open elements.`);
    }
    const expected = this._elemStack[this._elemStackLen - 1]!;
    if (tagName !== expected) {
      throw new Error(`Mismatched closing tag: </${tagName}>. Expected </${expected}>.`);
    }

    this._elemStackLen--;
    this._nsStackLen--;

    this._eventType = CursorEventType.END_ELEMENT;
    this._nameStart = nameS;
    this._nameEnd = nameE;
    this._colonPos = colon;
    this._attrCount = 0;

    this._cachedName = undefined;
    this._cachedLocalName = undefined;
    this._cachedPrefix = undefined;

    this.pos = closePos + 1;
    return true;
  }

  private tryParseBangTag(): boolean | null {
    const win = this.window;

    if (win.startsWith('<![CDATA[', this.pos)) {
      const end = win.indexOf(']]>', this.pos + 9);
      if (end === -1) {
        return this.streamDone
          ? (() => { throw new Error('Unclosed CDATA section'); })()
          : null;
      }
      this._eventType = CursorEventType.CDATA;
      this._valueStart = this.pos + 9;
      this._valueEnd = end;
      this._attrCount = 0;
      this.pos = end + 3;
      return true;
    }

    if (win.startsWith('<!--', this.pos)) {
      const end = win.indexOf('-->', this.pos + 4);
      if (end === -1) {
        return this.streamDone
          ? (() => { throw new Error('Unclosed comment'); })()
          : null;
      }
      this.pos = end + 3;
      return false;
    }

    if (win.startsWith('<!DOCTYPE', this.pos)) {
      const end = win.indexOf('>', this.pos);
      if (end === -1) {
        return this.streamDone
          ? (() => { throw new Error('Unclosed DOCTYPE declaration'); })()
          : null;
      }
      this.pos = end + 1;
      return false;
    }

    // Need at least 9 chars to determine type (<![CDATA[)
    if (this.pos + 9 > this.windowLen && !this.streamDone) return null;

    const end = win.indexOf('>', this.pos);
    if (end === -1) {
      return this.streamDone
        ? (() => { throw new Error('Unclosed markup'); })()
        : null;
    }
    this.pos = end + 1;
    return false;
  }

  private tryParsePI(): boolean | null {
    const end = this.window.indexOf('?>', this.pos);
    if (end === -1) {
      return this.streamDone
        ? (() => { throw new Error('Unclosed processing instruction'); })()
        : null;
    }
    this.pos = end + 2;
    return false;
  }

  private tryParseStartTag(): boolean | null {
    const win = this.window;
    const tagStart = this.pos + 1;
    const tagEnd = this.findTagEnd(tagStart);
    if (tagEnd === -1) {
      return this.streamDone
        ? (() => { throw new Error('Unclosed start tag'); })()
        : null;
    }

    let isSelfClosing = false;
    let actualEnd = tagEnd;
    if (win.charCodeAt(tagEnd - 1) === 47) {
      isSelfClosing = true;
      actualEnd = tagEnd - 1;
    }

    let nameEnd = tagStart;
    let colonPos = -1;
    while (nameEnd < actualEnd) {
      const code = win.charCodeAt(nameEnd);
      if (code === 58 && colonPos === -1) colonPos = nameEnd;
      else if (code <= 32 && isWS(code)) break;
      else if (code === 62 || code === 47) break;
      nameEnd++;
    }

    const tagName = win.slice(tagStart, nameEnd);
    const parentNs = this._nsStack[this._nsStackLen - 1]!;

    this._attrCount = 0;
    const namespaces = this.parseAttrs(nameEnd, actualEnd, parentNs);

    this._eventType = CursorEventType.START_ELEMENT;
    this._nameStart = tagStart;
    this._nameEnd = nameEnd;
    this._colonPos = colonPos;

    this._cachedName = undefined;
    this._cachedLocalName = undefined;
    this._cachedPrefix = undefined;

    if (this._elemStackLen === this._elemStack.length) {
      this._elemStack.push(tagName);
    } else {
      this._elemStack[this._elemStackLen] = tagName;
    }
    this._elemStackLen++;

    if (this._nsStackLen === this._nsStack.length) {
      this._nsStack.push(namespaces);
    } else {
      this._nsStack[this._nsStackLen] = namespaces;
    }
    this._nsStackLen++;

    if (isSelfClosing) {
      this._pendingSelfClose = 1;
    }

    this.pos = tagEnd + 1;
    return true;
  }

  // ── Attribute parsing (same as sync) ──────────────────────────────

  private parseAttrs(
    start: number, end: number, parentNs: Map<string, string>,
  ): Map<string, string> {
    let ns = parentNs;
    let nsCopied = false;
    const win = this.window;
    let i = start;
    let attrIdx = 0;

    while (i < end) {
      while (i < end && isWS(win.charCodeAt(i))) i++;
      if (i >= end) break;

      const nameS = i;
      let attrColon = -1;
      while (i < end) {
        const code = win.charCodeAt(i);
        if (code === 61 || isWS(code)) break;
        if (code === 58 && attrColon === -1) attrColon = i;
        i++;
      }
      if (i === nameS) break;
      const nameE = i;

      while (i < end && isWS(win.charCodeAt(i))) i++;
      if (i >= end || win.charCodeAt(i) !== 61) {
        this.setAttrSpan(attrIdx++, nameS, nameE, attrColon, nameE, nameE);
        continue;
      }
      i++;

      while (i < end && isWS(win.charCodeAt(i))) i++;
      if (i >= end) break;

      const quote = win.charCodeAt(i);
      if (quote !== 34 && quote !== 39) break;
      i++;
      const valS = i;
      while (i < end && win.charCodeAt(i) !== quote) i++;
      if (i >= end) break;
      const valE = i;
      i++;

      const c0 = win.charCodeAt(nameS);
      if (c0 === 120 && nameE - nameS >= 5) {
        const nameLen = nameE - nameS;
        if (nameLen === 5 && win.slice(nameS, nameE) === 'xmlns') {
          if (!nsCopied) { ns = new Map(parentNs); nsCopied = true; }
          ns.set('', this.entityDecode(win.slice(valS, valE)));
        } else if (nameLen >= 6 && win.charCodeAt(nameS + 5) === 58 && win.slice(nameS, nameS + 5) === 'xmlns') {
          if (!nsCopied) { ns = new Map(parentNs); nsCopied = true; }
          ns.set(win.slice(nameS + 6, nameE), this.entityDecode(win.slice(valS, valE)));
        }
      }

      this.setAttrSpan(attrIdx++, nameS, nameE, attrColon, valS, valE);
    }

    this._attrCount = attrIdx;
    return ns;
  }

  private setAttrSpan(
    idx: number,
    nameStart: number, nameEnd: number, colonPos: number,
    valueStart: number, valueEnd: number,
  ): void {
    if (idx < this._attrs.length) {
      const s = this._attrs[idx]!;
      s.nameStart = nameStart;
      s.nameEnd = nameEnd;
      s.colonPos = colonPos;
      s.valueStart = valueStart;
      s.valueEnd = valueEnd;
    } else {
      this._attrs.push({ nameStart, nameEnd, colonPos, valueStart, valueEnd });
    }
  }

  private findTagEnd(start: number): number {
    let i = start;
    let inQuote = false;
    let quoteChar = 0;
    const win = this.window;
    const len = this.windowLen;

    while (i < len) {
      const code = win.charCodeAt(i);
      if (code === 34 || code === 39) {
        if (!inQuote) { inQuote = true; quoteChar = code; }
        else if (code === quoteChar) { inQuote = false; quoteChar = 0; }
      } else if (code === 62 && !inQuote) {
        return i;
      }
      i++;
    }
    return -1;
  }

  private trimSpan(s: number, e: number): [number, number] {
    const win = this.window;
    while (s < e && isWS(win.charCodeAt(s))) s++;
    while (e > s && isWS(win.charCodeAt(e - 1))) e--;
    return [s, e];
  }

  // ── Chunk reading and window management ───────────────────────────

  /**
   * Read one or more chunks from the stream, decode them, and merge
   * with any unconsumed tail from the current window.
   */
  private async readMoreChunks(): Promise<void> {
    // Keep unconsumed portion
    const tail = this.pos < this.windowLen
      ? this.window.slice(this.pos)
      : '';

    const { done, value } = await this.reader.read();
    if (done) {
      // Flush remaining bytes from decoder
      const flushed = this.decoder.decode();
      this.window = tail + flushed;
      this.windowLen = this.window.length;
      this.pos = 0;
      this.streamDone = true;
      return;
    }

    const decoded = this.decoder.decode(value, { stream: true });
    this.window = tail.length > 0 ? tail + decoded : decoded;
    this.windowLen = this.window.length;
    this.pos = 0;
  }
}
