import { XmlSchema, type ParseInput } from './XmlSchema.js';
import { XmlParserInternal } from './XmlParserInternal.js';
import type { ParseOptions, XmlStringOptions, XmlWriteOptions } from './types.js';
import { SchemaType } from './types.js';
import { isCharacters, isCdata, isEndElement, isStartElement, type AnyXmlEvent, type StartElementEvent } from '../types.js';
import { StaxXmlWriterSync } from '../StaxXmlWriterSync.js';
import { StaxXmlWriter } from '../StaxXmlWriter.js';

/**
 * Helper to escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Schema for parsing XML string values
 *
 * @public
 */
export class XmlStringSchema extends XmlSchema<string, string> {
  readonly schemaType = SchemaType.STRING;

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
    // Validate XPath immediately
    if (!path || path.length === 0) {
      throw new Error('XPath cannot be empty');
    }
    return new XmlStringSchema({ ...this.options, xpath: path });
  }

  /**
   * Write raw content only (used inside object schema)
   * @internal
   */
  _writeContent(data: string, options?: XmlWriteOptions): string {
    return this.writeConfig?.cdata ? data : escapeXml(data);
  }

  /**
   * Write string data to XML synchronously
   * @internal
   */
  _writeSync(data: string, options?: XmlWriteOptions): string {
    // Use injected writer or create new one
    let writer: StaxXmlWriterSync;
    let isInjected = false;

    if (options?.writer) {
      if (options.writer instanceof StaxXmlWriterSync) {
        writer = options.writer;
        isInjected = true;
      } else {
        throw new Error('writeSync requires StaxXmlWriterSync instance');
      }
    } else {
      writer = new StaxXmlWriterSync({
        prettyPrint: options?.prettyPrint,
        indentString: options?.indentString,
        encoding: options?.encoding
      });
    }

    // Write declaration if requested and not injected
    if (!isInjected && options?.rootElement && options?.includeDeclaration !== false) {
      writer.writeStartDocument(options?.xmlVersion, options?.encoding);
    }

    // Write root element if specified
    if (options?.rootElement) {
      writer.writeStartElement(options.rootElement, {
        comment: this.writeConfig?.comment
      });
    }

    // Write string element (only if not injected - parent handles element when injected)
    if (!isInjected && this.writeConfig?.element) {
      writer.writeStartElement(this.writeConfig.element, {
        comment: this.writeConfig?.comment
      });
    }

    // Write content
    const content = this._writeContent(data, options);
    if (this.writeConfig?.cdata) {
      writer.writeCData(content);
    } else {
      // _writeContent already escaped the content, so write as raw
      writer.writeRaw(content);
    }

    // Close elements (only if not injected)
    if (!isInjected && this.writeConfig?.element) {
      writer.writeEndElement();
    }
    if (options?.rootElement) {
      writer.writeEndElement();
    }

    // End document if not injected
    if (!isInjected) {
      writer.writeEndDocument();
    }

    return writer.getXmlString();
  }

  /**
   * Write string data to WritableStream asynchronously
   * @internal
   */
  async _write(
    data: string,
    stream: WritableStream<Uint8Array>,
    options?: XmlWriteOptions
  ): Promise<void> {
    // Use injected writer or create new one
    let writer: StaxXmlWriter;
    let isInjected = false;

    if (options?.writer) {
      if (options.writer instanceof StaxXmlWriter) {
        writer = options.writer;
        isInjected = true;
      } else {
        throw new Error('write requires StaxXmlWriter instance');
      }
    } else {
      writer = new StaxXmlWriter(stream, {
        prettyPrint: options?.prettyPrint,
        indentString: options?.indentString,
        encoding: options?.encoding
      });
    }

    // Write declaration if requested and not injected
    if (!isInjected && options?.rootElement && options?.includeDeclaration !== false) {
      await writer.writeStartDocument(options?.xmlVersion, options?.encoding);
    }

    // Write root element if specified
    if (options?.rootElement) {
      await writer.writeStartElement(options.rootElement, {
        comment: this.writeConfig?.comment
      });
    }

    // Write string element (only if not injected - parent handles element when injected)
    if (!isInjected && this.writeConfig?.element) {
      await writer.writeStartElement(this.writeConfig.element, {
        comment: this.writeConfig?.comment
      });
    }

    // Write content
    const content = this._writeContent(data, options);
    if (this.writeConfig?.cdata) {
      await writer.writeCData(content);
    } else {
      // _writeContent already escaped the content, so write as raw
      await writer.writeRaw(content);
    }

    // Close elements (only if not injected)
    if (!isInjected && this.writeConfig?.element) {
      await writer.writeEndElement();
    }
    if (options?.rootElement) {
      await writer.writeEndElement();
    }

    // End document if not injected
    if (!isInjected) {
      await writer.writeEndDocument();
    }
  }
}