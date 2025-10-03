import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

/**
 * Additional tests specifically targeting parseArrayFromPosition and parseObjectFromPosition
 * These tests ensure the position-based parsing methods are properly covered
 */
describe('Position-Based Parsing Coverage Tests', () => {
  describe('collectTextUntilClose and collectTextUntilCloseSync', () => {
    it('should collect text across multiple CHARACTERS events', async () => {
      // Large text that might be chunked
      const longText = 'A'.repeat(10000);
      const xml = `<root><item>${longText}</item></root>`;
      const schema = x.string().xpath('//item');

      const result = await schema.parse(xml);
      expect(result).toBe(longText);
      expect(result.length).toBe(10000);
    });

    it('should collect text with CDATA mixed in (sync)', () => {
      const xml = '<root><item>Text<![CDATA[CDATA content]]>More text</item></root>';
      const schema = x.string().xpath('//item');

      const result = schema.parseSync(xml);
      expect(result).toBe('TextCDATA contentMore text');
    });

    it('should collect text with CDATA mixed in (async)', async () => {
      const xml = '<root><item>Start<![CDATA[<xml>data</xml>]]>End</item></root>';
      const schema = x.string().xpath('//item');

      const result = await schema.parse(xml);
      // CDATA content comes first in async parsing
      expect(result).toContain('Start');
      expect(result).toContain('<xml>data</xml>');
      expect(result).toContain('End');
    });

    it('should handle nested elements when collecting text at specific depth', () => {
      const xml = `
        <root>
          <item>
            Depth 1 text
            <nested>Depth 2 text</nested>
            More depth 1
          </item>
        </root>
      `;
      const schema = x.string().xpath('//item');

      const result = schema.parseSync(xml);
      // All text is collected including nested
      expect(result).toContain('Depth 1 text');
      expect(result).toContain('Depth 2 text');
      expect(result).toContain('More depth 1');
    });
  });

  describe('extractValueWithElementMatcher coverage', () => {
    it('should extract value when no match is found (returns empty)', () => {
      const xml = '<root><items><other>data</other></items></root>';
      const schema = x.object({
        value: x.string().xpath('/root/items/nonexistent')
      });

      const result = schema.parseSync(xml);
      expect(result.value).toBe('');
    });

    it('should extract value from deeply nested structure', async () => {
      const xml = `
        <root>
          <level1>
            <data>surface</data>
            <level2>
              <data>deep</data>
            </level2>
          </level1>
        </root>
      `;
      const schema = x.object({
        surface: x.string().xpath('/root/level1/data'),
        deep: x.string().xpath('/root/level1/level2/data')
      });

      const result = await schema.parse(xml);
      expect(result.surface).toBe('surface');
      expect(result.deep).toBe('deep');
    });

    it('should accumulate text from multiple character events', () => {
      const largeText = 'B'.repeat(5000);
      const xml = `<root><data><value>${largeText}</value></data></root>`;
      const schema = x.object({
        value: x.string().xpath('/root/data/value')
      });

      const result = schema.parseSync(xml);
      expect(result.value).toBe(largeText);
    });
  });

  describe('extractValueFromCollector edge cases', () => {
    it('should handle optional empty string vs undefined distinction', () => {
      const xml1 = '<root><value></value></root>';
      const xml2 = '<root></root>';

      const schema = x.string().xpath('/root/value').optional();

      const result1 = schema.parseSync(xml1);
      const result2 = schema.parseSync(xml2);

      expect(result1).toBeUndefined(); // Empty element
      expect(result2).toBeUndefined(); // Missing element
    });

    it('should return NaN for invalid number', () => {
      const xml = '<root><num>not-a-number</num></root>';
      const schema = x.number().xpath('/root/num');

      expect(() => schema.parseSync(xml)).toThrow('Invalid number');
    });

    it('should return NaN when number collector has no value', () => {
      const xml = '<root></root>';
      const schema = x.object({
        missing: x.number().xpath('/root/missing').optional()
      });

      const result = schema.parseSync(xml);
      expect(result.missing).toBeUndefined();
    });

    it('should apply multiple transforms to array in correct order', () => {
      const xml = `
        <root>
          <item>1</item>
          <item>2</item>
          <item>3</item>
        </root>
      `;
      const schema = x.array(x.number().writer({ element: 'item' }), '//item')
        .transform(arr => arr.map(n => n * 2))   // [2, 4, 6]
        .transform(arr => arr.filter(n => n > 3)) // [4, 6]
        .transform(arr => arr.reduce((sum, n) => sum + n, 0)); // 10

      const result = schema.parseSync(xml);
      expect(result).toBe(10);
    });

    it('should handle object collector with some fields missing', () => {
      const xml = `
        <root>
          <data>
            <field1>value1</field1>
            <!-- field2 is missing -->
            <field3>value3</field3>
          </data>
        </root>
      `;
      const schema = x.object({
        data: x.object({
          field1: x.string().xpath('./field1'),
          field2: x.string().xpath('./field2').optional(),
          field3: x.string().xpath('./field3')
        }).xpath('/root/data')
      });

      const result = schema.parseSync(xml);
      expect(result.data.field1).toBe('value1');
      expect(result.data.field2).toBeUndefined();
      expect(result.data.field3).toBe('value3');
    });
  });

  describe('unwrapSchema and schema helpers coverage', () => {
    it('should unwrap schema with 5 levels of transforms and optional', () => {
      const xml = '<root><value>10</value></root>';
      const schema = x.number()
        .xpath('/root/value')
        .transform(n => n * 2)      // Level 1: Transform
        .optional()                  // Level 2: Optional
        .transform(n => n !== undefined ? n + 5 : 0) // Level 3: Transform
        .transform(n => n * 3)      // Level 4: Transform
        .optional()                  // Level 5: Optional
        .transform(n => n !== undefined ? `Result: ${n}` : 'N/A'); // Level 6: Transform

      const result = schema.parseSync(xml);
      expect(result).toBe('Result: 75'); // ((10 * 2) + 5) * 3
    });

    it('should handle optional in the middle of a transform chain', () => {
      const xml = '<root><num>5</num></root>';
      const schema = x.number()
        .xpath('/root/num')
        .transform(n => n * 2)      // 10
        .optional()                  // Optional wrapper
        .transform(n => n !== undefined ? n + 10 : 0); // 20

      const result = schema.parseSync(xml);
      expect(result).toBe(20);
    });

    it('should extract xpath from array schema wrapped in transform and optional', () => {
      const xml = `
        <root>
          <items>
            <item>1</item>
            <item>2</item>
          </items>
        </root>
      `;
      const schema = x.array(
        x.number().writer({ element: 'item' }),
        '/root/items/item'
      )
        .transform(arr => arr.map(n => n * 2))
        .optional()
        .transform(arr => arr || []);

      const result = schema.parseSync(xml);
      expect(result).toEqual([2, 4]);
    });
  });

  describe('parseArrayFromPosition - comprehensive coverage', () => {
    it('should handle array elements with nested objects using position parsing', async () => {
      const xml = `
        <root>
          <departments>
            <dept>
              <name>Sales</name>
              <head>
                <name>John Doe</name>
                <level>Senior</level>
              </head>
            </dept>
            <dept>
              <name>Engineering</name>
              <head>
                <name>Jane Smith</name>
                <level>Principal</level>
              </head>
            </dept>
          </departments>
        </root>
      `;

      const schema = x.array(
        x.object({
          name: x.string().xpath('./name'),
          head: x.object({
            name: x.string().xpath('./name'),
            level: x.string().xpath('./level')
          }).xpath('./head')
        }).writer({ element: 'dept' }),
        '/root/departments/dept'
      );

      const result = await schema.parse(xml);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Sales');
      expect(result[0].head.name).toBe('John Doe');
      expect(result[1].name).toBe('Engineering');
      expect(result[1].head.level).toBe('Principal');
    });

    it('should handle triple-nested arrays', () => {
      const xml = `
        <root>
          <level1>
            <l1-item>
              <level2>
                <l2-item>
                  <level3>
                    <l3-item>Deep1</l3-item>
                    <l3-item>Deep2</l3-item>
                  </level3>
                </l2-item>
              </level2>
            </l1-item>
          </level1>
        </root>
      `;

      const schema = x.array(
        x.object({
          level2: x.array(
            x.object({
              level3: x.array(
                x.string().writer({ element: 'l3-item' }),
                './level3/l3-item'
              )
            }).writer({ element: 'l2-item' }),
            './level2/l2-item'
          )
        }).writer({ element: 'l1-item' }),
        '/root/level1/l1-item'
      );

      const result = schema.parseSync(xml);
      expect(result).toHaveLength(1);
      expect(result[0].level2).toHaveLength(1);
      expect(result[0].level2[0].level3).toEqual(['Deep1', 'Deep2']);
    });

    it('should correctly track depth when parsing mixed nested structures', async () => {
      const xml = `
        <root>
          <container>
            <item>
              <type>A</type>
              <nested>
                <value>1</value>
              </nested>
            </item>
            <item>
              <type>B</type>
              <nested>
                <value>2</value>
              </nested>
            </item>
          </container>
        </root>
      `;

      const schema = x.array(
        x.object({
          type: x.string().xpath('./type'),
          nested: x.object({
            value: x.number().xpath('./value')
          }).xpath('./nested')
        }).writer({ element: 'item' }),
        '/root/container/item'
      );

      const result = await schema.parse(xml);
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('A');
      expect(result[0].nested.value).toBe(1);
      expect(result[1].type).toBe('B');
      expect(result[1].nested.value).toBe(2);
    });
  });

  describe('parseObjectFromPosition - comprehensive coverage', () => {
    it('should handle 7+ levels of nested objects', () => {
      const xml = `
        <root>
          <l1>
            <l2>
              <l3>
                <l4>
                  <l5>
                    <l6>
                      <l7>
                        <value>deep-nested</value>
                      </l7>
                    </l6>
                  </l5>
                </l4>
              </l3>
            </l2>
          </l1>
        </root>
      `;

      const schema = x.object({
        l1: x.object({
          l2: x.object({
            l3: x.object({
              l4: x.object({
                l5: x.object({
                  l6: x.object({
                    l7: x.object({
                      value: x.string().xpath('./value')
                    }).xpath('./l7')
                  }).xpath('./l6')
                }).xpath('./l5')
              }).xpath('./l4')
            }).xpath('./l3')
          }).xpath('./l2')
        }).xpath('/root/l1')
      });

      const result = schema.parseSync(xml);
      expect(result.l1.l2.l3.l4.l5.l6.l7.value).toBe('deep-nested');
    });

    it('should maintain collector state across nested object parsing (async)', async () => {
      const xml = `
        <root>
          <config>
            <database>
              <host>localhost</host>
              <port>5432</port>
              <credentials>
                <user>admin</user>
                <pass>secret</pass>
              </credentials>
            </database>
            <cache>
              <enabled>true</enabled>
            </cache>
          </config>
        </root>
      `;

      const schema = x.object({
        config: x.object({
          database: x.object({
            host: x.string().xpath('./host'),
            port: x.number().xpath('./port'),
            credentials: x.object({
              user: x.string().xpath('./user'),
              pass: x.string().xpath('./pass')
            }).xpath('./credentials')
          }).xpath('./database'),
          cache: x.object({
            enabled: x.string().xpath('./enabled')
          }).xpath('./cache')
        }).xpath('/root/config')
      });

      const result = await schema.parse(xml);
      expect(result.config.database.host).toBe('localhost');
      expect(result.config.database.port).toBe(5432);
      expect(result.config.database.credentials.user).toBe('admin');
      expect(result.config.database.credentials.pass).toBe('secret');
      expect(result.config.cache.enabled).toBe('true');
    });

    it('should handle object with mixed optional and required fields in nested context', () => {
      const xml = `
        <root>
          <person>
            <name>Alice</name>
            <contact>
              <email>alice@example.com</email>
              <!-- phone is optional and missing -->
            </contact>
          </person>
        </root>
      `;

      const schema = x.object({
        person: x.object({
          name: x.string().xpath('./name'),
          contact: x.object({
            email: x.string().xpath('./email'),
            phone: x.string().xpath('./phone').optional()
          }).xpath('./contact')
        }).xpath('/root/person')
      });

      const result = schema.parseSync(xml);
      expect(result.person.name).toBe('Alice');
      expect(result.person.contact.email).toBe('alice@example.com');
      expect(result.person.contact.phone).toBeUndefined();
    });
  });

  describe('isComplexSchema coverage', () => {
    it('should identify object schema as complex requiring position-based parsing', () => {
      const xml = `
        <root>
          <items>
            <item>
              <id>1</id>
              <data>content</data>
            </item>
          </items>
        </root>
      `;

      // Object schema is complex
      const schema = x.array(
        x.object({
          id: x.number().xpath('./id'),
          data: x.string().xpath('./data')
        }).writer({ element: 'item' }),
        '/root/items/item'
      );

      const result = schema.parseSync(xml);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].data).toBe('content');
    });

    it('should handle wrapped complex schema (optional wrapping object)', async () => {
      const xml = `
        <root>
          <items>
            <item>
              <name>First</name>
            </item>
            <item>
              <name>Second</name>
            </item>
          </items>
        </root>
      `;

      const schema = x.array(
        x.object({
          name: x.string().xpath('./name')
        })
          .writer({ element: 'item' })
          .optional(),
        '/root/items/item'
      );

      const result = await schema.parse(xml);
      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('First');
      expect(result[1]?.name).toBe('Second');
    });
  });

  describe('Depth tracking edge cases', () => {
    it('should handle rapid depth changes in nested structures', () => {
      const xml = `
        <root>
          <a>
            <b>
              <c>deep</c>
            </b>
            <d>shallow</d>
            <e>
              <f>medium</f>
            </e>
          </a>
        </root>
      `;

      const schema = x.object({
        a: x.object({
          b: x.object({
            c: x.string().xpath('./c')
          }).xpath('./b'),
          d: x.string().xpath('./d'),
          e: x.object({
            f: x.string().xpath('./f')
          }).xpath('./e')
        }).xpath('/root/a')
      });

      const result = schema.parseSync(xml);
      expect(result.a.b.c).toBe('deep');
      expect(result.a.d).toBe('shallow');
      expect(result.a.e.f).toBe('medium');
    });

    it('should handle sibling elements at same depth in arrays', async () => {
      const xml = `
        <root>
          <list>
            <item>A</item>
            <item>B</item>
            <item>C</item>
            <item>D</item>
          </list>
        </root>
      `;

      const schema = x.array(
        x.string().writer({ element: 'item' }),
        '/root/list/item'
      );

      const result = await schema.parse(xml);
      expect(result).toEqual(['A', 'B', 'C', 'D']);
    });
  });
});
