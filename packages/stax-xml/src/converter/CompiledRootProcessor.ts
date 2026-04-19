import { StaxXmlParser } from '../StaxXmlParser.js';
import { StaxXmlParserSync } from '../StaxXmlParserSync.js';
import {
  isCdata,
  isCharacters,
  isEndElement,
  isError,
  isStartElement,
  type AnyXmlEvent,
  type StartElementEvent
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
import type { ParseOptions } from './types.js';

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
  active: boolean;
};

type ArrayState = {
  plan: DispatchArrayPlan;
  contextDepth?: number;
  items: unknown[];
  parent: ParentBinding;
  active: boolean;
  finalized: boolean;
};

type CaptureState = {
  plan: DispatchScalarPlan;
  depth: number;
  buffer: string;
  textMode: 'subtree' | 'direct';
  parent: ParentBinding;
  field?: DispatchFieldPlan;
  active: boolean;
};

type RuntimeState = {
  plan: DispatchCompiledPlan;
  options?: ParseOptions;
  depth: number;
  eventCount: number;
  maxDepth: number;
  maxEvents: number;
  elementStack: string[];
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
    private readonly plan: CompiledSchemaPlan,
    private readonly options?: ParseOptions
  ) {}

  static supports(plan: CompiledSchemaPlan): boolean {
    return plan.kind === 'dispatch';
  }

  parseSync<T>(input: string, options?: ParseOptions | unknown): T {
    if (this.plan.kind !== 'dispatch') {
      throw new Error(`CompiledRootProcessor requires a dispatch plan: ${this.plan.reason}`);
    }
    const effectiveOptions = normalizeOptions(options) ?? this.options;
    const runtime = this.createRuntime(this.plan, effectiveOptions);
    const parser = new StaxXmlParserSync(input, {
      autoDecodeEntities: effectiveOptions?.decodeEntities,
      eventFilter: this.plan.eventFilter
    });

    for (const event of parser) {
      this.processEvent(runtime, event);
    }

    return this.finish<T>(runtime);
  }

  async parse<T>(input: ParseInput, options?: ParseOptions | unknown): Promise<T> {
    if (this.plan.kind !== 'dispatch') {
      throw new Error(`CompiledRootProcessor requires a dispatch plan: ${this.plan.reason}`);
    }

    if (typeof input === 'string') {
      return this.parseSync<T>(input, options);
    }

    const effectiveOptions = normalizeOptions(options) ?? this.options;
    const runtime = this.createRuntime(this.plan, effectiveOptions);
    const parser = this.createParser(input, effectiveOptions);

    if (isSyncIterator(input)) {
      for (const event of input) {
        this.processEvent(runtime, event);
      }
      return this.finish<T>(runtime);
    }

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
      rootValue: defaultValue(plan.root, true),
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
      runtime.currentAttributes = event.attributes;
      this.checkDepthLimit(runtime);
      this.processStart(runtime, event);
      runtime.currentAttributes = undefined;
    } else if (isCharacters(event) || isCdata(event)) {
      this.processText(runtime, event.value);
    } else if (isEndElement(event)) {
      this.processEnd(runtime);
      runtime.elementStack.pop();
      runtime.depth--;
    }
  }

  private processStart(runtime: RuntimeState, event: StartElementEvent): void {
    const root = runtime.plan.root;
    if (!runtime.rootDone && root.kind !== 'array' && !(root.kind === 'object' && !root.selector)) {
      this.tryStartValue(runtime, root, undefined, { kind: 'root' }, undefined);
    }

    for (let index = 0; index < runtime.arrays.length; index++) {
      const array = runtime.arrays[index];
      if (!array.active || !matchesSelector(array.plan.itemSelector, runtime, array.contextDepth)) {
        continue;
      }
      this.startArrayItem(runtime, array, event);
    }

    for (let index = 0; index < runtime.objects.length; index++) {
      const object = runtime.objects[index];
      if (!object.active) continue;
      this.processObjectStart(runtime, object);
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

      this.tryStartScalar(runtime, value, object.depth, { kind: 'field', object, field }, field);
    }
  }

  private tryStartValue(
    runtime: RuntimeState,
    value: DispatchValuePlan,
    contextDepth: number | undefined,
    parent: ParentBinding,
    field: DispatchFieldPlan | undefined
  ): void {
    if (value.kind === 'string' || value.kind === 'number') {
      this.tryStartScalar(runtime, value, contextDepth, parent, field);
      return;
    }

    if (value.kind === 'object') {
      if (value.selector && matchesSelector(value.selector, runtime, contextDepth)) {
        this.createObjectState(runtime, value, runtime.depth, parent);
      }
    }
  }

  private tryStartScalar(
    runtime: RuntimeState,
    plan: DispatchScalarPlan,
    contextDepth: number | undefined,
    parent: ParentBinding,
    field: DispatchFieldPlan | undefined
  ): void {
    const selector = plan.selector;
    if (!selector || !matchesSelector(selector, runtime, contextDepth)) {
      return;
    }

    if (selector.terminal === 'attribute') {
      const value = selector.attributeName ? currentAttributes(runtime)?.[selector.attributeName] : undefined;
      if (value !== undefined) {
        this.assignScalar(runtime, plan, value, parent, field);
      } else {
        markCompleted(parent, field, plan);
      }
      return;
    }

    runtime.captures.push({
      plan,
      depth: runtime.depth,
      buffer: '',
      textMode: selector.textMode,
      parent,
      field,
      active: true
    });
  }

  private startArrayItem(runtime: RuntimeState, array: ArrayState, event: StartElementEvent): void {
    const itemSelector = array.plan.itemSelector;
    const element = array.plan.element;

    if (itemSelector.terminal === 'attribute') {
      const value = itemSelector.attributeName ? event.attributes?.[itemSelector.attributeName] : undefined;
      if (value !== undefined && (element.kind === 'string' || element.kind === 'number')) {
        array.items.push(parseScalar(element, value));
      }
      return;
    }

    if (element.kind === 'object') {
      this.createObjectState(runtime, element, runtime.depth, { kind: 'array', array });
      return;
    }

    if (element.kind === 'string' || element.kind === 'number') {
      runtime.captures.push({
        plan: element,
        depth: runtime.depth,
        buffer: '',
        textMode: itemSelector.textMode,
        parent: { kind: 'array', array },
        active: true
      });
    }
  }

  private processText(runtime: RuntimeState, text: string): void {
    for (const capture of runtime.captures) {
      if (!capture.active) continue;
      if (capture.textMode === 'direct') {
        if (runtime.depth === capture.depth) {
          capture.buffer += text;
        }
        continue;
      }
      if (runtime.depth >= capture.depth) {
        capture.buffer += text;
      }
    }
  }

  private processEnd(runtime: RuntimeState): void {
    for (const capture of runtime.captures) {
      if (!capture.active || capture.depth !== runtime.depth) {
        continue;
      }
      capture.active = false;
      this.assignScalar(runtime, capture.plan, capture.buffer.trim(), capture.parent, capture.field);
    }
    runtime.captures = runtime.captures.filter(capture => capture.active);

    for (let index = runtime.objects.length - 1; index >= 0; index--) {
      const object = runtime.objects[index];
      if (object.active && object.depth === runtime.depth) {
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
      parent,
      active: true
    };

    for (const field of plan.fields) {
      const value = field.value;
      if (value.kind === 'array') {
        const array = this.createArrayState(runtime, value, depth, { kind: 'field', object, field });
        object.childArrays.push(array);
        object.values[field.fieldName] = value.optional ? undefined : [];
        continue;
      }

      if (value.kind === 'object' && !value.selector) {
        const child = this.createObjectState(runtime, value, depth, { kind: 'field', object, field });
        object.childObjects.push(child);
        continue;
      }

      object.values[field.fieldName] = defaultValue(value, true);
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
      parent,
      active: true,
      finalized: false
    };
    runtime.arrays.push(array);
    return array;
  }

  private assignScalar(
    runtime: RuntimeState,
    plan: DispatchScalarPlan,
    rawValue: string,
    parent: ParentBinding,
    field: DispatchFieldPlan | undefined
  ): void {
    const value = parseScalar(plan, rawValue);
    this.assignValue(runtime, value, parent, field, plan);
  }

  private assignValue(
    runtime: RuntimeState,
    value: unknown,
    parent: ParentBinding,
    field: DispatchFieldPlan | undefined,
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

    if (!field) {
      return;
    }
    parent.object.values[field.fieldName] = value;
    parent.object.completedFields.add(plan.id);
  }

  private finalizeObject(runtime: RuntimeState, object: ObjectState): unknown {
    if (!object.active) {
      return object.values;
    }

    for (const child of object.childObjects) {
      if (child.active) {
        this.finalizeObject(runtime, child);
      }
    }

    for (const array of object.childArrays) {
      if (array.active) {
        this.finalizeArray(runtime, array);
      }
    }

    object.active = false;
    runtime.objects = runtime.objects.filter(candidate => candidate !== object);
    let value: unknown = object.values;
    for (const transformFn of object.plan.transforms) {
      value = transformFn(value);
    }

    this.assignValue(runtime, value, object.parent, object.parent.kind === 'field' ? object.parent.field : undefined, object.plan);
    return value;
  }

  private finalizeArray(runtime: RuntimeState, array: ArrayState): unknown {
    if (array.finalized) {
      return array.items;
    }

    array.active = false;
    array.finalized = true;
    runtime.arrays = runtime.arrays.filter(candidate => candidate !== array);

    let value: unknown = array.plan.optional && array.items.length === 0 ? undefined : array.items;
    if (!(array.plan.optional && array.items.length === 0)) {
      for (const transformFn of array.plan.transforms) {
        value = transformFn(value);
      }
    }

    this.assignValue(runtime, value, array.parent, array.parent.kind === 'field' ? array.parent.field : undefined, array.plan);
    return value;
  }

  private finish<T>(runtime: RuntimeState): T {
    if (runtime.rootObject?.active) {
      this.finalizeObject(runtime, runtime.rootObject);
    }
    if (runtime.rootArray?.active) {
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
    input: ParseInput,
    options?: ParseOptions
  ): AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent> {
    if (input instanceof ReadableStream) {
      return new StaxXmlParser(input, {
        autoDecodeEntities: options?.decodeEntities,
        eventFilter: this.plan.kind === 'dispatch' ? this.plan.eventFilter : undefined
      }) as AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent>;
    }
    return input as AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent>;
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
    return true;
  }

  if (selector.mode === 'descendant') {
    if (runtime.depth < segments.length) return false;
    const offset = runtime.depth - segments.length;
    for (let index = 0; index < segments.length; index++) {
      if (runtime.elementStack[offset + index] !== segments[index]) return false;
    }
    return true;
  }

  if (contextDepth === undefined) {
    return false;
  }
  if (runtime.depth !== contextDepth + segments.length) {
    return false;
  }
  for (let index = 0; index < segments.length; index++) {
    if (runtime.elementStack[contextDepth + index] !== segments[index]) return false;
  }
  return true;
}

function parseScalar(plan: DispatchScalarPlan, rawValue: string): unknown {
  if (plan.schema._parseText) {
    return plan.schema._parseText(rawValue);
  }
  return rawValue;
}

function defaultValue(plan: DispatchValuePlan, missingSelectableObject: boolean): unknown {
  if (plan.optional) {
    return undefined;
  }
  if (plan.kind === 'string') {
    return '';
  }
  if (plan.kind === 'number') {
    return NaN;
  }
  if (plan.kind === 'array') {
    return [];
  }
  if (missingSelectableObject && plan.selector) {
    return {};
  }

  if (plan.kind !== 'object') {
    return undefined;
  }

  const result: Record<string, unknown> = {};
  for (const field of plan.fields) {
    result[field.fieldName] = defaultValue(field.value, true);
  }
  return result;
}

function currentAttributes(runtime: RuntimeState): Record<string, string> | undefined {
  return runtime.currentAttributes;
}

function markCompleted(parent: ParentBinding, field: DispatchFieldPlan | undefined, plan: DispatchScalarPlan): void {
  if (parent.kind === 'field' && field) {
    parent.object.completedFields.add(plan.id);
  }
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
    && !(input instanceof ReadableStream)
    && Symbol.iterator in input
    && typeof (input as Iterable<AnyXmlEvent>)[Symbol.iterator] === 'function';
}
