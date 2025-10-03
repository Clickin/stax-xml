import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

describe('Optional Schema Write Operations', () => {
  describe('Sync Write Methods', () => {
    it('should return empty for undefined value in object field', () => {
      const schema = x.object({
        value: x.string().optional().writer({ element: 'value' })
      });
      const xml = schema.writeSync({ value: undefined }, { rootElement: 'root' });

      expect(xml).toContain('<root>');
      expect(xml).toContain('</root>');
      expect(xml).not.toContain('<value>');
    });

    it('should return empty for null value in object field', () => {
      const schema = x.object({
        value: x.string().optional().writer({ element: 'value' })
      });
      const xml = schema.writeSync({ value: null as any }, { rootElement: 'root' });

      expect(xml).toContain('<root>');
      expect(xml).toContain('</root>');
      expect(xml).not.toContain('<value>');
    });

    it('should write valid optional string value in object', () => {
      const schema = x.object({
        value: x.string().optional().writer({ element: 'value' })
      });
      const xml = schema.writeSync({ value: 'Hello World' }, { rootElement: 'root' });

      expect(xml).toContain('<value>Hello World</value>');
    });

    it('should write valid optional number value in object', () => {
      const schema = x.object({
        count: x.number().optional().writer({ element: 'count' })
      });
      const xml = schema.writeSync({ count: 42 }, { rootElement: 'root' });

      expect(xml).toContain('<count>42</count>');
    });

    it('should write empty string for undefined in object field', () => {
      const schema = x.object({
        name: x.string().writer({ element: 'name' }),
        age: x.number().optional().writer({ element: 'age' })
      });

      const xml = schema.writeSync(
        { name: 'John', age: undefined },
        { rootElement: 'person' }
      );

      expect(xml).toContain('<name>John</name>');
      expect(xml).not.toContain('<age>');
    });

    it('should write value for defined optional in object field', () => {
      const schema = x.object({
        name: x.string().writer({ element: 'name' }),
        age: x.number().optional().writer({ element: 'age' })
      });

      const xml = schema.writeSync(
        { name: 'John', age: 30 },
        { rootElement: 'person' }
      );

      expect(xml).toContain('<name>John</name>');
      expect(xml).toContain('<age>30</age>');
    });
  });

  describe('Async Write Methods', () => {
    it('should return empty when writing undefined value async', async () => {
      const schema = x.object({
        value: x.string().optional().writer({ element: 'value' })
      });
      const xml = await schema.write({ value: undefined }, { rootElement: 'root' });

      expect(xml).toContain('<root>');
      expect(xml).toContain('</root>');
      expect(xml).not.toContain('<value>');
    });

    it('should return empty when writing null value async', async () => {
      const schema = x.object({
        value: x.string().optional().writer({ element: 'value' })
      });
      const xml = await schema.write({ value: null as any }, { rootElement: 'root' });

      expect(xml).toContain('<root>');
      expect(xml).toContain('</root>');
      expect(xml).not.toContain('<value>');
    });

    it('should write valid optional value async', async () => {
      const schema = x.object({
        value: x.string().optional().writer({ element: 'value' })
      });
      const xml = await schema.write({ value: 'Async Test' }, { rootElement: 'root' });

      expect(xml).toContain('<value>Async Test</value>');
    });

    it('should write valid optional number async', async () => {
      const schema = x.object({
        score: x.number().optional().writer({ element: 'score' })
      });
      const xml = await schema.write({ score: 95 }, { rootElement: 'test' });

      expect(xml).toContain('<score>95</score>');
    });

    it('should handle async write in object with undefined field', async () => {
      const schema = x.object({
        title: x.string().writer({ element: 'title' }),
        subtitle: x.string().optional().writer({ element: 'subtitle' })
      });

      const xml = await schema.write(
        { title: 'Main Title', subtitle: undefined },
        { rootElement: 'book' }
      );

      expect(xml).toContain('<title>Main Title</title>');
      expect(xml).not.toContain('subtitle');
    });

    it('should handle async write in object with defined optional field', async () => {
      const schema = x.object({
        title: x.string().writer({ element: 'title' }),
        subtitle: x.string().optional().writer({ element: 'subtitle' })
      });

      const xml = await schema.write(
        { title: 'Main Title', subtitle: 'Subtitle Text' },
        { rootElement: 'book' }
      );

      expect(xml).toContain('<title>Main Title</title>');
      expect(xml).toContain('<subtitle>Subtitle Text</subtitle>');
    });
  });

  describe('Parse with Optional', () => {
    it('should return undefined when parsing error with optional', () => {
      const xml = '<root><value>not a number</value></root>';
      const schema = x.number().xpath('/root/value').optional();

      const result = schema.parseSync(xml);
      expect(result).toBeUndefined();
    });

    it('should parse valid value with optional', () => {
      const xml = '<root><value>42</value></root>';
      const schema = x.number().xpath('/root/value').optional();

      const result = schema.parseSync(xml);
      expect(result).toBe(42);
    });

    it('should handle missing element with optional', () => {
      const xml = '<root><other>text</other></root>';
      const schema = x.string().xpath('/root/missing').optional();

      const result = schema.parseSync(xml);
      expect(result).toBeUndefined();
    });
  });

  describe('Complex Optional Scenarios', () => {
    it('should handle multiple optional fields in object', () => {
      const schema = x.object({
        required: x.string().writer({ element: 'required' }),
        optional1: x.string().optional().writer({ element: 'opt1' }),
        optional2: x.number().optional().writer({ element: 'opt2' }),
        optional3: x.string().optional().writer({ element: 'opt3' })
      });

      const xml = schema.writeSync(
        {
          required: 'present',
          optional1: undefined,
          optional2: 42,
          optional3: undefined
        },
        { rootElement: 'data' }
      );

      expect(xml).toContain('<required>present</required>');
      expect(xml).toContain('<opt2>42</opt2>');
      expect(xml).not.toContain('opt1');
      expect(xml).not.toContain('opt3');
    });

    it('should handle nested optional objects', async () => {
      const schema = x.object({
        name: x.string().writer({ element: 'name' }),
        address: x.object({
          street: x.string().writer({ element: 'street' }),
          city: x.string().optional().writer({ element: 'city' })
        }).optional().writer({ element: 'address' })
      });

      const xmlWithAddress = await schema.write(
        {
          name: 'John',
          address: { street: 'Main St', city: 'NYC' }
        },
        { rootElement: 'person' }
      );

      expect(xmlWithAddress).toContain('<name>John</name>');
      expect(xmlWithAddress).toContain('<street>Main St</street>');
      expect(xmlWithAddress).toContain('<city>NYC</city>');

      const xmlWithoutAddress = await schema.write(
        { name: 'Jane', address: undefined },
        { rootElement: 'person' }
      );

      expect(xmlWithoutAddress).toContain('<name>Jane</name>');
      expect(xmlWithoutAddress).not.toContain('<address>');
    });

    it('should handle optional in array elements', async () => {
      const schema = x.array(
        x.object({
          id: x.number().writer({ element: 'id' }),
          note: x.string().optional().writer({ element: 'note' })
        }).writer({ element: 'item' })
      );

      const xml = await schema.write(
        [
          { id: 1, note: 'First item' },
          { id: 2, note: undefined },
          { id: 3, note: 'Third item' }
        ],
        { rootElement: 'items' }
      );

      expect(xml).toContain('<id>1</id>');
      expect(xml).toContain('<note>First item</note>');
      expect(xml).toContain('<id>2</id>');
      // Second item should not have note element
      const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g);
      expect(itemMatches).toBeDefined();
      expect(itemMatches![1]).not.toContain('<note>');
      expect(xml).toContain('<id>3</id>');
      expect(xml).toContain('<note>Third item</note>');
    });
  });

  describe('Edge Cases', () => {
    it('should handle optional with empty string value', () => {
      const schema = x.object({
        value: x.string().optional().writer({ element: 'value' })
      });
      const xml = schema.writeSync({ value: '' }, { rootElement: 'root' });

      // Empty string should still be written (it's not undefined)
      expect(xml).toContain('<value></value>');
    });

    it('should handle optional with zero value', () => {
      const schema = x.object({
        count: x.number().optional().writer({ element: 'count' })
      });
      const xml = schema.writeSync({ count: 0 }, { rootElement: 'root' });

      // Zero is a valid value, should be written
      expect(xml).toContain('<count>0</count>');
    });

    it('should handle optional with false-like number value', () => {
      const schema = x.object({
        flag: x.number().optional().writer({ element: 'flag' })
      });
      const xml = schema.writeSync({ flag: 0 }, { rootElement: 'root' });

      expect(xml).toContain('<flag>0</flag>');
    });

    it('should handle optional with negative number', async () => {
      const schema = x.object({
        temp: x.number().optional().writer({ element: 'temp' })
      });
      const xml = await schema.write({ temp: -15 }, { rootElement: 'weather' });

      expect(xml).toContain('<temp>-15</temp>');
    });

    it('should handle deeply nested optional chains', () => {
      const schema = x.object({
        level1: x.object({
          level2: x.object({
            value: x.string().optional().writer({ element: 'value' })
          }).writer({ element: 'level2' })
        }).optional().writer({ element: 'level1' })
      });

      const xmlWithValue = schema.writeSync(
        { level1: { level2: { value: 'deep' } } },
        { rootElement: 'root' }
      );

      expect(xmlWithValue).toContain('<level2>deep</level2>');

      const xmlWithoutLevel1 = schema.writeSync(
        { level1: undefined },
        { rootElement: 'root' }
      );

      expect(xmlWithoutLevel1).not.toContain('<level1>');
    });
  });

  describe('Parse Method Coverage', () => {
    it('should handle _parse with undefined input', () => {
      const schema = x.string().optional();
      // When schema has no xpath, it returns undefined
      const result = (schema as any)._parse(undefined);
      expect(result).toBeUndefined();
    });

    it('should handle _parse with null input', () => {
      const schema = x.string().optional();
      const result = (schema as any)._parse(null);
      expect(result).toBeUndefined();
    });

    it('should handle _parseAsync with undefined input', async () => {
      const schema = x.string().optional();
      const result = await (schema as any)._parseAsync(undefined);
      expect(result).toBeUndefined();
    });

    it('should handle _parseAsync with null input', async () => {
      const schema = x.string().optional();
      const result = await (schema as any)._parseAsync(null);
      expect(result).toBeUndefined();
    });

    it('should handle _parseAsync with error scenario', async () => {
      const xml = '<root><value>invalid</value></root>';
      const schema = x.number().xpath('/root/value').optional();

      const result = await schema.parse(xml);
      expect(result).toBeUndefined();
    });

    it('should handle _parseText with undefined schema', () => {
      const schema = x.string().optional();
      const result = (schema as any)._parseText('some text');
      expect(result).toBe('some text');
    });

    it('should handle _parseText with error in inner schema', () => {
      const schema = x.number().optional();
      const result = (schema as any)._parseText('not a number');
      // Optional catches error and returns undefined
      expect(result).toBeUndefined();
    });

    it('should handle _parseText with empty string', () => {
      const schema = x.string().optional();
      const result = (schema as any)._parseText('');
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty string result', () => {
      const xml = '<root><value></value></root>';
      const schema = x.string().xpath('/root/value').optional();

      const result = schema.parseSync(xml);
      expect(result).toBeUndefined();
    });
  });

  describe('Write Methods with Undefined/Null', () => {
    it('should _writeSync return empty string for undefined', () => {
      const schema = x.string().optional().writer({ element: 'test' });
      const result = (schema as any)._writeSync(undefined);
      expect(result).toBe('');
    });

    it('should _writeSync return empty string for null', () => {
      const schema = x.string().optional().writer({ element: 'test' });
      const result = (schema as any)._writeSync(null);
      expect(result).toBe('');
    });

    it('should write return empty string for undefined', async () => {
      const schema = x.string().optional().writer({ element: 'test' });
      const result = await schema.write(undefined);
      expect(result).toBe('');
    });

    it('should write return empty string for null', async () => {
      const schema = x.string().optional().writer({ element: 'test' });
      const result = await schema.write(null);
      expect(result).toBe('');
    });
  });

  describe('Nested Optional Schemas', () => {
    it('should handle optional with nested schemas for parsing', () => {
      const xml = '<root><value>hello</value></root>';
      const schema = x.object({
        value: x.string().xpath('./value').optional()
      });

      const parsed = schema.parseSync(xml);
      expect(parsed.value).toBe('hello');
    });

    it('should handle optional when value is missing', () => {
      const xml = '<root></root>';
      const schema = x.object({
        value: x.string().xpath('./value').optional()
      });

      const parsed = schema.parseSync(xml);
      expect(parsed.value).toBeUndefined();
    });

    it('should handle deeply nested optionals', async () => {
      const schema = x.object({
        outer: x.object({
          middle: x.object({
            inner: x.string().optional().writer({ element: 'inner' })
          }).optional().writer({ element: 'middle' })
        }).optional().writer({ element: 'outer' })
      });

      // All defined
      const xml1 = await schema.write(
        { outer: { middle: { inner: 'value' } } },
        { rootElement: 'root' }
      );
      expect(xml1).toContain('<inner>value</inner>');

      // Middle undefined
      const xml2 = await schema.write(
        { outer: { middle: undefined } },
        { rootElement: 'root' }
      );
      expect(xml2).toContain('<outer>');
      expect(xml2).not.toContain('<middle>');

      // Outer undefined
      const xml3 = await schema.write(
        { outer: undefined },
        { rootElement: 'root' }
      );
      expect(xml3).not.toContain('<outer>');
    });
  });

  describe('Round-trip with Optional', () => {
    it('should round-trip optional values correctly', async () => {
      const schema = x.object({
        name: x.string().xpath('./name').writer({ element: 'name' }),
        age: x.number().xpath('./age').optional().writer({ element: 'age' })
      });

      const original = { name: 'Alice', age: 25 };
      const xml = await schema.write(original, { rootElement: 'person' });
      const parsed = schema.parseSync(xml);

      expect(parsed).toEqual(original);
    });

    it('should round-trip with undefined optional', async () => {
      const schema = x.object({
        name: x.string().xpath('./name').writer({ element: 'name' }),
        age: x.number().xpath('./age').optional().writer({ element: 'age' })
      });

      const original = { name: 'Bob', age: undefined };
      const xml = await schema.write(original, { rootElement: 'person' });
      const parsed = schema.parseSync(xml);

      expect(parsed.name).toBe('Bob');
      expect(parsed.age).toBeUndefined();
    });

    it('should parse undefined when element missing', () => {
      const schema = x.object({
        name: x.string().xpath('./name'),
        nickname: x.string().xpath('./nickname').optional()
      });

      const xml = '<person><name>Charlie</name></person>';
      const parsed = schema.parseSync(xml);

      expect(parsed.name).toBe('Charlie');
      expect(parsed.nickname).toBeUndefined();
    });
  });
});
