import { NEED_INPUT, TokenCursor, materializeTokenEvent, type AnyXmlEvent, type DocumentMode, type XmlEventType } from '@stax-xml/core';

export type StreamReaderSource = AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>;
export interface StreamReaderOptions {
  documentMode?: DocumentMode;
  /** Resolve namespaces and omit xmlns declarations from attributes. @defaultValue true */
  namespaceAware?: boolean;
}

export class StreamReader {
  private readonly cursor: TokenCursor;
  private readonly iterator: AsyncIterator<Uint8Array>;
  private readonly decoder = new TextDecoder('utf-8', { fatal: true });
  private inFlight = false;
  private closed = false;
  private closing: Promise<void> | undefined;

  constructor(source: StreamReaderSource, options: StreamReaderOptions = {}) {
    this.cursor = new TokenCursor('', false, options);
    this.iterator = isReadableStream(source) ? streamIterator(source) : source[Symbol.asyncIterator]();
    // The package-internal pump accesses these private fields through ReaderState.
    void this.iterator; void this.decoder; void this.inFlight; void this.closed; void this.closing;
  }
  next(): Promise<XmlEventType | null> { return advance(this, false); }
  close(): Promise<void> { return closeReader(this as unknown as ReaderState); }
  eventType(): XmlEventType { return this.cursor.eventType(); }
  name(): string | undefined { return this.cursor.name(); }
  text(): string | undefined { return this.cursor.text(); }
  localName(): string | undefined { return this.cursor.localName(); }
  prefix(): string { return this.cursor.prefix(); }
  namespaceURI(): string { return this.cursor.namespaceURI(); }
  attributeCount(): number { return this.cursor.attributeCount(); }
  attributeName(index: number): string | undefined { return this.cursor.attribute(index)?.name; }
  attributeLocalName(index: number): string | undefined { return this.cursor.attribute(index)?.localName; }
  attributePrefix(index: number): string | undefined { return this.cursor.attribute(index)?.prefix; }
  attributeNamespaceURI(index: number): string | undefined { return this.cursor.attribute(index)?.namespaceURI; }
  attributeValue(indexOrNameOrNamespace: number | string, localName?: string): string | undefined {
    return this.cursor.attribute(indexOrNameOrNamespace, localName)?.value;
  }
  namespaceURIForPrefix(prefix: string): string { return this.cursor.namespaceURIForPrefix(prefix); }
}

/** @internal */
export function nextMaterialized(reader: StreamReader): Promise<IteratorResult<AnyXmlEvent>> { return advance(reader, true); }

interface ReaderState {
  cursor: TokenCursor;
  iterator: AsyncIterator<Uint8Array>;
  decoder: TextDecoder;
  inFlight: boolean;
  closed: boolean;
  closing: Promise<void> | undefined;
}

function advance(reader: StreamReader, event: false): Promise<XmlEventType | null>;
function advance(reader: StreamReader, event: true): Promise<IteratorResult<AnyXmlEvent>>;
function advance(reader: StreamReader, event: boolean): Promise<XmlEventType | null | IteratorResult<AnyXmlEvent>> {
  const state = reader as unknown as ReaderState;
  if (state.inFlight) return Promise.reject(new Error('Concurrent next() calls are not allowed.'));
  if (state.closed) return Promise.resolve(project(state.cursor, null, event));
  state.inFlight = true;
  try {
    const result = state.cursor.next();
    if (result === NEED_INPUT) return refill(state, event);
    state.inFlight = false;
    return Promise.resolve(project(state.cursor, result, event));
  } catch (error) {
    state.inFlight = false;
    return fail(state, error);
  }
}

async function refill(state: ReaderState, event: boolean): Promise<XmlEventType | null | IteratorResult<AnyXmlEvent>> {
  try {
    while (true) {
      const part = await state.iterator.next();
      if (state.closed) return project(state.cursor, null, event);
      if (part.done) state.cursor.push(state.decoder.decode(), true);
      else {
        if (!(part.value instanceof Uint8Array)) throw new Error('Reader chunks must be Uint8Array values.');
        state.cursor.push(state.decoder.decode(part.value, { stream: true }));
      }
      const result = state.cursor.next();
      if (result !== NEED_INPUT) return project(state.cursor, result, event);
    }
  } catch (error) {
    return fail(state, error);
  } finally {
    state.inFlight = false;
  }
}

function closeReader(state: ReaderState): Promise<void> {
  if (state.closing) return state.closing;
  state.closed = true;
  state.cursor.dispose();
  state.closing = closeIterator(state.iterator);
  return state.closing;
}

async function closeIterator(iterator: AsyncIterator<Uint8Array>): Promise<void> { await iterator.return?.(); }

async function fail(state: ReaderState, error: unknown): Promise<never> {
  try { await closeReader(state); } catch { /* Preserve the parse/decode error. */ }
  throw error;
}

function project(cursor: TokenCursor, type: XmlEventType | null, event: boolean): XmlEventType | null | IteratorResult<AnyXmlEvent> {
  if (!event) return type;
  if (type === null) return { value: undefined, done: true };
  return { value: materializeTokenEvent(cursor, type), done: false };
}

function isReadableStream(source: StreamReaderSource): source is ReadableStream<Uint8Array> { return typeof (source as ReadableStream<Uint8Array>).getReader === 'function'; }
function streamIterator(stream: ReadableStream<Uint8Array>): AsyncIterator<Uint8Array> {
  const reader = stream.getReader();
  let closed = false;
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    reader.releaseLock();
  };
  return {
    async next(): Promise<IteratorResult<Uint8Array>> {
      if (closed) return { value: undefined, done: true };
      const item = await reader.read();
      if (item.done) { closed = true; release(); }
      return item;
    },
    async return(): Promise<IteratorResult<Uint8Array>> {
      if (!closed) {
        closed = true;
        try { await reader.cancel(); } catch { /* Closing an errored stream is already complete. */ }
      }
      release();
      return { value: undefined, done: true };
    },
  };
}
