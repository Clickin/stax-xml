import { XmlSchema } from "./XmlSchema.js";
import { XmlParseError } from "./errors.js";
import type { XmlNumberOptions, XmlWriteOptions } from "./types.js";
import { SchemaType } from "./types.js";
import { WriterSync, WriterSyncSink } from "@stax-xml/sync";
import { Writer } from "@stax-xml/async";
import {
  elementOptions,
  getOwnWriteConfig,
  getRootWriteConfig,
} from "./write-utils.js";
import { XPathCompiler } from "./XPathEngine.js";

/**
 * Schema for parsing XML number values
 *
 * @public
 */
export class XmlNumberSchema extends XmlSchema<number, number> {
  readonly schemaType = SchemaType.NUMBER;

  constructor(public options: XmlNumberOptions = {}) {
    super();
    if (options.xpath !== undefined) XPathCompiler.compile(options.xpath);
  }

  _parseText(text: string): number {
    // Handle empty or whitespace-only strings gracefully
    const trimmedText = text.trim();
    if (trimmedText === "") {
      throw new XmlParseError([
        {
          path: [],
          message: `No number content found (empty text)`,
          code: "empty_content",
        },
      ]);
    }

    const num = parseFloat(trimmedText);

    if (isNaN(num)) {
      throw new XmlParseError([
        {
          path: [],
          message: `Invalid number: ${trimmedText}`,
          code: "invalid_number",
        },
      ]);
    }

    if (this.options.min !== undefined && num < this.options.min) {
      throw new XmlParseError([
        {
          path: [],
          message: `Number ${num} is less than minimum ${this.options.min}`,
          code: "too_small",
        },
      ]);
    }

    if (this.options.max !== undefined && num > this.options.max) {
      throw new XmlParseError([
        {
          path: [],
          message: `Number ${num} is greater than maximum ${this.options.max}`,
          code: "too_big",
        },
      ]);
    }

    if (this.options.int && !Number.isInteger(num)) {
      throw new XmlParseError([
        {
          path: [],
          message: `Expected integer, got ${num}`,
          code: "not_integer",
        },
      ]);
    }

    return num;
  }

  /**
   * Set XPath expression for locating the element
   * @param path - XPath expression
   * @returns New schema with XPath
   */
  xpath(path: string): XmlNumberSchema {
    return new XmlNumberSchema({ ...this.options, xpath: path });
  }

  /**
   * Set minimum value
   * @param value - Minimum value
   * @returns New schema with minimum
   */
  min(value: number): XmlNumberSchema {
    return new XmlNumberSchema({ ...this.options, min: value });
  }

  /**
   * Set maximum value
   * @param value - Maximum value
   * @returns New schema with maximum
   */
  max(value: number): XmlNumberSchema {
    return new XmlNumberSchema({ ...this.options, max: value });
  }

  /**
   * Require integer value
   * @returns New schema that only accepts integers
   */
  int(): XmlNumberSchema {
    return new XmlNumberSchema({ ...this.options, int: true });
  }

  /**
   * Write raw content only (used inside object schema)
   * @internal
   */
  _writeContent(data: number, options?: XmlWriteOptions): string {
    return this.options.int ? String(Math.floor(data)) : String(data);
  }

  /**
   * Write number data to XML synchronously
   * @internal
   */
  _writeSync(data: number, options?: XmlWriteOptions): string {
    if (!Number.isFinite(data))
      throw new Error("XML number writer requires a finite number.");
    // Use injected writer or create new one
    let writer: WriterSync | WriterSyncSink;
    let isInjected = false;

    if (options?.writer) {
      if (
        options.writer instanceof WriterSync ||
        options.writer instanceof WriterSyncSink
      ) {
        writer = options.writer;
        isInjected = true;
      } else {
        throw new Error(
          "writeSync requires WriterSync or WriterSyncSink instance",
        );
      }
    } else {
      writer = new WriterSync({
        prettyPrint: options?.prettyPrint,
        indentString: options?.indentString,
        encoding: options?.encoding,
      });
    }

    // Write declaration if requested and not injected
    const ownConfig = getOwnWriteConfig(options) ?? this.writeConfig;
    if (
      !isInjected &&
      (options?.rootElement || ownConfig?.element) &&
      options?.includeDeclaration !== false
    ) {
      writer.writeStartDocument(options?.xmlVersion, options?.encoding);
    }

    // Write root element if specified
    if (options?.rootElement) {
      writer.writeStartElement(
        options.rootElement,
        elementOptions(getRootWriteConfig(options)),
      );
    }

    // Write number element (only if not injected - parent handles element when injected)
    if (!isInjected && ownConfig?.element) {
      writer.writeStartElement(ownConfig.element, elementOptions(ownConfig));
    }

    // Write content
    const numberStr = this._writeContent(data, options);
    writer.writeCharacters(numberStr);

    // Close elements (only if not injected)
    if (!isInjected && ownConfig?.element) {
      writer.writeEndElement();
    }
    if (options?.rootElement) {
      writer.writeEndElement();
    }

    // End document if not injected
    if (!isInjected) {
      writer.writeEndDocument();
    }

    return writer.getXmlString();
  }

  /**
   * Write number data to WritableStream asynchronously
   * @internal
   */
  async _write(
    data: number,
    stream: WritableStream<Uint8Array>,
    options?: XmlWriteOptions,
  ): Promise<void> {
    if (!Number.isFinite(data))
      throw new Error("XML number writer requires a finite number.");
    // Use injected writer or create new one
    let writer: Writer;
    let isInjected = false;

    if (options?.writer) {
      if (options.writer instanceof Writer) {
        writer = options.writer;
        isInjected = true;
      } else {
        throw new Error("write requires Writer instance");
      }
    } else {
      writer = new Writer(stream, {
        prettyPrint: options?.prettyPrint,
        indentString: options?.indentString,
        encoding: options?.encoding,
      });
    }

    // Write declaration if requested and not injected
    const ownConfig = getOwnWriteConfig(options) ?? this.writeConfig;
    if (
      !isInjected &&
      (options?.rootElement || ownConfig?.element) &&
      options?.includeDeclaration !== false
    ) {
      await writer.writeStartDocument(options?.xmlVersion, options?.encoding);
    }

    // Write root element if specified
    if (options?.rootElement) {
      await writer.writeStartElement(
        options.rootElement,
        elementOptions(getRootWriteConfig(options)),
      );
    }

    // Write number element (only if not injected - parent handles element when injected)
    if (!isInjected && ownConfig?.element) {
      await writer.writeStartElement(
        ownConfig.element,
        elementOptions(ownConfig),
      );
    }

    // Write content
    const numberStr = this._writeContent(data, options);
    await writer.writeCharacters(numberStr);

    // Close elements (only if not injected)
    if (!isInjected && ownConfig?.element) {
      await writer.writeEndElement();
    }
    if (options?.rootElement) {
      await writer.writeEndElement();
    }

    // End document if not injected
    if (!isInjected) {
      await writer.writeEndDocument();
    }
  }
}
