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
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private decoderStream: TextDecoderStream;
  private buffer: string = '';
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
    // set up TextDecoderStream to decode Uint8Array to string and pipe from input
    this.decoderStream = new TextDecoderStream(this.options.encoding);
    xmlStream.pipeTo(this.decoderStream.writable);
    this.reader = this.decoderStream.readable.getReader();

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

        // TextDecoderStream에서 디코딩된 문자열을 버퍼에 추가
        this.buffer += value;
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
    // while 루프의 시작
    while (this.position < this.buffer.length && !this.parserFinished) {
      const remaining = this.buffer.substring(this.position);

      // < 문자를 기준으로 태그 시작 감지
      if (remaining.startsWith('<')) {
        this._flushCharacters(); // 태그 전에 버퍼링된 텍스트가 있다면 먼저 처리

        // XML 선언 <?xml ...?>
        if (remaining.startsWith('<?xml')) {
          const endDecl = remaining.indexOf('?>');
          if (endDecl !== -1) {
            this.position += endDecl + 2;
            this._compactBufferIfNeeded();
            continue;
          }
        }
        // 주석 <!-- ... -->
        else if (remaining.startsWith('<!--')) {
          const endCommentIndex = remaining.indexOf('-->');
          if (endCommentIndex !== -1) {
            this.position += endCommentIndex + 3; // '-->'의 길이만큼 position 이동
            this._compactBufferIfNeeded();
            continue; // 다음 구문 파싱
          }
        }
        // CDATA 섹션 <![CDATA[ ... ]]>
        else if (remaining.startsWith('<![CDATA[')) {
          const endCdata = remaining.indexOf(']]>');
          if (endCdata !== -1) {
            const cdataContent = remaining.substring('<![CDATA['.length, endCdata);
            this._addEvent({
              type: XmlEventType.CDATA,
              value: cdataContent
            } as CdataEvent);
            this.position += endCdata + ']]>'.length;
            this._compactBufferIfNeeded();
            continue;
          }
        }
        // 처리 명령 <?target ... ?>
        else if (remaining.startsWith('<?')) {
          const endPi = remaining.indexOf('?>');
          if (endPi !== -1) {
            this.position += endPi + 2;
            this._compactBufferIfNeeded();
            continue;
          }
        }
        // 종료 태그 </tag>
        else if (remaining.startsWith('</')) {
          const closeTagMatch = remaining.match(/^<\/([a-zA-Z0-9_:.-]+)\s*>/);
          if (closeTagMatch) {
            const tagName = closeTagMatch[1];
            if (this.elementStack.length === 0 || this.elementStack[this.elementStack.length - 1] !== tagName) {
              this._addError(new Error(`Mismatched closing tag: </${tagName}>. Expected </${this.elementStack[this.elementStack.length - 1] || 'nothing'}>`));
              return;
            }
            this.elementStack.pop();
            this._addEvent({ type: XmlEventType.END_ELEMENT, name: tagName } as EndElementEvent);
            this.position += closeTagMatch[0].length;
            this._compactBufferIfNeeded();
            continue;
          }
        }
        // 시작 태그 <tag> 또는 빈 태그 <tag/>
        else { // 여기가 시작 태그 또는 빈 태그를 처리하는 부분
          const tagMatch = remaining.match(/^<([a-zA-Z0-9_:.-]+)(\s+[^>]*?)?\s*(\/?)>/);
          if (tagMatch) {
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
            const attrMatches = attributesString.matchAll(/([a-zA-Z0-9_:.-]+)="([^"]*?)"/g);
            for (const match of attrMatches) {
              const attrName = match[1];
              const attrValue = this._unescapeXml(match[2]);
              attributes[attrName] = attrValue;

              // xmlns 네임스페이스 선언 처리
              if (attrName === 'xmlns') {
                // 기본 네임스페이스: xmlns="uri"
                currentNamespaces.set('', attrValue);
              } else if (attrName.startsWith('xmlns:')) {
                // 접두사 네임스페이스: xmlns:prefix="uri"
                const prefix = attrName.substring(6); // 'xmlns:' 제거
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
              attributes: attributes
            } as StartElementEvent);
            this.position += tagMatch[0].length;

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
            this._compactBufferIfNeeded();
            continue;
          }
        }
        // 만약 '<'로 시작했지만, 위 어떤 태그 형식에도 맞지 않는다면, 에러 또는 더 많은 데이터 대기
        if (this.isStreamEnded) {
          this._addError(new Error(`Malformed XML near position ${this.position}: ${remaining.substring(0, Math.min(50, remaining.length))}...`));
          return;
        }
      } // <-- if (remaining.startsWith('<'))의 닫는 대괄호

      // 텍스트 노드 처리
      const nextTagIndex = remaining.indexOf('<');
      if (nextTagIndex === -1) {
        // 남은 부분이 모두 텍스트일 경우, 일단 버퍼에 저장하고 새 데이터 대기
        this.currentTextBuffer += remaining;
        this.position = this.buffer.length; // 버퍼 끝까지 처리
        break; // while 루프를 일시 중단하고 새 데이터 기다림
      } else if (nextTagIndex > 0) {
        // 태그 앞에 텍스트가 있을 경우
        const text = remaining.substring(0, nextTagIndex);
        this.currentTextBuffer += text;
        this.position += text.length;
        this._flushCharacters(); // 텍스트를 발견하면 즉시 이벤트로 추가
        this._compactBufferIfNeeded();
        continue; // 텍스트 처리 후 다시 while 루프 처음부터 파싱 시도
      }

      // 더 이상 파싱할 수 없는 불완전한 데이터가 남아있는데 스트림이 끝났다면 오류
      if (this.isStreamEnded && this.position < this.buffer.length) {
        this._addError(new Error('Malformed XML at end of stream.'));
        this.parserFinished = true;
        return;
      }

      // 아직 파싱할 수 있는 데이터가 없으면 새 데이터가 올 때까지 대기
      // 이 시점에서 buffer.substring(this.position)은 유효하지만, 완전한 태그가 아닐 수 있음
      this._compactBuffer(); // 버퍼 압축으로 메모리 절약
      break; // while 루프를 일시 중단하고 새 데이터 기다림
    } // <-- while (this.position < this.buffer.length && !this.parserFinished)의 닫는 대괄호
  } // <-- _parseBuffer 메서드의 닫는 대괄호

  private _flushCharacters(): void {
    if (this.currentTextBuffer.length > 0) {
      const decodedText = this._unescapeXml(this.currentTextBuffer);
      if (decodedText.trim().length > 0) { // 공백만 있는 텍스트는 무시
        this._addEvent({
          type: XmlEventType.CHARACTERS,
          value: decodedText
        } as CharactersEvent);
      }
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
    if (this.position > 8192 || (this.buffer.length > maxSize && this.position > maxSize / 4)) {
      this._compactBuffer();
    }
  }

  /**
   * 버퍼를 압축하여 메모리 사용량을 줄입니다.
   * @private
   */
  private _compactBuffer(): void {
    if (this.position > 0) {
      this.buffer = this.buffer.substring(this.position);
      this.position = 0;
    }
  }

  /**
   * 버퍼 상태를 강제로 정리합니다.
   * @private
   */
  private _clearBuffers(): void {
    this.buffer = '';
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

      // 웹 표준 ReadableStream의 경우 reader를 해제
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
      '&amp;': '&'
    };

    const regex = new RegExp(Object.keys(entityMap).map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    // 디코딩 처리
    return text.replace(regex, (match) => {
      // entityMap에 정의된 엔티티인 경우, 매핑된 값을 반환합니다.
      if (entityMap[match]) {
        return entityMap[match];
      }
      else {
        // 정의되지 않은 엔티티는 그대로 반환합니다.
        return match;
      }
    });
  }

  /**
   * qualified name을 파싱하여 localName, prefix, uri를 추출합니다.
   * @param qname qualified name (예: "prefix:localName" 또는 "localName")
   * @param namespaces 현재 네임스페이스 매핑
   * @returns 파싱된 네임스페이스 정보
   * @private
   */
  private _parseQualifiedName(qname: string, namespaces: Map<string, string>): {
    localName: string;
    prefix?: string;
    uri?: string;
  } {
    const colonIndex = qname.indexOf(':');
    if (colonIndex === -1) {
      // 접두사가 없는 경우
      const defaultUri = namespaces.get('');
      return {
        localName: qname,
        prefix: undefined,
        uri: defaultUri
      };
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
}



export default StaxXmlParser;