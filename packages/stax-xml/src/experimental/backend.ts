/**
 * Deliberately unstable backend seam for experimental tokenizer
 * implementations. This entry is not part of the stable `stax-xml` root.
 */
export {
  NEED_INPUT,
  jsTokenBackendFactory,
  tokenBackendFactorySymbol,
  tokenBackendOf,
  withTokenBackend,
} from "@stax-xml/core";
export type {
  TokenBackendFactory,
  TokenCursorOptions,
  TokenCursor,
  TokenAdvanceResult,
  TokenFillResult,
  TokenInputSessionSpi,
  TokenReadView,
  TokenBatch,
  XmlDeclaration,
} from "@stax-xml/core";
