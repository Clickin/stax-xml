import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';
import { XPathCompiler } from '../../src/converter/XPathEngine.js';

describe('XPath Engine Tests', () => {
  describe('XPath Compilation', () => {
    it('should compile absolute path', () => {
      const compiled = XPathCompiler.compile('/root/item');
      expect(compiled.isAbsolute).toBe(true);
      expect(compiled.isDescendant).toBe(false);
      expect(compiled.segments).toHaveLength(2);
      expect(compiled.segments[0].name).toBe('root');
      expect(compiled.segments[1].name).toBe('item');
    });

    it('should compile descendant path', () => {
      const compiled = XPathCompiler.compile('//item');
      expect(compiled.isAbsolute).toBe(true); // // starts with / so isAbsolute is true
      expect(compiled.isDescendant).toBe(true);
      expect(compiled.segments).toHaveLength(1);
      expect(compiled.segments[0].name).toBe('item');
    });

    it('should compile relative path', () => {
      const compiled = XPathCompiler.compile('item');
      expect(compiled.isAbsolute).toBe(false);
      expect(compiled.isDescendant).toBe(false);
      expect(compiled.segments).toHaveLength(1);
    });

    it('should compile path with attribute predicate', () => {
      const compiled = XPathCompiler.compile("/book[@id='1']");
      expect(compiled.segments[0].predicates).toHaveLength(1);
      expect(compiled.segments[0].predicates[0].type).toBe('attribute');
      expect(compiled.segments[0].predicates[0].attribute).toBe('id');
      expect(compiled.segments[0].predicates[0].value).toBe('1');
    });

    it('should compile path with position predicate', () => {
      const compiled = XPathCompiler.compile('/items/item[2]');
      expect(compiled.segments[1].predicates).toHaveLength(1);
      expect(compiled.segments[1].predicates[0].type).toBe('position');
      expect(compiled.segments[1].predicates[0].position).toBe(2);
    });

    it('should compile path with wildcard', () => {
      const compiled = XPathCompiler.compile('/root/*');
      expect(compiled.segments[1].isWildcard).toBe(true);
    });

    it('should throw on empty xpath', () => {
      expect(() => XPathCompiler.compile('')).toThrow('cannot be empty');
    });

    it('should throw on invalid characters', () => {
      expect(() => XPathCompiler.compile('/root;<script>')).toThrow('Invalid characters');
    });

    it('should throw on too long xpath', () => {
      const longPath = '/root/' + 'a'.repeat(1000);
      expect(() => XPathCompiler.compile(longPath)).toThrow('too long');
    });

    it('should cache compiled xpaths', () => {
      XPathCompiler.clearCache();
      const xpath = '/root/item';
      const first = XPathCompiler.compile(xpath);
      const second = XPathCompiler.compile(xpath);
      expect(first).toBe(second); // Same reference = cached
    });
  });

  describe('XPath Matching - Absolute Paths', () => {
    it('should match absolute path', () => {
      const xml = '<root><item>Value</item></root>';
      const schema = x.string().xpath('/root/item');
      const result = schema.parse(xml);
      expect(result).toBe('Value');
    });

    it('should match nested absolute path', () => {
      const xml = '<root><level1><level2>Deep Value</level2></level1></root>';
      const schema = x.string().xpath('/root/level1/level2');
      const result = schema.parse(xml);
      expect(result).toBe('Deep Value');
    });

    it('should not match wrong absolute path', () => {
      const xml = '<root><item>Value</item></root>';
      const schema = x.string().xpath('/root/other');
      const result = schema.parse(xml);
      expect(result).toBe('');
    });
  });

  describe('XPath Matching - Descendant Paths', () => {
    it('should match descendant at any level', () => {
      const xml = `
        <root>
          <level1>
            <item>First</item>
            <level2>
              <item>Second</item>
            </level2>
          </level1>
        </root>
      `;
      const schema = x.array(x.string(), '//item');
      const result = schema.parse(xml);
      expect(result).toEqual(['First', 'Second']);
    });

    it('should match descendant in complex structure', () => {
      const xml = `
        <html>
          <body>
            <div>
              <p>Paragraph 1</p>
              <section>
                <p>Paragraph 2</p>
              </section>
            </div>
          </body>
        </html>
      `;
      const schema = x.array(x.string(), '//p');
      const result = schema.parse(xml);
      expect(result).toEqual(['Paragraph 1', 'Paragraph 2']);
    });
  });

  describe('XPath Matching - Attribute Predicates', () => {
    it('should match by attribute value', () => {
      const xml = `
        <books>
          <book id="1">First Book</book>
          <book id="2">Second Book</book>
          <book id="3">Third Book</book>
        </books>
      `;
      const schema = x.string().xpath("//book[@id='2']");
      const result = schema.parse(xml);
      expect(result).toBe('Second Book');
    });

    it('should not match wrong attribute value', () => {
      const xml = '<book id="1">Book</book>';
      const schema = x.string().xpath("//book[@id='2']");
      const result = schema.parse(xml);
      expect(result).toBe('');
    });

    it('should match attribute with different types', () => {
      const xml = `
        <items>
          <item type="active">Active Item</item>
          <item type="inactive">Inactive Item</item>
        </items>
      `;
      const schema = x.string().xpath("//item[@type='active']");
      const result = schema.parse(xml);
      expect(result).toBe('Active Item');
    });
  });

  describe('XPath Matching - Position Predicates', () => {
    it('should match first element', () => {
      const xml = `
        <list>
          <item>First</item>
          <item>Second</item>
          <item>Third</item>
        </list>
      `;
      const schema = x.string().xpath('//item[1]');
      const result = schema.parse(xml);
      expect(result).toBe('First');
    });

    it('should match second element', () => {
      const xml = `
        <list>
          <item>First</item>
          <item>Second</item>
          <item>Third</item>
        </list>
      `;
      const schema = x.string().xpath('//item[2]');
      const result = schema.parse(xml);
      expect(result).toBe('Second');
    });

    it('should match last element by position', () => {
      const xml = `
        <list>
          <item>First</item>
          <item>Second</item>
          <item>Third</item>
        </list>
      `;
      const schema = x.string().xpath('//item[3]');
      const result = schema.parse(xml);
      expect(result).toBe('Third');
    });
  });

  describe('XPath Matching - Wildcard', () => {
    it('should match any child with wildcard', () => {
      const xml = `
        <root>
          <first>First Value</first>
          <second>Second Value</second>
          <third>Third Value</third>
        </root>
      `;
      // Wildcard should match first element encountered
      const schema = x.string().xpath('/root/*');
      const result = schema.parse(xml);
      expect(result).toBe('First Value');
    });
  });

  describe('XPath Matching - Complex Cases', () => {
    it('should handle multiple levels with attributes', () => {
      const xml = `
        <library>
          <section name="fiction">
            <book id="1">Book 1</book>
            <book id="2">Book 2</book>
          </section>
          <section name="non-fiction">
            <book id="3">Book 3</book>
          </section>
        </library>
      `;
      const schema = x.string().xpath("//section[@name='fiction']/book[@id='2']");
      const result = schema.parse(xml);
      expect(result).toBe('Book 2');
    });

    it('should handle CDATA in xpath match', () => {
      const xml = '<root><item><![CDATA[<special>content</special>]]></item></root>';
      const schema = x.string().xpath('/root/item');
      const result = schema.parse(xml);
      expect(result).toBe('<special>content</special>');
    });

    it('should handle whitespace in matched content', () => {
      const xml = `
        <root>
          <item>
            Value with
            multiple lines
          </item>
        </root>
      `;
      const schema = x.string().xpath('/root/item');
      const result = schema.parse(xml);
      expect(result).toContain('Value with');
      expect(result).toContain('multiple lines');
    });
  });
});