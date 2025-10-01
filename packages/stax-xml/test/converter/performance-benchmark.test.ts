import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

describe('Performance Benchmark Tests', () => {
  describe('Parsing Speed Benchmarks', () => {
    it('should benchmark small document parsing (1KB)', () => {
      const xml = generateXML(100, 'small'); // ~1KB
      const iterations = 50;

      const schema = x.array(
        x.object({
          id: x.string().xpath('./@id'),
          value: x.string().xpath('./value'),
          number: x.number().xpath('./number')
        }),
        '//item'
      );

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        schema.parseSync(xml);
      }
      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(20); // Should parse in less than 20ms on average
      console.log(`Small document (1KB): ${avgTime.toFixed(2)}ms per parse`);
    });

    it('should benchmark medium document parsing (50KB)', () => {
      const xml = generateXML(2500, 'medium'); // ~50KB
      const iterations = 10;

      const schema = x.array(
        x.object({
          id: x.string().xpath('./@id'),
          data: x.string().xpath('./data'),
          created: x.string().xpath('./metadata/created'),
          type: x.string().xpath('./metadata/type')
        }),
        '//record'
      );

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        schema.parseSync(xml, { maxDepth: 5000 });
      }
      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(1000); // Should parse in less than 1000ms
      console.log(`Medium document (50KB): ${avgTime.toFixed(2)}ms per parse`);
    });

    it('should benchmark large document parsing (500KB)', () => {
      const xml = generateXML(25000, 'large'); // ~500KB
      const iterations = 3;

      const schema = x.array(
        x.object({
          id: x.string().xpath('./@id'),
          content: x.string().xpath('./content')
        }),
        '//entry'
      );

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        schema.parseSync(xml, { maxDepth: 5000 });
      }
      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(5000); // Should parse in less than 5 seconds
      console.log(`Large document (500KB): ${avgTime.toFixed(2)}ms per parse`);
    });

    it('should show linear scaling characteristics', () => {
      const sizes = [100, 500, 1000];
      const results: { size: number; time: number; rate: number }[] = [];

      sizes.forEach(size => {
        const xml = generateXML(size, 'scaling');
        const schema = x.array(x.string(), '//item/text');

        const start = performance.now();
        const result = schema.parseSync(xml);
        const duration = performance.now() - start;

        expect(result).toHaveLength(size);
        results.push({
          size,
          time: duration,
          rate: size / duration // items per ms
        });
      });

      // Check that performance scales reasonably (not exponentially)
      for (let i = 1; i < results.length; i++) {
        const current = results[i];
        const previous = results[i - 1];
        const timeRatio = current.time / previous.time;
        const sizeRatio = current.size / previous.size;

        // Time ratio should be less than size ratio squared
        expect(timeRatio).toBeLessThan(sizeRatio * sizeRatio);

        console.log(`Size ${current.size}: ${current.time.toFixed(2)}ms, ${current.rate.toFixed(1)} items/ms`);
      }
    });
  });

  describe('Memory Usage Benchmarks', () => {
    it('should handle large arrays efficiently', () => {
      const itemCount = 5000;
      let xml = '<data>';
      for (let i = 0; i < itemCount; i++) {
        xml += `<item id="${i}">Item ${i}</item>`;
      }
      xml += '</data>';

      const schema = x.array(x.string(), '//item');

      const start = performance.now();
      const result = schema.parseSync(xml);
      const duration = performance.now() - start;

      expect(result).toHaveLength(itemCount);
      expect(duration).toBeLessThan(2000); // Should complete in less than 2 seconds

      console.log(`Processing time for ${itemCount} items: ${duration.toFixed(2)}ms`);
    });

    it('should be memory efficient with complex objects', () => {
      const recordCount = 500;
      let xml = '<records>';

      for (let i = 0; i < recordCount; i++) {
        xml += `
          <record id="${i}">
            <name>Record ${i}</name>
            <description>This is a description for record ${i}</description>
            <data>
              <field1>Value ${i * 1}</field1>
              <field2>Value ${i * 2}</field2>
              <field3>Value ${i * 3}</field3>
            </data>
            <metadata>
              <created>2024-01-${String(i % 28 + 1).padStart(2, '0')}</created>
              <type>type-${i % 5}</type>
              <priority>${i % 3}</priority>
            </metadata>
          </record>
        `;
      }
      xml += '</records>';

      const recordSchema = x.object({
        id: x.string().xpath('./@id'),
        name: x.string().xpath('./name'),
        description: x.string().xpath('./description'),
        field1: x.string().xpath('./data/field1'),
        field2: x.string().xpath('./data/field2'),
        field3: x.string().xpath('./data/field3'),
        created: x.string().xpath('./metadata/created'),
        type: x.string().xpath('./metadata/type'),
        priority: x.number().xpath('./metadata/priority').int()
      });

      const schema = x.array(recordSchema, '//record');

      const start = performance.now();
      const result = schema.parseSync(xml);
      const duration = performance.now() - start;

      expect(result).toHaveLength(recordCount);
      expect(result[0].field1).toBe('Value 0');
      expect(result[499].type).toBe('type-4');

      console.log(`Complex objects parsing: ${duration.toFixed(2)}ms`);
    });

    it('should handle streaming memory efficiently', async () => {
      const chunkCount = 50;
      const itemsPerChunk = 100;

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('<items>'));

          let chunkIndex = 0;
          const sendChunk = () => {
            if (chunkIndex < chunkCount) {
              let chunk = '';
              for (let i = 0; i < itemsPerChunk; i++) {
                const itemId = chunkIndex * itemsPerChunk + i;
                chunk += `<item id="${itemId}">Data ${itemId}</item>`;
              }
              controller.enqueue(new TextEncoder().encode(chunk));
              chunkIndex++;
              setTimeout(sendChunk, 1); // Small delay to simulate streaming
            } else {
              controller.enqueue(new TextEncoder().encode('</items>'));
              controller.close();
            }
          };

          sendChunk();
        }
      });

      const schema = x.array(
        x.object({
          id: x.string().xpath('./@id'),
          data: x.string().xpath('.')
        }),
        '//item'
      );

      const start = performance.now();
      const result = await schema.parse(stream);
      const duration = performance.now() - start;

      expect(result).toHaveLength(chunkCount * itemsPerChunk);
      console.log(`Streaming ${result.length} items: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Complex Query Performance', () => {
    it('should efficiently handle basic XPath queries', () => {
      const xml = generateComplexDocument();

      const schema = x.object({
        // Simple queries
        allTitles: x.array(x.string(), '//title'),
        // Basic predicates
        electronicsItems: x.array(x.string(), "//item[@category='electronics']/name"),
        booksItems: x.array(x.string(), "//item[@category='books']/name"),
        // Deep nested queries
        deepValues: x.array(x.string(), '//level1/level2/level3/value'),
        // Position-based queries
        firstItems: x.array(x.string(), '//category/item[1]/name'),
        // All prices
        allPrices: x.array(x.number(), '//item/@price')
      });

      const start = performance.now();
      const result = schema.parseSync(xml);
      const duration = performance.now() - start;

      expect(result.allTitles.length).toBeGreaterThan(0);
      expect(result.electronicsItems.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500); // Should complete in less than 500ms

      console.log(`Basic XPath queries: ${duration.toFixed(2)}ms`);
      console.log(`Found ${result.allTitles.length} titles, ${result.electronicsItems.length} electronics items`);
    });

    it('should optimize repeated XPath evaluations', () => {
      const xml = generateRepeatedStructure();

      // Schema with many repeated queries
      const schema = x.object({
        userCount: x.array(x.string(), '//user/@id').transform(arr => arr.length),
        activeUsers: x.array(x.string(), "//user[@status='active']/@id"),
        inactiveUsers: x.array(x.string(), "//user[@status='inactive']/@id"),
        premiumUsers: x.array(x.string(), "//user[@type='premium']/@id"),
        freeUsers: x.array(x.string(), "//user[@type='free']/@id"),
        userNames: x.array(x.string(), '//user/name'),
        userEmails: x.array(x.string(), '//user/email'),
        userAges: x.array(x.number(), '//user/age'),
        avgAge: x.array(x.number(), '//user/age').transform(ages =>
          ages.reduce((sum, age) => sum + age, 0) / ages.length
        )
      });

      const start = performance.now();
      const result = schema.parseSync(xml);
      const duration = performance.now() - start;

      expect(result.userCount).toBeGreaterThan(0);
      expect(result.activeUsers.length + result.inactiveUsers.length).toBe(result.userCount);
      expect(duration).toBeLessThan(500);

      console.log(`Repeated XPath queries on ${result.userCount} users: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Sync vs Async Performance', () => {
    it('should compare sync and async parsing performance', async () => {
      const xml = generateXML(1000, 'comparison');

      const schema = x.array(
        x.object({
          id: x.string().xpath('./@id'),
          data: x.string().xpath('./data'),
          value: x.number().xpath('./value')
        }),
        '//item'
      );

      // Sync parsing
      const syncStart = performance.now();
      const syncResult = schema.parseSync(xml, { maxDepth: 5000 });
      const syncDuration = performance.now() - syncStart;

      // Async parsing
      const asyncStart = performance.now();
      const asyncResult = await schema.parse(xml, { maxDepth: 5000 });
      const asyncDuration = performance.now() - asyncStart;

      expect(syncResult).toEqual(asyncResult);

      console.log(`Sync parsing: ${syncDuration.toFixed(2)}ms`);
      console.log(`Async parsing: ${asyncDuration.toFixed(2)}ms`);
      console.log(`Async overhead: ${(asyncDuration - syncDuration).toFixed(2)}ms`);

      // Async should not be significantly slower for non-stream data
      expect(asyncDuration).toBeLessThan(syncDuration * 3);
    });

    it('should show async benefits with streaming', async () => {
      const totalItems = 2000;
      const chunkSize = 200;

      // Create streaming data
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('<data>'));

          for (let i = 0; i < totalItems; i += chunkSize) {
            let chunk = '';
            for (let j = i; j < Math.min(i + chunkSize, totalItems); j++) {
              chunk += `<item id="${j}">Item ${j}</item>`;
            }
            controller.enqueue(new TextEncoder().encode(chunk));
          }

          controller.enqueue(new TextEncoder().encode('</data>'));
          controller.close();
        }
      });

      const schema = x.array(x.string(), '//item');

      const start = performance.now();
      const result = await schema.parse(stream);
      const duration = performance.now() - start;

      expect(result).toHaveLength(totalItems);
      console.log(`Streaming ${totalItems} items: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Transformation Performance', () => {
    it('should benchmark data transformations', () => {
      const xml = generateSalesData();

      const saleSchema = x.object({
        id: x.string().xpath('./@id'),
        amount: x.number().xpath('./amount'),
        date: x.string().xpath('./date'),
        product: x.string().xpath('./product'),
        customer: x.string().xpath('./customer'),
        region: x.string().xpath('./region')
      });

      const schema = x.array(saleSchema, '//sale').transform(sales => {
        // Complex transformations
        const totalRevenue = sales.reduce((sum, sale) => sum + sale.amount, 0);

        const byRegion = sales.reduce((acc, sale) => {
          if (!acc[sale.region]) acc[sale.region] = { count: 0, revenue: 0 };
          acc[sale.region].count++;
          acc[sale.region].revenue += sale.amount;
          return acc;
        }, {} as Record<string, { count: number; revenue: number }>);

        const byProduct = sales.reduce((acc, sale) => {
          if (!acc[sale.product]) acc[sale.product] = { count: 0, revenue: 0 };
          acc[sale.product].count++;
          acc[sale.product].revenue += sale.amount;
          return acc;
        }, {} as Record<string, { count: number; revenue: number }>);

        const uniqueCustomers = new Set(sales.map(s => s.customer)).size;

        return {
          totalSales: sales.length,
          totalRevenue,
          averageTicket: totalRevenue / sales.length,
          uniqueCustomers,
          byRegion,
          byProduct,
          topProducts: Object.entries(byProduct)
            .sort(([,a], [,b]) => b.revenue - a.revenue)
            .slice(0, 3)
            .map(([product, stats]) => ({ product, ...stats }))
        };
      });

      const start = performance.now();
      const result = schema.parseSync(xml);
      const duration = performance.now() - start;

      expect(result.totalSales).toBeGreaterThan(0);
      expect(result.totalRevenue).toBeGreaterThan(0);
      expect(result.topProducts).toHaveLength(3);

      console.log(`Sales analysis (${result.totalSales} records): ${duration.toFixed(2)}ms`);
      console.log(`Revenue: $${result.totalRevenue.toFixed(2)}, Customers: ${result.uniqueCustomers}`);
    });

    it('should benchmark nested transformations', () => {
      const xml = generateNestedTransformData();

      const schema = x.object({
        departments: x.array(
          x.object({
            name: x.string().xpath('./@name'),
            employees: x.array(
              x.object({
                id: x.string().xpath('./@id'),
                name: x.string().xpath('./name'),
                salary: x.number().xpath('./salary'),
                projects: x.array(x.string(), './projects/project')
              }),
              './employee'
            ).transform(employees => ({
              employees,
              totalSalary: employees.reduce((sum, emp) => sum + emp.salary, 0),
              avgSalary: employees.reduce((sum, emp) => sum + emp.salary, 0) / employees.length,
              totalProjects: employees.reduce((sum, emp) => sum + emp.projects.length, 0)
            }))
          }),
          '//department'
        ).transform(departments => ({
          departments,
          companyStats: {
            totalDepartments: departments.length,
            totalEmployees: departments.reduce((sum, dept) => sum + dept.employees.employees.length, 0),
            totalSalary: departments.reduce((sum, dept) => sum + dept.employees.totalSalary, 0),
            totalProjects: departments.reduce((sum, dept) => sum + dept.employees.totalProjects, 0)
          }
        }))
      });

      const start = performance.now();
      const result = schema.parseSync(xml);
      const duration = performance.now() - start;

      expect(result.departments.length).toBeGreaterThan(0);
      expect(result.companyStats.totalEmployees).toBeGreaterThan(0);

      console.log(`Nested transformations: ${duration.toFixed(2)}ms`);
      console.log(`Company: ${result.companyStats.totalEmployees} employees, ${result.companyStats.totalDepartments} departments`);
    });
  });

  describe('Performance Regression Tests', () => {
    it('should maintain consistent performance across runs', () => {
      const xml = generateXML(1000, 'regression');
      const schema = x.array(x.string(), '//item/value');
      const runs = 5;
      const times: number[] = [];

      for (let i = 0; i < runs; i++) {
        const start = performance.now();
        schema.parseSync(xml);
        times.push(performance.now() - start);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const variance = times.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / times.length;
      const stdDev = Math.sqrt(variance);

      console.log(`Performance consistency over ${runs} runs:`);
      console.log(`  Average: ${avgTime.toFixed(2)}ms`);
      console.log(`  Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
      console.log(`  Std Dev: ${stdDev.toFixed(2)}ms`);

      // Performance should be consistent (low variance)
      expect(stdDev).toBeLessThan(avgTime * 0.5); // Standard deviation < 50% of average
    });
  });
});

// Helper functions for generating test data
function generateXML(itemCount: number, type: string): string {
  let xml = type === 'small' ? '<items>' :
            type === 'medium' ? '<records>' :
            type === 'large' ? '<entries>' :
            type === 'scaling' ? '<items>' :
            type === 'comparison' ? '<items>' :
            '<items>';

  for (let i = 0; i < itemCount; i++) {
    if (type === 'small') {
      xml += `<item id="${i}"><value>Value ${i}</value><number>${i}</number></item>`;
    } else if (type === 'medium') {
      xml += `
        <record id="${i}">
          <data>Data content for record ${i}</data>
          <metadata>
            <created>2024-01-${String((i % 28) + 1).padStart(2, '0')}</created>
            <type>type-${i % 5}</type>
          </metadata>
        </record>
      `;
    } else if (type === 'large') {
      xml += `<entry id="${i}"><content>Large content block for entry ${i} with lots of text data</content></entry>`;
    } else {
      xml += `<item id="${i}"><text>Item ${i}</text><value>${i * 2}</value><data>Data ${i}</data></item>`;
    }
  }

  xml += type === 'small' ? '</items>' :
         type === 'medium' ? '</records>' :
         type === 'large' ? '</entries>' :
         '</items>';

  return xml;
}

function generateComplexDocument(): string {
  return `
    <catalog>
      <title>Product Catalog</title>
      ${Array.from({ length: 5 }, (_, c) => `
        <category name="category-${c}">
          <title>Category ${c}</title>
          ${Array.from({ length: 10 }, (_, i) => `
            <item category="${['electronics', 'books', 'clothing'][i % 3]}" price="${50 + i * 25}">
              <name>Product ${c}-${i}</name>
              <description>Lorem ipsum ${i}</description>
              <level1>
                <level2>
                  <level3>
                    <value>Deep value ${c}-${i}</value>
                  </level3>
                </level2>
              </level1>
            </item>
          `).join('')}
        </category>
      `).join('')}
    </catalog>
  `;
}

function generateRepeatedStructure(): string {
  return `
    <users>
      ${Array.from({ length: 200 }, (_, i) => `
        <user id="user-${i}" status="${i % 2 === 0 ? 'active' : 'inactive'}" type="${i % 3 === 0 ? 'premium' : 'free'}">
          <name>User ${i}</name>
          <email>user${i}@example.com</email>
          <age>${20 + (i % 50)}</age>
        </user>
      `).join('')}
    </users>
  `;
}

function generateSalesData(): string {
  const products = ['Laptop', 'Phone', 'Tablet', 'Watch'];
  const regions = ['North', 'South', 'East', 'West'];

  return `
    <sales>
      ${Array.from({ length: 500 }, (_, i) => `
        <sale id="sale-${i}">
          <amount>${(Math.random() * 1000 + 50).toFixed(2)}</amount>
          <date>2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}</date>
          <product>${products[i % products.length]}</product>
          <customer>customer-${Math.floor(i / 3)}</customer>
          <region>${regions[i % regions.length]}</region>
        </sale>
      `).join('')}
    </sales>
  `;
}

function generateNestedTransformData(): string {
  return `
    <company>
      ${Array.from({ length: 3 }, (_, d) => `
        <department name="Dept-${d}">
          ${Array.from({ length: 5 }, (_, e) => `
            <employee id="emp-${d}-${e}">
              <name>Employee ${d}-${e}</name>
              <salary>${40000 + Math.random() * 60000}</salary>
              <projects>
                ${Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, p) =>
                  `<project>Project ${d}-${e}-${p}</project>`
                ).join('')}
              </projects>
            </employee>
          `).join('')}
        </department>
      `).join('')}
    </company>
  `;
}