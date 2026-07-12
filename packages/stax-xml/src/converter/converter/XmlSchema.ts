import { XmlSchemaBase, type ParseInput } from './base.js';

export { ParseInput };

/**
 * Main XML schema class (extends XmlSchemaBase with all methods)
 *
 * @public
 */
export abstract class XmlSchema<Output, Input = Output> extends XmlSchemaBase<Output, Input> {
  // All methods (transform, optional, array, write, writeSync) are inherited from XmlSchemaBase
  // Abstract methods are defined in XmlSchemaBase (_writeSync, _write)
}
