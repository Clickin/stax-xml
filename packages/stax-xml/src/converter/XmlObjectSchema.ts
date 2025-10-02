import { XmlSchema, type ParseInput } from './XmlSchema.js';
import { XmlParserInternal } from './XmlParserInternal.js';
import type { ParseOptions, XmlObjectOptions, XmlWriteOptions } from './types.js';
import type { AnyXmlEvent, StartElementEvent } from '../types.js';
import { XmlWriterInternal } from './XmlWriterInternal.js';
import type { SchemaActivation } from './XmlParsingStateMachine.js';

/**
 * Shape type for object schema
 *
 * @public
 */
export type XmlObjectShape = Record<string, XmlSchema<any, any>>;

/**
 * Infer output type from object shape
 *
 * @public
 */
export type InferObjectOutput<T extends XmlObjectShape> = {
  [K in keyof T]: T[K]['_output']
};

/**
 * Schema for parsing XML object values
 *
 * @public
 */
export class XmlObjectSchema<T extends XmlObjectShape> extends XmlSchema<InferObjectOutput<T>, any> {
  constructor(
    private shape: T,
    public options: XmlObjectOptions = {}
  ) {
    super();
  }

  _parse(input: ParseInput, parseOptions?: ParseOptions): InferObjectOutput<T> {
    const parser = new XmlParserInternal(parseOptions);
    return parser.parseObject(input as string, this.shape, this.options) as InferObjectOutput<T>;
  }

  async _parseAsync(input: ParseInput, parseOptions?: ParseOptions): Promise<InferObjectOutput<T>> {
    const parser = new XmlParserInternal(parseOptions);
    return parser.parseObjectAsync(input, this.shape, this.options) as Promise<InferObjectOutput<T>>;
  }

  /**
   * Parse from current iterator position (for recursive/streaming parsing)
   * @internal
   */
  _parseFromPosition(
    iterator: Iterator<AnyXmlEvent> | AsyncIterator<AnyXmlEvent>,
    startEvent: StartElementEvent,
    startDepth: number,
    options?: ParseOptions,
    parentActivation?: SchemaActivation
  ): InferObjectOutput<T> | Promise<InferObjectOutput<T>> {
    const parser = new XmlParserInternal(options);

    // Check if async iterator by checking Symbol.asyncIterator on the iterator itself
    // We cannot call next() here as it would consume an event
    // Instead, check if the iterator has async methods
    if ('return' in iterator && typeof (iterator as any).return === 'function') {
      const returnValue = (iterator as any).return;
      if (returnValue && typeof returnValue.then === 'function') {
        // Async iterator
        return parser.parseObjectFromPosition(
          iterator as AsyncIterator<AnyXmlEvent>,
          startEvent,
          startDepth,
          this.shape,
          this.options,
          parentActivation
        ) as Promise<InferObjectOutput<T>>;
      }
    }

    // Try another approach: check if iterator is from StaxXmlParser (async) or StaxXmlParserSync
    const iteratorConstructorName = iterator?.constructor?.name || '';
    if (iteratorConstructorName === 'StaxXmlParser' || iteratorConstructorName.includes('Async')) {
      return parser.parseObjectFromPosition(
        iterator as AsyncIterator<AnyXmlEvent>,
        startEvent,
        startDepth,
        this.shape,
        this.options,
        parentActivation
      ) as Promise<InferObjectOutput<T>>;
    }

    // Sync iterator
    return parser.parseObjectFromPositionSync(
      iterator as Iterator<AnyXmlEvent>,
      startEvent,
      startDepth,
      this.shape,
      this.options,
      parentActivation
    ) as InferObjectOutput<T>;
  }

  _parseText(text: string): InferObjectOutput<T> {
    // Objects cannot be parsed from plain text
    // Return empty object as default behavior
    return {} as InferObjectOutput<T>;
  }

  /**
   * Set XPath expression for locating the object
   * @param path - XPath expression
   * @returns New schema with XPath
   */
  xpath(path: string): XmlObjectSchema<T> {
    return new XmlObjectSchema(this.shape, { ...this.options, xpath: path });
  }

  /**
   * Write raw content only (used inside parent object/array schema)
   * @internal
   */
  _writeContent(data: InferObjectOutput<T>, options?: XmlWriteOptions): string {
    const writer = new XmlWriterInternal(options);

    // Write each field
    for (const [key, schema] of Object.entries(this.shape)) {
      const value = (data as any)[key];
      if (value === undefined || value === null) {
        continue;
      }

      const fieldConfig = (schema as any).writeConfig;
      if (fieldConfig?.asAttribute) {
        continue; // Attributes need parent element context
      }

      const elementName = fieldConfig?.element || key;
      writer.writeStartElement(elementName, undefined, fieldConfig);

      const rawContent = (schema as any)._writeContent ?
        (schema as any)._writeContent(value, options) :
        (schema as any)._write(value, { ...options, rootElement: undefined, includeDeclaration: false });

      if (fieldConfig?.cdata) {
        writer.writeCData(rawContent);
      } else if (rawContent.trim().startsWith('<')) {
        writer.writeRaw(rawContent);
      } else {
        writer.writeCharacters(rawContent);
      }

      writer.writeEndElement();
    }

    return writer.toString();
  }

  /**
   * Write object data to XML synchronously
   * @internal
   */
  _write(data: InferObjectOutput<T>, options?: XmlWriteOptions): string {
    const writer = new XmlWriterInternal(options);

    // Write declaration if requested
    if (options?.includeDeclaration !== false) {
      writer.writeStartDocument(options?.xmlVersion, options?.encoding);
    }

    // Write root element if specified
    if (options?.rootElement) {
      const rootAttributes: Record<string, string> = {};

      // Collect attributes from shape
      for (const [key, schema] of Object.entries(this.shape)) {
        const fieldConfig = (schema as any).writeConfig;
        if (fieldConfig?.asAttribute) {
          const value = (data as any)[key];
          if (value !== undefined && value !== null) {
            rootAttributes[fieldConfig.asAttribute] = String(value);
          }
        }
      }

      writer.writeStartElement(options.rootElement, rootAttributes, this.writeConfig);
    }

    // Write each field
    for (const [key, schema] of Object.entries(this.shape)) {
      const value = (data as any)[key];
      if (value === undefined || value === null) {
        continue; // Skip undefined/null values
      }

      const fieldConfig = (schema as any).writeConfig;

      // Skip if this field is an attribute (already written)
      if (fieldConfig?.asAttribute) {
        continue;
      }

      const elementName = fieldConfig?.element || key;
      const attributes: Record<string, string> = {};

      // Write element start
      writer.writeStartElement(elementName, attributes, fieldConfig);

      // Get raw content from schema (without wrapping element)
      const rawContent = (schema as any)._writeContent ?
        (schema as any)._writeContent(value, options) :
        (schema as any)._write(value, { ...options, rootElement: undefined, includeDeclaration: false });

      // Write content
      if (fieldConfig?.cdata) {
        writer.writeCData(rawContent);
      } else if (rawContent.trim().startsWith('<')) {
        // Already XML, write as raw
        writer.writeRaw(rawContent);
      } else {
        // Plain text, write as characters
        writer.writeCharacters(rawContent);
      }

      writer.writeEndElement();
    }

    // Close root element
    if (options?.rootElement) {
      writer.writeEndElement();
    }

    return writer.toString();
  }

  /**
   * Write object data to XML asynchronously
   * @internal
   */
  async _writeAsync(data: InferObjectOutput<T>, options?: XmlWriteOptions): Promise<string> {
    // For now, async is the same as sync for object writing
    // In the future, this could support streaming to a WritableStream
    return this._write(data, options);
  }
}