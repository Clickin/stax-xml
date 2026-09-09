import {
  NEED_INPUT,
  attributeValueOf,
  materializeTokenEvent,
  TokenCursorConsumer,
  tokenBackendOf,
  withTokenBackend,
  type AnyXmlEvent,
  type DocumentMode,
  type TokenBackendFactory,
  type TokenCursor,
  type TokenReadView,
  type TokenInputSessionSpi,
  type XmlEventType,
} from "@stax-xml/core";

/** Byte-stream sources accepted by `StreamReader`. */
export type StreamReaderSource =
  | AsyncIterable<Uint8Array>
  | ReadableStream<Uint8Array>;
/** Options for asynchronous current-token parsing. */
export interface StreamReaderOptions {
  documentMode?: DocumentMode;
  /** Resolve namespaces while retaining xmlns declarations in start-event attributes. @defaultValue true */
  namespaceAware?: boolean;
  /** Decode predefined, numeric, and configured custom entities. @defaultValue true */
  autoDecodeEntities?: boolean;
  /** Trusted internal entity replacements available without parsing a DTD. */
  addEntities?: { entity: string; value: string }[];
  /** TextDecoder encoding label for byte input. @defaultValue 'utf-8' */
  encoding?: string;
}

const readerStates = new WeakMap<StreamReader, ReaderState>();

/**
 * Asynchronous, forward-only XML reader backed by a reusable token cursor.
 * Call `next()` before accessing the current token through the accessor methods.
 */
export class StreamReader {
  private readonly producer: TokenCursor;
  private readonly consumer: TokenCursorConsumer;
  private readonly view: TokenReadView;
  private readonly session: TokenInputSessionSpi;
  private readonly iterator: AsyncIterator<Uint8Array>;

  constructor(source: StreamReaderSource, options: StreamReaderOptions = {}) {
    const backend = tokenBackendOf(options);
    this.session = backend.createByteSession(byteOptions(options, backend));
    this.producer = this.session.cursor;
    this.consumer = new TokenCursorConsumer(this.producer);
    this.view = this.consumer.current;
    this.iterator = isReadableStream(source)
      ? streamIterator(source)
      : source[Symbol.asyncIterator]();
    readerStates.set(this, {
      producer: this.producer,
      consumer: this.consumer,
      view: this.view,
      session: this.session,
      iterator: this.iterator,
      inFlight: false,
      closed: false,
      closing: undefined,
    });
  }
  /** Advance to the next token, or return `null` at end of input. */
  next(): Promise<XmlEventType | null> {
    return advance(this, false);
  }
  /** Stop parsing and close the underlying input iterator. */
  close(): Promise<void> {
    return closeReader(stateOf(this));
  }
  /** Return the current token type. */
  eventType(): XmlEventType {
    return this.view.eventType();
  }
  /** Return the current element's qualified name. */
  name(): string | undefined {
    return this.view.name();
  }
  /** Return text carried by the current text-like token. */
  text(): string | undefined {
    return this.view.text();
  }
  /** Return the current element's local name. */
  localName(): string | undefined {
    return this.view.localName();
  }
  /** Return the current element's namespace prefix, or an empty string. */
  prefix(): string {
    return this.view.prefix();
  }
  /** Return the namespace URI resolved for the current element. */
  namespaceURI(): string {
    return this.view.namespaceURI();
  }
  /** Return the number of attributes on the current start element. */
  attributeCount(): number {
    return this.view.attributeCount();
  }
  /** Return an attribute's qualified name by zero-based index. */
  attributeName(index: number): string | undefined {
    return this.view.attributeName(index);
  }
  /** Return an attribute's local name by zero-based index. */
  attributeLocalName(index: number): string | undefined {
    return this.view.attributeLocalName(index);
  }
  /** Return an attribute's namespace prefix by zero-based index. */
  attributePrefix(index: number): string | undefined {
    return this.view.attributePrefix(index);
  }
  /** Return an attribute's namespace URI by zero-based index. */
  attributeNamespaceURI(index: number): string | undefined {
    return this.view.attributeNamespaceURI(index);
  }
  /** Return an attribute value by index, qualified name, or namespace URI plus local name. */
  attributeValue(
    indexOrNameOrNamespace: number | string,
    localName?: string,
  ): string | undefined {
    return attributeValueOf(this.view, indexOrNameOrNamespace, localName);
  }
  /** Resolve a namespace prefix in the current element scope. */
  namespaceURIForPrefix(prefix: string): string {
    return this.view.namespaceURIForPrefix(prefix);
  }
}

/** @internal */
export function nextMaterialized(
  reader: StreamReader,
): Promise<IteratorResult<AnyXmlEvent>> {
  return advance(reader, true);
}

interface ReaderState {
  producer: TokenCursor;
  consumer: TokenCursorConsumer;
  view: TokenReadView;
  session: TokenInputSessionSpi;
  iterator: AsyncIterator<Uint8Array>;
  inFlight: boolean;
  closed: boolean;
  closing: Promise<void> | undefined;
}

function advance(
  reader: StreamReader,
  event: false,
): Promise<XmlEventType | null>;
function advance(
  reader: StreamReader,
  event: true,
): Promise<IteratorResult<AnyXmlEvent>>;
function advance(
  reader: StreamReader,
  event: boolean,
): Promise<XmlEventType | null | IteratorResult<AnyXmlEvent>> {
  const state = stateOf(reader);
  if (state.inFlight)
    return Promise.reject(
      new Error("Concurrent next() calls are not allowed."),
    );
  if (state.closed) return Promise.resolve(project(state.view, null, event));
  state.inFlight = true;
  try {
    const result = state.consumer.next();
    if (result === NEED_INPUT) return refill(state, event);
    state.inFlight = false;
    return Promise.resolve(project(state.view, result, event));
  } catch (error) {
    state.inFlight = false;
    return fail(state, error);
  }
}

async function refill(
  state: ReaderState,
  event: boolean,
): Promise<XmlEventType | null | IteratorResult<AnyXmlEvent>> {
  try {
    while (true) {
      const part = await state.iterator.next();
      if (state.closed) return project(state.view, null, event);
      if (part.done) {
        state.session.pushBytes(EMPTY_BYTES, true);
      } else {
        if (!(part.value instanceof Uint8Array))
          throw new Error("Reader chunks must be Uint8Array values.");
        state.session.pushBytes(part.value);
      }
      const result = state.consumer.next();
      if (result !== NEED_INPUT) return project(state.view, result, event);
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
  state.consumer.close();
  state.session.dispose();
  state.closing = closeIterator(state.iterator);
  return state.closing;
}

function stateOf(reader: StreamReader): ReaderState {
  return readerStates.get(reader)!;
}

async function closeIterator(
  iterator: AsyncIterator<Uint8Array>,
): Promise<void> {
  await iterator.return?.();
}

async function fail(state: ReaderState, error: unknown): Promise<never> {
  try {
    await closeReader(state);
  } catch {
    /* Preserve the parse/decode error. */
  }
  throw error;
}

function project(
  view: TokenReadView,
  type: XmlEventType | null,
  event: boolean,
): XmlEventType | null | IteratorResult<AnyXmlEvent> {
  if (!event) return type;
  if (type === null) return { value: undefined, done: true };
  return { value: materializeTokenEvent(view, type), done: false };
}

const EMPTY_BYTES = new Uint8Array(0);

function byteOptions(
  options: StreamReaderOptions,
  backend: TokenBackendFactory,
): StreamReaderOptions & { encoding: string } {
  if (options.encoding !== undefined)
    return options as StreamReaderOptions & { encoding: string };
  return withTokenBackend(
    { ...options, encoding: "utf-8" },
    backend,
  );
}

function isReadableStream(
  source: StreamReaderSource,
): source is ReadableStream<Uint8Array> {
  return typeof (source as ReadableStream<Uint8Array>).getReader === "function";
}
function streamIterator(
  stream: ReadableStream<Uint8Array>,
): AsyncIterator<Uint8Array> {
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
      /* v8 ignore next -- StreamReader stops calling its private stream iterator after done/close */
      if (closed) return { value: undefined, done: true };
      const item = await reader.read();
      if (item.done) {
        closed = true;
        release();
      }
      return item;
    },
    async return(): Promise<IteratorResult<Uint8Array>> {
      if (!closed) {
        closed = true;
        try {
          await reader.cancel();
        } catch {
          /* Closing an errored stream is already complete. */
        }
      }
      release();
      return { value: undefined, done: true };
    },
  };
}
