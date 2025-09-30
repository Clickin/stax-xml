import type { ParseResult } from './errors.js';
import type { ParseOptions } from './types.js';
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
export abstract class XmlSchemaBase<Output = any, Input = any> {
  readonly _output!: Output;
  readonly _input!: Input;

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
   * Parse XML synchronously (public API)
   * @param input - XML string or sync iterator
   * @param options - Parse options
   * @returns Parsed output
   * @throws {XmlParseError} If parsing fails
   */
  parse(input: string | Iterator<AnyXmlEvent>, options?: ParseOptions): Output {
    return this._parse(input, options);
  }

  /**
   * Parse XML asynchronously (public API)
   * @param input - XML string, stream, or async iterator
   * @param options - Parse options
   * @returns Parsed output
   * @throws {XmlParseError} If parsing fails
   */
  async parseAsync(input: ParseInput, options?: ParseOptions): Promise<Output> {
    return this._parseAsync(input, options);
  }

  /**
   * Parse XML synchronously with error handling
   * @param input - XML string or sync iterator
   * @param options - Parse options
   * @returns Parse result with success flag
   */
  safeParse(input: string | Iterator<AnyXmlEvent>, options?: ParseOptions): ParseResult<Output> {
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
   * Parse XML asynchronously with error handling
   * @param input - XML string, stream, or async iterator
   * @param options - Parse options
   * @returns Parse result with success flag
   */
  async safeParseAsync(input: ParseInput, options?: ParseOptions): Promise<ParseResult<Output>> {
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
    return XmlSchemaBase._createOptional(this as any);
  }

  /**
   * Convert this schema to an array schema
   * @param xpath - XPath expression for array elements
   * @returns New array schema
   */
  array(xpath?: string): XmlSchemaBase<Output[], Input[]> {
    return XmlSchemaBase._createArray(this as any, xpath);
  }

  // Static factory methods (will be set by initialization module)
  static _createTransform: <Output, Input, NewOutput>(schema: XmlSchemaBase<Output, Input>, fn: (value: Output) => NewOutput) => XmlSchemaBase<NewOutput, Input>;
  static _createOptional: <T extends XmlSchemaBase<any, any>>(schema: T) => XmlSchemaBase<T['_output'] | undefined, T['_input'] | undefined>;
  static _createArray: <T extends XmlSchemaBase<any, any>>(schema: T, xpath?: string) => XmlSchemaBase<T['_output'][], T['_input'][]>;
}