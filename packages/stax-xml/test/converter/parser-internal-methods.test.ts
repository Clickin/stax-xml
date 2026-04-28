import { describe, expect, it } from 'vitest';
import { EventReaderSync } from '../../src/EventReaderSync.js';
import { XmlParserInternal } from '../../src/converter/XmlParserInternal.js';
import { x } from '../../src/converter/index.js';
import { isStartElement } from '../../src/types.js';

/**
 * Direct unit tests for XmlParserInternal's untested private methods
 * These tests directly call internal methods using event iterators
 */
describe('XmlParserInternal - Internal Methods Coverage', () => {
  describe('collectTextUntilCloseSync', () => {
    it('should collect text content at same depth (sync)', () => {
      const xml = '<root><item>Hello World</item></root>';
      const parser = new EventReaderSync(xml);
      const parserInternal = new XmlParserInternal();

      let depth = 0;
      let targetDepth = -1;

      for (const event of parser) {
        if (isStartElement(event)) {
          depth++;
          if (event.name === 'item') {
            targetDepth = depth;
            if (targetDepth > 0) {
              const result = (parserInternal as any).collectTextUntilCloseSync(parser, targetDepth);
              expect(result).toBe('Hello World');
            } else {
              throw new Error('Failed to setup iterator');
            }
          }
        }
      }

    });

    it('should collect text with nested elements', () => {
      const xml = '<root><item>Text1<nested>Nested Text</nested>Text2</item></root>';
      const schema = x.object({
        items: x.array(
          x.string().writer({ element: 'item' }),
          '/root/item'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.items[0]).toContain('Text1');
      expect(result.items[0]).toContain('Text2');
    });

    it('should handle CDATA content', () => {
      const xml = '<root><item><![CDATA[<special>content</special>]]></item></root>';
      const schema = x.object({
        items: x.array(
          x.string().writer({ element: 'item' }),
          '/root/item'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.items[0]).toBe('<special>content</special>');
    });

    it('should return empty string for empty element', () => {
      const xml = '<root><item></item></root>';
      const schema = x.object({
        items: x.array(
          x.string().writer({ element: 'item' }),
          '/root/item'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.items[0]).toBe('');
    });

    it('should handle mixed text and CDATA', () => {
      const xml = '<root><item>Start<![CDATA[Middle]]>End</item></root>';
      const schema = x.object({
        items: x.array(
          x.string().writer({ element: 'item' }),
          '/root/item'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.items[0]).toBe('StartMiddleEnd');
    });
  });

  describe('collectTextUntilClose (async)', () => {
    it('should collect text asynchronously', async () => {
      const xml = '<root><item>Async Content</item></root>';
      const schema = x.object({
        items: x.array(
          x.string().writer({ element: 'item' }),
          '/root/item'
        )
      });

      const result = await schema.parse(xml);
      expect(result.items[0]).toBe('Async Content');
    });

    it('should handle nested elements async', async () => {
      const xml = '<root><item>Before<nested>Inside</nested>After</item></root>';
      const schema = x.object({
        items: x.array(
          x.string().writer({ element: 'item' }),
          '/root/item'
        )
      });

      const result = await schema.parse(xml);
      expect(result.items[0]).toContain('Before');
      expect(result.items[0]).toContain('After');
    });

    it('should handle CDATA async', async () => {
      const xml = '<root><item><![CDATA[Async CDATA]]></item></root>';
      const schema = x.object({
        items: x.array(
          x.string().writer({ element: 'item' }),
          '/root/item'
        )
      });

      const result = await schema.parse(xml);
      expect(result.items[0]).toBe('Async CDATA');
    });

    it('should handle long text streams', async () => {
      const longText = 'A'.repeat(1000);
      const xml = `<root><item>${longText}</item></root>`;
      const schema = x.object({
        items: x.array(
          x.string().writer({ element: 'item' }),
          '/root/item'
        )
      });

      const result = await schema.parse(xml);
      expect(result.items[0]).toBe(longText);
    });
  });

  describe('parseArrayFromPositionSync', () => {
    it('should parse simple string array', () => {
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
        items: x.array(
          x.string().writer({ element: 'item' }),
          '/root/items/item'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.items).toEqual(['A', 'B', 'C']);
    });

    it('should parse number array', () => {
      const xml = `
        <root>
          <numbers>
            <num>10</num>
            <num>20</num>
            <num>30</num>
          </numbers>
        </root>
      `;

      const schema = x.object({
        numbers: x.array(
          x.number().writer({ element: 'num' }),
          '/root/numbers/num'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.numbers).toEqual([10, 20, 30]);
    });

    it('should handle attribute selector', () => {
      const xml = `
        <root>
          <container>
            <item type="a">1</item>
            <item type="b">2</item>
            <item type="a">3</item>
          </container>
        </root>
      `;

      const schema = x.object({
        values: x.array(
          x.number().writer({ element: 'item' }),
          '/root/container/item[@type="a"]'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.values).toHaveLength(2);
      expect(result.values).toEqual([1, 3]);
    });

    it('should parse complex object array', () => {
      const xml = `
        <root>
          <users>
            <user>
              <name>Alice</name>
              <age>25</age>
            </user>
            <user>
              <name>Bob</name>
              <age>30</age>
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
      expect(result.users[0].name).toBe('Alice');
      expect(result.users[1].age).toBe(30);
    });

    it('should handle relative XPath', () => {
      const xml = `
        <root>
          <section>
            <item>X</item>
            <item>Y</item>
          </section>
        </root>
      `;

      const schema = x.object({
        section: x.object({
          items: x.array(
            x.string().writer({ element: 'item' }),
            './item'
          )
        }).xpath('/root/section')
      });

      const result = schema.parseSync(xml);
      expect(result.section.items).toEqual(['X', 'Y']);
    });

    it('should return empty array when no match', () => {
      const xml = `
        <root>
          <container>
            <other>Not matched</other>
          </container>
        </root>
      `;

      const schema = x.object({
        items: x.array(
          x.string().writer({ element: 'item' }),
          '/root/container/item'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.items).toEqual([]);
    });

    it('should throw error without xpath', () => {
      const xml = '<root><items></items></root>';
      const schema = x.array(x.string().writer({ element: 'item' }));

      expect(() => {
        schema.parseSync(xml);
      }).toThrow('Array schema requires xpath');
    });
  });

  describe('parseArrayFromPosition (async)', () => {
    it('should parse async string array', async () => {
      const xml = `
        <root>
          <items>
            <item>Async A</item>
            <item>Async B</item>
          </items>
        </root>
      `;

      const schema = x.object({
        items: x.array(
          x.string().writer({ element: 'item' }),
          '/root/items/item'
        )
      });

      const result = await schema.parse(xml);
      expect(result.items).toEqual(['Async A', 'Async B']);
    });

    it('should parse async object array', async () => {
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
      expect(result.products[0].id).toBe(1);
      expect(result.products[1].price).toBe(49.99);
    });

    it('should handle async attribute selector', async () => {
      const xml = `
        <root>
          <items>
            <item status="active">Item 1</item>
            <item status="inactive">Item 2</item>
            <item status="active">Item 3</item>
          </items>
        </root>
      `;

      const schema = x.object({
        active: x.array(
          x.string().writer({ element: 'item' }),
          '/root/items/item[@status="active"]'
        )
      });

      const result = await schema.parse(xml);
      expect(result.active).toHaveLength(2);
      expect(result.active).toEqual(['Item 1', 'Item 3']);
    });

    it('should handle deeply nested async arrays', async () => {
      const xml = `
        <root>
          <groups>
            <group>
              <items>
                <item>G1-I1</item>
                <item>G1-I2</item>
              </items>
            </group>
          </groups>
        </root>
      `;

      const schema = x.object({
        groups: x.array(
          x.object({
            items: x.array(
              x.string().writer({ element: 'item' }),
              './items/item'
            )
          }).writer({ element: 'group' }),
          '/root/groups/group'
        )
      });

      const result = await schema.parse(xml);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].items).toEqual(['G1-I1', 'G1-I2']);
    });

    it('should handle element XPath matching', async () => {
      const xml = `
        <root>
          <data>
            <record>
              <value>V1</value>
            </record>
            <record>
              <value>V2</value>
            </record>
          </data>
        </root>
      `;

      const schema = x.object({
        values: x.array(
          x.string().xpath('./value'),
          '/root/data/record'
        )
      });

      const result = await schema.parse(xml);
      expect(result.values).toEqual(['V1', 'V2']);
    });

    it('should throw error async without xpath', async () => {
      const xml = '<root><items></items></root>';
      const schema = x.array(x.string().writer({ element: 'item' }));

      await expect(async () => {
        await schema.parse(xml);
      }).rejects.toThrow('Array schema requires xpath');
    });
  });

  describe('parseObjectFromPositionSync', () => {
    it('should parse simple object', () => {
      const xml = `
        <root>
          <person>
            <name>John</name>
            <age>30</age>
          </person>
        </root>
      `;

      const schema = x.object({
        person: x.object({
          name: x.string().xpath('./name'),
          age: x.number().xpath('./age')
        }).xpath('/root/person')
      });

      const result = schema.parseSync(xml);
      expect(result.person.name).toBe('John');
      expect(result.person.age).toBe(30);
    });

    it('should handle nested objects with depth tracking', () => {
      const xml = `
        <root>
          <outer>
            <inner>
              <value>Nested Value</value>
            </inner>
            <other>Other Value</other>
          </outer>
        </root>
      `;

      const schema = x.object({
        outer: x.object({
          inner: x.object({
            value: x.string().xpath('./value')
          }).xpath('./inner'),
          other: x.string().xpath('./other')
        }).xpath('/root/outer')
      });

      const result = schema.parseSync(xml);
      expect(result.outer.inner.value).toBe('Nested Value');
      expect(result.outer.other).toBe('Other Value');
    });

    it('should integrate with State Machine', () => {
      const xml = `
        <root>
          <data>
            <field1>Value 1</field1>
            <field2>Value 2</field2>
          </data>
        </root>
      `;

      const schema = x.object({
        data: x.object({
          field1: x.string().xpath('./field1'),
          field2: x.string().xpath('./field2')
        }).xpath('/root/data')
      });

      const result = schema.parseSync(xml);
      expect(result.data.field1).toBe('Value 1');
      expect(result.data.field2).toBe('Value 2');
    });

    it('should handle empty object', () => {
      const xml = `
        <root>
          <empty></empty>
        </root>
      `;

      const schema = x.object({
        empty: x.object({
          missing: x.string().xpath('./missing').optional()
        }).xpath('/root/empty')
      });

      const result = schema.parseSync(xml);
      expect(result.empty.missing).toBeUndefined();
    });

    it('should maintain correct depth', () => {
      const xml = `
        <root>
          <container>
            <a>A Value</a>
            <b>
              <c>C Value</c>
            </b>
            <d>D Value</d>
          </container>
        </root>
      `;

      const schema = x.object({
        container: x.object({
          a: x.string().xpath('./a'),
          b: x.object({
            c: x.string().xpath('./c')
          }).xpath('./b'),
          d: x.string().xpath('./d')
        }).xpath('/root/container')
      });

      const result = schema.parseSync(xml);
      expect(result.container.a).toBe('A Value');
      expect(result.container.b.c).toBe('C Value');
      expect(result.container.d).toBe('D Value');
    });

    it('should handle mixed field types', () => {
      const xml = `
        <root>
          <record>
            <id>123</id>
            <name>Test</name>
            <active>true</active>
          </record>
        </root>
      `;

      const schema = x.object({
        record: x.object({
          id: x.number().xpath('./id'),
          name: x.string().xpath('./name'),
          active: x.string().xpath('./active')
        }).xpath('/root/record')
      });

      const result = schema.parseSync(xml);
      expect(result.record.id).toBe(123);
      expect(result.record.name).toBe('Test');
      expect(result.record.active).toBe('true');
    });
  });

  describe('parseObjectFromPosition (async)', () => {
    it('should parse async object', async () => {
      const xml = `
        <root>
          <user>
            <username>async_user</username>
            <email>user@example.com</email>
          </user>
        </root>
      `;

      const schema = x.object({
        user: x.object({
          username: x.string().xpath('./username'),
          email: x.string().xpath('./email')
        }).xpath('/root/user')
      });

      const result = await schema.parse(xml);
      expect(result.user.username).toBe('async_user');
      expect(result.user.email).toBe('user@example.com');
    });

    it('should handle async nested objects', async () => {
      const xml = `
        <root>
          <config>
            <server>
              <host>localhost</host>
              <port>8080</port>
            </server>
            <timeout>30</timeout>
          </config>
        </root>
      `;

      const schema = x.object({
        config: x.object({
          server: x.object({
            host: x.string().xpath('./host'),
            port: x.number().xpath('./port')
          }).xpath('./server'),
          timeout: x.number().xpath('./timeout')
        }).xpath('/root/config')
      });

      const result = await schema.parse(xml);
      expect(result.config.server.host).toBe('localhost');
      expect(result.config.server.port).toBe(8080);
      expect(result.config.timeout).toBe(30);
    });

    it('should integrate with async State Machine', async () => {
      const xml = `
        <root>
          <metadata>
            <created>2024-01-01</created>
            <modified>2024-01-02</modified>
          </metadata>
        </root>
      `;

      const schema = x.object({
        metadata: x.object({
          created: x.string().xpath('./created'),
          modified: x.string().xpath('./modified')
        }).xpath('/root/metadata')
      });

      const result = await schema.parse(xml);
      expect(result.metadata.created).toBe('2024-01-01');
      expect(result.metadata.modified).toBe('2024-01-02');
    });

    it('should handle async parent context', async () => {
      const xml = `
        <root>
          <level1>
            <level2>
              <field>Deep async value</field>
            </level2>
          </level1>
        </root>
      `;

      const schema = x.object({
        level1: x.object({
          level2: x.object({
            field: x.string().xpath('./field')
          }).xpath('./level2')
        }).xpath('/root/level1')
      });

      const result = await schema.parse(xml);
      expect(result.level1.level2.field).toBe('Deep async value');
    });

    it('should handle async empty object', async () => {
      const xml = `
        <root>
          <empty></empty>
        </root>
      `;

      const schema = x.object({
        empty: x.object({
          missing: x.string().xpath('./missing').optional()
        }).xpath('/root/empty')
      });

      const result = await schema.parse(xml);
      expect(result.empty.missing).toBeUndefined();
    });

    it('should maintain async depth tracking', async () => {
      const xml = `
        <root>
          <complex>
            <simple>Simple Value</simple>
            <nested>
              <deep>Deep Value</deep>
            </nested>
            <another>Another Value</another>
          </complex>
        </root>
      `;

      const schema = x.object({
        complex: x.object({
          simple: x.string().xpath('./simple'),
          nested: x.object({
            deep: x.string().xpath('./deep')
          }).xpath('./nested'),
          another: x.string().xpath('./another')
        }).xpath('/root/complex')
      });

      const result = await schema.parse(xml);
      expect(result.complex.simple).toBe('Simple Value');
      expect(result.complex.nested.deep).toBe('Deep Value');
      expect(result.complex.another).toBe('Another Value');
    });
  });
});
