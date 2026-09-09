import {
  XmlEventType,
  type XmlEventType as XmlEventTypeValue,
} from "../types.js";
import type {
  TokenBatch,
  TokenReadView,
  XmlDeclaration,
} from "../TokenCursor.js";
import type { NamespaceScopeNode } from "./NamespaceScope.js";
import { resolveScopePrefix } from "./NamespaceScope.js";

/** Numeric event codes used inside JS SoA columns (1..9 mirror the Wasm ABI). */
export const CODE_START_DOCUMENT = 1;
export const CODE_END_DOCUMENT = 2;
export const CODE_START_ELEMENT = 3;
export const CODE_END_ELEMENT = 4;
export const CODE_CHARACTERS = 5;
export const CODE_CDATA = 6;
export const CODE_COMMENT = 7;
export const CODE_PROCESSING_INSTRUCTION = 8;
export const CODE_DTD = 9;

const CODE_TO_TYPE: readonly XmlEventTypeValue[] = [
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

export function eventCodeToType(code: number): XmlEventTypeValue {
  return CODE_TO_TYPE[code - 1]!;
}

export function eventTypeToCode(type: XmlEventTypeValue): number {
  switch (type) {
    case XmlEventType.START_DOCUMENT:
      return CODE_START_DOCUMENT;
    case XmlEventType.END_DOCUMENT:
      return CODE_END_DOCUMENT;
    case XmlEventType.START_ELEMENT:
      return CODE_START_ELEMENT;
    case XmlEventType.END_ELEMENT:
      return CODE_END_ELEMENT;
    case XmlEventType.CHARACTERS:
      return CODE_CHARACTERS;
    case XmlEventType.CDATA:
      return CODE_CDATA;
    case XmlEventType.COMMENT:
      return CODE_COMMENT;
    case XmlEventType.PROCESSING_INSTRUCTION:
      return CODE_PROCESSING_INSTRUCTION;
    case XmlEventType.DTD:
      return CODE_DTD;
  }
}


/** How a JS slot turns raw spans into strings, mirroring the baseline cursor. */
export interface JsSlotDecoder {
  autoDecodeEntities: boolean;
  /** Decode a raw CHARACTERS slice (entity decode only for CHARACTERS). */
  decodeText(raw: string): string;
  /** Decode a raw attribute value (attribute = true). */
  decodeAttribute(raw: string): string;
}

/**
 * One reusable batch slot: SoA columns over completed tokens of one
 * `fillBatch()` result plus a flat attribute arena. The parser writes directly
 * into the arena range starting at `attrUsed` and commits a token record that
 * references that range; the view reads the selected slot columns.
 */
export class JsTokenSlot {
  /** Source string pinned for this slot generation. */
  source = "";

  tokenCount = 0;
  private tokenCapacity = 0;
  types = new Int8Array(0);
  names: Array<string | undefined> = [];
  localNames: Array<string | undefined> = [];
  prefixes: Array<string | undefined> = [];
  namespaceURIs: Array<string | undefined> = [];
  scopeHeads: Array<NamespaceScopeNode | undefined> = [];
  scopeVisible = new Uint8Array(0);
  textStarts = new Int32Array(0);
  textEnds = new Int32Array(0);
  textMemos: Array<string | undefined> = [];
  attrBases = new Int32Array(0);
  attrCounts = new Int32Array(0);
  flags = new Uint8Array(0); // bit 0 = self-closing

  /** Flat attribute arena, absolute indices shared by every token in slot. */
  attrUsed = 0;
  private attrCapacity = 0;
  attrNameStarts = new Int32Array(0);
  attrNameEnds = new Int32Array(0);
  attrValueStarts = new Int32Array(0);
  attrValueEnds = new Int32Array(0);
  attrColons = new Int32Array(0);
  attrNamespaceURIs: Array<string> = [];

  /** Release the slot for reuse in a later fill. */
  release(): void {
    this.source = "";
    this.tokenCount = 0;
    this.attrUsed = 0;
    clearRefs(this.names);
    clearRefs(this.localNames);
    clearRefs(this.prefixes);
    clearRefs(this.namespaceURIs);
    clearScopeRefs(this.scopeHeads);
    clearRefs(this.textMemos);
    clearRefs(this.attrNamespaceURIs);
  }

  private ensureTokenCapacity(required: number): void {
    if (required <= this.tokenCapacity) return;
    let capacity = this.tokenCapacity === 0 ? 8 : this.tokenCapacity;
    while (capacity < required) capacity *= 2;
    this.types = growInt8(this.types, capacity);
    this.scopeVisible = growUint8(this.scopeVisible, capacity);
    this.textStarts = growInt32(this.textStarts, capacity);
    this.textEnds = growInt32(this.textEnds, capacity);
    this.attrBases = growInt32(this.attrBases, capacity);
    this.attrCounts = growInt32(this.attrCounts, capacity);
    this.flags = growUint8(this.flags, capacity);
    this.tokenCapacity = capacity;
  }

  ensureAttributeCapacity(required: number): void {
    if (required <= this.attrCapacity) return;
    let capacity = this.attrCapacity === 0 ? 8 : this.attrCapacity;
    while (capacity < required) capacity *= 2;
    this.attrNameStarts = growInt32(this.attrNameStarts, capacity);
    this.attrNameEnds = growInt32(this.attrNameEnds, capacity);
    this.attrValueStarts = growInt32(this.attrValueStarts, capacity);
    this.attrValueEnds = growInt32(this.attrValueEnds, capacity);
    this.attrColons = growInt32(this.attrColons, capacity);
    this.attrCapacity = capacity;
  }

  /** Begin a token record; returns the absolute arena base to write into. */
  beginToken(
    type: number,
    source: string,
    attrBase: number,
    name: string | undefined,
    localName: string | undefined,
    prefix: string | undefined,
    namespaceURI: string | undefined,
    textStart: number,
    textEnd: number,
    selfClosing: boolean,
    scopeHead: NamespaceScopeNode | undefined,
    scopeVisible: boolean,
  ): void {
    const index = this.tokenCount;
    this.ensureTokenCapacity(index + 1);
    this.types[index] = type;
    this.names[index] = name;
    this.localNames[index] = localName;
    this.prefixes[index] = prefix;
    this.namespaceURIs[index] = namespaceURI;
    this.scopeHeads[index] = scopeHead;
    this.scopeVisible[index] = scopeVisible ? 1 : 0;
    this.textStarts[index] = textStart;
    this.textEnds[index] = textEnd;
    this.textMemos[index] = undefined;
    this.attrBases[index] = attrBase;
    this.attrCounts[index] = 0;
    this.flags[index] = selfClosing ? 1 : 0;
    void source;
    this.tokenCount = index + 1;
  }

  /** Record the count of attributes committed for the last token. */
  finishToken(attrCount: number, attrUsed: number): void {
    const index = this.tokenCount - 1;
    this.attrCounts[index] = attrCount;
    this.attrUsed = attrUsed;
  }
}

function clearRefs(values: Array<string | undefined>): void {
  for (let index = 0; index < values.length; index++)
    values[index] = undefined;
}
function clearScopeRefs(values: Array<NamespaceScopeNode | undefined>): void {
  for (let index = 0; index < values.length; index++)
    values[index] = undefined;
}

function growInt8(source: Int8Array<ArrayBufferLike>, capacity: number): Int8Array<ArrayBuffer> {
  const next = new Int8Array(capacity);
  next.set(source);
  return next;
}
function growUint8(source: Uint8Array<ArrayBufferLike>, capacity: number): Uint8Array<ArrayBuffer> {
  const next = new Uint8Array(capacity);
  next.set(source);
  return next;
}
function growInt32(source: Int32Array<ArrayBufferLike>, capacity: number): Int32Array<ArrayBuffer> {
  const next = new Int32Array(capacity);
  next.set(source);
  return next;
}

/**
 * Two reusable batch slots plus the stable current view. Production writes to
 * the slot that does not currently back the view; the first `select(0)` after a
 * positive fill switches the view to the produced slot.
 */
export class JsTokenBatch implements TokenBatch {
  readonly current: TokenReadView = new JsTokenReadView(this);
  readonly slots: [JsTokenSlot, JsTokenSlot] = [
    new JsTokenSlot(),
    new JsTokenSlot(),
  ];
  readonly decoder: JsSlotDecoder;
  /** Immutable document declaration shared by every slot once parsed. */
  declaration: XmlDeclaration | undefined;

  /** Slot the view currently reads (-1 until the first select). */
  viewSlot = -1;
  /** Token index inside `viewSlot` (-1 until the first select). */
  viewToken = -1;
  /** Slot of the most recent positive fillBatch result. */
  producedSlot = -1;
  producedCount = 0;

  constructor(decoder: JsSlotDecoder) {
    this.decoder = decoder;
  }

  /** Release a slot before refilling it. */
  releaseSlot(slotIndex: number): void {
    this.slots[slotIndex].release();
    if (this.producedSlot === slotIndex) {
      this.producedSlot = -1;
      this.producedCount = 0;
    }
    if (this.viewSlot === slotIndex) {
      this.viewSlot = -1;
      this.viewToken = -1;
    }
  }

  /** The slot the next fillBatch call should produce into. */
  fillTarget(): number {
    if (this.producedSlot >= 0 && this.viewSlot < 0) return this.producedSlot;
    return this.viewSlot === 0 ? 1 : 0;
  }

  select(index: number): XmlEventTypeValue {
    if (index < 0 || index >= this.producedCount || this.producedSlot < 0)
      throw new RangeError(`Invalid token batch index ${index}.`);
    this.viewSlot = this.producedSlot;
    this.viewToken = index;
    return eventCodeToType(this.slots[this.producedSlot]!.types[index]!);
  }

  /** Record the outcome of a fillBatch call. */
  setProduced(slotIndex: number, count: number): void {
    this.producedSlot = count > 0 ? slotIndex : -1;
    this.producedCount = count;
  }
}

class JsTokenReadView implements TokenReadView {
  constructor(private readonly batch: JsTokenBatch) {}

  eventType(): XmlEventTypeValue {
    const batch = this.batch;
    if (batch.viewSlot < 0 || batch.viewToken < 0)
      return XmlEventType.START_DOCUMENT;
    return eventCodeToType(
      batch.slots[batch.viewSlot]!.types[batch.viewToken]!,
    );
  }
  name(): string | undefined {
    return this.batch.slots[this.batch.viewSlot]?.names[this.batch.viewToken];
  }
  text(): string | undefined {
    const slot = this.batch.slots[this.batch.viewSlot];
    if (!slot || slot.textStarts[this.batch.viewToken]! < 0) return undefined;
    let memo = slot.textMemos[this.batch.viewToken];
    if (memo === undefined) {
      const raw = slot.source.slice(
        slot.textStarts[this.batch.viewToken]!,
        slot.textEnds[this.batch.viewToken]!,
      );
      memo =
        slot.types[this.batch.viewToken] === CODE_CHARACTERS
          ? this.batch.decoder.decodeText(raw)
          : raw;
      slot.textMemos[this.batch.viewToken] = memo;
    }
    return memo;
  }
  localName(): string | undefined {
    return this.batch.slots[this.batch.viewSlot]?.localNames[
      this.batch.viewToken
    ];
  }
  prefix(): string {
    return (
      this.batch.slots[this.batch.viewSlot]?.prefixes[this.batch.viewToken] ??
      ""
    );
  }
  namespaceURI(): string {
    return (
      this.batch.slots[this.batch.viewSlot]?.namespaceURIs[
        this.batch.viewToken
      ] ?? ""
    );
  }
  attributeCount(): number {
    return (
      this.batch.slots[this.batch.viewSlot]?.attrCounts[this.batch.viewToken] ??
      0
    );
  }
  attributeName(index: number): string | undefined {
    return this.attributeSlice(index, (slot, absolute) =>
      slot.source.slice(
        slot.attrNameStarts[absolute]!,
        slot.attrNameEnds[absolute]!,
      ),
    );
  }
  attributeLocalName(index: number): string | undefined {
    return this.attributeSlice(index, (slot, absolute) => {
      const colon = slot.attrColons[absolute]!;
      if (colon < 0)
        return slot.source.slice(
          slot.attrNameStarts[absolute]!,
          slot.attrNameEnds[absolute]!,
        );
      return slot.source.slice(colon + 1, slot.attrNameEnds[absolute]!);
    });
  }
  attributePrefix(index: number): string | undefined {
    return this.attributeSlice(index, (slot, absolute) => {
      const colon = slot.attrColons[absolute]!;
      if (colon < 0) return "";
      return slot.source.slice(slot.attrNameStarts[absolute]!, colon);
    });
  }
  attributeNamespaceURI(index: number): string | undefined {
    const slot = this.batch.slots[this.batch.viewSlot];
    const absolute = this.attributeAbsolute(index, slot);
    if (absolute < 0) return undefined;
    return slot.attrNamespaceURIs[absolute];
  }
  attributeValue(index: number): string | undefined {
    const slot = this.batch.slots[this.batch.viewSlot];
    const absolute = this.attributeAbsolute(index, slot);
    if (absolute < 0) return undefined;
    const raw = slot.source.slice(
      slot.attrValueStarts[absolute]!,
      slot.attrValueEnds[absolute]!,
    );
    return this.batch.decoder.decodeAttribute(raw);
  }
  selfClosing(): boolean {
    return (
      (this.batch.slots[this.batch.viewSlot]?.flags[this.batch.viewToken] ??
        0) !== 0
    );
  }
  documentDeclaration(): XmlDeclaration | undefined {
    return this.batch.declaration;
  }
  namespaceURIForPrefix(prefix: string): string {
    const slot = this.batch.slots[this.batch.viewSlot];
    if (!slot || slot.scopeVisible[this.batch.viewToken] !== 1) return "";
    return (
      resolveScopePrefix(slot.scopeHeads[this.batch.viewToken], prefix) ?? ""
    );
  }

  private attributeAbsolute(
    index: number,
    slot: JsTokenSlot | undefined,
  ): number {
    if (!slot || index < 0) return -1;
    const count = slot.attrCounts[this.batch.viewToken]!;
    if (index >= count) return -1;
    return slot.attrBases[this.batch.viewToken]! + index;
  }

  private attributeSlice(
    index: number,
    read: (slot: JsTokenSlot, absolute: number) => string | undefined,
  ): string | undefined {
    const slot = this.batch.slots[this.batch.viewSlot];
    const absolute = this.attributeAbsolute(index, slot);
    if (absolute < 0) return undefined;
    return read(slot!, absolute);
  }
}
