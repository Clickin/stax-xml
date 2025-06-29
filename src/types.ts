// types.ts

/**
 * XML 스트림 이벤트의 타입을 나타내는 열거형
 */
export enum XmlEventType {
  START_DOCUMENT = 'START_DOCUMENT',
  END_DOCUMENT = 'END_DOCUMENT',
  START_ELEMENT = 'START_ELEMENT',
  END_ELEMENT = 'END_ELEMENT',
  CHARACTERS = 'CHARACTERS',
  CDATA = 'CDATA',
  ERROR = 'ERROR',
}

/**
 * 모든 XML 이벤트의 기본 인터페이스
 */
export interface XmlEvent {
  type: XmlEventType;
}

/**
 * START_ELEMENT 이벤트 인터페이스
 */
export interface StartElementEvent extends XmlEvent {
  type: XmlEventType.START_ELEMENT;
  name: string;
  localName?: string; // 네임스페이스가 있는 경우 로컬 이름
  prefix?: string; // 네임스페이스 접두사
  uri?: string; // 네임스페이스 URI
  attributes: { [key: string]: string };
  attributesWithPrefix?: { [key: string]: { value: string; prefix?: string; uri?: string } };
}

/**
 * END_ELEMENT 이벤트 인터페이스
 */
export interface EndElementEvent extends XmlEvent {
  type: XmlEventType.END_ELEMENT;
  name: string;
  localName?: string; // 네임스페이스가 있는 경우 로컬 이름
  prefix?: string; // 네임스페이스 접두사
  uri?: string; // 네임스페이스 URI
}

/**
 * CHARACTERS 이벤트 인터페이스
 */
export interface CharactersEvent extends XmlEvent {
  type: XmlEventType.CHARACTERS;
  value: string;
}

/**
 * CDATA 이벤트 인터페이스
 */
export interface CdataEvent extends XmlEvent {
  type: XmlEventType.CDATA;
  value: string;
}

/**
 * ERROR 이벤트 인터페이스
 */
export interface ErrorEvent extends XmlEvent {
  type: XmlEventType.ERROR;
  error: Error;
}

/**
 * SimplifiedStaxParser가 반환할 수 있는 모든 이벤트 타입의 유니언
 */
export type AnyXmlEvent =
  | XmlEvent
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
  prefix?: string;
  uri?: string;
}

/**
 * 요소 작성 옵션 인터페이스 (Writer용)
 */
export interface WriteElementOptions {
  prefix?: string;              // 네임스페이스 접두사
  uri?: string;                 // 네임스페이스 URI
  attributes?: Record<string, string | AttributeInfo>; // 속성들 (간단한 문자열 또는 prefix 포함 객체)
  selfClosing?: boolean;        // self-closing 태그 여부
}