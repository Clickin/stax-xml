import {
  XmlEventFactory,
  XmlEventType,
  type AnyXmlEvent,
  type AttributeInfo,
  type ParserEventFilter,
} from './types';

/**
 * Configuration options for the StaxXmlParser
 *
 * @public
 */
export interface StaxXmlParserOptions {
  /**
   * Text encoding for the input stream
   * @defaultValue 'utf-8'
   */
  encoding?: string;

  /**
   * Additional custom entities to decode
   * @defaultValue []
   */
  addEntities?: { entity: string, value: string }[];

  /**
   * Whether to automatically decode XML entities
   * @defaultValue true
   */
  autoDecodeEntities?: boolean;

  /**
   * Maximum buffer size in bytes
   * @defaultValue 65536
   */
  maxBufferSize?: number;

  /**
   * Whether to enable buffer compaction for memory efficiency
   * @defaultValue true
   */
  enableBufferCompaction?: boolean;

  /**
   * Initial event queue capacity (circular buffer size)
   * @defaultValue 1024
   */
  initialQueueCapacity?: number;

  eventFilter?: ParserEventFilter;
}
type IteratorResultLike<T> = IteratorResult<T> | Promise<IteratorResult<T>>;

export class StaxXmlParser implements AsyncIterable<AnyXmlEvent> {
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

  // Singleton empty objects for fast-path elements (no attributes)
  private static readonly EMPTY_ATTRS: Record<string, string> = Object.freeze({});
  private static readonly EMPTY_ATTRS_WITH_PREFIX: Record<string, AttributeInfo> = Object.freeze({});

  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly decoder: TextDecoder;
  private readonly options: StaxXmlParserOptions;
  private readonly eventFilter?: ParserEventFilter;
  private readonly entityDecoder: (text: string) => string;

  // Circular buffer queue (O(1) enqueue and dequeue)
  private eventQueue: AnyXmlEvent[];
  private queueHead = 0;
  private queueTail = 0;
  private queueSize = 0;

  private readonly elementStack: string[] = [];
  private readonly namespaceStack: Map<string, string>[] = [];
  private readonly pendingTextSegments: string[] = [];
  // Carry tail: a single incomplete structural fragment from the previous chunk
  private pendingTail = '';

  private resolveNext: ((value: IteratorResult<AnyXmlEvent>) => void) | null = null;
  private resolveBatchReady: (() => void) | null = null;
  private error: Error | null = null;
  private parserFinished = false;
  private documentStarted = false;

  constructor(xmlStream: ReadableStream<Uint8Array>, options: StaxXmlParserOptions = {}) {
    if (!(xmlStream instanceof ReadableStream)) {
      throw new Error('xmlStream must be a web standard ReadableStream.');
    }

    this.options = {
      encoding: 'utf-8',
      autoDecodeEntities: true,
      maxBufferSize: 64 * 1024,
      enableBufferCompaction: true,
      initialQueueCapacity: 1024,
      ...options,
    };
    this.eventFilter = this.options.eventFilter;
    this.decoder = new TextDecoder(this.options.encoding, {
      fatal: false,
      ignoreBOM: true,
    });
    this.entityDecoder = this.compileEntityDecoder();
    // Initialize circular buffer queue
    this.eventQueue = new Array(this.options.initialQueueCapacity ?? 1024);
    this.reader = xmlStream.getReader();

    void this.startReading();
  }

  [Symbol.asyncIterator](): AsyncIterator<AnyXmlEvent> {
    return this as AsyncIterator<AnyXmlEvent>;
  }

  next(): IteratorResultLike<AnyXmlEvent> {
    if (this.error) {
      throw this.error;
    }

    if (this.queueSize > 0) {
      return { value: this.dequeueEvent(), done: false };
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
    this.queueHead = 0;
    this.queueTail = 0;
    this.queueSize = 0;
    this.pendingTail = '';
    this.pendingTextSegments.length = 0;
    await this.reader.cancel();
    this.resolveBatchReadyIfNeeded();
    this.resolveDoneIfNeeded();
    return { value: undefined, done: true };
  }

  async nextBatch(): Promise<AnyXmlEvent[]> {
    if (this.error) {
      throw this.error;
    }

    if (this.queueSize === 0 && !this.parserFinished) {
      await this.waitForBatchReady();
    }

    if (this.error) {
      throw this.error;
    }

    if (this.queueSize === 0) {
      return [];
    }

    const batch = new Array<AnyXmlEvent>(this.queueSize);
    for (let index = 0; index < batch.length; index++) {
      batch[index] = this.dequeueEvent();
    }

    return batch;
  }

  async *batchedIterator(): AsyncGenerator<AnyXmlEvent[]> {
    while (!this.parserFinished || this.queueSize > 0) {
      const batch = await this.nextBatch();
      if (batch.length === 0) {
        break;
      }
      yield batch;
    }
  }

  get XmlEventType(): typeof XmlEventType {
    return XmlEventType;
  }

  private async startReading(): Promise<void> {
    try {
      while (!this.parserFinished) {
        const { done, value } = await this.reader.read();
        this.enqueueStartDocumentIfNeeded();

        if (done) {
          const flushed = this.decoder.decode();
          this.processDecodedChunk(flushed, true);

          if (!this.parserFinished && this.pendingTail.length > 0) {
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
          this.resolveBatchReadyIfNeeded();
          break;
        }

        const decoded = this.decoder.decode(value, { stream: true });
        this.processDecodedChunk(decoded, false);
        this.resolveBatchReadyIfNeeded();
      }
    } catch (error) {
      this.addError(error as Error);
    }
  }

  private processDecodedChunk(decodedChunk: string, isFinal: boolean): void {
    // Prepend any incomplete structural tail from the previous chunk
    const window = this.pendingTail.length > 0 ? this.pendingTail + decodedChunk : decodedChunk;
    this.pendingTail = '';

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
        // Incomplete markup: carry the tail to the next chunk
        this.pendingTail = window.slice(ltPos);
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
    while (contentEnd > position + 1 && StaxXmlParser.isWhitespace(window.charCodeAt(contentEnd - 1))) {
      contentEnd--;
    }

    let isSelfClosing = false;
    let actualEnd = contentEnd;
    if (actualEnd > position + 1 && window.charCodeAt(actualEnd - 1) === 47) {
      isSelfClosing = true;
      actualEnd--;
      while (actualEnd > position + 1 && StaxXmlParser.isWhitespace(window.charCodeAt(actualEnd - 1))) {
        actualEnd--;
      }
    }

    // Extract tag name and detect colon in a single pass
    let nameEnd = position + 1;
    let colonPos = -1;
    while (nameEnd < actualEnd) {
      const code = window.charCodeAt(nameEnd);
      if (code === 58 /* ':' */ && colonPos === -1) colonPos = nameEnd;
      if (StaxXmlParser.isWhitespace(code) || code === 47 || code === 62) {
        break;
      }
      nameEnd++;
    }

    const tagName = window.slice(position + 1, nameEnd);
    const parentNamespaces = this.namespaceStack[this.namespaceStack.length - 1];

    // Fast path: simple element with no namespace prefix and no attributes
    if (colonPos === -1 && nameEnd === tagEnd && window.charCodeAt(nameEnd) === 62) {
      const uri = parentNamespaces?.get('');
      this.enqueueEvent(XmlEventFactory.startElement(
        tagName, tagName, undefined, uri,
        StaxXmlParser.EMPTY_ATTRS,
        StaxXmlParser.EMPTY_ATTRS_WITH_PREFIX,
      ));
      if (isSelfClosing) {
        this.enqueueEvent(XmlEventFactory.endElement(tagName, tagName, undefined, uri));
      } else {
        this.elementStack.push(tagName);
        // Share parent namespace map — no copy needed when no xmlns declared
        this.namespaceStack.push(parentNamespaces ?? new Map());
      }
      return tagEnd + 1;
    }

    // General path: parse attributes (handles xmlns, prefixed names, etc.)
    const includeAttributes = !this.eventFilter || this.eventFilter.includeAttributes;
    const { attributes, attributesWithPrefix, namespaces } = this.parseAttributesFast(
      window,
      nameEnd,
      actualEnd,
      parentNamespaces ?? new Map(),
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
      prefix = tagName.slice(0, colonPos - (position + 1));
      localName = tagName.slice(colonPos - (position + 1) + 1);
      uri = namespaces.get(prefix);
    }

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
      this.namespaceStack.push(namespaces);
    }

    return tagEnd + 1;
  }

  private parseAttributesFast(
    window: string,
    start: number,
    end: number,
    parentNamespaces: Map<string, string>,
    includeAttributes: boolean,
  ): { attributes: Record<string, string>; attributesWithPrefix: Record<string, AttributeInfo>; namespaces: Map<string, string> } {
    if (start >= end) {
      return {
        attributes: StaxXmlParser.EMPTY_ATTRS,
        attributesWithPrefix: StaxXmlParser.EMPTY_ATTRS_WITH_PREFIX,
        namespaces: parentNamespaces,
      };
    }

    const attributes: Record<string, string> = {};
    const attributesWithPrefix: Record<string, AttributeInfo> = {};
    // Lazy copy: only create new Map when first xmlns attr is found
    let namespaces: Map<string, string> = parentNamespaces;
    let namespaceCopied = false;

    let index = start;
    while (index < end) {
      while (index < end && StaxXmlParser.isWhitespace(window.charCodeAt(index))) {
        index++;
      }
      if (index >= end) {
        break;
      }

      const nameStart = index;
      while (index < end) {
        const code = window.charCodeAt(index);
        if (code === 61 || StaxXmlParser.isWhitespace(code)) {
          break;
        }
        index++;
      }

      if (index === nameStart) {
        break;
      }

      const attrName = window.slice(nameStart, index);
      while (index < end && StaxXmlParser.isWhitespace(window.charCodeAt(index))) {
        index++;
      }

      if (index >= end || window.charCodeAt(index) !== 61) {
        if (includeAttributes) {
          this.recordAttribute(attributes, attributesWithPrefix, namespaces, attrName, 'true');
        }
        continue;
      }

      index++;
      while (index < end && StaxXmlParser.isWhitespace(window.charCodeAt(index))) {
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

      // xmlns pre-filter: 'x'=120, min length 5 ('xmlns')
      const c0 = attrName.charCodeAt(0);
      if (c0 === 120 && attrName.length >= 5) {
        if (attrName === 'xmlns') {
          if (!namespaceCopied) { namespaces = new Map(parentNamespaces); namespaceCopied = true; }
          namespaces.set('', attrValue);
        } else if (attrName.charCodeAt(5) === 58 && attrName.slice(0, 5) === 'xmlns') {
          if (!namespaceCopied) { namespaces = new Map(parentNamespaces); namespaceCopied = true; }
          namespaces.set(attrName.slice(6), attrValue);
        }
      }

      if (includeAttributes) {
        this.recordAttribute(attributes, attributesWithPrefix, namespaces, attrName, attrValue);
      }
      index++;
    }

    return { attributes, attributesWithPrefix, namespaces };
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
    if (!decodedText) {
      return;
    }

    // Check for whitespace-only text without allocating trim()
    let isWs = true;
    for (let i = 0; i < decodedText.length; i++) {
      const c = decodedText.charCodeAt(i);
      if (c !== 32 && c !== 9 && c !== 10 && c !== 13) {
        isWs = false;
        break;
      }
    }
    if (isWs) {
      return;
    }

    if (!this.eventFilter || this.eventFilter.includeCharacters) {
      this.enqueueEvent(XmlEventFactory.characters(decodedText));
    }
  }

  private enqueueEvent(event: AnyXmlEvent): void {
    // Circular buffer enqueue
    if (this.queueSize === this.eventQueue.length) {
      this.growQueue();
    }
    this.eventQueue[this.queueTail] = event;
    this.queueTail = (this.queueTail + 1) % this.eventQueue.length;
    this.queueSize++;

    if (this.resolveNext !== null) {
      const resolve = this.resolveNext;
      this.resolveNext = null;
      // Dequeue the event we just enqueued and resolve the pending consumer
      const next = this.dequeueEvent();
      resolve({ value: next, done: false });
    }
  }

  private dequeueEvent(): AnyXmlEvent {
    const event = this.eventQueue[this.queueHead]!;
    this.queueHead = (this.queueHead + 1) % this.eventQueue.length;
    this.queueSize--;
    return event;
  }

  private growQueue(): void {
    const oldCapacity = this.eventQueue.length;
    const newCapacity = oldCapacity * 2;
    const newQueue = new Array<AnyXmlEvent>(newCapacity);
    for (let i = 0; i < this.queueSize; i++) {
      newQueue[i] = this.eventQueue[(this.queueHead + i) % oldCapacity]!;
    }
    this.eventQueue = newQueue;
    this.queueHead = 0;
    this.queueTail = this.queueSize;
  }

  private addError(error: Error): void {
    if (this.error !== null) {
      return;
    }

    this.error = error;
    this.enqueueEvent(XmlEventFactory.error(error));
    this.parserFinished = true;
    this.pendingTail = '';
    this.pendingTextSegments.length = 0;
    this.resolveBatchReadyIfNeeded();
    this.resolveDoneIfNeeded();
  }

  private resolveDoneIfNeeded(): void {
    if (this.resolveNext !== null && this.queueSize === 0 && this.parserFinished) {
      const resolve = this.resolveNext;
      this.resolveNext = null;
      resolve({ value: undefined, done: true });
    }
  }

  private waitForBatchReady(): Promise<void> {
    if (this.queueSize > 0 || this.parserFinished || this.error) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.resolveBatchReady = resolve;
    });
  }

  private resolveBatchReadyIfNeeded(): void {
    if (this.resolveBatchReady !== null && (this.queueSize > 0 || this.parserFinished || this.error)) {
      const resolve = this.resolveBatchReady;
      this.resolveBatchReady = null;
      resolve();
    }
  }

  private enqueueStartDocumentIfNeeded(): void {
    if (this.documentStarted) {
      return;
    }

    this.documentStarted = true;
    this.enqueueEvent(XmlEventFactory.startDocument());
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
    while (start < end && StaxXmlParser.isWhitespace(window.charCodeAt(start))) {
      start++;
    }
    while (end > start && StaxXmlParser.isWhitespace(window.charCodeAt(end - 1))) {
      end--;
    }
    return start < end ? window.slice(start, end) : '';
  }

  private compileEntityDecoder(): (text: string) => string {
    if (!this.options.autoDecodeEntities) {
      return (text) => text;
    }

    if (this.options.addEntities && this.options.addEntities.length > 0) {
      const entityMap: Record<string, string> = { ...StaxXmlParser.DEFAULT_ENTITY_MAP };
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
      let regex = StaxXmlParser.ENTITY_REGEX_CACHE.get(cacheKey);
      if (!regex) {
        const pattern = patterns
          .sort((left, right) => right.length - left.length)
          .map((entity) => entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|');
        regex = new RegExp(`&(${pattern});`, 'g');
        StaxXmlParser.ENTITY_REGEX_CACHE.set(cacheKey, regex);
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
      StaxXmlParser.DEFAULT_ENTITY_REGEX.lastIndex = 0;
      return text.replace(
        StaxXmlParser.DEFAULT_ENTITY_REGEX,
        (_, entity) => StaxXmlParser.DEFAULT_ENTITY_MAP[entity] || _,
      );
    };
  }

  private static isWhitespace(code: number): boolean {
    if (code < 128) {
      return StaxXmlParser.ASCII_TABLE[code] === 1;
    }
    return code <= 32 || StaxXmlParser.UNICODE_WHITESPACE.has(code);
  }
}

export function createStaxXmlParser(
  xmlStream: ReadableStream<Uint8Array>,
  options: StaxXmlParserOptions = {},
): StaxXmlParser {
  return new StaxXmlParser(xmlStream, options);
}

export default StaxXmlParser;

