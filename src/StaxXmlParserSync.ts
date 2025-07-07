// StaxXmlParserSync.ts

import {
  AnyXmlEvent,
  CharactersEvent,
  EndElementEvent,
  StartElementEvent,
  XmlEventType,
  CdataEvent
} from './types';

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

  constructor(xml: string) {
    this.xml = xml;
  }

  public *[Symbol.iterator](): Iterator<AnyXmlEvent> {
    yield { type: XmlEventType.START_DOCUMENT };

    while (this.pos < this.xml.length) {
      const nextTagOpen = this.xml.indexOf('<', this.pos);

      // Handle text content before the next tag
      if (nextTagOpen === -1) { // No more tags, remaining is text
        const text = this.xml.substring(this.pos);
        if (text.trim().length > 0) {
          yield { type: XmlEventType.CHARACTERS, value: text.trim() } as CharactersEvent;
        }
        this.pos = this.xml.length;
        break;
      }

      if (nextTagOpen > this.pos) { // Text content exists before the next tag
        const text = this.xml.substring(this.pos, nextTagOpen);
        if (text.trim().length > 0) {
          yield { type: XmlEventType.CHARACTERS, value: text.trim() } as CharactersEvent;
        }
      }

      this.pos = nextTagOpen; // Move position to the '<' character

      // Now parse the tag itself
      const charAfterAngle = this.xml[this.pos + 1];

      if (charAfterAngle === '/') { // End tag: </tag>
        const tagClose = this.xml.indexOf('>', this.pos);
        if (tagClose === -1) throw new Error('Unclosed end tag');
        const fullTagName = this.xml.substring(this.pos + 2, tagClose).trim();
        yield { type: XmlEventType.END_ELEMENT, name: fullTagName } as EndElementEvent;
        this.elementStack.pop();
        this.pos = tagClose + 1;
      } else if (charAfterAngle === '!') { // CDATA, Comment, DOCTYPE
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
        } else {
          // Fallback for unknown <! declarations, try to find next >
          const unknownDeclEnd = this.xml.indexOf('>', this.pos);
          if (unknownDeclEnd === -1) throw new Error(`Unclosed unknown XML declaration: ${this.xml.substring(this.pos, this.pos + 50)}`);
          this.pos = unknownDeclEnd + 1;
        }
      } else if (charAfterAngle === '?') { // Processing Instruction: <?tag ...?>
        const piEnd = this.xml.indexOf('?>', this.pos);
        if (piEnd === -1) throw new Error('Unclosed processing instruction');
        this.pos = piEnd + 2;
      } else { // Start tag: <tag attr="val"> or <tag/>
        const tagClose = this._findTagEnd(this.pos + 1); // Start searching after '<'
        if (tagClose === -1) throw new Error('Unclosed start tag');

        const tagContent = this.xml.substring(this.pos + 1, tagClose);

        let tagName: string;
        let attributes: { [key: string]: string } = {};
        let isSelfClosing = false;

        if (tagContent.endsWith('/')) {
          isSelfClosing = true;
          const actualTagContent = tagContent.substring(0, tagContent.length - 1).trim();
          const spaceIndex = actualTagContent.indexOf(' ');
          if (spaceIndex === -1) {
            tagName = actualTagContent;
          } else {
            tagName = actualTagContent.substring(0, spaceIndex);
            attributes = this.parseAttributes(actualTagContent.substring(spaceIndex + 1));
          }
        } else {
          const spaceIndex = tagContent.indexOf(' ');
          if (spaceIndex === -1) {
            tagName = tagContent;
          } else {
            tagName = tagContent.substring(0, spaceIndex);
            attributes = this.parseAttributes(tagContent.substring(spaceIndex + 1));
          }
        }

        yield { type: XmlEventType.START_ELEMENT, name: tagName, attributes } as StartElementEvent;
        this.elementStack.push(tagName);

        if (isSelfClosing) {
          yield { type: XmlEventType.END_ELEMENT, name: tagName } as EndElementEvent;
          this.elementStack.pop();
        }
        this.pos = tagClose + 1;
      }
    }

    yield { type: XmlEventType.END_DOCUMENT };
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

  private parseAttributes(attrStr: string): { [key: string]: string } {
    const attributes: { [key: string]: string } = {};
    let i = 0;
    while (i < attrStr.length) {
      // Skip leading whitespace
      while (i < attrStr.length && /\s/.test(attrStr[i])) {
        i++;
      }
      if (i >= attrStr.length) break;

      // Read attribute name
      let nameStart = i;
      while (i < attrStr.length && attrStr[i] !== '=' && !/\s/.test(attrStr[i])) {
        i++;
      }
      const name = attrStr.substring(nameStart, i);

      // Skip whitespace after name
      while (i < attrStr.length && /\s/.test(attrStr[i])) {
        i++;
      }

      if (i < attrStr.length && attrStr[i] === '=') {
        i++; // Skip '='
        // Skip whitespace after '='
        while (i < attrStr.length && /\s/.test(attrStr[i])) {
          i++;
        }

        let value: string;
        if (i < attrStr.length && (attrStr[i] === '\'' || attrStr[i] === '"')) {
          const quoteChar = attrStr[i];
          i++; // Skip opening quote
          const valueStart = i;
          while (i < attrStr.length && attrStr[i] !== quoteChar) {
            i++;
          }
          value = attrStr.substring(valueStart, i);
          i++; // Skip closing quote
        } else {
          // Unquoted attribute value (less common, but possible)
          // Read until next whitespace or end of string
          const valueStart = i;
          while (i < attrStr.length && !/\s/.test(attrStr[i])) {
            i++;
          }
          value = attrStr.substring(valueStart, i);
        }
        attributes[name] = value;
      } else {
        // Boolean attribute (e.g., <tag checked>)
        attributes[name] = 'true';
      }
    }
    return attributes;
  }
}