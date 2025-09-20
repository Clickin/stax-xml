// StaxXmlWriterAsync.ts
import { NamespaceDeclaration, WriteElementOptions } from './types';

enum WriterState {
  INITIAL,
  START_ELEMENT_OPEN,
  IN_ELEMENT,
  AFTER_ELEMENT,
  CLOSED,
  ERROR
}

interface ElementInfo {
  localName: string;
  prefix?: string;
}

export interface StaxXmlWriterAsyncOptions {
  encoding?: string;
  prettyPrint?: boolean;
  indentString?: string;
  addEntities?: { entity: string, value: string }[];
  autoEncodeEntities?: boolean;
  namespaces?: NamespaceDeclaration[];
  // 비동기 특화 옵션
  bufferSize?: number;           // 내부 버퍼 크기 (기본: 16KB)
  highWaterMark?: number;        // WritableStream 백프레셔 임계값
  flushThreshold?: number;       // 자동 플러시 임계값 (기본: bufferSize의 80%)
  enableAutoFlush?: boolean;     // 자동 플러시 활성화 (기본: true)
}

/**
 * 비동기 StAX XML Writer
 * WritableStream을 사용하여 대용량 XML을 효율적으로 스트리밍
 */
export class StaxXmlWriterAsync {
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private encoder: TextEncoder;
  private buffer: Uint8Array;
  private bufferPosition: number = 0;

  private state: WriterState = WriterState.INITIAL;
  private elementStack: ElementInfo[] = [];
  private hasTextContentStack: boolean[] = [];
  private namespaceStack: Map<string, string>[] = [];

  private readonly options: Required<StaxXmlWriterAsyncOptions>;
  private currentIndentLevel: number = 0;
  private needsIndent: boolean = false;
  private entityMap: Record<string, string> = {};

  // 성능 메트릭
  private metrics = {
    totalBytesWritten: 0,
    flushCount: 0,
    lastFlushTime: 0
  };

  constructor(
    stream: WritableStream<Uint8Array>,
    options: StaxXmlWriterAsyncOptions = {}
  ) {
    this.options = {
      encoding: 'utf-8',
      prettyPrint: false,
      indentString: '  ',
      autoEncodeEntities: true,
      namespaces: [],
      bufferSize: 16 * 1024,         // 16KB 기본값
      highWaterMark: 64 * 1024,      // 64KB 백프레셔
      flushThreshold: 0.8,            // 80% 차면 플러시
      enableAutoFlush: true,
      ...options
    };

    // flushThreshold를 실제 바이트 값으로 변환
    if (this.options.flushThreshold <= 1) {
      this.options.flushThreshold = Math.floor(
        this.options.bufferSize * this.options.flushThreshold
      );
    }

    this.writer = stream.getWriter();
    this.encoder = new TextEncoder();
    this.buffer = new Uint8Array(this.options.bufferSize);

    // 네임스페이스 스택 초기화
    this.namespaceStack = [new Map<string, string>()];

    // 엔티티 맵 초기화
    this._initializeEntityMap();
  }

  private _initializeEntityMap(): void {
    if (this.options.addEntities) {
      for (const entity of this.options.addEntities) {
        if (entity.entity && entity.value) {
          this.entityMap[entity.entity] = entity.value;
        }
      }
    }
  }

  /**
   * 버퍼에 데이터 쓰기 (자동 플러시 포함)
   */
  private async _writeToBuffer(text: string): Promise<void> {
    const bytes = this.encoder.encode(text);

    // 단일 청크가 버퍼보다 큰 경우 직접 스트림에 쓰기
    if (bytes.length > this.options.bufferSize) {
      await this._flushBuffer();
      await this.writer.write(bytes);
      this.metrics.totalBytesWritten += bytes.length;
      return;
    }

    // 버퍼에 공간이 부족한 경우 플러시
    if (this.bufferPosition + bytes.length > this.options.bufferSize) {
      await this._flushBuffer();
    }

    // 버퍼에 쓰기
    this.buffer.set(bytes, this.bufferPosition);
    this.bufferPosition += bytes.length;

    // 임계값 도달 시 자동 플러시
    if (this.options.enableAutoFlush &&
      this.bufferPosition >= this.options.flushThreshold) {
      await this._flushBuffer();
    }
  }

  /**
   * 버퍼 플러시
   */
  private async _flushBuffer(): Promise<void> {
    if (this.bufferPosition === 0) return;

    const chunk = this.buffer.slice(0, this.bufferPosition);
    await this.writer.write(chunk);

    this.metrics.totalBytesWritten += this.bufferPosition;
    this.metrics.flushCount++;
    this.metrics.lastFlushTime = Date.now();

    this.bufferPosition = 0;
  }

  /**
   * XML 선언 작성
   */
  public async writeStartDocument(
    version: string = '1.0',
    encoding?: string
  ): Promise<this> {
    if (this.state !== WriterState.INITIAL) {
      throw new Error('writeStartDocument can only be called once at the beginning');
    }

    this.state = WriterState.AFTER_ELEMENT;

    const actualEncoding = encoding || this.options.encoding;
    const declaration = `<?xml version="${version}" encoding="${actualEncoding.toUpperCase()}"?>`;

    await this._writeToBuffer(declaration);

    if (this.options.prettyPrint) {
      this.needsIndent = true;
    }

    return this;
  }

  /**
   * 문서 종료 (모든 요소 자동 닫기)
   */
  public async writeEndDocument(): Promise<void> {
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      return;
    }

    // 열린 모든 요소 닫기
    while (this.elementStack.length > 0) {
      await this.writeEndElement();
    }

    // 최종 플러시
    await this._flushBuffer();

    // Writer 닫기
    await this.writer.close();
    this.state = WriterState.CLOSED;
  }

  /**
   * 시작 요소 작성
   */
  public async writeStartElement(
    localName: string,
    options?: WriteElementOptions
  ): Promise<this> {
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      throw new Error('Cannot writeStartElement: Writer is closed or in error state');
    }

    await this._closeStartElementTag();

    const prefix = options?.prefix;
    const uri = options?.uri;
    const attributes = options?.attributes;
    const selfClosing = options?.selfClosing ?? false;

    // 들여쓰기
    if (this.options.prettyPrint && this.needsIndent) {
      await this._writeIndent();
    }

    const tagName = prefix ? `${prefix}:${localName}` : localName;
    await this._writeToBuffer(`<${tagName}`);

    // 네임스페이스 처리
    const currentNamespaces = new Map(
      this.namespaceStack[this.namespaceStack.length - 1]
    );

    if (prefix && uri) {
      await this._writeToBuffer(` xmlns:${prefix}="${this._escapeXml(uri)}"`);
      currentNamespaces.set(prefix, uri);
    }

    // 속성 처리
    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        if (typeof value === 'string') {
          await this._writeToBuffer(` ${key}="${this._escapeXml(value)}"`);
        } else {
          const attrPrefix = value.prefix;
          const attrValue = value.value;

          if (attrPrefix) {
            if (!currentNamespaces.has(attrPrefix)) {
              throw new Error(`Namespace prefix '${attrPrefix}' is not defined`);
            }
            await this._writeToBuffer(
              ` ${attrPrefix}:${key}="${this._escapeXml(attrValue)}"`
            );
          } else {
            await this._writeToBuffer(` ${key}="${this._escapeXml(attrValue)}"`);
          }
        }
      }
    }

    if (selfClosing) {
      await this._writeToBuffer('/>');
      this.state = WriterState.AFTER_ELEMENT;
      if (this.options.prettyPrint) {
        await this._writeNewline();
      }
      return this;
    }

    this.elementStack.push({ localName, prefix });
    this.hasTextContentStack.push(false);
    this.namespaceStack.push(currentNamespaces);
    this.state = WriterState.START_ELEMENT_OPEN;
    this.currentIndentLevel++;

    return this;
  }

  /**
   * 종료 요소 작성
   */
  public async writeEndElement(): Promise<this> {
    if (this.elementStack.length === 0) {
      throw new Error('No open element to close');
    }

    this.currentIndentLevel--;

    const hasTextContent = this.hasTextContentStack.pop() || false;

    if (!hasTextContent && this.state !== WriterState.START_ELEMENT_OPEN) {
      await this._writeIndent();
    }

    await this._closeStartElementTag();

    const elementInfo = this.elementStack.pop()!;
    this.namespaceStack.pop();

    const closingTagName = elementInfo.prefix
      ? `${elementInfo.prefix}:${elementInfo.localName}`
      : elementInfo.localName;

    await this._writeToBuffer(`</${closingTagName}>`);

    this.state = WriterState.AFTER_ELEMENT;

    if (this.options.prettyPrint) {
      this.needsIndent = true;
    }

    return this;
  }

  /**
   * 텍스트 작성
   */
  public async writeCharacters(text: string): Promise<this> {
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      throw new Error('Cannot writeCharacters: Writer is closed or in error state');
    }

    await this._closeStartElementTag();
    await this._writeToBuffer(this._escapeXml(text));

    this.state = WriterState.IN_ELEMENT;

    if (this.hasTextContentStack.length > 0) {
      this.hasTextContentStack[this.hasTextContentStack.length - 1] = true;
    }

    this.needsIndent = false;

    return this;
  }

  /**
   * CDATA 섹션 작성
   */
  public async writeCData(cdata: string): Promise<this> {
    if (cdata.includes(']]>')) {
      throw new Error('CDATA section cannot contain "]]>" sequence');
    }

    await this._closeStartElementTag();
    await this._writeToBuffer(`<![CDATA[${cdata}]]>`);

    this.state = WriterState.IN_ELEMENT;

    if (this.hasTextContentStack.length > 0) {
      this.hasTextContentStack[this.hasTextContentStack.length - 1] = true;
    }

    return this;
  }

  /**
   * 주석 작성
   */
  public async writeComment(comment: string): Promise<this> {
    if (comment.includes('--')) {
      throw new Error('XML comment cannot contain "--" sequence');
    }

    await this._closeStartElementTag();
    await this._writeIndent();
    await this._writeToBuffer(`<!-- ${comment} -->`);

    this.state = WriterState.AFTER_ELEMENT;

    if (this.options.prettyPrint) {
      await this._writeNewline();
    }

    return this;
  }

  /**
   * 수동 플러시
   */
  public async flush(): Promise<void> {
    await this._flushBuffer();
  }

  /**
   * 메트릭 반환
   */
  public getMetrics() {
    return {
      ...this.metrics,
      bufferUtilization: this.bufferPosition / this.options.bufferSize,
      averageFlushSize: this.metrics.flushCount > 0
        ? this.metrics.totalBytesWritten / this.metrics.flushCount
        : 0
    };
  }

  // === Private Helper Methods ===

  private async _closeStartElementTag(): Promise<void> {
    if (this.state === WriterState.START_ELEMENT_OPEN) {
      await this._writeToBuffer('>');
      this.state = WriterState.IN_ELEMENT;
      if (this.options.prettyPrint) {
        this.needsIndent = true;
      }
    }
  }

  private async _writeIndent(): Promise<void> {
    if (this.options.prettyPrint && this.needsIndent) {
      const indent = '\n' + this.options.indentString.repeat(this.currentIndentLevel);
      await this._writeToBuffer(indent);
      this.needsIndent = false;
    }
  }

  private async _writeNewline(): Promise<void> {
    if (this.options.prettyPrint) {
      await this._writeToBuffer('\n');
      this.needsIndent = true;
    }
  }

  private _escapeXml(text: string): string {
    if (!text) {
      return ''; // 빈 문자열은 그대로 반환
    }
    if (!this.options.autoEncodeEntities) {
      return text; // 자동 엔티티 인코딩이 비활성화된 경우 원본 텍스트 반환
    }

    let entityMap: Record<string, string> = {
      '&': '&amp;', // Write 과정에서는 &가 다른 엔티티와 충돌하지 않습니다.
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\'': '&apos;',
      ...this.options.addEntities?.reduce((map, entity) => {
        if (entity.entity && entity.value) {
          map[entity.entity] = entity.value;
        }
        return map;
      }, {} as Record<string, string>)
    };

    // entityMap의 key를 정규식으로 변환하여 이스케이프 처리
    const regex = new RegExp(Object.keys(entityMap).join('|'), 'g');
    // 이스케이프 처리
    return text.replace(regex, (match) => {
      // entityMap에 정의된 문자인 경우, 매핑된 값을 반환합니다.
      if (entityMap[match]) {
        return entityMap[match];
      }
      else {
        // 정의되지 않은 문자는 그대로 반환합니다.
        return match;
      }
    });
  }
}