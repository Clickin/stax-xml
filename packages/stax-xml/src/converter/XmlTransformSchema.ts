import { XmlSchemaBase, type ParseInput } from './base.js';
import type { ParseOptions, XmlWriteOptions } from './types.js';
import { SchemaType } from './types.js';
import type { AnyXmlEvent, StartElementEvent } from '../types.js';

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

  _parse(input: ParseInput, options?: ParseOptions): Output {
    const result = this.schema._parse(input, options);
    return this.transformFn(result);
  }

  async _parseAsync(input: ParseInput, options?: ParseOptions): Promise<Output> {
    const result = await this.schema._parseAsync(input, options);
    return this.transformFn(result);
  }

  /**
   * Parse from current iterator position and apply transform
   * @internal
   */
  _parseFromPosition(
    iterator: Iterator<AnyXmlEvent> | AsyncIterator<AnyXmlEvent>,
    startEvent: StartElementEvent,
    startDepth: number,
    options?: ParseOptions
  ): Output | Promise<Output> {
    if (this.schema._parseFromPosition) {
      const result = this.schema._parseFromPosition(iterator, startEvent, startDepth, options);

      // Check if result is a Promise
      if (result && typeof (result as unknown as {then?: unknown}).then === 'function') {
        return (result as Promise<IntermediateOutput>).then(r => this.transformFn(r));
      }

      return this.transformFn(result as IntermediateOutput);
    }

    // Fallback: should not happen if schemas are properly implemented
    throw new Error('Transform schema requires base schema with _parseFromPosition');
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