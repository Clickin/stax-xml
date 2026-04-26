import { StaxXmlParserSync } from '../StaxXmlParserSync.js';
import {
  isCdata,
  isCharacters,
  isEndElement,
  isStartElement,
  type AnyXmlEvent,
  type StartElementEvent,
  type ParserEventFilter
} from '../types.js';

import { XPathMatcher } from './XPathEngine.js';
import {
  IterableEventBackendIterator,
  getIterableEventBackend,
  readReadableStreamChunks,
  type IterableEventBackendOptions
} from './IterableEventBackend.js';
import {
  buildXPathDocumentFromAsyncEvents,
  buildXPathDocumentFromEvents,
  buildXPathDocumentFromString,
  evaluateXPath,
  xpathValueToNodes,
  xpathValueToString,
  type XPathDocument,
  type XPathNode,
  type XPathValue
} from './XPath1Engine.js';
import {
  XmlParsingStateMachine,
  type Collector,
  type ObjectCollector,
  type SchemaActivation,
} from './XmlParsingStateMachine.js';
import type { CompiledSchemaPlan } from './compiled-plan.js';
import { CompiledRootProcessor } from './CompiledRootProcessor.js';
import { asAsyncEventBatchIterator } from './AsyncEventBatchIterator.js';

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

class EarlyReturn<T> {
  constructor(readonly value: T) {}
}

const xpathInputDecoder = new TextDecoder();
const XPATH_MISSING: unique symbol = Symbol('stax-xml.xpath.missing');

type BatchCapableParser = AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent> & {
  batchedIterator(): AsyncGenerator<AnyXmlEvent[]>;
};

function hasBatchedIterator(
  parser: AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent>
): parser is BatchCapableParser {
  return 'batchedIterator' in parser && typeof parser.batchedIterator === 'function';
}



/**
 * Internal parser implementation
 * Handles both sync and async parsing with XPath support
 *
 * @internal
 */
export class XmlParserInternal {
  private options?: ParseOptions;

  constructor(options?: ParseOptions, private readonly compiledPlan?: CompiledSchemaPlan) {
    this.options = options;
  }

  parseWithSchema<T>(input: ParseInput, schema: XmlSchemaBase<T, unknown>): T {
    if (this.compiledPlan?.kind === 'runtime') {
      return schema._parse(input, this.options) as T;
    }
    if (this.compiledPlan?.kind === 'dispatch' && typeof input === 'string') {
      return this.parseCompiledWithPlan(input, this.compiledPlan) as T;
    }
    return schema._parse(input, this.options) as T;
  }

  async parseWithSchemaAsync<T>(input: ParseInput, schema: XmlSchemaBase<T, unknown>): Promise<T> {
    if (this.compiledPlan?.kind === 'runtime') {
      return schema._parseAsync(input, this.options) as Promise<T>;
    }
    if (this.compiledPlan?.kind === 'dispatch') {
      return this.parseCompiledWithPlanAsync(input, this.compiledPlan) as Promise<T>;
    }
    return schema._parseAsync(input, this.options) as Promise<T>;
  }

  createCollectorForCompiledSchema(schema: unknown): Collector<unknown> {
    return this.createCollectorForSchema(schema);
  }

  extractCompiledCollectorValue(collector: Collector<unknown>, schema: unknown): unknown {
    return this.extractValueFromCollector(collector, schema);
  }

  applyCompiledSchemaTransforms(schema: unknown, value: unknown): unknown {
    let result = value;
    for (const transformFn of this.getAllTransforms(schema)) {
      result = transformFn(result);
    }
    return result;
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
      const parser = this.createParser(input);
      try {
        await this.consumeAsyncEvents(parser, (event) => {
          if (isCharacters(event) || isCdata(event)) {
            throw new EarlyReturn(this.decodeText(event.value));
          }
        });
      } catch (error) {
        if (error instanceof EarlyReturn) {
          return error.value;
        }
        throw error;
      }
      return '';
    }

    const document = await this.createXPathDocumentAsync(input);
    return this.normalizeXPathScalar(evaluateXPath(xpath, document.document, document, this.options));
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

    const document = this.createXPathDocumentSync(input);
    return this.normalizeXPathScalar(evaluateXPath(xpath, document.document, document, this.options));
  }

  /**
   * Parse object asynchronously
   */
  async parseObjectAsync<T>(
    input: ParseInput,
    shape: Record<string, XmlSchemaBase<unknown, unknown>>,
    schemaOptions: { xpath?: string }
  ): Promise<T> {
    if (this.compiledPlan?.kind === 'dispatch') {
      return this.parseCompiledWithPlanAsync(input, this.compiledPlan) as Promise<T>;
    }
    const document = await this.createXPathDocumentAsync(input);
    const contextNode = this.selectObjectContext(document, schemaOptions.xpath);
    return this.parseObjectShapeFromXPathNode(shape, contextNode, document) as T;
  }

  /**
   * Parse object synchronously
   */
  parseObject<T>(
    input: string,
    shape: Record<string, XmlSchemaBase<unknown, unknown>>,
    schemaOptions: { xpath?: string }
  ): T {
    if (this.compiledPlan?.kind === 'dispatch') {
      return this.parseCompiledWithPlan(input, this.compiledPlan) as T;
    }
    const document = this.createXPathDocumentSync(input);
    const contextNode = this.selectObjectContext(document, schemaOptions.xpath);
    return this.parseObjectShapeFromXPathNode(shape, contextNode, document) as T;
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
        /* v8 ignore next -- schemas without xpath are intentionally skipped */
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

      if (parentContext?.context?.contextElement) {
        this.hydrateCurrentElementAttributeFields(
          rootCollector,
          shape,
          parentContext.context.contextElement
        );
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
    const eventReader = asAsyncEventBatchIterator(iterator);
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
        /* v8 ignore next -- schemas without xpath are intentionally skipped */
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

      if (parentContext?.context?.contextElement) {
        this.hydrateCurrentElementAttributeFields(
          rootCollector,
          shape,
          parentContext.context.contextElement
        );
      }
    }

    // Process startEvent
    sm.processEventSync(startEvent);

    // Iterate through events using State Machine
    let currentDepth = startDepth;
    while (currentDepth >= startDepth && await eventReader.ensureBatch()) {
      while (currentDepth >= startDepth && eventReader.hasBufferedEvents()) {
        const event = eventReader.nextBuffered().value as AnyXmlEvent;

        sm.processEventSync(event);

        /* v8 ignore next -- nested start handling is covered by state-machine integration */
        if (isStartElement(event)) {
          currentDepth++;
        } else if (isEndElement(event)) {
          currentDepth--;
          if (currentDepth < startDepth) {
            break;
          }
        }
      }
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

    const document = await this.createXPathDocumentAsync(input);
    return this.selectXPathNodes(document, document.document, xpath)
      .map(node => this.parseSchemaFromXPathNode(elementSchema, node, document, true)) as T[];
  }

  /**
   * Collect text content until the closing tag at the given depth
   */
  private async collectTextUntilClose(
    parser: AsyncIterator<AnyXmlEvent>,
    startDepth: number
  ): Promise<string> {
    const eventReader = asAsyncEventBatchIterator(parser);
    let currentDepth = startDepth;
    let buffer = '';
    while (currentDepth >= startDepth && await eventReader.ensureBatch()) {
      while (currentDepth >= startDepth && eventReader.hasBufferedEvents()) {
        const event = eventReader.nextBuffered().value as AnyXmlEvent;

        /* v8 ignore next -- nested start handling is covered by state-machine integration */
        if (isStartElement(event)) {
          currentDepth++;
        } else if (isEndElement(event)) {
          currentDepth--;
          if (currentDepth < startDepth) {
            break;
          }
        /* v8 ignore next -- text collection is covered by sync equivalent and parser integration */
        } else if ((isCharacters(event) || isCdata(event)) && currentDepth === startDepth) {
          buffer += event.value;
        }
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
    /* v8 ignore next -- relative and absolute array paths are covered through public array schemas */
    const isRelativePath = xpath.startsWith('./') || xpath === '.';
    /* v8 ignore next -- matcher depth selection mirrors XPathMatcher unit coverage */
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
            const attrName = elementMatcher.getAttributeName()!;
            const attrValue = event.attributes[attrName];
            if (attrValue !== undefined) {
              const value = this.parseFieldValue(attrValue, elementSchema);
              results.push(value as T);
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

      iterResult = iterator.next();
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
    const eventReader = asAsyncEventBatchIterator(iterator);

    // For relative paths, pass the context depth (startDepth) to the matcher
    /* v8 ignore next -- relative and absolute array paths are covered through public array schemas */
    const isRelativePath = xpath.startsWith('./') || xpath === '.';
    /* v8 ignore next -- matcher depth selection mirrors XPathMatcher unit coverage */
    const matcher = new XPathMatcher(xpath, isRelativePath ? startDepth : undefined);
    const results: T[] = [];
    const needsRecursive = this.isComplexSchema(elementSchema);
    let currentDepth = startDepth;

    // Process the start event for the parent element
    matcher.onStartElement(startEvent);

    while (currentDepth >= startDepth && await eventReader.ensureBatch()) {
      while (currentDepth >= startDepth && eventReader.hasBufferedEvents()) {
        const iterResult = eventReader.nextBuffered();
        if (iterResult.done) {
          break;
        }
        const event = iterResult.value;

        if (isStartElement(event)) {
          currentDepth++;
          matcher.onStartElement(event);

          if (matcher.matches(event)) {
            const elementXPath = this.extractXPath(elementSchema);
            const elementMatcher = elementXPath ? new XPathMatcher(elementXPath) : null;

            if (elementMatcher && elementMatcher.isAttributeSelector()) {
              const attrName = elementMatcher.getAttributeName()!;
              const attrValue = event.attributes[attrName];
              if (attrValue !== undefined) {
                const value = this.parseFieldValue(attrValue, elementSchema);
                results.push(value as T);
              }
            } else if (needsRecursive && elementSchema._parseFromPosition) {
              const value = await elementSchema._parseFromPosition(
                eventReader,
                event,
                currentDepth,
                this.options
              );
              results.push(value as T);
            } else if (elementXPath) {
              elementMatcher!.onStartElement(event);
              const value = await this.extractValueWithElementMatcherAsync(
                eventReader,
                event,
                currentDepth,
                elementMatcher!,
                elementSchema
              );
              results.push(value as T);
              matcher.onEndElement();
              currentDepth--;
            } else {
              const textBuffer = await this.collectTextUntilClose(
                eventReader,
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

          if (currentDepth < startDepth) {
            break;
          }
        }
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

    const document = this.createXPathDocumentSync(input);
    return this.selectXPathNodes(document, document.document, xpath)
      .map(node => this.parseSchemaFromXPathNode(elementSchema, node, document, true)) as T[];
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

      /* v8 ignore next -- nested start handling is covered by state-machine integration */
      if (isStartElement(event)) {
        currentDepth++;
      } else if (isEndElement(event)) {
        currentDepth--;
        if (currentDepth < startDepth) {
          break;
        }
      /* v8 ignore next -- text collection is covered by parser integration */
      } else if ((isCharacters(event) || isCdata(event)) && currentDepth === startDepth) {
        buffer += event.value;
      }

      iterResult = parser.next();
    }

    return buffer;
  }

  // Helper methods

  private createXPathDocumentSync(input: string): XPathDocument {
    return buildXPathDocumentFromString(input, this.options);
  }

  private async createXPathDocumentAsync(input: ParseInput): Promise<XPathDocument> {
    if (typeof input === 'string') {
      return buildXPathDocumentFromString(input, this.options);
    }
    if (isArrayBufferView(input)) {
      return buildXPathDocumentFromString(xpathInputDecoder.decode(toUint8Array(input)), this.options);
    }
    if (input instanceof ReadableStream) {
      const chunks = await readReadableStreamChunks(input);
      return buildXPathDocumentFromString(decodeChunks(chunks), this.options);
    }
    if (isSyncIterable(input)) {
      return buildXPathDocumentFromEvents(input);
    }
    return buildXPathDocumentFromAsyncEvents(this.createParser(input));
  }

  private selectObjectContext(document: XPathDocument, xpath: string | undefined): XPathNode {
    if (!xpath) {
      return document.documentElement ?? document.document;
    }
    return this.selectXPathNodes(document, document.document, xpath)[0] ?? document.document;
  }

  private parseObjectShapeFromXPathNode(
    shape: Record<string, XmlSchemaBase<unknown, unknown>>,
    contextNode: XPathNode,
    document: XPathDocument
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [fieldName, fieldSchema] of Object.entries(shape)) {
      if (!this.shouldParseObjectField(fieldSchema)) {
        continue;
      }
      result[fieldName] = this.parseSchemaFromXPathNode(fieldSchema, contextNode, document, false);
    }
    return result;
  }

  private shouldParseObjectField(schema: XmlSchemaBase<unknown, unknown>): boolean {
    if (this.extractXPath(schema)) {
      return true;
    }
    const unwrapped = this.unwrapSchema(schema);
    if (!unwrapped || typeof unwrapped !== 'object' || !('schemaType' in unwrapped)) {
      return false;
    }
    const core = unwrapped as XmlSchemaBase<unknown, unknown>;
    if (isObjectSchema(core)) {
      return true;
    }
    if (isArraySchema(core)) {
      return !!this.extractXPath(core.element);
    }
    return false;
  }

  private parseSchemaFromXPathNode(
    schema: XmlSchemaBase<unknown, unknown>,
    contextNode: XPathNode,
    document: XPathDocument,
    ignoreOwnXPath: boolean
  ): unknown {
    const effects = this.unwrapSchemaEffects(schema);
    try {
      let value = this.parseCoreSchemaFromXPathNode(
        effects.schema,
        contextNode,
        document,
        ignoreOwnXPath
      );
      if (value === XPATH_MISSING) {
        if (effects.optional) {
          return undefined;
        }
        if (isObjectSchema(effects.schema)) {
          return {};
        }
        if (isArraySchema(effects.schema)) {
          return [];
        }
        return '';
      }
      for (const transformFn of effects.transforms) {
        value = transformFn(value);
      }
      return value;
    } catch (error) {
      if (effects.optional) {
        return undefined;
      }
      throw error;
    }
  }

  private parseCoreSchemaFromXPathNode(
    schema: XmlSchemaBase<unknown, unknown>,
    contextNode: XPathNode,
    document: XPathDocument,
    ignoreOwnXPath: boolean
  ): unknown {
    if (isObjectSchema(schema)) {
      const xpath = ignoreOwnXPath ? undefined : this.extractXPath(schema);
      if (xpath) {
        const objectContext = this.selectXPathNodes(document, contextNode, xpath)[0];
        if (!objectContext) {
          return XPATH_MISSING;
        }
        return this.parseObjectShapeFromXPathNode(schema.shape, objectContext, document);
      }
      const objectContext = contextNode;
      return this.parseObjectShapeFromXPathNode(schema.shape, objectContext, document);
    }

    if (isArraySchema(schema)) {
      const itemXPath = schema.xpath ?? this.extractXPath(schema.element);
      if (!itemXPath) {
        return [];
      }
      const itemNodes = this.selectXPathNodes(document, contextNode, itemXPath);
      return itemNodes.map(node => this.parseSchemaFromXPathNode(
        schema.element,
        node,
        document,
        schema.xpath === undefined
      ));
    }

    if (!isStringSchema(schema) && !isNumberSchema(schema)) {
      return '';
    }

    const xpath = ignoreOwnXPath ? undefined : this.extractXPath(schema);
    const value = xpath
      ? evaluateXPath(xpath, contextNode, document, this.options)
      : [contextNode];
    if (Array.isArray(value) && value.length === 0) {
      return XPATH_MISSING;
    }
    const text = this.normalizeXPathScalar(value);
    if (schema._parseText) {
      return schema._parseText(text);
    }
    return text;
  }

  private selectXPathNodes(
    document: XPathDocument,
    contextNode: XPathNode,
    xpath: string
  ): XPathNode[] {
    return xpathValueToNodes(evaluateXPath(xpath, contextNode, document, this.options));
  }

  private normalizeXPathScalar(value: XPathValue): string {
    return this.decodeText(xpathValueToString(value).trim());
  }

  private unwrapSchemaEffects(schema: XmlSchemaBase<unknown, unknown>): {
    schema: XmlSchemaBase<unknown, unknown>;
    optional: boolean;
    transforms: Array<(value: unknown) => unknown>;
  } {
    const transforms: Array<(value: unknown) => unknown> = [];
    let current = schema;
    let optional = false;

    while (isOptionalSchema(current) || isTransformSchema(current)) {
      if (isOptionalSchema(current)) {
        optional = true;
        current = current.schema;
        continue;
      }
      transforms.unshift(current.transformFn as (value: unknown) => unknown);
      current = current.schema;
    }

    return { schema: current, optional, transforms };
  }

  private createParser(input: ParseInput, eventFilter?: ParserEventFilter): AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent> {
    const backend = getIterableEventBackend(input);
    if (backend) {
      return backend;
    }
    if (typeof input === 'string') {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(input));
          controller.close();
        }
      });
      return new IterableEventBackendIterator(stream, toIterableBackendOptions(this.options, eventFilter));
    }
    if (input instanceof ReadableStream) {
      return new IterableEventBackendIterator(input, toIterableBackendOptions(this.options, eventFilter));
    }
    return input as AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent>;
  }

  private async consumeAsyncEvents(
    parser: AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent>,
    onEvent: (event: AnyXmlEvent) => void
  ): Promise<void> {
    if (hasBatchedIterator(parser)) {
      for await (const batch of parser.batchedIterator()) {
        for (const event of batch) {
          onEvent(event);
        }
      }
      return;
    }

    const eventReader = asAsyncEventBatchIterator(parser);
    while (await eventReader.ensureBatch()) {
      while (eventReader.hasBufferedEvents()) {
        const iterResult = eventReader.nextBuffered();
        /* v8 ignore next -- buffered iterator done guard is defensive */
        if (iterResult.done) {
          break;
        }
        onEvent(iterResult.value);
      }
    }
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
    /* v8 ignore next -- schema wrapper helpers receive schema objects from public APIs */
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

  private parseCompiledWithPlan<T>(
    input: string,
    plan: CompiledSchemaPlan
  ): T {
    if (plan.kind !== 'dispatch') {
      throw new Error(`Compiled runtime fallback cannot be executed without the wrapped schema: ${plan.reason}`);
    }
    return new CompiledRootProcessor(plan, this.options).parseSync<T>(input);
  }

  private async parseCompiledWithPlanAsync<T>(
    input: ParseInput,
    plan: CompiledSchemaPlan
  ): Promise<T> {
    if (plan.kind !== 'dispatch') {
      throw new Error(`Compiled runtime fallback cannot be executed without the wrapped schema: ${plan.reason}`);
    }
    return new CompiledRootProcessor(plan, this.options).parse<T>(input);
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
    const eventReader = asAsyncEventBatchIterator(parser);
    let currentDepth = startDepth;
    let textBuffer = '';
    let matchedDepth = -1;
    while (currentDepth >= startDepth && await eventReader.ensureBatch()) {
      while (currentDepth >= startDepth && eventReader.hasBufferedEvents()) {
        const iterResult = eventReader.nextBuffered();
        if (iterResult.done) {
          break;
        }
        const event = iterResult.value;

        if (isStartElement(event)) {
          currentDepth++;
          elementMatcher.onStartElement(event);

          if (elementMatcher.matches(event) && matchedDepth === -1) {
            matchedDepth = currentDepth;
            textBuffer = '';
          }
        } else if (isEndElement(event)) {
          if (matchedDepth !== -1 && currentDepth === matchedDepth) {
            return this.parseFieldValue(textBuffer.trim(), elementSchema);
          }
          elementMatcher.onEndElement();
          currentDepth--;

          if (currentDepth < startDepth) {
            break;
          }
        } else if ((isCharacters(event) || isCdata(event)) && matchedDepth !== -1 && currentDepth === matchedDepth) {
          textBuffer += event.value;
        }
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

  private hydrateCurrentElementAttributeFields(
    collector: ObjectCollector,
    shape: Record<string, XmlSchemaBase<unknown, unknown>>,
    startEvent: StartElementEvent
  ): void {
    for (const [fieldName, fieldSchema] of Object.entries(shape)) {
      const xpath = this.extractXPath(fieldSchema);
      if (!xpath || (!xpath.startsWith('./@') && !xpath.startsWith('@'))) {
        continue;
      }

      const attrName = xpath.startsWith('./@') ? xpath.slice(3) : xpath.slice(1);
      const attrValue = startEvent.attributes?.[attrName];
      if (attrValue === undefined) {
        continue;
      }

      const fieldCollector = collector.fields.get(fieldName);
      if (!fieldCollector) {
        continue;
      }

      if (fieldCollector.type === 'string') {
        fieldCollector.value = attrValue;
      } else if (fieldCollector.type === 'number' && fieldSchema._parseText) {
        fieldCollector.value = fieldSchema._parseText(attrValue) as number;
      }
    }
  }
  /* v8 ignore end */
}

function toIterableBackendOptions(
  options: ParseOptions | undefined,
  eventFilter: ParserEventFilter | undefined
): IterableEventBackendOptions {
  return {
    autoDecodeEntities: options?.decodeEntities === true,
    eventFilter
  };
}

function isArrayBufferView(input: unknown): input is ArrayBufferView {
  return ArrayBuffer.isView(input);
}

function toUint8Array(input: ArrayBufferView): Uint8Array {
  return input instanceof Uint8Array
    ? input
    : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}

function isSyncIterable(input: unknown): input is Iterable<AnyXmlEvent> {
  return typeof input === 'object'
    && input !== null
    && Symbol.iterator in input
    && typeof (input as Iterable<AnyXmlEvent>)[Symbol.iterator] === 'function';
}

function decodeChunks(chunks: Uint8Array[]): string {
  let byteLength = 0;
  for (const chunk of chunks) {
    byteLength += chunk.byteLength;
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return xpathInputDecoder.decode(bytes);
}
