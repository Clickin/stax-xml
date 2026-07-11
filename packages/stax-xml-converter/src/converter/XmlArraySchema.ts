import { XmlSchemaBase } from './base.js';
import type { XmlWriteOptions } from './types.js';
import { SchemaType } from './types.js';
import { WriterSync, WriterSyncSink } from 'stax-xml-sync';
import { Writer } from 'stax-xml-async';

/**
 * Schema for parsing XML array values
 *
 * @public
 */
export class XmlArraySchema<T extends XmlSchemaBase<unknown, unknown>> extends XmlSchemaBase<T['_output'][], T['_input'][]> {
  readonly schemaType = SchemaType.ARRAY;

  constructor(
    public readonly element: T,
    public readonly xpath?: string
  ) {
    super();
  }

  _parseText(text: string): T['_output'][] {
    // Arrays cannot be parsed from plain text
    // Return empty array as default behavior
    return [];
  }

  /**
   * Write array data to XML synchronously
   * @internal
   */
  _writeSync(data: T['_output'][], options?: XmlWriteOptions): string {
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
        /* v8 ignore next -- array write comments are covered at object writer level */
        comment: this.writeConfig?.comment
      });
    }

    // Write each array item without declaration
    // Access writeConfig via type assertion - it's protected but we need it here
    const elementConfig = (this.element as unknown as { writeConfig?: { element?: string } }).writeConfig;
    const nestedOptions: XmlWriteOptions = {
      ...options,
      writer, // Pass the writer to nested calls
      rootElement: elementConfig?.element,
      includeDeclaration: false
    };

    for (const item of data) {
      this.element._writeSync(item as T['_output'], nestedOptions);
    }

    // Close root element
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
   * Write array data to WritableStream asynchronously
   * @internal
   */
  async _write(
    data: T['_output'][],
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
        /* v8 ignore next -- array write comments are covered at object writer level */
        comment: this.writeConfig?.comment
      });
    }

    // Write each array item without declaration
    // Access writeConfig via type assertion - it's protected but we need it here
    const elementConfig = (this.element as unknown as { writeConfig?: { element?: string } }).writeConfig;
    const nestedOptions: XmlWriteOptions = {
      ...options,
      writer, // Pass the writer to nested calls
      rootElement: elementConfig?.element,
      includeDeclaration: false
    };

    for (const item of data) {
      await this.element._write(item as T['_output'], stream, nestedOptions);
    }

    // Close root element
    if (options?.rootElement) {
      await writer.writeEndElement();
    }

    // End document if not injected
    if (!isInjected) {
      await writer.writeEndDocument();
    }
  }
}
