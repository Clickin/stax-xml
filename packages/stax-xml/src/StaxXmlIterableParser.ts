import {
  XmlEventFactory,
  type AnyXmlEvent,
  type AttributeInfo,
  type ParserEventFilter,
} from './types.js';

/**
 * Configuration options shared by iterable byte-batch parsers.
 *
 * @public
 */
export interface StaxXmlIterableParserOptions {
  /**
   * Text encoding for byte chunks.
   * @defaultValue 'utf-8'
   */
  encoding?: string;

  /**
   * Additional custom entities to decode.
   * @defaultValue []
   */
  addEntities?: { entity: string; value: string }[];

  /**
   * Whether to automatically decode XML entities.
   * @defaultValue true
   */
  autoDecodeEntities?: boolean;

  /**
   * Event materialization filter used by converter fast paths.
   */
  eventFilter?: ParserEventFilter;
}

export type ByteBatch = readonly Uint8Array[];

export interface ByteBatchOptions {
  /**
   * Number of chunks to group into each yielded batch.
   * @defaultValue 16
   */
  batchSize?: number;
}

const DEFAULT_BATCH_SIZE = 16;

const ASCII_TABLE = /* @__PURE__ */ (() => {
  const table = new Uint8Array(128);
  table[9] = 1;
  table[10] = 1;
  table[13] = 1;
  table[32] = 1;
  return table;
})();

const UNICODE_WHITESPACE = /* @__PURE__ */ new Set([
  0x00A0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A,
  0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF,
]);

const DEFAULT_ENTITY_REGEX = /&(lt|gt|quot|apos|amp);/g;
const ENTITY_REGEX_CACHE = new Map<string, RegExp>();
const DEFAULT_ENTITY_MAP: Record<string, string> = {
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  amp: '&',
};

const EMPTY_ATTRS: Record<string, string> = Object.freeze({});
const EMPTY_ATTRS_WITH_PREFIX: Record<string, AttributeInfo> = Object.freeze({});

/**
 * Convert a chunk iterable into the byte-batch ABI consumed by StAX iterable parsers.
 *
 * @public
 */
export function* toByteBatches(
  source: Iterable<Uint8Array>,
  options: ByteBatchOptions = {},
): Iterable<ByteBatch> {
  const batchSize = normalizeBatchSize(options.batchSize);
  let batch: Uint8Array[] = [];

  for (const chunk of source) {
    batch.push(chunk);
    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }

  if (batch.length > 0) {
    yield batch;
  }
}

/**
 * Convert an async chunk iterable into the byte-batch ABI consumed by async StAX iterable parsers.
 *
 * @public
 */
export async function* toAsyncByteBatches(
  source: AsyncIterable<Uint8Array>,
  options: ByteBatchOptions = {},
): AsyncIterable<ByteBatch> {
  const batchSize = normalizeBatchSize(options.batchSize);
  let batch: Uint8Array[] = [];

  for await (const chunk of source) {
    batch.push(chunk);
    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }

  if (batch.length > 0) {
    yield batch;
  }
}

/**
 * Synchronous StAX pull parser for iterable byte batches.
 *
 * @public
 */
export class StaxXmlIterableParser implements Iterable<AnyXmlEvent[]> {
  private readonly iterator: Iterator<ByteBatch>;
  private readonly core: IterableParserCore;
  private sourceDone = false;

  constructor(source: Iterable<ByteBatch>, options: StaxXmlIterableParserOptions = {}) {
    this.iterator = source[Symbol.iterator]();
    this.core = new IterableParserCore(options);
  }

  nextBatch(): AnyXmlEvent[] {
    if (!this.core.hasStarted()) {
      this.core.start();
    }

    while (!this.sourceDone) {
      const result = this.iterator.next();
      if (result.done) {
        this.sourceDone = true;
        this.core.finish();
      } else {
        this.core.pushBatch(result.value);
      }

      const batch = this.core.drainEvents();
      if (batch.length > 0) {
        return batch;
      }
    }

    return this.core.drainEvents();
  }

  *batchedIterator(): IterableIterator<AnyXmlEvent[]> {
    while (true) {
      const batch = this.nextBatch();
      if (batch.length === 0) {
        break;
      }
      yield batch;
    }
  }

  [Symbol.iterator](): Iterator<AnyXmlEvent[]> {
    return this.batchedIterator();
  }
}

/**
 * Asynchronous StAX pull parser for async iterable byte batches.
 *
 * The async surface is batch-oriented: each pull returns a non-empty event
 * batch until EOF, where it returns an empty array.
 *
 * @public
 */
export class StaxXmlAsyncIterableParser implements AsyncIterable<AnyXmlEvent[]> {
  private readonly iterator: AsyncIterator<ByteBatch>;
  private readonly core: IterableParserCore;
  private sourceDone = false;

  constructor(source: AsyncIterable<ByteBatch>, options: StaxXmlIterableParserOptions = {}) {
    this.iterator = source[Symbol.asyncIterator]();
    this.core = new IterableParserCore(options);
  }

  async nextBatch(): Promise<AnyXmlEvent[]> {
    if (!this.core.hasStarted()) {
      this.core.start();
    }

    while (!this.sourceDone) {
      const result = await this.iterator.next();
      if (result.done) {
        this.sourceDone = true;
        this.core.finish();
      } else {
        this.core.pushBatch(result.value);
      }

      const batch = this.core.drainEvents();
      if (batch.length > 0) {
        return batch;
      }
    }

    return this.core.drainEvents();
  }

  async *batchedIterator(): AsyncGenerator<AnyXmlEvent[]> {
    while (true) {
      const batch = await this.nextBatch();
      if (batch.length === 0) {
        break;
      }
      yield batch;
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<AnyXmlEvent[]> {
    return this.batchedIterator();
  }
}

class IterableParserCore {
  private readonly decoder: TextDecoder;
  private readonly options: Required<Pick<StaxXmlIterableParserOptions, 'encoding' | 'autoDecodeEntities'>> & StaxXmlIterableParserOptions;
  private readonly eventFilter?: ParserEventFilter;
  private readonly entityDecoder: (text: string) => string;

  private readonly eventQueue: AnyXmlEvent[] = [];
  private queueHead = 0;
  private readonly elementStack: string[] = [];
  private readonly namespaceStack: Map<string, string>[] = [];
  private readonly pendingTextSegments: string[] = [];
  private pendingTail = '';
  private started = false;
  private finished = false;

  constructor(options: StaxXmlIterableParserOptions) {
    this.options = {
      encoding: 'utf-8',
      autoDecodeEntities: true,
      ...options,
    };
    this.eventFilter = options.eventFilter;
    this.decoder = new TextDecoder(this.options.encoding, {
      fatal: false,
      ignoreBOM: true,
    });
    this.entityDecoder = this.compileEntityDecoder();
  }

  hasStarted(): boolean {
    return this.started;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.enqueueEvent(XmlEventFactory.startDocument());
  }

  pushBatch(batch: ByteBatch): void {
    this.start();
    for (let index = 0; index < batch.length; index++) {
      const decoded = this.decoder.decode(batch[index], { stream: true });
      this.processDecodedChunk(decoded, false);
    }
  }

  finish(): void {
    if (this.finished) {
      return;
    }

    this.start();
    const flushed = this.decoder.decode();
    this.processDecodedChunk(flushed, true);

    if (this.pendingTail.length > 0) {
      throw new Error('Unexpected end of document. Incomplete markup at end of stream.');
    }

    this.flushTextSegments();

    if (this.elementStack.length > 0) {
      throw new Error('Unexpected end of document. Not all elements were closed.');
    }

    this.enqueueEvent(XmlEventFactory.endDocument());
    this.finished = true;
  }

  drainEvents(): AnyXmlEvent[] {
    if (this.queueHead >= this.eventQueue.length) {
      return [];
    }

    const batch = this.eventQueue.slice(this.queueHead);
    this.eventQueue.length = 0;
    this.queueHead = 0;
    return batch;
  }

  private processDecodedChunk(decodedChunk: string, isFinal: boolean): void {
    const window = this.pendingTail.length > 0 ? this.pendingTail + decodedChunk : decodedChunk;
    this.pendingTail = '';

    let position = 0;
    while (position < window.length) {
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
    while (contentEnd > position + 1 && isWhitespace(window.charCodeAt(contentEnd - 1))) {
      contentEnd--;
    }

    let isSelfClosing = false;
    let actualEnd = contentEnd;
    if (actualEnd > position + 1 && window.charCodeAt(actualEnd - 1) === 47) {
      isSelfClosing = true;
      actualEnd--;
      while (actualEnd > position + 1 && isWhitespace(window.charCodeAt(actualEnd - 1))) {
        actualEnd--;
      }
    }

    let nameEnd = position + 1;
    let colonPos = -1;
    while (nameEnd < actualEnd) {
      const code = window.charCodeAt(nameEnd);
      if (code === 58 && colonPos === -1) {
        colonPos = nameEnd;
      }
      if (isWhitespace(code) || code === 47 || code === 62) {
        break;
      }
      nameEnd++;
    }

    const tagName = window.slice(position + 1, nameEnd);
    const parentNamespaces = this.namespaceStack[this.namespaceStack.length - 1];

    if (colonPos === -1 && nameEnd === tagEnd && window.charCodeAt(nameEnd) === 62) {
      const uri = parentNamespaces?.get('');
      this.enqueueEvent(XmlEventFactory.startElement(
        tagName,
        tagName,
        undefined,
        uri,
        EMPTY_ATTRS,
        EMPTY_ATTRS_WITH_PREFIX,
      ));

      if (isSelfClosing) {
        this.enqueueEvent(XmlEventFactory.endElement(tagName, tagName, undefined, uri));
      } else {
        this.elementStack.push(tagName);
        this.namespaceStack.push(parentNamespaces ?? new Map());
      }
      return tagEnd + 1;
    }

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
        attributes: EMPTY_ATTRS,
        attributesWithPrefix: EMPTY_ATTRS_WITH_PREFIX,
        namespaces: parentNamespaces,
      };
    }

    const attributes: Record<string, string> = {};
    const attributesWithPrefix: Record<string, AttributeInfo> = {};
    let namespaces: Map<string, string> = parentNamespaces;
    let namespaceCopied = false;

    let index = start;
    while (index < end) {
      while (index < end && isWhitespace(window.charCodeAt(index))) {
        index++;
      }
      if (index >= end) {
        break;
      }

      const nameStart = index;
      while (index < end) {
        const code = window.charCodeAt(index);
        if (code === 61 || isWhitespace(code)) {
          break;
        }
        index++;
      }

      if (index === nameStart) {
        break;
      }

      const attrName = window.slice(nameStart, index);
      while (index < end && isWhitespace(window.charCodeAt(index))) {
        index++;
      }

      if (index >= end || window.charCodeAt(index) !== 61) {
        if (includeAttributes) {
          this.recordAttribute(attributes, attributesWithPrefix, namespaces, attrName, 'true');
        }
        continue;
      }

      index++;
      while (index < end && isWhitespace(window.charCodeAt(index))) {
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
      const c0 = attrName.charCodeAt(0);
      if (c0 === 120 && attrName.length >= 5) {
        if (attrName === 'xmlns') {
          if (!namespaceCopied) {
            namespaces = new Map(parentNamespaces);
            namespaceCopied = true;
          }
          namespaces.set('', attrValue);
        } else if (attrName.charCodeAt(5) === 58 && attrName.slice(0, 5) === 'xmlns') {
          if (!namespaceCopied) {
            namespaces = new Map(parentNamespaces);
            namespaceCopied = true;
          }
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

    const trimmedText = trimmedString(rawText);
    if (!trimmedText) {
      return;
    }

    if (!this.eventFilter || this.eventFilter.includeCharacters) {
      this.enqueueEvent(XmlEventFactory.characters(this.entityDecoder(trimmedText)));
    }
  }

  private enqueueEvent(event: AnyXmlEvent): void {
    this.eventQueue.push(event);
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
    while (start < end && isWhitespace(window.charCodeAt(start))) {
      start++;
    }
    while (end > start && isWhitespace(window.charCodeAt(end - 1))) {
      end--;
    }
    return start < end ? window.slice(start, end) : '';
  }

  private compileEntityDecoder(): (text: string) => string {
    if (!this.options.autoDecodeEntities) {
      return (text) => text;
    }

    if (this.options.addEntities && this.options.addEntities.length > 0) {
      const entityMap: Record<string, string> = { ...DEFAULT_ENTITY_MAP };
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
      let regex = ENTITY_REGEX_CACHE.get(cacheKey);
      if (!regex) {
        const pattern = patterns
          .sort((left, right) => right.length - left.length)
          .map((entity) => entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|');
        regex = new RegExp(`&(${pattern});`, 'g');
        ENTITY_REGEX_CACHE.set(cacheKey, regex);
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
      DEFAULT_ENTITY_REGEX.lastIndex = 0;
      return text.replace(
        DEFAULT_ENTITY_REGEX,
        (_, entity) => DEFAULT_ENTITY_MAP[entity] || _,
      );
    };
  }
}

function normalizeBatchSize(value: number | undefined): number {
  const batchSize = value ?? DEFAULT_BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new RangeError('batchSize must be a positive integer.');
  }
  return batchSize;
}

function isWhitespace(code: number): boolean {
  if (code < 128) {
    return ASCII_TABLE[code] === 1;
  }
  return code <= 32 || UNICODE_WHITESPACE.has(code);
}

function trimmedString(value: string): string {
  let start = 0;
  let end = value.length;

  while (start < end && isWhitespace(value.charCodeAt(start))) {
    start++;
  }
  while (end > start && isWhitespace(value.charCodeAt(end - 1))) {
    end--;
  }
  return start < end ? value.slice(start, end) : '';
}
