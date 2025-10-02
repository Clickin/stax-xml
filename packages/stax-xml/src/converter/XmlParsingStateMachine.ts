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

      // Debug logging
      const isDebug = false; // Set to true to enable logging
      if (isDebug) {
        console.log(`[SM] START <${event.name}> depth=${this.currentDepth}, activeSchemas=${this.activeSchemas.length}`);
      }

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
        const shouldActivate = isArraySchema
          ? matches  // Arrays activate on every match
          : (activation.depth === -1 && matches);  // Others activate once

        if (shouldActivate) {
          if (isDebug) {
            console.log(`[SM]   ✓ Activated: ${activation.fieldName || 'root'} (${this.getSchemaType(activation.schema)}) xpath=${activation.xpath}`);
          }
          activation.depth = this.currentDepth;
          this.onSchemaActivatedSync(activation, event);
        }
      }
    } else if (isEndElement(event)) {
      // Debug logging
      const isDebug = false;
      if (isDebug) {
        console.log(`[SM] END </${event.name}> depth=${this.currentDepth}`);
      }

      // Deactivate schemas at current depth
      for (const activation of [...this.activeSchemas]) {
        if (activation.depth === this.currentDepth) {
          if (isDebug) {
            console.log(`[SM]   ✗ Deactivated: ${activation.fieldName || 'root'} (${this.getSchemaType(activation.schema)})`);
          }
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
        const shouldActivate = isArraySchema
          ? matches  // Arrays activate on every match
          : (activation.depth === -1 && matches);  // Others activate once

        if (shouldActivate) {
          activation.depth = this.currentDepth;
          await this.onSchemaActivated(activation, event);
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
  getSchemaType(schema: XmlSchemaBase<any, any>): string {
    return schema.constructor.name;
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
      const pathSegments = relativePath.split('/').filter(s => s.length > 0);
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
          activation.collector.value = parseFloat(value);
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
        // Array element matched - start collecting
        const arrayCollector = activation.collector as ArrayCollector<any>;
        const elementSchema = (activation.schema as any).element;
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
          const shape = (elementSchema as any).shape;
          for (const [fieldName, fieldSchema] of Object.entries(shape)) {
            const xpath = this.extractXPath(fieldSchema);
            if (!xpath) continue;

            const childCollector = this.createCollectorForSchema(fieldSchema);

            this.registerSchema(
              fieldSchema,
              xpath,  // Keep original xpath
              childCollector,
              itemContext,  // Pass context for relative matching
              fieldName
            );

            itemCollector.fields.set(fieldName, childCollector);
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
            this.registerSchema(
              elementSchema,
              nestedXPath,  // Keep original xpath
              itemCollector,
              nestedContext,  // Pass context
              undefined
            );
          }

          arrayCollector.currentItem = itemCollector;
        } else {
          // Simple element: string/number
          arrayCollector.currentItem = {
            depth: this.currentDepth,
            buffer: ''
          };
        }
        break;

      case 'XmlObjectSchema':
        // Object matched - dynamically register field schemas
        const objectCollector = activation.collector as ObjectCollector;
        const shape = (activation.schema as any).shape as Record<string, any>;

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
        numberCollector.value = text ? parseFloat(text) : NaN;
        break;

      case 'XmlArraySchema':
        // Array element finished - add to items
        const arrayCollector = activation.collector as ArrayCollector<any>;
        const isDebug = false;
        if (isDebug) {
          console.log(`[SM]     Array deactivate: currentItem=`, arrayCollector.currentItem ? JSON.stringify(arrayCollector.currentItem, (k, v) => v instanceof Map ? `Map(${v.size})` : v) : 'undefined');
        }
        if (arrayCollector.currentItem) {
          const elementSchema = (activation.schema as any).element;
          const elementType = this.getSchemaType(elementSchema);

          if (elementType === 'XmlObjectSchema' &&
              typeof arrayCollector.currentItem === 'object' &&
              'fields' in arrayCollector.currentItem) {
            // Complex element: object
            const itemObject = this.extractObjectFromCollector(
              arrayCollector.currentItem,
              elementSchema
            );
            if (isDebug) console.log(`[SM]     Pushing object:`, itemObject);
            arrayCollector.items.push(itemObject);
          } else if (elementType === 'XmlArraySchema' &&
                     typeof arrayCollector.currentItem === 'object' &&
                     'items' in arrayCollector.currentItem) {
            // Complex element: nested array
            if (isDebug) console.log(`[SM]     Pushing nested array:`, arrayCollector.currentItem.items);
            arrayCollector.items.push(arrayCollector.currentItem.items);
          } else if ('buffer' in arrayCollector.currentItem) {
            // Simple element: text
            const text = arrayCollector.currentItem.buffer.trim();
            if (isDebug) console.log(`[SM]     Pushing text:`, text);
            arrayCollector.items.push(text);
          }

          arrayCollector.currentItem = undefined;
        }
        if (isDebug) {
          console.log(`[SM]     Array items count: ${arrayCollector.items.length}`);
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
    const result: any = {};
    const shape = (schema as any).shape;

    for (const [fieldName, fieldCollector] of collector.fields) {
      const fieldSchema = shape[fieldName];
      if (fieldSchema) {
        // Simple extraction
        result[fieldName] = this.extractSimpleValue(fieldCollector);
      }
    }

    return result;
  }

  /**
   * Extract simple value from collector (without transforms)
   * @internal
   */
  private extractSimpleValue(collector: Collector<any>): any {
    if (collector.type === 'string') {
      return collector.value ?? '';
    } else if (collector.type === 'number') {
      return collector.value ?? NaN;
    } else if (collector.type === 'array') {
      return collector.items;
    } else if (collector.type === 'object') {
      // Recursively extract object fields
      const result: any = {};
      for (const [key, childCollector] of collector.fields) {
        result[key] = this.extractSimpleValue(childCollector);
      }
      return result;
    }
    return undefined;
  }
}
