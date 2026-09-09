// Shared StAX token cursor, event types, and event materialization.
// Internal module consumed by the reader, writer, and converter layers.

export * from './types.js';
export * from './TokenCursorSpi.js';
export { TokenCursor } from './TokenCursor.js';
export type { TokenAttribute } from './TokenCursor.js';
export {
  jsTokenBackendFactory,
  tokenBackendFactorySymbol,
  tokenBackendOf,
  withTokenBackend,
} from './internal/token-backend.js';
export type {
  TokenBackendFactory,
  TokenInputSessionSpi,
} from './internal/token-backend.js';
export * from './xml-validation.js';
export { materializeTokenEvent } from './internal/materialize-token-event.js';
