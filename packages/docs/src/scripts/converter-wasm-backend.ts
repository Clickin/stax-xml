import type { AnyXmlEvent } from 'stax-xml';
import { StaxXmlWasmIterableParser } from 'stax-xml/runtime';
import type { ParseOptions } from 'stax-xml/converter';

type ConverterSchema = {
  parse(input: string | Iterator<AnyXmlEvent>, options?: ParseOptions): Promise<unknown>;
  parseSync(input: string | Iterator<AnyXmlEvent>, options?: ParseOptions): unknown;
  compile?(): ConverterSchema;
};

type WasmModule = {
  parseSpanTableStringUtf16(input: string): ArrayBufferView | ArrayBuffer;
};

type BrowserBufferConstructor = {
  (): never;
  from(input: ArrayBufferLike | ArrayBufferView | readonly number[] | string, byteOffset?: number, length?: number): Uint8Array;
  alloc(size: number): Uint8Array;
  allocUnsafe(size: number): Uint8Array;
  isBuffer(value: unknown): value is Uint8Array;
};

export type ConverterBackendPreference = 'wasm' | 'js';

export type ConverterBackendInfo = {
  kind: 'wasm' | 'js';
  label: string;
  detail: string;
};

export type ConverterBackendResult = {
  result: unknown;
  backend: ConverterBackendInfo;
  timings: {
    wasmImportMs?: number;
    wasmSpanTableMs?: number;
    wasmSchemaCompileMs?: number;
    wasmEventCount?: number;
    wasmAttrCount?: number;
    wasmTableBytes?: number;
    fallbackReason?: string;
  };
};

export const JS_CONVERTER_BACKEND: ConverterBackendInfo = {
  kind: 'js',
  label: 'JS fallback',
  detail: 'The converter demo uses the JavaScript parser/converter path.'
};

export const WASM_CONVERTER_BACKEND: ConverterBackendInfo = {
  kind: 'wasm',
  label: 'Wasm span-table',
  detail: 'The demo uses @stax-xml/native-wasm32-wasi to build an explicit iterable parser and runs the converter through its compiled dispatch path.'
};

const LOG_PREFIX = '[stax-xml converter wasm]';

let wasmModulePromise: Promise<WasmModule> | undefined;

export async function parseTextWithSelectedConverterBackend(
  schema: ConverterSchema,
  xmlInput: string,
  parseOptions: ParseOptions | undefined,
  fallbackMode: 'sync' | 'async',
  backendPreference: ConverterBackendPreference
): Promise<ConverterBackendResult> {
  if (backendPreference === 'js') {
    return parseTextWithJsConverterBackend(schema, xmlInput, parseOptions, fallbackMode);
  }

  try {
    return await parseTextWithWasmConverterBackend(schema, xmlInput, parseOptions);
  } catch (error) {
    const fallbackReason = error instanceof Error ? error.message : String(error);
    console.warn(`${LOG_PREFIX} fallback`, error);
    const fallback = await parseTextWithJsConverterBackend(schema, xmlInput, parseOptions, fallbackMode);

    return {
      ...fallback,
      timings: { ...fallback.timings, fallbackReason }
    };
  }
}

async function parseTextWithWasmConverterBackend(
  schema: ConverterSchema,
  xmlInput: string,
  parseOptions: ParseOptions | undefined
): Promise<ConverterBackendResult> {
  const importStart = performance.now();
  const wasm = await loadWasmModule();
  const wasmImportMs = performance.now() - importStart;

  const spanStart = performance.now();
  const table = wasm.parseSpanTableStringUtf16(xmlInput);
  const parser = StaxXmlWasmIterableParser.fromSpanTable(xmlInput, table, {
    decodeEntities: parseOptions?.decodeEntities,
  });
  const wasmSpanTableMs = performance.now() - spanStart;
  const compileStart = performance.now();
  const acceleratedSchema = typeof schema.compile === 'function' ? schema.compile() : schema;
  const wasmSchemaCompileMs = performance.now() - compileStart;
  const result = await acceleratedSchema.parse(parser, parseOptions);

  const timings = {
    wasmImportMs,
    wasmSpanTableMs,
    wasmSchemaCompileMs,
    wasmEventCount: parser.eventCount,
    wasmAttrCount: parser.attrCount,
    wasmTableBytes: parser.spanTableBytes
  };

  console.info(`${LOG_PREFIX} ok`, timings);
  return {
    result,
    backend: WASM_CONVERTER_BACKEND,
    timings
  };
}

async function parseTextWithJsConverterBackend(
  schema: ConverterSchema,
  xmlInput: string,
  parseOptions: ParseOptions | undefined,
  fallbackMode: 'sync' | 'async'
): Promise<ConverterBackendResult> {
  const result = fallbackMode === 'sync'
    ? schema.parseSync(xmlInput, parseOptions)
    : await schema.parse(xmlInput, parseOptions);

  return {
    result,
    backend: JS_CONVERTER_BACKEND,
    timings: {}
  };
}

function loadWasmModule(): Promise<WasmModule> {
  installBrowserBufferViewPolyfill();
  wasmModulePromise ??= import('@stax-xml/native-wasm32-wasi') as Promise<WasmModule>;
  return wasmModulePromise;
}

function installBrowserBufferViewPolyfill(): void {
  const globalWithBuffer = globalThis as unknown as { Buffer?: unknown };
  if (typeof globalWithBuffer.Buffer === 'function') {
    return;
  }

  const BufferPolyfill = function Buffer(): never {
    throw new TypeError('Buffer constructor is not available in this browser demo.');
  } as BrowserBufferConstructor;

  BufferPolyfill.from = (input, byteOffset = 0, length) => {
    if (typeof input === 'string') {
      return new TextEncoder().encode(input);
    }

    if (ArrayBuffer.isView(input)) {
      const viewOffset = input.byteOffset + byteOffset;
      const viewLength = length ?? input.byteLength - byteOffset;
      return new Uint8Array(input.buffer, viewOffset, viewLength);
    }

    if (isArrayBufferLike(input)) {
      return new Uint8Array(input, byteOffset, length);
    }

    return Uint8Array.from(input);
  };
  BufferPolyfill.alloc = (size) => new Uint8Array(size);
  BufferPolyfill.allocUnsafe = (size) => new Uint8Array(size);
  BufferPolyfill.isBuffer = (value): value is Uint8Array => value instanceof Uint8Array;
  globalWithBuffer.Buffer = BufferPolyfill;
}

function isArrayBufferLike(value: unknown): value is ArrayBufferLike {
  return value instanceof ArrayBuffer
    || (typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer);
}
