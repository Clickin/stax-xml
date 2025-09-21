// StaxXmlParser.ts - UTF-8 safe version with Boyer-Moore-Horspool and Batch API
import {
  AnyXmlEvent,
  CdataEvent,
  CharactersEvent,
  EndElementEvent,
  ErrorEvent,
  StartElementEvent,
  XmlEventType
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
   * Number of events to batch together
   * @defaultValue 1
   */
  batchSize?: number;

  /**
   * Timeout for batch processing in milliseconds
   * @defaultValue 0
   */
  batchTimeout?: number;
}

/**
 * High-performance asynchronous XML parser implementing the StAX (Streaming API for XML) pattern.
 *
 * This parser provides memory-efficient processing of large XML files through streaming
 * with support for pull-based parsing, custom entity handling, and namespace processing.
 *
 * @remarks
 * The parser uses UTF-8 safe processing with Boyer-Moore-Horspool pattern search optimization
 * and supports both single-event and batch processing modes for improved performance.
 *
 * @example
 * Basic usage:
 * ```typescript
 * const xmlContent = '<root><item>Hello</item></root>';
 * const stream = new ReadableStream({
 *   start(controller) {
 *     controller.enqueue(new TextEncoder().encode(xmlContent));
 *     controller.close();
 *   }
 * });
 *
 * const parser = new StaxXmlParser(stream);
 * for await (const event of parser) {
 *   console.log(event.type, event);
 * }
 * ```
 *
 * @example
 * With custom options:
 * ```typescript
 * const options = {
 *   autoDecodeEntities: true,
 *   maxBufferSize: 128 * 1024,
 *   addEntities: [{ entity: 'custom', value: 'replacement' }]
 * };
 * const parser = new StaxXmlParser(stream, options);
 * ```
 *
 * @public
 */
export class StaxXmlParser implements AsyncIterator<AnyXmlEvent> {
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private readonly decoder: TextDecoder;
  private buffer: Uint8Array;
  private bufferLength: number = 0;
  private position: number = 0;
  private eventQueue: AnyXmlEvent[] = [];
  private resolveNext: ((value: IteratorResult<AnyXmlEvent>) => void) | null = null;
  private error: Error | null = null;
  private isStreamEnded: boolean = false;
  private parserFinished: boolean = false;
  private currentTextBuffer: string = '';
  private elementStack: string[] = [];
  private namespaceStack: Map<string, string>[] = [];
  private readonly options: StaxXmlParserOptions;

  // ===== 최적화 테이블 및 캐시 =====

  // ASCII 문자 빠른 분류 테이블 (실제로 사용됨)
  private static readonly ASCII_TABLE = (() => {
    const table = new Uint8Array(128);
    // 공백 문자들: 1
    table[9] = 1;   // TAB
    table[10] = 1;  // LF  
    table[13] = 1;  // CR
    table[32] = 1;  // SPACE
    // XML 특수 문자들: 2-12
    table[60] = 2;  // '<'
    table[62] = 3;  // '>'
    table[47] = 4;  // '/'
    table[61] = 5;  // '='
    table[33] = 6;  // '!'
    table[63] = 7;  // '?'
    table[34] = 8;  // '"'
    table[39] = 9;  // "'"
    table[38] = 10; // '&'
    table[91] = 11; // '['
    table[93] = 12; // ']'
    return table;
  })();

  // 엔티티 정규식 캐시
  private static readonly ENTITY_REGEX_CACHE = new Map<string, RegExp>();
  private static readonly DEFAULT_ENTITY_REGEX = /&(lt|gt|quot|apos|amp);/g;
  private static readonly DEFAULT_ENTITY_MAP: Record<string, string> = {
    'lt': '<', 'gt': '>', 'quot': '"', 'apos': "'", 'amp': '&'
  };

  // 컴파일된 엔티티 디코더
  private readonly entityDecoder: (text: string) => string;

  // Boyer-Moore-Horspool 패턴 캐시
  private readonly bmhCache = new Map<string, Uint8Array>();

  // 배치 처리 상태
  private batchMetrics = {
    avgEventSize: 100,
    lastBatchTime: 0,
    eventCount: 0
  };

  /**
   * Creates a new StaxXmlParser instance.
   *
   * @param xmlStream - The ReadableStream containing XML data as Uint8Array chunks
   * @param options - Configuration options for the parser
   * @throws {Error} When xmlStream is not a valid ReadableStream
   *
   * @example
   * ```typescript
   * const xmlData = '<root><item>content</item></root>';
   * const stream = new ReadableStream({
   *   start(controller) {
   *     controller.enqueue(new TextEncoder().encode(xmlData));
   *     controller.close();
   *   }
   * });
   *
   * const parser = new StaxXmlParser(stream, {
   *   autoDecodeEntities: true,
   *   maxBufferSize: 64 * 1024
   * });
   * ```
   */
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
      ...options
    };

    // TextDecoder 최적화 설정
    this.decoder = new TextDecoder(this.options.encoding, {
      fatal: false,    // 에러 대신 � 문자 사용
      ignoreBOM: true  // BOM 무시
    });

    this.buffer = new Uint8Array(this.options.maxBufferSize || 64 * 1024);

    // 엔티티 디코더 프리컴파일
    this.entityDecoder = this._compileEntityDecoder();

    this.reader = xmlStream.getReader();
    this._startReading();
    this._addEvent({ type: XmlEventType.START_DOCUMENT });
  }

  // ===== ASCII 테이블 활용 메서드 =====

  /**
   * 빠른 XML 특수 문자 확인
   */
  private getXmlCharType(byte: number): number {
    return byte < 128 ? StaxXmlParser.ASCII_TABLE[byte] : 0;
  }

  // ===== UTF-8 안전성 메서드 =====

  /**
   * UTF-8 바이트가 문자 시작인지 확인
   * @param byte 확인할 바이트
   * @returns 문자 시작이면 true
   */
  private isUtf8CharStart(byte: number): boolean {
    // ASCII (0xxxxxxx) 또는 멀티바이트 시작 (11xxxxxx)
    // 연속 바이트 (10xxxxxx)가 아닌 경우
    return (byte & 0x80) === 0 || (byte & 0xC0) === 0xC0;
  }

  /**
   * UTF-8 시퀀스 길이 계산
   * @param byte 첫 바이트
   * @returns 시퀀스 길이 (1-4)
   */
  private getUtf8SequenceLength(byte: number): number {
    if ((byte & 0x80) === 0) return 1;        // 0xxxxxxx
    if ((byte & 0xE0) === 0xC0) return 2;      // 110xxxxx
    if ((byte & 0xF0) === 0xE0) return 3;      // 1110xxxx
    if ((byte & 0xF8) === 0xF0) return 4;      // 11110xxx
    return 1; // 잘못된 시퀀스
  }

  /**
   * UTF-8 문자 경계에서 안전하게 위치 조정
   * @param pos 조정할 위치
   * @param searchBackward 뒤로 검색할지 여부
   * @returns 안전한 UTF-8 경계 위치
   */
  private findSafeUtf8Boundary(pos: number, searchBackward: boolean = true): number {
    if (pos <= 0 || pos >= this.bufferLength) return pos;

    if (searchBackward) {
      // 뒤로 검색하여 문자 시작 찾기
      let safePos = pos;
      let backtrack = 0;

      while (safePos > 0 && backtrack < 4) {
        if (this.isUtf8CharStart(this.buffer[safePos])) {
          // 이 위치에서 시작하는 시퀀스가 원래 pos를 포함하는지 확인
          const seqLen = this.getUtf8SequenceLength(this.buffer[safePos]);
          if (safePos + seqLen > pos) {
            // pos가 이 문자 중간에 있음, safePos 반환
            return safePos;
          } else {
            // pos가 이미 안전한 경계임
            return pos;
          }
        }
        safePos--;
        backtrack++;
      }
      return pos; // 적절한 경계를 찾지 못함
    } else {
      // 앞으로 검색하여 다음 문자 시작 찾기
      while (pos < this.bufferLength && !this.isUtf8CharStart(this.buffer[pos])) {
        pos++;
      }
      return pos;
    }
  }

  /**
   * 버퍼에서 안전하게 UTF-8 문자열 추출
   * @param start 시작 위치
   * @param end 끝 위치
   * @returns 디코딩된 문자열
   */
  private safeDecodeRange(start: number, end: number): string {
    // 시작과 끝을 안전한 경계로 조정
    const safeStart = this.findSafeUtf8Boundary(start, false);
    const safeEnd = this.findSafeUtf8Boundary(end, true);

    if (safeStart >= safeEnd) return '';

    return this.decoder.decode(
      this.buffer.subarray(safeStart, safeEnd),
      { stream: false }
    );
  }

  // ===== Boyer-Moore-Horspool 패턴 검색 구현 =====

  /**
   * Boyer-Moore-Horspool bad character table 생성
   */
  private _buildBMHTable(pattern: Uint8Array): Uint8Array {
    const table = new Uint8Array(256);
    const patternLength = pattern.length;

    table.fill(patternLength);

    for (let i = 0; i < patternLength - 1; i++) {
      table[pattern[i]] = patternLength - 1 - i;
    }

    return table;
  }

  /**
   * Boyer-Moore-Horspool 알고리즘으로 패턴 검색
   * XML 구분자는 모두 ASCII이므로 UTF-8 경계 문제 없음
   */
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
        // 캐시 크기 제한
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

  /**
   * 단일 바이트 검색 (최적화)
   */
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

  // ===== 엔티티 디코더 컴파일 =====

  private _compileEntityDecoder(): (text: string) => string {
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
          .sort((a, b) => b.length - a.length)
          .map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|');
        regex = new RegExp(`&(${pattern});`, 'g');
        StaxXmlParser.ENTITY_REGEX_CACHE.set(cacheKey, regex);
      }

      return (text: string) => {
        if (!text || text.indexOf('&') === -1) return text;
        regex!.lastIndex = 0;
        return text.replace(regex!, (_, entity) => entityMap[entity] || _);
      };
    }

    return (text: string) => {
      if (!text || text.indexOf('&') === -1) return text;
      StaxXmlParser.DEFAULT_ENTITY_REGEX.lastIndex = 0;
      return text.replace(
        StaxXmlParser.DEFAULT_ENTITY_REGEX,
        (_, entity) => StaxXmlParser.DEFAULT_ENTITY_MAP[entity] || _
      );
    };
  }

  // ===== 배치 처리 API =====

  private _calculateOptimalBatchSize(): number {
    const MIN_BATCH = 1;
    const MAX_BATCH = this.options.batchSize || 10;

    if (this.bufferLength < 1024) return MIN_BATCH;
    if (this.bufferLength > 10240) return MAX_BATCH;

    if (this.eventQueue.length > 0) {
      const lastEvent = this.eventQueue[this.eventQueue.length - 1];
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

  public async nextBatch(size?: number): Promise<AnyXmlEvent[]> {
    const batch: AnyXmlEvent[] = [];
    const targetSize = size || this._calculateOptimalBatchSize();
    const startTime = Date.now();
    const timeout = this.options.batchTimeout || 10;

    for (let i = 0; i < targetSize; i++) {
      if (Date.now() - startTime > timeout) {
        break;
      }

      const result = await this.next();
      if (result.done) break;
      batch.push(result.value);
    }

    return batch;
  }

  public async *batchedIterator(batchSize?: number): AsyncGenerator<AnyXmlEvent[]> {
    while (!this.parserFinished || this.eventQueue.length > 0) {
      const batch = await this.nextBatch(batchSize);
      if (batch.length === 0) break;
      yield batch;
    }
  }

  // ===== 개선된 버퍼 관리 =====

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
      // UTF-8 경계 확인
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

  // ===== 메인 파싱 로직 =====

  private async _startReading(): Promise<void> {
    try {
      while (true) {
        const { done, value } = await this.reader!.read();

        if (done) {
          this.isStreamEnded = true;
          this._parseBuffer();

          if (!this.parserFinished && this.elementStack.length > 0) {
            this._addError(new Error('Unexpected end of document. Not all elements were closed.'));
          }

          if (!this.parserFinished) {
            this._flushCharacters();
            this._addEvent({ type: XmlEventType.END_DOCUMENT });
            this.parserFinished = true;
          }

          if (this.resolveNext && this.eventQueue.length === 0) {
            this.resolveNext({ value: undefined, done: true });
            this.resolveNext = null;
          }
          break;
        }

        this._appendToBuffer(value);
        this._parseBuffer();
        this._compactBufferIfNeeded();
        this._updateBatchMetrics(value.length);
      }
    } catch (err) {
      this._addError(err as Error);
      if (this.resolveNext) {
        this.resolveNext({ value: undefined, done: true });
        this.resolveNext = null;
      }
    }
  }

  private _updateBatchMetrics(bytesProcessed: number): void {
    const eventsDelta = this.eventQueue.length;
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
      const ltPos = this._findSingleByte(60, this.position); // '<'

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

      // ASCII 테이블 활용한 빠른 태그 타입 판별
      const nextByte = this.buffer[this.position + 1];
      const charType = this.getXmlCharType(nextByte);

      if (charType === 4) { // '/' (47)
        this._flushCharacters();
        if (!this._parseEndTag()) break;
      } else if (charType === 6) { // '!' (33)
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
      } else if (charType === 7) { // '?' (63)
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
          value: decodedText
        } as CharactersEvent);
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
    this.eventQueue.push(event);
    if (this.resolveNext) {
      this.resolveNext(this._popNextEvent() as IteratorResult<AnyXmlEvent>);
      this.resolveNext = null;
    }
  }

  private _addError(err: Error): void {
    if (this.error === null) {
      this.error = err;
      this._addEvent({ type: XmlEventType.ERROR, error: err } as ErrorEvent);
      this.parserFinished = true;
      this._clearBuffers();

      if (this.reader) {
        this.reader.releaseLock();
        this.reader = null;
      }
    }
  }

  private _popNextEvent(): IteratorResult<AnyXmlEvent> | null {
    if (this.eventQueue.length > 0) {
      return { value: this.eventQueue.shift()!, done: false };
    }
    if (this.parserFinished) {
      return { value: undefined, done: true };
    }
    return null;
  }

  public async next(): Promise<IteratorResult<AnyXmlEvent>> {
    if (this.error) {
      throw this.error;
    }

    const nextEvent = this._popNextEvent();
    if (nextEvent) {
      return nextEvent;
    }

    if (this.parserFinished) {
      return { value: undefined, done: true };
    }

    return new Promise((resolve) => {
      this.resolveNext = resolve;
    });
  }

  public [Symbol.asyncIterator](): AsyncIterator<AnyXmlEvent> {
    return this;
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

  /**
   * UTF-8 안전 버퍼 읽기
   */
  private _readBuffer(length?: number): string {
    const originalPos = this.position;
    let endPos = length ? Math.min(this.position + length, this.bufferLength) : this.bufferLength;

    // 지정된 길이가 있고 버퍼 중간이면 UTF-8 경계 확인
    if (length && endPos < this.bufferLength) {
      endPos = this.findSafeUtf8Boundary(endPos, true);
    }

    const slice = this.buffer.subarray(this.position, endPos);

    try {
      const result = this.decoder.decode(slice, { stream: !this.isStreamEnded });
      this.position = endPos;
      return result;
    } catch (error) {
      // 불완전한 UTF-8 시퀀스 처리
      if (!this.isStreamEnded && endPos === this.bufferLength) {
        // 마지막 4바이트까지 백트랙
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

  /**
   * UTF-8 안전 CDATA 파싱
   */
  private _parseCData(): boolean {
    const startPos = this.position + 9; // '<![CDATA[' 이후
    const endPos = this._findPatternBMH(']]>');
    if (endPos === -1) return false;

    try {
      // UTF-8 경계 확인
      const safeStart = this.findSafeUtf8Boundary(startPos, false);
      const safeEnd = this.findSafeUtf8Boundary(endPos, true);

      const cdataContent = this.decoder.decode(
        this.buffer.subarray(safeStart, safeEnd),
        { stream: false }
      );

      this._addEvent({
        type: XmlEventType.CDATA,
        value: cdataContent
      } as CdataEvent);

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

  /**
   * UTF-8 안전 종료 태그 파싱
   */
  private _parseEndTag(): boolean {
    const gtPos = this._findSingleByte(62, this.position); // '>'
    if (gtPos === -1) return false;

    try {
      // 태그 전체를 안전하게 디코딩
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

      const currentNamespaces = this.namespaceStack.length > 0 ?
        this.namespaceStack[this.namespaceStack.length - 1] : new Map();
      const { localName, prefix, uri } = this._parseQualifiedName(tagName, currentNamespaces);

      this.elementStack.pop();
      this.namespaceStack.pop();

      this._addEvent({
        type: XmlEventType.END_ELEMENT,
        name: tagName,
        localName,
        prefix,
        uri
      } as EndElementEvent);

      this.position = gtPos + 1;
      return true;
    } catch (error) {
      if (!this.isStreamEnded) return false;
      throw error;
    }
  }

  /**
   * UTF-8 안전 시작 태그 파싱 (ASCII 테이블 활용)
   */
  private _parseStartTag(): boolean {
    const gtPos = this._findSingleByte(62, this.position); // '>'
    if (gtPos === -1) return false;

    try {
      // 태그 전체를 안전하게 디코딩
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
      const attributesWithPrefix: { [key: string]: { value: string; prefix?: string; uri?: string } } = {};

      // 속성 파싱 - 유니코드 문자 지원
      const attrRegex = /([a-zA-Z0-9_:.\-\u0080-\uFFFF]+)(?:\s*=\s*"([^"]*)"|\s*=\s*'([^']*)')?/g;
      let attrMatch;

      while ((attrMatch = attrRegex.exec(attributesString)) !== null) {
        const attrName = attrMatch[1];
        const attrValue = this.entityDecoder(attrMatch[2] || attrMatch[3] || 'true');
        attributes[attrName] = attrValue;

        const attrNamespaceInfo = this._parseQualifiedName(attrName, currentNamespaces, true);
        attributesWithPrefix[attrNamespaceInfo.localName] = {
          value: attrValue,
          prefix: attrNamespaceInfo.prefix,
          uri: attrNamespaceInfo.uri
        };

        if (attrName === 'xmlns') {
          currentNamespaces.set('', attrValue);
        } else if (attrName.startsWith('xmlns:')) {
          const prefix = attrName.substring(6);
          currentNamespaces.set(prefix, attrValue);
        }
      }

      const { localName, prefix, uri } = this._parseQualifiedName(tagName, currentNamespaces);

      this._addEvent({
        type: XmlEventType.START_ELEMENT,
        name: tagName,
        localName,
        prefix,
        uri,
        attributes: attributes,
        attributesWithPrefix: attributesWithPrefix
      } as StartElementEvent);

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
          uri
        } as EndElementEvent);
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
    isAttribute: boolean = false
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
          uri: undefined
        };
      } else {
        const defaultUri = namespaces.get('');
        return {
          localName: qname,
          prefix: undefined,
          uri: defaultUri
        };
      }
    } else {
      const prefix = qname.substring(0, colonIndex);
      const localName = qname.substring(colonIndex + 1);
      const uri = namespaces.get(prefix);
      return {
        localName,
        prefix,
        uri
      };
    }
  }

  public get XmlEventType(): typeof XmlEventType {
    return XmlEventType;
  }
}

export default StaxXmlParser;