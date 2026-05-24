export { EventReader, createEventReader, createEventReaderFromAsyncByteBatches } from "./EventReader.js";
export type { EventReaderLike, EventReaderOptions } from "./EventReader.js";
export { EventReaderSync } from "./EventReaderSync.js";
export type { EventReaderSyncOptions } from "./EventReaderSync.js";
export { StreamReader } from "./StreamReader.js";
export type { StreamReaderOptions } from "./StreamReader.js";
export { StreamEventType, StreamReaderSync } from "./StreamReaderSync.js";
export type { StreamBatch, StreamEventView, StreamReaderSyncByteBatch, StreamReaderSyncOptions, StreamReaderSyncRawBatch } from "./StreamReaderSync.js";
export * from "./XmlObject.js";
export { Writer } from "./Writer.js";
export type { WriterOptions } from "./Writer.js";
export { WriterSync, WriterSyncSink } from "./WriterSync.js";
export type { SyncTextSink, WriterSyncOptions, WriterSyncSinkOptions } from "./WriterSync.js";
export { default } from "./WriterSync.js";
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
