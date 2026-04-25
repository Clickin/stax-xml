import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

describe('String Schema Position Parsing', () => {
  describe('Nested Array Element Parsing', () => {
    it('should parse string from nested array element (sync)', () => {
      const xml = `
        <root>
          <items>
            <item>
              <name>Item 1</name>
            </item>
            <item>
              <name>Item 2</name>
            </item>
          </items>
        </root>
      `;

      const schema = x.object({
        items: x.array(
          x.object({
            name: x.string().xpath('./name')
          }).writer({ element: 'item' }),
          '/root/items/item'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe('Item 1');
      expect(result.items[1].name).toBe('Item 2');
    });

    it('should parse string from nested array element (async)', async () => {
      const xml = `
        <root>
          <items>
            <item>
              <name>Item 1</name>
            </item>
            <item>
              <name>Item 2</name>
            </item>
          </items>
        </root>
      `;

      const schema = x.object({
        items: x.array(
          x.object({
            name: x.string().xpath('./name')
          }).writer({ element: 'item' }),
          '/root/items/item'
        )
      });

      const result = await schema.parse(xml);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe('Item 1');
      expect(result.items[1].name).toBe('Item 2');
    });
  });

  describe('Mixed Content Parsing', () => {
    it('should handle string with nested child elements (mixed content)', () => {
      const xml = `
        <root>
          <content>
            Text before
            <child>Nested</child>
            Text after
          </content>
        </root>
      `;

      const schema = x.object({
        content: x.string().xpath('/root/content')
      });

      const result = schema.parseSync(xml);
      // Collects all text content within the element
      expect(result.content).toContain('Text before');
      expect(result.content).toContain('Nested');
      expect(result.content).toContain('Text after');
    });
  });

  describe('XPath Validation', () => {
    it('should throw error when XPath is empty string', () => {
      expect(() => {
        x.string().xpath('');
      }).toThrow('XPath cannot be empty');
    });

    it('should accept valid XPath', () => {
      expect(() => {
        x.string().xpath('/root/element');
      }).not.toThrow();
    });
  });

  describe('Write Operations', () => {
    it('should write string with root element', () => {
      const schema = x.string();
      const xml = schema.writeSync('Hello World', { rootElement: 'message' });

      expect(xml).toContain('<?xml');
      expect(xml).toContain('<message>Hello World</message>');
    });

    it('should write string with element config', () => {
      const schema = x.string().writer({ element: 'text' });
      const xml = (schema as any)._writeSync('Test Content', { rootElement: 'root' });

      expect(xml).toContain('<root>');
      expect(xml).toContain('<text>Test Content</text>');
    });

    it('should write string with async', async () => {
      const schema = x.string();
      const xml = await schema.write('Async Content', { rootElement: 'data' });

      expect(xml).toContain('<data>Async Content</data>');
    });

    it('should write async string content without a root wrapper', async () => {
      const schema = x.string();
      const xml = await schema.write('Bare & Content');

      expect(xml).toBe('Bare &amp; Content');
    });

    it('should write content with CDATA config', () => {
      const schema = x.string().writer({ cdata: true, element: 'content' });
      const xml = (schema as any)._writeSync('Special <> Content', { rootElement: 'root' });

      expect(xml).toContain('<![CDATA[Special <> Content]]>');
    });

    it('should escape special XML chars when not using CDATA', () => {
      const schema = x.string();
      const content = schema._writeContent('Text with < and > and &', {});

      expect(content).toContain('&lt;');
      expect(content).toContain('&gt;');
      expect(content).toContain('&amp;');
    });

    it('should not escape when using CDATA', () => {
      const schema = x.string().writer({ cdata: true });
      const content = schema._writeContent('Text with < and >', {});

      expect(content).toBe('Text with < and >');
    });
  });

  describe('Text Collection with Deep Nesting', () => {
    it('should collect text from deeply nested elements (sync)', () => {
      const xml = `
        <root>
          <level1>
            <level2>
              <level3>Deep Content</level3>
            </level2>
          </level1>
        </root>
      `;

      const schema = x.object({
        level1: x.object({
          level2: x.object({
            level3: x.string().xpath('./level3')
          }).xpath('./level2')
        }).xpath('/root/level1')
      });

      const result = schema.parseSync(xml);
      expect(result.level1.level2.level3).toBe('Deep Content');
    });

    it('should collect text from deeply nested elements (async)', async () => {
      const xml = `
        <root>
          <outer>
            <middle>
              <inner>Nested Text</inner>
            </middle>
          </outer>
        </root>
      `;

      const schema = x.object({
        outer: x.object({
          middle: x.object({
            inner: x.string().xpath('./inner')
          }).xpath('./middle')
        }).xpath('/root/outer')
      });

      const result = await schema.parse(xml);
      expect(result.outer.middle.inner).toBe('Nested Text');
    });

    it('should handle CDATA in nested parsing (sync)', () => {
      const xml = `
        <root>
          <container>
            <data><![CDATA[CDATA <content>]]></data>
          </container>
        </root>
      `;

      const schema = x.object({
        container: x.object({
          data: x.string().xpath('./data')
        }).xpath('/root/container')
      });

      const result = schema.parseSync(xml);
      expect(result.container.data).toBe('CDATA <content>');
    });

    it('should handle CDATA in nested parsing (async)', async () => {
      const xml = `
        <root>
          <wrapper>
            <content><![CDATA[Async CDATA <data>]]></content>
          </wrapper>
        </root>
      `;

      const schema = x.object({
        wrapper: x.object({
          content: x.string().xpath('./content')
        }).xpath('/root/wrapper')
      });

      const result = await schema.parse(xml);
      expect(result.wrapper.content).toBe('Async CDATA <data>');
    });
  });

  describe('Position-Based Parsing Edge Cases', () => {
    it('should handle _parseFromPosition with sync iterator', () => {
      const xml = `
        <root>
          <items>
            <item>
              <value>Item Value</value>
            </item>
          </items>
        </root>
      `;

      const schema = x.object({
        items: x.array(
          x.object({
            value: x.string().xpath('./value')
          }).writer({ element: 'item' }),
          '/root/items/item'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.items[0].value).toBe('Item Value');
    });

    it('should handle _parseFromPosition with async iterator', async () => {
      const xml = `
        <root>
          <entries>
            <entry>
              <text>Entry Text</text>
            </entry>
          </entries>
        </root>
      `;

      const schema = x.object({
        entries: x.array(
          x.object({
            text: x.string().xpath('./text')
          }).writer({ element: 'entry' }),
          '/root/entries/entry'
        )
      });

      const result = await schema.parse(xml);
      expect(result.entries[0].text).toBe('Entry Text');
    });

    it('should handle nested elements with mixed content', () => {
      const xml = `
        <root>
          <section>
            Text before
            <nested>Nested content</nested>
            Text after
          </section>
        </root>
      `;

      const schema = x.object({
        section: x.string().xpath('/root/section')
      });

      const result = schema.parseSync(xml);
      // collectText gathers text at the same depth level
      expect(result.section).toContain('Text before');
      expect(result.section).toContain('Nested content');
      expect(result.section).toContain('Text after');
    });
  });
});
