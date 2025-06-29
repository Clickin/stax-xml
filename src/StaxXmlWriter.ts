// StaxXmlWriter.ts
import { NamespaceDeclaration, WriteElementOptions, XmlAttribute } from './types'; // NamespaceDeclaration, ProcessingInstruction은 사용되지 않음

/**
 * XML 문서 작성 중 발생하는 상태
 */
enum WriterState {
    INITIAL,            // 초기 상태
    START_ELEMENT_OPEN, // <element (속성, 네임스페이스 작성 가능)
    IN_ELEMENT,         // <element>...</element> (텍스트, 자식 요소, PI 등 작성 가능)
    AFTER_ELEMENT,      // </element> 이후 (다음 요소, 주석 등 작성 가능)
    CLOSED,             // 스트림이 닫힘
    ERROR               // 오류 발생
}

/**
 * 요소 스택에 저장되는 요소 정보
 */
interface ElementInfo {
    localName: string;
    prefix?: string;
}


export interface StaxXmlWriterOptions {
    encoding?: string; // 출력 인코딩 (기본값: 'utf-8')
    prettyPrint?: boolean; // Pretty print 활성화 여부 (기본값: false)
    indentString?: string; // Pretty print 들여쓰기 문자열 (기본값: '  ')
    addEntities?: { entity: string, value: string }[]; // 사용자 정의 엔티티
    autoEncodeEntities?: boolean; // 자동 엔티티 인코딩 활성화 여부 (기본값: true)
    namespaces?: NamespaceDeclaration[]; // 문서 기본 네임스페이스 선언
}

interface StaxXmlInternalOptions {
    encoding: string; // 출력 인코딩
    prettyPrint: boolean; // Pretty print 활성화 여부
    indentString: string; // Pretty print 들여쓰기 문자열
    addEntities?: { entity: string, value: string }[]; // 사용자 정의 엔티티 (정규식 포함)
    autoEncodeEntities: boolean; // 자동 엔티티 인코딩 활성화 여부
    namespaces?: NamespaceDeclaration[]; // 문서 기본 네임스페이스 선언
}

const defaultOptions: StaxXmlInternalOptions = {
    encoding: 'utf-8',
    prettyPrint: false,
    indentString: '  ',
    autoEncodeEntities: true, // 기본값은 true로 설정
    namespaces: []
};
/**
 * StAX XMLStreamWriter와 유사하게 XML을 작성하는 클래스.
 * 웹 표준 WritableStream에 XML을 직접 작성합니다.
 * 네임스페이스 및 복잡한 PI/주석 관리는 지원하지 않는 간소화된 구현입니다.
 */
class StaxXmlWriter {
    private writer: WritableStreamDefaultWriter<string> | null = null;
    private encoderStream: TextEncoderStream;
    private state: WriterState = WriterState.INITIAL;
    private elementStack: ElementInfo[] = []; // 열린 요소의 정보 스택
    private hasTextContentStack: boolean[] = []; // 각 요소가 텍스트 콘텐츠를 가지고 있는지 추적하는 스택
    // options 객체로 변경
    private options: StaxXmlInternalOptions;
    private currentIndentLevel: number = 0; // 현재 들여쓰기 레벨
    private needsIndent: boolean = false; // 다음 출력에 들여쓰기가 필요한지 여부
    private entityMap: Record<string, string> = {};

    constructor(outputStream: WritableStream<Uint8Array>, options: StaxXmlWriterOptions = {}) {
        if (!(outputStream instanceof WritableStream)) {
            throw new Error('outputStream must be a web standard WritableStream.');
        }
        // set up TextEncoderStream to encode strings to Uint8Array and pipe to output
        this.encoderStream = new TextEncoderStream();
        this.encoderStream.readable.pipeTo(outputStream as WritableStream<Uint8Array>);
        this.writer = this.encoderStream.writable.getWriter();
        // 기본 옵션으로 초기화
        this.options = { ...defaultOptions, ...options };
        // 사용자 정의 엔티티가 있다면 entityMap에 추가
        if (this.options.addEntities && Array.isArray(this.options.addEntities)) {
            for (const entity of this.options.addEntities) {
                if (entity.entity && entity.value) {
                    this.entityMap[entity.entity] = entity.value;
                }
            }
        }
    }

    /**
     * XML 선언을 작성합니다 (예: <?xml version="1.0" encoding="UTF-8"?>).
     * 문서의 가장 처음에 한 번만 호출해야 합니다.
     * @param version XML 버전 (기본값: "1.0")
     * @param encoding 인코딩 (기본값: 생성자에서 설정된 값)
     * @param standalone 독립 실행형 문서 여부 (기본값: undefined)
     * @returns this (체이닝 가능)
     * @throws Error 잘못된 상태에서 호출 시
     */
    public writeStartDocument(version: string = '1.0', encoding?: string): this {
        if (this.state !== WriterState.INITIAL) {
            throw new Error('writeStartDocument can only be called once at the beginning of the document.');
        }
        this.state = WriterState.AFTER_ELEMENT; // 문서 선언 후에는 요소나 주석 등을 작성할 수 있도록

        let declaration = `<?xml version="${version}"`;
        if (encoding) {
            declaration += ` encoding="${encoding.toUpperCase()}"`; // 인코딩 대문자로
            this.options.encoding = encoding; // 인코딩 업데이트
        } else {
            declaration += ` encoding="${this.options.encoding.toUpperCase()}"`;
        }
        declaration += '?>';
        this._write(declaration);
        if (this.options.prettyPrint) {
            this.needsIndent = true;
        }
        return this;
    }

    /**
     * 문서의 끝을 나타내며, 열린 모든 요소를 자동으로 닫습니다.
     * @returns Promise<void> 스트림이 플러시될 때 resolve되는 Promise
     */
    public async writeEndDocument(): Promise<void> {
        if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
            return; // 이미 닫혔거나 에러 상태면 아무것도 하지 않음
        }

        // 열려 있는 모든 요소 닫기
        while (this.elementStack.length > 0) {
            this.writeEndElement();
        }
        this.state = WriterState.CLOSED;

        // 웹 표준 WritableStream의 writer를 닫고 모든 데이터를 플러시합니다.
        if (this.writer) {
            try {
                await this.writer.close();
                this.writer = null;
            } catch (err) {
                this.state = WriterState.ERROR;
                throw err;
            }
        }
    }

    /**
     * 시작 요소를 작성합니다 (예: <element> 또는 <prefix:element>).
     * @param localName 요소의 로컬 이름
     * @param options 요소 작성 옵션 (prefix, uri, attributes, selfClosing)
     * @returns this (체이닝 가능)
     * @throws Error 잘못된 상태에서 호출 시
     */
    public writeStartElement(localName: string, options?: WriteElementOptions): this {
        if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
            throw new Error('Cannot writeStartElement: Writer is closed or in error state.');
        }
        this._closeStartElementTag(); // 이전에 열린 태그가 있다면 닫음

        // 옵션에서 값 추출
        const prefix = options?.prefix;
        const uri = options?.uri;
        const attributes = options?.attributes;
        const selfClosing = options?.selfClosing ?? false;

        this._writeIndent(); // Pretty print용 들여쓰기
        const tagName = prefix ? `${prefix}:${localName}` : localName;
        this._write(`<${tagName}`);

        // 속성 추가 (attributes가 제공된 경우)
        if (attributes) {
            for (const [key, value] of Object.entries(attributes)) {
                this._write(` ${key}="${this._escapeXml(value)}"`);
            }
        }

        // element-level namespace declaration if prefix and uri provided
        if (prefix && uri) {
            this._write(` xmlns:${prefix}="${this._escapeXml(uri)}"`);
        }

        // selfClosing이 true이면 바로 태그를 닫고 종료
        if (selfClosing) {
            this._write('/>');
            this.state = WriterState.AFTER_ELEMENT;
            this._writeNewline(); // Pretty print용 줄바꿈
            return this;
        }

        this.elementStack.push({
            localName,
            prefix
        });
        this.hasTextContentStack.push(false); // 새 요소는 아직 텍스트 콘텐츠가 없음
        this.state = WriterState.START_ELEMENT_OPEN; // 이제 속성이나 네임스페이스를 작성할 수 있음
        this.currentIndentLevel++; // 들여쓰기 레벨 증가
        return this;
    }



    /**
     * 속성을 작성합니다. writeStartElement() 호출 직후에만 호출할 수 있습니다.
     * @param localName 속성의 로컬 이름
     * @param value 속성 값
     * @param prefix 속성의 네임스페이스 접두사 (이 구현에서는 네임스페이스 매핑을 관리하지 않으므로 주의)
     * @param uri 속성의 네임스페이스 URI (이 구현에서는 네임스페이스 매핑을 관리하지 않으므로 주의)
     * @returns this (체이닝 가능)
     * @throws Error 잘못된 상태에서 호출 시
     */
    public writeAttribute(localName: string, value: string, prefix?: string): this {
        if (this.state !== WriterState.START_ELEMENT_OPEN) {
            throw new Error('writeAttribute can only be called after writeStartElement.');
        }
        let attrName = prefix ? `${prefix}:${localName}` : localName;
        let attr = ` ${attrName}="${this._escapeXml(value)}"`;
        // URI는 현재 구현에서 처리되지 않음 (네임스페이스 관리 로직이 없기 때문)
        this._write(attr);
        return this;
    }

    /**
     * 네임스페이스 선언을 작성합니다. writeStartElement() 호출 직후에만 호출할 수 있습니다.
     * 이 구현에서는 단순하게 xmlns:prefix="uri" 또는 xmlns="uri" 형태로 문자열을 작성합니다.
     * 실제 네임스페이스 유효성 검사/관리 로직은 포함되지 않습니다.
     * @param prefix 네임스페이스 접두사
     * @param uri 네임스페이스 URI
     * @returns this (체이닝 가능)
     * @throws Error 잘못된 상태에서 호출 시
     */
    public writeNamespace(prefix: string, uri: string): this {
        if (this.state !== WriterState.START_ELEMENT_OPEN) {
            throw new Error('writeNamespace can only be called after writeStartElement.');
        }
        if (prefix) {
            this._write(` xmlns:${prefix}="${this._escapeXml(uri)}"`);
        } else { // 기본 네임스페이스
            this._write(` xmlns="${this._escapeXml(uri)}"`);
        }
        return this;
    }

    /**
     * 텍스트 내용을 작성합니다.
     * @param text 작성할 텍스트
     * @returns this (체이닝 가능)
     * @throws Error 잘못된 상태에서 호출 시
     */
    public writeCharacters(text: string): this {
        if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
            throw new Error('Cannot writeCharacters: Writer is closed or in error state.');
        }
        this._closeStartElementTag();
        // 텍스트에는 별도의 들여쓰기를 적용하지 않음 (인라인 텍스트로 처리)
        this._write(this._escapeXml(text));
        this.state = WriterState.IN_ELEMENT; // 텍스트 작성 후에는 요소 안에 있다고 간주
        // 현재 요소에 텍스트 콘텐츠가 있음을 표시
        if (this.hasTextContentStack.length > 0) {
            this.hasTextContentStack[this.hasTextContentStack.length - 1] = true;
        }
        // 텍스트 후에는 needsIndent를 false로 설정하여 다음 요소가 적절히 들여쓰기되도록 함
        this.needsIndent = false;
        return this;
    }

    /**
     * CDATA 섹션을 작성합니다.
     * @param cdata CDATA 내용
     * @returns this (체이닝 가능)
     * @throws Error 잘못된 상태에서 호출 시 (특히 ']]>' 시퀀스 포함 시)
     */
    public writeCData(cdata: string): this {
        if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
            throw new Error('Cannot writeCData: Writer is closed or in error state.');
        }
        this._closeStartElementTag();
        // CDATA 섹션 내부는 파싱되지 않으므로 이스케이프할 필요가 없습니다.
        // 하지만 ']]>' 시퀀스는 CDATA를 종료시키므로 포함될 수 없습니다.
        if (cdata.includes(']]>')) {
            throw new Error('CDATA section cannot contain "]]>" sequence.');
        }
        // CDATA는 원본 형태 그대로 출력 (들여쓰기 무시)
        this._write(`<![CDATA[${cdata}]]>`);
        this.state = WriterState.IN_ELEMENT;
        // 현재 요소에 텍스트 콘텐츠가 있음을 표시
        if (this.hasTextContentStack.length > 0) {
            this.hasTextContentStack[this.hasTextContentStack.length - 1] = true;
        }
        this.needsIndent = false; // CDATA 후에는 needsIndent를 false로 설정
        return this;
    }

    /**
     * 주석을 작성합니다.
     * @param comment 주석 내용
     * @returns this (체이닝 가능)
     * @throws Error 잘못된 상태에서 호출 시 (특히 '--' 시퀀스 포함 시)
     */
    public writeComment(comment: string): this {
        if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
            throw new Error('Cannot writeComment: Writer is closed or in error state.');
        }
        this._closeStartElementTag();
        // XML 주석은 '--' 시퀀스를 포함할 수 없습니다.
        if (comment.includes('--')) {
            throw new Error('XML comment cannot contain "--" sequence.');
        }
        this._writeIndent(); // Pretty print용 들여쓰기
        this._write(`<!-- ${comment} -->`);
        this.state = WriterState.AFTER_ELEMENT; // 주석 후에는 다음 요소 또는 주석 등이 가능
        this._writeNewline(); // Pretty print용 줄바꿈
        return this;
    }

    /**
     * 처리 명령 (Processing Instruction)을 작성합니다.
     * @param target PI의 대상
     * @param data PI의 데이터 (선택 사항)
     * @returns this (체이닝 가능)
     * @throws Error 잘못된 상태에서 호출 시 (특히 '?>' 시퀀스 포함 시)
     */
    public writeProcessingInstruction(target: string, data?: string): this {
        if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
            throw new Error('Cannot writeProcessingInstruction: Writer is closed or in error state.');
        }
        this._closeStartElementTag();
        let pi = `<?${target}`;
        if (data) {
            // 데이터 내부에 '?>' 시퀀스는 PI를 종료시키므로 피해야 합니다.
            if (data.includes('?>')) {
                throw new Error('Processing instruction data cannot contain "?>" sequence.');
            }
            pi += ` ${data}`;
        }
        pi += '?>';
        this._writeIndent(); // Pretty print용 들여쓰기
        this._write(pi);
        this.state = WriterState.AFTER_ELEMENT;
        this._writeNewline(); // Pretty print용 줄바꿈
        return this;
    }

    /**
     * 현재 열려있는 요소를 닫습니다 (예: </element> 또는 </prefix:element>).
     * @returns this (체이닝 가능)
     * @throws Error 열린 요소가 없을 때 호출 시
     */
    public writeEndElement(): this {
        if (this.elementStack.length === 0) {
            throw new Error('No open element to close.');
        }
        if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
            throw new Error('Cannot writeEndElement: Writer is closed or in error state.');
        }

        this.currentIndentLevel--; // 들여쓰기 레벨 감소

        // 현재 요소에 텍스트 콘텐츠가 있는지 확인
        const hasTextContent = this.hasTextContentStack.pop() || false;

        // 텍스트 콘텐츠가 없고, 빈 요소가 아닌 경우에만 들여쓰기 적용
        if (!hasTextContent && this.state !== WriterState.START_ELEMENT_OPEN) {
            this._writeIndent();
        }

        this._closeStartElementTag(); // 혹시 열린 태그가 있으면 먼저 닫고 닫는 태그 작성

        const elementInfo = this.elementStack.pop()!;
        const closingTagName = elementInfo.prefix ? `${elementInfo.prefix}:${elementInfo.localName}` : elementInfo.localName;
        this._write(`</${closingTagName}>`);
        this.state = WriterState.AFTER_ELEMENT; // 요소 닫은 후에는 다음 요소 또는 주석 등이 가능

        if (this.options.prettyPrint) {
            this.needsIndent = true;
        }
        return this;
    }

    /**
     * 빈 요소를 작성합니다 (예: <element/>).
     * @param localName 요소의 로컬 이름
     * @param prefix 네임스페이스 접두사 (선택 사항)
     * @param uri 네임스페이스 URI (선택 사항)
     * @param attributes 속성 배열 (선택 사항)
     * @param namespaces 네임스페이스 선언 배열 (선택 사항)
     * @returns this (체이닝 가능)
     * @throws Error 잘못된 상태에서 호출 시
     */
    public writeEmptyElement(
        localName: string,
        prefix?: string,
        uri?: string, // 이 구현에서는 사용되지 않음
        attributes?: XmlAttribute[],
        namespaces?: NamespaceDeclaration[] // 이 구현에서는 사용되지 않음
    ): this {
        if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
            throw new Error('Cannot writeEmptyElement: Writer is closed or in error state.');
        }
        this._closeStartElementTag();

        this._writeIndent(); // Pretty print용 들여쓰기
        const tagName = prefix ? `${prefix}:${localName}` : localName;
        let element = `<${tagName}`;
        // element-level namespace declaration
        if (prefix && uri) {
            element += ` xmlns:${prefix}="${this._escapeXml(uri)}"`;
        }

        if (namespaces) { // 이 부분은 현재 구현에서 네임스페이스 관리가 안 되므로, 단순 문자열 추가
            for (const ns of namespaces) {
                element += ` xmlns${ns.prefix ? `:${ns.prefix}` : ''}="${this._escapeXml(ns.uri)}"`;
            }
        }
        if (attributes) {
            for (const attr of attributes) {
                const attrName = attr.prefix ? `${attr.prefix}:${attr.localName}` : attr.localName;
                element += ` ${attrName}="${this._escapeXml(attr.value)}"`;
            }
        }
        element += '/>';
        this._write(element);
        this.state = WriterState.AFTER_ELEMENT;
        this._writeNewline(); // Pretty print용 줄바꿈
        return this;
    }

    /**
     * Pretty print 기능을 활성화/비활성화합니다.
     * @param enabled Pretty print 활성화 여부
     * @returns this (체이닝 가능)
     */
    public setPrettyPrint(enabled: boolean): this {
        this.options.prettyPrint = enabled;
        return this;
    }

    /**
     * 들여쓰기 문자열을 설정합니다.
     * @param indentString 들여쓰기에 사용할 문자열 (예: '  ', '\t', '    ')
     * @returns this (체이닝 가능)
     */
    public setIndentString(indentString: string): this {
        this.options.indentString = indentString;
        return this;
    }

    /**
     * 현재 Pretty print 설정을 반환합니다.
     * @returns Pretty print 활성화 여부
     */
    public isPrettyPrintEnabled(): boolean {
        return this.options.prettyPrint;
    }

    /**
     * 현재 들여쓰기 문자열을 반환합니다.
     * @returns 현재 설정된 들여쓰기 문자열
     */
    public getIndentString(): string {
        return this.options.indentString;
    }

    /**
     * 현재 열려있는 시작 요소 태그를 닫습니다 ('>' 추가).
     * 예를 들어, <element 를 <element> 로 만듭니다.
     * @private
     */
    private _closeStartElementTag(): void {
        if (this.state === WriterState.START_ELEMENT_OPEN) {
            this._write('>');
            this.state = WriterState.IN_ELEMENT; // 태그를 닫았으므로 이제 요소 내부에 있다고 간주
            if (this.options.prettyPrint) {
                this.needsIndent = true;
            }
        }
    }

    /**
     * Pretty print용 들여쓰기를 적용합니다.
     * @private
     */
    private _writeIndent(): void {
        if (this.options.prettyPrint && this.needsIndent && this.writer) {
            try {
                this.writer.write('\n');
                this.writer.write(this.options.indentString.repeat(this.currentIndentLevel));
                this.needsIndent = false;
            } catch (err) {
                this.state = WriterState.ERROR;
                throw new Error(`StaxXmlWriter: Error writing indent: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }

    /**
     * Pretty print용 줄바꿈을 추가합니다.
     * @private
     */
    private _writeNewline(): void {
        if (this.options.prettyPrint && this.writer) {
            try {
                this.writer.write('\n');
                this.needsIndent = true;
            } catch (err) {
                this.state = WriterState.ERROR;
                throw new Error(`StaxXmlWriter: Error writing newline: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }

    /**
     * 문자열을 출력 스트림에 씁니다.
     * @param chunk 작성할 문자열
     * @private
     */
    private _write(chunk: string): void {
        if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) return;
        if (!this.writer) return;
        try {
            this.writer.write(chunk);
        } catch (err) {
            this.state = WriterState.ERROR;
            throw new Error(`StaxXmlWriter: Error writing chunk: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /**
     * XML 텍스트를 이스케이프합니다.
     * @param text 이스케이프할 텍스트
     * @returns 이스케이프된 텍스트
     * @private
     */
    private _escapeXml(text: string): string {
        if (!text) {
            return ''; // 빈 문자열은 그대로 반환
        }
        if (!this.options.autoEncodeEntities) {
            return text; // 자동 엔티티 인코딩이 비활성화된 경우 원본 텍스트 반환
        }
        let entityMap: Record<string, string> = {
            '&': '&amp;',
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
        // entityMap의 key를 정규식으로 변환하여 이스케이프 처를
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

export default StaxXmlWriter;