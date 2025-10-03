import { describe, expect, it } from 'vitest';
import { x, type Infer } from '../../src/converter/index.js';

describe('Integration Tests', () => {
  describe('Real-World XML Examples', () => {
    it('should parse RSS feed structure', () => {
      const xml = `
        <?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Example RSS Feed</title>
            <link>https://example.com</link>
            <description>Example Description</description>
            <item>
              <title>Article 1</title>
              <link>https://example.com/article1</link>
              <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
            </item>
            <item>
              <title>Article 2</title>
              <link>https://example.com/article2</link>
              <pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>
      `;

      const schema = x.object({
        channelTitle: x.string().xpath('//channel/title'),
        channelLink: x.string().xpath('//channel/link'),
        items: x.array(
          x.object({
            title: x.string().xpath('./title'),
            link: x.string().xpath('./link'),
            pubDate: x.string().xpath('./pubDate')
          }).transform(item => ({
            ...item,
            url: new URL(item.link)
          })),
          '//item'
        )
      });

      const result = schema.parseSync(xml);
      expect(result.channelTitle).toBe('Example RSS Feed');
      expect(result.items).toHaveLength(2);
      expect(result.items[0].title).toBe('Article 1');
      expect(result.items[0].url.hostname).toBe('example.com');
    });

    it('should parse e-commerce product catalog', () => {
      const xml = `
        <catalog>
          <product id="1">
            <name>Laptop</name>
            <price currency="USD">999.99</price>
            <stock>15</stock>
            <categories>
              <category>Electronics</category>
              <category>Computers</category>
            </categories>
            <specs>
              <spec name="CPU">Intel i7</spec>
              <spec name="RAM">16GB</spec>
              <spec name="Storage">512GB SSD</spec>
            </specs>
          </product>
        </catalog>
      `;

      const schema = x.object({
        id: x.string().xpath("//product[@id='1']/@id"),
        name: x.string().xpath('//product/name'),
        price: x.number().xpath('//product/price'),
        stock: x.number().xpath('//product/stock').int(),
        categories: x.array(x.string(), '//category'),
        cpu: x.string().xpath("//spec[@name='CPU']"),
        ram: x.string().xpath("//spec[@name='RAM']"),
        storage: x.string().xpath("//spec[@name='Storage']")
      }).transform(product => ({
        ...product,
        inStock: product.stock > 0,
        specs: {
          cpu: product.cpu,
          ram: product.ram,
          storage: product.storage
        }
      }));

      const result = schema.parseSync(xml);
      expect(result.name).toBe('Laptop');
      expect(result.price).toBe(999.99);
      expect(result.stock).toBe(15);
      expect(result.inStock).toBe(true);
      expect(result.categories).toEqual(['Electronics', 'Computers']);
      expect(result.specs.cpu).toBe('Intel i7');
    });

    it('should parse configuration file', () => {
      const xml = `
        <configuration>
          <database>
            <host>localhost</host>
            <port>5432</port>
            <name>mydb</name>
            <credentials>
              <username>admin</username>
              <password>secret123</password>
            </credentials>
          </database>
          <features>
            <feature name="auth" enabled="true"/>
            <feature name="logging" enabled="true"/>
            <feature name="analytics" enabled="false"/>
          </features>
        </configuration>
      `;

      const schema = x.object({
        dbHost: x.string().xpath('//database/host'),
        dbPort: x.number().xpath('//database/port').int(),
        dbName: x.string().xpath('//database/name'),
        dbUser: x.string().xpath('//database/credentials/username'),
        dbPass: x.string().xpath('//database/credentials/password'),
        authEnabled: x.string().xpath("//feature[@name='auth']/@enabled"),
        loggingEnabled: x.string().xpath("//feature[@name='logging']/@enabled"),
        analyticsEnabled: x.string().xpath("//feature[@name='analytics']/@enabled")
      }).transform(config => ({
        database: {
          host: config.dbHost,
          port: config.dbPort,
          name: config.dbName,
          credentials: {
            username: config.dbUser,
            password: config.dbPass
          }
        },
        features: {
          auth: config.authEnabled === 'true',
          logging: config.loggingEnabled === 'true',
          analytics: config.analyticsEnabled === 'true'
        }
      }));

      const result = schema.parseSync(xml);
      expect(result.database.host).toBe('localhost');
      expect(result.database.port).toBe(5432);
      expect(result.features.auth).toBe(true);
      expect(result.features.analytics).toBe(false);
    });

    it('should parse SVG structure', () => {
      const xml = `
        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
          <rect x="10" y="10" width="80" height="80" fill="blue"/>
          <circle cx="50" cy="50" r="30" fill="red"/>
          <text x="50" y="50">Hello</text>
        </svg>
      `;

      const schema = x.object({
        width: x.string().xpath('/svg/@width'),
        height: x.string().xpath('/svg/@height'),
        rectFill: x.string().xpath('//rect/@fill'),
        circleFill: x.string().xpath('//circle/@fill'),
        text: x.string().xpath('//text')
      });

      const result = schema.parseSync(xml);
      expect(result.width).toBe('100');
      expect(result.height).toBe('100');
      expect(result.rectFill).toBe('blue');
      expect(result.circleFill).toBe('red');
      expect(result.text).toBe('Hello');
    });
  });

  describe('Complex Data Transformations', () => {
    it('should transform and validate user data', () => {
      const xml = `
        <users>
          <user>
            <id>1</id>
            <email>john@example.com</email>
            <age>30</age>
            <active>true</active>
          </user>
          <user>
            <id>2</id>
            <email>jane@example.com</email>
            <age>25</age>
            <active>false</active>
          </user>
        </users>
      `;

      const userSchema = x.object({
        id: x.number().xpath('./id').int(),
        email: x.string().xpath('./email'),
        age: x.number().xpath('./age').int().min(18).max(100),
        active: x.string().xpath('./active')
      }).transform(user => ({
        ...user,
        active: user.active === 'true',
        isAdult: user.age >= 18
      }));

      const schema = x.array(userSchema, '//user');
      const result = schema.parseSync(xml);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].email).toBe('john@example.com');
      expect(result[0].active).toBe(true);
      expect(result[0].isAdult).toBe(true);
      expect(result[1].active).toBe(false);
    });

    it('should aggregate and calculate statistics', () => {
      const xml = `
        <sales>
          <sale>
            <product>Laptop</product>
            <quantity>2</quantity>
            <price>999.99</price>
          </sale>
          <sale>
            <product>Mouse</product>
            <quantity>5</quantity>
            <price>29.99</price>
          </sale>
          <sale>
            <product>Keyboard</product>
            <quantity>3</quantity>
            <price>79.99</price>
          </sale>
        </sales>
      `;

      const saleSchema = x.object({
        product: x.string().xpath('./product'),
        quantity: x.number().xpath('./quantity').int(),
        price: x.number().xpath('./price')
      }).transform(sale => ({
        ...sale,
        total: sale.quantity * sale.price
      }));

      const schema = x.array(saleSchema, '//sale').transform(sales => {
        const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
        const totalItems = sales.reduce((sum, sale) => sum + sale.quantity, 0);
        return {
          sales,
          summary: {
            totalRevenue,
            totalItems,
            averagePrice: totalRevenue / totalItems,
            itemCount: sales.length
          }
        };
      });

      const result = schema.parseSync(xml);
      expect(result.sales).toHaveLength(3);
      expect(result.sales[0].total).toBeCloseTo(1999.98);
      expect(result.summary.totalItems).toBe(10);
      expect(result.summary.itemCount).toBe(3);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle moderate-sized datasets efficiently', () => {
      let xml = '<items>';
      for (let i = 0; i < 500; i++) {
        xml += `<item><id>${i}</id><value>${i * 2}</value></item>`;
      }
      xml += '</items>';

      const schema = x.array(
        x.object({
          id: x.number().xpath('./id').int(),
          value: x.number().xpath('./value')
        }),
        '//item'
      );

      const start = performance.now();
      const result = schema.parseSync(xml);
      const duration = performance.now() - start;

      expect(result).toHaveLength(500);
      expect(result[0].id).toBe(0);
      expect(result[499].id).toBe(499);
      expect(duration).toBeLessThan(1000); // Should parse in less than 1 second
    });

    it('should handle async parsing with large data', async () => {
      let xml = '<data>';
      for (let i = 0; i < 100; i++) {
        xml += `<item>${i}</item>`;
      }
      xml += '</data>';

      const schema = x.array(x.number(), '//item');
      const result = await schema.parse(xml);

      expect(result).toHaveLength(100);
      expect(result[0]).toBe(0);
      expect(result[99]).toBe(99);
    });
  });

  describe('Error Recovery and Validation', () => {
    it('should validate and reject invalid data', () => {
      const xml = `
        <order>
          <id>12345</id>
          <amount>-50.00</amount>
          <items>5</items>
        </order>
      `;

      const schema = x.object({
        id: x.number().xpath('//id').int().min(1),
        amount: x.number().xpath('//amount').min(0),
        items: x.number().xpath('//items').int().min(1)
      });

      const result = schema.safeParseSync(xml);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('too_small');
      }
    });

    it('should use optional for partial data', () => {
      const xml = `
        <profile>
          <username>johndoe</username>
          <!-- email is missing -->
          <age>30</age>
        </profile>
      `;

      const schema = x.object({
        username: x.string().xpath('//username'),
        email: x.string().xpath('//email').optional(),
        age: x.number().xpath('//age').int()
      });

      const result = schema.parseSync(xml);
      expect(result.username).toBe('johndoe');
      expect(result.email).toBeUndefined();
      expect(result.age).toBe(30);
    });
  });

  describe('Type Safety and Inference', () => {
    it('should have correct type inference for complex schemas', () => {
      const schema = x.object({
        name: x.string().xpath('//name'),
        age: x.number().xpath('//age').int(),
        tags: x.array(x.string(), '//tag'),
        metadata: x.object({
          created: x.string().xpath('//created'),
          updated: x.string().xpath('//updated')
        })
      });

      type Expected = {
        name: string;
        age: number;
        tags: string[];
        metadata: {
          created: string;
          updated: string;
        };
      };

      type Actual = Infer<typeof schema>;

      const value: Actual = {
        name: 'test',
        age: 25,
        tags: ['a', 'b'],
        metadata: {
          created: '2024-01-01',
          updated: '2024-01-02'
        }
      };

      expect(value.name).toBe('test');
    });

    it('should infer transformed types correctly', () => {
      const schema = x.object({
        firstName: x.string().xpath('//firstName'),
        lastName: x.string().xpath('//lastName')
      }).transform(person => ({
        fullName: `${person.firstName} ${person.lastName}`,
        initials: `${person.firstName[0]}${person.lastName[0]}`
      }));

      type Result = Infer<typeof schema>;

      const value: Result = {
        fullName: 'John Doe',
        initials: 'JD'
      };

      expect(value.fullName).toBe('John Doe');
    });
  });

  describe('Async vs Sync Comparison', () => {
    it('should produce same results for sync and async', async () => {
      const xml = `
        <data>
          <items>
            <item>A</item>
            <item>B</item>
            <item>C</item>
          </items>
          <count>3</count>
        </data>
      `;

      const schema = x.object({
        items: x.array(x.string(), '//item'),
        count: x.number().xpath('//count').int()
      });

      const syncResult = schema.parseSync(xml);
      const asyncResult = await schema.parse(xml);

      expect(syncResult).toEqual(asyncResult);
    });
  });
});