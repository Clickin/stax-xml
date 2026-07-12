import { type AnyXmlEvent, type DocumentMode } from '@stax-xml/core';
import { StreamReader, nextMaterialized, type StreamReaderSource } from './StreamReader.js';

export interface EventReaderOptions {
  documentMode?: DocumentMode;
  /** Resolve namespaces and omit xmlns declarations from attributes. @defaultValue true */
  namespaceAware?: boolean;
}
export class EventReader implements AsyncIterable<AnyXmlEvent>, AsyncIterator<AnyXmlEvent> {
  private readonly reader: StreamReader;
  constructor(input: StreamReaderSource, options: EventReaderOptions = {}) { this.reader = new StreamReader(input, options); }
  [Symbol.asyncIterator](): AsyncIterator<AnyXmlEvent> { return this; }
  next(): Promise<IteratorResult<AnyXmlEvent>> { return nextMaterialized(this.reader); }
  close(): Promise<void> { return this.reader.close(); }
  async return(): Promise<IteratorResult<AnyXmlEvent>> { await this.close(); return { value: undefined, done: true }; }
}
