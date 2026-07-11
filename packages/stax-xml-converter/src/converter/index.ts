/**
 * Declarative XML Converter Module
 *
 * @remarks
 * This module provides a zod-style declarative API for parsing XML documents.
 * It allows you to define XML schemas using a fluent API and parse XML with XPath support.
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { x } from 'stax-xml/converter';
 *
 * const schema = x.object({
 *   title: x.string().xpath('/book/title'),
 *   author: x.string().xpath('/book/author'),
 *   price: x.number().xpath('/book/price')
 * });
 *
 * const xml = '<book><title>TypeScript</title><author>John</author><price>29.99</price></book>';
 * const result = await schema.parse(xml);
 * // { title: 'TypeScript', author: 'John', price: 29.99 }
 * ```
 *
 * @packageDocumentation
 */

// Initialize factory methods to avoid circular dependency
import { XmlSchemaBase } from './base.js';
import { XmlTransformSchema } from './XmlTransformSchema.js';
import { XmlOptionalSchema } from './XmlOptionalSchema.js';
import { XmlArraySchema } from './XmlArraySchema.js';
import { XmlSchema } from './XmlSchema.js';
import {
  tryParseAsyncWithCompiledPlan,
  tryParseWithCompiledPlan
} from './CompiledXmlSchema.js';


XmlSchemaBase._createTransform = (schema, fn) => new XmlTransformSchema(schema, fn);
XmlSchemaBase._createOptional = (schema) => new XmlOptionalSchema(schema);
XmlSchemaBase._createArray = (schema, xpath) => new XmlArraySchema(schema, xpath);
XmlSchemaBase._tryParseWithCompiledPlan = tryParseWithCompiledPlan;
XmlSchemaBase._tryParseAsyncWithCompiledPlan = tryParseAsyncWithCompiledPlan;


export { x } from './XmlBuilder.js';
export type {
  XmlElementWriteConfig,
  XmlWriteOptions,
  ParseOptions,
  XmlStringOptions,
  XmlNumberOptions,
  XmlObjectOptions
} from './types.js';
export { XmlParseError, type ParseResult } from './errors.js';
export type { ParseInput } from './base.js';

export type Infer<T extends XmlSchema<unknown, unknown>> = T['_output'];
