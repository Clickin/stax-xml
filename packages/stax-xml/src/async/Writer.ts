// WriterAsync.ts
import {
  assertXmlChars,
  assertXmlEncodingName,
  assertXmlVersion,
  planStartElement,
  WriteElementOptions,
  XML_NAMESPACE_URI
} from '@stax-xml/core';

const WriterState = {
  INITIAL: 0,
  START_ELEMENT_OPEN: 1,
  IN_ELEMENT: 2,
  AFTER_ELEMENT: 3,
  CLOSED: 4,
  ERROR: 5
} as const;

type WriterState = typeof WriterState[keyof typeof WriterState];

/**
 * Configuration options for the Writer
 *
 * @public
 */
export interface WriterOptions {
  /**
   * XML declaration encoding. Byte-stream output is always UTF-8. For an
   * AsyncTextSink, this value must match the sink encoding.
   * @defaultValue 'utf-8'
   */
  encoding?: string;

  /**
   * Whether to format output with indentation
   * @defaultValue false
   */
  prettyPrint?: boolean;

  /**
   * String used for indentation when prettyPrint is true
   * @defaultValue '  '
   */
  indentString?: string;

  /**
   * Additional custom entities to encode
   * @defaultValue []
   */
  addEntities?: { entity: string, value: string }[];

  /**
   * Whether to automatically encode XML entities
   * @defaultValue true
   */
  autoEncodeEntities?: boolean;

  /**
   * Internal buffer size in bytes, or UTF-16 code units for AsyncTextSink output
   * @defaultValue 16384
   */
  bufferSize?: number;

  /**
   * Automatic flush threshold (percentage or output units of bufferSize)
   * @defaultValue 0.8
   */
  flushThreshold?: number;

  /**
   * Whether to enable automatic flushing
   * @defaultValue true
   */
  enableAutoFlush?: boolean;
}

/** Text output boundary for caller-provided streaming encoders. */
export interface AsyncTextSink {
  /** Encoding produced after this text sink's external encoding stage. */
  readonly encoding: string;
  /** Accept a serialized XML text chunk. */
  write(chunk: string): void | Promise<void>;
  /** Flush the external encoding/output chain, when supported. */
  flush?(): void | Promise<void>;
  /** Close the external encoding/output chain, when supported. */
  close?(): void | Promise<void>;
}

/**
 * High-performance asynchronous XML writer implementing the StAX (Streaming API for XML) pattern.
 *
 * This writer provides efficient streaming XML generation using WritableStream for handling
 * large XML documents with automatic buffering, backpressure management, and namespace support.
 *
 * This is an optimized implementation with:
 * - Optimization 1: Regex caching for entity escaping
 * - Optimization 2: Attribute string batching
 * - Optimization 3: Early entity check before regex execution
 * - Optimization 4: Qualified closing-tag stack (avoid rebuilding end tags)
 * - Optimization 5: Copy-on-write namespace frames
 * - Optimization 6: Indentation cache for pretty-print output
 * - Optimization 7: `TextEncoder.encodeInto()` buffering to reduce intermediate byte arrays
 * - Optimization 8: Flush by buffer view to avoid per-flush copy slices
 *
 * @remarks
 * The writer supports streaming output with configurable buffering, automatic entity encoding,
 * pretty printing with customizable indentation, and comprehensive namespace handling.
 *
 * @example
 * Basic usage:
 * ```typescript
 * const writableStream = new WritableStream({
 *   write(chunk) {
 *     console.log(new TextDecoder().decode(chunk));
 *   }
 * });
 *
 * const writer = new Writer(writableStream);
 * await writer.writeStartElement('root');
 * await writer.writeStartElement('item', { attributes: { id: '1' } });
 * await writer.writeCharacters('Hello World');
 * await writer.writeEndElement();
 * await writer.writeEndElement();
 * await writer.close();
 * ```
 *
 * @example
 * With pretty printing:
 * ```typescript
 * const options = {
 *   prettyPrint: true,
 *   indentString: '    ',
 *   autoEncodeEntities: true
 * };
 * const writer = new Writer(writableStream, options);
 * ```
 *
 * @public
 */
export class Writer {
  // OPTIMIZATION 1: Static cached regex and entity map for basic entities
  private static readonly BASIC_ENTITY_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&apos;'
  };
  private static readonly BASIC_ENTITY_REGEX = /[&<>"']/g;

  private writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
  private textSink: AsyncTextSink | undefined;
  private textBuffer = '';
  private encoder: TextEncoder;
  private buffer: Uint8Array;
  private bufferPosition: number = 0;

  private state: WriterState = WriterState.INITIAL;
  private elementStack: string[] = [];
  private hasTextContentStack: boolean[] = [];
  private readonly namespaces = new Map<string, string>();
  private namespaceUndoStarts: number[] = [];
  private namespaceUndoPrefixes: string[] = [];
  private namespaceUndoPrevious: Array<string | undefined> = [];
  private attributeNames: Array<Set<string>> = [];

  private readonly options: Required<WriterOptions>;
  private currentIndentLevel: number = 0;
  private needsIndent: boolean = false;
  private indentCache: string[] = [''];

  // OPTIMIZATION 1: Instance fields for custom entity handling (if any)
  private customEntityRegex?: RegExp;
  private fullEntityMap?: Record<string, string>;
  private customEntityKeys?: string[]; // For fast early checking

  // Performance metrics
  private metrics = {
    totalBytesWritten: 0,
    totalCharactersWritten: 0,
    flushCount: 0,
    lastFlushTime: 0
  };

  constructor(
    output: WritableStream<Uint8Array> | AsyncTextSink,
    options: WriterOptions = {}
  ) {
    const textSink = isAsyncTextSink(output) ? output : undefined;
    if (textSink && typeof textSink.write !== 'function') {
      throw new TypeError('AsyncTextSink.write must be a function.');
    }
    const encoding = textSink
      ? externalEncoding(textSink.encoding, options.encoding)
      : utf8Encoding(options.encoding);
    this.options = {
      encoding,
      prettyPrint: options.prettyPrint ?? false,
      indentString: options.indentString || '  ',
      addEntities: options.addEntities ?? [],
      autoEncodeEntities: options.autoEncodeEntities ?? true,
      bufferSize: options.bufferSize ?? 16 * 1024,         // 16KB default
      flushThreshold: options.flushThreshold ?? 0.8,            // Flush when 80% full
      enableAutoFlush: options.enableAutoFlush ?? true,
    };

    // Convert flushThreshold to actual byte value
    if (this.options.flushThreshold <= 1) {
      this.options.flushThreshold = Math.floor(
        this.options.bufferSize * this.options.flushThreshold
      );
    }

    if (textSink) this.textSink = textSink;
    else this.writer = (output as WritableStream<Uint8Array>).getWriter();
    this.encoder = new TextEncoder();
    this.buffer = new Uint8Array(this.options.bufferSize);

    // OPTIMIZATION 1: Build custom entity map and regex at construction time
    if (this.options.addEntities && this.options.addEntities.length > 0) {
      this.fullEntityMap = {
        ...Writer.BASIC_ENTITY_MAP,
        ...this.options.addEntities.reduce((map, entity) => {
          if (entity.entity && entity.value) {
            map[entity.entity] = entity.value;
          }
          return map;
        }, {} as Record<string, string>)
      };

      // Build regex with proper escaping
      const escapedKeys = Object.keys(this.fullEntityMap).map(k =>
        k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      );
      this.customEntityRegex = new RegExp(escapedKeys.join('|'), 'g');

      // Store custom entity keys (excluding basic ones) for early check
      this.customEntityKeys = Object.keys(this.fullEntityMap).filter(
        k => !(k in Writer.BASIC_ENTITY_MAP)
      );
    }
  }

  /**
   * Write data to buffer (with automatic flush)
   */
  private async _writeToBuffer(text: string): Promise<void> {
    if (text.length === 0) {
      return;
    }

    if (this.textSink) {
      this.textBuffer += text;
      this.bufferPosition = this.textBuffer.length;
      const limit = this.options.enableAutoFlush ? this.options.flushThreshold : this.options.bufferSize;
      if (this.bufferPosition >= limit) {
        await this._flushBuffer();
      }
      return;
    }

    let readOffset = 0;

    while (readOffset < text.length) {
      /* v8 ignore next -- bufferPosition overflow is guarded by encodeInto accounting */
      if (this.bufferPosition >= this.options.bufferSize) {
        await this._flushBuffer();
      }

      const source = readOffset === 0 ? text : text.slice(readOffset);
      const target = this.buffer.subarray(this.bufferPosition);
      const { read, written } = this.encoder.encodeInto(source, target);

      if (written === 0) {
        await this._flushBuffer();
        const codePoint = Array.from(source)[0]!;
        const encoded = this.encoder.encode(codePoint);
        await this._writeChunk(encoded);
        this.metrics.totalBytesWritten += encoded.byteLength;
        this.metrics.flushCount++;
        this.metrics.lastFlushTime = Date.now();
        readOffset += codePoint.length;
        continue;
      }

      this.bufferPosition += written;
      readOffset += read;

      if (this.options.enableAutoFlush &&
        this.bufferPosition >= this.options.flushThreshold) {
        await this._flushBuffer();
      }
    }
  }

  /**
   * Buffer flush
   */
  private async _flushBuffer(): Promise<void> {
    if (this.bufferPosition === 0) return;

    if (this.textSink) {
      const chunk = this.textBuffer;
      this.textBuffer = '';
      this.bufferPosition = 0;
      await this._writeTextChunk(chunk);
      this.metrics.totalCharactersWritten += chunk.length;
      this.metrics.flushCount++;
      this.metrics.lastFlushTime = Date.now();
      return;
    }

    const bytesWritten = this.bufferPosition;
    const chunk = bytesWritten === this.buffer.length
      ? this.buffer
      : this.buffer.subarray(0, bytesWritten);
    this.buffer = new Uint8Array(this.options.bufferSize);
    this.bufferPosition = 0;

    await this._writeChunk(chunk);

    this.metrics.totalBytesWritten += bytesWritten;
    this.metrics.flushCount++;
    this.metrics.lastFlushTime = Date.now();
  }

  /**
   * Write XML declaration
   */
  public async writeStartDocument(
    version: '1.0' = '1.0',
    encoding?: string
  ): Promise<this> {
    if (this.state !== WriterState.INITIAL) {
      throw new Error('writeStartDocument can only be called once at the beginning');
    }

    const actualEncoding = matchingEncoding(encoding ?? this.options.encoding, this.options.encoding);
    assertXmlVersion(version);
    this.state = WriterState.AFTER_ELEMENT;
    const declaration = `<?xml version="${version}" encoding="${actualEncoding}"?>`;

    await this._writeToBuffer(declaration);

    if (this.options.prettyPrint) {
      this.needsIndent = true;
    }

    return this;
  }

  /**
   * End document (automatically close all elements)
   */
  public async writeEndDocument(): Promise<void> {
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      return;
    }

    // Close all open elements
    while (this.elementStack.length > 0) {
      await this.writeEndElement();
    }

    // Final flush
    await this._flushBuffer();

    // Close writer
    try {
      if (this.textSink) {
        await this.textSink.flush?.();
        await this.textSink.close?.();
      } else {
        await this.writer!.close();
      }
      this.state = WriterState.CLOSED;
    } catch (error) {
      this.state = WriterState.ERROR;
      throw error;
    }
  }

  /**
   * Finalize any open elements, flush buffered bytes, and close the underlying stream.
   */
  public async close(): Promise<void> {
    await this.writeEndDocument();
  }

  /**
   * Write start element
   */
  public async writeStartElement(
    localName: string,
    options?: WriteElementOptions
  ): Promise<this> {
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      throw new Error('Cannot writeStartElement: Writer is closed or in error state');
    }

    const selfClosing = options?.selfClosing ?? false;
    const plan = planStartElement(
      localName,
      options,
      prefix => prefix === 'xml' ? XML_NAMESPACE_URI : this.namespaces.get(prefix),
      value => this._escapeXml(value)
    );

    await this._closeStartElementTag();

    if (options?.comment) {
      await this._writeIndent();
      await this._writeToBuffer(`<!-- ${options.comment} -->`);
      await this._writeNewline();
    }

    // Indentation
    if (this.options.prettyPrint && this.needsIndent) {
      await this._writeIndent();
    }

    const undoStart = this.namespaceUndoPrefixes.length;
    await this._writeToBuffer(plan.startTag);
    for (const binding of plan.namespaceBindings) this._bindNamespace(binding.prefix, binding.uri);

    if (selfClosing) {
      await this._writeToBuffer('/>');
      this._restoreNamespaces(undoStart);
      this.state = WriterState.AFTER_ELEMENT;
      if (this.options.prettyPrint) {
        await this._writeNewline();
      }
      return this;
    }

    this.elementStack.push(plan.qualifiedName);
    this.hasTextContentStack.push(false);
    this.attributeNames.push(plan.attributeNames);
    this.namespaceUndoStarts.push(undoStart);
    this.state = WriterState.START_ELEMENT_OPEN;
    this.currentIndentLevel++;

    return this;
  }

  /**
   * Write end element
   */
  public async writeEndElement(): Promise<this> {
    if (this.elementStack.length === 0) {
      throw new Error('No open element to close');
    }
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      throw new Error('Cannot writeEndElement: Writer is closed or in error state');
    }

    this.currentIndentLevel--;

    const hasTextContent = this.hasTextContentStack.pop() || false;

    if (!hasTextContent && this.state !== WriterState.START_ELEMENT_OPEN) {
      await this._writeIndent();
    }

    await this._closeStartElementTag();

    const closingTagName = this.elementStack.pop()!;
    this.attributeNames.pop();
    this._restoreNamespaces(this.namespaceUndoStarts.pop()!);

    await this._writeToBuffer(`</${closingTagName}>`);

    this.state = WriterState.AFTER_ELEMENT;

    if (this.options.prettyPrint) {
      this.needsIndent = true;
    }

    return this;
  }

  /**
   * Write text
   */
  public async writeCharacters(text: string): Promise<this> {
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      throw new Error('Cannot writeCharacters: Writer is closed or in error state');
    }

    assertXmlChars(text, 'character data');
    await this._closeStartElementTag();
    await this._writeToBuffer(this._escapeXml(text));

    this.state = WriterState.IN_ELEMENT;

    if (this.hasTextContentStack.length > 0) {
      this.hasTextContentStack[this.hasTextContentStack.length - 1] = true;
    }

    this.needsIndent = false;

    return this;
  }

  /**
   * Write CDATA section
   */
  public async writeCData(cdata: string): Promise<this> {
    this._assertWritable('writeCData');
    assertXmlChars(cdata, 'CDATA');
    if (cdata.includes(']]>')) {
      throw new Error('CDATA section cannot contain "]]>" sequence');
    }

    await this._closeStartElementTag();
    await this._writeToBuffer(`<![CDATA[${cdata}]]>`);

    this.state = WriterState.IN_ELEMENT;

    if (this.hasTextContentStack.length > 0) {
      this.hasTextContentStack[this.hasTextContentStack.length - 1] = true;
    }

    return this;
  }

  /**
   * Write comment
   */
  public async writeComment(comment: string): Promise<this> {
    this._assertWritable('writeComment');
    assertXmlChars(comment, 'comment');
    if (comment.includes('--')) {
      throw new Error('XML comment cannot contain "--" sequence');
    }

    await this._closeStartElementTag();
    await this._writeIndent();
    await this._writeToBuffer(`<!-- ${comment} -->`);

    this.state = WriterState.AFTER_ELEMENT;

    if (this.options.prettyPrint) {
      await this._writeNewline();
    }

    return this;
  }

  /**
   * Write raw XML content without escaping
   * @param xml Raw XML string to write
   * @returns this (chainable)
   */
  public async writeRaw(xml: string): Promise<this> {
    this._assertWritable('writeRaw');
    await this._closeStartElementTag();
    await this._writeToBuffer(xml);
    return this;
  }

  /**
   * Manual flush
   */
  public async flush(): Promise<void> {
    this._assertWritable('flush');
    await this._flushBuffer();
    if (this.textSink?.flush) {
      try {
        await this.textSink.flush();
      } catch (error) {
        this.state = WriterState.ERROR;
        throw error;
      }
    }
  }

  /**
   * Return metrics
   */
  public getMetrics() {
    return {
      ...this.metrics,
      bufferUtilization: this.bufferPosition / this.options.bufferSize,
      averageFlushSize: this.metrics.flushCount > 0
        ? (this.textSink ? this.metrics.totalCharactersWritten : this.metrics.totalBytesWritten) / this.metrics.flushCount
        : 0
    };
  }

  // === Private Helper Methods ===

  private async _closeStartElementTag(): Promise<void> {
    if (this.state === WriterState.START_ELEMENT_OPEN) {
      await this._writeToBuffer('>');
      this.state = WriterState.IN_ELEMENT;
      if (this.options.prettyPrint) {
        this.needsIndent = true;
      }
    }
  }

  private async _writeChunk(chunk: Uint8Array): Promise<void> {
    try {
      await this.writer!.write(chunk);
    } catch (error) {
      this.state = WriterState.ERROR;
      throw error;
    }
  }

  private async _writeTextChunk(chunk: string): Promise<void> {
    try {
      await this.textSink!.write(chunk);
    } catch (error) {
      this.state = WriterState.ERROR;
      throw error;
    }
  }

  private _assertWritable(action: string): void {
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      throw new Error(`Cannot ${action}: Writer is closed or in error state`);
    }
  }

  private async _writeIndent(): Promise<void> {
    if (this.options.prettyPrint && this.needsIndent) {
      const indent = '\n' + this._getIndent(this.currentIndentLevel);
      await this._writeToBuffer(indent);
      this.needsIndent = false;
    }
  }

  private async _writeNewline(): Promise<void> {
    await this._writeToBuffer('\n');
    this.needsIndent = true;
  }

  /**
   * Escapes XML text.
   * OPTIMIZED with:
   * - Cached regex patterns (Optimization 1)
   * - Early entity check to skip regex when not needed (Optimization 3)
   * - Fast path for no custom entities case (most common)
   * @param text Text to escape
   * @returns Escaped text
   * @private
   */
  private _escapeXml(text: string): string {
    if (!text) {
      return ''; // Return empty string as-is
    }
    if (!this.options.autoEncodeEntities) {
      return text; // Return original text if automatic entity encoding is disabled
    }

    // Fast path: No custom entities case (most common)
    if (!this.customEntityRegex) {
      // Early exit: Check if text contains basic entities
      if (!text.includes('&') && !text.includes('<') && !text.includes('>') &&
          !text.includes('"') && !text.includes("'")) {
        return text; // No escaping needed
      }

      // Use cached basic entity regex
      /* v8 ignore next -- regex only matches keys present in BASIC_ENTITY_MAP */
      return text.replace(Writer.BASIC_ENTITY_REGEX,
        (match) => Writer.BASIC_ENTITY_MAP[match]!);
    }

    // Slow path: Custom entities exist
    // OPTIMIZATION 3: Early exit check (including custom entities)
    const hasBasicEntities = text.includes('&') || text.includes('<') || text.includes('>') ||
                             text.includes('"') || text.includes("'");

    let hasCustomEntities = false;
    if (this.customEntityKeys && this.customEntityKeys.length > 0) {
      hasCustomEntities = this.customEntityKeys.some(entity => text.includes(entity));
    }

    // If no entities present, return original text
    if (!hasBasicEntities && !hasCustomEntities) {
      return text;
    }

    // OPTIMIZATION 1: Use cached custom entity regex
    /* v8 ignore next -- regex only matches keys present in fullEntityMap */
    return text.replace(this.customEntityRegex, (match) => this.fullEntityMap![match]!);
  }

  private _getIndent(level: number): string {
    const cached = this.indentCache[level];
    if (cached !== undefined) {
      return cached;
    }
    const indent = this.options.indentString.repeat(level);
    this.indentCache[level] = indent;
    return indent;
  }

  private _bindNamespace(prefix: string, uri: string): void {
    const previous = this.namespaces.get(prefix);
    if (previous === uri) return;
    this.namespaceUndoPrefixes.push(prefix);
    this.namespaceUndoPrevious.push(previous);
    this.namespaces.set(prefix, uri);
  }

  private _restoreNamespaces(start: number): void {
    while (this.namespaceUndoPrefixes.length > start) {
      const prefix = this.namespaceUndoPrefixes.pop()!;
      const previous = this.namespaceUndoPrevious.pop();
      if (previous === undefined) this.namespaces.delete(prefix);
      else this.namespaces.set(prefix, previous);
    }
  }
}

function utf8Encoding(value = 'utf-8'): 'UTF-8' {
  if (value.toLowerCase() !== 'utf-8') {
    throw new Error(`Writer only supports UTF-8 output, received: ${value}`);
  }
  return 'UTF-8';
}

function externalEncoding(sinkEncoding: string, optionEncoding?: string): string {
  const target = xmlEncoding(sinkEncoding);
  if (optionEncoding !== undefined) matchingEncoding(optionEncoding, target);
  return target;
}

function matchingEncoding(requested: string, target: string): string {
  const actual = xmlEncoding(requested);
  if (actual.toLowerCase() !== target.toLowerCase()) {
    throw new Error(`Writer encoding '${actual}' does not match output encoding '${target}'.`);
  }
  return target;
}

function xmlEncoding(value: string): string {
  assertXmlEncodingName(value);
  return value.toLowerCase() === 'utf-8' ? 'UTF-8' : value;
}

function isAsyncTextSink(output: WritableStream<Uint8Array> | AsyncTextSink): output is AsyncTextSink {
  return typeof (output as WritableStream<Uint8Array>).getWriter !== 'function';
}
