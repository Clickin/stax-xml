import { XmlSchemaBase } from "./base.js";
import type { XmlWriteOptions } from "./types.js";
import { SchemaType } from "./types.js";
import { WriterSync, WriterSyncSink } from "@stax-xml/sync";
import { Writer } from "@stax-xml/async";
import {
  elementOptions,
  getOwnWriteConfig,
  getRootWriteConfig,
  getWriteConfig,
  nestedWriteOptions,
} from "./write-utils.js";
import { XPathCompiler } from "./XPathEngine.js";

/**
 * Schema for parsing XML array values
 *
 * @public
 */
export class XmlArraySchema<
  T extends XmlSchemaBase<unknown, unknown>,
> extends XmlSchemaBase<T["_output"][], T["_input"][]> {
  readonly schemaType = SchemaType.ARRAY;

  constructor(
    public readonly element: T,
    public readonly xpath?: string,
  ) {
    super();
    if (xpath !== undefined) XPathCompiler.compile(xpath);
  }

  /**
   * Write array data to XML synchronously
   * @internal
   */
  _writeSync(data: T["_output"][], options?: XmlWriteOptions): string {
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

    const ownConfig = getOwnWriteConfig(options) ?? this.writeConfig;
    const ownElement = !isInjected ? ownConfig?.element : undefined;
    const rootConfig =
      getRootWriteConfig(options) ?? (ownElement ? undefined : ownConfig);

    if (
      !isInjected &&
      (options?.rootElement || ownElement) &&
      options?.includeDeclaration !== false
    ) {
      writer.writeStartDocument(options?.xmlVersion, options?.encoding);
    }

    const rootSelfClosing = Boolean(
      options?.rootElement &&
        !ownElement &&
        rootConfig?.selfClosing &&
        data.length === 0,
    );
    if (options?.rootElement) {
      writer.writeStartElement(
        options.rootElement,
        elementOptions(rootConfig, { selfClosing: rootSelfClosing }),
      );
      if (rootSelfClosing) {
        if (!isInjected) writer.writeEndDocument();
        return writer.getXmlString();
      }
    }

    const ownSelfClosing = Boolean(
      ownElement && ownConfig?.selfClosing && data.length === 0,
    );
    if (ownElement) {
      writer.writeStartElement(
        ownElement,
        elementOptions(ownConfig, { selfClosing: ownSelfClosing }),
      );
    }

    // Write each array item without declaration
    const elementConfig = getWriteConfig(this.element);
    if (!elementConfig?.element && data.length > 0) {
      throw new Error(
        "Array element schemas require writer({ element }) for XML output.",
      );
    }

    if (!ownSelfClosing) {
      for (const item of data) {
        this.element._writeSync(
          item as T["_output"],
          nestedWriteOptions(
            options,
            writer,
            elementConfig!.element,
            elementConfig,
          ),
        );
      }
    }

    if (ownElement && !ownSelfClosing) {
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
   * Write array data to WritableStream asynchronously
   * @internal
   */
  async _write(
    data: T["_output"][],
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

    const ownConfig = getOwnWriteConfig(options) ?? this.writeConfig;
    const ownElement = !isInjected ? ownConfig?.element : undefined;
    const rootConfig =
      getRootWriteConfig(options) ?? (ownElement ? undefined : ownConfig);

    if (
      !isInjected &&
      (options?.rootElement || ownElement) &&
      options?.includeDeclaration !== false
    ) {
      await writer.writeStartDocument(options?.xmlVersion, options?.encoding);
    }

    const rootSelfClosing = Boolean(
      options?.rootElement &&
        !ownElement &&
        rootConfig?.selfClosing &&
        data.length === 0,
    );
    if (options?.rootElement) {
      await writer.writeStartElement(
        options.rootElement,
        elementOptions(rootConfig, { selfClosing: rootSelfClosing }),
      );
      if (rootSelfClosing) {
        if (!isInjected) await writer.writeEndDocument();
        return;
      }
    }

    const ownSelfClosing = Boolean(
      ownElement && ownConfig?.selfClosing && data.length === 0,
    );
    if (ownElement) {
      await writer.writeStartElement(
        ownElement,
        elementOptions(ownConfig, { selfClosing: ownSelfClosing }),
      );
    }

    // Write each array item without declaration
    const elementConfig = getWriteConfig(this.element);
    if (!elementConfig?.element && data.length > 0) {
      throw new Error(
        "Array element schemas require writer({ element }) for XML output.",
      );
    }

    if (!ownSelfClosing) {
      for (const item of data) {
        await this.element._write(
          item as T["_output"],
          stream,
          nestedWriteOptions(
            options,
            writer,
            elementConfig!.element,
            elementConfig,
          ),
        );
      }
    }

    if (ownElement && !ownSelfClosing) {
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
