// Shared StAX token cursor, event types, and event materialization.
// Internal module consumed by the reader, writer, and converter layers.

export * from './types.js';
export * from './TokenCursor.js';
export { materializeTokenEvent } from './internal/materialize-token-event.js';
