// SimplifiedStaxParser.ts
import {
  AnyXmlEvent,
  CdataEvent,
  CharactersEvent,
  EndElementEvent,
  ErrorEvent,
  StartElementEvent,
  XmlEventType
} from './types';

export interface StaxXmlParserOptions {
  encoding?: string; // XML 스트림의 인코딩 (기본값: 'utf-8')
  addEntities?: { entity: string, value: string }[]; // 사용자 정의 엔티티
  autoDecodeEntities?: boolean; // 자동 엔티티 디코딩 활성화 여부 (기본값: true)
  maxBufferSize?: number; // 최대 버퍼 크기 (기본값: 64KB)
  enableBufferCompaction?: boolean; // 버퍼 압축 활성화 (기본값: true)
}

/**
 * 웹 표준 ReadableStream을 직접 파싱하여 간소화된 StAX Pull 모델을 제공하는 XML 파서.
 * DTD, 네임스페이스, 복잡한 엔티티 등은 지원하지 않습니다.
 */
class StaxXmlParser implements AsyncIterator<AnyXmlEvent> {
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private decoder: TextDecoder;
  private buffer: Uint8Array;
  private bufferLength: number = 0; // 버퍼에 실제로 저장된 바이트 수
  private position: number = 0;
  private eventQueue: AnyXmlEvent[] = [];
  private resolveNext: ((value: IteratorResult<AnyXmlEvent>) => void) | null = null;
  private error: Error | null = null;
  private isStreamEnded: boolean = false;
  private parserFinished: boolean = false;
  private currentTextBuffer: string = '';
  private elementStack: string[] = []; // 열린 요소의 이름 스택
  private namespaceStack: Map<string, string>[] = []; // 네임스페이스 매핑 스택
  private options: StaxXmlParserOptions;

  constructor(xmlStream: ReadableStream<Uint8Array>, options: StaxXmlParserOptions = {}) {
    if (!(xmlStream instanceof ReadableStream)) {
      throw new Error('xmlStream must be a web standard ReadableStream.');
    }

    this.options = {
      encoding: 'utf-8',
      autoDecodeEntities: true,
      maxBufferSize: 64 * 1024, // 64KB 기본값
      enableBufferCompaction: true,
      ...options
    };

    // TextDecoder 초기화
    this.decoder = new TextDecoder(this.options.encoding);

    // 고정 크기 바이트 버퍼 초기화
    this.buffer = new Uint8Array(this.options.maxBufferSize || 64 * 1024);

    // ReadableStream에서 직접 읽기
    this.reader = xmlStream.getReader();

    this._startReading();
    this._addEvent({ type: XmlEventType.START_DOCUMENT });
  }

  private async _startReading(): Promise<void> {
    try {
      while (true) {
        const { done, value } = await this.reader!.read();

        if (done) {
          this.isStreamEnded = true;
          this._parseBuffer(); // 스트림 끝에서 남은 버퍼 파싱

          // 파서가 아직 완료되지 않았고, 열린 태그가 있다면 오류
          if (!this.parserFinished && this.elementStack.length > 0) {
            this._addError(new Error('Unexpected end of document. Not all elements were closed.'));
          }

          // 파서가 모든 작업을 마쳤으면 END_DOCUMENT 이벤트 추가
          if (!this.parserFinished) {
            this._flushCharacters(); // 남은 텍스트 처리
            this._addEvent({ type: XmlEventType.END_DOCUMENT });
            this.parserFinished = true;
          }

          // 대기 중인 next() 호출이 있다면 완료 처리
          if (this.resolveNext && this.eventQueue.length === 0) {
            this.resolveNext({ value: undefined, done: true });
            this.resolveNext = null;
          }
          break;
        }

        // 새로운 바이트 데이터를 버퍼에 추가
        this._appendToBuffer(value);
        this._parseBuffer();

        // 주기적으로 버퍼 압축 확인
        this._compactBufferIfNeeded();
      }
    } catch (err) {
      this._addError(err as Error);
      if (this.resolveNext) {
        this.resolveNext({ value: undefined, done: true });
        this.resolveNext = null;
      }
    }
  }

  private _parseBuffer(): void {
    while (this.position < this.bufferLength && !this.parserFinished) {
      // '<' 문자를 기준으로 태그 시작 감지
      const ltPos = this._findPattern('<');

      if (ltPos === -1) {
        // '<' 문자가 없으면 모든 남은 데이터를 텍스트로 처리
        if (this.isStreamEnded) {
          // 스트림이 끝났으면 남은 모든 데이터를 텍스트로 처리
          const remainingText = this._readBuffer();
          this.currentTextBuffer += remainingText;
          this._flushCharacters();
        } else {
          // 스트림이 끝나지 않았으면 더 많은 데이터를 기다림
          // 현재 버퍼의 모든 내용을 텍스트 버퍼에 저장하지 않고 그대로 둠
          break;
        }
        break;
      }

      // '<' 앞에 텍스트가 있으면 처리
      if (ltPos > this.position) {
        try {
          const textLength = ltPos - this.position;
          const text = this._readBuffer(textLength);
          this.currentTextBuffer += text;
          // position은 _readBuffer에서 이미 업데이트됨
        } catch (error) {
          // 불완전한 UTF-8 문자로 인한 오류면 더 많은 데이터 대기
          if (!this.isStreamEnded) {
            break;
          }
          throw error;
        }
      }

      // 이제 position은 '<' 위치에 있어야 함
      // 하지만 확실히 하기 위해 다시 설정
      this.position = ltPos;

      // 태그 타입 확인 및 파싱
      if (this._matchesPattern('<?xml')) {
        if (!this._parseXmlDeclaration()) break;
      } else if (this._matchesPattern('<!--')) {
        if (!this._parseComment()) break;
      } else if (this._matchesPattern('<![CDATA[')) {
        if (!this._parseCData()) break;
      } else if (this._matchesPattern('<?')) {
        if (!this._parseProcessingInstruction()) break;
      } else if (this._matchesPattern('</')) {
        // 종료 태그를 만나면 먼저 현재 텍스트를 flush
        this._flushCharacters();
        if (!this._parseEndTag()) break;
      } else if (this._matchesPattern('<')) {
        // 시작 태그를 만나면 먼저 현재 텍스트를 flush
        this._flushCharacters();
        if (!this._parseStartTag()) break;
      } else {
        // 인식되지 않는 태그
        if (this.isStreamEnded) {
          this._addError(new Error(`Malformed XML near position ${this.position}`));
          return;
        }
        break; // 더 많은 데이터 대기
      }

      this._compactBufferIfNeeded();
    }
  }

  private _flushCharacters(): void {
    if (this.currentTextBuffer.length > 0) {
      const decodedText = this._unescapeXml(this.currentTextBuffer);
      // 공백만 있는 텍스트도 포함하여 모든 텍스트를 이벤트로 추가
      this._addEvent({
        type: XmlEventType.CHARACTERS,
        value: decodedText
      } as CharactersEvent);
      this.currentTextBuffer = '';
    }
  }

  /**
   * 버퍼가 설정된 최대 크기를 초과하면 압축합니다.
   * @private
   */
  private _compactBufferIfNeeded(): void {
    if (!this.options.enableBufferCompaction) return;

    const maxSize = this.options.maxBufferSize || 64 * 1024;
    // 더 적극적인 버퍼 압축: position이 8KB 이상이면 압축
    if (this.position > 8192 || (this.bufferLength > maxSize && this.position > maxSize / 4)) {
      this._compactBuffer();
    }
  }

  /**
   * 버퍼를 압축하여 메모리 사용량을 줄입니다.
   * @private
   */
  private _compactBuffer(): void {
    if (this.position > 0 && this.position < this.bufferLength) {
      const remainingLength = this.bufferLength - this.position;
      // 남은 데이터를 버퍼 앞쪽으로 이동
      this.buffer.copyWithin(0, this.position, this.bufferLength);
      this.bufferLength = remainingLength;
      this.position = 0;
    }
  }

  /**
   * 버퍼 상태를 강제로 정리합니다.
   * @private
   */
  private _clearBuffers(): void {
    this.bufferLength = 0;
    this.position = 0;
    this.currentTextBuffer = '';
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

      // 에러 발생 시 메모리 정리
      this._clearBuffers();

      // ReadableStream의 reader를 해제
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

  /**
   * XML 텍스트의 엔티티를 디코딩합니다.
   * @param text 디코딩할 텍스트
   * @returns 디코딩된 텍스트
   * @private
   */
  private _unescapeXml(text: string): string {
    if (!text) {
      return ''; // 빈 문자열은 그대로 반환
    }
    if (!this.options.autoDecodeEntities) {
      return text; // 자동 엔티티 디코딩이 비활성화된 경우 원본 텍스트 반환
    }

    let entityMap: Record<string, string> = {
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&apos;': "'",
      ...this.options.addEntities?.reduce((map, entity) => {
        if (entity.entity && entity.value) {
          map[entity.entity] = entity.value;
        }
        return map;
      }, {} as Record<string, string>),
      '&amp;': '&' // &는 다른 entity와 충돌하지 않도록 마지막에 추가
    };

    const regex = new RegExp(Object.keys(entityMap).map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    // 디코딩 처리
    return text.replace(regex, (match) => {
      // entityMap에 정의된 엔티티인 경우, 매핑된 값을 반환합니다.
      if (entityMap[match]) {
        return entityMap[match];
      } else {
        // 정의되지 않은 엔티티는 그대로 반환합니다.
        return match;
      }
    });
  }

  /**
   * qualified name을 파싱하여 localName, prefix, uri를 추출합니다.
   * @param qname qualified name (예: "prefix:localName" 또는 "localName")
   * @param namespaces 현재 네임스페이스 매핑
   * @param isAttribute 속성인지 여부 (속성은 prefix가 없으면 네임스페이스에 속하지 않음)
   * @returns 파싱된 네임스페이스 정보
   * @private
   */
  private _parseQualifiedName(qname: string, namespaces: Map<string, string>, isAttribute: boolean = false): {
    localName: string;
    prefix?: string;
    uri?: string;
  } {
    const colonIndex = qname.indexOf(':');
    if (colonIndex === -1) {
      // 접두사가 없는 경우
      if (isAttribute) {
        // 속성의 경우 prefix가 없으면 네임스페이스에 속하지 않음
        return {
          localName: qname,
          prefix: undefined,
          uri: undefined
        };
      } else {
        // 요소의 경우 기본 네임스페이스 사용
        const defaultUri = namespaces.get('');
        return {
          localName: qname,
          prefix: undefined,
          uri: defaultUri
        };
      }
    } else {
      // 접두사가 있는 경우
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

  /**
   * 새로운 바이트 데이터를 버퍼에 추가합니다.
   * @param newData 추가할 바이트 데이터
   * @private
   */
  private _appendToBuffer(newData: Uint8Array): void {
    const requiredSize = this.bufferLength + newData.length;

    // 버퍼 크기가 부족하면 확장
    if (requiredSize > this.buffer.length) {
      const newSize = Math.max(this.buffer.length * 2, requiredSize);
      const newBuffer = new Uint8Array(newSize);
      newBuffer.set(this.buffer.subarray(0, this.bufferLength));
      this.buffer = newBuffer;
    }

    // 새 데이터를 버퍼에 복사
    this.buffer.set(newData, this.bufferLength);
    this.bufferLength += newData.length;
  }

  /**
   * 버퍼의 현재 위치부터 지정된 길이만큼 문자열로 디코딩하고 position을 업데이트합니다.
   * UTF-8 문자 경계를 고려하여 안전하게 디코딩합니다.
   * @param length 디코딩할 바이트 길이 (선택적)
   * @returns 디코딩된 문자열
   * @private
   */
  private _readBuffer(length?: number): string {
    const originalPos = this.position;
    const endPos = length ? Math.min(this.position + length, this.bufferLength) : this.bufferLength;
    const slice = this.buffer.subarray(this.position, endPos);

    try {
      const result = this.decoder.decode(slice, { stream: !this.isStreamEnded });
      this.position = endPos;
      return result;
    } catch (error) {
      // 불완전한 UTF-8 시퀀스로 인한 오류 처리
      if (!this.isStreamEnded && endPos === this.bufferLength) {
        // 스트림이 끝나지 않았고 버퍼 끝까지 읽었다면, 불완전한 문자가 있을 수 있음
        // 마지막 몇 바이트를 제외하고 디코딩 시도
        for (let i = 1; i <= 4 && endPos - i > this.position; i++) {
          try {
            const safeSlice = this.buffer.subarray(this.position, endPos - i);
            const result = this.decoder.decode(safeSlice, { stream: true });
            this.position = endPos - i;
            return result;
          } catch {
            continue;
          }
        }
      }
      this.position = originalPos; // 실패 시 원래 위치로 복원
      throw error;
    }
  }

  /**
   * 현재 위치에서 패턴이 일치하는지 확인합니다.
   * @param pattern 확인할 패턴
   * @returns 패턴이 일치하면 true
   * @private
   */
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

  /**
   * 현재 위치부터 지정된 패턴을 찾습니다.
   * @param pattern 찾을 문자열 패턴
   * @returns 패턴이 발견된 위치 (바이트 오프셋), 없으면 -1
   * @private
   */
  private _findPattern(pattern: string): number {
    const patternBytes = new TextEncoder().encode(pattern);
    const searchEnd = this.bufferLength - patternBytes.length + 1;

    for (let i = this.position; i < searchEnd; i++) {
      let found = true;
      for (let j = 0; j < patternBytes.length; j++) {
        if (this.buffer[i + j] !== patternBytes[j]) {
          found = false;
          break;
        }
      }
      if (found) {
        return i;
      }
    }
    return -1;
  }

  /**
   * XML 선언을 파싱합니다.
   * @returns 파싱이 완료되면 true, 더 많은 데이터가 필요하면 false
   * @private
   */
  private _parseXmlDeclaration(): boolean {
    const endPos = this._findPattern('?>');
    if (endPos === -1) {
      return false;
    }
    this.position = endPos + 2; // '?>' 다음으로 이동
    return true;
  }

  /**
   * 주석을 파싱합니다.
   * @returns 파싱이 완료되면 true, 더 많은 데이터가 필요하면 false
   * @private
   */
  private _parseComment(): boolean {
    const endPos = this._findPattern('-->');
    if (endPos === -1) {
      return false; // 더 많은 데이터 필요
    }
    this.position = endPos + 3; // '-->' 다음으로 이동
    return true;
  }

  /**
   * CDATA 섹션을 파싱합니다.
   * @returns 파싱이 완료되면 true, 더 많은 데이터가 필요하면 false
   * @private
   */
  private _parseCData(): boolean {
    const startPos = this.position + 9; // '<![CDATA[' 다음
    const endPos = this._findPattern(']]>');
    if (endPos === -1) {
      return false; // 더 많은 데이터 필요
    }

    try {
      const cdataContent = this.decoder.decode(this.buffer.subarray(startPos, endPos));
      this._addEvent({
        type: XmlEventType.CDATA,
        value: cdataContent
      } as CdataEvent);
      this.position = endPos + 3; // ']]>' 다음으로 이동
      return true;
    } catch (error) {
      if (!this.isStreamEnded) {
        return false; // 불완전한 UTF-8, 더 많은 데이터 필요
      }
      throw error;
    }
  }

  /**
   * 처리 명령을 파싱합니다.
   * @returns 파싱이 완료되면 true, 더 많은 데이터가 필요하면 false
   * @private
   */
  private _parseProcessingInstruction(): boolean {
    const endPos = this._findPattern('?>');
    if (endPos === -1) {
      return false; // 더 많은 데이터 필요
    }
    this.position = endPos + 2; // '?>' 다음으로 이동
    return true;
  }

  /**
   * 종료 태그를 파싱합니다.
   * @returns 파싱이 완료되면 true, 더 많은 데이터가 필요하면 false
   * @private
   */
  private _parseEndTag(): boolean {
    const gtPos = this._findPattern('>');
    if (gtPos === -1) {
      return false; // 더 많은 데이터 필요
    }

    try {
      const tagContent = this.decoder.decode(this.buffer.subarray(this.position, gtPos + 1));
      const closeTagMatch = tagContent.match(/^<\/([a-zA-Z0-9_:.-]+)\s*>$/);

      if (!closeTagMatch) {
        this._addError(new Error('Malformed closing tag'));
        return true;
      }

      const tagName = closeTagMatch[1];
      if (this.elementStack.length === 0 || this.elementStack[this.elementStack.length - 1] !== tagName) {
        this._addError(new Error(`Mismatched closing tag: </${tagName}>. Expected </${this.elementStack[this.elementStack.length - 1] || 'nothing'}>`));
        return true;
      }

      // 네임스페이스 정보를 pop하기 전에 먼저 추출
      const currentNamespaces = this.namespaceStack.length > 0 ? this.namespaceStack[this.namespaceStack.length - 1] : new Map();
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
      if (!this.isStreamEnded) {
        return false; // 불완전한 UTF-8, 더 많은 데이터 필요
      }
      throw error;
    }
  }

  /**
   * 시작 태그를 파싱합니다.
   * @returns 파싱이 완료되면 true, 더 많은 데이터가 필요하면 false
   * @private
   */
  private _parseStartTag(): boolean {
    const gtPos = this._findPattern('>');
    if (gtPos === -1) {
      return false; // 더 많은 데이터 필요
    }

    try {
      const tagContent = this.decoder.decode(this.buffer.subarray(this.position, gtPos + 1));
      const tagMatch = tagContent.match(/^<([a-zA-Z0-9_:.-]+)(\s+[^>]*?)?\s*(\/?)>$/);

      if (!tagMatch) {
        this._addError(new Error('Malformed start tag'));
        return true;
      }

      const tagName = tagMatch[1];
      const attributesString = tagMatch[2] || '';
      const isSelfClosing = tagMatch[3] === '/';

      // 네임스페이스 매핑 스택에 새 레벨 추가
      const currentNamespaces = new Map<string, string>();
      if (this.namespaceStack.length > 0) {
        // 부모의 네임스페이스 매핑을 복사
        const parentNamespaces = this.namespaceStack[this.namespaceStack.length - 1];
        for (const [prefix, uri] of parentNamespaces) {
          currentNamespaces.set(prefix, uri);
        }
      }

      const attributes: { [key: string]: string } = {};
      const attributesWithPrefix: { [key: string]: { value: string; prefix?: string; uri?: string } } = {};
      const attrMatches = attributesString.matchAll(/([a-zA-Z0-9_:.-]+)="([^"]*)"/g);
      for (const match of attrMatches) {
        const attrName = match[1];
        const attrValue = this._unescapeXml(match[2]);
        attributes[attrName] = attrValue;

        // 속성의 네임스페이스 정보 파싱
        const attrNamespaceInfo = this._parseQualifiedName(attrName, currentNamespaces, true);
        attributesWithPrefix[attrNamespaceInfo.localName] = {
          value: attrValue,
          prefix: attrNamespaceInfo.prefix,
          uri: attrNamespaceInfo.uri
        };

        // xmlns 네임스페이스 선언 처리
        if (attrName === 'xmlns') {
          currentNamespaces.set('', attrValue);
        } else if (attrName.startsWith('xmlns:')) {
          const prefix = attrName.substring(6);
          currentNamespaces.set(prefix, attrValue);
        }
      }

      // 태그 이름에서 네임스페이스 정보 추출
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
      if (!this.isStreamEnded) {
        return false; // 불완전한 UTF-8, 더 많은 데이터 필요
      }
      throw error;
    }
  }

  // ...existing code...
}



export default StaxXmlParser;