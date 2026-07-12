import { materializeTokenEvent, type AnyXmlEvent, type DocumentMode } from '@stax-xml/core';
import { StreamReaderSync, tokenCursorOf, type StreamReaderSyncInput } from './StreamReaderSync.js';

export interface EventReaderSyncOptions {
  documentMode?: DocumentMode;
  /** Resolve namespaces and omit xmlns declarations from attributes. @defaultValue true */
  namespaceAware?: boolean;
}

export class EventReaderSync implements Iterable<AnyXmlEvent>, Iterator<AnyXmlEvent> {
  private readonly reader: StreamReaderSync;
  private finished = false;
  constructor(input: StreamReaderSyncInput, options: EventReaderSyncOptions = {}) { this.reader = new StreamReaderSync(input, options); }
  [Symbol.iterator](): Iterator<AnyXmlEvent> { return this; }
  next(): IteratorResult<AnyXmlEvent> {
    if (this.finished) return { value: undefined, done: true };
    const type = this.reader.next();
    if (type === null) { this.finished = true; return { value: undefined, done: true }; }
    return { value: materialize(this.reader, type), done: false };
  }
  return(): IteratorResult<AnyXmlEvent> {
    this.close();
    return { value: undefined, done: true };
  }
  close(): void { this.finished = true; this.reader.close(); }
}

function materialize(reader: StreamReaderSync, type = reader.eventType()): AnyXmlEvent {
  return materializeTokenEvent(tokenCursorOf(reader), type);
}
