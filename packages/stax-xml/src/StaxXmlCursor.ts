import { type AttributeInfo, XmlEventType } from './types';
import { AttributeCollector } from './internal/AttributeCollector';
import {
  cloneNamespaces,
  collectAttributesFromSource,
  resolveElementName,
  type QualifiedNameInfo,
} from './internal/XmlCursorParserUtil';

type CursorLifecycleState = 'INITIAL' | 'ACTIVE' | 'DONE' | 'FAILED';
type AsyncInputState = 'BUFFER_READY' | 'NEED_INPUT' | 'STREAM_ENDED';
type ParseAction = XmlEventType | 'need_input' | 'skip';

interface CursorToken {
  type: XmlEventType;
  name?: string;
  localName?: string;
  prefix?: string;
  uri?: string;
  text?: string;
}

export interface StaxXmlCursorOptions {
  encoding?: string;
  addEntities?: { entity: string, value: string }[];
  autoDecodeEntities?: boolean;
  maxBufferSize?: number;
  enableBufferCompaction?: boolean;
  batchSize?: number;
  batchTimeout?: number;
}

export class StaxXmlCursor {
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private readonly decoder: TextDecoder;
  private readonly options: StaxXmlCursorOptions;
  private readonly entityDecoder: (text: string) => string;
  private readonly attributeCollector: AttributeCollector;
  private readonly bmhCache = new Map<string, Uint8Array>();

  private buffer: Uint8Array;
  private bufferLength = 0;
  private position = 0;
  private currentTextBuffer = '';
  private currentStartTagSource = '';
  private readonly elementStack: string[] = [];
  private readonly namespaceStack: Map<string, string>[] = [new Map<string, string>()];
  private lifecycleState: CursorLifecycleState = 'INITIAL';
  private inputState: AsyncInputState = 'NEED_INPUT';
  private currentToken?: CursorToken;
  private pendingEndElement?: QualifiedNameInfo;
  private storedError?: Error;
  private busy = false;

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

  private static readonly ENTITY_REGEX_CACHE = new Map<string, RegExp>();
  private static readonly DEFAULT_ENTITY_REGEX = /&(lt|gt|quot|apos|amp);/g;
  private static readonly DEFAULT_ENTITY_MAP: Record<string, string> = {
    lt: '<',
    gt: '>',
    quot: '"',
    apos: '\'',
    amp: '&',
  };

  constructor(xmlStream: ReadableStream<Uint8Array>, options: StaxXmlCursorOptions = {}) {
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
      ...options,
    };

    this.decoder = new TextDecoder(this.options.encoding, {
      fatal: false,
      ignoreBOM: true,
    });
    this.buffer = new Uint8Array(this.options.maxBufferSize ?? 64 * 1024);
    this.entityDecoder = this.compileEntityDecoder();
    this.attributeCollector = new AttributeCollector(this.entityDecoder);
    this.attributeCollector.reset('');
    this.reader = xmlStream.getReader();
  }

  hasNext(): boolean {
    this.assertNotBusy();
    return this.lifecycleState !== 'DONE' && this.lifecycleState !== 'FAILED';
  }

  async next(): Promise<XmlEventType> {
    this.assertNotBusy();
    if (this.lifecycleState === 'FAILED') {
      throw this.storedError;
    }

    this.busy = true;
    try {
      return await this.pullNextToken();
    } catch (error) {
      this.markFailed(error as Error);
      throw this.storedError;
    } finally {
      this.busy = false;
    }
  }

  get eventType(): XmlEventType | undefined {
    return this.currentToken?.type;
  }

  get name(): string | undefined {
    return this.currentToken?.name;
  }

  get localName(): string | undefined {
    return this.currentToken?.localName;
  }

  get prefix(): string | undefined {
    return this.currentToken?.prefix;
  }

  get uri(): string | undefined {
    return this.currentToken?.uri;
  }

  get text(): string | undefined {
    return this.currentToken?.text;
  }

  getText(): string {
    if (this.currentToken?.type !== XmlEventType.CHARACTERS && this.currentToken?.type !== XmlEventType.CDATA) {
      throw new Error('Current token does not expose text.');
    }

    return this.currentToken.text;
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

  private async pullNextToken(): Promise<XmlEventType> {
    this.releaseCurrentStartTagSource();

    if (this.lifecycleState === 'INITIAL') {
      this.lifecycleState = 'ACTIVE';
      this.currentToken = { type: XmlEventType.START_DOCUMENT };
      return XmlEventType.START_DOCUMENT;
    }

    if (this.pendingEndElement) {
      const pending = this.pendingEndElement;
      this.pendingEndElement = undefined;
      this.currentToken = {
        type: XmlEventType.END_ELEMENT,
        ...pending,
      };
      return XmlEventType.END_ELEMENT;
    }

    while (true) {
      if (this.position >= this.bufferLength) {
        if (this.flushCharacters()) {
          return XmlEventType.CHARACTERS;
        }

        if (this.inputState !== 'STREAM_ENDED') {
          await this.readMore();
          continue;
        }

        if (this.elementStack.length > 0) {
          throw new Error('Unexpected end of document. Not all elements were closed.');
        }

        this.markDone();
        this.currentToken = { type: XmlEventType.END_DOCUMENT };
        return XmlEventType.END_DOCUMENT;
      }

      const ltPos = this.findSingleByte(60, this.position);
      if (ltPos === -1) {
        try {
          this.currentTextBuffer += this.readBuffer();
        } catch (error) {
          if (this.inputState !== 'STREAM_ENDED') {
            await this.readMore();
            continue;
          }
          throw error;
        }

        if (this.inputState !== 'STREAM_ENDED') {
          await this.readMore();
        }
        continue;
      }

      if (ltPos > this.position) {
        try {
          this.currentTextBuffer += this.readBuffer(ltPos - this.position);
        } catch (error) {
          if (this.inputState !== 'STREAM_ENDED') {
            await this.readMore();
            continue;
          }
          throw error;
        }
      }

      this.position = ltPos;
      if (this.flushCharacters()) {
        return XmlEventType.CHARACTERS;
      }

      if (this.position + 1 >= this.bufferLength) {
        if (this.inputState === 'STREAM_ENDED') {
          throw new Error('Unexpected end of document.');
        }
        await this.readMore();
        continue;
      }

      const nextByte = this.buffer[this.position + 1];
      const charType = this.getXmlCharType(nextByte);
      let action: ParseAction;

      if (charType === 4) {
        action = this.parseEndTag();
      } else if (charType === 6) {
        action = this.parseBangConstruct();
      } else if (charType === 7) {
        action = this.parseQuestionConstruct();
      } else {
        action = this.parseStartTag();
      }

      if (action === 'need_input') {
        await this.readMore();
        continue;
      }
      if (action === 'skip') {
        continue;
      }
      return action;
    }
  }

  private parseBangConstruct(): ParseAction {
    if (this.matchesPattern('<!--')) {
      return this.parseComment();
    }
    if (this.matchesPattern('<![CDATA[')) {
      return this.parseCData();
    }
    if (this.matchesPattern('<!DOCTYPE')) {
      return this.parseDoctype();
    }

    if (this.inputState === 'STREAM_ENDED') {
      throw new Error(`Malformed XML near position ${this.position}`);
    }
    return 'need_input';
  }

  private parseQuestionConstruct(): ParseAction {
    if (this.matchesPattern('<?xml')) {
      return this.parseXmlDeclaration();
    }
    if (this.matchesPattern('<?')) {
      return this.parseProcessingInstruction();
    }

    if (this.inputState === 'STREAM_ENDED') {
      throw new Error(`Malformed XML near position ${this.position}`);
    }
    return 'need_input';
  }

  private parseXmlDeclaration(): ParseAction {
    const endPos = this.findPatternBMH('?>');
    if (endPos === -1) {
      if (this.inputState === 'STREAM_ENDED') {
        throw new Error('Unclosed processing instruction');
      }
      return 'need_input';
    }

    this.position = endPos + 2;
    return 'skip';
  }

  private parseComment(): ParseAction {
    const endPos = this.findPatternBMH('-->');
    if (endPos === -1) {
      if (this.inputState === 'STREAM_ENDED') {
        throw new Error('Unclosed comment');
      }
      return 'need_input';
    }

    this.position = endPos + 3;
    return 'skip';
  }

  private parseDoctype(): ParseAction {
    const endPos = this.findSingleByte(62, this.position);
    if (endPos === -1) {
      if (this.inputState === 'STREAM_ENDED') {
        throw new Error('Unclosed DOCTYPE declaration');
      }
      return 'need_input';
    }

    this.position = endPos + 1;
    return 'skip';
  }

  private parseCData(): ParseAction {
    const endPos = this.findPatternBMH(']]>');
    if (endPos === -1) {
      if (this.inputState === 'STREAM_ENDED') {
        throw new Error('Unclosed CDATA section');
      }
      return 'need_input';
    }

    const safeStart = this.findSafeUtf8Boundary(this.position + 9, false);
    const safeEnd = this.findSafeUtf8Boundary(endPos, true);
    this.currentToken = {
      type: XmlEventType.CDATA,
      text: this.decoder.decode(this.buffer.subarray(safeStart, safeEnd), { stream: false }),
    };
    this.position = endPos + 3;
    return XmlEventType.CDATA;
  }

  private parseProcessingInstruction(): ParseAction {
    const endPos = this.findPatternBMH('?>');
    if (endPos === -1) {
      if (this.inputState === 'STREAM_ENDED') {
        throw new Error('Unclosed processing instruction');
      }
      return 'need_input';
    }

    this.position = endPos + 2;
    return 'skip';
  }

  private parseEndTag(): ParseAction {
    const gtPos = this.findSingleByte(62, this.position);
    if (gtPos === -1) {
      if (this.inputState === 'STREAM_ENDED') {
        throw new Error('Unclosed end tag');
      }
      return 'need_input';
    }

    const tagContent = this.safeDecodeRange(this.position, gtPos + 1);
    const closeTagMatch = tagContent.match(/^<\/([a-zA-Z0-9_:.\-\u0080-\uFFFF]+)\s*>$/);
    if (!closeTagMatch) {
      throw new Error('Malformed closing tag');
    }

    const tagName = closeTagMatch[1];
    if (this.elementStack.length === 0) {
      throw new Error(`Mismatched closing tag: </${tagName}>. Expected </nothing>`);
    }
    if (this.elementStack[this.elementStack.length - 1] !== tagName) {
      throw new Error(`Mismatched closing tag: </${tagName}>. Expected </${this.elementStack[this.elementStack.length - 1]}>`);
    }

    const namespaces = this.namespaceStack[this.namespaceStack.length - 1] ?? new Map<string, string>();
    this.elementStack.pop();
    this.namespaceStack.pop();
    this.currentToken = {
      type: XmlEventType.END_ELEMENT,
      ...resolveElementName(tagName, namespaces),
    };
    this.position = gtPos + 1;
    return XmlEventType.END_ELEMENT;
  }

  private parseStartTag(): ParseAction {
    const gtPos = this.findSingleByte(62, this.position);
    if (gtPos === -1) {
      if (this.inputState === 'STREAM_ENDED') {
        throw new Error('Unclosed start tag');
      }
      return 'need_input';
    }

    const tagContent = this.safeDecodeRange(this.position, gtPos + 1);
    const tagMatch = tagContent.match(/^<([a-zA-Z0-9_:.\-\u0080-\uFFFF]+)(\s+[^>]*?)?\s*(\/?)>$/);
    if (!tagMatch) {
      throw new Error('Malformed start tag');
    }

    const tagName = tagMatch[1];
    const isSelfClosing = tagMatch[3] === '/';
    const namespaces = cloneNamespaces(this.namespaceStack[this.namespaceStack.length - 1]);
    this.currentStartTagSource = tagContent;
    const nameEnd = 1 + tagName.length;
    const actualEnd = tagContent.length - (isSelfClosing ? 2 : 1);

    collectAttributesFromSource(
      tagContent,
      nameEnd,
      actualEnd,
      namespaces,
      this.attributeCollector,
      this.entityDecoder,
      StaxXmlCursor.isWhitespaceCode
    );

    const nameInfo = resolveElementName(tagName, namespaces);
    this.currentToken = {
      type: XmlEventType.START_ELEMENT,
      ...nameInfo,
    };
    this.position = gtPos + 1;

    if (isSelfClosing) {
      this.pendingEndElement = nameInfo;
      return XmlEventType.START_ELEMENT;
    }

    this.elementStack.push(tagName);
    this.namespaceStack.push(namespaces);
    return XmlEventType.START_ELEMENT;
  }

  private flushCharacters(): boolean {
    if (this.currentTextBuffer.length === 0) {
      return false;
    }

    const decodedText = this.entityDecoder(this.currentTextBuffer);
    this.currentTextBuffer = '';
    if (decodedText.trim().length === 0) {
      return false;
    }

    this.currentToken = {
      type: XmlEventType.CHARACTERS,
      text: decodedText,
    };
    return true;
  }

  private releaseCurrentStartTagSource(): void {
    if (this.currentToken?.type === XmlEventType.START_ELEMENT && this.currentStartTagSource.length > 0) {
      this.currentStartTagSource = '';
      this.attributeCollector.reset('');
    }
  }

  private async readMore(): Promise<void> {
    if (this.inputState === 'STREAM_ENDED') {
      return;
    }

    this.compactBufferIfNeeded();
    const { done, value } = await this.reader.read();
    if (done) {
      this.inputState = 'STREAM_ENDED';
      this.releaseReader();
      return;
    }

    this.appendToBuffer(value);
    this.inputState = 'BUFFER_READY';
  }

  private appendToBuffer(newData: Uint8Array): void {
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

  private compactBufferIfNeeded(): void {
    if (!this.options.enableBufferCompaction) {
      return;
    }

    const maxSize = this.options.maxBufferSize ?? 64 * 1024;
    const shouldCompact =
      (this.position > 8192 && this.bufferLength > 16384) ||
      (this.position > maxSize / 2) ||
      (this.bufferLength > maxSize && this.position > maxSize / 4);

    if (!shouldCompact || this.position === 0 || this.position >= this.bufferLength) {
      return;
    }

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
    this.position -= safePos;
    if (this.bmhCache.size > 20) {
      this.bmhCache.clear();
    }
  }

  private readBuffer(length?: number): string {
    const originalPos = this.position;
    let endPos = length ? Math.min(this.position + length, this.bufferLength) : this.bufferLength;
    if (length && endPos < this.bufferLength) {
      endPos = this.findSafeUtf8Boundary(endPos, true);
    }

    const slice = this.buffer.subarray(this.position, endPos);
    try {
      const result = this.decoder.decode(slice, { stream: this.inputState !== 'STREAM_ENDED' });
      this.position = endPos;
      return result;
    } catch (error) {
      if (this.inputState !== 'STREAM_ENDED' && endPos === this.bufferLength) {
        for (let i = 1; i <= 4 && endPos - i > this.position; i++) {
          const testEnd = this.findSafeUtf8Boundary(endPos - i, true);
          if (testEnd <= this.position) {
            continue;
          }
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
      this.position = originalPos;
      throw error;
    }
  }

  private safeDecodeRange(start: number, end: number): string {
    const safeStart = this.findSafeUtf8Boundary(start, false);
    const safeEnd = this.findSafeUtf8Boundary(end, true);
    if (safeStart >= safeEnd) {
      return '';
    }

    return this.decoder.decode(this.buffer.subarray(safeStart, safeEnd), { stream: false });
  }

  private findSafeUtf8Boundary(pos: number, searchBackward: boolean): number {
    if (pos <= 0 || pos >= this.bufferLength) {
      return pos;
    }

    if (searchBackward) {
      let safePos = pos;
      let backtrack = 0;
      while (safePos > 0 && backtrack < 4) {
        if (this.isUtf8CharStart(this.buffer[safePos])) {
          const sequenceLength = this.getUtf8SequenceLength(this.buffer[safePos]);
          if (safePos + sequenceLength > pos) {
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

  private buildBMHTable(pattern: Uint8Array): Uint8Array {
    const table = new Uint8Array(256);
    table.fill(pattern.length);
    for (let i = 0; i < pattern.length - 1; i++) {
      table[pattern[i]] = pattern.length - 1 - i;
    }
    return table;
  }

  private findPatternBMH(pattern: string, startPos = this.position): number {
    const patternBytes = new TextEncoder().encode(pattern);
    if (patternBytes.length === 0) {
      return -1;
    }
    if (patternBytes.length === 1) {
      return this.findSingleByte(patternBytes[0], startPos);
    }

    let skipTable = this.bmhCache.get(pattern);
    if (!skipTable) {
      skipTable = this.buildBMHTable(patternBytes);
      if (this.bmhCache.size > 20) {
        this.bmhCache.clear();
      }
      this.bmhCache.set(pattern, skipTable);
    }

    const bufferEnd = this.bufferLength - patternBytes.length;
    let pos = startPos;
    while (pos <= bufferEnd) {
      let i = patternBytes.length - 1;
      while (i >= 0 && this.buffer[pos + i] === patternBytes[i]) {
        i--;
      }
      if (i < 0) {
        return pos;
      }
      pos += skipTable[this.buffer[pos + patternBytes.length - 1]];
    }

    return -1;
  }

  private findSingleByte(byte: number, startPos = this.position): number {
    const end4 = this.bufferLength - 3;
    let i = startPos;
    for (; i < end4; i += 4) {
      if (this.buffer[i] === byte) return i;
      if (this.buffer[i + 1] === byte) return i + 1;
      if (this.buffer[i + 2] === byte) return i + 2;
      if (this.buffer[i + 3] === byte) return i + 3;
    }
    for (; i < this.bufferLength; i++) {
      if (this.buffer[i] === byte) return i;
    }
    return -1;
  }

  private matchesPattern(pattern: string): boolean {
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

  private compileEntityDecoder(): (text: string) => string {
    if (this.options.autoDecodeEntities === false) {
      return (text) => text;
    }

    if (this.options.addEntities && this.options.addEntities.length > 0) {
      const entityMap: Record<string, string> = { ...StaxXmlCursor.DEFAULT_ENTITY_MAP };
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
      let regex = StaxXmlCursor.ENTITY_REGEX_CACHE.get(cacheKey);
      if (!regex) {
        const pattern = patterns
          .sort((left, right) => right.length - left.length)
          .map((entity) => entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|');
        regex = new RegExp(`&(${pattern});`, 'g');
        StaxXmlCursor.ENTITY_REGEX_CACHE.set(cacheKey, regex);
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
      StaxXmlCursor.DEFAULT_ENTITY_REGEX.lastIndex = 0;
      return text.replace(
        StaxXmlCursor.DEFAULT_ENTITY_REGEX,
        (_, entity) => StaxXmlCursor.DEFAULT_ENTITY_MAP[entity] || _
      );
    };
  }

  private getXmlCharType(byte: number): number {
    return byte < 128 ? StaxXmlCursor.ASCII_TABLE[byte] : 0;
  }

  private assertNotBusy(): void {
    if (this.busy) {
      throw new Error('Concurrent cursor access is not allowed.');
    }
  }

  private assertStartElementToken(): void {
    if (this.currentToken?.type !== XmlEventType.START_ELEMENT) {
      throw new Error('Current token does not expose attributes.');
    }
  }

  private markDone(): void {
    this.lifecycleState = 'DONE';
    this.releaseReader();
  }

  private markFailed(error: Error): void {
    this.lifecycleState = 'FAILED';
    this.storedError = error;
    this.currentToken = undefined;
    this.currentTextBuffer = '';
    this.currentStartTagSource = '';
    this.attributeCollector.reset('');
    this.releaseReader();
  }

  private releaseReader(): void {
    if (this.reader) {
      this.reader.releaseLock();
      this.reader = null;
    }
  }

  private static isWhitespaceCode(code: number): boolean {
    return code < 128 ? StaxXmlCursor.ASCII_TABLE[code] === 1 : code <= 32;
  }
}

export default StaxXmlCursor;
