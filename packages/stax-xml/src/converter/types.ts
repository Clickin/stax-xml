import type { StaxXmlWriter } from '../StaxXmlWriter.js';
import type { StaxXmlWriterSync, StaxXmlWriterSyncSink } from '../StaxXmlWriterSync.js';
import type { DocumentMode } from '../types.js';

/**
 * Parse options for XML converter
 *
 * @public
 */
export interface ParseOptions {
  /**
   * Whether to trim whitespace from text content
   * @defaultValue false
   */
  trimText?: boolean;

  /**
   * Whether to decode XML entities
   * @defaultValue true
   */
  decodeEntities?: boolean;

  /**
   * Strict mode for parsing
   * @defaultValue false
   */
  strict?: boolean;

  /**
   * XML document conformance mode.
   *
   * @defaultValue 'fragment'
   */
  documentMode?: DocumentMode;

  /**
   * Maximum XML depth
   * @defaultValue 1000
   */
  maxDepth?: number;

  /**
   * Maximum number of events to process
   * @defaultValue 1000000
   */
  maxEvents?: number;

  /**
   * Namespace bindings used by XPath 1.0 prefix resolution.
   *
   * @remarks
   * XML default namespaces do not automatically apply to unprefixed XPath
   * element names, matching XPath 1.0 semantics. Bind a prefix here and use it
   * in XPath expressions when selecting namespaced elements.
   */
  xpathNamespaces?: Record<string, string>;

  /**
   * Optional structural-index acceleration for compiled converter parsing.
   *
   * @remarks
   * Backend load and capability failures fall back to the JavaScript iterable parser.
   * XML parse errors and structural-index ABI validation errors throw by default;
   * set `fallbackOnParseError` to true to retry the JavaScript parser for those
   * errors as well.
   */
  acceleration?: {
    backend?: 'auto' | 'js' | 'native' | 'wasm';
    simd?: 'auto-safe' | 'off' | 'avx2';
    fallbackOnLoadError?: boolean;
    fallbackOnParseError?: boolean;
  };
}

/**
 * Options for string schema
 *
 * @public
 */
export interface XmlStringOptions {
  /**
   * XPath expression to locate the element
   */
  xpath?: string;

  /**
   * Minimum string length
   */
  min?: number;

  /**
   * Maximum string length
   */
  max?: number;

  /**
   * Regular expression pattern to validate against
   */
  pattern?: RegExp;
}

/**
 * Options for number schema
 *
 * @public
 */
export interface XmlNumberOptions {
  /**
   * XPath expression to locate the element
   */
  xpath?: string;

  /**
   * Minimum value
   */
  min?: number;

  /**
   * Maximum value
   */
  max?: number;

  /**
   * Whether the number must be an integer
   * @defaultValue false
   */
  int?: boolean;
}

/**
 * Options for object schema
 *
 * @public
 */
export interface XmlObjectOptions {
  /**
   * XPath expression to locate the element
   */
  xpath?: string;

  /**
   * Strict mode - reject unknown properties
   * @defaultValue false
   */
  strict?: boolean;
}

/**
 * Writer configuration for XML element
 *
 * @public
 */
export interface XmlElementWriteConfig {
  /**
   * Element name (required)
   */
  element: string;

  /**
   * Write as attribute instead of element
   * Value is the attribute name
   */
  asAttribute?: string;

  /**
   * Namespace configuration
   */
  namespace?: {
    /**
     * Namespace prefix (e.g., 'dc', 'xsi')
     */
    prefix?: string;

    /**
     * Namespace URI (e.g., 'http://purl.org/dc/elements/1.1/')
     */
    uri?: string;
  };

  /**
   * Wrap content in CDATA section
   * @defaultValue false
   */
  cdata?: boolean;

  /**
   * Use self-closing tag for empty elements
   * @defaultValue false
   */
  selfClosing?: boolean;

  /**
   * Add XML comment before element
   */
  comment?: string;
}

/**
 * Options for XML writer
 *
 * @public
 */
export interface XmlWriteOptions {
  /**
   * Format output with indentation
   * @defaultValue false
   */
  prettyPrint?: boolean;

  /**
   * Indentation string
   * @defaultValue '  '
   */
  indentString?: string;

  /**
   * Text encoding for output
   * @defaultValue 'utf-8'
   */
  encoding?: string;

  /**
   * Root element name
   * If not provided, no root element wrapper is added
   */
  rootElement?: string;

  /**
   * Global namespace declarations
   */
  namespaces?: Array<{
    prefix: string;
    uri: string;
  }>;

  /**
   * Include XML declaration
   * @defaultValue true
   */
  includeDeclaration?: boolean;

  /**
   * XML version for declaration
   * @defaultValue '1.0'
   */
  xmlVersion?: string;

  /**
   * Custom writer instance
   * - StaxXmlWriterSync: for writeSync() method
   * - StaxXmlWriterSyncSink: for writeSync() with custom sink
   * - StaxXmlWriter: for write() async method
   */
  writer?: StaxXmlWriterSync | StaxXmlWriterSyncSink | StaxXmlWriter;
}

/**
 * Schema type constants for XML schema classification
 *
 * @public
 */
export const SchemaType = {
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  ARRAY: 'ARRAY',
  OBJECT: 'OBJECT',
  TRANSFORM: 'TRANSFORM',
  OPTIONAL: 'OPTIONAL'
} as const;

/**
 * Schema type union
 *
 * @public
 */
export type SchemaType = typeof SchemaType[keyof typeof SchemaType];

// Forward declarations for type guards (will be imported from schema files)
import type { XmlStringSchema } from './XmlStringSchema.js';
import type { XmlNumberSchema } from './XmlNumberSchema.js';
import type { XmlArraySchema } from './XmlArraySchema.js';
import type { XmlObjectSchema, XmlObjectShape } from './XmlObjectSchema.js';
import type { XmlTransformSchema } from './XmlTransformSchema.js';
import type { XmlOptionalSchema } from './XmlOptionalSchema.js';
import type { XmlSchemaBase } from './base.js';

/**
 * Core schema types (non-wrapper schemas)
 *
 * @public
 */
export type XmlCoreSchema =
  | XmlStringSchema
  | XmlNumberSchema
  | XmlArraySchema<XmlSchemaBase<unknown, unknown>>
  | XmlObjectSchema<XmlObjectShape>;

/**
 * Wrapper schema types (transform and optional)
 *
 * @public
 */
export type XmlWrappedSchema =
  | XmlTransformSchema<unknown, unknown>
  | XmlOptionalSchema<XmlSchemaBase<unknown, unknown>>;

/**
 * Any XML schema type
 *
 * @public
 */
export type AnyXmlSchema = XmlCoreSchema | XmlWrappedSchema;

/**
 * Type guard for string schema
 *
 * @public
 */
export function isStringSchema(schema: XmlSchemaBase<unknown, unknown>): schema is XmlStringSchema {
  return schema.schemaType === SchemaType.STRING;
}

/**
 * Type guard for number schema
 *
 * @public
 */
export function isNumberSchema(schema: XmlSchemaBase<unknown, unknown>): schema is XmlNumberSchema {
  return schema.schemaType === SchemaType.NUMBER;
}

/**
 * Type guard for array schema
 *
 * @public
 */
export function isArraySchema(schema: XmlSchemaBase<unknown, unknown>): schema is XmlArraySchema<XmlSchemaBase<unknown, unknown>> {
  return schema.schemaType === SchemaType.ARRAY;
}

/**
 * Type guard for object schema
 *
 * @public
 */
export function isObjectSchema(schema: XmlSchemaBase<unknown, unknown>): schema is XmlObjectSchema<XmlObjectShape> {
  return schema.schemaType === SchemaType.OBJECT;
}

/**
 * Type guard for transform schema
 *
 * @public
 */
export function isTransformSchema(schema: XmlSchemaBase<unknown, unknown>): schema is XmlTransformSchema<unknown, unknown> {
  return schema.schemaType === SchemaType.TRANSFORM;
}

/**
 * Type guard for optional schema
 *
 * @public
 */
export function isOptionalSchema(schema: XmlSchemaBase<unknown, unknown>): schema is XmlOptionalSchema<XmlSchemaBase<unknown, unknown>> {
  return schema.schemaType === SchemaType.OPTIONAL;
}
