import { XmlSchema, type ParseInput } from './XmlSchema.js';
import { XmlParserInternal } from './XmlParserInternal.js';
import { XmlParseError } from './errors.js';
import type { ParseOptions, XmlNumberOptions } from './types.js';
import { isCharacters, isCdata, isEndElement, isStartElement, type AnyXmlEvent, type StartElementEvent } from '../types.js';

/**
 * Schema for parsing XML number values
 *
 * @public
 */
export class XmlNumberSchema extends XmlSchema<number, number> {
  constructor(public options: XmlNumberOptions = {}) {
    super();
  }

  _parse(input: ParseInput, parseOptions?: ParseOptions): number {
    const parser = new XmlParserInternal(parseOptions);
    const text = parser.parseString(input as string, this.options);
    return this._parseText(text);
  }

  async _parseAsync(input: ParseInput, parseOptions?: ParseOptions): Promise<number> {
    const parser = new XmlParserInternal(parseOptions);
    const text = await parser.parseStringAsync(input, this.options);
    return this._parseText(text);
  }

  _parseText(text: string): number {
    const num = parseFloat(text);

    if (isNaN(num)) {
      throw new XmlParseError([{
        path: [],
        message: `Invalid number: ${text}`,
        code: 'invalid_number'
      }]);
    }

    if (this.options.min !== undefined && num < this.options.min) {
      throw new XmlParseError([{
        path: [],
        message: `Number ${num} is less than minimum ${this.options.min}`,
        code: 'too_small'
      }]);
    }

    if (this.options.max !== undefined && num > this.options.max) {
      throw new XmlParseError([{
        path: [],
        message: `Number ${num} is greater than maximum ${this.options.max}`,
        code: 'too_big'
      }]);
    }

    if (this.options.int && !Number.isInteger(num)) {
      throw new XmlParseError([{
        path: [],
        message: `Expected integer, got ${num}`,
        code: 'not_integer'
      }]);
    }

    return num;
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
  ): number | Promise<number> {
    // Check if async iterator by checking constructor name
    // We cannot call next() here as it would consume an event
    const iteratorConstructorName = iterator?.constructor?.name || '';
    if (iteratorConstructorName === 'StaxXmlParser' || iteratorConstructorName.includes('Async')) {
      return this.collectAndParseAsync(iterator as AsyncIterator<AnyXmlEvent>, startDepth);
    }

    return this.collectAndParseSync(iterator as Iterator<AnyXmlEvent>, startDepth);
  }

  private collectAndParseSync(iterator: Iterator<AnyXmlEvent>, startDepth: number): number {
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

    return this._parseText(buffer);
  }

  private async collectAndParseAsync(iterator: AsyncIterator<AnyXmlEvent>, startDepth: number): Promise<number> {
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

    return this._parseText(buffer);
  }

  /**
   * Set XPath expression for locating the element
   * @param path - XPath expression
   * @returns New schema with XPath
   */
  xpath(path: string): XmlNumberSchema {
    return new XmlNumberSchema({ ...this.options, xpath: path });
  }

  /**
   * Set minimum value
   * @param value - Minimum value
   * @returns New schema with minimum
   */
  min(value: number): XmlNumberSchema {
    return new XmlNumberSchema({ ...this.options, min: value });
  }

  /**
   * Set maximum value
   * @param value - Maximum value
   * @returns New schema with maximum
   */
  max(value: number): XmlNumberSchema {
    return new XmlNumberSchema({ ...this.options, max: value });
  }

  /**
   * Require integer value
   * @returns New schema that only accepts integers
   */
  int(): XmlNumberSchema {
    return new XmlNumberSchema({ ...this.options, int: true });
  }
}