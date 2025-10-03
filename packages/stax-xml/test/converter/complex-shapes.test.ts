import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

describe('Complex Shapes Tests', () => {
  describe('Mixed Content Structures', () => {
    it('should parse mixed text and element content', () => {
      const xml = `
        <article>
          This is some text
          <bold>with bold</bold>
          and more text
          <italic>with italic</italic>
          and final text.
        </article>
      `;

      const schema = x.object({
        fullText: x.string().xpath('//article'),
        bold: x.string().xpath('//bold'),
        italic: x.string().xpath('//italic')
      });

      const result = schema.parseSync(xml);
      expect(result.fullText).toContain('This is some text');
      expect(result.fullText).toContain('with bold');
      expect(result.bold).toBe('with bold');
      expect(result.italic).toBe('with italic');
    });

    it('should handle complex mixed content with nested elements', () => {
      const xml = `
        <document>
          <paragraph>
            Start of paragraph with <strong>strong text</strong> and
            <em>emphasized text with <code>inline code</code></em> inside.
            <list>
              <item>Item 1</item>
              <item>Item 2 with text</item>
            </list>
            End of paragraph.
          </paragraph>
        </document>
      `;

      const schema = x.object({
        paragraphText: x.string().xpath('//paragraph'),
        strong: x.string().xpath('//strong'),
        emphasized: x.string().xpath('//em'),
        code: x.string().xpath('//code'),
        listItems: x.array(x.string(), '//item')
      });

      const result = schema.parseSync(xml);
      expect(result.strong).toBe('strong text');
      expect(result.code).toBe('inline code');
      expect(result.listItems).toEqual(['Item 1', 'Item 2 with text']);
    });
  });

  describe('Polymorphic Structures', () => {
    it('should handle different element types in same list', () => {
      const xml = `
        <shapes>
          <circle>
            <radius>10</radius>
          </circle>
          <rectangle>
            <width>20</width>
            <height>30</height>
          </rectangle>
          <polygon>
            <sides>5</sides>
          </polygon>
        </shapes>
      `;

      const circleSchema = x.object({
        radius: x.number().xpath('/shapes/circle/radius')
      });

      const rectangleSchema = x.object({
        width: x.number().xpath('/shapes/rectangle/width'),
        height: x.number().xpath('/shapes/rectangle/height')
      });

      const polygonSchema = x.object({
        sides: x.number().xpath('/shapes/polygon/sides')
      });

      const circle = circleSchema.parseSync(xml);
      const rectangle = rectangleSchema.parseSync(xml);
      const polygon = polygonSchema.parseSync(xml);

      expect(circle.radius).toBe(10);
      expect(rectangle.width).toBe(20);
      expect(rectangle.height).toBe(30);
      expect(polygon.sides).toBe(5);
    });

    it('should parse conditional structures', () => {
      const xml = `
        <responses>
          <success>
            <data>
              <id>123</id>
              <value>Success Value</value>
            </data>
          </success>
          <error>
            <code>404</code>
            <message>Not Found</message>
          </error>
          <pending>
            <estimatedTime>300</estimatedTime>
            <retryAfter>60</retryAfter>
          </pending>
        </responses>
      `;

      const schema = x.object({
        successId: x.number().xpath('/responses/success/data/id'),
        successValue: x.string().xpath('/responses/success/data/value'),
        errorCode: x.number().xpath('/responses/error/code'),
        errorMessage: x.string().xpath('/responses/error/message'),
        estimatedTime: x.number().xpath('/responses/pending/estimatedTime'),
        retryAfter: x.number().xpath('/responses/pending/retryAfter')
      });

      const result = schema.parseSync(xml);

      expect(result.successId).toBe(123);
      expect(result.successValue).toBe('Success Value');
      expect(result.errorCode).toBe(404);
      expect(result.errorMessage).toBe('Not Found');
      expect(result.estimatedTime).toBe(300);
      expect(result.retryAfter).toBe(60);
    });
  });

  describe('Irregular Tree Structures', () => {
    it('should handle asymmetric tree structures', () => {
      const xml = `
        <tree>
          <node id="1">
            <value>Root</value>
            <children>
              <node id="2">
                <value>Child</value>
              </node>
            </children>
          </node>
        </tree>
      `;

      const nodeValues = x.array(x.string(), '//node/value');
      const result = nodeValues.parseSync(xml);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe('Root');
      expect(result[1]).toBe('Child');
    });

    it('should parse jagged arrays', () => {
      const xml = `
        <matrix>
          <row>
            <col>1</col>
            <col>2</col>
            <col>3</col>
          </row>
          <row>
            <col>4</col>
            <col>5</col>
          </row>
          <row>
            <col>6</col>
            <col>7</col>
            <col>8</col>
            <col>9</col>
          </row>
          <row>
            <col>10</col>
          </row>
        </matrix>
      `;

      const rowSchema = x.array(x.number(), './col');
      const schema = x.array(rowSchema, '/matrix/row').transform(matrix => ({
        rows: matrix,
        rowCount: matrix.length,
        maxCol: matrix.map(sub => Math.max(...sub)).reduce((max, cur) => Math.max(max, cur)),
        minCol: matrix.map(sub => Math.min(...sub)).reduce((max, cur) => Math.min(max, cur)),
        totalElements: matrix.reduce((sum, row) => sum + row.length, 0)
      }));

      const result = schema.parseSync(xml);
      expect(result.rowCount).toBe(4);
      expect(result.maxCol).toBe(10);
      expect(result.minCol).toBe(1);
      expect(result.totalElements).toBe(10);
      expect(result.rows[2]).toEqual([6, 7, 8, 9]);
    });
  });

  describe('Self-Referential and Recursive', () => {
    it('should handle menu structures', () => {
      const xml = `
        <menu>
          <item name="File">
            <submenu>
              <item name="New"/>
              <item name="Open"/>
              <item name="Save"/>
            </submenu>
          </item>
          <item name="Edit">
            <submenu>
              <item name="Cut"/>
              <item name="Copy"/>
              <item name="Paste"/>
            </submenu>
          </item>
        </menu>
      `;
      const subMenuSchema = x.array(x.object({
        name: x.string().xpath("./@name")
      }), "./submenu/item")
      const itemArraySchema = x.array(x.object({
        name: x.string().xpath("./@name"),
        submenus: subMenuSchema
      }), "/menu/item")
      const result = itemArraySchema.parseSync(xml);

      expect(result.length).toBeGreaterThan(0);
      const fileItem = result.find(item => item.name === 'File');
      const editItem = result.find(item => item.name === 'Edit');
      expect(fileItem).toBeDefined();
      expect(editItem).toBeDefined();
    });

    it('should parse graph-like structures with references', () => {
      const xml = `
        <graph>
          <nodes>
            <node id="A" label="Node A"/>
            <node id="B" label="Node B"/>
            <node id="C" label="Node C"/>
            <node id="D" label="Node D"/>
          </nodes>
          <edges>
            <edge from="A" to="B" weight="5"/>
            <edge from="A" to="C" weight="3"/>
            <edge from="B" to="C" weight="2"/>
            <edge from="B" to="D" weight="4"/>
            <edge from="C" to="D" weight="1"/>
          </edges>
        </graph>
      `;

      const schema = x.object({
        nodes: x.array(
          x.object({
            id: x.string().xpath('./@id'),
            label: x.string().xpath('./@label')
          }),
          '//node'
        ),
        edges: x.array(
          x.object({
            from: x.string().xpath('./@from'),
            to: x.string().xpath('./@to'),
            weight: x.number().xpath('./@weight')
          }),
          '//edge'
        )
      }).transform(graph => ({
        ...graph,
        adjacencyList: graph.edges.reduce((acc, edge) => {
          if (!acc[edge.from]) acc[edge.from] = [];
          acc[edge.from].push({ to: edge.to, weight: edge.weight });
          return acc;
        }, {} as Record<string, Array<{ to: string; weight: number }>>)
      }));

      const result = schema.parseSync(xml);

      expect(result.nodes).toHaveLength(4);
      expect(result.edges).toHaveLength(5);
      expect(result.adjacencyList['A']).toHaveLength(2);
      expect(result.adjacencyList['B']).toHaveLength(2);
    });
  });

  describe('Dynamic and Variable Structures', () => {
    it('should handle dynamic field names', () => {
      const xml = `
        <config>
          <setting key="timeout" value="30"/>
          <setting key="retries" value="3"/>
          <setting key="debug" value="true"/>
          <setting key="endpoint" value="https://api.example.com"/>
        </config>
      `;

      const settingSchema = x.object({
        key: x.string().xpath('./@key'),
        value: x.string().xpath('./@value')
      });

      const schema = x.array(settingSchema, '//setting').transform(settings =>
        settings.reduce((config, setting) => {
          config[setting.key] = setting.value;
          return config;
        }, {} as Record<string, string>)
      );

      const result = schema.parseSync(xml);

      expect(result.timeout).toBe('30');
      expect(result.retries).toBe('3');
      expect(result.debug).toBe('true');
      expect(result.endpoint).toBe('https://api.example.com');
    });

    it('should parse flexible schema documents', () => {
      const xml = `
        <document version="2.0">
          <metadata>
            <field name="author" type="string">John Doe</field>
            <field name="created" type="date">2024-01-01</field>
            <field name="pages" type="number">150</field>
          </metadata>
          <content format="markdown">
            # Title
            This is the content
          </content>
        </document>
      `;
      const fieldSchema = x.object({
        name: x.string().xpath('./@name'),
        type: x.string().xpath('./@type'),
        value: x.string().xpath('./text()')
      }).transform(field => {
        let value: string | number = field.value;
        if (field.type === 'number' && !isNaN(Number(field.value))) {
          value = parseInt(field.value)
        }
        return { name: field.name, value: value }
      });

      const schema = x.object({
        version: x.string().xpath('/document/@version'),
        fields: x.array(fieldSchema, '/document/metadata/field'),
        contentFormat: x.string().xpath('//content/@format'),
        content: x.string().xpath('//content')
      });

      const result = schema.parseSync(xml);

      expect(result.version).toBe('2.0');
      expect(result.fields.find(v => v.name === "author")?.value).toBe("John Doe")
      expect(result.fields.find(v => v.name === "pages")?.value).toBe(150);
      expect(result.contentFormat).toBe('markdown');
    });
  });

  describe('Complex Nested Collections', () => {
    it('should parse nested data structures', () => {
      const xml = `
        <data>
          <users>
            <user id="john">
              <name>John</name>
              <age>30</age>
              <roles>
                <role>admin</role>
                <role>user</role>
              </roles>
            </user>
            <user id="jane">
              <name>Jane</name>
              <age>25</age>
              <roles>
                <role>user</role>
              </roles>
            </user>
          </users>
        </data>
      `;

      const userSchema = x.object({
        id: x.string().xpath('./@id'),
        name: x.string().xpath('./name'),
        age: x.number().xpath('./age').int(),
        roles: x.array(x.string(), './roles/role')
      });

      const schema = x.array(userSchema, '//user');
      const result = schema.parseSync(xml);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('John');
      expect(result[0].roles).toEqual(['admin', 'user']);
      expect(result[1].name).toBe('Jane');
      expect(result[1].roles).toEqual(['user']);
    });

    it('should handle complex product variants', () => {
      const xml = `
        <product>
          <name>T-Shirt</name>
          <variants>
            <variant sku="TS-S-RED">
              <size>S</size>
              <color>Red</color>
              <stock>10</stock>
            </variant>
            <variant sku="TS-M-BLUE">
              <size>M</size>
              <color>Blue</color>
              <stock>15</stock>
            </variant>
            <variant sku="TS-L-GREEN">
              <size>L</size>
              <color>Green</color>
              <stock>5</stock>
            </variant>
          </variants>
        </product>
      `;

      const variantSchema = x.object({
        sku: x.string().xpath('./@sku'),
        size: x.string().xpath('./size'),
        color: x.string().xpath('./color'),
        stock: x.number().xpath('./stock').int()
      });

      const schema = x.object({
        name: x.string().xpath('//name'),
        variants: x.array(variantSchema, '//variant'),
        totalStock: x.array(x.number(), '//stock').transform(stocks =>
          stocks.reduce((sum, stock) => sum + stock, 0)
        ),
        uniqueSizes: x.array(x.string(), '//size').transform(sizes =>
          [...new Set(sizes)]
        )
      });

      const result = schema.parseSync(xml);

      expect(result.name).toBe('T-Shirt');
      expect(result.variants).toHaveLength(3);
      expect(result.totalStock).toBe(30);
      expect(result.uniqueSizes).toEqual(['S', 'M', 'L']);
    });
  });

  describe('Conditional and Optional Structures', () => {
    it('should handle conditional elements', () => {
      const xml = `
        <orders>
          <order id="1" status="shipped">
            <items>3</items>
            <total>99.99</total>
            <shipping>
              <carrier>UPS</carrier>
              <tracking>1234567890</tracking>
            </shipping>
          </order>
          <order id="2" status="pending">
            <items>1</items>
            <total>29.99</total>
          </order>
        </orders>
      `;

      const orderSchema = x.object({
        id: x.string().xpath('./@id'),
        status: x.string().xpath('./@status'),
        items: x.number().xpath('./items').int(),
        total: x.number().xpath('./total'),
        carrier: x.string().xpath('./shipping/carrier').optional(),
        tracking: x.string().xpath('./shipping/tracking').optional()
      });

      const schema = x.array(orderSchema, '//order');
      const result = schema.parseSync(xml);

      expect(result).toHaveLength(2);
      expect(result[0].carrier).toBe('UPS');
      expect(result[0].tracking).toBe('1234567890');
      expect(result[1].carrier).toBeUndefined();
      expect(result[1].tracking).toBeUndefined();
    });
  });

  describe('Special Format Structures', () => {
    it('should parse table-like structures', () => {
      const xml = `
        <table>
          <headers>
            <header>Name</header>
            <header>Age</header>
            <header>City</header>
          </headers>
          <rows>
            <row>
              <cell>Alice</cell>
              <cell>30</cell>
              <cell>New York</cell>
            </row>
            <row>
              <cell>Bob</cell>
              <cell>25</cell>
              <cell>Los Angeles</cell>
            </row>
          </rows>
        </table>
      `;

      const schema = x.object({
        headers: x.array(x.string(), '//header'),
        rows: x.array(
          x.array(x.string(), './cell'),
          '//row'
        )
      }).transform(table => {
        const data = table.rows.map(row =>
          table.headers.reduce((obj, header, index) => {
            obj[header] = row[index];
            return obj;
          }, {} as Record<string, string>)
        );
        return { headers: table.headers, data };
      });

      const result = schema.parseSync(xml);

      expect(result.headers).toEqual(['Name', 'Age', 'City']);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({ Name: 'Alice', Age: '30', City: 'New York' });
    });
  });
});