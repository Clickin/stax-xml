import { NEED_INPUT, TokenCursor, XmlEventType } from '@stax-xml/core';
import {
  isCdata,
  isCharacters,
  isEndElement,
  isStartElement,
  type AnyXmlEvent
} from '@stax-xml/core';
import type {
  DispatchArrayPlan,
  DispatchCompiledPlan,
  DispatchFieldAction,
  DispatchFieldPlan,
  DispatchObjectPlan,
  DispatchScalarPlan,
  DispatchSelector,
  DispatchEndAction,
  DispatchStartAction,
  DispatchIrProgram,
  DispatchTextAction,
  DispatchValuePlan
} from './compiled-plan.js';
import type { ParseInput } from './XmlSchema.js';
import type { ParseOptions } from './types.js';

const DECODE_CHUNK_BYTES = 64 * 1024;

type ParentBinding =
  | { kind: 'root' }
  | { kind: 'field'; object: ObjectState; field: DispatchFieldPlan }
  | { kind: 'array'; array: ArrayState; index: number };

type ObjectState = {
  slot: number;
  plan: DispatchObjectPlan;
  depth: number;
  values: Record<string, unknown>;
  completedFieldBits: number;
  completedFields?: Set<number>;
  activeFieldBits: number;
  activeFields?: Set<number>;
  closed: boolean;
  childObjects: ObjectState[];
  childArrays: ArrayState[];
  runtimeStart: number;
  parent: ParentBinding;
  closed: boolean;
};

type ArrayState = {
  slot: number;
  plan: DispatchArrayPlan;
  contextDepth?: number;
  items: unknown[];
  runtimeStart: number;
  parent: ParentBinding;
};

type CaptureState = {
  slot: number;
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
  rootDone: boolean;
  rootActive: boolean;
  rootObject?: ObjectState;
  rootArray?: ArrayState;
  objects: ObjectState[];
  objectsByPlan: ObjectState[][];
  arrays: ArrayState[];
  arraysByPlan: ArrayState[][];
  objectsByPlanDepth: Array<Map<number, ObjectState[]>>;
  arraysByPlanDepth: Array<Map<number, ArrayState[]>>;
  captures: CaptureState[];
  positionScopes?: Array<Map<string, number>>;
  currentAttributes?: Record<string, string>;
  currentTokenCursor?: TokenCursor;
  attributeLookupCount: number;
  attributeLookupCache?: Record<string, string | undefined>;
  processingStart?: boolean;
};

type StartExecutor = (processor: CompiledRootProcessor, runtime: RuntimeState) => void;
type TextExecutor = (processor: CompiledRootProcessor, runtime: RuntimeState, text: string) => void;
type EndExecutor = (processor: CompiledRootProcessor, runtime: RuntimeState) => void;
type StartConstant = DispatchValuePlan | DispatchArrayPlan | DispatchFieldAction;
type ObjectFactory = () => Record<string, unknown>;
const startExecutorCache = new WeakMap<DispatchIrProgram, StartExecutor>();
const textExecutorCache = new WeakMap<DispatchIrProgram, TextExecutor>();
const endExecutorCache = new WeakMap<DispatchIrProgram, EndExecutor>();
const objectFactoryCache = new WeakMap<DispatchObjectPlan, ObjectFactory>();
const objectTemplateFactoryCache = new WeakMap<DispatchObjectPlan, ObjectFactory>();
let warnedCodeGenerationFallback = false;

export function warnCodeGenerationFallback(): void {
  if (warnedCodeGenerationFallback) return;
  warnedCodeGenerationFallback = true;
  console.warn('[stax-xml] Runtime code generation is unavailable; using the slower compiled-plan executor.');
}

export class CompiledRootProcessor {
  private readonly startExecutor: StartExecutor;
  private readonly textExecutor: TextExecutor;
  private readonly endExecutor: EndExecutor;

  constructor(
    private readonly plan: DispatchCompiledPlan,
    private readonly options?: ParseOptions
  ) {
    let executor = startExecutorCache.get(plan.ir);
    if (!executor) {
      executor = compileStartExecutor(plan.ir);
      startExecutorCache.set(plan.ir, executor);
    }
    this.startExecutor = executor;
    let textExecutor = textExecutorCache.get(plan.ir);
    if (!textExecutor) {
      textExecutor = compileTextExecutor(plan.ir);
      textExecutorCache.set(plan.ir, textExecutor);
    }
    this.textExecutor = textExecutor;
    let endExecutor = endExecutorCache.get(plan.ir);
    if (!endExecutor) {
      endExecutor = compileEndExecutor(plan.ir);
      endExecutorCache.set(plan.ir, endExecutor);
    }
    this.endExecutor = endExecutor;
  }

  parseSync<T>(input: ParseInput, options?: ParseOptions | unknown): T {
    const effectiveOptions = normalizeOptions(options) ?? this.options;
    if (typeof input === 'string') {
      const runtime = this.createRuntime(this.plan, effectiveOptions);
      this.processString(runtime, input);
      return this.finish<T>(runtime);
    }
    if (input instanceof Uint8Array) {
      const runtime = this.createRuntime(this.plan, effectiveOptions);
      this.processBytes(runtime, input);
      return this.finish<T>(runtime);
    }
    if (isSyncIterable(input)) {
      const runtime = this.createRuntime(this.plan, effectiveOptions);
      this.processSyncIterable(runtime, input);
      return this.finish<T>(runtime);
    }
    throw new Error('Unsupported parseSync input type.');
  }

  async parse<T>(input: ParseInput, options?: ParseOptions | unknown): Promise<T> {
    const effectiveOptions = normalizeOptions(options) ?? this.options;
    if (typeof input === 'string') {
      const runtime = this.createRuntime(this.plan, effectiveOptions);
      this.processString(runtime, input);
      return this.finish<T>(runtime);
    }
    const runtime = this.createRuntime(this.plan, effectiveOptions);

    if (input instanceof Uint8Array) {
      this.processBytes(runtime, input);
      return this.finish<T>(runtime);
    }

    if (isSyncIterable(input)) {
      this.processSyncIterable(runtime, input);
      return this.finish<T>(runtime);
    }

    if (input instanceof ReadableStream) {
      await this.processReadableStream(runtime, input);
      return this.finish<T>(runtime);
    }

    if (isAsyncIterable(input)) {
      await this.processAsyncIterable(
        runtime,
        input as AsyncIterable<Uint8Array | readonly Uint8Array[] | AnyXmlEvent>
      );
      return this.finish<T>(runtime);
    }

    throw new Error('Unsupported parse input type.');
  }

  private createRuntime(plan: DispatchCompiledPlan, options?: ParseOptions): RuntimeState {
    const runtime: RuntimeState = {
      plan,
      options,
      depth: 0,
      eventCount: 0,
      maxDepth: options?.maxDepth ?? Infinity,
      maxEvents: options?.maxEvents ?? Infinity,
      elementStack: [],
      positionStack: [],
      rootValue: undefined,
      rootDone: false,
      rootActive: false,
      objects: [],
      objectsByPlan: [],
      arrays: [],
      arraysByPlan: [],
      objectsByPlanDepth: [],
      arraysByPlanDepth: [],
      captures: [],
      attributeLookupCount: 0,
      positionScopes: plan.ir.paths.some(path => path.selector.positionFilters) ? [] : undefined
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

    if (isStartElement(event)) {
      runtime.depth++;
      runtime.elementStack.push(event.name);
      recordElementPosition(runtime);
      runtime.currentAttributes = runtime.plan.eventFilter.includeAttributes
        ? Object.fromEntries(event.attributes.map((attribute) => [attribute.name, attribute.value]))
        : undefined;
      runtime.attributeLookupCount = 0;
      runtime.attributeLookupCache = undefined;
      this.checkDepthLimit(runtime);
      runtime.processingStart = true;
      try {
        this.processStart(runtime);
      } finally {
        runtime.processingStart = false;
      }
      runtime.currentAttributes = undefined;
      runtime.attributeLookupCache = undefined;
    } else if (isCharacters(event) || isCdata(event)) {
      this.processText(runtime, event.value);
    } else if (isEndElement(event)) {
      this.processEnd(runtime);
      runtime.elementStack.pop();
      runtime.depth--;
      popCompletedChildPositionScope(runtime);
    }
  }

  private processString(runtime: RuntimeState, input: string): void {
    const cursor = new TokenCursor(input, true, {
      documentMode: runtime.options?.documentMode ?? 'fragment',
    });
    while (cursor.next() !== null) this.processTokenCursorEvent(runtime, cursor);
  }

  private processBytes(runtime: RuntimeState, bytes: Uint8Array): void {
    const cursor = this.createIncrementalCursor(runtime);
    const decoder = new TextDecoder('utf-8', { fatal: true });
    this.processByteChunk(runtime, cursor, decoder, bytes);
    this.finishByteInput(runtime, cursor, decoder);
  }

  private createIncrementalCursor(runtime: RuntimeState): TokenCursor {
    return new TokenCursor('', false, {
      documentMode: runtime.options?.documentMode ?? 'fragment',
    });
  }

  private processByteChunk(
    runtime: RuntimeState,
    cursor: TokenCursor,
    decoder: TextDecoder,
    bytes: Uint8Array,
  ): void {
    for (let offset = 0; offset < bytes.byteLength; offset += DECODE_CHUNK_BYTES) {
      const end = Math.min(offset + DECODE_CHUNK_BYTES, bytes.byteLength);
      const text = decoder.decode(bytes.subarray(offset, end), { stream: true });
      if (text.length === 0) continue;
      cursor.push(text, false);
      this.drainIncrementalCursor(runtime, cursor);
    }
  }

  private finishByteInput(runtime: RuntimeState, cursor: TokenCursor, decoder: TextDecoder): void {
    cursor.push(decoder.decode(), true);
    this.drainIncrementalCursor(runtime, cursor);
  }

  private drainIncrementalCursor(runtime: RuntimeState, cursor: TokenCursor): void {
    while (true) {
      const type = cursor.next();
      if (type === NEED_INPUT || type === null) return;
      this.processTokenCursorEvent(runtime, cursor);
    }
  }

  private processTokenCursorEvent(runtime: RuntimeState, cursor: TokenCursor): void {
    const type = cursor.eventType();
    if (type === XmlEventType.CHARACTERS && !runtime.plan.eventFilter.includeCharacters) return;
    if (type === XmlEventType.CDATA && !runtime.plan.eventFilter.includeCdata) return;

    this.checkEventLimit(runtime);
    if (type === XmlEventType.START_ELEMENT) {
      runtime.depth++;
      runtime.elementStack.push(cursor.name()!);
      recordElementPosition(runtime);
      runtime.currentTokenCursor = cursor;
      runtime.attributeLookupCount = 0;
      runtime.attributeLookupCache = undefined;
      runtime.processingStart = true;
      try {
        this.checkDepthLimit(runtime);
        this.processStart(runtime);
      } finally {
        runtime.processingStart = false;
        runtime.currentTokenCursor = undefined;
        runtime.attributeLookupCache = undefined;
      }
      return;
    }
    if (type === XmlEventType.CHARACTERS || type === XmlEventType.CDATA) {
      if (runtime.captures.length !== 0) this.processText(runtime, cursor.text()!);
      return;
    }
    if (type === XmlEventType.END_ELEMENT) {
      this.processEnd(runtime);
      runtime.elementStack.pop();
      runtime.depth--;
      popCompletedChildPositionScope(runtime);
    }
  }

  private processSyncIterable(
    runtime: RuntimeState,
    input: Iterable<Uint8Array | readonly Uint8Array[] | AnyXmlEvent>
  ): void {
    const iterator = input[Symbol.iterator]();
    let completed = false;
    try {
      const first = iterator.next();
      if (first.done) {
        completed = true;
        return;
      }
      if (isByteSourceItem(first.value)) {
        const cursor = this.createIncrementalCursor(runtime);
        const decoder = new TextDecoder('utf-8', { fatal: true });
        this.processByteSourceItem(runtime, cursor, decoder, first.value);
        for (let next = iterator.next(); !next.done; next = iterator.next()) {
          if (!isByteSourceItem(next.value)) throw new Error('Byte iterables must contain only Uint8Array values or byte batches.');
          this.processByteSourceItem(runtime, cursor, decoder, next.value);
        }
        this.finishByteInput(runtime, cursor, decoder);
        completed = true;
        return;
      }
      this.processEvent(runtime, first.value as AnyXmlEvent);
      for (let next = iterator.next(); !next.done; next = iterator.next()) {
        this.processEvent(runtime, next.value as AnyXmlEvent);
      }
      completed = true;
    } finally {
      if (!completed) iterator.return?.();
    }
  }

  private async processAsyncIterable(
    runtime: RuntimeState,
    input: AsyncIterable<Uint8Array | readonly Uint8Array[] | AnyXmlEvent>
  ): Promise<void> {
    const iterator = input[Symbol.asyncIterator]();
    let completed = false;
    try {
      const first = await iterator.next();
      if (first.done) {
        completed = true;
        return;
      }
      if (isByteSourceItem(first.value)) {
        const cursor = this.createIncrementalCursor(runtime);
        const decoder = new TextDecoder('utf-8', { fatal: true });
        this.processByteSourceItem(runtime, cursor, decoder, first.value);
        for (let next = await iterator.next(); !next.done; next = await iterator.next()) {
          if (!isByteSourceItem(next.value)) {
            throw new Error('Byte iterables must contain only Uint8Array values or byte batches.');
          }
          this.processByteSourceItem(runtime, cursor, decoder, next.value);
        }
        this.finishByteInput(runtime, cursor, decoder);
      } else {
        this.processEvent(runtime, first.value as AnyXmlEvent);
        for (let next = await iterator.next(); !next.done; next = await iterator.next()) {
          this.processEvent(runtime, next.value as AnyXmlEvent);
        }
      }
      completed = true;
    } finally {
      if (!completed) await iterator.return?.();
    }
  }

  private processByteSourceItem(
    runtime: RuntimeState,
    cursor: TokenCursor,
    decoder: TextDecoder,
    item: Uint8Array | readonly Uint8Array[],
  ): void {
    if (item instanceof Uint8Array) {
      this.processByteChunk(runtime, cursor, decoder, item);
      return;
    }
    for (const bytes of item) this.processByteChunk(runtime, cursor, decoder, bytes);
  }

  private processStart(runtime: RuntimeState): void {
    const root = runtime.plan.root;
    if (!runtime.rootDone && !runtime.rootActive && !root.selector && root.kind !== 'array' && root.kind !== 'object') {
      this.tryStartValue(runtime, root, undefined, { kind: 'root' });
    }

    this.startExecutor(this, runtime);
  }

  /** @internal Called by a schema-generated start executor. */
  executeRootStart(runtime: RuntimeState, plan: DispatchValuePlan): void {
    if (!runtime.rootDone && !runtime.rootActive) this.tryStartValue(runtime, plan, undefined, { kind: 'root' });
  }

  /** @internal Called by a schema-generated executor after its path check. */
  executeMatchedRootStart(runtime: RuntimeState, plan: DispatchValuePlan): void {
    if (runtime.rootDone || runtime.rootActive) return;
    if (plan.kind === 'string' || plan.kind === 'number') {
      runtime.rootActive = true;
      this.startMatchedScalar(runtime, plan, { kind: 'root' });
    } else if (plan.kind === 'object') {
      runtime.rootActive = true;
      this.createObjectState(runtime, plan, runtime.depth, { kind: 'root' });
    }
  }

  /** @internal Called by a schema-generated start executor. */
  executeArrayStart(runtime: RuntimeState, plan: DispatchArrayPlan): void {
    const selector = plan.itemSelector;
    const arrays = selector.mode === 'relative'
      ? runtime.arraysByPlanDepth[plan.id]?.get(runtime.depth - selector.segments.length)
      : runtime.arraysByPlan[plan.id];
    if (!arrays) return;
    for (let index = 0, length = arrays.length; index < length; index++) {
      const array = arrays[index]!;
      if (matchesSelector(plan.itemSelector, runtime, array.contextDepth)) {
        this.startArrayItem(runtime, array);
      }
    }
  }

  /** @internal Called by a schema-generated executor after its path check. */
  executeMatchedArrayStart(runtime: RuntimeState, array: ArrayState): void {
    this.startArrayItem(runtime, array);
  }

  /** @internal Called by a schema-generated start executor. */
  executeFieldStart(runtime: RuntimeState, action: DispatchFieldAction): void {
    const selector = action.field.value.selector!;
    const objects = selector.mode === 'relative'
      ? runtime.objectsByPlanDepth[action.objectPlanId]?.get(runtime.depth - selector.segments.length)
      : runtime.objectsByPlan[action.objectPlanId];
    if (!objects) return;
    for (let index = 0, length = objects.length; index < length; index++) {
      this.processObjectFieldStart(runtime, objects[index]!, action.field);
    }
  }

  /** @internal Called by a schema-generated executor after its path check. */
  executeMatchedFieldStart(
    runtime: RuntimeState,
    object: ObjectState,
    field: DispatchFieldAction
  ): void {
    this.processMatchedObjectFieldStart(runtime, object, field.field);
  }

  private processObjectFieldStart(
    runtime: RuntimeState,
    object: ObjectState,
    field: DispatchFieldPlan
  ): void {
    const value = field.value;
    if (value.kind === 'array' || hasStartedField(object, value.id)) return;

    if (value.kind === 'object') {
      if (value.selector && matchesSelector(value.selector, runtime, object.depth)) {
        this.processMatchedObjectFieldStart(runtime, object, field);
      }
      return;
    }

    if (matchesSelector(value.selector!, runtime, object.depth)) {
      this.processMatchedObjectFieldStart(runtime, object, field);
    }
  }

  private processMatchedObjectFieldStart(
    runtime: RuntimeState,
    object: ObjectState,
    field: DispatchFieldPlan
  ): void {
    const value = field.value;
    if (value.kind === 'array' || hasStartedField(object, value.id)) return;
    if (value.kind === 'object') {
      markObjectFieldActive(object, value.id);
      this.createObjectState(runtime, value, runtime.depth, { kind: 'field', object, field });
      return;
    }
    this.startMatchedScalar(runtime, value, { kind: 'field', object, field });
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
      if (parent.kind === 'root') runtime.rootActive = true;
      else if (parent.kind === 'field') markObjectFieldActive(parent.object, value.id);
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
    if (!selector) {
      if (parent.kind === 'root' && runtime.depth === 1) {
        runtime.rootActive = true;
        runtime.captures.push({ slot: plan.id, plan, depth: 1, buffer: '', textMode: 'subtree', parent });
      }
      return;
    }
    if (!matchesSelector(selector, runtime, contextDepth)) {
      return;
    }

    this.startMatchedScalar(runtime, plan, parent);
  }

  private startMatchedScalar(
    runtime: RuntimeState,
    plan: DispatchScalarPlan,
    parent: ParentBinding
  ): void {
    const selector = plan.selector!;
    if (parent.kind === 'root') runtime.rootActive = true;
    if (selector.terminal === 'attribute') {
      const value = currentAttributeValue(runtime, selector.attributeName!);
      if (value !== undefined) {
        markActive(parent, plan);
        this.assignScalar(runtime, plan, value, parent);
      }
      return;
    }

    markActive(parent, plan);

    runtime.captures.push({
      slot: plan.id,
      plan,
      depth: runtime.depth,
      buffer: '',
      textMode: selector.textMode,
      parent
    });
  }

  private startArrayItem(runtime: RuntimeState, array: ArrayState): void {
    const itemSelector = array.plan.itemSelector;
    const element = array.plan.element;

    if (itemSelector.terminal === 'attribute') {
      const value = currentAttributeValue(runtime, itemSelector.attributeName!);
      if (value !== undefined) {
        array.items.push(parseScalar(element as DispatchScalarPlan, value, true));
      }
      return;
    }

    const index = array.items.length;
    array.items.push(undefined);
    if (element.kind === 'object') {
      this.createObjectState(runtime, element, runtime.depth, { kind: 'array', array, index });
      return;
    }

    runtime.captures.push({
      slot: element.id,
      plan: element as DispatchScalarPlan,
      depth: runtime.depth,
      buffer: '',
      textMode: itemSelector.textMode,
      parent: { kind: 'array', array, index }
    });
  }

  private processText(runtime: RuntimeState, text: string): void {
    this.textExecutor(this, runtime, text);
  }

  /** @internal Called by the IR text executor. */
  executeAppendCaptures(runtime: RuntimeState, text: string): void {
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
    this.endExecutor(this, runtime);
  }

  /** @internal Called by the IR end executor. */
  executeFinishCaptures(runtime: RuntimeState): void {
    const captureEnd = runtime.captures.length;
    if (captureEnd === 1) {
      const capture = runtime.captures[0]!;
      if (capture.depth === runtime.depth) {
        this.assignScalar(runtime, capture.plan, this.captureText(runtime, capture), capture.parent);
        runtime.captures = [];
      }
    } else if (captureEnd > 1) {
      let captureStart = captureEnd;
      while (captureStart > 0 && runtime.captures[captureStart - 1]!.depth === runtime.depth) captureStart--;
      for (let index = captureStart; index < captureEnd; index++) {
        const capture = runtime.captures[index]!;
        this.assignScalar(runtime, capture.plan, this.captureText(runtime, capture), capture.parent);
      }
      if (captureStart === 0) runtime.captures = [];
      else runtime.captures.length = captureStart;
    }

  }

  /** @internal Called by the IR end executor. */
  executeFinalizeValues(runtime: RuntimeState): void {
    while (true) {
      const object = runtime.objects[runtime.objects.length - 1];
      if (!object || object.depth !== runtime.depth) break;
      this.finalizeObject(runtime, object);
    }
  }

  private captureText(runtime: RuntimeState, capture: CaptureState): string {
    return runtime.options?.trimText === false ? capture.buffer : capture.buffer.trim();
  }

  private createObjectState(
    runtime: RuntimeState,
    plan: DispatchObjectPlan,
    depth: number,
    parent: ParentBinding
  ): ObjectState {
    const slot = irSlot(runtime, plan.id);
    const runtimeStart = runtime.objects.length;
    const object: ObjectState = {
      slot: slot.slot,
      plan,
      depth,
      values: compileObjectFactory(plan, false)(),
      completedFieldBits: 0,
      activeFieldBits: 0,
      childObjects: [],
      childArrays: [],
      runtimeStart,
      parent,
      closed: false
    };

    runtime.objects.push(object);
    (runtime.objectsByPlan[object.slot] ??= []).push(object);
    addDepthActive(runtime.objectsByPlanDepth, object.slot, depth, object);

    for (const childSlot of slot.children) {
      const child = irSlot(runtime, childSlot);
      if (!child.fieldName) throw new Error(`Missing converter IR field binding for slot: ${child.slot}`);
      const field: DispatchFieldPlan = { fieldName: child.fieldName, value: child.value };
      const value = child.value;
      if (value.kind === 'array') {
        const array = this.createArrayState(runtime, value, depth, { kind: 'field', object, field });
        object.childArrays.push(array);
        continue;
      }

      if (value.kind === 'object' && !value.selector) {
        const child = this.createObjectState(runtime, value, depth, { kind: 'field', object, field });
        object.childObjects.push(child);
        continue;
      }
    }

    if (runtime.processingStart) {
      for (const action of runtime.plan.ir.onOpen[object.slot] ?? []) {
        this.processObjectFieldStart(runtime, object, action.field);
      }
    }
    return object;
  }

  private createArrayState(
    runtime: RuntimeState,
    plan: DispatchArrayPlan,
    contextDepth: number | undefined,
    parent: ParentBinding
  ): ArrayState {
    const slot = irSlot(runtime, plan.id);
    const array: ArrayState = {
      slot: slot.slot,
      plan,
      contextDepth,
      items: [],
      runtimeStart: runtime.arrays.length,
      parent,
      closed: false
    };
    runtime.arrays.push(array);
    (runtime.arraysByPlan[array.slot] ??= []).push(array);
    addDepthActive(runtime.arraysByPlanDepth, array.slot, contextDepth, array);
    if (runtime.processingStart && !plan.itemSelector.lastElementName
      && matchesSelector(plan.itemSelector, runtime, contextDepth)) {
      this.startArrayItem(runtime, array);
    }
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
      runtime.rootDone = true;
      runtime.rootActive = false;
      return;
    }

    if (parent.kind === 'array') {
      parent.array.items[parent.index] = value;
      return;
    }

    setOwn(parent.object.values, parent.field.fieldName, value);
    markObjectFieldCompleted(parent.object, plan.id);
  }

  private finalizeObject(runtime: RuntimeState, object: ObjectState): unknown {
    if (object.closed) return object.values;
    for (const child of object.childObjects) this.finalizeObject(runtime, child);

    for (const array of object.childArrays) this.finalizeArray(runtime, array);

    for (const field of object.plan.fields) {
      if (!hasCompletedField(object, field.value.id)) {
        setOwn(object.values, field.fieldName, defaultValue(field.value, true, 'field'));
        markObjectFieldCompleted(object, field.value.id);
      }
    }

    let value: unknown = object.values;
    for (const transformFn of object.plan.transforms) {
      value = transformFn(value);
    }

    this.assignValue(runtime, value, object.parent, object.plan);
    object.closed = true;
    removeActive(runtime.objectsByPlan[object.slot]!, object);
    removeDepthActive(runtime.objectsByPlanDepth[object.slot], object.depth, object);
    runtime.objects.length = Math.min(runtime.objects.length, object.runtimeStart);
    return value;
  }

  private finalizeArray(runtime: RuntimeState, array: ArrayState): unknown {
    if (array.closed) return array.items;
    const missingOptional = array.plan.optional && array.items.length === 0;
    let value: unknown = missingOptional && array.parent.kind !== 'root' ? undefined : array.items;
    if (!missingOptional || array.plan.transforms.length > 0) {
      value = applyTransforms(array.plan, value);
    }

    this.assignValue(runtime, value, array.parent, array.plan);
    array.closed = true;
    removeActive(runtime.arraysByPlan[array.slot]!, array);
    removeDepthActive(runtime.arraysByPlanDepth[array.slot], array.contextDepth, array);
    runtime.arrays.length = Math.min(runtime.arrays.length, array.runtimeStart);
    return value;
  }

  private finish<T>(runtime: RuntimeState): T {
    if (runtime.rootObject) {
      this.finalizeObject(runtime, runtime.rootObject);
    }
    if (runtime.rootArray) {
      this.finalizeArray(runtime, runtime.rootArray);
    }
    if (!runtime.rootDone) {
      runtime.rootValue = defaultValue(runtime.plan.root, true, 'root');
      runtime.rootDone = true;
    }
    return runtime.rootValue as T;
  }

  private checkDepthLimit(runtime: RuntimeState): void {
    if (runtime.depth > runtime.maxDepth) {
      throw new Error(`XML depth limit exceeded: ${runtime.maxDepth}`);
    }
  }

  private checkEventLimit(runtime: RuntimeState): void {
    if (runtime.eventCount >= runtime.maxEvents) {
      throw new Error(`XML event limit exceeded: ${runtime.maxEvents}`);
    }
    runtime.eventCount++;
  }

  private async processReadableStream(
    runtime: RuntimeState,
    stream: ReadableStream<Uint8Array>
  ): Promise<void> {
    const cursor = this.createIncrementalCursor(runtime);
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const reader = stream.getReader();
    let completed = false;
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) {
          completed = true;
          break;
        }
        if (!(item.value instanceof Uint8Array)) throw new Error('Reader chunks must be Uint8Array values.');
        this.processByteChunk(runtime, cursor, decoder, item.value);
      }
      this.finishByteInput(runtime, cursor, decoder);
    } finally {
      if (!completed) await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }

}

function compileStartExecutor(program: DispatchIrProgram): StartExecutor {
  try {
    return compileGeneratedStartExecutor(program);
  } catch {
    warnCodeGenerationFallback();
    return compileFallbackStartExecutor(program);
  }
}

function compileTextExecutor(program: DispatchIrProgram): TextExecutor {
  try {
    const statements = program.onText.map(action => {
      if (action.op === 'append-captures') return 'append(processor,runtime,text);';
      return '';
    }).join('');
    const create = Function(
      'append',
      `return function(processor,runtime,text){${statements}}`
    ) as (
      append: (processor: CompiledRootProcessor, runtime: RuntimeState, text: string) => void
    ) => TextExecutor;
    return create((processor, runtime, text) => processor.executeAppendCaptures(runtime, text));
  } catch {
    warnCodeGenerationFallback();
  }
  const actions = program.onText.map(compileTextAction);
  return (processor, runtime, text) => {
    for (const action of actions) action(processor, runtime, text);
  };
}

function compileTextAction(action: DispatchTextAction): TextExecutor {
  return (processor, runtime, text) => {
    if (action.op === 'append-captures') processor.executeAppendCaptures(runtime, text);
  };
}

function compileEndExecutor(program: DispatchIrProgram): EndExecutor {
  try {
    const statements = program.onEnd.map(action => action.op === 'finish-captures'
      ? 'finish(processor,runtime);'
      : 'finalize(processor,runtime);'
    ).join('');
    const create = Function(
      'finish', 'finalize',
      `return function(processor,runtime){${statements}}`
    ) as (
      finish: (processor: CompiledRootProcessor, runtime: RuntimeState) => void,
      finalize: (processor: CompiledRootProcessor, runtime: RuntimeState) => void
    ) => EndExecutor;
    return create(
      (processor, runtime) => processor.executeFinishCaptures(runtime),
      (processor, runtime) => processor.executeFinalizeValues(runtime)
    );
  } catch {
    warnCodeGenerationFallback();
  }
  const actions = program.onEnd.map(compileEndAction);
  return (processor, runtime) => {
    for (const action of actions) action(processor, runtime);
  };
}

function compileEndAction(action: DispatchEndAction): EndExecutor {
  return (processor, runtime) => {
    if (action.op === 'finish-captures') {
      processor.executeFinishCaptures(runtime);
    } else {
      processor.executeFinalizeValues(runtime);
    }
  };
}

function compileGeneratedStartExecutor(program: DispatchIrProgram): StartExecutor {
  const constants: StartConstant[] = [];
  const cases: string[] = [];
  for (const [name, bucket] of Object.entries(program.byElement)) {
    const statements: string[] = [];
    for (const action of bucket.actions) {
      const resolved = resolveStartAction(program, action);
      if (resolved.op === 'start-root') {
        const constant = constants.push(resolved.value) - 1;
        statements.push(
          `if(${emitPathMatch(resolved.selector, '0')})processor.executeMatchedRootStart(runtime,constants[${constant}]);`
        );
      } else if (resolved.op === 'start-array-item') {
        const constant = constants.push(resolved.array) - 1;
        const state = `a${constant}`;
        const arrays = resolved.selector.mode === 'relative'
          ? `runtime.arraysByPlanDepth[constants[${constant}].id]?.get(runtime.depth-${resolved.selector.segments.length})`
          : `runtime.arraysByPlan[constants[${constant}].id]`;
        statements.push(
          `{const ${state}=${arrays};if(${state})for(let i=0;i<${state}.length;i++){` +
          `const value=${state}[i];if(${emitPathMatch(resolved.selector, 'value.contextDepth')})` +
          `processor.executeMatchedArrayStart(runtime,value);}}`
        );
      } else {
        const constant = constants.push(resolved.field) - 1;
        const state = `o${constant}`;
        const objects = resolved.selector.mode === 'relative'
          ? `runtime.objectsByPlanDepth[constants[${constant}].objectPlanId]?.get(runtime.depth-${resolved.selector.segments.length})`
          : `runtime.objectsByPlan[constants[${constant}].objectPlanId]`;
        statements.push(
          `{const ${state}=${objects};if(${state})for(let i=0;i<${state}.length;i++){` +
          `const value=${state}[i];if(${emitPathMatch(resolved.selector, 'value.depth')})` +
          `processor.executeMatchedFieldStart(runtime,value,constants[${constant}]);}}`
        );
      }
    }
    cases.push(`case ${JSON.stringify(name)}:${statements.join('')}return;`);
  }
  const create = Function(
    'constants',
    `return function(processor,runtime){switch(runtime.elementStack[runtime.depth-1]){${cases.join('')}}}`
  ) as (values: StartConstant[]) => StartExecutor;
  return create(constants);
}

function compileFallbackStartExecutor(program: DispatchIrProgram): StartExecutor {
  const handlers: Record<string, StartExecutor> = Object.create(null);
  for (const [name, bucket] of Object.entries(program.byElement)) {
    const actions: StartExecutor[] = [];
    for (const action of bucket.actions) {
      actions.push(compileFallbackStartAction(resolveStartAction(program, action)));
    }
    handlers[name] = chain(actions);
  }
  return (processor, runtime) => {
    handlers[runtime.elementStack[runtime.depth - 1]!]?.(processor, runtime);
  };
}

type ResolvedStartAction =
  | { op: 'start-root'; value: DispatchValuePlan; selector: DispatchSelector }
  | { op: 'start-array-item'; array: DispatchArrayPlan; selector: DispatchSelector }
  | { op: 'start-field'; field: DispatchFieldAction; selector: DispatchSelector };

function resolveStartAction(
  program: DispatchIrProgram,
  action: DispatchStartAction
): ResolvedStartAction {
  const value = (slot: number): DispatchValuePlan => {
    const resolved = program.slotsById[slot]?.value;
    if (!resolved) throw new Error(`Invalid converter IR slot: ${slot}`);
    return resolved;
  };
  const selector = (path: number): DispatchSelector => {
    const resolved = program.paths[path]?.selector;
    if (!resolved) throw new Error(`Invalid converter IR path: ${path}`);
    return resolved;
  };
  if (action.op === 'start-root') {
    return { op: action.op, value: value(action.slot), selector: selector(action.path) };
  }
  if (action.op === 'start-array-item') {
    const array = value(action.slot);
    if (array.kind !== 'array') throw new Error(`Converter IR slot ${action.slot} is not an array`);
    return { op: action.op, array, selector: selector(action.path) };
  }
  const object = value(action.objectSlot);
  if (object.kind !== 'object') throw new Error(`Converter IR slot ${action.objectSlot} is not an object`);
  const field = object.fields.find(candidate => candidate.fieldName === action.fieldName);
  if (!field || field.value.id !== action.slot) {
    throw new Error(`Invalid converter IR field binding: ${action.fieldName}`);
  }
  return { op: action.op, field: { objectPlanId: object.id, field }, selector: selector(action.path) };
}

function emitPathMatch(selector: DispatchSelector, contextDepth: string): string {
  const segments = selector.segments;
  const offset = selector.mode === 'absolute'
    ? '0'
    : selector.mode === 'descendant'
      ? `runtime.depth-${segments.length}`
      : contextDepth;
  const checks: string[] = [selector.mode === 'absolute'
    ? `runtime.depth===${segments.length}`
    : selector.mode === 'descendant'
      ? `runtime.depth>=${segments.length}`
      : `runtime.depth===${contextDepth}+${segments.length}`];
  const compareLength = segments.length - (selector.lastElementName ? 1 : 0);
  for (let index = 0; index < compareLength; index++) {
    checks.push(`runtime.elementStack[${offset}+${index}]===${JSON.stringify(segments[index])}`);
  }
  for (let index = 0; index < (selector.positionFilters?.length ?? 0); index++) {
    const expected = selector.positionFilters![index];
    if (expected !== undefined) checks.push(`runtime.positionStack[${offset}+${index}]===${expected}`);
  }
  return checks.join('&&');
}

function compileFallbackStartAction(action: ResolvedStartAction): StartExecutor {
  if (action.op === 'start-root') {
    return (processor, runtime) => processor.executeRootStart(runtime, action.value);
  }
  if (action.op === 'start-array-item') {
    return (processor, runtime) => processor.executeArrayStart(runtime, action.array);
  }
  return (processor, runtime) => processor.executeFieldStart(runtime, action.field);
}

function chain(actions: StartExecutor[]): StartExecutor {
  let handler: StartExecutor = () => undefined;
  for (let index = actions.length - 1; index >= 0; index--) {
    const action = actions[index]!;
    const next = handler;
    handler = (processor, runtime) => {
      action(processor, runtime);
      next(processor, runtime);
    };
  }
  return handler;
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
  const scopes = runtime.positionScopes;
  if (!scopes) return;
  const parentDepth = runtime.depth - 1;
  const parentScope = scopes[parentDepth] ??= new Map();
  const name = runtime.elementStack[parentDepth]!;
  const position = (parentScope.get(name) ?? 0) + 1;
  parentScope.set(name, position);
  runtime.positionStack[parentDepth] = position;
  scopes[runtime.depth] = new Map();
}

function popCompletedChildPositionScope(runtime: RuntimeState): void {
  if (!runtime.positionScopes) return;
  runtime.positionStack.length = runtime.depth;
  runtime.positionScopes.length = runtime.depth + 1;
}

export function parseScalar(plan: DispatchScalarPlan, rawValue: string, preserveEmptyOptional: boolean): unknown {
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

export function defaultValue(
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
      setOwn(result, field.fieldName, defaultValue(field.value, true, 'field'));
    }
    value = result;
  }
  return applyTransforms(plan, value);
}

export function compileObjectFactory(plan: DispatchObjectPlan, includeDefaults = true): ObjectFactory {
  const cache = includeDefaults ? objectFactoryCache : objectTemplateFactoryCache;
  const cached = cache.get(plan);
  if (cached) return cached;
  try {
    const dynamicPlans: DispatchValuePlan[] = [];
    const properties = plan.fields.map(field => {
      const value = field.value;
      let expression: string;
      if (!value.optional && value.transforms.length === 0 && value.kind === 'string') {
        expression = "''";
      } else if (!value.optional && value.transforms.length === 0 && value.kind === 'number') {
        expression = 'NaN';
      } else if (includeDefaults) {
        expression = `defaultValue(plans[${dynamicPlans.push(value) - 1}],true,'field')`;
      } else {
        expression = 'undefined';
      }
      return `[${JSON.stringify(field.fieldName)}]:${expression}`;
    });
    const create = Function(
      'defaultValue',
      'plans',
      `return function(){return {${properties.join(',')}}}`
    ) as (defaultValueFn: typeof defaultValue, plans: DispatchValuePlan[]) => ObjectFactory;
    const factory = create(defaultValue, dynamicPlans);
    cache.set(plan, factory);
    return factory;
  } catch {
    warnCodeGenerationFallback();
  }
  const fields = plan.fields;
  const factory = (): Record<string, unknown> => {
    const values: Record<string, unknown> = {};
    for (const field of fields) {
      setOwn(values, field.fieldName, includeDefaults ? defaultValue(field.value, true, 'field') : undefined);
    }
    return values;
  };
  cache.set(plan, factory);
  return factory;
}

export function applyTransforms(plan: DispatchValuePlan, value: unknown): unknown {
  let result = value;
  for (const transformFn of plan.transforms) {
    result = transformFn(result);
  }
  return result;
}

function irSlot(runtime: RuntimeState, slot: number) {
  const resolved = runtime.plan.ir.slotsById[slot];
  if (!resolved) throw new Error(`Missing converter IR slot: ${slot}`);
  return resolved;
}

function currentAttributeValue(runtime: RuntimeState, name: string): string | undefined {
  const tokenCursor = runtime.currentTokenCursor;
  if (tokenCursor) {
    const cache = runtime.attributeLookupCache;
    if (cache) return cache[name];
    if (++runtime.attributeLookupCount > 1) {
      const indexed: Record<string, string | undefined> = Object.create(null);
      for (let index = 0; index < tokenCursor.attributeCount(); index++) {
        const attribute = tokenCursor.attribute(index)!;
        indexed[attribute.name] = attribute.value;
      }
      runtime.attributeLookupCache = indexed;
      return indexed[name];
    }
    return tokenCursor.attribute(name)?.value;
  }
  return runtime.currentAttributes?.[name];
}

function setOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  if (key === '__proto__') {
    Object.defineProperty(target, key, { configurable: true, enumerable: true, value, writable: true });
    return;
  }
  target[key] = value;
}

function addDepthActive<T>(
  indexes: Array<Map<number, T[]>>,
  slot: number,
  depth: number | undefined,
  value: T
): void {
  if (depth === undefined) return;
  const byDepth = indexes[slot] ??= new Map();
  (byDepth.get(depth) ?? (byDepth.set(depth, []), byDepth.get(depth)!)).push(value);
}

function removeDepthActive<T>(
  byDepth: Map<number, T[]> | undefined,
  depth: number | undefined,
  value: T
): void {
  if (depth === undefined || !byDepth) return;
  const values = byDepth.get(depth);
  if (!values) return;
  removeActive(values, value);
  if (values.length === 0) byDepth.delete(depth);
}

function removeActive<T>(values: T[], value: T): void {
  const index = values.indexOf(value);
  if (index >= 0) values.splice(index, 1);
}

function markActive(parent: ParentBinding, plan: DispatchValuePlan): void {
  if (parent.kind === 'root') return;
  if (parent.kind === 'field') markObjectFieldActive(parent.object, plan.id);
}

function hasCompletedField(object: ObjectState, id: number): boolean {
  if (id < 31) {
    return (object.completedFieldBits & (1 << id)) !== 0;
  }
  return object.completedFields?.has(id) ?? false;
}

function hasStartedField(object: ObjectState, id: number): boolean {
  if (hasCompletedField(object, id)) return true;
  if (id < 31) return (object.activeFieldBits & (1 << id)) !== 0;
  return object.activeFields?.has(id) ?? false;
}

function markObjectFieldActive(object: ObjectState, id: number): void {
  if (id < 31) {
    object.activeFieldBits |= 1 << id;
    return;
  }
  (object.activeFields ??= new Set()).add(id);
}

function markObjectFieldCompleted(object: ObjectState, id: number): void {
  if (id < 31) {
    object.completedFieldBits |= 1 << id;
    object.activeFieldBits &= ~(1 << id);
    return;
  }
  let completedFields = object.completedFields;
  if (!completedFields) {
    completedFields = new Set();
    object.completedFields = completedFields;
  }
  completedFields.add(id);
  object.activeFields?.delete(id);
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

function isSyncIterable(
  input: ParseInput
): input is Iterable<Uint8Array> | Iterable<readonly Uint8Array[]> | Iterable<AnyXmlEvent> {
  return typeof input === 'object'
    && input !== null
    && !(input instanceof Uint8Array)
    && !(input instanceof ReadableStream)
    && Symbol.iterator in input
    && typeof (input as Iterable<AnyXmlEvent>)[Symbol.iterator] === 'function';
}

function isByteSourceItem(value: unknown): value is Uint8Array | readonly Uint8Array[] {
  return value instanceof Uint8Array || isByteBatch(value);
}

function isByteBatch(value: unknown): value is readonly Uint8Array[] {
  return Array.isArray(value) && value.every(entry => entry instanceof Uint8Array);
}

function isAsyncIterable(input: ParseInput): boolean {
  return typeof input === 'object'
    && input !== null
    && Symbol.asyncIterator in input
    && typeof (input as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function';
}
