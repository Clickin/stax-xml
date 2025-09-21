// StaxXmlWriterAsync.ts
import { NamespaceDeclaration, WriteElementOptions } from './types';

const WriterState = {
  INITIAL: 0,
  START_ELEMENT_OPEN: 1,
  IN_ELEMENT: 2,
  AFTER_ELEMENT: 3,
  CLOSED: 4,
  ERROR: 5
} as const;

type WriterState = typeof WriterState[keyof typeof WriterState];

interface ElementInfo {
  localName: string;
  prefix?: string;
}

/**
 * Configuration options for the StaxXmlWriter
 *
 * @public
 */
export interface StaxXmlWriterOptions {
  /**
   * Text encoding for the output stream
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
   * Namespace declarations to include
   * @defaultValue []
   */
  namespaces?: NamespaceDeclaration[];

  /**
   * Internal buffer size in bytes
   * @defaultValue 16384
   */
  bufferSize?: number;

  /**
   * WritableStream backpressure threshold
   * @defaultValue 65536
   */
  highWaterMark?: number;

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
 * const writer = new StaxXmlWriter(writableStream);
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
 * const writer = new StaxXmlWriter(writableStream, options);
 * ```
 *
 * @public
 */
export class StaxXmlWriter {
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private encoder: TextEncoder;
  private buffer: Uint8Array;
  private bufferPosition: number = 0;

  private state: WriterState = WriterState.INITIAL;
  private elementStack: ElementInfo[] = [];
  private hasTextContentStack: boolean[] = [];
  private namespaceStack: Map<string, string>[] = [];

  private readonly options: Required<StaxXmlWriterOptions>;
  private currentIndentLevel: number = 0;
  private needsIndent: boolean = false;
  private entityMap: Record<string, string> = {};

  // Performance metrics
  private metrics = {
    totalBytesWritten: 0,
    flushCount: 0,
    lastFlushTime: 0
  };

  constructor(
    stream: WritableStream<Uint8Array>,
    options: StaxXmlWriterOptions = {}
  ) {
    this.options = {
      encoding: 'utf-8',
      prettyPrint: false,
      indentString: '  ',
      addEntities: options.addEntities ?? [],
      autoEncodeEntities: true,
      namespaces: [],
      bufferSize: 16 * 1024,         // 16KB default
      highWaterMark: 64 * 1024,      // 64KB backpressure
      flushThreshold: 0.8,            // Flush when 80% full
      enableAutoFlush: true,
      ...options,
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

    // Initialize entity map
    this._initializeEntityMap();
  }

  private _initializeEntityMap(): void {
    if (this.options.addEntities) {
      for (const entity of this.options.addEntities) {
        if (entity.entity && entity.value) {
          this.entityMap[entity.entity] = entity.value;
        }
      }
    }
  }

  /**
   * Write data to buffer (with automatic flush)
   */
  private async _writeToBuffer(text: string): Promise<void> {
    const bytes = this.encoder.encode(text);

    // If single chunk is larger than buffer, write directly to stream
    if (bytes.length > this.options.bufferSize) {
      await this._flushBuffer();
      await this.writer.write(bytes);
      this.metrics.totalBytesWritten += bytes.length;
      return;
    }

    // Flush if buffer doesn't have enough space
    if (this.bufferPosition + bytes.length > this.options.bufferSize) {
      await this._flushBuffer();
    }

    // Write to buffer
    this.buffer.set(bytes, this.bufferPosition);
    this.bufferPosition += bytes.length;

    // Auto flush when threshold is reached
    if (this.options.enableAutoFlush &&
      this.bufferPosition >= this.options.flushThreshold) {
      await this._flushBuffer();
    }
  }

  /**
   * Buffer flush
   */
  private async _flushBuffer(): Promise<void> {
    if (this.bufferPosition === 0) return;

    const chunk = this.buffer.slice(0, this.bufferPosition);
    await this.writer.write(chunk);

    this.metrics.totalBytesWritten += this.bufferPosition;
    this.metrics.flushCount++;
    this.metrics.lastFlushTime = Date.now();

    this.bufferPosition = 0;
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

    this.state = WriterState.AFTER_ELEMENT;

    const actualEncoding = encoding || this.options.encoding;
    const declaration = `<?xml version="${version}" encoding="${actualEncoding.toUpperCase()}"?>`;

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

    const tagName = prefix ? `${prefix}:${localName}` : localName;
    await this._writeToBuffer(`<${tagName}`);

    // Namespace processing
    const currentNamespaces = new Map(
      this.namespaceStack[this.namespaceStack.length - 1]
    );

    if (prefix && uri) {
      await this._writeToBuffer(` xmlns:${prefix}="${this._escapeXml(uri)}"`);
      currentNamespaces.set(prefix, uri);
    }

    // Attribute processing
    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        if (typeof value === 'string') {
          await this._writeToBuffer(` ${key}="${this._escapeXml(value)}"`);
        } else {
          const attrPrefix = value.prefix;
          const attrValue = value.value;

          if (attrPrefix) {
            if (!currentNamespaces.has(attrPrefix)) {
              throw new Error(`Namespace prefix '${attrPrefix}' is not defined`);
            }
            await this._writeToBuffer(
              ` ${attrPrefix}:${key}="${this._escapeXml(attrValue)}"`
            );
          } else {
            await this._writeToBuffer(` ${key}="${this._escapeXml(attrValue)}"`);
          }
        }
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

    this.elementStack.push({ localName, prefix });
    this.hasTextContentStack.push(false);
    this.namespaceStack.push(currentNamespaces);
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

    const elementInfo = this.elementStack.pop()!;
    this.namespaceStack.pop();

    const closingTagName = elementInfo.prefix
      ? `${elementInfo.prefix}:${elementInfo.localName}`
      : elementInfo.localName;

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
      const indent = '\n' + this.options.indentString.repeat(this.currentIndentLevel);
      await this._writeToBuffer(indent);
      this.needsIndent = false;
    }
  }

  private async _writeNewline(): Promise<void> {
    if (this.options.prettyPrint) {
      await this._writeToBuffer('\n');
      this.needsIndent = true;
    }
  }

  private _escapeXml(text: string): string {
    if (!text) {
      return ''; // Return empty string as-is
    }
    if (!this.options.autoEncodeEntities) {
      return text; // Return original text if automatic entity encoding is disabled
    }

    let entityMap: Record<string, string> = {
      '&': '&amp;', // During write process, & does not conflict with other entities
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\'': '&apos;',
      ...this.options.addEntities?.reduce((map, entity) => {
        if (entity.entity && entity.value) {
          map[entity.entity] = entity.value;
        }
        return map;
      }, {} as Record<string, string>)
    };

    // Convert entityMap keys to regex for escaping
    const regex = new RegExp(Object.keys(entityMap).join('|'), 'g');
    // Escape processing
    return text.replace(regex, (match) => {
      // If character is defined in entityMap, return mapped value
      if (entityMap[match]) {
        return entityMap[match];
      }
      else {
        // Return undefined characters as-is
        return match;
      }
    });
  }
}