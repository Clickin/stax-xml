import { XmlStringSchema } from './XmlStringSchema.js';
import { XmlNumberSchema } from './XmlNumberSchema.js';
import { XmlObjectSchema, type XmlObjectShape } from './XmlObjectSchema.js';
import { XmlArraySchema } from './XmlArraySchema.js';
import type { XmlObjectOptions } from './types.js';
import type { XmlSchema } from './XmlSchema.js';

/**
 * Builder API for creating XML schemas
 *
 * @public
 */
export class XmlBuilder {
  /**
   * Create a string schema
   * @param xpath - Optional XPath expression
   * @returns String schema
   */
  string(xpath?: string): XmlStringSchema {
    return new XmlStringSchema(typeof xpath === 'string' ? { xpath } : undefined);
  }

  /**
   * Create a number schema
   * @param xpath - Optional XPath expression
   * @returns Number schema
   */
  number(xpath?: string): XmlNumberSchema {
    return new XmlNumberSchema(typeof xpath === 'string' ? { xpath } : undefined);
  }

  /**
   * Create an object schema
   * @param shape - Object shape definition
   * @param options - Optional object options
   * @returns Object schema
   */
  object<T extends XmlObjectShape>(shape: T, options?: XmlObjectOptions): XmlObjectSchema<T> {
    return new XmlObjectSchema(shape, options);
  }

  /**
   * Create an array schema
   * @param element - Element schema
   * @param xpath - XPath expression for array elements
   * @returns Array schema
   */
  array<T extends XmlSchema<unknown, unknown>>(element: T, xpath?: string): XmlArraySchema<T> {
    return new XmlArraySchema(element, xpath);
  }
}

/**
 * Singleton builder instance
 *
 * @public
 */
export const x = new XmlBuilder();