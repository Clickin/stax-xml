import { XmlSchemaBase } from './base.js';
import type { XmlWriteOptions } from './types.js';
import { SchemaType } from './types.js';
import { ownWriteOptions, rootWriteOptions } from './write-utils.js';

/**
 * Schema for optional values
 *
 * @public
 */
export class XmlOptionalSchema<T extends XmlSchemaBase<unknown, unknown>> extends XmlSchemaBase<T['_output'] | undefined, T['_input'] | undefined> {
  readonly schemaType = SchemaType.OPTIONAL;

  constructor(public readonly schema: T) {
    super();
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
  _writeSync(data: T['_output'] | undefined, options?: XmlWriteOptions): string {
    if (data === undefined || data === null) {
      return ''; // Skip undefined/null values
    }
    const nested = options?.writer
      ? rootWriteOptions(options, this.writeConfig)
      : ownWriteOptions(options, this.writeConfig);
    return this.schema._writeSync(data as T['_input'], nested);
  }

  /**
   * Write optional data to WritableStream asynchronously
   * @internal
   */
  async _write(
    data: T['_output'] | undefined,
    stream: WritableStream<Uint8Array>,
    options?: XmlWriteOptions
  ): Promise<void> {
    if (data === undefined || data === null) {
      return; // Skip undefined/null values
    }
    const nested = options?.writer
      ? rootWriteOptions(options, this.writeConfig)
      : ownWriteOptions(options, this.writeConfig);
    return this.schema._write(data as T['_input'], stream, nested);
  }
}
