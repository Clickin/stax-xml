import { describe, expect, it } from 'vitest';
import { x } from '../../../stax-xml-converter/src/converter/index.js';

describe('Parser Collector Coverage', () => {
  describe('createCollectorForSchema - all schema types', () => {
    it('should create string collector', () => {
      const xml = '<root><str>text value</str></root>';
      const schema = x.object({
        str: x.string().xpath('/root/str')
      });

      const result = schema.parseSync(xml);
      expect(result.str).toBe('text value');
    });

    it('should create number collector', () => {
      const xml = '<root><num>42.5</num></root>';
      const schema = x.object({
        num: x.number().xpath('/root/num')
      });

      const result = schema.parseSync(xml);
      expect(result.num).toBe(42.5);
    });

    it('should create array collector', () => {
      const xml = `
        <root>
          <arr>
            <item>1</item>
            <item>2</item>
          </arr>
        </root>
      `;
      const schema = x.object({
        arr: x.array(
          x.number().writer({ element: 'item' }),
          '/root/arr/item'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.arr).toEqual([1, 2]);
    });

    it('should create object collector (nested)', () => {
      const xml = `
        <root>
          <obj>
            <field1>value1</field1>
            <field2>value2</field2>
          </obj>
        </root>
      `;
      const schema = x.object({
        obj: x.object({
          field1: x.string().xpath('./field1'),
          field2: x.string().xpath('./field2')
        }).xpath('/root/obj')
      });

      const result = schema.parseSync(xml);
      expect(result.obj.field1).toBe('value1');
      expect(result.obj.field2).toBe('value2');
    });

    it('should create collectors for mixed schema types', () => {
      const xml = `
        <root>
          <str>text</str>
          <num>100</num>
          <arr>
            <item>A</item>
            <item>B</item>
          </arr>
          <obj>
            <nested>nested value</nested>
          </obj>
        </root>
      `;
      const schema = x.object({
        str: x.string().xpath('/root/str'),
        num: x.number().xpath('/root/num'),
        arr: x.array(
          x.string().writer({ element: 'item' }),
          '/root/arr/item'
        ),
        obj: x.object({
          nested: x.string().xpath('./nested')
        }).xpath('/root/obj')
      });

      const result = schema.parseSync(xml);
      expect(result.str).toBe('text');
      expect(result.num).toBe(100);
      expect(result.arr).toEqual(['A', 'B']);
      expect(result.obj.nested).toBe('nested value');
    });
  });

  describe('extractValueFromCollector with empty optionals', () => {
    it('should extract undefined from empty optional string', () => {
      const xml = '<root></root>';
      const schema = x.object({
        missing: x.string().xpath('/root/missing').optional()
      });

      const result = schema.parseSync(xml);
      expect(result.missing).toBeUndefined();
    });

    it('should extract undefined from empty optional number', () => {
      const xml = '<root></root>';
      const schema = x.object({
        missing: x.number().xpath('/root/missing').optional()
      });

      const result = schema.parseSync(xml);
      expect(result.missing).toBeUndefined();
    });

    it('should extract undefined from empty optional array', () => {
      const xml = '<root></root>';
      const schema = x.object({
        items: x.array(x.string(), '/root/items/item').optional()
      });

      const result = schema.parseSync(xml);
      expect(result.items).toBeUndefined();
    });

    it('should extract undefined from empty optional object', () => {
      const xml = '<root></root>';
      const schema = x.object({
        data: x.object({
          field: x.string().xpath('./field')
        }).xpath('/root/data').optional()
      });

      const result = schema.parseSync(xml);
      expect(result.data).toBeUndefined();
    });

    it('should extract value from present optional string', () => {
      const xml = '<root><text>present</text></root>';
      const schema = x.object({
        text: x.string().xpath('/root/text').optional()
      });

      const result = schema.parseSync(xml);
      expect(result.text).toBe('present');
    });

    it('should extract value from present optional array', () => {
      const xml = `
        <root>
          <items>
            <item>X</item>
            <item>Y</item>
          </items>
        </root>
      `;
      const schema = x.object({
        items: x.array(
          x.string().writer({ element: 'item' }),
          '/root/items/item'
        ).optional()
      });

      const result = schema.parseSync(xml);
      expect(result.items).toEqual(['X', 'Y']);
    });
  });

  describe('extractValueFromCollector with transforms', () => {
    it('should extract and transform string value', () => {
      const xml = '<root><text>hello</text></root>';
      const schema = x.string()
        .xpath('/root/text')
        .transform(s => s.toUpperCase());

      const result = schema.parseSync(xml);
      expect(result).toBe('HELLO');
    });

    it('should extract and transform number value', () => {
      const xml = '<root><num>10</num></root>';
      const schema = x.number()
        .xpath('/root/num')
        .transform(n => n * 2);

      const result = schema.parseSync(xml);
      expect(result).toBe(20);
    });

    it('should extract and transform array', () => {
      const xml = `
        <root>
          <items>
            <item>1</item>
            <item>2</item>
            <item>3</item>
          </items>
        </root>
      `;
      const schema = x.array(
        x.number().writer({ element: 'item' }),
        '/root/items/item'
      ).transform(arr => arr.reduce((sum, n) => sum + n, 0));

      const result = schema.parseSync(xml);
      expect(result).toBe(6);
    });

    it('should extract and transform object collector', () => {
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
      });

      const result = schema.parseSync(xml);
      expect(result.person).toEqual({ fullName: 'John Doe' });
    });

    it('should extract and apply chained transforms', () => {
      const xml = '<root><value>5</value></root>';
      const schema = x.number()
        .xpath('/root/value')
        .transform(n => n * 2)
        .transform(n => n + 10)
        .transform(n => `Result: ${n}`);

      const result = schema.parseSync(xml);
      expect(result).toBe('Result: 20');
    });

    it('should extract transformed optional with present value', () => {
      const xml = '<root><num>7</num></root>';
      const schema = x.number()
        .xpath('/root/num')
        .optional()
        .transform(n => n !== undefined ? n * 3 : 0);

      const result = schema.parseSync(xml);
      expect(result).toBe(21);
    });

    it('should extract transformed optional with missing value', () => {
      const xml = '<root></root>';
      const schema = x.number()
        .xpath('/root/missing')
        .optional()
        .transform(n => n !== undefined ? n * 3 : 99);

      const result = schema.parseSync(xml);
      expect(result).toBe(99);
    });
  });

  describe('buildResultFromCollector via position parsing', () => {
    it('should build result from nested object collector (sync)', () => {
      const xml = `
        <root>
          <parent>
            <child>child value</child>
          </parent>
        </root>
      `;
      const schema = x.object({
        parent: x.object({
          child: x.string().xpath('./child')
        }).xpath('/root/parent')
      });

      const result = schema.parseSync(xml);
      expect(result.parent.child).toBe('child value');
    });

    it('should build result from nested object collector (async)', async () => {
      const xml = `
        <root>
          <section>
            <item>item value</item>
          </section>
        </root>
      `;
      const schema = x.object({
        section: x.object({
          item: x.string().xpath('./item')
        }).xpath('/root/section')
      });

      const result = await schema.parse(xml);
      expect(result.section.item).toBe('item value');
    });

    it('should build result with multiple nested collectors', () => {
      const xml = `
        <root>
          <level1>
            <level2>
              <field1>value1</field1>
              <field2>value2</field2>
            </level2>
          </level1>
        </root>
      `;
      const schema = x.object({
        level1: x.object({
          level2: x.object({
            field1: x.string().xpath('./field1'),
            field2: x.string().xpath('./field2')
          }).xpath('./level2')
        }).xpath('/root/level1')
      });

      const result = schema.parseSync(xml);
      expect(result.level1.level2.field1).toBe('value1');
      expect(result.level1.level2.field2).toBe('value2');
    });

    it('should build result with array inside object collector', () => {
      const xml = `
        <root>
          <container>
            <items>
              <item>A</item>
              <item>B</item>
            </items>
          </container>
        </root>
      `;
      const schema = x.object({
        container: x.object({
          items: x.array(
            x.string().writer({ element: 'item' }),
            './items/item'
          )
        }).xpath('/root/container')
      });

      const result = schema.parseSync(xml);
      expect(result.container.items).toEqual(['A', 'B']);
    });

    it('should build result with transform on nested collector', () => {
      const xml = `
        <root>
          <data>
            <value>10</value>
          </data>
        </root>
      `;
      const schema = x.object({
        data: x.object({
          value: x.number().xpath('./value')
        }).xpath('/root/data')
          .transform(d => ({ doubled: d.value * 2 }))
      });

      const result = schema.parseSync(xml);
      expect(result.data.doubled).toBe(20);
    });

    it('should build result from deeply nested collectors', () => {
      const xml = `
        <root>
          <a>
            <b>
              <c>
                <d>deep value</d>
              </c>
            </b>
          </a>
        </root>
      `;
      const schema = x.object({
        a: x.object({
          b: x.object({
            c: x.object({
              d: x.string().xpath('./d')
            }).xpath('./c')
          }).xpath('./b')
        }).xpath('/root/a')
      });

      const result = schema.parseSync(xml);
      expect(result.a.b.c.d).toBe('deep value');
    });
  });

  describe('Collector with parseFieldValue', () => {
    it('should parse field value for number schema', () => {
      const xml = `
        <root>
          <items>
            <item>42</item>
            <item>99</item>
          </items>
        </root>
      `;
      const schema = x.array(
        x.number().writer({ element: 'item' }),
        '//item'
      );

      const result = schema.parseSync(xml);
      expect(result).toEqual([42, 99]);
    });

    it('should parse field value for string with transform', () => {
      const xml = `
        <root>
          <item>10</item>
          <item>20</item>
        </root>
      `;
      const schema = x.array(
        x.string()
          .writer({ element: 'item' })
          .transform(s => parseInt(s)),
        '//item'
      );

      const result = schema.parseSync(xml);
      expect(result).toEqual([10, 20]);
    });

    it('should parse field values in object fields', () => {
      const xml = `
        <root>
          <record>
            <id>123</id>
            <score>95.5</score>
            <name>Test</name>
          </record>
        </root>
      `;
      const schema = x.object({
        record: x.object({
          id: x.number().xpath('./id'),
          score: x.number().xpath('./score'),
          name: x.string().xpath('./name')
        }).xpath('/root/record')
      });

      const result = schema.parseSync(xml);
      expect(result.record.id).toBe(123);
      expect(result.record.score).toBe(95.5);
      expect(result.record.name).toBe('Test');
    });
  });
});
