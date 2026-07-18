import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/converter/index.js';

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
        isbn: x.string().writer({ element: 'isbn', asAttribute: 'isbn' }),
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

    it('should reject XML versions outside the supported XML 1.0 contract', async () => {
      const schema = x.string().writer({ element: 'text' });
      await expect(schema.write('Hello', {
        rootElement: 'root',
        xmlVersion: '1.1' as '1.0'
      })).rejects.toThrow(/only supports XML 1\.0/i);
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

    it('should preserve nested object, optional, and array element structure exactly', async () => {
      const schema = x.object({
        child: x.object({
          name: x.string().writer({ element: 'name' })
        }).writer({ element: 'child' }),
        note: x.string().optional().writer({ element: 'note' }),
        items: x.array(
          x.object({ value: x.string().writer({ element: 'value' }) })
            .writer({ element: 'item' })
        ).writer({ element: 'items' })
      });
      const data = {
        child: { name: 'A' },
        note: 'B',
        items: [{ value: 'one' }, { value: 'two' }]
      };
      const options = { rootElement: 'root', includeDeclaration: false } as const;
      const expected = '<root><child><name>A</name></child><note>B</note><items><item><value>one</value></item><item><value>two</value></item></items></root>';

      expect(schema.writeSync(data, options)).toBe(expected);
      await expect(schema.write(data, options)).resolves.toBe(expected);
    });

    it('should honor top-level object, array, and optional schema elements', async () => {
      const object = x.object({
        id: x.string().writer({ asAttribute: 'id' }),
        value: x.string().writer({ element: 'value' })
      }).writer({ element: 'entry' });
      const array = x.array(x.string().writer({ element: 'item' }))
        .writer({ element: 'items' });
      const optional = x.string().optional().writer({ element: 'maybe' });
      const options = { rootElement: 'root', includeDeclaration: false } as const;

      expect(object.writeSync({ id: '7', value: 'A' }, options))
        .toBe('<root><entry id="7"><value>A</value></entry></root>');
      await expect(object.write({ id: '7', value: 'A' }, options))
        .resolves.toBe('<root><entry id="7"><value>A</value></entry></root>');
      expect(object.writeSync({ id: '7', value: 'A' }, { includeDeclaration: false }))
        .toBe('<entry id="7"><value>A</value></entry>');
      expect(array.writeSync(['A', 'B'], options))
        .toBe('<root><items><item>A</item><item>B</item></items></root>');
      await expect(array.write(['A', 'B'], options))
        .resolves.toBe('<root><items><item>A</item><item>B</item></items></root>');
      expect(optional.writeSync('A', options)).toBe('<root><maybe>A</maybe></root>');
      await expect(optional.write('A', options)).resolves.toBe('<root><maybe>A</maybe></root>');
    });

    it('should honor namespaces and self-closing empty elements and reject invalid XML characters', async () => {
      const namespaced = x.string().writer({
        element: 'value',
        namespace: { uri: 'urn:example' }
      });
      const empty = x.string().writer({ element: 'empty', selfClosing: true });

      expect(namespaced.writeSync('ok', { rootElement: 'root', includeDeclaration: false }))
        .toBe('<root><value xmlns="urn:example">ok</value></root>');
      await expect(namespaced.write('ok', { rootElement: 'root', includeDeclaration: false }))
        .resolves.toBe('<root><value xmlns="urn:example">ok</value></root>');
      expect(empty.writeSync('', { rootElement: 'root', includeDeclaration: false }))
        .toBe('<root><empty/></root>');
      await expect(empty.write('', { rootElement: 'root', includeDeclaration: false }))
        .resolves.toBe('<root><empty/></root>');
      expect(() => namespaced.writeSync('\u0000', { rootElement: 'root' }))
        .toThrow(/invalid XML character/i);
      await expect(namespaced.write('\u0000', { rootElement: 'root' }))
        .rejects.toThrow(/invalid XML character/i);
    });

    it('should serialize namespaced object attributes using their expanded names', async () => {
      const schema = x.object({
        id: x.string('./@id').writer({
          asAttribute: 'id',
          namespace: { prefix: 'm', uri: 'urn:metrics' }
        })
      });
      const options = { rootElement: 'root', includeDeclaration: false } as const;

      expect(schema.writeSync({ id: '7' }, options))
        .toBe('<root xmlns:m="urn:metrics" m:id="7"></root>');
      await expect(schema.write({ id: '7' }, options))
        .resolves.toBe('<root xmlns:m="urn:metrics" m:id="7"></root>');

      const invalid = x.object({
        id: x.string('./@id').writer({ asAttribute: 'id', namespace: { uri: 'urn:metrics' } })
      });
      expect(() => invalid.writeSync({ id: '7' }, options)).toThrow(/requires a prefix/i);
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

    it('should reject invalid injected writer instances for primitive and array schemas', async () => {
      const invalidWriter = {} as any;

      expect(() => x.string().writeSync('text', { writer: invalidWriter })).toThrow(
        'writeSync requires WriterSync or WriterSyncSink instance'
      );
      await expect(x.string().write('text', { writer: invalidWriter })).rejects.toThrow(
        'write requires Writer instance'
      );

      expect(() => x.number().writeSync(1, { writer: invalidWriter })).toThrow(
        'writeSync requires WriterSync or WriterSyncSink instance'
      );
      await expect(x.number().write(1, { writer: invalidWriter })).rejects.toThrow(
        'write requires Writer instance'
      );

      const arraySchema = x.array(x.string().writer({ element: 'item' }));
      expect(() => arraySchema.writeSync(['a'], { writer: invalidWriter })).toThrow(
        'writeSync requires WriterSync or WriterSyncSink instance'
      );
      await expect(arraySchema.write(['a'], { writer: invalidWriter })).rejects.toThrow(
        'write requires Writer instance'
      );
    });
  });

  describe('Stream Writing', () => {
    it('should write directly to a provided WritableStream', async () => {
      const chunks: Uint8Array[] = [];
      const stream = new WritableStream<Uint8Array>({
        write(chunk) {
          chunks.push(chunk);
        }
      });
      const schema = x.object({
        title: x.string().writer({ element: 'title' }),
        tags: x.array(x.string().writer({ element: 'tag' })).writer({ element: 'tags' })
      });

      await schema.writeToStream(
        { title: 'Guide', tags: ['xml', 'stream'] },
        stream,
        { rootElement: 'book', includeDeclaration: false, prettyPrint: false }
      );

      const decoder = new TextDecoder();
      const xml = chunks.map(chunk => decoder.decode(chunk, { stream: true })).join('') + decoder.decode();
      expect(xml).toContain('<book>');
      expect(xml).toContain('<title>Guide</title>');
      expect(xml).toContain('<tag>xml</tag>');
      expect(xml).toContain('<tag>stream</tag>');
    });
  });
});
