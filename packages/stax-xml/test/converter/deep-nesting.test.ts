import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

describe('Deep Nesting Tests', () => {
  describe('10+ Depth Level Tests', () => {
    it('should parse XML with 10 levels of nesting', () => {
      const xml = `
        <level1>
          <level2>
            <level3>
              <level4>
                <level5>
                  <level6>
                    <level7>
                      <level8>
                        <level9>
                          <level10>
                            <value>Deep Value</value>
                          </level10>
                        </level9>
                      </level8>
                    </level7>
                  </level6>
                </level5>
              </level4>
            </level3>
          </level2>
        </level1>
      `;

      const schema = x.string().xpath('//level10/value');
      const result = schema.parseSync(xml);
      expect(result).toBe('Deep Value');
    });

    it('should parse XML with 15 levels of nesting', () => {
      const levels = 15;
      let xml = '';
      let closing = '';

      for (let i = 1; i <= levels; i++) {
        xml += `<level${i}>`;
        closing = `</level${i}>` + closing;
      }
      xml += '<data>Level 15 Data</data>' + closing;

      const schema = x.string().xpath('//data');
      const result = schema.parseSync(xml);
      expect(result).toBe('Level 15 Data');
    });

    it('should parse complex object through 12 levels of nesting', () => {
      const xml = `
        <root>
          <company>
            <department>
              <team>
                <project>
                  <sprint>
                    <task>
                      <subtask>
                        <assignment>
                          <details>
                            <metadata>
                              <info>
                                <id>12345</id>
                                <name>Deep Task</name>
                                <priority>high</priority>
                              </info>
                            </metadata>
                          </details>
                        </assignment>
                      </subtask>
                    </task>
                  </sprint>
                </project>
              </team>
            </department>
          </company>
        </root>
      `;

      const schema = x.object({
        id: x.number().xpath('//info/id').int(),
        name: x.string().xpath('//info/name'),
        priority: x.string().xpath('//info/priority')
      });

      const result = schema.parseSync(xml);
      expect(result.id).toBe(12345);
      expect(result.name).toBe('Deep Task');
      expect(result.priority).toBe('high');
    });

    it('should handle 20+ levels with attributes', () => {
      let xml = '';
      let closing = '';
      const depth = 20;

      for (let i = 1; i <= depth; i++) {
        xml += `<node level="${i}" type="container">`;
        closing = `</node>` + closing;
      }
      xml += `<leaf id="deep-leaf">Final Value</leaf>` + closing;

      const schema = x.object({
        value: x.string().xpath('//leaf'),
        leafId: x.string().xpath('//leaf/@id'),
        level10Type: x.string().xpath('//node[@level="10"]/@type')
      });

      const result = schema.parseSync(xml);
      expect(result.value).toBe('Final Value');
      expect(result.leafId).toBe('deep-leaf');
      expect(result.level10Type).toBe('container');
    });
  });

  describe('Recursive Structure Tests', () => {
    it('should parse recursive tree structure', () => {
      const xml = `
        <tree>
          <node id="1">
            <value>Root</value>
            <children>
              <node id="2">
                <value>Child 1</value>
                <children>
                  <node id="3">
                    <value>Grandchild 1</value>
                    <children>
                      <node id="4">
                        <value>Great Grandchild</value>
                      </node>
                    </children>
                  </node>
                </children>
              </node>
              <node id="5">
                <value>Child 2</value>
              </node>
            </children>
          </node>
        </tree>
      `;

      const schema = x.array(
        x.object({
          id: x.string().xpath('./@id'),
          value: x.string().xpath('./value')
        }),
        '//node'
      );

      const result = schema.parseSync(xml);
      expect(result).toHaveLength(5);
      expect(result[0].value).toBe('Root');
      expect(result[3].value).toBe('Great Grandchild');
    });

    it('should handle circular-like references in XML', () => {
      const xml = `
        <graph>
          <nodes>
            <node id="A">
              <name>Node A</name>
              <connections>B,C</connections>
            </node>
            <node id="B">
              <name>Node B</name>
              <connections>A,C,D</connections>
            </node>
            <node id="C">
              <name>Node C</name>
              <connections>A,B</connections>
            </node>
            <node id="D">
              <name>Node D</name>
              <connections>B</connections>
            </node>
          </nodes>
        </graph>
      `;

      const nodeSchema = x.object({
        id: x.string().xpath('./@id'),
        name: x.string().xpath('./name'),
        connections: x.string().xpath('./connections').transform(str => str.split(','))
      });

      const schema = x.array(nodeSchema, '//node');
      const result = schema.parseSync(xml);

      expect(result).toHaveLength(4);
      expect(result[0].connections).toEqual(['B', 'C']);
      expect(result[1].connections).toEqual(['A', 'C', 'D']);
    });
  });

  describe('Deep Nesting with Arrays', () => {
    it('should parse deeply nested arrays', () => {
      const xml = `
        <catalog>
          <categories>
            <category name="Electronics">
              <subcategories>
                <subcategory name="Computers">
                  <products>
                    <product>
                      <variants>
                        <variant>
                          <options>
                            <option>
                              <values>
                                <value>Option 1</value>
                                <value>Option 2</value>
                              </values>
                            </option>
                          </options>
                        </variant>
                      </variants>
                    </product>
                  </products>
                </subcategory>
              </subcategories>
            </category>
          </categories>
        </catalog>
      `;

      const schema = x.array(x.string(), '//values/value');
      const result = schema.parseSync(xml);

      expect(result).toEqual(['Option 1', 'Option 2']);
    });

    it('should handle nested arrays at different levels', () => {
      const xml = `
        <data>
          <level1>
            <items>
              <item>L1-1</item>
              <item>L1-2</item>
            </items>
            <level2>
              <items>
                <item>L2-1</item>
                <item>L2-2</item>
              </items>
              <level3>
                <items>
                  <item>L3-1</item>
                  <item>L3-2</item>
                </items>
              </level3>
            </level2>
          </level1>
        </data>
      `;

      const schema = x.object({
        level1Items: x.array(x.string(), '/data/level1/items/item'),
        level2Items: x.array(x.string(), '/data/level1/level2/items/item'),
        level3Items: x.array(x.string(), '/data/level1/level2/level3/items/item')
      });

      const result = schema.parseSync(xml);
      expect(result.level1Items).toEqual(['L1-1', 'L1-2']);
      expect(result.level2Items).toEqual(['L2-1', 'L2-2']);
      expect(result.level3Items).toEqual(['L3-1', 'L3-2']);
    });
  });

  describe('Performance with Deep Nesting', () => {
    it('should handle 50 levels efficiently', () => {
      const levels = 50;
      let xml = '';
      let closing = '';

      for (let i = 1; i <= levels; i++) {
        xml += `<l${i} d="${i}">`;
        closing = `</l${i}>` + closing;
      }
      xml += '<v>Deep</v>' + closing;

      const start = performance.now();
      const schema = x.string().xpath('//v');
      const result = schema.parseSync(xml);
      const duration = performance.now() - start;

      expect(result).toBe('Deep');
      expect(duration).toBeLessThan(100); // Should parse in less than 100ms
    });

    it('should parse 100 levels with async', async () => {
      const levels = 100;
      let xml = '<root>';
      let closing = '</root>';

      for (let i = 1; i <= levels; i++) {
        xml += `<n${i}>`;
        closing = `</n${i}>` + closing;
      }
      xml += `<final>Level ${levels}</final>` + closing;

      const schema = x.string().xpath('//final');
      const result = await schema.parse(xml);

      expect(result).toBe(`Level ${levels}`);
    });
  });

  describe('Complex XPath through Deep Structures', () => {
    it('should navigate with complex XPath predicates', () => {
      const xml = `
        <root>
          <level1 type="A">
            <level2 type="B">
              <level3 type="C">
                <item>Wrong</item>
              </level3>
            </level2>
          </level1>
          <level1 type="X">
            <level2 type="Y">
              <level3 type="Z">
                <item>Correct</item>
              </level3>
            </level2>
          </level1>
        </root>
      `;

      const schema = x.string().xpath('//level1[@type="X"]/level2[@type="Y"]/level3[@type="Z"]/item');
      const result = schema.parseSync(xml);

      expect(result).toBe('Correct');
    });

    it('should handle position predicates in deep structures', () => {
      const xml = `
        <root>
          <container>
            <group>
              <subgroup>
                <items>
                  <item>First</item>
                  <item>Second</item>
                  <item>Third</item>
                </items>
              </subgroup>
            </group>
          </container>
        </root>
      `;

      const schema = x.object({
        first: x.string().xpath('//items/item[1]'),
        second: x.string().xpath('//items/item[2]'),
        last: x.string().xpath('//items/item[last()]')
      });

      const result = schema.parseSync(xml);
      expect(result.first).toBe('First');
      expect(result.second).toBe('Second');
      expect(result.last).toBe('Third');
    });
  });

  describe('Memory and Resource Tests', () => {
    it('should handle wide and deep structures', () => {
      let xml = '<root>';

      // Create 10 levels deep with 10 siblings at each level
      function createLevel(depth: number, maxDepth: number): string {
        if (depth > maxDepth) return '';

        let level = '';
        for (let i = 0; i < 10; i++) {
          level += `<node level="${depth}" index="${i}">`;
          if (depth === maxDepth) {
            level += `<value>${depth}-${i}</value>`;
          } else {
            level += createLevel(depth + 1, maxDepth);
          }
          level += '</node>';
        }
        return level;
      }

      xml += createLevel(1, 5) + '</root>';

      const schema = x.array(
        x.object({
          level: x.string().xpath('./@level'),
          index: x.string().xpath('./@index'),
          value: x.string().xpath('./value').optional()
        }),
        '//node'
      );

      const result = schema.parseSync(xml);
      expect(result.length).toBeGreaterThan(0);

      // Find all leaf nodes (level 5)
      const leafNodes = result.filter(n => n.level === '5');
      expect(leafNodes).toHaveLength(10000); // 10^4 leaf nodes
    });

    it('should parse deeply nested mixed content', () => {
      const xml = `
        <document>
          <chapter num="1">
            <section num="1.1">
              <subsection num="1.1.1">
                <paragraph>
                  <sentence>
                    <clause>
                      <phrase>
                        <word pos="noun">Test</word>
                        <word pos="verb">is</word>
                        <word pos="adjective">deep</word>
                      </phrase>
                    </clause>
                  </sentence>
                </paragraph>
              </subsection>
            </section>
          </chapter>
        </document>
      `;

      const schema = x.object({
        words: x.array(x.string(), '//word'),
        nouns: x.array(x.string(), '//word[@pos="noun"]'),
        verbs: x.array(x.string(), '//word[@pos="verb"]'),
        sectionNumber: x.string().xpath('//section/@num')
      });

      const result = schema.parseSync(xml);
      expect(result.words).toEqual(['Test', 'is', 'deep']);
      expect(result.nouns).toEqual(['Test']);
      expect(result.verbs).toEqual(['is']);
      expect(result.sectionNumber).toBe('1.1');
    });
  });

  describe('Edge Cases with Deep Nesting', () => {
    it('should handle empty nodes at various depths', () => {
      const xml = `
        <root>
          <level1>
            <level2></level2>
            <level2>
              <level3/>
              <level3>
                <level4>Value</level4>
              </level3>
            </level2>
          </level1>
        </root>
      `;

      const schema = x.object({
        empty2: x.string().xpath('/root/level1/level2[1]'),
        empty3: x.string().xpath('//level3[1]'),
        value4: x.string().xpath('//level4')
      });

      const result = schema.parseSync(xml);
      expect(result.empty2).toBe('');
      expect(result.empty3).toBe('');
      expect(result.value4).toBe('Value');
    });

    it('should handle CDATA in deeply nested structures', () => {
      const xml = `
        <root>
          <l1>
            <l2>
              <l3>
                <l4>
                  <l5>
                    <l6>
                      <l7>
                        <l8>
                          <l9>
                            <l10>
                              <data><![CDATA[<special>Deep CDATA Content</special>]]></data>
                            </l10>
                          </l9>
                        </l8>
                      </l7>
                    </l6>
                  </l5>
                </l4>
              </l3>
            </l2>
          </l1>
        </root>
      `;

      const schema = x.string().xpath('//data');
      const result = schema.parseSync(xml);

      expect(result).toBe('<special>Deep CDATA Content</special>');
    });

    it('should handle namespaces in deep structures', () => {
      const xml = `
        <root xmlns:a="http://a.com" xmlns:b="http://b.com">
          <a:level1>
            <b:level2>
              <a:level3>
                <b:level4>
                  <a:level5>
                    <b:level6>
                      <a:data>Namespaced Deep Value</a:data>
                    </b:level6>
                  </a:level5>
                </b:level4>
              </a:level3>
            </b:level2>
          </a:level1>
        </root>
      `;

      const schema = x.string().xpath('//a:data');
      const result = schema.parseSync(xml);

      expect(result).toBe('Namespaced Deep Value');
    });
  });
});