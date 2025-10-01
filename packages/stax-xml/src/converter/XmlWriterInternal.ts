import type { XmlWriteOptions, XmlElementWriteConfig } from './types.js';

/**
 * Simple string-based XML writer for internal use
 * Does not require external writer implementation
 *
 * @internal
 */
export class XmlWriterInternal {
  private xml: string = '';
  private indentLevel: number = 0;
  private needsIndent: boolean = false;
  private elementStack: string[] = [];
  private options: Required<Pick<XmlWriteOptions, 'prettyPrint' | 'indentString'>>;

  constructor(options?: XmlWriteOptions) {
    this.options = {
      prettyPrint: options?.prettyPrint ?? false,
      indentString: options?.indentString ?? '  '
    };
  }

  /**
   * Write XML declaration
   */
  writeStartDocument(version: string = '1.0', encoding: string = 'utf-8'): this {
    this.xml += `<?xml version="${version}" encoding="${encoding.toUpperCase()}"?>`;
    if (this.options.prettyPrint) {
      this.xml += '\n';
      this.needsIndent = false;
    }
    return this;
  }

  /**
   * Write start element with optional config
   */
  writeStartElement(name: string, attributes?: Record<string, string>, config?: XmlElementWriteConfig): this {
    this.writeIndent();

    // Add comment if specified
    if (config?.comment) {
      this.xml += `<!-- ${config.comment} -->`;
      if (this.options.prettyPrint) {
        this.xml += '\n';
      }
      this.writeIndent();
    }

    // Build start tag
    this.xml += '<';
    if (config?.namespace?.prefix) {
      this.xml += `${config.namespace.prefix}:`;
    }
    this.xml += name;

    // Add attributes
    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        this.xml += ` ${key}="${escapeXml(String(value))}"`;
      }
    }

    this.xml += '>';

    this.elementStack.push(name);
    this.indentLevel++;
    if (this.options.prettyPrint) {
      this.needsIndent = true;
    }

    return this;
  }

  /**
   * Write end element
   */
  writeEndElement(): this {
    const name = this.elementStack.pop();
    if (!name) {
      throw new Error('No element to close');
    }

    this.indentLevel--;
    this.writeIndent();

    this.xml += `</${name}>`;

    if (this.options.prettyPrint) {
      this.needsIndent = true;
    }

    return this;
  }

  /**
   * Write text characters
   */
  writeCharacters(text: string): this {
    this.xml += escapeXml(text);
    this.needsIndent = false;
    return this;
  }

  /**
   * Write CDATA section
   */
  writeCData(content: string): this {
    this.xml += `<![CDATA[${content}]]>`;
    this.needsIndent = false;
    return this;
  }

  /**
   * Write comment
   */
  writeComment(comment: string): this {
    this.writeIndent();
    this.xml += `<!-- ${comment} -->`;
    if (this.options.prettyPrint) {
      this.needsIndent = true;
    }
    return this;
  }

  /**
   * Write raw XML content
   */
  writeRaw(xml: string): this {
    this.xml += xml;
    return this;
  }

  /**
   * Write indentation if needed
   */
  private writeIndent(): void {
    if (this.options.prettyPrint && this.needsIndent) {
      this.xml += '\n' + this.options.indentString.repeat(this.indentLevel);
      this.needsIndent = false;
    }
  }

  /**
   * Get the XML string
   */
  toString(): string {
    return this.xml;
  }
}

/**
 * Helper to escape XML special characters
 * @internal
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Helper to build element with attributes
 * @internal
 */
export function buildElementTag(
  name: string,
  attributes: Record<string, string>,
  config?: XmlElementWriteConfig,
  selfClosing?: boolean
): string {
  let tag = '<';

  // Add namespace prefix if specified
  if (config?.namespace?.prefix) {
    tag += `${config.namespace.prefix}:`;
  }

  tag += name;

  // Add attributes
  for (const [key, value] of Object.entries(attributes)) {
    tag += ` ${key}="${escapeXml(String(value))}"`;
  }

  // Self-closing or open tag
  tag += selfClosing ? '/>' : '>';

  return tag;
}
