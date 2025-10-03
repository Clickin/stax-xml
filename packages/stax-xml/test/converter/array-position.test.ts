import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

describe('Array Schema Position Parsing', () => {
  describe('_parseText Method', () => {
    it('should return empty array when parsing from text', () => {
      const schema = x.array(x.string().writer({ element: 'item' }));
      const result = (schema as any)._parseText('some text');

      expect(result).toEqual([]);
    });
  });

  describe('Nested Array Parsing', () => {
    it('should parse nested array in object (sync position parsing)', () => {
      const xml = `
        <root>
          <person>
            <name>John</name>
            <hobbies>
              <hobby>Reading</hobby>
              <hobby>Gaming</hobby>
            </hobbies>
          </person>
        </root>
      `;

      const schema = x.object({
        person: x.object({
          name: x.string().xpath('./name'),
          hobbies: x.array(x.string().writer({ element: 'hobby' }), './hobbies/hobby')
        }).xpath('/root/person')
      });

      const result = schema.parseSync(xml);
      expect(result.person.name).toBe('John');
      expect(result.person.hobbies).toEqual(['Reading', 'Gaming']);
    });

    it('should parse nested array in object (async position parsing)', async () => {
      const xml = `
        <root>
          <person>
            <name>Jane</name>
            <tags>
              <tag>developer</tag>
              <tag>designer</tag>
            </tags>
          </person>
        </root>
      `;

      const schema = x.object({
        person: x.object({
          name: x.string().xpath('./name'),
          tags: x.array(x.string().writer({ element: 'tag' }), './tags/tag')
        }).xpath('/root/person')
      });

      const result = await schema.parse(xml);
      expect(result.person.name).toBe('Jane');
      expect(result.person.tags).toEqual(['developer', 'designer']);
    });
  });

  describe('Iterator Detection', () => {
    it('should handle array with async iterator detection', async () => {
      const xml = `
        <root>
          <items>
            <item>A</item>
            <item>B</item>
            <item>C</item>
          </items>
        </root>
      `;

      const schema = x.object({
        items: x.array(x.string().writer({ element: 'item' }), '/root/items/item')
      });

      // Async parsing uses async iterator internally
      const result = await schema.parse(xml);
      expect(result.items).toEqual(['A', 'B', 'C']);
    });
  });

  describe('Nested Arrays', () => {
    it('should parse nested arrays with complex structures', () => {
      const xml = `
        <root>
          <groups>
            <group>
              <items>
                <item>A1</item>
                <item>A2</item>
              </items>
            </group>
            <group>
              <items>
                <item>B1</item>
                <item>B2</item>
              </items>
            </group>
          </groups>
        </root>
      `;

      const schema = x.object({
        groups: x.array(
          x.object({
            items: x.array(
              x.string().writer({ element: 'item' }),
              './items/item'
            )
          }).writer({ element: 'group' }),
          '/root/groups/group'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.groups).toHaveLength(2);
      expect(result.groups[0].items).toEqual(['A1', 'A2']);
      expect(result.groups[1].items).toEqual(['B1', 'B2']);
    });

    it('should parse nested arrays async', async () => {
      const xml = `
        <root>
          <sections>
            <section>
              <values>
                <value>1</value>
                <value>2</value>
              </values>
            </section>
          </sections>
        </root>
      `;

      const schema = x.object({
        sections: x.array(
          x.object({
            values: x.array(
              x.number().writer({ element: 'value' }),
              './values/value'
            )
          }).writer({ element: 'section' }),
          '/root/sections/section'
        )
      });

      const result = await schema.parse(xml);
      expect(result.sections[0].values).toEqual([1, 2]);
    });
  });

  describe('Write Operations', () => {
    it('should write empty array', () => {
      const schema = x.array(x.string().writer({ element: 'item' }));
      const xml = schema.writeSync([], { rootElement: 'items' });

      expect(xml).toContain('<items>');
      expect(xml).toContain('</items>');
      expect(xml).not.toContain('<item>');
    });

    it('should write multiple items in array', () => {
      const schema = x.array(x.string().writer({ element: 'item' }));
      const xml = schema.writeSync(['A', 'B', 'C'], { rootElement: 'items' });

      expect(xml).toContain('<item>A</item>');
      expect(xml).toContain('<item>B</item>');
      expect(xml).toContain('<item>C</item>');
    });

    it('should write array with root element', () => {
      const schema = x.array(x.number().writer({ element: 'num' }));
      const xml = schema.writeSync([1, 2, 3], { rootElement: 'numbers' });

      expect(xml).toContain('<?xml');
      expect(xml).toContain('<numbers>');
      expect(xml).toContain('<num>1</num>');
      expect(xml).toContain('<num>2</num>');
      expect(xml).toContain('<num>3</num>');
    });

    it('should write array async', async () => {
      const schema = x.array(x.string().writer({ element: 'value' }));
      const xml = await schema.write(['X', 'Y'], { rootElement: 'data' });

      expect(xml).toContain('<value>X</value>');
      expect(xml).toContain('<value>Y</value>');
    });
  });

  describe('Edge Cases', () => {
    it('should throw error when array schema has no xpath', () => {
      const xml = '<root><item>A</item></root>';
      const schema = x.array(x.string().writer({ element: 'item' }));

      expect(() => {
        schema.parseSync(xml);
      }).toThrow('Array schema requires xpath');
    });

    it('should handle arrays with optional elements', () => {
      const xml = `
        <root>
          <items>
            <item>Present</item>
            <item></item>
            <item>Also Present</item>
          </items>
        </root>
      `;

      const schema = x.object({
        items: x.array(
          x.string().optional().writer({ element: 'item' }),
          '/root/items/item'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.items).toHaveLength(3);
      expect(result.items[0]).toBe('Present');
      // Empty elements return empty string when optional
      expect(result.items[1]).toBe('');
      expect(result.items[2]).toBe('Also Present');
    });

    it('should handle arrays with complex element schemas', () => {
      const xml = `
        <root>
          <records>
            <record>
              <id>1</id>
              <name>First</name>
            </record>
            <record>
              <id>2</id>
              <name>Second</name>
            </record>
          </records>
        </root>
      `;

      const schema = x.object({
        records: x.array(
          x.object({
            id: x.number().xpath('./id'),
            name: x.string().xpath('./name')
          }).writer({ element: 'record' }),
          '/root/records/record'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.records).toHaveLength(2);
      expect(result.records[0].id).toBe(1);
      expect(result.records[0].name).toBe('First');
      expect(result.records[1].id).toBe(2);
      expect(result.records[1].name).toBe('Second');
    });

    it('should return empty array for _parseText', () => {
      const schema = x.array(x.string().writer({ element: 'item' }), '/root/item');
      const result = (schema as any)._parseText('any text content');

      expect(result).toEqual([]);
    });
  });
});
