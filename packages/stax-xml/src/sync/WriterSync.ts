import {
  assertXmlEncodingName,
  type AnyXmlEvent,
  type WriteElementOptions,
} from "@stax-xml/core";
import { WriterCore } from "../WriterCore.js";

/** Sink interface for custom sync targets. */
export interface SyncTextSink {
  readonly encoding?: string;
  /** Write a serialized XML text chunk. */
  write(chunk: string): void;
  /** Flush buffered text when supported. */
  flush?(): void;
  /** Close the sink when supported. */
  close?(): void;
}
/** Options for string-based synchronous writing. */
export interface WriterSyncOptions {
  encoding?: string;
  prettyPrint?: boolean;
  indentString?: string;
  addEntities?: { entity: string; value: string }[];
  autoEncodeEntities?: boolean;
}
/** Options for incremental synchronous sink writing. */
export interface WriterSyncSinkOptions extends WriterSyncOptions {
  bufferSize?: number;
  enableAutoFlush?: boolean;
  flushOnClose?: boolean;
  flushThreshold?: number;
}

/** String-based synchronous XML writer. */
export class WriterSync {
  protected readonly core: WriterCore;
  private xmlString = "";

  public constructor(
    options: WriterSyncOptions = {},
    encoding: string = utf8Encoding(options.encoding),
  ) {
    this.core = new WriterCore({ ...options, encoding }, (chunk) =>
      this._emit(chunk),
    );
  }
  /** Return XML accumulated by this string writer. */
  public getXmlString(): string {
    return this.xmlString;
  }
  /** Extension hook retained for existing subclasses; wrappers call it only for core chunks. */
  protected _emit(chunk: string): void {
    this.xmlString += chunk;
  }
  /** Write an XML declaration. */
  public writeStartDocument(
    version: "1.0" = "1.0",
    encoding?: string,
    standalone?: boolean,
  ): this {
    this.core.writeStartDocument(version, encoding, standalone);
    return this;
  }
  /** Finish the XML document. */
  public writeEndDocument(): void {
    this.core.writeEndDocument();
  }
  /** Open an element. */
  public writeStartElement(
    localName: string,
    options?: WriteElementOptions,
  ): this {
    this.core.writeStartElement(localName, options);
    return this;
  }
  /** Close the current element. */
  public writeEndElement(): this {
    this.core.writeEndElement();
    return this;
  }
  /** Write escaped character data. */
  public writeCharacters(text: string): this {
    this.core.writeCharacters(text);
    return this;
  }
  /** Write a CDATA section. */
  public writeCData(cdata: string): this {
    this.core.writeCData(cdata);
    return this;
  }
  /** Add an attribute to the open start tag. */
  public writeAttribute(
    localName: string,
    value: string,
    prefix?: string,
  ): this {
    this.core.writeAttribute(localName, value, prefix);
    return this;
  }
  /** Add a namespace declaration to the open start tag. */
  public writeNamespace(prefix: string, uri: string): this {
    this.core.writeNamespace(prefix, uri);
    return this;
  }
  /** Write an XML comment. */
  public writeComment(comment: string): this {
    this.core.writeComment(comment);
    return this;
  }
  /** Write a processing instruction. */
  public writeProcessingInstruction(target: string, data?: string): this {
    this.core.writeProcessingInstruction(target, data);
    return this;
  }
  /** Write a document type declaration. */
  public writeDTD(value: string): this {
    this.core.writeDTD(value);
    return this;
  }
  /** Write one standard materialized XML event. */
  public writeEvent(event: AnyXmlEvent): this {
    if (event.type === "END_DOCUMENT") this.writeEndDocument();
    else this.core.writeEvent(event);
    return this;
  }
  /** Write trusted XML text without escaping. */
  public writeRaw(xml: string): this {
    this.core.writeRaw(xml);
    return this;
  }
  /** Enable or disable pretty printing. */
  public setPrettyPrint(enabled: boolean): this {
    this.core.setPrettyPrint(enabled);
    return this;
  }
  /** Set the indentation unit used by pretty printing. */
  public setIndentString(indentString: string): this {
    this.core.setIndentString(indentString);
    return this;
  }
  /** Return whether pretty printing is enabled. */
  public isPrettyPrintEnabled(): boolean {
    return this.core.isPrettyPrintEnabled();
  }
  /** Return the current indentation unit. */
  public getIndentString(): string {
    return this.core.getIndentString();
  }
}

/** Sink-based sync writer. I/O and flushing live here, outside WriterCore. */
export class WriterSyncSink extends WriterSync {
  private buffer = "";
  private readonly bufferSize: number;
  private readonly enableAutoFlush: boolean;
  private readonly flushThreshold: number;
  private readonly flushOnClose: boolean;

  constructor(
    private readonly sink: SyncTextSink,
    options: WriterSyncSinkOptions = {},
  ) {
    const encoding =
      sink.encoding === undefined
        ? utf8Encoding(options.encoding)
        : externalEncoding(sink.encoding, options.encoding);
    super(options, encoding);
    this.bufferSize = Math.max(1, options.bufferSize ?? 16 * 1024);
    this.enableAutoFlush = options.enableAutoFlush ?? true;
    const threshold = options.flushThreshold ?? 0.8;
    this.flushThreshold = Math.max(
      1,
      Math.floor(threshold <= 1 ? this.bufferSize * threshold : threshold),
    );
    this.flushOnClose = options.flushOnClose ?? false;
  }
  protected override _emit(chunk: string): void {
    try {
      let remaining = chunk;
      while (remaining) {
        if (!this.buffer && remaining.length >= this.bufferSize) {
          this.sink.write(remaining);
          return;
        }
        const available = this.bufferSize - this.buffer.length;
        this.buffer += remaining.slice(0, available);
        remaining = remaining.slice(available);
        if (
          this.buffer.length >= this.bufferSize ||
          (this.enableAutoFlush && this.buffer.length >= this.flushThreshold)
        )
          this.flushBuffer();
      }
    } catch (error) {
      this.core.fail();
      throw error;
    }
  }
  /** Finish the document and flush serialized text to the sink. */
  public override writeEndDocument(): void {
    super.writeEndDocument();
    this.flushBuffer();
    if (this.flushOnClose) this.sink.flush?.();
  }
  /** Flush buffered text to the sink. */
  public flush(): void {
    if (this.core.failed) throw new Error("Writer is in error state.");
    try {
      this.flushBuffer();
      this.sink.flush?.();
    } catch (error) {
      this.core.fail();
      throw error;
    }
  }
  /** Finalize the document and close the sink. */
  public close(): void {
    const finalized = !this.core.closed && !this.core.failed;
    if (finalized) this.writeEndDocument();
    try {
      this.flushBuffer();
      if (!finalized && this.flushOnClose) this.sink.flush?.();
      this.sink.close?.();
    } catch (error) {
      this.core.fail();
      throw error;
    }
  }
  private flushBuffer(): void {
    if (!this.buffer) return;
    const output = this.buffer;
    this.buffer = "";
    this.sink.write(output);
  }
}
export default WriterSync;

function utf8Encoding(value = "utf-8"): "UTF-8" {
  if (value.toLowerCase() !== "utf-8")
    throw new Error(`Writer only supports UTF-8 output, received: ${value}`);
  return "UTF-8";
}
function externalEncoding(
  sinkEncoding: string,
  optionEncoding?: string,
): string {
  assertXmlEncodingName(sinkEncoding);
  const target =
    sinkEncoding.toLowerCase() === "utf-8" ? "UTF-8" : sinkEncoding;
  if (
    optionEncoding !== undefined &&
    optionEncoding.toLowerCase() !== target.toLowerCase()
  )
    throw new Error(
      `Writer encoding '${optionEncoding}' does not match output encoding '${target}'.`,
    );
  return target;
}
