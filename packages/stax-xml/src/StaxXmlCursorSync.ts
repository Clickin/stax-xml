import { type AttributeInfo, XmlEventType } from './types';
import { AttributeCollector } from './internal/AttributeCollector';
import {
  cloneNamespaces,
  collectAttributesFromSource,
  hasNamespaceDeclarationInSource,
} from './internal/XmlCursorParserUtil';

export interface StaxXmlCursorSyncOptions {
  autoDecodeEntities?: boolean;
  addEntities?: { entity: string, value: string }[];
}

type CursorLifecycleState = 'INITIAL' | 'ACTIVE' | 'DONE' | 'FAILED';

export class StaxXmlCursorSync {
  private readonly xml: string;
  private readonly xmlLength: number;
  private pos = 0;
  private readonly elementStack: string[] = [];
  private readonly namespaceStack: Map<string, string>[] = [new Map<string, string>()];
  private lifecycleState: CursorLifecycleState = 'INITIAL';
  private currentType?: XmlEventType;
  private currentName?: string;
  private currentLocalName?: string;
  private currentPrefix?: string;
  private currentUri?: string;
  private currentText?: string;
  private pendingEndName?: string;
  private pendingEndLocalName?: string;
  private pendingEndPrefix?: string;
  private pendingEndUri?: string;
  private storedError?: Error;

  private static readonly ASCII_TABLE = (() => {
    const table = new Uint8Array(128);
    table[9] = 1;
    table[10] = 1;
    table[13] = 1;
    table[32] = 1;
    table[34] = 8;
    table[39] = 9;
    return table;
  })();

  private static readonly UNICODE_WHITESPACE = new Set([
    0x00A0,
    0x1680,
    0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A,
    0x2028,
    0x2029,
    0x202F,
    0x205F,
    0x3000,
    0xFEFF
  ]);

  private static readonly ENTITY_REGEX_CACHE = new Map<string, RegExp>();
  private static readonly DEFAULT_ENTITY_REGEX = /&(lt|gt|quot|apos|amp);/g;
  private static readonly DEFAULT_ENTITY_MAP: Record<string, string> = {
    lt: '<',
    gt: '>',
    quot: '"',
    apos: '\'',
    amp: '&',
  };

  private readonly entityDecoder: (text: string) => string;
  private readonly attributeCollector: AttributeCollector;

  constructor(xml: string, options: StaxXmlCursorSyncOptions = {}) {
    this.xml = xml;
    this.xmlLength = xml.length;
    this.entityDecoder = this.compileEntityDecoder(options);
    this.attributeCollector = new AttributeCollector(this.entityDecoder);
    this.attributeCollector.reset(this.xml);
  }

  hasNext(): boolean {
    return this.lifecycleState !== 'DONE' && this.lifecycleState !== 'FAILED';
  }

  next(): XmlEventType {
    if (this.lifecycleState === 'FAILED') {
      throw this.storedError;
    }

    try {
      if (this.lifecycleState === 'INITIAL') {
        this.lifecycleState = 'ACTIVE';
        this.currentType = XmlEventType.START_DOCUMENT;
        this.currentName = undefined;
        this.currentLocalName = undefined;
        this.currentPrefix = undefined;
        this.currentUri = undefined;
        this.currentText = undefined;
        return XmlEventType.START_DOCUMENT;
      }

      if (this.pendingEndName !== undefined) {
        this.setCurrent(
          XmlEventType.END_ELEMENT,
          this.pendingEndName,
          this.pendingEndLocalName,
          this.pendingEndPrefix,
          this.pendingEndUri
        );
        this.clearPendingEnd();
        return XmlEventType.END_ELEMENT;
      }

      while (true) {
        if (this.pos >= this.xmlLength) {
          if (this.elementStack.length > 0) {
            return this.fail(new Error('Unexpected end of document. Not all elements were closed.'));
          }

          this.lifecycleState = 'DONE';
          this.currentType = XmlEventType.END_DOCUMENT;
          this.currentName = undefined;
          this.currentLocalName = undefined;
          this.currentPrefix = undefined;
          this.currentUri = undefined;
          this.currentText = undefined;
          return XmlEventType.END_DOCUMENT;
        }

        const ltPos = this.findChar(60, this.pos);
        if (ltPos === -1) {
          const text = this.trimmedSlice(this.pos, this.xmlLength);
          this.pos = this.xmlLength;
          if (!text) {
            continue;
          }

          this.currentType = XmlEventType.CHARACTERS;
          this.currentName = undefined;
          this.currentLocalName = undefined;
          this.currentPrefix = undefined;
          this.currentUri = undefined;
          this.currentText = this.entityDecoder(text);
          return XmlEventType.CHARACTERS;
        }

        if (ltPos > this.pos) {
          const text = this.trimmedSlice(this.pos, ltPos);
          this.pos = ltPos;
          if (!text) {
            continue;
          }

          this.currentType = XmlEventType.CHARACTERS;
          this.currentName = undefined;
          this.currentLocalName = undefined;
          this.currentPrefix = undefined;
          this.currentUri = undefined;
          this.currentText = this.entityDecoder(text);
          return XmlEventType.CHARACTERS;
        }

        const nextCharCode = this.xml.charCodeAt(this.pos + 1);
        if (nextCharCode === 47) {
          return this.parseEndTag();
        }
        if (nextCharCode === 33) {
          const cdataType = this.parseBangConstruct();
          if (cdataType) {
            return cdataType;
          }
          continue;
        }
        if (nextCharCode === 63) {
          this.parseProcessingInstruction();
          continue;
        }

        return this.parseStartTag();
      }
    } catch (error) {
      return this.fail(error as Error);
    }
  }

  get eventType(): XmlEventType | undefined {
    return this.currentType;
  }

  get name(): string | undefined {
    return this.currentName;
  }

  get localName(): string | undefined {
    return this.currentLocalName;
  }

  get prefix(): string | undefined {
    return this.currentPrefix;
  }

  get uri(): string | undefined {
    return this.currentUri;
  }

  get text(): string | undefined {
    return this.currentText;
  }

  getText(): string {
    if (this.currentType !== XmlEventType.CHARACTERS && this.currentType !== XmlEventType.CDATA) {
      throw new Error('Current token does not expose text.');
    }

    return this.currentText!;
  }

  getAttributes(): Record<string, string> {
    this.assertStartElementToken();
    return this.attributeCollector.getAttributes();
  }

  getAttributesWithPrefix(): Record<string, AttributeInfo> {
    this.assertStartElementToken();
    return this.attributeCollector.getAttributesWithPrefix();
  }

  getAttributeValue(rawName: string): string | undefined {
    this.assertStartElementToken();
    return this.attributeCollector.getAttributeValue(rawName);
  }

  private parseStartTag(): XmlEventType {
    const tagStart = this.pos + 1;
    const tagEnd = this.findTagEnd(tagStart);
    if (tagEnd === -1) {
      throw new Error('Unclosed start tag');
    }

    let actualEnd = tagEnd;
    let isSelfClosing = false;
    if (this.xml.charCodeAt(tagEnd - 1) === 47) {
      actualEnd = tagEnd - 1;
      isSelfClosing = true;
    }

    let nameEnd = tagStart;
    while (nameEnd < actualEnd) {
      const code = this.xml.charCodeAt(nameEnd);
      if (code <= 32) {
        if (StaxXmlCursorSync.isWhitespace(code)) {
          break;
        }
      } else if (code === 62 || code === 47) {
        break;
      }
      nameEnd++;
    }

    const tagName = this.xml.slice(tagStart, nameEnd);
    const parentNamespaces = this.namespaceStack[this.namespaceStack.length - 1];
    const hasNamespaceDeclarations = hasNamespaceDeclarationInSource(
      this.xml,
      nameEnd,
      actualEnd,
      StaxXmlCursorSync.isWhitespace
    );
    const namespaces = hasNamespaceDeclarations ? cloneNamespaces(parentNamespaces) : parentNamespaces;
    collectAttributesFromSource(
      this.xml,
      nameEnd,
      actualEnd,
      namespaces,
      this.attributeCollector,
      this.entityDecoder,
      StaxXmlCursorSync.isWhitespace,
      hasNamespaceDeclarations
    );

    const colonIndex = tagName.indexOf(':');
    const prefix = colonIndex === -1 ? undefined : tagName.slice(0, colonIndex);
    const localName = colonIndex === -1 ? tagName : tagName.slice(colonIndex + 1);
    const uri = prefix === undefined ? namespaces.get('') : namespaces.get(prefix);
    this.currentType = XmlEventType.START_ELEMENT;
    this.currentName = tagName;
    this.currentLocalName = localName;
    this.currentPrefix = prefix;
    this.currentUri = uri;
    this.currentText = undefined;

    this.pos = tagEnd + 1;

    if (isSelfClosing) {
      this.pendingEndName = tagName;
      this.pendingEndLocalName = localName;
      this.pendingEndPrefix = prefix;
      this.pendingEndUri = uri;
      return XmlEventType.START_ELEMENT;
    }

    this.elementStack.push(tagName);
    this.namespaceStack.push(namespaces);
    return XmlEventType.START_ELEMENT;
  }

  private parseEndTag(): XmlEventType {
    const tagClose = this.findChar(62, this.pos);
    if (tagClose === -1) {
      throw new Error('Unclosed end tag');
    }

    const fullTagName = this.trimmedSlice(this.pos + 2, tagClose);
    if (this.elementStack.length === 0) {
      throw new Error(`Mismatched closing tag: </${fullTagName}>. No open elements.`);
    }

    const expectedTagName = this.elementStack[this.elementStack.length - 1];
    if (fullTagName !== expectedTagName) {
      throw new Error(`Mismatched closing tag: </${fullTagName}>. Expected </${expectedTagName}>.`);
    }

    this.elementStack.pop();
    const namespaces = this.namespaceStack.pop() ?? new Map<string, string>();
    const colonIndex = fullTagName.indexOf(':');
    const prefix = colonIndex === -1 ? undefined : fullTagName.slice(0, colonIndex);
    this.currentType = XmlEventType.END_ELEMENT;
    this.currentName = fullTagName;
    this.currentLocalName = colonIndex === -1 ? fullTagName : fullTagName.slice(colonIndex + 1);
    this.currentPrefix = prefix;
    this.currentUri = prefix === undefined ? namespaces.get('') : namespaces.get(prefix);
    this.currentText = undefined;
    this.pos = tagClose + 1;
    return XmlEventType.END_ELEMENT;
  }

  private parseBangConstruct(): XmlEventType | undefined {
    if (this.matchesAt('<![CDATA[', this.pos)) {
      const cdataEnd = this.findSequence(']]>', this.pos + 9);
      if (cdataEnd === -1) {
        throw new Error('Unclosed CDATA section');
      }

      this.currentType = XmlEventType.CDATA;
      this.currentName = undefined;
      this.currentLocalName = undefined;
      this.currentPrefix = undefined;
      this.currentUri = undefined;
      this.currentText = this.xml.slice(this.pos + 9, cdataEnd);
      this.pos = cdataEnd + 3;
      return XmlEventType.CDATA;
    }

    if (this.matchesAt('<!--', this.pos)) {
      const commentEnd = this.findSequence('-->', this.pos + 4);
      if (commentEnd === -1) {
        throw new Error('Unclosed comment');
      }

      this.pos = commentEnd + 3;
      return undefined;
    }

    if (this.matchesAt('<!DOCTYPE', this.pos)) {
      const doctypeEnd = this.findDoctypeEnd(this.pos + 9);
      if (doctypeEnd === -1) {
        throw new Error('Unclosed DOCTYPE declaration');
      }

      this.pos = doctypeEnd + 1;
      return undefined;
    }

    throw new Error(`Malformed XML near position ${this.pos}`);
  }

  private parseProcessingInstruction(): void {
    const piEnd = this.findSequence('?>', this.pos);
    if (piEnd === -1) {
      throw new Error('Unclosed processing instruction');
    }

    this.pos = piEnd + 2;
  }

  private compileEntityDecoder(options: StaxXmlCursorSyncOptions): (text: string) => string {
    if (options.autoDecodeEntities === false) {
      return (text) => text;
    }

    if (options.addEntities && options.addEntities.length > 0) {
      const entityMap: Record<string, string> = { ...StaxXmlCursorSync.DEFAULT_ENTITY_MAP };
      const patterns: string[] = ['lt', 'gt', 'quot', 'apos'];

      for (const { entity, value } of options.addEntities) {
        if (entity && value) {
          const key = entity.startsWith('&') && entity.endsWith(';')
            ? entity.slice(1, -1)
            : entity;
          entityMap[key] = value;
          patterns.push(key);
        }
      }
      patterns.push('amp');

      const cacheKey = patterns.join(',');
      let regex = StaxXmlCursorSync.ENTITY_REGEX_CACHE.get(cacheKey);
      if (!regex) {
        const pattern = patterns
          .sort((left, right) => right.length - left.length)
          .map((entity) => entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|');
        regex = new RegExp(`&(${pattern});`, 'g');
        StaxXmlCursorSync.ENTITY_REGEX_CACHE.set(cacheKey, regex);
      }

      return (text: string) => {
        if (!text || text.indexOf('&') === -1) {
          return text;
        }
        regex.lastIndex = 0;
        return text.replace(regex, (_, entity) => entityMap[entity] || _);
      };
    }

    return (text: string) => {
      if (!text || text.indexOf('&') === -1) {
        return text;
      }
      StaxXmlCursorSync.DEFAULT_ENTITY_REGEX.lastIndex = 0;
      return text.replace(
        StaxXmlCursorSync.DEFAULT_ENTITY_REGEX,
        (_, entity) => StaxXmlCursorSync.DEFAULT_ENTITY_MAP[entity] || _
      );
    };
  }

  private fail(error: Error): XmlEventType {
    this.lifecycleState = 'FAILED';
    this.storedError = error;
    this.clearCurrent();
    throw error;
  }

  private assertStartElementToken(): void {
    if (this.currentType !== XmlEventType.START_ELEMENT) {
      throw new Error('Current token does not expose attributes.');
    }
  }

  private clearCurrent(): void {
    this.currentType = undefined;
    this.currentName = undefined;
    this.currentLocalName = undefined;
    this.currentPrefix = undefined;
    this.currentUri = undefined;
    this.currentText = undefined;
  }

  private clearPendingEnd(): void {
    this.pendingEndName = undefined;
    this.pendingEndLocalName = undefined;
    this.pendingEndPrefix = undefined;
    this.pendingEndUri = undefined;
  }

  private setCurrent(
    type: XmlEventType,
    name?: string,
    localName?: string,
    prefix?: string,
    uri?: string,
    text?: string
  ): void {
    this.currentType = type;
    this.currentName = name;
    this.currentLocalName = localName;
    this.currentPrefix = prefix;
    this.currentUri = uri;
    this.currentText = text;
  }

  private findChar(targetCode: number, start = this.pos): number {
    const len16 = this.xmlLength - 15;
    let i = start;

    for (; i < len16; i += 16) {
      if (this.xml.charCodeAt(i) === targetCode) return i;
      if (this.xml.charCodeAt(i + 1) === targetCode) return i + 1;
      if (this.xml.charCodeAt(i + 2) === targetCode) return i + 2;
      if (this.xml.charCodeAt(i + 3) === targetCode) return i + 3;
      if (this.xml.charCodeAt(i + 4) === targetCode) return i + 4;
      if (this.xml.charCodeAt(i + 5) === targetCode) return i + 5;
      if (this.xml.charCodeAt(i + 6) === targetCode) return i + 6;
      if (this.xml.charCodeAt(i + 7) === targetCode) return i + 7;
      if (this.xml.charCodeAt(i + 8) === targetCode) return i + 8;
      if (this.xml.charCodeAt(i + 9) === targetCode) return i + 9;
      if (this.xml.charCodeAt(i + 10) === targetCode) return i + 10;
      if (this.xml.charCodeAt(i + 11) === targetCode) return i + 11;
      if (this.xml.charCodeAt(i + 12) === targetCode) return i + 12;
      if (this.xml.charCodeAt(i + 13) === targetCode) return i + 13;
      if (this.xml.charCodeAt(i + 14) === targetCode) return i + 14;
      if (this.xml.charCodeAt(i + 15) === targetCode) return i + 15;
    }

    for (; i < this.xmlLength; i++) {
      if (this.xml.charCodeAt(i) === targetCode) {
        return i;
      }
    }

    return -1;
  }

  private matchesAt(value: string, pos: number): boolean {
    if (pos + value.length > this.xmlLength) {
      return false;
    }

    for (let i = 0; i < value.length; i++) {
      if (this.xml.charCodeAt(pos + i) !== value.charCodeAt(i)) {
        return false;
      }
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
    const maxPos = this.xmlLength - sequence.length;
    for (let i = start; i <= maxPos; i++) {
      let match = true;
      for (let j = 0; j < sequence.length; j++) {
        if (this.xml.charCodeAt(i + j) !== sequence.charCodeAt(j)) {
          match = false;
          break;
        }
      }
      if (match) {
        return i;
      }
    }
    return -1;
  }

  private findDoctypeEnd(start: number): number {
    let position = start;
    let bracketDepth = 0;
    let quoteChar = 0;
    let inComment = false;

    while (position < this.xmlLength) {
      const currentChar = this.xml.charCodeAt(position);

      if (inComment) {
        if (this.matchesAt('-->', position)) {
          inComment = false;
          position += 3;
          continue;
        }
        position++;
        continue;
      }

      if (quoteChar !== 0) {
        if (currentChar === quoteChar) {
          quoteChar = 0;
        }
        position++;
        continue;
      }

      if (currentChar === 34 || currentChar === 39) {
        quoteChar = currentChar;
        position++;
        continue;
      }

      if (this.matchesAt('<!--', position)) {
        inComment = true;
        position += 4;
        continue;
      }

      if (currentChar === 91) {
        bracketDepth++;
        position++;
        continue;
      }

      if (currentChar === 93) {
        if (bracketDepth > 0) {
          bracketDepth--;
        }
        position++;
        continue;
      }

      if (currentChar === 62 && bracketDepth === 0) {
        return position;
      }

      position++;
    }

    return -1;
  }

  private trimmedSlice(start: number, end: number): string {
    while (start < end && StaxXmlCursorSync.isWhitespace(this.xml.charCodeAt(start))) {
      start++;
    }
    while (end > start && StaxXmlCursorSync.isWhitespace(this.xml.charCodeAt(end - 1))) {
      end--;
    }
    return start < end ? this.xml.slice(start, end) : '';
  }

  private static isWhitespace(code: number): boolean {
    if (code < 128) {
      return StaxXmlCursorSync.ASCII_TABLE[code] === 1;
    }
    return code <= 32 || StaxXmlCursorSync.UNICODE_WHITESPACE.has(code);
  }
}

export default StaxXmlCursorSync;
