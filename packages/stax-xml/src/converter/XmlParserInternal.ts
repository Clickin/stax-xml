import { StaxXmlParser } from '../StaxXmlParser.js';
import { StaxXmlParserSync } from '../StaxXmlParserSync.js';
import {
  isCdata,
  isCharacters,
  isEndElement,
  isStartElement,
  type AnyXmlEvent,
  type StartElementEvent
} from '../types.js';
import { XPathMatcher } from './XPathEngine.js';
import {
  XmlParsingStateMachine,
  type ArrayCollector,
  type Collector,
  type NumberCollector,
  type ObjectCollector,
  type SchemaActivation,
  type StringCollector
} from './XmlParsingStateMachine.js';
import type { ParseInput } from './XmlSchema.js';
import { XmlSchemaBase } from './base.js';
import type { ParseOptions } from './types.js';
import {
  isArraySchema,
  isNumberSchema,
  isObjectSchema,
  isOptionalSchema,
  isStringSchema,
  isTransformSchema
} from './types.js';


/**
 * Internal parser implementation
 * Handles both sync and async parsing with XPath support
 *
 * @internal
 */
export class XmlParserInternal {
  private options?: ParseOptions;

  constructor(options?: ParseOptions) {
    this.options = options;
  }

  /**
   * Parse string value asynchronously
   */
  async parseStringAsync(
    input: ParseInput,
    schemaOptions: { xpath?: string }
  ): Promise<string> {
    const xpath = schemaOptions.xpath;

    if (!xpath) {
      // No XPath - just get first text content
      const parser = this.createParser(input);
      for await (const event of parser) {
        if (isCharacters(event) || isCdata(event)) {
          return this.decodeText(event.value);
        }
      }
      return '';
    }

    // Use State Machine for XPath matching
    const parser = this.createParser(input);
    const stateMachine = new XmlParsingStateMachine(this.options);
    const collector: StringCollector = { type: 'string', buffer: '' };

    // Create a dummy schema object for registration with schemaType
    const dummySchema = {
      schemaType: 'STRING' as const,
      constructor: { name: 'XmlStringSchema' }
    };
    stateMachine.registerSchema(dummySchema as unknown as XmlSchemaBase<unknown, unknown>, xpath, collector);

    for await (const event of parser) {
      await stateMachine.processEvent(event);
    }

    return this.decodeText(collector.value ?? '');
  }

  /**
   * Parse string value synchronously
   */
  parseString(input: string, schemaOptions: { xpath?: string }): string {
    const xpath = schemaOptions.xpath;
    const parser = new StaxXmlParserSync(input, {
      autoDecodeEntities: this.options?.decodeEntities
    });

    if (!xpath) {
      for (const event of parser) {
        if (isCharacters(event) || isCdata(event)) {
          return this.decodeText(event.value);
        }
      }
      return '';
    }

    // Use State Machine for XPath matching
    const stateMachine = new XmlParsingStateMachine(this.options);
    const collector: StringCollector = { type: 'string', buffer: '' };

    const dummySchema = {
      schemaType: 'STRING' as const,
      constructor: { name: 'XmlStringSchema' }
    };
    stateMachine.registerSchema(dummySchema as unknown as XmlSchemaBase<unknown, unknown>, xpath, collector);

    for (const event of parser) {
      stateMachine.processEventSync(event);
    }

    return this.decodeText(collector.value ?? '');
  }

  /**
   * Parse object asynchronously
   */
  async parseObjectAsync<T>(
    input: ParseInput,
    shape: Record<string, XmlSchemaBase<unknown, unknown>>,
    schemaOptions: { xpath?: string }
  ): Promise<T> {
    const parser = this.createParser(input);
    const stateMachine = new XmlParsingStateMachine(this.options);
    const collectors = new Map<string, Collector<unknown>>();
    const fieldSchemas = new Map<string, XmlSchemaBase<unknown, unknown>>();

    // Register all field schemas
    for (const [fieldName, fieldSchema] of Object.entries(shape)) {
      const xpath = this.extractXPath(fieldSchema);
      const unwrapped = this.unwrapSchema(fieldSchema);
      const schemaType = unwrapped?.constructor?.name;

      // Special case: Object schema without its own XPath
      // Register its child fields instead
      if (!xpath && schemaType === 'XmlObjectSchema') {
        const objectCollector: ObjectCollector = { type: 'object', fields: new Map() };
        const objectShape = (unwrapped as any).shape as Record<string, XmlSchemaBase<unknown, unknown>>;

        // Register child field schemas with absolute XPaths
        for (const [childFieldName, childFieldSchema] of Object.entries(objectShape)) {
          const childXPath = this.extractXPath(childFieldSchema);
          if (!childXPath) continue;

          const childCollector = this.createCollectorForSchema(childFieldSchema);
          stateMachine.registerSchema(childFieldSchema, childXPath, childCollector, undefined, childFieldName);
          objectCollector.fields.set(childFieldName, childCollector);
        }

        collectors.set(fieldName, objectCollector);
        fieldSchemas.set(fieldName, fieldSchema);
        continue;
      }

      // Special case: Array schema without its own XPath
      // Check if element schema has XPath and use that instead
      if (!xpath && schemaType === 'XmlArraySchema') {
        const elementSchema = (unwrapped as any).element;
        if (elementSchema) {
          const elementXPath = this.extractXPath(elementSchema);
          if (elementXPath) {
            const collector: ArrayCollector<unknown> = { type: 'array', items: [] };
            stateMachine.registerSchema(fieldSchema, elementXPath, collector, undefined, fieldName);
            collectors.set(fieldName, collector);
            fieldSchemas.set(fieldName, fieldSchema);
            continue;
          }
        }
      }

      if (!xpath) continue;

      let collector: Collector<unknown>;

      if (schemaType === 'XmlArraySchema') {
        collector = { type: 'array', items: [] } as ArrayCollector<unknown>;
      } else if (schemaType === 'XmlStringSchema') {
        collector = { type: 'string', buffer: '' } as StringCollector;
      } else if (schemaType === 'XmlNumberSchema') {
        collector = { type: 'number', buffer: '' } as NumberCollector;
      } else if (schemaType === 'XmlObjectSchema') {
        collector = { type: 'object', fields: new Map() } as ObjectCollector;
      } else {
        // Fallback: treat as string
        collector = { type: 'string', buffer: '' } as StringCollector;
      }

      stateMachine.registerSchema(fieldSchema, xpath, collector, undefined, fieldName);
      collectors.set(fieldName, collector);
      fieldSchemas.set(fieldName, fieldSchema);
    }

    // Process events
    for await (const event of parser) {
      await stateMachine.processEvent(event);
    }

    // Extract results from collectors
    const result: Record<string, unknown> = {};
    for (const [fieldName, collector] of collectors) {
      const fieldSchema = fieldSchemas.get(fieldName)!;
      result[fieldName] = this.extractValueFromCollector(collector, fieldSchema);
    }

    return result as T;
  }

  /**
   * Parse object synchronously
   */
  parseObject<T>(
    input: string,
    shape: Record<string, XmlSchemaBase<unknown, unknown>>,
    schemaOptions: { xpath?: string }
  ): T {
    const parser = new StaxXmlParserSync(input, {
      autoDecodeEntities: this.options?.decodeEntities
    });

    const stateMachine = new XmlParsingStateMachine(this.options);
    const collectors = new Map<string, Collector<unknown>>();
    const fieldSchemas = new Map<string, XmlSchemaBase<unknown, unknown>>();

    // Register all field schemas
    for (const [fieldName, fieldSchema] of Object.entries(shape)) {
      const xpath = this.extractXPath(fieldSchema);
      const unwrapped = this.unwrapSchema(fieldSchema);
      const schemaType = unwrapped?.constructor?.name;

      // Special case: Object schema without its own XPath
      // Register its child fields instead
      if (!xpath && schemaType === 'XmlObjectSchema') {
        const objectCollector: ObjectCollector = { type: 'object', fields: new Map() };
        const objectShape = (unwrapped as any).shape as Record<string, XmlSchemaBase<unknown, unknown>>;

        // Register child field schemas with absolute XPaths
        for (const [childFieldName, childFieldSchema] of Object.entries(objectShape)) {
          const childXPath = this.extractXPath(childFieldSchema);
          if (!childXPath) continue;

          const childCollector = this.createCollectorForSchema(childFieldSchema);
          stateMachine.registerSchema(childFieldSchema, childXPath, childCollector, undefined, childFieldName);
          objectCollector.fields.set(childFieldName, childCollector);
        }

        collectors.set(fieldName, objectCollector);
        fieldSchemas.set(fieldName, fieldSchema);
        continue;
      }

      // Special case: Array schema without its own XPath
      // Check if element schema has XPath and use that instead
      if (!xpath && schemaType === 'XmlArraySchema') {
        const elementSchema = (unwrapped as any).element;
        if (elementSchema) {
          const elementXPath = this.extractXPath(elementSchema);
          if (elementXPath) {
            const collector: ArrayCollector<unknown> = { type: 'array', items: [] };
            stateMachine.registerSchema(fieldSchema, elementXPath, collector, undefined, fieldName);
            collectors.set(fieldName, collector);
            fieldSchemas.set(fieldName, fieldSchema);
            continue;
          }
        }
      }

      if (!xpath) continue;

      let collector: Collector<unknown>;

      if (schemaType === 'XmlArraySchema') {
        collector = { type: 'array', items: [] } as ArrayCollector<unknown>;
      } else if (schemaType === 'XmlStringSchema') {
        collector = { type: 'string', buffer: '' } as StringCollector;
      } else if (schemaType === 'XmlNumberSchema') {
        collector = { type: 'number', buffer: '' } as NumberCollector;
      } else if (schemaType === 'XmlObjectSchema') {
        collector = { type: 'object', fields: new Map() } as ObjectCollector;
      } else {
        // Fallback: treat as string
        collector = { type: 'string', buffer: '' } as StringCollector;
      }

      stateMachine.registerSchema(fieldSchema, xpath, collector, undefined, fieldName);
      collectors.set(fieldName, collector);
      fieldSchemas.set(fieldName, fieldSchema);
    }

    // Process events
    for (const event of parser) {
      stateMachine.processEventSync(event);
    }

    // Extract results from collectors
    const result: Record<string, unknown> = {};
    for (const [fieldName, collector] of collectors) {
      const fieldSchema = fieldSchemas.get(fieldName)!;
      result[fieldName] = this.extractValueFromCollector(collector, fieldSchema);
    }

    return result as T;
  }

  /**
   * Parse object from current iterator position (sync)
   * Used for recursive parsing without restarting the stream
   */
  parseObjectFromPositionSync<T>(
    iterator: Iterator<AnyXmlEvent>,
    startEvent: StartElementEvent,
    startDepth: number,
    shape: Record<string, XmlSchemaBase<unknown, unknown>>,
    schemaOptions: { xpath?: string },
    stateMachine?: XmlParsingStateMachine,
    parentContext?: SchemaActivation
  ): T {
    // Use provided State Machine or create new one
    const sm = stateMachine || new XmlParsingStateMachine(this.options);

    // If parentContext has a collector, it might be pre-populated by State Machine
    // Otherwise create a new collector
    const rootCollector: ObjectCollector = (parentContext?.collector && parentContext.collector.type === 'object')
      ? parentContext.collector as ObjectCollector
      : { type: 'object', fields: new Map() };

    // If collector is empty, we need to register field schemas
    if (rootCollector.fields.size === 0) {
      // Register all field schemas with State Machine
      for (const [fieldName, fieldSchema] of Object.entries(shape)) {
        const xpath = this.extractXPath(fieldSchema);
        if (!xpath) continue;

        // Create collector for this field
        const childCollector = this.createCollectorForSchema(fieldSchema);

        // Register with State Machine, passing parent context
        sm.registerSchema(
          fieldSchema,
          xpath,  // State Machine will resolve relative XPath internally
          childCollector,
          parentContext?.context,  // Link to parent for XPath resolution
          fieldName
        );

        rootCollector.fields.set(fieldName, childCollector);
      }
    }

    // Process startEvent
    sm.processEventSync(startEvent);

    // Iterate through events using State Machine
    let currentDepth = startDepth;
    let iterResult = iterator.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      // Let State Machine handle event processing
      sm.processEventSync(event);

      // Track depth
      if (isStartElement(event)) {
        currentDepth++;
      } else if (isEndElement(event)) {
        currentDepth--;
        if (currentDepth < startDepth) {
          break;
        }
      }

      iterResult = iterator.next();
    }

    // Extract result from collectors
    return this.buildResultFromCollector(rootCollector, shape) as T;
  }


  /**
   * Parse object from current iterator position (async)
   */
  async parseObjectFromPosition<T>(
    iterator: AsyncIterator<AnyXmlEvent>,
    startEvent: StartElementEvent,
    startDepth: number,
    shape: Record<string, XmlSchemaBase<unknown, unknown>>,
    schemaOptions: { xpath?: string },
    stateMachine?: XmlParsingStateMachine,
    parentContext?: SchemaActivation
  ): Promise<T> {
    // Use provided State Machine or create new one
    const sm = stateMachine || new XmlParsingStateMachine(this.options);

    // If parentContext has a collector, it might be pre-populated by State Machine
    // Otherwise create a new collector
    const rootCollector: ObjectCollector = (parentContext?.collector && parentContext.collector.type === 'object')
      ? parentContext.collector as ObjectCollector
      : { type: 'object', fields: new Map() };

    // If collector is empty, we need to register field schemas
    if (rootCollector.fields.size === 0) {
      // Register all field schemas with State Machine
      for (const [fieldName, fieldSchema] of Object.entries(shape)) {
        const xpath = this.extractXPath(fieldSchema);
        if (!xpath) continue;

        // Create collector for this field
        const childCollector = this.createCollectorForSchema(fieldSchema);

        // Register with State Machine, passing parent context
        sm.registerSchema(
          fieldSchema,
          xpath,  // State Machine will resolve relative XPath internally
          childCollector,
          parentContext?.context,  // Link to parent for XPath resolution
          fieldName
        );

        rootCollector.fields.set(fieldName, childCollector);
      }
    }

    // Process startEvent
    await sm.processEventAsync(startEvent);

    // Iterate through events using State Machine
    let currentDepth = startDepth;
    let iterResult = await iterator.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      // Let State Machine handle event processing
      await sm.processEventAsync(event);

      // Track depth
      if (isStartElement(event)) {
        currentDepth++;
      } else if (isEndElement(event)) {
        currentDepth--;
        if (currentDepth < startDepth) {
          break;
        }
      }

      iterResult = await iterator.next();
    }

    // Extract result from collectors
    return this.buildResultFromCollector(rootCollector, shape) as T;
  }

  /**
   * Parse array asynchronously
   */
  async parseArrayAsync<T>(
    input: ParseInput,
    elementSchema: XmlSchemaBase<unknown, unknown>,
    xpath?: string
  ): Promise<T[]> {
    if (!xpath) {
      throw new Error('Array schema requires xpath');
    }

    const parser = this.createParser(input);
    const stateMachine = new XmlParsingStateMachine(this.options);

    // Create array collector
    const arrayCollector: ArrayCollector<T> = { type: 'array', items: [] };

    // Create a dummy array schema for registration
    const dummyArraySchema = {
      schemaType: 'ARRAY' as const,
      constructor: { name: 'XmlArraySchema' },
      element: elementSchema
    };

    // Register array schema with State Machine
    stateMachine.registerSchema(
      dummyArraySchema as unknown as XmlSchemaBase<unknown, unknown>,
      xpath,
      arrayCollector,
      undefined,  // No parent context for top-level array
      undefined   // No field name for top-level array
    );

    // Process all events through State Machine
    for await (const event of parser) {
      await stateMachine.processEventAsync(event);
    }

    // Extract results from collector
    return this.extractValueFromCollector(arrayCollector, {
      schemaType: 'ARRAY' as const,
      constructor: { name: 'XmlArraySchema' },
      element: elementSchema
    } as unknown as XmlSchemaBase<unknown, unknown>) as T[];
  }

  /**
   * Collect text content until the closing tag at the given depth
   */
  private async collectTextUntilClose(
    parser: AsyncIterator<AnyXmlEvent>,
    startDepth: number
  ): Promise<string> {
    let currentDepth = startDepth;
    let buffer = '';
    let iterResult = await parser.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      if (isStartElement(event)) {
        currentDepth++;
      } else if (isEndElement(event)) {
        currentDepth--;
        if (currentDepth < startDepth) {
          break;
        }
      } else if ((isCharacters(event) || isCdata(event)) && currentDepth === startDepth) {
        buffer += event.value;
      }

      if (currentDepth >= startDepth) {
        iterResult = await parser.next();
      }
    }

    return buffer;
  }

  /**
   * Parse array from current iterator position (sync)
   * Used for nested array parsing within a specific element scope
   */
  parseArrayFromPositionSync<T>(
    iterator: Iterator<AnyXmlEvent>,
    startEvent: StartElementEvent,
    startDepth: number,
    elementSchema: XmlSchemaBase<unknown, unknown>,
    xpath?: string,
    stateMachine?: XmlParsingStateMachine
  ): T[] {
    if (!xpath) {
      throw new Error('Array schema requires xpath');
    }

    // For relative paths, pass the context depth (startDepth) to the matcher
    const isRelativePath = xpath.startsWith('./') || xpath === '.';
    const matcher = new XPathMatcher(xpath, isRelativePath ? startDepth : undefined);
    const results: T[] = [];
    const needsRecursive = this.isComplexSchema(elementSchema);
    let currentDepth = startDepth;

    // Process the start event for the parent element
    matcher.onStartElement(startEvent);

    let iterResult = iterator.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      if (isStartElement(event)) {
        currentDepth++;
        matcher.onStartElement(event);

        if (matcher.matches(event)) {
          // Found matching element
          const elementXPath = this.extractXPath(elementSchema);
          const elementMatcher = elementXPath ? new XPathMatcher(elementXPath) : null;

          if (elementMatcher && elementMatcher.isAttributeSelector()) {
            const attrName = elementMatcher.getAttributeName();
            if (attrName && event.attributes) {
              const attrValue = event.attributes[attrName];
              if (attrValue !== undefined) {
                const value = this.parseFieldValue(attrValue, elementSchema);
                results.push(value as T);
              }
            }
          } else if (needsRecursive && elementSchema._parseFromPosition) {
            // Use recursive position-based parsing
            const value = elementSchema._parseFromPosition(
              iterator,
              event,
              currentDepth,
              this.options
            );
            results.push(value as T);
            // _parseFromPosition consumed up to and including the closing tag
          } else if (elementXPath) {
            // Element has XPath - use matching logic
            elementMatcher!.onStartElement(event);
            const value = this.extractValueWithElementMatcher(
              iterator,
              event,
              currentDepth,
              elementMatcher!,
              elementSchema
            );
            results.push(value as T);
            matcher.onEndElement();
            currentDepth--;
          } else {
            // Simple schema - collect text
            const textBuffer = this.collectTextUntilCloseSync(
              iterator,
              currentDepth
            );
            const value = this.parseFieldValue(textBuffer.trim(), elementSchema);
            results.push(value as T);
            matcher.onEndElement();
            currentDepth--;
          }
        }
      } else if (isEndElement(event)) {
        currentDepth--;
        matcher.onEndElement();

        // Exit when we close the parent element
        if (currentDepth < startDepth) {
          break;
        }
      }

      if (currentDepth >= startDepth) {
        iterResult = iterator.next();
      }
    }

    return results;
  }

  /**
   * Parse array from current iterator position (async)
   * Used for nested array parsing within a specific element scope
   */
  async parseArrayFromPosition<T>(
    iterator: AsyncIterator<AnyXmlEvent>,
    startEvent: StartElementEvent,
    startDepth: number,
    elementSchema: XmlSchemaBase<unknown, unknown>,
    xpath?: string,
    stateMachine?: XmlParsingStateMachine
  ): Promise<T[]> {
    if (!xpath) {
      throw new Error('Array schema requires xpath');
    }

    // For relative paths, pass the context depth (startDepth) to the matcher
    const isRelativePath = xpath.startsWith('./') || xpath === '.';
    const matcher = new XPathMatcher(xpath, isRelativePath ? startDepth : undefined);
    const results: T[] = [];
    const needsRecursive = this.isComplexSchema(elementSchema);
    let currentDepth = startDepth;

    // Process the start event for the parent element
    matcher.onStartElement(startEvent);

    let iterResult = await iterator.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      if (isStartElement(event)) {
        currentDepth++;
        matcher.onStartElement(event);

        if (matcher.matches(event)) {
          // Found matching element
          const elementXPath = this.extractXPath(elementSchema);
          const elementMatcher = elementXPath ? new XPathMatcher(elementXPath) : null;

          if (elementMatcher && elementMatcher.isAttributeSelector()) {
            const attrName = elementMatcher.getAttributeName();
            if (attrName && event.attributes) {
              const attrValue = event.attributes[attrName];
              if (attrValue !== undefined) {
                const value = this.parseFieldValue(attrValue, elementSchema);
                results.push(value as T);
              }
            }
          } else if (needsRecursive && elementSchema._parseFromPosition) {
            // Use recursive position-based parsing
            const value = await elementSchema._parseFromPosition(
              iterator,
              event,
              currentDepth,
              this.options
            );
            results.push(value as T);
            // _parseFromPosition consumed up to and including the closing tag
          } else if (elementXPath) {
            // Element has XPath - use matching logic
            elementMatcher!.onStartElement(event);
            const value = await this.extractValueWithElementMatcherAsync(
              iterator,
              event,
              currentDepth,
              elementMatcher!,
              elementSchema
            );
            results.push(value as T);
            matcher.onEndElement();
            currentDepth--;
          } else {
            // Simple schema - collect text
            const textBuffer = await this.collectTextUntilClose(
              iterator,
              currentDepth
            );
            const value = this.parseFieldValue(textBuffer.trim(), elementSchema);
            results.push(value as T);
            matcher.onEndElement();
            currentDepth--;
          }
        }
      } else if (isEndElement(event)) {
        currentDepth--;
        matcher.onEndElement();

        // Exit when we close the parent element
        if (currentDepth < startDepth) {
          break;
        }
      }

      if (currentDepth >= startDepth) {
        iterResult = await iterator.next();
      }
    }

    return results;
  }

  /**
   * Parse array synchronously
   */
  parseArray<T>(input: string, elementSchema: XmlSchemaBase<unknown, unknown>, xpath?: string): T[] {
    if (!xpath) {
      throw new Error('Array schema requires xpath');
    }

    const parser = new StaxXmlParserSync(input, {
      autoDecodeEntities: this.options?.decodeEntities
    });

    const stateMachine = new XmlParsingStateMachine(this.options);

    // Create array collector
    const arrayCollector: ArrayCollector<T> = { type: 'array', items: [] };

    // Create a dummy array schema for registration
    const dummyArraySchema = {
      schemaType: 'ARRAY' as const,
      constructor: { name: 'XmlArraySchema' },
      element: elementSchema
    };

    // Register array schema with State Machine
    stateMachine.registerSchema(
      dummyArraySchema as unknown as XmlSchemaBase<unknown, unknown>,
      xpath,
      arrayCollector,
      undefined,  // No parent context for top-level array
      undefined   // No field name for top-level array
    );

    // Process all events through State Machine
    for (const event of parser) {
      stateMachine.processEventSync(event);
    }

    // Extract results from collector
    return this.extractValueFromCollector(arrayCollector, {
      schemaType: 'ARRAY' as const,
      constructor: { name: 'XmlArraySchema' },
      element: elementSchema
    } as unknown as XmlSchemaBase<unknown, unknown>) as T[];
  }

  /**
   * Collect text content until the closing tag at the given depth (sync)
   */
  private collectTextUntilCloseSync(
    parser: Iterator<AnyXmlEvent>,
    startDepth: number
  ): string {
    let currentDepth = startDepth;
    let buffer = '';
    let iterResult = parser.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      if (isStartElement(event)) {
        currentDepth++;
      } else if (isEndElement(event)) {
        currentDepth--;
        if (currentDepth < startDepth) {
          break;
        }
      } else if ((isCharacters(event) || isCdata(event)) && currentDepth === startDepth) {
        buffer += event.value;
      }

      if (currentDepth >= startDepth) {
        iterResult = parser.next();
      }
    }

    return buffer;
  }

  // Helper methods

  private createParser(input: ParseInput): AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent> {
    if (typeof input === 'string') {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(input));
          controller.close();
        }
      });
      return new StaxXmlParser(stream, {
        autoDecodeEntities: this.options?.decodeEntities
      }) as AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent>;
    }
    if (input instanceof ReadableStream) {
      return new StaxXmlParser(input, {
        autoDecodeEntities: this.options?.decodeEntities
      }) as AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent>;
    }
    return input as AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent>;
  }


  private extractXPath(schema: unknown): string | undefined {
    if (!schema || typeof schema !== 'object') {
      return undefined;
    }

    // Unwrap wrappers (Transform, Optional) first to get to the core schema
    const unwrapped = this.unwrapSchema(schema);
    if (!unwrapped || typeof unwrapped !== 'object') {
      return undefined;
    }

    // First check if xpath is a direct property (for XmlArraySchema)
    // Must be a string value, not just any property
    if ('xpath' in unwrapped) {
      const xpathProp = (unwrapped as { xpath?: unknown }).xpath;
      if (typeof xpathProp === 'string') {
        return xpathProp;
      }
    }

    // Then check options (for other schemas like XmlStringSchema, XmlNumberSchema)
    if ('options' in unwrapped) {
      const opts = (unwrapped as { options?: unknown }).options;
      if (opts && typeof opts === 'object' && 'xpath' in opts) {
        const xpath = (opts as { xpath?: unknown }).xpath;
        if (typeof xpath === 'string') {
          return xpath;
        }
      }
    }

    return undefined;
  }


  /**
   * Check if a schema is wrapped in XmlOptionalSchema
   */
  private isOptionalSchemaWrapper(schema: unknown): boolean {
    if (!schema || typeof schema !== 'object') return false;
    let current: unknown = schema;
    while (current && typeof current === 'object' && 'schemaType' in current) {
      if (isOptionalSchema(current as XmlSchemaBase<unknown, unknown>)) {
        return true;
      }
      if (isTransformSchema(current as XmlSchemaBase<unknown, unknown>) && 'schema' in current) {
        current = (current as { schema: unknown }).schema;
      } else {
        break;
      }
    }
    return false;
  }
  /* v8 ignore start */
  /**
   * Unwrap wrapper schemas (Optional, Transform) to get the inner schema
   */
  private unwrapSchema(schema: unknown): unknown {
    if (!schema || typeof schema !== 'object' || !('schemaType' in schema)) {
      return schema;
    }

    const baseSchema = schema as XmlSchemaBase<unknown, unknown>;

    // Unwrap Optional and Transform wrappers
    if ((isOptionalSchema(baseSchema) || isTransformSchema(baseSchema)) && 'schema' in baseSchema) {
      return this.unwrapSchema(baseSchema.schema); // Recursive unwrap
    }

    return schema;
  }
  /**
   * Extract all Transform functions from a schema chain
   */
  private getAllTransforms(schema: unknown): Array<(value: unknown) => unknown> {
    const transforms: Array<(value: unknown) => unknown> = [];
    let current: unknown = schema;

    while (current && typeof current === 'object' && 'schemaType' in current) {
      const baseSchema = current as XmlSchemaBase<unknown, unknown>;

      if (isTransformSchema(baseSchema)) {
        if ('transformFn' in baseSchema && typeof baseSchema.transformFn === 'function') {
          transforms.unshift(baseSchema.transformFn as (value: unknown) => unknown);
        }
        if ('schema' in baseSchema) {
          current = (baseSchema as { schema: unknown }).schema;
        } else {
          break;
        }
      } else if (isOptionalSchema(baseSchema)) {
        if ('schema' in baseSchema) {
          current = (baseSchema as { schema: unknown }).schema;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return transforms;
  }

  private parseFieldValue(text: string, schema: unknown): unknown {
    // For simple schemas with _parseText, use it directly
    if (schema && typeof schema === 'object' && '_parseText' in schema && typeof schema._parseText === 'function') {
      return schema._parseText(text);
    }

    // Default: return text as-is
    return text;
  }
  private isComplexSchema(schema: unknown): boolean {
    // Unwrap wrappers first
    const unwrapped = this.unwrapSchema(schema);
    if (!unwrapped || typeof unwrapped !== 'object' || !('schemaType' in unwrapped)) {
      return false;
    }
    // Only XmlObjectSchema needs recursive position-based parsing
    // Arrays, Transforms, and Optionals can be handled differently
    return isObjectSchema(unwrapped as XmlSchemaBase<unknown, unknown>);
  }


  private decodeText(text: string): string {
    if (this.options?.trimText) {
      return text.trim();
    }
    return text;
  }

  /**
   * Extract value using XPath matching within a single element scope (sync)
   */
  private extractValueWithElementMatcher(
    parser: Iterator<AnyXmlEvent>,
    startEvent: StartElementEvent,
    startDepth: number,
    elementMatcher: XPathMatcher,
    elementSchema: XmlSchemaBase<unknown, unknown>
  ): unknown {
    let currentDepth = startDepth;
    let textBuffer = '';
    let matchedDepth = -1;
    let iterResult = parser.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      if (isStartElement(event)) {
        currentDepth++;
        elementMatcher.onStartElement(event);

        if (elementMatcher.matches(event) && matchedDepth === -1) {
          matchedDepth = currentDepth;
          textBuffer = ''; // Reset buffer for this match
        }
      } else if (isEndElement(event)) {
        if (matchedDepth !== -1 && currentDepth === matchedDepth) {
          // We're closing the matched element - return the collected text
          const value = this.parseFieldValue(textBuffer.trim(), elementSchema);
          return value;
        }
        elementMatcher.onEndElement();
        currentDepth--;

        if (currentDepth < startDepth) {
          break;
        }
      } else if ((isCharacters(event) || isCdata(event)) && matchedDepth !== -1 && currentDepth === matchedDepth) {
        textBuffer += event.value;
      }

      if (currentDepth >= startDepth) {
        iterResult = parser.next();
      }
    }

    // If we didn't find a match, try to extract using parseFieldValue with empty text
    return this.parseFieldValue('', elementSchema);
  }

  /**
   * Extract value using XPath matching within a single element scope (async)
   */
  private async extractValueWithElementMatcherAsync(
    parser: AsyncIterator<AnyXmlEvent>,
    startEvent: StartElementEvent,
    startDepth: number,
    elementMatcher: XPathMatcher,
    elementSchema: XmlSchemaBase<unknown, unknown>
  ): Promise<unknown> {
    let currentDepth = startDepth;
    let textBuffer = '';
    let matchedDepth = -1;
    let iterResult = await parser.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      if (isStartElement(event)) {
        currentDepth++;
        elementMatcher.onStartElement(event);

        if (elementMatcher.matches(event) && matchedDepth === -1) {
          matchedDepth = currentDepth;
          textBuffer = ''; // Reset buffer for this match
        }
      } else if (isEndElement(event)) {
        if (matchedDepth !== -1 && currentDepth === matchedDepth) {
          // We're closing the matched element - return the collected text
          const value = this.parseFieldValue(textBuffer.trim(), elementSchema);
          return value;
        }
        elementMatcher.onEndElement();
        currentDepth--;

        if (currentDepth < startDepth) {
          break;
        }
      } else if ((isCharacters(event) || isCdata(event)) && matchedDepth !== -1 && currentDepth === matchedDepth) {
        textBuffer += event.value;
      }

      if (currentDepth >= startDepth) {
        iterResult = await parser.next();
      }
    }

    // If we didn't find a match, try to extract using parseFieldValue with empty text
    return this.parseFieldValue('', elementSchema);
  }

  /**
   * Extract final value from collector based on schema type
   */
  private extractValueFromCollector(collector: Collector<unknown>, schema: unknown): unknown {
    // Check if schema is Optional and collector is empty
    const isOptional = this.isOptionalSchemaWrapper(schema);
    const isEmpty = (
      (collector.type === 'string' && !collector.value && !collector.buffer) ||
      (collector.type === 'number' && collector.value === undefined) ||
      (collector.type === 'array' && collector.items.length === 0) ||
      (collector.type === 'object' && collector.fields.size === 0)
    );

    if (isOptional && isEmpty) {
      return undefined;
    }

    if (collector.type === 'string') {
      const stringValue = collector.value ?? '';
      // For optional schemas, treat empty string as undefined
      if (isOptional && stringValue === '') {
        return undefined;
      }
      return stringValue;
    } else if (collector.type === 'number') {
      return collector.value ?? NaN;
    } else if (collector.type === 'array') {
      let items = collector.items;

      // NOTE: Array items are already parsed by XmlParsingStateMachine.onSchemaDeactivatedSync()
      // (lines 586-594), which applies type conversion for string/number element schemas.
      // We should NOT call _parseText() again here as items are already processed.

      // Apply all transforms in the schema chain
      const transforms = this.getAllTransforms(schema);
      for (const transformFn of transforms) {
        items = transformFn(items) as unknown[];
      }

      return items;
    } else if (collector.type === 'object') {
      // Reconstruct object from field collectors
      let result: Record<string, unknown> = {};
      const unwrapped = this.unwrapSchema(schema);

      // Type guard to safely access shape
      if (!unwrapped || typeof unwrapped !== 'object' || !('shape' in unwrapped)) {
        return result;
      }
      const shape = unwrapped.shape as Record<string, unknown>;

      for (const [fieldName, fieldCollector] of collector.fields) {
        // Get the field schema from the object's shape
        const fieldSchema = shape[fieldName];
        if (fieldSchema) {
          // Recursively extract with the correct field schema
          result[fieldName] = this.extractValueFromCollector(fieldCollector, fieldSchema);
        }
      }

      // Apply all transforms to the object result
      const transforms = this.getAllTransforms(schema);
      for (const transformFn of transforms) {
        result = transformFn(result) as Record<string, unknown>;
      }

      return result;
    }

    return undefined;
  }

  /**
   * Create collector for a schema based on its type
   * @internal
   */
  private createCollectorForSchema(schema: unknown): Collector<unknown> {
    const unwrapped = this.unwrapSchema(schema);

    if (!unwrapped || typeof unwrapped !== 'object' || !('schemaType' in unwrapped)) {
      return { type: 'string', buffer: '' };
    }

    const baseSchema = unwrapped as XmlSchemaBase<unknown, unknown>;

    if (isArraySchema(baseSchema)) {
      return { type: 'array', items: [] };
    } else if (isStringSchema(baseSchema)) {
      return { type: 'string', buffer: '' };
    } else if (isNumberSchema(baseSchema)) {
      return { type: 'number', buffer: '' };
    } else if (isObjectSchema(baseSchema)) {
      return { type: 'object', fields: new Map() };
    }

    // Fallback to string
    return { type: 'string', buffer: '' };
  }

  /**
   * Build result object from collector
   * @internal
   */
  private buildResultFromCollector(collector: ObjectCollector, shape: Record<string, XmlSchemaBase<unknown, unknown>>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [fieldName, fieldCollector] of collector.fields) {
      const schema = shape[fieldName];
      // Use extractValueFromCollector which handles transforms and type conversions properly
      result[fieldName] = this.extractValueFromCollector(fieldCollector, schema);
    }

    return result;
  }
  /* v8 ignore end */
}