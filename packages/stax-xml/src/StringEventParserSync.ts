import {
  type AnyXmlEvent,
  type AttributeInfo,
  type CdataEvent,
  type CharactersEvent,
  type EndDocumentEvent,
  type EndElementEvent,
  type ParserEventFilter,
  type StartDocumentEvent,
  type StartElementEvent,
  XmlEventType,
} from './types.js';

export interface StringEventParserSyncOptions {
  autoDecodeEntities?: boolean;
  addEntities?: { entity: string; value: string }[];
  eventFilter?: ParserEventFilter;
  namespaceAware?: boolean;
}

enum ParserState {
  INITIAL = 0,
  PARSING = 1,
  DONE = 2,
}

export class StringEventParserSync implements Iterable<AnyXmlEvent>, Iterator<AnyXmlEvent> {
  private readonly xml: string;
  private readonly xmlLength: number;
  private pos = 0;
  private readonly elementStack: string[] = [];
  private namespaceStack: Map<string, string>[] = [];
  private readonly entityDecoder: (text: string) => string;
  private readonly eventFilter?: ParserEventFilter;
  private readonly namespaceAware: boolean;
  private state: ParserState = ParserState.INITIAL;
  private pendingEvent: AnyXmlEvent | null = null;

  private readonly iteratorResult: IteratorResult<AnyXmlEvent> = {
    value: undefined as unknown as AnyXmlEvent,
    done: false,
  };
  private readonly doneResult: IteratorResult<AnyXmlEvent> = {
    value: undefined,
    done: true,
  };

  private static readonly EMPTY_ATTRS: Record<string, string> = Object.freeze({});
  private static readonly EMPTY_ATTRS_WITH_PREFIX: Record<string, AttributeInfo> = Object.freeze({});
  private static readonly ASCII_TABLE = (() => {
    const table = new Uint8Array(128);
    table[9] = 1;
    table[10] = 1;
    table[13] = 1;
    table[32] = 1;
    return table;
  })();
  private static readonly UNICODE_WHITESPACE = new Set([
    0x00A0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A,
    0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF,
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

  constructor(xml: string, options: StringEventParserSyncOptions = {}) {
    this.xml = xml;
    this.xmlLength = xml.length;
    this.eventFilter = options.eventFilter;
    this.namespaceAware = options.namespaceAware ?? true;
    if (this.namespaceAware) {
      this.namespaceStack.push(new Map<string, string>());
    }
    this.entityDecoder = this.compileEntityDecoder(options);
  }

  [Symbol.iterator](): Iterator<AnyXmlEvent> {
    return this;
  }

  next(): IteratorResult<AnyXmlEvent> {
    if (this.pendingEvent) {
      this.iteratorResult.value = this.pendingEvent;
      this.pendingEvent = null;
      return this.iteratorResult;
    }

    switch (this.state) {
      case ParserState.INITIAL:
        this.state = ParserState.PARSING;
        this.iteratorResult.value = this.createStartDocumentEvent();
        return this.iteratorResult;
      case ParserState.PARSING: {
        const event = this.parseNextEvent();
        if (event) {
          this.iteratorResult.value = event;
          return this.iteratorResult;
        }
        this.state = ParserState.DONE;
        this.iteratorResult.value = this.createEndDocumentEvent();
        return this.iteratorResult;
      }
      case ParserState.DONE:
      default:
        return this.doneResult;
    }
  }

  private parseNextEvent(): AnyXmlEvent | null {
    while (this.pos < this.xmlLength) {
      const ltPos = this.xml.indexOf('<', this.pos);
      if (ltPos === -1) {
        if (this.pos < this.xmlLength) {
          const text = this.xml.slice(this.pos, this.xmlLength);
          this.pos = this.xmlLength;
          if (text.trim().length > 0 && (!this.eventFilter || this.eventFilter.includeCharacters)) {
            return this.createCharactersEvent(text);
          }
        }
        return null;
      }

      if (ltPos > this.pos) {
        const text = this.xml.slice(this.pos, ltPos);
        this.pos = ltPos;
        if (text.trim().length > 0 && (!this.eventFilter || this.eventFilter.includeCharacters)) {
          return this.createCharactersEvent(text);
        }
      }

      this.pos = ltPos;
      const event = this.parseTag();
      if (event !== null) {
        return event;
      }
    }

    return null;
  }

  private parseTag(): AnyXmlEvent | null {
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

  private parseEndTag(): AnyXmlEvent {
    const tagClose = this.xml.indexOf('>', this.pos);
    if (tagClose === -1) throw new Error('Unclosed end tag');

    const fullTagName = this.trimmedSlice(this.pos + 2, tagClose);
    const expectedTagName = this.elementStack[this.elementStack.length - 1];
    if (expectedTagName === undefined) {
      throw new Error(`Mismatched closing tag: </${fullTagName}>. No open elements.`);
    }
    if (fullTagName !== expectedTagName) {
      throw new Error(`Mismatched closing tag: </${fullTagName}>. Expected </${expectedTagName}>.`);
    }

    this.elementStack.pop();
    if (!this.namespaceAware) {
      this.pos = tagClose + 1;
      return this.createLeanEndElementEvent(fullTagName);
    }
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

    this.pos = tagClose + 1;
    return this.createEndElementEvent(fullTagName, localName, prefix, uri);
  }

  private parseCdataCommentDoctype(): AnyXmlEvent | null {
    if (this.xml.startsWith('<![CDATA[', this.pos)) {
      const cdataEnd = this.findSequence(']]>', this.pos + 9);
      if (cdataEnd === -1) throw new Error('Unclosed CDATA section');
      const cdataContent = this.xml.slice(this.pos + 9, cdataEnd);
      this.pos = cdataEnd + 3;
      if (!this.eventFilter || this.eventFilter.includeCdata) {
        return this.createCdataEvent(cdataContent);
      }
      return null;
    }
    if (this.xml.startsWith('<!--', this.pos)) {
      const commentEnd = this.findSequence('-->', this.pos + 4);
      if (commentEnd === -1) throw new Error('Unclosed comment');
      this.pos = commentEnd + 3;
      return null;
    }
    if (this.xml.startsWith('<!DOCTYPE', this.pos)) {
      const doctypeEnd = this.xml.indexOf('>', this.pos);
      if (doctypeEnd === -1) throw new Error('Unclosed DOCTYPE declaration');
      this.pos = doctypeEnd + 1;
      return null;
    }
    return null;
  }

  private parseProcessingInstruction(): void {
    const piEnd = this.findSequence('?>', this.pos);
    if (piEnd === -1) throw new Error('Unclosed processing instruction');
    this.pos = piEnd + 2;
  }

  private parseStartTag(): AnyXmlEvent {
    const tagStart = this.pos + 1;
    const tagEnd = this.findTagEnd(tagStart);
    if (tagEnd === -1) throw new Error('Unclosed start tag');

    let isSelfClosing = false;
    let actualEnd = tagEnd;
    if (this.xml.charCodeAt(tagEnd - 1) === 47) {
      isSelfClosing = true;
      actualEnd = tagEnd - 1;
    }

    let nameEnd = tagStart;
    let colonPos = -1;
    const xml = this.xml;
    while (nameEnd < actualEnd) {
      const code = xml.charCodeAt(nameEnd);
      if (code === 58 && colonPos === -1) {
        colonPos = nameEnd;
      } else if (code <= 32) {
        if (StringEventParserSync.isWhitespace(code)) break;
      } else if (code === 62 || code === 47) {
        break;
      }
      nameEnd++;
    }

    const tagName = xml.slice(tagStart, nameEnd);
    const includeAttributes = !this.eventFilter || this.eventFilter.includeAttributes;
    if (!this.namespaceAware) {
      const attributes = includeAttributes
        ? this.parsePlainAttributesFast(nameEnd, actualEnd)
        : StringEventParserSync.EMPTY_ATTRS;
      const startEvent = this.createLeanStartElementEvent(tagName, attributes);
      this.elementStack.push(tagName);
      if (isSelfClosing) {
        this.pendingEvent = this.createLeanEndElementEvent(tagName);
        this.elementStack.pop();
      }
      this.pos = tagEnd + 1;
      return startEvent;
    }

    const parentNamespaces = this.namespaceStack[this.namespaceStack.length - 1]!;
    if (colonPos === -1 && nameEnd === actualEnd) {
      const uri = parentNamespaces.get('');
      const startEvent = this.createStartElementEvent(
        tagName,
        tagName,
        undefined,
        uri,
        StringEventParserSync.EMPTY_ATTRS,
        StringEventParserSync.EMPTY_ATTRS_WITH_PREFIX,
      );
      this.elementStack.push(tagName);
      if (isSelfClosing) {
        this.pendingEvent = this.createEndElementEvent(tagName, tagName, undefined, uri);
        this.elementStack.pop();
      } else {
        this.namespaceStack.push(parentNamespaces);
      }
      this.pos = tagEnd + 1;
      return startEvent;
    }

    const { attributes, attributesWithPrefix, namespaces } = this.parseAttributesFast(
      nameEnd,
      actualEnd,
      parentNamespaces,
      includeAttributes,
    );

    let localName: string;
    let prefix: string | undefined;
    let uri: string | undefined;
    if (colonPos === -1) {
      localName = tagName;
      prefix = undefined;
      uri = namespaces.get('');
    } else {
      prefix = tagName.slice(0, colonPos - tagStart);
      localName = tagName.slice(colonPos - tagStart + 1);
      uri = namespaces.get(prefix);
    }

    const startEvent = this.createStartElementEvent(tagName, localName, prefix, uri, attributes, attributesWithPrefix);
    this.elementStack.push(tagName);

    if (!isSelfClosing) {
      this.namespaceStack.push(namespaces);
    } else {
      this.pendingEvent = this.createEndElementEvent(tagName, localName, prefix, uri);
      this.elementStack.pop();
    }

    this.pos = tagEnd + 1;
    return startEvent;
  }

  private createStartDocumentEvent(): StartDocumentEvent {
    return { type: XmlEventType.START_DOCUMENT };
  }

  private createEndDocumentEvent(): EndDocumentEvent {
    return { type: XmlEventType.END_DOCUMENT };
  }

  private createCharactersEvent(text: string): CharactersEvent {
    return {
      type: XmlEventType.CHARACTERS,
      value: this.entityDecoder(text),
    };
  }

  private createStartElementEvent(
    name: string,
    localName: string | undefined,
    prefix: string | undefined,
    uri: string | undefined,
    attributes: Record<string, string>,
    attributesWithPrefix: Record<string, AttributeInfo>,
  ): StartElementEvent {
    return {
      type: XmlEventType.START_ELEMENT,
      name,
      localName,
      prefix,
      uri,
      attributes,
      attributesWithPrefix,
    };
  }

  private createLeanStartElementEvent(
    name: string,
    attributes: Record<string, string>,
  ): StartElementEvent {
    return {
      type: XmlEventType.START_ELEMENT,
      name,
      attributes,
    };
  }

  private createEndElementEvent(
    name: string,
    localName: string | undefined,
    prefix: string | undefined,
    uri: string | undefined,
  ): EndElementEvent {
    return {
      type: XmlEventType.END_ELEMENT,
      name,
      localName,
      prefix,
      uri,
    };
  }

  private createLeanEndElementEvent(name: string): EndElementEvent {
    return {
      type: XmlEventType.END_ELEMENT,
      name,
    };
  }

  private createCdataEvent(value: string): CdataEvent {
    return {
      type: XmlEventType.CDATA,
      value,
    };
  }

  private static isWhitespace(code: number): boolean {
    if (code < 128) {
      return StringEventParserSync.ASCII_TABLE[code] === 1;
    }
    return code <= 32 || StringEventParserSync.UNICODE_WHITESPACE.has(code);
  }

  private static isHighSurrogate(code: number): boolean {
    return code >= 0xd800 && code <= 0xdbff;
  }

  private static isLowSurrogate(code: number): boolean {
    return code >= 0xdc00 && code <= 0xdfff;
  }

  private trimmedSlice(start: number, end: number): string {
    const xml = this.xml;
    while (start < end && StringEventParserSync.isWhitespace(xml.charCodeAt(start))) {
      if (StringEventParserSync.isHighSurrogate(xml.charCodeAt(start))) {
        start += 2;
      } else {
        start++;
      }
    }
    while (end > start && StringEventParserSync.isWhitespace(xml.charCodeAt(end - 1))) {
      if (
        end > start + 1
        && StringEventParserSync.isLowSurrogate(xml.charCodeAt(end - 1))
        && StringEventParserSync.isHighSurrogate(xml.charCodeAt(end - 2))
      ) {
        end -= 2;
      } else {
        end--;
      }
    }
    return start < end ? xml.slice(start, end) : '';
  }

  private compileEntityDecoder(options: StringEventParserSyncOptions): (text: string) => string {
    if (options.autoDecodeEntities === false) {
      return (text) => text;
    }

    if (options.addEntities && options.addEntities.length > 0) {
      const entityMap: Record<string, string> = { ...StringEventParserSync.DEFAULT_ENTITY_MAP };
      const patterns: string[] = ['lt', 'gt', 'quot', 'apos'];
      for (const { entity, value } of options.addEntities) {
        if (!entity || !value) continue;
        const key = entity.startsWith('&') && entity.endsWith(';') ? entity.slice(1, -1) : entity;
        entityMap[key] = value;
        patterns.push(key);
      }
      patterns.push('amp');

      const cacheKey = patterns.join(',');
      let regex = StringEventParserSync.ENTITY_REGEX_CACHE.get(cacheKey);
      if (!regex) {
        const pattern = patterns
          .sort((left, right) => right.length - left.length)
          .map((entity) => entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|');
        regex = new RegExp(`&(${pattern});`, 'g');
        StringEventParserSync.ENTITY_REGEX_CACHE.set(cacheKey, regex);
      }

      return (text: string) => {
        if (!text || text.indexOf('&') === -1) return text;
        regex!.lastIndex = 0;
        return text.replace(regex!, (_match, entity) => entityMap[entity] || _match);
      };
    }

    return (text: string) => {
      if (!text || text.indexOf('&') === -1) return text;
      StringEventParserSync.DEFAULT_ENTITY_REGEX.lastIndex = 0;
      return text.replace(
        StringEventParserSync.DEFAULT_ENTITY_REGEX,
        (_match, entity) => StringEventParserSync.DEFAULT_ENTITY_MAP[entity] || _match,
      );
    };
  }

  private parseAttributesFast(
    start: number,
    end: number,
    parentNamespaces: Map<string, string>,
    includeAttributes: boolean,
  ): {
    attributes: Record<string, string>;
    attributesWithPrefix: Record<string, AttributeInfo>;
    namespaces: Map<string, string>;
  } {
    if (start >= end) {
      return {
        attributes: StringEventParserSync.EMPTY_ATTRS,
        attributesWithPrefix: StringEventParserSync.EMPTY_ATTRS_WITH_PREFIX,
        namespaces: parentNamespaces,
      };
    }

    const attributes: Record<string, string> = {};
    const attributesWithPrefix: Record<string, AttributeInfo> = {};
    let namespaces = parentNamespaces;
    let namespaceCopied = false;
    let i = start;
    const xml = this.xml;

    while (i < end) {
      while (i < end && StringEventParserSync.isWhitespace(xml.charCodeAt(i))) i++;
      if (i >= end) break;

      const nameStart = i;
      while (i < end) {
        const code = xml.charCodeAt(i);
        if (code === 61 || StringEventParserSync.isWhitespace(code)) break;
        i++;
      }

      if (i === nameStart) break;
      const attrName = xml.slice(nameStart, i);

      while (i < end && StringEventParserSync.isWhitespace(xml.charCodeAt(i))) i++;
      if (i >= end || xml.charCodeAt(i) !== 61) {
        if (includeAttributes) {
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
        }
        continue;
      }

      i++;
      while (i < end && StringEventParserSync.isWhitespace(xml.charCodeAt(i))) i++;
      if (i >= end) break;

      const quote = xml.charCodeAt(i);
      if (quote !== 34 && quote !== 39) break;
      i++;
      const valueStart = i;
      while (i < end && xml.charCodeAt(i) !== quote) i++;

      const rawValue = xml.slice(valueStart, i);
      const attrValue = this.entityDecoder(rawValue);

      const c0 = attrName.charCodeAt(0);
      if (c0 === 120 && attrName.length >= 5) {
        if (attrName === 'xmlns') {
          if (!namespaceCopied) {
            namespaces = new Map(parentNamespaces);
            namespaceCopied = true;
          }
          namespaces.set('', attrValue);
        } else if (attrName.length >= 6 && attrName.charCodeAt(5) === 58 && attrName.slice(0, 5) === 'xmlns') {
          if (!namespaceCopied) {
            namespaces = new Map(parentNamespaces);
            namespaceCopied = true;
          }
          namespaces.set(attrName.slice(6), attrValue);
        }
      }

      if (includeAttributes) {
        attributes[attrName] = attrValue;
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
        if (c0 === 120 && attrName.length >= 5 && attrName.slice(0, 5) === 'xmlns') {
          if (attrName === 'xmlns') {
            localName = 'xmlns';
            prefix = undefined;
          } else {
            localName = attrName.slice(6);
            prefix = 'xmlns';
          }
          uri = undefined;
        }
        attributesWithPrefix[attrName] = { value: attrValue, localName, prefix, uri };
      }

      i++;
    }

    return { attributes, attributesWithPrefix, namespaces };
  }

  private parsePlainAttributesFast(
    start: number,
    end: number,
  ): Record<string, string> {
    if (start >= end) {
      return StringEventParserSync.EMPTY_ATTRS;
    }

    const attributes: Record<string, string> = {};
    let i = start;
    const xml = this.xml;

    while (i < end) {
      while (i < end && StringEventParserSync.isWhitespace(xml.charCodeAt(i))) i++;
      if (i >= end) break;

      const nameStart = i;
      while (i < end) {
        const code = xml.charCodeAt(i);
        if (code === 61 || StringEventParserSync.isWhitespace(code)) break;
        i++;
      }

      if (i === nameStart) break;
      const attrName = xml.slice(nameStart, i);

      while (i < end && StringEventParserSync.isWhitespace(xml.charCodeAt(i))) i++;
      if (i >= end || xml.charCodeAt(i) !== 61) {
        attributes[attrName] = 'true';
        continue;
      }

      i++;
      while (i < end && StringEventParserSync.isWhitespace(xml.charCodeAt(i))) i++;
      if (i >= end) break;

      const quote = xml.charCodeAt(i);
      if (quote !== 34 && quote !== 39) break;
      i++;
      const valueStart = i;
      while (i < end && xml.charCodeAt(i) !== quote) i++;
      attributes[attrName] = this.entityDecoder(xml.slice(valueStart, i));
      i++;
    }

    return attributes;
  }

  private findTagEnd(start: number): number {
    let inQuote = false;
    let quoteChar = 0;
    for (let index = start; index < this.xmlLength; index++) {
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
    }
    return -1;
  }

  private findSequence(sequence: string, start: number): number {
    const seqLen = sequence.length;
    const maxPos = this.xmlLength - seqLen;
    for (let index = start; index <= maxPos; index++) {
      if (this.xml.startsWith(sequence, index)) {
        return index;
      }
    }
    return -1;
  }
}
