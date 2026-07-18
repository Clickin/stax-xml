import { materializeTokenEvent, type AnyXmlEvent } from '@stax-xml/core';
import { StreamReaderSync, tokenCursorOf, type StreamReaderSyncInput, type StreamReaderSyncOptions } from './StreamReaderSync.js';

/** Options for the synchronous materialized-event reader. */
export interface EventReaderSyncOptions extends StreamReaderSyncOptions {}

/** Synchronous iterator that yields stable, materialized XML event objects. */
export class EventReaderSync implements Iterable<AnyXmlEvent>, Iterator<AnyXmlEvent> {
  private readonly reader: StreamReaderSync;
  private finished = false;
  constructor(input: StreamReaderSyncInput, options: EventReaderSyncOptions = {}) { this.reader = new StreamReaderSync(input, options); }
  /** Return this reader as its iterator. */
  [Symbol.iterator](): Iterator<AnyXmlEvent> { return this; }
  /** Read the next materialized event. */
  next(): IteratorResult<AnyXmlEvent> {
    if (this.finished) return { value: undefined, done: true };
    const type = this.reader.next();
    if (type === null) { this.finished = true; return { value: undefined, done: true }; }
    return { value: materialize(this.reader, type), done: false };
  }
  /** Close the reader when iteration ends early. */
  return(): IteratorResult<AnyXmlEvent> {
    this.close();
    return { value: undefined, done: true };
  }
  /** Stop parsing and release the underlying input iterator. */
  close(): void { this.finished = true; this.reader.close(); }
}

function materialize(reader: StreamReaderSync, type = reader.eventType()): AnyXmlEvent {
  return materializeTokenEvent(tokenCursorOf(reader), type);
}
