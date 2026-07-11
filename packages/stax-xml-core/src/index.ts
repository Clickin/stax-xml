// stax-xml-core: private workspace package
// Shared StAX token cursor, event types, and event materialization.
// Exported broadly because this is a private package consumed only by
// stax-xml-sync, stax-xml-async, stax-xml-converter, and the stax-xml facade.

export * from './types.js';
export * from './TokenCursor.js';
export { materializeTokenEvent } from './internal/materialize-token-event.js';
