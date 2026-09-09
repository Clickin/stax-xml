export type WasmVariant = "scalar" | "simd";

export interface InitWasmOptions {
  /** Backend asset to initialize. The default is `simd`. */
  variant?: WasmVariant;
  /** An already compiled module, useful for bundlers and cold-start tests. */
  module?: WebAssembly.Module;
  /** Raw module bytes, useful for bundlers and tests. */
  bytes?: Uint8Array | ArrayBuffer;
}

const moduleCache = new Map<WasmVariant, Promise<WebAssembly.Module>>();
let activeModule: WebAssembly.Module | undefined;
let activeVariant: WasmVariant | undefined;

/**
 * Compile and select a tokenizer module. Importing this package performs no
 * file or network I/O; the shipped asset is loaded only by this function.
 */
export async function initWasm(
  options: InitWasmOptions = {},
): Promise<WebAssembly.Module> {
  const variant = options.variant ?? "simd";
  activeVariant = variant;

  let compiled: Promise<WebAssembly.Module>;
  if (options.module !== undefined) {
    compiled = Promise.resolve(options.module);
  } else if (options.bytes !== undefined) {
    compiled = WebAssembly.compile(options.bytes as BufferSource);
  } else {
    compiled = moduleCache.get(variant) ?? compileAsset(variant);
  }
  moduleCache.set(variant, compiled);

  const module = await compiled;
  if (activeVariant === variant) activeModule = module;
  return module;
}

/** @internal */
export function initializedWasmModule(): WebAssembly.Module | undefined {
  return activeModule;
}

/** @internal */
export function initializedWasmVariant(): WasmVariant | undefined {
  return activeVariant;
}

async function compileAsset(variant: WasmVariant): Promise<WebAssembly.Module> {
  const bytes = await loadAsset(variant);
  return WebAssembly.compile(bytes as BufferSource);
}

async function loadAsset(variant: WasmVariant): Promise<Uint8Array> {
  const url = new URL(`tokenizer.${variant}.wasm`, import.meta.url);
  if (url.protocol === "http:" || url.protocol === "https:") {
    if (typeof fetch !== "function")
      throw new Error(`Cannot load ${url}: fetch is unavailable.`);
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(
        `Unable to load ${url}: HTTP ${response.status} ${response.statusText}`,
      );
    return new Uint8Array(await response.arrayBuffer());
  }

  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    return new Uint8Array(await fs.readFile(url));
  }

  if (typeof fetch === "function") {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Unable to load ${url}: HTTP ${response.status}.`);
    return new Uint8Array(await response.arrayBuffer());
  }
  throw new Error(`Cannot load WebAssembly asset URL ${url}.`);
}
