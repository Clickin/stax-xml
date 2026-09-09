import {
  NEED_INPUT,
  type TokenCursorOptions,
  type TokenCursorResult,
  type TokenCursorSpi,
  type XmlDeclaration,
} from "stax-xml/experimental/backend";
import { XmlEventType } from "stax-xml";
import { initializedWasmModule } from "./loader.js";
import { TokenCursorWasmError, wasmErrorMessage } from "./errors.js";

type XmlEventTypeValue = Exclude<TokenCursorResult, typeof NEED_INPUT | null>;

const PAGE_BYTES = 64 * 1024;
const MAX_I32 = 0x7fffffff;
const UNSET = Symbol("unset");
type CachedValue = string | undefined | typeof UNSET;

interface RawExports {
  readonly memory: WebAssembly.Memory;
  initialize(documentMode: number, namespaceAware: number, autoDecode: number): void;
  reserve(length: number): number;
  commit(length: number, final: number): number;
  next(): number;
  tokenView(): number;
  lookupNamespace(ptr: number, length: number): void;
  scratch(length: number): number;
  addEntity(
    namePtr: number,
    nameLength: number,
    valuePtr: number,
    valueLength: number,
  ): number;
  errorCode(): number;
  errorPosition(): number;
  errorPtr(): number;
  errorLen(): number;
  dispose(): void;
  inputCapacity(): number;
}

const EVENT_TYPES: Readonly<Record<number, XmlEventTypeValue>> = {
  1: XmlEventType.START_DOCUMENT,
  2: XmlEventType.END_DOCUMENT,
  3: XmlEventType.START_ELEMENT,
  4: XmlEventType.END_ELEMENT,
  5: XmlEventType.CHARACTERS,
  6: XmlEventType.CDATA,
  7: XmlEventType.COMMENT,
  8: XmlEventType.PROCESSING_INSTRUCTION,
  9: XmlEventType.DTD,
};
const NAME_FIELDS = [0, 2, 3] as const;

const WASM_IMPORTS = {
  env: {
    abort(): never {
      throw new Error("WebAssembly tokenizer runtime aborted.");
    },
  },
};

/**
 * Primitive-ABI facade for one isolated tokenizer instance.
 *
 * UTF-8 bytes enter Wasm through `pushBytes`; only requested token spans are
 * decoded in JavaScript. Direct JavaScript strings intentionally stay on the
 * reference JS backend.
 */
export class TokenCursorWasm implements TokenCursorSpi {
  private readonly decoder = new TextDecoder("utf-8", { fatal: true });
  private readonly encoder = new TextEncoder();
  private readonly fields: CachedValue[] = new Array(13).fill(UNSET);
  private readonly fieldPointers: Array<number | undefined> = new Array(13);
  private readonly fieldLengths: Array<number | undefined> = new Array(13);
  private readonly attributes: Array<CachedValue[] | undefined> = [];
  private fieldDirtyMask = 0;
  private attributeDirtyMask = 0;
  private readonly namespaceMemo = new Map<string, string>();
  private raw: RawExports | undefined;
  private memoryBytes: Uint8Array | undefined;
  private memoryInts: Int32Array | undefined;
  private tokenViewAddress = 0;
  private tokenViewReady = false;
  private currentType: XmlEventTypeValue = XmlEventType.START_DOCUMENT;
  private finalInput = false;
  private declarationMemo: XmlDeclaration | undefined | typeof UNSET = UNSET;

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
    this.raw = raw;
    this.refreshMemory();
    try {
      raw.initialize(
        options.documentMode === "document" ? 1 : 0,
        options.namespaceAware === false ? 0 : 1,
        options.autoDecodeEntities === false ? 0 : 1,
      );
      this.refreshMemory();
      for (const entity of options.addEntities ?? []) {
        this.addEntity(entity.entity, entity.value);
      }
    } catch (error) {
      try {
        raw.dispose();
      } catch {
        /* Preserve the initialization failure. */
      }
      this.raw = undefined;
      this.memoryBytes = undefined;
      this.memoryInts = undefined;
      throw error;
    }
  }

  pushBytes(bytes: Uint8Array, final = false): void {
    const raw = this.requireRaw();
    if (this.finalInput) throw new Error("Cannot push after end of input.");
    if (!(bytes instanceof Uint8Array))
      throw new TypeError("Wasm input must be a Uint8Array.");
    if (bytes.byteLength > MAX_I32)
      throw new RangeError("Wasm input chunk exceeds the 32-bit ABI limit.");
    this.clearCaches();
    const address = raw.reserve(bytes.byteLength);
    this.refreshMemory();
    if (
      bytes.byteLength > 0 &&
      (address === 0 ||
        address > this.memoryBytes!.byteLength - bytes.byteLength)
    )
      this.throwRawError(raw.errorCode() || -2);
    this.memoryBytes!.set(bytes, address);
    const result = raw.commit(bytes.byteLength, final ? 1 : 0);
    if (result !== 0) this.throwRawError(result);
    this.finalInput = final;
  }

  next(): TokenCursorResult {
    const raw = this.raw;
    if (!raw) return null;
    this.clearCaches();
    const result = raw.next();
    if (result === -1) return NEED_INPUT;
    if (result === 0) return null;
    if (result === -2) this.throwRawError(result);
    const eventType = EVENT_TYPES[result];
    if (eventType === undefined)
      throw new Error(`Unknown WebAssembly tokenizer result ${result}.`);
    this.currentType = eventType;
    return eventType;
  }

  eventType(): XmlEventTypeValue {
    return this.currentType;
  }

  name(): string | undefined {
    return this.readField(0, 0);
  }

  text(): string | undefined {
    return this.readField(1, 0);
  }

  localName(): string | undefined {
    return this.readField(2, 0);
  }

  prefix(): string {
    return this.readField(3, 0) ?? "";
  }

  namespaceURI(): string {
    return this.readField(4, 0) ?? "";
  }

  attributeCount(): number {
    if (!this.raw) return 0;
    const count = this.headerWord(3);
    return count > 0 ? count : 0;
  }

  attributeName(index: number): string | undefined {
    return this.readAttribute(5, index);
  }

  attributeLocalName(index: number): string | undefined {
    return this.readAttribute(6, index);
  }

  attributePrefix(index: number): string | undefined {
    return this.readAttribute(7, index);
  }

  attributeNamespaceURI(index: number): string | undefined {
    return this.readAttribute(8, index);
  }

  attributeValue(index: number): string | undefined {
    return this.readAttribute(9, index);
  }

  selfClosing(): boolean {
    if (!this.raw) return false;
    return this.headerWord(4) !== 0;
  }

  documentDeclaration(): XmlDeclaration | undefined {
    if (this.declarationMemo !== UNSET) return this.declarationMemo;
    const version = this.readField(10, 0);
    if (version === undefined) {
      this.declarationMemo = undefined;
      return undefined;
    }
    const encoding = this.readField(11, 0);
    const standalone = this.headerWord(5);
    const declaration = {
      version: version as "1.0",
      ...(encoding === undefined ? {} : { encoding }),
      ...(standalone < 0 ? {} : { standalone: standalone !== 0 }),
    };
    this.declarationMemo = declaration;
    return declaration;
  }

  namespaceURIForPrefix(prefix: string): string {
    const known = this.namespaceMemo.get(prefix);
    if (known !== undefined) return known;
    if (!this.raw) return "";
    const encoded = this.encoder.encode(prefix);
    const raw = this.requireRaw();
    const address = raw.scratch(encoded.byteLength);
    this.refreshMemory();
    if (
      encoded.byteLength > 0 &&
      (address === 0 ||
        address > this.memoryBytes!.byteLength - encoded.byteLength)
    )
      this.throwRawError(raw.errorCode() || -2);
    this.memoryBytes!.set(encoded, address);
    this.fields[12] = UNSET;
    this.fieldPointers[12] = undefined;
    this.fieldLengths[12] = undefined;
    raw.lookupNamespace(address, encoded.byteLength);
    this.refreshMemory();
    const value = this.readField(12, 0) ?? "";
    this.namespaceMemo.set(prefix, value);
    return value;
  }

  /**
   * Return per-instance linear-memory diagnostics without exposing the raw
   * instance or any generated AssemblyScript bindings.
   */
  memoryStats(): { pages: number; inputCapacity: number } {
    const raw = this.raw;
    if (!raw) return { pages: 0, inputCapacity: 0 };
    this.refreshMemory();
    return {
      pages: this.memoryBytes!.byteLength / PAGE_BYTES,
      inputCapacity: Math.max(0, raw.inputCapacity()),
    };
  }

  dispose(): void {
    const raw = this.raw;
    if (!raw) return;
    try {
      raw.dispose();
    } finally {
      this.raw = undefined;
      this.memoryBytes = undefined;
      this.memoryInts = undefined;
      this.finalInput = true;
      this.clearCaches();
    }
  }

  private addEntity(name: string, value: string): void {
    const raw = this.requireRaw();
    const nameBytes = this.encoder.encode(name);
    const valueBytes = this.encoder.encode(value);
    const total = nameBytes.byteLength + valueBytes.byteLength;
    if (total > MAX_I32)
      throw new RangeError("Wasm entity definition exceeds the 32-bit ABI limit.");
    const address = raw.scratch(total);
    this.refreshMemory();
    if (
      total > 0 &&
      (address === 0 || address > this.memoryBytes!.byteLength - total)
    )
      this.throwRawError(raw.errorCode() || -2);
    this.memoryBytes!.set(nameBytes, address);
    this.memoryBytes!.set(valueBytes, address + nameBytes.byteLength);
    const result = raw.addEntity(
      address,
      nameBytes.byteLength,
      address + nameBytes.byteLength,
      valueBytes.byteLength,
    );
    if (result !== 0) this.throwRawError(result);
  }

  private readAttribute(field: number, index: number): string | undefined {
    if (!Number.isInteger(index) || index < 0 || index >= this.attributeCount())
      return undefined;
    const slot = field - 5;
    let cache = this.attributes[slot];
    if (!cache) {
      cache = [];
      this.attributes[slot] = cache;
    }
    this.attributeDirtyMask |= 1 << slot;
    const value = cache[index];
    if (index in cache && value !== UNSET) return value;

    this.ensureTokenView();
    let pointer: number;
    let length: number;
    let colon = -1;
    let inputPointer = 0;
    let nameOffset = 0;
    let nameLength = 0;
    if (field <= 7) {
      inputPointer = this.headerWord(2) >>> 0;
      nameOffset = this.readI32(this.headerWord(6) >>> 0, index) >>> 0;
      nameLength = this.readI32(this.headerWord(7) >>> 0, index);
      colon = this.readI32(this.headerWord(10) >>> 0, index);
      if (colon < 0 && (field === 5 || field === 6)) {
        const other = this.attributes[field === 5 ? 1 : 0];
        if (other && index in other && other[index] !== UNSET) {
          const decoded = other[index];
          cache[index] = decoded;
          return decoded;
        }
      }
    }
    switch (field) {
      case 5:
        pointer = inputPointer + nameOffset;
        length = nameLength;
        break;
      case 6: {
        if (colon < 0) {
          pointer = inputPointer + nameOffset;
          length = nameLength;
        } else {
          pointer = inputPointer + colon + 1;
          length = nameLength - (colon - nameOffset) - 1;
        }
        break;
      }
      case 7: {
        pointer = colon < 0 ? 0 : inputPointer + nameOffset;
        length = colon < 0 ? 0 : colon - nameOffset;
        break;
      }
      case 8:
        pointer = this.readI32(this.headerWord(11) >>> 0, index) >>> 0;
        length = this.readI32(this.headerWord(12) >>> 0, index);
        break;
      case 9:
        pointer = this.readI32(this.headerWord(8) >>> 0, index) >>> 0;
        length = this.readI32(this.headerWord(9) >>> 0, index);
        break;
      default:
        return undefined;
    }
    cache[index] = UNSET;
    const decoded = this.decodeSpan(pointer, length);
    cache[index] = decoded;
    return decoded;
  }

  private readField(field: number, index: number): string | undefined {
    if (index !== 0) return undefined;
    const cache = this.fields[field];
    if (cache !== UNSET) return cache;
    if (!this.raw) return undefined;
    this.ensureTokenView();
    const fieldPointers = this.headerWord(0) >>> 0;
    const fieldLengths = this.headerWord(1) >>> 0;
    const length = this.readI32(fieldLengths, field);
    const pointer =
      length < 0 ? 0 : this.readI32(fieldPointers, field) >>> 0;
    const decoded = this.decodeCurrentField(field, pointer, length);
    this.fields[field] = decoded;
    this.fieldDirtyMask |= 1 << field;
    this.fieldPointers[field] = pointer;
    this.fieldLengths[field] = length;
    return decoded;
  }

  private clearCaches(): void {
    for (let field = 0, mask = this.fieldDirtyMask; mask !== 0; field++, mask >>>= 1)
      if ((mask & 1) !== 0) this.fields[field] = UNSET;
    this.fieldDirtyMask = 0;
    for (let slot = 0, mask = this.attributeDirtyMask; mask !== 0; slot++, mask >>>= 1)
      if ((mask & 1) !== 0) this.attributes[slot]!.length = 0;
    this.attributeDirtyMask = 0;
    if (this.namespaceMemo.size !== 0) this.namespaceMemo.clear();
    this.declarationMemo = UNSET;
    this.tokenViewAddress = 0;
    this.tokenViewReady = false;
  }

  private refreshMemory(): void {
    const memory = this.raw?.memory;
    if (!memory) return;
    const buffer = memory.buffer;
    if (!this.memoryBytes || this.memoryBytes.buffer !== buffer) {
      this.memoryBytes = new Uint8Array(buffer);
      this.memoryInts = new Int32Array(buffer);
    }
  }

  private ensureTokenView(): void {
    if (this.tokenViewReady) return;
    const raw = this.requireRaw();
    const address = raw.tokenView();
    this.refreshMemory();
    const memoryInts = this.memoryInts;
    if (
      !Number.isInteger(address) ||
      address <= 0 ||
      address % 4 !== 0 ||
      !memoryInts ||
      address + 13 * 4 > memoryInts.byteLength
    )
      throw new Error("WebAssembly tokenizer returned an invalid token view.");
    this.tokenViewAddress = address;
    this.tokenViewReady = true;
  }

  private headerWord(offset: number): number {
    this.ensureTokenView();
    return this.memoryInts![(this.tokenViewAddress >>> 2) + offset]!;
  }

  private readI32(pointer: number, index: number): number {
    return this.memoryInts![(pointer >>> 2) + index]!;
  }

  private decodeCurrentField(
    field: number,
    pointer: number,
    length: number,
  ): string | undefined {
    if (length < 0) return undefined;
    if (length > MAX_I32)
      throw new RangeError("Wasm span exceeds the 32-bit ABI limit.");
    if (length === 0) return "";
    if (field === 0 || field === 2 || field === 3) {
      for (const other of NAME_FIELDS) {
        if (
          other !== field &&
          this.fields[other] !== UNSET &&
          this.fieldPointers[other] === pointer &&
          this.fieldLengths[other] === length
        )
          return this.fields[other] as string | undefined;
      }
    }
    return this.decodeSpan(pointer, length);
  }

  private decodeSpan(pointer: number, length: number): string | undefined {
    if (length < 0) return undefined;
    if (length > MAX_I32)
      throw new RangeError("Wasm span exceeds the 32-bit ABI limit.");
    if (length === 0) return "";
    // Views refresh after Wasm calls that can grow memory, not between JS getters.
    return this.decoder.decode(
      this.memoryBytes!.subarray(pointer, pointer + length),
    );
  }

  private requireRaw(): RawExports {
    const raw = this.raw;
    if (!raw)
      throw new Error("Wasm tokenizer has been disposed.");
    return raw;
  }

  private throwRawError(fallbackCode: number): never {
    const raw = this.requireRaw();
    const code = raw.errorCode() || fallbackCode;
    const positionValue = raw.errorPosition();
    const position = positionValue >= 0 ? positionValue : undefined;
    let message = "";
    const length = raw.errorLen();
    if (length > 0) {
      try {
        const pointer = raw.errorPtr();
        this.refreshMemory();
        message = this.decoder.decode(
          this.memoryBytes!.subarray(pointer, pointer + length),
        );
      } catch {
        message = "";
      }
    }
    throw new TokenCursorWasmError(
      message || wasmErrorMessage(code),
      code,
      position,
    );
  }
}

function validateExports(exports: WebAssembly.Exports): RawExports {
  const value = exports as Record<string, unknown>;
  const names = [
    "initialize",
    "reserve",
    "commit",
    "next",
    "tokenView",
    "lookupNamespace",
    "scratch",
    "addEntity",
    "errorCode",
    "errorPosition",
    "errorPtr",
    "errorLen",
    "dispose",
    "inputCapacity",
  ];
  for (const name of names) {
    if (typeof value[name] !== "function")
      throw new Error(`Wasm tokenizer module is missing export ${name}().`);
  }
  if (!(value.memory instanceof WebAssembly.Memory))
    throw new Error("Wasm tokenizer module is missing its exported memory.");
  return value as unknown as RawExports;
}

export { NEED_INPUT };
