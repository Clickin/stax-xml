import {
  createStaxXmlRuntimeFromBackend,
  getInitializedStaxXmlRuntime,
  getStaxXmlRuntimeForSyncApi,
  resolveStaxXmlRuntimeBackend,
  type StaxXmlRuntime,
  type StaxXmlRuntimeBackendPreference,
  type StaxXmlRuntimeFallbackBackend,
  type StaxXmlObjectProjectionPlan,
} from '../runtime/native-backend.js';
import {
  parseXmlTree,
  parseXmlTreeSync,
  type ParseXmlTreeOptions,
  type XmlAsyncInput,
  type XmlSyncInput,
  type XmlTreeDocument,
  type XmlTreeElement,
  type XmlTreeNode,
} from '../XmlObject.js';
export type { EntityDefinition } from '../IterableEventBackend.js';
export type { DocumentMode } from '../types.js';
export type { ParseXmlTreeOptions, XmlAsyncInput, XmlSyncInput } from '../XmlObject.js';

export type ProjectionBackendPreference = StaxXmlRuntimeBackendPreference;
export type ProjectionLinuxLibc = 'gnu' | 'musl';

export interface ProjectionRuntimePlatform {
  platform: string;
  arch: string;
  libc?: ProjectionLinuxLibc;
}

export type ProjectionPackageImporter = (packageName: string) => Promise<unknown>;

export interface ProjectionReaderOptions {
  backend?: ProjectionBackendPreference;
  fallbackBackend?: StaxXmlRuntimeFallbackBackend;
  /**
   * @deprecated JavaScript is no longer a public projection fallback. Use
   * `fallbackBackend: "wasm"` when wasm compatibility is intended.
   */
  fallbackOnLoadError?: boolean;
  platform?: ProjectionRuntimePlatform;
  importPackage?: ProjectionPackageImporter;
}

export interface ParseXmlNodesOptions extends ParseXmlTreeOptions, ProjectionReaderOptions {}

export type XmlNode = string | XmlElementNode;

export interface XmlElementNode {
  tagName: string;
  attributes: Record<string, string>;
  children: XmlNode[];
}

export type ProjectionFieldValueKind = 'string' | 'number';
export type ProjectionFieldSourceKind = 'attribute' | 'element';
export type ProjectionFieldTextMode = 'direct' | 'subtree';

export interface ObjectRowsProjectionFieldSpec {
  outputName: string;
  valueKind: ProjectionFieldValueKind;
  sourceKind: ProjectionFieldSourceKind;
  sourceName: string;
  sourcePath?: string[];
  sourcePositions?: number[];
  textMode: ProjectionFieldTextMode;
}

export interface ObjectRowsProjectionSpec {
  itemName: string;
  itemPosition?: number;
  fields: ObjectRowsProjectionFieldSpec[];
}

export interface ObjectRowsProjectionColumn {
  present?: unknown[];
  values?: unknown[];
  numberValues?: unknown[];
  number_values?: unknown[];
  spanStarts?: unknown[];
  span_starts?: unknown[];
  spanEnds?: unknown[];
  span_ends?: unknown[];
}

export interface ObjectRowsProjectionResult {
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
  columns?: ObjectRowsProjectionColumn[];
}

export interface ObjectRecordsProjectionResult {
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
  json?: string;
  rows?: unknown[];
}

export interface ItemRowsProjectionResult {
  inputBytes?: number;
  input_bytes?: number;
  eventCount?: number;
  event_count?: number;
  maxDepth?: number;
  max_depth?: number;
  rows?: unknown[];
}

export interface XmlNodesProjectionResult {
  inputBytes?: number;
  input_bytes?: number;
  nodeCount?: number;
  node_count?: number;
  json?: string;
  nodes?: unknown[];
}

export class ProjectionReader {
  private readonly objectProjectionPlans = new WeakMap<ObjectRowsProjectionSpec, {
    factory: NonNullable<StaxXmlRuntime['capabilities']['createObjectProjectionPlan']>;
    plan: StaxXmlObjectProjectionPlan;
  }>();

  constructor(private readonly options: ProjectionReaderOptions = {}) {}

  parseNodes(
    input: XmlAsyncInput,
    options?: ParseXmlNodesOptions,
  ): Promise<XmlNode[]> {
    return parseXmlNodes(input, {
      ...this.options,
      ...options,
    });
  }

  parseNodesSync(
    input: XmlSyncInput,
    options?: ParseXmlNodesOptions,
  ): XmlNode[] {
    return parseXmlNodesSync(input, {
      ...this.options,
      ...options,
    });
  }

  projectObjectRows(
    input: ArrayBufferView,
    spec: ObjectRowsProjectionSpec,
    options?: ProjectionReaderOptions,
  ): Promise<ObjectRowsProjectionResult> {
    return projectXmlObjectRows(input, spec, {
      ...this.options,
      ...options,
    });
  }

  projectObjectRowsSync(
    input: ArrayBufferView,
    spec: ObjectRowsProjectionSpec,
    options?: ProjectionReaderOptions,
  ): ObjectRowsProjectionResult {
    const mergedOptions = { ...this.options, ...options };
    const runtime = getProjectionRuntimeSync(mergedOptions.backend);
    return projectObjectRowsWithRuntime(
      runtime,
      input,
      spec,
      this.getObjectProjectionPlan(runtime, spec),
    );
  }

  projectItemRows(
    input: ArrayBufferView,
    options?: ProjectionReaderOptions,
  ): Promise<ItemRowsProjectionResult> {
    return projectXmlItemRows(input, {
      ...this.options,
      ...options,
    });
  }

  projectItemRowsSync(
    input: ArrayBufferView,
    options?: ProjectionReaderOptions,
  ): ItemRowsProjectionResult {
    return projectXmlItemRowsSync(input, {
      ...this.options,
      ...options,
    });
  }

  projectObjectRecords(
    input: ArrayBufferView,
    spec: ObjectRowsProjectionSpec,
    options?: ProjectionReaderOptions,
  ): Promise<ObjectRecordsProjectionResult> {
    return projectXmlObjectRecords(input, spec, {
      ...this.options,
      ...options,
    });
  }

  projectObjectRecordsSync(
    input: ArrayBufferView,
    spec: ObjectRowsProjectionSpec,
    options?: ProjectionReaderOptions,
  ): ObjectRecordsProjectionResult {
    const mergedOptions = { ...this.options, ...options };
    const runtime = getProjectionRuntimeSync(mergedOptions.backend);
    return projectObjectRecordsWithRuntime(
      runtime,
      input,
      spec,
      this.getObjectProjectionPlan(runtime, spec),
    );
  }

  private getObjectProjectionPlan(
    runtime: StaxXmlRuntime,
    spec: ObjectRowsProjectionSpec,
  ): StaxXmlObjectProjectionPlan | undefined {
    const factory = runtime.capabilities.createObjectProjectionPlan;
    if (typeof factory !== 'function') {
      return undefined;
    }
    const cached = this.objectProjectionPlans.get(spec);
    if (cached?.factory === factory) {
      return cached.plan;
    }
    const plan = factory(spec);
    this.objectProjectionPlans.set(spec, { factory, plan });
    return plan;
  }
}

export async function parseXmlNodes(
  input: XmlAsyncInput,
  options: ParseXmlNodesOptions = {},
): Promise<XmlNode[]> {
  const runtime = await resolveOptionalProjectionRuntime(options);
  if (runtime?.capabilities.documentNodesProjection) {
    return projectXmlNodesWithRuntime(runtime, await toContiguousUtf8Bytes(input), options);
  }
  return treeToXmlNodes(await parseXmlTree(input, treeOptionsFromNodesOptions(options)));
}

export function parseXmlNodesSync(
  input: XmlSyncInput,
  options: ParseXmlNodesOptions = {},
): XmlNode[] {
  const runtime = getOptionalProjectionRuntimeSync(options.backend);
  if (runtime?.capabilities.documentNodesProjection) {
    return projectXmlNodesWithRuntime(runtime, toContiguousUtf8BytesSync(input), options);
  }
  return treeToXmlNodes(parseXmlTreeSync(input, treeOptionsFromNodesOptions(options)));
}

export async function projectXmlObjectRows(
  input: ArrayBufferView,
  spec: ObjectRowsProjectionSpec,
  options: ProjectionReaderOptions = {},
): Promise<ObjectRowsProjectionResult> {
  const runtime = await resolveProjectionRuntime(options);
  return projectObjectRowsWithRuntime(runtime, input, spec);
}

export function projectXmlObjectRowsSync(
  input: ArrayBufferView,
  spec: ObjectRowsProjectionSpec,
  options: Pick<ProjectionReaderOptions, 'backend'> = {},
): ObjectRowsProjectionResult {
  const runtime = getProjectionRuntimeSync(options.backend);
  return projectObjectRowsWithRuntime(runtime, input, spec);
}

export async function projectXmlItemRows(
  input: ArrayBufferView,
  options: ProjectionReaderOptions = {},
): Promise<ItemRowsProjectionResult> {
  const runtime = await resolveProjectionRuntime(options);
  return projectItemRowsWithRuntime(runtime, input);
}

export function projectXmlItemRowsSync(
  input: ArrayBufferView,
  options: Pick<ProjectionReaderOptions, 'backend'> = {},
): ItemRowsProjectionResult {
  const runtime = getProjectionRuntimeSync(options.backend);
  return projectItemRowsWithRuntime(runtime, input);
}

export async function projectXmlObjectRecords(
  input: ArrayBufferView,
  spec: ObjectRowsProjectionSpec,
  options: ProjectionReaderOptions = {},
): Promise<ObjectRecordsProjectionResult> {
  const runtime = await resolveProjectionRuntime(options);
  return projectObjectRecordsWithRuntime(runtime, input, spec);
}

export function projectXmlObjectRecordsSync(
  input: ArrayBufferView,
  spec: ObjectRowsProjectionSpec,
  options: Pick<ProjectionReaderOptions, 'backend'> = {},
): ObjectRecordsProjectionResult {
  const runtime = getProjectionRuntimeSync(options.backend);
  return projectObjectRecordsWithRuntime(runtime, input, spec);
}

async function resolveProjectionRuntime(options: ProjectionReaderOptions): Promise<StaxXmlRuntime> {
  const backendPreference = options.backend ?? 'auto';
  const initialized = getInitializedStaxXmlRuntime();
  if (initialized) {
    if (backendPreference !== 'auto' && initialized.backend.kind !== backendPreference) {
      throw new Error(`Initialized stax-xml backend is ${initialized.backend.kind}, not ${backendPreference}. Call initStaxXml({ backend: '${backendPreference}' }) first.`);
    }
    if (initialized.backend.kind === 'js') {
      throw new Error('ProjectionReader requires a native or wasm backend with projection capabilities.');
    }
    return initialized;
  }

  const backend = await resolveStaxXmlRuntimeBackend({
    ...options,
    backend: backendPreference,
    fallbackBackend: options.fallbackBackend,
    fallbackOnLoadError: options.fallbackOnLoadError ?? false,
  });
  const runtime = createStaxXmlRuntimeFromBackend(backend);
  if (runtime.backend.kind === 'js') {
    throw new Error('ProjectionReader requires a native or wasm backend with projection capabilities.');
  }
  return runtime;
}

async function resolveOptionalProjectionRuntime(options: ProjectionReaderOptions): Promise<StaxXmlRuntime | undefined> {
  const backendPreference = options.backend ?? 'auto';
  const initialized = getInitializedStaxXmlRuntime();
  if (initialized) {
    if (backendPreference !== 'auto' && initialized.backend.kind !== backendPreference) {
      throw new Error(`Initialized stax-xml backend is ${initialized.backend.kind}, not ${backendPreference}. Call initStaxXml({ backend: '${backendPreference}' }) first.`);
    }
    return initialized.backend.kind === 'js' ? undefined : initialized;
  }

  try {
    const backend = await resolveStaxXmlRuntimeBackend({
      ...options,
      backend: backendPreference,
      fallbackBackend: options.fallbackBackend,
      fallbackOnLoadError: options.fallbackOnLoadError ?? false,
    });
    const runtime = createStaxXmlRuntimeFromBackend(backend);
    return runtime.backend.kind === 'js' ? undefined : runtime;
  } catch (error) {
    if (backendPreference === 'auto' && !options.fallbackBackend) {
      return undefined;
    }
    throw error;
  }
}

function getProjectionRuntimeSync(
  backendPreference: ProjectionBackendPreference | undefined,
): StaxXmlRuntime {
  const runtime = getStaxXmlRuntimeForSyncApi(backendPreference);
  if (!runtime || runtime.backend.kind === 'js') {
    throw new Error('ProjectionReader sync methods require an initialized native or wasm backend. Call initStaxXml() first or use the async methods.');
  }
  return runtime;
}

function getOptionalProjectionRuntimeSync(
  backendPreference: ProjectionBackendPreference | undefined,
): StaxXmlRuntime | undefined {
  const runtime = getStaxXmlRuntimeForSyncApi(backendPreference);
  if (!runtime || runtime.backend.kind === 'js') {
    return undefined;
  }
  return runtime;
}

function projectXmlNodesWithRuntime(
  runtime: StaxXmlRuntime,
  input: Uint8Array,
  options: ParseXmlNodesOptions,
): XmlNode[] {
  const project = runtime.capabilities.documentNodesProjection;
  if (typeof project !== 'function') {
    throw new Error(`Initialized ${runtime.backend.kind} backend does not provide document node projection capability.`);
  }
  return hydrateXmlNodesResult(project(input, documentNodesProjectionOptions(options)));
}

function projectObjectRowsWithRuntime(
  runtime: StaxXmlRuntime,
  input: ArrayBufferView,
  spec: ObjectRowsProjectionSpec,
  compiledPlan?: StaxXmlObjectProjectionPlan,
): ObjectRowsProjectionResult {
  if (typeof compiledPlan?.projectRows === 'function') {
    return compiledPlan.projectRows(toUint8Array(input)) as ObjectRowsProjectionResult;
  }
  const project = runtime.capabilities.objectRowsProjection;
  if (typeof project !== 'function') {
    throw new Error(`Initialized ${runtime.backend.kind} backend does not provide object row projection capability.`);
  }
  return project(toUint8Array(input), spec) as ObjectRowsProjectionResult;
}

function projectItemRowsWithRuntime(
  runtime: StaxXmlRuntime,
  input: ArrayBufferView,
): ItemRowsProjectionResult {
  const project = runtime.capabilities.itemRowsProjection;
  if (typeof project !== 'function') {
    throw new Error(`Initialized ${runtime.backend.kind} backend does not provide item row projection capability.`);
  }
  return project(toUint8Array(input)) as ItemRowsProjectionResult;
}

function projectObjectRecordsWithRuntime(
  runtime: StaxXmlRuntime,
  input: ArrayBufferView,
  spec: ObjectRowsProjectionSpec,
  compiledPlan?: StaxXmlObjectProjectionPlan,
): ObjectRecordsProjectionResult {
  if (typeof compiledPlan?.projectRecords === 'function') {
    return hydrateObjectRecordsResult(
      compiledPlan.projectRecords(toUint8Array(input)) as ObjectRecordsProjectionResult,
    );
  }
  const project = runtime.capabilities.objectRecordsProjection;
  if (typeof project !== 'function') {
    throw new Error(`Initialized ${runtime.backend.kind} backend does not provide object record projection capability.`);
  }
  const result = project(toUint8Array(input), spec) as ObjectRecordsProjectionResult;
  return hydrateObjectRecordsResult(result);
}

function hydrateObjectRecordsResult(
  result: ObjectRecordsProjectionResult,
): ObjectRecordsProjectionResult {
  if (!Array.isArray(result.rows) && typeof result.json === 'string') {
    result.rows = JSON.parse(result.json) as unknown[];
  }
  return result;
}

function hydrateXmlNodesResult(result: unknown): XmlNode[] {
  if (Array.isArray(result)) {
    return normalizeXmlNodes(result);
  }
  if (!result || typeof result !== 'object') {
    throw new Error('Document node projection returned an invalid result.');
  }
  const projectionResult = result as XmlNodesProjectionResult;
  if (Array.isArray(projectionResult.nodes)) {
    return normalizeXmlNodes(projectionResult.nodes);
  }
  if (typeof projectionResult.json === 'string') {
    return normalizeXmlNodes(JSON.parse(projectionResult.json) as unknown[]);
  }
  throw new Error('Document node projection result must include nodes or json.');
}

function normalizeXmlNodes(nodes: unknown[]): XmlNode[] {
  return nodes.map(normalizeXmlNode);
}

function normalizeXmlNode(node: unknown): XmlNode {
  if (typeof node === 'string') {
    return node;
  }
  if (!node || typeof node !== 'object') {
    throw new Error('Document node projection returned a non-node value.');
  }
  const candidate = node as {
    tagName?: unknown;
    attributes?: unknown;
    children?: unknown;
  };
  if (typeof candidate.tagName !== 'string') {
    throw new Error('Document node projection returned an element without a tagName.');
  }
  return {
    tagName: candidate.tagName,
    attributes: copyAttributeRecord(candidate.attributes),
    children: Array.isArray(candidate.children) ? normalizeXmlNodes(candidate.children) : [],
  };
}

function treeToXmlNodes(document: XmlTreeDocument): XmlNode[] {
  return document.children.map(treeNodeToXmlNode);
}

function treeNodeToXmlNode(node: XmlTreeNode): XmlNode {
  if (node.type === 'text' || node.type === 'cdata') {
    return node.value;
  }
  return treeElementToXmlNode(node);
}

function treeElementToXmlNode(element: XmlTreeElement): XmlElementNode {
  return {
    tagName: element.name,
    attributes: copyAttributeRecord(element.attributes),
    children: element.children.map(treeNodeToXmlNode),
  };
}

function copyAttributeRecord(source: unknown): Record<string, string> {
  const target: Record<string, string> = {};
  if (!source || typeof source !== 'object') {
    return target;
  }
  for (const [key, value] of Object.entries(source)) {
    defineStringData(target, key, typeof value === 'string' ? value : String(value));
  }
  return target;
}

function defineStringData(target: Record<string, string>, key: string, value: string): void {
  Object.defineProperty(target, key, {
    value,
    configurable: true,
    enumerable: true,
    writable: true,
  });
}

function treeOptionsFromNodesOptions(options: ParseXmlNodesOptions): ParseXmlTreeOptions {
  const {
    backend: _backend,
    fallbackBackend: _fallbackBackend,
    fallbackOnLoadError: _fallbackOnLoadError,
    platform: _platform,
    importPackage: _importPackage,
    ...treeOptions
  } = options;
  return treeOptions;
}

function documentNodesProjectionOptions(options: ParseXmlNodesOptions): {
  autoDecodeEntities: boolean;
  addEntities?: Array<{ entity: string; value: string }>;
} {
  return {
    autoDecodeEntities: options.autoDecodeEntities ?? true,
    addEntities: options.addEntities,
  };
}

const textEncoder = new TextEncoder();

async function toContiguousUtf8Bytes(input: XmlAsyncInput): Promise<Uint8Array> {
  if (isSyncXmlInput(input)) {
    return toContiguousUtf8BytesSync(input);
  }
  if (input instanceof ReadableStream) {
    const reader = input.getReader();
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const result = await reader.read();
        if (result.done) {
          break;
        }
        chunks.push(result.value);
      }
    } finally {
      reader.releaseLock();
    }
    return concatChunks(chunks);
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of input) {
    chunks.push(chunk);
  }
  return concatChunks(chunks);
}

function toContiguousUtf8BytesSync(input: XmlSyncInput): Uint8Array {
  if (typeof input === 'string') {
    return textEncoder.encode(input);
  }
  if (input instanceof Uint8Array) {
    return input;
  }
  return concatChunks([...input]);
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 0) {
    return new Uint8Array();
  }
  if (chunks.length === 1) {
    return chunks[0]!;
  }
  let byteLength = 0;
  for (const chunk of chunks) {
    byteLength += chunk.byteLength;
  }
  const output = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function isSyncXmlInput(input: XmlAsyncInput): input is XmlSyncInput {
  return typeof input === 'string'
    || input instanceof Uint8Array
    || (!(input instanceof ReadableStream) && Symbol.iterator in Object(input));
}

function toUint8Array(input: ArrayBufferView): Uint8Array {
  return input instanceof Uint8Array
    ? input
    : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}
