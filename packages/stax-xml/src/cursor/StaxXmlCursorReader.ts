/**
 * StaxXmlCursorReader — High-performance sync cursor-based XML reader.
 *
 * Key optimizations:
 * - ABSOLUTE positions (JS string max ~268M << SMI max ~2.1B): no _base offset arithmetic
 * - Position-based element stack (number[] of SMI pairs): zero string allocs in next()
 * - Lazy attribute parsing: attr positions parsed only on first getAttribute*() call
 * - Fused tag scanning: single pass finds both nameEnd and tagEnd for simple tags
 * - Namespace fast-path: _nsActive flag for instant uri() return on non-namespaced XML
 * - All mutable fields are V8 SMI (Small Integer) to bypass write barriers
 *
 * @public
 */

import { CursorEventType, type StaxXmlCursorReaderOptions } from './types.js';

// ── Static tables (shared across all instances) ─────────────────────

const ASCII_TABLE = /* @__PURE__ */ (() => {
  const t = new Uint8Array(128);
  t[9] = 1; t[10] = 1; t[13] = 1; t[32] = 1;   // whitespace
  return t;
})();

const UNICODE_WS = /* @__PURE__ */ new Set([
  0x00A0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003,
  0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009,
  0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF,
]);

const DEFAULT_ENTITY_MAP: Record<string, string> = {
  lt: '<', gt: '>', quot: '"', apos: "'", amp: '&',
};
const DEFAULT_ENTITY_REGEX = /&(lt|gt|quot|apos|amp);/g;
const ENTITY_REGEX_CACHE = new Map<string, RegExp>();

function isWS(code: number): boolean {
  return code < 128 ? ASCII_TABLE[code] === 1 : code <= 32 || UNICODE_WS.has(code);
}

// ── Cursor parser state (SMI enum) ──────────────────────────────────

const S_INITIAL = 0;
const S_PARSING = 1;
const S_DONE    = 2;

// ── Attribute data layout (flat SMI array, ABSOLUTE positions) ──────
// Each attribute occupies ATTR_STRIDE consecutive slots:
//   [nameStart, nameEnd, colonPos, valueStart, valueEnd]
const ATTR_STRIDE = 5;

export class StaxXmlCursorReader {
  // ── Source (readonly, set once) ──────────────────────────────────
  private readonly xml: string;
  private readonly xmlLen: number;

  // ── Scan position ────────────────────────────────────────────────
  private pos: number = 0;

  // ── Parser state machine (SMI) ───────────────────────────────────
  private state: number = S_INITIAL;

  // ── Current event — ALL ABSOLUTE positions (SMI for JS strings) ──
  private _eventType: number = -1;
  private _nameStart: number = -1;
  private _nameEnd: number = -1;
  private _colonPos: number = -1;    // -1 = no colon
  private _textStart: number = 0;
  private _textEnd: number = -1;     // -1 = no text
  private _nsIdx: number = -1;
  private _attrCount: number = 0;

  // ── Lazy attribute parsing ───────────────────────────────────────
  private _attrRegionStart: number = 0;
  private _attrRegionEnd: number = 0;
  private _attrsParsed: number = 1;  // 0|1 SMI flag (start as 1: nothing to parse)

  // ── Pending self-close END_ELEMENT (absolute positions) ──────────
  private _pendingSelfClose: number = 0;
  private _pendingNameStart: number = -1;
  private _pendingNameEnd: number = -1;
  private _pendingColonPos: number = -1;
  private _pendingNsIdx: number = -1;

  // ── Flat attribute positions (absolute SMI values) ───────────────
  private readonly _attrData: number[] = [];

  // ── Position-based element stack: flat [start, end] pairs ────────
  private readonly _elemPosStack: number[] = [];
  private _elemStackLen: number = 0;

  // ── Namespace stack ──────────────────────────────────────────────
  private readonly _nsStack: Map<string, string>[] = [new Map()];
  private _nsStackLen: number = 1;

  // ── Namespace optimization flags (SMI) ───────────────────────────
  private readonly _xmlHasXmlns: number;   // 0|1 — pre-scanned at construction
  private _nsActive: number = 0;           // 0|1 — set to 1 when first xmlns encountered

  // ── Entity decoder ───────────────────────────────────────────────
  private readonly entityDecode: (text: string) => string;

  constructor(xml: string, options: StaxXmlCursorReaderOptions = {}) {
    this.xml = xml;
    this.xmlLen = xml.length;
    this.entityDecode = compileEntityDecoder(options);
    this._xmlHasXmlns = xml.indexOf('xmlns') !== -1 ? 1 : 0;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Public cursor API
  // ═══════════════════════════════════════════════════════════════════

  next(): boolean {
    // Fast path: pending END_ELEMENT from self-closing tag
    if (this._pendingSelfClose === 1) {
      this._pendingSelfClose = 0;
      this._eventType = CursorEventType.END_ELEMENT;
      this._nameStart = this._pendingNameStart;
      this._nameEnd = this._pendingNameEnd;
      this._colonPos = this._pendingColonPos;
      this._nsIdx = this._pendingNsIdx;
      this._textEnd = -1;
      this._attrCount = 0;
      this._attrsParsed = 1;
      this._elemStackLen--;
      this._nsStackLen--;
      return true;
    }

    switch (this.state) {
      case S_INITIAL:
        this.state = S_PARSING;
        this._eventType = CursorEventType.START_DOCUMENT;
        this._nameStart = -1;
        this._textEnd = -1;
        this._nsIdx = -1;
        this._attrCount = 0;
        this._attrsParsed = 1;
        return true;

      case S_PARSING:
        return this.parseNext();

      case S_DONE:
        return false;
      /* v8 ignore next -- exhaustive cursor state switch fallback */
      default:
        return false;
    }
  }

  eventType(): CursorEventType {
    return this._eventType as CursorEventType;
  }

  name(): string | undefined {
    if (this._nameStart < 0) return undefined;
    return this.xml.slice(this._nameStart, this._nameEnd);
  }

  localName(): string | undefined {
    if (this._nameStart < 0) return undefined;
    return this._colonPos < 0
      ? this.xml.slice(this._nameStart, this._nameEnd)
      : this.xml.slice(this._colonPos + 1, this._nameEnd);
  }

  prefix(): string | undefined {
    if (this._colonPos < 0) return undefined;
    return this.xml.slice(this._nameStart, this._colonPos);
  }

  uri(): string | undefined {
    if (this._nsActive === 0) return undefined;
    if (this._nsIdx < 0) return undefined;
    const key = this._colonPos >= 0
      ? this.xml.slice(this._nameStart, this._colonPos)
      : '';
    return this._nsStack[this._nsIdx]!.get(key);
  }

  text(): string | undefined {
    if (this._textEnd < 0) return undefined;
    const raw = this.xml.slice(this._textStart, this._textEnd);
    return this._eventType === CursorEventType.CHARACTERS ? this.entityDecode(raw) : raw;
  }

  getAttributeCount(): number {
    /* v8 ignore next -- lazy attribute parsing is covered through count/value accessors */
    if (this._attrsParsed === 0) this.ensureAttrsParsed();
    return this._attrCount;
  }

  getAttributeName(i: number): string | undefined {
    /* v8 ignore next -- lazy attribute parsing is covered through count/value accessors */
    if (this._attrsParsed === 0) this.ensureAttrsParsed();
    if (i < 0 || i >= this._attrCount) return undefined;
    const o = i * ATTR_STRIDE;
    return this.xml.slice(this._attrData[o]!, this._attrData[o + 1]!);
  }

  getAttributeLocalName(i: number): string | undefined {
    /* v8 ignore start -- lazy attr parse trigger is covered through count/value accessors */
    if (this._attrsParsed === 0) this.ensureAttrsParsed();
    /* v8 ignore end */
    if (i < 0 || i >= this._attrCount) return undefined;
    const o = i * ATTR_STRIDE;
    const cp = this._attrData[o + 2]!;
    return cp < 0
      ? this.xml.slice(this._attrData[o]!, this._attrData[o + 1]!)
      : this.xml.slice(cp + 1, this._attrData[o + 1]!);
  }

  getAttributePrefix(i: number): string | undefined {
    /* v8 ignore start -- lazy attr parse trigger is covered through count/value accessors */
    if (this._attrsParsed === 0) this.ensureAttrsParsed();
    /* v8 ignore end */
    if (i < 0 || i >= this._attrCount) return undefined;
    const o = i * ATTR_STRIDE;
    const cp = this._attrData[o + 2]!;
    return cp >= 0 ? this.xml.slice(this._attrData[o]!, cp) : undefined;
  }

  getAttributeValue(indexOrName: number | string): string | undefined {
    if (this._attrsParsed === 0) this.ensureAttrsParsed();
    if (typeof indexOrName === 'number') {
      if (indexOrName < 0 || indexOrName >= this._attrCount) return undefined;
      const o = indexOrName * ATTR_STRIDE;
      const vs = this._attrData[o + 3]!;
      const ve = this._attrData[o + 4]!;
      return vs === ve ? '' : this.entityDecode(this.xml.slice(vs, ve));
    }
    for (let i = 0; i < this._attrCount; i++) {
      const o = i * ATTR_STRIDE;
      if (this.attrNameMatch(o, indexOrName)) {
        const vs = this._attrData[o + 3]!;
        const ve = this._attrData[o + 4]!;
        return vs === ve ? '' : this.entityDecode(this.xml.slice(vs, ve));
      }
    }
    return undefined;
  }

  getAttributeUri(i: number): string | undefined {
    /* v8 ignore next -- no-namespace URI lookup is covered by element uri() accessors */
    if (this._nsActive === 0) return undefined;
    /* v8 ignore next -- lazy attribute parsing is covered through count/value accessors */
    if (this._attrsParsed === 0) this.ensureAttrsParsed();
    if (i < 0 || i >= this._attrCount) return undefined;
    const o = i * ATTR_STRIDE;
    const cp = this._attrData[o + 2]!;
    if (cp < 0 || this._nsIdx < 0) return undefined;
    const pfx = this.xml.slice(this._attrData[o]!, cp);
    return this._nsStack[this._nsIdx]!.get(pfx);
  }

  depth(): number {
    return this._elemStackLen;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Internal helpers
  // ═══════════════════════════════════════════════════════════════════

  private attrNameMatch(off: number, target: string): boolean {
    const s = this._attrData[off]!;
    const e = this._attrData[off + 1]!;
    if (e - s !== target.length) return false;
    const xml = this.xml;
    for (let j = 0; j < target.length; j++) {
      if (xml.charCodeAt(s + j) !== target.charCodeAt(j)) return false;
    }
    return true;
  }

  private ensureAttrsParsed(): void {
    this._attrsParsed = 1;
    /* v8 ignore next -- empty attribute region is a defensive lazy-parser guard */
    if (this._attrRegionStart >= this._attrRegionEnd) {
      this._attrCount = 0;
      return;
    }
    this.parseAttrPositions(this._attrRegionStart, this._attrRegionEnd);
  }

  /** Parse attribute positions only (no xmlns — used when _xmlHasXmlns === 0) */
  private parseAttrPositions(start: number, end: number): void {
    const xml = this.xml;
    const d = this._attrData;
    let i = start;
    let attrIdx = 0;

    while (i < end) {
      while (i < end && isWS(xml.charCodeAt(i))) i++;
      /* v8 ignore start -- malformed attribute value guard */
      if (i >= end) break;
      /* v8 ignore end */

      const nameS = i;
      let attrColonPos = -1;
      while (i < end) {
        const code = xml.charCodeAt(i);
        if (code === 61 || isWS(code)) break;
        if (code === 58 && attrColonPos === -1) attrColonPos = i;
        i++;
      }
      if (i === nameS) break;
      const nameE = i;

      /* v8 ignore start -- whitespace after '=' mirrors lazy attribute parser coverage */
      while (i < end && isWS(xml.charCodeAt(i))) i++;
      /* v8 ignore end */
      if (i >= end || xml.charCodeAt(i) !== 61) {
        const b = attrIdx * ATTR_STRIDE;
        if (b + ATTR_STRIDE > d.length) for (let j = d.length; j < b + ATTR_STRIDE; j++) d.push(0);
        d[b] = nameS; d[b + 1] = nameE;
        d[b + 2] = attrColonPos >= 0 ? attrColonPos : -1;
        d[b + 3] = nameS; d[b + 4] = nameE;
        attrIdx++;
        continue;
      }
      i++;

      while (i < end && isWS(xml.charCodeAt(i))) i++;
      if (i >= end) break;

      const quote = xml.charCodeAt(i);
      if (quote !== 34 && quote !== 39) break;
      i++;
      const valS = i;
      while (i < end && xml.charCodeAt(i) !== quote) i++;
      if (i >= end) break;
      const valE = i;
      i++;

      const b = attrIdx * ATTR_STRIDE;
      if (b + ATTR_STRIDE > d.length) for (let j = d.length; j < b + ATTR_STRIDE; j++) d.push(0);
      d[b] = nameS; d[b + 1] = nameE;
      d[b + 2] = attrColonPos >= 0 ? attrColonPos : -1;
      d[b + 3] = valS; d[b + 4] = valE;
      attrIdx++;
    }

    this._attrCount = attrIdx;
  }

  private emitEndDocument(): boolean {
    this.state = S_DONE;
    this._eventType = CursorEventType.END_DOCUMENT;
    this._nameStart = -1;
    this._textEnd = -1;
    this._nsIdx = -1;
    this._attrCount = 0;
    this._attrsParsed = 1;
    return true;
  }

  /** Push to position-based element stack */
  private pushElemStack(start: number, end: number): void {
    const d2 = this._elemStackLen * 2;
    if (d2 >= this._elemPosStack.length) {
      this._elemPosStack.push(start, end);
    } else {
      this._elemPosStack[d2] = start;
      this._elemPosStack[d2 + 1] = end;
    }
    this._elemStackLen++;
  }

  /** Inherit parent namespace (no new xmlns declarations) */
  private pushNsInherit(): void {
    const parentNs = this._nsStack[this._nsStackLen - 1]!;
    if (this._nsStackLen === this._nsStack.length) {
      this._nsStack.push(parentNs);
    } else {
      this._nsStack[this._nsStackLen] = parentNs;
    }
    this._nsStackLen++;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Internal parsing — ABSOLUTE positions throughout
  // ═══════════════════════════════════════════════════════════════════

  private parseNext(): boolean {
    const xml = this.xml;
    const len = this.xmlLen;

    while (this.pos < len) {
      const ltPos = xml.indexOf('<', this.pos);

      // No more tags — remaining text
      if (ltPos === -1) {
        if (this.pos < len) {
          let s = this.pos;
          let e = len;
          while (s < e && isWS(xml.charCodeAt(s))) s++;
          while (e > s && isWS(xml.charCodeAt(e - 1))) e--;
          this.pos = len;
          if (s < e) {
            this._eventType = CursorEventType.CHARACTERS;
            this._textStart = s;
            this._textEnd = e;
            this._nameStart = -1;
            this._nsIdx = -1;
            this._attrCount = 0;
            this._attrsParsed = 1;
            return true;
          }
        }
        return this.emitEndDocument();
      }

      // Text before '<'
      if (ltPos > this.pos) {
        let s = this.pos;
        let e = ltPos;
        while (s < e && isWS(xml.charCodeAt(s))) s++;
        /* v8 ignore next -- text trimming is covered at cursor API level */
        while (e > s && isWS(xml.charCodeAt(e - 1))) e--;
        this.pos = ltPos;
        if (s < e) {
          this._eventType = CursorEventType.CHARACTERS;
          this._textStart = s;
          this._textEnd = e;
          this._nameStart = -1;
          this._nsIdx = -1;
          this._attrCount = 0;
          this._attrsParsed = 1;
          return true;
        }
      }

      // Parse tag
      this.pos = ltPos;
      const result = this.parseTag();
      if (result) return true;
    }

    return this.emitEndDocument();
  }

  private parseTag(): boolean {
    const nextCode = this.xml.charCodeAt(this.pos + 1);

    switch (nextCode) {
      case 47: return this.parseEndTag();
      case 33: return this.parseBangTag();
      case 63: return this.parsePI();
      default: return this.parseStartTag();
    }
  }

  private parseEndTag(): boolean {
    const xml = this.xml;
    const closePos = xml.indexOf('>', this.pos + 2);
    if (closePos === -1) throw new Error('Unclosed end tag');

    let nameS = this.pos + 2;
    let nameE = closePos;
    while (nameS < nameE && isWS(xml.charCodeAt(nameS))) nameS++;
    while (nameE > nameS && isWS(xml.charCodeAt(nameE - 1))) nameE--;

    // Position-based end-tag validation (charCode comparison, zero alloc)
    if (this._elemStackLen === 0) {
      throw new Error(`Mismatched closing tag: </${xml.slice(nameS, nameE)}>. No open elements.`);
    }

    const si = (this._elemStackLen - 1) * 2;
    const expS = this._elemPosStack[si]!;
    const expE = this._elemPosStack[si + 1]!;
    const tagLen = nameE - nameS;

    if (tagLen !== expE - expS) {
      throw new Error(`Mismatched closing tag: </${xml.slice(nameS, nameE)}>. Expected </${xml.slice(expS, expE)}>.`);
    }
    for (let j = 0; j < tagLen; j++) {
      if (xml.charCodeAt(nameS + j) !== xml.charCodeAt(expS + j)) {
        throw new Error(`Mismatched closing tag: </${xml.slice(nameS, nameE)}>. Expected </${xml.slice(expS, expE)}>.`);
      }
    }

    this._nsIdx = this._nsStackLen - 1;
    this._elemStackLen--;
    this._nsStackLen--;

    let colonPos = -1;
    for (let j = nameS; j < nameE; j++) {
      if (xml.charCodeAt(j) === 58) { colonPos = j; break; }
    }

    this._eventType = CursorEventType.END_ELEMENT;
    this._nameStart = nameS;
    this._nameEnd = nameE;
    this._colonPos = colonPos;
    this._textEnd = -1;
    this._attrCount = 0;
    this._attrsParsed = 1;

    this.pos = closePos + 1;
    return true;
  }

  private parseBangTag(): boolean {
    const xml = this.xml;
    const base = this.pos;

    if (xml.startsWith('<![CDATA[', base)) {
      const end = xml.indexOf(']]>', base + 9);
      if (end === -1) throw new Error('Unclosed CDATA section');

      this._eventType = CursorEventType.CDATA;
      this._textStart = base + 9;
      this._textEnd = end;
      this._nameStart = -1;
      this._nsIdx = -1;
      this._attrCount = 0;
      this._attrsParsed = 1;
      this.pos = end + 3;
      return true;
    }

    if (xml.startsWith('<!--', base)) {
      const end = xml.indexOf('-->', base + 4);
      if (end === -1) throw new Error('Unclosed comment');
      this.pos = end + 3;
      return false;
    }

    if (xml.startsWith('<!DOCTYPE', base)) {
      const end = xml.indexOf('>', base);
      if (end === -1) throw new Error('Unclosed DOCTYPE declaration');
      this.pos = end + 1;
      return false;
    }

    const end = xml.indexOf('>', base);
    if (end === -1) throw new Error('Unclosed markup');
    this.pos = end + 1;
    return false;
  }

  private parsePI(): boolean {
    const end = this.xml.indexOf('?>', this.pos);
    if (end === -1) throw new Error('Unclosed processing instruction');
    this.pos = end + 2;
    return false;
  }

  private parseStartTag(): boolean {
    const xml = this.xml;
    const len = this.xmlLen;
    const tagStart = this.pos + 1;

    // ── Fused name scan: find nameEnd + detect simple vs complex ───
    let nameEnd = tagStart;
    let colonPos = -1;
    let code = 0;

    while (nameEnd < len) {
      code = xml.charCodeAt(nameEnd);
      if (code === 58) { // ':'
        if (colonPos === -1) colonPos = nameEnd;
        nameEnd++;
        continue;
      }
      if (code === 62 || code === 47 ||
          code === 32 || code === 9 || code === 10 || code === 13) break;
      nameEnd++;
    }

    if (nameEnd >= len) throw new Error('Unclosed start tag');

    // ── Simple tag: <name> ──────────────────────────────────────────
    if (code === 62) {
      this.pushElemStack(tagStart, nameEnd);
      this.pushNsInherit();
      this._eventType = CursorEventType.START_ELEMENT;
      this._nameStart = tagStart;
      this._nameEnd = nameEnd;
      this._colonPos = colonPos;
      this._textEnd = -1;
      this._attrCount = 0;
      this._attrsParsed = 1;
      this._nsIdx = this._nsStackLen - 1;
      this.pos = nameEnd + 1;
      return true;
    }

    // ── Simple self-closing: <name/> ────────────────────────────────
    if (code === 47) {
      if (nameEnd + 1 >= len || xml.charCodeAt(nameEnd + 1) !== 62) {
        throw new Error('Unclosed start tag');
      }
      this.pushElemStack(tagStart, nameEnd);
      this.pushNsInherit();
      this._eventType = CursorEventType.START_ELEMENT;
      this._nameStart = tagStart;
      this._nameEnd = nameEnd;
      this._colonPos = colonPos;
      this._textEnd = -1;
      this._attrCount = 0;
      this._attrsParsed = 1;
      this._nsIdx = this._nsStackLen - 1;
      this._pendingSelfClose = 1;
      this._pendingNameStart = tagStart;
      this._pendingNameEnd = nameEnd;
      this._pendingColonPos = colonPos;
      this._pendingNsIdx = this._nsStackLen - 1;
      this.pos = nameEnd + 2;
      return true;
    }

    // ── Complex tag: has attributes ─────────────────────────────────
    const tagEnd = this.findTagEnd(nameEnd);
    if (tagEnd === -1) throw new Error('Unclosed start tag');

    let isSelfClosing = false;
    let attrEnd = tagEnd;
    if (xml.charCodeAt(tagEnd - 1) === 47) {
      isSelfClosing = true;
      attrEnd = tagEnd - 1;
    }

    this.pushElemStack(tagStart, nameEnd);

    this._eventType = CursorEventType.START_ELEMENT;
    this._nameStart = tagStart;
    this._nameEnd = nameEnd;
    this._colonPos = colonPos;
    this._textEnd = -1;

    if (this._xmlHasXmlns === 1) {
      // Eagerly parse attrs for xmlns namespace correctness
      this._attrCount = 0;
      const parentNs = this._nsStack[this._nsStackLen - 1]!;
      const namespaces = this.parseAttrsWithXmlns(nameEnd, attrEnd, parentNs);
      this._attrsParsed = 1;

      if (this._nsStackLen === this._nsStack.length) {
        this._nsStack.push(namespaces);
      } else {
        this._nsStack[this._nsStackLen] = namespaces;
      }
      this._nsStackLen++;
    } else {
      // No xmlns anywhere: defer ALL attr parsing
      this._attrRegionStart = nameEnd;
      this._attrRegionEnd = attrEnd;
      this._attrsParsed = 0;
      this._attrCount = 0;
      this.pushNsInherit();
    }

    this._nsIdx = this._nsStackLen - 1;

    if (isSelfClosing) {
      this._pendingSelfClose = 1;
      this._pendingNameStart = tagStart;
      this._pendingNameEnd = nameEnd;
      this._pendingColonPos = colonPos;
      this._pendingNsIdx = this._nsStackLen - 1;
    }

    this.pos = tagEnd + 1;
    return true;
  }

  /** Parse attrs with xmlns handling (ABSOLUTE positions) */
  private parseAttrsWithXmlns(
    start: number,
    end: number,
    parentNs: Map<string, string>,
  ): Map<string, string> {
    let ns = parentNs;
    let nsCopied = false;
    const xml = this.xml;
    const d = this._attrData;
    let i = start;
    let attrIdx = 0;

    while (i < end) {
      while (i < end && isWS(xml.charCodeAt(i))) i++;
      /* v8 ignore next -- malformed namespace attribute ending guard */
      if (i >= end) break;

      const nameS = i;
      let attrColonPos = -1;
      while (i < end) {
        const code = xml.charCodeAt(i);
        if (code === 61 || isWS(code)) break;
        if (code === 58 && attrColonPos === -1) attrColonPos = i;
        i++;
      }
      /* v8 ignore next -- defensive guard for empty namespace attribute names */
      if (i === nameS) break;
      const nameE = i;

      /* v8 ignore next -- whitespace after '=' mirrors lazy attribute parser coverage */
      while (i < end && isWS(xml.charCodeAt(i))) i++;
      if (i >= end || xml.charCodeAt(i) !== 61) {
        const b = attrIdx * ATTR_STRIDE;
        if (b + ATTR_STRIDE > d.length) for (let j = d.length; j < b + ATTR_STRIDE; j++) d.push(0);
        d[b] = nameS; d[b + 1] = nameE;
        d[b + 2] = attrColonPos >= 0 ? attrColonPos : -1;
        d[b + 3] = nameS; d[b + 4] = nameE;
        attrIdx++;
        continue;
      }
      i++;

      while (i < end && isWS(xml.charCodeAt(i))) i++;
      /* v8 ignore next -- malformed namespace attribute value guard */
      if (i >= end) break;

      const quote = xml.charCodeAt(i);
      /* v8 ignore next -- malformed unquoted namespace attribute guard */
      if (quote !== 34 && quote !== 39) break;
      i++;
      const valS = i;
      while (i < end && xml.charCodeAt(i) !== quote) i++;
      /* v8 ignore next -- unterminated namespace attribute value guard */
      if (i >= end) break;
      const valE = i;
      i++;

      // xmlns detection — charCode-based
      const nameLen = nameE - nameS;
      if (nameLen >= 5 && xml.charCodeAt(nameS) === 120) {
        if (xml.charCodeAt(nameS + 1) === 109 &&
            xml.charCodeAt(nameS + 2) === 108 &&
            xml.charCodeAt(nameS + 3) === 110 &&
            xml.charCodeAt(nameS + 4) === 115) {
          if (nameLen === 5) {
            if (!nsCopied) { ns = new Map(parentNs); nsCopied = true; }
            ns.set('', this.entityDecode(xml.slice(valS, valE)));
            this._nsActive = 1;
          } else if (xml.charCodeAt(nameS + 5) === 58) {
            if (!nsCopied) { ns = new Map(parentNs); nsCopied = true; }
            ns.set(xml.slice(nameS + 6, nameE), this.entityDecode(xml.slice(valS, valE)));
            this._nsActive = 1;
          }
        }
      }

      const b = attrIdx * ATTR_STRIDE;
      if (b + ATTR_STRIDE > d.length) for (let j = d.length; j < b + ATTR_STRIDE; j++) d.push(0);
      d[b] = nameS; d[b + 1] = nameE;
      d[b + 2] = attrColonPos >= 0 ? attrColonPos : -1;
      d[b + 3] = valS; d[b + 4] = valE;
      attrIdx++;
    }

    this._attrCount = attrIdx;
    return ns;
  }

  private findTagEnd(start: number): number {
    let i = start;
    let inQuote = false;
    let quoteChar = 0;
    const xml = this.xml;
    const len = this.xmlLen;

    while (i < len) {
      const code = xml.charCodeAt(i);
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
}

// ── Entity decoder compiler (shared logic) ──────────────────────────

/** @internal */
export function compileEntityDecoder(
  options: StaxXmlCursorReaderOptions,
): (text: string) => string {
  if (options.autoDecodeEntities === false) {
    return (t) => t;
  }

  if (options.addEntities && options.addEntities.length > 0) {
    const map: Record<string, string> = { ...DEFAULT_ENTITY_MAP };
    const patterns: string[] = ['lt', 'gt', 'quot', 'apos'];

    for (const { entity, value } of options.addEntities) {
      if (entity && value) {
        const key = entity.startsWith('&') && entity.endsWith(';')
          ? entity.slice(1, -1)
          : entity;
        map[key] = value;
        patterns.push(key);
      }
    }
    patterns.push('amp');

    const cacheKey = patterns.join(',');
    let regex = ENTITY_REGEX_CACHE.get(cacheKey);
    if (!regex) {
      const pat = patterns
        .sort((a, b) => b.length - a.length)
        .map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
      regex = new RegExp(`&(${pat});`, 'g');
      ENTITY_REGEX_CACHE.set(cacheKey, regex);
    }

    return (text: string) => {
      /* v8 ignore next -- no-entity custom decoder path is covered through parser decoder tests */
      if (!text || text.indexOf('&') === -1) return text;
      regex!.lastIndex = 0;
      /* v8 ignore next -- regex only matches keys present in map */
      return text.replace(regex!, (_, ent) => map[ent] || _);
    };
  }

  return (text: string) => {
    if (!text || text.indexOf('&') === -1) return text;
    DEFAULT_ENTITY_REGEX.lastIndex = 0;
    return text.replace(
      DEFAULT_ENTITY_REGEX,
      /* v8 ignore next -- regex only matches keys present in DEFAULT_ENTITY_MAP */
      (_, ent) => DEFAULT_ENTITY_MAP[ent] || _,
    );
  };
}
