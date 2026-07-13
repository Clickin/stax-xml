import { XmlEventType, type DocumentMode, type XmlEventType as XmlEventTypeValue } from './types.js';

export const NEED_INPUT = Symbol('stax-xml.need-input');
export type TokenCursorResult = XmlEventTypeValue | typeof NEED_INPUT | null;

export interface TokenCursorOptions {
  documentMode?: DocumentMode;
  namespaceAware?: boolean;
}
export interface TokenAttribute { name: string; value: string; localName: string; prefix: string; namespaceURI: string }

interface ElementFrame { name: string; localName: string; prefix: string; namespaceURI: string; namespaceUndoStart: number }
interface DuplicateTable { slots: Int32Array; generations: Uint32Array; generation: number }

const NO_SPAN = -1;
const XMLNS = 'xmlns';
const XML_NAMESPACE_URI = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NAMESPACE_URI = 'http://www.w3.org/2000/xmlns/';
const DUPLICATE_TABLE_THRESHOLD = 16;
const enum ResumeKind { NONE, TEXT, START_TAG, END_TAG, COMMENT, CDATA, PI, DOCTYPE }
const enum DoctypeState { TEXT, LT, BANG, DASH, COMMENT, COMMENT_DASH, COMMENT_END }

/** One tokenizer shared by direct strings and incrementally decoded UTF-8. */
export class TokenCursor {
  private buffer: string;
  private pos = 0;
  private final: boolean;
  private resumeKind = ResumeKind.NONE;
  private resumeOffset = 0;
  private resumeQuote = 0;
  private resumeBrackets = 0;
  private resumeDoctypeState = DoctypeState.TEXT;
  private resumeEnd = NO_SPAN;
  private resumeTail = '';
  private leadingBOMPending = true;
  private started = false;
  private ended = false;
  private pendingEnd: ElementFrame | undefined;
  private pendingNamespaceUndoStart = NO_SPAN;
  private readonly stack: ElementFrame[] = [];
  private readonly namespaces = new Map<string, string>([['xml', XML_NAMESPACE_URI]]);
  private namespaceUndoCapacity = 8;
  private namespaceUndoLength = 0;
  private namespaceUndoPrefixes: Array<string | undefined> = [];
  private namespaceUndoPrevious: Array<string | undefined> = [];
  private namespaceUndoHad = new Uint8Array(this.namespaceUndoCapacity);
  private roots = 0;
  private xmlDeclarationAllowed = true;
  private seenDoctype = false;
  private doctypeRootName: string | undefined;
  private seenNonWhitespaceOutsideRoot = false;
  private currentType: XmlEventTypeValue = XmlEventType.START_DOCUMENT;
  private currentNameValue: string | undefined;
  private currentTextStart = NO_SPAN;
  private currentTextEnd = NO_SPAN;
  private currentTextMemo: string | undefined;
  private currentFrame: ElementFrame | undefined;
  private currentAttributeCount = 0;
  private attributeCapacity = 8;
  private attributeNameStarts = new Int32Array(this.attributeCapacity);
  private attributeNameEnds = new Int32Array(this.attributeCapacity);
  private attributeValueStarts = new Int32Array(this.attributeCapacity);
  private attributeValueEnds = new Int32Array(this.attributeCapacity);
  private attributeColons = new Int32Array(this.attributeCapacity).fill(NO_SPAN);
  private attributeHashes = new Uint32Array(this.attributeCapacity);
  private attributeNamespaceURIs: string[] = [];
  private attributeMemos: Array<TokenAttribute | undefined> = [];
  private attributeMemoEvents = new Int32Array(this.attributeCapacity);
  private attributeMemoHighWater = 0;
  private duplicateTable: DuplicateTable | undefined;
  private currentEvent = 0;
  private readonly documentMode: DocumentMode;
  private readonly namespaceAware: boolean;

  constructor(input = '', final = false, options: TokenCursorOptions = {}) {
    this.buffer = input;
    this.final = final;
    this.documentMode = options.documentMode ?? 'fragment';
    this.namespaceAware = options.namespaceAware ?? true;
  }

  push(text: string, final = false): void {
    if (this.final) throw new Error('Cannot push after end of input.');
    let base = this.buffer;
    if (this.pos > 0) {
      if (this.resumeKind !== ResumeKind.NONE) {
        this.resumeOffset -= this.pos;
        if (this.resumeEnd >= 0) this.resumeEnd -= this.pos;
      }
      base = this.buffer.slice(this.pos);
      this.pos = 0;
    }
    if (this.resumeKind !== ResumeKind.NONE) this.scanPushedText(text, base.length);
    this.buffer = base + text;
    this.final = final;
  }

  next(): TokenCursorResult {
    if (this.pendingNamespaceUndoStart >= 0) {
      this.restoreNamespaces(this.pendingNamespaceUndoStart);
      this.pendingNamespaceUndoStart = NO_SPAN;
    }
    if (!this.started) {
      this.started = true;
      return this.set(XmlEventType.START_DOCUMENT);
    }
    if (this.leadingBOMPending) {
      if (this.pos >= this.buffer.length && !this.final) return NEED_INPUT;
      this.leadingBOMPending = false;
      if (this.buffer.charCodeAt(this.pos) === 0xfeff) this.pos++;
    }
    if (this.pendingEnd) {
      const frame = this.pendingEnd;
      this.pendingEnd = undefined;
      this.currentFrame = frame;
      this.currentNameValue = frame.name;
      this.pendingNamespaceUndoStart = frame.namespaceUndoStart;
      return this.set(XmlEventType.END_ELEMENT);
    }
    if (this.ended) return null;
    if (this.resumeKind !== ResumeKind.NONE) return this.resumeNext();

    while (true) {
      if (this.pos >= this.buffer.length) {
        if (!this.final) return NEED_INPUT;
        if (this.stack.length) throw new Error(`Unclosed element: ${this.stack.at(-1)!.name}`);
        if (this.documentMode === 'document' && this.roots !== 1) throw new Error('XML document must contain exactly one root element.');
        this.ended = true;
        const type = this.set(XmlEventType.END_DOCUMENT);
        this.releaseRetainedInput();
        return type;
      }
      if (this.buffer.charCodeAt(this.pos) !== 60) return this.parseText();
      // Wait for the markup discriminator before choosing a resumable parser.
      // A bare '<' may become a start tag, end tag, PI, or declaration.
      if (this.pos + 1 >= this.buffer.length && !this.final) return NEED_INPUT;

      const next = this.buffer.charCodeAt(this.pos + 1);
      if (next === 47) return this.parseEnd();
      if (next === 63) {
        const result = this.parseProcessingInstruction();
        if (result !== undefined) return result;
        continue;
      }
      if (next === 33) return this.parseBang();
      return this.parseStart();
    }
  }

  eventType(): XmlEventTypeValue { return this.currentType; }
  name(): string | undefined { return this.currentNameValue; }
  text(): string | undefined {
    if (this.currentTextStart < 0) return undefined;
    if (this.currentTextMemo === undefined) {
      const value = this.buffer.slice(this.currentTextStart, this.currentTextEnd);
      this.currentTextMemo = this.currentType === XmlEventType.CHARACTERS ? decodeEntities(value) : value;
    }
    return this.currentTextMemo;
  }
  localName(): string | undefined { return this.currentFrame?.localName; }
  prefix(): string { return this.currentFrame?.prefix ?? ''; }
  namespaceURI(): string { return this.currentFrame?.namespaceURI ?? ''; }
  attributeCount(): number { return this.currentAttributeCount; }
  attributeLocalName(index: number): string | undefined {
    if (index < 0 || index >= this.currentAttributeCount) return undefined;
    const start = this.attributeNameStarts[index]!;
    const end = this.attributeNameEnds[index]!;
    const colon = this.attributeColons[index]!;
    return this.buffer.slice(colon < 0 ? start : colon + 1, end);
  }
  attributeValue(index: number): string | undefined {
    if (index < 0 || index >= this.currentAttributeCount) return undefined;
    return decodeEntities(this.buffer.slice(this.attributeValueStarts[index]!, this.attributeValueEnds[index]!));
  }
  attribute(indexOrNameOrNamespace: number | string, localName?: string): TokenAttribute | undefined {
    if (localName !== undefined) {
      const namespaceURI = indexOrNameOrNamespace as string;
      for (let index = 0; index < this.currentAttributeCount; index++) {
        if (this.attributeNamespaceURIs[index] !== namespaceURI) continue;
        const colon = this.attributeColons[index]!;
        const start = colon < 0 ? this.attributeNameStarts[index]! : colon + 1;
        if (spanEqualsString(this.buffer, start, this.attributeNameEnds[index]!, localName)) {
          return this.materializeAttribute(index);
        }
      }
      return undefined;
    }
    const indexOrName = indexOrNameOrNamespace;
    if (typeof indexOrName === 'number') return this.materializeAttribute(indexOrName);
    const hash = hashString(indexOrName);
    for (let index = 0; index < this.currentAttributeCount; index++) {
      if (this.attributeHashes[index] === hash && spanEqualsString(
        this.buffer,
        this.attributeNameStarts[index]!,
        this.attributeNameEnds[index]!,
        indexOrName,
      )) return this.materializeAttribute(index);
    }
    return undefined;
  }
  namespaceURIForPrefix(prefix: string): string {
    return this.namespaceAware && this.currentFrame ? (this.namespaces.get(prefix) ?? '') : '';
  }

  /** @internal Release input and parser state after an early stop. */
  dispose(): void {
    if (this.ended && this.final && this.buffer.length === 0) return;
    this.final = true;
    this.started = true;
    this.ended = true;
    this.pendingEnd = undefined;
    this.pendingNamespaceUndoStart = NO_SPAN;
    this.stack.length = 0;
    this.currentNameValue = undefined;
    this.currentTextMemo = undefined;
    this.currentFrame = undefined;
    this.releaseRetainedInput();
  }

  private parseText(): TokenCursorResult {
    if (this.xmlDeclarationAllowed && !this.stack.length && this.roots === 0) {
      this.xmlDeclarationAllowed = false;
    }
    const start = this.pos;
    const lt = this.findTextEndValidated(start);
    if (lt < 0 && !this.final) return NEED_INPUT;
    const end = lt < 0 ? this.buffer.length : lt;
    this.pos = end;
    if (!this.stack.length) {
      let lexicalWhitespace = true;
      for (let index = start; index < end; index++) {
        if (!isXmlWhitespace(this.buffer.charCodeAt(index))) {
          lexicalWhitespace = false;
          break;
        }
      }
      if (!lexicalWhitespace) {
        this.seenNonWhitespaceOutsideRoot = true;
        if (this.documentMode === 'document') throw new Error('Character data is not allowed outside the root element.');
      }
    }
    this.currentTextStart = start;
    this.currentTextEnd = end;
    return this.set(XmlEventType.CHARACTERS);
  }

  private parseProcessingInstruction(): TokenCursorResult | undefined {
    const end = this.findDelimiter(ResumeKind.PI, '?>', this.pos + 2);
    if (end < 0) return this.incomplete('processing instruction');
    const contentStart = this.pos + 2;
    validateXmlCharsSpan(this.buffer, contentStart, end);
    let targetEnd = contentStart;
    while (targetEnd < end && !isXmlWhitespace(this.buffer.charCodeAt(targetEnd))) targetEnd++;
    const target = this.buffer.slice(contentStart, targetEnd);
    if (!isValidName(target)) throw new Error(`Invalid processing instruction target: ${target}`);
    this.pos = end + 2;
    if (target.toLowerCase() === 'xml') {
      if (target !== 'xml' || !this.xmlDeclarationAllowed || !isValidXmlDeclaration(this.buffer.slice(targetEnd, end))) {
        throw new Error('Invalid or misplaced XML declaration.');
      }
      this.xmlDeclarationAllowed = false;
      return undefined;
    }
    this.xmlDeclarationAllowed = false;
    this.currentNameValue = target;
    this.currentTextMemo = this.buffer.slice(targetEnd, end).trim();
    this.currentTextStart = this.currentTextEnd = 0;
    return this.set(XmlEventType.PROCESSING_INSTRUCTION, true);
  }

  private parseBang(): TokenCursorResult {
    if (this.buffer.startsWith('<!--', this.pos)) return this.parseComment();
    if (this.buffer.startsWith('<![CDATA[', this.pos)) return this.parseCdata();
    if (this.buffer.startsWith('<!DOCTYPE', this.pos) && isDoctypeBoundary(this.buffer.charCodeAt(this.pos + 9))) {
      return this.parseDoctype();
    }
    if (!this.final) {
      const rest = this.buffer.slice(this.pos);
      if (['<!--', '<![CDATA[', '<!DOCTYPE'].some((marker) => marker.startsWith(rest))) return NEED_INPUT;
    }
    throw new Error('Unsupported XML declaration.');
  }

  private parseComment(): TokenCursorResult {
    const end = this.findDelimiter(ResumeKind.COMMENT, '-->', this.pos + 4);
    if (end < 0) return this.incomplete('comment');
    if (this.buffer.indexOf('--', this.pos + 4) < end) throw new Error('XML comments must not contain "--".');
    validateXmlCharsSpan(this.buffer, this.pos + 4, end);
    this.xmlDeclarationAllowed = false;
    this.currentTextStart = this.pos + 4;
    this.currentTextEnd = end;
    this.pos = end + 3;
    return this.set(XmlEventType.COMMENT);
  }

  private parseCdata(): TokenCursorResult {
    const end = this.findDelimiter(ResumeKind.CDATA, ']]>', this.pos + 9);
    if (end < 0) return this.incomplete('CDATA');
    validateXmlCharsSpan(this.buffer, this.pos + 9, end);
    this.xmlDeclarationAllowed = false;
    if (!this.stack.length && this.documentMode === 'document') throw new Error('CDATA is not allowed outside the root element.');
    this.currentTextStart = this.pos + 9;
    this.currentTextEnd = end;
    this.pos = end + 3;
    return this.set(XmlEventType.CDATA);
  }

  private parseDoctype(): TokenCursorResult {
    const end = this.findDeclarationEnd(this.pos + 2);
    if (end < 0) return this.incomplete('DOCTYPE');
    validateXmlCharsSpan(this.buffer, this.pos + 2, end);
    if (this.seenDoctype || this.roots !== 0 || this.stack.length !== 0) throw new Error('DOCTYPE must appear once before the root element.');
    this.doctypeRootName = parseDoctypeRootName(this.buffer, this.pos + 9, end);
    this.seenDoctype = true;
    this.xmlDeclarationAllowed = false;
    this.currentTextStart = this.pos + 2;
    this.currentTextEnd = end;
    this.pos = end + 1;
    return this.set(XmlEventType.DTD);
  }

  private parseStart(): TokenCursorResult {
    if (this.resumeKind === ResumeKind.START_TAG && this.findStartTagEnd() < 0) return this.incomplete('start tag');
    const length = this.buffer.length;
    let cursor = this.pos + 1;
    const nameStart = cursor;
    let nameColon = NO_SPAN;
    let colonCount = 0;

    while (cursor < length) {
      const code = this.buffer.charCodeAt(cursor);
      if (isXmlWhitespace(code) || code === 47 || code === 62) break;
      if (cursor === nameStart ? !isNameStart(code) : !isNamePart(code)) {
        throw new Error(`Invalid XML name: ${scanInvalidName(this.buffer, nameStart)}`);
      }
      if (code === 58) { nameColon = cursor; colonCount++; }
      cursor++;
    }
    if (cursor === length) return this.waitForStartTag('start tag');
    const nameEnd = cursor;
    if (cursor === nameStart || colonCount > 1 || nameColon === nameStart || nameColon === nameEnd - 1) {
      throw new Error(`Invalid XML name: ${this.buffer.slice(nameStart, cursor)}`);
    }

    let rawCount = 0;
    let selfClosing = false;
    let tagEnd = NO_SPAN;
    while (cursor < length) {
      while (cursor < length && isXmlWhitespace(this.buffer.charCodeAt(cursor))) cursor++;
      if (cursor === length) return this.waitForStartTag('start tag');
      const code = this.buffer.charCodeAt(cursor);
      if (code === 62) { tagEnd = cursor; break; }
      if (code === 47) {
        selfClosing = true;
        cursor++;
        if (cursor === length) return this.waitForStartTag('start tag');
        if (this.buffer.charCodeAt(cursor) !== 62) throw new Error('Invalid start tag.');
        tagEnd = cursor;
        break;
      }

      this.ensureAttributeCapacity(rawCount + 1);
      const attrStart = cursor;
      let attrHash = HASH_OFFSET;
      let attrColon = NO_SPAN;
      let attrColons = 0;
      while (cursor < length) {
        const attrCode = this.buffer.charCodeAt(cursor);
        if (isXmlWhitespace(attrCode) || attrCode === 61 || attrCode === 47 || attrCode === 62) break;
        if (cursor === attrStart ? !isNameStart(attrCode) : !isNamePart(attrCode)) {
          throw new Error(`Invalid XML name: ${scanInvalidName(this.buffer, attrStart)}`);
        }
        if (attrCode === 58) { attrColon = cursor; attrColons++; }
        attrHash = hashCode(attrHash, attrCode);
        cursor++;
      }
      if (cursor === length) return this.waitForStartTag('start tag');
      const attrEnd = cursor;
      if (attrEnd === attrStart || attrColons > 1 || attrColon === attrStart || attrColon === attrEnd - 1) {
        throw new Error(`Invalid XML name: ${this.buffer.slice(attrStart, attrEnd)}`);
      }
      while (cursor < length && isXmlWhitespace(this.buffer.charCodeAt(cursor))) cursor++;
      if (cursor === length) return this.waitForStartTag('start tag');
      if (this.buffer.charCodeAt(cursor++) !== 61) {
        throw new Error(`Attribute ${this.buffer.slice(attrStart, attrEnd)} requires a value.`);
      }
      while (cursor < length && isXmlWhitespace(this.buffer.charCodeAt(cursor))) cursor++;
      if (cursor === length) return this.waitForStartTag('start tag');
      const quote = this.buffer.charCodeAt(cursor++);
      if (quote !== 34 && quote !== 39) throw new Error(`Attribute ${this.buffer.slice(attrStart, attrEnd)} must be quoted.`);
      const valueStart = cursor;
      const valueEnd = findValidatedAttributeEnd(this.buffer, cursor, quote);
      if (valueEnd < 0) return this.waitForStartTag(`attribute ${this.buffer.slice(attrStart, attrEnd)}`);
      cursor = valueEnd + 1;
      if (cursor < length && !isXmlWhitespace(this.buffer.charCodeAt(cursor))
        && this.buffer.charCodeAt(cursor) !== 47 && this.buffer.charCodeAt(cursor) !== 62) {
        throw new Error('Attributes must be separated by whitespace.');
      }

      if (rawCount < DUPLICATE_TABLE_THRESHOLD) {
        for (let previous = 0; previous < rawCount; previous++) {
          if (this.attributeHashes[previous] === attrHash && spansEqual(
            this.buffer,
            this.attributeNameStarts[previous]!,
            this.attributeNameEnds[previous]!,
            attrStart,
            attrEnd,
          )) throw new Error(`Duplicate attribute: ${this.buffer.slice(attrStart, attrEnd)}`);
        }
      } else {
        const table = this.prepareDuplicateTable(rawCount);
        const mask = table.slots.length - 1;
        let slot = attrHash & mask;
        while (table.generations[slot] === table.generation) {
          const previous = table.slots[slot]!;
          if (this.attributeHashes[previous] === attrHash && spansEqual(
            this.buffer,
            this.attributeNameStarts[previous]!,
            this.attributeNameEnds[previous]!,
            attrStart,
            attrEnd,
          )) throw new Error(`Duplicate attribute: ${this.buffer.slice(attrStart, attrEnd)}`);
          slot = (slot + 1) & mask;
        }
        table.slots[slot] = rawCount;
        table.generations[slot] = table.generation;
      }
      this.attributeNameStarts[rawCount] = attrStart;
      this.attributeNameEnds[rawCount] = attrEnd;
      this.attributeValueStarts[rawCount] = valueStart;
      this.attributeValueEnds[rawCount] = valueEnd;
      this.attributeColons[rawCount] = attrColon;
      this.attributeHashes[rawCount] = attrHash;
      rawCount++;
    }
    if (tagEnd < 0) return this.incomplete('start tag');

    const namespaceUndoStart = this.namespaceUndoLength;
    let name: string;
    let prefix: string;
    let localName: string;
    let namespaceURI: string;
    let publicCount = 0;
    if (!this.namespaceAware) {
      // Namespace processing disabled: report raw qualified names and expose
      // xmlns attributes as ordinary attributes. Mirrors quick-xml's plain Reader
      // and Woodstox's isNamespaceAware(false).
      name = this.buffer.slice(nameStart, nameEnd);
      prefix = nameColon < 0 ? '' : this.buffer.slice(nameStart, nameColon);
      localName = nameColon < 0 ? name : this.buffer.slice(nameColon + 1, nameEnd);
      namespaceURI = '';
      for (let index = 0; index < rawCount; index++) {
        if (publicCount !== index) this.copyAttributeSpan(index, publicCount);
        this.attributeNamespaceURIs[publicCount] = '';
        publicCount++;
      }
      if (!this.stack.length) {
        this.xmlDeclarationAllowed = false;
        if (this.doctypeRootName !== undefined && this.doctypeRootName !== name) throw new Error(`DOCTYPE root ${this.doctypeRootName} does not match root element ${name}.`);
        this.roots++;
        if (this.documentMode === 'document' && (this.roots > 1 || this.seenNonWhitespaceOutsideRoot)) throw new Error('XML document must contain exactly one root element.');
      }
    } else {
    try {
      for (let index = 0; index < rawCount; index++) {
        const start = this.attributeNameStarts[index]!;
        const end = this.attributeNameEnds[index]!;
        const colon = this.attributeColons[index]!;
        if (!isNamespaceDeclaration(this.buffer, start, end, colon)) continue;
        const declaredPrefix = colon < 0 ? '' : this.buffer.slice(colon + 1, end);
        const value = decodeEntities(this.buffer.slice(this.attributeValueStarts[index]!, this.attributeValueEnds[index]!));
        this.bindNamespace(declaredPrefix, value);
      }

      name = this.buffer.slice(nameStart, nameEnd);
      prefix = nameColon < 0 ? '' : this.buffer.slice(nameStart, nameColon);
      localName = nameColon < 0 ? name : this.buffer.slice(nameColon + 1, nameEnd);
      namespaceURI = prefix ? requireNamespace(this.namespaces, prefix) : (this.namespaces.get('') ?? '');

      let qualifiedCount = 0;
      let qualifiedIndices: number[] | undefined;
      let expandedNames: Set<string> | undefined;
      for (let index = 0; index < rawCount; index++) {
        const start = this.attributeNameStarts[index]!;
        const end = this.attributeNameEnds[index]!;
        const colon = this.attributeColons[index]!;
        if (isNamespaceDeclaration(this.buffer, start, end, colon)) continue;
        if (publicCount !== index) this.copyAttributeSpan(index, publicCount);
        const publicColon = this.attributeColons[publicCount]!;
        const attrPrefix = publicColon < 0 ? '' : this.buffer.slice(this.attributeNameStarts[publicCount]!, publicColon);
        const attributeNamespaceURI = attrPrefix ? requireNamespace(this.namespaces, attrPrefix) : '';
        this.attributeNamespaceURIs[publicCount] = attributeNamespaceURI;
        if (attrPrefix) {
          qualifiedIndices ??= [];
          if (qualifiedCount < DUPLICATE_TABLE_THRESHOLD) {
            for (const previous of qualifiedIndices) {
              const previousColon = this.attributeColons[previous]!;
              if (this.attributeNamespaceURIs[previous] === attributeNamespaceURI
                && spansEqual(this.buffer, previousColon + 1, this.attributeNameEnds[previous]!, publicColon + 1, this.attributeNameEnds[publicCount]!)) {
                throw new Error(`Duplicate expanded attribute: ${this.buffer.slice(this.attributeNameStarts[publicCount]!, this.attributeNameEnds[publicCount]!)}`);
              }
            }
          } else {
            if (!expandedNames) {
              expandedNames = new Set<string>();
              for (const previous of qualifiedIndices) {
                const previousColon = this.attributeColons[previous]!;
                expandedNames.add(`${this.attributeNamespaceURIs[previous]}\0${this.buffer.slice(previousColon + 1, this.attributeNameEnds[previous]!)}`);
              }
            }
            const expandedName = `${attributeNamespaceURI}\0${this.buffer.slice(publicColon + 1, this.attributeNameEnds[publicCount]!)}`;
            if (expandedNames.has(expandedName)) throw new Error(`Duplicate expanded attribute: ${this.buffer.slice(this.attributeNameStarts[publicCount]!, this.attributeNameEnds[publicCount]!)}`);
            expandedNames.add(expandedName);
          }
          qualifiedIndices.push(publicCount);
          qualifiedCount++;
        }
        publicCount++;
      }

      if (!this.stack.length) {
        this.xmlDeclarationAllowed = false;
        if (this.doctypeRootName !== undefined && this.doctypeRootName !== name) throw new Error(`DOCTYPE root ${this.doctypeRootName} does not match root element ${name}.`);
        this.roots++;
        if (this.documentMode === 'document' && (this.roots > 1 || this.seenNonWhitespaceOutsideRoot)) throw new Error('XML document must contain exactly one root element.');
      }
    } catch (error) {
      this.restoreNamespaces(namespaceUndoStart);
      throw error;
    }
    }
    const frame = {
      name,
      prefix,
      localName,
      namespaceURI,
      namespaceUndoStart: this.namespaceUndoLength === namespaceUndoStart ? NO_SPAN : namespaceUndoStart,
    };
    if (!selfClosing) this.stack.push(frame);
    else this.pendingEnd = frame;
    this.pos = tagEnd + 1;
    this.currentFrame = frame;
    this.currentNameValue = name;
    this.currentAttributeCount = publicCount;
    return this.set(XmlEventType.START_ELEMENT);
  }

  private parseEnd(): TokenCursorResult {
    const end = this.findDelimiter(ResumeKind.END_TAG, '>', this.pos + 2);
    if (end < 0) return this.incomplete('end tag');
    const start = this.pos + 2;
    if (start >= end || isXmlWhitespace(this.buffer.charCodeAt(start))) throw new Error('Invalid end tag.');
    let nameEnd = end;
    while (nameEnd > start && isXmlWhitespace(this.buffer.charCodeAt(nameEnd - 1))) nameEnd--;
    const name = this.buffer.slice(start, nameEnd);
    const frame = this.stack.pop();
    if (!frame || frame.name !== name) throw new Error(`Mismatched end tag: ${name}`);
    this.pos = end + 1;
    this.currentFrame = frame;
    this.currentNameValue = name;
    this.pendingNamespaceUndoStart = frame.namespaceUndoStart;
    return this.set(XmlEventType.END_ELEMENT);
  }

  private bindNamespace(prefix: string, value: string): void {
    if (prefix === 'xmlns' || value === XMLNS_NAMESPACE_URI) throw new Error('The xmlns namespace is reserved.');
    if ((prefix === 'xml') !== (value === XML_NAMESPACE_URI)) throw new Error('The xml prefix has a reserved namespace binding.');
    if (prefix && value === '') throw new Error(`Namespace prefix ${prefix} cannot be undeclared.`);
    this.ensureNamespaceUndoCapacity(this.namespaceUndoLength + 1);
    const index = this.namespaceUndoLength++;
    const had = this.namespaces.has(prefix);
    this.namespaceUndoPrefixes[index] = prefix;
    this.namespaceUndoPrevious[index] = had ? this.namespaces.get(prefix) : undefined;
    this.namespaceUndoHad[index] = had ? 1 : 0;
    this.namespaces.set(prefix, value);
  }

  private restoreNamespaces(start: number): void {
    for (let index = this.namespaceUndoLength - 1; index >= start; index--) {
      const prefix = this.namespaceUndoPrefixes[index]!;
      if (this.namespaceUndoHad[index] === 1) this.namespaces.set(prefix, this.namespaceUndoPrevious[index]!);
      else this.namespaces.delete(prefix);
      this.namespaceUndoPrefixes[index] = undefined;
      this.namespaceUndoPrevious[index] = undefined;
    }
    this.namespaceUndoLength = start;
  }

  private ensureNamespaceUndoCapacity(required: number): void {
    if (required <= this.namespaceUndoCapacity) return;
    let capacity = this.namespaceUndoCapacity;
    while (capacity < required) capacity *= 2;
    this.namespaceUndoHad = growUint8(this.namespaceUndoHad, capacity);
    this.namespaceUndoCapacity = capacity;
  }

  private materializeAttribute(index: number): TokenAttribute | undefined {
    if (index < 0 || index >= this.currentAttributeCount) return undefined;
    const memo = this.attributeMemos[index];
    if (memo !== undefined && this.attributeMemoEvents[index] === this.currentEvent) return memo;
    const start = this.attributeNameStarts[index]!;
    const end = this.attributeNameEnds[index]!;
    const colon = this.attributeColons[index]!;
    const name = this.buffer.slice(start, end);
    const attribute = {
      name,
      value: decodeEntities(this.buffer.slice(this.attributeValueStarts[index]!, this.attributeValueEnds[index]!)),
      localName: colon < 0 ? name : this.buffer.slice(colon + 1, end),
      prefix: colon < 0 ? '' : this.buffer.slice(start, colon),
      namespaceURI: this.attributeNamespaceURIs[index] ?? '',
    };
    this.attributeMemos[index] = attribute;
    this.attributeMemoEvents[index] = this.currentEvent;
    if (index >= this.attributeMemoHighWater) this.attributeMemoHighWater = index + 1;
    return attribute;
  }

  private copyAttributeSpan(from: number, to: number): void {
    this.attributeNameStarts[to] = this.attributeNameStarts[from]!;
    this.attributeNameEnds[to] = this.attributeNameEnds[from]!;
    this.attributeValueStarts[to] = this.attributeValueStarts[from]!;
    this.attributeValueEnds[to] = this.attributeValueEnds[from]!;
    this.attributeColons[to] = this.attributeColons[from]!;
    this.attributeHashes[to] = this.attributeHashes[from]!;
  }

  private ensureAttributeCapacity(required: number): void {
    if (required <= this.attributeCapacity) return;
    let capacity = this.attributeCapacity;
    while (capacity < required) capacity *= 2;
    this.attributeNameStarts = growInt32(this.attributeNameStarts, capacity);
    this.attributeNameEnds = growInt32(this.attributeNameEnds, capacity);
    this.attributeValueStarts = growInt32(this.attributeValueStarts, capacity);
    this.attributeValueEnds = growInt32(this.attributeValueEnds, capacity);
    this.attributeColons = growInt32(this.attributeColons, capacity, NO_SPAN);
    this.attributeHashes = growUint32(this.attributeHashes, capacity);
    this.attributeMemoEvents = growInt32(this.attributeMemoEvents, capacity);
    this.attributeCapacity = capacity;
  }

  private prepareDuplicateTable(count: number): DuplicateTable {
    const required = (count + 1) * 2;
    let table = this.duplicateTable;
    if (table === undefined || table.slots.length < required) {
      let capacity = 32;
      while (capacity < required) capacity *= 2;
      table = { slots: new Int32Array(capacity), generations: new Uint32Array(capacity), generation: 0 };
      this.duplicateTable = table;
    } else if (count > DUPLICATE_TABLE_THRESHOLD) {
      return table;
    }

    let generation = (table.generation + 1) >>> 0;
    if (generation === 0) {
      table.generations.fill(0);
      generation = 1;
    }
    table.generation = generation;
    const mask = table.slots.length - 1;
    for (let index = 0; index < count; index++) {
      let slot = this.attributeHashes[index]! & mask;
      while (table.generations[slot] === generation) slot = (slot + 1) & mask;
      table.slots[slot] = index;
      table.generations[slot] = generation;
    }
    return table;
  }

  private resumeNext(): TokenCursorResult {
    if (this.resumeKind === ResumeKind.TEXT) return this.parseText();
    if (this.resumeKind === ResumeKind.START_TAG) return this.parseStart();
    if (this.resumeKind === ResumeKind.END_TAG) return this.parseEnd();
    if (this.resumeKind === ResumeKind.COMMENT) return this.parseComment();
    if (this.resumeKind === ResumeKind.CDATA) return this.parseCdata();
    if (this.resumeKind === ResumeKind.PI) return this.parseProcessingInstruction() ?? this.next();
    return this.parseDoctype();
  }

  private waitForStartTag(kind: string): TokenCursorResult {
    if (this.final) return this.incomplete(kind);
    this.findStartTagEnd();
    return NEED_INPUT;
  }

  private findDelimiter(kind: ResumeKind, delimiter: string, start: number): number {
    if (this.resumeKind === kind) {
      if (this.resumeEnd >= 0) {
        const end = this.resumeEnd;
        this.clearResume();
        return end;
      }
      if (this.resumeOffset >= this.buffer.length) {
        if (this.final) this.clearResume();
        return -1;
      }
    }
    const from = this.resumeKind === kind ? this.resumeOffset : start;
    const index = this.buffer.indexOf(delimiter, from);
    if (index >= 0) {
      this.clearResume();
      return index;
    }
    if (this.final) {
      this.clearResume();
      return -1;
    }
    this.resumeKind = kind;
    this.resumeOffset = this.buffer.length;
    this.resumeTail = delimiter.length === 1
      ? ''
      : this.buffer.slice(Math.max(start, this.buffer.length - delimiter.length + 1));
    return -1;
  }

  private findTextEndValidated(start: number): number {
    if (this.resumeKind === ResumeKind.TEXT) {
      const end = this.findDelimiter(ResumeKind.TEXT, '<', start);
      if (end >= 0 || this.final) validateCharDataSpan(this.buffer, start, end < 0 ? this.buffer.length : end);
      return end;
    }
    // The first '<' terminates this text node. Entity references such as
    // '&lt;' contain no literal '<', so this single lookup is the real boundary.
    // Reusing it below avoids an O(n^2) per-entity forward scan.
    const boundary = this.buffer.indexOf('<', start);
    const forbidden = this.buffer.indexOf(']]>', start);
    if (forbidden >= 0 && (boundary < 0 || forbidden < boundary)) {
      throw new Error('Character data cannot contain ]]>');
    }
    for (let index = start; index < this.buffer.length; index++) {
      const code = this.buffer.charCodeAt(index);
      if (code === 60) return index;
      if (code >= 32 && code < 0xd800) {
        if (code !== 38) continue;
      } else if (code < 32) {
        if (code !== 9 && code !== 10 && code !== 13) throw new Error('Invalid XML character.');
        continue;
      } else if (code >= 0xd800 && code <= 0xdfff) {
        if (code > 0xdbff || index + 1 >= this.buffer.length) throw new Error('Invalid XML character.');
        const low = this.buffer.charCodeAt(index + 1);
        if (low < 0xdc00 || low > 0xdfff) throw new Error('Invalid XML character.');
        index++;
        continue;
      } else if (code === 0xfffe || code === 0xffff) {
        throw new Error('Invalid XML character.');
      } else {
        continue;
      }
      const semi = this.buffer.indexOf(';', index + 1);
      const lt = boundary;
      if (lt >= 0 && (semi < 0 || semi > lt)) throw new Error('Unterminated entity reference.');
      if (semi < 0) break;
      decodeEntity(this.buffer.slice(index + 1, semi));
      index = semi;
    }
    if (this.final) {
      validateCharDataSpan(this.buffer, start, this.buffer.length);
      return -1;
    }
    this.resumeKind = ResumeKind.TEXT;
    this.resumeOffset = this.buffer.length;
    return -1;
  }

  private findStartTagEnd(): number {
    if (this.resumeKind === ResumeKind.START_TAG) {
      if (this.resumeEnd >= 0) {
        const end = this.resumeEnd;
        this.clearResume();
        return end;
      }
      if (this.resumeOffset >= this.buffer.length) {
        if (this.final) this.clearResume();
        return -1;
      }
    }
    let index = this.resumeKind === ResumeKind.START_TAG ? this.resumeOffset : this.pos + 1;
    let quote = this.resumeKind === ResumeKind.START_TAG ? this.resumeQuote : 0;
    for (; index < this.buffer.length; index++) {
      const code = this.buffer.charCodeAt(index);
      if (quote) {
        if (code === quote) quote = 0;
      } else if (code === 34 || code === 39) {
        quote = code;
      } else if (code === 62) {
        this.clearResume();
        return index;
      }
    }
    if (this.final) {
      this.clearResume();
      return -1;
    }
    this.resumeKind = ResumeKind.START_TAG;
    this.resumeOffset = index;
    this.resumeQuote = quote;
    return -1;
  }

  private findDeclarationEnd(start: number): number {
    if (this.resumeKind === ResumeKind.DOCTYPE) {
      if (this.resumeEnd >= 0) {
        const end = this.resumeEnd;
        this.clearResume();
        return end;
      }
      if (this.resumeOffset >= this.buffer.length) {
        if (this.final) this.clearResume();
        return -1;
      }
    }
    const resuming = this.resumeKind === ResumeKind.DOCTYPE;
    this.scanDoctypeText(this.buffer, resuming ? this.resumeOffset : start, 0, !resuming);
    if (this.resumeEnd >= 0) {
      const end = this.resumeEnd;
      this.clearResume();
      return end;
    }
    if (this.final) {
      this.clearResume();
      return -1;
    }
    this.resumeKind = ResumeKind.DOCTYPE;
    return -1;
  }

  private scanDoctypeText(text: string, start: number, baseLength: number, reset = false): void {
    let quote = reset ? 0 : this.resumeQuote;
    let brackets = reset ? 0 : this.resumeBrackets;
    let commentState = reset ? DoctypeState.TEXT : this.resumeDoctypeState;
    for (let index = start; index < text.length; index++) {
      const code = text.charCodeAt(index);
      if (commentState !== DoctypeState.TEXT) {
        if (commentState === DoctypeState.LT) {
          if (code === 33) commentState = DoctypeState.BANG;
          else { commentState = DoctypeState.TEXT; index--; }
        } else if (commentState === DoctypeState.BANG) {
          if (code === 45) commentState = DoctypeState.DASH;
          else { commentState = DoctypeState.TEXT; index--; }
        } else if (commentState === DoctypeState.DASH) {
          if (code === 45) commentState = DoctypeState.COMMENT;
          else { commentState = DoctypeState.TEXT; index--; }
        } else if (commentState === DoctypeState.COMMENT) {
          if (code === 45) commentState = DoctypeState.COMMENT_DASH;
        } else if (commentState === DoctypeState.COMMENT_DASH) {
          commentState = code === 45 ? DoctypeState.COMMENT_END : DoctypeState.COMMENT;
        } else if (code === 62) {
          commentState = DoctypeState.TEXT;
        } else if (code !== 45) {
          commentState = DoctypeState.COMMENT;
        }
        continue;
      }
      if (quote) {
        if (code === quote) quote = 0;
        continue;
      }
      if (code === 34 || code === 39) quote = code;
      else if (code === 60) commentState = DoctypeState.LT;
      else if (code === 91) brackets++;
      else if (code === 93) brackets--;
      else if (code === 62 && brackets === 0) {
        this.resumeEnd = baseLength + index;
        break;
      }
    }
    this.resumeOffset = baseLength + text.length;
    this.resumeQuote = quote;
    this.resumeBrackets = brackets;
    this.resumeDoctypeState = commentState;
  }

  private scanPushedText(text: string, baseLength: number): void {
    if (this.resumeEnd >= 0) return;
    if (this.resumeKind === ResumeKind.START_TAG) {
      let quote = this.resumeQuote;
      for (let index = 0; index < text.length; index++) {
        const code = text.charCodeAt(index);
        if (quote) {
          if (code === quote) quote = 0;
          continue;
        }
        if (code === 34 || code === 39) quote = code;
        else if (code === 62) {
          this.resumeEnd = baseLength + index;
          break;
        }
      }
      this.resumeOffset = baseLength + text.length;
      this.resumeQuote = quote;
      return;
    }
    if (this.resumeKind === ResumeKind.DOCTYPE) {
      this.scanDoctypeText(text, 0, baseLength);
      return;
    }

    const delimiter = delimiterFor(this.resumeKind);
    const prefixLength = this.resumeTail.length;
    const combined = this.resumeTail + text;
    const found = combined.indexOf(delimiter);
    if (found >= 0) {
      this.resumeEnd = baseLength - prefixLength + found;
    } else {
      this.resumeTail = delimiter.length === 1
        ? ''
        : combined.slice(Math.max(0, combined.length - delimiter.length + 1));
    }
    this.resumeOffset = baseLength + text.length;
  }

  private clearResume(): void {
    this.resumeKind = ResumeKind.NONE;
    this.resumeOffset = 0;
    this.resumeQuote = 0;
    this.resumeBrackets = 0;
    this.resumeDoctypeState = DoctypeState.TEXT;
    this.resumeEnd = NO_SPAN;
    this.resumeTail = '';
  }

  private releaseRetainedInput(): void {
    this.clearResume();
    this.buffer = '';
    this.pos = 0;
    this.namespaces.clear();
    this.namespaceUndoPrefixes.length = 0;
    this.namespaceUndoPrevious.length = 0;
    this.namespaceUndoHad = new Uint8Array(0);
    this.namespaceUndoCapacity = 0;
    this.attributeNamespaceURIs.length = 0;
    this.attributeMemos.length = 0;
    this.attributeNameStarts = new Int32Array(0);
    this.attributeNameEnds = new Int32Array(0);
    this.attributeValueStarts = new Int32Array(0);
    this.attributeValueEnds = new Int32Array(0);
    this.attributeColons = new Int32Array(0);
    this.attributeHashes = new Uint32Array(0);
    this.attributeMemoEvents = new Int32Array(0);
    this.attributeCapacity = 0;
    this.duplicateTable = undefined;
  }

  private incomplete(kind: string): typeof NEED_INPUT {
    if (this.final) throw new Error(`Unterminated ${kind}.`);
    return NEED_INPUT;
  }
  private set(type: XmlEventTypeValue, preserveTextMemo = false): XmlEventTypeValue {
    for (let index = 0; index < this.attributeMemoHighWater; index++) this.attributeMemos[index] = undefined;
    this.attributeMemoHighWater = 0;
    this.currentEvent = (this.currentEvent + 1) | 0;
    this.currentType = type;
    if (type !== XmlEventType.START_ELEMENT) this.currentAttributeCount = 0;
    if (type !== XmlEventType.CHARACTERS && type !== XmlEventType.CDATA && type !== XmlEventType.COMMENT && type !== XmlEventType.PROCESSING_INSTRUCTION && type !== XmlEventType.DTD) {
      this.currentTextStart = this.currentTextEnd = NO_SPAN;
      this.currentTextMemo = undefined;
    } else if (!preserveTextMemo) {
      this.currentTextMemo = undefined;
    }
    if (type !== XmlEventType.START_ELEMENT && type !== XmlEventType.END_ELEMENT && type !== XmlEventType.PROCESSING_INSTRUCTION) {
      this.currentNameValue = undefined;
      this.currentFrame = undefined;
    }
    return type;
  }
}

function delimiterFor(kind: ResumeKind): string {
  if (kind === ResumeKind.TEXT) return '<';
  if (kind === ResumeKind.END_TAG) return '>';
  if (kind === ResumeKind.COMMENT) return '-->';
  if (kind === ResumeKind.CDATA) return ']]>';
  if (kind === ResumeKind.PI) return '?>';
  throw new Error('Invalid resumable delimiter state.');
}

function decodeEntities(value: string): string {
  if (!value.includes('&')) return value;
  return value.replace(/&([^;]+);/g, (_all, entity: string) => decodeEntity(entity));
}

function decodeEntity(entity: string): string {
  if (entity === 'lt') return '<'; if (entity === 'gt') return '>'; if (entity === 'amp') return '&'; if (entity === 'quot') return '"'; if (entity === 'apos') return "'";
  const cp = /^#x[0-9a-fA-F]+$/.test(entity)
    ? Number.parseInt(entity.slice(2), 16)
    : /^#[0-9]+$/.test(entity) ? Number.parseInt(entity.slice(1), 10) : NaN;
  if (!Number.isInteger(cp) || !isXmlCodePoint(cp)) throw new Error(`Unknown or invalid entity: &${entity};`);
  return String.fromCodePoint(cp);
}

function isXmlCodePoint(code: number): boolean {
  return code === 9 || code === 10 || code === 13
    || (code >= 0x20 && code <= 0xd7ff)
    || (code >= 0xe000 && code <= 0xfffd)
    || (code >= 0x10000 && code <= 0x10ffff);
}

function validateEntitiesSpan(text: string, start: number, end: number, attribute = false): void {
  for (let index = start; index < end; index++) {
    const code = text.charCodeAt(index);
    if (code >= 32 && code < 0xd800) {
      if (attribute && code === 60) throw new Error('Attribute values cannot contain <.');
      if (code !== 38) continue;
    } else if (code < 32) {
      if (code !== 9 && code !== 10 && code !== 13) throw new Error('Invalid XML character.');
    } else if (code >= 0xd800 && code <= 0xdfff) {
      if (code > 0xdbff || index + 1 >= end) throw new Error('Invalid XML character.');
      const low = text.charCodeAt(index + 1);
      if (low < 0xdc00 || low > 0xdfff) throw new Error('Invalid XML character.');
      index++;
      continue;
    } else if (code === 0xfffe || code === 0xffff) {
      throw new Error('Invalid XML character.');
    }
    if (code === 38) {
      const semi = text.indexOf(';', index + 1);
      if (semi < 0 || semi >= end) throw new Error('Unterminated entity reference.');
      decodeEntity(text.slice(index + 1, semi));
      index = semi;
    }
  }
}

function validateXmlCharsSpan(text: string, start: number, end: number): void {
  for (let index = start; index < end; index++) {
    const code = text.charCodeAt(index);
    if (code < 32) {
      if (code !== 9 && code !== 10 && code !== 13) throw new Error('Invalid XML character.');
    } else if (code >= 0xd800 && code <= 0xdfff) {
      if (code > 0xdbff || index + 1 >= end) throw new Error('Invalid XML character.');
      const low = text.charCodeAt(index + 1);
      if (low < 0xdc00 || low > 0xdfff) throw new Error('Invalid XML character.');
      index++;
    } else if (code === 0xfffe || code === 0xffff) {
      throw new Error('Invalid XML character.');
    }
  }
}

function findValidatedAttributeEnd(text: string, start: number, quote: number): number {
  const end = text.indexOf(String.fromCharCode(quote), start);
  if (end < 0) return -1;
  validateEntitiesSpan(text, start, end, true);
  return end;
}

function validateCharDataSpan(text: string, start: number, end: number): void {
  validateEntitiesSpan(text, start, end);
  if (text.indexOf(']]>', start) >= 0 && text.indexOf(']]>', start) < end) {
    throw new Error('Character data cannot contain ]]>');
  }
}

function isXmlWhitespace(code: number): boolean { return code === 32 || code === 9 || code === 10 || code === 13; }
function isAsciiLetter(code: number): boolean { const lower = code | 32; return lower >= 97 && lower <= 122; }
function isNameStart(code: number): boolean { return isAsciiLetter(code) || code === 95 || code === 58 || (code >= 0xc0 && code <= 0xffff); }
function isNamePart(code: number): boolean {
  return isNameStart(code) || (code >= 48 && code <= 57) || code === 46 || code === 45 || (code >= 0xb7 && code <= 0xffff);
}
function isValidName(value: string): boolean {
  if (value.length === 0 || !isNameStart(value.charCodeAt(0))) return false;
  for (let index = 1; index < value.length; index++) if (!isNamePart(value.charCodeAt(index))) return false;
  return true;
}
function isValidXmlDeclaration(value: string): boolean {
  return /^\s+version\s*=\s*(?:"1\.[01]"|'1\.[01]')(?:\s+encoding\s*=\s*(?:"[A-Za-z][A-Za-z0-9._-]*"|'[A-Za-z][A-Za-z0-9._-]*'))?(?:\s+standalone\s*=\s*(?:"(?:yes|no)"|'(?:yes|no)'))?\s*$/.test(value);
}
function parseDoctypeRootName(text: string, start: number, end: number): string {
  while (start < end && isXmlWhitespace(text.charCodeAt(start))) start++;
  let nameEnd = start;
  while (nameEnd < end && !isXmlWhitespace(text.charCodeAt(nameEnd)) && text.charCodeAt(nameEnd) !== 91) nameEnd++;
  const name = text.slice(start, nameEnd);
  if (!isValidName(name)) throw new Error(`Invalid DOCTYPE root name: ${name}`);
  return name;
}

const HASH_OFFSET = 2166136261 >>> 0;
function hashCode(hash: number, code: number): number { return Math.imul(hash ^ code, 16777619) >>> 0; }
function hashString(value: string): number {
  let hash = HASH_OFFSET;
  for (let index = 0; index < value.length; index++) hash = hashCode(hash, value.charCodeAt(index));
  return hash;
}
function spansEqual(text: string, aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  const length = aEnd - aStart;
  if (length !== bEnd - bStart) return false;
  for (let index = 0; index < length; index++) if (text.charCodeAt(aStart + index) !== text.charCodeAt(bStart + index)) return false;
  return true;
}
function spanEqualsString(text: string, start: number, end: number, value: string): boolean {
  if (end - start !== value.length) return false;
  for (let index = 0; index < value.length; index++) if (text.charCodeAt(start + index) !== value.charCodeAt(index)) return false;
  return true;
}
function spanEqualsLiteral(text: string, start: number, end: number, value: string): boolean {
  return spanEqualsString(text, start, end, value);
}
function isNamespaceDeclaration(text: string, start: number, end: number, colon: number): boolean {
  return colon < 0
    ? spanEqualsLiteral(text, start, end, XMLNS)
    : colon === start + XMLNS.length && spanEqualsLiteral(text, start, colon, XMLNS);
}
function requireNamespace(namespaces: Map<string, string>, prefix: string): string {
  const uri = namespaces.get(prefix);
  if (uri === undefined) throw new Error(`Undeclared namespace prefix: ${prefix}`);
  return uri;
}
function scanInvalidName(text: string, start: number): string {
  let end = start;
  while (end < text.length) {
    const code = text.charCodeAt(end);
    if (isXmlWhitespace(code) || code === 47 || code === 62 || code === 61) break;
    end++;
  }
  return text.slice(start, end);
}
function growInt32(source: Int32Array<ArrayBufferLike>, capacity: number, fill?: number): Int32Array<ArrayBuffer> {
  const next = new Int32Array(capacity);
  if (fill !== undefined) next.fill(fill);
  next.set(source);
  return next;
}
function growUint32(source: Uint32Array<ArrayBufferLike>, capacity: number): Uint32Array<ArrayBuffer> {
  const next = new Uint32Array(capacity);
  next.set(source);
  return next;
}
function growUint8(source: Uint8Array<ArrayBufferLike>, capacity: number): Uint8Array<ArrayBuffer> {
  const next = new Uint8Array(capacity);
  next.set(source);
  return next;
}
function isDoctypeBoundary(code: number): boolean { return code === 62 || isXmlWhitespace(code); }
