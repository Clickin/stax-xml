// WriterAsync.ts
import { WriteElementOptions } from '@stax-xml/core';

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
   * XML declaration encoding. Writer output is always UTF-8.
   * Values other than UTF-8 are rejected.
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
   * Internal buffer size in bytes
   * @defaultValue 16384
   */
  bufferSize?: number;

  /**
   * Automatic flush threshold (percentage of bufferSize)
   * @defaultValue 0.8
   */
  flushThreshold?: number;

  /**
   * Whether to enable automatic flushing
   * @defaultValue true
   */
  enableAutoFlush?: boolean;
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
 * await writer.writeElement('item', { id: '1' }, 'Hello World');
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

  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private encoder: TextEncoder;
  private buffer: Uint8Array;
  private bufferPosition: number = 0;

  private state: WriterState = WriterState.INITIAL;
  private elementStack: string[] = [];
  private hasTextContentStack: boolean[] = [];
  private namespaceStack: Map<string, string>[] = [];
  private namespaceOwnedStack: boolean[] = [];

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
    flushCount: 0,
    lastFlushTime: 0
  };

  constructor(
    stream: WritableStream<Uint8Array>,
    options: WriterOptions = {}
  ) {
    const encoding = utf8Encoding(options.encoding);
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

    this.writer = stream.getWriter();
    this.encoder = new TextEncoder();
    this.buffer = new Uint8Array(this.options.bufferSize);

    // Initialize namespace stack
    this.namespaceStack = [new Map<string, string>()];
    this.namespaceOwnedStack = [true];

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
        await this.writer.write(encoded);
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

    const bytesWritten = this.bufferPosition;
    const chunk = bytesWritten === this.buffer.length
      ? this.buffer
      : this.buffer.subarray(0, bytesWritten);
    this.buffer = new Uint8Array(this.options.bufferSize);
    this.bufferPosition = 0;

    await this.writer.write(chunk);

    this.metrics.totalBytesWritten += bytesWritten;
    this.metrics.flushCount++;
    this.metrics.lastFlushTime = Date.now();
  }

  /**
   * Write XML declaration
   */
  public async writeStartDocument(
    version: string = '1.0',
    encoding?: string
  ): Promise<this> {
    if (this.state !== WriterState.INITIAL) {
      throw new Error('writeStartDocument can only be called once at the beginning');
    }

    const actualEncoding = utf8Encoding(encoding ?? this.options.encoding);
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
    await this.writer.close();
    this.state = WriterState.CLOSED;
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

    await this._closeStartElementTag();

    const prefix = options?.prefix;
    const uri = options?.uri;
    const attributes = options?.attributes;
    const selfClosing = options?.selfClosing ?? false;

    // Indentation
    if (this.options.prettyPrint && this.needsIndent) {
      await this._writeIndent();
    }

    const qualifiedName = prefix ? `${prefix}:${localName}` : localName;
    await this._writeToBuffer(`<${qualifiedName}`);

    // Namespace processing
    const parentNamespaces = this.namespaceStack[this.namespaceStack.length - 1]!;
    let currentNamespaces = parentNamespaces;
    let ownsNamespaces = false;

    if (prefix && uri) {
      await this._writeToBuffer(` xmlns:${prefix}="${this._escapeXml(uri)}"`);
      if (parentNamespaces.get(prefix) !== uri) {
        currentNamespaces = new Map(parentNamespaces);
        currentNamespaces.set(prefix, uri);
        ownsNamespaces = true;
      }
    }

    // OPTIMIZATION 2: Attribute string batching
    // Build entire attribute string first, then single _writeToBuffer call
    if (attributes) {
      let attrString = '';
      for (const key in attributes) {
        const value = attributes[key];
        if (value === undefined) {
          continue;
        }
        if (typeof value === 'string') {
          // Simple string attribute
          attrString += ` ${key}="${this._escapeXml(value)}"`;
        } else {
          // AttributeInfo object - attribute with prefix
          const attrPrefix = value.prefix;
          const attrValue = value.value;

          if (attrPrefix) {
            // Check if prefix is defined in namespace
            if (!currentNamespaces.has(attrPrefix)) {
              throw new Error(`Namespace prefix '${attrPrefix}' is not defined for attribute '${key}'`);
            }
            attrString += ` ${attrPrefix}:${key}="${this._escapeXml(attrValue)}"`;
          } else {
            attrString += ` ${key}="${this._escapeXml(attrValue)}"`;
          }
        }
      }
      if (attrString) {
        await this._writeToBuffer(attrString);
      }
    }

    if (selfClosing) {
      await this._writeToBuffer('/>');
      this.state = WriterState.AFTER_ELEMENT;
      if (this.options.prettyPrint) {
        await this._writeNewline();
      }
      return this;
    }

    this.elementStack.push(qualifiedName);
    this.hasTextContentStack.push(false);
    this.namespaceStack.push(currentNamespaces);
    this.namespaceOwnedStack.push(ownsNamespaces);
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

    this.currentIndentLevel--;

    const hasTextContent = this.hasTextContentStack.pop() || false;

    if (!hasTextContent && this.state !== WriterState.START_ELEMENT_OPEN) {
      await this._writeIndent();
    }

    await this._closeStartElementTag();

    const closingTagName = this.elementStack.pop()!;
    this.namespaceStack.pop();
    this.namespaceOwnedStack.pop();

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
    await this._closeStartElementTag();
    await this._writeToBuffer(xml);
    return this;
  }

  /**
   * Manual flush
   */
  public async flush(): Promise<void> {
    await this._flushBuffer();
  }

  /**
   * Return metrics
   */
  public getMetrics() {
    return {
      ...this.metrics,
      bufferUtilization: this.bufferPosition / this.options.bufferSize,
      averageFlushSize: this.metrics.flushCount > 0
        ? this.metrics.totalBytesWritten / this.metrics.flushCount
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
}

function utf8Encoding(value = 'utf-8'): 'UTF-8' {
  if (value.toLowerCase() !== 'utf-8') {
    throw new Error(`Writer only supports UTF-8 output, received: ${value}`);
  }
  return 'UTF-8';
}
