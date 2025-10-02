import { XmlSchema, type ParseInput } from './XmlSchema.js';
import { XmlParserInternal } from './XmlParserInternal.js';
import { XmlParseError } from './errors.js';
import type { ParseOptions, XmlNumberOptions, XmlWriteOptions } from './types.js';
import { isCharacters, isCdata, isEndElement, isStartElement, type AnyXmlEvent, type StartElementEvent } from '../types.js';
import { XmlWriterInternal } from './XmlWriterInternal.js';

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
    // Handle empty or whitespace-only strings gracefully
    const trimmedText = text.trim();
    if (trimmedText === '') {
      throw new XmlParseError([{
        path: [],
        message: `No number content found (empty text)`,
        code: 'empty_content'
      }]);
    }

    const num = parseFloat(trimmedText);

    if (isNaN(num)) {
      throw new XmlParseError([{
        path: [],
        message: `Invalid number: ${trimmedText}`,
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
    // Validate XPath immediately
    if (!path || path.length === 0) {
      throw new Error('XPath cannot be empty');
    }
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

  /**
   * Write raw content only (used inside object schema)
   * @internal
   */
  _writeContent(data: number, options?: XmlWriteOptions): string {
    return this.options.int ? String(Math.floor(data)) : String(data);
  }

  /**
   * Write number data to XML synchronously
   * @internal
   */
  _write(data: number, options?: XmlWriteOptions): string {
    const writer = new XmlWriterInternal(options);

    // Write declaration if requested and at root level
    if (options?.rootElement && options?.includeDeclaration !== false) {
      writer.writeStartDocument(options?.xmlVersion, options?.encoding);
    }

    // Write root element if specified
    if (options?.rootElement) {
      writer.writeStartElement(options.rootElement, undefined, this.writeConfig);
    }

    // Write number element
    if (this.writeConfig?.element) {
      writer.writeStartElement(this.writeConfig.element, undefined, this.writeConfig);
    }

    // Write content
    const numberStr = this._writeContent(data, options);
    writer.writeCharacters(numberStr);

    // Close elements
    if (this.writeConfig?.element) {
      writer.writeEndElement();
    }
    if (options?.rootElement) {
      writer.writeEndElement();
    }

    return writer.toString();
  }

  /**
   * Write number data to XML asynchronously
   * @internal
   */
  async _writeAsync(data: number, options?: XmlWriteOptions): Promise<string> {
    return this._write(data, options);
  }
}