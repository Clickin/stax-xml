import { describe, expect, it } from 'vitest';
import { x } from '../../../stax-xml-converter/src/converter/index.js';

describe('Object Schema Position and Write Tests', () => {
  describe('_parseText Method', () => {
    it('should return empty object when parsing from text', () => {
      const schema = x.object({
        name: x.string().xpath('./name')
      });
      const result = (schema as any)._parseText('some text');

      expect(result).toEqual({});
    });
  });

  describe('XPath Validation', () => {
    it('should throw error when XPath is empty string', () => {
      const schema = x.object({
        name: x.string().xpath('./name')
      });

      expect(() => {
        schema.xpath('');
      }).toThrow('XPath cannot be empty');
    });
  });

  describe('Root Object XPath', () => {
    it('should scope relative fields to the matched root object xpath (sync)', () => {
      const xml = '<root><noise id="wrong"><name>Wrong</name></noise><person id="p1"><name>Right</name></person></root>';
      const schema = x.object({
        id: x.string().xpath('./@id'),
        name: x.string().xpath('./name')
      }).xpath('/root/person');

      expect(schema.parseSync(xml)).toEqual({
        id: 'p1',
        name: 'Right'
      });
    });

    it('should scope relative fields to the matched root object xpath (async)', async () => {
      const xml = '<root><noise id="wrong"><name>Wrong</name></noise><person id="p1"><name>Right</name></person></root>';
      const schema = x.object({
        id: x.string().xpath('./@id'),
        name: x.string().xpath('./name')
      }).xpath('/root/person');

      await expect(schema.parse(xml)).resolves.toEqual({
        id: 'p1',
        name: 'Right'
      });
    });
  });

  describe('Async Iterator Detection', () => {
    it('should handle object with async iterator check', async () => {
      const xml = `
        <root>
          <user>
            <id>123</id>
            <name>Alice</name>
          </user>
        </root>
      `;

      const schema = x.object({
        user: x.object({
          id: x.number().xpath('./id'),
          name: x.string().xpath('./name')
        }).xpath('/root/user')
      });

      // Async parsing uses async iterator internally
      const result = await schema.parse(xml);
      expect(result.user.id).toBe(123);
      expect(result.user.name).toBe('Alice');
    });
  });

  describe('Nested Object as Array Element', () => {
    it('should parse nested object as array element (sync)', () => {
      const xml = `
        <root>
          <users>
            <user>
              <name>Bob</name>
              <age>30</age>
            </user>
            <user>
              <name>Carol</name>
              <age>25</age>
            </user>
          </users>
        </root>
      `;

      const schema = x.object({
        users: x.array(
          x.object({
            name: x.string().xpath('./name'),
            age: x.number().xpath('./age')
          }).writer({ element: 'user' }),
          '/root/users/user'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.users).toHaveLength(2);
      expect(result.users[0].name).toBe('Bob');
      expect(result.users[1].age).toBe(25);
    });

    it('should parse nested object as array element (async)', async () => {
      const xml = `
        <root>
          <products>
            <product>
              <id>1</id>
              <price>99.99</price>
            </product>
            <product>
              <id>2</id>
              <price>49.99</price>
            </product>
          </products>
        </root>
      `;

      const schema = x.object({
        products: x.array(
          x.object({
            id: x.number().xpath('./id'),
            price: x.number().xpath('./price')
          }).writer({ element: 'product' }),
          '/root/products/product'
        )
      });

      const result = await schema.parse(xml);
      expect(result.products).toHaveLength(2);
      expect(result.products[0].price).toBe(99.99);
      expect(result.products[1].id).toBe(2);
    });
  });

  describe('Write Operations', () => {
    it('should write object with undefined field values', () => {
      const schema = x.object({
        name: x.string().writer({ element: 'name' }),
        age: x.number().writer({ element: 'age' })
      });

      const xml = schema.writeSync(
        { name: 'John', age: undefined as any },
        { rootElement: 'person' }
      );

      expect(xml).toContain('<name>John</name>');
      expect(xml).not.toContain('<age>');
    });

    it('should write object with attribute fields', () => {
      const schema = x.object({
        id: x.string().writer({ asAttribute: 'id' }),
        name: x.string().writer({ element: 'name' })
      });

      const xml = schema.writeSync(
        { id: '123', name: 'Alice' },
        { rootElement: 'user' }
      );

      expect(xml).toContain('id="123"');
      expect(xml).toContain('<name>Alice</name>');
    });

    it('should handle object field without _writeContent method', () => {
      const schema = x.object({
        count: x.number().writer({ element: 'count' })
      });

      const xml = schema.writeSync(
        { count: 42 },
        { rootElement: 'data' }
      );

      expect(xml).toContain('<count>42</count>');
    });

    it('should handle object field with CDATA in _writeContent', () => {
      const schema = x.object({
        content: x.string().writer({ element: 'content', cdata: true })
      });

      const xml = schema.writeSync(
        { content: '<script>alert("test")</script>' },
        { rootElement: 'data' }
      );

      expect(xml).toContain('<![CDATA[<script>alert("test")</script>]]>');
    });
  });
});
