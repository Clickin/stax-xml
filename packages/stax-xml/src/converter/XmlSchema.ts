import { XmlSchemaBase, type ParseInput } from './base.js';
import type { ParseOptions } from './types.js';

export { ParseInput };

/**
 * Main XML schema class (extends XmlSchemaBase with all methods)
 *
 * @public
 */
export abstract class XmlSchema<Output = any, Input = any> extends XmlSchemaBase<Output, Input> {
  // All methods (transform, optional, array) are inherited from XmlSchemaBase
}