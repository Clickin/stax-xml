import { XmlSchema } from "./XmlSchema.js";
import type { XmlStringOptions, XmlWriteOptions } from "./types.js";
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
 * Helper to escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Schema for parsing XML string values
 *
 * @public
 */
export class XmlStringSchema extends XmlSchema<string, string> {
  readonly schemaType = SchemaType.STRING;

  constructor(public options: XmlStringOptions = {}) {
    super();
    if (options.xpath !== undefined) XPathCompiler.compile(options.xpath);
  }

  _parseText(text: string): string {
    return text;
  }

  /**
   * Set XPath expression for locating the element
   * @param path - XPath expression
   * @returns New schema with XPath
   */
  xpath(path: string): XmlStringSchema {
    return new XmlStringSchema({ ...this.options, xpath: path });
  }

  /**
   * Write raw content only (used inside object schema)
   * @internal
   */
  _writeContent(data: string, options?: XmlWriteOptions): string {
    return this.writeConfig?.cdata ? data : escapeXml(data);
  }

  /**
   * Write string data to XML synchronously
   * @internal
   */
  _writeSync(data: string, options?: XmlWriteOptions): string {
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

    const rootConfig = getRootWriteConfig(options);
    const rootSelfClosing = Boolean(
      options?.rootElement && rootConfig?.selfClosing && data.length === 0,
    );

    if (options?.rootElement) {
      writer.writeStartElement(
        options.rootElement,
        elementOptions(rootConfig, { selfClosing: rootSelfClosing }),
      );
      if (rootSelfClosing) {
        /* v8 ignore next -- root self-closing config reaches this branch only through an injected parent writer */
        if (!isInjected) writer.writeEndDocument();
        return writer.getXmlString();
      }
    }

    const ownSelfClosing = Boolean(
      !isInjected &&
        ownConfig?.element &&
        ownConfig.selfClosing &&
        data.length === 0,
    );
    if (!isInjected && ownConfig?.element) {
      writer.writeStartElement(
        ownConfig.element,
        elementOptions(ownConfig, { selfClosing: ownSelfClosing }),
      );
    }

    if (!ownSelfClosing) {
      const contentConfig = rootConfig ?? ownConfig;
      if (contentConfig?.cdata) writer.writeCData(data);
      else writer.writeCharacters(data);
    }

    if (!isInjected && ownConfig?.element && !ownSelfClosing) {
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
   * Write string data to WritableStream asynchronously
   * @internal
   */
  async _write(
    data: string,
    stream: WritableStream<Uint8Array>,
    options?: XmlWriteOptions,
  ): Promise<void> {
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

    const rootConfig = getRootWriteConfig(options);
    const rootSelfClosing = Boolean(
      options?.rootElement && rootConfig?.selfClosing && data.length === 0,
    );

    if (options?.rootElement) {
      await writer.writeStartElement(
        options.rootElement,
        elementOptions(rootConfig, { selfClosing: rootSelfClosing }),
      );
      if (rootSelfClosing) {
        /* v8 ignore next -- root self-closing config reaches this branch only through an injected parent writer */
        if (!isInjected) await writer.writeEndDocument();
        return;
      }
    }

    const ownSelfClosing = Boolean(
      !isInjected &&
        ownConfig?.element &&
        ownConfig.selfClosing &&
        data.length === 0,
    );
    if (!isInjected && ownConfig?.element) {
      await writer.writeStartElement(
        ownConfig.element,
        elementOptions(ownConfig, { selfClosing: ownSelfClosing }),
      );
    }

    if (!ownSelfClosing) {
      const contentConfig = rootConfig ?? ownConfig;
      if (contentConfig?.cdata) await writer.writeCData(data);
      else await writer.writeCharacters(data);
    }

    if (!isInjected && ownConfig?.element && !ownSelfClosing) {
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
