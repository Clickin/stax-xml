# Data Model: Zod-Style XML Schema System

**Date**: 2024-09-24
**Feature**: Declarative XML schema mapping with TypeScript type inference
**Architecture**: Monorepo with core package (zero deps) + converter package (with deps)

## Overview

This document defines the core data models and entities for the Zod-inspired XML schema system. The design separates concerns between the zero-dependency core parsing functionality and the feature-rich converter package while maintaining type safety and performance.

## Package Architecture

### Core Package (`stax-xml`)
- **Purpose**: Zero-dependency XML parsing and writing
- **Exports**: XML event types, parser/writer classes, basic utilities
- **Dependencies**: None (runtime)
- **Target**: Maximum compatibility and adoption

### Converter Package (`@stax-xml/converter`)
- **Purpose**: Schema definition, validation, and object mapping
- **Exports**: Schema builders, mappers, validation utilities
- **Dependencies**: External libraries allowed
- **Target**: Rich developer experience and advanced features

## Core Data Models

### 1. XML Schema Base Types

#### XMLSchema Base Class
```typescript
abstract class XMLSchema<TInput = any, TOutput = TInput> {
  protected _def: SchemaDef<TInput, TOutput>;

  constructor(def: SchemaDef<TInput, TOutput>) {
    this._def = def;
  }

  // Core parsing method - implemented by subclasses
  abstract _parse(input: ParseInput): ParseOutput<TOutput>;

  // Transformation pipeline
  transform<U>(fn: (val: TOutput) => U): XMLTransformSchema<TInput, U> {
    return new XMLTransformSchema(this, fn);
  }

  // Validation refinement
  refine(predicate: (val: TOutput) => boolean, message?: string): XMLRefineSchema<TInput, TOutput> {
    return new XMLRefineSchema(this, predicate, message);
  }

  // Array wrapper
  array(): XMLArraySchema<TInput, TOutput[]> {
    return new XMLArraySchema(this);
  }

  // Optional wrapper
  optional(): XMLOptionalSchema<TInput, TOutput | undefined> {
    return new XMLOptionalSchema(this);
  }

  // Type inference utility
  static infer<T extends XMLSchema<any, any>>(schema: T): XMLInfer<T> {
    return {} as XMLInfer<T>;
  }
}
```

#### Schema Definition Structure
```typescript
interface SchemaDef<TInput = any, TOutput = any> {
  type: XMLSchemaType;
  elementName?: string;
  attributeName?: string;
  namespace?: string;
  transform?: (value: any) => any;
  refinements?: RefinementDef[];
  children?: Record<string, XMLSchema<any, any>>;
  arrayMode?: boolean;
  optional?: boolean;
  defaultValue?: TOutput;
}

enum XMLSchemaType {
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

interface RefinementDef {
  predicate: (value: any) => boolean;
  message: string;
  path?: string[];
}
```

### 2. Concrete Schema Types

#### XMLElementSchema
```typescript
class XMLElementSchema<TOutput = XMLElementValue> extends XMLSchema<XMLEvent, TOutput> {
  constructor(elementName: string, namespace?: string) {
    super({
      type: XMLSchemaType.ELEMENT,
      elementName,
      namespace
    });
  }

  // Define element structure
  shape<TShape extends Record<string, XMLSchema<any, any>>>(
    shape: TShape
  ): XMLObjectSchema<XMLElementValue, InferObjectShape<TShape>> {
    return new XMLObjectSchema(this._def.elementName!, shape);
  }

  // Add attribute schema
  attr<K extends string, V>(
    name: K,
    schema: XMLSchema<any, V>
  ): XMLElementWithAttrSchema<TOutput, K, V> {
    return new XMLElementWithAttrSchema(this, name, schema);
  }

  // Extract text content
  text<T = string>(schema?: XMLSchema<any, T>): XMLElementWithTextSchema<T> {
    return new XMLElementWithTextSchema(this._def.elementName!, schema || xml.string());
  }

  // Extract CDATA content
  cdata<T = string>(schema?: XMLSchema<any, T>): XMLElementWithCDataSchema<T> {
    return new XMLElementWithCDataSchema(this._def.elementName!, schema || xml.string());
  }

  _parse(input: ParseInput): ParseOutput<TOutput> {
    return this.parseElement(input);
  }
}
```

#### XMLAttributeSchema
```typescript
class XMLAttributeSchema<TOutput = string> extends XMLSchema<XMLEvent, TOutput> {
  constructor(attributeName: string, namespace?: string) {
    super({
      type: XMLSchemaType.ATTRIBUTE,
      attributeName,
      namespace
    });
  }

  _parse(input: ParseInput): ParseOutput<TOutput> {
    return this.parseAttribute(input);
  }
}
```

#### XMLTextSchema & XMLCDataSchema
```typescript
class XMLTextSchema<TOutput = string> extends XMLSchema<XMLEvent, TOutput> {
  constructor() {
    super({ type: XMLSchemaType.TEXT });
  }

  _parse(input: ParseInput): ParseOutput<TOutput> {
    return this.parseText(input);
  }
}

class XMLCDataSchema<TOutput = string> extends XMLSchema<XMLEvent, TOutput> {
  constructor() {
    super({ type: XMLSchemaType.CDATA });
  }

  _parse(input: ParseInput): ParseOutput<TOutput> {
    return this.parseCData(input);
  }
}
```

### 3. Composite Schema Types

#### XMLObjectSchema
```typescript
class XMLObjectSchema<TInput, TOutput> extends XMLSchema<TInput, TOutput> {
  private shape: Record<string, XMLSchema<any, any>>;

  constructor(elementName: string, shape: Record<string, XMLSchema<any, any>>) {
    super({
      type: XMLSchemaType.OBJECT,
      elementName,
      children: shape
    });
    this.shape = shape;
  }

  _parse(input: ParseInput): ParseOutput<TOutput> {
    return this.parseObject(input);
  }
}
```

#### XMLArraySchema
```typescript
class XMLArraySchema<TInput, TOutput extends any[]> extends XMLSchema<TInput, TOutput> {
  private itemSchema: XMLSchema<any, any>;

  constructor(itemSchema: XMLSchema<any, any>) {
    super({
      type: XMLSchemaType.ARRAY,
      arrayMode: true
    });
    this.itemSchema = itemSchema;
  }

  _parse(input: ParseInput): ParseOutput<TOutput> {
    return this.parseArray(input);
  }
}
```

### 4. Transformation and Validation Types

#### XMLTransformSchema
```typescript
class XMLTransformSchema<TInput, TOutput> extends XMLSchema<TInput, TOutput> {
  private baseSchema: XMLSchema<TInput, any>;
  private transformer: (value: any) => TOutput;

  constructor(baseSchema: XMLSchema<TInput, any>, transformer: (value: any) => TOutput) {
    super({
      type: XMLSchemaType.TRANSFORM,
      transform: transformer
    });
    this.baseSchema = baseSchema;
    this.transformer = transformer;
  }

  _parse(input: ParseInput): ParseOutput<TOutput> {
    const baseResult = this.baseSchema._parse(input);
    if (!baseResult.success) return baseResult;

    try {
      return { success: true, data: this.transformer(baseResult.data) };
    } catch (error) {
      return { success: false, error: new XMLValidationError('Transform failed', error) };
    }
  }
}
```

#### XMLRefineSchema
```typescript
class XMLRefineSchema<TInput, TOutput> extends XMLSchema<TInput, TOutput> {
  private baseSchema: XMLSchema<TInput, TOutput>;
  private predicate: (value: TOutput) => boolean;
  private message: string;

  constructor(
    baseSchema: XMLSchema<TInput, TOutput>,
    predicate: (value: TOutput) => boolean,
    message: string = 'Validation failed'
  ) {
    super({
      type: XMLSchemaType.REFINE,
      refinements: [{ predicate, message }]
    });
    this.baseSchema = baseSchema;
    this.predicate = predicate;
    this.message = message;
  }

  _parse(input: ParseInput): ParseOutput<TOutput> {
    const baseResult = this.baseSchema._parse(input);
    if (!baseResult.success) return baseResult;

    if (!this.predicate(baseResult.data)) {
      return {
        success: false,
        error: new XMLValidationError(this.message, { value: baseResult.data })
      };
    }

    return baseResult;
  }
}
```

## 5. Factory Functions and API Surface

### XML Schema Factory
```typescript
export const xml = {
  // Element factories
  element: (name: string, namespace?: string) => new XMLElementSchema(name, namespace),

  // Attribute factory
  attr: (name: string, namespace?: string) => new XMLAttributeSchema(name, namespace),

  // Content factories
  text: () => new XMLTextSchema(),
  cdata: () => new XMLCDataSchema(),

  // Primitive type factories with built-in transformations
  string: () => new XMLTextSchema<string>(),
  number: () => new XMLTextSchema<string>().transform(Number),
  boolean: () => new XMLTextSchema<string>().transform(val => val.toLowerCase() === 'true'),
  date: () => new XMLTextSchema<string>().transform(val => new Date(val)),

  // Utility functions
  array: <T>(schema: XMLSchema<any, T>) => schema.array(),
  optional: <T>(schema: XMLSchema<any, T>) => schema.optional(),
  union: <T extends readonly XMLSchema<any, any>[]>(...schemas: T) => new XMLUnionSchema(schemas),

  // Type inference utility
  infer: XMLSchema.infer
};
```

### Advanced Schema Builders
```typescript
// Conditional schema selection
export function when<T>(
  condition: (context: any) => boolean,
  schema: XMLSchema<any, T>
): ConditionalSchema<T> {
  return new ConditionalSchema(condition, schema);
}

// Lazy schema evaluation for recursive structures
export function lazy<T>(
  factory: () => XMLSchema<any, T>
): LazySchema<T> {
  return new LazySchema(factory);
}

// Schema preprocessing
export function preprocess<T, U>(
  preprocessor: (input: T) => U,
  schema: XMLSchema<any, U>
): PreprocessSchema<T, U> {
  return new PreprocessSchema(preprocessor, schema);
}
```

## 6. Parse Context and State Management

### ParseInput and ParseOutput Types
```typescript
interface ParseInput {
  events: XMLEvent[];
  context: ParseContext;
  position: number;
}

interface ParseOutput<T> {
  success: boolean;
  data?: T;
  error?: XMLValidationError;
  consumed?: number;
}

interface ParseContext {
  elementStack: string[];
  namespaceResolver: Map<string, string>;
  currentElement?: StartElementEvent;
  textBuffer: string;
  attributes: Map<string, string>;
}
```

### Validation Error Types
```typescript
class XMLValidationError extends Error {
  public readonly code: string;
  public readonly path: string[];
  public readonly context: any;

  constructor(message: string, context?: any) {
    super(message);
    this.name = 'XMLValidationError';
    this.context = context;
    this.path = context?.path || [];
    this.code = context?.code || 'VALIDATION_ERROR';
  }
}

interface ValidationResult {
  success: boolean;
  errors: XMLValidationError[];
  warnings: string[];
  data?: any;
}
```

## 7. Streaming Integration Types

### Streaming Mapper Interfaces
```typescript
interface StreamingMapper<T> {
  mapAsync(xmlStream: ReadableStream<Uint8Array>): AsyncGenerator<T>;
  mapBatch(events: XMLEvent[]): Promise<T[]>;
  getValidationErrors(): XMLValidationError[];
}

interface SyncMapper<T> {
  mapSync(xmlString: string): T;
  mapEvents(events: XMLEvent[]): T;
  validate(data: T): ValidationResult;
}
```

### Parser Integration
```typescript
class XMLSchemaParser<T> {
  constructor(
    private schema: XMLSchema<any, T>,
    private options: XMLSchemaParserOptions = {}
  ) {}

  async parseStream(xmlStream: ReadableStream<Uint8Array>): Promise<T> {
    const parser = new StaxXmlParser(xmlStream, this.options.parserOptions);
    const events: XMLEvent[] = [];

    for await (const event of parser) {
      events.push(event);
    }

    const parseResult = this.schema._parse({
      events,
      context: this.createParseContext(),
      position: 0
    });

    if (!parseResult.success) {
      throw parseResult.error;
    }

    return parseResult.data!;
  }

  parseSync(xmlString: string): T {
    // Implementation for synchronous parsing
    return this.parseFromString(xmlString);
  }
}
```

## 8. Type Inference System

### Core Type Inference Utilities
```typescript
// Primary type inference for schemas
type XMLInfer<T> = T extends XMLSchema<any, infer U> ? U : never;

// Object shape inference
type InferObjectShape<T> = {
  [K in keyof T]: T[K] extends XMLSchema<any, infer U> ? U : never;
};

// Array type inference
type InferArrayType<T> = T extends XMLSchema<any, infer U> ? U[] : never;

// Optional type inference
type InferOptional<T> = T extends XMLSchema<any, infer U> ? U | undefined : never;

// Transform type inference
type InferTransform<T, F> = F extends (val: any) => infer R ? R : never;

// Union type inference
type InferUnion<T extends readonly XMLSchema<any, any>[]> =
  T[number] extends XMLSchema<any, infer U> ? U : never;
```

### Advanced Type System Features
```typescript
// Conditional type inference for polymorphic schemas
type InferConditional<T> = T extends ConditionalSchema<infer U> ? U : never;

// Recursive type inference for nested structures
type InferRecursive<T> = T extends LazySchema<infer U> ? U : never;

// Branded types for primitive transformations
type BrandedNumber = number & { __brand: 'XMLNumber' };
type BrandedDate = Date & { __brand: 'XMLDate' };
```

## Entity Relationships

```
XMLSchema (abstract base)
├── XMLElementSchema
│   ├── XMLElementWithAttrSchema
│   ├── XMLElementWithTextSchema
│   └── XMLElementWithCDataSchema
├── XMLAttributeSchema
├── XMLTextSchema
├── XMLCDataSchema
├── XMLObjectSchema
├── XMLArraySchema
├── XMLTransformSchema
├── XMLRefineSchema
├── XMLOptionalSchema
└── XMLUnionSchema

ParseInput → ParseContext → XMLSchemaParser → ParseOutput<T>
                ↓
        ValidationResult → XMLValidationError[]
```

## Validation Rules and State Transitions

1. **Element Validation**: Element name matching, namespace resolution
2. **Attribute Validation**: Required attributes, type conversion, refinement rules
3. **Content Validation**: Text/CDATA extraction, transformation pipeline
4. **Structure Validation**: Nested element validation, array element collection
5. **Cross-Reference Validation**: Optional elements, conditional schemas

## Performance Considerations

1. **Schema Compilation**: Pre-compile schemas to optimized validators
2. **Memory Management**: Use object pooling for frequently created parse contexts
3. **Type Cache**: Cache inferred types to avoid recomputation
4. **Streaming Efficiency**: Maintain constant memory usage during large file processing
5. **Validation Short-Circuiting**: Stop validation early on fatal errors when configured

This data model provides the foundation for a type-safe, performant XML schema system that maintains the streaming capabilities of the existing StAX parser while providing a modern, Zod-inspired developer experience.