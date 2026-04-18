import { XmlSchemaBase, type ParseInput } from './base.js';
import { XmlParserInternal } from './XmlParserInternal.js';
import { isAsyncEventIterator } from './AsyncEventBatchIterator.js';
import type { ParseOptions, XmlWriteOptions } from './types.js';
import { SchemaType } from './types.js';
import { StaxXmlWriterSync, StaxXmlWriterSyncSink } from '../StaxXmlWriterSync.js';
import { StaxXmlWriter } from '../StaxXmlWriter.js';
import type { AnyXmlEvent, StartElementEvent } from '../types.js';
import type { XmlParsingStateMachine } from './XmlParsingStateMachine.js';

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

  _parse(input: ParseInput, parseOptions?: ParseOptions): T['_output'][] {
    const parser = new XmlParserInternal(parseOptions);
    return parser.parseArray(input as string, this.element, this.xpath);
  }

  async _parseAsync(input: ParseInput, parseOptions?: ParseOptions): Promise<T['_output'][]> {
    const parser = new XmlParserInternal(parseOptions);
    return parser.parseArrayAsync(input, this.element, this.xpath);
  }

  /**
   * Parse array from current iterator position (for nested array parsing)
   * @internal
   */
  _parseFromPosition(
    iterator: Iterator<AnyXmlEvent> | AsyncIterator<AnyXmlEvent>,
    startEvent: StartElementEvent,
    startDepth: number,
    options?: ParseOptions,
    stateMachine?: XmlParsingStateMachine,
    parentContext?: unknown
  ): T['_output'][] | Promise<T['_output'][]> {
    const parser = new XmlParserInternal(options);

    if (isAsyncEventIterator(iterator)) {
      return parser.parseArrayFromPosition(
        iterator as AsyncIterator<AnyXmlEvent>,
        startEvent,
        startDepth,
        this.element,
        this.xpath,
        stateMachine
      ) as Promise<T['_output'][]>;
    }

    // Sync iterator
    return parser.parseArrayFromPositionSync(
      iterator as Iterator<AnyXmlEvent>,
      startEvent,
      startDepth,
      this.element,
      this.xpath,
      stateMachine
    ) as T['_output'][];
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
    let writer: StaxXmlWriterSync | StaxXmlWriterSyncSink;
    let isInjected = false;

    if (options?.writer) {
      if (
        options.writer instanceof StaxXmlWriterSync ||
        options.writer instanceof StaxXmlWriterSyncSink
      ) {
        writer = options.writer;
        isInjected = true;
      } else {
        throw new Error('writeSync requires StaxXmlWriterSync or StaxXmlWriterSyncSink instance');
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

    if (writer instanceof StaxXmlWriterSync) {
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
