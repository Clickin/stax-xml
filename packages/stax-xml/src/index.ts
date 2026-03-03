export * from "./StaxXmlParser.js";
export * from "./StaxXmlParserSync.js";
export * from "./StaxXmlStreamReaderSync.js";
export * from "./StaxXmlWriter.js";
export * from "./StaxXmlWriterSync.js";

export { isCdata, isCharacters, isEndDocument, isEndElement, isError, isStartDocument, isStartElement, XmlEventType } from "./types.js";
export type {
  AnyXmlEvent, CdataEvent, CharactersEvent, ErrorEvent, StartElementEvent, WriteElementOptions, XmlAttribute
} from "./types.js";

