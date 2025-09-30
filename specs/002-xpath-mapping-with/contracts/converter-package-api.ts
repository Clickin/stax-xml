/**
 * Converter Package API Contract - @stax-xml/converter
 * Can have external dependencies
 * Schema definition, validation, and object mapping functionality
 */

import type {
  AnyXmlEvent,
  XMLElementValue,
  StaxXmlParser,
  StaxXmlParserOptions
} from 'stax-xml';

// Core schema interfaces
export interface XMLSchemaDef<TInput = any, TOutput = TInput> {
  type: XMLSchemaType;
  elementName?: string;
  attributeName?: string;
  namespace?: string;
  transform?: (value: any) => TOutput;
  refinements?: RefinementDef[];
  children?: Record<string, XMLSchema<any, any>>;
  arrayMode?: boolean;
  optional?: boolean;
  defaultValue?: TOutput;
}

export enum XMLSchemaType {
  ELEMENT = 'element',
  ATTRIBUTE = 'attribute',
  TEXT = 'text',
  CDATA = 'cdata',
  OBJECT = 'object',
  ARRAY = 'array',
  TRANSFORM = 'transform',
  REFINE = 'refine',
  OPTIONAL = 'optional',
  UNION = 'union'
}

export interface RefinementDef {
  predicate: (value: any) => boolean;
  message: string;
  path?: string[];
}

// Base schema class
export declare abstract class XMLSchema<TInput = any, TOutput = TInput> {
  protected _def: XMLSchemaDef<TInput, TOutput>;

  constructor(def: XMLSchemaDef<TInput, TOutput>);

  abstract _parse(input: ParseInput): ParseOutput<TOutput>;

  transform<U>(fn: (val: TOutput) => U): XMLSchema<TInput, U>;
  refine(predicate: (val: TOutput) => boolean, message?: string): XMLSchema<TInput, TOutput>;
  array(): XMLSchema<TInput, TOutput[]>;
  optional(): XMLSchema<TInput, TOutput | undefined>;

  static infer<T extends XMLSchema<any, any>>(schema: T): XMLInfer<T>;
}

// Concrete schema types
export declare class XMLElementSchema<TOutput = XMLElementValue> extends XMLSchema<AnyXmlEvent, TOutput> {
  constructor(elementName: string, namespace?: string);

  shape<TShape extends Record<string, XMLSchema<any, any>>>(
    shape: TShape
  ): XMLObjectSchema<XMLElementValue, InferObjectShape<TShape>>;

  attr<K extends string, V>(
    name: K,
    schema: XMLSchema<any, V>
  ): XMLElementWithAttrSchema<TOutput, K, V>;

  text<T = string>(schema?: XMLSchema<any, T>): XMLElementWithTextSchema<T>;
  cdata<T = string>(schema?: XMLSchema<any, T>): XMLElementWithCDataSchema<T>;
}

export declare class XMLAttributeSchema<TOutput = string> extends XMLSchema<AnyXmlEvent, TOutput> {
  constructor(attributeName: string, namespace?: string);
}

export declare class XMLTextSchema<TOutput = string> extends XMLSchema<AnyXmlEvent, TOutput> {
  constructor();
}

export declare class XMLObjectSchema<TInput, TOutput> extends XMLSchema<TInput, TOutput> {
  constructor(elementName: string, shape: Record<string, XMLSchema<any, any>>);
}

export declare class XMLArraySchema<TInput, TOutput extends any[]> extends XMLSchema<TInput, TOutput> {
  constructor(itemSchema: XMLSchema<any, any>);
}

// Parse types
export interface ParseInput {
  events: AnyXmlEvent[];
  context: ParseContext;
  position: number;
}

export interface ParseOutput<T> {
  success: boolean;
  data?: T;
  error?: XMLValidationError;
  consumed?: number;
}

export interface ParseContext {
  elementStack: string[];
  namespaceResolver: Map<string, string>;
  currentElement?: import('stax-xml').StartElementEvent;
  textBuffer: string;
  attributes: Map<string, string>;
}

// Validation types
export declare class XMLValidationError extends Error {
  public readonly code: string;
  public readonly path: string[];
  public readonly context: any;

  constructor(message: string, context?: any);
}

export interface ValidationResult {
  success: boolean;
  errors: XMLValidationError[];
  warnings: string[];
  data?: any;
}

// Factory function interface
export interface XMLFactory {
  // Element factories
  element(name: string, namespace?: string): XMLElementSchema;
  attr(name: string, namespace?: string): XMLAttributeSchema;

  // Content factories
  text(): XMLTextSchema;
  cdata(): XMLTextSchema;

  // Primitive type factories
  string(): XMLTextSchema<string>;
  number(): XMLTextSchema<number>;
  boolean(): XMLTextSchema<boolean>;
  date(): XMLTextSchema<Date>;

  // Utility functions
  array<T>(schema: XMLSchema<any, T>): XMLArraySchema<any, T[]>;
  optional<T>(schema: XMLSchema<any, T>): XMLSchema<any, T | undefined>;
  union<T extends readonly XMLSchema<any, any>[]>(...schemas: T): XMLUnionSchema<T>;

  // Type inference utility
  infer<T extends XMLSchema<any, any>>(schema: T): XMLInfer<T>;
}

export declare const xml: XMLFactory;

// Streaming mapper interfaces
export interface StreamingMapperOptions {
  batchSize?: number;
  maxMemoryMB?: number;
  stopOnError?: boolean;
  collectErrors?: boolean;
}

export declare class XMLStreamingMapper<T> {
  constructor(schema: XMLSchema<any, T>, options?: StreamingMapperOptions);

  mapAsync(xmlStream: ReadableStream<Uint8Array>): AsyncGenerator<T>;
  mapBatch(events: AnyXmlEvent[]): Promise<T[]>;

  getValidationErrors(): XMLValidationError[];
  getParsingStats(): ParsingStats;
}

export declare class XMLSyncMapper<T> {
  constructor(schema: XMLSchema<any, T>, options?: SyncMapperOptions);

  mapSync(xmlString: string): T;
  mapEvents(events: AnyXmlEvent[]): T;
  validate(data: T): ValidationResult;
}

export interface SyncMapperOptions {
  stopOnError?: boolean;
  collectErrors?: boolean;
}

export interface ParsingStats {
  elementsProcessed: number;
  attributesProcessed: number;
  errorsEncountered: number;
  processingTimeMs: number;
  memoryUsedMB: number;
}

// Schema parser integration
export declare class XMLSchemaParser<T> {
  constructor(schema: XMLSchema<any, T>, options?: XMLSchemaParserOptions);

  parseStream(xmlStream: ReadableStream<Uint8Array>): Promise<T>;
  parseSync(xmlString: string): T;

  validate(xmlStream: ReadableStream<Uint8Array>): Promise<ValidationResult>;
  validateSync(xmlString: string): ValidationResult;
}

export interface XMLSchemaParserOptions {
  parserOptions?: StaxXmlParserOptions;
  stopOnError?: boolean;
  collectAllErrors?: boolean;
  maxErrors?: number;
}

// Type inference utilities
export type XMLInfer<T> = T extends XMLSchema<any, infer U> ? U : never;

export type InferObjectShape<T> = {
  [K in keyof T]: T[K] extends XMLSchema<any, infer U> ? U : never;
};

export type InferArrayType<T> = T extends XMLSchema<any, infer U> ? U[] : never;

export type InferOptional<T> = T extends XMLSchema<any, infer U> ? U | undefined : never;

export type InferTransform<T, F> = F extends (val: any) => infer R ? R : never;

export type InferUnion<T extends readonly XMLSchema<any, any>[]> =
  T[number] extends XMLSchema<any, infer U> ? U : never;

// Advanced schema types (type-only exports)
export type XMLElementWithAttrSchema<TOutput, K extends string, V> =
  XMLSchema<AnyXmlEvent, TOutput & Record<K, V>>;

export type XMLElementWithTextSchema<T> = XMLSchema<AnyXmlEvent, T>;

export type XMLElementWithCDataSchema<T> = XMLSchema<AnyXmlEvent, T>;

export type XMLUnionSchema<T extends readonly XMLSchema<any, any>[]> =
  XMLSchema<AnyXmlEvent, InferUnion<T>>;

// Utility functions
export declare function when<T>(
  condition: (context: any) => boolean,
  schema: XMLSchema<any, T>
): ConditionalSchema<T>;

export declare function lazy<T>(
  factory: () => XMLSchema<any, T>
): LazySchema<T>;

export declare function preprocess<T, U>(
  preprocessor: (input: T) => U,
  schema: XMLSchema<any, U>
): PreprocessSchema<T, U>;

// Advanced schema types (implementation classes)
export declare class ConditionalSchema<T> extends XMLSchema<any, T> {
  constructor(condition: (context: any) => boolean, schema: XMLSchema<any, T>);
}

export declare class LazySchema<T> extends XMLSchema<any, T> {
  constructor(factory: () => XMLSchema<any, T>);
}

export declare class PreprocessSchema<T, U> extends XMLSchema<T, U> {
  constructor(preprocessor: (input: T) => U, schema: XMLSchema<any, U>);
}