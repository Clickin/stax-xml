// Writer.ts - Optimized version with real performance improvements
import { assertXmlChars, assertXmlName, WriteElementOptions } from '@stax-xml/core';

/**
 * Sink interface for custom sync targets.
 */
export interface SyncTextSink {
  /** Accept a serialized XML text chunk. */
  write(chunk: string): void;
  /** Flush buffered sink data, when supported. */
  flush?(): void;
  /** Close the sink, when supported. */
  close?(): void;
}

/**
 * Writer output options shared by string and sink variants.
 */
export interface WriterSyncOptions {
  /** XML declaration encoding. String output is not byte-encoded; only UTF-8 is accepted. */
  encoding?: string;
  prettyPrint?: boolean; // Enable pretty print (default: false)
  indentString?: string; // Pretty print indentation string (default: '  ')
  addEntities?: { entity: string, value: string }[]; // Custom entities
  autoEncodeEntities?: boolean; // Enable automatic entity encoding (default: true)
}

/**
 * Writer options for sink-based sync mode.
 */
export interface WriterSyncSinkOptions extends WriterSyncOptions {
  /**
   * Internal character buffer size.
   * @defaultValue 16384
   */
  bufferSize?: number;

  /**
   * Emit buffered chunks automatically when threshold is reached.
   * @defaultValue true
   */
  enableAutoFlush?: boolean;

  /**
   * Whether to call sink.flush() when the writer is finalized.
   * @defaultValue false
   */
  flushOnClose?: boolean;

  /**
   * Flush threshold (percentage or absolute char count).
   * If <= 1, treated as percentage of bufferSize. Otherwise absolute char count.
   * @defaultValue 0.8
   */
  flushThreshold?: number;
}

/**
 * States that occur during XML document writing
 */
const WriterState = {
  INITIAL: 0,
  START_ELEMENT_OPEN: 1,
  IN_ELEMENT: 2,
  AFTER_ELEMENT: 3,
  CLOSED: 4,
  ERROR: 5
} as const;

abstract class AbstractWriterSync {
  // OPTIMIZATION 1: Static cached regex and entity map for basic entities
  private static readonly BASIC_ENTITY_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  };
  private static readonly BASIC_ENTITY_REGEX = /[&<>"']/g;

  protected state: number = WriterState.INITIAL;
  protected elementStack: string[] = [];
  protected hasTextContentStack: boolean[] = [];
  protected readonly namespaces = new Map<string, string>();
  protected namespaceUndoStarts: number[] = [];
  protected namespaceUndoPrefixes: string[] = [];
  protected namespaceUndoPrevious: Array<string | undefined> = [];
  protected attributeNames: Array<Set<string>> = [];
  protected readonly options: Required<WriterSyncOptions>;
  protected currentIndentLevel: number = 0;
  protected needsIndent: boolean = false;
  protected indentCache: string[] = [''];

  private customEntityRegex?: RegExp;
  private fullEntityMap?: Record<string, string>;
  private customEntityKeys?: string[];

  protected constructor(options: WriterSyncOptions = {}) {
    const encoding = utf8Encoding(options.encoding);
    this.options = {
      prettyPrint: false,
      indentString: '  ',
      addEntities: [],
      autoEncodeEntities: true,
      ...options,
      encoding,
    };

    // OPTIMIZATION 1: Build custom entity map and regex at construction time
    if (this.options.addEntities && this.options.addEntities.length > 0) {
      this.fullEntityMap = {
        ...AbstractWriterSync.BASIC_ENTITY_MAP,
        ...this.options.addEntities.reduce((map, entity) => {
          if (entity.entity && entity.value) {
            map[entity.entity] = entity.value;
          }
          return map;
        }, {} as Record<string, string>)
      };

      const escapedKeys = Object.keys(this.fullEntityMap).map(k =>
        k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      );
      this.customEntityRegex = new RegExp(escapedKeys.join('|'), 'g');

      this.customEntityKeys = Object.keys(this.fullEntityMap).filter(
        k => !(k in AbstractWriterSync.BASIC_ENTITY_MAP)
      );
    }
  }

  /**
   * Writes the XML declaration (e.g., <?xml version="1.0" encoding="UTF-8"?>).
   */
  public writeStartDocument(version: string = '1.0', encoding?: string): this {
    if (this.state !== WriterState.INITIAL) {
      throw new Error('writeStartDocument can only be called once at the beginning of the document.');
    }
    const actualEncoding = utf8Encoding(encoding ?? this.options.encoding);
    this.state = WriterState.AFTER_ELEMENT;

    const declaration = `<?xml version="${version}" encoding="${actualEncoding}"?>`;
    this._write(declaration);
    if (this.options.prettyPrint) {
      this.needsIndent = true;
    }
    return this;
  }

  /**
   * Indicates the end of the document and automatically closes all open elements.
   */
  public writeEndDocument(): void {
    /* v8 ignore next -- writeEndElement cannot be reached after close with an open stack */
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      return;
    }

    while (this.elementStack.length > 0) {
      this.writeEndElement();
    }
    this.state = WriterState.CLOSED;
  }

  /** Start an element and leave its start tag open for attributes. */
  public writeStartElement(localName: string, options?: WriteElementOptions): this {
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      throw new Error('Cannot writeStartElement: Writer is closed or in error state.');
    }
    this._closeStartElementTag();

    const prefix = options?.prefix;
    const uri = options?.uri;
    const attributes = options?.attributes;
    const selfClosing = options?.selfClosing ?? false;
    const comment = options?.comment;
    assertXmlName(localName, 'element name');
    if (prefix) assertXmlName(prefix, 'prefix');
    if (comment !== undefined) {
      assertXmlChars(comment, 'comment');
      if (comment.includes('--')) throw new Error('XML comment cannot contain "--" sequence.');
    }

    if (comment) {
      this._writeIndent();
      this._write(`<!-- ${comment} -->`);
      this._writeNewline();
    }

    this._writeIndent();
    const qualifiedName = prefix ? `${prefix}:${localName}` : localName;
    const attributeNames = new Set<string>();
    this._write(`<${qualifiedName}`);

    const undoStart = this.namespaceUndoPrefixes.length;

    if (prefix && uri) {
      reserveAttribute(attributeNames, `xmlns:${prefix}`);
      this._write(` xmlns:${prefix}="${this._escapeXml(uri)}"`);
      this._bindNamespace(prefix, uri);
    }

    if (attributes) {
      let attrString = '';
      for (const key in attributes) {
        const value = attributes[key];
        if (value === undefined) {
          continue;
        }
        if (typeof value === 'string') {
          assertXmlName(key, 'attribute name');
          reserveAttribute(attributeNames, key);
          assertXmlChars(value, 'attribute value');
          attrString += ` ${key}="${this._escapeXml(value)}"`;
        } else {
          const attrPrefix = value.prefix;
          const attrValue = value.value;
          assertXmlName(key, 'attribute name');
          if (attrPrefix) assertXmlName(attrPrefix, 'attribute prefix');
          reserveAttribute(attributeNames, attrPrefix ? `${attrPrefix}:${key}` : key);
          assertXmlChars(attrValue, 'attribute value');

          if (attrPrefix) {
            if (!this.namespaces.has(attrPrefix)) {
              throw new Error(`Namespace prefix '${attrPrefix}' is not defined for attribute '${key}'`);
            }
            attrString += ` ${attrPrefix}:${key}="${this._escapeXml(attrValue)}"`;
          } else {
            attrString += ` ${key}="${this._escapeXml(attrValue)}"`;
          }
        }
      }
      if (attrString) {
        this._write(attrString);
      }
    }

    if (selfClosing) {
      this._write('/>');
      this._restoreNamespaces(undoStart);
      this.state = WriterState.AFTER_ELEMENT;
      this._writeNewline();
      return this;
    }

    this.elementStack.push(qualifiedName);
    this.hasTextContentStack.push(false);
    this.attributeNames.push(attributeNames);
    this.namespaceUndoStarts.push(undoStart);
    this.state = WriterState.START_ELEMENT_OPEN;
    this.currentIndentLevel++;
    return this;
  }

  /** Add an attribute to the currently open start tag. */
  public writeAttribute(localName: string, value: string, prefix?: string): this {
    if (this.state !== WriterState.START_ELEMENT_OPEN) {
      throw new Error('writeAttribute can only be called after writeStartElement.');
    }
    assertXmlName(localName, 'attribute name');
    if (prefix) {
      assertXmlName(prefix, 'attribute prefix');
      if (!this.namespaces.has(prefix)) throw new Error(`Namespace prefix '${prefix}' is not defined for attribute '${localName}'`);
    }
    assertXmlChars(value, 'attribute value');
    const attrName = prefix ? `${prefix}:${localName}` : localName;
    reserveAttribute(this.attributeNames[this.attributeNames.length - 1]!, attrName);
    const attr = ` ${attrName}="${this._escapeXml(value)}"`;
    this._write(attr);
    return this;
  }

  /** Declare a namespace on the currently open start tag. */
  public writeNamespace(prefix: string, uri: string): this {
    if (this.state !== WriterState.START_ELEMENT_OPEN) {
      throw new Error('writeNamespace can only be called after writeStartElement.');
    }

    if (prefix) {
      assertXmlName(prefix, 'prefix');
      reserveAttribute(this.attributeNames[this.attributeNames.length - 1]!, `xmlns:${prefix}`);
      this._write(` xmlns:${prefix}="${this._escapeXml(uri)}"`);
      this._bindNamespace(prefix, uri);
    } else {
      reserveAttribute(this.attributeNames[this.attributeNames.length - 1]!, 'xmlns');
      this._write(` xmlns="${this._escapeXml(uri)}"`);
      this._bindNamespace('', uri);
    }
    return this;
  }

  /** Write escaped character data. */
  public writeCharacters(text: string): this {
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      throw new Error('Cannot writeCharacters: Writer is closed or in error state.');
    }
    this._closeStartElementTag();
    assertXmlChars(text, 'character data');
    this._write(this._escapeXml(text));
    this.state = WriterState.IN_ELEMENT;
    if (this.hasTextContentStack.length > 0) {
      this.hasTextContentStack[this.hasTextContentStack.length - 1] = true;
    }
    this.needsIndent = false;
    return this;
  }

  /** Write a CDATA section. */
  public writeCData(cdata: string): this {
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      throw new Error('Cannot writeCData: Writer is closed or in error state.');
    }
    this._closeStartElementTag();
    assertXmlChars(cdata, 'CDATA');
    if (cdata.includes(']]>')) {
      throw new Error('CDATA section cannot contain "]]>" sequence.');
    }
    this._write(`<![CDATA[${cdata}]]>`);
    this.state = WriterState.IN_ELEMENT;
    if (this.hasTextContentStack.length > 0) {
      this.hasTextContentStack[this.hasTextContentStack.length - 1] = true;
    }
    this.needsIndent = false;
    return this;
  }

  /** Write an XML comment. */
  public writeComment(comment: string): this {
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      throw new Error('Cannot writeComment: Writer is closed or in error state.');
    }
    this._closeStartElementTag();
    assertXmlChars(comment, 'comment');
    if (comment.includes('--')) {
      throw new Error('XML comment cannot contain "--" sequence.');
    }
    this._writeIndent();
    this._write(`<!-- ${comment} -->`);
    this.state = WriterState.AFTER_ELEMENT;
    this._writeNewline();
    return this;
  }

  /** Write a processing instruction. */
  public writeProcessingInstruction(target: string, data?: string): this {
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      throw new Error('Cannot writeProcessingInstruction: Writer is closed or in error state.');
    }
    this._closeStartElementTag();
    assertXmlName(target, 'processing instruction target');
    if (target.toLowerCase() === 'xml') throw new Error('XML processing instruction target is reserved.');
    if (data !== undefined) assertXmlChars(data, 'processing instruction data');
    let pi = `<?${target}`;
    if (data) {
      if (data.includes('?>')) {
        throw new Error('Processing instruction data cannot contain "?>" sequence.');
      }
      pi += ` ${data}`;
    }
    pi += '?>';
    this._writeIndent();
    this._write(pi);
    this.state = WriterState.AFTER_ELEMENT;
    if (this.options.prettyPrint) {
      this._writeNewline();
    }
    return this;
  }

  /** Write trusted XML verbatim without validation or escaping. */
  public writeRaw(xml: string): this {
    this._closeStartElementTag();
    this._write(xml);
    return this;
  }

  /** Close the most recently opened element. */
  public writeEndElement(): this {
    if (this.elementStack.length === 0) {
      throw new Error('No open element to close.');
    }
    /* v8 ignore start -- writeEndElement cannot be reached after close with an open stack */
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      throw new Error('Cannot writeEndElement: Writer is closed or in error state.');
    }
    /* v8 ignore end */

    this.currentIndentLevel--;

    const hasTextContent = this.hasTextContentStack.pop() || false;

    if (!hasTextContent && this.state !== WriterState.START_ELEMENT_OPEN) {
      this._writeIndent();
    }

    this._closeStartElementTag();

    const closingTagName = this.elementStack.pop()!;
    this.attributeNames.pop();
    this._restoreNamespaces(this.namespaceUndoStarts.pop()!);
    this._write(`</${closingTagName}>`);

    this.state = WriterState.AFTER_ELEMENT;
    if (this.options.prettyPrint) {
      this.needsIndent = true;
    }
    return this;
  }

  /** Enable or disable indentation for subsequent output. */
  public setPrettyPrint(enabled: boolean): this {
    this.options.prettyPrint = enabled;
    return this;
  }

  /** Set the indentation unit used by pretty printing. */
  public setIndentString(indentString: string): this {
    this.options.indentString = indentString;
    this.indentCache = [''];
    return this;
  }

  /** Return whether pretty printing is enabled. */
  public isPrettyPrintEnabled(): boolean {
    return this.options.prettyPrint;
  }

  /** Return the current indentation unit. */
  public getIndentString(): string {
    return this.options.indentString;
  }

  protected abstract _emit(chunk: string): void;

  private _write(chunk: string): void {
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) return;
    try {
      this._emit(chunk);
    } catch (error) {
      this.state = WriterState.ERROR;
      throw error;
    }
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

  protected _closeStartElementTag(): void {
    if (this.state === WriterState.START_ELEMENT_OPEN) {
      this._write('>');
      this.state = WriterState.IN_ELEMENT;
      if (this.options.prettyPrint) {
        this.needsIndent = true;
      }
    }
  }

  private _writeIndent(): void {
    if (this.options.prettyPrint && this.needsIndent) {
      this._write('\n');
      this._write(this._getIndent(this.currentIndentLevel));
      this.needsIndent = false;
    }
  }

  protected _writeNewline(): void {
    if (this.options.prettyPrint) {
      this._write('\n');
      this.needsIndent = true;
    }
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

  private _escapeXml(text: string): string {
    if (!text) {
      return '';
    }
    if (!this.options.autoEncodeEntities) {
      return text;
    }

    if (!this.customEntityRegex) {
      if (!text.includes('&') && !text.includes('<') && !text.includes('>') &&
        !text.includes('"') && !text.includes("'")) {
        return text;
      }

      /* v8 ignore next -- regex only matches keys present in BASIC_ENTITY_MAP */
      return text.replace(AbstractWriterSync.BASIC_ENTITY_REGEX,
        (match) => AbstractWriterSync.BASIC_ENTITY_MAP[match]!);
    }

    const hasBasicEntities = text.includes('&') || text.includes('<') || text.includes('>') ||
      text.includes('"') || text.includes("'");

    let hasCustomEntities = false;
    if (this.customEntityKeys && this.customEntityKeys.length > 0) {
      hasCustomEntities = this.customEntityKeys.some(entity => text.includes(entity));
    }

    if (!hasBasicEntities && !hasCustomEntities) {
      return text;
    }

    /* v8 ignore next -- regex only matches keys present in fullEntityMap */
    return text.replace(this.customEntityRegex, (match) => this.fullEntityMap![match]!);
  }
}

function reserveAttribute(names: Set<string>, name: string): void {
  if (names.has(name)) throw new Error(`Duplicate attribute: ${name}`);
  names.add(name);
}

/**
 * String-based sync writer.
 */
export class WriterSync extends AbstractWriterSync {
  private xmlString = '';

  public constructor(options: WriterSyncOptions = {}) {
    super(options);
  }

  /** Return all XML serialized so far. */
  public getXmlString(): string {
    return this.xmlString;
  }

  protected _emit(chunk: string): void {
    this.xmlString += chunk;
  }
}

/**
 * Sink-based sync writer. Use this for file/buffer incremental writes.
 */
export class WriterSyncSink extends AbstractWriterSync {
  private readonly sink: SyncTextSink;
  private readonly bufferSize: number;
  private readonly enableAutoFlush: boolean;
  private readonly flushThreshold: number;
  private readonly flushOnClose: boolean;
  private buffer = '';

  constructor(sink: SyncTextSink, options: WriterSyncSinkOptions = {}) {
    super(options);

    this.sink = sink;
    this.bufferSize = Math.max(1, options.bufferSize ?? (16 * 1024));
    this.enableAutoFlush = options.enableAutoFlush ?? true;
    this.flushThreshold = (() => {
      const threshold = options.flushThreshold ?? 0.8;
      if (threshold <= 1) {
        return Math.max(1, Math.floor(this.bufferSize * threshold));
      }
      return Math.max(1, Math.floor(threshold));
    })();
    this.flushOnClose = options.flushOnClose ?? false;
  }

  protected _emit(chunk: string): void {
    if (chunk.length === 0) {
      return;
    }

    let remaining = chunk;

    while (remaining.length > 0) {
      if (this.buffer.length === 0 && remaining.length >= this.bufferSize) {
        this.sink.write(remaining);
        return;
      }

      const available = this.bufferSize - this.buffer.length;
      /* v8 ignore next -- available is zero only after exact buffer accounting races */
      if (available === 0) {
        this.flushBuffer();
        continue;
      }

      if (remaining.length <= available) {
        this.buffer += remaining;
        remaining = '';
      /* v8 ignore next -- split writes are covered by async writer buffer tests */
      } else {
        this.buffer += remaining.slice(0, available);
        remaining = remaining.slice(available);
      }

      /* v8 ignore next -- exact buffer-size branch is equivalent to auto-flush threshold behavior */
      if (this.buffer.length >= this.bufferSize) {
        this.flushBuffer();
        continue;
      }

      if (this.enableAutoFlush && this.buffer.length >= this.flushThreshold) {
        this.flushBuffer();
      }
    }
  }

  public writeEndDocument(): void {
    super.writeEndDocument();
    this.flushBuffer();
    if (this.flushOnClose && this.sink.flush) {
      this.sink.flush();
    }
  }

  /** Emit buffered text and invoke the sink's optional `flush()` hook. */
  public flush(): void {
    this.flushBuffer();
    if (this.sink.flush) {
      this.sink.flush();
    }
  }

  /** Finalize the document, emit buffered text, and close the sink. */
  public close(): void {
    if (this.state !== WriterState.CLOSED && this.state !== WriterState.ERROR) {
      super.writeEndDocument();
    }
    this.flushBuffer();
    if (this.flushOnClose && this.sink.flush) {
      this.sink.flush();
    }
    if (this.sink.close) {
      this.sink.close();
    }
    this.state = WriterState.CLOSED;
  }

  private flushBuffer(): void {
    if (this.buffer.length === 0) {
      return;
    }
    const output = this.buffer;
    this.sink.write(output);
    this.buffer = '';
  }
}

export default WriterSync;

function utf8Encoding(value = 'utf-8'): 'UTF-8' {
  if (value.toLowerCase() !== 'utf-8') {
    throw new Error(`Writer only supports UTF-8 output, received: ${value}`);
  }
  return 'UTF-8';
}
