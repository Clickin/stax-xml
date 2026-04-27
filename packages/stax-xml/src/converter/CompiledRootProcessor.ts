import { IterableEventType, StaxXmlIterableParser, toByteBatches } from '../StaxXmlIterableParser.js';
import {
  resolveStaxXmlRuntimeBackend,
  StaxXmlStructuralIndexParser,
  type StructuralIndexTable
} from '../runtime/index.js';
import {
  isCdata,
  isCharacters,
  isEndElement,
  isError,
  isStartElement,
  type AnyXmlEvent
} from '../types.js';
import type {
  CompiledSchemaPlan,
  DispatchArrayPlan,
  DispatchCompiledPlan,
  DispatchFieldPlan,
  DispatchObjectPlan,
  DispatchScalarPlan,
  DispatchSelector,
  DispatchValuePlan
} from './compiled-plan.js';
import type { ParseInput } from './XmlSchema.js';
import type { ParseOptions, XmlNumberOptions } from './types.js';
import { XmlParseError } from './errors.js';
import {
  IterableEventBackendIterator,
  createIterableParserFromChunks,
  getIterableEventBackend,
  getIterableEventTable,
  readReadableStreamByteBatches,
  type IterableEventTable,
} from './IterableEventBackend.js';

const textEncoder = new TextEncoder();
const utf8Decoder = new TextDecoder();
const DEFAULT_ENTITY_REGEX = /&(lt|gt|quot|apos|amp);/g;
const DEFAULT_ENTITY_MAP: Record<string, string> = {
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  amp: '&'
};

type ParentBinding =
  | { kind: 'root' }
  | { kind: 'field'; object: ObjectState; field: DispatchFieldPlan }
  | { kind: 'array'; array: ArrayState };

type ObjectState = {
  plan: DispatchObjectPlan;
  depth: number;
  values: Record<string, unknown>;
  completedFields: Set<number>;
  childObjects: ObjectState[];
  childArrays: ArrayState[];
  parent: ParentBinding;
};

type ArrayState = {
  plan: DispatchArrayPlan;
  contextDepth?: number;
  items: unknown[];
  parent: ParentBinding;
};

type CaptureState = {
  plan: DispatchScalarPlan;
  depth: number;
  buffer: string;
  textMode: 'subtree' | 'direct';
  parent: ParentBinding;
};

type RuntimeState = {
  plan: DispatchCompiledPlan;
  options?: ParseOptions;
  depth: number;
  eventCount: number;
  maxDepth: number;
  maxEvents: number;
  elementStack: string[];
  positionStack: number[];
  rootValue: unknown;
  rootSet: boolean;
  rootDone: boolean;
  rootObject?: ObjectState;
  rootArray?: ArrayState;
  objects: ObjectState[];
  arrays: ArrayState[];
  captures: CaptureState[];
  currentAttributes?: Record<string, string>;
};

type BatchCapableParser = AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent> & {
  batchedIterator(): AsyncGenerator<AnyXmlEvent[]>;
};

function hasBatchedIterator(
  parser: AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent>
): parser is BatchCapableParser {
  return 'batchedIterator' in parser && typeof parser.batchedIterator === 'function';
}

export class CompiledRootProcessor {
  constructor(
    private readonly plan: DispatchCompiledPlan,
    private readonly options?: ParseOptions
  ) {}

  static supports(plan: CompiledSchemaPlan): boolean {
    return plan.kind === 'dispatch';
  }

  parseSync<T>(input: string, options?: ParseOptions | unknown): T {
    const effectiveOptions = normalizeOptions(options) ?? this.options;
    const runtime = this.createRuntime(this.plan, effectiveOptions);
    const parser = new StaxXmlIterableParser(
      toByteBatches([textEncoder.encode(input)], { batchSize: 1 }),
      { documentMode: effectiveOptions?.documentMode }
    );

    while (parser.nextBatch()) {
      for (let index = 0; index < parser.eventCount(); index++) {
        this.processIterableEvent(runtime, parser, index);
      }
    }

    return this.finish<T>(runtime);
  }

  async parse<T>(input: ParseInput, options?: ParseOptions | unknown): Promise<T> {
    const effectiveOptions = normalizeOptions(options) ?? this.options;
    if (isArrayBufferView(input)) {
      const projectedRows = await tryProjectItemRowsViaNativeTable(this.plan, input, effectiveOptions);
      if (projectedRows !== undefined) {
        return projectedRows as T;
      }
    }
    const runtime = this.createRuntime(this.plan, effectiveOptions);

    if (typeof input === 'string') {
      const acceleratedTable = await tryCreateStructuralIndexTable(input, effectiveOptions);
      if (acceleratedTable) {
        this.processEventTable(runtime, acceleratedTable);
        return this.finish<T>(runtime);
      }
      return this.parseSync<T>(input, effectiveOptions);
    }

    if (isArrayBufferView(input)) {
      const acceleratedTable = await tryCreateStructuralIndexTable(input, effectiveOptions);
      if (acceleratedTable) {
        this.processEventTable(runtime, acceleratedTable);
        return this.finish<T>(runtime);
      }

      const parser = createIterableParserFromChunks([toUint8Array(input)], {
        batchSize: 1,
        documentMode: effectiveOptions?.documentMode
      });
      while (parser.nextBatch()) {
        for (let index = 0; index < parser.eventCount(); index++) {
          this.processIterableEvent(runtime, parser, index);
        }
      }
      return this.finish<T>(runtime);
    }

    const eventTable = getIterableEventTable(input);
    if (eventTable) {
      this.processEventTable(runtime, eventTable);
      return this.finish<T>(runtime);
    }

    if (isSyncIterator(input)) {
      for (const event of input) {
        this.processEvent(runtime, event);
      }
      return this.finish<T>(runtime);
    }

    if (input instanceof ReadableStream) {
      await this.processReadableStream(runtime, input);
      return this.finish<T>(runtime);
    }

    const backend = getIterableEventBackend(input);
    if (backend) {
      await this.processEventBackend(runtime, backend);
      return this.finish<T>(runtime);
    }

    const parser = this.createParser(input);

    if (hasBatchedIterator(parser)) {
      for await (const batch of parser.batchedIterator()) {
        for (const event of batch) {
          this.processEvent(runtime, event);
        }
      }
    } else {
      let iterResult = await parser.next();
      while (!iterResult.done) {
        const event = iterResult.value;
        this.processEvent(runtime, event);
        iterResult = await parser.next();
      }
    }

    return this.finish<T>(runtime);
  }

  private createRuntime(plan: DispatchCompiledPlan, options?: ParseOptions): RuntimeState {
    const runtime: RuntimeState = {
      plan,
      options,
      depth: 0,
      eventCount: 0,
      maxDepth: options?.maxDepth ?? 1000,
      maxEvents: options?.maxEvents ?? 1000000,
      elementStack: [],
      positionStack: [],
      rootValue: defaultValue(plan.root, true, 'root'),
      rootSet: false,
      rootDone: false,
      objects: [],
      arrays: [],
      captures: []
    };

    if (plan.root.kind === 'object' && !plan.root.selector) {
      runtime.rootObject = this.createObjectState(runtime, plan.root, 0, { kind: 'root' });
    } else if (plan.root.kind === 'array') {
      runtime.rootArray = this.createArrayState(runtime, plan.root, undefined, { kind: 'root' });
    }

    return runtime;
  }

  private processEvent(runtime: RuntimeState, event: AnyXmlEvent): void {
    this.checkEventLimit(runtime);

    if (isError(event)) {
      throw event.error;
    }

    if (isStartElement(event)) {
      runtime.depth++;
      runtime.elementStack.push(event.name);
      recordElementPosition(runtime);
      runtime.currentAttributes = event.attributes;
      this.checkDepthLimit(runtime);
      this.processStart(runtime, event.attributes);
      runtime.currentAttributes = undefined;
    } else if (isCharacters(event) || isCdata(event)) {
      this.processText(runtime, event.value);
    } else if (isEndElement(event)) {
      popCompletedChildPositionScope(runtime);
      this.processEnd(runtime);
      runtime.elementStack.pop();
      runtime.depth--;
    }
  }

  private processIterableEvent(
    runtime: RuntimeState,
    parser: StaxXmlIterableParser | IterableEventTable,
    index: number
  ): void {
    const type = parser.eventType(index);
    if (type === IterableEventType.CHARACTERS && !runtime.plan.eventFilter.includeCharacters) {
      return;
    }
    if (type === IterableEventType.CDATA && !runtime.plan.eventFilter.includeCdata) {
      return;
    }

    this.checkEventLimit(runtime);

    if (type === IterableEventType.START_ELEMENT) {
      const name = parser.copyName(index)!;
      const attributes = runtime.plan.eventFilter.includeAttributes
        ? copyAttributes(parser, index, runtime.options)
        : undefined;
      runtime.depth++;
      runtime.elementStack.push(name);
      recordElementPosition(runtime);
      runtime.currentAttributes = attributes;
      this.checkDepthLimit(runtime);
      this.processStart(runtime, attributes);
      runtime.currentAttributes = undefined;
      return;
    }

    if (type === IterableEventType.CHARACTERS || type === IterableEventType.CDATA) {
      const text = parser.copyText(index)!;
      this.processText(runtime, decodeEntities(text, runtime.options));
      return;
    }

    if (type === IterableEventType.END_ELEMENT) {
      popCompletedChildPositionScope(runtime);
      this.processEnd(runtime);
      runtime.elementStack.pop();
      runtime.depth--;
    }
  }

  private processStart(runtime: RuntimeState, attributes: Record<string, string> | undefined): void {
    const root = runtime.plan.root;
    if (!runtime.rootDone && root.kind !== 'array' && !(root.kind === 'object' && !root.selector)) {
      this.tryStartValue(runtime, root, undefined, { kind: 'root' });
    }

    for (let index = 0; index < runtime.arrays.length; index++) {
      const array = runtime.arrays[index];
      if (!matchesSelector(array.plan.itemSelector, runtime, array.contextDepth)) {
        continue;
      }
      this.startArrayItem(runtime, array, attributes);
    }

    for (let index = 0; index < runtime.objects.length; index++) {
      this.processObjectStart(runtime, runtime.objects[index]);
    }
  }

  private processObjectStart(runtime: RuntimeState, object: ObjectState): void {
    for (const field of object.plan.fields) {
      const value = field.value;
      if (value.kind === 'array') {
        continue;
      }

      if (object.completedFields.has(value.id)) {
        continue;
      }

      if (value.kind === 'object') {
        if (!value.selector) {
          continue;
        }
        if (matchesSelector(value.selector, runtime, object.depth)) {
          this.createObjectState(runtime, value, runtime.depth, { kind: 'field', object, field });
        }
        continue;
      }

      this.tryStartScalar(runtime, value, object.depth, { kind: 'field', object, field });
    }
  }

  private tryStartValue(
    runtime: RuntimeState,
    value: DispatchValuePlan,
    contextDepth: number | undefined,
    parent: ParentBinding
  ): void {
    if (value.kind === 'string' || value.kind === 'number') {
      this.tryStartScalar(runtime, value, contextDepth, parent);
      return;
    }

    const object = value as DispatchObjectPlan;
    if (object.selector && matchesSelector(object.selector, runtime, contextDepth)) {
      this.createObjectState(runtime, object, runtime.depth, parent);
    }
  }

  private tryStartScalar(
    runtime: RuntimeState,
    plan: DispatchScalarPlan,
    contextDepth: number | undefined,
    parent: ParentBinding
  ): void {
    const selector = plan.selector;
    if (!selector || !matchesSelector(selector, runtime, contextDepth)) {
      return;
    }

    if (selector.terminal === 'attribute') {
      const value = currentAttributes(runtime)?.[selector.attributeName!];
      if (value !== undefined) {
        this.assignScalar(runtime, plan, value, parent);
      } else {
        markCompleted(parent, plan);
      }
      return;
    }

    runtime.captures.push({
      plan,
      depth: runtime.depth,
      buffer: '',
      textMode: selector.textMode,
      parent
    });
  }

  private startArrayItem(runtime: RuntimeState, array: ArrayState, attributes: Record<string, string> | undefined): void {
    const itemSelector = array.plan.itemSelector;
    const element = array.plan.element;

    if (itemSelector.terminal === 'attribute') {
      const value = attributes?.[itemSelector.attributeName!];
      if (value !== undefined) {
        array.items.push(parseScalar(element as DispatchScalarPlan, value, true));
      }
      return;
    }

    if (element.kind === 'object') {
      this.createObjectState(runtime, element, runtime.depth, { kind: 'array', array });
      return;
    }

    runtime.captures.push({
      plan: element as DispatchScalarPlan,
      depth: runtime.depth,
      buffer: '',
      textMode: itemSelector.textMode,
      parent: { kind: 'array', array }
    });
  }

  private processText(runtime: RuntimeState, text: string): void {
    for (const capture of runtime.captures) {
      if (capture.textMode === 'direct') {
        if (runtime.depth === capture.depth) {
          capture.buffer += text;
        }
        continue;
      }
      capture.buffer += text;
    }
  }

  private processEnd(runtime: RuntimeState): void {
    const activeCaptures: CaptureState[] = [];
    for (const capture of runtime.captures) {
      if (capture.depth !== runtime.depth) {
        activeCaptures.push(capture);
        continue;
      }
      this.assignScalar(runtime, capture.plan, capture.buffer.trim(), capture.parent);
    }
    runtime.captures = activeCaptures;

    for (let index = runtime.objects.length - 1; index >= 0; index--) {
      const object = runtime.objects[index];
      if (object.depth === runtime.depth) {
        this.finalizeObject(runtime, object);
      }
    }
  }

  private createObjectState(
    runtime: RuntimeState,
    plan: DispatchObjectPlan,
    depth: number,
    parent: ParentBinding
  ): ObjectState {
    const object: ObjectState = {
      plan,
      depth,
      values: {},
      completedFields: new Set(),
      childObjects: [],
      childArrays: [],
      parent
    };

    for (const field of plan.fields) {
      const value = field.value;
      if (value.kind === 'array') {
        const array = this.createArrayState(runtime, value, depth, { kind: 'field', object, field });
        object.childArrays.push(array);
        object.values[field.fieldName] = defaultValue(value, true, 'field');
        continue;
      }

      if (value.kind === 'object' && !value.selector) {
        const child = this.createObjectState(runtime, value, depth, { kind: 'field', object, field });
        object.childObjects.push(child);
        continue;
      }

      object.values[field.fieldName] = defaultValue(value, true, 'field');
    }

    runtime.objects.push(object);
    return object;
  }

  private createArrayState(
    runtime: RuntimeState,
    plan: DispatchArrayPlan,
    contextDepth: number | undefined,
    parent: ParentBinding
  ): ArrayState {
    const array: ArrayState = {
      plan,
      contextDepth,
      items: [],
      parent
    };
    runtime.arrays.push(array);
    return array;
  }

  private assignScalar(
    runtime: RuntimeState,
    plan: DispatchScalarPlan,
    rawValue: string,
    parent: ParentBinding
  ): void {
    const value = parseScalar(plan, rawValue, parent.kind === 'array');
    this.assignValue(runtime, value, parent, plan);
  }

  private assignValue(
    runtime: RuntimeState,
    value: unknown,
    parent: ParentBinding,
    plan: DispatchValuePlan
  ): void {
    if (parent.kind === 'root') {
      runtime.rootValue = value;
      runtime.rootSet = true;
      runtime.rootDone = true;
      return;
    }

    if (parent.kind === 'array') {
      parent.array.items.push(value);
      return;
    }

    parent.object.values[parent.field.fieldName] = value;
    parent.object.completedFields.add(plan.id);
  }

  private finalizeObject(runtime: RuntimeState, object: ObjectState): unknown {
    for (const child of object.childObjects) {
      this.finalizeObject(runtime, child);
    }

    for (const array of object.childArrays) {
      this.finalizeArray(runtime, array);
    }

    runtime.objects = runtime.objects.filter(candidate => candidate !== object);
    let value: unknown = object.values;
    for (const transformFn of object.plan.transforms) {
      value = transformFn(value);
    }

    this.assignValue(runtime, value, object.parent, object.plan);
    return value;
  }

  private finalizeArray(runtime: RuntimeState, array: ArrayState): unknown {
    runtime.arrays = runtime.arrays.filter(candidate => candidate !== array);

    const missingOptional = array.plan.optional && array.items.length === 0;
    let value: unknown = missingOptional && array.parent.kind !== 'root' ? undefined : array.items;
    if (!missingOptional || array.plan.transforms.length > 0) {
      value = applyTransforms(array.plan, value);
    }

    this.assignValue(runtime, value, array.parent, array.plan);
    return value;
  }

  private finish<T>(runtime: RuntimeState): T {
    if (runtime.rootObject) {
      this.finalizeObject(runtime, runtime.rootObject);
    }
    if (runtime.rootArray) {
      this.finalizeArray(runtime, runtime.rootArray);
    }
    return runtime.rootValue as T;
  }

  private checkDepthLimit(runtime: RuntimeState): void {
    if (runtime.depth > runtime.maxDepth) {
      throw new Error(`XML depth limit exceeded: ${runtime.maxDepth}`);
    }
  }

  private checkEventLimit(runtime: RuntimeState): void {
    if (runtime.eventCount > runtime.maxEvents) {
      throw new Error(`XML event limit exceeded: ${runtime.maxEvents}`);
    }
    runtime.eventCount++;
  }

  private createParser(
    input: ParseInput
  ): AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent> {
    return input as AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent>;
  }

  private async processReadableStream(
    runtime: RuntimeState,
    stream: ReadableStream<Uint8Array>
  ): Promise<void> {
    const parser = new StaxXmlIterableParser([], {
      documentMode: runtime.options?.documentMode
    });
    for await (const batch of readReadableStreamByteBatches(stream, { batchSize: 1 })) {
      if (!parser.pushByteBatch(batch, false)) {
        continue;
      }
      for (let index = 0; index < parser.eventCount(); index++) {
        this.processIterableEvent(runtime, parser, index);
      }
    }
    if (parser.pushByteBatch([], true)) {
      for (let index = 0; index < parser.eventCount(); index++) {
        this.processIterableEvent(runtime, parser, index);
      }
    }
  }

  private async processEventBackend(
    runtime: RuntimeState,
    backend: IterableEventBackendIterator
  ): Promise<void> {
    for await (const batch of backend.batchedIterator()) {
      for (const event of batch) {
        this.processEvent(runtime, event);
      }
    }
  }

  private processEventTable(
    runtime: RuntimeState,
    eventTable: IterableEventTable
  ): void {
    while (eventTable.nextBatch()) {
      const count = eventTable.eventCount;
      for (let index = 0; index < count; index++) {
        this.processIterableEvent(runtime, eventTable, index);
      }
    }
  }
}

function matchesSelector(
  selector: DispatchSelector,
  runtime: RuntimeState,
  contextDepth: number | undefined
): boolean {
  if (selector.lastElementName && runtime.elementStack[runtime.depth - 1] !== selector.lastElementName) {
    return false;
  }

  const segments = selector.segments;
  if (selector.mode === 'absolute') {
    if (runtime.depth !== segments.length) return false;
    for (let index = 0; index < segments.length; index++) {
      if (runtime.elementStack[index] !== segments[index]) return false;
    }
    return matchesPositionFilters(selector, runtime, 0);
  }

  if (selector.mode === 'descendant') {
    if (runtime.depth < segments.length) return false;
    const offset = runtime.depth - segments.length;
    for (let index = 0; index < segments.length; index++) {
      if (runtime.elementStack[offset + index] !== segments[index]) return false;
    }
    return matchesPositionFilters(selector, runtime, offset);
  }

  if (runtime.depth !== contextDepth! + segments.length) {
    return false;
  }
  for (let index = 0; index < segments.length; index++) {
    if (runtime.elementStack[contextDepth! + index] !== segments[index]) return false;
  }
  return matchesPositionFilters(selector, runtime, contextDepth!);
}

function matchesPositionFilters(selector: DispatchSelector, runtime: RuntimeState, offset: number): boolean {
  const filters = selector.positionFilters;
  if (!filters) {
    return true;
  }

  for (let index = 0; index < filters.length; index++) {
    const expected = filters[index];
    if (expected !== undefined && runtime.positionStack[offset + index] !== expected) {
      return false;
    }
  }
  return true;
}

function recordElementPosition(runtime: RuntimeState): void {
  if (runtime.positionStack.length < runtime.depth) {
    runtime.positionStack.push(1);
    return;
  }
  runtime.positionStack[runtime.depth - 1]++;
}

function popCompletedChildPositionScope(runtime: RuntimeState): void {
  if (runtime.positionStack.length > runtime.depth) {
    runtime.positionStack.pop();
  }
}

function parseScalar(plan: DispatchScalarPlan, rawValue: string, preserveEmptyOptional: boolean): unknown {
  if (!(plan.optional && rawValue === '' && preserveEmptyOptional) && plan.schema._parseText) {
    return plan.schema._parseText(rawValue);
  }

  let value: unknown;
  if (plan.unwrappedSchema._parseText) {
    try {
      value = plan.unwrappedSchema._parseText(rawValue);
    } catch {
      value = undefined;
    }
  } else {
    value = rawValue;
  }
  return applyTransforms(plan, value);
}

function defaultValue(
  plan: DispatchValuePlan,
  missingSelectableObject: boolean,
  context: 'root' | 'field'
): unknown {
  let value: unknown;
  if ((plan.kind === 'string' || plan.kind === 'number') && plan.optional) {
    return parseScalar(plan, '', false);
  }
  if (plan.optional) {
    value = plan.kind === 'array' && context === 'root' ? [] : undefined;
  } else if (plan.kind === 'string') {
    value = '';
  } else if (plan.kind === 'number') {
    value = NaN;
  } else if (plan.kind === 'array') {
    value = [];
  } else if (missingSelectableObject && plan.selector) {
    value = {};
  } else {
    const result: Record<string, unknown> = {};
    const objectPlan = plan as DispatchObjectPlan;
    for (const field of objectPlan.fields) {
      result[field.fieldName] = defaultValue(field.value, true, 'field');
    }
    value = result;
  }
  return applyTransforms(plan, value);
}

function applyTransforms(plan: DispatchValuePlan, value: unknown): unknown {
  let result = value;
  for (const transformFn of plan.transforms) {
    result = transformFn(result);
  }
  return result;
}

function currentAttributes(runtime: RuntimeState): Record<string, string> | undefined {
  return runtime.currentAttributes;
}

function markCompleted(parent: ParentBinding, plan: DispatchScalarPlan): void {
  if (parent.kind === 'field') {
    parent.object.completedFields.add(plan.id);
  }
}

function copyAttributes(
  parser: StaxXmlIterableParser | IterableEventTable,
  eventIndex: number,
  options?: ParseOptions
): Record<string, string> {
  const count = attributeCount(parser, eventIndex);
  if (count === 0) {
    return {};
  }

  if (hasAttributeLookup(parser)) {
    return lazyAttributeRecord(parser, eventIndex, options);
  }

  const attributes: Record<string, string> = {};
  for (let attrIndex = 0; attrIndex < count; attrIndex++) {
    attributes[parser.copyAttrName(eventIndex, attrIndex)!] = decodeEntities(
      parser.copyAttrValue(eventIndex, attrIndex)!,
      options
    );
  }
  return attributes;
}

function lazyAttributeRecord(
  parser: IterableEventTable & { copyAttrValueByName(eventIndex: number, name: string): string | undefined },
  eventIndex: number,
  options?: ParseOptions
): Record<string, string> {
  let materialized: Record<string, string> | undefined;
  const ensureMaterialized = (): Record<string, string> => {
    if (materialized) {
      return materialized;
    }
    materialized = {};
    const count = parser.eventAttrCount(eventIndex);
    for (let attrIndex = 0; attrIndex < count; attrIndex++) {
      const name = parser.copyAttrName(eventIndex, attrIndex);
      const value = parser.copyAttrValue(eventIndex, attrIndex);
      if (name !== undefined && value !== undefined) {
        materialized[name] = decodeEntities(value, options);
      }
    }
    return materialized;
  };

  return new Proxy(Object.create(null) as Record<string, string>, {
    get(_target, property) {
      if (typeof property !== 'string') {
        return undefined;
      }
      const direct = parser.copyAttrValueByName(eventIndex, property);
      return direct === undefined ? undefined : decodeEntities(direct, options);
    },
    has(_target, property) {
      return typeof property === 'string'
        && parser.copyAttrValueByName(eventIndex, property) !== undefined;
    },
    ownKeys() {
      return Reflect.ownKeys(ensureMaterialized());
    },
    getOwnPropertyDescriptor(_target, property) {
      if (typeof property !== 'string') {
        return undefined;
      }
      const value = ensureMaterialized()[property];
      return value === undefined
        ? undefined
        : { enumerable: true, configurable: true, value };
    },
  });
}

function hasAttributeLookup(
  parser: StaxXmlIterableParser | IterableEventTable
): parser is IterableEventTable & {
  copyAttrValueByName(eventIndex: number, name: string): string | undefined;
} {
  return !(parser instanceof StaxXmlIterableParser)
    && typeof parser.copyAttrValueByName === 'function';
}

type StructuralIndexNativeModule = {
  parseStructuralIndexStringUtf16?: (input: string) => StructuralIndexTable;
  parseSpanTableStringUtf16?: (input: string) => StructuralIndexTable;
  parseStructuralIndexBuffer?: (input: Uint8Array) => StructuralIndexTable;
  parseStructuralIndexUint8Array?: (input: Uint8Array) => StructuralIndexTable;
  parseSpanTableUint8Array?: (input: Uint8Array) => StructuralIndexTable;
};

type NativeItemRowsModule = {
  parseObjectRowsUint8Array?: (
    input: Uint8Array,
    spec: NativeObjectRowsProjectionSpec
  ) => NativeObjectRowsResult;
  parseObjectRowsViaTableUint8Array?: (
    input: Uint8Array,
    spec: NativeObjectRowsProjectionSpec
  ) => NativeObjectRowsResult;
  parseItemRowsViaTableUint8Array?: (input: Uint8Array) => NativeItemRowsResult;
};

type NativeObjectRowsProjectionSpec = {
  itemName: string;
  fields: NativeObjectRowsProjectionFieldSpec[];
};

type NativeObjectRowsProjectionFieldSpec = {
  outputName: string;
  valueKind: 'string' | 'number';
  sourceKind: 'attribute' | 'element';
  sourceName: string;
  textMode: 'direct' | 'subtree';
};

type NativeObjectRowsProjectionPlan = {
  spec: NativeObjectRowsProjectionSpec;
  fields: DispatchFieldPlan[];
};

type NativeObjectRowsResult = {
  inputBytes?: number;
  input_bytes?: number;
  eventCount?: number;
  event_count?: number;
  maxDepth?: number;
  max_depth?: number;
  fieldCount?: number;
  field_count?: number;
  rowCount?: number;
  row_count?: number;
  columns?: NativeObjectRowsColumn[];
};

type NativeObjectRowsColumn = {
  present?: unknown[];
  values?: unknown[];
  numberValues?: unknown[];
  number_values?: unknown[];
  spanStarts?: unknown[];
  span_starts?: unknown[];
  spanEnds?: unknown[];
  span_ends?: unknown[];
};

type NativeObjectRowsResolvedColumn = {
  values?: unknown[];
  spanStarts?: unknown[];
  spanEnds?: unknown[];
  source?: Utf8SpanSource;
};

type Utf8SpanSource = {
  view: Uint8Array;
  buffer?: { toString(encoding: string, start: number, end: number): string };
};

type NativeObjectRowsHydrator = {
  fieldName: string;
  missingValue: unknown;
  valueKind: 'string' | 'number';
  parseValue: (rawValue: string | number) => unknown;
};

type NativeItemRowsResult = {
  inputBytes?: number;
  input_bytes?: number;
  eventCount?: number;
  event_count?: number;
  maxDepth?: number;
  max_depth?: number;
  rows?: Array<{ id: unknown; name: unknown; value: unknown }>;
};

async function tryProjectItemRowsViaNativeTable(
  plan: DispatchCompiledPlan,
  input: ArrayBufferView,
  options?: ParseOptions
): Promise<unknown[] | undefined> {
  if (options?.documentMode === 'document') {
    return undefined;
  }
  const objectRowsProjection = createNativeObjectRowsProjectionPlan(plan);
  const itemRowsSupported = isSupportedNativeItemRowsPlan(plan);
  if (!objectRowsProjection && !itemRowsSupported) {
    return undefined;
  }

  const acceleration = options?.acceleration;
  const backendPreference = acceleration?.backend ?? 'auto';
  if (backendPreference === 'js' || acceleration?.simd === 'avx2') {
    return undefined;
  }

  const backend = await resolveStaxXmlRuntimeBackend();
  if (backend.kind === 'js') {
    return undefined;
  }
  if (backendPreference !== 'auto' && backend.kind !== backendPreference) {
    return undefined;
  }

  const nativeModule = backend.module as NativeItemRowsModule | undefined;
  const projectRows = nativeModule?.parseItemRowsViaTableUint8Array;
  const nativeInput = toUint8Array(input);
  if (itemRowsSupported && typeof projectRows === 'function') {
    try {
      return normalizeNativeItemRowsResult(projectRows(nativeInput), options);
    } catch (error) {
      if (acceleration?.fallbackOnParseError) {
        return undefined;
      }
      throw error;
    }
  }

  const projectObjectRows = nativeModule?.parseObjectRowsUint8Array
    ?? nativeModule?.parseObjectRowsViaTableUint8Array;
  if (objectRowsProjection && typeof projectObjectRows === 'function') {
    try {
      return normalizeNativeObjectRowsResult(
        projectObjectRows(nativeInput, objectRowsProjection.spec),
        objectRowsProjection,
        nativeInput,
        options
      );
    } catch (error) {
      if (acceleration?.fallbackOnParseError) {
        return undefined;
      }
      throw error;
    }
  }

  return undefined;
}

function normalizeNativeObjectRowsResult(
  result: NativeObjectRowsResult,
  projection: NativeObjectRowsProjectionPlan,
  input: Uint8Array,
  options?: ParseOptions
): unknown[] {
  const eventCount = readNativeNumber(result.eventCount ?? result.event_count, 'eventCount');
  const maxDepth = readNativeNumber(result.maxDepth ?? result.max_depth, 'maxDepth');
  const fieldCount = readNativeNumber(result.fieldCount ?? result.field_count, 'fieldCount');
  const rowCount = readNativeNumber(result.rowCount ?? result.row_count, 'rowCount');
  const maxEvents = options?.maxEvents ?? 1000000;
  const configuredMaxDepth = options?.maxDepth ?? 1000;
  if (eventCount > maxEvents) {
    throw new Error(`XML event limit exceeded: ${maxEvents}`);
  }
  if (maxDepth > configuredMaxDepth) {
    throw new Error(`XML depth limit exceeded: ${configuredMaxDepth}`);
  }
  if (fieldCount !== projection.fields.length) {
    throw new Error('Native object rows projection returned an unexpected field count.');
  }
  if (!Array.isArray(result.columns)) {
    throw new Error('Native object rows projection did not return columns.');
  }
  if (result.columns.length !== projection.fields.length) {
    throw new Error('Native object rows projection returned an invalid column count.');
  }
  const hydrators = createNativeObjectRowsHydrators(projection, options);
  const valueColumns = new Array<NativeObjectRowsResolvedColumn>(result.columns.length);
  const spanSource = createUtf8SpanSource(input);
  for (let index = 0; index < result.columns.length; index++) {
    const column = result.columns[index]!;
    const hydrator = hydrators[index]!;
    if (!Array.isArray(column.present)) {
      throw new Error('Native object rows projection returned an invalid column.');
    }
    const values = readNativeObjectRowsColumnValues(column, hydrator, spanSource);
    if (column.present.length !== rowCount || !nativeObjectRowsColumnHasHeight(values, rowCount)) {
      throw new Error('Native object rows projection returned an invalid column height.');
    }
    valueColumns[index] = values;
  }

  const columns = result.columns;
  const rows = new Array<unknown>(rowCount);
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const output: Record<string, unknown> = {};
    for (let index = 0; index < hydrators.length; index++) {
      const hydrator = hydrators[index]!;
      const column = columns[index]!;
      const present = column.present;
      if (!Array.isArray(present)) {
        throw new Error('Native object rows projection returned an invalid column.');
      }
      if (present[rowIndex] !== true) {
        output[hydrator.fieldName] = hydrator.missingValue;
        continue;
      }

      const rawValue = readNativeObjectRowsColumnValue(valueColumns[index]!, rowIndex);
      if (hydrator.valueKind === 'number') {
        if (typeof rawValue !== 'number' && typeof rawValue !== 'string') {
          throw new Error('Native object rows projection returned a non-number value.');
        }
      } else if (typeof rawValue !== 'string') {
        throw new Error('Native object rows projection returned a non-string value.');
      }
      output[hydrator.fieldName] = hydrator.parseValue(rawValue);
    }
    rows[rowIndex] = output;
  }
  return rows;
}

function createNativeObjectRowsHydrators(
  projection: NativeObjectRowsProjectionPlan,
  options?: ParseOptions
): NativeObjectRowsHydrator[] {
  const shouldDecodeEntities = options?.decodeEntities === true;
  return projection.fields.map((field) => {
    const plan = field.value as DispatchScalarPlan;
    const parseText = plan.schema._parseText?.bind(plan.schema);
    const missingValue = defaultValue(plan, true, 'field');
    let parseValue: (rawValue: string | number) => unknown;
    if (plan.kind === 'string' && !plan.optional) {
      parseValue = shouldDecodeEntities
        ? rawValue => decodeEntities(String(rawValue), options)
        : rawValue => rawValue;
    } else if (plan.kind === 'number') {
      parseValue = rawValue => typeof rawValue === 'number'
        ? parseNativeNumberValue(plan, rawValue)
        : (shouldDecodeEntities
            ? parseScalar(plan, decodeEntities(rawValue, options), false)
            : parseScalar(plan, rawValue, false));
    } else if (parseText) {
      parseValue = shouldDecodeEntities
        ? rawValue => parseText(decodeEntities(String(rawValue), options))
        : rawValue => parseText(String(rawValue));
    } else {
      parseValue = shouldDecodeEntities
        ? rawValue => parseScalar(plan, decodeEntities(String(rawValue), options), false)
        : rawValue => parseScalar(plan, String(rawValue), false);
    }

    return {
      fieldName: field.fieldName,
      missingValue,
      valueKind: plan.kind,
      parseValue,
    };
  });
}

function readNativeObjectRowsColumnValues(
  column: NativeObjectRowsColumn,
  hydrator: NativeObjectRowsHydrator,
  source: Utf8SpanSource
): NativeObjectRowsResolvedColumn {
  if (hydrator.valueKind === 'number') {
    const numberValues = column.numberValues ?? column.number_values;
    if (numberValues !== undefined) {
      if (!Array.isArray(numberValues)) {
        throw new Error('Native object rows projection returned an invalid number column.');
      }
      return { values: numberValues };
    }
  }

  const spanStarts = column.spanStarts ?? column.span_starts;
  const spanEnds = column.spanEnds ?? column.span_ends;
  if (
    hydrator.valueKind === 'string'
    && Array.isArray(spanStarts)
    && Array.isArray(spanEnds)
    && spanStarts.length > 0
  ) {
    return {
      values: Array.isArray(column.values) ? column.values : undefined,
      spanStarts,
      spanEnds,
      source
    };
  }

  if (Array.isArray(column.values)) {
    return { values: column.values };
  }

  if (
    hydrator.valueKind === 'string'
    && ((spanStarts !== undefined && !Array.isArray(spanStarts))
      || (spanEnds !== undefined && !Array.isArray(spanEnds)))
  ) {
    throw new Error('Native object rows projection returned an invalid span column.');
  }

  throw new Error('Native object rows projection returned an invalid column.');
}

function nativeObjectRowsColumnHasHeight(
  column: NativeObjectRowsResolvedColumn,
  rowCount: number
): boolean {
  if (column.values && column.values.length !== rowCount) {
    return false;
  }
  if (column.spanStarts && column.spanStarts.length !== rowCount) {
    return false;
  }
  if (column.spanEnds && column.spanEnds.length !== rowCount) {
    return false;
  }
  return !!column.values || (!!column.spanStarts && !!column.spanEnds);
}

function readNativeObjectRowsColumnValue(
  column: NativeObjectRowsResolvedColumn,
  rowIndex: number
): unknown {
  if (column.spanStarts && column.spanEnds && column.source) {
    const start = column.spanStarts[rowIndex];
    const end = column.spanEnds[rowIndex];
    if (typeof start === 'number' && typeof end === 'number' && start >= 0 && end >= start) {
      return copyUtf8Span(column.source, start, end);
    }
  }
  return column.values?.[rowIndex];
}

function copyUtf8Span(source: Utf8SpanSource, start: number, end: number): string {
  if (source.buffer) {
    return source.buffer.toString('utf8', start, end);
  }
  return utf8Decoder.decode(source.view.subarray(start, end));
}

function createUtf8SpanSource(input: Uint8Array): Utf8SpanSource {
  const bufferCtor = (globalThis as {
    Buffer?: {
      isBuffer(value: unknown): boolean;
      from(buffer: ArrayBufferLike, byteOffset: number, length: number): {
        toString(encoding: string, start: number, end: number): string;
      };
    };
  }).Buffer;
  if (bufferCtor?.isBuffer(input) && typeof (input as { toString?: unknown }).toString === 'function') {
    return {
      view: input,
      buffer: input as unknown as { toString(encoding: string, start: number, end: number): string },
    };
  }
  if (bufferCtor?.from) {
    return {
      view: input,
      buffer: bufferCtor.from(input.buffer, input.byteOffset, input.byteLength),
    };
  }
  return { view: input };
}

function parseNativeNumberValue(plan: DispatchScalarPlan, value: number): number {
  const options = ((plan.unwrappedSchema as { options?: XmlNumberOptions }).options ?? {}) as XmlNumberOptions;
  if (Number.isNaN(value)) {
    throw new XmlParseError([{
      path: [],
      message: 'Invalid number: NaN',
      code: 'invalid_number'
    }]);
  }
  if (options.min !== undefined && value < options.min) {
    throw new XmlParseError([{
      path: [],
      message: `Number ${value} is less than minimum ${options.min}`,
      code: 'too_small'
    }]);
  }
  if (options.max !== undefined && value > options.max) {
    throw new XmlParseError([{
      path: [],
      message: `Number ${value} is greater than maximum ${options.max}`,
      code: 'too_big'
    }]);
  }
  if (options.int && !Number.isInteger(value)) {
    throw new XmlParseError([{
      path: [],
      message: `Expected integer, got ${value}`,
      code: 'not_integer'
    }]);
  }
  return value;
}

function normalizeNativeItemRowsResult(
  result: NativeItemRowsResult,
  options?: ParseOptions
): unknown[] {
  const eventCount = readNativeNumber(result.eventCount ?? result.event_count, 'eventCount');
  const maxDepth = readNativeNumber(result.maxDepth ?? result.max_depth, 'maxDepth');
  const maxEvents = options?.maxEvents ?? 1000000;
  const configuredMaxDepth = options?.maxDepth ?? 1000;
  if (eventCount > maxEvents) {
    throw new Error(`XML event limit exceeded: ${maxEvents}`);
  }
  if (maxDepth > configuredMaxDepth) {
    throw new Error(`XML depth limit exceeded: ${configuredMaxDepth}`);
  }
  if (!Array.isArray(result.rows)) {
    throw new Error('Native item projection did not return rows.');
  }

  return result.rows.map((row) => ({
    id: Number(row.id),
    name: decodeEntities(String(row.name), options),
    value: decodeEntities(String(row.value), options),
  }));
}

function readNativeNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Native item projection did not return ${label}.`);
  }
  return value;
}

function createNativeObjectRowsProjectionPlan(
  plan: DispatchCompiledPlan
): NativeObjectRowsProjectionPlan | undefined {
  const root = plan.root;
  if (
    root.kind !== 'array'
    || root.transforms.length !== 0
    || root.itemSelector.mode !== 'descendant'
    || root.itemSelector.terminal !== 'element'
    || root.itemSelector.segments.length !== 1
    || root.itemSelector.positionFilters
    || root.element.kind !== 'object'
    || root.element.transforms.length !== 0
  ) {
    return undefined;
  }

  const fields: DispatchFieldPlan[] = [];
  const nativeFields: NativeObjectRowsProjectionFieldSpec[] = [];
  for (const field of root.element.fields) {
    const value = field.value;
    if (
      (value.kind !== 'string' && value.kind !== 'number')
      || value.transforms.length !== 0
      || !value.selector
      || value.selector.mode !== 'relative'
      || value.selector.positionFilters
    ) {
      return undefined;
    }

    if (value.selector.terminal === 'attribute') {
      if (value.selector.segments.length !== 0 || !value.selector.attributeName) {
        return undefined;
      }
      nativeFields.push({
        outputName: field.fieldName,
        valueKind: value.kind,
        sourceKind: 'attribute',
        sourceName: value.selector.attributeName,
        textMode: 'direct',
      });
    } else {
      if (value.selector.segments.length !== 1) {
        return undefined;
      }
      nativeFields.push({
        outputName: field.fieldName,
        valueKind: value.kind,
        sourceKind: 'element',
        sourceName: value.selector.segments[0]!,
        textMode: value.selector.textMode,
      });
    }
    fields.push(field);
  }

  if (nativeFields.length === 0) {
    return undefined;
  }

  return {
    spec: {
      itemName: root.itemSelector.segments[0]!,
      fields: nativeFields,
    },
    fields,
  };
}

function isSupportedNativeItemRowsPlan(plan: DispatchCompiledPlan): boolean {
  const root = plan.root;
  if (
    root.kind !== 'array'
    || root.optional
    || root.transforms.length !== 0
    || !selectorEquals(root.itemSelector, {
      mode: 'descendant',
      segments: ['item'],
      terminal: 'element',
    })
    || root.element.kind !== 'object'
    || root.element.optional
    || root.element.transforms.length !== 0
  ) {
    return false;
  }

  const fields = new Map(root.element.fields.map(field => [field.fieldName, field.value]));
  return fields.size === 3
    && isScalarField(fields.get('id'), 'number', {
      mode: 'relative',
      segments: [],
      terminal: 'attribute',
      attributeName: 'id',
    })
    && isScalarField(fields.get('name'), 'string', {
      mode: 'relative',
      segments: ['name'],
      terminal: 'element',
    })
    && isScalarField(fields.get('value'), 'string', {
      mode: 'relative',
      segments: ['value'],
      terminal: 'element',
    });
}

function isScalarField(
  value: DispatchValuePlan | undefined,
  kind: 'string' | 'number',
  selector: Pick<DispatchSelector, 'mode' | 'segments' | 'terminal' | 'attributeName'>
): value is DispatchScalarPlan {
  return value?.kind === kind
    && !value.optional
    && value.transforms.length === 0
    && selectorEquals(value.selector, selector);
}

function selectorEquals(
  actual: DispatchSelector | undefined,
  expected: Pick<DispatchSelector, 'mode' | 'segments' | 'terminal' | 'attributeName'>
): boolean {
  return actual?.mode === expected.mode
    && actual.terminal === expected.terminal
    && (actual.attributeName ?? undefined) === (expected.attributeName ?? undefined)
    && !actual.positionFilters
    && actual.segments.length === expected.segments.length
    && actual.segments.every((segment, index) => segment === expected.segments[index]);
}

async function tryCreateStructuralIndexTable(
  input: string | ArrayBufferView,
  options?: ParseOptions
): Promise<StaxXmlStructuralIndexParser | undefined> {
  if (options?.documentMode === 'document') {
    return undefined;
  }
  const acceleration = options?.acceleration;
  const backendPreference = acceleration?.backend ?? 'auto';
  if (backendPreference === 'js') {
    return undefined;
  }
  if (acceleration?.simd === 'avx2') {
    return undefined;
  }

  const backend = await resolveStaxXmlRuntimeBackend();
  if (backend.kind === 'js') {
    return undefined;
  }
  if (backendPreference !== 'auto' && backend.kind !== backendPreference) {
    return undefined;
  }

  try {
    const nativeModule = backend.module as StructuralIndexNativeModule | undefined;
    let table: StructuralIndexTable;
    const sourceKind = typeof input === 'string' ? 'utf16' : 'utf8';
    if (typeof input === 'string') {
      const buildStringTable = nativeModule?.parseStructuralIndexStringUtf16
        ?? nativeModule?.parseSpanTableStringUtf16;
      if (typeof buildStringTable !== 'function') {
        return undefined;
      }
      table = buildStringTable(input);
    } else {
      const buildByteTable = nativeModule?.parseStructuralIndexBuffer
        ?? nativeModule?.parseStructuralIndexUint8Array
        ?? nativeModule?.parseSpanTableUint8Array;
      if (typeof buildByteTable !== 'function') {
        return undefined;
      }
      table = buildByteTable(toUint8Array(input));
    }
    return new StaxXmlStructuralIndexParser(input, table, {
      decodeEntities: options?.decodeEntities ?? false,
      sourceKind,
    });
  } catch (error) {
    if (acceleration?.fallbackOnParseError) {
      return undefined;
    }
    throw error;
  }
}

function attributeCount(parser: StaxXmlIterableParser | IterableEventTable, eventIndex: number): number {
  return parser instanceof StaxXmlIterableParser
    ? parser.attrCount(eventIndex)
    : parser.eventAttrCount(eventIndex);
}

function decodeEntities(value: string, options?: ParseOptions): string {
  if (options?.decodeEntities !== true) {
    return value;
  }
  if (value.indexOf('&') === -1) {
    return value;
  }

  DEFAULT_ENTITY_REGEX.lastIndex = 0;
  return value.replace(DEFAULT_ENTITY_REGEX, (_, entity: string) => DEFAULT_ENTITY_MAP[entity]!);
}

function normalizeOptions(options: ParseOptions | unknown): ParseOptions | undefined {
  if (!options || typeof options !== 'object') {
    return undefined;
  }
  if ('schemaType' in options) {
    return undefined;
  }
  return options as ParseOptions;
}

function isSyncIterator(input: ParseInput): input is Iterator<AnyXmlEvent> & Iterable<AnyXmlEvent> {
  return typeof input === 'object'
    && input !== null
    && !isArrayBufferView(input)
    && !(input instanceof ReadableStream)
    && Symbol.iterator in input
    && typeof (input as Iterable<AnyXmlEvent>)[Symbol.iterator] === 'function';
}

function isArrayBufferView(input: unknown): input is ArrayBufferView {
  return ArrayBuffer.isView(input);
}

function toUint8Array(input: ArrayBufferView): Uint8Array {
  return input instanceof Uint8Array
    ? input
    : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}
