import { XmlSchema } from './XmlSchema.js';
import type { XmlStringOptions, XmlWriteOptions } from './types.js';
import { SchemaType } from './types.js';
import { WriterSync, WriterSyncSink } from 'stax-xml-sync';
import { Writer } from 'stax-xml-async';

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

  _parseText(text: string): string {
    return text;
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
    let writer: WriterSync | WriterSyncSink;
    let isInjected = false;

    if (options?.writer) {
      if (
        options.writer instanceof WriterSync ||
        options.writer instanceof WriterSyncSink
      ) {
        writer = options.writer;
        isInjected = true;
      } else {
        throw new Error('writeSync requires WriterSync or WriterSyncSink instance');
      }
    } else {
      writer = new WriterSync({
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

    if (writer instanceof WriterSync) {
      return writer.getXmlString();
    }
    return '';
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
    let writer: Writer;
    let isInjected = false;

    if (options?.writer) {
      if (options.writer instanceof Writer) {
        writer = options.writer;
        isInjected = true;
      } else {
        throw new Error('write requires Writer instance');
      }
    } else {
      writer = new Writer(stream, {
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
