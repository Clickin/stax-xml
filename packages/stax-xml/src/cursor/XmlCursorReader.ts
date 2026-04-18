/**
 * XmlCursorReader — All-SMI high-performance sync cursor-based XML reader.
 *
 * Every mutable event field on the cursor is a V8 SMI (Small Integer).
 * Position fields (_nameStart, _nameEnd, etc.) are **relative offsets** from
 * `_base`, the anchor position for the current event.  `_base` itself is a
 * plain `number` that V8 may store as a Double/MutableHeapNumber for very
 * large inputs — after an initial Smi→Double transition, updates are in-place
 * with zero write barriers.  The relative offsets are bounded by the size of
 * a single XML element (always tiny) so they never leave SMI range.
 *
 * Strings are materialised on-demand in accessor methods via
 * `xml.slice(_base + offset, _base + offset)`, producing short-lived
 * young-generation objects that the Scavenger collects for free.
 *
 * Attribute data is kept in a flat `number[]` (all SMI elements) with a fixed
 * stride, so attribute writes also bypass write barriers entirely.
 *
 * @public
 */

import { CursorEventType, type XmlCursorReaderOptions } from './types.js';

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

// ── Attribute data layout (flat SMI array, offsets relative to _base) ─
// Each attribute occupies ATTR_STRIDE consecutive SMI slots:
//   [nameStart, nameEnd, colonPos, valueStart, valueEnd]
const ATTR_STRIDE = 5;

export class XmlCursorReader {
  // ── Source (readonly, set once — no repeated write barrier) ───────
  private readonly xml: string;
  private readonly xmlLen: number;

  // ── Scan position (can grow beyond SMI for huge inputs) ──────────
  private pos: number = 0;

  // ── Parser state machine (SMI) ───────────────────────────────────
  private state: number = S_INITIAL;

  // ── Current event anchor + relative SMI offsets ──────────────────
  //
  // _base: anchor position for the current event (== this.pos at parse
  //   start).  Plain number — V8 promotes to MutableHeapNumber once it
  //   exceeds SMI range; subsequent updates are in-place (no barrier).
  //
  // All other position fields are *relative to _base* and bounded by
  // a single element's size, so they always fit in SMI.
  private _base: number = 0;
  private _eventType: number = -1;
  private _nameStart: number = -1;   // relative to _base
  private _nameEnd: number = -1;     // relative to _base
  private _colonPos: number = -1;    // relative to _base (-1 = no colon)
  private _textStart: number = 0;    // relative to _base
  private _textEnd: number = -1;     // relative to _base (-1 = no text)
  private _nsIdx: number = -1;       // index into _nsStack
  private _attrCount: number = 0;

  // ── Pending self-close END_ELEMENT (ALL SMI + base) ──────────────
  private _pendingSelfClose: number = 0;
  private _pendingBase: number = 0;
  private _pendingNameStart: number = -1;
  private _pendingNameEnd: number = -1;
  private _pendingColonPos: number = -1;
  private _pendingNsIdx: number = -1;

  // ── Flat attribute offsets (SMI array, relative to _base) ────────
  private readonly _attrData: number[] = [];

  // ── Element stack (string[] — same as parser, equal cost) ────────
  private readonly _elemStack: string[] = [];
  private _elemStackLen: number = 0;

  // ── Namespace stack (lazy-copy on xmlns) ─────────────────────────
  private readonly _nsStack: Map<string, string>[] = [new Map()];
  private _nsStackLen: number = 1;

  // ── Entity decoder ───────────────────────────────────────────────
  private readonly entityDecode: (text: string) => string;

  constructor(xml: string, options: XmlCursorReaderOptions = {}) {
    this.xml = xml;
    this.xmlLen = xml.length;
    this.entityDecode = compileEntityDecoder(options);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Public cursor API
  // ═══════════════════════════════════════════════════════════════════

  next(): boolean {
    // Fast path: pending END_ELEMENT from self-closing tag
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
        this.state = S_PARSING;
        this._eventType = CursorEventType.START_DOCUMENT;
        this._nameStart = -1;
        this._textEnd = -1;
        this._nsIdx = -1;
        this._attrCount = 0;
        return true;

      case S_PARSING:
        return this.parseNext();

      case S_DONE:
        return false;
    }
    return false;
  }

  eventType(): CursorEventType {
    return this._eventType as CursorEventType;
  }

  name(): string | undefined {
    if (this._nameStart < 0) return undefined;
    const b = this._base;
    return this.xml.slice(b + this._nameStart, b + this._nameEnd);
  }

  localName(): string | undefined {
    if (this._nameStart < 0) return undefined;
    const b = this._base;
    return this._colonPos < 0
      ? this.xml.slice(b + this._nameStart, b + this._nameEnd)
      : this.xml.slice(b + this._colonPos + 1, b + this._nameEnd);
  }

  prefix(): string | undefined {
    if (this._colonPos < 0) return undefined;
    const b = this._base;
    return this.xml.slice(b + this._nameStart, b + this._colonPos);
  }

  uri(): string | undefined {
    if (this._nsIdx < 0) return undefined;
    const b = this._base;
    const key = this._colonPos >= 0 ? this.xml.slice(b + this._nameStart, b + this._colonPos) : '';
    return this._nsStack[this._nsIdx]!.get(key);
  }

  text(): string | undefined {
    if (this._textEnd < 0) return undefined;
    const b = this._base;
    const raw = this.xml.slice(b + this._textStart, b + this._textEnd);
    return this._eventType === CursorEventType.CHARACTERS ? this.entityDecode(raw) : raw;
  }

  getAttributeCount(): number {
    return this._attrCount;
  }

  getAttributeName(i: number): string | undefined {
    if (i < 0 || i >= this._attrCount) return undefined;
    const o = i * ATTR_STRIDE;
    const b = this._base;
    return this.xml.slice(b + this._attrData[o]!, b + this._attrData[o + 1]!);
  }

  getAttributeLocalName(i: number): string | undefined {
    if (i < 0 || i >= this._attrCount) return undefined;
    const o = i * ATTR_STRIDE;
    const b = this._base;
    const cp = this._attrData[o + 2]!;
    return cp < 0
      ? this.xml.slice(b + this._attrData[o]!, b + this._attrData[o + 1]!)
      : this.xml.slice(b + cp + 1, b + this._attrData[o + 1]!);
  }

  getAttributePrefix(i: number): string | undefined {
    if (i < 0 || i >= this._attrCount) return undefined;
    const o = i * ATTR_STRIDE;
    const b = this._base;
    const cp = this._attrData[o + 2]!;
    return cp >= 0 ? this.xml.slice(b + this._attrData[o]!, b + cp) : undefined;
  }

  getAttributeValue(indexOrName: number | string): string | undefined {
    const b = this._base;
    if (typeof indexOrName === 'number') {
      if (indexOrName < 0 || indexOrName >= this._attrCount) return undefined;
      const o = indexOrName * ATTR_STRIDE;
      const vs = this._attrData[o + 3]!;
      const ve = this._attrData[o + 4]!;
      return vs === ve ? '' : this.entityDecode(this.xml.slice(b + vs, b + ve));
    }
    for (let i = 0; i < this._attrCount; i++) {
      const o = i * ATTR_STRIDE;
      if (this.attrNameMatch(o, indexOrName)) {
        const vs = this._attrData[o + 3]!;
        const ve = this._attrData[o + 4]!;
        return vs === ve ? '' : this.entityDecode(this.xml.slice(b + vs, b + ve));
      }
    }
    return undefined;
  }

  getAttributeUri(i: number): string | undefined {
    if (i < 0 || i >= this._attrCount) return undefined;
    const o = i * ATTR_STRIDE;
    const cp = this._attrData[o + 2]!;
    if (cp < 0 || this._nsIdx < 0) return undefined;
    const b = this._base;
    const pfx = this.xml.slice(b + this._attrData[o]!, b + cp);
    return this._nsStack[this._nsIdx]!.get(pfx);
  }

  depth(): number {
    return this._elemStackLen;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Internal helpers
  // ═══════════════════════════════════════════════════════════════════

  private attrNameMatch(off: number, target: string): boolean {
    const b = this._base;
    const s = b + this._attrData[off]!;
    const e = b + this._attrData[off + 1]!;
    if (e - s !== target.length) return false;
    const xml = this.xml;
    for (let j = 0; j < target.length; j++) {
      if (xml.charCodeAt(s + j) !== target.charCodeAt(j)) return false;
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

  // ═══════════════════════════════════════════════════════════════════
  // Internal parsing — uses absolute positions, stores relative offsets
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
            this._base = s;
            this._textStart = 0;
            this._textEnd = e - s;
            this._nameStart = -1;
            this._nsIdx = -1;
            this._attrCount = 0;
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
        while (e > s && isWS(xml.charCodeAt(e - 1))) e--;
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
    const base = this.pos;
    const closePos = xml.indexOf('>', base + 2);
    if (closePos === -1) throw new Error('Unclosed end tag');

    let nameS = base + 2;
    let nameE = closePos;
    while (nameS < nameE && isWS(xml.charCodeAt(nameS))) nameS++;
    while (nameE > nameS && isWS(xml.charCodeAt(nameE - 1))) nameE--;

    const fullTagName = xml.slice(nameS, nameE);

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
      if (xml.charCodeAt(j) === 58) { colonPos = j - base; break; }
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

  private parseBangTag(): boolean {
    const xml = this.xml;
    const base = this.pos;

    if (xml.startsWith('<![CDATA[', base)) {
      const end = xml.indexOf(']]>', base + 9);
      if (end === -1) throw new Error('Unclosed CDATA section');

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
    const base = this.pos;
    const tagStart = base + 1;
    const tagEnd = this.findTagEnd(tagStart);
    if (tagEnd === -1) throw new Error('Unclosed start tag');

    let isSelfClosing = false;
    let actualEnd = tagEnd;
    if (xml.charCodeAt(tagEnd - 1) === 47) {
      isSelfClosing = true;
      actualEnd = tagEnd - 1;
    }

    let nameEnd = tagStart;
    let colonPos = -1;
    while (nameEnd < actualEnd) {
      const code = xml.charCodeAt(nameEnd);
      if (code === 58 && colonPos === -1) colonPos = nameEnd;
      else if (code <= 32 && isWS(code)) break;
      else if (code === 62 || code === 47) break;
      nameEnd++;
    }

    const tagName = xml.slice(tagStart, nameEnd);
    const parentNs = this._nsStack[this._nsStackLen - 1]!;

    // Set base BEFORE parseAttrs (it reads this._base for relative storage)
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

  /**
   * Parse attribute positions into `_attrData` (flat SMI array).
   * All stored positions are relative to `this._base` (already set by caller).
   */
  private parseAttrs(
    start: number,
    end: number,
    parentNs: Map<string, string>,
  ): Map<string, string> {
    let ns = parentNs;
    let nsCopied = false;
    const xml = this.xml;
    const d = this._attrData;
    const base = this._base;
    let i = start;
    let attrIdx = 0;

    while (i < end) {
      while (i < end && isWS(xml.charCodeAt(i))) i++;
      if (i >= end) break;

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

      while (i < end && isWS(xml.charCodeAt(i))) i++;
      if (i >= end || xml.charCodeAt(i) !== 61) {
        const b = attrIdx * ATTR_STRIDE;
        if (b + ATTR_STRIDE > d.length) for (let j = d.length; j < b + ATTR_STRIDE; j++) d.push(0);
        d[b] = nameS - base; d[b + 1] = nameE - base;
        d[b + 2] = attrColonPos >= 0 ? attrColonPos - base : -1;
        d[b + 3] = nameS - base; d[b + 4] = nameE - base;
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

      // xmlns handling — charCode-based, absolute positions for xml access
      const nameLen = nameE - nameS;
      if (nameLen >= 5 && xml.charCodeAt(nameS) === 120) {
        if (xml.charCodeAt(nameS + 1) === 109 &&
            xml.charCodeAt(nameS + 2) === 108 &&
            xml.charCodeAt(nameS + 3) === 110 &&
            xml.charCodeAt(nameS + 4) === 115) {
          if (nameLen === 5) {
            if (!nsCopied) { ns = new Map(parentNs); nsCopied = true; }
            ns.set('', this.entityDecode(xml.slice(valS, valE)));
          } else if (xml.charCodeAt(nameS + 5) === 58) {
            if (!nsCopied) { ns = new Map(parentNs); nsCopied = true; }
            ns.set(xml.slice(nameS + 6, nameE), this.entityDecode(xml.slice(valS, valE)));
          }
        }
      }

      // Store as relative offsets (all SMI)
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
  options: XmlCursorReaderOptions,
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
      if (!text || text.indexOf('&') === -1) return text;
      regex!.lastIndex = 0;
      return text.replace(regex!, (_, ent) => map[ent] || _);
    };
  }

  return (text: string) => {
    if (!text || text.indexOf('&') === -1) return text;
    DEFAULT_ENTITY_REGEX.lastIndex = 0;
    return text.replace(
      DEFAULT_ENTITY_REGEX,
      (_, ent) => DEFAULT_ENTITY_MAP[ent] || _,
    );
  };
}
