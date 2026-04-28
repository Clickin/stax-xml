export { EventReader, createEventReader } from "./EventReader.js";
export type { EventReaderOptions } from "./EventReader.js";
export { EventReaderSync } from "./EventReaderSync.js";
export type { EventReaderSyncOptions } from "./EventReaderSync.js";
export {
  IterableEventType,
  IterableReader,
  toAsyncByteBatches,
  toByteBatches,
} from "./IterableReader.js";
export type {
  ByteBatch,
  ByteBatchOptions,
  IterableReaderBatchFrame,
  IterableReaderOptions,
} from "./IterableReader.js";
export * from "./XmlObject.js";
export { Writer } from "./Writer.js";
export type { WriterOptions } from "./Writer.js";
export { WriterSync, WriterSyncSink } from "./WriterSync.js";
export type { SyncTextSink, WriterSyncOptions, WriterSyncSinkOptions } from "./WriterSync.js";
export { default } from "./WriterSync.js";
export { getStaxXmlRuntime, initStaxXml } from "./runtime/index.js";
export type {
  InitStaxXmlOptions,
  LinuxLibc,
  OptionalPackageImporter,
  StaxXmlRuntime,
  StaxXmlRuntimeBackend,
  StaxXmlRuntimeBackendKind,
  StaxXmlRuntimeBackendPreference,
  StaxXmlRuntimeCapabilities,
  StaxXmlRuntimePlatform,
  StaxXmlRuntimeResolverOptions,
  StaxXmlStreamingEventBatch,
  StaxXmlStreamingEventBatchFactory,
  StaxXmlStreamingEventBatchParser,
} from "./runtime/index.js";
export type { EntityDefinition } from "./IterableEventBackend.js";

export { isCdata, isCharacters, isEndDocument, isEndElement, isError, isStartDocument, isStartElement, XmlEventType } from "./types.js";
export type {
  AnyXmlEvent,
  AttributeInfo,
  CdataEvent,
  CharactersEvent,
  DocumentMode,
  EndDocumentEvent,
  EndElementEvent,
  ErrorEvent,
  NamespaceDeclaration,
  ParserEventFilter,
  ProcessingInstruction,
  StartDocumentEvent,
  StartElementEvent,
  WriteElementOptions,
  XmlAttribute,
} from "./types.js";

// Cursor API
export { CursorEventType, CursorReader, CursorReaderAsync } from "./cursor/index.js";
export type { CursorReaderOptions, CursorReaderAsyncOptions } from "./cursor/index.js";
