import type { AnyXmlEvent, StartElementEvent } from '../types.js';
import {
  isCdata,
  isCharacters,
  isEndElement,
  isStartElement
} from '../types.js';
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
import { XPathMatcher } from './XPathEngine.js';

/**
 * Collector types for different schema types
 * @internal
 */
export type Collector<T> =
  | StringCollector
  | NumberCollector
  | ArrayCollector<T>
  | ObjectCollector;

export interface StringCollector {
  type: 'string';
  buffer: string;
  value?: string;
}

export interface NumberCollector {
  type: 'number';
  buffer: string;
  value?: number;
}

export interface ArrayCollector<T> {
  type: 'array';
  items: T[];
  currentItem?: {
    depth: number;
    buffer: string;
  } | ObjectCollector | ArrayCollector<unknown>;
}

export interface ObjectCollector {
  type: 'object';
  fields: Map<string, Collector<unknown>>;
}

/**
 * Type guard for StringCollector
 * @internal
 */
export function isStringCollector(collector: Collector<unknown>): collector is StringCollector {
  return collector.type === 'string';
}

/**
 * Type guard for NumberCollector
 * @internal
 */
export function isNumberCollector(collector: Collector<unknown>): collector is NumberCollector {
  return collector.type === 'number';
}

/**
 * Type guard for ArrayCollector
 * @internal
 */
export function isArrayCollector<T = unknown>(collector: Collector<T>): collector is ArrayCollector<T> {
  return collector.type === 'array';
}

/**
 * Type guard for ObjectCollector
 * @internal
 */
export function isObjectCollector(collector: Collector<unknown>): collector is ObjectCollector {
  return collector.type === 'object';
}

/**
 * Match context for relative XPath evaluation
 * @internal
 */
export interface MatchContext {
  /** The element that owns this schema (context node) */
  contextElement?: StartElementEvent;
  /** Depth of the context element */
  contextDepth: number;
  /** Parent context for nested structures */
  parentContext?: MatchContext;
  /** XPath of the context for debugging */
  contextXPath?: string;
}

/**
 * Schema activation state tracker
 * @internal
 */
export interface SchemaActivation {
  schema: XmlSchemaBase<unknown, unknown>;
  xpath: string;
  matcher: XPathMatcher;
  depth: number; // -2 = permanently deactivated (satisfied), -1 = inactive, >= 0 = active at this depth
  collector: Collector<unknown>;
  context?: MatchContext; // Context for relative XPath matching
  fieldName?: string; // For object fields
  isTemporary?: boolean; // Mark dynamically registered schemas for cleanup
  parentCollector?: Collector<unknown>; // Parent collector for cleanup tracking
}

/**
 * Internal state machine for event-based XML parsing
 * Processes events and fills collectors without type awareness
 *
 * @internal
 */
export class XmlParsingStateMachine {
  private activeSchemas: SchemaActivation[] = [];
  private currentDepth = 0;
  private eventCount = 0;
  private readonly maxDepth: number;
  private readonly maxEvents: number;
  //@ts-ignore 
  constructor(private readonly options: ParseOptions = {}) {
    this.maxDepth = options.maxDepth ?? 1000;
    this.maxEvents = options.maxEvents ?? 1000000;
  }

  /**
   * Register a schema for event-based activation
   */
  registerSchema(
    schema: XmlSchemaBase<unknown, unknown>,
    xpath: string,
    collector: Collector<unknown>,
    context?: MatchContext,
    fieldName?: string
  ): SchemaActivation {
    const activation: SchemaActivation = {
      schema,
      xpath,
      matcher: new XPathMatcher(xpath),
      depth: -1,
      collector,
      context,
      fieldName
    };

    this.activeSchemas.push(activation);
    return activation;
  }

  /**
   * Process events synchronously
   */
  processEventSync(event: AnyXmlEvent): void {
    this.checkLimits();

    if (isStartElement(event)) {
      this.currentDepth++;


      for (const activation of this.activeSchemas) {
        activation.matcher.onStartElement(event);

        // Check if we're within the activation's context
        const inContext = !activation.context || this.currentDepth > activation.context.contextDepth;
        if (!inContext) {
          continue; // Skip if we're not within this schema's context
        }

        // Check if this schema should activate using context-aware matching
        const unwrappedSchema = this.unwrapSchema(activation.schema);
        const isArray = isArraySchema(unwrappedSchema);
        const matches = this.matchesInContext(event, activation);

        // O(n) optimization: Arrays activate only once, then create items for subsequent matches
        const shouldActivate = isArray
          ? (activation.depth === -1 && matches)  // Activate once like others
          : (activation.depth === -1 && matches);  // Others activate once

        if (shouldActivate) {
          activation.depth = this.currentDepth;
          this.onSchemaActivatedSync(activation, event);
        } else {
          // Handle already-active array matches
          const isActiveArrayMatch = isArray
            && activation.depth !== -1  // Already active
            && matches;  // Matches again

          if (isActiveArrayMatch) {
            // Create new item WITHOUT activating again
            this.createArrayItemSync(activation, event);
          }
        }
      }
    } else if (isEndElement(event)) {
      // Deactivate schemas at current depth
      for (const activation of [...this.activeSchemas]) {
        if (activation.depth === this.currentDepth) {
          this.onSchemaDeactivatedSync(activation);
          // Only set to -1 if not already permanently deactivated (-2)
          if (activation.depth !== -2) {
            activation.depth = -1;
          }
        }
        activation.matcher.onEndElement();
      }

      this.currentDepth--;
    } else if (isCharacters(event) || isCdata(event)) {
      // Forward text to active schemas
      for (const activation of this.activeSchemas) {
        if (activation.depth !== -1 && activation.depth <= this.currentDepth) {
          this.onSchemaCollectText(activation, event.value);
        }
      }
    }

    this.eventCount++;
  }

  /**
   * Process events asynchronously
   */
  async processEvent(event: AnyXmlEvent): Promise<void> {
    this.checkLimits();

    if (isStartElement(event)) {
      this.currentDepth++;

      for (const activation of this.activeSchemas) {
        activation.matcher.onStartElement(event);

        // Check if we're within the activation's context
        const inContext = !activation.context || this.currentDepth > activation.context.contextDepth;
        if (!inContext) {
          continue; // Skip if we're not within this schema's context
        }

        // Check if this schema should activate using context-aware matching
        const unwrappedSchema = this.unwrapSchema(activation.schema);
        const isArray = isArraySchema(unwrappedSchema);
        const matches = this.matchesInContext(event, activation);

        // O(n) optimization: Arrays activate only once, then create items for subsequent matches
        const shouldActivate = isArray
          ? (activation.depth === -1 && matches)  // Activate once like others
          : (activation.depth === -1 && matches);  // Others activate once

        if (shouldActivate) {
          activation.depth = this.currentDepth;
          await this.onSchemaActivated(activation, event);
        } else {
          // Handle already-active array matches
          const isActiveArrayMatch = isArray
            && activation.depth !== -1  // Already active
            && matches;  // Matches again

          if (isActiveArrayMatch) {
            // Create new item WITHOUT activating again
            await this.createArrayItemAsync(activation, event);
          }
        }
      }
    } else if (isEndElement(event)) {
      for (const activation of [...this.activeSchemas]) {
        if (activation.depth === this.currentDepth) {
          await this.onSchemaDeactivated(activation);
          // Only set to -1 if not already permanently deactivated (-2)
          if (activation.depth !== -2) {
            activation.depth = -1;
          }
        }
        activation.matcher.onEndElement();
      }

      this.currentDepth--;
    } else if (isCharacters(event) || isCdata(event)) {
      for (const activation of this.activeSchemas) {
        if (activation.depth !== -1 && activation.depth <= this.currentDepth) {
          this.onSchemaCollectText(activation, event.value);
        }
      }
    }

    this.eventCount++;
  }

  /**
   * Alias for processEvent (async)
   */
  async processEventAsync(event: AnyXmlEvent): Promise<void> {
    return this.processEvent(event);
  }

  /**
   * Unwrap Transform and Optional wrappers to get core schema
   */
  private unwrapSchema(schema: XmlSchemaBase<unknown, unknown>): XmlSchemaBase<unknown, unknown> {
    let unwrapped = schema;
    while (isTransformSchema(unwrapped) || isOptionalSchema(unwrapped)) {
      unwrapped = unwrapped.schema;
    }
    return unwrapped;
  }

  /**
   * Check if event matches activation's XPath within its context
   */
  private matchesInContext(event: StartElementEvent, activation: SchemaActivation): boolean {
    const xpath = activation.xpath;
    const context = activation.context;

    // No context means root-level matching
    if (!context) {
      return activation.matcher.matches(event);
    }

    // For relative paths (./price), check depth relative to context
    if (xpath.startsWith('./')) {
      const relativePath = xpath.slice(2);

      // Attribute selectors (./@attr) match at the same depth as context
      if (relativePath.startsWith('@')) {
        // This is an attribute selector - it should activate at context depth
        return this.currentDepth === context.contextDepth && activation.matcher.matches(event);
      }

      const pathSegments = relativePath.split('/').filter(s => s.length > 0);

      // Check for element/@attr pattern (e.g., "./name/@lang")
      if (pathSegments.length >= 2 && pathSegments[pathSegments.length - 1].startsWith('@')) {
        // This is an element with an attribute selector
        // Expected depth is context + (segments - 1) because @attr doesn't increase depth
        const expectedDepth = context.contextDepth + (pathSegments.length - 1);

        if (this.currentDepth !== expectedDepth) {
          return false;
        }

        // Check if element name matches (second to last segment)
        const elementSegment = pathSegments[pathSegments.length - 2];
        const elementName = elementSegment.split('[')[0]; // Remove predicates

        return event.name === elementName && activation.matcher.matches(event);
      }

      // Check for element/text() pattern (e.g., "./name/text()")
      if (pathSegments.length >= 2 && pathSegments[pathSegments.length - 1] === 'text()') {
        // This is an element with a text() selector
        // Expected depth is context + (segments - 1) because text() doesn't increase depth
        const expectedDepth = context.contextDepth + (pathSegments.length - 1);

        if (this.currentDepth !== expectedDepth) {
          return false;
        }

        // Check if element name matches (second to last segment)
        const elementSegment = pathSegments[pathSegments.length - 2];
        const elementName = elementSegment.split('[')[0]; // Remove predicates

        return event.name === elementName && activation.matcher.matches(event);
      }

      const expectedDepth = context.contextDepth + pathSegments.length;

      // Check depth matches and element name matches the last segment
      if (this.currentDepth !== expectedDepth) {
        return false;
      }

      // Check if element name matches (handle predicates later)
      const lastSegment = pathSegments[pathSegments.length - 1];
      const elementName = lastSegment.split('[')[0]; // Remove predicates

      return event.name === elementName && activation.matcher.matches(event);
    }

    // For descendant paths (//price), match at any depth below context
    if (xpath.startsWith('//')) {
      return this.currentDepth > context.contextDepth && activation.matcher.matches(event);
    }

    // For absolute paths, use standard matching
    return activation.matcher.matches(event);
  }

  /**
   * Create a new array item for an already-active array schema (sync)
   * @internal
   */
  private createArrayItemSync(activation: SchemaActivation, event: StartElementEvent): void {
    if (activation.collector.type !== 'array') return;
    const arrayCollector = activation.collector;
    // Unwrap schema to get the actual array schema (in case it's wrapped in Transform/Optional)
    const unwrappedArraySchema = this.unwrapSchema(activation.schema);
    if (!isArraySchema(unwrappedArraySchema)) return;

    const elementSchema = unwrappedArraySchema.element;
    const unwrappedElement = this.unwrapSchema(elementSchema);

    if (isObjectSchema(unwrappedElement)) {
      // Complex element: object
      const itemCollector: ObjectCollector = {
        type: 'object',
        fields: new Map()
      };

      // Create context for this array item (object)
      const itemContext: MatchContext = {
        contextElement: event,
        contextDepth: this.currentDepth,
        parentContext: activation.context,
        contextXPath: activation.xpath
      };

      // Register object fields with context
      const shape = unwrappedElement.shape;
      for (const [fieldName, fieldSchema] of Object.entries(shape) as Array<[string, XmlSchemaBase<unknown, unknown>]>) {
        const xpath = this.extractXPath(fieldSchema);
        if (!xpath) continue;

        const childCollector = this.createCollectorForSchema(fieldSchema);

        const activation = this.registerSchema(
          fieldSchema,
          xpath,  // Keep original xpath
          childCollector,
          itemContext,  // Pass context for relative matching
          fieldName
        );

        // Mark as temporary - should be cleaned up when parent deactivates
        activation.isTemporary = true;
        activation.parentCollector = itemCollector; // Track parent for precise cleanup

        itemCollector.fields.set(fieldName, childCollector);

        // If this is an attribute selector, activate it immediately on current event
        if (xpath.startsWith('./@') || xpath.startsWith('@')) {
          const relativePath = xpath.startsWith('./@') ? xpath.slice(3) : xpath.slice(1);
          if (event.attributes && relativePath in event.attributes) {
            const attrValue = event.attributes[relativePath];
            if (childCollector.type === 'string') {
              childCollector.value = attrValue;
            } else if (childCollector.type === 'number') {
              const parsedValue = parseFloat(attrValue);
              childCollector.value = parsedValue;
            }
          }
        }
        // If this is a text() selector, activate it immediately on current element
        // so it can collect text from the element's content
        else if (xpath === './text()' || xpath === 'text()') {
          // Activate the schema on current event to collect text
          activation.depth = this.currentDepth;
          if (childCollector.type === 'string' || childCollector.type === 'number') {
            childCollector.buffer = '';
          }
        }
      }

      arrayCollector.currentItem = itemCollector;
    } else if (isArraySchema(unwrappedElement)) {
      // Complex element: nested array
      const itemCollector: ArrayCollector<unknown> = {
        type: 'array',
        items: []
      };

      // Create context for nested array
      const nestedContext: MatchContext = {
        contextElement: event,
        contextDepth: this.currentDepth,
        parentContext: activation.context,
        contextXPath: activation.xpath
      };

      // Register nested array with context
      const nestedXPath = unwrappedElement.xpath;
      if (nestedXPath) {
        const nestedActivation = this.registerSchema(
          elementSchema,
          nestedXPath,  // Keep original xpath
          itemCollector,
          nestedContext,  // Pass context
          undefined
        );

        // Mark as temporary - should be cleaned up when parent array item deactivates
        nestedActivation.isTemporary = true;
        nestedActivation.parentCollector = itemCollector;
      }

      arrayCollector.currentItem = itemCollector;
    } else {
      // Simple element: string/number
      arrayCollector.currentItem = {
        depth: this.currentDepth,
        buffer: ''
      };
    }
  }

  /**
   * Create a new array item for an already-active array schema (async)
   * @internal
   */
  private async createArrayItemAsync(activation: SchemaActivation, event: StartElementEvent): Promise<void> {
    // Same logic as sync version for now
    this.createArrayItemSync(activation, event);
  }

  /**
   * Schema activated (sync)
   */
  private onSchemaActivatedSync(activation: SchemaActivation, event: StartElementEvent): void {
    // Priority 1: Handle attribute selectors immediately
    if (activation.matcher.isAttributeSelector()) {
      const attrName = activation.matcher.getAttributeName();
      if (attrName && event.attributes && attrName in event.attributes) {
        const value = event.attributes[attrName];

        // Store value based on collector type
        if (activation.collector.type === 'array') {
          // Check if array elements need type conversion
          const unwrappedSchema = this.unwrapSchema(activation.schema);
          if (isArraySchema(unwrappedSchema)) {
            const unwrappedElement = this.unwrapSchema(unwrappedSchema.element);
            if (isNumberSchema(unwrappedElement) && unwrappedElement._parseText) {
              activation.collector.items.push(unwrappedElement._parseText(value));
            } else {
              activation.collector.items.push(value);
            }
          } else {
            activation.collector.items.push(value);
          }
        } else if (activation.collector.type === 'string') {
          activation.collector.value = value;
        } else if (activation.collector.type === 'number' && activation.schema._parseText) {
          // Call schema's _parseText to apply validation
          activation.collector.value = activation.schema._parseText(value);
        }

        // Immediately deactivate - no need to process children
        activation.depth = -1;
        return;
      }
    }

    const unwrappedSchema = this.unwrapSchema(activation.schema);

    // Priority 2: Handle arrays before text() check
    // Arrays with text() selectors need to create items before collecting text
    if (isArraySchema(unwrappedSchema)) {
      // Array element matched - start collecting first item
      this.createArrayItemSync(activation, event);
      return;
    }

    // Priority 3: Handle text node selectors (text())
    // Text nodes need to collect text content from the matched element
    if (activation.matcher.isTextNodeSelector()) {
      // Initialize buffer for text collection
      if (activation.collector.type === 'string' || activation.collector.type === 'number') {
        activation.collector.buffer = '';
      }
      // Will collect text in onSchemaCollectText and finalize in deactivation
      return;
    }

    if (isStringSchema(unwrappedSchema) || isNumberSchema(unwrappedSchema)) {
      if (activation.collector.type === 'string' || activation.collector.type === 'number') {
        activation.collector.buffer = '';
      }
    } else if (isObjectSchema(unwrappedSchema)) {
      // Object matched - dynamically register field schemas
      if (activation.collector.type !== 'object') return;
      const objectCollector = activation.collector;
      const shape = unwrappedSchema.shape;

      // Create context for this object's fields
      const objectContext: MatchContext = {
        contextElement: event,
        contextDepth: this.currentDepth,
        parentContext: activation.context,
        contextXPath: activation.xpath
      };

      for (const [fieldName, fieldSchema] of Object.entries(shape) as Array<[string, XmlSchemaBase<unknown, unknown>]>) {
        const xpath = this.extractXPath(fieldSchema);
        if (!xpath) continue;

        // Create collector for this field
        const childCollector = this.createCollectorForSchema(fieldSchema);

        // Register child schema with context (no path resolution needed!)
        this.registerSchema(
          fieldSchema,
          xpath,  // Keep original xpath (./price, ./name, etc.)
          childCollector,
          objectContext,  // Pass context for relative matching
          fieldName
        );

        // Store collector in object's fields map
        objectCollector.fields.set(fieldName, childCollector);

        // If this is an attribute selector, activate it immediately on current event
        if (xpath.startsWith('./@') || xpath.startsWith('@')) {
          const relativePath = xpath.startsWith('./@') ? xpath.slice(3) : xpath.slice(1);
          if (event.attributes && relativePath in event.attributes) {
            const attrValue = event.attributes[relativePath];
            if (childCollector.type === 'string') {
              childCollector.value = attrValue;
            } else if (childCollector.type === 'number' && fieldSchema._parseText) {
              // Call schema's _parseText to apply validation
              childCollector.value = fieldSchema._parseText(attrValue);
            }
          }
        }
      }
    }
  }

  /**
   * Schema activated (async)
   */
  private async onSchemaActivated(activation: SchemaActivation, event: StartElementEvent): Promise<void> {
    // Same logic as sync for now
    this.onSchemaActivatedSync(activation, event);
  }

  /**
   * Schema deactivated (sync)
   */
  private onSchemaDeactivatedSync(activation: SchemaActivation): void {
    const unwrappedSchema = this.unwrapSchema(activation.schema);

    // Handle text() node selectors
    if (activation.matcher.isTextNodeSelector()) {
      if (isStringSchema(unwrappedSchema)) {
        if (activation.collector.type !== 'string') return;
        const stringCollector = activation.collector;
        stringCollector.value = stringCollector.buffer.trim();
        activation.depth = -2;
        return;
      } else if (isNumberSchema(unwrappedSchema)) {
        if (activation.collector.type !== 'number') return;
        const numberCollector = activation.collector;
        const text = numberCollector.buffer.trim();
        if (unwrappedSchema._parseText) {
          numberCollector.value = unwrappedSchema._parseText(text);
        }
        activation.depth = -2;
        return;
      }
    }

    if (isStringSchema(unwrappedSchema)) {
      if (activation.collector.type !== 'string') return;
      const stringCollector = activation.collector;
      stringCollector.value = stringCollector.buffer.trim();
      // Mark as satisfied - non-array schemas should not reactivate
      // Use depth = -2 as a sentinel for "permanently deactivated"
      activation.depth = -2;
      return;
    } else if (isNumberSchema(unwrappedSchema)) {
      if (activation.collector.type !== 'number') return;
      const numberCollector = activation.collector;
      const text = numberCollector.buffer.trim();
      // Call schema's _parseText to apply validation (min/max/int checks)
      if (unwrappedSchema._parseText) {
        numberCollector.value = unwrappedSchema._parseText(text);
      }
      // Mark as satisfied - non-array schemas should not reactivate
      activation.depth = -2;
      return;
    } else if (isArraySchema(unwrappedSchema)) {
      // Array element finished - add to items
      if (activation.collector.type !== 'array') return;
      const arrayCollector = activation.collector;
      if (arrayCollector.currentItem) {
        const elementSchema = unwrappedSchema.element;
        const unwrappedElement = this.unwrapSchema(elementSchema);

        if (isObjectSchema(unwrappedElement) &&
          typeof arrayCollector.currentItem === 'object' &&
          'fields' in arrayCollector.currentItem) {
          // Complex element: object
          const itemObject = this.extractObjectFromCollector(
            arrayCollector.currentItem,
            elementSchema
          );
          arrayCollector.items.push(itemObject);
        } else if (isArraySchema(unwrappedElement) &&
          typeof arrayCollector.currentItem === 'object' &&
          'items' in arrayCollector.currentItem) {
          // Complex element: nested array
          arrayCollector.items.push(arrayCollector.currentItem.items);
        } else if ('buffer' in arrayCollector.currentItem) {
          // Simple element: string or number
          const text = arrayCollector.currentItem.buffer.trim();

          // Apply type conversion based on element schema
          let value: unknown = text;
          if (isNumberSchema(unwrappedElement) && unwrappedElement._parseText) {
            value = unwrappedElement._parseText(text);
          }

          // Apply transforms from the element schema
          const transforms = this.getAllTransforms(elementSchema);
          for (const transformFn of transforms) {
            value = transformFn(value);
          }

          arrayCollector.items.push(value);
        }

        // Clean up temporary child schemas for this array item
        // Only remove schemas that were registered with this specific collector
        this.activeSchemas = this.activeSchemas.filter(a =>
          !(a.isTemporary && a.parentCollector === arrayCollector.currentItem)
        );

        arrayCollector.currentItem = undefined;
      }
    } else if (isObjectSchema(unwrappedSchema)) {
      // Mark object as satisfied - non-array schemas should not reactivate
      activation.depth = -2;
      return;
    }
    // Other schema types default to depth = -1 (set in END_ELEMENT handler)
  }

  /**
   * Schema deactivated (async)
   */
  private async onSchemaDeactivated(activation: SchemaActivation): Promise<void> {
    // Same logic as sync for now
    this.onSchemaDeactivatedSync(activation);
  }

  /**
   * Collect text content for active schema
   */
  private onSchemaCollectText(activation: SchemaActivation, text: string): void {
    const collector = activation.collector;

    // For text() selectors, only collect text at the exact activation depth
    // (direct text content, not from nested elements)
    if (activation.matcher.isTextNodeSelector()) {
      if (this.currentDepth === activation.depth) {
        if (collector.type === 'string' || collector.type === 'number') {
          collector.buffer += text;
        } else if (collector.type === 'array') {
          // For arrays with text() selector, collect into current item buffer
          if (collector.currentItem && 'buffer' in collector.currentItem) {
            collector.currentItem.buffer += text;
          }
        }
      }
      return;
    }

    // For regular selectors, collect text from activation depth and below
    if (collector.type === 'string' || collector.type === 'number') {
      collector.buffer += text;
    } else if (collector.type === 'array') {
      if (collector.currentItem && 'buffer' in collector.currentItem) {
        // Only collect text for simple array elements (not objects or nested arrays)
        collector.currentItem.buffer += text;
      }
    }
  }

  /**
   * Check depth and event limits
   */
  private checkLimits(): void {
    if (this.currentDepth > this.maxDepth) {
      throw new Error(`XML depth limit exceeded: ${this.maxDepth}`);
    }
    if (this.eventCount > this.maxEvents) {
      throw new Error(`XML event limit exceeded: ${this.maxEvents}`);
    }
  }

  /**
   * Reset state for reuse
   */
  reset(): void {
    this.activeSchemas = [];
    this.currentDepth = 0;
    this.eventCount = 0;
  }


  /**
   * Extract XPath from a schema (handles wrappers and different schema types)
   * @internal
   */
  private extractXPath(schema: XmlSchemaBase<unknown, unknown>): string | undefined {
    const unwrapped = this.unwrapSchema(schema);

    // XmlArraySchema has direct xpath property
    if (isArraySchema(unwrapped)) {
      return unwrapped.xpath;
    }

    // Other schemas (String, Number, Object) use options.xpath
    if (isStringSchema(unwrapped) || isNumberSchema(unwrapped)) {
      return unwrapped.options.xpath;
    }

    if (isObjectSchema(unwrapped)) {
      return unwrapped.options.xpath;
    }

    return undefined;
  }

  /**
   * Create appropriate collector for a schema type
   * @internal
   */
  private createCollectorForSchema(schema: XmlSchemaBase<unknown, unknown>): Collector<unknown> {
    const unwrapped = this.unwrapSchema(schema);

    if (isStringSchema(unwrapped)) {
      return { type: 'string', buffer: '' };
    } else if (isNumberSchema(unwrapped)) {
      return { type: 'number', buffer: '' };
    } else if (isArraySchema(unwrapped)) {
      return { type: 'array', items: [] };
    } else if (isObjectSchema(unwrapped)) {
      return { type: 'object', fields: new Map() };
    }

    // Fallback to string
    return { type: 'string', buffer: '' };
  }

  /**
   * Extract object from ObjectCollector
   * @internal
   */
  private extractObjectFromCollector(
    collector: ObjectCollector,
    schema: XmlSchemaBase<unknown, unknown>
  ): Record<string, unknown> {
    let result: Record<string, unknown> = {};
    const unwrappedSchema = this.unwrapSchema(schema);
    if (!isObjectSchema(unwrappedSchema)) return result;

    const shape = unwrappedSchema.shape;

    // 1. Extract field values from collectors
    for (const [fieldName, fieldCollector] of collector.fields) {
      const fieldSchema = shape[fieldName];
      if (fieldSchema) {
        // Recursively extract, applying field-level transforms
        result[fieldName] = this.extractValueWithTransforms(fieldCollector, fieldSchema);
      }
    }

    // 2. Apply object-level transforms
    const transforms = this.getAllTransforms(schema);
    for (const transformFn of transforms) {
      result = transformFn(result);
    }

    return result;
  }

  /**
   * Get all transform functions from schema chain
   * @internal
   */
  private getAllTransforms(schema: XmlSchemaBase<unknown, unknown>): Array<(value: unknown) => unknown> {
    const transforms: Array<(value: unknown) => unknown> = [];
    let current: XmlSchemaBase<unknown, unknown> = schema;

    while (isTransformSchema(current) || isOptionalSchema(current)) {
      if (isTransformSchema(current)) {
        if (current.transformFn) {
          transforms.unshift(current.transformFn); // Prepend for correct order
        }
        current = current.schema;
      } else if (isOptionalSchema(current)) {
        current = current.schema;
      }
    }

    return transforms;
  }

  /**
   * Extract value with field-level transforms
   * @internal
   */
  private extractValueWithTransforms(collector: Collector<unknown>, schema: XmlSchemaBase<unknown, unknown>): unknown {
    // Check if schema is optional
    const schemaIsOptional = this.hasOptionalWrapper(schema);
    let value = this.extractSimpleValue(collector, schemaIsOptional);

    // Apply transforms for this field
    const transforms = this.getAllTransforms(schema);
    for (const transformFn of transforms) {
      value = transformFn(value);
    }

    return value;
  }

  /**
   * Extract simple value from collector (without transforms)
   * @internal
   */
  private extractSimpleValue(collector: Collector<unknown>, isOptional: boolean = false): unknown {
    if (collector.type === 'string') {
      // If buffer has content but value is empty, use buffer (for text() selectors)
      let stringValue = collector.value ?? '';
      if (stringValue === '' && collector.buffer && collector.buffer.trim() !== '') {
        stringValue = collector.buffer.trim();
      }
      // For optional schemas, treat empty string as undefined
      if (isOptional && stringValue === '') {
        return undefined;
      }
      return stringValue;
    } else if (collector.type === 'number') {
      // If buffer has content but value is NaN/undefined, parse buffer (for text() selectors)
      if ((collector.value === undefined || isNaN(collector.value)) && collector.buffer && collector.buffer.trim() !== '') {
        return parseFloat(collector.buffer.trim());
      }
      return collector.value ?? NaN;
    } else if (collector.type === 'array') {
      // Array items are already extracted by onSchemaDeactivatedSync
      return collector.items;
    } else if (collector.type === 'object') {
      // Recursively extract object fields
      const result: Record<string, unknown> = {};
      for (const [key, childCollector] of collector.fields) {
        result[key] = this.extractSimpleValue(childCollector, false);
      }
      return result;
    }
    return undefined;
  }

  /**
   * Check if schema chain contains XmlOptionalSchema
   * @internal
   */
  private hasOptionalWrapper(schema: XmlSchemaBase<unknown, unknown>): boolean {
    let current: XmlSchemaBase<unknown, unknown> = schema;
    while (isOptionalSchema(current) || isTransformSchema(current)) {
      if (isOptionalSchema(current)) {
        return true;
      }
      if (isTransformSchema(current)) {
        current = current.schema;
      }
    }
    return false;
  }
}
