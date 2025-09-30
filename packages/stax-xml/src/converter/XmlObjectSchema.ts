import { XmlSchema, type ParseInput } from './XmlSchema.js';
import { XmlParserInternal } from './XmlParserInternal.js';
import type { ParseOptions, XmlObjectOptions } from './types.js';
import type { AnyXmlEvent, StartElementEvent } from '../types.js';

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
    options?: ParseOptions
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
          this.options
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
        this.options
      ) as Promise<InferObjectOutput<T>>;
    }

    // Sync iterator
    return parser.parseObjectFromPositionSync(
      iterator as Iterator<AnyXmlEvent>,
      startEvent,
      startDepth,
      this.shape,
      this.options
    ) as InferObjectOutput<T>;
  }

  /**
   * Set XPath expression for locating the object
   * @param path - XPath expression
   * @returns New schema with XPath
   */
  xpath(path: string): XmlObjectSchema<T> {
    return new XmlObjectSchema(this.shape, { ...this.options, xpath: path });
  }
}