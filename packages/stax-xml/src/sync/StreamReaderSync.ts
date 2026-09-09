import {
  NEED_INPUT,
  attributeValueOf,
  TokenCursorConsumer,
  tokenBackendOf,
  withTokenBackend,
  type DocumentMode,
  type TokenBackendFactory,
  type TokenCursor,
  type TokenReadView,
  type TokenInputSessionSpi,
  type XmlEventType,
} from "@stax-xml/core";

/** Inputs accepted by `StreamReaderSync`. */
export type StreamReaderSyncInput = string | Uint8Array | Iterable<Uint8Array>;
/** Options for synchronous current-token parsing. */
export interface StreamReaderSyncOptions {
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
const BYTE_CHUNK_SIZE = 64 * 1024;
const EMPTY_BYTES = new Uint8Array(0);
const readerViews = new WeakMap<StreamReaderSync, TokenReadView>();

/**
 * Synchronous current-token reader. Strings are scanned directly without
 * encoding; byte inputs are decoded in fatal mode with the configured encoding.
 */
export class StreamReaderSync {
  private readonly producer: TokenCursor;
  private readonly consumer: TokenCursorConsumer;
  private readonly view: TokenReadView;
  private readonly session: TokenInputSessionSpi | undefined;
  private iterator: Iterator<Uint8Array> | undefined;
  private closed = false;

  constructor(
    input: StreamReaderSyncInput,
    options: StreamReaderSyncOptions = {},
  ) {
    const backend = tokenBackendOf(options);
    if (typeof input === "string") {
      this.producer = backend.createStringCursor(input, options);
      this.session = undefined;
    } else if (input instanceof Uint8Array) {
      this.session = backend.createByteSession(byteOptions(options, backend));
      this.producer = this.session.cursor;
      this.iterator = fixedByteChunks(input);
    } else {
      this.session = backend.createByteSession(byteOptions(options, backend));
      this.producer = this.session.cursor;
      // Re-batch caller-supplied byte chunks up to BYTE_CHUNK_SIZE before decoding.
      // Tiny chunks (e.g. per-row iterables, small stream frames) otherwise pay
      // a full backend push round-trip per few bytes; batching recovers that
      // overhead. The backend session owns decoding/tokenization.
      this.iterator = batchByteChunks(
        input[Symbol.iterator](),
        BYTE_CHUNK_SIZE,
      );
    }
    this.consumer = new TokenCursorConsumer(this.producer);
    this.view = this.consumer.current;
    readerViews.set(this, this.view);
  }

  /** Advance to the next token, or return `null` at end of input. */
  next(): XmlEventType | null {
    if (this.closed) return null;
    try {
      while (true) {
        const result = this.consumer.next();
        if (result !== NEED_INPUT) return result;
        const part = this.iterator!.next();
        if (part.done) this.session!.pushBytes(EMPTY_BYTES, true);
        else this.session!.pushBytes(part.value);
      }
    } catch (error) {
      try {
        this.close();
      } catch {
        /* Preserve the parse/decode error. */
      }
      throw error;
    }
  }
  /** Stop parsing and release the underlying input iterator. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.consumer.close();
    if (this.session) this.session.dispose();
    else this.producer.dispose();
    const iterator = this.iterator;
    this.iterator = undefined;
    iterator?.return?.();
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

/** Coalesce small caller-supplied Uint8Array chunks into ~size-byte batches.
 *  Reuses one backing buffer; returned views stay valid only until the next call,
 *  which matches StreamReaderSync's decode-then-refill consumption order. */
function batchByteChunks(
  source: Iterator<Uint8Array>,
  size: number,
): Iterator<Uint8Array> {
  let buffer = new Uint8Array(size);
  let length = 0;
  let done = false;
  return {
    next(): IteratorResult<Uint8Array> {
      if (done) return { value: undefined, done: true };
      while (length < size) {
        const part = source.next();
        if (part.done) {
          done = true;
          break;
        }
        const value = part.value;
        if (!(value instanceof Uint8Array))
          throw new Error("Reader chunks must be Uint8Array values.");
        if (value.byteLength === 0) continue;
        if (length + value.byteLength > buffer.byteLength) {
          const grown = new Uint8Array(
            Math.max(length + value.byteLength, buffer.byteLength * 2),
          );
          grown.set(buffer.subarray(0, length));
          buffer = grown;
        }
        buffer.set(value, length);
        length += value.byteLength;
        if (length >= size) {
          const out = buffer.subarray(0, length);
          length = 0;
          return { value: out, done: false };
        }
      }
      if (length > 0) {
        const out = buffer.subarray(0, length);
        length = 0;
        return { value: out, done: false };
      }
      return { value: undefined, done: true };
    },
    return(): IteratorResult<Uint8Array> {
      done = true;
      source.return?.();
      return { value: undefined, done: true };
    },
  };
}

function fixedByteChunks(input: Uint8Array): Iterator<Uint8Array> {
  let source: Uint8Array | undefined = input;
  let offset = 0;
  return {
    next(): IteratorResult<Uint8Array> {
      /* v8 ignore next -- StreamReaderSync stops requesting fixed chunks after this iterator reports done */
      if (source === undefined) return { value: undefined, done: true };
      if (offset >= source.byteLength) {
        source = undefined;
        return { value: undefined, done: true };
      }
      const value = source.subarray(
        offset,
        Math.min(offset + BYTE_CHUNK_SIZE, source.byteLength),
      );
      offset += value.byteLength;
      return { value, done: false };
    },
    return(): IteratorResult<Uint8Array> {
      source = undefined;
      return { value: undefined, done: true };
    },
  };
}

function byteOptions(
  options: StreamReaderSyncOptions,
  backend: TokenBackendFactory,
): StreamReaderSyncOptions & { encoding: string } {
  if (options.encoding !== undefined)
    return options as StreamReaderSyncOptions & { encoding: string };
  return withTokenBackend(
    { ...options, encoding: "utf-8" },
    backend,
  );
}

/** @internal */
export function tokenViewOf(reader: StreamReaderSync): TokenReadView {
  return readerViews.get(reader)!;
}
