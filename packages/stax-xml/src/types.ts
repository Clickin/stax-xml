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
  ERROR: 'ERROR',
} as const;

export type XmlEventType = typeof XmlEventType[keyof typeof XmlEventType];

/**
 * Internal unified event structure optimized for V8 hidden class performance.
 *
 * @remarks
 * All events share the same shape to optimize V8 hidden class performance.
 * Unused fields are initialized to undefined.
 *
 * @internal
 */
export interface UnifiedXmlEvent {
  type: XmlEventType;
  // Element-related fields
  name: string | undefined;
  localName: string | undefined;
  prefix: string | undefined;
  uri: string | undefined;
  // StartElement specific
  attributes: Record<string, string> | undefined;
  attributesWithPrefix: Record<string, AttributeInfo> | undefined;
  // Characters/CDATA related
  value: string | undefined;
  // Error related
  error: Error | undefined;
}

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
  localName?: string;
  prefix?: string;
  uri?: string;
  attributes: Record<string, string>;
  attributesWithPrefix?: Record<string, AttributeInfo>;
}

export interface EndElementEvent {
  type: typeof XmlEventType.END_ELEMENT;
  name: string;
  localName?: string;
  prefix?: string;
  uri?: string;
}

export interface CharactersEvent {
  type: typeof XmlEventType.CHARACTERS;
  value: string;
}

export interface CdataEvent {
  type: typeof XmlEventType.CDATA;
  value: string;
}

export interface ErrorEvent {
  type: typeof XmlEventType.ERROR;
  error: Error;
}

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
  | ErrorEvent;

/**
 * Cursor-compatible XML event type.
 *
 * @public
 */
export type CursorXmlEventType = XmlEventType;

/**
 * Attribute shape used by the cursor API.
 *
 * @public
 */
export interface CursorAttribute {
  name: string;
  localName: string;
  prefix?: string;
  uri?: string;
  value: string;
}

/**
 * Read-only view for cursor events.
 *
 * @public
 */
export interface XmlCursorEventLike {
  readonly type: CursorXmlEventType;
  readonly name: string | undefined;
  readonly localName: string | undefined;
  readonly prefix: string | undefined;
  readonly uri: string | undefined;
  readonly text: string | undefined;
  readonly error: Error | undefined;
  getAttributeCount(): number;
  getAttribute(index: number): CursorAttribute | undefined;
  getAttributeValue(name: string): string | undefined;
}

/**
 * Synchronous cursor-style reader API.
 *
 * @public
 */
export interface XmlCursorReaderSyncLike {
  hasNext(): boolean;
  read(): boolean;
  getEvent(): XmlCursorEventLike | null;
  requireEvent(): XmlCursorEventLike;
}

/**
 * Attribute interface (for Writer)
 */
export interface XmlAttribute {
  prefix?: string; // May not be used in this simple implementation
  localName: string;
  uri?: string;    // May not be used in this simple implementation
  value: string;
}

/**
 * Namespace declaration interface (for Writer)
 * Not used in this simple implementation.
 */
export interface NamespaceDeclaration {
  prefix: string;
  uri: string;
}

/**
 * Processing instruction (PI) interface (for Writer)
 * Not used in this simple implementation.
 */
export interface ProcessingInstruction {
  target: string;
  data?: string;
}

/**
 * Attribute information interface
 */
export interface AttributeInfo {
  value: string;
  localName: string;
  prefix?: string;
  uri?: string;
}

/**
 * Event factory class - creates all events with the same shape
 * Can be optimized with inline functions
 */
export class XmlEventFactory {

  /**
   * Create START_DOCUMENT event
   */
  static startDocument(): StartDocumentEvent {
    return {
      type: XmlEventType.START_DOCUMENT,
      name: undefined,
      localName: undefined,
      prefix: undefined,
      uri: undefined,
      attributes: undefined,
      attributesWithPrefix: undefined,
      value: undefined,
      error: undefined
    } as StartDocumentEvent;
  }

  /**
   * Create END_DOCUMENT event
   */
  static endDocument(): EndDocumentEvent {
    return {
      type: XmlEventType.END_DOCUMENT,
      name: undefined,
      localName: undefined,
      prefix: undefined,
      uri: undefined,
      attributes: undefined,
      attributesWithPrefix: undefined,
      value: undefined,
      error: undefined
    } as EndDocumentEvent;
  }

  /**
   * Create START_ELEMENT event
   */
  static startElement(
    name: string,
    localName: string | undefined,
    prefix: string | undefined,
    uri: string | undefined,
    attributes: Record<string, string>,
    attributesWithPrefix?: Record<string, AttributeInfo>
  ): StartElementEvent {
    return {
      type: XmlEventType.START_ELEMENT,
      name,
      localName,
      prefix,
      uri,
      attributes,
      attributesWithPrefix,
      value: undefined,
      error: undefined
    } as StartElementEvent;
  }

  /**
   * Create END_ELEMENT event
   */
  static endElement(
    name: string,
    localName: string | undefined,
    prefix: string | undefined,
    uri: string | undefined
  ): EndElementEvent {
    return {
      type: XmlEventType.END_ELEMENT,
      name,
      localName,
      prefix,
      uri,
      attributes: undefined,
      attributesWithPrefix: undefined,
      value: undefined,
      error: undefined
    } as EndElementEvent;
  }

  /**
   * Create CHARACTERS event
   */
  static characters(value: string): CharactersEvent {
    return {
      type: XmlEventType.CHARACTERS,
      name: undefined,
      localName: undefined,
      prefix: undefined,
      uri: undefined,
      attributes: undefined,
      attributesWithPrefix: undefined,
      value,
      error: undefined
    } as CharactersEvent;
  }

  /**
   * Create CDATA event
   */
  static cdata(value: string): CdataEvent {
    return {
      type: XmlEventType.CDATA,
      name: undefined,
      localName: undefined,
      prefix: undefined,
      uri: undefined,
      attributes: undefined,
      attributesWithPrefix: undefined,
      value,
      error: undefined
    } as CdataEvent;
  }

  /**
   * Create ERROR event
   */
  static error(error: Error): ErrorEvent {
    return {
      type: XmlEventType.ERROR,
      name: undefined,
      localName: undefined,
      prefix: undefined,
      uri: undefined,
      attributes: undefined,
      attributesWithPrefix: undefined,
      value: undefined,
      error
    } as ErrorEvent;
  }
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
export function isError(event: AnyXmlEvent): event is ErrorEvent {
  return event.type === XmlEventType.ERROR;
}
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
