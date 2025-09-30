/**
 * Core Package API Contract - stax-xml
 * Zero runtime dependencies
 * Basic XML parsing and writing functionality
 */

// Re-exported from existing implementation
export interface StaxXmlParserOptions {
  bufferSize?: number;
  maxBatchSize?: number;
  compactionThreshold?: number;
}

export interface StaxXmlWriterOptions {
  encoding?: 'utf-8' | 'utf-16';
  prettyPrint?: boolean;
  indent?: string;
}

// Core XML event types (existing)
export enum XmlEventType {
  START_ELEMENT = 'START_ELEMENT',
  END_ELEMENT = 'END_ELEMENT',
  CHARACTERS = 'CHARACTERS',
  CDATA = 'CDATA',
  COMMENT = 'COMMENT',
  PROCESSING_INSTRUCTION = 'PROCESSING_INSTRUCTION',
  START_DOCUMENT = 'START_DOCUMENT',
  END_DOCUMENT = 'END_DOCUMENT'
}

export interface StartElementEvent {
  type: XmlEventType.START_ELEMENT;
  name: string;
  namespace?: string;
  attributes?: Record<string, string>;
  isEmpty?: boolean;
}

export interface EndElementEvent {
  type: XmlEventType.END_ELEMENT;
  name: string;
  namespace?: string;
}

export interface CharactersEvent {
  type: XmlEventType.CHARACTERS;
  value: string;
}

export interface CdataEvent {
  type: XmlEventType.CDATA;
  value: string;
}

export type AnyXmlEvent =
  | StartElementEvent
  | EndElementEvent
  | CharactersEvent
  | CdataEvent;

// Core parser contract
export declare class StaxXmlParser implements AsyncIterable<AnyXmlEvent> {
  constructor(xmlStream: ReadableStream<Uint8Array>, options?: StaxXmlParserOptions);

  [Symbol.asyncIterator](): AsyncIterator<AnyXmlEvent>;

  batchedIterator(batchSize?: number): AsyncIterable<AnyXmlEvent[]>;

  close(): Promise<void>;
}

// Core writer contract
export declare class StaxXmlWriter {
  constructor(options?: StaxXmlWriterOptions);

  writeStartDocument(encoding?: string, version?: string): this;
  writeEndDocument(): this;

  writeStartElement(name: string, namespace?: string): this;
  writeEndElement(): this;

  writeAttribute(name: string, value: string, namespace?: string): this;
  writeCharacters(text: string): this;
  writeCData(data: string): this;

  getXmlString(): string;
  getXmlStream(): ReadableStream<Uint8Array>;
}

// Utility types for type inference (no runtime cost)
export type XMLElementValue = {
  name: string;
  namespace?: string;
  attributes?: Record<string, string>;
  text?: string;
  children?: XMLElementValue[];
};

// Error types
export class XMLParseError extends Error {
  constructor(
    message: string,
    public readonly position: number,
    public readonly line: number,
    public readonly column: number
  ) {
    super(message);
    this.name = 'XMLParseError';
  }
}

export class XMLWriteError extends Error {
  constructor(message: string, public readonly context?: string) {
    super(message);
    this.name = 'XMLWriteError';
  }
}