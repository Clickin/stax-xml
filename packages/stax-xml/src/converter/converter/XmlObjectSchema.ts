import { XmlSchema } from "./XmlSchema.js";
import type { XmlObjectOptions, XmlWriteOptions } from "./types.js";
import { SchemaType } from "./types.js";
import { WriterSync, WriterSyncSink } from "@stax-xml/sync";
import { Writer } from "@stax-xml/async";
import type { AttributeInfo } from "@stax-xml/core";
import {
  elementOptions,
  getOwnWriteConfig,
  getRootWriteConfig,
  getWriteConfig,
  nestedWriteOptions,
} from "./write-utils.js";
import { XPathCompiler } from "./XPathEngine.js";

/**
 * Shape type for object schema
 *
 * @public
 */
export type XmlObjectShape = Record<string, XmlSchema<unknown, unknown>>;

/**
 * Infer output type from object shape
 *
 * @public
 */
export type InferObjectOutput<T extends XmlObjectShape> = {
  [K in keyof T]: T[K]["_output"];
};

/**
 * Schema for parsing XML object values
 *
 * @public
 */
export class XmlObjectSchema<T extends XmlObjectShape> extends XmlSchema<
  InferObjectOutput<T>,
  unknown
> {
  readonly schemaType = SchemaType.OBJECT;

  constructor(
    public readonly shape: T,
    public options: XmlObjectOptions = {},
  ) {
    super();
    if (options.xpath !== undefined) XPathCompiler.compile(options.xpath);
  }

  /**
   * Set XPath expression for locating the object
   * @param path - XPath expression
   * @returns New schema with XPath
   */
  xpath(path: string): XmlObjectSchema<T> {
    return new XmlObjectSchema(this.shape, { ...this.options, xpath: path });
  }

  /**
   * Write object data to XML synchronously
   * @internal
   */
  _writeSync(data: InferObjectOutput<T>, options?: XmlWriteOptions): string {
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
    const rootAttributes = this._collectAttributes(data);
    const hasContent = this._hasElementContent(data);

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
        !hasContent,
    );

    if (options?.rootElement) {
      writer.writeStartElement(
        options.rootElement,
        elementOptions(rootConfig, {
          attributes: ownElement ? undefined : rootAttributes,
          selfClosing: rootSelfClosing,
        }),
      );
      if (rootSelfClosing) {
        if (!isInjected) writer.writeEndDocument();
        return writer.getXmlString();
      }
    }

    const ownSelfClosing = Boolean(
      ownElement && ownConfig?.selfClosing && !hasContent,
    );
    if (ownElement) {
      writer.writeStartElement(
        ownElement,
        elementOptions(ownConfig, {
          attributes: rootAttributes,
          selfClosing: ownSelfClosing,
        }),
      );
    } else if (
      !options?.rootElement &&
      Object.keys(rootAttributes).length > 0
    ) {
      throw new Error(
        "Object attributes require a root or containing element.",
      );
    }

    if (!ownSelfClosing) {
      for (const [key, schema] of Object.entries(this.shape)) {
        const value = (data as Record<string, unknown>)[key];
        if (value === undefined || value === null) {
          continue; // Skip undefined/null values
        }

        const fieldConfig = getWriteConfig(schema);

        // Skip if this field is an attribute (already written)
        if (fieldConfig?.asAttribute) {
          continue;
        }

        const elementName = fieldConfig?.element || key;

        schema._writeSync(
          value as never,
          nestedWriteOptions(options, writer, elementName, fieldConfig),
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
   * Write object data to WritableStream asynchronously
   * @internal
   */
  async _write(
    data: InferObjectOutput<T>,
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
    const rootAttributes = this._collectAttributes(data);
    const hasContent = this._hasElementContent(data);

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
        !hasContent,
    );

    if (options?.rootElement) {
      await writer.writeStartElement(
        options.rootElement,
        elementOptions(rootConfig, {
          attributes: ownElement ? undefined : rootAttributes,
          selfClosing: rootSelfClosing,
        }),
      );
      if (rootSelfClosing) {
        if (!isInjected) await writer.writeEndDocument();
        return;
      }
    }

    const ownSelfClosing = Boolean(
      ownElement && ownConfig?.selfClosing && !hasContent,
    );
    if (ownElement) {
      await writer.writeStartElement(
        ownElement,
        elementOptions(ownConfig, {
          attributes: rootAttributes,
          selfClosing: ownSelfClosing,
        }),
      );
    } else if (
      !options?.rootElement &&
      Object.keys(rootAttributes).length > 0
    ) {
      throw new Error(
        "Object attributes require a root or containing element.",
      );
    }

    if (!ownSelfClosing) {
      for (const [key, schema] of Object.entries(this.shape)) {
        const value = (data as Record<string, unknown>)[key];
        if (value === undefined || value === null) {
          continue; // Skip undefined/null values
        }

        const fieldConfig = getWriteConfig(schema);

        // Skip if this field is an attribute (already written)
        if (fieldConfig?.asAttribute) {
          continue;
        }

        const elementName = fieldConfig?.element || key;

        await schema._write(
          value as never,
          stream,
          nestedWriteOptions(options, writer, elementName, fieldConfig),
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

  private _collectAttributes(
    data: InferObjectOutput<T>,
  ): Record<string, string | AttributeInfo> {
    const attributes: Record<string, string | AttributeInfo> = {};
    for (const [key, schema] of Object.entries(this.shape)) {
      const config = getWriteConfig(schema);
      if (!config?.asAttribute) continue;
      const value = (data as Record<string, unknown>)[key];
      if (value === undefined || value === null) continue;
      if (config.namespace && !config.namespace.prefix) {
        throw new Error(
          `Namespaced attribute '${config.asAttribute}' requires a prefix.`,
        );
      }
      attributes[config.asAttribute] = config.namespace?.prefix
        ? {
            value: String(value),
            prefix: config.namespace.prefix,
            uri: config.namespace.uri,
          }
        : String(value);
    }
    return attributes;
  }

  private _hasElementContent(data: InferObjectOutput<T>): boolean {
    return Object.entries(this.shape).some(([key, schema]) => {
      const value = (data as Record<string, unknown>)[key];
      return (
        value !== undefined &&
        value !== null &&
        !getWriteConfig(schema)?.asAttribute
      );
    });
  }
}
