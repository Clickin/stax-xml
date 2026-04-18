import type { StaxXmlParserOptions } from './StaxXmlParser';
import {
  XmlEventFactory,
  XmlEventType,
  type AnyXmlEvent,
  type AttributeInfo,
  type ParserEventFilter,
} from './types';

type IteratorResultLike<T> = IteratorResult<T> | Promise<IteratorResult<T>>;

export class StaxXmlParserFastPathExperimental implements AsyncIterable<AnyXmlEvent> {
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
    apos: "'",
    amp: '&',
  };

  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly decoder: TextDecoder;
  private readonly options: StaxXmlParserOptions;
  private readonly eventFilter?: ParserEventFilter;
  private readonly entityDecoder: (text: string) => string;

  private readonly eventQueue: AnyXmlEvent[] = [];
  private readonly elementStack: string[] = [];
  private readonly namespaceStack: Map<string, string>[] = [];
  private readonly pendingTextSegments: string[] = [];
  private pendingStructuralSegments: string[] = [];

  private resolveNext: ((value: IteratorResult<AnyXmlEvent>) => void) | null = null;
  private error: Error | null = null;
  private isStreamEnded = false;
  private parserFinished = false;

  constructor(xmlStream: ReadableStream<Uint8Array>, options: StaxXmlParserOptions = {}) {
    if (!(xmlStream instanceof ReadableStream)) {
      throw new Error('xmlStream must be a web standard ReadableStream.');
    }

    this.options = {
      encoding: 'utf-8',
      autoDecodeEntities: true,
      maxBufferSize: 64 * 1024,
      enableBufferCompaction: true,
      batchSize: 10,
      batchTimeout: 10,
      initialQueueCapacity: 1024,
      ...options,
    };
    this.eventFilter = this.options.eventFilter;
    this.decoder = new TextDecoder(this.options.encoding, {
      fatal: false,
      ignoreBOM: true,
    });
    this.entityDecoder = this.compileEntityDecoder();
    this.reader = xmlStream.getReader();

    this.enqueueEvent(XmlEventFactory.startDocument());
    void this.startReading();
  }

  [Symbol.asyncIterator](): AsyncIterator<AnyXmlEvent> {
    return this as AsyncIterator<AnyXmlEvent>;
  }

  next(): IteratorResultLike<AnyXmlEvent> {
    if (this.error) {
      throw this.error;
    }

    const queued = this.eventQueue.shift();
    if (queued !== undefined) {
      return { value: queued, done: false };
    }

    if (this.parserFinished) {
      return { value: undefined, done: true };
    }

    return new Promise((resolve) => {
      this.resolveNext = resolve;
    });
  }

  async return(): Promise<IteratorResult<AnyXmlEvent>> {
    this.parserFinished = true;
    this.eventQueue.length = 0;
    this.pendingStructuralSegments = [];
    this.pendingTextSegments.length = 0;
    await this.reader.cancel();
    this.resolveDoneIfNeeded();
    return { value: undefined, done: true };
  }

  private async startReading(): Promise<void> {
    try {
      while (!this.parserFinished) {
        const { done, value } = await this.reader.read();
        if (done) {
          this.isStreamEnded = true;
          const flushed = this.decoder.decode();
          this.processDecodedChunk(flushed, true);

          if (!this.parserFinished && this.pendingStructuralSegments.length > 0) {
            this.addError(new Error('Unexpected end of document. Incomplete markup at end of stream.'));
            break;
          }

          if (!this.parserFinished) {
            this.flushTextSegments();
            if (this.elementStack.length > 0) {
              this.addError(new Error('Unexpected end of document. Not all elements were closed.'));
              break;
            }

            this.enqueueEvent(XmlEventFactory.endDocument());
            this.parserFinished = true;
            this.resolveDoneIfNeeded();
          }
          break;
        }

        const decoded = this.decoder.decode(value, { stream: true });
        this.processDecodedChunk(decoded, false);
      }
    } catch (error) {
      this.addError(error as Error);
    }
  }

  private processDecodedChunk(decodedChunk: string, isFinal: boolean): void {
    let window = decodedChunk;
    if (this.pendingStructuralSegments.length > 0) {
      this.pendingStructuralSegments.push(decodedChunk);
      window = this.pendingStructuralSegments.length === 1
        ? this.pendingStructuralSegments[0]!
        : this.pendingStructuralSegments.join('');
      this.pendingStructuralSegments = [];
    }

    let position = 0;
    while (position < window.length && !this.parserFinished) {
      const ltPos = window.indexOf('<', position);
      if (ltPos === -1) {
        if (position < window.length) {
          this.pendingTextSegments.push(window.slice(position));
        }
        return;
      }

      if (ltPos > position) {
        this.pendingTextSegments.push(window.slice(position, ltPos));
      }

      if (this.pendingTextSegments.length > 0) {
        this.flushTextSegments();
      }

      const result = this.parseTag(window, ltPos, isFinal);
      if (result === null) {
        this.pendingStructuralSegments.push(window.slice(ltPos));
        return;
      }

      position = result;
    }
  }

  private parseTag(window: string, position: number, isFinal: boolean): number | null {
    if (window.startsWith('<?xml', position)) {
      const end = window.indexOf('?>', position + 5);
      if (end === -1) {
        if (isFinal) {
          throw new Error('Unclosed XML declaration');
        }
        return null;
      }
      return end + 2;
    }

    if (window.startsWith('<!--', position)) {
      const end = window.indexOf('-->', position + 4);
      if (end === -1) {
        if (isFinal) {
          throw new Error('Unclosed comment');
        }
        return null;
      }
      return end + 3;
    }

    if (window.startsWith('<![CDATA[', position)) {
      const end = window.indexOf(']]>', position + 9);
      if (end === -1) {
        if (isFinal) {
          throw new Error('Unclosed CDATA section');
        }
        return null;
      }

      if (!this.eventFilter || this.eventFilter.includeCdata) {
        this.enqueueEvent(XmlEventFactory.cdata(window.slice(position + 9, end)));
      }
      return end + 3;
    }

    if (window.startsWith('<?', position)) {
      const end = window.indexOf('?>', position + 2);
      if (end === -1) {
        if (isFinal) {
          throw new Error('Unclosed processing instruction');
        }
        return null;
      }
      return end + 2;
    }

    if (window.startsWith('</', position)) {
      return this.parseEndTag(window, position, isFinal);
    }

    return this.parseStartTag(window, position, isFinal);
  }

  private parseEndTag(window: string, position: number, isFinal: boolean): number | null {
    const end = window.indexOf('>', position + 2);
    if (end === -1) {
      if (isFinal) {
        throw new Error('Unclosed end tag');
      }
      return null;
    }

    const fullTagName = this.trimmedSlice(window, position + 2, end);
    if (this.elementStack.length === 0) {
      throw new Error(`Mismatched closing tag: </${fullTagName}>. No open elements.`);
    }

    const expectedTagName = this.elementStack[this.elementStack.length - 1]!;
    if (fullTagName !== expectedTagName) {
      throw new Error(`Mismatched closing tag: </${fullTagName}>. Expected </${expectedTagName}>.`);
    }

    this.elementStack.pop();
    const currentNamespaces = this.namespaceStack.pop();
    const { localName, prefix, uri } = this.parseQualifiedName(fullTagName, currentNamespaces);
    this.enqueueEvent(XmlEventFactory.endElement(fullTagName, localName, prefix, uri));
    return end + 1;
  }

  private parseStartTag(window: string, position: number, isFinal: boolean): number | null {
    const tagEnd = this.findTagEnd(window, position + 1);
    if (tagEnd === -1) {
      if (isFinal) {
        throw new Error('Unclosed start tag');
      }
      return null;
    }

    let contentEnd = tagEnd;
    while (contentEnd > position + 1 && StaxXmlParserFastPathExperimental.isWhitespace(window.charCodeAt(contentEnd - 1))) {
      contentEnd--;
    }

    let isSelfClosing = false;
    let actualEnd = contentEnd;
    if (actualEnd > position + 1 && window.charCodeAt(actualEnd - 1) === 47) {
      isSelfClosing = true;
      actualEnd--;
      while (actualEnd > position + 1 && StaxXmlParserFastPathExperimental.isWhitespace(window.charCodeAt(actualEnd - 1))) {
        actualEnd--;
      }
    }

    let nameEnd = position + 1;
    while (nameEnd < actualEnd) {
      const code = window.charCodeAt(nameEnd);
      if (StaxXmlParserFastPathExperimental.isWhitespace(code) || code === 47 || code === 62) {
        break;
      }
      nameEnd++;
    }

    const tagName = window.slice(position + 1, nameEnd);
    const currentNamespaces = new Map<string, string>(this.namespaceStack[this.namespaceStack.length - 1] ?? undefined);
    const includeAttributes = !this.eventFilter || this.eventFilter.includeAttributes;
    const { attributes, attributesWithPrefix } = this.parseAttributesFast(
      window,
      nameEnd,
      actualEnd,
      currentNamespaces,
      includeAttributes,
    );
    const { localName, prefix, uri } = this.parseQualifiedName(tagName, currentNamespaces);

    this.enqueueEvent(XmlEventFactory.startElement(
      tagName,
      localName,
      prefix,
      uri,
      attributes,
      attributesWithPrefix,
    ));

    if (isSelfClosing) {
      this.enqueueEvent(XmlEventFactory.endElement(tagName, localName, prefix, uri));
    } else {
      this.elementStack.push(tagName);
      this.namespaceStack.push(currentNamespaces);
    }

    return tagEnd + 1;
  }

  private parseAttributesFast(
    window: string,
    start: number,
    end: number,
    namespaces: Map<string, string>,
    includeAttributes: boolean,
  ): { attributes: Record<string, string>; attributesWithPrefix: Record<string, AttributeInfo> } {
    if (start >= end) {
      return {
        attributes: {},
        attributesWithPrefix: {},
      };
    }

    const attributes: Record<string, string> = {};
    const attributesWithPrefix: Record<string, AttributeInfo> = {};

    let index = start;
    while (index < end) {
      while (index < end && StaxXmlParserFastPathExperimental.isWhitespace(window.charCodeAt(index))) {
        index++;
      }
      if (index >= end) {
        break;
      }

      const nameStart = index;
      while (index < end) {
        const code = window.charCodeAt(index);
        if (code === 61 || StaxXmlParserFastPathExperimental.isWhitespace(code)) {
          break;
        }
        index++;
      }

      if (index === nameStart) {
        break;
      }

      const attrName = window.slice(nameStart, index);
      while (index < end && StaxXmlParserFastPathExperimental.isWhitespace(window.charCodeAt(index))) {
        index++;
      }

      if (index >= end || window.charCodeAt(index) !== 61) {
        if (includeAttributes) {
          this.recordAttribute(attributes, attributesWithPrefix, namespaces, attrName, 'true');
        }
        continue;
      }

      index++;
      while (index < end && StaxXmlParserFastPathExperimental.isWhitespace(window.charCodeAt(index))) {
        index++;
      }
      if (index >= end) {
        break;
      }

      const quote = window.charCodeAt(index);
      if (quote !== 34 && quote !== 39) {
        break;
      }

      index++;
      const valueStart = index;
      while (index < end && window.charCodeAt(index) !== quote) {
        index++;
      }
      if (index >= end) {
        break;
      }

      const attrValue = this.entityDecoder(window.slice(valueStart, index));
      if (attrName === 'xmlns') {
        namespaces.set('', attrValue);
      } else if (attrName.startsWith('xmlns:')) {
        namespaces.set(attrName.slice(6), attrValue);
      }

      if (includeAttributes) {
        this.recordAttribute(attributes, attributesWithPrefix, namespaces, attrName, attrValue);
      }
      index++;
    }

    return { attributes, attributesWithPrefix };
  }

  private recordAttribute(
    attributes: Record<string, string>,
    attributesWithPrefix: Record<string, AttributeInfo>,
    namespaces: Map<string, string>,
    attrName: string,
    attrValue: string,
  ): void {
    attributes[attrName] = attrValue;

    let localName = attrName;
    let prefix: string | undefined;
    let uri: string | undefined;
    const colonIndex = attrName.indexOf(':');
    if (colonIndex !== -1) {
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
      uri = undefined;
    }

    attributesWithPrefix[attrName] = {
      value: attrValue,
      localName,
      prefix,
      uri,
    };
  }

  private parseQualifiedName(
    qname: string,
    namespaces?: Map<string, string>,
  ): { localName: string; prefix: string | undefined; uri: string | undefined } {
    const colonIndex = qname.indexOf(':');
    if (colonIndex === -1) {
      return {
        localName: qname,
        prefix: undefined,
        uri: namespaces?.get(''),
      };
    }

    const prefix = qname.slice(0, colonIndex);
    return {
      localName: qname.slice(colonIndex + 1),
      prefix,
      uri: namespaces?.get(prefix),
    };
  }

  private flushTextSegments(): void {
    if (this.pendingTextSegments.length === 0) {
      return;
    }

    const rawText = this.pendingTextSegments.length === 1
      ? this.pendingTextSegments[0]!
      : this.pendingTextSegments.join('');
    this.pendingTextSegments.length = 0;

    const decodedText = this.entityDecoder(rawText);
    if (!decodedText || decodedText.trim().length === 0) {
      return;
    }

    if (!this.eventFilter || this.eventFilter.includeCharacters) {
      this.enqueueEvent(XmlEventFactory.characters(decodedText));
    }
  }

  private enqueueEvent(event: AnyXmlEvent): void {
    this.eventQueue.push(event);
    if (this.resolveNext !== null) {
      const resolve = this.resolveNext;
      this.resolveNext = null;
      const next = this.eventQueue.shift();
      if (next === undefined) {
        resolve({ value: undefined, done: true });
      } else {
        resolve({ value: next, done: false });
      }
    }
  }

  private addError(error: Error): void {
    if (this.error !== null) {
      return;
    }

    this.error = error;
    this.enqueueEvent(XmlEventFactory.error(error));
    this.parserFinished = true;
    this.pendingStructuralSegments = [];
    this.pendingTextSegments.length = 0;
    this.resolveDoneIfNeeded();
  }

  private resolveDoneIfNeeded(): void {
    if (this.resolveNext !== null && this.eventQueue.length === 0 && this.parserFinished) {
      const resolve = this.resolveNext;
      this.resolveNext = null;
      resolve({ value: undefined, done: true });
    }
  }

  private findTagEnd(window: string, start: number): number {
    let index = start;
    let inQuote = false;
    let quoteChar = 0;

    while (index < window.length) {
      const code = window.charCodeAt(index);
      if (code === 34 || code === 39) {
        if (!inQuote) {
          inQuote = true;
          quoteChar = code;
        } else if (quoteChar === code) {
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

  private trimmedSlice(window: string, start: number, end: number): string {
    while (start < end && StaxXmlParserFastPathExperimental.isWhitespace(window.charCodeAt(start))) {
      start++;
    }
    while (end > start && StaxXmlParserFastPathExperimental.isWhitespace(window.charCodeAt(end - 1))) {
      end--;
    }
    return start < end ? window.slice(start, end) : '';
  }

  private compileEntityDecoder(): (text: string) => string {
    if (!this.options.autoDecodeEntities) {
      return (text) => text;
    }

    if (this.options.addEntities && this.options.addEntities.length > 0) {
      const entityMap: Record<string, string> = { ...StaxXmlParserFastPathExperimental.DEFAULT_ENTITY_MAP };
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
      let regex = StaxXmlParserFastPathExperimental.ENTITY_REGEX_CACHE.get(cacheKey);
      if (!regex) {
        const pattern = patterns
          .sort((left, right) => right.length - left.length)
          .map((entity) => entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|');
        regex = new RegExp(`&(${pattern});`, 'g');
        StaxXmlParserFastPathExperimental.ENTITY_REGEX_CACHE.set(cacheKey, regex);
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
      StaxXmlParserFastPathExperimental.DEFAULT_ENTITY_REGEX.lastIndex = 0;
      return text.replace(
        StaxXmlParserFastPathExperimental.DEFAULT_ENTITY_REGEX,
        (_, entity) => StaxXmlParserFastPathExperimental.DEFAULT_ENTITY_MAP[entity] || _,
      );
    };
  }

  private static isWhitespace(code: number): boolean {
    if (code < 128) {
      return StaxXmlParserFastPathExperimental.ASCII_TABLE[code] === 1;
    }
    return code <= 32 || StaxXmlParserFastPathExperimental.UNICODE_WHITESPACE.has(code);
  }
}

export function createStaxXmlParserFastPathExperimental(
  xmlStream: ReadableStream<Uint8Array>,
  options: StaxXmlParserOptions = {},
): StaxXmlParserFastPathExperimental {
  return new StaxXmlParserFastPathExperimental(xmlStream, options);
}
