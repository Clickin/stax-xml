import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

describe('Parser Internal Complex Scenarios', () => {
  describe('Nested Schema Parsing Without XPath', () => {
    it('should parse object with nested object (no xpath on child)', () => {
      const xml = `
        <root>
          <outer>
            <inner>
              <value>test</value>
            </inner>
          </outer>
        </root>
      `;

      const schema = x.object({
        outer: x.object({
          inner: x.object({
            value: x.string().xpath('./value')
          }).xpath('./inner')
        }).xpath('/root/outer')
      });

      const result = schema.parseSync(xml);
      expect(result.outer.inner.value).toBe('test');
    });

    it('should parse object with array (no xpath on array)', () => {
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
  });

  describe('Sync Versions of Nested Parsing', () => {
    it('should use sync version of nested object parsing', () => {
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

      const result = schema.parseSync(xml);
      expect(result.data.field1).toBe('value1');
      expect(result.data.field2).toBe('value2');
    });

    it('should use sync version of nested array parsing', () => {
      const xml = `
        <root>
          <numbers>
            <num>1</num>
            <num>2</num>
            <num>3</num>
          </numbers>
        </root>
      `;

      const schema = x.object({
        numbers: x.array(
          x.number().writer({ element: 'num' }),
          '/root/numbers/num'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.numbers).toEqual([1, 2, 3]);
    });
  });

  describe('Parse Object From Position with Empty Collector', () => {
    it('should parse object from position (sync, empty collector)', () => {
      const xml = `
        <root>
          <entry>
            <key>name</key>
            <value>John</value>
          </entry>
        </root>
      `;

      const schema = x.object({
        entry: x.object({
          key: x.string().xpath('./key'),
          value: x.string().xpath('./value')
        }).xpath('/root/entry')
      });

      const result = schema.parseSync(xml);
      expect(result.entry.key).toBe('name');
      expect(result.entry.value).toBe('John');
    });

    it('should parse object from position (async, empty collector)', async () => {
      const xml = `
        <root>
          <record>
            <id>123</id>
            <status>active</status>
          </record>
        </root>
      `;

      const schema = x.object({
        record: x.object({
          id: x.number().xpath('./id'),
          status: x.string().xpath('./status')
        }).xpath('/root/record')
      });

      const result = await schema.parse(xml);
      expect(result.record.id).toBe(123);
      expect(result.record.status).toBe('active');
    });
  });

  describe('Build Result from Collector with Transforms', () => {
    it('should build result from collector with transforms', () => {
      const xml = `
        <root>
          <items>
            <item>hello</item>
            <item>world</item>
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
      expect(result.items).toEqual(['HELLO', 'WORLD']);
    });
  });

  describe('Create Collector for Unknown Schema Type', () => {
    it('should create collector for standard schema types', () => {
      const xml = `
        <root>
          <text>sample</text>
          <number>42</number>
          <items>
            <item>A</item>
          </items>
        </root>
      `;

      const schema = x.object({
        text: x.string().xpath('/root/text'),
        number: x.number().xpath('/root/number'),
        items: x.array(
          x.string().writer({ element: 'item' }),
          '/root/items/item'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.text).toBe('sample');
      expect(result.number).toBe(42);
      expect(result.items).toEqual(['A']);
    });
  });
});
