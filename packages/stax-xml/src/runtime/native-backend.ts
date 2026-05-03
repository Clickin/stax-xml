export const WASM_PACKAGE_NAME = '@stax-xml/native-wasm32-wasi';

export type StaxXmlRuntimeBackendPreference = 'auto' | 'native' | 'wasm';
export type StaxXmlRuntimeBackendKind = 'native' | 'wasm' | 'js';
export type StaxXmlRuntimeFallbackBackend = 'wasm';
export type LinuxLibc = 'gnu' | 'musl';

export interface StaxXmlRuntimePlatform {
  platform: string;
  arch: string;
  libc?: LinuxLibc;
}

export interface StaxXmlRuntimeBackend {
  kind: StaxXmlRuntimeBackendKind;
  packageName?: string;
  module?: unknown;
  errors: Array<{ packageName: string; error: unknown }>;
}

export interface StaxXmlRuntimeCapabilities {
  structuralIndexUtf8?: (input: Uint8Array) => ArrayBuffer | ArrayBufferView;
  // The public stax-xml runtime intentionally canonicalizes text inputs to
  // UTF-8 bytes before acceleration. Do not add string-native structural index
  // capabilities back to this facade without re-evaluating the bytes-mainline
  // policy and the large-input probes.
  streamingEventBatches?: StaxXmlStreamingEventBatchFactory;
  objectRowsProjection?: (input: Uint8Array, spec: unknown) => unknown;
  objectRecordsProjection?: (input: Uint8Array, spec: unknown) => unknown;
  createObjectProjectionPlan?: (spec: unknown) => StaxXmlObjectProjectionPlan;
  itemRowsProjection?: (input: Uint8Array) => unknown;
  documentNodesProjection?: (input: Uint8Array, options?: unknown) => unknown;
}

export interface StaxXmlObjectProjectionPlan {
  projectRows?: (input: Uint8Array) => unknown;
  projectRecords?: (input: Uint8Array) => unknown;
  projectSchemaAwareRecords?: (input: Uint8Array) => unknown;
}

export type StaxXmlStreamingEventBatchFactory = (options?: unknown) => StaxXmlStreamingEventBatchParser;

export interface StaxXmlStreamingEventBatch {
  buffer: ArrayBuffer | ArrayBufferView;
  table?: ArrayBuffer | ArrayBufferView;
  soaTable?: ArrayBuffer | ArrayBufferView;
  stringArena?: string;
}

export interface StaxXmlStreamingEventBatchParser {
  pushChunk(chunk: Uint8Array, isFinal: boolean): StaxXmlStreamingEventBatch;
  pushBatch?(chunks: readonly Uint8Array[], isFinal: boolean): StaxXmlStreamingEventBatch;
}

export interface StaxXmlRuntime {
  initialized: boolean;
  backend: StaxXmlRuntimeBackend;
  capabilities: StaxXmlRuntimeCapabilities;
}

export type OptionalPackageImporter = (packageName: string) => Promise<unknown>;

export interface StaxXmlRuntimeResolverOptions {
  backend?: StaxXmlRuntimeBackendPreference;
  fallbackBackend?: StaxXmlRuntimeFallbackBackend;
  /**
   * @deprecated JavaScript is no longer a public runtime fallback. Use
   * `fallbackBackend: "wasm"` when wasm compatibility is intended.
   */
  fallbackOnLoadError?: boolean;
  platform?: StaxXmlRuntimePlatform;
  importPackage?: OptionalPackageImporter;
}

export type InitStaxXmlOptions = StaxXmlRuntimeResolverOptions;

interface RuntimeProcessLike {
  platform?: string;
  arch?: string;
  report?: {
    getReport?: () => {
      header?: {
        glibcVersionRuntime?: unknown;
      };
    };
  };
}

const NATIVE_PACKAGES: Record<string, string> = {
  'darwin|arm64': '@stax-xml/native-darwin-arm64',
  'darwin|x64': '@stax-xml/native-darwin-x64',
  'linux|arm64|gnu': '@stax-xml/native-linux-arm64-gnu',
  'linux|arm64|musl': '@stax-xml/native-linux-arm64-musl',
  'linux|x64|gnu': '@stax-xml/native-linux-x64-gnu',
  'linux|x64|musl': '@stax-xml/native-linux-x64-musl',
  'win32|arm64': '@stax-xml/native-win32-arm64-msvc',
  'win32|x64': '@stax-xml/native-win32-x64-msvc',
};

const JS_BACKEND: StaxXmlRuntimeBackend = {
  kind: 'js',
  packageName: 'stax-xml',
  errors: [],
};
const UNINITIALIZED_RUNTIME: StaxXmlRuntime = {
  initialized: false,
  backend: JS_BACKEND,
  capabilities: {},
};
const RUNTIME_STATE_KEY = Symbol.for('stax-xml.runtime.state');

interface RuntimeState {
  initializedRuntime?: StaxXmlRuntime;
}

function runtimeState(): RuntimeState {
  const stateHost = globalThis as unknown as { [key: symbol]: RuntimeState | undefined };
  return stateHost[RUNTIME_STATE_KEY] ??= {};
}

export function detectRuntimePlatform(
  processLike: RuntimeProcessLike | undefined = (globalThis as { process?: RuntimeProcessLike }).process,
): StaxXmlRuntimePlatform {
  const platform = processLike?.platform ?? 'browser';
  const arch = processLike?.arch ?? 'unknown';
  const libc = platform === 'linux' ? detectLinuxLibc(processLike) : undefined;
  return { platform, arch, libc };
}

export function getStaxXmlNativePackageName(platform: StaxXmlRuntimePlatform): string | undefined {
  const libcSuffix = platform.platform === 'linux' ? `|${platform.libc ?? 'gnu'}` : '';
  return NATIVE_PACKAGES[`${platform.platform}|${platform.arch}${libcSuffix}`];
}

export async function resolveStaxXmlRuntimeBackend(
  options: StaxXmlRuntimeResolverOptions = {},
): Promise<StaxXmlRuntimeBackend> {
  const platform = options.platform ?? detectRuntimePlatform();
  const importPackage = options.importPackage ?? importOptionalPackage;
  const backendPreference = options.backend ?? 'auto';
  if ((backendPreference as string) === 'js') {
    throw new Error('backend: "js" is no longer a public stax-xml runtime backend. Use backend: "wasm" for compatibility or keep JavaScript parser helpers internal to tests.');
  }

  const candidates = withFallbackBackend(
    backendCandidates(backendPreference, platform),
    backendPreference,
    options.fallbackBackend,
  );
  const errors: Array<{ packageName: string; error: unknown }> = [];

  for (const packageName of candidates) {
    try {
      return {
        kind: packageName === WASM_PACKAGE_NAME ? 'wasm' : 'native',
        packageName,
        module: await importPackage(packageName),
        errors,
      };
    } catch (error) {
      errors.push({ packageName, error });
    }
  }

  throw createBackendLoadError(backendPreference, platform, errors);
}

export async function initStaxXml(options: InitStaxXmlOptions = {}): Promise<StaxXmlRuntime> {
  const backend = await resolveStaxXmlRuntimeBackend({
    ...options,
    backend: options.backend ?? 'auto',
  });
  const runtime = {
    ...createStaxXmlRuntimeFromBackend(backend),
    initialized: true,
  };
  runtimeState().initializedRuntime = runtime;
  return runtime;
}

export function createStaxXmlRuntimeFromBackend(backend: StaxXmlRuntimeBackend): StaxXmlRuntime {
  return {
    initialized: true,
    backend,
    capabilities: createRuntimeCapabilities(backend),
  };
}

export function getStaxXmlRuntime(): StaxXmlRuntime {
  return runtimeState().initializedRuntime ?? UNINITIALIZED_RUNTIME;
}

export function getInitializedStaxXmlRuntime(): StaxXmlRuntime | undefined {
  return runtimeState().initializedRuntime;
}

export function resetStaxXmlRuntimeForTests(): void {
  runtimeState().initializedRuntime = undefined;
}

export function getStaxXmlRuntimeForSyncApi(
  backendPreference: StaxXmlRuntimeBackendPreference | 'js' | undefined,
): StaxXmlRuntime | undefined {
  const preference = backendPreference ?? 'auto';
  if (preference === 'js') {
    return undefined;
  }
  const runtime = getInitializedStaxXmlRuntime();
  if (!runtime) {
    if (preference === 'auto') {
      return undefined;
    }
    throw new Error(`The ${preference} backend is not initialized. Call initStaxXml() before requesting an accelerated backend.`);
  }
  if (runtime.backend.kind === 'js') {
    if (preference === 'auto') {
      return undefined;
    }
    throw new Error(`The ${preference} backend is not initialized. Call initStaxXml() before requesting an accelerated backend.`);
  }
  if (preference !== 'auto' && runtime.backend.kind !== preference) {
    throw new Error(`Initialized stax-xml backend is ${runtime.backend.kind}, not ${preference}. Call initStaxXml({ backend: '${preference}' }) first.`);
  }
  return runtime;
}

export async function getStaxXmlRuntimeForAsyncApi(
  backendPreference: StaxXmlRuntimeBackendPreference | 'js' | undefined,
): Promise<StaxXmlRuntime | undefined> {
  return getStaxXmlRuntimeForSyncApi(backendPreference);
}

function backendCandidates(
  backendPreference: StaxXmlRuntimeBackendPreference,
  platform: StaxXmlRuntimePlatform,
): string[] {
  if (backendPreference === 'wasm') {
    return [WASM_PACKAGE_NAME];
  }
  const nativePackage = getStaxXmlNativePackageName(platform);
  return nativePackage ? [nativePackage] : [];
}

function withFallbackBackend(
  candidates: string[],
  backendPreference: StaxXmlRuntimeBackendPreference,
  fallbackBackend: StaxXmlRuntimeFallbackBackend | undefined,
): string[] {
  if (fallbackBackend !== 'wasm' || backendPreference === 'wasm' || candidates.includes(WASM_PACKAGE_NAME)) {
    return candidates;
  }
  return [...candidates, WASM_PACKAGE_NAME];
}

function createRuntimeCapabilities(backend: StaxXmlRuntimeBackend): StaxXmlRuntimeCapabilities {
  if (backend.kind === 'js') {
    return {};
  }
  const nativeModule = backend.module as Record<string, unknown> | undefined;
  const structuralIndexUtf8 = firstFunction(nativeModule, [
    'parseStructuralIndexUint8Array',
    'parseStructuralIndexBuffer',
    'parseSpanTableUint8Array',
  ]);
  const objectRowsProjection = firstFunction(nativeModule, [
    'parseObjectRowsUint8Array',
    'parseObjectRowsViaTableUint8Array',
  ]);
  const objectRecordsProjection = firstFunction(nativeModule, [
    'parseObjectRecordsUint8Array',
  ]);
  const createObjectProjectionPlan = firstFunction(nativeModule, [
    'createObjectProjectionPlan',
  ]);
  const itemRowsProjection = firstFunction(nativeModule, [
    'parseItemRowsViaTableUint8Array',
  ]);
  const documentNodesProjection = firstFunction(nativeModule, [
    'parseDocumentNodesUint8Array',
    'parseXmlNodesUint8Array',
  ]);
  const streamingEventBatches = firstFunction(nativeModule, [
    'createStreamingEventBatchParser',
    'createStreamingEventBatches',
  ]);

  return {
    structuralIndexUtf8: structuralIndexUtf8 as StaxXmlRuntimeCapabilities['structuralIndexUtf8'],
    objectRowsProjection: objectRowsProjection as StaxXmlRuntimeCapabilities['objectRowsProjection'],
    objectRecordsProjection: objectRecordsProjection as StaxXmlRuntimeCapabilities['objectRecordsProjection'],
    createObjectProjectionPlan: createObjectProjectionPlan as StaxXmlRuntimeCapabilities['createObjectProjectionPlan'],
    itemRowsProjection: itemRowsProjection as StaxXmlRuntimeCapabilities['itemRowsProjection'],
    documentNodesProjection: documentNodesProjection as StaxXmlRuntimeCapabilities['documentNodesProjection'],
    streamingEventBatches: streamingEventBatches as StaxXmlRuntimeCapabilities['streamingEventBatches'],
  };
}

function firstFunction(module: Record<string, unknown> | undefined, names: string[]): Function | undefined {
  for (const name of names) {
    const value = module?.[name];
    if (typeof value === 'function') {
      return value;
    }
  }
  return undefined;
}

function createBackendLoadError(
  backendPreference: StaxXmlRuntimeBackendPreference,
  platform: StaxXmlRuntimePlatform,
  errors: Array<{ packageName: string; error: unknown }>,
): Error {
  const expectedPackage = backendPreference === 'wasm'
    ? WASM_PACKAGE_NAME
    : getStaxXmlNativePackageName(platform)
      ?? `no native package for ${platform.platform}/${platform.arch}${platform.libc ? `/${platform.libc}` : ''}`;
  const attemptedPackages = errors.map(({ packageName }) => packageName).join(', ') || 'none';
  const loadErrors = errors
    .map(({ packageName, error }) => `${packageName}: ${error instanceof Error ? error.message : String(error)}`)
    .join('; ');
  const message = [
    `Unable to initialize stax-xml ${backendPreference} backend.`,
    `Expected package: ${expectedPackage}.`,
    `Attempted packages: ${attemptedPackages}.`,
    'Install stax-xml with optional dependencies enabled and verify the matching @stax-xml/native-* package is present.',
    `Use backend: "wasm" or fallbackBackend: "wasm" only when the ${WASM_PACKAGE_NAME} compatibility backend is intended.`,
    loadErrors ? `Load errors: ${loadErrors}` : undefined,
  ].filter(Boolean).join(' ');
  const error = new Error(message);
  (error as Error & { cause?: unknown }).cause = errors;
  return error;
}

function detectLinuxLibc(processLike: RuntimeProcessLike | undefined): LinuxLibc {
  const glibcVersion = processLike?.report?.getReport?.().header?.glibcVersionRuntime;
  return typeof glibcVersion === 'string' && glibcVersion.length > 0 ? 'gnu' : 'musl';
}

async function importOptionalPackage(packageName: string): Promise<unknown> {
  return import(packageName);
}
