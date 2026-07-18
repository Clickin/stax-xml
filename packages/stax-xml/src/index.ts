export { EventReader, StreamReader } from '@stax-xml/async';
export type { EventReaderOptions, StreamReaderOptions, StreamReaderSource } from '@stax-xml/async';
export { EventReaderSync, StreamReaderSync } from '@stax-xml/sync';
export type { EventReaderSyncOptions } from '@stax-xml/sync';
export type { StreamReaderSyncInput, StreamReaderSyncOptions } from '@stax-xml/sync';
export { Writer } from '@stax-xml/async';
export type { AsyncTextSink, WriterOptions } from '@stax-xml/async';
export { WriterSync, WriterSyncSink } from '@stax-xml/sync';
export type { SyncTextSink, WriterSyncOptions, WriterSyncSinkOptions } from '@stax-xml/sync';
export { isCdata, isCharacters, isEndDocument, isEndElement, isStartDocument, isStartElement, XmlEventType } from '@stax-xml/core';
export type {
  AnyXmlEvent,
  AttributeInfo,
  CdataEvent,
  CharactersEvent,
  CommentEvent,
  DocumentMode,
  DtdEvent,
  EndDocumentEvent,
  EndElementEvent,
  EventAttribute,
  ProcessingInstructionEvent,
  StartDocumentEvent,
  StartElementEvent,
  WriteElementOptions,
} from '@stax-xml/core';
