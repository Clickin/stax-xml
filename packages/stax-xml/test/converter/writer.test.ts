import { describe, it, expect } from 'vitest';
import { x } from '../../src/converter/index.js';

describe('Writer Tests', () => {
  describe('Basic String Writing', () => {
    it('should write simple string', async () => {
      const schema = x.string().writer({ element: 'title' });
      const xml = await schema.write('Hello World', {
        rootElement: 'root',
        prettyPrint: false
      });
      expect(xml).toContain('<title>Hello World</title>');
    });

    it('should write string with CDATA', async () => {
      const schema = x.string().writer({ element: 'content', cdata: true });
      const xml = await schema.write('<html>code</html>', {
        rootElement: 'root'
      });
      expect(xml).toContain('<![CDATA[<html>code</html>]]>');
    });

    it('should escape XML entities', async () => {
      const schema = x.string().writer({ element: 'text' });
      const xml = await schema.write('Tom & Jerry', {
        rootElement: 'root'
      });
      expect(xml).toContain('Tom &amp; Jerry');
    });
  });

  describe('Number Writing', () => {
    it('should write number', async () => {
      const schema = x.number().writer({ element: 'price' });
      const xml = await schema.write(29.99, {
        rootElement: 'root'
      });
      expect(xml).toContain('<price>29.99</price>');
    });

    it('should write integer', async () => {
      const schema = x.number().int().writer({ element: 'count' });
      const xml = await schema.write(42.7, {
        rootElement: 'root'
      });
      expect(xml).toContain('<count>42</count>');
    });
  });

  describe('Object Writing', () => {
    it('should write simple object', async () => {
      const schema = x.object({
        title: x.string().writer({ element: 'title' }),
        price: x.number().writer({ element: 'price' })
      });

      const xml = await schema.write(
        { title: 'TypeScript Guide', price: 29.99 },
        { rootElement: 'book', prettyPrint: false }
      );

      expect(xml).toContain('<title>TypeScript Guide</title>');
      expect(xml).toContain('<price>29.99</price>');
    });

    it('should write object with attributes', async () => {
      const schema = x.object({
        isbn: x.string().writer({ asAttribute: 'isbn' }),
        title: x.string().writer({ element: 'title' }),
        price: x.number().writer({ element: 'price' })
      });

      const xml = await schema.write(
        { isbn: '123-456', title: 'Book', price: 20 },
        { rootElement: 'book' }
      );

      expect(xml).toContain('isbn="123-456"');
      expect(xml).toContain('<title>Book</title>');
      expect(xml).toContain('<price>20</price>');
    });

    it('should write nested objects', async () => {
      const authorSchema = x.object({
        name: x.string().writer({ element: 'name' }),
        email: x.string().writer({ element: 'email' })
      });

      const schema = x.object({
        title: x.string().writer({ element: 'title' }),
        author: authorSchema.writer({ element: 'author' })
      });

      const data = {
        title: 'TypeScript',
        author: {
          name: 'John Doe',
          email: 'john@example.com'
        }
      };

      const xml = await schema.write(data, {
        rootElement: 'book',
        prettyPrint: false
      });

      expect(xml).toContain('<title>TypeScript</title>');
      expect(xml).toContain('<author>');
      expect(xml).toContain('<name>John Doe</name>');
      expect(xml).toContain('<email>john@example.com</email>');
    });

    it('should skip undefined values', async () => {
      const schema = x.object({
        title: x.string().writer({ element: 'title' }),
        subtitle: x.string().optional().writer({ element: 'subtitle' })
      });

      const xml = await schema.write(
        { title: 'Book', subtitle: undefined },
        { rootElement: 'book' }
      );

      expect(xml).toContain('<title>Book</title>');
      expect(xml).not.toContain('subtitle');
    });
  });

  describe('Array Writing', () => {
    it('should write array of strings', async () => {
      const schema = x.array(x.string().writer({ element: 'item' }));

      const xml = await schema.write(['apple', 'banana', 'cherry'], {
        rootElement: 'items',
        prettyPrint: false
      });

      expect(xml).toContain('<item>apple</item>');
      expect(xml).toContain('<item>banana</item>');
      expect(xml).toContain('<item>cherry</item>');
    });

    it('should write array of objects', async () => {
      const itemSchema = x.object({
        name: x.string().writer({ element: 'name' }),
        price: x.number().writer({ element: 'price' })
      }).writer({ element: 'item' });

      const schema = x.array(itemSchema);

      const data = [
        { name: 'Book', price: 20 },
        { name: 'Pen', price: 5 }
      ];

      const xml = await schema.write(data, {
        rootElement: 'items',
        prettyPrint: false
      });

      expect(xml).toContain('<item>');
      expect(xml).toContain('<name>Book</name>');
      expect(xml).toContain('<price>20</price>');
      expect(xml).toContain('<name>Pen</name>');
      expect(xml).toContain('<price>5</price>');
    });
  });

  describe('Pretty Print', () => {
    it('should format with pretty print', async () => {
      const schema = x.object({
        title: x.string().writer({ element: 'title' }),
        author: x.string().writer({ element: 'author' })
      });

      const xml = await schema.write(
        { title: 'Book', author: 'John' },
        { rootElement: 'book', prettyPrint: true }
      );

      // Check for newlines and indentation
      expect(xml).toContain('\n');
      expect(xml).toMatch(/<book>\s+<title>/);
    });
  });

  describe('XML Declaration', () => {
    it('should include XML declaration by default', async () => {
      const schema = x.string().writer({ element: 'text' });
      const xml = await schema.write('Hello', { rootElement: 'root' });
      expect(xml).toMatch(/^<\?xml version="1\.0"/);
    });

    it('should skip XML declaration when requested', async () => {
      const schema = x.string().writer({ element: 'text' });
      const xml = await schema.write('Hello', {
        rootElement: 'root',
        includeDeclaration: false
      });
      expect(xml).not.toContain('<?xml');
    });

    it('should use custom XML version', async () => {
      const schema = x.string().writer({ element: 'text' });
      const xml = await schema.write('Hello', {
        rootElement: 'root',
        xmlVersion: '1.1'
      });
      expect(xml).toContain('<?xml version="1.1"');
    });
  });

  describe('Sync vs Async', () => {
    it('should support synchronous writing', () => {
      const schema = x.object({
        title: x.string().writer({ element: 'title' }),
        price: x.number().writer({ element: 'price' })
      });

      const xml = schema.writeSync(
        { title: 'Book', price: 20 },
        { rootElement: 'book', prettyPrint: false }
      );

      expect(xml).toContain('<title>Book</title>');
      expect(xml).toContain('<price>20</price>');
    });

    it('should have same output for sync and async', async () => {
      const schema = x.object({
        title: x.string().writer({ element: 'title' }),
        price: x.number().writer({ element: 'price' })
      });

      const data = { title: 'Book', price: 20 };
      const options = { rootElement: 'book', prettyPrint: false };

      const syncXml = schema.writeSync(data, options);
      const asyncXml = await schema.write(data, options);

      expect(syncXml).toBe(asyncXml);
    });
  });

  describe('Round-trip (Parse and Write)', () => {
    it('should preserve data through parse and write cycle', async () => {
      const schema = x.object({
        title: x.string()
          .xpath('/book/title')
          .writer({ element: 'title' }),
        price: x.number()
          .xpath('/book/price')
          .writer({ element: 'price' })
      });

      const originalData = { title: 'TypeScript', price: 29.99 };

      // Write to XML
      const xml = await schema.write(originalData, {
        rootElement: 'book',
        prettyPrint: false
      });

      // Parse back
      const parsedData = await schema.parse(xml);

      // Should match original
      expect(parsedData).toEqual(originalData);
    });

    it('should handle complex nested structures', async () => {
      const schema = x.object({
        title: x.string()
          .xpath('/book/title')
          .writer({ element: 'title' }),
        authors: x.array(
          x.object({
            name: x.string()
              .xpath('./name')
              .writer({ element: 'name' }),
            email: x.string()
              .xpath('./email')
              .writer({ element: 'email' })
          })
            .xpath('/book/authors/author')
            .writer({ element: 'author' })
        ).writer({ element: 'authors' })
      });

      const originalData = {
        title: 'TypeScript Guide',
        authors: [
          { name: 'John', email: 'john@example.com' },
          { name: 'Jane', email: 'jane@example.com' }
        ]
      };

      const xml = await schema.write(originalData, {
        rootElement: 'book',
        prettyPrint: false
      });

      const parsedData = await schema.parse(xml);

      expect(parsedData).toEqual(originalData);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for transform schema', async () => {
      const schema = x.string()
        .writer({ element: 'text' })
        .transform(s => s.toUpperCase());

      await expect(
        schema.write('hello', { rootElement: 'root' })
      ).rejects.toThrow('Transform schema does not support writing');
    });
  });
});
