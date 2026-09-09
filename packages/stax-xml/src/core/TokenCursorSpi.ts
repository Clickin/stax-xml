import type {
  DocumentMode,
  XmlEventType,
  XmlEventType as XmlEventTypeValue,
} from "./types.js";

/**
 * Sentinel returned by an incremental cursor when it needs more input.
 *
 * `Symbol.for` is intentional: the stable and experimental bundles are built
 * separately, but their readers must still recognize the same sentinel.
 */
export const NEED_INPUT = Symbol.for("stax-xml.need-input");

export type TokenCursorResult = XmlEventTypeValue | typeof NEED_INPUT | null;

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

/**
 * Read-only/current-token interface implemented by every tokenizer backend.
 *
 * Implementations expose indexed attribute primitives so consumers can defer
 * JavaScript object creation until a stable materialized event is requested.
 */
export interface TokenCursorSpi {
  next(): TokenCursorResult;

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

  dispose(): void;
}

/**
 * Resolve an attribute value without asking a cursor to materialize an
 * attribute object.
 */
export function attributeValueOf(
  cursor: TokenCursorSpi,
  indexOrNameOrNamespace: number | string,
  localName?: string,
): string | undefined {
  if (localName === undefined) {
    if (typeof indexOrNameOrNamespace === "number")
      return cursor.attributeValue(indexOrNameOrNamespace);
    const name = indexOrNameOrNamespace;
    for (let index = 0; index < cursor.attributeCount(); index++) {
      if (cursor.attributeName(index) === name)
        return cursor.attributeValue(index);
    }
    return undefined;
  }

  const namespaceURI = indexOrNameOrNamespace;
  for (let index = 0; index < cursor.attributeCount(); index++) {
    if (
      cursor.attributeNamespaceURI(index) === namespaceURI &&
      cursor.attributeLocalName(index) === localName
    )
      return cursor.attributeValue(index);
  }
  return undefined;
}
