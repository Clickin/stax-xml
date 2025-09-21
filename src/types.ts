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
  // Element 관련 필드
  name: string | undefined;
  localName: string | undefined;
  prefix: string | undefined;
  uri: string | undefined;
  // StartElement 전용
  attributes: Record<string, string> | undefined;
  attributesWithPrefix: Record<string, AttributeInfo> | undefined;
  // Characters/CDATA 관련
  value: string | undefined;
  // Error 관련
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
 * 개발자가 사용할 Discriminated Union 타입
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
 * 속성 인터페이스 (Writer용)
 */
export interface XmlAttribute {
  prefix?: string; // 이 간단한 구현에서는 사용되지 않을 수 있습니다.
  localName: string;
  uri?: string;    // 이 간단한 구현에서는 사용되지 않을 수 있습니다.
  value: string;
}

/**
 * 네임스페이스 선언 인터페이스 (Writer용)
 * 이 간단한 구현에서는 사용되지 않습니다.
 */
export interface NamespaceDeclaration {
  prefix: string;
  uri: string;
}

/**
 * 처리 명령 (PI) 인터페이스 (Writer용)
 * 이 간단한 구현에서는 사용되지 않습니다.
 */
export interface ProcessingInstruction {
  target: string;
  data?: string;
}

/**
 * 속성 정보 인터페이스
 */
export interface AttributeInfo {
  value: string;
  localName: string;
  prefix?: string;
  uri?: string;
}

/**
 * 이벤트 팩토리 클래스 - 모든 이벤트를 동일한 shape로 생성
 * 인라인 함수로 최적화 가능
 */
export class XmlEventFactory {

  /**
   * START_DOCUMENT 이벤트 생성
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
    } as any as StartDocumentEvent;
  }

  /**
   * END_DOCUMENT 이벤트 생성
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
    } as any as EndDocumentEvent;
  }

  /**
   * START_ELEMENT 이벤트 생성
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
    } as any as StartElementEvent;
  }

  /**
   * END_ELEMENT 이벤트 생성
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
    } as any as EndElementEvent;
  }

  /**
   * CHARACTERS 이벤트 생성
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
    } as any as CharactersEvent;
  }

  /**
   * CDATA 이벤트 생성
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
    } as any as CdataEvent;
  }

  /**
   * ERROR 이벤트 생성
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
    } as any as ErrorEvent;
  }
}

/**
 * 타입 가드 함수들 - TypeScript narrowing을 위해
 * 이 함수들은 런타임에서 타입을 체크하고 TypeScript에게 타입 정보를 제공합니다.
 */
export function isStartElement(event: AnyXmlEvent): event is StartElementEvent {
  return event.type === XmlEventType.START_ELEMENT;
}

export function isEndElement(event: AnyXmlEvent): event is EndElementEvent {
  return event.type === XmlEventType.END_ELEMENT;
}

export function isCharacters(event: AnyXmlEvent): event is CharactersEvent {
  return event.type === XmlEventType.CHARACTERS;
}

export function isCdata(event: AnyXmlEvent): event is CdataEvent {
  return event.type === XmlEventType.CDATA;
}

export function isError(event: AnyXmlEvent): event is ErrorEvent {
  return event.type === XmlEventType.ERROR;
}

export function isStartDocument(event: AnyXmlEvent): event is StartDocumentEvent {
  return event.type === XmlEventType.START_DOCUMENT;
}

export function isEndDocument(event: AnyXmlEvent): event is EndDocumentEvent {
  return event.type === XmlEventType.END_DOCUMENT;
}

/**
 * 요소 작성 옵션 인터페이스 (Writer용)
 */
export interface WriteElementOptions {
  prefix?: string;
  uri?: string;
  attributes?: Record<string, string | AttributeInfo>;
  selfClosing?: boolean;
}