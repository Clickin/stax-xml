import { type AnyXmlEvent, type DocumentMode } from '@stax-xml/core';
import { StreamReader, nextMaterialized, type StreamReaderSource } from './StreamReader.js';

/** Options for the asynchronous materialized-event reader. */
export interface EventReaderOptions {
  documentMode?: DocumentMode;
  /** Resolve namespaces and omit xmlns declarations from attributes. @defaultValue true */
  namespaceAware?: boolean;
}

/**
 * Async iterator that yields stable, materialized XML event objects.
 *
 * Use `StreamReader` instead when current-token access and lower allocation are
 * more important than retaining event objects.
 */
export class EventReader implements AsyncIterable<AnyXmlEvent>, AsyncIterator<AnyXmlEvent> {
  private readonly reader: StreamReader;
  constructor(input: StreamReaderSource, options: EventReaderOptions = {}) { this.reader = new StreamReader(input, options); }
  /** Return this reader as its async iterator. */
  [Symbol.asyncIterator](): AsyncIterator<AnyXmlEvent> { return this; }
  /** Read the next materialized event. */
  next(): Promise<IteratorResult<AnyXmlEvent>> { return nextMaterialized(this.reader); }
  /** Stop parsing and close the underlying input iterator. */
  close(): Promise<void> { return this.reader.close(); }
  /** Close the reader when async iteration ends early. */
  async return(): Promise<IteratorResult<AnyXmlEvent>> { await this.close(); return { value: undefined, done: true }; }
}
