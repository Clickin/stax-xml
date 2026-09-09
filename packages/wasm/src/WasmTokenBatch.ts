import { XmlEventType, type XmlEventType as XmlEventTypeValue } from "stax-xml";
import type {
  TokenBatch,
  TokenReadView,
  XmlDeclaration,
} from "stax-xml/experimental/backend";
import {
  WASM_ATTRIBUTE_STRIDE,
  WASM_TOKEN_STRIDE,
} from "./abi.generated.js";


const UNSELECTED = -1;

const EVENT_TYPES: readonly XmlEventTypeValue[] = [
  XmlEventType.START_DOCUMENT,
  XmlEventType.END_DOCUMENT,
  XmlEventType.START_ELEMENT,
  XmlEventType.END_ELEMENT,
  XmlEventType.CHARACTERS,
  XmlEventType.CDATA,
  XmlEventType.COMMENT,
  XmlEventType.PROCESSING_INSTRUCTION,
  XmlEventType.DTD,
];

interface WasmBatchSlot {
  tokenPtr: number;
  attrPtr: number;
  tokenCount: number;
  attrCount: number;
}

export class WasmTokenBatch implements TokenBatch {
  readonly current: TokenReadView = new WasmTokenReadView(this);
  readonly slots: [WasmBatchSlot, WasmBatchSlot] = [emptySlot(), emptySlot()];
  private viewSlot = UNSELECTED;
  private viewToken = UNSELECTED;
  private producedSlot = UNSELECTED;
  private producedCount = 0;
  private readonly namespaceMemo = new Map<string, string>();
  private declarationMemo: XmlDeclaration | undefined | null = null;
  private declarationPtr = 0;

  constructor(
    private readonly getBytes: () => Uint8Array,
    private readonly getDecoder: () => TextDecoder,
  ) {}

  targetSlot(): number {
    return this.viewSlot === 0 ? 1 : 0;
  }

  setProduced(
    slot: number,
    tokenCount: number,
    tokenPtr: number,
    attrPtr: number,
    attrCount: number,
  ): void {
    const target = this.slots[slot];
    target.tokenPtr = tokenPtr;
    target.attrPtr = attrPtr;
    target.tokenCount = tokenCount;
    target.attrCount = attrCount;
    if (this.declarationPtr === 0 && tokenCount > 0)
      this.declarationPtr = this.u32(tokenPtr + 60);
    this.producedSlot = tokenCount > 0 ? slot : UNSELECTED;
    this.producedCount = tokenCount;
  }

  clearProduced(): void {
    this.producedSlot = UNSELECTED;
    this.producedCount = 0;
  }

  select(index: number): XmlEventTypeValue {
    if (
      this.producedSlot < 0 ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.producedCount
    )
      throw new RangeError(`Invalid token batch index ${index}.`);
    this.viewSlot = this.producedSlot;
    this.viewToken = index;
    this.namespaceMemo.clear();
    return EVENT_TYPES[this.tokenWord(0) - 1]!;
  }

  get selectedSlot(): number { return this.viewSlot; }
  get selectedToken(): number { return this.viewToken; }
  get hasUnselectedBatch(): boolean { return this.producedSlot >= 0 && this.viewSlot < 0; }
  get hasPendingTokens(): boolean {
    return this.producedSlot >= 0 && this.viewToken >= 0 && this.viewToken < this.producedCount - 1;
  }
  get isConsumed(): boolean {
    return this.producedSlot < 0 || this.viewToken >= this.producedCount - 1;
  }

  tokenWord(word: number): number {
    const slot = this.selected();
    return this.i32(slot.tokenPtr + this.viewToken * WASM_TOKEN_STRIDE + word * 4);
  }

  tokenSpan(field: number): [number, number] {
    const record = this.selected().tokenPtr + this.viewToken * WASM_TOKEN_STRIDE;
    return [this.u32(record + (4 + field * 2) * 4), this.i32(record + (5 + field * 2) * 4)];
  }

  attributeSpan(field: number, index: number): [number, number] {
    const slot = this.selected();
    const count = this.tokenWord(3);
    if (!Number.isInteger(index) || index < 0 || index >= count)
      return [0, -1];
    const base = this.tokenWord(2);
    const record = slot.attrPtr + (base + index) * WASM_ATTRIBUTE_STRIDE;
    return [this.u32(record + field * 8), this.i32(record + field * 8 + 4)];
  }

  decodeSpan(pointer: number, length: number): string | undefined {
    if (length < 0) return undefined;
    if (length === 0) return "";
    const bytes = this.getBytes();
    if (
      !Number.isSafeInteger(pointer) ||
      pointer < 0 ||
      pointer > bytes.byteLength - length
    )
      throw new Error("WebAssembly tokenizer returned an invalid span.");
    return this.getDecoder().decode(bytes.subarray(pointer, pointer + length));
  }

  readField(field: number): string | undefined {
    const [pointer, length] = this.tokenSpan(field);
    return this.decodeSpan(pointer, length);
  }

  readAttribute(field: number, index: number): string | undefined {
    const [pointer, length] = this.attributeSpan(field, index);
    return this.decodeSpan(pointer, length);
  }

  readScope(prefix: string): string {
    const cached = this.namespaceMemo.get(prefix);
    if (cached !== undefined) return cached;
    const scope = this.tokenWord(14) >>> 0;
    if (scope === 0) return "";
    const wanted = new TextEncoder().encode(prefix);
    const bytes = this.getBytes();
    for (let node = scope; node !== 0; node = this.u32(node)) {
      const prefixPtr = this.u32(node + 8);
      const prefixLen = this.i32(node + 12);
      if (prefixLen !== wanted.byteLength) continue;
      let equal = true;
      for (let i = 0; i < prefixLen; i++) {
        if (bytes[prefixPtr + i] !== wanted[i]) { equal = false; break; }
      }
      if (equal) {
        const uri = this.decodeSpan(this.u32(node + 16), this.i32(node + 20)) ?? "";
        this.namespaceMemo.set(prefix, uri);
        return uri;
      }
    }
    this.namespaceMemo.set(prefix, "");
    return "";
  }

  declaration(): XmlDeclaration | undefined {
    if (this.declarationMemo !== null) return this.declarationMemo;
    const pointer = this.declarationPtr;
    if (pointer === 0) return undefined;
    const version = this.decodeSpan(this.u32(pointer), this.i32(pointer + 4));
    if (version === undefined) return undefined;
    const encoding = this.decodeSpan(this.u32(pointer + 8), this.i32(pointer + 12));
    const standalone = this.i32(pointer + 16);
    this.declarationMemo = {
      version: version as "1.0",
      ...(encoding === undefined ? {} : { encoding }),
      ...(standalone < 0 ? {} : { standalone: standalone !== 0 }),
    };
    return this.declarationMemo;
  }

  private selected(): WasmBatchSlot {
    if (this.viewSlot < 0 || this.viewToken < 0)
      throw new Error("No token is selected.");
    return this.slots[this.viewSlot]!;
  }

  private i32(offset: number): number {
    return new DataView(this.getBytes().buffer).getInt32(offset, true);
  }

  private u32(offset: number): number {
    return new DataView(this.getBytes().buffer).getUint32(offset, true);
  }
}

class WasmTokenReadView implements TokenReadView {
  constructor(private readonly batch: WasmTokenBatch) {}

  eventType(): XmlEventTypeValue {
    if (this.batch.selectedSlot < 0) return XmlEventType.START_DOCUMENT;
    return EVENT_TYPES[this.batch.tokenWord(0) - 1]!;
  }
  name(): string | undefined { return this.batch.readField(0); }
  text(): string | undefined { return this.batch.readField(1); }
  localName(): string | undefined { return this.batch.readField(2); }
  prefix(): string { return this.batch.readField(3) ?? ""; }
  namespaceURI(): string { return this.batch.readField(4) ?? ""; }
  attributeCount(): number { return this.batch.selectedSlot < 0 ? 0 : this.batch.tokenWord(3); }
  attributeName(index: number): string | undefined { return this.batch.readAttribute(0, index); }
  attributeLocalName(index: number): string | undefined { return this.batch.readAttribute(2, index); }
  attributePrefix(index: number): string | undefined { return this.batch.readAttribute(3, index); }
  attributeNamespaceURI(index: number): string | undefined { return this.batch.readAttribute(4, index); }
  attributeValue(index: number): string | undefined { return this.batch.readAttribute(1, index); }
  selfClosing(): boolean { return this.batch.selectedSlot >= 0 && (this.batch.tokenWord(1) & 1) !== 0; }
  documentDeclaration(): XmlDeclaration | undefined { return this.batch.selectedSlot < 0 ? undefined : this.batch.declaration(); }
  namespaceURIForPrefix(prefix: string): string {
    if (this.batch.selectedSlot < 0 || (this.batch.tokenWord(1) & 2) === 0) return "";
    return this.batch.readScope(prefix);
  }
}

function emptySlot(): WasmBatchSlot {
  return { tokenPtr: 0, attrPtr: 0, tokenCount: 0, attrCount: 0 };
}
