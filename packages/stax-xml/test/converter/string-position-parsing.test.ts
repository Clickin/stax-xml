import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

describe('String Schema Position Parsing', () => {
  describe('Nested Array Element Parsing', () => {
    it('should parse string from nested array element (sync)', () => {
      const xml = `
        <root>
          <items>
            <item>
              <name>Item 1</name>
            </item>
            <item>
              <name>Item 2</name>
            </item>
          </items>
        </root>
      `;

      const schema = x.object({
        items: x.array(
          x.object({
            name: x.string().xpath('./name')
          }).writer({ element: 'item' }),
          '/root/items/item'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe('Item 1');
      expect(result.items[1].name).toBe('Item 2');
    });

    it('should parse string from nested array element (async)', async () => {
      const xml = `
        <root>
          <items>
            <item>
              <name>Item 1</name>
            </item>
            <item>
              <name>Item 2</name>
            </item>
          </items>
        </root>
      `;

      const schema = x.object({
        items: x.array(
          x.object({
            name: x.string().xpath('./name')
          }).writer({ element: 'item' }),
          '/root/items/item'
        )
      });

      const result = await schema.parse(xml);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe('Item 1');
      expect(result.items[1].name).toBe('Item 2');
    });
  });

  describe('Mixed Content Parsing', () => {
    it('should handle string with nested child elements (mixed content)', () => {
      const xml = `
        <root>
          <content>
            Text before
            <child>Nested</child>
            Text after
          </content>
        </root>
      `;

      const schema = x.object({
        content: x.string().xpath('/root/content')
      });

      const result = schema.parseSync(xml);
      // Collects all text content within the element
      expect(result.content).toContain('Text before');
      expect(result.content).toContain('Nested');
      expect(result.content).toContain('Text after');
    });
  });

  describe('XPath Validation', () => {
    it('should throw error when XPath is empty string', () => {
      expect(() => {
        x.string().xpath('');
      }).toThrow('XPath cannot be empty');
    });
  });
});
