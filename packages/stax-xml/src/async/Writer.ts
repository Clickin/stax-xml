import {
  assertXmlEncodingName,
  type AnyXmlEvent,
  type WriteElementOptions,
} from "@stax-xml/core";
import { WriterCore } from "../WriterCore.js";

/** Options shared by the asynchronous XML writer and its serializer core. */
export interface WriterOptions {
  encoding?: string;
  prettyPrint?: boolean;
  indentString?: string;
  addEntities?: { entity: string; value: string }[];
  autoEncodeEntities?: boolean;
  bufferSize?: number;
  flushThreshold?: number;
  enableAutoFlush?: boolean;
}
/** Text sink for external streaming encoders. */
export interface AsyncTextSink {
  readonly encoding: string;
  /** Write a serialized XML text chunk. */
  write(chunk: string): void | Promise<void>;
  /** Flush buffered text when supported. */
  flush?(): void | Promise<void>;
  /** Close the sink when supported. */
  close?(): void | Promise<void>;
}

/** Asynchronous I/O wrapper for the shared WriterCore serializer. */
export class Writer {
  private writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
  private textSink: AsyncTextSink | undefined;
  private textBuffer = "";
  private readonly encoder = new TextEncoder();
  private buffer: Uint8Array;
  private bufferPosition = 0;
  private pendingText = "";
  private readonly core: WriterCore;
  private readonly bufferSize: number;
  private readonly flushThreshold: number;
  private readonly enableAutoFlush: boolean;

  constructor(
    output: WritableStream<Uint8Array> | AsyncTextSink,
    options: WriterOptions = {},
  ) {
    const textSink = isAsyncTextSink(output) ? output : undefined;
    if (textSink && typeof textSink.write !== "function")
      throw new TypeError("AsyncTextSink.write must be a function.");
    const encoding = textSink
      ? externalEncoding(textSink.encoding, options.encoding)
      : utf8Encoding(options.encoding);
    this.core = new WriterCore({ ...options, encoding }, (chunk) => {
      this.pendingText += chunk;
    });
    this.bufferSize = Math.max(1, options.bufferSize ?? 16 * 1024);
    const threshold = options.flushThreshold ?? 0.8;
    this.flushThreshold = Math.max(
      1,
      Math.floor(threshold <= 1 ? this.bufferSize * threshold : threshold),
    );
    this.enableAutoFlush = options.enableAutoFlush ?? true;
    this.buffer = new Uint8Array(this.bufferSize);
    if (textSink) this.textSink = textSink;
    else this.writer = (output as WritableStream<Uint8Array>).getWriter();
  }

  private async run(operation: () => void): Promise<void> {
    try {
      operation();
    } catch (error) {
      this.pendingText = "";
      throw error;
    }
    const text = this.pendingText;
    this.pendingText = "";
    try {
      await this.writeToBuffer(text);
    } catch (error) {
      this.pendingText = "";
      this.core.fail();
      throw error;
    }
  }
  /** Write an XML declaration. */
  public async writeStartDocument(
    version: "1.0" = "1.0",
    encoding?: string,
    standalone?: boolean,
  ): Promise<this> {
    await this.run(() =>
      this.core.writeStartDocument(version, encoding, standalone),
    );
    return this;
  }
  /** Open an element. */
  public async writeStartElement(
    localName: string,
    options?: WriteElementOptions,
  ): Promise<this> {
    await this.run(() => this.core.writeStartElement(localName, options));
    return this;
  }
  /** Close the current element. */
  public async writeEndElement(): Promise<this> {
    await this.run(() => this.core.writeEndElement());
    return this;
  }
  /** Write escaped character data. */
  public async writeCharacters(text: string): Promise<this> {
    await this.run(() => this.core.writeCharacters(text));
    return this;
  }
  /** Write a CDATA section. */
  public async writeCData(cdata: string): Promise<this> {
    await this.run(() => this.core.writeCData(cdata));
    return this;
  }
  /** Add an attribute to the open start tag. */
  public async writeAttribute(
    localName: string,
    value: string,
    prefix?: string,
  ): Promise<this> {
    await this.run(() => this.core.writeAttribute(localName, value, prefix));
    return this;
  }
  /** Add a namespace declaration to the open start tag. */
  public async writeNamespace(prefix: string, uri: string): Promise<this> {
    await this.run(() => this.core.writeNamespace(prefix, uri));
    return this;
  }
  /** Write an XML comment. */
  public async writeComment(comment: string): Promise<this> {
    await this.run(() => this.core.writeComment(comment));
    return this;
  }
  /** Write a processing instruction. */
  public async writeProcessingInstruction(
    target: string,
    data?: string,
  ): Promise<this> {
    await this.run(() => this.core.writeProcessingInstruction(target, data));
    return this;
  }
  /** Write a document type declaration. */
  public async writeDTD(value: string): Promise<this> {
    await this.run(() => this.core.writeDTD(value));
    return this;
  }
  /** Write one standard materialized XML event. */
  public async writeEvent(event: AnyXmlEvent): Promise<this> {
    if (event.type === "END_DOCUMENT") await this.writeEndDocument();
    else await this.run(() => this.core.writeEvent(event));
    return this;
  }
  /** Write trusted XML text without escaping. */
  public async writeRaw(xml: string): Promise<this> {
    await this.run(() => this.core.writeRaw(xml));
    return this;
  }

  /** Finish the XML document and close the output. */
  public async writeEndDocument(): Promise<void> {
    if (this.core.closed || this.core.failed) return;
    await this.run(() => this.core.writeEndDocument());
    await this.flushBuffer();
    try {
      if (this.textSink) {
        await this.textSink.flush?.();
        await this.textSink.close?.();
      } else await this.writer!.close();
    } catch (error) {
      this.core.fail();
      throw error;
    }
  }
  /** Close the writer and its output. */
  public async close(): Promise<void> {
    await this.writeEndDocument();
  }
  /** Flush buffered output. */
  public async flush(): Promise<void> {
    if (this.core.failed || this.core.closed)
      throw new Error("Cannot flush: Writer is closed or in error state");
    await this.flushBuffer();
    try {
      await this.textSink?.flush?.();
    } catch (error) {
      this.core.fail();
      throw error;
    }
  }

  private async writeToBuffer(text: string): Promise<void> {
    if (!text) return;
    if (this.textSink) {
      this.textBuffer += text;
      this.bufferPosition = this.textBuffer.length;
      if (
        this.bufferPosition >=
        (this.enableAutoFlush ? this.flushThreshold : this.bufferSize)
      )
        await this.flushBuffer();
      return;
    }
    let offset = 0;
    while (offset < text.length) {
      if (this.bufferPosition >= this.bufferSize) await this.flushBuffer();
      const source = offset ? text.slice(offset) : text;
      const { read, written } = this.encoder.encodeInto(
        source,
        this.buffer.subarray(this.bufferPosition),
      );
      if (!written) {
        await this.flushBuffer();
        const codePoint = Array.from(source)[0]!;
        await this.writeBytes(this.encoder.encode(codePoint));
        offset += codePoint.length;
        continue;
      }
      this.bufferPosition += written;
      offset += read;
      if (this.enableAutoFlush && this.bufferPosition >= this.flushThreshold)
        await this.flushBuffer();
    }
  }
  private async flushBuffer(): Promise<void> {
    if (!this.bufferPosition) return;
    if (this.textSink) {
      const chunk = this.textBuffer;
      this.textBuffer = "";
      this.bufferPosition = 0;
      await this.writeText(chunk);
      return;
    }
    const chunk = this.buffer.subarray(0, this.bufferPosition);
    this.buffer = new Uint8Array(this.bufferSize);
    this.bufferPosition = 0;
    await this.writeBytes(chunk);
  }
  private async writeBytes(chunk: Uint8Array): Promise<void> {
    try {
      await this.writer!.write(chunk);
    } catch (error) {
      this.core.fail();
      throw error;
    }
  }
  private async writeText(chunk: string): Promise<void> {
    try {
      await this.textSink!.write(chunk);
    } catch (error) {
      this.core.fail();
      throw error;
    }
  }
}
function isAsyncTextSink(
  output: WritableStream<Uint8Array> | AsyncTextSink,
): output is AsyncTextSink {
  return typeof (output as WritableStream<Uint8Array>).getWriter !== "function";
}
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
