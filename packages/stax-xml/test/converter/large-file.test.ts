import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

describe('Large File Tests', () => {
  describe('Large Dataset Parsing', () => {
    it('should parse 1000 items efficiently', () => {
      let xml = '<items>';
      for (let i = 0; i < 1000; i++) {
        xml += `
          <item id="${i}">
            <name>Item ${i}</name>
            <price>${(Math.random() * 1000).toFixed(2)}</price>
            <stock>${Math.floor(Math.random() * 100)}</stock>
          </item>
        `;
      }
      xml += '</items>';

      const itemSchema = x.object({
        id: x.string().xpath('./@id'),
        name: x.string().xpath('./name'),
        price: x.number().xpath('./price'),
        stock: x.number().xpath('./stock').int()
      });

      const start = performance.now();
      const schema = x.array(itemSchema, '//item');
      const result = schema.parseSync(xml, { maxDepth: 1500 });
      const duration = performance.now() - start;

      expect(result).toHaveLength(1000);
      expect(result[0].id).toBe('0');
      expect(result[999].id).toBe('999');
      expect(duration).toBeLessThan(1000); // Should parse in less than 1s
    });

    it('should parse 5,000 simple elements', () => {
      let xml = '<numbers>';
      for (let i = 0; i < 5000; i++) {
        xml += `<n>${i}</n>`;
      }
      xml += '</numbers>';

      const start = performance.now();
      const schema = x.array(x.number(), '//n');
      const result = schema.parseSync(xml);
      const duration = performance.now() - start;

      expect(result).toHaveLength(5000);
      expect(result[0]).toBe(0);
      expect(result[4999]).toBe(4999);
      expect(duration).toBeLessThan(2000); // Should parse in less than 2s
    });

    it('should handle large arrays with async parsing', async () => {
      let xml = '<data>';
      for (let i = 0; i < 10000; i++) {
        xml += `<v>${i % 1000}</v>`;
      }
      xml += '</data>';

      const schema = x.array(x.number(), '//v');
      const result = await schema.parse(xml);

      expect(result).toHaveLength(10000);
      expect(result[5000]).toBe(0);
      expect(result.filter(v => v === 500)).toHaveLength(10);
    });
  });

  describe('Large XML Document Structures', () => {
    it('should parse large catalog structure', () => {
      const categories = 10;
      const productsPerCategory = 50;

      let xml = '<catalog>';
      for (let c = 0; c < categories; c++) {
        xml += `<category id="cat-${c}" name="Category ${c}">`;
        for (let p = 0; p < productsPerCategory; p++) {
          xml += `
            <product id="prod-${c}-${p}">
              <name>Product ${c}-${p}</name>
              <price>${(100 + p * 10).toFixed(2)}</price>
            </product>
          `;
        }
        xml += '</category>';
      }
      xml += '</catalog>';

      const schema = x.object({
        totalProducts: x.array(x.string(), '//product/@id').transform(arr => arr.length),
        categories: x.array(x.string(), '//category/@name'),
        allPrices: x.array(x.number(), '//price')
      });

      const result = schema.parseSync(xml);

      expect(result.totalProducts).toBe(categories * productsPerCategory);
      expect(result.categories).toHaveLength(categories);
      expect(result.allPrices).toHaveLength(categories * productsPerCategory);
    });

    it('should parse large log file structure', () => {
      const days = 10;
      const eventsPerDay = 100;

      let xml = '<logs>';
      for (let d = 1; d <= days; d++) {
        xml += `<day date="2024-01-${String(d).padStart(2, '0')}">`;
        for (let e = 0; e < eventsPerDay; e++) {
          const level = ['INFO', 'WARN', 'ERROR'][e % 3];
          xml += `
            <event>
              <timestamp>${d * 1000 + e}</timestamp>
              <level>${level}</level>
              <message>Event message ${e}</message>
            </event>
          `;
        }
        xml += '</day>';
      }
      xml += '</logs>';

      const schema = x.object({
        totalEvents: x.array(x.string(), '//event/timestamp').transform(arr => arr.length),
        allLevels: x.array(x.string(), '//level'),
        uniqueDays: x.array(x.string(), '//day/@date')
      });

      const result = schema.parseSync(xml);

      expect(result.totalEvents).toBe(days * eventsPerDay);
      expect(result.allLevels).toHaveLength(days * eventsPerDay);
      expect(result.uniqueDays).toHaveLength(days);
    });
  });

  describe('Memory-Efficient Streaming', () => {
    it('should parse from ReadableStream with chunks', async () => {
      const totalItems = 1000;
      const chunkSize = 100;

      function createChunk(start: number, end: number): string {
        let chunk = '';
        for (let i = start; i < end; i++) {
          chunk += `<item id="${i}">Value ${i}</item>`;
        }
        return chunk;
      }

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('<items>'));

          for (let i = 0; i < totalItems; i += chunkSize) {
            const chunk = createChunk(i, Math.min(i + chunkSize, totalItems));
            controller.enqueue(new TextEncoder().encode(chunk));
          }

          controller.enqueue(new TextEncoder().encode('</items>'));
          controller.close();
        }
      });

      const schema = x.array(
        x.object({
          id: x.string().xpath('./@id'),
          value: x.string().xpath('.')
        }),
        '//item'
      );

      const result = await schema.parse(stream);

      expect(result).toHaveLength(totalItems);
      expect(result[0].id).toBe('0');
      expect(result[999].id).toBe('999');
    });

    it('should handle large streamed documents', async () => {
      const xml = `
        <report>
          <summary>
            <total>1000</total>
            <date>2024-01-01</date>
          </summary>
          <data>
            ${Array.from({ length: 100 }, (_, i) =>
              `<record id="${i}"><value>${i * 100}</value></record>`
            ).join('')}
          </data>
        </report>
      `;

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const bytes = encoder.encode(xml);
          const chunkSize = 1024; // 1KB chunks

          for (let i = 0; i < bytes.length; i += chunkSize) {
            controller.enqueue(bytes.slice(i, i + chunkSize));
          }
          controller.close();
        }
      });

      const schema = x.object({
        total: x.number().xpath('//summary/total'),
        recordCount: x.array(x.string(), '//record/@id').transform(arr => arr.length),
        sumValues: x.array(x.number(), '//record/value').transform(arr =>
          arr.reduce((sum, val) => sum + val, 0)
        )
      });

      const result = await schema.parse(stream);

      expect(result.total).toBe(1000);
      expect(result.recordCount).toBe(100);
      expect(result.sumValues).toBe(495000); // Sum of 0+100+200+...+9900
    });
  });

  describe('Complex Large Data Transformations', () => {
    it('should aggregate large datasets', () => {
      const xml = `
        <sales>
          ${Array.from({ length: 1000 }, (_, i) => {
            const amount = (Math.random() * 1000).toFixed(2);
            const region = ['North', 'South', 'East', 'West'][i % 4];
            return `
              <sale>
                <id>${i}</id>
                <amount>${amount}</amount>
                <region>${region}</region>
              </sale>
            `;
          }).join('')}
        </sales>
      `;

      const saleSchema = x.object({
        id: x.number().xpath('./id').int(),
        amount: x.number().xpath('./amount'),
        region: x.string().xpath('./region')
      });

      const schema = x.array(saleSchema, '//sale').transform(sales => {
        const byRegion = sales.reduce((acc, sale) => {
          if (!acc[sale.region]) {
            acc[sale.region] = { count: 0, total: 0 };
          }
          acc[sale.region].count++;
          acc[sale.region].total += sale.amount;
          return acc;
        }, {} as Record<string, { count: number; total: number }>);

        return {
          totalSales: sales.length,
          totalAmount: sales.reduce((sum, s) => sum + s.amount, 0),
          byRegion,
          averageSale: sales.reduce((sum, s) => sum + s.amount, 0) / sales.length
        };
      });

      const result = schema.parseSync(xml, { maxDepth: 1500 });

      expect(result.totalSales).toBe(1000);
      expect(result.byRegion['North'].count).toBe(250);
      expect(result.byRegion['South'].count).toBe(250);
      expect(result.byRegion['East'].count).toBe(250);
      expect(result.byRegion['West'].count).toBe(250);
    });

    it('should filter and map large datasets', () => {
      const xml = `
        <inventory>
          ${Array.from({ length: 1000 }, (_, i) => `
            <item>
              <sku>SKU-${String(i).padStart(5, '0')}</sku>
              <quantity>${Math.floor(Math.random() * 100)}</quantity>
              <price>${(Math.random() * 500).toFixed(2)}</price>
              <warehouse>${i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C'}</warehouse>
            </item>
          `).join('')}
        </inventory>
      `;

      const itemSchema = x.object({
        sku: x.string().xpath('./sku'),
        quantity: x.number().xpath('./quantity').int(),
        price: x.number().xpath('./price'),
        warehouse: x.string().xpath('./warehouse')
      });

      const schema = x.array(itemSchema, '//item').transform(items => {
        const lowStock = items.filter(item => item.quantity < 10);
        const highValue = items.filter(item => item.price > 250);
        const warehouseA = items.filter(item => item.warehouse === 'A');

        return {
          totalItems: items.length,
          lowStockCount: lowStock.length,
          highValueCount: highValue.length,
          warehouseDistribution: {
            A: warehouseA.length,
            B: items.filter(i => i.warehouse === 'B').length,
            C: items.filter(i => i.warehouse === 'C').length
          },
          totalValue: items.reduce((sum, item) => sum + (item.quantity * item.price), 0)
        };
      });

      const result = schema.parseSync(xml, { maxDepth: 1500 });

      expect(result.totalItems).toBe(1000);
      expect(result.lowStockCount).toBeGreaterThan(0);
      expect(result.highValueCount).toBeGreaterThan(0);
      expect(result.warehouseDistribution.A + result.warehouseDistribution.B + result.warehouseDistribution.C).toBe(1000);
    });
  });

  describe('Edge Cases with Large Files', () => {
    it('should handle large files with empty elements', () => {
      const xml = `
        <data>
          ${Array.from({ length: 1000 }, (_, i) =>
            i % 10 === 0 ? '<item/>' : `<item>${i}</item>`
          ).join('')}
        </data>
      `;

      const schema = x.array(x.string(), '//item');
      const result = schema.parseSync(xml);

      expect(result).toHaveLength(1000);
      expect(result.filter(item => item === '')).toHaveLength(100);
      expect(result.filter(item => item !== '')).toHaveLength(900);
    });

    it('should handle large files with CDATA sections', () => {
      const xml = `
        <posts>
          ${Array.from({ length: 100 }, (_, i) => `
            <post id="${i}">
              <title>Post ${i}</title>
              <content><![CDATA[
                <h1>HTML Content ${i}</h1>
                <p>This is paragraph with special characters: < > & " '</p>
              ]]></content>
            </post>
          `).join('')}
        </posts>
      `;

      const postSchema = x.object({
        id: x.string().xpath('./@id'),
        title: x.string().xpath('./title'),
        content: x.string().xpath('./content')
      });

      const schema = x.array(postSchema, '//post');
      const result = schema.parseSync(xml);

      expect(result).toHaveLength(100);
      expect(result[0].content).toContain('<h1>HTML Content 0</h1>');
      expect(result[0].content).toContain('< > & " \'');
    });
  });
});
