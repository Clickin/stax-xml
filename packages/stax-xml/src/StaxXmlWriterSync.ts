// StaxXmlWriter.ts - Optimized version with real performance improvements
import { NamespaceDeclaration, WriteElementOptions } from './types';

/**
 * Sink interface for custom sync targets.
 */
export interface SyncTextSink {
  write(chunk: string): void;
  flush?(): void;
  close?(): void;
}

/**
 * Writer output options shared by string and sink variants.
 */
export interface StaxXmlWriterSyncOptions {
  encoding?: string; // Output encoding (default: 'utf-8')
  prettyPrint?: boolean; // Enable pretty print (default: false)
  indentString?: string; // Pretty print indentation string (default: '  ')
  addEntities?: { entity: string, value: string }[]; // Custom entities
  autoEncodeEntities?: boolean; // Enable automatic entity encoding (default: true)
  namespaces?: NamespaceDeclaration[]; // Default namespace declarations for the document
}

/**
 * Writer options for sink-based sync mode.
 */
export interface StaxXmlWriterSyncSinkOptions extends StaxXmlWriterSyncOptions {
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
   * Whether to flush the sink after writeEndDocument() closes this writer.
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

type WriterState = typeof WriterState[keyof typeof WriterState];

abstract class AbstractStaxXmlWriterSync {
  // OPTIMIZATION 1: Static cached regex and entity map for basic entities
  private static readonly BASIC_ENTITY_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  };
  private static readonly BASIC_ENTITY_REGEX = /[&<>"']/g;

  protected state: WriterState = WriterState.INITIAL;
  protected elementStack: string[] = [];
  protected hasTextContentStack: boolean[] = [];
  protected namespaceStack: Map<string, string>[] = [];
  protected namespaceOwnedStack: boolean[] = [];
  protected readonly options: Required<StaxXmlWriterSyncOptions>;
  protected currentIndentLevel: number = 0;
  protected needsIndent: boolean = false;
  protected indentCache: string[] = [''];

  private customEntityRegex?: RegExp;
  private fullEntityMap?: Record<string, string>;
  private customEntityKeys?: string[];

  protected constructor(options: StaxXmlWriterSyncOptions = {}) {
    this.options = {
      encoding: 'utf-8',
      prettyPrint: false,
      indentString: '  ',
      addEntities: [],
      autoEncodeEntities: true,
      namespaces: [],
      ...options
    };

    // Initialize namespace stack (root namespace context)
    this.namespaceStack = [new Map<string, string>()];
    this.namespaceOwnedStack = [true];

    // OPTIMIZATION 1: Build custom entity map and regex at construction time
    if (this.options.addEntities && this.options.addEntities.length > 0) {
      this.fullEntityMap = {
        ...AbstractStaxXmlWriterSync.BASIC_ENTITY_MAP,
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
        k => !(k in AbstractStaxXmlWriterSync.BASIC_ENTITY_MAP)
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
    this.state = WriterState.AFTER_ELEMENT;

    let declaration = `<?xml version="${version}"`;
    if (encoding) {
      declaration += ` encoding="${encoding.toUpperCase()}"`;
      this.options.encoding = encoding;
    } else {
      const actualEncoding = this.options.encoding || 'UTF-8';
      declaration += ` encoding="${actualEncoding.toUpperCase()}"`;
    }
    declaration += '?>';
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
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      return;
    }

    while (this.elementStack.length > 0) {
      this.writeEndElement();
    }
    this.state = WriterState.CLOSED;
  }

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

    if (comment) {
      this._writeIndent();
      this._write(`<!-- ${comment} -->`);
      this._writeNewline();
    }

    this._writeIndent();
    const qualifiedName = prefix ? `${prefix}:${localName}` : localName;
    this._write(`<${qualifiedName}`);

    const parentNamespaces = this.namespaceStack[this.namespaceStack.length - 1]!;
    let currentNamespaces = parentNamespaces;
    let ownsNamespaces = false;

    if (prefix && uri) {
      this._write(` xmlns:${prefix}="${this._escapeXml(uri)}"`);
      if (parentNamespaces.get(prefix) !== uri) {
        currentNamespaces = new Map(parentNamespaces);
        currentNamespaces.set(prefix, uri);
        ownsNamespaces = true;
      }
    }

    if (attributes) {
      let attrString = '';
      for (const key in attributes) {
        const value = attributes[key];
        if (value === undefined) {
          continue;
        }
        if (typeof value === 'string') {
          attrString += ` ${key}="${this._escapeXml(value)}"`;
        } else {
          const attrPrefix = value.prefix;
          const attrValue = value.value;

          if (attrPrefix) {
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
        this._write(attrString);
      }
    }

    if (selfClosing) {
      this._write('/>');
      this.state = WriterState.AFTER_ELEMENT;
      this._writeNewline();
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

  public writeAttribute(localName: string, value: string, prefix?: string): this {
    if (this.state !== WriterState.START_ELEMENT_OPEN) {
      throw new Error('writeAttribute can only be called after writeStartElement.');
    }
    let attrName = prefix ? `${prefix}:${localName}` : localName;
    const attr = ` ${attrName}="${this._escapeXml(value)}"`;
    this._write(attr);
    return this;
  }

  public writeNamespace(prefix: string, uri: string): this {
    if (this.state !== WriterState.START_ELEMENT_OPEN) {
      throw new Error('writeNamespace can only be called after writeStartElement.');
    }

    const currentNamespaces = this._ensureMutableNamespaceContext();

    if (prefix) {
      this._write(` xmlns:${prefix}="${this._escapeXml(uri)}"`);
      currentNamespaces.set(prefix, uri);
    } else {
      this._write(` xmlns="${this._escapeXml(uri)}"`);
      currentNamespaces.set('', uri);
    }
    return this;
  }

  public writeCharacters(text: string): this {
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      throw new Error('Cannot writeCharacters: Writer is closed or in error state.');
    }
    this._closeStartElementTag();
    this._write(this._escapeXml(text));
    this.state = WriterState.IN_ELEMENT;
    if (this.hasTextContentStack.length > 0) {
      this.hasTextContentStack[this.hasTextContentStack.length - 1] = true;
    }
    this.needsIndent = false;
    return this;
  }

  public writeCData(cdata: string): this {
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      throw new Error('Cannot writeCData: Writer is closed or in error state.');
    }
    this._closeStartElementTag();
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

  public writeComment(comment: string): this {
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      throw new Error('Cannot writeComment: Writer is closed or in error state.');
    }
    this._closeStartElementTag();
    if (comment.includes('--')) {
      throw new Error('XML comment cannot contain "--" sequence.');
    }
    this._writeIndent();
    this._write(`<!-- ${comment} -->`);
    this.state = WriterState.AFTER_ELEMENT;
    this._writeNewline();
    return this;
  }

  public writeProcessingInstruction(target: string, data?: string): this {
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      throw new Error('Cannot writeProcessingInstruction: Writer is closed or in error state.');
    }
    this._closeStartElementTag();
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

  public writeRaw(xml: string): this {
    this._closeStartElementTag();
    this._write(xml);
    return this;
  }

  public writeEndElement(): this {
    if (this.elementStack.length === 0) {
      throw new Error('No open element to close.');
    }
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
      throw new Error('Cannot writeEndElement: Writer is closed or in error state.');
    }

    this.currentIndentLevel--;

    const hasTextContent = this.hasTextContentStack.pop() || false;

    if (!hasTextContent && this.state !== WriterState.START_ELEMENT_OPEN) {
      this._writeIndent();
    }

    this._closeStartElementTag();

    const closingTagName = this.elementStack.pop()!;
    this.namespaceStack.pop();
    this.namespaceOwnedStack.pop();
    this._write(`</${closingTagName}>`);

    this.state = WriterState.AFTER_ELEMENT;
    if (this.options.prettyPrint) {
      this.needsIndent = true;
    }
    return this;
  }

  public setPrettyPrint(enabled: boolean): this {
    this.options.prettyPrint = enabled;
    return this;
  }

  public setIndentString(indentString: string): this {
    this.options.indentString = indentString;
    this.indentCache = [''];
    return this;
  }

  public isPrettyPrintEnabled(): boolean {
    return this.options.prettyPrint;
  }

  public getIndentString(): string {
    return this.options.indentString;
  }

  protected abstract _emit(chunk: string): void;

  private _write(chunk: string): void {
    if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) return;
    this._emit(chunk);
  }

  private _ensureMutableNamespaceContext(): Map<string, string> {
    const index = this.namespaceStack.length - 1;
    let namespaces = this.namespaceStack[index]!;
    if (!this.namespaceOwnedStack[index]) {
      namespaces = new Map(namespaces);
      this.namespaceStack[index] = namespaces;
      this.namespaceOwnedStack[index] = true;
    }
    return namespaces;
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

      return text.replace(AbstractStaxXmlWriterSync.BASIC_ENTITY_REGEX,
        (match) => AbstractStaxXmlWriterSync.BASIC_ENTITY_MAP[match] || match);
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

    return text.replace(this.customEntityRegex, (match) => this.fullEntityMap![match] || match);
  }
}

/**
 * String-based sync writer.
 */
export class StaxXmlWriterSync extends AbstractStaxXmlWriterSync {
  private xmlString = '';

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
export class StaxXmlWriterSyncSink extends AbstractStaxXmlWriterSync {
  private readonly sink: SyncTextSink;
  private readonly bufferSize: number;
  private readonly enableAutoFlush: boolean;
  private readonly flushThreshold: number;
  private readonly flushOnClose: boolean;
  private buffer = '';

  constructor(sink: SyncTextSink, options: StaxXmlWriterSyncSinkOptions = {}) {
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
    this.buffer += chunk;
    if (this.enableAutoFlush && this.buffer.length >= this.flushThreshold) {
      this.flush();
    }
  }

  public writeEndDocument(): void {
    super.writeEndDocument();
    this.flush();
  }

  public flush(): void {
    if (this.buffer.length === 0) {
      return;
    }
    const output = this.buffer;
    this.buffer = '';
    this.sink.write(output);
  }

  public close(): void {
    this.flush();
    if (this.flushOnClose && this.sink.flush) {
      this.sink.flush();
    }
    if (this.sink.close) {
      this.sink.close();
    }
  }
}

export default StaxXmlWriterSync;
