import { StreamEventType, StreamReaderSync } from '../StreamReaderSync.js';
import type {
  StreamReaderSyncByteBatch,
  StreamReaderSyncOptions,
  StreamReaderSyncRawBatch,
} from '../StreamReaderSync.js';

type FrameBatch = Extract<StreamReaderSyncRawBatch, { kind: 'frame' }>;

/**
 * Input accepted by the synchronous projection engine.
 *
 * @public
 */
export type ProjectionInput =
  | string
  | Uint8Array
  | Iterable<StreamReaderSyncByteBatch>;

/**
 * Attribute or child-text field captured into a projected record.
 *
 * @public
 */
export interface ProjectionField<TValue = string> {
  readonly kind: 'attr' | 'childText';
  readonly name: string;
  readonly required: boolean;
  optional(): ProjectionField<TValue | undefined>;
}

/**
 * Attribute equality predicate for a record selector.
 *
 * @public
 */
export interface ProjectionPredicate {
  readonly kind: 'attrEquals';
  readonly name: string;
  readonly value: string;
}

/**
 * Options for a repeated record selector.
 *
 * @public
 */
export interface ManyProjectionOptions {
  /**
   * Initial fast lane is namespace-unaware and compares raw element names.
   *
   * @defaultValue false
   */
  namespaceAware?: false;
  where?: ProjectionPredicate | readonly ProjectionPredicate[];
}

/**
 * Repeated record selector.
 *
 * @public
 */
export interface ManyProjection<TRecord extends Record<string, unknown>> {
  readonly kind: 'many';
  readonly path: string;
  readonly fields: ProjectionFields;
  readonly options: ManyProjectionOptions;
  readonly __record?: TRecord;
}

/**
 * Compiled projection plan consumed by {@link projectXmlSync}.
 *
 * @public
 */
export interface CompiledProjection<TRecord extends Record<string, unknown>> {
  readonly kind: 'compiled-projection';
  readonly __record?: TRecord;
}

/**
 * Sink options for {@link projectXmlSync}.
 *
 * @public
 */
export interface ProjectXmlSyncOptions<TRecord> extends StreamReaderSyncOptions {
  onRecord?: (record: TRecord) => void;
}

type ProjectionFields = Record<string, ProjectionField<unknown>>;
type ProjectionDefinition = Record<string, ManyProjection<Record<string, unknown>>>;
type FieldValue<TField> = TField extends ProjectionField<infer TValue> ? TValue : never;
type ProjectedRecord<TFields extends ProjectionFields> = {
  [K in keyof TFields]: FieldValue<TFields[K]>;
};
type ProjectionRecord<TDefinition extends ProjectionDefinition> =
  TDefinition[keyof TDefinition] extends ManyProjection<infer TRecord> ? TRecord : never;

interface CompiledRecordSelector {
  readonly outputKey: string;
  readonly bit: number;
  readonly path: readonly Uint8Array[];
  readonly fields: readonly CompiledField[];
  readonly attrFields: readonly CompiledField[];
  readonly childTextFields: readonly CompiledField[];
  readonly predicates: readonly CompiledPredicate[];
}

interface InternalCompiledProjection<TRecord extends Record<string, unknown>> extends CompiledProjection<TRecord> {
  readonly selectors: readonly CompiledRecordSelector[];
}

interface RuntimeRecordSelector {
  readonly selector: CompiledRecordSelector;
  readonly bit: number;
  readonly pathNameIds: Int32Array;
  readonly fields: readonly RuntimeField[];
  readonly attrFields: readonly RuntimeField[];
  readonly childTextFields: readonly RuntimeField[];
  readonly predicates: readonly RuntimePredicate[];
}

interface RuntimeField {
  readonly field: CompiledField;
  nameId: number;
}

interface RuntimePredicate {
  readonly predicate: CompiledPredicate;
  nameId: number;
}

interface CompiledField {
  readonly outputKey: string;
  readonly kind: 'attr' | 'childText';
  readonly name: string;
  readonly nameBytes: Uint8Array;
  readonly required: boolean;
}

interface CompiledPredicate {
  readonly kind: 'attrEquals';
  readonly nameBytes: Uint8Array;
  readonly valueBytes: Uint8Array;
}

interface ActiveRecord {
  readonly selector: RuntimeRecordSelector;
  readonly record: Record<string, string | undefined>;
  readonly recordDepth: number;
  captureDepth: number;
  captureFields: readonly RuntimeField[] | undefined;
}

let textEncoder: TextEncoder | undefined;

function encodeUtf8(input: string): Uint8Array {
  textEncoder ??= new TextEncoder();
  return textEncoder.encode(input);
}

/**
 * Capture an attribute value from a matching record element.
 *
 * @public
 */
export function attr(name: string): ProjectionField<string> {
  return createField('attr', name, true);
}

/**
 * Capture direct child text from a matching record element.
 *
 * @public
 */
export function childText(name: string): ProjectionField<string> {
  return createField('childText', name, true);
}

/**
 * Match records whose start element has the requested attribute value.
 *
 * @public
 */
export function attrEquals(name: string, value: string): ProjectionPredicate {
  assertName(name, 'attribute predicate name');
  return {
    kind: 'attrEquals',
    name,
    value,
  };
}

/**
 * Select repeated records at an absolute child path.
 *
 * @public
 */
export function many<const TFields extends ProjectionFields>(
  path: string,
  fields: TFields,
  options: ManyProjectionOptions = {},
): ManyProjection<ProjectedRecord<TFields>> {
  if (options.namespaceAware !== undefined && options.namespaceAware !== false) {
    throw new Error('stax-xml/projection currently supports namespaceAware: false only.');
  }
  return {
    kind: 'many',
    path,
    fields,
    options,
  };
}

/**
 * Compile a projection definition into a reusable streaming plan.
 *
 * @public
 */
export function compileProjection<const TDefinition extends ProjectionDefinition>(
  definition: TDefinition,
): CompiledProjection<ProjectionRecord<TDefinition>> {
  const entries = Object.entries(definition);
  if (entries.length === 0) {
    throw new Error('compileProjection requires at least one many() selector.');
  }
  if (entries.length > 30) {
    throw new Error('compileProjection currently supports up to 30 many() selectors.');
  }

  return {
    kind: 'compiled-projection',
    selectors: entries.map(([outputKey, selector], index) => compileSelector(outputKey, selector, index)),
  } satisfies InternalCompiledProjection<ProjectionRecord<TDefinition>>;
}

export function projectXmlSync<TRecord extends Record<string, unknown>>(
  input: ProjectionInput,
  projection: CompiledProjection<TRecord>,
  options: ProjectXmlSyncOptions<TRecord> & { onRecord: (record: TRecord) => void },
): undefined;
export function projectXmlSync<TRecord extends Record<string, unknown>>(
  input: ProjectionInput,
  projection: CompiledProjection<TRecord>,
  options?: ProjectXmlSyncOptions<TRecord>,
): IterableIterator<TRecord>;
/**
 * Project repeated records from XML without exposing per-event SAX objects.
 *
 * @public
 */
export function projectXmlSync<TRecord extends Record<string, unknown>>(
  input: ProjectionInput,
  projection: CompiledProjection<TRecord>,
  options: ProjectXmlSyncOptions<TRecord> = {},
): IterableIterator<TRecord> | undefined {
  assertUtf8Encoding(options.encoding);
  if (options.onRecord) {
    scanProjectionSyncToSink(input, projection, options, options.onRecord);
    return undefined;
  }
  return scanProjectionSync(input, projection, options);
}

function createField(kind: 'attr' | 'childText', name: string, required: boolean): ProjectionField<string> {
  assertName(name, `${kind} field name`);
  return {
    kind,
    name,
    required,
    optional() {
      return createField(kind, name, false);
    },
  };
}

function compileSelector(
  outputKey: string,
  selector: ManyProjection<Record<string, unknown>>,
  index: number,
): CompiledRecordSelector {
  if (selector.kind !== 'many') {
    throw new Error(`Projection entry "${outputKey}" must be created by many().`);
  }

  const fields = Object.entries(selector.fields).map(([fieldKey, field]) => compileField(fieldKey, field));
  if (fields.length === 0) {
    throw new Error(`Projection entry "${outputKey}" must capture at least one field.`);
  }

  return {
    outputKey,
    bit: 1 << index,
    path: compilePath(selector.path),
    fields,
    attrFields: fields.filter((field) => field.kind === 'attr'),
    childTextFields: fields.filter((field) => field.kind === 'childText'),
    predicates: normalizePredicates(selector.options.where).map(compilePredicate),
  };
}

function compileField(outputKey: string, field: ProjectionField<unknown>): CompiledField {
  if (field.kind !== 'attr' && field.kind !== 'childText') {
    throw new Error(`Unsupported projection field for "${outputKey}".`);
  }
  return {
    outputKey,
    kind: field.kind,
    name: field.name,
    nameBytes: encodeUtf8(field.name),
    required: field.required,
  };
}

function compilePredicate(predicate: ProjectionPredicate): CompiledPredicate {
  return {
    kind: predicate.kind,
    nameBytes: encodeUtf8(predicate.name),
    valueBytes: encodeUtf8(predicate.value),
  };
}

function normalizePredicates(
  predicates: ProjectionPredicate | readonly ProjectionPredicate[] | undefined,
): readonly ProjectionPredicate[] {
  if (predicates === undefined) {
    return [];
  }
  return Array.isArray(predicates) ? predicates : [predicates];
}

function compilePath(path: string): readonly Uint8Array[] {
  if (!path.startsWith('/')) {
    throw new Error(`Projection path must be absolute: ${path}`);
  }
  if (path.includes('//')) {
    throw new Error(`Projection path cannot use descendant selectors: ${path}`);
  }
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) {
    throw new Error('Projection path must select an element below the document root.');
  }
  for (const segment of segments) {
    assertName(segment, 'path segment');
  }
  return segments.map((segment) => encodeUtf8(segment));
}

function* scanProjectionSync<TRecord extends Record<string, unknown>>(
  input: ProjectionInput,
  projection: CompiledProjection<TRecord>,
  options: StreamReaderSyncOptions,
): IterableIterator<TRecord> {
  const reader = new StreamReaderSync(normalizeInput(input), options);
  const decoder = new TextDecoder(options.encoding ?? 'utf-8', {
    fatal: options.documentMode === 'document',
    ignoreBOM: true,
  });
  const selectors = asInternalProjection(projection).selectors.map(createRuntimeSelector);
  if (selectors.length === 1) {
    yield* scanSingleSelectorSync<TRecord>(reader, decoder, selectors[0]!);
    return;
  }
  const allSelectorMask = selectors.reduce((mask, selector) => mask | selector.bit, 0);
  const prefixMasks: number[] = [];
  const activeRecords: ActiveRecord[] = [];
  let depth = 0;

  while (true) {
    const raw = reader.nextRawBatch();
    if (raw === null) {
      return;
    }
    if (raw.kind !== 'frame') {
      throw new Error(`Unsupported raw stream batch kind: ${raw.kind}`);
    }

    const frame = raw;
    for (let eventIndex = 0; eventIndex < frame.eventCount; eventIndex++) {
      const type = frame.eventTypes[eventIndex];
      if (type === StreamEventType.START_ELEMENT) {
        depth = handleStartElement(frame, eventIndex, depth, selectors, allSelectorMask, prefixMasks, activeRecords, decoder);
        continue;
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        captureText(frame, eventIndex, depth, activeRecords, decoder);
        continue;
      }
      if (type === StreamEventType.END_ELEMENT) {
        yield* handleEndElement<TRecord>(depth, activeRecords);
        prefixMasks[depth] = 0;
        depth--;
      }
    }
  }
}

function scanProjectionSyncToSink<TRecord extends Record<string, unknown>>(
  input: ProjectionInput,
  projection: CompiledProjection<TRecord>,
  options: StreamReaderSyncOptions,
  onRecord: (record: TRecord) => void,
): void {
  const reader = new StreamReaderSync(normalizeInput(input), options);
  const decoder = new TextDecoder(options.encoding ?? 'utf-8', {
    fatal: options.documentMode === 'document',
    ignoreBOM: true,
  });
  const selectors = asInternalProjection(projection).selectors.map(createRuntimeSelector);
  if (selectors.length === 1) {
    scanSingleSelectorSyncToSink(reader, decoder, selectors[0]!, onRecord);
    return;
  }

  const allSelectorMask = selectors.reduce((mask, selector) => mask | selector.bit, 0);
  const prefixMasks: number[] = [];
  const activeRecords: ActiveRecord[] = [];
  let depth = 0;

  while (true) {
    const raw = reader.nextRawBatch();
    if (raw === null) {
      return;
    }
    if (raw.kind !== 'frame') {
      throw new Error(`Unsupported raw stream batch kind: ${raw.kind}`);
    }

    const frame = raw;
    for (let eventIndex = 0; eventIndex < frame.eventCount; eventIndex++) {
      const type = frame.eventTypes[eventIndex];
      if (type === StreamEventType.START_ELEMENT) {
        depth = handleStartElement(frame, eventIndex, depth, selectors, allSelectorMask, prefixMasks, activeRecords, decoder);
        continue;
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        captureText(frame, eventIndex, depth, activeRecords, decoder);
        continue;
      }
      if (type === StreamEventType.END_ELEMENT) {
        emitEndedRecords(depth, activeRecords, onRecord);
        prefixMasks[depth] = 0;
        depth--;
      }
    }
  }
}

function* scanSingleSelectorSync<TRecord extends Record<string, unknown>>(
  reader: StreamReaderSync,
  decoder: TextDecoder,
  selector: RuntimeRecordSelector,
): IterableIterator<TRecord> {
  const prefixMatched: boolean[] = [];
  const activeRecords: ActiveRecord[] = [];
  let depth = 0;

  while (true) {
    const raw = reader.nextRawBatch();
    if (raw === null) {
      return;
    }
    if (raw.kind !== 'frame') {
      throw new Error(`Unsupported raw stream batch kind: ${raw.kind}`);
    }

    const frame = raw;
    for (let eventIndex = 0; eventIndex < frame.eventCount; eventIndex++) {
      const type = frame.eventTypes[eventIndex];
      if (type === StreamEventType.START_ELEMENT) {
        depth = handleSingleStartElement(frame, eventIndex, depth, selector, prefixMatched, activeRecords, decoder);
        continue;
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        captureText(frame, eventIndex, depth, activeRecords, decoder);
        continue;
      }
      if (type === StreamEventType.END_ELEMENT) {
        yield* handleEndElement<TRecord>(depth, activeRecords);
        prefixMatched[depth] = false;
        depth--;
      }
    }
  }
}

function scanSingleSelectorSyncToSink<TRecord extends Record<string, unknown>>(
  reader: StreamReaderSync,
  decoder: TextDecoder,
  selector: RuntimeRecordSelector,
  onRecord: (record: TRecord) => void,
): void {
  const prefixMatched: boolean[] = [];
  const activeRecords: ActiveRecord[] = [];
  let depth = 0;

  while (true) {
    const raw = reader.nextRawBatch();
    if (raw === null) {
      return;
    }
    if (raw.kind !== 'frame') {
      throw new Error(`Unsupported raw stream batch kind: ${raw.kind}`);
    }

    const frame = raw;
    for (let eventIndex = 0; eventIndex < frame.eventCount; eventIndex++) {
      const type = frame.eventTypes[eventIndex];
      if (type === StreamEventType.START_ELEMENT) {
        depth = handleSingleStartElement(frame, eventIndex, depth, selector, prefixMatched, activeRecords, decoder);
        continue;
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        captureText(frame, eventIndex, depth, activeRecords, decoder);
        continue;
      }
      if (type === StreamEventType.END_ELEMENT) {
        emitEndedRecords(depth, activeRecords, onRecord);
        prefixMatched[depth] = false;
        depth--;
      }
    }
  }
}

function handleSingleStartElement(
  frame: FrameBatch,
  eventIndex: number,
  currentDepth: number,
  selector: RuntimeRecordSelector,
  prefixMatched: boolean[],
  activeRecords: ActiveRecord[],
  decoder: TextDecoder,
): number {
  const nextDepth = currentDepth + 1;
  const parentMatched = currentDepth === 0 || prefixMatched[currentDepth] === true;
  const isPathPrefix = parentMatched
    && selector.selector.path.length >= nextDepth
    && eventNameMatches(
      selector.pathNameIds,
      nextDepth - 1,
      frame,
      eventIndex,
      selector.selector.path[nextDepth - 1]!,
    );

  prefixMatched[nextDepth] = isPathPrefix;
  if (isPathPrefix && selector.selector.path.length === nextDepth && predicatesMatch(frame, eventIndex, selector)) {
    activeRecords.push(startRecord(frame, eventIndex, nextDepth, selector, decoder));
  }

  beginChildTextCaptures(frame, eventIndex, nextDepth, activeRecords);
  return nextDepth;
}

function asInternalProjection<TRecord extends Record<string, unknown>>(
  projection: CompiledProjection<TRecord>,
): InternalCompiledProjection<TRecord> {
  return projection as InternalCompiledProjection<TRecord>;
}

function handleStartElement(
  frame: FrameBatch,
  eventIndex: number,
  currentDepth: number,
  selectors: readonly RuntimeRecordSelector[],
  allSelectorMask: number,
  prefixMasks: number[],
  activeRecords: ActiveRecord[],
  decoder: TextDecoder,
): number {
  const nextDepth = currentDepth + 1;
  const parentMask = currentDepth === 0 ? allSelectorMask : (prefixMasks[currentDepth] ?? 0);
  let prefixMask = 0;

  for (const selector of selectors) {
    if ((parentMask & selector.bit) === 0 || selector.selector.path.length < nextDepth) {
      continue;
    }
    const expectedName = selector.selector.path[nextDepth - 1]!;
    if (eventNameMatches(selector.pathNameIds, nextDepth - 1, frame, eventIndex, expectedName)) {
      prefixMask |= selector.bit;
    }
  }

  prefixMasks[nextDepth] = prefixMask;

  for (const selector of selectors) {
    if ((prefixMask & selector.bit) !== 0 && selector.selector.path.length === nextDepth && predicatesMatch(frame, eventIndex, selector)) {
      activeRecords.push(startRecord(frame, eventIndex, nextDepth, selector, decoder));
    }
  }

  beginChildTextCaptures(frame, eventIndex, nextDepth, activeRecords);
  return nextDepth;
}

function startRecord(
  frame: FrameBatch,
  eventIndex: number,
  recordDepth: number,
  selector: RuntimeRecordSelector,
  decoder: TextDecoder,
): ActiveRecord {
  const record: Record<string, string | undefined> = {};
  for (const field of selector.fields) {
    record[field.field.outputKey] = undefined;
  }

  for (const field of selector.attrFields) {
    const attrIndex = findAttribute(frame, eventIndex, field);
    if (attrIndex >= 0) {
      record[field.field.outputKey] = decodeAttributeValue(frame, attrIndex, decoder);
    }
  }

  return {
    selector,
    record,
    recordDepth,
    captureDepth: 0,
    captureFields: undefined,
  };
}

function beginChildTextCaptures(
  frame: FrameBatch,
  eventIndex: number,
  depth: number,
  activeRecords: readonly ActiveRecord[],
): void {
  for (const active of activeRecords) {
    if (depth !== active.recordDepth + 1) {
      continue;
    }

    const fields: RuntimeField[] = [];
    for (const field of active.selector.childTextFields) {
      if (fieldNameMatches(field, frame, eventIndex)) {
        fields.push(field);
      }
    }
    if (fields.length > 0) {
      active.captureDepth = depth;
      active.captureFields = fields;
    }
  }
}

function captureText(
  frame: FrameBatch,
  eventIndex: number,
  depth: number,
  activeRecords: readonly ActiveRecord[],
  decoder: TextDecoder,
): void {
  let text: string | undefined;
  for (const active of activeRecords) {
    if (active.captureDepth !== depth || active.captureFields === undefined) {
      continue;
    }

    text ??= decoder.decode(frame.buffer.subarray(frame.textStarts[eventIndex]!, frame.textEnds[eventIndex]!));
    for (const field of active.captureFields) {
      active.record[field.field.outputKey] = (active.record[field.field.outputKey] ?? '') + text;
    }
  }
}

function* handleEndElement<TRecord extends Record<string, unknown>>(
  depth: number,
  activeRecords: ActiveRecord[],
): IterableIterator<TRecord> {
  for (const active of activeRecords) {
    if (active.captureDepth === depth) {
      active.captureDepth = 0;
      active.captureFields = undefined;
    }
  }

  for (let index = activeRecords.length - 1; index >= 0; index--) {
    const active = activeRecords[index]!;
    if (active.recordDepth !== depth) {
      continue;
    }
    activeRecords.splice(index, 1);
    if (recordHasRequiredFields(active)) {
      yield active.record as TRecord;
    }
  }
}

function emitEndedRecords<TRecord extends Record<string, unknown>>(
  depth: number,
  activeRecords: ActiveRecord[],
  onRecord: (record: TRecord) => void,
): void {
  for (const active of activeRecords) {
    if (active.captureDepth === depth) {
      active.captureDepth = 0;
      active.captureFields = undefined;
    }
  }

  for (let index = activeRecords.length - 1; index >= 0; index--) {
    const active = activeRecords[index]!;
    if (active.recordDepth !== depth) {
      continue;
    }
    activeRecords.splice(index, 1);
    if (recordHasRequiredFields(active)) {
      onRecord(active.record as TRecord);
    }
  }
}

function recordHasRequiredFields(active: ActiveRecord): boolean {
  for (const field of active.selector.fields) {
    if (field.field.required && active.record[field.field.outputKey] === undefined) {
      return false;
    }
  }
  return true;
}

function predicatesMatch(
  frame: FrameBatch,
  eventIndex: number,
  selector: RuntimeRecordSelector,
): boolean {
  for (const predicate of selector.predicates) {
    if (predicate.predicate.kind === 'attrEquals' && !attributeEquals(frame, eventIndex, predicate)) {
      return false;
    }
  }
  return true;
}

function attributeEquals(
  frame: FrameBatch,
  eventIndex: number,
  predicate: RuntimePredicate,
): boolean {
  const attrIndex = findAttribute(frame, eventIndex, predicate);
  return attrIndex >= 0
    && spanEquals(frame.buffer, frame.attrValueStarts[attrIndex]!, frame.attrValueEnds[attrIndex]!, predicate.predicate.valueBytes);
}

function findAttribute(frame: FrameBatch, eventIndex: number, matcher: RuntimeField | RuntimePredicate): number {
  const start = frame.attrStarts[eventIndex]!;
  const end = start + frame.attrCounts[eventIndex]!;
  for (let attrIndex = start; attrIndex < end; attrIndex++) {
    if (attrNameMatches(matcher, frame, attrIndex)) {
      return attrIndex;
    }
  }
  return -1;
}

function createRuntimeSelector(selector: CompiledRecordSelector): RuntimeRecordSelector {
  const fields = selector.fields.map((field) => ({ field, nameId: -1 }));
  const fieldByOutput = new Map(fields.map((field) => [field.field.outputKey, field]));
  const attrFields = selector.attrFields.map((field) => fieldByOutput.get(field.outputKey)!);
  const childTextFields = selector.childTextFields.map((field) => fieldByOutput.get(field.outputKey)!);
  const pathNameIds = new Int32Array(selector.path.length);
  pathNameIds.fill(-1);
  return {
    selector,
    bit: selector.bit,
    pathNameIds,
    fields,
    attrFields,
    childTextFields,
    predicates: selector.predicates.map((predicate) => ({ predicate, nameId: -1 })),
  };
}

function eventNameMatches(
  knownNameIds: Int32Array,
  nameIndex: number,
  frame: FrameBatch,
  eventIndex: number,
  expected: Uint8Array,
): boolean {
  const actualNameId = frame.nameIds[eventIndex]!;
  const knownNameId = knownNameIds[nameIndex]!;
  if (knownNameId === actualNameId) {
    return true;
  }
  if (knownNameId >= 0) {
    return false;
  }
  if (!spanEquals(frame.buffer, frame.nameStarts[eventIndex]!, frame.nameEnds[eventIndex]!, expected)) {
    return false;
  }
  knownNameIds[nameIndex] = actualNameId;
  return true;
}

function fieldNameMatches(field: RuntimeField, frame: FrameBatch, eventIndex: number): boolean {
  const actualNameId = frame.nameIds[eventIndex]!;
  if (field.nameId === actualNameId) {
    return true;
  }
  if (field.nameId >= 0) {
    return false;
  }
  if (!spanEquals(frame.buffer, frame.nameStarts[eventIndex]!, frame.nameEnds[eventIndex]!, field.field.nameBytes)) {
    return false;
  }
  field.nameId = actualNameId;
  return true;
}

function attrNameMatches(matcher: RuntimeField | RuntimePredicate, frame: FrameBatch, attrIndex: number): boolean {
  const actualNameId = frame.attrNameIds[attrIndex]!;
  if (matcher.nameId === actualNameId) {
    return true;
  }
  if (matcher.nameId >= 0) {
    return false;
  }

  const expected = 'field' in matcher ? matcher.field.nameBytes : matcher.predicate.nameBytes;
  if (!spanEquals(frame.buffer, frame.attrNameStarts[attrIndex]!, frame.attrNameEnds[attrIndex]!, expected)) {
    return false;
  }
  matcher.nameId = actualNameId;
  return true;
}

function decodeAttributeValue(frame: FrameBatch, attrIndex: number, decoder: TextDecoder): string {
  const valueStart = frame.attrValueStarts[attrIndex]!;
  const valueEnd = frame.attrValueEnds[attrIndex]!;
  if (frame.attrNameStarts[attrIndex] === valueStart && frame.attrNameEnds[attrIndex] === valueEnd) {
    return 'true';
  }
  return decoder.decode(frame.buffer.subarray(valueStart, valueEnd));
}

function spanEquals(buffer: Uint8Array, start: number, end: number, expected: Uint8Array): boolean {
  const length = end - start;
  if (length !== expected.byteLength) {
    return false;
  }
  for (let index = 0; index < length; index++) {
    if (buffer[start + index] !== expected[index]) {
      return false;
    }
  }
  return true;
}

function normalizeInput(input: ProjectionInput): Uint8Array | Iterable<StreamReaderSyncByteBatch> {
  if (typeof input === 'string') {
    return encodeUtf8(input);
  }
  return input;
}

function assertUtf8Encoding(encoding: string | undefined): void {
  if (encoding === undefined || /^utf-?8$/i.test(encoding)) {
    return;
  }
  throw new Error('stax-xml/projection currently supports UTF-8 input only.');
}

function assertName(value: string, label: string): void {
  if (value.length === 0 || value.includes('/') || value.includes('[') || value.includes(']')) {
    throw new Error(`Invalid projection ${label}: ${value}`);
  }
}
