import { describe, expect, it } from 'vitest';
import { EventReaderSync } from '../../src/EventReaderSync.js';
import { x } from '../../src/converter/index.js';
import { XmlParserInternal } from '../../src/converter/XmlParserInternal.js';
import {
  isEndElement,
  isStartElement,
  type AnyXmlEvent,
  type StartElementEvent
} from '../../src/types.js';

function eventsFromXml(xml: string): AnyXmlEvent[] {
  return Array.from(new EventReaderSync(xml));
}

function findStartPosition(
  events: AnyXmlEvent[],
  name: string,
  occurrence = 1
): { index: number; startEvent: StartElementEvent; depth: number } {
  let depth = 0;
  let matches = 0;

  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    if (isStartElement(event)) {
      depth++;
      if (event.name === name) {
        matches++;
        if (matches === occurrence) {
          return { index, startEvent: event, depth };
        }
      }
    } else if (isEndElement(event)) {
      depth--;
    }
  }

  throw new Error(`Could not find <${name}> start event`);
}

function syncIteratorFrom(events: AnyXmlEvent[], startIndex: number): Iterator<AnyXmlEvent> {
  let index = startIndex;
  return {
    next(): IteratorResult<AnyXmlEvent> {
      if (index >= events.length) {
        return { value: undefined, done: true };
      }
      return { value: events[index++], done: false };
    }
  };
}

async function* asyncIteratorFrom(events: AnyXmlEvent[], startIndex: number): AsyncGenerator<AnyXmlEvent> {
  for (let index = startIndex; index < events.length; index++) {
    yield events[index];
  }
}

describe('XmlParserInternal Position-Based Parsing Methods', () => {
  describe('parseArrayFromPosition - Attribute Selectors', () => {
    it('should filter array elements by attribute selector (sync)', () => {
      const xml = `
        <root>
          <items>
            <item type="a">10</item>
            <item type="b">20</item>
            <item type="a">30</item>
          </items>
        </root>
      `;

      const schema = x.object({
        values: x.array(
          x.number().writer({ element: 'item' }),
          '/root/items/item[@type="a"]'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.values).toEqual([10, 30]); // Only type="a" items
    });

    it('should filter array elements by attribute selector (async)', async () => {
      const xml = `
        <root>
          <products>
            <product category="electronics">999</product>
            <product category="books">19</product>
            <product category="electronics">599</product>
          </products>
        </root>
      `;

      const schema = x.object({
        electronicsPrices: x.array(
          x.number().writer({ element: 'product' }),
          '/root/products/product[@category="electronics"]'
        )
      });

      const result = await schema.parse(xml);
      expect(result.electronicsPrices).toEqual([999, 599]);
    });

    it('should handle attribute selector with no matches', () => {
      const xml = `
        <root>
          <items>
            <item type="x">A</item>
            <item type="y">B</item>
          </items>
        </root>
      `;

      const schema = x.object({
        filtered: x.array(
          x.string().writer({ element: 'item' }),
          '/root/items/item[@type="z"]'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.filtered).toEqual([]);
    });
  });

  describe('parseArrayFromPosition - Nested Complex Objects', () => {
    it('should parse nested array with deep object structures (sync)', () => {
      const xml = `
        <root>
          <departments>
            <dept>
              <name>Engineering</name>
              <employees>
                <emp>
                  <id>1</id>
                  <name>Alice</name>
                </emp>
                <emp>
                  <id>2</id>
                  <name>Bob</name>
                </emp>
              </employees>
            </dept>
          </departments>
        </root>
      `;

      const schema = x.array(
        x.object({
          name: x.string().xpath('./name'),
          employees: x.array(
            x.object({
              id: x.number().xpath('./id'),
              name: x.string().xpath('./name')
            }).writer({ element: 'emp' }),
            './employees/emp'
          )
        }).writer({ element: 'dept' }),
        '/root/departments/dept'
      );

      const result = schema.parseSync(xml);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Engineering');
      expect(result[0].employees).toHaveLength(2);
      expect(result[0].employees[0].name).toBe('Alice');
      expect(result[0].employees[1].id).toBe(2);
    });

    it('should parse nested array with deep object structures (async)', async () => {
      const xml = `
        <root>
          <teams>
            <team>
              <name>Alpha</name>
              <members>
                <member>
                  <role>Lead</role>
                  <email>lead@example.com</email>
                </member>
                <member>
                  <role>Dev</role>
                  <email>dev@example.com</email>
                </member>
              </members>
            </team>
            <team>
              <name>Beta</name>
              <members>
                <member>
                  <role>Manager</role>
                  <email>manager@example.com</email>
                </member>
              </members>
            </team>
          </teams>
        </root>
      `;

      const schema = x.array(
        x.object({
          name: x.string().xpath('./name'),
          members: x.array(
            x.object({
              role: x.string().xpath('./role'),
              email: x.string().xpath('./email')
            }).writer({ element: 'member' }),
            './members/member'
          )
        }).writer({ element: 'team' }),
        '/root/teams/team'
      );

      const result = await schema.parse(xml);
      expect(result).toHaveLength(2);
      expect(result[0].members).toHaveLength(2);
      expect(result[1].members).toHaveLength(1);
      expect(result[1].members[0].role).toBe('Manager');
    });
  });

  describe('parseArrayFromPosition - Relative vs Absolute XPath', () => {
    it('should correctly handle relative XPath in nested array schemas', () => {
      const xml = `
        <root>
          <section>
            <items>
              <item>A</item>
              <item>B</item>
            </items>
          </section>
        </root>
      `;

      const schema = x.object({
        section: x.object({
          items: x.array(
            x.string().writer({ element: 'item' }),
            './items/item' // Relative to section
          )
        }).xpath('/root/section')
      });

      const result = schema.parseSync(xml);
      expect(result.section.items).toEqual(['A', 'B']);
    });

    it('should correctly handle absolute XPath in nested context', async () => {
      const xml = `
        <root>
          <container>
            <data>
              <value>1</value>
            </data>
            <data>
              <value>2</value>
            </data>
          </container>
        </root>
      `;

      const schema = x.object({
        values: x.array(
          x.number().xpath('./value'),
          '/root/container/data' // Absolute path
        )
      });

      const result = await schema.parse(xml);
      expect(result.values).toEqual([1, 2]);
    });

    it('should handle dot (.) as current context in XPath', () => {
      const xml = `
        <root>
          <wrapper>
            <child>Content1</child>
            <child>Content2</child>
          </wrapper>
        </root>
      `;

      const schema = x.object({
        wrapper: x.object({
          children: x.array(
            x.string().writer({ element: 'child' }),
            './child'
          )
        }).xpath('/root/wrapper')
      });

      const result = schema.parseSync(xml);
      expect(result.wrapper.children).toEqual(['Content1', 'Content2']);
    });
  });

  describe('parseObjectFromPosition - State Machine Integration', () => {
    it('should handle pre-populated collectors from state machine (sync)', () => {
      const xml = `
        <root>
          <parent>
            <child1>value1</child1>
            <child2>value2</child2>
          </parent>
        </root>
      `;

      const schema = x.object({
        parent: x.object({
          child1: x.string().xpath('./child1'),
          child2: x.string().xpath('./child2')
        }).xpath('/root/parent')
      });

      const result = schema.parseSync(xml);
      expect(result.parent.child1).toBe('value1');
      expect(result.parent.child2).toBe('value2');
    });

    it('should handle pre-populated collectors from state machine (async)', async () => {
      const xml = `
        <root>
          <config>
            <setting1>enabled</setting1>
            <setting2>disabled</setting2>
            <setting3>auto</setting3>
          </config>
        </root>
      `;

      const schema = x.object({
        config: x.object({
          setting1: x.string().xpath('./setting1'),
          setting2: x.string().xpath('./setting2'),
          setting3: x.string().xpath('./setting3')
        }).xpath('/root/config')
      });

      const result = await schema.parse(xml);
      expect(result.config.setting1).toBe('enabled');
      expect(result.config.setting2).toBe('disabled');
      expect(result.config.setting3).toBe('auto');
    });
  });

  describe('parseObjectFromPosition - Parent Context XPath Resolution', () => {
    it('should resolve XPath correctly with parent context in deeply nested objects', () => {
      const xml = `
        <root>
          <level1>
            <level2>
              <level3>
                <field>deep value</field>
              </level3>
            </level2>
          </level1>
        </root>
      `;

      const schema = x.object({
        level1: x.object({
          level2: x.object({
            level3: x.object({
              field: x.string().xpath('./field')
            }).xpath('./level3')
          }).xpath('./level2')
        }).xpath('/root/level1')
      });

      const result = schema.parseSync(xml);
      expect(result.level1.level2.level3.field).toBe('deep value');
    });

    it('should maintain correct depth tracking in recursive object parsing (async)', async () => {
      const xml = `
        <root>
          <outer>
            <middle>
              <inner>
                <deepest>content</deepest>
              </inner>
            </middle>
          </outer>
        </root>
      `;

      const schema = x.object({
        outer: x.object({
          middle: x.object({
            inner: x.object({
              deepest: x.string().xpath('./deepest')
            }).xpath('./inner')
          }).xpath('./middle')
        }).xpath('/root/outer')
      });

      const result = await schema.parse(xml);
      expect(result.outer.middle.inner.deepest).toBe('content');
    });

    it('should handle 5+ levels of nesting with position-based parsing', () => {
      const xml = `
        <root>
          <l1>
            <l2>
              <l3>
                <l4>
                  <l5>
                    <target>nested content</target>
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
                  target: x.string().xpath('./target')
                }).xpath('./l5')
              }).xpath('./l4')
            }).xpath('./l3')
          }).xpath('./l2')
        }).xpath('/root/l1')
      });

      const result = schema.parseSync(xml);
      expect(result.l1.l2.l3.l4.l5.target).toBe('nested content');
    });
  });

  describe('parseArrayFromPosition - Element XPath Matching', () => {
    it('should use element schema XPath for matching within array', () => {
      const xml = `
        <root>
          <container>
            <data>
              <value>1</value>
            </data>
            <data>
              <value>2</value>
            </data>
          </container>
        </root>
      `;

      const schema = x.object({
        values: x.array(
          x.number().xpath('./value'),
          '/root/container/data'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.values).toEqual([1, 2]);
    });

    it('should handle complex element XPath matching (async)', async () => {
      const xml = `
        <root>
          <records>
            <record>
              <metadata>
                <id>1</id>
              </metadata>
            </record>
            <record>
              <metadata>
                <id>2</id>
              </metadata>
            </record>
          </records>
        </root>
      `;

      const schema = x.object({
        ids: x.array(
          x.number().xpath('./metadata/id'),
          '/root/records/record'
        )
      });

      const result = await schema.parse(xml);
      expect(result.ids).toEqual([1, 2]);
    });
  });

  describe('parseArrayFromPosition - Simple Schema Text Collection', () => {
    it('should collect text from simple schema elements', () => {
      const xml = `
        <root>
          <items>
            <item>First</item>
            <item>Second</item>
            <item>Third</item>
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
      expect(result.items).toEqual(['First', 'Second', 'Third']);
    });

    it('should collect and trim text from simple number schema (async)', async () => {
      const xml = `
        <root>
          <numbers>
            <num>  10  </num>
            <num>20</num>
            <num>  30</num>
          </numbers>
        </root>
      `;

      const schema = x.object({
        numbers: x.array(
          x.number().writer({ element: 'num' }),
          '/root/numbers/num'
        )
      });

      const result = await schema.parse(xml);
      expect(result.numbers).toEqual([10, 20, 30]);
    });
  });

  describe('parseObjectFromPosition - Depth Tracking', () => {
    it('should maintain correct depth when entering and exiting nested objects', () => {
      const xml = `
        <root>
          <a>
            <b>
              <c>value_c</c>
            </b>
            <d>value_d</d>
          </a>
        </root>
      `;

      const schema = x.object({
        a: x.object({
          b: x.object({
            c: x.string().xpath('./c')
          }).xpath('./b'),
          d: x.string().xpath('./d')
        }).xpath('/root/a')
      });

      const result = schema.parseSync(xml);
      expect(result.a.b.c).toBe('value_c');
      expect(result.a.d).toBe('value_d');
    });

    it('should track depth correctly with mixed nesting (async)', async () => {
      const xml = `
        <root>
          <parent>
            <child1>
              <grandchild>gc1</grandchild>
            </child1>
            <child2>c2</child2>
            <child3>
              <grandchild>gc3</grandchild>
            </child3>
          </parent>
        </root>
      `;

      const schema = x.object({
        parent: x.object({
          child1: x.object({
            grandchild: x.string().xpath('./grandchild')
          }).xpath('./child1'),
          child2: x.string().xpath('./child2'),
          child3: x.object({
            grandchild: x.string().xpath('./grandchild')
          }).xpath('./child3')
        }).xpath('/root/parent')
      });

      const result = await schema.parse(xml);
      expect(result.parent.child1.grandchild).toBe('gc1');
      expect(result.parent.child2).toBe('c2');
      expect(result.parent.child3.grandchild).toBe('gc3');
    });
  });

  describe('parseArrayFromPosition - Mixed Content and Depth', () => {
    it('should handle arrays with text at different depths', () => {
      const xml = `
        <root>
          <items>
            <item>
              Surface text
              <nested>Nested text</nested>
            </item>
            <item>
              Another surface
              <nested>Another nested</nested>
            </item>
          </items>
        </root>
      `;

      // collectTextUntilCloseSync collects all text including nested elements
      const schema = x.object({
        items: x.array(
          x.string().writer({ element: 'item' }),
          '/root/items/item'
        )
      });

      const result = schema.parseSync(xml);
      // Text collection includes nested element text content
      expect(result.items[0]).toContain('Surface text');
      expect(result.items[0]).toContain('Nested text');
    });

    it('should handle empty elements in array parsing', async () => {
      const xml = `
        <root>
          <list>
            <item></item>
            <item>content</item>
            <item></item>
          </list>
        </root>
      `;

      const schema = x.object({
        list: x.array(
          x.string().writer({ element: 'item' }),
          '/root/list/item'
        )
      });

      const result = await schema.parse(xml);
      expect(result.list).toEqual(['', 'content', '']);
    });
  });

  describe('parseObjectFromPosition - Empty and Missing Fields', () => {
    it('should handle objects with some fields missing', () => {
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

    it('should handle completely empty nested object (async)', async () => {
      const xml = `
        <root>
          <outer>
            <inner></inner>
          </outer>
        </root>
      `;

      const schema = x.object({
        outer: x.object({
          inner: x.object({
            value: x.string().xpath('./value').optional()
          }).xpath('./inner')
        }).xpath('/root/outer')
      });

      const result = await schema.parse(xml);
      expect(result.outer.inner.value).toBeUndefined();
    });
  });

  describe('parseArrayFromPosition - Recursive Position-Based Parsing', () => {
    it('should use recursive parsing for complex element schemas', () => {
      const xml = `
        <root>
          <collection>
            <item>
              <name>Item 1</name>
              <props>
                <prop>A</prop>
                <prop>B</prop>
              </props>
            </item>
            <item>
              <name>Item 2</name>
              <props>
                <prop>C</prop>
              </props>
            </item>
          </collection>
        </root>
      `;

      const schema = x.object({
        collection: x.array(
          x.object({
            name: x.string().xpath('./name'),
            props: x.array(
              x.string().writer({ element: 'prop' }),
              './props/prop'
            )
          }).writer({ element: 'item' }),
          '/root/collection/item'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.collection).toHaveLength(2);
      expect(result.collection[0].name).toBe('Item 1');
      expect(result.collection[0].props).toEqual(['A', 'B']);
      expect(result.collection[1].name).toBe('Item 2');
      expect(result.collection[1].props).toEqual(['C']);
    });

    it('should handle deeply nested recursive structures (async)', async () => {
      const xml = `
        <root>
          <nodes>
            <node>
              <id>1</id>
              <children>
                <node>
                  <id>2</id>
                  <value>leaf</value>
                </node>
              </children>
            </node>
          </nodes>
        </root>
      `;

      const nodeSchema: any = x.object({
        id: x.number().xpath('./id'),
        value: x.string().xpath('./value').optional(),
        children: x.array(
          x.object({
            id: x.number().xpath('./id'),
            value: x.string().xpath('./value').optional()
          }).writer({ element: 'node' }),
          './children/node'
        ).optional()
      }).writer({ element: 'node' });

      const schema = x.object({
        nodes: x.array(nodeSchema, '/root/nodes/node')
      });

      const result = await schema.parse(xml);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe(1);
      expect(result.nodes[0].children).toHaveLength(1);
      expect(result.nodes[0].children[0].id).toBe(2);
      expect(result.nodes[0].children[0].value).toBe('leaf');
    });
  });

  describe('parseArrayFromPosition - Text and Element Content', () => {
    it('should collect text content from array elements', () => {
      const xml = `
        <root>
          <items>
            <item id="1">Content 1</item>
            <item id="2">Content 2</item>
            <item id="3">Content 3</item>
          </items>
        </root>
      `;

      const schema = x.object({
        contents: x.array(
          x.string().writer({ element: 'item' }),
          '/root/items/item'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.contents).toEqual(['Content 1', 'Content 2', 'Content 3']);
    });

    it('should collect numeric text content (async)', async () => {
      const xml = `
        <root>
          <products>
            <product>99.99</product>
            <product>49.50</product>
            <product>199.00</product>
          </products>
        </root>
      `;

      const schema = x.object({
        prices: x.array(
          x.number().writer({ element: 'product' }),
          '/root/products/product'
        )
      });

      const result = await schema.parse(xml);
      expect(result.prices).toEqual([99.99, 49.5, 199]);
    });

    it('should handle mixed empty and non-empty elements', () => {
      const xml = `
        <root>
          <items>
            <item>First</item>
            <item></item>
            <item>Third</item>
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
      expect(result.items).toEqual(['First', '', 'Third']);
    });
  });

  describe('Edge Cases - Position-Based Parsing', () => {
    it('should handle very deep nesting (10+ levels)', async () => {
      const xml = `
        <root>
          <l1><l2><l3><l4><l5><l6><l7><l8><l9><l10>
            <value>deep</value>
          </l10></l9></l8></l7></l6></l5></l4></l3></l2></l1>
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
                      l8: x.object({
                        l9: x.object({
                          l10: x.object({
                            value: x.string().xpath('./value')
                          }).xpath('./l10')
                        }).xpath('./l9')
                      }).xpath('./l8')
                    }).xpath('./l7')
                  }).xpath('./l6')
                }).xpath('./l5')
              }).xpath('./l4')
            }).xpath('./l3')
          }).xpath('./l2')
        }).xpath('/root/l1')
      });

      const result = await schema.parse(xml);
      expect(result.l1.l2.l3.l4.l5.l6.l7.l8.l9.l10.value).toBe('deep');
    });

    it('should handle array with single element', () => {
      const xml = `
        <root>
          <items>
            <item>only one</item>
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
      expect(result.items).toEqual(['only one']);
      expect(result.items).toHaveLength(1);
    });

    it('should handle array with no matching elements', async () => {
      const xml = `
        <root>
          <items>
            <other>not an item</other>
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
      expect(result.items).toEqual([]);
    });
  });

  describe('Direct internal position parsing coverage', () => {
    it('parses number text from sync and async current-position iterators', async () => {
      const xml = '<root><value>4<![CDATA[2]]><nested>ignored</nested></value></root>';
      const events = eventsFromXml(xml);
      const position = findStartPosition(events, 'value');
      const schema = x.number().int();

      const syncResult = (schema as any)._parseFromPosition(
        syncIteratorFrom(events, position.index + 1),
        position.startEvent,
        position.depth
      );
      const asyncResult = await (schema as any)._parseFromPosition(
        asyncIteratorFrom(events, position.index + 1),
        position.startEvent,
        position.depth
      );

      expect(syncResult).toBe(42);
      expect(asyncResult).toBe(42);
    });

    it('parses string text from sync and async current-position iterators', async () => {
      const xml = '<root><value>left<![CDATA[-right]]><nested>ignored</nested></value></root>';
      const events = eventsFromXml(xml);
      const position = findStartPosition(events, 'value');
      const schema = x.string();

      const syncResult = (schema as any)._parseFromPosition(
        syncIteratorFrom(events, position.index + 1),
        position.startEvent,
        position.depth
      );
      const asyncResult = await (schema as any)._parseFromPosition(
        asyncIteratorFrom(events, position.index + 1),
        position.startEvent,
        position.depth
      );

      expect(syncResult).toBe('left-right');
      expect(asyncResult).toBe('left-right');
    });

    it('parses array item attributes directly from a sync position', () => {
      const xml = `
        <root>
          <section>
            <item code="a">ignored</item>
            <item code="b">ignored</item>
          </section>
        </root>
      `;
      const events = eventsFromXml(xml);
      const position = findStartPosition(events, 'section');
      const parser = new XmlParserInternal();

      const values = (parser as any).parseArrayFromPositionSync(
        syncIteratorFrom(events, position.index + 1),
        position.startEvent,
        1,
        x.string().xpath('./@code'),
        './item'
      );

      expect(values).toEqual(['a', 'b']);
    });

    it('parses array item attributes directly from an async position', async () => {
      const xml = `
        <root>
          <section>
            <line qty="2">ignored</line>
            <line qty="4">ignored</line>
          </section>
        </root>
      `;
      const events = eventsFromXml(xml);
      const position = findStartPosition(events, 'section');
      const parser = new XmlParserInternal();

      const values = await (parser as any).parseArrayFromPosition(
        asyncIteratorFrom(events, position.index + 1),
        position.startEvent,
        1,
        x.number().xpath('./@qty').int(),
        './line'
      );

      expect(values).toEqual([2, 4]);
    });

    it('parses object fields directly from sync and async positions', async () => {
      const xml = `
        <root>
          <book>
            <title>Streaming XML</title>
            <pages>320</pages>
          </book>
        </root>
      `;
      const events = eventsFromXml(xml);
      const position = findStartPosition(events, 'book');
      const parser = new XmlParserInternal();
      const shape = {
        title: x.string().xpath('./title'),
        pages: x.number().xpath('./pages').int()
      };

      const syncResult = (parser as any).parseObjectFromPositionSync(
        syncIteratorFrom(events, position.index + 1),
        position.startEvent,
        position.depth,
        shape,
        {}
      );
      const asyncResult = await (parser as any).parseObjectFromPosition(
        asyncIteratorFrom(events, position.index + 1),
        position.startEvent,
        position.depth,
        shape,
        {}
      );

      expect(syncResult).toEqual({ title: 'Streaming XML', pages: 320 });
      expect(asyncResult).toEqual({ title: 'Streaming XML', pages: 320 });
    });

    it('throws when direct array position parsing has no xpath', async () => {
      const events = eventsFromXml('<root><section><item>A</item></section></root>');
      const position = findStartPosition(events, 'section');
      const parser = new XmlParserInternal();

      expect(() => (parser as any).parseArrayFromPositionSync(
        syncIteratorFrom(events, position.index + 1),
        position.startEvent,
        position.depth,
        x.string()
      )).toThrow('Array schema requires xpath');

      await expect((parser as any).parseArrayFromPosition(
        asyncIteratorFrom(events, position.index + 1),
        position.startEvent,
        position.depth,
        x.string()
      )).rejects.toThrow('Array schema requires xpath');
    });
  });
});
