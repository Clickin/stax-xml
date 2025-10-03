import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';
import { XmlTransformSchema } from '../../src/converter/XmlTransformSchema.js';
import { XmlSchemaBase } from '../../src/converter/base.js';
import { SchemaType } from '../../src/converter/types.js';

describe('Transform Schema Error Paths', () => {
  describe('Missing Method Errors', () => {
    it('should throw error when base schema lacks _parseFromPosition', () => {
      // Create a minimal schema without _parseFromPosition
      class MinimalSchema extends XmlSchemaBase<string, string> {
        readonly schemaType = SchemaType.STRING;
        _parse(): string {
          return 'test';
        }
        async _parseAsync(): Promise<string> {
          return 'test';
        }
        // _parseFromPosition is intentionally not implemented
      }

      const baseSchema = new MinimalSchema();
      const transformSchema = new XmlTransformSchema(baseSchema, (val: string) => val.toUpperCase());

      // Create a mock iterator and event
      const mockIterator = {
        next: () => ({ done: true, value: undefined })
      } as Iterator<any>;

      const mockStartEvent = {
        type: 'start-element' as const,
        name: 'test',
        attributes: {},
        depth: 0
      };

      expect(() => {
        (transformSchema as any)._parseFromPosition(mockIterator, mockStartEvent, 0);
      }).toThrow('Transform schema requires base schema with _parseFromPosition');
    });

    it('should throw error when base schema lacks _parseText', () => {
      // Create a minimal schema without _parseText
      class MinimalSchema extends XmlSchemaBase<string, string> {
        readonly schemaType = SchemaType.STRING;
        _parse(): string {
          return 'test';
        }
        async _parseAsync(): Promise<string> {
          return 'test';
        }
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
    it('should throw error when calling _write on transform schema', () => {
      const transformSchema = x.string()
        .xpath('/root/value')
        .transform((val) => val.toUpperCase());

      expect(() => {
        (transformSchema as any)._write('TEST');
      }).toThrow('Transform schema does not support writing');
    });

    it('should throw error when calling _writeAsync on transform schema', async () => {
      const transformSchema = x.string()
        .xpath('/root/value')
        .transform((val) => val.toUpperCase());

      await expect((transformSchema as any)._writeAsync('TEST')).rejects.toThrow(
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
