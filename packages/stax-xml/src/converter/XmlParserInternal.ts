import { StaxXmlParser } from '../StaxXmlParser.js';
import { StaxXmlParserSync } from '../StaxXmlParserSync.js';
import {
  isStartElement,
  isEndElement,
  isCharacters,
  isCdata,
  type AnyXmlEvent,
  type StartElementEvent
} from '../types.js';
import { XPathMatcher } from './XPathEngine.js';
import type { ParseInput } from './XmlSchema.js';
import type { ParseOptions } from './types.js';
import {
  XmlParsingStateMachine,
  type Collector,
  type StringCollector,
  type NumberCollector,
  type ArrayCollector,
  type ObjectCollector,
  type SchemaActivation
} from './XmlParsingStateMachine.js';

/**
 * Internal parse context for tracking state
 *
 * @internal
 */
interface ParseContext {
  matcher?: XPathMatcher;
  currentDepth: number;
  maxDepth: number;
  eventCount: number;
  maxEvents: number;
}

/**
 * Internal parser implementation
 * Handles both sync and async parsing with XPath support
 *
 * @internal
 */
export class XmlParserInternal {
  private options?: ParseOptions;
  private static readonly DEFAULT_MAX_DEPTH = 1000;
  private static readonly DEFAULT_MAX_EVENTS = 1000000;

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

    // Create a dummy schema object for registration
    const dummySchema = { constructor: { name: 'XmlStringSchema' } };
    stateMachine.registerSchema(dummySchema as any, xpath, collector);

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

    const dummySchema = { constructor: { name: 'XmlStringSchema' } };
    stateMachine.registerSchema(dummySchema as any, xpath, collector);

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
    shape: Record<string, any>,
    schemaOptions: { xpath?: string }
  ): Promise<T> {
    const parser = this.createParser(input);
    const stateMachine = new XmlParsingStateMachine(this.options);
    const collectors = new Map<string, Collector<any>>();
    const fieldSchemas = new Map<string, any>();

    // Register all field schemas
    for (const [fieldName, fieldSchema] of Object.entries(shape)) {
      const xpath = this.extractXPath(fieldSchema);
      if (!xpath) continue;

      const unwrapped = this.unwrapSchema(fieldSchema);
      const schemaType = unwrapped?.constructor?.name;
      let collector: Collector<any>;

      if (schemaType === 'XmlArraySchema') {
        collector = { type: 'array', items: [] } as ArrayCollector<any>;
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
    const result: any = {};
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
    shape: Record<string, any>,
    schemaOptions: { xpath?: string }
  ): T {
    const parser = new StaxXmlParserSync(input, {
      autoDecodeEntities: this.options?.decodeEntities
    });

    const stateMachine = new XmlParsingStateMachine(this.options);
    const collectors = new Map<string, Collector<any>>();
    const fieldSchemas = new Map<string, any>();

    // Register all field schemas
    for (const [fieldName, fieldSchema] of Object.entries(shape)) {
      const xpath = this.extractXPath(fieldSchema);
      if (!xpath) continue;

      const unwrapped = this.unwrapSchema(fieldSchema);
      const schemaType = unwrapped?.constructor?.name;
      let collector: Collector<any>;

      if (schemaType === 'XmlArraySchema') {
        collector = { type: 'array', items: [] } as ArrayCollector<any>;
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
    const result: any = {};
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
    shape: Record<string, any>,
    schemaOptions: { xpath?: string },
    parentActivation?: SchemaActivation
  ): T {
    // Create State Machine instance
    const stateMachine = new XmlParsingStateMachine(this.options);
    const rootCollector: ObjectCollector = { type: 'object', fields: new Map() };

    // Register all field schemas with State Machine
    for (const [fieldName, fieldSchema] of Object.entries(shape)) {
      const xpath = this.extractXPath(fieldSchema);
      if (!xpath) continue;

      // Create collector for this field
      const childCollector = this.createCollectorForSchema(fieldSchema);

      // Register with State Machine, passing parent activation
      stateMachine.registerSchema(
        fieldSchema,
        xpath,  // State Machine will resolve relative XPath internally
        childCollector,
        parentActivation,  // Link to parent for XPath resolution
        fieldName
      );

      rootCollector.fields.set(fieldName, childCollector);
    }

    // Process startEvent
    stateMachine.processEventSync(startEvent);

    // Iterate through events using State Machine
    let currentDepth = startDepth;
    let iterResult = iterator.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      // Let State Machine handle event processing
      stateMachine.processEventSync(event);

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
    shape: Record<string, any>,
    schemaOptions: { xpath?: string },
    parentActivation?: SchemaActivation
  ): Promise<T> {
    // Create State Machine instance
    const stateMachine = new XmlParsingStateMachine(this.options);
    const rootCollector: ObjectCollector = { type: 'object', fields: new Map() };

    // Register all field schemas with State Machine
    for (const [fieldName, fieldSchema] of Object.entries(shape)) {
      const xpath = this.extractXPath(fieldSchema);
      if (!xpath) continue;

      // Create collector for this field
      const childCollector = this.createCollectorForSchema(fieldSchema);

      // Register with State Machine, passing parent activation
      stateMachine.registerSchema(
        fieldSchema,
        xpath,  // State Machine will resolve relative XPath internally
        childCollector,
        parentActivation,  // Link to parent for XPath resolution
        fieldName
      );

      rootCollector.fields.set(fieldName, childCollector);
    }

    // Process startEvent
    await stateMachine.processEventAsync(startEvent);

    // Iterate through events using State Machine
    let currentDepth = startDepth;
    let iterResult = await iterator.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      // Let State Machine handle event processing
      await stateMachine.processEventAsync(event);

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
    elementSchema: any,
    xpath?: string
  ): Promise<T[]> {
    if (!xpath) {
      throw new Error('Array schema requires xpath');
    }

    const parser = this.createParser(input);
    const matcher = new XPathMatcher(xpath);
    const context = this.createContext(matcher);
    const results: T[] = [];
    const needsRecursive = this.isComplexSchema(elementSchema);

    for await (const event of parser) {
      this.checkLimits(context);

      if (isStartElement(event)) {
        context.currentDepth++;
        matcher.onStartElement(event);

        if (matcher.matches(event)) {
          // Found matching element - process it now

          // Check if the element schema has an attribute selector
          const elementXPath = this.extractXPath(elementSchema);
          const elementMatcher = elementXPath ? new XPathMatcher(elementXPath) : null;

          if (elementMatcher && elementMatcher.isAttributeSelector()) {
            const attrName = elementMatcher.getAttributeName();
            if (attrName && event.attributes) {
              const attrValue = event.attributes[attrName];
              if (attrValue !== undefined) {
                const value = this.parseFieldValue(attrValue, elementSchema);
                results.push(value);
              }
            }
          } else if (needsRecursive && elementSchema._parseFromPosition) {
            // Use recursive position-based parsing
            // Create a temporary activation for the array context
            const arrayActivation: SchemaActivation = {
              schema: elementSchema,
              xpath: xpath,
              matcher: matcher,
              depth: context.currentDepth,
              collector: { type: 'object', fields: new Map() },
              parentActivation: undefined,
              fieldName: undefined
            };

            const value = await elementSchema._parseFromPosition(
              parser,
              event,
              context.currentDepth,
              this.options,
              arrayActivation  // Pass activation object
            );
            results.push(value);
            // _parseFromPosition consumed up to and including the closing tag
            context.currentDepth--;
          } else if (elementXPath) {
            // Element has XPath - use object parsing logic for relative path resolution
            elementMatcher!.onStartElement(event);
            const value = await this.extractValueWithElementMatcherAsync(
              parser,
              event,
              context.currentDepth,
              elementMatcher!,
              elementSchema
            );
            results.push(value);
            // extractValueWithElementMatcherAsync handles depth management
            context.currentDepth--;
          } else {
            // Simple schema without XPath - collect text only
            const textBuffer = await this.collectTextUntilClose(
              parser,
              context.currentDepth
            );
            const value = this.parseFieldValue(textBuffer.trim(), elementSchema);
            results.push(value);
            // collectTextUntilClose consumed up to the closing tag
            context.currentDepth--;
          }
        }
      } else if (isEndElement(event)) {
        context.currentDepth--;
        matcher.onEndElement();
      }

      context.eventCount++;
    }

    return results;
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
    elementSchema: any,
    xpath?: string
  ): T[] {
    if (!xpath) {
      throw new Error('Array schema requires xpath');
    }

    const matcher = new XPathMatcher(xpath);
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
                results.push(value);
              }
            }
          } else if (needsRecursive && elementSchema._parseFromPosition) {
            // Use recursive position-based parsing
            // Create a temporary activation for the array context
            const arrayActivation: SchemaActivation = {
              schema: elementSchema,
              xpath: xpath,
              matcher: matcher,
              depth: currentDepth,
              collector: { type: 'object', fields: new Map() },
              parentActivation: undefined,
              fieldName: undefined
            };

            const value = elementSchema._parseFromPosition(
              iterator,
              event,
              currentDepth,
              this.options,
              arrayActivation  // Pass activation object
            );
            results.push(value);
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
            results.push(value);
            matcher.onEndElement();
            currentDepth--;
          } else {
            // Simple schema - collect text
            const textBuffer = this.collectTextUntilCloseSync(
              iterator,
              currentDepth
            );
            const value = this.parseFieldValue(textBuffer.trim(), elementSchema);
            results.push(value);
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
    elementSchema: any,
    xpath?: string
  ): Promise<T[]> {
    if (!xpath) {
      throw new Error('Array schema requires xpath');
    }

    const matcher = new XPathMatcher(xpath);
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
                results.push(value);
              }
            }
          } else if (needsRecursive && elementSchema._parseFromPosition) {
            // Use recursive position-based parsing
            // Create a temporary activation for the array context
            const arrayActivation: SchemaActivation = {
              schema: elementSchema,
              xpath: xpath,
              matcher: matcher,
              depth: currentDepth,
              collector: { type: 'object', fields: new Map() },
              parentActivation: undefined,
              fieldName: undefined
            };

            const value = await elementSchema._parseFromPosition(
              iterator,
              event,
              currentDepth,
              this.options,
              arrayActivation  // Pass activation object
            );
            results.push(value);
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
            results.push(value);
            matcher.onEndElement();
            currentDepth--;
          } else {
            // Simple schema - collect text
            const textBuffer = await this.collectTextUntilClose(
              iterator,
              currentDepth
            );
            const value = this.parseFieldValue(textBuffer.trim(), elementSchema);
            results.push(value);
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
  parseArray<T>(input: string, elementSchema: any, xpath?: string): T[] {
    if (!xpath) {
      throw new Error('Array schema requires xpath');
    }

    const parser = new StaxXmlParserSync(input, {
      autoDecodeEntities: this.options?.decodeEntities
    });

    const matcher = new XPathMatcher(xpath);
    const context = this.createContext(matcher);
    const results: T[] = [];
    const needsRecursive = this.isComplexSchema(elementSchema);

    for (const event of parser) {
      this.checkLimits(context);

      if (isStartElement(event)) {
        context.currentDepth++;
        matcher.onStartElement(event);

        if (matcher.matches(event)) {
          // Found matching element - process it now

          // Check if the element schema has an attribute selector
          const elementXPath = this.extractXPath(elementSchema);
          const elementMatcher = elementXPath ? new XPathMatcher(elementXPath) : null;

          if (elementMatcher && elementMatcher.isAttributeSelector()) {
            const attrName = elementMatcher.getAttributeName();
            if (attrName && event.attributes) {
              const attrValue = event.attributes[attrName];
              if (attrValue !== undefined) {
                const value = this.parseFieldValue(attrValue, elementSchema);
                results.push(value);
              }
            }
          } else if (needsRecursive && elementSchema._parseFromPosition) {
            // Use recursive position-based parsing
            // Create a temporary activation for the array context
            const arrayActivation: SchemaActivation = {
              schema: elementSchema,
              xpath: xpath,
              matcher: matcher,
              depth: context.currentDepth,
              collector: { type: 'object', fields: new Map() },
              parentActivation: undefined,
              fieldName: undefined
            };

            const value = elementSchema._parseFromPosition(
              parser,
              event,
              context.currentDepth,
              this.options,
              arrayActivation  // Pass activation object
            );
            results.push(value);
            // _parseFromPosition consumed up to and including the closing tag
            // Don't manually decrement - the END_ELEMENT will be processed by the main loop
          } else if (elementXPath) {
            // Element has XPath - use object parsing logic for relative path resolution
            elementMatcher!.onStartElement(event);
            const value = this.extractValueWithElementMatcher(
              parser,
              event,
              context.currentDepth,
              elementMatcher!,
              elementSchema
            );
            results.push(value);
            // extractValueWithElementMatcher handles depth management
            matcher.onEndElement();
            context.currentDepth--;
          } else {
            // Simple schema without XPath - collect text only
            const textBuffer = this.collectTextUntilCloseSync(
              parser,
              context.currentDepth
            );
            const value = this.parseFieldValue(textBuffer.trim(), elementSchema);
            results.push(value);
            // collectTextUntilCloseSync consumed up to and including the closing tag
            // We need to manually call onEndElement since the main loop won't see it
            matcher.onEndElement();
            context.currentDepth--;
          }
        }
      } else if (isEndElement(event)) {
        context.currentDepth--;
        matcher.onEndElement();
      }

      context.eventCount++;
    }

    return results;
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

  private createContext(matcher?: XPathMatcher): ParseContext {
    return {
      matcher,
      currentDepth: 0,
      maxDepth: this.options?.maxDepth ?? XmlParserInternal.DEFAULT_MAX_DEPTH,
      eventCount: 0,
      maxEvents: this.options?.maxEvents ?? XmlParserInternal.DEFAULT_MAX_EVENTS
    };
  }

  private checkLimits(context: ParseContext): void {
    if (context.currentDepth > context.maxDepth) {
      throw new Error(`XML depth limit exceeded: ${context.maxDepth}`);
    }
    if (context.eventCount > context.maxEvents) {
      throw new Error(`XML event limit exceeded: ${context.maxEvents}`);
    }
  }

  private extractXPath(schema: any): string | undefined {
    if (!schema || typeof schema !== 'object') {
      return undefined;
    }

    // Unwrap wrappers (Transform, Optional) first to get to the core schema
    const unwrapped = this.unwrapSchema(schema);

    // First check if xpath is a direct property (for XmlArraySchema)
    // Must be a string value, not just any property
    if ('xpath' in unwrapped && typeof unwrapped.xpath === 'string') {
      return unwrapped.xpath;
    }

    // Then check options (for other schemas like XmlStringSchema, XmlNumberSchema)
    if ('options' in unwrapped && unwrapped.options && typeof unwrapped.options === 'object') {
      const xpath = unwrapped.options.xpath;
      if (typeof xpath === 'string') {
        return xpath;
      }
    }

    return undefined;
  }

  /**
   * Check if a schema (possibly wrapped) is an array field
   */
  private isArrayField(schema: any): boolean {
    const unwrapped = this.unwrapSchema(schema);
    return unwrapped?.constructor?.name === 'XmlArraySchema';
  }

  /**
   * Check if a schema is wrapped in XmlOptionalSchema
   */
  private isOptionalSchema(schema: any): boolean {
    if (!schema) return false;
    let current = schema;
    while (current) {
      const typeName = current?.constructor?.name || '';
      if (typeName === 'XmlOptionalSchema') {
        return true;
      }
      if (typeName === 'XmlTransformSchema' && current.schema) {
        current = current.schema;
      } else {
        break;
      }
    }
    return false;
  }

  /**
   * Unwrap wrapper schemas (Optional, Transform) to get the inner schema
   */
  private unwrapSchema(schema: any): any {
    const typeName = schema?.constructor?.name || '';

    // Unwrap Optional and Transform wrappers
    if ((typeName === 'XmlOptionalSchema' || typeName === 'XmlTransformSchema') && schema.schema) {
      return this.unwrapSchema(schema.schema); // Recursive unwrap
    }

    return schema;
  }

  /**
   * Extract all Transform functions from a schema chain
   */
  private getAllTransforms(schema: any): Array<(value: any) => any> {
    const transforms: Array<(value: any) => any> = [];
    let current = schema;

    while (current) {
      const typeName = current?.constructor?.name || '';
      if (typeName === 'XmlTransformSchema') {
        if (current.transformFn) {
          transforms.unshift(current.transformFn); // Prepend to maintain correct order
        }
        current = current.schema;
      } else if (typeName === 'XmlOptionalSchema') {
        current = current.schema;
      } else {
        break;
      }
    }

    return transforms;
  }

  /**
   * Get element schema from an array schema (unwrapping if needed)
   */
  private unwrapArraySchema(schema: any): any {
    const unwrapped = this.unwrapSchema(schema);
    if (unwrapped?.constructor?.name === 'XmlArraySchema' && unwrapped.element) {
      return unwrapped.element;
    }
    return null;
  }

  private parseFieldValue(text: string, schema: any): any {
    // For simple schemas with _parseText, use it directly
    if (schema?._parseText) {
      return schema._parseText(text);
    }

    // Default: return text as-is
    return text;
  }

  private isComplexSchema(schema: any): boolean {
    // Unwrap wrappers first
    const unwrapped = this.unwrapSchema(schema);
    const typeName = unwrapped?.constructor?.name || '';
    // Only XmlObjectSchema needs recursive position-based parsing
    // Arrays, Transforms, and Optionals can be handled differently
    return typeName === 'XmlObjectSchema';
  }


  private needsFullDocumentParsing(schema: any): boolean {
    const typeName = schema?.constructor?.name || '';

    // Direct array schema
    if (typeName === 'XmlArraySchema') {
      // Check if it uses relative XPath (starts with ./)
      const xpath = this.extractArrayXPath(schema);
      if (xpath && xpath.startsWith('./')) {
        // Relative XPath - should be parsed within current context, not full document
        return false;
      }
      return true; // Absolute XPath - needs full document parsing
    }

    // Transform schema wrapping an array
    if (typeName === 'XmlTransformSchema' && schema.schema) {
      return this.needsFullDocumentParsing(schema.schema);
    }

    // Optional schema wrapping an array
    if (typeName === 'XmlOptionalSchema' && schema.schema) {
      return this.needsFullDocumentParsing(schema.schema);
    }

    return false;
  }

  private extractArrayXPath(schema: any): string | undefined {
    // For XmlArraySchema, xpath is a private field but can be accessed directly
    if (schema && typeof schema === 'object' && 'xpath' in schema && typeof schema.xpath === 'string') {
      return schema.xpath;
    }
    return undefined;
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
    elementSchema: any
  ): any {
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
    elementSchema: any
  ): Promise<any> {
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
  private extractValueFromCollector(collector: Collector<any>, schema: any): any {
    const isDebug = false;
    if (isDebug && collector.type === 'array') {
      console.log(`[Extract] Array collector items:`, JSON.stringify(collector.items));
    }

    // Check if schema is Optional and collector is empty
    const isOptional = this.isOptionalSchema(schema);
    const isEmpty = (
      (collector.type === 'string' && !collector.value) ||
      (collector.type === 'number' && collector.value === undefined) ||
      (collector.type === 'array' && collector.items.length === 0) ||
      (collector.type === 'object' && collector.fields.size === 0)
    );

    if (isOptional && isEmpty) {
      return undefined;
    }

    if (collector.type === 'string') {
      return collector.value ?? '';
    } else if (collector.type === 'number') {
      return collector.value ?? NaN;
    } else if (collector.type === 'array') {
      let items = collector.items;

      // Parse each array element using element schema
      const unwrapped = this.unwrapSchema(schema);
      if (unwrapped?.constructor?.name === 'XmlArraySchema') {
        const elementSchema = (unwrapped as any).element;
        const elementUnwrapped = this.unwrapSchema(elementSchema);
        const elementType = elementUnwrapped?.constructor?.name;

        if (isDebug) {
          console.log(`[Extract] Element schema type:`, elementType);
          console.log(`[Extract] Has _parseText:`, !!elementSchema?._parseText);
        }

        // Only parse text for scalar types (string, number)
        // Complex types (array, object) are already parsed by the state machine
        if (elementType === 'XmlStringSchema' || elementType === 'XmlNumberSchema') {
          if (elementSchema?._parseText) {
            // Parse text content for each item
            if (isDebug) console.log(`[Extract] Parsing text for each item`);
            items = items.map((text: string) => elementSchema._parseText(text));
          }
        }
      }

      // Apply all transforms in the schema chain
      const transforms = this.getAllTransforms(schema);
      for (const transformFn of transforms) {
        if (isDebug) console.log(`[Extract] Applying transform`);
        items = transformFn(items);
      }

      if (isDebug) {
        console.log(`[Extract] Returning items:`, JSON.stringify(items));
      }
      return items;
    } else if (collector.type === 'object') {
      // Reconstruct object from field collectors
      let result: any = {};
      const unwrapped = this.unwrapSchema(schema);
      const shape = (unwrapped as any).shape as Record<string, any>;

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
        result = transformFn(result);
      }

      return result;
    }

    return undefined;
  }

  /**
   * Create collector for a schema based on its type
   * @internal
   */
  private createCollectorForSchema(schema: any): Collector<any> {
    const unwrapped = this.unwrapSchema(schema);
    const schemaType = unwrapped?.constructor?.name;

    switch (schemaType) {
      case 'XmlArraySchema':
        return { type: 'array', items: [] } as ArrayCollector<any>;
      case 'XmlStringSchema':
        return { type: 'string', buffer: '' } as StringCollector;
      case 'XmlNumberSchema':
        return { type: 'number', buffer: '' } as NumberCollector;
      case 'XmlObjectSchema':
        return { type: 'object', fields: new Map() } as ObjectCollector;
      default:
        return { type: 'string', buffer: '' } as StringCollector;
    }
  }

  /**
   * Build result object from collector
   * @internal
   */
  private buildResultFromCollector(collector: ObjectCollector, shape: Record<string, any>): any {
    const result: any = {};

    for (const [fieldName, fieldCollector] of collector.fields) {
      const schema = shape[fieldName];
      // Use extractValueFromCollector which handles transforms and type conversions properly
      result[fieldName] = this.extractValueFromCollector(fieldCollector, schema);
    }

    return result;
  }
}