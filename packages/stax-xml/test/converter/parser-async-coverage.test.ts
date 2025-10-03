import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

describe('Parser Async Coverage', () => {
  describe('createParser with ReadableStream input', () => {
    it('should parse string from ReadableStream', async () => {
      const xml = '<root><text>Hello Stream</text></root>';
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(xml));
          controller.close();
        }
      });

      const schema = x.string().xpath('/root/text');
      const result = await schema.parse(stream);
      expect(result).toBe('Hello Stream');
    });

    it('should parse object from ReadableStream', async () => {
      const xml = `
        <root>
          <person>
            <name>Alice</name>
            <age>30</age>
          </person>
        </root>
      `;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(xml));
          controller.close();
        }
      });

      const schema = x.object({
        person: x.object({
          name: x.string().xpath('./name'),
          age: x.number().xpath('./age')
        }).xpath('/root/person')
      });

      const result = await schema.parse(stream);
      expect(result.person.name).toBe('Alice');
      expect(result.person.age).toBe(30);
    });

    it('should parse array from ReadableStream', async () => {
      const xml = `
        <root>
          <items>
            <item>1</item>
            <item>2</item>
            <item>3</item>
          </items>
        </root>
      `;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(xml));
          controller.close();
        }
      });

      const schema = x.array(
        x.number().writer({ element: 'item' }),
        '//item'
      );

      const result = await schema.parse(stream);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should parse chunked stream data', async () => {
      const xmlParts = [
        '<root>',
        '<items>',
        '<item>A</item>',
        '<item>B</item>',
        '</items>',
        '</root>'
      ];

      const stream = new ReadableStream({
        start(controller) {
          for (const part of xmlParts) {
            controller.enqueue(new TextEncoder().encode(part));
          }
          controller.close();
        }
      });

      const schema = x.array(
        x.string().writer({ element: 'item' }),
        '//item'
      );

      const result = await schema.parse(stream);
      expect(result).toEqual(['A', 'B']);
    });
  });

  describe('collectTextUntilClose async', () => {
    it('should collect text in async array parsing', async () => {
      const xml = `
        <root>
          <items>
            <item>First</item>
            <item>Second</item>
          </items>
        </root>
      `;
      const schema = x.array(
        x.string().writer({ element: 'item' }),
        '/root/items/item'
      );

      const result = await schema.parse(xml);
      expect(result).toEqual(['First', 'Second']);
    });

    it('should collect text with CDATA in async parsing', async () => {
      const xml = `
        <root>
          <items>
            <item><![CDATA[<special>]]></item>
            <item><![CDATA[&chars&]]></item>
          </items>
        </root>
      `;
      const schema = x.array(
        x.string().writer({ element: 'item' }),
        '/root/items/item'
      );

      const result = await schema.parse(xml);
      expect(result).toEqual(['<special>', '&chars&']);
    });

    it('should collect mixed text and CDATA async', async () => {
      const xml = `
        <root>
          <content>
            Text before
            <![CDATA[CDATA content]]>
            Text after
          </content>
        </root>
      `;
      const schema = x.string().xpath('/root/content');

      const result = await schema.parse(xml);
      expect(result).toContain('Text before');
      expect(result).toContain('CDATA content');
      expect(result).toContain('Text after');
    });

    it('should collect nested object text async', async () => {
      const xml = `
        <root>
          <records>
            <record>
              <value>Value 1</value>
            </record>
            <record>
              <value>Value 2</value>
            </record>
          </records>
        </root>
      `;
      const schema = x.array(
        x.object({
          value: x.string().xpath('./value')
        }).writer({ element: 'record' }),
        '/root/records/record'
      );

      const result = await schema.parse(xml);
      expect(result).toHaveLength(2);
      expect(result[0].value).toBe('Value 1');
      expect(result[1].value).toBe('Value 2');
    });
  });

  describe('extractValueWithElementMatcherAsync', () => {
    it('should extract value with nested xpath async', async () => {
      const xml = `
        <root>
          <items>
            <item>
              <inner>
                <value>Nested Value</value>
              </inner>
            </item>
          </items>
        </root>
      `;
      const schema = x.array(
        x.string()
          .xpath('./inner/value')
          .writer({ element: 'item' }),
        '/root/items/item'
      );

      const result = await schema.parse(xml);
      expect(result).toEqual(['Nested Value']);
    });

    it('should extract multiple nested values async', async () => {
      const xml = `
        <root>
          <items>
            <item>
              <deep>
                <nested>
                  <value>Deep 1</value>
                </nested>
              </deep>
            </item>
            <item>
              <deep>
                <nested>
                  <value>Deep 2</value>
                </nested>
              </deep>
            </item>
          </items>
        </root>
      `;
      const schema = x.array(
        x.string()
          .xpath('./deep/nested/value')
          .writer({ element: 'item' }),
        '/root/items/item'
      );

      const result = await schema.parse(xml);
      expect(result).toEqual(['Deep 1', 'Deep 2']);
    });

    it('should handle element matcher with transform async', async () => {
      const xml = `
        <root>
          <items>
            <item>
              <data>text</data>
            </item>
          </items>
        </root>
      `;
      const schema = x.array(
        x.string()
          .xpath('./data')
          .writer({ element: 'item' })
          .transform(s => s.toUpperCase()),
        '/root/items/item'
      );

      const result = await schema.parse(xml);
      expect(result).toEqual(['TEXT']);
    });
  });

  describe('Async position-based parsing', () => {
    it('should parse object from position async', async () => {
      const xml = `
        <root>
          <data>
            <field1>value1</field1>
            <field2>value2</field2>
          </data>
        </root>
      `;
      const schema = x.object({
        data: x.object({
          field1: x.string().xpath('./field1'),
          field2: x.string().xpath('./field2')
        }).xpath('/root/data')
      });

      const result = await schema.parse(xml);
      expect(result.data.field1).toBe('value1');
      expect(result.data.field2).toBe('value2');
    });

    it('should parse array from position async', async () => {
      const xml = `
        <root>
          <numbers>
            <num>10</num>
            <num>20</num>
            <num>30</num>
          </numbers>
        </root>
      `;
      const schema = x.array(
        x.number().writer({ element: 'num' }),
        '/root/numbers/num'
      );

      const result = await schema.parse(xml);
      expect(result).toEqual([10, 20, 30]);
    });

    it('should parse deeply nested structure async', async () => {
      const xml = `
        <root>
          <level1>
            <level2>
              <level3>
                <value>deep async</value>
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

      const result = await schema.parse(xml);
      expect(result.level1.level2.level3.value).toBe('deep async');
    });
  });

  describe('Async with transforms and optionals', () => {
    it('should apply transform in async parsing', async () => {
      const xml = '<root><text>hello</text></root>';
      const schema = x.string()
        .xpath('/root/text')
        .transform(s => s.toUpperCase());

      const result = await schema.parse(xml);
      expect(result).toBe('HELLO');
    });

    it('should apply chained transforms async', async () => {
      const xml = '<root><num>5</num></root>';
      const schema = x.number()
        .xpath('/root/num')
        .transform(n => n * 2)
        .transform(n => n + 10)
        .transform(n => `Result: ${n}`);

      const result = await schema.parse(xml);
      expect(result).toBe('Result: 20');
    });

    it('should handle optional with async parsing', async () => {
      const xml = '<root></root>';
      const schema = x.string()
        .xpath('/root/missing')
        .optional();

      const result = await schema.parse(xml);
      expect(result).toBeUndefined();
    });

    it('should handle optional with transform async', async () => {
      const xml = '<root><num>7</num></root>';
      const schema = x.number()
        .xpath('/root/num')
        .optional()
        .transform(n => n !== undefined ? n * 3 : 0);

      const result = await schema.parse(xml);
      expect(result).toBe(21);
    });

    it('should handle array transform async', async () => {
      const xml = `
        <root>
          <item>1</item>
          <item>2</item>
          <item>3</item>
        </root>
      `;
      const schema = x.array(x.number(), '//item')
        .transform(arr => arr.filter(n => n > 1))
        .transform(arr => arr.map(n => n * 2));

      const result = await schema.parse(xml);
      expect(result).toEqual([4, 6]);
    });
  });

  describe('String schema async paths', () => {
    it('should parse string without xpath async', async () => {
      const xml = '<root>Simple text</root>';
      const schema = x.string();

      const result = await schema.parse(xml);
      expect(result).toBe('Simple text');
    });

    it('should parse string with xpath async', async () => {
      const xml = '<root><text>Target</text></root>';
      const schema = x.string().xpath('/root/text');

      const result = await schema.parse(xml);
      expect(result).toBe('Target');
    });

    it('should handle collectTextAsync with mixed content', async () => {
      const xml = `
        <root>
          <content>
            Before
            <nested>Middle</nested>
            After
          </content>
        </root>
      `;
      const schema = x.string().xpath('/root/content');

      const result = await schema.parse(xml);
      expect(result).toContain('Before');
      expect(result).toContain('Middle');
      expect(result).toContain('After');
    });

    it('should handle _parseFromPosition async path', async () => {
      const xml = `
        <root>
          <items>
            <item>
              <text>Item text</text>
            </item>
          </items>
        </root>
      `;
      const schema = x.array(
        x.object({
          text: x.string().xpath('./text')
        }).writer({ element: 'item' }),
        '/root/items/item'
      );

      const result = await schema.parse(xml);
      expect(result[0].text).toBe('Item text');
    });
  });

  describe('Async error handling', () => {
    it('should handle parse errors async', async () => {
      const xml = '<root><num>not a number</num></root>';
      const schema = x.number().xpath('/root/num');

      await expect(schema.parse(xml)).rejects.toThrow();
    });

    it('should handle safeParse with async', async () => {
      const xml = '<root><num>42</num></root>';
      const schema = x.number().xpath('/root/num');

      const result = await schema.safeParse(xml);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });

    it('should handle safeParse error async', async () => {
      const xml = '<root><num>invalid</num></root>';
      const schema = x.number().xpath('/root/num');

      const result = await schema.safeParse(xml);
      expect(result.success).toBe(false);
    });
  });
});
