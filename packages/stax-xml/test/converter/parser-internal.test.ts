import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/converter/index.js';

describe('Parser Internal Complex Scenarios', () => {
  describe('Nested Schema Parsing Without XPath', () => {
    it('should parse object with nested object (no xpath on child)', () => {
      const xml = `
        <root>
          <outer>
            <inner>
              <value>test</value>
            </inner>
          </outer>
        </root>
      `;

      const schema = x.object({
        outer: x.object({
          inner: x.object({
            value: x.string().xpath('./value')
          }).xpath('./inner')
        }).xpath('/root/outer')
      });

      const result = schema.parseSync(xml);
      expect(result.outer.inner.value).toBe('test');
    });

    it('should parse object with array (no xpath on array)', () => {
      const xml = `
        <root>
          <container>
            <items>
              <item>A</item>
              <item>B</item>
            </items>
          </container>
        </root>
      `;

      const schema = x.object({
        container: x.object({
          items: x.array(
            x.string().writer({ element: 'item' }),
            './items/item'
          )
        }).xpath('/root/container')
      });

      const result = schema.parseSync(xml);
      expect(result.container.items).toEqual(['A', 'B']);
    });
  });

  describe('Sync Versions of Nested Parsing', () => {
    it('should use sync version of nested object parsing', () => {
      const xml = `
        <root>
          <data>
            <field1>value1</field1>
            <field2>value2</field2>
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
      expect(result.data.field1).toBe('value1');
      expect(result.data.field2).toBe('value2');
    });

    it('should use sync version of nested array parsing', () => {
      const xml = `
        <root>
          <numbers>
            <num>1</num>
            <num>2</num>
            <num>3</num>
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
      expect(result.numbers).toEqual([1, 2, 3]);
    });
  });

  describe('Parse Object From Position with Empty Collector', () => {
    it('should parse object from position (sync, empty collector)', () => {
      const xml = `
        <root>
          <entry>
            <key>name</key>
            <value>John</value>
          </entry>
        </root>
      `;

      const schema = x.object({
        entry: x.object({
          key: x.string().xpath('./key'),
          value: x.string().xpath('./value')
        }).xpath('/root/entry')
      });

      const result = schema.parseSync(xml);
      expect(result.entry.key).toBe('name');
      expect(result.entry.value).toBe('John');
    });

    it('should parse object from position (async, empty collector)', async () => {
      const xml = `
        <root>
          <record>
            <id>123</id>
            <status>active</status>
          </record>
        </root>
      `;

      const schema = x.object({
        record: x.object({
          id: x.number().xpath('./id'),
          status: x.string().xpath('./status')
        }).xpath('/root/record')
      });

      const result = await schema.parse(xml);
      expect(result.record.id).toBe(123);
      expect(result.record.status).toBe('active');
    });
  });

  describe('Build Result from Collector with Transforms', () => {
    it('should build result from collector with transforms', () => {
      const xml = `
        <root>
          <items>
            <item>hello</item>
            <item>world</item>
          </items>
        </root>
      `;

      const schema = x.object({
        items: x.array(
          x.string()
            .writer({ element: 'item' })
            .transform((val) => val.toUpperCase()),
          '/root/items/item'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.items).toEqual(['HELLO', 'WORLD']);
    });
  });

  describe('Create Collector for Unknown Schema Type', () => {
    it('should create collector for standard schema types', () => {
      const xml = `
        <root>
          <text>sample</text>
          <number>42</number>
          <items>
            <item>A</item>
          </items>
        </root>
      `;

      const schema = x.object({
        text: x.string().xpath('/root/text'),
        number: x.number().xpath('/root/number'),
        items: x.array(
          x.string().writer({ element: 'item' }),
          '/root/items/item'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.text).toBe('sample');
      expect(result.number).toBe(42);
      expect(result.items).toEqual(['A']);
    });
  });

  describe('String Parsing Without XPath', () => {
    it('should parse string without xpath from empty XML (sync)', () => {
      const xml = '<root></root>';
      const schema = x.string();

      const result = schema.parseSync(xml);
      expect(result).toBe('');
    });

    it('should parse string without xpath from whitespace-only XML (sync)', () => {
      const xml = '<root>   </root>';
      const schema = x.string();

      const result = schema.parseSync(xml);
      // Whitespace-only content returns first text found but auto-decoded
      expect(result).toBe('');
    });

    it('should parse string without xpath from normal text (sync)', () => {
      const xml = '<root>Hello World</root>';
      const schema = x.string();

      const result = schema.parseSync(xml);
      expect(result).toBe('Hello World');
    });

    it('should parse string without xpath from CDATA (sync)', () => {
      const xml = '<root><![CDATA[CDATA content]]></root>';
      const schema = x.string();

      const result = schema.parseSync(xml);
      expect(result).toBe('CDATA content');
    });

    it('should parse string without xpath from empty XML (async)', async () => {
      const xml = '<root></root>';
      const schema = x.string();

      const result = await schema.parse(xml);
      expect(result).toBe('');
    });

    it('should parse string without xpath from whitespace-only XML (async)', async () => {
      const xml = '<root>   </root>';
      const schema = x.string();

      const result = await schema.parse(xml);
      // Whitespace-only content returns first text found but auto-decoded
      expect(result).toBe('');
    });

    it('should parse string without xpath from normal text (async)', async () => {
      const xml = '<root>Hello Async</root>';
      const schema = x.string();

      const result = await schema.parse(xml);
      expect(result).toBe('Hello Async');
    });

    it('should parse string without xpath from CDATA (async)', async () => {
      const xml = '<root><![CDATA[Async CDATA]]></root>';
      const schema = x.string();

      const result = await schema.parse(xml);
      expect(result).toBe('Async CDATA');
    });
  });

  describe('Object Parsing Tests', () => {
    it('should parse object with simple shape (sync)', () => {
      const xml = `
        <root>
          <name>John</name>
          <age>30</age>
        </root>
      `;

      const schema = x.object({
        name: x.string().xpath('/root/name'),
        age: x.number().xpath('/root/age')
      });

      const result = schema.parseSync(xml);
      expect(result.name).toBe('John');
      expect(result.age).toBe(30);
    });

    it('should parse object with nested object without xpath (sync)', () => {
      const xml = `
        <root>
          <person>
            <firstName>Jane</firstName>
            <lastName>Doe</lastName>
          </person>
        </root>
      `;

      const schema = x.object({
        person: x.object({
          firstName: x.string().xpath('./firstName'),
          lastName: x.string().xpath('./lastName')
        }).xpath('/root/person')
      });

      const result = schema.parseSync(xml);
      expect(result.person.firstName).toBe('Jane');
      expect(result.person.lastName).toBe('Doe');
    });

    it('should parse object with array fields without xpath (sync)', () => {
      const xml = `
        <root>
          <data>
            <tags>
              <tag>red</tag>
              <tag>blue</tag>
            </tags>
          </data>
        </root>
      `;

      const schema = x.object({
        data: x.object({
          tags: x.array(
            x.string().writer({ element: 'tag' }),
            './tags/tag'
          )
        }).xpath('/root/data')
      });

      const result = schema.parseSync(xml);
      expect(result.data.tags).toEqual(['red', 'blue']);
    });

    it('should parse object with mixed schema types (sync)', () => {
      const xml = `
        <root>
          <title>Book</title>
          <price>19.99</price>
          <authors>
            <author>Author 1</author>
            <author>Author 2</author>
          </authors>
        </root>
      `;

      const schema = x.object({
        title: x.string().xpath('/root/title'),
        price: x.number().xpath('/root/price'),
        authors: x.array(
          x.string().writer({ element: 'author' }),
          '/root/authors/author'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.title).toBe('Book');
      expect(result.price).toBe(19.99);
      expect(result.authors).toEqual(['Author 1', 'Author 2']);
    });

    it('should parse object with simple shape (async)', async () => {
      const xml = `
        <root>
          <name>Alice</name>
          <age>25</age>
        </root>
      `;

      const schema = x.object({
        name: x.string().xpath('/root/name'),
        age: x.number().xpath('/root/age')
      });

      const result = await schema.parse(xml);
      expect(result.name).toBe('Alice');
      expect(result.age).toBe(25);
    });

    it('should parse object with nested object without xpath (async)', async () => {
      const xml = `
        <root>
          <company>
            <name>TechCorp</name>
            <year>2020</year>
          </company>
        </root>
      `;

      const schema = x.object({
        company: x.object({
          name: x.string().xpath('./name'),
          year: x.number().xpath('./year')
        }).xpath('/root/company')
      });

      const result = await schema.parse(xml);
      expect(result.company.name).toBe('TechCorp');
      expect(result.company.year).toBe(2020);
    });

    it('should parse object with array fields without xpath (async)', async () => {
      const xml = `
        <root>
          <container>
            <items>
              <item>X</item>
              <item>Y</item>
              <item>Z</item>
            </items>
          </container>
        </root>
      `;

      const schema = x.object({
        container: x.object({
          items: x.array(
            x.string().writer({ element: 'item' }),
            './items/item'
          )
        }).xpath('/root/container')
      });

      const result = await schema.parse(xml);
      expect(result.container.items).toEqual(['X', 'Y', 'Z']);
    });

    it('should parse object with mixed schema types (async)', async () => {
      const xml = `
        <root>
          <product>Widget</product>
          <cost>9.99</cost>
          <categories>
            <category>Tools</category>
            <category>Hardware</category>
          </categories>
        </root>
      `;

      const schema = x.object({
        product: x.string().xpath('/root/product'),
        cost: x.number().xpath('/root/cost'),
        categories: x.array(
          x.string().writer({ element: 'category' }),
          '/root/categories/category'
        )
      });

      const result = await schema.parse(xml);
      expect(result.product).toBe('Widget');
      expect(result.cost).toBe(9.99);
      expect(result.categories).toEqual(['Tools', 'Hardware']);
    });
  });

  describe('Position-Based Parsing Tests', () => {
    it('should parse object from position with various schemas (sync)', () => {
      const xml = `
        <root>
          <record>
            <id>101</id>
            <name>Test Record</name>
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
      expect(result.record.id).toBe(101);
      expect(result.record.name).toBe('Test Record');
      expect(result.record.active).toBe('true');
    });

    it('should parse object from position with async iterator', async () => {
      const xml = `
        <root>
          <product>
            <sku>ABC123</sku>
            <price>99.99</price>
            <stock>50</stock>
          </product>
        </root>
      `;

      const schema = x.object({
        product: x.object({
          sku: x.string().xpath('./sku'),
          price: x.number().xpath('./price'),
          stock: x.number().xpath('./stock')
        }).xpath('/root/product')
      });

      const result = await schema.parse(xml);
      expect(result.product.sku).toBe('ABC123');
      expect(result.product.price).toBe(99.99);
      expect(result.product.stock).toBe(50);
    });

    it('should parse array from position with simple elements (sync)', () => {
      const xml = `
        <root>
          <values>
            <value>100</value>
            <value>200</value>
            <value>300</value>
          </values>
        </root>
      `;

      const schema = x.object({
        values: x.array(
          x.number().writer({ element: 'value' }),
          '/root/values/value'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.values).toEqual([100, 200, 300]);
    });

    it('should parse array from position with complex elements (sync)', () => {
      const xml = `
        <root>
          <users>
            <user>
              <name>Alice</name>
              <role>admin</role>
            </user>
            <user>
              <name>Bob</name>
              <role>user</role>
            </user>
          </users>
        </root>
      `;

      const schema = x.object({
        users: x.array(
          x.object({
            name: x.string().xpath('./name'),
            role: x.string().xpath('./role')
          }).writer({ element: 'user' }),
          '/root/users/user'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.users).toHaveLength(2);
      expect(result.users[0].name).toBe('Alice');
      expect(result.users[0].role).toBe('admin');
      expect(result.users[1].name).toBe('Bob');
      expect(result.users[1].role).toBe('user');
    });

    it('should parse array from position with async iterator', async () => {
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

      const result = await schema.parse(xml);
      expect(result.items).toEqual(['A', 'B', 'C']);
    });

    it('should parse nested position-based structures', () => {
      const xml = `
        <root>
          <department>
            <name>Engineering</name>
            <employees>
              <employee>
                <name>John</name>
                <level>5</level>
              </employee>
              <employee>
                <name>Jane</name>
                <level>6</level>
              </employee>
            </employees>
          </department>
        </root>
      `;

      const schema = x.object({
        department: x.object({
          name: x.string().xpath('./name'),
          employees: x.array(
            x.object({
              name: x.string().xpath('./name'),
              level: x.number().xpath('./level')
            }).writer({ element: 'employee' }),
            './employees/employee'
          )
        }).xpath('/root/department')
      });

      const result = schema.parseSync(xml);
      expect(result.department.name).toBe('Engineering');
      expect(result.department.employees).toHaveLength(2);
      expect(result.department.employees[0].name).toBe('John');
      expect(result.department.employees[0].level).toBe(5);
    });

    it('should handle async position-based parsing with complex nesting', async () => {
      const xml = `
        <root>
          <store>
            <location>Downtown</location>
            <inventory>
              <item>
                <code>SKU001</code>
                <qty>10</qty>
              </item>
              <item>
                <code>SKU002</code>
                <qty>25</qty>
              </item>
            </inventory>
          </store>
        </root>
      `;

      const schema = x.object({
        store: x.object({
          location: x.string().xpath('./location'),
          inventory: x.array(
            x.object({
              code: x.string().xpath('./code'),
              qty: x.number().xpath('./qty')
            }).writer({ element: 'item' }),
            './inventory/item'
          )
        }).xpath('/root/store')
      });

      const result = await schema.parse(xml);
      expect(result.store.location).toBe('Downtown');
      expect(result.store.inventory).toHaveLength(2);
      expect(result.store.inventory[1].code).toBe('SKU002');
      expect(result.store.inventory[1].qty).toBe(25);
    });
  });

  describe('String Parsing With XPath', () => {
    it('should parse string with xpath using state machine (sync)', () => {
      const xml = `
        <root>
          <data>
            <value>Target Value</value>
          </data>
        </root>
      `;
      const schema = x.string().xpath('/root/data/value');

      const result = schema.parseSync(xml);
      expect(result).toBe('Target Value');
    });

    it('should parse string with xpath when xpath matches (sync)', () => {
      const xml = `
        <root>
          <item>First</item>
          <item>Second</item>
        </root>
      `;
      const schema = x.string().xpath('/root/item');

      const result = schema.parseSync(xml);
      expect(result).toBe('First');
    });

    it('should parse string with xpath when xpath does not match (sync)', () => {
      const xml = `
        <root>
          <item>Content</item>
        </root>
      `;
      const schema = x.string().xpath('/root/missing');

      const result = schema.parseSync(xml);
      expect(result).toBe('');
    });

    it('should parse string with xpath using state machine (async)', async () => {
      const xml = `
        <root>
          <data>
            <value>Async Target</value>
          </data>
        </root>
      `;
      const schema = x.string().xpath('/root/data/value');

      const result = await schema.parse(xml);
      expect(result).toBe('Async Target');
    });

    it('should parse string with xpath when xpath matches (async)', async () => {
      const xml = `
        <root>
          <item>First Async</item>
          <item>Second Async</item>
        </root>
      `;
      const schema = x.string().xpath('/root/item');

      const result = await schema.parse(xml);
      expect(result).toBe('First Async');
    });

    it('should parse string with xpath when xpath does not match (async)', async () => {
      const xml = `
        <root>
          <item>Content</item>
        </root>
      `;
      const schema = x.string().xpath('/root/notfound');

      const result = await schema.parse(xml);
      expect(result).toBe('');
    });
  });
});
