import { XmlSchemaBase } from './base.js';
import { XPathMatcher } from './XPathEngine.js';
import type { ParseOptions } from './types.js';
import type { AnyXmlEvent, StartElementEvent } from '../types.js';
import {
  isStartElement,
  isEndElement,
  isCharacters,
  isCdata
} from '../types.js';

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
  } | ObjectCollector | ArrayCollector<any>;
}

export interface ObjectCollector {
  type: 'object';
  fields: Map<string, Collector<any>>;
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
  schema: XmlSchemaBase<any, any>;
  xpath: string;
  matcher: XPathMatcher;
  depth: number; // -1 = inactive, >= 0 = active at this depth
  collector: Collector<any>;
  context?: MatchContext; // Context for relative XPath matching
  fieldName?: string; // For object fields
  isTemporary?: boolean; // Mark dynamically registered schemas for cleanup
  parentCollector?: Collector<any>; // Parent collector for cleanup tracking
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

  constructor(private readonly options: ParseOptions = {}) {
    this.maxDepth = options.maxDepth ?? 1000;
    this.maxEvents = options.maxEvents ?? 1000000;
  }

  /**
   * Register a schema for event-based activation
   */
  registerSchema(
    schema: XmlSchemaBase<any, any>,
    xpath: string,
    collector: Collector<any>,
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
        const isArraySchema = this.getSchemaType(activation.schema) === 'XmlArraySchema';
        const matches = this.matchesInContext(event, activation);

        // O(n) optimization: Arrays activate only once, then create items for subsequent matches
        const shouldActivate = isArraySchema
          ? (activation.depth === -1 && matches)  // Activate once like others
          : (activation.depth === -1 && matches);  // Others activate once

        if (shouldActivate) {
          activation.depth = this.currentDepth;
          this.onSchemaActivatedSync(activation, event);
        } else {
          // Handle already-active array matches
          const isActiveArrayMatch = isArraySchema
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
          activation.depth = -1;
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
        const isArraySchema = this.getSchemaType(activation.schema) === 'XmlArraySchema';
        const matches = this.matchesInContext(event, activation);

        // O(n) optimization: Arrays activate only once, then create items for subsequent matches
        const shouldActivate = isArraySchema
          ? (activation.depth === -1 && matches)  // Activate once like others
          : (activation.depth === -1 && matches);  // Others activate once

        if (shouldActivate) {
          activation.depth = this.currentDepth;
          await this.onSchemaActivated(activation, event);
        } else {
          // Handle already-active array matches
          const isActiveArrayMatch = isArraySchema
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
          activation.depth = -1;
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
   * Get schema type name (runtime type detection)
   */
  /**
   * Unwrap Transform and Optional wrappers
   */
  private unwrapSchema(schema: any): any {
    let unwrapped = schema;
    while (unwrapped && 'schema' in unwrapped) {
      const typeName = unwrapped.constructor?.name || '';
      if (typeName === 'XmlTransformSchema' || typeName === 'XmlOptionalSchema') {
        unwrapped = unwrapped.schema;
      } else {
        break;
      }
    }
    return unwrapped || schema;
  }

  getSchemaType(schema: XmlSchemaBase<any, any>): string {
    if (!schema) return 'undefined';
    return this.unwrapSchema(schema)?.constructor?.name || schema?.constructor?.name || 'unknown';
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
    const arrayCollector = activation.collector as ArrayCollector<any>;
    // Unwrap schema to get the actual array schema (in case it's wrapped in Transform/Optional)
    const unwrappedArraySchema = this.unwrapSchema(activation.schema);
    const elementSchema = (unwrappedArraySchema as any).element;
    const elementType = this.getSchemaType(elementSchema);

    if (elementType === 'XmlObjectSchema') {
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
      const unwrappedElement = this.unwrapSchema(elementSchema);
      const shape = (unwrappedElement as any).shape;
      for (const [fieldName, fieldSchema] of Object.entries(shape)) {
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
              childCollector.value = parseFloat(attrValue);
            }
          }
        }
      }

      arrayCollector.currentItem = itemCollector;
    } else if (elementType === 'XmlArraySchema') {
      // Complex element: nested array
      const itemCollector: ArrayCollector<any> = {
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
      const nestedXPath = (elementSchema as any).xpath;
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
          activation.collector.items.push(value);
        } else if (activation.collector.type === 'string') {
          activation.collector.value = value;
        } else if (activation.collector.type === 'number') {
          // Call schema's _parseText to apply validation
          activation.collector.value = (activation.schema as any)._parseText(value);
        }

        // Immediately deactivate - no need to process children
        activation.depth = -1;
        return;
      }
    }

    const schemaType = this.getSchemaType(activation.schema);

    switch (schemaType) {
      case 'XmlStringSchema':
      case 'XmlNumberSchema':
        (activation.collector as StringCollector | NumberCollector).buffer = '';
        break;

      case 'XmlArraySchema':
        // Array element matched - start collecting first item
        this.createArrayItemSync(activation, event);
        break;

      case 'XmlObjectSchema':
        // Object matched - dynamically register field schemas
        const objectCollector = activation.collector as ObjectCollector;
        const unwrappedObject = this.unwrapSchema(activation.schema);
        const shape = (unwrappedObject as any).shape as Record<string, any>;

        // Create context for this object's fields
        const objectContext: MatchContext = {
          contextElement: event,
          contextDepth: this.currentDepth,
          parentContext: activation.context,
          contextXPath: activation.xpath
        };

        for (const [fieldName, fieldSchema] of Object.entries(shape)) {
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
              } else if (childCollector.type === 'number') {
                // Call schema's _parseText to apply validation
                childCollector.value = (fieldSchema as any)._parseText(attrValue);
              }
            }
          }
        }
        break;
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
    const schemaType = this.getSchemaType(activation.schema);

    switch (schemaType) {
      case 'XmlStringSchema':
        const stringCollector = activation.collector as StringCollector;
        stringCollector.value = stringCollector.buffer.trim();
        break;

      case 'XmlNumberSchema':
        const numberCollector = activation.collector as NumberCollector;
        const text = numberCollector.buffer.trim();
        // Call schema's _parseText to apply validation (min/max/int checks)
        numberCollector.value = (activation.schema as any)._parseText(text);
        break;

      case 'XmlArraySchema':
        // Array element finished - add to items
        const arrayCollector = activation.collector as ArrayCollector<any>;
        if (arrayCollector.currentItem) {
          // Unwrap schema to get the actual array schema (in case it's wrapped in Transform/Optional)
          const unwrappedArraySchema = this.unwrapSchema(activation.schema);
          const elementSchema = (unwrappedArraySchema as any).element;
          const elementType = this.getSchemaType(elementSchema);

          if (elementType === 'XmlObjectSchema' &&
              typeof arrayCollector.currentItem === 'object' &&
              'fields' in arrayCollector.currentItem) {
            // Complex element: object
            const itemObject = this.extractObjectFromCollector(
              arrayCollector.currentItem,
              elementSchema
            );
            arrayCollector.items.push(itemObject);
          } else if (elementType === 'XmlArraySchema' &&
                     typeof arrayCollector.currentItem === 'object' &&
                     'items' in arrayCollector.currentItem) {
            // Complex element: nested array
            arrayCollector.items.push(arrayCollector.currentItem.items);
          } else if ('buffer' in arrayCollector.currentItem) {
            // Simple element: string or number
            const text = arrayCollector.currentItem.buffer.trim();

            // Apply type conversion based on element schema
            if (elementType === 'XmlNumberSchema') {
              const numberValue = (elementSchema as any)._parseText(text);
              arrayCollector.items.push(numberValue);
            } else {
              arrayCollector.items.push(text);
            }
          }

          // Clean up temporary child schemas for this array item
          // Only remove schemas that were registered with this specific collector
          this.activeSchemas = this.activeSchemas.filter(a =>
            !(a.isTemporary && a.parentCollector === arrayCollector.currentItem)
          );

          arrayCollector.currentItem = undefined;
        }
        break;

      case 'XmlObjectSchema':
        // Object finished
        break;
    }
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
  private extractXPath(schema: any): string | undefined {
    if (!schema || typeof schema !== 'object') {
      return undefined;
    }

    // Unwrap Transform/Optional wrappers first
    let current = schema;
    while (current) {
      const typeName = current.constructor?.name || '';
      if (typeName === 'XmlTransformSchema' || typeName === 'XmlOptionalSchema') {
        current = current.schema;
      } else {
        break;
      }
    }

    // XmlArraySchema has direct xpath property
    if ('xpath' in current && typeof current.xpath === 'string') {
      return current.xpath;
    }

    // Other schemas use options.xpath
    if ('options' in current && current.options?.xpath) {
      return current.options.xpath;
    }

    return undefined;
  }

  /**
   * Create appropriate collector for a schema type
   * @internal
   */
  private createCollectorForSchema(schema: any): Collector<any> {
    // Unwrap wrappers to get core schema type
    let unwrapped = schema;
    while (unwrapped && 'schema' in unwrapped) {
      const typeName = unwrapped.constructor?.name || '';
      if (typeName === 'XmlTransformSchema' || typeName === 'XmlOptionalSchema') {
        unwrapped = unwrapped.schema;
      } else {
        break;
      }
    }

    const schemaType = unwrapped?.constructor?.name || '';

    switch (schemaType) {
      case 'XmlStringSchema':
        return { type: 'string', buffer: '' };
      case 'XmlNumberSchema':
        return { type: 'number', buffer: '' };
      case 'XmlArraySchema':
        return { type: 'array', items: [] };
      case 'XmlObjectSchema':
        return { type: 'object', fields: new Map() };
      default:
        // Fallback to string
        return { type: 'string', buffer: '' };
    }
  }

  /**
   * Extract object from ObjectCollector
   * @internal
   */
  private extractObjectFromCollector(
    collector: ObjectCollector,
    schema: any
  ): any {
    let result: any = {};
    const unwrappedSchema = this.unwrapSchema(schema);
    const shape = (unwrappedSchema as any).shape;

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
  private getAllTransforms(schema: any): Array<(value: any) => any> {
    const transforms: Array<(value: any) => any> = [];
    let current = schema;

    while (current) {
      const typeName = current?.constructor?.name || '';
      if (typeName === 'XmlTransformSchema') {
        if (current.transformFn) {
          transforms.unshift(current.transformFn); // Prepend for correct order
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
   * Extract value with field-level transforms
   * @internal
   */
  private extractValueWithTransforms(collector: Collector<any>, schema: any): any {
    // Check if schema is optional
    const isOptional = this.isOptionalSchema(schema);
    let value = this.extractSimpleValue(collector, isOptional);

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
  private extractSimpleValue(collector: Collector<any>, isOptional: boolean = false): any {
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
      // Array items are already extracted by onSchemaDeactivatedSync
      return collector.items;
    } else if (collector.type === 'object') {
      // Recursively extract object fields
      const result: any = {};
      for (const [key, childCollector] of collector.fields) {
        result[key] = this.extractSimpleValue(childCollector, false);
      }
      return result;
    }
    return undefined;
  }

  /**
   * Check if schema is wrapped in XmlOptionalSchema
   * @internal
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
}
