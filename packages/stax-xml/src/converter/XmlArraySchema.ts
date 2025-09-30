import { XmlSchemaBase, type ParseInput } from './base.js';
import { XmlParserInternal } from './XmlParserInternal.js';
import type { ParseOptions } from './types.js';

/**
 * Schema for parsing XML array values
 *
 * @public
 */
export class XmlArraySchema<T extends XmlSchemaBase<any, any>> extends XmlSchemaBase<T['_output'][], T['_input'][]> {
  constructor(
    private element: T,
    private xpath?: string
  ) {
    super();
  }

  _parse(input: ParseInput, parseOptions?: ParseOptions): T['_output'][] {
    const parser = new XmlParserInternal(parseOptions);
    return parser.parseArray(input as string, this.element, this.xpath);
  }

  async _parseAsync(input: ParseInput, parseOptions?: ParseOptions): Promise<T['_output'][]> {
    const parser = new XmlParserInternal(parseOptions);
    return parser.parseArrayAsync(input, this.element, this.xpath);
  }
}