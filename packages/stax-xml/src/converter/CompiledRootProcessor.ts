import {
  IterableEventType,
  IterableReader,
} from '../IterableReader.js';
import {
  createStaxXmlRuntimeFromBackend,
  getInitializedStaxXmlRuntime,
  getStaxXmlRuntimeForSyncApi,
  resolveStaxXmlRuntimeBackend,
  type StaxXmlRuntime,
  type StaxXmlRuntimeBackendPreference,
  type StaxXmlObjectProjectionPlan,
} from '../runtime/index.js';
import {
  StaxXmlStructuralIndexParser,
  type StructuralIndexTable
} from '../runtime/structural-index-parser.js';
import {
  projectXmlItemRows,
  projectXmlItemRowsSync,
  projectXmlObjectRows,
  projectXmlObjectRowsSync,
  type ItemRowsProjectionResult,
  type ObjectRecordsProjectionResult,
  type ObjectRowsProjectionFieldSpec,
  type ObjectRowsProjectionResult,
  type ObjectRowsProjectionSpec,
} from '../projection/index.js';
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
  createIterableReaderFromChunks,
  getIterableEventBackend,
  getIterableEventTable,
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
const NATIVE_OBJECT_WIRE_EXPERIMENT_KEY = Symbol.for('stax-xml.experiment.native-object-wire');
const STABLE_NATIVE_RECORD_SHAPE_EXPERIMENT_KEY = Symbol.for('stax-xml.experiment.stable-record-shape');
const DISABLE_SCHEMA_AWARE_RECORDS_EXPERIMENT_KEY = Symbol.for('stax-xml.experiment.disable-schema-aware-records');

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

  parseSync<T>(input: string | ArrayBufferView, options?: ParseOptions | unknown): T {
    const effectiveOptions = normalizeOptions(options) ?? this.options;
    if (typeof input === 'string') {
      return this.parseSync<T>(textEncoder.encode(input), effectiveOptions);
    }
    if (isArrayBufferView(input)) {
      const projectedRows = tryProjectItemRowsViaNativeTableSync(this.plan, input, effectiveOptions);
      if (projectedRows !== undefined) {
        return projectedRows as T;
      }

      const runtime = this.createRuntime(this.plan, effectiveOptions);
      const acceleratedTable = tryCreateStructuralIndexTableSync(input, effectiveOptions);
      if (acceleratedTable) {
        this.processEventTable(runtime, acceleratedTable);
        return this.finish<T>(runtime);
      }
      const parser = createIterableReaderFromChunks([toUint8Array(input)], {
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
    throw new Error('Unsupported parseSync input type.');
  }

  async parse<T>(input: ParseInput, options?: ParseOptions | unknown): Promise<T> {
    const effectiveOptions = normalizeOptions(options) ?? this.options;
    if (typeof input === 'string') {
      return this.parse<T>(textEncoder.encode(input), effectiveOptions);
    }
    if (isArrayBufferView(input)) {
      const projectedRows = await tryProjectItemRowsViaNativeTable(this.plan, input, effectiveOptions);
      if (projectedRows !== undefined) {
        return projectedRows as T;
      }
    }
    const runtime = this.createRuntime(this.plan, effectiveOptions);

    if (isArrayBufferView(input)) {
      const acceleratedTable = await tryCreateStructuralIndexTable(input, effectiveOptions);
      if (acceleratedTable) {
        this.processEventTable(runtime, acceleratedTable);
        return this.finish<T>(runtime);
      }

      const parser = createIterableReaderFromChunks([toUint8Array(input)], {
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
    parser: IterableReader | IterableEventTable,
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
    const backend = new IterableEventBackendIterator(stream, {
      autoDecodeEntities: runtime.options?.decodeEntities === true,
      trimText: false,
      documentMode: runtime.options?.documentMode,
      backend: runtime.options?.acceleration?.backend,
      fallbackOnLoadError: runtime.options?.acceleration?.fallbackOnLoadError,
      fallbackOnParseError: runtime.options?.acceleration?.fallbackOnParseError
    });
    await this.processEventBackend(runtime, backend);
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
  parser: IterableReader | IterableEventTable,
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
  return new Proxy(Object.create(null) as Record<string, string>, {
    get(_target, property) {
      const direct = parser.copyAttrValueByName(eventIndex, property as string);
      return direct === undefined ? undefined : decodeEntities(direct, options);
    },
  });
}

function hasAttributeLookup(
  parser: IterableReader | IterableEventTable
): parser is IterableEventTable & {
  copyAttrValueByName(eventIndex: number, name: string): string | undefined;
} {
  return !(parser instanceof IterableReader)
    && typeof parser.copyAttrValueByName === 'function';
}

type StructuralIndexNativeModule = {
  parseStructuralIndexBuffer?: (input: Uint8Array) => StructuralIndexTable;
  parseStructuralIndexUint8Array?: (input: Uint8Array) => StructuralIndexTable;
  parseSpanTableUint8Array?: (input: Uint8Array) => StructuralIndexTable;
};

type NativeObjectRowsProjectionSpec = ObjectRowsProjectionSpec;
type NativeObjectRowsProjectionFieldSpec = ObjectRowsProjectionFieldSpec;

type NativeObjectRowsProjectionPlan = {
  spec: NativeObjectRowsProjectionSpec;
  fields: DispatchFieldPlan[];
  compiledNative?: {
    factory: NonNullable<StaxXmlRuntime['capabilities']['createObjectProjectionPlan']>;
    plan: StaxXmlObjectProjectionPlan;
  };
};

type NativeObjectRowsResult = ObjectRowsProjectionResult;
type NativeObjectRecordsResult = ObjectRecordsProjectionResult;

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

type NativeObjectRecordsRequiredScalarFastPath = {
  stringFieldNames: string[];
  stringFieldIndexes: number[];
  numberFieldNames: string[];
  numberFieldIndexes: number[];
  numberFieldPlans: DispatchScalarPlan[];
};

const nativeObjectRowsProjectionPlanCache = new WeakMap<
  DispatchCompiledPlan,
  NativeObjectRowsProjectionPlan
>();

type NativeItemRowsResult = ItemRowsProjectionResult;

async function resolveConverterRuntime(
  backendPreference: StaxXmlRuntimeBackendPreference,
  fallbackBackend: 'wasm' | undefined,
  allowAutoLoad: boolean,
): Promise<StaxXmlRuntime | undefined> {
  const initialized = getInitializedStaxXmlRuntime();
  if (initialized) {
    if (backendPreference !== 'auto' && initialized.backend.kind !== backendPreference) {
      throw new Error(`Initialized stax-xml backend is ${initialized.backend.kind}, not ${backendPreference}. Call initStaxXml({ backend: '${backendPreference}' }) first.`);
    }
    return initialized.backend.kind === 'js' ? undefined : initialized;
  }
  if (backendPreference === 'auto' && !allowAutoLoad) {
    return undefined;
  }
  const backend = await resolveStaxXmlRuntimeBackend({
    backend: backendPreference,
    fallbackBackend,
    fallbackOnLoadError: false,
  });
  return backend.kind === 'js' ? undefined : createStaxXmlRuntimeFromBackend(backend);
}

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
  const accelerationRequested = acceleration !== undefined;
  if (acceleration?.simd === 'avx2') {
    return undefined;
  }

  const initializedRuntime = getInitializedStaxXmlRuntime();
  if (backendPreference === 'auto' && !initializedRuntime && !accelerationRequested) {
    return undefined;
  }

  const nativeInput = toUint8Array(input);
  const projectionOptions = {
    backend: backendPreference,
    fallbackBackend: acceleration?.fallbackBackend,
  };
  if (itemRowsSupported) {
    try {
      return normalizeNativeItemRowsResult(
        await projectXmlItemRows(nativeInput, projectionOptions),
        options
      );
    } catch (error) {
      if (isProjectionCapabilityError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  if (objectRowsProjection) {
    const compiledPlan = initializedRuntime
      ? getNativeCompiledObjectProjectionPlan(initializedRuntime, objectRowsProjection)
      : undefined;
    const requiredScalarFastPath = createNativeObjectRecordsRequiredScalarFastPath(objectRowsProjection, options);
    const preferRowsWire = shouldPreferNativeObjectRowsWireExperiment()
      && requiredScalarFastPath !== undefined;
    if (preferRowsWire) {
      try {
        return normalizeNativeObjectRowsResult(
          typeof compiledPlan?.projectRows === 'function'
            ? compiledPlan.projectRows(nativeInput) as NativeObjectRowsResult
            : await projectXmlObjectRows(nativeInput, objectRowsProjection.spec, projectionOptions),
          objectRowsProjection,
          nativeInput,
          options
        );
      } catch (error) {
        if (isProjectionCapabilityError(error)) {
          return undefined;
        }
        throw error;
      }
    }
    if (canUseNativeSchemaAwareRecordsPlan(compiledPlan, requiredScalarFastPath)) {
      try {
        return normalizeNativeObjectRecordsResult(
          compiledPlan.projectSchemaAwareRecords(nativeInput) as NativeObjectRecordsResult,
          objectRowsProjection,
          options
        );
      } catch (error) {
        if (!isProjectionCapabilityError(error)) {
          throw error;
        }
      }
    }
    if (
      typeof compiledPlan?.projectRecords === 'function'
      && canUseNativeObjectRecordsPlan(objectRowsProjection)
    ) {
      try {
        return normalizeNativeObjectRecordsResult(
          compiledPlan.projectRecords(nativeInput) as NativeObjectRecordsResult,
          objectRowsProjection,
          options
        );
      } catch (error) {
        if (!isProjectionCapabilityError(error)) {
          throw error;
        }
      }
    }
    try {
      return normalizeNativeObjectRowsResult(
        typeof compiledPlan?.projectRows === 'function'
          ? compiledPlan.projectRows(nativeInput) as NativeObjectRowsResult
          : await projectXmlObjectRows(nativeInput, objectRowsProjection.spec, projectionOptions),
        objectRowsProjection,
        nativeInput,
        options
      );
    } catch (error) {
      if (isProjectionCapabilityError(error)) {
        return undefined;
      }
      throw error;
    }
  }
  return undefined;
}

function tryProjectItemRowsViaNativeTableSync(
  plan: DispatchCompiledPlan,
  input: ArrayBufferView,
  options?: ParseOptions
): unknown[] | undefined {
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
  const accelerationRequested = acceleration !== undefined;
  if (acceleration?.simd === 'avx2') {
    return undefined;
  }

  const initializedRuntime = getInitializedStaxXmlRuntime();
  if (backendPreference === 'auto' && !initializedRuntime) {
    if (accelerationRequested) {
      throw new Error('Compiled converter sync acceleration requires an initialized native or wasm backend. Call initStaxXml() before parseSync or use the async parse method.');
    }
    return undefined;
  }

  const nativeInput = toUint8Array(input);
  if (itemRowsSupported) {
    try {
      return normalizeNativeItemRowsResult(
        projectXmlItemRowsSync(nativeInput, { backend: backendPreference }),
        options
      );
    } catch (error) {
      if (isProjectionCapabilityError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  if (objectRowsProjection) {
    const compiledPlan = initializedRuntime
      ? getNativeCompiledObjectProjectionPlan(initializedRuntime, objectRowsProjection)
      : undefined;
    const requiredScalarFastPath = createNativeObjectRecordsRequiredScalarFastPath(objectRowsProjection, options);
    const preferRowsWire = shouldPreferNativeObjectRowsWireExperiment()
      && requiredScalarFastPath !== undefined;
    if (preferRowsWire) {
      try {
        return normalizeNativeObjectRowsResult(
          typeof compiledPlan?.projectRows === 'function'
            ? compiledPlan.projectRows(nativeInput) as NativeObjectRowsResult
            : projectXmlObjectRowsSync(nativeInput, objectRowsProjection.spec, { backend: backendPreference }),
          objectRowsProjection,
          nativeInput,
          options
        );
      } catch (error) {
        if (isProjectionCapabilityError(error)) {
          return undefined;
        }
        throw error;
      }
    }
    if (canUseNativeSchemaAwareRecordsPlan(compiledPlan, requiredScalarFastPath)) {
      try {
        return normalizeNativeObjectRecordsResult(
          compiledPlan.projectSchemaAwareRecords(nativeInput) as NativeObjectRecordsResult,
          objectRowsProjection,
          options
        );
      } catch (error) {
        if (!isProjectionCapabilityError(error)) {
          throw error;
        }
      }
    }
    if (
      typeof compiledPlan?.projectRecords === 'function'
      && canUseNativeObjectRecordsPlan(objectRowsProjection)
    ) {
      try {
        return normalizeNativeObjectRecordsResult(
          compiledPlan.projectRecords(nativeInput) as NativeObjectRecordsResult,
          objectRowsProjection,
          options
        );
      } catch (error) {
        if (!isProjectionCapabilityError(error)) {
          throw error;
        }
      }
    }
    try {
      return normalizeNativeObjectRowsResult(
        typeof compiledPlan?.projectRows === 'function'
          ? compiledPlan.projectRows(nativeInput) as NativeObjectRowsResult
          : projectXmlObjectRowsSync(nativeInput, objectRowsProjection.spec, { backend: backendPreference }),
        objectRowsProjection,
        nativeInput,
        options
      );
    } catch (error) {
      if (isProjectionCapabilityError(error)) {
        return undefined;
      }
      throw error;
    }
  }
  return undefined;
}

function isProjectionCapabilityError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('projection capabilities')
    || message.includes('does not provide object row projection capability')
    || message.includes('does not provide object record projection capability')
    || message.includes('does not provide item row projection capability')
    || message.includes('backend is not initialized')
    || message.includes('sync methods require an initialized');
}

function normalizeNativeObjectRecordsResult(
  result: NativeObjectRecordsResult,
  projection: NativeObjectRowsProjectionPlan,
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
    throw new Error('Native object records projection returned an unexpected field count.');
  }
  let rows = Array.isArray(result.rows)
    ? result.rows
    : typeof result.json === 'string'
      ? JSON.parse(result.json) as unknown[]
      : undefined;
  if (!Array.isArray(rows) || rows.length !== rowCount) {
    throw new Error('Native object records projection returned invalid rows.');
  }

  const fastPath = createNativeObjectRecordsRequiredScalarFastPath(projection, options);
  if (fastPath) {
    if (isStableNativeRecordShapeExperimentEnabled()) {
      rows = cloneStableNativeObjectRecordsShape(rows, fastPath);
    }
    return normalizeSpecializedNativeObjectRecordsResult(rows, fastPath);
  }

  const hydrators = createNativeObjectRowsHydrators(projection, options);
  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      throw new Error('Native object records projection returned a non-object row.');
    }
    const record = row as Record<string, unknown>;
    for (const hydrator of hydrators) {
      const rawValue = hydrator.valueKind === 'number' && record[hydrator.fieldName] === null
        ? NaN
        : record[hydrator.fieldName];
      if (hydrator.valueKind === 'number') {
        if (typeof rawValue !== 'number' && typeof rawValue !== 'string') {
          throw new Error('Native object records projection returned a non-number value.');
        }
      } else if (typeof rawValue !== 'string') {
        throw new Error('Native object records projection returned a non-string value.');
      }
      const value = hydrator.parseValue(rawValue);
      if (value !== rawValue) {
        record[hydrator.fieldName] = value;
      }
    }
  }
  return rows;
}

function isStableNativeRecordShapeExperimentEnabled(): boolean {
  return (globalThis as Record<PropertyKey, unknown>)[STABLE_NATIVE_RECORD_SHAPE_EXPERIMENT_KEY] === true;
}

function shouldPreferNativeObjectRowsWireExperiment(): boolean {
  return (globalThis as Record<PropertyKey, unknown>)[NATIVE_OBJECT_WIRE_EXPERIMENT_KEY] === 'rows';
}

function isSchemaAwareRecordsExperimentDisabled(): boolean {
  return (globalThis as Record<PropertyKey, unknown>)[DISABLE_SCHEMA_AWARE_RECORDS_EXPERIMENT_KEY] === true;
}

function canUseNativeSchemaAwareRecordsPlan(
  compiledPlan: StaxXmlObjectProjectionPlan | undefined,
  fastPath: NativeObjectRecordsRequiredScalarFastPath | undefined,
): compiledPlan is StaxXmlObjectProjectionPlan & {
  projectSchemaAwareRecords: (input: Uint8Array) => unknown;
} {
  return fastPath !== undefined
    && typeof compiledPlan?.projectSchemaAwareRecords === 'function'
    && !isSchemaAwareRecordsExperimentDisabled();
}

function createNativeObjectRecordsRequiredScalarFastPath(
  projection: NativeObjectRowsProjectionPlan,
  options?: ParseOptions,
): NativeObjectRecordsRequiredScalarFastPath | undefined {
  if (options?.decodeEntities === true) {
    return undefined;
  }

  const stringFieldNames: string[] = [];
  const stringFieldIndexes: number[] = [];
  const numberFieldNames: string[] = [];
  const numberFieldIndexes: number[] = [];
  const numberFieldPlans: DispatchScalarPlan[] = [];

  for (let index = 0; index < projection.fields.length; index++) {
    const field = projection.fields[index]!;
    const plan = field.value;
    if (plan.kind === 'string') {
      if (plan.optional || plan.transforms.length !== 0) {
        return undefined;
      }
      stringFieldNames.push(field.fieldName);
      stringFieldIndexes.push(index);
      continue;
    }
    if (plan.kind === 'number') {
      if (plan.optional || plan.transforms.length !== 0) {
        return undefined;
      }
      numberFieldNames.push(field.fieldName);
      numberFieldIndexes.push(index);
      numberFieldPlans.push(plan);
      continue;
    }
    return undefined;
  }

  return {
    stringFieldNames,
    stringFieldIndexes,
    numberFieldNames,
    numberFieldIndexes,
    numberFieldPlans,
  };
}

function normalizeSpecializedNativeObjectRecordsResult(
  rows: unknown[],
  fastPath: NativeObjectRecordsRequiredScalarFastPath,
): unknown[] {
  const stringFieldCount = fastPath.stringFieldNames.length;
  const numberFieldCount = fastPath.numberFieldNames.length;

  if (stringFieldCount === 2 && numberFieldCount === 2) {
    return normalizeSpecializedNativeObjectRecordsResult2x2(rows, fastPath);
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!row || typeof row !== 'object') {
      throw new Error('Native object records projection returned a non-object row.');
    }
    const record = row as Record<string, unknown>;

    for (let fieldIndex = 0; fieldIndex < stringFieldCount; fieldIndex++) {
      const fieldName = fastPath.stringFieldNames[fieldIndex]!;
      if (typeof record[fieldName] !== 'string') {
        throw new Error('Native object records projection returned a non-string value.');
      }
    }

    for (let fieldIndex = 0; fieldIndex < numberFieldCount; fieldIndex++) {
      const fieldName = fastPath.numberFieldNames[fieldIndex]!;
      const plan = fastPath.numberFieldPlans[fieldIndex]!;
      const rawValue = record[fieldName];

      let normalizedValue: number;
      if (rawValue === null) {
        normalizedValue = parseNativeNumberValue(plan, NaN);
      } else if (typeof rawValue === 'number') {
        normalizedValue = parseNativeNumberValue(plan, rawValue);
      } else if (typeof rawValue === 'string') {
        normalizedValue = parseScalar(plan, rawValue, false) as number;
      } else {
        throw new Error('Native object records projection returned a non-number value.');
      }

      if (normalizedValue !== rawValue) {
        record[fieldName] = normalizedValue;
      }
    }
  }

  return rows;
}

function normalizeSpecializedNativeObjectRecordsResult2x2(
  rows: unknown[],
  fastPath: NativeObjectRecordsRequiredScalarFastPath,
): unknown[] {
  const stringFieldName0 = fastPath.stringFieldNames[0]!;
  const stringFieldName1 = fastPath.stringFieldNames[1]!;
  const numberFieldName0 = fastPath.numberFieldNames[0]!;
  const numberFieldName1 = fastPath.numberFieldNames[1]!;
  const numberFieldPlan0 = fastPath.numberFieldPlans[0]!;
  const numberFieldPlan1 = fastPath.numberFieldPlans[1]!;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!row || typeof row !== 'object') {
      throw new Error('Native object records projection returned a non-object row.');
    }
    const record = row as Record<string, unknown>;

    const stringValue0 = record[stringFieldName0];
    if (typeof stringValue0 !== 'string') {
      throw new Error('Native object records projection returned a non-string value.');
    }
    const stringValue1 = record[stringFieldName1];
    if (typeof stringValue1 !== 'string') {
      throw new Error('Native object records projection returned a non-string value.');
    }

    normalizeSpecializedNativeObjectRecordNumberField(record, numberFieldName0, numberFieldPlan0);
    normalizeSpecializedNativeObjectRecordNumberField(record, numberFieldName1, numberFieldPlan1);
  }

  return rows;
}

function normalizeSpecializedNativeObjectRecordNumberField(
  record: Record<string, unknown>,
  fieldName: string,
  plan: DispatchScalarPlan,
): void {
  const rawValue = record[fieldName];
  let normalizedValue: number;
  if (rawValue === null) {
    normalizedValue = parseNativeNumberValue(plan, NaN);
  } else if (typeof rawValue === 'number') {
    normalizedValue = parseNativeNumberValue(plan, rawValue);
  } else if (typeof rawValue === 'string') {
    normalizedValue = parseScalar(plan, rawValue, false) as number;
  } else {
    throw new Error('Native object records projection returned a non-number value.');
  }

  if (normalizedValue !== rawValue) {
    record[fieldName] = normalizedValue;
  }
}

function cloneStableNativeObjectRecordsShape(
  rows: unknown[],
  fastPath: NativeObjectRecordsRequiredScalarFastPath,
): unknown[] {
  const stableRows = new Array<unknown>(rows.length);
  const stringFieldCount = fastPath.stringFieldNames.length;
  const numberFieldCount = fastPath.numberFieldNames.length;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!row || typeof row !== 'object') {
      throw new Error('Native object records projection returned a non-object row.');
    }
    const sourceRecord = row as Record<string, unknown>;
    const stableRecord: Record<string, unknown> = {};

    for (let fieldIndex = 0; fieldIndex < stringFieldCount; fieldIndex++) {
      const fieldName = fastPath.stringFieldNames[fieldIndex]!;
      stableRecord[fieldName] = sourceRecord[fieldName];
    }
    for (let fieldIndex = 0; fieldIndex < numberFieldCount; fieldIndex++) {
      const fieldName = fastPath.numberFieldNames[fieldIndex]!;
      stableRecord[fieldName] = sourceRecord[fieldName];
    }

    stableRows[rowIndex] = stableRecord;
  }

  return stableRows;
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
  const requiredScalarFastPath = createNativeObjectRecordsRequiredScalarFastPath(projection, options);
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

  if (requiredScalarFastPath) {
    return normalizeSpecializedNativeObjectRowsResult(
      valueColumns,
      result.columns,
      rowCount,
      requiredScalarFastPath,
    );
  }

  const columns = result.columns;
  const rows = new Array<unknown>(rowCount);
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const output: Record<string, unknown> = {};
    for (let index = 0; index < hydrators.length; index++) {
      const hydrator = hydrators[index]!;
      const column = columns[index]!;
      const present = column.present!;
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

function normalizeSpecializedNativeObjectRowsResult(
  valueColumns: readonly NativeObjectRowsResolvedColumn[],
  columns: readonly NativeObjectRowsColumn[],
  rowCount: number,
  fastPath: NativeObjectRecordsRequiredScalarFastPath,
): unknown[] {
  const rows = new Array<unknown>(rowCount);
  const stringFieldCount = fastPath.stringFieldNames.length;
  const numberFieldCount = fastPath.numberFieldNames.length;

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const output: Record<string, unknown> = {};

    for (let fieldIndex = 0; fieldIndex < stringFieldCount; fieldIndex++) {
      const columnIndex = fastPath.stringFieldIndexes[fieldIndex]!;
      const column = columns[columnIndex]!;
      if (column.present![rowIndex] !== true) {
        output[fastPath.stringFieldNames[fieldIndex]!] = '';
        continue;
      }
      const rawValue = readSpecializedNativeObjectRowsStringValue(valueColumns[columnIndex]!, rowIndex);
      if (typeof rawValue !== 'string') {
        throw new Error('Native object rows projection returned a non-string value.');
      }
      output[fastPath.stringFieldNames[fieldIndex]!] = rawValue;
    }

    for (let fieldIndex = 0; fieldIndex < numberFieldCount; fieldIndex++) {
      const columnIndex = fastPath.numberFieldIndexes[fieldIndex]!;
      const column = columns[columnIndex]!;
      if (column.present![rowIndex] !== true) {
        output[fastPath.numberFieldNames[fieldIndex]!] = NaN;
        continue;
      }
      const plan = fastPath.numberFieldPlans[fieldIndex]!;
      const rawValue = readSpecializedNativeObjectRowsNumberValue(valueColumns[columnIndex]!, rowIndex);
      if (typeof rawValue === 'number') {
        output[fastPath.numberFieldNames[fieldIndex]!] = parseNativeNumberValue(plan, rawValue);
      } else if (typeof rawValue === 'string') {
        output[fastPath.numberFieldNames[fieldIndex]!] = parseScalar(plan, rawValue, false);
      } else {
        throw new Error('Native object rows projection returned a non-number value.');
      }
    }

    rows[rowIndex] = output;
  }

  return rows;
}

function readSpecializedNativeObjectRowsStringValue(
  column: NativeObjectRowsResolvedColumn,
  rowIndex: number,
): string | undefined {
  if (column.spanStarts && column.spanEnds && column.source) {
    const start = column.spanStarts[rowIndex];
    const end = column.spanEnds[rowIndex];
    if (typeof start === 'number' && typeof end === 'number' && start >= 0 && end >= start) {
      return copyUtf8Span(column.source, start, end);
    }
  }
  const direct = column.values?.[rowIndex];
  return typeof direct === 'string' ? direct : undefined;
}

function readSpecializedNativeObjectRowsNumberValue(
  column: NativeObjectRowsResolvedColumn,
  rowIndex: number,
): string | number | undefined {
  const direct = column.values?.[rowIndex];
  if (typeof direct === 'number' || typeof direct === 'string') {
    return direct;
  }
  return undefined;
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
    } else {
      parseValue = shouldDecodeEntities
        ? rawValue => parseText!(decodeEntities(String(rawValue), options))
        : rawValue => parseText!(String(rawValue));
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
      values: Array.isArray(column.values) && column.values.length > 0 ? column.values : undefined,
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

  return result.rows.map((row) => {
    const record = row as { id: unknown; name: unknown; value: unknown };
    return {
      id: Number(record.id),
      name: decodeEntities(String(record.name), options),
      value: decodeEntities(String(record.value), options),
    };
  });
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
  const cached = nativeObjectRowsProjectionPlanCache.get(plan);
  if (cached) {
    return cached;
  }

  const root = plan.root;
  if (
    root.kind !== 'array'
    || root.transforms.length !== 0
    || root.itemSelector.mode !== 'descendant'
    || root.itemSelector.terminal !== 'element'
    || root.itemSelector.segments.length !== 1
    || root.element.kind !== 'object'
    || root.element.transforms.length !== 0
  ) {
    return undefined;
  }

  let requiresRequiredScalarFields = false;
  const fields: DispatchFieldPlan[] = [];
  const nativeFields: NativeObjectRowsProjectionFieldSpec[] = [];
  for (const field of root.element.fields) {
    const value = field.value;
    if (
      (value.kind !== 'string' && value.kind !== 'number')
      || value.transforms.length !== 0
      || !value.selector
      || value.selector.mode !== 'relative'
    ) {
      return undefined;
    }

    if (value.selector.terminal === 'attribute') {
      if (
        value.selector.segments.length !== 0
        || value.selector.positionFilters
        || !value.selector.attributeName
      ) {
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
      if (value.selector.segments.length === 0) {
        return undefined;
      }
      if (value.selector.segments.length > 1 || value.selector.positionFilters) {
        requiresRequiredScalarFields = true;
      }
      const nativeField: NativeObjectRowsProjectionFieldSpec = {
        outputName: field.fieldName,
        valueKind: value.kind,
        sourceKind: 'element',
        sourceName: value.selector.segments[value.selector.segments.length - 1]!,
        textMode: value.selector.textMode,
      };
      if (value.selector.segments.length > 1 || value.selector.positionFilters) {
        nativeField.sourcePath = [...value.selector.segments];
        if (value.selector.positionFilters) {
          nativeField.sourcePositions = value.selector.positionFilters.map(position => position ?? 0);
        }
      }
      nativeFields.push(nativeField);
    }
    if (requiresRequiredScalarFields && value.optional) {
      return undefined;
    }
    fields.push(field);
  }

  if (nativeFields.length === 0 || hasOverlappingNativeObjectRowsCaptures(nativeFields)) {
    return undefined;
  }

  const projection = {
    spec: {
      itemName: root.itemSelector.segments[0]!,
      itemPosition: root.itemSelector.positionFilters?.[0],
      fields: nativeFields,
    },
    fields,
  };
  nativeObjectRowsProjectionPlanCache.set(plan, projection);
  return projection;
}

function isSupportedNativeObjectRecordsPlan(
  projection: NativeObjectRowsProjectionPlan
): boolean {
  return projection.fields.every(field => {
    const value = field?.value;
    return !!value
      && (value.kind === 'string' || value.kind === 'number')
      && !value.optional
      && value.transforms.length === 0;
  });
}

function canUseNativeObjectRecordsPlan(
  projection: NativeObjectRowsProjectionPlan
): boolean {
  try {
    return isSupportedNativeObjectRecordsPlan(projection);
  } catch {
    return false;
  }
}

function getNativeCompiledObjectProjectionPlan(
  runtime: StaxXmlRuntime,
  projection: NativeObjectRowsProjectionPlan
): StaxXmlObjectProjectionPlan | undefined {
  const factory = runtime.capabilities.createObjectProjectionPlan;
  if (typeof factory !== 'function') {
    return undefined;
  }
  if (projection.compiledNative?.factory === factory) {
    return projection.compiledNative.plan;
  }
  const plan = factory(projection.spec);
  projection.compiledNative = { factory, plan };
  return plan;
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

function hasOverlappingNativeObjectRowsCaptures(
  fields: readonly NativeObjectRowsProjectionFieldSpec[]
): boolean {
  const normalized = fields
    .filter((field) => field.sourceKind === 'element')
    .map((field) => ({
      textMode: field.textMode,
      path: field.sourcePath && field.sourcePath.length > 0
        ? field.sourcePath
        : [field.sourceName],
      positions: normalizeNativeSourcePositions(field),
    }));

  for (let index = 0; index < normalized.length; index++) {
    for (let otherIndex = index + 1; otherIndex < normalized.length; otherIndex++) {
      const left = normalized[index]!;
      const right = normalized[otherIndex]!;
      if (
        selectorsCouldMatchSameElement(left.path, left.positions, right.path, right.positions)
        && left.textMode !== right.textMode
      ) {
        return true;
      }
      if (
        selectorIsCompatiblePrefix(left.path, left.positions, right.path, right.positions)
        || selectorIsCompatiblePrefix(right.path, right.positions, left.path, left.positions)
      ) {
        return true;
      }
    }
  }
  return false;
}

function normalizeNativeSourcePositions(
  field: NativeObjectRowsProjectionFieldSpec
): number[] {
  const length = field.sourcePath?.length ?? 1;
  const sourcePositions = field.sourcePositions ?? [];
  return Array.from({ length }, (_, index) => sourcePositions[index] ?? 0);
}

function selectorsCouldMatchSameElement(
  leftPath: readonly string[],
  leftPositions: readonly number[],
  rightPath: readonly string[],
  rightPositions: readonly number[],
): boolean {
  if (leftPath.length !== rightPath.length) {
    return false;
  }
  for (let index = 0; index < leftPath.length; index++) {
    if (leftPath[index] !== rightPath[index]) {
      return false;
    }
    if (!positionsAreCompatible(leftPositions[index] ?? 0, rightPositions[index] ?? 0)) {
      return false;
    }
  }
  return true;
}

function selectorIsCompatiblePrefix(
  shorterPath: readonly string[],
  shorterPositions: readonly number[],
  longerPath: readonly string[],
  longerPositions: readonly number[],
): boolean {
  if (shorterPath.length >= longerPath.length) {
    return false;
  }
  for (let index = 0; index < shorterPath.length; index++) {
    if (shorterPath[index] !== longerPath[index]) {
      return false;
    }
    if (!positionsAreCompatible(shorterPositions[index] ?? 0, longerPositions[index] ?? 0)) {
      return false;
    }
  }
  return true;
}

function positionsAreCompatible(left: number, right: number): boolean {
  return left === 0 || right === 0 || left === right;
}

async function tryCreateStructuralIndexTable(
  input: ArrayBufferView,
  options?: ParseOptions
): Promise<StaxXmlStructuralIndexParser | undefined> {
  if (options?.documentMode === 'document') {
    return undefined;
  }
  const acceleration = options?.acceleration;
  const backendPreference = acceleration?.backend ?? 'auto';
  const accelerationRequested = acceleration !== undefined;
  if (acceleration?.simd === 'avx2') {
    return undefined;
  }

  const runtime = await resolveConverterRuntime(
    backendPreference,
    acceleration?.fallbackBackend,
    accelerationRequested,
  );
  if (!runtime || runtime.backend.kind === 'js') {
    if (accelerationRequested) {
      throw new Error('Compiled converter acceleration requires a native or wasm backend. Use initStaxXml() or backend: "wasm" explicitly; JavaScript is not a public acceleration fallback.');
    }
    return undefined;
  }

  try {
    const buildByteTable = runtime.capabilities.structuralIndexUtf8 as StructuralIndexNativeModule['parseStructuralIndexUint8Array'];
    if (typeof buildByteTable !== 'function') {
      if (accelerationRequested) {
        throw new Error(`Initialized ${runtime.backend.kind} backend does not provide structuralIndexUtf8 capability.`);
      }
      return undefined;
    }
    const bytes = toUint8Array(input);
    const table = buildByteTable(bytes);
    return new StaxXmlStructuralIndexParser(bytes, table, {
      decodeEntities: options?.decodeEntities ?? false,
      sourceKind: 'utf8',
    });
  } catch (error) {
    if (!accelerationRequested && isProjectionCapabilityError(error)) {
      return undefined;
    }
    throw error;
  }
}

function tryCreateStructuralIndexTableSync(
  input: ArrayBufferView,
  options?: ParseOptions
): StaxXmlStructuralIndexParser | undefined {
  if (options?.documentMode === 'document') {
    return undefined;
  }
  const acceleration = options?.acceleration;
  const backendPreference = acceleration?.backend ?? 'auto';
  const accelerationRequested = acceleration !== undefined;
  if (acceleration?.simd === 'avx2') {
    return undefined;
  }

  const runtime = getStaxXmlRuntimeForSyncApi(backendPreference);
  if (!runtime || runtime.backend.kind === 'js') {
    if (accelerationRequested) {
      throw new Error('Compiled converter sync acceleration requires an initialized native or wasm backend. Call initStaxXml() before parseSync or use the async parse method.');
    }
    return undefined;
  }
  const buildByteTable = runtime.capabilities.structuralIndexUtf8 as StructuralIndexNativeModule['parseStructuralIndexUint8Array'];
  if (typeof buildByteTable !== 'function') {
    if (accelerationRequested || backendPreference !== 'auto') {
      throw new Error(`Initialized ${runtime.backend.kind} backend does not provide structuralIndexUtf8 capability.`);
    }
    return undefined;
  }

  try {
    const bytes = toUint8Array(input);
    return new StaxXmlStructuralIndexParser(bytes, buildByteTable(bytes), {
      decodeEntities: options?.decodeEntities ?? false,
      sourceKind: 'utf8',
    });
  } catch (error) {
    if (!accelerationRequested && isProjectionCapabilityError(error)) {
      return undefined;
    }
    throw error;
  }
}

function attributeCount(parser: IterableReader | IterableEventTable, eventIndex: number): number {
  return parser instanceof IterableReader
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
