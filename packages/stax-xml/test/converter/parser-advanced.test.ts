import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

describe('Advanced Integration Tests', () => {
  describe('Deep Nested Structures', () => {
    it('should handle deep nested object with relative XPaths', () => {
      const xml = `
        <root>
          <level1>
            <level2>
              <level3>
                <value>deep value</value>
              </level3>
            </level2>
          </level1>
        </root>
      `;

      const schema = x.object({
        level1: x.object({
          level2: x.object({
            level3: x.object({
              value: x.string().xpath('./value')
            }).xpath('./level3')
          }).xpath('./level2')
        }).xpath('/root/level1')
      });

      const result = schema.parseSync(xml);
      expect(result.level1.level2.level3.value).toBe('deep value');
    });
  });

  describe('Nested Arrays', () => {
    it('should handle array of arrays (nested arrays)', () => {
      const xml = `
        <root>
          <matrix>
            <row>
              <col>1</col>
              <col>2</col>
            </row>
            <row>
              <col>3</col>
              <col>4</col>
            </row>
          </matrix>
        </root>
      `;

      const schema = x.object({
        matrix: x.array(
          x.array(
            x.number().writer({ element: 'col' }),
            './col'
          ).writer({ element: 'row' }),
          '/root/matrix/row'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.matrix).toEqual([[1, 2], [3, 4]]);
    });
  });

  describe('Mixed Schema Types', () => {
    it('should handle object with all schema types as fields', () => {
      const xml = `
        <root>
          <data>
            <text>Hello</text>
            <number>42</number>
            <items>
              <item>A</item>
              <item>B</item>
            </items>
            <nested>
              <field>value</field>
            </nested>
          </data>
        </root>
      `;

      const schema = x.object({
        data: x.object({
          text: x.string().xpath('./text'),
          number: x.number().xpath('./number'),
          items: x.array(
            x.string().writer({ element: 'item' }),
            './items/item'
          ),
          nested: x.object({
            field: x.string().xpath('./field')
          }).xpath('./nested')
        }).xpath('/root/data')
      });

      const result = schema.parseSync(xml);
      expect(result.data.text).toBe('Hello');
      expect(result.data.number).toBe(42);
      expect(result.data.items).toEqual(['A', 'B']);
      expect(result.data.nested.field).toBe('value');
    });
  });

  describe('Transform Chains', () => {
    it('should handle transform chain with optional wrapper', () => {
      const xml = `
        <root>
          <values>
            <value>10</value>
            <value>20</value>
            <value>30</value>
          </values>
        </root>
      `;

      const schema = x.object({
        values: x.array(
          x.number()
            .writer({ element: 'value' })
            .transform((val) => val * 2)
            .optional(),
          '/root/values/value'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.values).toEqual([20, 40, 60]);
    });
  });

  describe('Large Objects', () => {
    it('should handle large object with 20+ fields', () => {
      const fields: Record<string, any> = {};
      let xmlFields = '';

      for (let i = 1; i <= 25; i++) {
        fields[`field${i}`] = x.string().xpath(`./field${i}`);
        xmlFields += `        <field${i}>value${i}</field${i}>\n`;
      }

      const xml = `
        <root>
          <data>
${xmlFields}
          </data>
        </root>
      `;

      const schema = x.object({
        data: x.object(fields).xpath('/root/data')
      });

      const result = schema.parseSync(xml);
      expect(result.data.field1).toBe('value1');
      expect(result.data.field25).toBe('value25');
      expect(Object.keys(result.data)).toHaveLength(25);
    });
  });

  describe('ReadableStream Parsing', () => {
    it('should parse from ReadableStream with chunks', async () => {
      const xmlPart1 = '<root><items>';
      const xmlPart2 = '<item>A</item>';
      const xmlPart3 = '<item>B</item>';
      const xmlPart4 = '</items></root>';

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode(xmlPart1));
          controller.enqueue(new TextEncoder().encode(xmlPart2));
          controller.enqueue(new TextEncoder().encode(xmlPart3));
          controller.enqueue(new TextEncoder().encode(xmlPart4));
          controller.close();
        }
      });

      const schema = x.object({
        items: x.array(
          x.string().writer({ element: 'item' }),
          '/root/items/item'
        )
      });

      const result = await schema.parse(stream);
      expect(result.items).toEqual(['A', 'B']);
    });
  });
});
