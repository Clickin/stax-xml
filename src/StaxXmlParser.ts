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

/**
 * 웹 표준 ReadableStream을 직접 파싱하여 간소화된 StAX Pull 모델을 제공하는 XML 파서.
 * DTD, 네임스페이스, 복잡한 엔티티 등은 지원하지 않습니다.
 */
class StaxXmlParser implements AsyncIterator<AnyXmlEvent> {
  private stream: ReadableStream<Uint8Array>;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private decoder: TextDecoder;
  private buffer: string = '';
  private position: number = 0;
  private eventQueue: AnyXmlEvent[] = [];
  private resolveNext: ((value: IteratorResult<AnyXmlEvent>) => void) | null = null;
  private error: Error | null = null;
  private isStreamEnded: boolean = false;
  private parserFinished: boolean = false;
  private currentTextBuffer: string = '';
  private elementStack: string[] = []; // 열린 요소의 이름 스택
  private decodeEntities: { entity: string, value: string, regex: RegExp }[] = [
    { entity: '&amp;', value: '&', regex: /&amp;/g },
    { entity: '&lt;', value: '<', regex: /&lt;/g },
    { entity: '&gt;', value: '>', regex: /&gt;/g },
    { entity: '&quot;', value: '"', regex: /&quot;/g },
    { entity: '&apos;', value: "'", regex: /&apos;/g }
  ];

  constructor(xmlStream: ReadableStream<Uint8Array>, encoding: string = 'utf-8', entities: { entity: string, value: string }[] = []) {
    if (!(xmlStream instanceof ReadableStream)) {
      throw new Error('xmlStream must be a web standard ReadableStream.');
    }

    this.stream = xmlStream;
    this.decoder = new TextDecoder(encoding);
    this.reader = this.stream.getReader();

    this._startReading();
    this._addEvent({ type: XmlEventType.START_DOCUMENT });
    if (entities && Array.isArray(entities) && entities.length > 0) {
      this.decodeEntities.push(...entities.map(entity => ({
        ...entity,
        regex: new RegExp(entity.entity, 'g')
      }))); // 사용자 정의 엔티티 설정
    }
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

        // Uint8Array를 문자열로 디코딩하여 버퍼에 추가
        this.buffer += this.decoder.decode(value, { stream: true });
        this._parseBuffer();
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
            continue;
          }
        }
        // 주석 else if (remaining.startsWith('');
        const endCommentIndex = remaining.indexOf('-->');
        if (endCommentIndex !== -1) {
          this.position += endCommentIndex + 3; // '-->'의 길이만큼 position 이동
          continue; // 다음 구문 파싱
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
            continue;
          }
        }
        // 처리 명령 <?target ... ?>
        else if (remaining.startsWith('<?')) {
          const endPi = remaining.indexOf('?>');
          if (endPi !== -1) {
            this.position += endPi + 2;
            continue;
          }
        }
        // 종료 태그 </tag>
        else if (remaining.startsWith('</')) {
          const closeTagMatch = remaining.match(/^<\/([a-zA-Z0-9_.-]+)\s*>/);
          if (closeTagMatch) {
            const tagName = closeTagMatch[1];
            if (this.elementStack.length === 0 || this.elementStack[this.elementStack.length - 1] !== tagName) {
              this._addError(new Error(`Mismatched closing tag: </${tagName}>. Expected </${this.elementStack[this.elementStack.length - 1] || 'nothing'}>`));
              return;
            }
            this.elementStack.pop();
            this._addEvent({ type: XmlEventType.END_ELEMENT, name: tagName } as EndElementEvent);
            this.position += closeTagMatch[0].length;
            continue;
          }
        }
        // 시작 태그 <tag> 또는 빈 태그 <tag/>
        else { // 여기가 시작 태그 또는 빈 태그를 처리하는 부분
          const tagMatch = remaining.match(/^<([a-zA-Z0-9_.-]+)(\s+[^>]*?)?\s*(\/?)>/);
          if (tagMatch) {
            const tagName = tagMatch[1];
            const attributesString = tagMatch[2] || '';
            const isSelfClosing = tagMatch[3] === '/';

            const attributes: { [key: string]: string } = {};
            // 속성 파싱: key="value" 형태만 지원
            const attrMatches = attributesString.matchAll(/([a-zA-Z0-9_.-]+)="([^"]*?)"/g);
            for (const match of attrMatches) {
              attributes[match[1]] = this._unescapeXml(match[2]);
            }

            this._addEvent({
              type: XmlEventType.START_ELEMENT,
              name: tagName,
              attributes: attributes
            } as StartElementEvent);
            this.position += tagMatch[0].length;

            if (!isSelfClosing) {
              this.elementStack.push(tagName);
            } else {
              this._addEvent({ type: XmlEventType.END_ELEMENT, name: tagName } as EndElementEvent);
            }
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
      this.buffer = this.buffer.substring(this.position);
      this.position = 0;
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

  private _unescapeXml(text: string): string {
    for (const entity of this.decodeEntities) {
      text = text.replace(entity.regex, entity.value);
    }
    return text;
  }

  public get XmlEventType(): typeof XmlEventType {
    return XmlEventType;
  }
}



export default StaxXmlParser;