import { StaxXmlParser } from '../StaxXmlParser.js';
import { StaxXmlParserSync } from '../StaxXmlParserSync.js';
import {
  isCdata,
  isCharacters,
  isEndElement,
  isStartElement,
  type AnyXmlEvent
} from '../types.js';
import { XPathMatcher } from './XPathEngine.js';
import { XmlParserInternal } from './XmlParserInternal.js';
import type { ParseInput } from './XmlSchema.js';
import { XmlSchemaBase } from './base.js';
import { XmlParsingStateMachine, type Collector, type ArrayCollector, type ObjectCollector } from './XmlParsingStateMachine.js';
import type { CompiledSchemaPlan, ObjectFieldTemplate, RootFieldPlan } from './compiled-plan.js';
import type { ParseOptions } from './types.js';
import { isArraySchema, isNumberSchema, isObjectSchema, isOptionalSchema, isStringSchema, isTransformSchema } from './types.js';

type ScalarLane = {
  mode: 'scalar';
  schema: XmlSchemaBase<unknown, unknown>;
  collector: Collector<unknown>;
  matcher: XPathMatcher;
  done?: boolean;
  activeDepth?: number;
};

type ArrayPrimitiveLane = {
  mode: 'array-primitive';
  schema: XmlSchemaBase<unknown, unknown>;
  itemSchema: XmlSchemaBase<unknown, unknown>;
  collector: ArrayCollector<unknown>;
  matcher: XPathMatcher;
  currentItem?: { depth: number; buffer: string };
};

type FallbackLane = {
  mode: 'fallback';
  schema: XmlSchemaBase<unknown, unknown>;
  collector: ObjectCollector | ArrayCollector<unknown>;
  stateMachine: XmlParsingStateMachine;
};

type PrimitiveLane = ScalarLane | ArrayPrimitiveLane;
type RootLane = PrimitiveLane | FallbackLane;

type BatchCapableParser = AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent> & {
  batchedIterator(): AsyncGenerator<AnyXmlEvent[]>;
};

function hasBatchedIterator(
  parser: AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent>
): parser is BatchCapableParser {
  return 'batchedIterator' in parser && typeof parser.batchedIterator === 'function';
}

type RuntimeState = {
  collectors: Array<Collector<unknown> | undefined>;
  helper: XmlParserInternal;
  primitiveLanes: PrimitiveLane[];
  fallbackLanes: FallbackLane[];
};

export class CompiledRootProcessor {
  constructor(
    private readonly plan: CompiledSchemaPlan,
    private readonly options?: ParseOptions
  ) {}

  static supports(plan: CompiledSchemaPlan): boolean {
    return plan.rootPlan.length > 0;
  }

  parseSync<T>(input: string, options?: ParseOptions): T {
    const effectiveOptions = options ?? this.options;
    const runtime = this.createRuntime(effectiveOptions);
    const parser = new StaxXmlParserSync(input, {
      autoDecodeEntities: effectiveOptions?.decodeEntities,
      eventFilter: this.plan.eventFilter
    } as never);
    const iterator = parser[Symbol.iterator]();
    let depth = 0;
    let iterResult = iterator.next();

    while (!iterResult.done) {
      const event = iterResult.value;

      if (isStartElement(event)) {
        depth++;
        this.processEvent(event, depth, runtime.primitiveLanes, runtime.fallbackLanes);
      } else if (isEndElement(event)) {
        this.processEvent(event, depth, runtime.primitiveLanes, runtime.fallbackLanes);
        depth--;
      } else if (isCharacters(event) || isCdata(event)) {
        this.processEvent(event, depth, runtime.primitiveLanes, runtime.fallbackLanes);
      }

      iterResult = iterator.next();
    }

    return this.buildResult<T>(runtime);
  }

  async parse<T>(input: ParseInput, options?: ParseOptions): Promise<T> {
    const effectiveOptions = options ?? this.options;
    const runtime = this.createRuntime(effectiveOptions);
    const parser = this.createParser(input, effectiveOptions);
    let depth = 0;

    if (hasBatchedIterator(parser)) {
      for await (const batch of parser.batchedIterator()) {
        for (const event of batch) {
          if (isStartElement(event)) {
            depth++;
            this.processEvent(event, depth, runtime.primitiveLanes, runtime.fallbackLanes);
          } else if (isEndElement(event)) {
            this.processEvent(event, depth, runtime.primitiveLanes, runtime.fallbackLanes);
            depth--;
          } else if (isCharacters(event) || isCdata(event)) {
            this.processEvent(event, depth, runtime.primitiveLanes, runtime.fallbackLanes);
          }
        }
      }
    } else {
      for await (const event of parser) {
        if (isStartElement(event)) {
          depth++;
          this.processEvent(event, depth, runtime.primitiveLanes, runtime.fallbackLanes);
        } else if (isEndElement(event)) {
          this.processEvent(event, depth, runtime.primitiveLanes, runtime.fallbackLanes);
          depth--;
        } else if (isCharacters(event) || isCdata(event)) {
          this.processEvent(event, depth, runtime.primitiveLanes, runtime.fallbackLanes);
        }
      }
    }

    return this.buildResult<T>(runtime);
  }

  private createRuntime(options?: ParseOptions): RuntimeState {
    const helper = new XmlParserInternal(options, this.plan);
    const collectors = new Array<Collector<unknown> | undefined>(this.plan.rootPlan.length);
    const primitiveLanes: PrimitiveLane[] = [];
    const fallbackLanes: FallbackLane[] = [];

    for (let index = 0; index < this.plan.rootPlan.length; index++) {
      const entry = this.plan.rootPlan[index];

      if (entry.kind === 'object') {
        const collector = helper.createCollectorForCompiledSchema(entry.schema);
        if (collector?.type !== 'object') {
          throw new Error('CompiledRootProcessor expected object collector for root object field');
        }
        collectors[index] = collector;
        for (const template of entry.childTemplates) {
          const childCollector = helper.createCollectorForCompiledSchema(template.schema);
          collector.fields.set(template.fieldName, childCollector);
          const lane = this.createLaneFromTemplate(template, childCollector);
          if (lane) {
            if (lane.mode === 'fallback') {
              fallbackLanes.push(lane);
            } else {
              primitiveLanes.push(lane);
            }
          }
        }
        continue;
      }

      const collector = helper.createCollectorForCompiledSchema(entry.schema);
      collectors[index] = collector;
      const lane = this.createLaneFromRootEntry(entry, collector);
      if (lane) {
        if (lane.mode === 'fallback') {
          fallbackLanes.push(lane);
        } else {
          primitiveLanes.push(lane);
        }
      }
    }

    return { collectors, helper, primitiveLanes, fallbackLanes };
  }

  private createLaneFromRootEntry(
    entry: RootFieldPlan,
    collector: Collector<unknown>
  ): RootLane | undefined {
    if (entry.kind === 'array') {
      return this.createLane(entry.schema, entry.elementXPath, collector);
    }

    if (entry.kind === 'direct') {
      return this.createLane(entry.schema, entry.xpath, collector);
    }

    return undefined;
  }

  private createLaneFromTemplate(
    template: ObjectFieldTemplate,
    collector: Collector<unknown>
  ): RootLane | undefined {
    return this.createLane(template.schema, template.xpath, collector);
  }

  private createLane(
    schema: XmlSchemaBase<unknown, unknown>,
    xpath: string,
    collector: Collector<unknown>
  ): RootLane | undefined {
    const unwrappedSchema = unwrapSchema(schema);

    if (isStringSchema(unwrappedSchema) || isNumberSchema(unwrappedSchema)) {
      return {
        mode: 'scalar',
        schema,
        collector,
        matcher: new XPathMatcher(xpath)
      };
    }

    if (isObjectSchema(unwrappedSchema)) {
      if (collector.type !== 'object') {
        return undefined;
      }
      const stateMachine = new XmlParsingStateMachine(this.options, this.plan.objectFieldTemplates);
      stateMachine.registerSchema(schema, xpath, collector);
      return {
        mode: 'fallback',
        schema,
        collector,
        stateMachine
      };
    }

    if (!isArraySchema(unwrappedSchema)) {
      return undefined;
    }

    const itemSchema = unwrappedSchema.element;
    const unwrappedItemSchema = unwrapSchema(itemSchema);
    if (isStringSchema(unwrappedItemSchema) || isNumberSchema(unwrappedItemSchema)) {
      if (collector.type !== 'array') {
        return undefined;
      }
      return {
        mode: 'array-primitive',
        schema,
        itemSchema,
        collector,
        matcher: new XPathMatcher(xpath)
      };
    }

    if (!isObjectSchema(unwrappedItemSchema) || collector.type !== 'array') {
      return undefined;
    }

    const stateMachine = new XmlParsingStateMachine(this.options, this.plan.objectFieldTemplates);
    stateMachine.registerSchema(schema, xpath, collector);

    return {
      mode: 'fallback',
      schema,
      collector,
      stateMachine
    };
  }

  private processEvent(
    event: AnyXmlEvent,
    depth: number,
    primitiveLanes: PrimitiveLane[],
    fallbackLanes: FallbackLane[]
  ): void {
    for (const lane of fallbackLanes) {
      lane.stateMachine.processEventSync(event);
    }

    if (primitiveLanes.length === 0) {
      return;
    }

    for (const lane of primitiveLanes) {
      if (!isStartElement(event)) {
        continue;
      }

      lane.matcher.onStartElement(event);

      if (lane.mode === 'scalar') {
        if (lane.done || !lane.matcher.matches(event)) {
          continue;
        }

        if (lane.matcher.isAttributeSelector()) {
          const attrName = lane.matcher.getAttributeName();
          const attrValue = attrName ? event.attributes?.[attrName] : undefined;
          if (attrValue !== undefined) {
            this.assignScalarCollector(lane.collector, lane.schema, attrValue);
          }
          lane.done = true;
          continue;
        }

        if (lane.collector.type === 'string' || lane.collector.type === 'number') {
          lane.collector.buffer = '';
        }
        lane.activeDepth = depth;
        continue;
      }

      if (lane.mode === 'array-primitive') {
        if (!lane.matcher.matches(event)) {
          continue;
        }

        if (lane.matcher.isAttributeSelector()) {
          const attrName = lane.matcher.getAttributeName();
          const attrValue = attrName ? event.attributes?.[attrName] : undefined;
          if (attrValue !== undefined) {
            lane.collector.items.push(this.parseSchemaText(lane.itemSchema, attrValue));
          }
          continue;
        }

        lane.currentItem = { depth, buffer: '' };
      }
    }

    if (isCharacters(event) || isCdata(event)) {
      for (const lane of primitiveLanes) {
        if (lane.mode === 'scalar') {
          if (lane.activeDepth !== undefined && depth >= lane.activeDepth) {
            if (lane.collector.type === 'string' || lane.collector.type === 'number') {
              lane.collector.buffer += event.value;
            }
          }
          continue;
        }

        if (lane.mode === 'array-primitive' && lane.currentItem && depth >= lane.currentItem.depth) {
          lane.currentItem.buffer += event.value;
        }
      }
      return;
    }

    if (isEndElement(event)) {
      for (const lane of primitiveLanes) {
        if (lane.mode === 'scalar') {
          if (lane.activeDepth === depth) {
            if (lane.collector.type === 'string' || lane.collector.type === 'number') {
              this.assignScalarCollector(lane.collector, lane.schema, lane.collector.buffer.trim());
            }
            lane.activeDepth = undefined;
            lane.done = true;
          }
          lane.matcher.onEndElement();
          continue;
        }

        if (lane.mode === 'array-primitive') {
          if (lane.currentItem?.depth === depth) {
            lane.collector.items.push(this.parseSchemaText(lane.itemSchema, lane.currentItem.buffer.trim()));
            lane.currentItem = undefined;
          }
          lane.matcher.onEndElement();
        }
      }
    }
  }

  private buildResult<T>(runtime: RuntimeState): T {
    const result: Record<string, unknown> = {};

    for (let index = 0; index < this.plan.rootPlan.length; index++) {
      const collector = runtime.collectors[index];
      if (!collector) {
        continue;
      }
      const entry = this.plan.rootPlan[index];
      result[entry.fieldName] = runtime.helper.extractCompiledCollectorValue(collector, entry.schema);
    }

    return result as T;
  }

  private assignScalarCollector(
    collector: Collector<unknown>,
    schema: XmlSchemaBase<unknown, unknown>,
    value: string
  ): void {
    if (collector.type === 'string') {
      collector.value = this.parseSchemaText(schema, value) as string;
    } else if (collector.type === 'number') {
      collector.value = this.parseSchemaText(schema, value) as number;
    }
  }

  private parseSchemaText(schema: XmlSchemaBase<unknown, unknown>, text: string): unknown {
    if (schema._parseText) {
      return schema._parseText(text);
    }
    return text;
  }

  private createParser(
    input: ParseInput,
    options?: ParseOptions
  ): AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent> {
    if (typeof input === 'string') {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(input));
          controller.close();
        }
      });
      return new StaxXmlParser(stream, {
        autoDecodeEntities: options?.decodeEntities,
        eventFilter: this.plan.eventFilter
      } as never) as AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent>;
    }

    if (input instanceof ReadableStream) {
      return new StaxXmlParser(input, {
        autoDecodeEntities: options?.decodeEntities,
        eventFilter: this.plan.eventFilter
      } as never) as AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent>;
    }

    return input as AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent>;
  }
}

function unwrapSchema(schema: XmlSchemaBase<unknown, unknown>): XmlSchemaBase<unknown, unknown> {
  let current = schema;
  while (isOptionalSchema(current) || isTransformSchema(current)) {
    current = current.schema;
  }
  return current;
}
