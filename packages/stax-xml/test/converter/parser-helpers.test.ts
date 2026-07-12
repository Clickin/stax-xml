import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/converter/index.js';

describe('Parser Internal Helper Methods Coverage', () => {
  describe('decodeText with trimText option', () => {
    it('should trim whitespace when trimText is true', () => {
      const xml = '<root><text>  spaced  </text></root>';
      const schema = x.string().xpath('/root/text');

      const result = schema.parseSync(xml, { trimText: true });
      expect(result).toBe('spaced');
    });

    it('should preserve whitespace when trimText is false', () => {
      const xml = '<root><text>  spaced  </text></root>';
      const schema = x.string().xpath('/root/text');

      const result = schema.parseSync(xml, { trimText: false });
      expect(result).toBe('  spaced  ');
    });

    it('should trim multiline text when trimText is true', () => {
      const xml = `<root><text>
        line one
        line two
      </text></root>`;
      const schema = x.string().xpath('/root/text');

      const result = schema.parseSync(xml, { trimText: true });
      expect(result.startsWith('line')).toBe(true);
      expect(result.endsWith('two')).toBe(true);
    });

    it('should work with arrays and trimText option', () => {
      const xml = `
        <root>
          <item>  A  </item>
          <item>  B  </item>
        </root>
      `;
      const schema = x.array(
        x.string().writer({ element: 'item' }),
        '//item'
      );

      const result = schema.parseSync(xml, { trimText: true });
      expect(result).toEqual(['A', 'B']);
    });
  });

  describe('getAllTransforms with chained transforms', () => {
    it('should apply 2 chained transforms', () => {
      const xml = '<root><value>hello</value></root>';
      const schema = x.string()
        .xpath('/root/value')
        .transform(s => s.toUpperCase())
        .transform(s => s + '!');

      const result = schema.parseSync(xml);
      expect(result).toBe('HELLO!');
    });

    it('should apply 3 chained transforms', () => {
      const xml = '<root><num>5</num></root>';
      const schema = x.number()
        .xpath('/root/num')
        .transform(n => n * 2)
        .transform(n => n + 10)
        .transform(n => n.toString());

      const result = schema.parseSync(xml);
      expect(result).toBe('20');
    });

    it('should apply 4 chained transforms on array', () => {
      const xml = `
        <root>
          <item>1</item>
          <item>2</item>
          <item>3</item>
          <item>4</item>
        </root>
      `;
      const schema = x.array(x.number(), '//item')
        .transform(arr => arr.filter(n => n > 1))
        .transform(arr => arr.map(n => n * 2))
        .transform(arr => arr.reduce((sum, n) => sum + n, 0))
        .transform(sum => `Total: ${sum}`);

      const result = schema.parseSync(xml);
      expect(result).toBe('Total: 18');
    });

    it('should apply transforms on nested object schema', () => {
      const xml = `
        <root>
          <person>
            <first>John</first>
            <last>Doe</last>
          </person>
        </root>
      `;
      const schema = x.object({
        person: x.object({
          first: x.string().xpath('./first'),
          last: x.string().xpath('./last')
        }).xpath('/root/person')
          .transform(p => ({ fullName: `${p.first} ${p.last}` }))
          .transform(p => ({ display: p.fullName.toUpperCase() }))
      });

      const result = schema.parseSync(xml);
      expect(result.person.display).toBe('JOHN DOE');
    });
  });

  describe('unwrapSchema and isOptionalSchemaWrapper', () => {
    it('should unwrap nested optional schema', () => {
      const xml = '<root><value>42</value></root>';
      const schema = x.number()
        .xpath('/root/value')
        .optional();

      const result = schema.parseSync(xml);
      expect(result).toBe(42);
    });

    it('should unwrap transform then optional', () => {
      const xml = '<root><text>hello</text></root>';
      const schema = x.string()
        .xpath('/root/text')
        .transform(s => s.toUpperCase())
        .optional();

      const result = schema.parseSync(xml);
      expect(result).toBe('HELLO');
    });

    it('should unwrap optional then transform', () => {
      const xml = '<root><num>10</num></root>';
      const schema = x.number()
        .xpath('/root/num')
        .optional()
        .transform(n => n !== undefined ? n * 2 : 0);

      const result = schema.parseSync(xml);
      expect(result).toBe(20);
    });

    it('should unwrap multiple layers of transforms and optional', () => {
      const xml = '<root><value>5</value></root>';
      const schema = x.string()
        .xpath('/root/value')
        .transform(s => parseInt(s))
        .transform(n => n * 2)
        .optional()
        .transform(n => n !== undefined ? n + 10 : 0)
        .transform(n => `Result: ${n}`);

      const result = schema.parseSync(xml);
      expect(result).toBe('Result: 20');
    });

    it('should handle optional on array schema', () => {
      const xml = '<root></root>';
      const schema = x.array(x.string(), '/root/items/item').optional();

      const result = schema.parseSync(xml);
      // Empty array is returned when no items found
      expect(result).toEqual([]);
    });
  });

  describe('extractXPath from various schema types', () => {
    it('should extract xpath from array schema with xpath property', () => {
      const xml = `
        <root>
          <items>
            <item>A</item>
            <item>B</item>
          </items>
        </root>
      `;
      const schema = x.array(
        x.string().writer({ element: 'item' }),
        '/root/items/item'
      );

      const result = schema.parseSync(xml);
      expect(result).toEqual(['A', 'B']);
    });

    it('should extract xpath from object with nested xpath', () => {
      const xml = `
        <root>
          <data>
            <field>value</field>
          </data>
        </root>
      `;
      const schema = x.object({
        field: x.string().xpath('./field')
      }).xpath('/root/data');

      const result = schema.parseSync(xml);
      expect(result.field).toBe('value');
    });

    it('should extract xpath from wrapped transform schema', () => {
      const xml = '<root><value>test</value></root>';
      const schema = x.string()
        .xpath('/root/value')
        .transform(s => s.toUpperCase());

      const result = schema.parseSync(xml);
      expect(result).toBe('TEST');
    });

    it('should extract xpath from wrapped optional schema', () => {
      const xml = '<root><missing></missing></root>';
      const schema = x.string()
        .xpath('/root/value')
        .optional();

      const result = schema.parseSync(xml);
      expect(result).toBeUndefined();
    });

    it('should extract xpath from deeply wrapped schema', () => {
      const xml = '<root><num>7</num></root>';
      const schema = x.number()
        .xpath('/root/num')
        .transform(n => n * 2)
        .optional()
        .transform(n => n !== undefined ? n + 1 : 0);

      const result = schema.parseSync(xml);
      expect(result).toBe(15);
    });
  });

  describe('isComplexSchema detection', () => {
    it('should detect object schema as complex', () => {
      const xml = `
        <root>
          <items>
            <item>
              <id>1</id>
              <name>First</name>
            </item>
            <item>
              <id>2</id>
              <name>Second</name>
            </item>
          </items>
        </root>
      `;
      const schema = x.array(
        x.object({
          id: x.number().xpath('./id'),
          name: x.string().xpath('./name')
        }).writer({ element: 'item' }),
        '/root/items/item'
      );

      const result = schema.parseSync(xml);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].name).toBe('First');
    });

    it('should detect simple string schema as non-complex', () => {
      const xml = `
        <root>
          <item>A</item>
          <item>B</item>
          <item>C</item>
        </root>
      `;
      const schema = x.array(
        x.string().writer({ element: 'item' }),
        '//item'
      );

      const result = schema.parseSync(xml);
      expect(result).toEqual(['A', 'B', 'C']);
    });

    it('should detect number schema as non-complex', () => {
      const xml = `
        <root>
          <num>10</num>
          <num>20</num>
          <num>30</num>
        </root>
      `;
      const schema = x.array(
        x.number().writer({ element: 'num' }),
        '//num'
      );

      const result = schema.parseSync(xml);
      expect(result).toEqual([10, 20, 30]);
    });

    it('should handle complex nested arrays', () => {
      const xml = `
        <root>
          <group>
            <item>
              <tags>
                <tag>red</tag>
                <tag>blue</tag>
              </tags>
            </item>
          </group>
        </root>
      `;
      const schema = x.array(
        x.object({
          tags: x.array(
            x.string().writer({ element: 'tag' }),
            './tags/tag'
          )
        }).writer({ element: 'item' }),
        '/root/group/item'
      );

      const result = schema.parseSync(xml);
      expect(result[0].tags).toEqual(['red', 'blue']);
    });
  });

  describe('Optional schema edge cases', () => {
    it('should return undefined for empty element with optional', () => {
      const xml = '<root><empty></empty></root>';
      const schema = x.string().xpath('/root/empty').optional();

      const result = schema.parseSync(xml);
      expect(result).toBeUndefined();
    });

    it('should return undefined for missing element with optional', () => {
      const xml = '<root></root>';
      const schema = x.string().xpath('/root/missing').optional();

      const result = schema.parseSync(xml);
      expect(result).toBeUndefined();
    });

    it('should return value for present element with optional', () => {
      const xml = '<root><present>value</present></root>';
      const schema = x.string().xpath('/root/present').optional();

      const result = schema.parseSync(xml);
      expect(result).toBe('value');
    });

    it('should handle optional array with missing elements', () => {
      const xml = '<root></root>';
      const schema = x.object({
        items: x.array(x.string(), '/root/items/item').optional()
      });

      const result = schema.parseSync(xml);
      expect(result.items).toBeUndefined();
    });

    it('should handle optional array with empty array', () => {
      const xml = '<root><items></items></root>';
      const schema = x.object({
        items: x.array(x.string(), '/root/items/item').optional()
      });

      const result = schema.parseSync(xml);
      expect(result.items).toBeUndefined();
    });

    it('should handle optional object with missing element', () => {
      const xml = '<root></root>';
      const schema = x.object({
        data: x.object({
          field: x.string().xpath('./field')
        }).xpath('/root/data').optional()
      });

      const result = schema.parseSync(xml);
      expect(result.data).toBeUndefined();
    });

    it('should apply transform on optional undefined value', () => {
      const xml = '<root></root>';
      const schema = x.string()
        .xpath('/root/missing')
        .optional()
        .transform(val => val || 'default');

      const result = schema.parseSync(xml);
      expect(result).toBe('default');
    });
  });
});
