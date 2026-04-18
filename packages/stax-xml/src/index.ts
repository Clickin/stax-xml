export * from "./StaxXmlParser.js";
export * from "./StaxXmlParserSync.js";
export * from "./StaxXmlWriter.js";
export * from "./StaxXmlWriterSync.js";

export { isCdata, isCharacters, isEndDocument, isEndElement, isError, isStartDocument, isStartElement, XmlEventType } from "./types.js";
export type {
  AnyXmlEvent, CdataEvent, CharactersEvent, ErrorEvent, StartElementEvent, WriteElementOptions, XmlAttribute
} from "./types.js";

// Cursor API
export { CursorEventType, XmlCursorReader, XmlCursorReaderAsync } from "./cursor/index.js";
export type { XmlCursorReaderOptions, XmlCursorReaderAsyncOptions } from "./cursor/index.js";

