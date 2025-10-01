import { XmlSchemaBase, type ParseInput } from './base.js';
import type { ParseOptions, XmlWriteOptions } from './types.js';

/**
 * Schema for optional values
 *
 * @public
 */
export class XmlOptionalSchema<T extends XmlSchemaBase<any, any>> extends XmlSchemaBase<T['_output'] | undefined, T['_input'] | undefined> {
  constructor(private schema: T) {
    super();
  }

  _parse(input: ParseInput, options?: ParseOptions): T['_output'] | undefined {
    try {
      const result = this.schema._parse(input, options);
      // Treat empty string as undefined for missing elements
      if (result === '') {
        return undefined;
      }
      return result;
    } catch {
      return undefined;
    }
  }

  async _parseAsync(input: ParseInput, options?: ParseOptions): Promise<T['_output'] | undefined> {
    try {
      const result = await this.schema._parseAsync(input, options);
      // Treat empty string as undefined for missing elements
      if (result === '') {
        return undefined;
      }
      return result;
    } catch {
      return undefined;
    }
  }

  _parseText(text: string): T['_output'] | undefined {
    if (this.schema._parseText) {
      try {
        const result = this.schema._parseText(text);
        // Treat empty string as undefined for missing elements
        if (result === '') {
          return undefined;
        }
        return result;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  /**
   * Write optional data to XML synchronously
   * @internal
   */
  _write(data: T['_output'] | undefined, options?: XmlWriteOptions): string {
    if (data === undefined || data === null) {
      return ''; // Skip undefined/null values
    }
    return (this.schema as any)._write(data, options);
  }

  /**
   * Write optional data to XML asynchronously
   * @internal
   */
  async _writeAsync(data: T['_output'] | undefined, options?: XmlWriteOptions): Promise<string> {
    if (data === undefined || data === null) {
      return '';
    }
    return (this.schema as any)._writeAsync(data, options);
  }
}