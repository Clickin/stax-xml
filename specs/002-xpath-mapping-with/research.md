# Research Report: Zod-Style XML Mapping with Separate Converter Package

**Date**: 2024-09-24
**Feature**: Declarative XML schema mapping with TypeScript type inference
**Approach**: Zod-inspired API with monorepo architecture

## Research Summary

Based on comprehensive research into Zod's design patterns, TypeScript monorepo management, and streaming validation techniques, this report provides the technical foundation for implementing a Zod-inspired XML schema mapping system split across two packages: `stax-xml` (zero dependencies) and `@stax-xml/converter` (with dependencies).

## 1. Zod Schema Design Pattern Analysis

### Decision: Adopt Zod's Fluent Interface Architecture
**Rationale**: Zod's method chaining pattern provides excellent developer experience with automatic type inference while maintaining immutability and composability.

**Key Implementation Insights**:
- Each method returns a new schema instance (immutable pattern)
- Methods are chainable while maintaining type safety
- Type inference flows through the chain automatically via TypeScript conditional types

**XML Adaptation Pattern**:
```typescript
// Zod-inspired XML schema API
const BookSchema = xml.element('book').shape({
  id: xml.attr('id').transform(Number),
  title: xml.element('title').text(),
  price: xml.element('price').text().transform(parseFloat),
  author: xml.element('author').shape({
    name: xml.text(),
    id: xml.attr('id').transform(Number)
  }),
  chapters: xml.element('chapter').text().array()
});

type Book = xml.infer<typeof BookSchema>;
// Automatically infers: {
//   id: number;
//   title: string;
//   price: number;
//   author: { name: string; id: number };
//   chapters: string[];
// }
```

**Alternatives Considered**:
- **XPath-based approach**: Rejected due to complexity of multiple element mapping and performance concerns
- **Object-literal configuration**: Rejected due to lack of type inference and composability
- **Class-based builders**: Rejected due to verbosity and less intuitive chaining

### Implementation Architecture

**Base Schema Class Hierarchy**:
```typescript
abstract class XmlSchema<TInput, TOutput = TInput> {
  protected _def: SchemaDef;

  abstract _parse(input: any): TOutput;

  transform<U>(fn: (val: TOutput) => U): XmlSchema<TInput, U> {
    return new XmlTransformSchema(this, fn);
  }

  refine(fn: (val: TOutput) => boolean, message?: string): this {
    return new XmlRefineSchema(this, fn, message) as this;
  }
}

class XmlElementSchema<T> extends XmlSchema<XmlEvent, T> {
  shape<TShape>(shape: TShape): XmlObjectSchema<TShape> {
    return new XmlObjectSchema(this.elementName, shape);
  }

  attr<K extends string, V>(name: K, schema: XmlSchema<any, V>): XmlElementWithAttrSchema<T, K, V> {
    return new XmlElementWithAttrSchema(this.elementName, name, schema);
  }
}
```

## 2. Monorepo Management Strategy

### Decision: Use Bun Workspaces with TypeScript Project References
**Rationale**: Leverages existing Bun runtime while providing proper package isolation, type sharing, and build coordination.

**Directory Structure**:
```
stax-xml/
├── package.json                    # Root workspace configuration
├── packages/
│   ├── stax-xml/                  # Core package (zero deps)
│   │   ├── src/
│   │   │   ├── parser/            # Existing StaxXmlParser
│   │   │   ├── writer/            # Existing StaxXmlWriter
│   │   │   ├── types/             # Shared XML event types
│   │   │   └── index.ts
│   │   └── package.json           # Zero runtime dependencies
│   └── converter/                 # Converter package (@stax-xml/converter)
│       ├── src/
│       │   ├── schema/            # Zod-inspired schema system
│       │   ├── mappers/           # Sync/async mappers
│       │   ├── transforms/        # Data transformation utilities
│       │   └── index.ts
│       └── package.json           # Can have dependencies
```

**Package Separation Strategy**:
- **Core Package**: Pure XML parsing/writing with shared types, zero runtime dependencies
- **Converter Package**: Schema definition, validation, and mapping features with external dependencies
- **Type Sharing**: Use TypeScript project references and `workspace:*` dependencies

**Build Coordination**:
```json
{
  "scripts": {
    "build": "bun run build:packages",
    "build:packages": "tsc --build tsconfig.build.json",
    "test": "bun test packages/*/test/**/*.test.ts",
    "dev:core": "bun --watch packages/stax-xml/src/index.ts",
    "dev:converter": "bun --watch packages/converter/src/index.ts"
  }
}
```

**Alternatives Considered**:
- **Lerna**: Rejected due to overhead for simple two-package setup
- **Rush**: Rejected due to complexity for current project size
- **Separate repositories**: Rejected due to development workflow complications

## 3. Streaming Schema Validation Patterns

### Decision: Hierarchical State Machine with Adaptive Batching
**Rationale**: Maintains streaming performance while providing comprehensive validation with memory efficiency.

**State Management Architecture**:
```typescript
interface ValidationState {
  elementStack: ValidationContext[];
  currentSchema: SchemaNode;
  errorCollector: ValidationError[];
  bufferState: {
    pendingValidation: ValidationItem[];
    memoryThreshold: number;
  };
}

class StreamingValidator {
  private stateStack: ValidationState[] = [];
  private compiledRules: Map<string, CompiledRule>;

  validateStreamingEvent(event: AnyXmlEvent): ValidationResult {
    const currentState = this.getCurrentState();
    const transition = this.findTransition(currentState, event);
    return this.applyValidationRules(transition, event);
  }
}
```

**Smart Batching Strategy**:
```typescript
class SmartBatchCalculator {
  calculateOptimalBatchSize(bufferSize: number, validationComplexity: number): number {
    const baseSize = Math.min(this.options.maxBatchSize || 100, Math.floor(bufferSize / 1024));

    // Adjust based on validation complexity, error rate, and memory pressure
    const complexityFactor = Math.max(0.1, 1.0 - (validationComplexity / 100));
    const errorFactor = Math.max(0.5, 1.0 - this.metrics.errorRate);
    const memoryFactor = Math.max(0.3, 1.0 - this.metrics.memoryPressure);

    return Math.ceil(baseSize * complexityFactor * errorFactor * memoryFactor);
  }
}
```

**Memory Efficiency Techniques**:
- Circular buffer management for large XML files
- LRU cache for validation states and transitions
- Schema fragment compilation to finite state automata
- Incremental validation with bounded memory usage

**Alternatives Considered**:
- **Full DOM validation**: Rejected due to memory constraints for large XML files
- **Pull-based validation**: Rejected due to complexity with streaming architecture
- **External validation libraries**: Rejected due to zero-dependency constraint for core package

## 4. Zero-Dependency Library Architecture

### Decision: Pure TypeScript Core with Minimal Runtime Footprint
**Rationale**: Maintains library adoption by avoiding dependency conflicts while enabling rich ecosystem through separate packages.

**Core Package Constraints**:
- Zero runtime dependencies
- Pure TypeScript/JavaScript implementation
- Compatible with Node.js, Bun, and browsers via bundling
- Minimal API surface for maximum compatibility

**Extensibility Strategy**:
- Plugin architecture through converter package
- Type-only imports between packages where possible
- Runtime feature detection for optional enhancements
- Clear separation of concerns between parsing and validation

**Performance Optimization**:
- Leverage existing StAX parser optimizations (Boyer-Moore-Horspool search, UTF-8 boundary detection)
- Schema compilation to optimized validators
- Memory pooling for frequently created objects
- V8-optimized object shapes and hidden classes

## 5. Type Inference System Design

### Decision: Conditional Types with Template Literal Types
**Rationale**: Provides automatic TypeScript type inference without runtime overhead while maintaining type safety through complex schema compositions.

**Type Inference Implementation**:
```typescript
// Core type inference utilities
type InferSchemaType<T> = T extends XmlSchema<any, infer U> ? U : never;

type InferObjectShape<T> = {
  [K in keyof T]: T[K] extends XmlSchema<any, infer U> ? U : never;
};

type InferArrayType<T> = T extends XmlSchema<any, infer U> ? U[] : never;

// Usage with full type safety
const schema = xml.element('user').shape({
  name: xml.text(),
  age: xml.text().transform(Number),
  active: xml.attr('active').transform(Boolean)
});

type User = xml.infer<typeof schema>;
// Result: { name: string; age: number; active: boolean }
```

**Advanced Type Features**:
- Conditional schema types for polymorphic XML structures
- Union types for element variants
- Optional and nullable schema types
- Custom transformation type inference

## Implementation Roadmap

### Phase 1: Core Package Foundation
1. Extract shared types from existing StAX implementation
2. Implement base schema classes with type inference
3. Create fluent API factory functions
4. Set up monorepo structure and build system

### Phase 2: Schema System Implementation
1. Implement element, attribute, and text schema types
2. Add transformation and validation pipeline
3. Create schema composition and nesting support
4. Implement error handling and collection

### Phase 3: Streaming Integration
1. Integrate schema validation with StAX parser events
2. Implement smart batching and memory management
3. Add streaming mapper for async processing
4. Create synchronous wrapper for small XML files

### Phase 4: Advanced Features
1. Add conditional schemas and polymorphic types
2. Implement custom validation rules and refinements
3. Create schema introspection and documentation tools
4. Add performance monitoring and optimization

## Conclusion

The research supports adopting a Zod-inspired fluent API architecture with monorepo package separation. This approach provides excellent developer experience through automatic type inference while maintaining the zero-dependency philosophy of the core XML parser. The streaming validation system will leverage existing StAX optimizations while providing comprehensive validation capabilities through smart batching and memory-efficient state management.

The separation into `stax-xml` (core) and `@stax-xml/converter` (advanced features) packages provides the optimal balance between simplicity and functionality, allowing users to adopt minimal dependencies while enabling rich ecosystem development.