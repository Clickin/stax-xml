import { describe, expect, it } from 'vitest';
import { x, type Infer } from '../../src/converter/converter/index.js';

describe('Schema Transform Tests', () => {
  describe('Transform Method', () => {
    it('should transform string to uppercase', () => {
      const xml = '<root><text>hello</text></root>';
      const schema = x.string()
        .xpath('/root/text')
        .transform(s => s.toUpperCase());

      const result = schema.parseSync(xml);
      expect(result).toBe('HELLO');
    });

    it('should transform number with calculation', () => {
      const xml = '<root><price>100</price></root>';
      const schema = x.number()
        .xpath('/root/price')
        .transform(n => n * 1.1); // Add 10% tax

      const result = schema.parseSync(xml);
      expect(result).toBeCloseTo(110);
    });

    it('should transform object', () => {
      const xml = `
        <person>
          <firstName>John</firstName>
          <lastName>Doe</lastName>
        </person>
      `;
      const schema = x.object({
        firstName: x.string().xpath('/person/firstName'),
        lastName: x.string().xpath('/person/lastName')
      }).transform(person => ({
        fullName: `${person.firstName} ${person.lastName}`
      }));

      const result = schema.parseSync(xml);
      expect(result).toEqual({ fullName: 'John Doe' });
    });

    it('should transform array', () => {
      const xml = `
        <list>
          <item>1</item>
          <item>2</item>
          <item>3</item>
        </list>
      `;
      const schema = x.array(x.number(), '//item')
        .transform(arr => arr.reduce((sum, n) => sum + n, 0));

      const result = schema.parseSync(xml);
      expect(result).toBe(6);
    });

    it('should chain multiple transforms', () => {
      const xml = '<root><value>5</value></root>';
      const schema = x.number()
        .xpath('/root/value')
        .transform(n => n * 2)
        .transform(n => n + 10)
        .transform(n => n.toString());

      const result = schema.parseSync(xml);
      expect(result).toBe('20');
    });

    it('should work with async parsing', async () => {
      const xml = '<root><text>world</text></root>';
      const schema = x.string()
        .xpath('/root/text')
        .transform(s => s.toUpperCase());

      const result = await schema.parse(xml);
      expect(result).toBe('WORLD');
    });

    it('should transform to different type', () => {
      const xml = '<root><count>42</count></root>';
      const schema = x.string()
        .xpath('/root/count')
        .transform(s => parseInt(s, 10))
        .transform(n => n > 10);

      const result = schema.parseSync(xml);
      expect(result).toBe(true);
    });
  });

  describe('Optional Method', () => {
    it('should return undefined on parse error', () => {
      const xml = '<root><text>not a number</text></root>';
      const schema = x.number().xpath('/root/text').optional();

      const result = schema.parseSync(xml);
      expect(result).toBeUndefined();
    });

    it('should return value when valid', () => {
      const xml = '<root><count>42</count></root>';
      const schema = x.number().xpath('/root/count').optional();

      const result = schema.parseSync(xml);
      expect(result).toBe(42);
    });

    it('should return undefined when element not found', () => {
      const xml = '<root><other>value</other></root>';
      const schema = x.string().xpath('/root/missing').optional();

      const result = schema.parseSync(xml);
      expect(result).toBeUndefined();
    });

    it('should work with async parsing', async () => {
      const xml = '<root><text>not a number</text></root>';
      const schema = x.number().xpath('/root/text').optional();

      const result = await schema.parse(xml);
      expect(result).toBeUndefined();
    });

    it('should work with object schema', () => {
      const xml = '<root><name>Test</name></root>';
      const schema = x.object({
        name: x.string().xpath('/root/name'),
        age: x.number().xpath('/root/age').optional()
      });

      const result = schema.parseSync(xml);
      expect(result.name).toBe('Test');
      expect(result.age).toBeUndefined();
    });

    it('should have correct type inference', () => {
      const schema = x.number().optional();
      type Result = Infer<typeof schema>;
      const valid: Result = 42;
      const invalid: Result = undefined;
      expect(valid).toBe(42);
      expect(invalid).toBeUndefined();
    });
  });

  describe('Array Method', () => {
    it('should convert string schema to array', () => {
      const xml = `
        <list>
          <item>A</item>
          <item>B</item>
          <item>C</item>
        </list>
      `;
      const schema = x.string().array('//item');
      const result = schema.parseSync(xml);
      expect(result).toEqual(['A', 'B', 'C']);
    });

    it('should convert number schema to array', () => {
      const xml = `
        <numbers>
          <value>10</value>
          <value>20</value>
          <value>30</value>
        </numbers>
      `;
      const schema = x.number().array('//value');
      const result = schema.parseSync(xml);
      expect(result).toEqual([10, 20, 30]);
    });

    it('should work with transformed schema', () => {
      const xml = `
        <list>
          <item>hello</item>
          <item>world</item>
        </list>
      `;
      const schema = x.string()
        .transform(s => s.toUpperCase())
        .array('//item');

      const result = schema.parseSync(xml);
      expect(result).toEqual(['HELLO', 'WORLD']);
    });

    it('should have correct type inference', () => {
      const schema = x.string().array('//item');
      type Result = Infer<typeof schema>;
      const result: Result = ['a', 'b', 'c'];
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Method Chaining', () => {
    it('should chain optional and transform', () => {
      const xml = '<root><value>10</value></root>';
      const schema = x.number()
        .xpath('/root/value')
        .optional()
        .transform(n => n !== undefined ? n * 2 : 0);

      const result = schema.parseSync(xml);
      expect(result).toBe(20);
    });

    it('should chain array and transform', () => {
      const xml = `
        <list>
          <item>1</item>
          <item>2</item>
          <item>3</item>
        </list>
      `;
      const schema = x.number()
        .array('//item')
        .transform(arr => ({ sum: arr.reduce((a, b) => a + b, 0) }));

      const result = schema.parseSync(xml);
      expect(result).toEqual({ sum: 6 });
    });

    it('should chain transform and optional', () => {
      const xml = '<root><text>hello</text></root>';
      const schema = x.string()
        .xpath('/root/text')
        .transform(s => s.toUpperCase())
        .optional();

      const result = schema.parseSync(xml);
      expect(result).toBe('HELLO');
    });

    it('should chain complex transformations', () => {
      const xml = `
        <data>
          <person>
            <name>John Doe</name>
            <age>30</age>
          </person>
        </data>
      `;
      const schema = x.object({
        name: x.string().xpath('//name'),
        age: x.number().xpath('//age')
      })
      .transform(p => ({
        ...p,
        category: p.age >= 18 ? 'adult' : 'minor'
      }))
      .transform(p => ({
        display: `${p.name} (${p.category})`
      }));

      const result = schema.parseSync(xml);
      expect(result.display).toBe('John Doe (adult)');
    });
  });

  describe('Safe Parse with Transforms', () => {
    it('should return success with transform', () => {
      const xml = '<root><value>42</value></root>';
      const schema = x.number()
        .xpath('/root/value')
        .transform(n => n * 2);

      const result = schema.safeParseSync(xml);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(84);
      }
    });

    it('should return error when transform throws', () => {
      const xml = '<root><value>42</value></root>';
      const schema = x.number()
        .xpath('/root/value')
        .transform(() => { throw new Error('Transform failed'); });

      const result = schema.safeParseSync(xml);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Transform failed');
      }
    });

    it('should work async with transform', async () => {
      const xml = '<root><value>10</value></root>';
      const schema = x.number()
        .xpath('/root/value')
        .transform(n => n + 5);

      const result = await schema.safeParse(xml);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(15);
      }
    });
  });
});
