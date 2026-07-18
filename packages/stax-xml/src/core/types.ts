/**
 * Enumeration of XML stream event types used by the StAX parser
 *
 * @public
 */
export const XmlEventType = {
  START_DOCUMENT: 'START_DOCUMENT',
  END_DOCUMENT: 'END_DOCUMENT',
  START_ELEMENT: 'START_ELEMENT',
  END_ELEMENT: 'END_ELEMENT',
  CHARACTERS: 'CHARACTERS',
  CDATA: 'CDATA',
  COMMENT: 'COMMENT',
  PROCESSING_INSTRUCTION: 'PROCESSING_INSTRUCTION',
  DTD: 'DTD',
} as const;

export type XmlEventType = typeof XmlEventType[keyof typeof XmlEventType];

/**
 * Event fired when the document starts parsing
 *
 * @public
 */
export interface StartDocumentEvent {
  type: typeof XmlEventType.START_DOCUMENT;
}

/**
 * Event fired when the document ends parsing
 *
 * @public
 */
export interface EndDocumentEvent {
  type: typeof XmlEventType.END_DOCUMENT;
}

/**
 * Event fired when an XML element starts
 *
 * @public
 */
export interface StartElementEvent {
  type: typeof XmlEventType.START_ELEMENT;
  name: string;
  localName: string;
  prefix: string;
  namespaceURI: string;
  attributes: EventAttribute[];
}

/** Materialized attribute attached to a start-element event. */
export interface EventAttribute { name: string; localName: string; prefix: string; namespaceURI: string; value: string }

/** Event emitted when an XML element ends. */
export interface EndElementEvent {
  type: typeof XmlEventType.END_ELEMENT;
  name: string;
  localName: string;
  prefix: string;
  namespaceURI: string;
}

/** Event containing ordinary character data. */
export interface CharactersEvent {
  type: typeof XmlEventType.CHARACTERS;
  value: string;
}

/** Event containing CDATA content. */
export interface CdataEvent {
  type: typeof XmlEventType.CDATA;
  value: string;
}

/** Event containing an XML comment. */
export interface CommentEvent { type: typeof XmlEventType.COMMENT; value: string }
/** Event containing an XML processing instruction. */
export interface ProcessingInstructionEvent { type: typeof XmlEventType.PROCESSING_INSTRUCTION; target: string; data: string }
/** Event containing a document type declaration. */
export interface DtdEvent { type: typeof XmlEventType.DTD; value: string }

/**
 * Discriminated Union type for developer use
 */
export type AnyXmlEvent =
  | StartDocumentEvent
  | EndDocumentEvent
  | StartElementEvent
  | EndElementEvent
  | CharactersEvent
  | CdataEvent
  | CommentEvent
  | ProcessingInstructionEvent
  | DtdEvent;

/**
 * Attribute information interface
 */
export interface AttributeInfo {
  value: string;
  prefix?: string;
  uri?: string;
}

// ===============================================
// Type guard functions - for TypeScript narrowing
// These functions check types at runtime and provide type information to TypeScript.
// ===============================================

/**
 * Type guard function - Check if the event is a START_ELEMENT event
 * @param event XML event to check
 * @returns true if the event is a START_ELEMENT event, false otherwise
 */
export function isStartElement(event: AnyXmlEvent): event is StartElementEvent {
  return event.type === XmlEventType.START_ELEMENT;
}

/**
 * Type guard function - Check if the event is an END_ELEMENT event
 * @param event XML event to check
 * @returns true if the event is an END_ELEMENT event, false otherwise
 */
export function isEndElement(event: AnyXmlEvent): event is EndElementEvent {
  return event.type === XmlEventType.END_ELEMENT;
}

/**
 * Type guard function - Check if the event is a CHARACTERS event
 * @param event XML event to check
 * @returns true if the event is a CHARACTERS event, false otherwise
 */
export function isCharacters(event: AnyXmlEvent): event is CharactersEvent {
  return event.type === XmlEventType.CHARACTERS;
}
/**
 * Type guard function - Check if the event is a CDATA event
 * @param event XML event to check
 * @returns true if the event is a CDATA event, false otherwise
 */
export function isCdata(event: AnyXmlEvent): event is CdataEvent {
  return event.type === XmlEventType.CDATA;
}
/**
 * Type guard function - Check if the event is an ERROR event
 * @param event XML event to check
 * @returns true if the event is an ERROR event, false otherwise
 */
/**
 * Type guard function - Check if the event is a START_DOCUMENT event
 * @param event XML event to check
 * @returns true if the event is a START_DOCUMENT event, false otherwise
 */
export function isStartDocument(event: AnyXmlEvent): event is StartDocumentEvent {
  return event.type === XmlEventType.START_DOCUMENT;
}
/**
 * Type guard function - Check if the event is an END_DOCUMENT event
 * @param event XML event to check
 * @returns true if the event is an END_DOCUMENT event, false otherwise
 */
export function isEndDocument(event: AnyXmlEvent): event is EndDocumentEvent {
  return event.type === XmlEventType.END_DOCUMENT;
}

/**
 * Element writing options interface (for Writer)
 */
export interface WriteElementOptions {
  prefix?: string;
  uri?: string;
  attributes?: Record<string, string | AttributeInfo>;
  selfClosing?: boolean;
  comment?: string;
}

export interface ParserEventFilter {
  includeAttributes: boolean;
  includeCharacters: boolean;
  includeCdata: boolean;
}

/**
 * XML document conformance mode.
 *
 * @public
 */
export type DocumentMode = 'fragment' | 'document';
