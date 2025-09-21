// StaxXmlParserSync.ts - Optimized version using XmlEventFactory

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

  // ===== Static optimization tables and caches =====

  // ASCII character fast classification table (0-127)
  private static readonly ASCII_TABLE = (() => {
    const table = new Uint8Array(128);
    // Whitespace characters: 1
    table[9] = 1;   // TAB
    table[10] = 1;  // LF
    table[13] = 1;  // CR
    table[32] = 1;  // SPACE
    // XML special characters
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

  // Multilingual whitespace character Set (fast lookup)
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

  // Entity regex cache
  private static readonly ENTITY_REGEX_CACHE = new Map<string, RegExp>();
  private static readonly DEFAULT_ENTITY_REGEX = /&(lt|gt|quot|apos|amp);/g;
  private static readonly DEFAULT_ENTITY_MAP: Record<string, string> = {
    'lt': '<', 'gt': '>', 'quot': '"', 'apos': "'", 'amp': '&'
  };

  // Compiled entity decoder (per-instance caching)
  private readonly entityDecoder: (text: string) => string;

  constructor(xml: string, options: StaxXmlParserSyncOptions = {}) {
    this.xml = xml;
    this.xmlLength = xml.length;
    this.options = {
      autoDecodeEntities: true,
      ...options
    };

    this.namespaceStack.push(new Map<string, string>());

    // Pre-compile entity decoder
    this.entityDecoder = this.compileEntityDecoder();
  }

  // ===== Helper methods: character classification =====

  private static isWhitespace(code: number): boolean {
    if (code < 128) {
      return StaxXmlParserSync.ASCII_TABLE[code] === 1;
    }
    return code <= 32 || StaxXmlParserSync.UNICODE_WHITESPACE.has(code);
  }

  // ===== Helper methods: surrogate pair handling =====

  private static isHighSurrogate(code: number): boolean {
    return code >= 0xD800 && code <= 0xDBFF;
  }

  private static isLowSurrogate(code: number): boolean {
    return code >= 0xDC00 && code <= 0xDFFF;
  }

  // ===== Optimized string processing =====

  // indexOf replacement - fast character search (16-byte unrolling)
  private findChar(targetCode: number, start: number = this.pos): number {
    const xml = this.xml;
    const len = this.xmlLength;

    // Performance improvement with 16-byte unrolling
    const len16 = len - 15;
    let i = start;

    // 16-byte unrolling loop
    for (; i < len16; i += 16) {
      if (xml.charCodeAt(i) === targetCode) return i;
      if (xml.charCodeAt(i + 1) === targetCode) return i + 1;
      if (xml.charCodeAt(i + 2) === targetCode) return i + 2;
      if (xml.charCodeAt(i + 3) === targetCode) return i + 3;
      if (xml.charCodeAt(i + 4) === targetCode) return i + 4;
      if (xml.charCodeAt(i + 5) === targetCode) return i + 5;
      if (xml.charCodeAt(i + 6) === targetCode) return i + 6;
      if (xml.charCodeAt(i + 7) === targetCode) return i + 7;
      if (xml.charCodeAt(i + 8) === targetCode) return i + 8;
      if (xml.charCodeAt(i + 9) === targetCode) return i + 9;
      if (xml.charCodeAt(i + 10) === targetCode) return i + 10;
      if (xml.charCodeAt(i + 11) === targetCode) return i + 11;
      if (xml.charCodeAt(i + 12) === targetCode) return i + 12;
      if (xml.charCodeAt(i + 13) === targetCode) return i + 13;
      if (xml.charCodeAt(i + 14) === targetCode) return i + 14;
      if (xml.charCodeAt(i + 15) === targetCode) return i + 15;
    }

    // Handle remaining bytes
    for (; i < len; i++) {
      if (xml.charCodeAt(i) === targetCode) return i;
    }

    return -1;
  }

  // Fast string search (startsWith replacement)
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

  // Inline trim (avoid substring)
  private trimmedSlice(start: number, end: number): string {
    const xml = this.xml;

    // Remove leading whitespace
    while (start < end && StaxXmlParserSync.isWhitespace(xml.charCodeAt(start))) {
      if (StaxXmlParserSync.isHighSurrogate(xml.charCodeAt(start))) {
        start += 2;
      } else {
        start++;
      }
    }

    // Remove trailing whitespace
    while (end > start && StaxXmlParserSync.isWhitespace(xml.charCodeAt(end - 1))) {
      // Surrogate pair check (reverse direction)
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

  // ===== Entity processing optimization =====

  private compileEntityDecoder(): (text: string) => string {
    if (!this.options.autoDecodeEntities) {
      return (text) => text;
    }

    // If custom entities exist
    if (this.options.addEntities && this.options.addEntities.length > 0) {
      const entityMap: Record<string, string> = { ...StaxXmlParserSync.DEFAULT_ENTITY_MAP };
      const patterns: string[] = ['lt', 'gt', 'quot', 'apos'];

      for (const { entity, value } of this.options.addEntities) {
        if (entity && value) {
          // Extract only entity part from &entity; format
          const key = entity.startsWith('&') && entity.endsWith(';')
            ? entity.slice(1, -1)
            : entity;
          entityMap[key] = value;
          patterns.push(key);
        }
      }
      patterns.push('amp'); // amp goes last

      // Generate cache key and regex caching
      const cacheKey = patterns.join(',');
      let regex = StaxXmlParserSync.ENTITY_REGEX_CACHE.get(cacheKey);

      if (!regex) {
        const pattern = patterns
          .sort((a, b) => b.length - a.length) // Longer patterns first
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

    // Use only default entities
    return (text: string) => {
      if (!text || text.indexOf('&') === -1) return text;
      StaxXmlParserSync.DEFAULT_ENTITY_REGEX.lastIndex = 0;
      return text.replace(
        StaxXmlParserSync.DEFAULT_ENTITY_REGEX,
        (_, entity) => StaxXmlParserSync.DEFAULT_ENTITY_MAP[entity] || _
      );
    };
  }

  // ===== Main parsing logic - using EventFactory =====

  /**
   * Iterator implementation - yields AnyXmlEvent
   * Important: Return type is same as before - Iterator<AnyXmlEvent>
   * Factory internally creates UnifiedXmlEvent, but
   * types are returned as StartElementEvent, EndElementEvent etc. so
   * perfectly compatible with AnyXmlEvent union type
   */
  public *[Symbol.iterator](): Iterator<AnyXmlEvent> {
    // XmlEventFactory.startDocument() returns StartDocumentEvent type
    // StartDocumentEvent is part of AnyXmlEvent so type compatible
    yield XmlEventFactory.startDocument();

    while (this.pos < this.xmlLength) {
      const ltPos = this.findChar(60, this.pos); // Find '<'

      if (ltPos === -1) {
        // Process remaining text
        if (this.pos < this.xmlLength) {
          const text = this.trimmedSlice(this.pos, this.xmlLength);
          if (text) {
            // XmlEventFactory.characters() returns CharactersEvent type
            // CharactersEvent is part of AnyXmlEvent
            yield XmlEventFactory.characters(this.entityDecoder(text));
          }
        }
        break;
      }

      // Process text before '<'
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

  // ===== Tag parsing methods - using EventFactory =====

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

    // Inline QName parsing (for end tag) - optimized
    const colonIndex = fullTagName.indexOf(':');
    let localName: string, prefix: string | undefined, uri: string | undefined;

    if (colonIndex === -1) {
      localName = fullTagName;
      prefix = undefined;
      uri = currentNamespaces ? currentNamespaces.get('') : undefined;
    } else {
      prefix = fullTagName.slice(0, colonIndex);
      localName = fullTagName.slice(colonIndex + 1);
      uri = currentNamespaces ? currentNamespaces.get(prefix) : undefined;
    }

    // XmlEventFactory.endElement() returns EndElementEvent type
    // EndElementEvent is part of AnyXmlEvent
    yield XmlEventFactory.endElement(fullTagName, localName, prefix, uri);

    this.pos = tagClose + 1;
  }

  private *parseCdataCommentDoctype(): Generator<AnyXmlEvent> {
    if (this.matchesAt('<![CDATA[', this.pos)) {
      const cdataEnd = this.findSequence(']]>', this.pos + 9);
      if (cdataEnd === -1) throw new Error('Unclosed CDATA section');

      const cdataContent = this.xml.slice(this.pos + 9, cdataEnd);
      // XmlEventFactory.cdata() returns CdataEvent type
      // CdataEvent is part of AnyXmlEvent
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

    // Separate tag name and attributes (optimized)
    let nameEnd = tagStart;
    const xml = this.xml;

    // Fast tag name search (find whitespace, '>', '/')
    while (nameEnd < actualEnd) {
      const code = xml.charCodeAt(nameEnd);
      // Fast branching for ASCII range
      if (code <= 32) {
        if (StaxXmlParserSync.isWhitespace(code)) break;
      } else if (code === 62 || code === 47) { // '>' or '/'
        break;
      }
      nameEnd++;
    }

    const tagName = xml.slice(tagStart, nameEnd);

    // Create namespace context
    const currentNamespaces = new Map<string, string>();
    if (this.namespaceStack.length > 0) {
      const parentNamespaces = this.namespaceStack[this.namespaceStack.length - 1];
      for (const [prefix, uri] of parentNamespaces) {
        currentNamespaces.set(prefix, uri);
      }
    }

    // Attribute parsing (inline optimization)
    const { attributes, attributesWithPrefix } = this.parseAttributesFast(
      nameEnd,
      actualEnd,
      currentNamespaces
    );

    // Inline QName parsing (for tag name) - optimized
    const colonIndex = tagName.indexOf(':');
    let localName: string, prefix: string | undefined, uri: string | undefined;

    if (colonIndex === -1) {
      localName = tagName;
      prefix = undefined;
      uri = currentNamespaces.get('');
    } else {
      prefix = tagName.slice(0, colonIndex);
      localName = tagName.slice(colonIndex + 1);
      uri = currentNamespaces.get(prefix);
    }

    // XmlEventFactory.startElement() returns StartElementEvent type
    // StartElementEvent is part of AnyXmlEvent
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

  // ===== Attribute parsing (optimized) =====

  private parseAttributesFast(
    start: number,
    end: number,
    namespaces: Map<string, string>
  ): {
    attributes: Record<string, string>,
    attributesWithPrefix: Record<string, AttributeInfo>
  } {
    // Fast path: when there are no attributes
    if (start >= end) {
      return {
        attributes: {},
        attributesWithPrefix: {}
      };
    }

    const attributes: Record<string, string> = {};
    const attributesWithPrefix: Record<string, AttributeInfo> = {};

    let i = start;
    const xml = this.xml;

    while (i < end) {
      // Skip whitespace (handled inline)
      while (i < end && StaxXmlParserSync.isWhitespace(xml.charCodeAt(i))) i++;
      if (i >= end) break;

      // Extract attribute name
      const nameStart = i;
      while (i < end) {
        const code = xml.charCodeAt(i);
        if (code === 61 || StaxXmlParserSync.isWhitespace(code)) break; // '=' or space
        i++;
      }

      if (i === nameStart) break;
      const attrName = xml.slice(nameStart, i);

      // Find '='
      while (i < end && StaxXmlParserSync.isWhitespace(xml.charCodeAt(i))) i++;
      if (i >= end || xml.charCodeAt(i) !== 61) {
        // Boolean attribute - parseQualifiedName inline processing
        attributes[attrName] = 'true';

        // Inline QName parsing (for attributes)
        const colonIndex = attrName.indexOf(':');
        let localName: string, prefix: string | undefined, uri: string | undefined;

        if (colonIndex === -1) {
          localName = attrName;
          prefix = undefined;
          uri = undefined;
        } else {
          prefix = attrName.slice(0, colonIndex);
          localName = attrName.slice(colonIndex + 1);
          uri = namespaces.get(prefix);
        }

        attributesWithPrefix[attrName] = { value: 'true', localName, prefix, uri };
        continue;
      }

      i++; // Skip '='

      // Find quotes
      while (i < end && StaxXmlParserSync.isWhitespace(xml.charCodeAt(i))) i++;
      if (i >= end) break;

      const quote = xml.charCodeAt(i);
      if (quote !== 34 && quote !== 39) break; // '"' or "'"

      i++;
      const valueStart = i;

      // Find end of value
      while (i < end && xml.charCodeAt(i) !== quote) i++;

      const rawValue = xml.slice(valueStart, i);
      const attrValue = this.entityDecoder(rawValue);
      attributes[attrName] = attrValue;

      // Handle xmlns
      if (attrName === 'xmlns') {
        namespaces.set('', attrValue);
      } else if (attrName.startsWith('xmlns:')) {
        namespaces.set(attrName.slice(6), attrValue);
      }

      // Inline QName parsing (for attributes) - optimized
      const colonIndex = attrName.indexOf(':');
      let localName: string, prefix: string | undefined, uri: string | undefined;

      if (colonIndex === -1) {
        localName = attrName;
        prefix = undefined;
        uri = undefined;
      } else {
        prefix = attrName.slice(0, colonIndex);
        localName = attrName.slice(colonIndex + 1);
        uri = namespaces.get(prefix);
      }

      // Special handling for xmlns attributes
      if (attrName.startsWith('xmlns')) {
        if (attrName === 'xmlns') {
          localName = 'xmlns';
          prefix = undefined;
        } else {
          localName = attrName.slice(6);
          prefix = 'xmlns';
        }
      }

      attributesWithPrefix[attrName] = {
        value: attrValue,
        localName,
        prefix,
        uri
      };

      i++; // Skip closing quote
    }

    return { attributes, attributesWithPrefix };
  }

  // ===== Utility methods =====

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

}