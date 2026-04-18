import {
  AnyXmlEvent,
  CdataEvent,
  CharactersEvent,
  EndDocumentEvent,
  EndElementEvent,
  ErrorEvent,
  StartElementEvent,
  UnifiedXmlEvent,
  XmlEventType,
} from '../../types';

export interface XmlParserCoreOptions {
  encoding?: string;
  addEntities?: { entity: string, value: string }[];
  autoDecodeEntities?: boolean;
  maxBufferSize?: number;
  enableBufferCompaction?: boolean;
  batchSize?: number;
  batchTimeout?: number;
  initialQueueCapacity?: number;
}

export class XmlParserCore {
  private readonly decoder: TextDecoder;
  private buffer: Uint8Array;
  private bufferLength = 0;
  private position = 0;

  private eventQueue: AnyXmlEvent[];
  private queueHead = 0;
  private queueTail = 0;
  private queueSize = 0;
  private readonly initialCapacity: number;

  private error: Error | null = null;
  private isStreamEnded = false;
  private parserFinished = false;
  private currentTextBuffer = '';
  private elementStack: string[] = [];
  private namespaceStack: Map<string, string>[] = [];
  private readonly options: XmlParserCoreOptions;

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
    table[38] = 10;
    table[91] = 11;
    table[93] = 12;
    return table;
  })();

  private static readonly ENTITY_REGEX_CACHE = new Map<string, RegExp>();
  private static readonly DEFAULT_ENTITY_REGEX = /&(lt|gt|quot|apos|amp);/g;
  private static readonly DEFAULT_ENTITY_MAP: Record<string, string> = {
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    amp: '&',
  };

  private readonly entityDecoder: (text: string) => string;
  private readonly bmhCache = new Map<string, Uint8Array>();

  private batchMetrics = {
    avgEventSize: 100,
    lastBatchTime: 0,
    eventCount: 0,
  };

  constructor(options: XmlParserCoreOptions = {}) {
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

    this.decoder = new TextDecoder(this.options.encoding, {
      fatal: false,
      ignoreBOM: true,
    });

    this.buffer = new Uint8Array(this.options.maxBufferSize || 64 * 1024);
    this.initialCapacity = this.options.initialQueueCapacity || 1024;
    this.eventQueue = new Array(this.initialCapacity);
    this.entityDecoder = this._compileEntityDecoder();

    this._addEvent({
      type: XmlEventType.START_DOCUMENT,
      name: undefined,
      localName: undefined,
      prefix: undefined,
      uri: undefined,
      attributes: undefined,
      attributesWithPrefix: undefined,
      value: undefined,
      error: undefined,
    } as UnifiedXmlEvent as StartElementEvent);
  }

  public feed(chunk: Uint8Array): void {
    if (this.parserFinished || this.error || this.isStreamEnded || chunk.length === 0) {
      return;
    }

    this._appendToBuffer(chunk);
    this._parseBuffer();
    this._compactBufferIfNeeded();
    this._updateBatchMetrics(chunk.length);
  }

  public end(): void {
    if (this.parserFinished || this.isStreamEnded) {
      return;
    }

    this.isStreamEnded = true;
    this._parseBuffer();

    if (!this.parserFinished && this.elementStack.length > 0) {
      this._addError(new Error('Unexpected end of document. Not all elements were closed.'));
    }

    if (!this.parserFinished) {
      this._flushCharacters();
      this._addEvent({
        type: XmlEventType.END_DOCUMENT,
        name: undefined,
        localName: undefined,
        prefix: undefined,
        uri: undefined,
        attributes: undefined,
        attributesWithPrefix: undefined,
        value: undefined,
        error: undefined,
      } as UnifiedXmlEvent as EndDocumentEvent);
      this.parserFinished = true;
    }
  }

  public fail(err: Error): void {
    this._addError(err);
  }

  public nextEvent(): AnyXmlEvent | null {
    return this._dequeueEvent();
  }

  public getError(): Error | null {
    return this.error;
  }

  public getDone(): boolean {
    return this.parserFinished && this.queueSize === 0;
  }

  public getRecommendedBatchSize(): number {
    return this._calculateOptimalBatchSize();
  }

  public getBatchTimeout(): number {
    return this.options.batchTimeout || 10;
  }

  private _enqueueEvent(event: AnyXmlEvent): void {
    if (this.queueSize === this.eventQueue.length) {
      this._growQueue();
    }

    this.eventQueue[this.queueTail] = event;
    this.queueTail = (this.queueTail + 1) % this.eventQueue.length;
    this.queueSize++;
  }

  private _dequeueEvent(): AnyXmlEvent | null {
    if (this.queueSize === 0) {
      return null;
    }

    const event = this.eventQueue[this.queueHead];
    this.queueHead = (this.queueHead + 1) % this.eventQueue.length;
    this.queueSize--;
    return event;
  }

  private _growQueue(): void {
    const oldCapacity = this.eventQueue.length;
    const newCapacity = oldCapacity * 2;
    const newQueue = new Array(newCapacity);

    let writeIndex = 0;
    for (let i = 0; i < this.queueSize; i++) {
      const readIndex = (this.queueHead + i) % oldCapacity;
      newQueue[writeIndex++] = this.eventQueue[readIndex];
    }

    this.eventQueue = newQueue;
    this.queueHead = 0;
    this.queueTail = this.queueSize;
  }

  private getXmlCharType(byte: number): number {
    return byte < 128 ? XmlParserCore.ASCII_TABLE[byte] : 0;
  }

  private isUtf8CharStart(byte: number): boolean {
    return (byte & 0x80) === 0 || (byte & 0xC0) === 0xC0;
  }

  private getUtf8SequenceLength(byte: number): number {
    if ((byte & 0x80) === 0) return 1;
    if ((byte & 0xE0) === 0xC0) return 2;
    if ((byte & 0xF0) === 0xE0) return 3;
    if ((byte & 0xF8) === 0xF0) return 4;
    return 1;
  }

  private findSafeUtf8Boundary(pos: number, searchBackward = true): number {
    if (pos <= 0 || pos >= this.bufferLength) return pos;

    if (searchBackward) {
      let safePos = pos;
      let backtrack = 0;

      while (safePos > 0 && backtrack < 4) {
        if (this.isUtf8CharStart(this.buffer[safePos])) {
          const seqLen = this.getUtf8SequenceLength(this.buffer[safePos]);
          if (safePos + seqLen > pos) {
            return safePos;
          }
          return pos;
        }
        safePos--;
        backtrack++;
      }
      return pos;
    }

    while (pos < this.bufferLength && !this.isUtf8CharStart(this.buffer[pos])) {
      pos++;
    }
    return pos;
  }

  private safeDecodeRange(start: number, end: number): string {
    const safeStart = this.findSafeUtf8Boundary(start, false);
    const safeEnd = this.findSafeUtf8Boundary(end, true);

    if (safeStart >= safeEnd) return '';

    return this.decoder.decode(this.buffer.subarray(safeStart, safeEnd), { stream: false });
  }

  private _buildBMHTable(pattern: Uint8Array): Uint8Array {
    const table = new Uint8Array(256);
    const patternLength = pattern.length;
    table.fill(patternLength);

    for (let i = 0; i < patternLength - 1; i++) {
      table[pattern[i]] = patternLength - 1 - i;
    }

    return table;
  }

  private _findPatternBMH(pattern: string, startPos?: number): number {
    const patternBytes = new TextEncoder().encode(pattern);
    const patternLength = patternBytes.length;

    if (patternLength === 0) return -1;
    if (patternLength === 1) {
      return this._findSingleByte(patternBytes[0], startPos);
    }

    let skipTable = this.bmhCache.get(pattern);
    if (!skipTable) {
      skipTable = this._buildBMHTable(patternBytes);
      if (this.bmhCache.size > 20) {
        this.bmhCache.clear();
      }
      this.bmhCache.set(pattern, skipTable);
    }

    const start = startPos || this.position;
    const bufferEnd = this.bufferLength - patternLength;
    let pos = start;

    while (pos <= bufferEnd) {
      let i = patternLength - 1;
      while (i >= 0 && this.buffer[pos + i] === patternBytes[i]) {
        i--;
      }

      if (i < 0) {
        return pos;
      }

      pos += skipTable[this.buffer[pos + patternLength - 1]];
    }

    return -1;
  }

  private _findSingleByte(byte: number, startPos?: number): number {
    const start = startPos || this.position;
    const buffer = this.buffer;
    const end = this.bufferLength;

    const end4 = end - 3;
    let i = start;

    for (; i < end4; i += 4) {
      if (buffer[i] === byte) return i;
      if (buffer[i + 1] === byte) return i + 1;
      if (buffer[i + 2] === byte) return i + 2;
      if (buffer[i + 3] === byte) return i + 3;
    }

    for (; i < end; i++) {
      if (buffer[i] === byte) return i;
    }

    return -1;
  }

  private _compileEntityDecoder(): (text: string) => string {
    if (!this.options.autoDecodeEntities) {
      return (text) => text;
    }

    if (this.options.addEntities && this.options.addEntities.length > 0) {
      const entityMap: Record<string, string> = { ...XmlParserCore.DEFAULT_ENTITY_MAP };
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
      let regex = XmlParserCore.ENTITY_REGEX_CACHE.get(cacheKey);

      if (!regex) {
        const pattern = patterns
          .sort((a, b) => b.length - a.length)
          .map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|');
        regex = new RegExp(`&(${pattern});`, 'g');
        XmlParserCore.ENTITY_REGEX_CACHE.set(cacheKey, regex);
      }

      return (text: string) => {
        if (!text || text.indexOf('&') === -1) return text;
        regex!.lastIndex = 0;
        return text.replace(regex!, (_, entity) => entityMap[entity] || _);
      };
    }

    return (text: string) => {
      if (!text || text.indexOf('&') === -1) return text;
      XmlParserCore.DEFAULT_ENTITY_REGEX.lastIndex = 0;
      return text.replace(XmlParserCore.DEFAULT_ENTITY_REGEX, (_, entity) => XmlParserCore.DEFAULT_ENTITY_MAP[entity] || _);
    };
  }

  private _calculateOptimalBatchSize(): number {
    const MIN_BATCH = 1;
    const MAX_BATCH = this.options.batchSize || 10;

    if (this.bufferLength < 1024) return MIN_BATCH;
    if (this.bufferLength > 10240) return MAX_BATCH;

    if (this.queueSize > 0) {
      const headIndex = this.queueHead;
      const lastEvent = this.eventQueue[headIndex];
      if (lastEvent?.type === XmlEventType.CHARACTERS) {
        return MIN_BATCH;
      }
    }

    if (this.batchMetrics.eventCount > 100) {
      const avgSize = this.batchMetrics.avgEventSize;
      if (avgSize > 1000) return MIN_BATCH;
      if (avgSize < 100) return MAX_BATCH;
    }

    return Math.min(MAX_BATCH, Math.max(MIN_BATCH, Math.floor(this.bufferLength / 1024)));
  }

  private _compactBufferIfNeeded(): void {
    if (!this.options.enableBufferCompaction) return;

    const maxSize = this.options.maxBufferSize || 64 * 1024;
    const shouldCompact =
      (this.position > 8192 && this.bufferLength > 16384) ||
      (this.position > maxSize / 2) ||
      (this.bufferLength > maxSize && this.position > maxSize / 4);

    if (shouldCompact) {
      this._compactBuffer();
    }
  }

  private _compactBuffer(): void {
    if (this.position > 0 && this.position < this.bufferLength) {
      const safePos = this.findSafeUtf8Boundary(this.position, true);
      const remainingLength = this.bufferLength - safePos;

      if (remainingLength < safePos) {
        const newBuffer = new Uint8Array(this.buffer.length);
        newBuffer.set(this.buffer.subarray(safePos, this.bufferLength));
        this.buffer = newBuffer;
      } else {
        this.buffer.copyWithin(0, safePos, this.bufferLength);
      }

      this.bufferLength = remainingLength;
      this.position = this.position - safePos;

      if (this.bmhCache.size > 20) {
        this.bmhCache.clear();
      }
    }
  }

  private _updateBatchMetrics(bytesProcessed: number): void {
    const eventsDelta = this.queueSize;
    if (eventsDelta > 0) {
      this.batchMetrics.eventCount += eventsDelta;
      this.batchMetrics.avgEventSize =
        (this.batchMetrics.avgEventSize * 0.9) +
        ((bytesProcessed / eventsDelta) * 0.1);
    }
    this.batchMetrics.lastBatchTime = Date.now();
  }

  private _parseBuffer(): void {
    while (this.position < this.bufferLength && !this.parserFinished) {
      const ltPos = this._findSingleByte(60, this.position);

      if (ltPos === -1) {
        if (this.isStreamEnded) {
          const remainingText = this._readBuffer();
          this.currentTextBuffer += remainingText;
          this._flushCharacters();
        }
        break;
      }

      if (ltPos > this.position) {
        try {
          const textLength = ltPos - this.position;
          const text = this._readBuffer(textLength);
          this.currentTextBuffer += text;
        } catch (error) {
          if (!this.isStreamEnded) break;
          throw error;
        }
      }

      this.position = ltPos;

      const nextByte = this.buffer[this.position + 1];
      const charType = this.getXmlCharType(nextByte);

      if (charType === 4) {
        this._flushCharacters();
        if (!this._parseEndTag()) break;
      } else if (charType === 6) {
        if (this._matchesPattern('<!--')) {
          if (!this._parseComment()) break;
        } else if (this._matchesPattern('<![CDATA[')) {
          if (!this._parseCData()) break;
        } else {
          if (this.isStreamEnded) {
            this._addError(new Error(`Malformed XML near position ${this.position}`));
            return;
          }
          break;
        }
      } else if (charType === 7) {
        if (this._matchesPattern('<?xml')) {
          if (!this._parseXmlDeclaration()) break;
        } else if (this._matchesPattern('<?')) {
          if (!this._parseProcessingInstruction()) break;
        }
      } else {
        this._flushCharacters();
        if (!this._parseStartTag()) break;
      }

      this._compactBufferIfNeeded();
    }
  }

  private _flushCharacters(): void {
    if (this.currentTextBuffer.length > 0) {
      const decodedText = this.entityDecoder(this.currentTextBuffer);

      if (decodedText.trim().length > 0) {
        this._addEvent({
          type: XmlEventType.CHARACTERS,
          name: undefined,
          localName: undefined,
          prefix: undefined,
          uri: undefined,
          attributes: undefined,
          attributesWithPrefix: undefined,
          value: decodedText,
          error: undefined,
        } as UnifiedXmlEvent as CharactersEvent);
      }
      this.currentTextBuffer = '';
    }
  }

  private _clearBuffers(): void {
    this.bufferLength = 0;
    this.position = 0;
    this.currentTextBuffer = '';
    this.bmhCache.clear();
  }

  private _addEvent(event: AnyXmlEvent): void {
    this._enqueueEvent(event);
  }

  private _addError(err: Error): void {
    if (this.error === null) {
      this.error = err;
      this._addEvent({
        type: XmlEventType.ERROR,
        name: undefined,
        localName: undefined,
        prefix: undefined,
        uri: undefined,
        attributes: undefined,
        attributesWithPrefix: undefined,
        value: undefined,
        error: err,
      } as UnifiedXmlEvent as ErrorEvent);
      this.parserFinished = true;
      this._clearBuffers();
    }
  }

  private _appendToBuffer(newData: Uint8Array): void {
    const requiredSize = this.bufferLength + newData.length;

    if (requiredSize > this.buffer.length) {
      const newSize = Math.max(this.buffer.length * 2, requiredSize);
      const newBuffer = new Uint8Array(newSize);
      newBuffer.set(this.buffer.subarray(0, this.bufferLength));
      this.buffer = newBuffer;
    }

    this.buffer.set(newData, this.bufferLength);
    this.bufferLength += newData.length;
  }

  private _readBuffer(length?: number): string {
    const originalPos = this.position;
    let endPos = length ? Math.min(this.position + length, this.bufferLength) : this.bufferLength;

    if (length && endPos < this.bufferLength) {
      endPos = this.findSafeUtf8Boundary(endPos, true);
    }

    const slice = this.buffer.subarray(this.position, endPos);

    try {
      const result = this.decoder.decode(slice, { stream: !this.isStreamEnded });
      this.position = endPos;
      return result;
    } catch (error) {
      if (!this.isStreamEnded && endPos === this.bufferLength) {
        for (let i = 1; i <= 4 && endPos - i > this.position; i++) {
          const testEnd = this.findSafeUtf8Boundary(endPos - i, true);
          if (testEnd > this.position) {
            try {
              const safeSlice = this.buffer.subarray(this.position, testEnd);
              const result = this.decoder.decode(safeSlice, { stream: true });
              this.position = testEnd;
              return result;
            } catch {
              continue;
            }
          }
        }
      }
      this.position = originalPos;
      throw error;
    }
  }

  private _matchesPattern(pattern: string): boolean {
    const patternBytes = new TextEncoder().encode(pattern);
    if (this.position + patternBytes.length > this.bufferLength) {
      return false;
    }

    for (let i = 0; i < patternBytes.length; i++) {
      if (this.buffer[this.position + i] !== patternBytes[i]) {
        return false;
      }
    }
    return true;
  }

  private _parseXmlDeclaration(): boolean {
    const endPos = this._findPatternBMH('?>');
    if (endPos === -1) return false;
    this.position = endPos + 2;
    return true;
  }

  private _parseComment(): boolean {
    const endPos = this._findPatternBMH('-->');
    if (endPos === -1) return false;
    this.position = endPos + 3;
    return true;
  }

  private _parseCData(): boolean {
    const startPos = this.position + 9;
    const endPos = this._findPatternBMH(']]>');
    if (endPos === -1) return false;

    try {
      const safeStart = this.findSafeUtf8Boundary(startPos, false);
      const safeEnd = this.findSafeUtf8Boundary(endPos, true);

      const cdataContent = this.decoder.decode(this.buffer.subarray(safeStart, safeEnd), { stream: false });

      this._addEvent({
        type: XmlEventType.CDATA,
        name: undefined,
        localName: undefined,
        prefix: undefined,
        uri: undefined,
        attributes: undefined,
        attributesWithPrefix: undefined,
        value: cdataContent,
        error: undefined,
      } as UnifiedXmlEvent as CdataEvent);

      this.position = endPos + 3;
      return true;
    } catch (error) {
      if (!this.isStreamEnded) return false;
      throw error;
    }
  }

  private _parseProcessingInstruction(): boolean {
    const endPos = this._findPatternBMH('?>');
    if (endPos === -1) return false;
    this.position = endPos + 2;
    return true;
  }

  private _parseEndTag(): boolean {
    const gtPos = this._findSingleByte(62, this.position);
    if (gtPos === -1) return false;

    try {
      const tagContent = this.safeDecodeRange(this.position, gtPos + 1);
      const closeTagMatch = tagContent.match(/^<\/([a-zA-Z0-9_:.\-\u0080-\uFFFF]+)\s*>$/);

      if (!closeTagMatch) {
        this._addError(new Error('Malformed closing tag'));
        return true;
      }

      const tagName = closeTagMatch[1];
      if (this.elementStack.length === 0 || this.elementStack[this.elementStack.length - 1] !== tagName) {
        this._addError(new Error(`Mismatched closing tag: </${tagName}>. Expected </${this.elementStack[this.elementStack.length - 1] || 'nothing'}>`));
        return true;
      }

      const currentNamespaces = this.namespaceStack.length > 0
        ? this.namespaceStack[this.namespaceStack.length - 1]
        : new Map();
      const { localName, prefix, uri } = this._parseQualifiedName(tagName, currentNamespaces);

      this.elementStack.pop();
      this.namespaceStack.pop();

      this._addEvent({
        type: XmlEventType.END_ELEMENT,
        name: tagName,
        localName,
        prefix,
        uri,
        attributes: undefined,
        attributesWithPrefix: undefined,
        value: undefined,
        error: undefined,
      } as UnifiedXmlEvent as EndElementEvent);

      this.position = gtPos + 1;
      return true;
    } catch (error) {
      if (!this.isStreamEnded) return false;
      throw error;
    }
  }

  private _parseStartTag(): boolean {
    const gtPos = this._findSingleByte(62, this.position);
    if (gtPos === -1) return false;

    try {
      const tagContent = this.safeDecodeRange(this.position, gtPos + 1);
      const tagMatch = tagContent.match(/^<([a-zA-Z0-9_:.\-\u0080-\uFFFF]+)(\s+[^>]*?)?\s*(\/?)>$/);

      if (!tagMatch) {
        this._addError(new Error('Malformed start tag'));
        return true;
      }

      const tagName = tagMatch[1];
      const attributesString = tagMatch[2] || '';
      const isSelfClosing = tagMatch[3] === '/';

      const currentNamespaces = new Map<string, string>();
      if (this.namespaceStack.length > 0) {
        const parentNamespaces = this.namespaceStack[this.namespaceStack.length - 1];
        for (const [prefix, uri] of parentNamespaces) {
          currentNamespaces.set(prefix, uri);
        }
      }

      const attributes: { [key: string]: string } = {};
      const attributesWithPrefix: { [key: string]: { value: string; localName: string; prefix?: string; uri?: string } } = {};

      const attrRegex = /([a-zA-Z0-9_:.\-\u0080-\uFFFF]+)(?:\s*=\s*"([^"]*)"|\s*=\s*'([^']*)')?/g;
      let attrMatch = attrRegex.exec(attributesString);

      while (attrMatch !== null) {
        const attrName = attrMatch[1];
        const attrValue = this.entityDecoder(attrMatch[2] || attrMatch[3] || 'true');
        attributes[attrName] = attrValue;

        const attrNamespaceInfo = this._parseQualifiedName(attrName, currentNamespaces, true);
        let attributeLocalName = attrNamespaceInfo.localName;
        let attributePrefix = attrNamespaceInfo.prefix;
        let attributeUri = attrNamespaceInfo.uri;

        if (attrName === 'xmlns') {
          attributeLocalName = 'xmlns';
          attributePrefix = undefined;
          attributeUri = undefined;
        } else if (attrName.startsWith('xmlns:')) {
          attributeLocalName = attrName.substring(6);
          attributePrefix = 'xmlns';
          attributeUri = undefined;
        }

        attributesWithPrefix[attrName] = {
          value: attrValue,
          localName: attributeLocalName,
          prefix: attributePrefix,
          uri: attributeUri,
        };

        if (attrName === 'xmlns') {
          currentNamespaces.set('', attrValue);
        } else if (attrName.startsWith('xmlns:')) {
          const prefix = attrName.substring(6);
          currentNamespaces.set(prefix, attrValue);
        }
        attrMatch = attrRegex.exec(attributesString);
      }

      const { localName, prefix, uri } = this._parseQualifiedName(tagName, currentNamespaces);

      this._addEvent({
        type: XmlEventType.START_ELEMENT,
        name: tagName,
        localName,
        prefix,
        uri,
        attributes,
        attributesWithPrefix,
        value: undefined,
        error: undefined,
      } as UnifiedXmlEvent as StartElementEvent);

      this.position = gtPos + 1;

      if (!isSelfClosing) {
        this.elementStack.push(tagName);
        this.namespaceStack.push(currentNamespaces);
      } else {
        this._addEvent({
          type: XmlEventType.END_ELEMENT,
          name: tagName,
          localName,
          prefix,
          uri,
          attributes: undefined,
          attributesWithPrefix: undefined,
          value: undefined,
          error: undefined,
        } as UnifiedXmlEvent as EndElementEvent);
      }

      return true;
    } catch (error) {
      if (!this.isStreamEnded) return false;
      throw error;
    }
  }

  private _parseQualifiedName(
    qname: string,
    namespaces: Map<string, string>,
    isAttribute = false,
  ): {
    localName: string;
    prefix?: string;
    uri?: string;
  } {
    const colonIndex = qname.indexOf(':');
    if (colonIndex === -1) {
      if (isAttribute) {
        return {
          localName: qname,
          prefix: undefined,
          uri: undefined,
        };
      }

      const defaultUri = namespaces.get('');
      return {
        localName: qname,
        prefix: undefined,
        uri: defaultUri,
      };
    }

    const prefix = qname.substring(0, colonIndex);
    const localName = qname.substring(colonIndex + 1);
    const uri = namespaces.get(prefix);
    return {
      localName,
      prefix,
      uri,
    };
  }
}

export default XmlParserCore;
