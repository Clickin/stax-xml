import { XmlSchema, type ParseInput } from './XmlSchema.js';
import { XmlParserInternal } from './XmlParserInternal.js';
import type { ParseOptions, XmlObjectOptions, XmlWriteOptions } from './types.js';
import { SchemaType } from './types.js';
import type { AnyXmlEvent, StartElementEvent } from '../types.js';
import { StaxXmlWriterSync } from '../StaxXmlWriterSync.js';
import { StaxXmlWriter } from '../StaxXmlWriter.js';
import type { XmlParsingStateMachine, SchemaActivation } from './XmlParsingStateMachine.js';

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
 * Type guard to check if schema has _writeContent method
 */
function hasWriteContentMethod(schema: XmlSchema<unknown, unknown>): schema is XmlSchema<unknown, unknown> & { _writeContent(data: unknown, options?: XmlWriteOptions): string } {
  return '_writeContent' in schema && typeof (schema as { _writeContent?: unknown })._writeContent === 'function';
}

/**
 * Type guard to check if schema has writeConfig property
 */
function hasWriteConfig(schema: XmlSchema<unknown, unknown>): schema is XmlSchema<unknown, unknown> & { writeConfig?: { element?: string; asAttribute?: string; cdata?: boolean; comment?: string } } {
  return 'writeConfig' in schema;
}

/**
 * Shape type for object schema
 *
 * @public
 */
export type XmlObjectShape = Record<string, XmlSchema<unknown, unknown>>;

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
export class XmlObjectSchema<T extends XmlObjectShape> extends XmlSchema<InferObjectOutput<T>, unknown> {
  readonly schemaType = SchemaType.OBJECT;

  constructor(
    public readonly shape: T,
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
    stateMachine?: XmlParsingStateMachine,
    parentContext?: SchemaActivation
  ): InferObjectOutput<T> | Promise<InferObjectOutput<T>> {
    const parser = new XmlParserInternal(options);

    // Check if async iterator by checking if return method returns a Promise
    // We cannot call next() here as it would consume an event
    // Instead, check if the iterator has async methods
    if ('return' in iterator && typeof (iterator as { return?: unknown }).return === 'function') {
      const returnMethod = (iterator as { return: () => unknown | Promise<unknown> }).return;
      try {
        const returnValue = returnMethod.call(iterator);
        if (returnValue && typeof (returnValue as { then?: unknown }).then === 'function') {
          // Async iterator
          return parser.parseObjectFromPosition(
            iterator as AsyncIterator<AnyXmlEvent>,
            startEvent,
            startDepth,
            this.shape,
            this.options,
            stateMachine,
            parentContext
          ) as Promise<InferObjectOutput<T>>;
        }
      } catch {
        // Calling return() failed, assume sync iterator
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
        stateMachine,
        parentContext
      ) as Promise<InferObjectOutput<T>>;
    }

    // Sync iterator
    return parser.parseObjectFromPositionSync(
      iterator as Iterator<AnyXmlEvent>,
      startEvent,
      startDepth,
      this.shape,
      this.options,
      stateMachine,
      parentContext
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
    // Validate XPath immediately
    if (!path || path.length === 0) {
      throw new Error('XPath cannot be empty');
    }
    return new XmlObjectSchema(this.shape, { ...this.options, xpath: path });
  }

  /**
   * Write raw content only (used inside parent object/array schema)
   * @internal
   */
  _writeContent(data: InferObjectOutput<T>, options?: XmlWriteOptions): string {
    let content = '';

    // Write each field
    for (const [key, schema] of Object.entries(this.shape)) {
      const value = (data as Record<string, unknown>)[key];
      if (value === undefined || value === null) {
        continue;
      }

      const fieldConfig = hasWriteConfig(schema) ? schema.writeConfig : undefined;
      if (fieldConfig?.asAttribute) {
        continue; // Attributes need parent element context
      }

      const rawContent = hasWriteContentMethod(schema) ?
        schema._writeContent(value, options) :
        escapeXml(String(value));

      content += rawContent;
    }

    return content;
  }

  /**
   * Write object data to XML synchronously
   * @internal
   */
  _writeSync(data: InferObjectOutput<T>, options?: XmlWriteOptions): string {
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
      const rootAttributes: Record<string, string> = Object.create(null);

      // Collect attributes from shape
      for (const [key, schema] of Object.entries(this.shape)) {
        const fieldConfig = hasWriteConfig(schema) ? schema.writeConfig : undefined;
        if (fieldConfig?.asAttribute) {
          const value = (data as Record<string, unknown>)[key];
          if (value !== undefined && value !== null) {
            rootAttributes[fieldConfig.asAttribute] = String(value);
          }
        }
      }

      writer.writeStartElement(options.rootElement, {
        attributes: rootAttributes,
        comment: this.writeConfig?.comment
      });
    }

    // Write each field
    const nestedOptions: XmlWriteOptions = {
      ...options,
      writer, // Pass the writer to nested calls
      includeDeclaration: false
    };

    for (const [key, schema] of Object.entries(this.shape)) {
      const value = (data as Record<string, unknown>)[key];
      if (value === undefined || value === null) {
        continue; // Skip undefined/null values
      }

      const fieldConfig = hasWriteConfig(schema) ? schema.writeConfig : undefined;

      // Skip if this field is an attribute (already written)
      if (fieldConfig?.asAttribute) {
        continue;
      }

      const elementName = fieldConfig?.element || key;

      // Check if this is an array field - arrays handle their own element wrapping
      const isArray = Array.isArray(value);

      if (isArray) {
        // For arrays, don't wrap with element - let the array schema handle it
        schema._writeSync(value as never, nestedOptions);
      } else {
        // Write element start
        writer.writeStartElement(elementName, {
          comment: fieldConfig?.comment
        });

        // Get raw content from schema (without wrapping element)
        const rawContent = hasWriteContentMethod(schema) ?
          schema._writeContent(value, nestedOptions) :
          schema._writeSync(value as never, { ...nestedOptions, rootElement: undefined });

        // Write content
        if (fieldConfig?.cdata) {
          writer.writeCData(rawContent);
        } else {
          // _writeContent already escaped the content, so write as raw
          writer.writeRaw(rawContent);
        }

        writer.writeEndElement();
      }
    }

    // Close root element
    if (options?.rootElement) {
      writer.writeEndElement();
    }

    // End document if not injected
    if (!isInjected) {
      writer.writeEndDocument();
    }

    return isInjected ? '' : writer.getXmlString();
  }

  /**
   * Write object data to WritableStream asynchronously
   * @internal
   */
  async _write(
    data: InferObjectOutput<T>,
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
      const rootAttributes: Record<string, string> = Object.create(null);

      // Collect attributes from shape
      for (const [key, schema] of Object.entries(this.shape)) {
        const fieldConfig = hasWriteConfig(schema) ? schema.writeConfig : undefined;
        if (fieldConfig?.asAttribute) {
          const value = (data as Record<string, unknown>)[key];
          if (value !== undefined && value !== null) {
            rootAttributes[fieldConfig.asAttribute] = String(value);
          }
        }
      }

      await writer.writeStartElement(options.rootElement, {
        attributes: rootAttributes,
        comment: this.writeConfig?.comment
      });
    }

    // Write each field
    for (const [key, schema] of Object.entries(this.shape)) {
      const value = (data as Record<string, unknown>)[key];
      if (value === undefined || value === null) {
        continue; // Skip undefined/null values
      }

      const fieldConfig = hasWriteConfig(schema) ? schema.writeConfig : undefined;

      // Skip if this field is an attribute (already written)
      if (fieldConfig?.asAttribute) {
        continue;
      }

      const elementName = fieldConfig?.element || key;

      // Write element start
      await writer.writeStartElement(elementName, {
        comment: fieldConfig?.comment
      });

      // For nested schemas, use sync write with a temporary writer to generate content
      // This ensures proper element nesting without double declarations
      const tempWriter = new StaxXmlWriterSync({
        prettyPrint: options?.prettyPrint,
        indentString: options?.indentString,
        encoding: options?.encoding
      });
      schema._writeSync(value as never, {
        ...options,
        writer: tempWriter,
        rootElement: undefined,
        includeDeclaration: false
      });

      // Get content from temp writer
      const rawContent = tempWriter.getXmlString();

      // Write content
      if (fieldConfig?.cdata) {
        await writer.writeCData(rawContent);
      } else {
        // _writeContent already escaped the content, so write as raw
        await writer.writeRaw(rawContent);
      }

      await writer.writeEndElement();
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