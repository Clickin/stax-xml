import { describe, expect, it } from 'vitest';
import { x, XmlParseError } from '../../src/converter/index.js';

describe('Error Handling Tests', () => {
  describe('XmlParseError', () => {
    it('should create error with issues', () => {
      const error = new XmlParseError([
        { path: ['root', 'item'], message: 'Invalid value', code: 'invalid_type' }
      ]);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('XmlParseError');
      expect(error.issues).toHaveLength(1);
      expect(error.issues[0].message).toBe('Invalid value');
      expect(error.message).toContain('Invalid value');
    });

    it('should handle multiple issues', () => {
      const error = new XmlParseError([
        { path: ['field1'], message: 'Error 1', code: 'error1' },
        { path: ['field2'], message: 'Error 2', code: 'error2' }
      ]);

      expect(error.issues).toHaveLength(2);
      expect(error.message).toContain('Error 1');
      expect(error.message).toContain('Error 2');
    });
  });

  describe('Number Validation Errors', () => {
    it('should throw on invalid number', () => {
      const xml = '<root><value>not a number</value></root>';
      const schema = x.number().xpath('/root/value');

      expect(() => schema.parse(xml)).toThrow(XmlParseError);
      expect(() => schema.parse(xml)).toThrow('Invalid number');
    });

    it('should throw on minimum validation', () => {
      const xml = '<root><age>5</age></root>';
      const schema = x.number().xpath('/root/age').min(10);

      expect(() => schema.parse(xml)).toThrow(XmlParseError);
      expect(() => schema.parse(xml)).toThrow('less than minimum');
    });

    it('should throw on maximum validation', () => {
      const xml = '<root><age>150</age></root>';
      const schema = x.number().xpath('/root/age').max(120);

      expect(() => schema.parse(xml)).toThrow(XmlParseError);
      expect(() => schema.parse(xml)).toThrow('greater than maximum');
    });

    it('should throw on integer validation', () => {
      const xml = '<root><count>42.5</count></root>';
      const schema = x.number().xpath('/root/count').int();

      expect(() => schema.parse(xml)).toThrow(XmlParseError);
      expect(() => schema.parse(xml)).toThrow('Expected integer');
    });
  });

  describe('Safe Parse', () => {
    it('should return success for valid input', () => {
      const xml = '<root><value>42</value></root>';
      const schema = x.number().xpath('/root/value');

      const result = schema.safeParse(xml);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });

    it('should return error for invalid number', () => {
      const xml = '<root><value>not a number</value></root>';
      const schema = x.number().xpath('/root/value');

      const result = schema.safeParse(xml);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(XmlParseError);
        expect(result.error.issues[0].code).toBe('invalid_number');
      }
    });

    it('should return error for validation failure', () => {
      const xml = '<root><age>5</age></root>';
      const schema = x.number().xpath('/root/age').min(10);

      const result = schema.safeParse(xml);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('too_small');
      }
    });

    it('should work with object schema', () => {
      const xml = '<root><name>Test</name><age>invalid</age></root>';
      const schema = x.object({
        name: x.string().xpath('/root/name'),
        age: x.number().xpath('/root/age')
      });

      const result = schema.safeParse(xml);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(XmlParseError);
      }
    });
  });

  describe('Safe Parse Async', () => {
    it('should return success for valid input', async () => {
      const xml = '<root><value>42</value></root>';
      const schema = x.number().xpath('/root/value');

      const result = await schema.safeParseAsync(xml);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });

    it('should return error for invalid input', async () => {
      const xml = '<root><value>not a number</value></root>';
      const schema = x.number().xpath('/root/value');

      const result = await schema.safeParseAsync(xml);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(XmlParseError);
      }
    });

    it('should catch async parsing errors', async () => {
      const xml = '<root><age>5</age></root>';
      const schema = x.number().xpath('/root/age').min(10);

      const result = await schema.safeParseAsync(xml);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('too_small');
      }
    });
  });

  describe('XPath Errors', () => {
    it('should require xpath for array', () => {
      const xml = '<list><item>Test</item></list>';
      const schema = x.array(x.string());

      expect(() => schema.parse(xml)).toThrow('requires xpath');
    });

    it('should handle invalid xpath syntax', () => {
      const schema = x.string().xpath('');
      // Empty xpath will be caught during compilation
      expect(() => schema.parse('<root>test</root>')).toThrow();
    });

    it('should handle xpath with invalid characters', () => {
      expect(() => {
        const schema = x.string().xpath('/root;<script>');
        schema.parse('<root>test</root>');
      }).toThrow('Invalid characters');
    });
  });

  describe('Limit Errors', () => {
    it('should throw on depth limit exceeded', () => {
      // Create deeply nested XML
      let xml = '<root>';
      for (let i = 0; i < 150; i++) {
        xml += `<level${i}>`;
      }
      xml += 'deep value';
      for (let i = 149; i >= 0; i--) {
        xml += `</level${i}>`;
      }
      xml += '</root>';

      const schema = x.string().xpath('//deep');
      expect(() => {
        schema.parse(xml, { maxDepth: 100 });
      }).toThrow('depth limit exceeded');
    });

    it('should allow custom depth limit', () => {
      const xml = '<a><b><c><d>value</d></c></b></a>';
      const schema = x.string().xpath('//d');

      const result = schema.parse(xml, { maxDepth: 10 });
      expect(result).toBe('value');
    });
  });

  describe('Error Context', () => {
    it('should preserve error context through transforms', () => {
      const xml = '<root><value>not a number</value></root>';
      const schema = x.number()
        .xpath('/root/value')
        .transform(n => n * 2);

      const result = schema.safeParse(xml);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid number');
      }
    });

    it('should handle errors in nested objects', () => {
      const xml = `
        <root>
          <user>
            <name>John</name>
            <age>not a number</age>
          </user>
        </root>
      `;
      const schema = x.object({
        name: x.string().xpath('//name'),
        age: x.number().xpath('//age')
      });

      const result = schema.safeParse(xml);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('invalid_number');
      }
    });
  });

  describe('Generic Error Handling', () => {
    it('should wrap non-XmlParseError in safeParse', () => {
      const xml = '<root><value>test</value></root>';
      const schema = x.string()
        .xpath('/root/value')
        .transform(() => { throw new Error('Custom error'); });

      const result = schema.safeParse(xml);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(XmlParseError);
        expect(result.error.issues[0].message).toContain('Custom error');
        expect(result.error.issues[0].code).toBe('parse_error');
      }
    });

    it('should wrap string errors', () => {
      const xml = '<root><value>test</value></root>';
      const schema = x.string()
        .xpath('/root/value')
        .transform(() => { throw 'String error'; });

      const result = schema.safeParse(xml);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(XmlParseError);
        expect(result.error.issues[0].message).toBe('String error');
      }
    });
  });
});