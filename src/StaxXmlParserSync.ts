// StaxXmlParserSync.ts

import {
  AnyXmlEvent,
  CharactersEvent,
  EndElementEvent,
  StartElementEvent,
  XmlEventType,
  CdataEvent,
  AttributeInfo
} from './types';

export interface StaxXmlParserSyncOptions {
  autoDecodeEntities?: boolean; // 자동 엔티티 디코딩 활성화 여부 (기본값: true)
  addEntities?: { entity: string, value: string }[]; // 사용자 정의 엔티티
}

/**
 * A synchronous, iterable XML parser that processes an entire XML string.
 *
 * This parser is designed for speed and is ideal for environments where the entire
 * XML document is already in memory, such as in web servers handling small to
 * medium-sized XML payloads. It avoids the overhead of asynchronous streams.
 *
 * It implements the `Iterable<AnyXmlEvent>` interface, allowing you to use it
 * directly in `for...of` loops.
 *
 * @example
 * ```typescript
 * const xml = '<root><item>Hello</item></root>';
 * const parser = new StaxXmlParserSync(xml);
 * for (const event of parser) {
 *   if (event.type === XmlEventType.START_ELEMENT) {
 *     console.log(`Start Element: ${event.name}`);
 *   }
 * }
 * ```
 */
export class StaxXmlParserSync implements Iterable<AnyXmlEvent> {
  private readonly xml: string;
  private pos: number = 0;
  private readonly elementStack: string[] = [];
  private namespaceStack: Map<string, string>[] = []; // 네임스페이스 매핑 스택
  private options: StaxXmlParserSyncOptions;

  private readonly xmlnsRegex: RegExp;
  private readonly attrRegex: RegExp;

  constructor(xml: string, options: StaxXmlParserSyncOptions = {}) {
    this.xml = xml;
    this.options = {
      autoDecodeEntities: true,
      ...options
    };
    // Initialize with a default empty namespace map for the root scope
    this.namespaceStack.push(new Map<string, string>());

    // Initialize regexes once in the constructor
    this.xmlnsRegex = /(xmlns(?::([a-zA-Z0-9_.-]+))?)="([^"]*)"/g;
    this.attrRegex = /([a-zA-Z0-9_:.-]+)(?:\s*=\s*"([^"]*)")?/g;
  }

  public *[Symbol.iterator](): Iterator<AnyXmlEvent> {
    yield { type: XmlEventType.START_DOCUMENT };

    while (this.pos < this.xml.length) {
      const nextTagOpen = this.xml.indexOf('<', this.pos);

      // Handle text content before the next tag
      if (nextTagOpen === -1) { // No more tags, remaining is text
        const text = this.xml.substring(this.pos);
        if (text.trim().length > 0) {
          yield { type: XmlEventType.CHARACTERS, value: this._unescapeXml(text.trim()) } as CharactersEvent;
        }
        this.pos = this.xml.length;
        break;
      }

      if (nextTagOpen > this.pos) { // Text content exists before the next tag
        const text = this.xml.substring(this.pos, nextTagOpen);
        if (text.trim().length > 0) {
          yield { type: XmlEventType.CHARACTERS, value: this._unescapeXml(text.trim()) } as CharactersEvent;
        }
      }

      this.pos = nextTagOpen; // Move position to the '<' character

      // Now parse the tag itself
      const charAfterAngle = this.xml[this.pos + 1];

      switch (charAfterAngle) {
        case '/': // End tag: </tag>
          yield* this._parseEndTag();
          break;
        case '!': // CDATA, Comment, DOCTYPE
          yield* this._parseCdataCommentDoctype();
          break;
        case '?': // Processing Instruction: <?tag ...?>
          yield* this._parseProcessingInstruction();
          break;
        default: // Start tag: <tag attr="val"> or <tag/>
          yield* this._parseStartTag();
          break;
      }
    }

    yield { type: XmlEventType.END_DOCUMENT };
  }

  private *_parseEndTag(): Generator<AnyXmlEvent> {
    const tagClose = this.xml.indexOf('>', this.pos);
    if (tagClose === -1) throw new Error('Unclosed end tag');
    const fullTagName = this.xml.substring(this.pos + 2, tagClose).trim();

    if (this.elementStack.length === 0) {
      throw new Error(`Mismatched closing tag: </${fullTagName}>. No open elements.`);
    }

    const expectedTagName = this.elementStack[this.elementStack.length - 1];
    if (fullTagName !== expectedTagName) {
      throw new Error(`Mismatched closing tag: </${fullTagName}>. Expected </${expectedTagName}>.`);
    }

    this.elementStack.pop();
    const currentNamespaces = this.namespaceStack.pop(); // Pop the namespace scope

    const { localName, prefix, uri } = this._parseQualifiedName(fullTagName, currentNamespaces || new Map(), false); // Use the popped namespace map

    yield { type: XmlEventType.END_ELEMENT, name: fullTagName, localName, prefix, uri } as EndElementEvent;
    this.pos = tagClose + 1;
  }

  private *_parseCdataCommentDoctype(): Generator<AnyXmlEvent> {
    if (this.xml.startsWith('<![CDATA[', this.pos)) { // CDATA
      const cdataEnd = this.xml.indexOf(']]>', this.pos);
      if (cdataEnd === -1) throw new Error('Unclosed CDATA section');
      const cdataContent = this.xml.substring(this.pos + 9, cdataEnd);
      yield { type: XmlEventType.CDATA, value: cdataContent } as CdataEvent;
      this.pos = cdataEnd + 3;
    } else if (this.xml.startsWith('<!--', this.pos)) { // Comment
      const commentEnd = this.xml.indexOf('-->', this.pos);
      if (commentEnd === -1) throw new Error('Unclosed comment');
      this.pos = commentEnd + 3;
    } else if (this.xml.startsWith('<!DOCTYPE', this.pos)) { // DOCTYPE
      const doctypeEnd = this.xml.indexOf('>', this.pos);
      if (doctypeEnd === -1) throw new Error('Unclosed DOCTYPE declaration');
      this.pos = doctypeEnd + 1;
    }
  }

  private *_parseProcessingInstruction(): Generator<AnyXmlEvent> {
    const piEnd = this.xml.indexOf('?>', this.pos);
    if (piEnd === -1) throw new Error('Unclosed processing instruction');
    this.pos = piEnd + 2;
  }

  private *_parseStartTag(): Generator<AnyXmlEvent> {
    const tagClose = this._findTagEnd(this.pos + 1); // Start searching after '<'
    if (tagClose === -1) throw new Error('Unclosed start tag');

    const tagContent = this.xml.substring(this.pos + 1, tagClose);

    let tagName: string;
    let attributes: { [key: string]: string } = {};
    let attributesWithPrefix: { [key: string]: AttributeInfo } = {};
    let isSelfClosing = false;

    // Create a new namespace scope for this element
    const currentNamespaces = new Map<string, string>();
    if (this.namespaceStack.length > 0) {
      // Inherit parent's namespaces
      const parentNamespaces = this.namespaceStack[this.namespaceStack.length - 1];
      for (const [prefix, uri] of parentNamespaces) {
        currentNamespaces.set(prefix, uri);
      }
    }

    // Extract raw tag name and attribute string
    let rawTagName: string;
    let rawAttrStr: string = '';

    if (tagContent.endsWith('/')) {
      isSelfClosing = true;
      const actualTagContent = tagContent.substring(0, tagContent.length - 1).trim();
      const spaceIndex = actualTagContent.indexOf(' ');
      if (spaceIndex === -1) {
        rawTagName = actualTagContent;
      } else {
        rawTagName = actualTagContent.substring(0, spaceIndex);
        rawAttrStr = actualTagContent.substring(spaceIndex + 1);
      }
    } else {
      const spaceIndex = tagContent.indexOf(' ');
      if (spaceIndex === -1) {
        rawTagName = tagContent;
      } else {
        rawTagName = tagContent.substring(0, spaceIndex);
        rawAttrStr = tagContent.substring(spaceIndex + 1);
      }
    }

    // First pass: Process xmlns attributes to update currentNamespaces
    // Reset regex lastIndex before using it in a loop
    this.xmlnsRegex.lastIndex = 0;
    let match;
    while ((match = this.xmlnsRegex.exec(rawAttrStr)) !== null) {
      const fullAttr = match[1];
      const prefix = match[2];
      const uri = match[3];
      if (prefix) {
        currentNamespaces.set(prefix, uri);
      } else {
        currentNamespaces.set('', uri);
      }
      // Also add to simple attributes for output
      attributes[fullAttr] = uri;
      attributesWithPrefix[fullAttr] = { value: uri, localName: prefix || 'xmlns', prefix: prefix ? 'xmlns' : undefined, uri: undefined };
    }

    // Second pass: Parse all other attributes and resolve their namespaces
    // Reset regex lastIndex before using it in a loop
    this.attrRegex.lastIndex = 0;
    let attrMatch;
    while ((attrMatch = this.attrRegex.exec(rawAttrStr)) !== null) {
      const fullAttrName = attrMatch[1];
      // Skip xmlns attributes as they were handled in the first pass
      if (fullAttrName.startsWith('xmlns')) continue;

      const attrValue = attrMatch[2] ? this._unescapeXml(attrMatch[2]) : 'true'; // Default to 'true' for boolean attributes
      attributes[fullAttrName] = attrValue;

      const { localName, prefix, uri } = this._parseQualifiedName(fullAttrName, currentNamespaces, true);
      attributesWithPrefix[fullAttrName] = { value: attrValue, localName, prefix, uri };
    }

    // Parse element's qualified name using the updated currentNamespaces
    const { localName, prefix, uri } = this._parseQualifiedName(rawTagName, currentNamespaces, false);

    yield { type: XmlEventType.START_ELEMENT, name: rawTagName, localName, prefix, uri, attributes, attributesWithPrefix } as StartElementEvent;
    this.elementStack.push(rawTagName);

    if (!isSelfClosing) {
      this.namespaceStack.push(currentNamespaces); // Push the new namespace scope onto the stack
    } else {
      // For self-closing tags, immediately yield END_ELEMENT and pop from elementStack
      yield { type: XmlEventType.END_ELEMENT, name: rawTagName, localName, prefix, uri } as EndElementEvent;
      this.elementStack.pop(); // Pop the element name for self-closing tags
    }
    this.pos = tagClose + 1;
  }

  private _findTagEnd(startIndex: number): number {
    let i = startIndex;
    let inQuote = false;
    let quoteChar = '';

    while (i < this.xml.length) {
      const char = this.xml[i];
      if (char === '\'' || char === '"') {
        if (!inQuote) {
          inQuote = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuote = false;
          quoteChar = '';
        }
      } else if (char === '>' && !inQuote) {
        return i; // Found the end of the tag
      }
      i++;
    }
    return -1; // Not found
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
}
