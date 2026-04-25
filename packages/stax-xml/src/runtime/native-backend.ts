export const WASM_PACKAGE_NAME = '@stax-xml/native-wasm32-wasi';

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

export type OptionalPackageImporter = (packageName: string) => Promise<unknown>;

export interface StaxXmlRuntimeResolverOptions {
  platform?: StaxXmlRuntimePlatform;
  importPackage?: OptionalPackageImporter;
}

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
  const nativePackage = getStaxXmlNativePackageName(platform);
  const candidates = nativePackage === undefined
    ? [WASM_PACKAGE_NAME]
    : [nativePackage, WASM_PACKAGE_NAME];
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

  return {
    kind: 'js',
    packageName: 'stax-xml',
    errors,
  };
}

function detectLinuxLibc(processLike: RuntimeProcessLike | undefined): LinuxLibc {
  const glibcVersion = processLike?.report?.getReport?.().header?.glibcVersionRuntime;
  return typeof glibcVersion === 'string' && glibcVersion.length > 0 ? 'gnu' : 'musl';
}

async function importOptionalPackage(packageName: string): Promise<unknown> {
  return import(packageName);
}
