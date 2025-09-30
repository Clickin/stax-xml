import { XmlSchema, type ParseInput } from './XmlSchema.js';
import { XmlParserInternal } from './XmlParserInternal.js';
import type { ParseOptions, XmlStringOptions } from './types.js';
import { isCharacters, isCdata, isEndElement, isStartElement, type AnyXmlEvent, type StartElementEvent } from '../types.js';

/**
 * Schema for parsing XML string values
 *
 * @public
 */
export class XmlStringSchema extends XmlSchema<string, string> {
  constructor(public options: XmlStringOptions = {}) {
    super();
  }

  _parse(input: ParseInput, parseOptions?: ParseOptions): string {
    const parser = new XmlParserInternal(parseOptions);
    return parser.parseString(input as string, this.options);
  }

  async _parseAsync(input: ParseInput, parseOptions?: ParseOptions): Promise<string> {
    const parser = new XmlParserInternal(parseOptions);
    return parser.parseStringAsync(input, this.options);
  }

  _parseText(text: string): string {
    return text;
  }

  /**
   * Parse from current iterator position
   * @internal
   */
  _parseFromPosition(
    iterator: Iterator<AnyXmlEvent> | AsyncIterator<AnyXmlEvent>,
    startEvent: StartElementEvent,
    startDepth: number,
    options?: ParseOptions
  ): string | Promise<string> {
    // Check if async iterator by checking constructor name
    // We cannot call next() here as it would consume an event
    const iteratorConstructorName = iterator?.constructor?.name || '';
    if (iteratorConstructorName === 'StaxXmlParser' || iteratorConstructorName.includes('Async')) {
      return this.collectTextAsync(iterator as AsyncIterator<AnyXmlEvent>, startDepth);
    }

    return this.collectTextSync(iterator as Iterator<AnyXmlEvent>, startDepth);
  }

  private collectTextSync(iterator: Iterator<AnyXmlEvent>, startDepth: number): string {
    let currentDepth = startDepth;
    let buffer = '';
    let iterResult = iterator.next();

    while (!iterResult.done) {
      const event = iterResult.value;

      if (isStartElement(event)) {
        currentDepth++;
      } else if (isEndElement(event)) {
        currentDepth--;
        if (currentDepth < startDepth) {
          break;
        }
      } else if ((isCharacters(event) || isCdata(event)) && currentDepth === startDepth) {
        buffer += event.value;
      }

      iterResult = iterator.next();
    }

    return buffer;
  }

  private async collectTextAsync(iterator: AsyncIterator<AnyXmlEvent>, startDepth: number): Promise<string> {
    let currentDepth = startDepth;
    let buffer = '';
    let iterResult = await iterator.next();

    while (!iterResult.done) {
      const event = iterResult.value;

      if (isStartElement(event)) {
        currentDepth++;
      } else if (isEndElement(event)) {
        currentDepth--;
        if (currentDepth < startDepth) {
          break;
        }
      } else if ((isCharacters(event) || isCdata(event)) && currentDepth === startDepth) {
        buffer += event.value;
      }

      iterResult = await iterator.next();
    }

    return buffer;
  }

  /**
   * Set XPath expression for locating the element
   * @param path - XPath expression
   * @returns New schema with XPath
   */
  xpath(path: string): XmlStringSchema {
    return new XmlStringSchema({ ...this.options, xpath: path });
  }
}