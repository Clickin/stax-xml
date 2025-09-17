// StaxXmlParserSync.ts - XmlEventFactory를 사용한 최적화 버전

import {
  AnyXmlEvent,
  AttributeInfo,
  XmlEventFactory
} from './types';

export interface StaxXmlParserSyncOptions {
  autoDecodeEntities?: boolean;
  addEntities?: { entity: string, value: string }[];
}

export class StaxXmlParserSync implements Iterable<AnyXmlEvent> {
  private readonly xml: string;
  private readonly xmlLength: number;
  private pos: number = 0;
  private readonly elementStack: string[] = [];
  private namespaceStack: Map<string, string>[] = [];
  private readonly options: StaxXmlParserSyncOptions;

  // ===== 정적 최적화 테이블 및 캐시 =====

  // ASCII 문자 빠른 분류 테이블 (0-127)
  private static readonly ASCII_TABLE = (() => {
    const table = new Uint8Array(128);
    // 공백 문자들: 1
    table[9] = 1;   // TAB
    table[10] = 1;  // LF
    table[13] = 1;  // CR
    table[32] = 1;  // SPACE
    // XML 특수 문자들
    table[60] = 2;  // '<'
    table[62] = 3;  // '>'
    table[47] = 4;  // '/'
    table[61] = 5;  // '='
    table[33] = 6;  // '!'
    table[63] = 7;  // '?'
    table[34] = 8;  // '"'
    table[39] = 9;  // "'"
    return table;
  })();

  // 다국어 공백 문자 Set (빠른 조회)
  private static readonly UNICODE_WHITESPACE = new Set([
    0x00A0, // Non-breaking space
    0x1680, // Ogham space
    0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, // Various spaces
    0x2028, // Line separator
    0x2029, // Paragraph separator
    0x202F, // Narrow no-break space
    0x205F, // Medium mathematical space
    0x3000, // CJK ideographic space
    0xFEFF  // Zero-width no-break space
  ]);

  // 엔티티 정규식 캐시
  private static readonly ENTITY_REGEX_CACHE = new Map<string, RegExp>();
  private static readonly DEFAULT_ENTITY_REGEX = /&(lt|gt|quot|apos|amp);/g;
  private static readonly DEFAULT_ENTITY_MAP: Record<string, string> = {
    'lt': '<', 'gt': '>', 'quot': '"', 'apos': "'", 'amp': '&'
  };

  // 컴파일된 엔티티 디코더 (인스턴스별 캐싱)
  private readonly entityDecoder: (text: string) => string;

  constructor(xml: string, options: StaxXmlParserSyncOptions = {}) {
    this.xml = xml;
    this.xmlLength = xml.length;
    this.options = {
      autoDecodeEntities: true,
      ...options
    };

    this.namespaceStack.push(new Map<string, string>());

    // 엔티티 디코더 사전 컴파일
    this.entityDecoder = this.compileEntityDecoder();
  }

  // ===== 헬퍼 메서드: 문자 분류 =====

  private static isWhitespace(code: number): boolean {
    if (code < 128) {
      return StaxXmlParserSync.ASCII_TABLE[code] === 1;
    }
    return code <= 32 || StaxXmlParserSync.UNICODE_WHITESPACE.has(code);
  }

  // ===== 헬퍼 메서드: 서로게이트 페어 처리 =====

  private static isHighSurrogate(code: number): boolean {
    return code >= 0xD800 && code <= 0xDBFF;
  }

  private static isLowSurrogate(code: number): boolean {
    return code >= 0xDC00 && code <= 0xDFFF;
  }

  // ===== 최적화된 문자열 처리 =====

  // indexOf 대체 - 빠른 문자 검색
  private findChar(targetCode: number, start: number = this.pos): number {
    const xml = this.xml;
    const len = this.xmlLength;

    // 8바이트 언롤링으로 성능 향상
    const len8 = len - 7;
    let i = start;

    for (; i < len8; i += 8) {
      if (xml.charCodeAt(i) === targetCode) return i;
      if (xml.charCodeAt(i + 1) === targetCode) return i + 1;
      if (xml.charCodeAt(i + 2) === targetCode) return i + 2;
      if (xml.charCodeAt(i + 3) === targetCode) return i + 3;
      if (xml.charCodeAt(i + 4) === targetCode) return i + 4;
      if (xml.charCodeAt(i + 5) === targetCode) return i + 5;
      if (xml.charCodeAt(i + 6) === targetCode) return i + 6;
      if (xml.charCodeAt(i + 7) === targetCode) return i + 7;
    }

    for (; i < len; i++) {
      if (xml.charCodeAt(i) === targetCode) return i;
    }

    return -1;
  }

  // 빠른 문자열 검색 (startsWith 대체)
  private matchesAt(str: string, pos: number): boolean {
    const len = str.length;
    if (pos + len > this.xmlLength) return false;

    for (let i = 0; i < len; i++) {
      if (this.xml.charCodeAt(pos + i) !== str.charCodeAt(i)) {
        return false;
      }
    }
    return true;
  }

  // 인라인 trim (substring 회피)
  private trimmedSlice(start: number, end: number): string {
    const xml = this.xml;

    // 앞 공백 제거
    while (start < end && StaxXmlParserSync.isWhitespace(xml.charCodeAt(start))) {
      if (StaxXmlParserSync.isHighSurrogate(xml.charCodeAt(start))) {
        start += 2;
      } else {
        start++;
      }
    }

    // 뒤 공백 제거
    while (end > start && StaxXmlParserSync.isWhitespace(xml.charCodeAt(end - 1))) {
      // 서로게이트 페어 체크 (역방향)
      if (end > start + 1 &&
        StaxXmlParserSync.isLowSurrogate(xml.charCodeAt(end - 1)) &&
        StaxXmlParserSync.isHighSurrogate(xml.charCodeAt(end - 2))) {
        end -= 2;
      } else {
        end--;
      }
    }

    return start < end ? xml.slice(start, end) : '';
  }

  // ===== 엔티티 처리 최적화 =====

  private compileEntityDecoder(): (text: string) => string {
    if (!this.options.autoDecodeEntities) {
      return (text) => text;
    }

    // 사용자 정의 엔티티가 있는 경우
    if (this.options.addEntities && this.options.addEntities.length > 0) {
      const entityMap: Record<string, string> = { ...StaxXmlParserSync.DEFAULT_ENTITY_MAP };
      const patterns: string[] = ['lt', 'gt', 'quot', 'apos'];

      for (const { entity, value } of this.options.addEntities) {
        if (entity && value) {
          // &entity; 형식에서 entity 부분만 추출
          const key = entity.startsWith('&') && entity.endsWith(';')
            ? entity.slice(1, -1)
            : entity;
          entityMap[key] = value;
          patterns.push(key);
        }
      }
      patterns.push('amp'); // amp는 마지막에

      // 캐시 키 생성 및 정규식 캐싱
      const cacheKey = patterns.join(',');
      let regex = StaxXmlParserSync.ENTITY_REGEX_CACHE.get(cacheKey);

      if (!regex) {
        const pattern = patterns
          .sort((a, b) => b.length - a.length) // 긴 패턴 우선
          .map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|');
        regex = new RegExp(`&(${pattern});`, 'g');
        StaxXmlParserSync.ENTITY_REGEX_CACHE.set(cacheKey, regex);
      }

      return (text: string) => {
        if (!text || text.indexOf('&') === -1) return text;
        regex!.lastIndex = 0;
        return text.replace(regex!, (_, entity) => entityMap[entity] || _);
      };
    }

    // 기본 엔티티만 사용
    return (text: string) => {
      if (!text || text.indexOf('&') === -1) return text;
      StaxXmlParserSync.DEFAULT_ENTITY_REGEX.lastIndex = 0;
      return text.replace(
        StaxXmlParserSync.DEFAULT_ENTITY_REGEX,
        (_, entity) => StaxXmlParserSync.DEFAULT_ENTITY_MAP[entity] || _
      );
    };
  }

  // ===== 메인 파싱 로직 - EventFactory 사용 =====

  /**
   * Iterator 구현 - AnyXmlEvent를 yield
   * 중요: 반환 타입은 기존과 동일하게 Iterator<AnyXmlEvent>
   * Factory가 내부적으로 UnifiedXmlEvent를 생성하지만,
   * 타입은 StartElementEvent, EndElementEvent 등으로 반환되므로
   * AnyXmlEvent 유니온 타입에 완벽하게 호환됨
   */
  public *[Symbol.iterator](): Iterator<AnyXmlEvent> {
    // XmlEventFactory.startDocument()는 StartDocumentEvent 타입 반환
    // StartDocumentEvent는 AnyXmlEvent의 일부이므로 타입 호환
    yield XmlEventFactory.startDocument();

    while (this.pos < this.xmlLength) {
      const ltPos = this.findChar(60, this.pos); // '<' 찾기

      if (ltPos === -1) {
        // 남은 텍스트 처리
        if (this.pos < this.xmlLength) {
          const text = this.trimmedSlice(this.pos, this.xmlLength);
          if (text) {
            // XmlEventFactory.characters()는 CharactersEvent 타입 반환
            // CharactersEvent는 AnyXmlEvent의 일부
            yield XmlEventFactory.characters(this.entityDecoder(text));
          }
        }
        break;
      }

      // '<' 전의 텍스트 처리
      if (ltPos > this.pos) {
        const text = this.trimmedSlice(this.pos, ltPos);
        if (text) {
          yield XmlEventFactory.characters(this.entityDecoder(text));
        }
      }

      this.pos = ltPos;
      const nextCharCode = this.xml.charCodeAt(this.pos + 1);

      switch (nextCharCode) {
        case 47: // '/'
          yield* this.parseEndTag();
          break;
        case 33: // '!'
          yield* this.parseCdataCommentDoctype();
          break;
        case 63: // '?'
          yield* this.parseProcessingInstruction();
          break;
        default:
          yield* this.parseStartTag();
          break;
      }
    }

    yield XmlEventFactory.endDocument();
  }

  // ===== 태그 파싱 메서드 - EventFactory 사용 =====

  private *parseEndTag(): Generator<AnyXmlEvent> {
    const tagClose = this.findChar(62, this.pos); // '>'
    if (tagClose === -1) throw new Error('Unclosed end tag');

    const fullTagName = this.trimmedSlice(this.pos + 2, tagClose);

    if (this.elementStack.length === 0) {
      throw new Error(`Mismatched closing tag: </${fullTagName}>. No open elements.`);
    }

    const expectedTagName = this.elementStack[this.elementStack.length - 1];
    if (fullTagName !== expectedTagName) {
      throw new Error(`Mismatched closing tag: </${fullTagName}>. Expected </${expectedTagName}>.`);
    }

    this.elementStack.pop();
    const currentNamespaces = this.namespaceStack.pop();

    const { localName, prefix, uri } = this.parseQualifiedName(
      fullTagName,
      currentNamespaces || new Map(),
      false
    );

    // XmlEventFactory.endElement()는 EndElementEvent 타입 반환
    // EndElementEvent는 AnyXmlEvent의 일부
    yield XmlEventFactory.endElement(fullTagName, localName, prefix, uri);

    this.pos = tagClose + 1;
  }

  private *parseCdataCommentDoctype(): Generator<AnyXmlEvent> {
    if (this.matchesAt('<![CDATA[', this.pos)) {
      const cdataEnd = this.findSequence(']]>', this.pos + 9);
      if (cdataEnd === -1) throw new Error('Unclosed CDATA section');

      const cdataContent = this.xml.slice(this.pos + 9, cdataEnd);
      // XmlEventFactory.cdata()는 CdataEvent 타입 반환
      // CdataEvent는 AnyXmlEvent의 일부
      yield XmlEventFactory.cdata(cdataContent);

      this.pos = cdataEnd + 3;
    } else if (this.matchesAt('<!--', this.pos)) {
      const commentEnd = this.findSequence('-->', this.pos + 4);
      if (commentEnd === -1) throw new Error('Unclosed comment');
      this.pos = commentEnd + 3;
    } else if (this.matchesAt('<!DOCTYPE', this.pos)) {
      const doctypeEnd = this.findChar(62, this.pos); // '>'
      if (doctypeEnd === -1) throw new Error('Unclosed DOCTYPE declaration');
      this.pos = doctypeEnd + 1;
    }
  }

  private *parseProcessingInstruction(): Generator<AnyXmlEvent> {
    const piEnd = this.findSequence('?>', this.pos);
    if (piEnd === -1) throw new Error('Unclosed processing instruction');
    this.pos = piEnd + 2;
  }

  private *parseStartTag(): Generator<AnyXmlEvent> {
    const tagStart = this.pos + 1;
    const tagEnd = this.findTagEnd(tagStart);
    if (tagEnd === -1) throw new Error('Unclosed start tag');

    let isSelfClosing = false;
    let actualEnd = tagEnd;

    if (this.xml.charCodeAt(tagEnd - 1) === 47) { // '/'
      isSelfClosing = true;
      actualEnd = tagEnd - 1;
    }

    // 태그 이름과 속성 분리
    let nameEnd = tagStart;
    while (nameEnd < actualEnd) {
      const code = this.xml.charCodeAt(nameEnd);
      if (StaxXmlParserSync.isWhitespace(code) || code === 62 || code === 47) {
        break;
      }
      nameEnd++;
    }

    const tagName = this.xml.slice(tagStart, nameEnd);

    // 네임스페이스 컨텍스트 생성
    const currentNamespaces = new Map<string, string>();
    if (this.namespaceStack.length > 0) {
      const parentNamespaces = this.namespaceStack[this.namespaceStack.length - 1];
      for (const [prefix, uri] of parentNamespaces) {
        currentNamespaces.set(prefix, uri);
      }
    }

    // 속성 파싱 (인라인 최적화)
    const { attributes, attributesWithPrefix } = this.parseAttributesFast(
      nameEnd,
      actualEnd,
      currentNamespaces
    );

    const { localName, prefix, uri } = this.parseQualifiedName(
      tagName,
      currentNamespaces,
      false
    );

    // XmlEventFactory.startElement()는 StartElementEvent 타입 반환
    // StartElementEvent는 AnyXmlEvent의 일부
    yield XmlEventFactory.startElement(
      tagName,
      localName,
      prefix,
      uri,
      attributes,
      attributesWithPrefix
    );

    this.elementStack.push(tagName);

    if (!isSelfClosing) {
      this.namespaceStack.push(currentNamespaces);
    } else {
      yield XmlEventFactory.endElement(tagName, localName, prefix, uri);
      this.elementStack.pop();
    }

    this.pos = tagEnd + 1;
  }

  // ===== 속성 파싱 (최적화) =====

  private parseAttributesFast(
    start: number,
    end: number,
    namespaces: Map<string, string>
  ): {
    attributes: Record<string, string>,
    attributesWithPrefix: Record<string, AttributeInfo>
  } {
    const attributes: Record<string, string> = Object.create(null);
    const attributesWithPrefix: Record<string, AttributeInfo> = Object.create(null);

    let i = start;
    const xml = this.xml;

    while (i < end) {
      // 공백 스킵 (인라인으로 처리)
      while (i < end && StaxXmlParserSync.isWhitespace(xml.charCodeAt(i))) i++;
      if (i >= end) break;

      // 속성 이름 추출
      const nameStart = i;
      while (i < end) {
        const code = xml.charCodeAt(i);
        if (code === 61 || StaxXmlParserSync.isWhitespace(code)) break; // '=' or space
        i++;
      }

      if (i === nameStart) break;
      const attrName = xml.slice(nameStart, i);

      // '=' 찾기
      while (i < end && StaxXmlParserSync.isWhitespace(xml.charCodeAt(i))) i++;
      if (i >= end || xml.charCodeAt(i) !== 61) {
        // Boolean 속성
        attributes[attrName] = 'true';
        const { localName, prefix, uri } = this.parseQualifiedName(attrName, namespaces, true);
        attributesWithPrefix[attrName] = { value: 'true', localName, prefix, uri };
        continue;
      }

      i++; // '=' 건너뛰기

      // 따옴표 찾기
      while (i < end && StaxXmlParserSync.isWhitespace(xml.charCodeAt(i))) i++;
      if (i >= end) break;

      const quote = xml.charCodeAt(i);
      if (quote !== 34 && quote !== 39) break; // '"' or "'"

      i++;
      const valueStart = i;

      // 값 끝 찾기
      while (i < end && xml.charCodeAt(i) !== quote) i++;

      const rawValue = xml.slice(valueStart, i);
      const attrValue = this.entityDecoder(rawValue);
      attributes[attrName] = attrValue;

      // xmlns 처리
      if (attrName === 'xmlns') {
        namespaces.set('', attrValue);
      } else if (attrName.startsWith('xmlns:')) {
        namespaces.set(attrName.slice(6), attrValue);
      }

      const { localName, prefix, uri } = this.parseQualifiedName(attrName, namespaces, true);
      attributesWithPrefix[attrName] = {
        value: attrValue,
        localName: attrName.startsWith('xmlns') ? (attrName === 'xmlns' ? 'xmlns' : attrName.slice(6)) : localName,
        prefix: attrName.startsWith('xmlns:') ? 'xmlns' : prefix,
        uri
      };

      i++; // 닫는 따옴표 건너뛰기
    }

    return { attributes, attributesWithPrefix };
  }

  // ===== 유틸리티 메서드 =====

  private findTagEnd(start: number): number {
    let i = start;
    let inQuote = false;
    let quoteChar = 0;

    while (i < this.xmlLength) {
      const code = this.xml.charCodeAt(i);

      if (code === 34 || code === 39) { // '"' or "'"
        if (!inQuote) {
          inQuote = true;
          quoteChar = code;
        } else if (code === quoteChar) {
          inQuote = false;
          quoteChar = 0;
        }
      } else if (code === 62 && !inQuote) { // '>'
        return i;
      }
      i++;
    }
    return -1;
  }

  private findSequence(sequence: string, start: number): number {
    const seqLen = sequence.length;
    const maxPos = this.xmlLength - seqLen;

    for (let i = start; i <= maxPos; i++) {
      let match = true;
      for (let j = 0; j < seqLen; j++) {
        if (this.xml.charCodeAt(i + j) !== sequence.charCodeAt(j)) {
          match = false;
          break;
        }
      }
      if (match) return i;
    }
    return -1;
  }

  private parseQualifiedName(
    qname: string,
    namespaces: Map<string, string>,
    isAttribute: boolean = false
  ): { localName: string; prefix?: string; uri?: string; } {
    const colonIndex = qname.indexOf(':');

    if (colonIndex === -1) {
      if (isAttribute) {
        return { localName: qname, prefix: undefined, uri: undefined };
      } else {
        const defaultUri = namespaces.get('');
        return { localName: qname, prefix: undefined, uri: defaultUri };
      }
    } else {
      const prefix = qname.slice(0, colonIndex);
      const localName = qname.slice(colonIndex + 1);
      const uri = namespaces.get(prefix);
      return { localName, prefix, uri };
    }
  }
}