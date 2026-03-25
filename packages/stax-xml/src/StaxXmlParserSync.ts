import {
  type AnyXmlEvent,
  type AttributeInfo,
  type CdataEvent,
  type CharactersEvent,
  type EndDocumentEvent,
  type EndElementEvent,
  type StartElementEvent,
  XmlEventType,
} from './types';

export interface StaxXmlParserSyncOptions {
  autoDecodeEntities?: boolean;
  addEntities?: { entity: string, value: string }[];
}

export class StaxXmlParserSync implements Iterable<AnyXmlEvent>, Iterator<AnyXmlEvent> {
  private readonly xml: string;
  private readonly xmlLength: number;
  private pos = 0;
  private readonly elementStack: string[] = [];
  private namespaceStack: Map<string, string>[] = [];
  private readonly options: StaxXmlParserSyncOptions;
  private internalIterator?: Generator<AnyXmlEvent>;

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
    0x00A0,
    0x1680,
    0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A,
    0x2028,
    0x2029,
    0x202F,
    0x205F,
    0x3000,
    0xFEFF,
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

  constructor(xml: string, options: StaxXmlParserSyncOptions = {}) {
    this.xml = xml;
    this.xmlLength = xml.length;
    this.options = {
      autoDecodeEntities: true,
      ...options,
    };

    this.namespaceStack.push(new Map<string, string>());
    this.entityDecoder = this.compileEntityDecoder();
  }

  public [Symbol.iterator](): Iterator<AnyXmlEvent> {
    return this;
  }

  public next(): IteratorResult<AnyXmlEvent> {
    if (!this.internalIterator) {
      this.internalIterator = this.internalGenerator();
    }

    return this.consumeIterator(this.internalIterator);
  }

  private *internalGenerator(): Generator<AnyXmlEvent> {
    yield {
      type: XmlEventType.START_DOCUMENT,
      name: undefined,
      localName: undefined,
      prefix: undefined,
      uri: undefined,
      attributes: undefined,
      attributesWithPrefix: undefined,
      value: undefined,
      error: undefined,
    } as unknown as StartElementEvent;

    while (this.pos < this.xmlLength) {
      const ltPos = this.findChar(60, this.pos);

      if (ltPos === -1) {
        if (this.pos < this.xmlLength) {
          const text = this.trimmedSlice(this.pos, this.xmlLength);
          if (text) {
            yield {
              type: XmlEventType.CHARACTERS,
              name: undefined,
              localName: undefined,
              prefix: undefined,
              uri: undefined,
              attributes: undefined,
              attributesWithPrefix: undefined,
              value: this.entityDecoder(text),
              error: undefined,
            } as unknown as CharactersEvent;
          }
        }
        break;
      }

      if (ltPos > this.pos) {
        const text = this.trimmedSlice(this.pos, ltPos);
        if (text) {
          yield {
            type: XmlEventType.CHARACTERS,
            name: undefined,
            localName: undefined,
            prefix: undefined,
            uri: undefined,
            attributes: undefined,
            attributesWithPrefix: undefined,
            value: this.entityDecoder(text),
            error: undefined,
          } as unknown as CharactersEvent;
        }
      }

      this.pos = ltPos;
      const nextCharCode = this.xml.charCodeAt(this.pos + 1);

      switch (nextCharCode) {
        case 47:
          yield* this.parseEndTag();
          break;
        case 33:
          yield* this.parseCdataCommentDoctype();
          break;
        case 63:
          yield* this.parseProcessingInstruction();
          break;
        default:
          yield* this.parseStartTag();
          break;
      }
    }

    yield {
      type: XmlEventType.END_DOCUMENT,
      name: undefined,
      localName: undefined,
      prefix: undefined,
      uri: undefined,
      attributes: undefined,
      attributesWithPrefix: undefined,
      value: undefined,
      error: undefined,
    } as unknown as EndDocumentEvent;
  }

  private *parseEndTag(): Generator<AnyXmlEvent> {
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
    const currentNamespaces = this.namespaceStack.pop();

    const colonIndex = fullTagName.indexOf(':');
    let localName: string;
    let prefix: string | undefined;
    let uri: string | undefined;

    if (colonIndex === -1) {
      localName = fullTagName;
      prefix = undefined;
      uri = currentNamespaces ? currentNamespaces.get('') : undefined;
    } else {
      prefix = fullTagName.slice(0, colonIndex);
      localName = fullTagName.slice(colonIndex + 1);
      uri = currentNamespaces ? currentNamespaces.get(prefix) : undefined;
    }

    yield {
      type: XmlEventType.END_ELEMENT,
      name: fullTagName,
      localName,
      prefix,
      uri,
      attributes: undefined,
      attributesWithPrefix: undefined,
      value: undefined,
      error: undefined,
    } as unknown as EndElementEvent;

    this.pos = tagClose + 1;
  }

  private *parseCdataCommentDoctype(): Generator<AnyXmlEvent> {
    if (this.matchesAt('<![CDATA[', this.pos)) {
      const cdataEnd = this.findSequence(']]>', this.pos + 9);
      if (cdataEnd === -1) {
        throw new Error('Unclosed CDATA section');
      }

      yield {
        type: XmlEventType.CDATA,
        name: undefined,
        localName: undefined,
        prefix: undefined,
        uri: undefined,
        attributes: undefined,
        attributesWithPrefix: undefined,
        value: this.xml.slice(this.pos + 9, cdataEnd),
        error: undefined,
      } as unknown as CdataEvent;

      this.pos = cdataEnd + 3;
      return;
    }

    if (this.matchesAt('<!--', this.pos)) {
      const commentEnd = this.findSequence('-->', this.pos + 4);
      if (commentEnd === -1) {
        throw new Error('Unclosed comment');
      }
      this.pos = commentEnd + 3;
      return;
    }

    if (this.matchesAt('<!DOCTYPE', this.pos)) {
      const doctypeEnd = this.findDoctypeEnd(this.pos + 9);
      if (doctypeEnd === -1) {
        throw new Error('Unclosed DOCTYPE declaration');
      }
      this.pos = doctypeEnd + 1;
      return;
    }
  }

  private *parseProcessingInstruction(): Generator<AnyXmlEvent> {
    const piEnd = this.findSequence('?>', this.pos);
    if (piEnd === -1) {
      throw new Error('Unclosed processing instruction');
    }
    this.pos = piEnd + 2;
  }

  private *parseStartTag(): Generator<AnyXmlEvent> {
    const tagStart = this.pos + 1;
    const tagEnd = this.findTagEnd(tagStart);
    if (tagEnd === -1) {
      throw new Error('Unclosed start tag');
    }

    let isSelfClosing = false;
    let actualEnd = tagEnd;
    if (this.xml.charCodeAt(tagEnd - 1) === 47) {
      isSelfClosing = true;
      actualEnd = tagEnd - 1;
    }

    let nameEnd = tagStart;
    const xml = this.xml;
    while (nameEnd < actualEnd) {
      const code = xml.charCodeAt(nameEnd);
      if (code <= 32) {
        if (StaxXmlParserSync.isWhitespace(code)) break;
      } else if (code === 62 || code === 47) {
        break;
      }
      nameEnd++;
    }

    const tagName = xml.slice(tagStart, nameEnd);
    const parentNamespaces = this.namespaceStack[this.namespaceStack.length - 1] ?? new Map<string, string>();

    const { attributes, attributesWithPrefix, namespaces } = this.parseAttributesFast(
      nameEnd,
      actualEnd,
      parentNamespaces
    );

    const colonIndex = tagName.indexOf(':');
    let localName: string;
    let prefix: string | undefined;
    let uri: string | undefined;

    if (colonIndex === -1) {
      localName = tagName;
      prefix = undefined;
      uri = namespaces.get('');
    } else {
      prefix = tagName.slice(0, colonIndex);
      localName = tagName.slice(colonIndex + 1);
      uri = namespaces.get(prefix);
    }

    yield {
      type: XmlEventType.START_ELEMENT,
      name: tagName,
      localName,
      prefix,
      uri,
      attributes,
      attributesWithPrefix,
      value: undefined,
      error: undefined,
    } as unknown as StartElementEvent;

    this.elementStack.push(tagName);

    if (!isSelfClosing) {
      this.namespaceStack.push(namespaces);
    } else {
      yield {
        type: XmlEventType.END_ELEMENT,
        name: tagName,
        localName,
        prefix,
        uri,
        attributes: undefined,
        attributesWithPrefix: undefined,
        value: undefined,
        error: undefined,
      } as unknown as EndElementEvent;
      this.elementStack.pop();
    }

    this.pos = tagEnd + 1;
  }

  private parseAttributesFast(
    start: number,
    end: number,
    parentNamespaces: Map<string, string>
  ): {
    attributes: Record<string, string>;
    attributesWithPrefix: Record<string, AttributeInfo>;
    namespaces: Map<string, string>;
  } {
    if (start >= end) {
      return {
        attributes: {},
        attributesWithPrefix: {},
        namespaces: parentNamespaces,
      };
    }

    const attributes: Record<string, string> = {};
    const attributesWithPrefix: Record<string, AttributeInfo> = {};
    let namespaces = parentNamespaces;
    let ownsNamespaces = false;
    const xml = this.xml;

    let index = start;
    while (index < end) {
      while (index < end && StaxXmlParserSync.isWhitespace(xml.charCodeAt(index))) {
        index++;
      }
      if (index >= end) {
        break;
      }

      const nameStart = index;
      while (index < end) {
        const code = xml.charCodeAt(index);
        if (code === 61 || StaxXmlParserSync.isWhitespace(code)) {
          break;
        }
        index++;
      }

      if (index === nameStart) {
        break;
      }
      const attrName = xml.slice(nameStart, index);

      while (index < end && StaxXmlParserSync.isWhitespace(xml.charCodeAt(index))) {
        index++;
      }
      if (index >= end || xml.charCodeAt(index) !== 61) {
        attributes[attrName] = 'true';

        const colonIndex = attrName.indexOf(':');
        let localName: string;
        let prefix: string | undefined;
        let uri: string | undefined;

        if (colonIndex === -1) {
          localName = attrName;
          prefix = undefined;
          uri = undefined;
        } else {
          prefix = attrName.slice(0, colonIndex);
          localName = attrName.slice(colonIndex + 1);
          uri = namespaces.get(prefix);
        }

        attributesWithPrefix[attrName] = { value: 'true', localName, prefix, uri };
        continue;
      }

      index++;
      while (index < end && StaxXmlParserSync.isWhitespace(xml.charCodeAt(index))) {
        index++;
      }
      if (index >= end) {
        break;
      }

      const quote = xml.charCodeAt(index);
      if (quote !== 34 && quote !== 39) {
        break;
      }

      index++;
      const valueStart = index;
      while (index < end && xml.charCodeAt(index) !== quote) {
        index++;
      }

      const attrValue = this.entityDecoder(xml.slice(valueStart, index));
      attributes[attrName] = attrValue;

      if (attrName === 'xmlns') {
        if (!ownsNamespaces) {
          namespaces = new Map<string, string>(parentNamespaces);
          ownsNamespaces = true;
        }
        namespaces.set('', attrValue);
      } else if (attrName.startsWith('xmlns:')) {
        if (!ownsNamespaces) {
          namespaces = new Map<string, string>(parentNamespaces);
          ownsNamespaces = true;
        }
        namespaces.set(attrName.slice(6), attrValue);
      }

      const colonIndex = attrName.indexOf(':');
      let localName: string;
      let prefix: string | undefined;
      let uri: string | undefined;

      if (colonIndex === -1) {
        localName = attrName;
        prefix = undefined;
        uri = undefined;
      } else {
        prefix = attrName.slice(0, colonIndex);
        localName = attrName.slice(colonIndex + 1);
        uri = namespaces.get(prefix);
      }

      if (attrName.startsWith('xmlns')) {
        if (attrName === 'xmlns') {
          localName = 'xmlns';
          prefix = undefined;
        } else {
          localName = attrName.slice(6);
          prefix = 'xmlns';
        }
      }

      attributesWithPrefix[attrName] = {
        value: attrValue,
        localName,
        prefix,
        uri,
      };

      index++;
    }

    return { attributes, attributesWithPrefix, namespaces };
  }

  /**
   * Keep the steady-state path free of try/catch so V8 can optimize `next()`.
   * Error-to-event conversion stays in this cold helper to preserve the public contract.
   */
  private consumeIterator(iterator: Generator<AnyXmlEvent>): IteratorResult<AnyXmlEvent> {
    try {
      return iterator.next();
    } catch (error) {
      return {
        value: {
          type: XmlEventType.ERROR,
          name: undefined,
          localName: undefined,
          prefix: undefined,
          uri: undefined,
          attributes: undefined,
          attributesWithPrefix: undefined,
          value: undefined,
          error: error as Error,
        } as unknown as AnyXmlEvent,
        done: false,
      };
    }
  }

  private findTagEnd(start: number): number {
    let index = start;
    let inQuote = false;
    let quoteChar = 0;

    while (index < this.xmlLength) {
      const code = this.xml.charCodeAt(index);
      if (code === 34 || code === 39) {
        if (!inQuote) {
          inQuote = true;
          quoteChar = code;
        } else if (code === quoteChar) {
          inQuote = false;
          quoteChar = 0;
        }
      } else if (code === 62 && !inQuote) {
        return index;
      }
      index++;
    }

    return -1;
  }

  private findSequence(sequence: string, start: number): number {
    const sequenceLength = sequence.length;
    const maxPos = this.xmlLength - sequenceLength;

    for (let index = start; index <= maxPos; index++) {
      let matches = true;
      for (let offset = 0; offset < sequenceLength; offset++) {
        if (this.xml.charCodeAt(index + offset) !== sequence.charCodeAt(offset)) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return index;
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

  private findChar(targetCode: number, start: number = this.pos): number {
    const len16 = this.xmlLength - 15;
    let index = start;

    for (; index < len16; index += 16) {
      if (this.xml.charCodeAt(index) === targetCode) return index;
      if (this.xml.charCodeAt(index + 1) === targetCode) return index + 1;
      if (this.xml.charCodeAt(index + 2) === targetCode) return index + 2;
      if (this.xml.charCodeAt(index + 3) === targetCode) return index + 3;
      if (this.xml.charCodeAt(index + 4) === targetCode) return index + 4;
      if (this.xml.charCodeAt(index + 5) === targetCode) return index + 5;
      if (this.xml.charCodeAt(index + 6) === targetCode) return index + 6;
      if (this.xml.charCodeAt(index + 7) === targetCode) return index + 7;
      if (this.xml.charCodeAt(index + 8) === targetCode) return index + 8;
      if (this.xml.charCodeAt(index + 9) === targetCode) return index + 9;
      if (this.xml.charCodeAt(index + 10) === targetCode) return index + 10;
      if (this.xml.charCodeAt(index + 11) === targetCode) return index + 11;
      if (this.xml.charCodeAt(index + 12) === targetCode) return index + 12;
      if (this.xml.charCodeAt(index + 13) === targetCode) return index + 13;
      if (this.xml.charCodeAt(index + 14) === targetCode) return index + 14;
      if (this.xml.charCodeAt(index + 15) === targetCode) return index + 15;
    }

    for (; index < this.xmlLength; index++) {
      if (this.xml.charCodeAt(index) === targetCode) {
        return index;
      }
    }

    return -1;
  }

  private matchesAt(value: string, pos: number): boolean {
    const length = value.length;
    if (pos + length > this.xmlLength) {
      return false;
    }

    for (let index = 0; index < length; index++) {
      if (this.xml.charCodeAt(pos + index) !== value.charCodeAt(index)) {
        return false;
      }
    }

    return true;
  }

  private trimmedSlice(start: number, end: number): string {
    while (start < end && StaxXmlParserSync.isWhitespace(this.xml.charCodeAt(start))) {
      if (StaxXmlParserSync.isHighSurrogate(this.xml.charCodeAt(start))) {
        start += 2;
      } else {
        start++;
      }
    }

    while (end > start && StaxXmlParserSync.isWhitespace(this.xml.charCodeAt(end - 1))) {
      if (
        end > start + 1 &&
        StaxXmlParserSync.isLowSurrogate(this.xml.charCodeAt(end - 1)) &&
        StaxXmlParserSync.isHighSurrogate(this.xml.charCodeAt(end - 2))
      ) {
        end -= 2;
      } else {
        end--;
      }
    }

    return start < end ? this.xml.slice(start, end) : '';
  }

  private compileEntityDecoder(): (text: string) => string {
    if (!this.options.autoDecodeEntities) {
      return (text) => text;
    }

    if (this.options.addEntities && this.options.addEntities.length > 0) {
      const entityMap: Record<string, string> = { ...StaxXmlParserSync.DEFAULT_ENTITY_MAP };
      const patterns: string[] = ['lt', 'gt', 'quot', 'apos'];

      for (const { entity, value } of this.options.addEntities) {
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
      let regex = StaxXmlParserSync.ENTITY_REGEX_CACHE.get(cacheKey);
      if (!regex) {
        const pattern = patterns
          .sort((left, right) => right.length - left.length)
          .map((entity) => entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|');
        regex = new RegExp(`&(${pattern});`, 'g');
        StaxXmlParserSync.ENTITY_REGEX_CACHE.set(cacheKey, regex);
      }

      return (text: string) => {
        if (!text || text.indexOf('&') === -1) {
          return text;
        }
        regex!.lastIndex = 0;
        return text.replace(regex!, (_, entity) => entityMap[entity] || _);
      };
    }

    return (text: string) => {
      if (!text || text.indexOf('&') === -1) {
        return text;
      }
      StaxXmlParserSync.DEFAULT_ENTITY_REGEX.lastIndex = 0;
      return text.replace(
        StaxXmlParserSync.DEFAULT_ENTITY_REGEX,
        (_, entity) => StaxXmlParserSync.DEFAULT_ENTITY_MAP[entity] || _
      );
    };
  }

  private static isWhitespace(code: number): boolean {
    if (code < 128) {
      return StaxXmlParserSync.ASCII_TABLE[code] === 1;
    }
    return code <= 32 || StaxXmlParserSync.UNICODE_WHITESPACE.has(code);
  }

  private static isHighSurrogate(code: number): boolean {
    return code >= 0xD800 && code <= 0xDBFF;
  }

  private static isLowSurrogate(code: number): boolean {
    return code >= 0xDC00 && code <= 0xDFFF;
  }
}

export default StaxXmlParserSync;
