import { XmlSchemaBase, type ParseInput } from './base.js';
import type { XmlWriteOptions } from './types.js';

export { ParseInput };

/**
 * Main XML schema class (extends XmlSchemaBase with all methods)
 *
 * @public
 */
export abstract class XmlSchema<Output = any, Input = any> extends XmlSchemaBase<Output, Input> {
  // All methods (transform, optional, array, write, writeSync) are inherited from XmlSchemaBase

  // Abstract methods that must be implemented by subclasses
  abstract _write(data: Output, options?: XmlWriteOptions): string;
  abstract _writeAsync(data: Output, options?: XmlWriteOptions): Promise<string>;
}