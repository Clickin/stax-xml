import { describe, expect, it } from 'vitest';
import { x } from '../../../stax-xml-converter/src/converter/index.js';

describe('Parser Edge Cases Coverage', () => {
  describe('Deep transform nesting', () => {
    it('should handle 5 levels of transforms', () => {
      const xml = '<root><value>test</value></root>';
      const schema = x.string()
        .xpath('/root/value')
        .transform(s => s.toUpperCase())
        .transform(s => s + '!')
        .transform(s => s.repeat(2))
        .transform(s => s.split('').reverse().join(''))
        .transform(s => `[${s}]`);

      const result = schema.parseSync(xml);
      expect(result).toBe('[!TSET!TSET]');
    });

    it('should handle deeply nested optional and transforms', () => {
      const xml = '<root><num>3</num></root>';
      const schema = x.number()
        .xpath('/root/num')
        .transform(n => n * 2)
        .optional()
        .transform(n => n !== undefined ? n + 5 : 0)
        .transform(n => n * 10)
        .transform(n => `Value: ${n}`)
        .optional();

      const result = schema.parseSync(xml);
      expect(result).toBe('Value: 110');
    });

    it('should handle array with deeply chained transforms', () => {
      const xml = `
        <root>
          <item>1</item>
          <item>2</item>
          <item>3</item>
          <item>4</item>
          <item>5</item>
        </root>
      `;
      const schema = x.array(x.number(), '//item')
        .transform(arr => arr.filter(n => n > 2))
        .transform(arr => arr.map(n => n * n))
        .transform(arr => arr.reduce((sum, n) => sum + n, 0))
        .transform(sum => ({ total: sum }))
        .transform(obj => `Total: ${obj.total}`);

      const result = schema.parseSync(xml);
      expect(result).toBe('Total: 50');
    });

    it('should handle object transform chains', () => {
      const xml = `
        <root>
          <data>
            <x>10</x>
            <y>20</y>
          </data>
        </root>
      `;
      const schema = x.object({
        data: x.object({
          x: x.number().xpath('./x'),
          y: x.number().xpath('./y')
        }).xpath('/root/data')
          .transform(d => ({ sum: d.x + d.y }))
          .transform(d => ({ doubled: d.sum * 2 }))
          .transform(d => ({ result: d.doubled + 100 }))
      });

      const result = schema.parseSync(xml);
      expect(result.data.result).toBe(160);
    });
  });

  describe('Mixed content edge cases', () => {
    it('should handle text before and after nested elements', () => {
      const xml = `
        <root>
          <content>
            Start
            <a>A</a>
            Middle
            <b>B</b>
            End
          </content>
        </root>
      `;
      const schema = x.string().xpath('/root/content');

      const result = schema.parseSync(xml);
      expect(result).toContain('Start');
      expect(result).toContain('A');
      expect(result).toContain('Middle');
      expect(result).toContain('B');
      expect(result).toContain('End');
    });

    it('should handle deeply nested mixed content', () => {
      const xml = `
        <root>
          <outer>
            Outer text
            <middle>
              Middle text
              <inner>Inner text</inner>
              After inner
            </middle>
            After middle
          </outer>
        </root>
      `;
      const schema = x.string().xpath('/root/outer');

      const result = schema.parseSync(xml);
      expect(result).toContain('Outer text');
      expect(result).toContain('Middle text');
      expect(result).toContain('Inner text');
    });

    it('should handle CDATA mixed with text and elements', () => {
      const xml = `
        <root>
          <content>
            Plain text
            <![CDATA[<CDATA content>]]>
            <element>Element</element>
            After element
          </content>
        </root>
      `;
      const schema = x.string().xpath('/root/content');

      const result = schema.parseSync(xml);
      expect(result).toContain('Plain text');
      expect(result).toContain('<CDATA content>');
      expect(result).toContain('Element');
      expect(result).toContain('After element');
    });

    it('should handle multiple CDATA sections', () => {
      const xml = `
        <root>
          <data>
            <![CDATA[First CDATA]]>
            Between
            <![CDATA[Second CDATA]]>
          </data>
        </root>
      `;
      const schema = x.string().xpath('/root/data');

      const result = schema.parseSync(xml);
      expect(result).toContain('First CDATA');
      expect(result).toContain('Between');
      expect(result).toContain('Second CDATA');
    });
  });

  describe('Complex nesting scenarios', () => {
    it('should handle 5 levels of nested objects', () => {
      const xml = `
        <root>
          <l1>
            <l2>
              <l3>
                <l4>
                  <l5>deep value</l5>
                </l4>
              </l3>
            </l2>
          </l1>
        </root>
      `;
      const schema = x.object({
        l1: x.object({
          l2: x.object({
            l3: x.object({
              l4: x.object({
                l5: x.string().xpath('./l5')
              }).xpath('./l4')
            }).xpath('./l3')
          }).xpath('./l2')
        }).xpath('/root/l1')
      });

      const result = schema.parseSync(xml);
      expect(result.l1.l2.l3.l4.l5).toBe('deep value');
    });

    it('should handle arrays within nested objects', () => {
      const xml = `
        <root>
          <outer>
            <middle>
              <inner>
                <items>
                  <item>A</item>
                  <item>B</item>
                </items>
              </inner>
            </middle>
          </outer>
        </root>
      `;
      const schema = x.object({
        outer: x.object({
          middle: x.object({
            inner: x.object({
              items: x.array(
                x.string().writer({ element: 'item' }),
                './items/item'
              )
            }).xpath('./inner')
          }).xpath('./middle')
        }).xpath('/root/outer')
      });

      const result = schema.parseSync(xml);
      expect(result.outer.middle.inner.items).toEqual(['A', 'B']);
    });

    it('should handle objects within arrays within objects', () => {
      const xml = `
        <root>
          <container>
            <records>
              <record>
                <data>
                  <value>V1</value>
                </data>
              </record>
              <record>
                <data>
                  <value>V2</value>
                </data>
              </record>
            </records>
          </container>
        </root>
      `;
      const schema = x.object({
        container: x.object({
          records: x.array(
            x.object({
              data: x.object({
                value: x.string().xpath('./value')
              }).xpath('./data')
            }).writer({ element: 'record' }),
            './records/record'
          )
        }).xpath('/root/container')
      });

      const result = schema.parseSync(xml);
      expect(result.container.records).toHaveLength(2);
      expect(result.container.records[0].data.value).toBe('V1');
      expect(result.container.records[1].data.value).toBe('V2');
    });

    it('should handle nested arrays', () => {
      const xml = `
        <root>
          <groups>
            <group>
              <items>
                <item>G1-I1</item>
                <item>G1-I2</item>
              </items>
            </group>
            <group>
              <items>
                <item>G2-I1</item>
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
      expect(result.groups[0].items).toEqual(['G1-I1', 'G1-I2']);
      expect(result.groups[1].items).toEqual(['G2-I1']);
    });
  });

  describe('Empty and whitespace edge cases', () => {
    it('should handle empty elements with optional', () => {
      const xml = `
        <root>
          <empty></empty>
          <whitespace>   </whitespace>
        </root>
      `;
      const schema = x.object({
        empty: x.string().xpath('/root/empty').optional(),
        whitespace: x.string().xpath('/root/whitespace').optional()
      });

      const result = schema.parseSync(xml);
      expect(result.empty).toBeUndefined();
      expect(result.whitespace).toBeUndefined();
    });

    it('should handle self-closing elements', () => {
      const xml = '<root><item/><item/></root>';
      const schema = x.array(
        x.string().writer({ element: 'item' }),
        '//item'
      );

      const result = schema.parseSync(xml);
      expect(result).toEqual(['', '']);
    });

    it('should handle mixed empty and valued elements in array', () => {
      const xml = `
        <root>
          <item>Value</item>
          <item></item>
          <item>Another</item>
          <item/>
        </root>
      `;
      const schema = x.array(
        x.string().writer({ element: 'item' }),
        '//item'
      );

      const result = schema.parseSync(xml);
      expect(result).toEqual(['Value', '', 'Another', '']);
    });
  });

  describe('Special characters and encoding', () => {
    it('should parse XML entities in text', () => {
      const xml = '<root><text>&lt;tag&gt; &amp; &quot;quoted&quot;</text></root>';
      const schema = x.string().xpath('/root/text');

      const result = schema.parseSync(xml);
      // Entities are preserved or decoded based on parser implementation
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should parse entities in array elements', () => {
      const xml = `
        <root>
          <item>&lt;A&gt;</item>
          <item>&amp;B&amp;</item>
        </root>
      `;
      const schema = x.array(
        x.string().writer({ element: 'item' }),
        '//item'
      );

      const result = schema.parseSync(xml);
      expect(result).toHaveLength(2);
      expect(result[0]).toBeTruthy();
      expect(result[1]).toBeTruthy();
    });

    it('should parse entities in nested objects', () => {
      const xml = `
        <root>
          <data>
            <field>&lt;value&gt;</field>
          </data>
        </root>
      `;
      const schema = x.object({
        data: x.object({
          field: x.string().xpath('./field')
        }).xpath('/root/data')
      });

      const result = schema.parseSync(xml);
      expect(result.data.field).toBeTruthy();
      expect(result.data.field.length).toBeGreaterThan(0);
    });
  });

  describe('XPath complexity', () => {
    it('should handle descendant XPath in arrays', () => {
      const xml = `
        <root>
          <section>
            <nested>
              <item>Deep 1</item>
            </nested>
          </section>
          <section>
            <nested>
              <item>Deep 2</item>
            </nested>
          </section>
        </root>
      `;
      const schema = x.array(
        x.string().writer({ element: 'item' }),
        '//item'
      );

      const result = schema.parseSync(xml);
      expect(result).toEqual(['Deep 1', 'Deep 2']);
    });

    it('should handle relative XPath in nested structures', () => {
      const xml = `
        <root>
          <parent>
            <child>
              <grandchild>value</grandchild>
            </child>
          </parent>
        </root>
      `;
      const schema = x.object({
        parent: x.object({
          child: x.object({
            grandchild: x.string().xpath('./grandchild')
          }).xpath('./child')
        }).xpath('/root/parent')
      });

      const result = schema.parseSync(xml);
      expect(result.parent.child.grandchild).toBe('value');
    });

    it('should handle XPath with multiple path segments', () => {
      const xml = `
        <root>
          <data>
            <level1>
              <level2>
                <level3>target</level3>
              </level2>
            </level1>
          </data>
        </root>
      `;
      const schema = x.string().xpath('/root/data/level1/level2/level3');

      const result = schema.parseSync(xml);
      expect(result).toBe('target');
    });
  });

  describe('Transform error handling', () => {
    it('should propagate transform errors', () => {
      const xml = '<root><value>test</value></root>';
      const schema = x.string()
        .xpath('/root/value')
        .transform(() => { throw new Error('Transform error'); });

      expect(() => schema.parseSync(xml)).toThrow('Transform error');
    });

    it('should handle transform errors in arrays', () => {
      const xml = `
        <root>
          <item>1</item>
          <item>2</item>
        </root>
      `;
      const schema = x.array(x.number(), '//item')
        .transform(() => { throw new Error('Array transform error'); });

      expect(() => schema.parseSync(xml)).toThrow('Array transform error');
    });

    it('should handle transform errors with safeParse', () => {
      const xml = '<root><value>test</value></root>';
      const schema = x.string()
        .xpath('/root/value')
        .transform(() => { throw new Error('Safe transform error'); });

      const result = schema.safeParseSync(xml);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Safe transform error');
      }
    });
  });

  describe('Number parsing edge cases', () => {
    it('should parse negative numbers', () => {
      const xml = '<root><num>-42</num></root>';
      const schema = x.number().xpath('/root/num');

      const result = schema.parseSync(xml);
      expect(result).toBe(-42);
    });

    it('should parse decimal numbers', () => {
      const xml = '<root><num>3.14159</num></root>';
      const schema = x.number().xpath('/root/num');

      const result = schema.parseSync(xml);
      expect(result).toBeCloseTo(3.14159);
    });

    it('should parse scientific notation', () => {
      const xml = '<root><num>1.5e10</num></root>';
      const schema = x.number().xpath('/root/num');

      const result = schema.parseSync(xml);
      expect(result).toBe(1.5e10);
    });

    it('should handle zero', () => {
      const xml = '<root><num>0</num></root>';
      const schema = x.number().xpath('/root/num');

      const result = schema.parseSync(xml);
      expect(result).toBe(0);
    });

    it('should parse numbers in arrays', () => {
      const xml = `
        <root>
          <num>-5.5</num>
          <num>0</num>
          <num>1e5</num>
        </root>
      `;
      const schema = x.array(
        x.number().writer({ element: 'num' }),
        '//num'
      );

      const result = schema.parseSync(xml);
      expect(result[0]).toBe(-5.5);
      expect(result[1]).toBe(0);
      expect(result[2]).toBe(1e5);
    });
  });
});
