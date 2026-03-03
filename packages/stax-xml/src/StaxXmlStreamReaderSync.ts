import { XmlEventType as XmlEventValue } from './types';
import type { XmlEventType } from './types';
import type { StaxXmlParserSyncOptions } from './StaxXmlParserSync';

enum ReaderState {
  PARSING = 0,
  DONE = 1,
}

export class StaxXmlStreamReaderSync {
  private readonly xml: string;
  private readonly xmlLength: number;
  private readonly options: StaxXmlParserSyncOptions;
  private readonly entityDecoder: (text: string) => string;

  private static readonly XML_NS_URI = 'http://www.w3.org/XML/1998/namespace';
  private static readonly XMLNS_NS_URI = 'http://www.w3.org/2000/xmlns/';

  private state: ReaderState = ReaderState.PARSING;
  private currentEvent: XmlEventType = XmlEventValue.START_DOCUMENT as unknown as XmlEventType;

  private pos = 0;
  private pendingEndElement = false;

  private readonly stackNameStart: number[] = [];
  private readonly stackNameEnd: number[] = [];
  private readonly stackColonPos: number[] = [];

  private readonly stackAttrScanStart: number[] = [];
  private readonly stackAttrScanEnd: number[] = [];
  private readonly stackNsDecls: Array<Record<string, string> | undefined> = [];

  private currNameStart = -1;
  private currNameEnd = -1;
  private currColonPos = -1;
  private currTextStart = -1;
  private currTextEnd = -1;

  private tokenId = 0;

  private currNameCacheTokenId = -1;
  private currNameCache: string | undefined;

  private currLocalNameCacheTokenId = -1;
  private currLocalNameCache: string | undefined;

  private currPrefixCacheTokenId = -1;
  private currPrefixCache: string | undefined;

  private currUriCacheTokenId = -1;
  private currUriCache: string | null | undefined;

  private currTextCacheTokenId = -1;
  private currTextCache: string | undefined;

  private attrCount = 0;
  private currAttrScanStart = -1;
  private currAttrScanEnd = -1;
  private attrsParsed = false;
  private readonly attrNameStart: number[] = [];
  private readonly attrNameEnd: number[] = [];
  private readonly attrColonPos: number[] = [];
  private readonly attrValueStart: number[] = [];
  private readonly attrValueEnd: number[] = [];
  private readonly attrValueCache: Array<string | undefined> = [];
  private readonly attrUriCache: Array<string | null | undefined> = [];

  private currEndAttrScanStart = -1;
  private currEndAttrScanEnd = -1;
  private currEndNsDecls: Record<string, string> | undefined;

  private static readonly EMPTY_NS_DECLS: Record<string, string> = Object.freeze(Object.create(null));

  private static readonly ASCII_TABLE = (() => {
    const table = new Uint8Array(128);
    table[9] = 1;
    table[10] = 1;
    table[13] = 1;
    table[32] = 1;
    table[60] = 2;
    table[62] = 3;
    table[47] = 4;
    table[61] = 5;
    table[33] = 6;
    table[63] = 7;
    table[34] = 8;
    table[39] = 9;
    return table;
  })();

  private static readonly UNICODE_WHITESPACE = new Set([
    0x00a0,
    0x1680,
    0x2000,
    0x2001,
    0x2002,
    0x2003,
    0x2004,
    0x2005,
    0x2006,
    0x2007,
    0x2008,
    0x2009,
    0x200a,
    0x2028,
    0x2029,
    0x202f,
    0x205f,
    0x3000,
    0xfeff,
  ]);

  private static readonly ENTITY_REGEX_CACHE = new Map<string, RegExp>();
  private static readonly DEFAULT_ENTITY_REGEX = /&(lt|gt|quot|apos|amp);/g;
  private static readonly DEFAULT_ENTITY_MAP: Record<string, string> = {
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    amp: '&',
  };

  constructor(xml: string, options: StaxXmlParserSyncOptions = {}) {
    this.xml = xml;
    this.xmlLength = xml.length;
    this.options = {
      autoDecodeEntities: true,
      ...options,
    } as StaxXmlParserSyncOptions;
    this.entityDecoder = this.compileEntityDecoder();
  }

  getEventType(): XmlEventType {
    return this.currentEvent;
  }

  hasNext(): boolean {
    return this.state !== ReaderState.DONE;
  }

  next(): XmlEventType {
    if (this.state === ReaderState.DONE) {
      throw new Error('No more tokens');
    }

    this.tokenId++;

    if (this.pendingEndElement) {
      this.pendingEndElement = false;
      return this.emitPendingEndElement();
    }

    const token = this.parseNextToken();
    if (token === null) {
      this.currentEvent = XmlEventValue.END_DOCUMENT as unknown as XmlEventType;
      this.state = ReaderState.DONE;
      return this.currentEvent;
    }

    this.currentEvent = token;
    return token;
  }

  getName(): string | undefined {
    if (this.currentEvent !== XmlEventValue.START_ELEMENT && this.currentEvent !== XmlEventValue.END_ELEMENT) {
      return undefined;
    }

    if (this.currNameCacheTokenId === this.tokenId && this.currNameCache !== undefined) return this.currNameCache;
    if (this.currNameStart < 0 || this.currNameEnd < 0) return undefined;
    this.currNameCache = this.xml.slice(this.currNameStart, this.currNameEnd);
    this.currNameCacheTokenId = this.tokenId;
    return this.currNameCache;
  }

  getLocalName(): string | undefined {
    if (this.currentEvent !== XmlEventValue.START_ELEMENT && this.currentEvent !== XmlEventValue.END_ELEMENT) {
      return undefined;
    }

    if (this.currLocalNameCacheTokenId === this.tokenId && this.currLocalNameCache !== undefined) {
      return this.currLocalNameCache;
    }
    if (this.currNameStart < 0 || this.currNameEnd < 0) return undefined;
    const start = this.currColonPos >= 0 ? this.currColonPos + 1 : this.currNameStart;
    this.currLocalNameCache = this.xml.slice(start, this.currNameEnd);
    this.currLocalNameCacheTokenId = this.tokenId;
    return this.currLocalNameCache;
  }

  getPrefix(): string | undefined {
    if (this.currentEvent !== XmlEventValue.START_ELEMENT && this.currentEvent !== XmlEventValue.END_ELEMENT) {
      return undefined;
    }

    if (this.currPrefixCacheTokenId === this.tokenId && this.currPrefixCache !== undefined) return this.currPrefixCache;
    if (this.currColonPos < 0) return undefined;
    this.currPrefixCache = this.xml.slice(this.currNameStart, this.currColonPos);
    this.currPrefixCacheTokenId = this.tokenId;
    return this.currPrefixCache;
  }

  getUri(): string | undefined {
    if (this.currentEvent !== XmlEventValue.START_ELEMENT && this.currentEvent !== XmlEventValue.END_ELEMENT) {
      return undefined;
    }
    if (this.currUriCacheTokenId === this.tokenId && this.currUriCache !== undefined) {
      return this.currUriCache ?? undefined;
    }

    let resolved: string | undefined;
    if (this.currColonPos < 0) {
      resolved = this.resolveDefaultNamespaceUriInScope();
    } else {
      if (this.spanEqualsString(this.currNameStart, this.currColonPos, 'xml')) {
        resolved = StaxXmlStreamReaderSync.XML_NS_URI;
      } else if (this.spanEqualsString(this.currNameStart, this.currColonPos, 'xmlns')) {
        resolved = StaxXmlStreamReaderSync.XMLNS_NS_URI;
      } else {
        const prefix = this.xml.slice(this.currNameStart, this.currColonPos);
        resolved = this.resolveNamespaceUriInScope(prefix);
      }
    }

    this.currUriCache = resolved ?? null;
    this.currUriCacheTokenId = this.tokenId;
    return resolved;
  }

  getText(): string | undefined {
    if (this.currentEvent !== XmlEventValue.CHARACTERS && this.currentEvent !== XmlEventValue.CDATA) {
      return undefined;
    }

    if (this.currTextCacheTokenId === this.tokenId && this.currTextCache !== undefined) return this.currTextCache;
    if (this.currTextStart < 0 || this.currTextEnd < 0) return undefined;
    const raw = this.xml.slice(this.currTextStart, this.currTextEnd);
    this.currTextCache = this.currentEvent === XmlEventValue.CHARACTERS ? this.entityDecoder(raw) : raw;
    this.currTextCacheTokenId = this.tokenId;
    return this.currTextCache;
  }

  getAttributeCount(): number {
    if (this.currentEvent !== XmlEventValue.START_ELEMENT) return 0;
    this.ensureAttributesParsed();
    return this.attrCount;
  }
  getAttributeName(i: number): string {
    const idx = this.assertAttributeIndex(i);
    return this.xml.slice(this.attrNameStart[idx], this.attrNameEnd[idx]);
  }
  getAttributeLocalName(i: number): string {
    const idx = this.assertAttributeIndex(i);
    const start = this.attrColonPos[idx] >= 0 ? this.attrColonPos[idx] + 1 : this.attrNameStart[idx];
    return this.xml.slice(start, this.attrNameEnd[idx]);
  }
  getAttributePrefix(i: number): string | undefined {
    const idx = this.assertAttributeIndex(i);
    const colonPos = this.attrColonPos[idx];
    if (colonPos < 0) return undefined;
    return this.xml.slice(this.attrNameStart[idx], colonPos);
  }
  getAttributeUri(i: number): string | undefined {
    const idx = this.assertAttributeIndex(i);
    const cached = this.attrUriCache[idx];
    if (cached !== undefined) return cached ?? undefined;

    const colonPos = this.attrColonPos[idx];
    if (colonPos < 0) {
      if (this.spanEqualsString(this.attrNameStart[idx], this.attrNameEnd[idx], 'xmlns')) {
        this.attrUriCache[idx] = null;
        return undefined;
      }
      this.attrUriCache[idx] = null;
      return undefined;
    }

    const prefixStart = this.attrNameStart[idx];
    const prefixEnd = colonPos;

    let resolved: string | undefined;
    if (this.spanEqualsString(prefixStart, prefixEnd, 'xml')) {
      resolved = StaxXmlStreamReaderSync.XML_NS_URI;
    } else if (this.spanEqualsString(prefixStart, prefixEnd, 'xmlns')) {
      resolved = undefined;
    } else {
      const prefix = this.xml.slice(prefixStart, prefixEnd);
      resolved = this.resolveNamespaceUriInScope(prefix);
    }

    this.attrUriCache[idx] = resolved ?? null;
    return resolved;
  }
  getAttributeValue(i: number): string {
    const idx = this.assertAttributeIndex(i);
    const cached = this.attrValueCache[idx];
    if (cached !== undefined) return cached;

    const raw = this.xml.slice(this.attrValueStart[idx], this.attrValueEnd[idx]);
    const decoded = this.entityDecoder(raw);
    this.attrValueCache[idx] = decoded;
    return decoded;
  }
  getAttributeValueByName(name: string): string | undefined {
    if (this.currentEvent !== XmlEventValue.START_ELEMENT) return undefined;
    if (!name) return undefined;

    this.ensureAttributesParsed();

    for (let i = 0; i < this.attrCount; i++) {
      if (this.spanEqualsString(this.attrNameStart[i], this.attrNameEnd[i], name)) {
        return this.getAttributeValue(i);
      }
    }
    return undefined;
  }

  getNamespaceURI(prefix?: string): string | undefined {
    const p = prefix ?? '';
    if (p === 'xml') return StaxXmlStreamReaderSync.XML_NS_URI;
    if (p === 'xmlns') return StaxXmlStreamReaderSync.XMLNS_NS_URI;

    if (p.length === 0) return this.resolveDefaultNamespaceUriInScope();
    return this.resolveNamespaceUriInScope(p);
  }

  private emitPendingEndElement(): XmlEventType {
    const depth = this.stackNameStart.length;
    if (depth === 0) throw new Error('Internal error');

    const i = depth - 1;

    this.currEndAttrScanStart = this.stackAttrScanStart[i];
    this.currEndAttrScanEnd = this.stackAttrScanEnd[i];
    this.currEndNsDecls = this.stackNsDecls[i];

    this.currNameStart = this.stackNameStart[i];
    this.currNameEnd = this.stackNameEnd[i];
    this.currColonPos = this.stackColonPos[i];
    this.stackNameStart.pop();
    this.stackNameEnd.pop();
    this.stackColonPos.pop();

    this.stackAttrScanStart.pop();
    this.stackAttrScanEnd.pop();
    this.stackNsDecls.pop();

    this.currentEvent = XmlEventValue.END_ELEMENT as unknown as XmlEventType;
    return this.currentEvent;
  }

  private parseNextToken(): XmlEventType | null {
    while (this.pos < this.xmlLength) {
      const ltPos = this.findChar(60, this.pos);
      if (ltPos === -1) {
        const textStart = this.pos;
        const textEnd = this.xmlLength;
        this.pos = this.xmlLength;
        let tStart = this.trimLeft(textStart, textEnd);
        let tEnd = this.trimRight(tStart, textEnd);
        if (tStart < tEnd) {
          this.currTextStart = tStart;
          this.currTextEnd = tEnd;
          return XmlEventValue.CHARACTERS as unknown as XmlEventType;
        }
        return null;
      }

      if (ltPos > this.pos) {
        const textStart = this.pos;
        const textEnd = ltPos;
        this.pos = ltPos;
        let tStart = this.trimLeft(textStart, textEnd);
        let tEnd = this.trimRight(tStart, textEnd);
        if (tStart < tEnd) {
          this.currTextStart = tStart;
          this.currTextEnd = tEnd;
          return XmlEventValue.CHARACTERS as unknown as XmlEventType;
        }
      }

      this.pos = ltPos;
      const token = this.parseTag();
      if (token !== null) return token;
    }

    return null;
  }

  private parseTag(): XmlEventType | null {
    const nextCharCode = this.xml.charCodeAt(this.pos + 1);
    switch (nextCharCode) {
      case 47:
        return this.parseEndTag();
      case 33:
        return this.parseCdataCommentDoctype();
      case 63:
        this.parseProcessingInstruction();
        return null;
      default:
        return this.parseStartTag();
    }
  }

  private parseEndTag(): XmlEventType {
    const tagClose = this.findChar(62, this.pos);
    if (tagClose === -1) throw new Error('Unclosed end tag');

    const nameStart = this.trimLeft(this.pos + 2, tagClose);
    const nameEnd = this.trimRight(nameStart, tagClose);
    if (nameStart >= nameEnd) throw new Error('Empty end tag');

    const depth = this.stackNameStart.length;
    if (depth === 0) throw new Error('Mismatched closing tag');

    const i = depth - 1;
    const openStart = this.stackNameStart[i];
    const openEnd = this.stackNameEnd[i];
    if (!this.spanEquals(nameStart, nameEnd, openStart, openEnd)) {
      throw new Error('Mismatched closing tag');
    }

    this.currEndAttrScanStart = this.stackAttrScanStart[i];
    this.currEndAttrScanEnd = this.stackAttrScanEnd[i];
    this.currEndNsDecls = this.stackNsDecls[i];

    this.currNameStart = openStart;
    this.currNameEnd = openEnd;
    this.currColonPos = this.stackColonPos[i];
    this.stackNameStart.pop();
    this.stackNameEnd.pop();
    this.stackColonPos.pop();
    this.stackAttrScanStart.pop();
    this.stackAttrScanEnd.pop();
    this.stackNsDecls.pop();

    this.pos = tagClose + 1;
    return XmlEventValue.END_ELEMENT as unknown as XmlEventType;
  }

  private parseCdataCommentDoctype(): XmlEventType | null {
    if (this.matchesAt('<![CDATA[', this.pos)) {
      const cdataEnd = this.findSequence(']]>', this.pos + 9);
      if (cdataEnd === -1) throw new Error('Unclosed CDATA section');

      this.currTextStart = this.pos + 9;
      this.currTextEnd = cdataEnd;
      this.pos = cdataEnd + 3;
      return XmlEventValue.CDATA as unknown as XmlEventType;
    }

    if (this.matchesAt('<!--', this.pos)) {
      const commentEnd = this.findSequence('-->', this.pos + 4);
      if (commentEnd === -1) throw new Error('Unclosed comment');
      this.pos = commentEnd + 3;
      return null;
    }

    if (this.matchesAt('<!DOCTYPE', this.pos)) {
      const doctypeEnd = this.findChar(62, this.pos);
      if (doctypeEnd === -1) throw new Error('Unclosed DOCTYPE declaration');
      this.pos = doctypeEnd + 1;
      return null;
    }

    const declEnd = this.findChar(62, this.pos);
    if (declEnd === -1) throw new Error('Unclosed markup declaration');
    this.pos = declEnd + 1;
    return null;
  }

  private parseProcessingInstruction(): void {
    const piEnd = this.findSequence('?>', this.pos);
    if (piEnd === -1) throw new Error('Unclosed processing instruction');
    this.pos = piEnd + 2;
  }

  private parseStartTag(): XmlEventType {
    const tagStart = this.pos + 1;
    const tagEnd = this.findTagEnd(tagStart);
    if (tagEnd === -1) throw new Error('Unclosed start tag');

    let isSelfClosing = false;
    let scan = tagEnd - 1;
    while (scan > tagStart && StaxXmlStreamReaderSync.isWhitespace(this.xml.charCodeAt(scan))) scan--;
    if (this.xml.charCodeAt(scan) === 47) {
      isSelfClosing = true;
    }

    let nameEnd = tagStart;
    while (nameEnd < tagEnd) {
      const code = this.xml.charCodeAt(nameEnd);
      if (code === 62 || code === 47 || StaxXmlStreamReaderSync.isWhitespace(code)) break;
      nameEnd++;
    }

    const nameStart = this.trimLeft(tagStart, nameEnd);
    const trimmedEnd = this.trimRight(nameStart, nameEnd);
    if (nameStart >= trimmedEnd) throw new Error('Empty start tag');

    const colonPos = this.findColon(nameStart, trimmedEnd);
    this.currNameStart = nameStart;
    this.currNameEnd = trimmedEnd;
    this.currColonPos = colonPos;

    this.stackNameStart.push(nameStart);
    this.stackNameEnd.push(trimmedEnd);
    this.stackColonPos.push(colonPos);

    const attrEnd = isSelfClosing ? scan : tagEnd;
    this.currAttrScanStart = nameEnd;
    this.currAttrScanEnd = attrEnd;
    this.attrsParsed = false;

    this.stackAttrScanStart.push(nameEnd);
    this.stackAttrScanEnd.push(attrEnd);
    this.stackNsDecls.push(undefined);

    if (isSelfClosing) {
      this.pendingEndElement = true;
    }

    this.pos = tagEnd + 1;
    return XmlEventValue.START_ELEMENT as unknown as XmlEventType;
  }

  private ensureAttributesParsed(): void {
    if (this.currentEvent !== XmlEventValue.START_ELEMENT) return;
    if (this.attrsParsed) return;

    this.attrCount = 0;
    this.attrNameStart.length = 0;
    this.attrNameEnd.length = 0;
    this.attrColonPos.length = 0;
    this.attrValueStart.length = 0;
    this.attrValueEnd.length = 0;
    this.attrValueCache.length = 0;
    this.attrUriCache.length = 0;

    const start = this.currAttrScanStart;
    const end = this.currAttrScanEnd;
    if (start < 0 || end < 0 || start >= end) {
      this.attrsParsed = true;
      return;
    }

    this.parseAttributes(start, end);
    this.attrsParsed = true;
  }

  private parseAttributes(start: number, end: number): void {
    let i = this.trimLeft(start, end);
    const xml = this.xml;

    while (i < end) {
      const nameStart = i;
      while (i < end) {
        const code = xml.charCodeAt(i);
        if (code === 61 || StaxXmlStreamReaderSync.isWhitespace(code)) break;
        i++;
      }
      const nameRawEnd = i;
      const nameEnd = this.trimRight(nameStart, nameRawEnd);
      if (nameStart >= nameEnd) break;

      i = this.trimLeft(i, end);
      if (i >= end || xml.charCodeAt(i) !== 61) throw new Error('Malformed attribute');
      i++;
      i = this.trimLeft(i, end);

      const quote = xml.charCodeAt(i);
      if (quote !== 34 && quote !== 39) throw new Error('Malformed attribute');
      i++;

      const valueStart = i;
      while (i < end && xml.charCodeAt(i) !== quote) i++;
      if (i >= end) throw new Error('Unclosed attribute value');
      const valueEnd = i;
      i++;

      const colonPos = this.findColon(nameStart, nameEnd);
      const attrIndex = this.attrCount++;
      this.attrNameStart[attrIndex] = nameStart;
      this.attrNameEnd[attrIndex] = nameEnd;
      this.attrColonPos[attrIndex] = colonPos;
      this.attrValueStart[attrIndex] = valueStart;
      this.attrValueEnd[attrIndex] = valueEnd;

      i = this.trimLeft(i, end);
    }
  }

  private isXmlnsAttribute(nameStart: number, nameEnd: number, colonPos: number): boolean {
    if (colonPos < 0) return this.spanEqualsString(nameStart, nameEnd, 'xmlns');
    return this.spanEqualsString(nameStart, colonPos, 'xmlns');
  }

  private resolveNamespaceUriInScope(prefix: string): string | undefined {
    if (this.currentEvent === XmlEventValue.END_ELEMENT) {
      const endDecls = this.ensureEndNamespaceDecls();
      const hit = endDecls[prefix];
      if (hit !== undefined) return hit;
    }

    for (let i = this.stackNsDecls.length - 1; i >= 0; i--) {
      const decls = this.ensureStackNamespaceDecls(i);
      const hit = decls[prefix];
      if (hit !== undefined) return hit;
    }

    return undefined;
  }

  private resolveDefaultNamespaceUriInScope(): string | undefined {
    if (this.currentEvent === XmlEventValue.END_ELEMENT) {
      const endDecls = this.ensureEndNamespaceDecls();
      const hit = endDecls[''];
      if (hit !== undefined) return hit;
    }

    for (let i = this.stackNsDecls.length - 1; i >= 0; i--) {
      const decls = this.ensureStackNamespaceDecls(i);
      const hit = decls[''];
      if (hit !== undefined) return hit;
    }

    return undefined;
  }

  private ensureStackNamespaceDecls(depth: number): Record<string, string> {
    const cached = this.stackNsDecls[depth];
    if (cached !== undefined) return cached;

    const start = this.stackAttrScanStart[depth];
    const end = this.stackAttrScanEnd[depth];
    const decls = start >= 0 && end >= 0 && start < end
      ? this.scanNamespaceDecls(start, end)
      : StaxXmlStreamReaderSync.EMPTY_NS_DECLS;

    this.stackNsDecls[depth] = decls;
    return decls;
  }

  private ensureEndNamespaceDecls(): Record<string, string> {
    const cached = this.currEndNsDecls;
    if (cached !== undefined) return cached;

    const start = this.currEndAttrScanStart;
    const end = this.currEndAttrScanEnd;
    const decls = start >= 0 && end >= 0 && start < end
      ? this.scanNamespaceDecls(start, end)
      : StaxXmlStreamReaderSync.EMPTY_NS_DECLS;

    this.currEndNsDecls = decls;
    return decls;
  }

  private scanNamespaceDecls(start: number, end: number): Record<string, string> {
    let i = this.trimLeft(start, end);
    const xml = this.xml;

    let out: Record<string, string> | undefined;

    while (i < end) {
      const nameStart = i;
      while (i < end) {
        const code = xml.charCodeAt(i);
        if (code === 61 || StaxXmlStreamReaderSync.isWhitespace(code)) break;
        i++;
      }
      const nameRawEnd = i;
      const nameEnd = this.trimRight(nameStart, nameRawEnd);
      if (nameStart >= nameEnd) break;

      i = this.trimLeft(i, end);
      if (i >= end || xml.charCodeAt(i) !== 61) throw new Error('Malformed attribute');
      i++;
      i = this.trimLeft(i, end);

      const quote = xml.charCodeAt(i);
      if (quote !== 34 && quote !== 39) throw new Error('Malformed attribute');
      i++;

      const valueStart = i;
      while (i < end && xml.charCodeAt(i) !== quote) i++;
      if (i >= end) throw new Error('Unclosed attribute value');
      const valueEnd = i;
      i++;

      const colonPos = this.findColon(nameStart, nameEnd);
      if (this.isXmlnsAttribute(nameStart, nameEnd, colonPos)) {
        if (out === undefined) out = Object.create(null) as Record<string, string>;

        const uriRaw = this.xml.slice(valueStart, valueEnd);
        const uri = this.entityDecoder(uriRaw);

        if (colonPos < 0) {
          out[''] = uri;
        } else {
          const prefix = this.xml.slice(colonPos + 1, nameEnd);
          out[prefix] = uri;
        }
      }

      i = this.trimLeft(i, end);
    }

    return out ?? StaxXmlStreamReaderSync.EMPTY_NS_DECLS;
  }

  private assertAttributeIndex(i: number): number {
    if (this.currentEvent !== XmlEventValue.START_ELEMENT) {
      throw new Error('Not positioned on START_ELEMENT');
    }

    this.ensureAttributesParsed();
    if (!Number.isInteger(i) || i < 0 || i >= this.attrCount) {
      throw new Error('Invalid attribute index');
    }
    return i;
  }

  private spanEqualsString(spanStart: number, spanEnd: number, str: string): boolean {
    const spanLen = spanEnd - spanStart;
    if (spanLen !== str.length) return false;
    for (let i = 0; i < spanLen; i++) {
      if (this.xml.charCodeAt(spanStart + i) !== str.charCodeAt(i)) return false;
    }
    return true;
  }

  private static isWhitespace(code: number): boolean {
    if (code < 128) {
      return StaxXmlStreamReaderSync.ASCII_TABLE[code] === 1;
    }
    return code <= 32 || StaxXmlStreamReaderSync.UNICODE_WHITESPACE.has(code);
  }

  private static isHighSurrogate(code: number): boolean {
    return code >= 0xd800 && code <= 0xdbff;
  }

  private static isLowSurrogate(code: number): boolean {
    return code >= 0xdc00 && code <= 0xdfff;
  }

  private trimLeft(start: number, end: number): number {
    const xml = this.xml;
    while (start < end && StaxXmlStreamReaderSync.isWhitespace(xml.charCodeAt(start))) {
      if (StaxXmlStreamReaderSync.isHighSurrogate(xml.charCodeAt(start))) {
        start += 2;
      } else {
        start++;
      }
    }
    return start;
  }

  private trimRight(start: number, end: number): number {
    const xml = this.xml;
    while (end > start && StaxXmlStreamReaderSync.isWhitespace(xml.charCodeAt(end - 1))) {
      if (
        end > start + 1 &&
        StaxXmlStreamReaderSync.isLowSurrogate(xml.charCodeAt(end - 1)) &&
        StaxXmlStreamReaderSync.isHighSurrogate(xml.charCodeAt(end - 2))
      ) {
        end -= 2;
      } else {
        end--;
      }
    }
    return end;
  }

  private findColon(start: number, end: number): number {
    for (let i = start; i < end; i++) {
      if (this.xml.charCodeAt(i) === 58) return i;
    }
    return -1;
  }

  private spanEquals(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
    const aLen = aEnd - aStart;
    if (aLen !== bEnd - bStart) return false;
    const xml = this.xml;
    for (let i = 0; i < aLen; i++) {
      if (xml.charCodeAt(aStart + i) !== xml.charCodeAt(bStart + i)) return false;
    }
    return true;
  }

  private findChar(targetCode: number, start: number): number {
    const xml = this.xml;
    const len = this.xmlLength;
    const len16 = len - 15;
    let i = start;

    for (; i < len16; i += 16) {
      if (xml.charCodeAt(i) === targetCode) return i;
      if (xml.charCodeAt(i + 1) === targetCode) return i + 1;
      if (xml.charCodeAt(i + 2) === targetCode) return i + 2;
      if (xml.charCodeAt(i + 3) === targetCode) return i + 3;
      if (xml.charCodeAt(i + 4) === targetCode) return i + 4;
      if (xml.charCodeAt(i + 5) === targetCode) return i + 5;
      if (xml.charCodeAt(i + 6) === targetCode) return i + 6;
      if (xml.charCodeAt(i + 7) === targetCode) return i + 7;
      if (xml.charCodeAt(i + 8) === targetCode) return i + 8;
      if (xml.charCodeAt(i + 9) === targetCode) return i + 9;
      if (xml.charCodeAt(i + 10) === targetCode) return i + 10;
      if (xml.charCodeAt(i + 11) === targetCode) return i + 11;
      if (xml.charCodeAt(i + 12) === targetCode) return i + 12;
      if (xml.charCodeAt(i + 13) === targetCode) return i + 13;
      if (xml.charCodeAt(i + 14) === targetCode) return i + 14;
      if (xml.charCodeAt(i + 15) === targetCode) return i + 15;
    }

    for (; i < len; i++) {
      if (xml.charCodeAt(i) === targetCode) return i;
    }
    return -1;
  }

  private matchesAt(str: string, pos: number): boolean {
    const len = str.length;
    if (pos + len > this.xmlLength) return false;
    for (let i = 0; i < len; i++) {
      if (this.xml.charCodeAt(pos + i) !== str.charCodeAt(i)) return false;
    }
    return true;
  }

  private findTagEnd(start: number): number {
    let i = start;
    let inQuote = false;
    let quoteChar = 0;

    while (i < this.xmlLength) {
      const code = this.xml.charCodeAt(i);
      if (code === 34 || code === 39) {
        if (!inQuote) {
          inQuote = true;
          quoteChar = code;
        } else if (code === quoteChar) {
          inQuote = false;
          quoteChar = 0;
        }
      } else if (code === 62 && !inQuote) {
        return i;
      }
      i++;
    }

    return -1;
  }

  private findSequence(sequence: string, start: number): number {
    const seqLen = sequence.length;
    const maxPos = this.xmlLength - seqLen;
    for (let i = start; i <= maxPos; i++) {
      if (this.matchesAt(sequence, i)) return i;
    }
    return -1;
  }

  private compileEntityDecoder(): (text: string) => string {
    if (!this.options.autoDecodeEntities) {
      return (text) => text;
    }

    if (this.options.addEntities && this.options.addEntities.length > 0) {
      const entityMap: Record<string, string> = { ...StaxXmlStreamReaderSync.DEFAULT_ENTITY_MAP };
      const patterns: string[] = ['lt', 'gt', 'quot', 'apos'];

      for (const { entity, value } of this.options.addEntities) {
        if (entity && value) {
          const key = entity.startsWith('&') && entity.endsWith(';') ? entity.slice(1, -1) : entity;
          entityMap[key] = value;
          patterns.push(key);
        }
      }
      patterns.push('amp');

      const cacheKey = patterns.join(',');
      let regex = StaxXmlStreamReaderSync.ENTITY_REGEX_CACHE.get(cacheKey);
      if (!regex) {
        const pattern = patterns
          .sort((a, b) => b.length - a.length)
          .map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|');
        regex = new RegExp(`&(${pattern});`, 'g');
        StaxXmlStreamReaderSync.ENTITY_REGEX_CACHE.set(cacheKey, regex);
      }

      return (text: string) => {
        if (!text || text.indexOf('&') === -1) return text;
        regex!.lastIndex = 0;
        return text.replace(regex!, (_, ent) => entityMap[ent] || _);
      };
    }

    return (text: string) => {
      if (!text || text.indexOf('&') === -1) return text;
      StaxXmlStreamReaderSync.DEFAULT_ENTITY_REGEX.lastIndex = 0;
      return text.replace(
        StaxXmlStreamReaderSync.DEFAULT_ENTITY_REGEX,
        (_, ent) => StaxXmlStreamReaderSync.DEFAULT_ENTITY_MAP[ent] || _,
      );
    };
  }
}
