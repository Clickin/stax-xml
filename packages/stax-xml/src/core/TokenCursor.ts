import type { DocumentMode, XmlEventType } from "./types.js";

/**
 * Sentinel returned by a batched token producer when it needs more input.
 *
 * `Symbol.for` is intentional: the stable and experimental bundles are built
 * separately, but their readers must still recognize the same sentinel.
 */
export const NEED_INPUT = Symbol.for("stax-xml.need-input");

/** Version of the experimental tokenizer backend contract. */
export const TOKEN_BACKEND_API_VERSION = 2 as const;

export interface TokenCursorOptions {
  documentMode?: DocumentMode;
  namespaceAware?: boolean;
  autoDecodeEntities?: boolean;
  addEntities?: { entity: string; value: string }[];
}

export interface XmlDeclaration {
  version: "1.0";
  encoding?: string;
  standalone?: boolean;
}

export interface TokenAttribute {
  name: string;
  value: string;
  localName: string;
  prefix: string;
  namespaceURI: string;
}

/**
 * Result of one `fillBatch()` call: a positive safe integer token count, the
 * `NEED_INPUT` sentinel when more input is required, or `null` for EOF. Zero is
 * never a valid count.
 */
export type TokenFillResult = number | typeof NEED_INPUT | null;

/** Result of advancing a sequential consumer by one token. */
export type TokenAdvanceResult = XmlEventType | typeof NEED_INPUT | null;

/**
 * Read-only view of the currently selected token. Backends expose indexed
 * primitives so consumers defer string/object creation until a stable event is
 * requested.
 */
export interface TokenReadView {
  eventType(): XmlEventType;
  name(): string | undefined;
  text(): string | undefined;
  localName(): string | undefined;
  prefix(): string;
  namespaceURI(): string;
  attributeCount(): number;
  attributeName(index: number): string | undefined;
  attributeLocalName(index: number): string | undefined;
  attributePrefix(index: number): string | undefined;
  attributeNamespaceURI(index: number): string | undefined;
  attributeValue(index: number): string | undefined;
  selfClosing(): boolean;
  documentDeclaration(): XmlDeclaration | undefined;
  namespaceURIForPrefix(prefix: string): string;
}

/**
 * Completed-token batch produced by one `fillBatch()` call. `current` keeps a
 * fixed identity; `select()` moves it without asking a backend to materialize
 * strings or events.
 */
export interface TokenBatch {
  readonly current: TokenReadView;
  select(index: number): XmlEventType;
}

/**
 * Batched producer shared by the JS and Wasm backends. `fillBatch()` consumes
 * only already-supplied input; it never fetches, reads, or awaits.
 */
export interface TokenCursor {
  readonly batch: TokenBatch;
  fillBatch(): TokenFillResult;
  dispose(): void;
}

export interface TokenInputSessionSpi {
  readonly cursor: TokenCursor;
  pushBytes(bytes: Uint8Array, final?: boolean): void;
  dispose(): void;
}

export interface TokenBackendFactory {
  readonly apiVersion: typeof TOKEN_BACKEND_API_VERSION;
  createStringCursor(
    input: string,
    options: TokenCursorOptions,
  ): TokenCursor;
  createByteSession(
    options: TokenCursorOptions & { encoding: string },
  ): TokenInputSessionSpi;
}

/** Soft per-batch budgets; `maxTokens` is a hard cap. */
export interface TokenBatchLimits {
  readonly maxTokens: number;
  readonly maxAttributes: number;
  readonly maxScanBytes: number;
  readonly maxTransientBytes: number;
}

/** Validate a batch-limits object once at factory configuration time. */
export function checkTokenBatchLimits(limits: TokenBatchLimits): void {
  for (const value of [
    limits.maxTokens,
    limits.maxAttributes,
    limits.maxScanBytes,
    limits.maxTransientBytes,
  ]) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new Error("Invalid token batch limits.");
  }
}

/**
 * Resolve an attribute value without materializing an attribute object.
 * Search order and results match the previous helper.
 */
export function attributeValueOf(
  view: TokenReadView,
  indexOrNameOrNamespace: number | string,
  localName?: string,
): string | undefined {
  if (localName === undefined) {
    if (typeof indexOrNameOrNamespace === "number")
      return view.attributeValue(indexOrNameOrNamespace);
    const name = indexOrNameOrNamespace;
    for (let index = 0; index < view.attributeCount(); index++) {
      if (view.attributeName(index) === name)
        return view.attributeValue(index);
    }
    return undefined;
  }

  const namespaceURI = indexOrNameOrNamespace;
  for (let index = 0; index < view.attributeCount(); index++) {
    if (
      view.attributeNamespaceURI(index) === namespaceURI &&
      view.attributeLocalName(index) === localName
    )
      return view.attributeValue(index);
  }
  return undefined;
}
