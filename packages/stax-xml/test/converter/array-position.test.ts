import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

describe('Array Schema Position Parsing', () => {
  describe('_parseText Method', () => {
    it('should return empty array when parsing from text', () => {
      const schema = x.array(x.string().writer({ element: 'item' }));
      const result = (schema as any)._parseText('some text');

      expect(result).toEqual([]);
    });
  });

  describe('Nested Array Parsing', () => {
    it('should parse nested array in object (sync position parsing)', () => {
      const xml = `
        <root>
          <person>
            <name>John</name>
            <hobbies>
              <hobby>Reading</hobby>
              <hobby>Gaming</hobby>
            </hobbies>
          </person>
        </root>
      `;

      const schema = x.object({
        person: x.object({
          name: x.string().xpath('./name'),
          hobbies: x.array(x.string().writer({ element: 'hobby' }), './hobbies/hobby')
        }).xpath('/root/person')
      });

      const result = schema.parseSync(xml);
      expect(result.person.name).toBe('John');
      expect(result.person.hobbies).toEqual(['Reading', 'Gaming']);
    });

    it('should parse nested array in object (async position parsing)', async () => {
      const xml = `
        <root>
          <person>
            <name>Jane</name>
            <tags>
              <tag>developer</tag>
              <tag>designer</tag>
            </tags>
          </person>
        </root>
      `;

      const schema = x.object({
        person: x.object({
          name: x.string().xpath('./name'),
          tags: x.array(x.string().writer({ element: 'tag' }), './tags/tag')
        }).xpath('/root/person')
      });

      const result = await schema.parse(xml);
      expect(result.person.name).toBe('Jane');
      expect(result.person.tags).toEqual(['developer', 'designer']);
    });
  });

  describe('Iterator Detection', () => {
    it('should handle array with async iterator detection', async () => {
      const xml = `
        <root>
          <items>
            <item>A</item>
            <item>B</item>
            <item>C</item>
          </items>
        </root>
      `;

      const schema = x.object({
        items: x.array(x.string().writer({ element: 'item' }), '/root/items/item')
      });

      // Async parsing uses async iterator internally
      const result = await schema.parse(xml);
      expect(result.items).toEqual(['A', 'B', 'C']);
    });
  });
});
