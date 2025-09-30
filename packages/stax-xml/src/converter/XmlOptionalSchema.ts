import { XmlSchemaBase, type ParseInput } from './base.js';
import type { ParseOptions } from './types.js';

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
}