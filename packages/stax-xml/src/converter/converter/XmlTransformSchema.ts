import { XmlSchemaBase } from './base.js';
import type { XmlWriteOptions } from './types.js';
import { SchemaType } from './types.js';

/**
 * Schema for transforming parsed values
 *
 * @public
 */
export class XmlTransformSchema<Output, Input, IntermediateOutput = unknown> extends XmlSchemaBase<Output, Input> {
  readonly schemaType = SchemaType.TRANSFORM;

  /** @internal */
  public readonly schema: XmlSchemaBase<IntermediateOutput, Input>;
  /** @internal */
  public readonly transformFn: (value: IntermediateOutput) => Output;

  constructor(
    schema: XmlSchemaBase<IntermediateOutput, Input>,
    transformFn: (value: IntermediateOutput) => Output
  ) {
    super();
    this.schema = schema;
    this.transformFn = transformFn;
  }

  _parseText(text: string): Output {
    if (this.schema._parseText) {
      const result = this.schema._parseText(text);
      return this.transformFn(result);
    }
    throw new Error('Transform schema requires base schema with _parseText');
  }

  /**
   * Write transformed data to XML synchronously
   * Note: Transform is not reversible, so writing is not supported
   * @internal
   */
  _writeSync(data: Output, options?: XmlWriteOptions): string {
    throw new Error('Transform schema does not support writing. Use the base schema for writing.');
  }

  /**
   * Write transformed data to WritableStream asynchronously
   * Note: Transform is not reversible, so writing is not supported
   * @internal
   */
  async _write(
    data: Output,
    stream: WritableStream<Uint8Array>,
    options?: XmlWriteOptions
  ): Promise<void> {
    throw new Error('Transform schema does not support writing. Use the base schema for writing.');
  }
}
