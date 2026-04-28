export * from "./StaxXmlParser.js";
export * from "./StaxXmlParserSync.js";
export * from "./StaxXmlIterableParser.js";
export * from "./XmlObject.js";
export * from "./StaxXmlWriter.js";
export * from "./StaxXmlWriterSync.js";
export { default } from "./StaxXmlWriterSync.js";
export { getStaxXmlRuntime, initStaxXml } from "./runtime/index.js";
export type { InitStaxXmlOptions, StaxXmlRuntime, StaxXmlRuntimeBackendPreference, StaxXmlRuntimeCapabilities } from "./runtime/index.js";

export { isCdata, isCharacters, isEndDocument, isEndElement, isError, isStartDocument, isStartElement, XmlEventType } from "./types.js";
export type {
  AnyXmlEvent, CdataEvent, CharactersEvent, ErrorEvent, StartElementEvent, WriteElementOptions, XmlAttribute
} from "./types.js";

// Cursor API
export { CursorEventType, StaxXmlCursorReader, StaxXmlCursorReaderAsync } from "./cursor/index.js";
export type { StaxXmlCursorReaderOptions, StaxXmlCursorReaderAsyncOptions } from "./cursor/index.js";
