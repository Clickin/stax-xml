import type { ParseResult } from './errors.js';
import type { ParseOptions, XmlWriteOptions, XmlElementWriteConfig, SchemaType } from './types.js';
import type { AnyXmlEvent, StartElementEvent } from '../types.js';
import { XmlParseError } from './errors.js';


/**
 * Parse input type - accepts string, sync iterator, async iterator, or ReadableStream
 *
 * @public
 */
export type ParseInput = string | ReadableStream<Uint8Array> | AsyncIterator<AnyXmlEvent> | Iterator<AnyXmlEvent>;

/**
 * Base abstract class for all XML schema types
 *
 * @remarks
 * This class provides the foundation for zod-style declarative XML parsing.
 * Each schema type extends this class and implements the parsing logic.
 *
 * @public
 */
export abstract class XmlSchemaBase<Output, Input = Output> {
  readonly _output!: Output;
  readonly _input!: Input;

  /**
   * Schema type identifier
   * @internal
   */
  abstract readonly schemaType: SchemaType;

  /**
   * Writer configuration for this schema
   * @internal
   */
  protected writeConfig?: XmlElementWriteConfig;

  /**
   * Parse XML input synchronously
   * @param input - XML string or sync iterator
   * @param options - Parse options
   * @returns Parsed output
   * @throws {XmlParseError} If parsing fails
   */
  abstract _parse(input: ParseInput, options?: ParseOptions): Output;

  /**
   * Parse XML input asynchronously
   * @param input - XML string, stream, or async iterator
   * @param options - Parse options
   * @returns Parsed output
   * @throws {XmlParseError} If parsing fails
   */
  abstract _parseAsync(input: ParseInput, options?: ParseOptions): Promise<Output>;

  /**
   * Write data to XML string synchronously
   * @param data - Data to write
   * @param options - Write options
   * @returns XML string
   * @internal
   */
  abstract _writeSync(data: Output, options?: XmlWriteOptions): string;

  /**
   * Write data to WritableStream asynchronously
   * @param data - Data to write
   * @param stream - Writable stream to write to
   * @param options - Write options
   * @internal
   */
  abstract _write(
    data: Output,
    stream: WritableStream<Uint8Array>,
    options?: XmlWriteOptions
  ): Promise<void>;

  /**
   * Parse text content (used internally by parser)
   * @param text - Text content
   * @returns Parsed output
   * @internal
   */
  abstract _parseText?(text: string): Output;

  /**
   * Parse from current iterator position (for streaming/recursive parsing)
   * @param iterator - Event iterator at current position
   * @param startEvent - The start element event
   * @param startDepth - Depth of the start element
   * @param options - Parse options
   * @returns Parsed output
   * @internal
   */
  _parseFromPosition?(
    iterator: Iterator<AnyXmlEvent> | AsyncIterator<AnyXmlEvent>,
    startEvent: StartElementEvent,
    startDepth: number,
    options?: ParseOptions
  ): Output | Promise<Output>;

  /**
   * Parse XML asynchronously (public API)
   * @param input - XML string, stream, or async iterator
   * @param options - Parse options
   * @returns Parsed output
   * @throws {XmlParseError} If parsing fails
   */
  async parse(input: ParseInput, options?: ParseOptions): Promise<Output> {
    return this._parseAsync(input, options);
  }

  /**
   * Parse XML synchronously (public API)
   * @param input - XML string or sync iterator
   * @param options - Parse options
   * @returns Parsed output
   * @throws {XmlParseError} If parsing fails
   */
  parseSync(input: string | Iterator<AnyXmlEvent>, options?: ParseOptions): Output {
    return this._parse(input, options);
  }

  /**
   * Parse XML asynchronously with error handling
   * @param input - XML string, stream, or async iterator
   * @param options - Parse options
   * @returns Parse result with success flag
   */
  async safeParse(input: ParseInput, options?: ParseOptions): Promise<ParseResult<Output>> {
    try {
      return { success: true, data: await this._parseAsync(input, options) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof XmlParseError ? error : new XmlParseError([{
          path: [],
          message: error instanceof Error ? error.message : String(error),
          code: 'parse_error'
        }])
      };
    }
  }

  /**
   * Parse XML synchronously with error handling
   * @param input - XML string or sync iterator
   * @param options - Parse options
   * @returns Parse result with success flag
   */
  safeParseSync(input: string | Iterator<AnyXmlEvent>, options?: ParseOptions): ParseResult<Output> {
    try {
      return { success: true, data: this._parse(input, options) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof XmlParseError ? error : new XmlParseError([{
          path: [],
          message: error instanceof Error ? error.message : String(error),
          code: 'parse_error'
        }])
      };
    }
  }

  /**
   * Transform the parsed output
   * @param fn - Transform function
   * @returns New schema with transform applied
   */
  transform<NewOutput>(fn: (value: Output) => NewOutput): XmlSchemaBase<NewOutput, Input> {
    return XmlSchemaBase._createTransform(this, fn);
  }

  /**
   * Make this schema optional
   * @returns New optional schema
   */
  optional(): XmlSchemaBase<Output | undefined, Input | undefined> {
    return XmlSchemaBase._createOptional(this as XmlSchemaBase<Output, Input>);
  }

  /**
   * Convert this schema to an array schema
   * @param xpath - XPath expression for array elements
   * @returns New array schema
   */
  array(xpath?: string): XmlSchemaBase<Output[], Input[]> {
    return XmlSchemaBase._createArray(this as XmlSchemaBase<Output, Input>, xpath);
  }

  compile(): XmlSchemaBase<Output, Input> {
    return XmlSchemaBase._createCompiled(this);
  }


  /**
   * Write data to XML string asynchronously (public API)
   * @param data - Data to write
   * @param options - Write options
   * @returns XML string
   */
  async write(data: Output, options?: XmlWriteOptions): Promise<string> {
    // Create a WritableStream that collects chunks into a string
    const chunks: Uint8Array[] = [];
    const stream = new WritableStream<Uint8Array>({
      write(chunk) {
        chunks.push(chunk);
      }
    });

    await this._write(data, stream, options);

    // Convert chunks to string
    const encoder = new TextDecoder(options?.encoding || 'utf-8');
    return chunks.map(chunk => encoder.decode(chunk, { stream: true })).join('') +
           encoder.decode(); // Flush remaining bytes
  }

  /**
   * Write data to WritableStream asynchronously (public API)
   * @param data - Data to write
   * @param stream - Writable stream to write to
   * @param options - Write options
   */
  async writeToStream(
    data: Output,
    stream: WritableStream<Uint8Array>,
    options?: XmlWriteOptions
  ): Promise<void> {
    return this._write(data, stream, options);
  }

  /**
   * Write data to XML string synchronously (public API)
   * @param data - Data to write
   * @param options - Write options
   * @returns XML string
   */
  writeSync(data: Output, options?: XmlWriteOptions): string {
    return this._writeSync(data, options);
  }

  /**
   * Configure writer settings for this schema
   * @param config - Writer configuration
   * @returns This schema with writer config
   */
  writer(config: XmlElementWriteConfig): this {
    this.writeConfig = config;
    return this;
  }

  // Static factory methods (will be set by initialization module)
  static _createTransform: <Output, Input, NewOutput>(schema: XmlSchemaBase<Output, Input>, fn: (value: Output) => NewOutput) => XmlSchemaBase<NewOutput, Input>;
  static _createOptional: <T extends XmlSchemaBase<unknown, unknown>>(schema: T) => XmlSchemaBase<T['_output'] | undefined, T['_input'] | undefined>;
  static _createArray: <T extends XmlSchemaBase<unknown, unknown>>(schema: T, xpath?: string) => XmlSchemaBase<T['_output'][], T['_input'][]>;
  static _createCompiled: <Output, Input>(schema: XmlSchemaBase<Output, Input>) => XmlSchemaBase<Output, Input>;

}