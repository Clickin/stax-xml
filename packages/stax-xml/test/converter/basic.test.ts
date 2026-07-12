import { describe, expect, it } from 'vitest';
import { x, type Infer } from '../../src/converter/converter/index.js';

describe('Converter Basic Tests', () => {
  describe('String Schema', () => {
    it('should parse simple string without xpath', () => {
      const xml = '<root>Hello World</root>';
      const schema = x.string();
      const result = schema.parseSync(xml);
      expect(result).toBe('Hello World');
    });

    it('should parse string with xpath', () => {
      const xml = '<root><item>Test Value</item></root>';
      const schema = x.string().xpath('/root/item');
      const result = schema.parseSync(xml);
      expect(result).toBe('Test Value');
    });

    it('should parse string with builder xpath shorthand', () => {
      const xml = '<root><item>Test Value</item></root>';
      const schema = x.string('/root/item');
      const result = schema.parseSync(xml);
      expect(result).toBe('Test Value');
    });

    it('should parse string async', async () => {
      const xml = '<root><item>Async Test</item></root>';
      const schema = x.string().xpath('/root/item');
      const result = await schema.parse(xml);
      expect(result).toBe('Async Test');
    });

    it('should return empty string when no match', () => {
      const xml = '<root><other>Value</other></root>';
      const schema = x.string().xpath('/root/item');
      const result = schema.parseSync(xml);
      expect(result).toBe('');
    });
  });

  describe('Number Schema', () => {
    it('should parse integer', () => {
      const xml = '<root><count>42</count></root>';
      const schema = x.number().xpath('/root/count');
      const result = schema.parseSync(xml);
      expect(result).toBe(42);
    });

    it('should parse number with builder xpath shorthand', () => {
      const xml = '<root><count>42</count></root>';
      const schema = x.number('/root/count');
      const result = schema.parseSync(xml);
      expect(result).toBe(42);
    });

    it('should parse float', () => {
      const xml = '<root><price>29.99</price></root>';
      const schema = x.number().xpath('/root/price');
      const result = schema.parseSync(xml);
      expect(result).toBe(29.99);
    });

    it('should parse negative number', () => {
      const xml = '<root><temp>-15.5</temp></root>';
      const schema = x.number().xpath('/root/temp');
      const result = schema.parseSync(xml);
      expect(result).toBe(-15.5);
    });

    it('should validate minimum', () => {
      const xml = '<root><age>5</age></root>';
      const schema = x.number().xpath('/root/age').min(10);
      expect(() => schema.parseSync(xml)).toThrow('less than minimum');
    });

    it('should validate maximum', () => {
      const xml = '<root><age>150</age></root>';
      const schema = x.number().xpath('/root/age').max(120);
      expect(() => schema.parseSync(xml)).toThrow('greater than maximum');
    });

    it('should validate integer', () => {
      const xml = '<root><count>42.5</count></root>';
      const schema = x.number().xpath('/root/count').int();
      expect(() => schema.parseSync(xml)).toThrow('Expected integer');
    });

    it('should accept valid integer', () => {
      const xml = '<root><count>42</count></root>';
      const schema = x.number().xpath('/root/count').int();
      const result = schema.parseSync(xml);
      expect(result).toBe(42);
    });

    it('should parse number async', async () => {
      const xml = '<root><value>123.45</value></root>';
      const schema = x.number().xpath('/root/value');
      const result = await schema.parse(xml);
      expect(result).toBe(123.45);
    });
  });

  describe('Object Schema', () => {
    it('should parse simple object', () => {
      const xml = `
        <book>
          <title>TypeScript Guide</title>
          <author>John Doe</author>
          <price>29.99</price>
        </book>
      `;
      const schema = x.object({
        title: x.string().xpath('/book/title'),
        author: x.string().xpath('/book/author'),
        price: x.number().xpath('/book/price')
      });

      const result = schema.parseSync(xml);
      expect(result).toEqual({
        title: 'TypeScript Guide',
        author: 'John Doe',
        price: 29.99
      });
    });

    it('should parse nested object', () => {
      const xml = `
        <product>
          <name>Laptop</name>
          <specs>
            <cpu>Intel i7</cpu>
            <ram>16GB</ram>
          </specs>
        </product>
      `;
      const schema = x.object({
        name: x.string().xpath('/product/name'),
        cpu: x.string().xpath('/product/specs/cpu'),
        ram: x.string().xpath('/product/specs/ram')
      });

      const result = schema.parseSync(xml);
      expect(result).toEqual({
        name: 'Laptop',
        cpu: 'Intel i7',
        ram: '16GB'
      });
    });

    it('should parse object async', async () => {
      const xml = '<data><x>1</x><y>2</y></data>';
      const schema = x.object({
        x: x.number().xpath('/data/x'),
        y: x.number().xpath('/data/y')
      });

      const result = await schema.parse(xml);
      expect(result).toEqual({ x: 1, y: 2 });
    });

    it('should handle missing fields', () => {
      const xml = '<data><x>1</x></data>';
      const schema = x.object({
        x: x.number().xpath('/data/x'),
        y: x.number().xpath('/data/y')
      });

      const result = schema.parseSync(xml);
      expect(result.x).toBe(1);
      expect(isNaN(result.y)).toBe(true); // Missing number becomes NaN
    });
  });

  describe('Array Schema', () => {
    it('should parse array of strings', () => {
      const xml = `
        <list>
          <item>First</item>
          <item>Second</item>
          <item>Third</item>
        </list>
      `;
      const schema = x.array(x.string(), '//item');
      const result = schema.parseSync(xml);
      expect(result).toEqual(['First', 'Second', 'Third']);
    });

    it('should parse array of numbers', () => {
      const xml = `
        <data>
          <value>10</value>
          <value>20</value>
          <value>30</value>
        </data>
      `;
      const schema = x.array(x.number(), '//value');
      const result = schema.parseSync(xml);
      expect(result).toEqual([10, 20, 30]);
    });

    it('should parse empty array', () => {
      const xml = '<list></list>';
      const schema = x.array(x.string(), '//item');
      const result = schema.parseSync(xml);
      expect(result).toEqual([]);
    });

    it('should parse array async', async () => {
      const xml = '<list><item>A</item><item>B</item></list>';
      const schema = x.array(x.string(), '//item');
      const result = await schema.parse(xml);
      expect(result).toEqual(['A', 'B']);
    });

    it('should require xpath for array', () => {
      const xml = '<list><item>Test</item></list>';
      const schema = x.array(x.string());
      expect(() => schema.parseSync(xml)).toThrow('requires xpath');
    });
  });

  describe('Type Inference', () => {
    it('should infer string type', () => {
      const schema = x.string();
      type Result = Infer<typeof schema>;
      const result: Result = 'test';
      expect(typeof result).toBe('string');
    });

    it('should infer number type', () => {
      const schema = x.number();
      type Result = Infer<typeof schema>;
      const result: Result = 42;
      expect(typeof result).toBe('number');
    });

    it('should infer object type', () => {
      const schema = x.object({
        name: x.string(),
        age: x.number()
      });
      type Result = Infer<typeof schema>;
      const result: Result = { name: 'John', age: 30 };
      expect(result.name).toBe('John');
      expect(result.age).toBe(30);
    });

    it('should infer array type', () => {
      const schema = x.array(x.string(), '//item');
      type Result = Infer<typeof schema>;
      const result: Result = ['a', 'b', 'c'];
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
