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
  DispatchFieldPlan,
  DispatchObjectPlan,
  DispatchScalarPlan,
  DispatchSelector,
  DispatchValuePlan
} from './compiled-plan.js';
import type { ParseInput } from './XmlSchema.js';
import type { ParseOptions } from './types.js';

const DECODE_CHUNK_BYTES = 64 * 1024;

type ParentBinding =
  | { kind: 'root' }
  | { kind: 'field'; object: ObjectState; field: DispatchFieldPlan }
  | { kind: 'array'; array: ArrayState };

type ObjectState = {
  plan: DispatchObjectPlan;
  depth: number;
  active?: boolean;
  values: Record<string, unknown>;
  completedFieldBits: number;
  completedFields?: Set<number>;
  childObjects: ObjectState[];
  childArrays: ArrayState[];
  runtimeStart: number;
  parent: ParentBinding;
};

type ArrayState = {
  plan: DispatchArrayPlan;
  contextDepth?: number;
  items: unknown[];
  runtimeStart: number;
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
  rootDone: boolean;
  rootObject?: ObjectState;
  rootArray?: ArrayState;
  objects: ObjectState[];
  objectsByDepth?: ObjectState[][];
  arrays: ArrayState[];
  captures: CaptureState[];
  currentAttributes?: Record<string, string>;
  currentTokenCursor?: TokenCursor;
};

type RelativeObjectFieldIndex = WeakMap<
  DispatchObjectPlan,
  Map<number, Map<string, DispatchFieldPlan[]>>
>;
type RelativeObjectDispatch = { fields: RelativeObjectFieldIndex; offsets: number[] };
const relativeObjectDispatchCache = new WeakMap<DispatchValuePlan, RelativeObjectDispatch | null>();

export class CompiledRootProcessor {
  private readonly relativeObjectFields?: RelativeObjectFieldIndex;
  private readonly relativeObjectOffsets?: number[];

  constructor(
    private readonly plan: DispatchCompiledPlan,
    private readonly options?: ParseOptions
  ) {
    let dispatch = relativeObjectDispatchCache.get(plan.root);
    if (dispatch === undefined) {
      dispatch = buildRelativeObjectFieldIndex(plan.root) ?? null;
      relativeObjectDispatchCache.set(plan.root, dispatch);
    }
    if (dispatch) {
      this.relativeObjectFields = dispatch.fields;
      this.relativeObjectOffsets = dispatch.offsets;
    }
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
      rootValue: isUnselectedRootScalar(plan.root) ? undefined : defaultValue(plan.root, true, 'root'),
      rootDone: false,
      objects: [],
      objectsByDepth: this.relativeObjectFields ? [] : undefined,
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

    if (isStartElement(event)) {
      runtime.depth++;
      runtime.elementStack.push(event.name);
      recordElementPosition(runtime);
      runtime.currentAttributes = runtime.plan.eventFilter.includeAttributes
        ? Object.fromEntries(event.attributes.map((attribute) => [attribute.name, attribute.value]))
        : undefined;
      this.checkDepthLimit(runtime);
      this.processStart(runtime);
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

  private processString(runtime: RuntimeState, input: string): void {
    const cursor = new TokenCursor(input, true, {
      documentMode: runtime.options?.documentMode ?? 'document',
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
      documentMode: runtime.options?.documentMode ?? 'document',
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
      try {
        this.checkDepthLimit(runtime);
        this.processStart(runtime);
      } finally {
        runtime.currentTokenCursor = undefined;
      }
      return;
    }
    if (type === XmlEventType.CHARACTERS || type === XmlEventType.CDATA) {
      if (runtime.captures.length !== 0) this.processText(runtime, cursor.text()!);
      return;
    }
    if (type === XmlEventType.END_ELEMENT) {
      popCompletedChildPositionScope(runtime);
      this.processEnd(runtime);
      runtime.elementStack.pop();
      runtime.depth--;
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
    if (!runtime.rootDone && root.kind !== 'array' && !(root.kind === 'object' && !root.selector)) {
      this.tryStartValue(runtime, root, undefined, { kind: 'root' });
    }

    for (let index = 0; index < runtime.arrays.length; index++) {
      const array = runtime.arrays[index];
      if (!matchesSelector(array.plan.itemSelector, runtime, array.contextDepth)) {
        continue;
      }
      this.startArrayItem(runtime, array);
    }

    if (this.relativeObjectFields) {
      this.processIndexedObjectStarts(runtime);
    } else {
      for (let index = 0; index < runtime.objects.length; index++) {
        this.processObjectStart(runtime, runtime.objects[index]);
      }
    }
  }

  private processIndexedObjectStarts(runtime: RuntimeState): void {
    const elementName = runtime.elementStack[runtime.depth - 1]!;
    for (const offset of this.relativeObjectOffsets!) {
      const contextDepth = runtime.depth - offset;
      if (contextDepth < 0) continue;
      const objects = runtime.objectsByDepth![contextDepth];
      if (!objects) continue;

      for (let index = 0; index < objects.length; index++) {
        const object = objects[index]!;
        const fields = this.relativeObjectFields!
          .get(object.plan)
          ?.get(offset)
          ?.get(elementName);
        if (!fields) continue;
        for (const field of fields) this.processObjectFieldStart(runtime, object, field);
      }
    }
  }

  private processObjectStart(runtime: RuntimeState, object: ObjectState): void {
    for (const field of object.plan.fields) {
      this.processObjectFieldStart(runtime, object, field);
    }
  }

  private processObjectFieldStart(
    runtime: RuntimeState,
    object: ObjectState,
    field: DispatchFieldPlan
  ): void {
    const value = field.value;
    if (value.kind === 'array' || hasCompletedField(object, value.id)) return;

    if (value.kind === 'object') {
      if (value.selector && matchesSelector(value.selector, runtime, object.depth)) {
        this.createObjectState(runtime, value, runtime.depth, { kind: 'field', object, field });
      }
      return;
    }

    this.tryStartScalar(runtime, value, object.depth, { kind: 'field', object, field });
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
    if (!selector) {
      if (parent.kind === 'root' && runtime.depth === 1) {
        runtime.captures.push({ plan, depth: 1, buffer: '', textMode: 'subtree', parent });
      }
      return;
    }
    if (!matchesSelector(selector, runtime, contextDepth)) {
      return;
    }

    if (selector.terminal === 'attribute') {
      const value = currentAttributeValue(runtime, selector.attributeName!);
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
    const runtimeStart = runtime.objects.length;
    const object: ObjectState = {
      plan,
      depth,
      values: {},
      completedFieldBits: 0,
      childObjects: [],
      childArrays: [],
      runtimeStart,
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

    if (runtime.objectsByDepth) {
      object.active = true;
      (runtime.objectsByDepth[depth] ??= []).push(object);
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
      runtimeStart: runtime.arrays.length,
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
      runtime.rootDone = true;
      return;
    }

    if (parent.kind === 'array') {
      parent.array.items.push(value);
      return;
    }

    parent.object.values[parent.field.fieldName] = value;
    markObjectFieldCompleted(parent.object, plan.id);
  }

  private finalizeObject(runtime: RuntimeState, object: ObjectState, compactDepth = true): unknown {
    for (const child of object.childObjects) this.finalizeObject(runtime, child, false);

    for (const array of object.childArrays) this.finalizeArray(runtime, array);

    let value: unknown = object.values;
    for (const transformFn of object.plan.transforms) {
      value = transformFn(value);
    }

    this.assignValue(runtime, value, object.parent, object.plan);
    if (runtime.objectsByDepth) object.active = false;
    runtime.objects.length = Math.min(runtime.objects.length, object.runtimeStart);
    if (compactDepth && runtime.objectsByDepth) compactObjectDepth(runtime.objectsByDepth[object.depth]);
    return value;
  }

  private finalizeArray(runtime: RuntimeState, array: ArrayState): unknown {
    const missingOptional = array.plan.optional && array.items.length === 0;
    let value: unknown = missingOptional && array.parent.kind !== 'root' ? undefined : array.items;
    if (!missingOptional || array.plan.transforms.length > 0) {
      value = applyTransforms(array.plan, value);
    }

    this.assignValue(runtime, value, array.parent, array.plan);
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

function buildRelativeObjectFieldIndex(
  root: DispatchValuePlan
): RelativeObjectDispatch | undefined {
  const fields: RelativeObjectFieldIndex = new WeakMap();
  const offsets = new Set<number>();
  const visited = new Set<DispatchValuePlan>();
  let fieldCount = 0;

  const visit = (value: DispatchValuePlan): boolean => {
    if (visited.has(value)) return true;
    visited.add(value);

    if (value.kind === 'array') return visit(value.element);
    if (value.kind !== 'object') return true;

    const byOffset = new Map<number, Map<string, DispatchFieldPlan[]>>();
    fields.set(value, byOffset);
    for (const field of value.fields) {
      const child = field.value;
      if (child.kind === 'array') {
        if (!visit(child.element)) return false;
        continue;
      }
      if (child.kind === 'object' && !child.selector) {
        if (!visit(child)) return false;
        continue;
      }

      const selector = child.selector;
      if (selector?.mode !== 'relative' || !selector.lastElementName) return false;
      const offset = selector.segments.length;
      let byName = byOffset.get(offset);
      if (!byName) {
        byName = new Map();
        byOffset.set(offset, byName);
      }
      let matchingFields = byName.get(selector.lastElementName);
      if (!matchingFields) {
        matchingFields = [];
        byName.set(selector.lastElementName, matchingFields);
      }
      matchingFields.push(field);
      offsets.add(offset);
      fieldCount++;

      if (!visit(child)) return false;
    }
    return true;
  };

  if (!visit(root) || fieldCount < 16) return undefined;
  return { fields, offsets: [...offsets].sort((left, right) => right - left) };
}

function compactObjectDepth(objects: ObjectState[] | undefined): void {
  if (!objects) return;
  let write = 0;
  for (const object of objects) {
    if (object.active) objects[write++] = object;
  }
  objects.length = write;
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

function isUnselectedRootScalar(plan: DispatchValuePlan): boolean {
  return (plan.kind === 'string' || plan.kind === 'number') && !plan.selector;
}

function currentAttributeValue(runtime: RuntimeState, name: string): string | undefined {
  const tokenCursor = runtime.currentTokenCursor;
  if (tokenCursor) return tokenCursor.attribute(name)?.value;
  return runtime.currentAttributes?.[name];
}

function markCompleted(parent: ParentBinding, plan: DispatchScalarPlan): void {
  if (parent.kind === 'field') {
    markObjectFieldCompleted(parent.object, plan.id);
  }
}

function hasCompletedField(object: ObjectState, id: number): boolean {
  if (id < 31) {
    return (object.completedFieldBits & (1 << id)) !== 0;
  }
  return object.completedFields?.has(id) ?? false;
}

function markObjectFieldCompleted(object: ObjectState, id: number): void {
  if (id < 31) {
    object.completedFieldBits |= 1 << id;
    return;
  }
  let completedFields = object.completedFields;
  if (!completedFields) {
    completedFields = new Set();
    object.completedFields = completedFields;
  }
  completedFields.add(id);
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
