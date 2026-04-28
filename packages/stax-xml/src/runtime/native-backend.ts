export const WASM_PACKAGE_NAME = '@stax-xml/native-wasm32-wasi';

export type StaxXmlRuntimeBackendPreference = 'auto' | 'native' | 'wasm' | 'js';
export type StaxXmlRuntimeBackendKind = 'native' | 'wasm' | 'js';
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
  structuralIndexUtf16?: (input: string) => ArrayBuffer | ArrayBufferView;
  streamingEventBatches?: StaxXmlStreamingEventBatchFactory;
  objectRowsProjection?: (input: Uint8Array, spec: unknown) => unknown;
  itemRowsProjection?: (input: Uint8Array) => unknown;
}

export type StaxXmlStreamingEventBatchFactory = (options?: unknown) => StaxXmlStreamingEventBatchParser;

export interface StaxXmlStreamingEventBatch {
  buffer: ArrayBuffer | ArrayBufferView;
  table: ArrayBuffer | ArrayBufferView;
}

export interface StaxXmlStreamingEventBatchParser {
  pushChunk(chunk: Uint8Array, isFinal: boolean): StaxXmlStreamingEventBatch;
}

export interface StaxXmlRuntime {
  initialized: boolean;
  backend: StaxXmlRuntimeBackend;
  capabilities: StaxXmlRuntimeCapabilities;
}

export type OptionalPackageImporter = (packageName: string) => Promise<unknown>;

export interface StaxXmlRuntimeResolverOptions {
  backend?: StaxXmlRuntimeBackendPreference;
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
let initializedRuntime: StaxXmlRuntime | undefined;

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
  if (backendPreference === 'js') {
    return { ...JS_BACKEND };
  }

  const candidates = backendCandidates(backendPreference, platform);
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

  const fallback = options.fallbackOnLoadError ?? backendPreference === 'auto';
  if (!fallback) {
    throw createBackendLoadError(backendPreference, errors);
  }

  return {
    kind: 'js',
    packageName: 'stax-xml',
    errors,
  };
}

export async function initStaxXml(options: InitStaxXmlOptions = {}): Promise<StaxXmlRuntime> {
  const backend = await resolveStaxXmlRuntimeBackend({
    ...options,
    backend: options.backend ?? 'auto',
  });
  initializedRuntime = {
    ...createStaxXmlRuntimeFromBackend(backend),
    initialized: true,
  };
  return initializedRuntime;
}

export function createStaxXmlRuntimeFromBackend(backend: StaxXmlRuntimeBackend): StaxXmlRuntime {
  return {
    initialized: true,
    backend,
    capabilities: createRuntimeCapabilities(backend),
  };
}

export function getStaxXmlRuntime(): StaxXmlRuntime {
  return initializedRuntime ?? UNINITIALIZED_RUNTIME;
}

export function getInitializedStaxXmlRuntime(): StaxXmlRuntime | undefined {
  return initializedRuntime;
}

export function resetStaxXmlRuntimeForTests(): void {
  initializedRuntime = undefined;
}

export function getStaxXmlRuntimeForSyncApi(
  backendPreference: StaxXmlRuntimeBackendPreference | undefined,
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
  backendPreference: StaxXmlRuntimeBackendPreference | undefined,
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
  if (backendPreference === 'native') {
    return nativePackage ? [nativePackage] : [];
  }
  return nativePackage === undefined
    ? [WASM_PACKAGE_NAME]
    : [nativePackage, WASM_PACKAGE_NAME];
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
  const structuralIndexUtf16 = firstFunction(nativeModule, [
    'parseStructuralIndexStringUtf16',
    'parseSpanTableStringUtf16',
  ]);
  const objectRowsProjection = firstFunction(nativeModule, [
    'parseObjectRowsUint8Array',
    'parseObjectRowsViaTableUint8Array',
  ]);
  const itemRowsProjection = firstFunction(nativeModule, [
    'parseItemRowsViaTableUint8Array',
  ]);
  const streamingEventBatches = firstFunction(nativeModule, [
    'createStreamingEventBatchParser',
    'createStreamingEventBatches',
  ]);

  return {
    structuralIndexUtf8: structuralIndexUtf8 as StaxXmlRuntimeCapabilities['structuralIndexUtf8'],
    structuralIndexUtf16: structuralIndexUtf16 as StaxXmlRuntimeCapabilities['structuralIndexUtf16'],
    objectRowsProjection: objectRowsProjection as StaxXmlRuntimeCapabilities['objectRowsProjection'],
    itemRowsProjection: itemRowsProjection as StaxXmlRuntimeCapabilities['itemRowsProjection'],
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
  errors: Array<{ packageName: string; error: unknown }>,
): Error {
  const packageNames = errors.map(({ packageName }) => packageName).join(', ') || backendPreference;
  const error = new Error(`Unable to initialize stax-xml ${backendPreference} backend from ${packageNames}.`);
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
