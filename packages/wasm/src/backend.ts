import {
  jsTokenBackendFactory,
  withTokenBackend,
  type TokenBackendFactory,
  type TokenCursorOptions,
  type TokenCursor,
  type TokenInputSessionSpi,
} from "stax-xml/experimental/backend";
import { WasmTokenCursor } from "./WasmTokenCursor.js";
import { initializedWasmModule } from "./loader.js";

export type WasmTokenInputOptions = TokenCursorOptions & {
  encoding: string;
};

/**
 * Byte session that forwards UTF-8 chunks directly to one Wasm cursor.
 */
export class WasmTokenInputSession implements TokenInputSessionSpi {
  readonly cursor: WasmTokenCursor;

  constructor(
    options: Partial<WasmTokenInputOptions> = {},
    module: WebAssembly.Module | undefined = initializedWasmModule(),
  ) {
    if (
      options.encoding !== undefined &&
      !isUtf8Encoding(options.encoding)
    )
      throw new RangeError(
        `WasmTokenInputSession only accepts UTF-8, got ${options.encoding}.`,
      );
    this.cursor = new WasmTokenCursor(options, module);
  }

  pushBytes(bytes: Uint8Array, final = false): void {
    this.cursor.pushBytes(bytes, final);
  }

  dispose(): void {
    this.cursor.dispose();
  }
}

/**
 * Experimental factory: UTF-8 bytes use Wasm after explicit initialization;
 * strings and all other TextDecoder labels retain the JS implementation.
 */
export const wasmTokenBackendFactory: TokenBackendFactory = {
  apiVersion: 2,
  createStringCursor(input: string, options: TokenCursorOptions): TokenCursor {
    return jsTokenBackendFactory.createStringCursor(input, options);
  },
  createByteSession(options: WasmTokenInputOptions): TokenInputSessionSpi {
    if (!isUtf8Encoding(options.encoding))
      return jsTokenBackendFactory.createByteSession(options);
    if (initializedWasmModule() === undefined)
      throw new Error(
        "Wasm tokenizer is not initialized; call initWasm() before parsing UTF-8 bytes.",
      );
    return new WasmTokenInputSession(options);
  },
};

/**
 * Clone reader/converter options and carry the experimental backend through
 * the stable implementation's non-enumerable Symbol.for seam.
 */
export function withWasmBackend<T extends object = Record<string, never>>(
  options?: T,
): T {
  const clone = { ...(options ?? ({} as T)) } as T;
  return withTokenBackend(clone, wasmTokenBackendFactory);
}

function isUtf8Encoding(label: unknown): boolean {
  if (typeof label !== "string") return false;
  const normalized = asciiTrim(label).toLowerCase();
  return (
    normalized === "utf-8" ||
    normalized === "utf8" ||
    normalized === "unicode-1-1-utf-8" ||
    normalized === "unicode11utf8" ||
    normalized === "unicode20utf8" ||
    normalized === "x-unicode20utf8"
  );
}

function asciiTrim(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && isAsciiWhitespace(value.charCodeAt(start))) start++;
  while (end > start && isAsciiWhitespace(value.charCodeAt(end - 1))) end--;
  return value.slice(start, end);
}

function isAsciiWhitespace(code: number): boolean {
  return code === 9 || code === 10 || code === 12 || code === 13 || code === 32;
}
