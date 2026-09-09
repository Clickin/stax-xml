import {
  EventReader as JsEventReader,
  StreamReader as JsStreamReader,
  type EventReaderOptions,
  type StreamReaderOptions,
  type StreamReaderSource,
} from "stax-xml";
import {
  EventReaderSync as JsEventReaderSync,
  StreamReaderSync as JsStreamReaderSync,
  type EventReaderSyncOptions,
  type StreamReaderSyncInput,
  type StreamReaderSyncOptions,
} from "stax-xml";
import {
  XmlEventType,
  isCdata,
  isCharacters,
  isEndDocument,
  isEndElement,
  isStartDocument,
  isStartElement,
  type AnyXmlEvent,
} from "stax-xml";
import {
  NEED_INPUT,
  jsTokenBackendFactory,
  tokenBackendFactorySymbol,
  tokenBackendOf,
  withTokenBackend,
  type TokenBackendFactory,
  type TokenBatch,
  type TokenCursor,
  type TokenAdvanceResult,
  type TokenFillResult,
  type TokenCursorOptions,
  type TokenInputSessionSpi,
  type TokenReadView,
  type XmlDeclaration,
} from "stax-xml/experimental/backend";
import {
  initWasm,
  type InitWasmOptions,
  type WasmVariant,
} from "./loader.js";
import { WasmTokenCursor } from "./WasmTokenCursor.js";
import { TokenCursorWasmError } from "./errors.js";
import {
  WasmTokenInputSession,
  wasmTokenBackendFactory,
  withWasmBackend,
} from "./backend.js";

/** Reader subclass that injects the experimental Wasm backend once. */
export class StreamReader extends JsStreamReader {
  constructor(source: StreamReaderSource, options: StreamReaderOptions = {}) {
    super(source, withWasmBackend(options));
  }
}

/** Async materialized-event reader using the existing stable implementation. */
export class EventReader extends JsEventReader {
  constructor(source: StreamReaderSource, options: EventReaderOptions = {}) {
    super(source, withWasmBackend(options));
  }
}

/** Synchronous reader using the existing stable implementation. */
export class StreamReaderSync extends JsStreamReaderSync {
  constructor(
    input: StreamReaderSyncInput,
    options: StreamReaderSyncOptions = {},
  ) {
    super(input, withWasmBackend(options));
  }
}

/** Synchronous materialized-event reader using the existing implementation. */
export class EventReaderSync extends JsEventReaderSync {
  constructor(
    input: StreamReaderSyncInput,
    options: EventReaderSyncOptions = {},
  ) {
    super(input, withWasmBackend(options));
  }
}

export type {
  AnyXmlEvent,
  EventReaderOptions,
  EventReaderSyncOptions,
  InitWasmOptions,
  StreamReaderOptions,
  StreamReaderSource,
  StreamReaderSyncInput,
  StreamReaderSyncOptions,
  TokenBackendFactory,
  TokenBatch,
  TokenCursor,
  TokenAdvanceResult,
  TokenFillResult,
  TokenCursorOptions,
  TokenInputSessionSpi,
  TokenReadView,
  WasmVariant,
  XmlDeclaration,
};
export {
  NEED_INPUT,
  jsTokenBackendFactory,
  tokenBackendFactorySymbol,
  tokenBackendOf,
  withTokenBackend,
  WasmTokenCursor,
  TokenCursorWasmError,
  WasmTokenInputSession,
  XmlEventType,
  isCdata,
  isCharacters,
  isEndDocument,
  isEndElement,
  isStartDocument,
  isStartElement,
  initWasm,
  wasmTokenBackendFactory,
  withWasmBackend,
};
