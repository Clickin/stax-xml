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
  TokenCursorResult,
  TokenCursorSpi,
  TokenInputSessionSpi,
  XmlDeclaration,
} from "@stax-xml/core";
