/**
 * XmlCursorReader — High-performance sync cursor-based XML reader.
 *
 * Unlike the event parser which creates materialized event objects per element,
 * the cursor reader maintains a single mutable cursor position. Callers advance
 * the cursor with `next()` and read the current event state through accessor
 * methods. This eliminates per-event object allocation entirely.
 *
 * All mutable integer state uses SMI (Small Integer) values so V8 can store
 * them unboxed and skip write-barrier checks on updates.
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

// ── Attribute span (stored in flat arrays for cache locality) ───────

/** @internal */
interface AttrSpan {
  nameStart: number;
  nameEnd: number;
  colonPos: number;   // -1 when no prefix
  valueStart: number;
  valueEnd: number;
}

// ── Cursor parser state (SMI enum) ──────────────────────────────────

const S_INITIAL = 0;
const S_PARSING = 1;
const S_DONE    = 2;

export class XmlCursorReader {
  // ── Source ────────────────────────────────────────────────────────
  private readonly xml: string;
  private readonly xmlLen: number;

  // ── Position (SMI) ───────────────────────────────────────────────
  private pos: number = 0;

  // ── Parser state machine (SMI) ───────────────────────────────────
  private state: number = S_INITIAL;

  // ── Current event (SMI + string refs) ────────────────────────────
  private _eventType: number = -1;

  // element name spans (SMI)
  private _nameStart: number = 0;
  private _nameEnd: number = 0;
  private _colonPos: number = -1;

  // text / CDATA value span (SMI)
  private _valueStart: number = 0;
  private _valueEnd: number = 0;

  // self-closing pending END_ELEMENT (SMI flag)
  private _pendingSelfClose: number = 0;

  // ── Attribute spans (reused array) ───────────────────────────────
  private readonly _attrs: AttrSpan[] = [];
  private _attrCount: number = 0;

  // ── Element stack ────────────────────────────────────────────────
  private readonly _elemStack: string[] = [];
  private _elemStackLen: number = 0;

  // ── Namespace stack (lazy-copy on xmlns) ─────────────────────────
  private readonly _nsStack: Map<string, string>[] = [new Map()];
  private _nsStackLen: number = 1;

  // ── Entity decoder ───────────────────────────────────────────────
  private readonly entityDecode: (text: string) => string;

  // ── Materialized name cache (lazy) ───────────────────────────────
  private _cachedName: string | undefined = undefined;
  private _cachedLocalName: string | undefined = undefined;
  private _cachedPrefix: string | undefined = undefined;

  constructor(xml: string, options: XmlCursorReaderOptions = {}) {
    this.xml = xml;
    this.xmlLen = xml.length;
    this.entityDecode = compileEntityDecoder(options);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Public cursor API
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Advance the cursor to the next event.
   * @returns `true` if there is a current event, `false` when the document is exhausted.
   */
  next(): boolean {
    // Fast path: pending END_ELEMENT from self-closing tag
    if (this._pendingSelfClose === 1) {
      this._pendingSelfClose = 0;
      this._eventType = CursorEventType.END_ELEMENT;
      // _nameStart/_nameEnd/_colonPos are still valid from the START_ELEMENT
      this._attrCount = 0;
      // pop element stack
      this._elemStackLen--;
      this._nsStackLen--;
      return true;
    }

    // Clear name cache
    this._cachedName = undefined;
    this._cachedLocalName = undefined;
    this._cachedPrefix = undefined;

    switch (this.state) {
      case S_INITIAL:
        this.state = S_PARSING;
        this._eventType = CursorEventType.START_DOCUMENT;
        this._attrCount = 0;
        return true;

      case S_PARSING:
        return this.parseNext();

      case S_DONE:
        return false;
    }
    return false;
  }

  /** Current event type (CursorEventType numeric constant). */
  eventType(): CursorEventType {
    return this._eventType as CursorEventType;
  }

  /** Full qualified name of the current element (e.g. "ns:tag"). */
  name(): string | undefined {
    const et = this._eventType;
    if (et !== CursorEventType.START_ELEMENT && et !== CursorEventType.END_ELEMENT) return undefined;
    if (this._cachedName === undefined) {
      this._cachedName = this.xml.slice(this._nameStart, this._nameEnd);
    }
    return this._cachedName;
  }

  /** Local name portion (after colon, or full name if no prefix). */
  localName(): string | undefined {
    const et = this._eventType;
    if (et !== CursorEventType.START_ELEMENT && et !== CursorEventType.END_ELEMENT) return undefined;
    if (this._cachedLocalName === undefined) {
      this._cachedLocalName = this._colonPos === -1
        ? this.xml.slice(this._nameStart, this._nameEnd)
        : this.xml.slice(this._colonPos + 1, this._nameEnd);
    }
    return this._cachedLocalName;
  }

  /** Namespace prefix (undefined if none). */
  prefix(): string | undefined {
    const et = this._eventType;
    if (et !== CursorEventType.START_ELEMENT && et !== CursorEventType.END_ELEMENT) return undefined;
    if (this._cachedPrefix === undefined && this._colonPos !== -1) {
      this._cachedPrefix = this.xml.slice(this._nameStart, this._colonPos);
    }
    return this._colonPos === -1 ? undefined : this._cachedPrefix;
  }

  /** Namespace URI for the current element. */
  uri(): string | undefined {
    const et = this._eventType;
    if (et !== CursorEventType.START_ELEMENT && et !== CursorEventType.END_ELEMENT) return undefined;
    const ns = this._nsStack[this._nsStackLen - 1];
    if (this._colonPos === -1) {
      return ns?.get('');
    }
    const p = this.prefix()!;
    return ns?.get(p);
  }

  /** Text content for CHARACTERS or CDATA events. */
  text(): string | undefined {
    const et = this._eventType;
    if (et !== CursorEventType.CHARACTERS && et !== CursorEventType.CDATA) return undefined;
    const raw = this.xml.slice(this._valueStart, this._valueEnd);
    return et === CursorEventType.CHARACTERS ? this.entityDecode(raw) : raw;
  }

  /** Number of attributes on the current START_ELEMENT. */
  getAttributeCount(): number {
    return this._attrCount;
  }

  /** Attribute name at index `i`. */
  getAttributeName(i: number): string | undefined {
    if (i < 0 || i >= this._attrCount) return undefined;
    const span = this._attrs[i]!;
    return this.xml.slice(span.nameStart, span.nameEnd);
  }

  /** Attribute local name at index `i`. */
  getAttributeLocalName(i: number): string | undefined {
    if (i < 0 || i >= this._attrCount) return undefined;
    const span = this._attrs[i]!;
    return span.colonPos === -1
      ? this.xml.slice(span.nameStart, span.nameEnd)
      : this.xml.slice(span.colonPos + 1, span.nameEnd);
  }

  /** Attribute prefix at index `i`. */
  getAttributePrefix(i: number): string | undefined {
    if (i < 0 || i >= this._attrCount) return undefined;
    const span = this._attrs[i]!;
    return span.colonPos === -1 ? undefined : this.xml.slice(span.nameStart, span.colonPos);
  }

  /** Attribute value at index `i` or by name. */
  getAttributeValue(indexOrName: number | string): string | undefined {
    if (typeof indexOrName === 'number') {
      if (indexOrName < 0 || indexOrName >= this._attrCount) return undefined;
      const span = this._attrs[indexOrName]!;
      return this.entityDecode(this.xml.slice(span.valueStart, span.valueEnd));
    }
    // lookup by name
    for (let i = 0; i < this._attrCount; i++) {
      const span = this._attrs[i]!;
      if (this.xml.slice(span.nameStart, span.nameEnd) === indexOrName) {
        return this.entityDecode(this.xml.slice(span.valueStart, span.valueEnd));
      }
    }
    return undefined;
  }

  /** Attribute namespace URI at index `i`. */
  getAttributeUri(i: number): string | undefined {
    if (i < 0 || i >= this._attrCount) return undefined;
    const span = this._attrs[i]!;
    if (span.colonPos === -1) return undefined;
    const p = this.xml.slice(span.nameStart, span.colonPos);
    const ns = this._nsStack[this._nsStackLen - 1];
    return ns?.get(p);
  }

  /** Depth of the current element (0 = document level). */
  depth(): number {
    return this._elemStackLen;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Internal parsing
  // ═══════════════════════════════════════════════════════════════════

  private parseNext(): boolean {
    const xml = this.xml;
    const len = this.xmlLen;

    while (this.pos < len) {
      const ltPos = xml.indexOf('<', this.pos);

      // No more tags — remaining text
      if (ltPos === -1) {
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
        this.state = S_DONE;
        this._eventType = CursorEventType.END_DOCUMENT;
        this._attrCount = 0;
        return true;
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
      }

      // Parse tag
      this.pos = ltPos;
      const result = this.parseTag();
      if (result) return true;
      // result === false means we skipped comment/PI/DOCTYPE, continue loop
    }

    // End of document
    this.state = S_DONE;
    this._eventType = CursorEventType.END_DOCUMENT;
    this._attrCount = 0;
    return true;
  }

  /**
   * Parse tag at this.pos (pointing at '<').
   * Returns true if an event was produced, false if skipped (comment/PI/DOCTYPE).
   */
  private parseTag(): boolean {
    const nextCode = this.xml.charCodeAt(this.pos + 1);

    switch (nextCode) {
      case 47: // '/' → end tag
        return this.parseEndTag();

      case 33: // '!' → CDATA, comment, DOCTYPE
        return this.parseBangTag();

      case 63: // '?' → PI
        return this.parsePI();

      default: // start tag
        return this.parseStartTag();
    }
  }

  private parseEndTag(): boolean {
    const xml = this.xml;
    const closePos = xml.indexOf('>', this.pos + 2);
    if (closePos === -1) throw new Error('Unclosed end tag');

    // Trim whitespace from tag name
    let nameS = this.pos + 2;
    let nameE = closePos;
    while (nameS < nameE && isWS(xml.charCodeAt(nameS))) nameS++;
    while (nameE > nameS && isWS(xml.charCodeAt(nameE - 1))) nameE--;

    // Find colon
    let colon = -1;
    for (let i = nameS; i < nameE; i++) {
      if (xml.charCodeAt(i) === 58) { colon = i; break; }
    }

    const tagName = xml.slice(nameS, nameE);

    // Well-formedness check
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

  private parseBangTag(): boolean {
    const xml = this.xml;

    if (xml.startsWith('<![CDATA[', this.pos)) {
      const end = xml.indexOf(']]>', this.pos + 9);
      if (end === -1) throw new Error('Unclosed CDATA section');

      this._eventType = CursorEventType.CDATA;
      this._valueStart = this.pos + 9;
      this._valueEnd = end;
      this._attrCount = 0;
      this.pos = end + 3;
      return true;
    }

    if (xml.startsWith('<!--', this.pos)) {
      const end = xml.indexOf('-->', this.pos + 4);
      if (end === -1) throw new Error('Unclosed comment');
      this.pos = end + 3;
      return false; // no event
    }

    if (xml.startsWith('<!DOCTYPE', this.pos)) {
      const end = xml.indexOf('>', this.pos);
      if (end === -1) throw new Error('Unclosed DOCTYPE declaration');
      this.pos = end + 1;
      return false; // no event
    }

    // Unknown bang tag — skip
    const end = xml.indexOf('>', this.pos);
    if (end === -1) throw new Error('Unclosed markup');
    this.pos = end + 1;
    return false;
  }

  private parsePI(): boolean {
    const end = this.xml.indexOf('?>', this.pos);
    if (end === -1) throw new Error('Unclosed processing instruction');
    this.pos = end + 2;
    return false; // no event
  }

  private parseStartTag(): boolean {
    const xml = this.xml;
    const tagStart = this.pos + 1;
    const tagEnd = this.findTagEnd(tagStart);
    if (tagEnd === -1) throw new Error('Unclosed start tag');

    let isSelfClosing = false;
    let actualEnd = tagEnd;
    if (xml.charCodeAt(tagEnd - 1) === 47) { // '/'
      isSelfClosing = true;
      actualEnd = tagEnd - 1;
    }

    // Extract tag name + detect colon in one pass
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

    // Parse attributes + collect xmlns declarations
    this._attrCount = 0;
    const namespaces = this.parseAttrs(nameEnd, actualEnd, parentNs);

    // Set cursor state
    this._eventType = CursorEventType.START_ELEMENT;
    this._nameStart = tagStart;
    this._nameEnd = nameEnd;
    this._colonPos = colonPos;

    this._cachedName = undefined;
    this._cachedLocalName = undefined;
    this._cachedPrefix = undefined;

    // Push element + namespace stack
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

  /**
   * Parse attributes in-place into `_attrs` array.
   * Returns the namespace map for this element (may be parent ref if no xmlns).
   */
  private parseAttrs(
    start: number,
    end: number,
    parentNs: Map<string, string>,
  ): Map<string, string> {
    let ns = parentNs;
    let nsCopied = false;
    const xml = this.xml;
    let i = start;
    let attrIdx = 0;

    while (i < end) {
      // Skip whitespace
      while (i < end && isWS(xml.charCodeAt(i))) i++;
      if (i >= end) break;

      // Attribute name
      const nameS = i;
      let attrColon = -1;
      while (i < end) {
        const code = xml.charCodeAt(i);
        if (code === 61 || isWS(code)) break;
        if (code === 58 && attrColon === -1) attrColon = i;
        i++;
      }
      if (i === nameS) break;
      const nameE = i;

      // Skip whitespace + '='
      while (i < end && isWS(xml.charCodeAt(i))) i++;
      if (i >= end || xml.charCodeAt(i) !== 61) {
        // Boolean attribute (no value)
        this.setAttrSpan(attrIdx++, nameS, nameE, attrColon, nameE, nameE);
        continue;
      }
      i++; // skip '='

      // Skip whitespace before quote
      while (i < end && isWS(xml.charCodeAt(i))) i++;
      if (i >= end) break;

      const quote = xml.charCodeAt(i);
      if (quote !== 34 && quote !== 39) break;
      i++; // skip opening quote
      const valS = i;
      while (i < end && xml.charCodeAt(i) !== quote) i++;
      if (i >= end) break;
      const valE = i;
      i++; // skip closing quote

      // xmlns handling
      const c0 = xml.charCodeAt(nameS);
      if (c0 === 120 && nameE - nameS >= 5) { // 'x'
        const nameLen = nameE - nameS;
        if (nameLen === 5 && xml.slice(nameS, nameE) === 'xmlns') {
          if (!nsCopied) { ns = new Map(parentNs); nsCopied = true; }
          ns.set('', this.entityDecode(xml.slice(valS, valE)));
        } else if (nameLen >= 6 && xml.charCodeAt(nameS + 5) === 58 && xml.slice(nameS, nameS + 5) === 'xmlns') {
          if (!nsCopied) { ns = new Map(parentNs); nsCopied = true; }
          ns.set(xml.slice(nameS + 6, nameE), this.entityDecode(xml.slice(valS, valE)));
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
      const span = this._attrs[idx]!;
      span.nameStart = nameStart;
      span.nameEnd = nameEnd;
      span.colonPos = colonPos;
      span.valueStart = valueStart;
      span.valueEnd = valueEnd;
    } else {
      this._attrs.push({ nameStart, nameEnd, colonPos, valueStart, valueEnd });
    }
  }

  private findTagEnd(start: number): number {
    let i = start;
    let inQuote = false;
    let quoteChar = 0;
    const xml = this.xml;
    const len = this.xmlLen;

    while (i < len) {
      const code = xml.charCodeAt(i);
      if (code === 34 || code === 39) { // " or '
        if (!inQuote) { inQuote = true; quoteChar = code; }
        else if (code === quoteChar) { inQuote = false; quoteChar = 0; }
      } else if (code === 62 && !inQuote) { // '>'
        return i;
      }
      i++;
    }
    return -1;
  }

  /**
   * Trim leading/trailing whitespace from a span and return [start, end].
   * Returns [s, s] if the entire span is whitespace.
   */
  private trimSpan(s: number, e: number): [number, number] {
    const xml = this.xml;
    while (s < e && isWS(xml.charCodeAt(s))) s++;
    while (e > s && isWS(xml.charCodeAt(e - 1))) e--;
    return [s, e];
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
