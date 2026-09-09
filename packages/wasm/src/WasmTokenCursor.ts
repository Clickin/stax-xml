import {
  NEED_INPUT,
  type TokenCursor,
  type TokenAdvanceResult,
  type TokenCursorOptions,
  type TokenFillResult,
  type XmlDeclaration,
} from "stax-xml/experimental/backend";
import type { XmlEventType } from "stax-xml";
import { initializedWasmModule } from "./loader.js";
import { TokenCursorWasmError, wasmErrorMessage } from "./errors.js";
import { WasmTokenBatch } from "./WasmTokenBatch.js";
import {
  WASM_ABI_VERSION,
  WASM_CONTROL_BYTES,
} from "./abi.generated.js";

const PAGE_BYTES = 64 * 1024;
const MAX_I32 = 0x7fffffff;
const CONTROL_BYTES = WASM_CONTROL_BYTES;

const ERROR = -2;

interface RawExports {
  readonly memory: WebAssembly.Memory;
  abiVersion(): number;
  initialize(documentMode: number, namespaceAware: number, autoDecode: number): number;
  reserve(length: number): number;
  commit(length: number, final: number): number;
  nextBatch(slotId: number, maxTokens: number, maxAttributes: number, maxScanBytes: number, maxTransientBytes: number): number;
  scratch(length: number): number;
  addEntity(namePtr: number, nameLength: number, valuePtr: number, valueLength: number): number;
  dispose(): void;
}

const WASM_IMPORTS = {
  env: {
    abort(): never {
      throw new Error("WebAssembly tokenizer runtime aborted.");
    },
  },
};

/** Wasm producer with local descriptor reads and lazy JS string decoding. */
export class WasmTokenCursor implements TokenCursor {
  readonly batch: WasmTokenBatch;
  private readonly decoder = new TextDecoder("utf-8", { fatal: true });
  private readonly encoder = new TextEncoder();
  private raw: RawExports | undefined;
  private memoryBytes: Uint8Array;
  private controlPtr: number;
  private finalInput = false;
  private firstBatch = true;
  private disposed = false;

  constructor(
    options: TokenCursorOptions = {},
    module: WebAssembly.Module | undefined = initializedWasmModule(),
  ) {
    if (module === undefined)
      throw new Error(
        "Wasm tokenizer is not initialized; call initWasm() before parsing UTF-8 bytes.",
      );
    const instance = new WebAssembly.Instance(module, WASM_IMPORTS);
    const raw = validateExports(instance.exports);
    if (raw.abiVersion() !== WASM_ABI_VERSION)
      throw new Error("Unsupported Wasm tokenizer ABI version.");
    this.raw = raw;
    this.memoryBytes = new Uint8Array(raw.memory.buffer);
    this.controlPtr = raw.initialize(
      options.documentMode === "document" ? 1 : 0,
      options.namespaceAware === false ? 0 : 1,
      options.autoDecodeEntities === false ? 0 : 1,
    );
    this.refreshMemory();
    if (
      !Number.isSafeInteger(this.controlPtr) ||
      this.controlPtr <= 0 ||
      this.controlPtr + CONTROL_BYTES > this.memoryBytes.byteLength
    )
      throw new Error("WebAssembly tokenizer returned an invalid control block.");
    this.batch = new WasmTokenBatch(
      () => this.memoryBytes,
      () => this.decoder,
    );
    try {
      for (const entity of options.addEntities ?? [])
        this.addEntity(entity.entity, entity.value);
    } catch (error) {
      try { raw.dispose(); } catch { /* preserve initialization failure */ }
      this.raw = undefined;
      this.disposed = true;
      throw error;
    }
  }

  pushBytes(bytes: Uint8Array, final = false): void {
    const raw = this.requireRaw();
    if (this.finalInput) throw new Error("Cannot push after end of input.");
    if (this.batch.hasUnselectedBatch || this.batch.hasPendingTokens)
      throw new Error("Cannot push input while a token batch is pending.");
    if (!(bytes instanceof Uint8Array)) throw new TypeError("Wasm input must be a Uint8Array.");
    if (bytes.byteLength > MAX_I32)
      throw new RangeError("Wasm input chunk exceeds the 32-bit ABI limit.");
    const address = raw.reserve(bytes.byteLength);
    this.refreshMemory();
    if (
      bytes.byteLength > 0 &&
      (address <= 0 || address > this.memoryBytes.byteLength - bytes.byteLength)
    )
      this.throwRawError(ERROR);
    this.memoryBytes.set(bytes, address);
    const result = raw.commit(bytes.byteLength, final ? 1 : 0);
    this.refreshMemory();
    if (result !== 0) this.throwRawError(result);
    this.finalInput = final;
  }

  fillBatch(): TokenFillResult {
    if (this.disposed) return null;
    const raw = this.requireRaw();
    if (!this.batch.isConsumed)
      throw new Error("Token batch must be consumed before refill.");
    const slot = this.batch.targetSlot();
    const maxTokens = this.firstBatch ? 1 : 128;
    const result = raw.nextBatch(slot, maxTokens, 1024, 64 * 1024, 256 * 1024);
    this.refreshMemory();
    if (result > 0) {
      const tokenPtr = this.controlWord(8);
      const attrPtr = this.controlWord(9);
      const attrCount = this.controlWord(10);
      this.batch.setProduced(slot, result, tokenPtr, attrPtr, attrCount);
      this.firstBatch = false;
      return result;
    }
    this.batch.clearProduced();
    if (result === -1) return NEED_INPUT;
    if (result === 0) return null;
    this.throwRawError(result);
  }

  /** @internal Compatibility path; readers use TokenCursorConsumer. */
  next(): TokenAdvanceResult {
    if (this.batch.hasUnselectedBatch) return this.batch.select(0);
    if (this.batch.hasPendingTokens)
      return this.batch.select(this.batch.selectedToken + 1);
    const result = this.fillBatch();
    if (result === NEED_INPUT || result === null) return result;
    return this.batch.select(0);
  }

  eventType(): XmlEventType { return this.batch.current.eventType(); }
  name(): string | undefined { return this.batch.current.name(); }
  text(): string | undefined { return this.batch.current.text(); }
  localName(): string | undefined { return this.batch.current.localName(); }
  prefix(): string { return this.batch.current.prefix(); }
  namespaceURI(): string { return this.batch.current.namespaceURI(); }
  attributeCount(): number { return this.batch.current.attributeCount(); }
  attributeName(index: number): string | undefined { return this.batch.current.attributeName(index); }
  attributeLocalName(index: number): string | undefined { return this.batch.current.attributeLocalName(index); }
  attributePrefix(index: number): string | undefined { return this.batch.current.attributePrefix(index); }
  attributeNamespaceURI(index: number): string | undefined { return this.batch.current.attributeNamespaceURI(index); }
  attributeValue(index: number): string | undefined { return this.batch.current.attributeValue(index); }
  selfClosing(): boolean { return this.batch.current.selfClosing(); }
  documentDeclaration(): XmlDeclaration | undefined { return this.batch.current.documentDeclaration(); }
  namespaceURIForPrefix(prefix: string): string { return this.batch.current.namespaceURIForPrefix(prefix); }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try { this.raw?.dispose(); }
    finally {
      this.raw = undefined;
      this.finalInput = true;
      this.memoryBytes = new Uint8Array(0);
      this.batch.clearProduced();
    }
  }

  memoryStats(): { pages: number; inputCapacity: number } {
    const raw = this.raw;
    if (!raw) return { pages: 0, inputCapacity: 0 };
    this.refreshMemory();
    return { pages: this.memoryBytes.byteLength / PAGE_BYTES, inputCapacity: this.controlWord(15) >>> 0 };
  }

  private addEntity(name: string, value: string): void {
    const raw = this.requireRaw();
    const nameBytes = this.encoder.encode(name);
    const valueBytes = this.encoder.encode(value);
    const total = nameBytes.byteLength + valueBytes.byteLength;
    if (total > MAX_I32) throw new RangeError("Wasm entity definition exceeds the 32-bit ABI limit.");
    const pointer = raw.scratch(total);
    this.refreshMemory();
    if (total > 0 && (pointer <= 0 || pointer > this.memoryBytes.byteLength - total))
      this.throwRawError(ERROR);
    this.memoryBytes.set(nameBytes, pointer);
    this.memoryBytes.set(valueBytes, pointer + nameBytes.byteLength);
    const result = raw.addEntity(pointer, nameBytes.byteLength, pointer + nameBytes.byteLength, valueBytes.byteLength);
    this.refreshMemory();
    if (result !== 0) this.throwRawError(result);
  }

  private controlWord(word: number): number {
    const offset = this.controlPtr + word * 4;
    if (offset < 0 || offset + 4 > this.memoryBytes.byteLength)
      throw new Error("WebAssembly tokenizer returned an invalid control block.");
    return new DataView(this.memoryBytes.buffer).getInt32(offset, true);
  }

  private refreshMemory(): void {
    const memory = this.raw?.memory;
    if (memory && this.memoryBytes.buffer !== memory.buffer)
      this.memoryBytes = new Uint8Array(memory.buffer);
  }

  private requireRaw(): RawExports {
    const raw = this.raw;
    if (!raw) throw new Error("Wasm tokenizer has been disposed.");
    return raw;
  }

  private throwRawError(fallbackCode: number): never {
    const code = this.controlWord(11) || fallbackCode;
    const position = this.controlWord(12);
    let message = "";
    const pointer = this.controlWord(13) >>> 0;
    const length = this.controlWord(14);
    if (length > 0) {
      if (pointer > this.memoryBytes.byteLength - length)
        throw new Error("WebAssembly tokenizer returned an invalid error span.");
      message = this.decoder.decode(this.memoryBytes.subarray(pointer, pointer + length));
    }
    throw new TokenCursorWasmError(message || wasmErrorMessage(code), code, position >= 0 ? position : undefined);
  }
}

function validateExports(exports: WebAssembly.Exports): RawExports {
  const value = exports as Record<string, unknown>;
  for (const name of ["abiVersion", "initialize", "reserve", "commit", "nextBatch", "scratch", "addEntity", "dispose"])
    if (typeof value[name] !== "function") throw new Error(`Wasm tokenizer module is missing export ${name}().`);
  if (!(value.memory instanceof WebAssembly.Memory))
    throw new Error("Wasm tokenizer module is missing its exported memory.");
  return value as unknown as RawExports;
}

export { NEED_INPUT };
