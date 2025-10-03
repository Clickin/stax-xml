import { XmlSchemaBase, type ParseInput } from './base.js';
import { XmlParserInternal } from './XmlParserInternal.js';
import type { ParseOptions, XmlWriteOptions } from './types.js';
import { SchemaType } from './types.js';
import { XmlWriterInternal } from './XmlWriterInternal.js';
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

    // Check if async iterator by checking constructor name
    const iteratorConstructorName = iterator?.constructor?.name || '';
    if (iteratorConstructorName === 'StaxXmlParser' || iteratorConstructorName.includes('Async')) {
      // Async iterator
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
  _write(data: T['_output'][], options?: XmlWriteOptions): string {
    const writer = new XmlWriterInternal(options);

    // Write declaration if requested and at root level
    if (options?.rootElement && options?.includeDeclaration !== false) {
      writer.writeStartDocument(options?.xmlVersion, options?.encoding);
    }

    // Write root element if specified
    if (options?.rootElement) {
      writer.writeStartElement(options.rootElement, undefined, this.writeConfig);
    }

    // Write each array item without declaration
    const elementConfig = (this.element as any).writeConfig;
    const nestedOptions: XmlWriteOptions = {
      ...options,
      rootElement: elementConfig?.element, // Use element's configured element name
      includeDeclaration: false
    };

    for (const item of data) {
      const itemXml = (this.element as any)._write(item, nestedOptions);
      writer.writeRaw(itemXml);
    }

    // Close root element
    if (options?.rootElement) {
      writer.writeEndElement();
    }

    return writer.toString();
  }

  /**
   * Write array data to XML asynchronously
   * @internal
   */
  async _writeAsync(data: T['_output'][], options?: XmlWriteOptions): Promise<string> {
    return this._write(data, options);
  }
}