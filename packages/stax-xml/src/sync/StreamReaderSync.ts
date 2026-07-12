import { NEED_INPUT, TokenCursor, type DocumentMode, type XmlEventType } from '@stax-xml/core';

export type StreamReaderSyncInput = string | Uint8Array | Iterable<Uint8Array>;
export interface StreamReaderSyncOptions { documentMode?: DocumentMode }
const BYTE_CHUNK_SIZE = 64 * 1024;

/** Synchronous current-token reader. Strings are scanned directly without encoding. */
export class StreamReaderSync {
  private readonly cursor: TokenCursor;
  private iterator: Iterator<Uint8Array> | undefined;
  private readonly decoder: TextDecoder | undefined;
  private closed = false;

  constructor(input: StreamReaderSyncInput, options: StreamReaderSyncOptions = {}) {
    if (typeof input === 'string') {
      this.cursor = new TokenCursor(input, true, options);
    } else if (input instanceof Uint8Array) {
      this.cursor = new TokenCursor('', false, options);
      this.iterator = fixedByteChunks(input);
      this.decoder = new TextDecoder('utf-8', { fatal: true });
    } else {
      this.cursor = new TokenCursor('', false, options);
      this.iterator = input[Symbol.iterator]();
      this.decoder = new TextDecoder('utf-8', { fatal: true });
    }
  }

  next(): XmlEventType | null {
    if (this.closed) return null;
    try {
      while (true) {
        const result = this.cursor.next();
        if (result !== NEED_INPUT) return result;
        const part = this.iterator!.next();
        if (part.done) {
          this.cursor.push(this.decoder!.decode(), true);
        } else {
          if (!(part.value instanceof Uint8Array)) throw new Error('Reader chunks must be Uint8Array values.');
          this.cursor.push(this.decoder!.decode(part.value, { stream: true }), false);
        }
      }
    } catch (error) {
      try { this.close(); } catch { /* Preserve the parse/decode error. */ }
      throw error;
    }
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.cursor.dispose();
    const iterator = this.iterator;
    this.iterator = undefined;
    iterator?.return?.();
  }
  eventType(): XmlEventType { return this.cursor.eventType(); }
  name(): string | undefined { return this.cursor.name(); }
  text(): string | undefined { return this.cursor.text(); }
  localName(): string | undefined { return this.cursor.localName(); }
  prefix(): string { return this.cursor.prefix(); }
  namespaceURI(): string { return this.cursor.namespaceURI(); }
  attributeCount(): number { return this.cursor.attributeCount(); }
  attributeName(index: number): string | undefined { return this.cursor.attribute(index)?.name; }
  attributeLocalName(index: number): string | undefined { return this.cursor.attributeLocalName(index); }
  attributePrefix(index: number): string | undefined { return this.cursor.attribute(index)?.prefix; }
  attributeNamespaceURI(index: number): string | undefined { return this.cursor.attribute(index)?.namespaceURI; }
  attributeValue(indexOrNameOrNamespace: number | string, localName?: string): string | undefined {
    return typeof indexOrNameOrNamespace === 'number' && localName === undefined
      ? this.cursor.attributeValue(indexOrNameOrNamespace)
      : this.cursor.attribute(indexOrNameOrNamespace, localName)?.value;
  }
  namespaceURIForPrefix(prefix: string): string { return this.cursor.namespaceURIForPrefix(prefix); }
}

function fixedByteChunks(input: Uint8Array): Iterator<Uint8Array> {
  let source: Uint8Array | undefined = input;
  let offset = 0;
  return {
    next(): IteratorResult<Uint8Array> {
      if (source === undefined) return { value: undefined, done: true };
      if (offset >= source.byteLength) {
        source = undefined;
        return { value: undefined, done: true };
      }
      const value = source.subarray(offset, Math.min(offset + BYTE_CHUNK_SIZE, source.byteLength));
      offset += value.byteLength;
      return { value, done: false };
    },
    return(): IteratorResult<Uint8Array> {
      source = undefined;
      return { value: undefined, done: true };
    },
  };
}

/** @internal */
export function tokenCursorOf(reader: StreamReaderSync): TokenCursor {
  return (reader as unknown as { cursor: TokenCursor }).cursor;
}
