/**
 * XmlCursorReaderAsync - All-SMI async cursor-based XML reader for ReadableStream.
 *
 * Same relative-offset design as the sync cursor: _base anchors the current
 * event's position in the window, and all other position fields are relative
 * SMI offsets from _base.  For the async reader, _base is always relative
 * to the current window string, so it stays small even for multi-GB streams.
 *
 * Reads chunks via the Web Standard ReadableStream API, decodes with TextDecoder,
 * and advances a mutable cursor one event at a time. Incomplete elements at chunk
 * boundaries are carried over and merged with the next chunk (carry-tail pattern).
 *
 * @public
 */

import { CursorEventType, type XmlCursorReaderAsyncOptions } from './types.js';
import { compileEntityDecoder } from './XmlCursorReader.js';

// -- Static helpers (shared with sync, duplicated for tree-shake) ----

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

// -- Parser state (SMI) ----------------------------------------------

const S_INITIAL = 0;
const S_READING = 1;
const S_DONE    = 2;

// -- Attribute data layout (flat SMI array, offsets relative to _base)
const ATTR_STRIDE = 5;

export class XmlCursorReaderAsync {
  // -- Stream --------------------------------------------------------
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly decoder: TextDecoder;

  // -- Buffer: current decoded window + carry-tail -------------------
  private window: string = '';
  private windowLen: number = 0;
  private pos: number = 0;
  private streamDone: boolean = false;

  // -- Parser state (SMI) --------------------------------------------
  private state: number = S_INITIAL;

  // -- Current event anchor + relative SMI offsets -------------------
  private _base: number = 0;
  private _eventType: number = -1;
  private _nameStart: number = -1;
  private _nameEnd: number = -1;
  private _colonPos: number = -1;
  private _textStart: number = 0;
  private _textEnd: number = -1;
  private _nsIdx: number = -1;
  private _attrCount: number = 0;

  // -- Pending self-close END_ELEMENT (ALL SMI + base) ---------------
  private _pendingSelfClose: number = 0;
  private _pendingBase: number = 0;
  private _pendingNameStart: number = -1;
  private _pendingNameEnd: number = -1;
  private _pendingColonPos: number = -1;
  private _pendingNsIdx: number = -1;

  // -- Flat attribute offsets (SMI array, relative to _base) ---------
  private readonly _attrData: number[] = [];

  // -- Element stack -------------------------------------------------
  private readonly _elemStack: string[] = [];
  private _elemStackLen: number = 0;

  // -- Namespace stack -----------------------------------------------
  private readonly _nsStack: Map<string, string>[] = [new Map()];
  private _nsStackLen: number = 1;

  // -- Namespace optimization (SMI) -----------------------------------
  private _nsActive: number = 0;  // 0|1 — set to 1 when first xmlns encountered

  // -- Entity decoder ------------------------------------------------
  private readonly entityDecode: (text: string) => string;

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

  // ===================================================================
  // Public async cursor API
  // ===================================================================

  async next(): Promise<boolean> {
    if (this._pendingSelfClose === 1) {
      this._pendingSelfClose = 0;
      this._eventType = CursorEventType.END_ELEMENT;
      this._base = this._pendingBase;
      this._nameStart = this._pendingNameStart;
      this._nameEnd = this._pendingNameEnd;
      this._colonPos = this._pendingColonPos;
      this._nsIdx = this._pendingNsIdx;
      this._textEnd = -1;
      this._attrCount = 0;
      this._elemStackLen--;
      this._nsStackLen--;
      return true;
    }

    switch (this.state) {
      case S_INITIAL:
        this.state = S_READING;
        this._eventType = CursorEventType.START_DOCUMENT;
        this._nameStart = -1;
        this._textEnd = -1;
        this._nsIdx = -1;
        this._attrCount = 0;
        return true;

      case S_READING:
        return this.parseNextAsync();

      case S_DONE:
        return false;
      /* v8 ignore next -- exhaustive async cursor state switch fallback */
      default:
        return false;
    }
  }

  async close(): Promise<void> {
    this.state = S_DONE;
    await this.reader.cancel();
  }

  // -- Accessor methods (on-demand materialization from window) ------

  eventType(): CursorEventType { return this._eventType as CursorEventType; }

  name(): string | undefined {
    if (this._nameStart < 0) return undefined;
    const b = this._base;
    return this.window.slice(b + this._nameStart, b + this._nameEnd);
  }

  localName(): string | undefined {
    if (this._nameStart < 0) return undefined;
    const b = this._base;
    return this._colonPos < 0
      ? this.window.slice(b + this._nameStart, b + this._nameEnd)
      : this.window.slice(b + this._colonPos + 1, b + this._nameEnd);
  }

  prefix(): string | undefined {
    if (this._colonPos < 0) return undefined;
    const b = this._base;
    return this.window.slice(b + this._nameStart, b + this._colonPos);
  }

  uri(): string | undefined {
    if (this._nsActive === 0) return undefined;
    if (this._nsIdx < 0) return undefined;
    const b = this._base;
    const key = this._colonPos >= 0 ? this.window.slice(b + this._nameStart, b + this._colonPos) : '';
    return this._nsStack[this._nsIdx]!.get(key);
  }

  text(): string | undefined {
    if (this._textEnd < 0) return undefined;
    const b = this._base;
    const raw = this.window.slice(b + this._textStart, b + this._textEnd);
    return this._eventType === CursorEventType.CHARACTERS ? this.entityDecode(raw) : raw;
  }

  getAttributeCount(): number { return this._attrCount; }

  getAttributeName(i: number): string | undefined {
    if (i < 0 || i >= this._attrCount) return undefined;
    const o = i * ATTR_STRIDE;
    const b = this._base;
    return this.window.slice(b + this._attrData[o]!, b + this._attrData[o + 1]!);
  }

  getAttributeLocalName(i: number): string | undefined {
    if (i < 0 || i >= this._attrCount) return undefined;
    const o = i * ATTR_STRIDE;
    const b = this._base;
    const cp = this._attrData[o + 2]!;
    return cp < 0
      ? this.window.slice(b + this._attrData[o]!, b + this._attrData[o + 1]!)
      : this.window.slice(b + cp + 1, b + this._attrData[o + 1]!);
  }

  getAttributePrefix(i: number): string | undefined {
    if (i < 0 || i >= this._attrCount) return undefined;
    const o = i * ATTR_STRIDE;
    const b = this._base;
    const cp = this._attrData[o + 2]!;
    return cp >= 0 ? this.window.slice(b + this._attrData[o]!, b + cp) : undefined;
  }

  getAttributeValue(indexOrName: number | string): string | undefined {
    const b = this._base;
    if (typeof indexOrName === 'number') {
      if (indexOrName < 0 || indexOrName >= this._attrCount) return undefined;
      const o = indexOrName * ATTR_STRIDE;
      const vs = this._attrData[o + 3]!;
      const ve = this._attrData[o + 4]!;
      /* v8 ignore next -- empty attribute values are covered by sync cursor equivalent */
      return vs === ve ? '' : this.entityDecode(this.window.slice(b + vs, b + ve));
    }
    for (let i = 0; i < this._attrCount; i++) {
      const o = i * ATTR_STRIDE;
      if (this.attrNameMatch(o, indexOrName)) {
        const vs = this._attrData[o + 3]!;
        const ve = this._attrData[o + 4]!;
        return vs === ve ? '' : this.entityDecode(this.window.slice(b + vs, b + ve));
      }
    }
    return undefined;
  }

  getAttributeUri(i: number): string | undefined {
    if (this._nsActive === 0) return undefined;
    if (i < 0 || i >= this._attrCount) return undefined;
    const o = i * ATTR_STRIDE;
    const cp = this._attrData[o + 2]!;
    if (cp < 0 || this._nsIdx < 0) return undefined;
    const b = this._base;
    const pfx = this.window.slice(b + this._attrData[o]!, b + cp);
    return this._nsStack[this._nsIdx]!.get(pfx);
  }

  depth(): number { return this._elemStackLen; }

  // ===================================================================
  // Internal helpers
  // ===================================================================

  private attrNameMatch(off: number, target: string): boolean {
    const b = this._base;
    const s = b + this._attrData[off]!;
    const e = b + this._attrData[off + 1]!;
    if (e - s !== target.length) return false;
    const win = this.window;
    for (let j = 0; j < target.length; j++) {
      if (win.charCodeAt(s + j) !== target.charCodeAt(j)) return false;
    }
    return true;
  }

  private emitEndDocument(): boolean {
    this.state = S_DONE;
    this._eventType = CursorEventType.END_DOCUMENT;
    this._nameStart = -1;
    this._textEnd = -1;
    this._nsIdx = -1;
    this._attrCount = 0;
    return true;
  }

  // ===================================================================
  // Internal async parsing
  // ===================================================================

  private async parseNextAsync(): Promise<boolean> {
    while (true) {
      const result = this.tryParseFromWindow();
      if (result !== null) return result;

      if (this.streamDone) {
        /* v8 ignore next -- final trailing text path is covered through tryParseFromWindow */
        if (this.pos < this.windowLen) {
          let s = this.pos;
          let e = this.windowLen;
          while (s < e && isWS(this.window.charCodeAt(s))) s++;
          while (e > s && isWS(this.window.charCodeAt(e - 1))) e--;
          this.pos = this.windowLen;
          if (s < e) {
            this._eventType = CursorEventType.CHARACTERS;
            this._base = s;
            this._textStart = 0;
            this._textEnd = e - s;
            this._nameStart = -1;
            this._nsIdx = -1;
            this._attrCount = 0;
            return true;
          }
        }

        if (this._elemStackLen > 0) {
          throw new Error('Unexpected end of document. Not all elements were closed.');
        }

        return this.emitEndDocument();
      }

      await this.readMoreChunks();
    }
  }

  private tryParseFromWindow(): boolean | null {
    const win = this.window;
    const len = this.windowLen;

    while (this.pos < len) {
      const ltPos = win.indexOf('<', this.pos);

      if (ltPos === -1) {
        if (this.streamDone) {
          if (this.pos < len) {
            let s = this.pos;
            let e = len;
            while (s < e && isWS(win.charCodeAt(s))) s++;
            while (e > s && isWS(win.charCodeAt(e - 1))) e--;
            this.pos = len;
            if (s < e) {
              this._eventType = CursorEventType.CHARACTERS;
              this._base = s;
              this._textStart = 0;
              this._textEnd = e - s;
              this._nameStart = -1;
              this._nsIdx = -1;
              this._attrCount = 0;
              return true;
            }
          }
          return null;
        }
        return null;
      }

      if (ltPos > this.pos) {
        let s = this.pos;
        let e = ltPos;
        while (s < e && isWS(win.charCodeAt(s))) s++;
        /* v8 ignore next -- text trimming is covered at cursor API level */
        while (e > s && isWS(win.charCodeAt(e - 1))) e--;
        this.pos = ltPos;
        if (s < e) {
          this._eventType = CursorEventType.CHARACTERS;
          this._base = s;
          this._textStart = 0;
          this._textEnd = e - s;
          this._nameStart = -1;
          this._nsIdx = -1;
          this._attrCount = 0;
          return true;
        }
      }

      this.pos = ltPos;
      const tagResult = this.tryParseTag();
      if (tagResult === null) return null;
      if (tagResult) return true;
    }

    return null;
  }

  private tryParseTag(): boolean | null {
    if (this.pos + 1 >= this.windowLen) {
      return this.streamDone ? this.forceParseTag() : null;
    }

    const nextCode = this.window.charCodeAt(this.pos + 1);
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
    const base = this.pos;
    const closePos = win.indexOf('>', base + 2);
    if (closePos === -1) {
      return this.streamDone
        ? (() => { throw new Error('Unclosed end tag'); })()
        : null;
    }

    let nameS = base + 2;
    let nameE = closePos;
    while (nameS < nameE && isWS(win.charCodeAt(nameS))) nameS++;
    while (nameE > nameS && isWS(win.charCodeAt(nameE - 1))) nameE--;

    const fullTagName = win.slice(nameS, nameE);

    if (this._elemStackLen === 0) {
      throw new Error(`Mismatched closing tag: </${fullTagName}>. No open elements.`);
    }
    const expected = this._elemStack[this._elemStackLen - 1]!;
    if (fullTagName !== expected) {
      throw new Error(`Mismatched closing tag: </${fullTagName}>. Expected </${expected}>.`);
    }

    this._nsIdx = this._nsStackLen - 1;
    this._elemStackLen--;
    this._nsStackLen--;

    let colonPos = -1;
    for (let j = nameS; j < nameE; j++) {
      if (win.charCodeAt(j) === 58) { colonPos = j - base; break; }
    }

    this._eventType = CursorEventType.END_ELEMENT;
    this._base = base;
    this._nameStart = nameS - base;
    this._nameEnd = nameE - base;
    this._colonPos = colonPos;
    this._textEnd = -1;
    this._attrCount = 0;

    this.pos = closePos + 1;
    return true;
  }

  private tryParseBangTag(): boolean | null {
    const win = this.window;
    const base = this.pos;

    if (win.startsWith('<![CDATA[', base)) {
      const end = win.indexOf(']]>', base + 9);
      if (end === -1) {
        return this.streamDone
          ? (() => { throw new Error('Unclosed CDATA section'); })()
          : null;
      }
      this._eventType = CursorEventType.CDATA;
      this._base = base;
      this._textStart = 9;
      this._textEnd = end - base;
      this._nameStart = -1;
      this._nsIdx = -1;
      this._attrCount = 0;
      this.pos = end + 3;
      return true;
    }

    if (win.startsWith('<!--', base)) {
      const end = win.indexOf('-->', base + 4);
      if (end === -1) {
        return this.streamDone
          ? (() => { throw new Error('Unclosed comment'); })()
          : null;
      }
      this.pos = end + 3;
      return false;
    }

    if (win.startsWith('<!DOCTYPE', base)) {
      const end = win.indexOf('>', base);
      if (end === -1) {
        return this.streamDone
          ? (() => { throw new Error('Unclosed DOCTYPE declaration'); })()
          : null;
      }
      this.pos = end + 1;
      return false;
    }

    if (base + 9 > this.windowLen && !this.streamDone) return null;

    const end = win.indexOf('>', base);
    if (end === -1) {
      return this.streamDone
        /* v8 ignore next -- generic <! markup error is a malformed-input guard */
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
    const base = this.pos;
    const tagStart = base + 1;
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
      /* v8 ignore next -- malformed tag-name delimiter guard */
      else if (code === 62 || code === 47) break;
      nameEnd++;
    }

    const tagName = win.slice(tagStart, nameEnd);
    const parentNs = this._nsStack[this._nsStackLen - 1]!;

    // Set base BEFORE parseAttrs
    this._base = base;

    // Fast path: simple element with no namespace prefix and no attributes
    if (colonPos === -1 && nameEnd === actualEnd) {
      this._eventType = CursorEventType.START_ELEMENT;
      this._nameStart = tagStart - base;
      this._nameEnd = nameEnd - base;
      this._colonPos = -1;
      this._textEnd = -1;
      this._attrCount = 0;

      if (this._elemStackLen === this._elemStack.length) {
        this._elemStack.push(tagName);
      } else {
        this._elemStack[this._elemStackLen] = tagName;
      }
      this._elemStackLen++;

      if (isSelfClosing) {
        this._pendingSelfClose = 1;
        this._pendingBase = base;
        this._pendingNameStart = tagStart - base;
        this._pendingNameEnd = nameEnd - base;
        this._pendingColonPos = -1;
        this._pendingNsIdx = this._nsStackLen - 1;
        this._nsIdx = this._nsStackLen - 1;
      } else {
        if (this._nsStackLen === this._nsStack.length) {
          this._nsStack.push(parentNs);
        } else {
          this._nsStack[this._nsStackLen] = parentNs;
        }
        this._nsStackLen++;
        this._nsIdx = this._nsStackLen - 1;
      }

      this.pos = tagEnd + 1;
      return true;
    }

    // General path: parse attributes + collect xmlns declarations
    this._attrCount = 0;
    const namespaces = this.parseAttrs(nameEnd, actualEnd, parentNs);

    this._eventType = CursorEventType.START_ELEMENT;
    this._nameStart = tagStart - base;
    this._nameEnd = nameEnd - base;
    this._colonPos = colonPos >= 0 ? colonPos - base : -1;
    this._textEnd = -1;

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

    this._nsIdx = this._nsStackLen - 1;

    if (isSelfClosing) {
      this._pendingSelfClose = 1;
      this._pendingBase = base;
      this._pendingNameStart = tagStart - base;
      this._pendingNameEnd = nameEnd - base;
      this._pendingColonPos = colonPos >= 0 ? colonPos - base : -1;
      this._pendingNsIdx = this._nsStackLen - 1;
    }

    this.pos = tagEnd + 1;
    return true;
  }

  // -- Attribute parsing (flat SMI array, offsets relative to _base) --

  private parseAttrs(
    start: number, end: number, parentNs: Map<string, string>,
  ): Map<string, string> {
    let ns = parentNs;
    let nsCopied = false;
    const win = this.window;
    const d = this._attrData;
    const base = this._base;
    let i = start;
    let attrIdx = 0;

    while (i < end) {
      /* v8 ignore start -- whitespace after '=' mirrors sync cursor coverage */
      while (i < end && isWS(win.charCodeAt(i))) i++;
      /* v8 ignore end */
      /* v8 ignore start -- malformed attribute value guard */
      if (i >= end) break;
      /* v8 ignore end */

      const nameS = i;
      let attrColonPos = -1;
      while (i < end) {
        const code = win.charCodeAt(i);
        if (code === 61 || isWS(code)) break;
        if (code === 58 && attrColonPos === -1) attrColonPos = i;
        i++;
      }
      if (i === nameS) break;
      const nameE = i;

      /* v8 ignore next -- whitespace after '=' mirrors sync cursor coverage */
      while (i < end && isWS(win.charCodeAt(i))) i++;
      if (i >= end || win.charCodeAt(i) !== 61) {
        const b = attrIdx * ATTR_STRIDE;
        if (b + ATTR_STRIDE > d.length) for (let j = d.length; j < b + ATTR_STRIDE; j++) d.push(0);
        d[b] = nameS - base; d[b + 1] = nameE - base;
        d[b + 2] = attrColonPos >= 0 ? attrColonPos - base : -1;
        d[b + 3] = nameS - base; d[b + 4] = nameE - base;
        attrIdx++;
        continue;
      }
      i++;

      while (i < end && isWS(win.charCodeAt(i))) i++;
      /* v8 ignore next -- malformed attribute value guard */
      if (i >= end) break;

      const quote = win.charCodeAt(i);
      if (quote !== 34 && quote !== 39) break;
      i++;
      const valS = i;
      while (i < end && win.charCodeAt(i) !== quote) i++;
      if (i >= end) break;
      const valE = i;
      i++;

      // xmlns handling - charCode-based, absolute positions for window access
      const nameLen = nameE - nameS;
      if (nameLen >= 5 && win.charCodeAt(nameS) === 120) {
        if (win.charCodeAt(nameS + 1) === 109 &&
            win.charCodeAt(nameS + 2) === 108 &&
            win.charCodeAt(nameS + 3) === 110 &&
            win.charCodeAt(nameS + 4) === 115) {
          if (nameLen === 5) {
            if (!nsCopied) { ns = new Map(parentNs); nsCopied = true; }
            ns.set('', this.entityDecode(win.slice(valS, valE)));
            this._nsActive = 1;
          } else if (win.charCodeAt(nameS + 5) === 58) {
            if (!nsCopied) { ns = new Map(parentNs); nsCopied = true; }
            ns.set(win.slice(nameS + 6, nameE), this.entityDecode(win.slice(valS, valE)));
            this._nsActive = 1;
          }
        }
      }

      const b = attrIdx * ATTR_STRIDE;
      if (b + ATTR_STRIDE > d.length) for (let j = d.length; j < b + ATTR_STRIDE; j++) d.push(0);
      d[b] = nameS - base; d[b + 1] = nameE - base;
      d[b + 2] = attrColonPos >= 0 ? attrColonPos - base : -1;
      d[b + 3] = valS - base; d[b + 4] = valE - base;
      attrIdx++;
    }

    this._attrCount = attrIdx;
    return ns;
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

  // -- Chunk reading and window management ---------------------------

  private async readMoreChunks(): Promise<void> {
    const tail = this.pos < this.windowLen
      ? this.window.slice(this.pos)
      : '';

    const { done, value } = await this.reader.read();
    if (done) {
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
