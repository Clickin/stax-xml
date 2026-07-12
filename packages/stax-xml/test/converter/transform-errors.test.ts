import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/converter/index.js';
import { XmlTransformSchema } from '../../src/converter/converter/XmlTransformSchema.js';
import { XmlSchemaBase } from '../../src/converter/converter/base.js';
import { SchemaType } from '../../src/converter/converter/types.js';

describe('Transform Schema Error Paths', () => {
  describe('Missing Method Errors', () => {
    it('should throw error when base schema lacks _parseText', () => {
      // Create a minimal schema without _parseText
      class MinimalSchema extends XmlSchemaBase<string, string> {
        readonly schemaType = SchemaType.STRING;
        // _parseText is intentionally not implemented
      }

      const baseSchema = new MinimalSchema();
      const transformSchema = new XmlTransformSchema(baseSchema, (val: string) => val.toUpperCase());

      expect(() => {
        (transformSchema as any)._parseText('test');
      }).toThrow('Transform schema requires base schema with _parseText');
    });
  });

  describe('Write Method Errors', () => {
    it('should throw error when calling _writeSync on transform schema', () => {
      const transformSchema = x.string()
        .xpath('/root/value')
        .transform((val) => val.toUpperCase());

      expect(() => {
        (transformSchema as any)._writeSync('TEST');
      }).toThrow('Transform schema does not support writing');
    });

    it('should throw error when calling _write on transform schema', async () => {
      const transformSchema = x.string()
        .xpath('/root/value')
        .transform((val) => val.toUpperCase());

      const stream = new WritableStream();
      await expect((transformSchema as any)._write('TEST', stream)).rejects.toThrow(
        'Transform schema does not support writing'
      );
    });
  });

  describe('Transform Execution in _parseFromPosition', () => {
    it('should handle promise-based transform result', async () => {
      const xml = `
        <root>
          <items>
            <item>hello</item>
          </items>
        </root>
      `;

      const schema = x.object({
        items: x.array(
          x.string()
            .writer({ element: 'item' })
            .transform((val) => val.toUpperCase()),
          '/root/items/item'
        )
      });

      const result = await schema.parse(xml);
      expect(result.items).toEqual(['HELLO']);
    });

    it('should handle synchronous transform result', () => {
      const xml = `
        <root>
          <items>
            <item>hello</item>
          </items>
        </root>
      `;

      const schema = x.object({
        items: x.array(
          x.string()
            .writer({ element: 'item' })
            .transform((val) => val.toUpperCase()),
          '/root/items/item'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.items).toEqual(['HELLO']);
    });
  });
});
