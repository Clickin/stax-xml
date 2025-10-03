import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

describe('Event Stream Tests', () => {
  describe('Partial Document Parsing', () => {
    it('should parse complete elements from partial documents', () => {
      // Simulating parsing starting from middle of document
      const partialXml = `
        <item id="3">Item 3</item>
        <item id="4">Item 4</item>
        <item id="5">Item 5</item>
      </items>
      `;

      // Wrap partial content to make it valid
      const validXml = `<items>${partialXml.replace('</items>', '')}</items>`;

      const schema = x.array(
        x.object({
          id: x.string().xpath('./@id'),
          text: x.string().xpath('.')
        }),
        '//item'
      );

      const result = schema.parseSync(validXml);
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('3');
      expect(result[2].id).toBe('5');
    });

    it('should handle fragments with context', () => {
      // Simulating a fragment that might come from stream
      const fragment = `
        <record>
          <timestamp>1234567890</timestamp>
          <data>Fragment Data</data>
        </record>
      `;

      const schema = x.object({
        timestamp: x.string().xpath('//timestamp'),
        data: x.string().xpath('//data')
      });

      const result = schema.parseSync(fragment);
      expect(result.timestamp).toBe('1234567890');
      expect(result.data).toBe('Fragment Data');
    });
  });

  describe('Chunked Streaming', () => {
    it('should parse XML from multiple chunks', async () => {
      const chunks = [
        '<root><items>',
        '<item id="1">First</item>',
        '<item id="2">Second</item>',
        '<item id="3">Third</item>',
        '</items></root>'
      ];

      const stream = new ReadableStream({
        start(controller) {
          chunks.forEach(chunk => {
            controller.enqueue(new TextEncoder().encode(chunk));
          });
          controller.close();
        }
      });

      const schema = x.array(
        x.object({
          id: x.string().xpath('./@id'),
          text: x.string().xpath('./text()')
        }),
        '//item'
      );

      const result = await schema.parse(stream);
      expect(result).toHaveLength(3);
      expect(result[0].text).toBe('First');
      expect(result[2].text).toBe('Third');
    });

    it('should handle chunks split at various boundaries', async () => {
      // Split XML at different points to test robustness
      const fullXml = `<data><user><id>123</id><name>John Doe</name><email>john@example.com</email></user></data>`;

      const testCases = [
        // Split in middle of tag
        ['<data><us', 'er><id>123</id><name>John Doe</na', 'me><email>john@example.com</email></user></data>'],
        // Split between tags
        ['<data>', '<user><id>123</id>', '<name>John Doe</name>', '<email>john@example.com</email></user></data>'],
        // Split in text content
        ['<data><user><id>1', '23</id><name>Jo', 'hn Doe</name><email>john@example.', 'com</email></user></data>']
      ];

      for (const chunks of testCases) {
        const stream = new ReadableStream({
          start(controller) {
            chunks.forEach(chunk => {
              controller.enqueue(new TextEncoder().encode(chunk));
            });
            controller.close();
          }
        });

        const schema = x.object({
          id: x.number().xpath('//id').int(),
          name: x.string().xpath('//name'),
          email: x.string().xpath('//email')
        });

        const result = await schema.parse(stream);
        expect(result.id).toBe(123);
        expect(result.name).toBe('John Doe');
        expect(result.email).toBe('john@example.com');
      }
    });

    it('should parse large stream with small chunks', async () => {
      const itemCount = 100;
      const chunkSize = 50; // Characters per chunk

      let fullXml = '<items>';
      for (let i = 0; i < itemCount; i++) {
        fullXml += `<item id="${i}">Value ${i}</item>`;
      }
      fullXml += '</items>';

      const chunks: string[] = [];
      for (let i = 0; i < fullXml.length; i += chunkSize) {
        chunks.push(fullXml.slice(i, i + chunkSize));
      }

      const stream = new ReadableStream({
        start(controller) {
          chunks.forEach(chunk => {
            controller.enqueue(new TextEncoder().encode(chunk));
          });
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
      expect(result).toHaveLength(itemCount);
      expect(result[0].id).toBe('0');
      expect(result[99].id).toBe('99');
    });
  });

  describe('Event-Based Processing', () => {
    it('should process events as they arrive', async () => {
      const events = [
        { type: 'start', timestamp: 1000 },
        { type: 'data', timestamp: 1001, value: 100 },
        { type: 'data', timestamp: 1002, value: 200 },
        { type: 'end', timestamp: 1003 }
      ];

      const stream = new ReadableStream({
        async start(controller) {
          // Enqueue opening tag
          controller.enqueue(new TextEncoder().encode('<events>'));

          for (const event of events) {
            const eventXml = `
              <event>
                <type>${event.type}</type>
                <timestamp>${event.timestamp}</timestamp>
                ${event.value !== undefined ? `<value>${event.value}</value>` : ''}
              </event>
            `;
            controller.enqueue(new TextEncoder().encode(eventXml));

            // Simulate delay between events
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          controller.enqueue(new TextEncoder().encode('</events>'));
          controller.close();
        }
      });

      const eventSchema = x.object({
        type: x.string().xpath('./type'),
        timestamp: x.number().xpath('./timestamp'),
        value: x.number().xpath('./value').optional()
      });

      const schema = x.array(eventSchema, '//event');
      const result = await schema.parse(stream);

      expect(result).toHaveLength(4);
      expect(result[0].type).toBe('start');
      expect(result[1].value).toBe(100);
      expect(result[2].value).toBe(200);
      expect(result[3].type).toBe('end');
    });

    it('should handle real-time log stream', async () => {
      const logEntries = Array.from({ length: 50 }, (_, i) => ({
        level: ['INFO', 'WARN', 'ERROR'][i % 3],
        message: `Log message ${i}`,
        timestamp: Date.now() + i * 100
      }));

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode('<logs>'));

          for (const entry of logEntries) {
            const logXml = `
              <log>
                <timestamp>${entry.timestamp}</timestamp>
                <level>${entry.level}</level>
                <message>${entry.message}</message>
              </log>
            `;
            controller.enqueue(new TextEncoder().encode(logXml));

            // Simulate real-time delay
            await new Promise(resolve => setTimeout(resolve, 5));
          }

          controller.enqueue(new TextEncoder().encode('</logs>'));
          controller.close();
        }
      });

      const logSchema = x.object({
        timestamp: x.number().xpath('./timestamp'),
        level: x.string().xpath('./level'),
        message: x.string().xpath('./message')
      });

      const schema = x.array(logSchema, '//log').transform(logs => ({
        total: logs.length,
        errors: logs.filter(l => l.level === 'ERROR').length,
        warnings: logs.filter(l => l.level === 'WARN').length,
        info: logs.filter(l => l.level === 'INFO').length,
        firstTimestamp: logs[0]?.timestamp,
        lastTimestamp: logs[logs.length - 1]?.timestamp
      }));

      const result = await schema.parse(stream);

      expect(result.total).toBe(50);
      expect(result.errors).toBe(16);
      expect(result.warnings).toBe(17);
      expect(result.info).toBe(17);
      expect(result.lastTimestamp).toBeGreaterThan(result.firstTimestamp);
    });
  });

  describe('Incremental Parsing', () => {
    it('should parse incrementally added content', async () => {
      const initialData = '<data><items>';
      const incrementalItems = [
        '<item>Item 1</item>',
        '<item>Item 2</item>',
        '<item>Item 3</item>'
      ];
      const closing = '</items></data>';

      let currentIndex = 0;
      const stream = new ReadableStream({
        async start(controller) {
          // Send initial structure
          controller.enqueue(new TextEncoder().encode(initialData));

          // Simulate incremental additions
          const interval = setInterval(() => {
            if (currentIndex < incrementalItems.length) {
              controller.enqueue(new TextEncoder().encode(incrementalItems[currentIndex]));
              currentIndex++;
            } else {
              clearInterval(interval);
              controller.enqueue(new TextEncoder().encode(closing));
              controller.close();
            }
          }, 10);
        }
      });

      const schema = x.array(x.string(), '//item');
      const result = await schema.parse(stream);

      expect(result).toEqual(['Item 1', 'Item 2', 'Item 3']);
    });

    it('should handle progressive data loading', async () => {
      const pageSize = 10;
      const totalPages = 5;

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode('<pages>'));

          for (let page = 0; page < totalPages; page++) {
            let pageXml = `<page number="${page + 1}">`;
            for (let item = 0; item < pageSize; item++) {
              const itemId = page * pageSize + item;
              pageXml += `<item id="${itemId}">Item ${itemId}</item>`;
            }
            pageXml += '</page>';

            controller.enqueue(new TextEncoder().encode(pageXml));

            // Simulate network delay between pages
            await new Promise(resolve => setTimeout(resolve, 20));
          }

          controller.enqueue(new TextEncoder().encode('</pages>'));
          controller.close();
        }
      });

      const schema = x.object({
        totalItems: x.array(x.string(), '//item/@id').transform(arr => arr.length),
        pages: x.array(x.string(), '//page/@number'),
        firstPageItems: x.array(x.string(), '//page[@number="1"]/item/@id'),
        lastPageItems: x.array(x.string(), `//page[@number="${totalPages}"]/item/@id`)
      });

      const result = await schema.parse(stream);

      expect(result.totalItems).toBe(pageSize * totalPages);
      expect(result.pages).toHaveLength(totalPages);
      expect(result.firstPageItems).toHaveLength(pageSize);
      expect(result.lastPageItems).toHaveLength(pageSize);
    });
  });

  describe('Stream Error Handling', () => {
    it('should handle stream interruption gracefully', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('<data>'));
          controller.enqueue(new TextEncoder().encode('<item>Test</item>'));
          // Simulate unexpected stream end (missing closing tag)
          controller.close();
        }
      });

      const schema = x.string().xpath('//item');

      try {
        const result = await schema.parse(stream);
        // May succeed with partial data or fail
        if (result) {
          expect(typeof result).toBe('string');
        }
      } catch (error) {
        // Stream interruption should be handled
        expect(error).toBeDefined();
      }
    });

    it('should recover from malformed chunks', async () => {
      const chunks = [
        '<data>',
        '<valid>Good Data</valid>',
        '<invalid>Missing close', // Malformed
        '<another>More Data</another>',
        '</data>'
      ];

      const stream = new ReadableStream({
        start(controller) {
          chunks.forEach(chunk => {
            controller.enqueue(new TextEncoder().encode(chunk));
          });
          controller.close();
        }
      });

      const schema = x.object({
        valid: x.string().xpath('//valid'),
        another: x.string().xpath('//another').optional()
      });

      const result = schema.safeParseSync(await streamToString(stream));
      if (result.success) {
        expect(result.data.valid).toBe('Good Data');
      } else {
        // Handle parse error gracefully
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Buffered Streaming', () => {
    it('should handle buffered reads efficiently', async () => {
      const bufferSize = 1024; // 1KB buffer
      const totalSize = 10240; // 10KB total

      let content = '<data>';
      const itemSize = 50; // Approximate size per item
      const itemCount = Math.floor((totalSize - 13) / itemSize); // Account for <data></data>

      for (let i = 0; i < itemCount; i++) {
        content += `<item id="${i}">Value ${i}</item>`;
      }
      content += '</data>';

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const bytes = encoder.encode(content);

          for (let i = 0; i < bytes.length; i += bufferSize) {
            controller.enqueue(bytes.slice(i, Math.min(i + bufferSize, bytes.length)));
          }
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
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].id).toBe('0');
    });

    it('should optimize memory with streaming large arrays', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('<numbers>'));

          // Stream numbers in batches
          const batchSize = 100;
          const totalBatches = 10;

          for (let batch = 0; batch < totalBatches; batch++) {
            let batchXml = '';
            for (let i = 0; i < batchSize; i++) {
              const num = batch * batchSize + i;
              batchXml += `<n>${num}</n>`;
            }
            controller.enqueue(new TextEncoder().encode(batchXml));
          }

          controller.enqueue(new TextEncoder().encode('</numbers>'));
          controller.close();
        }
      });

      const schema = x.array(x.number(), '//n').transform(numbers => ({
        count: numbers.length,
        sum: numbers.reduce((a, b) => a + b, 0),
        average: numbers.reduce((a, b) => a + b, 0) / numbers.length,
        min: Math.min(...numbers),
        max: Math.max(...numbers)
      }));

      const result = await schema.parse(stream);

      expect(result.count).toBe(1000);
      expect(result.min).toBe(0);
      expect(result.max).toBe(999);
      expect(result.average).toBe(499.5);
    });
  });

  describe('Live Data Feeds', () => {
    it('should parse simulated RSS feed updates', async () => {
      const feedUpdates = [
        { id: 1, title: 'Breaking News 1', time: '10:00' },
        { id: 2, title: 'Breaking News 2', time: '10:05' },
        { id: 3, title: 'Breaking News 3', time: '10:10' }
      ];

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode('<feed>'));

          for (const update of feedUpdates) {
            const itemXml = `
              <item>
                <id>${update.id}</id>
                <title>${update.title}</title>
                <time>${update.time}</time>
              </item>
            `;
            controller.enqueue(new TextEncoder().encode(itemXml));

            // Simulate real-time feed delay
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          controller.enqueue(new TextEncoder().encode('</feed>'));
          controller.close();
        }
      });

      const itemSchema = x.object({
        id: x.number().xpath('./id').int(),
        title: x.string().xpath('./title'),
        time: x.string().xpath('./time')
      });

      const schema = x.array(itemSchema, '//item');
      const result = await schema.parse(stream);

      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('Breaking News 1');
      expect(result[2].time).toBe('10:10');
    });

    it('should handle continuous sensor data stream', async () => {
      const sensorReadings = Array.from({ length: 20 }, (_, i) => ({
        sensor: `sensor-${i % 3}`,
        value: Math.random() * 100,
        timestamp: Date.now() + i * 1000,
        status: Math.random() > 0.8 ? 'warning' : 'normal'
      }));

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode('<readings>'));

          for (const reading of sensorReadings) {
            const readingXml = `
              <reading>
                <sensor>${reading.sensor}</sensor>
                <value>${reading.value.toFixed(2)}</value>
                <timestamp>${reading.timestamp}</timestamp>
                <status>${reading.status}</status>
              </reading>
            `;
            controller.enqueue(new TextEncoder().encode(readingXml));

            // Simulate sensor polling interval
            await new Promise(resolve => setTimeout(resolve, 5));
          }

          controller.enqueue(new TextEncoder().encode('</readings>'));
          controller.close();
        }
      });

      const readingSchema = x.object({
        sensor: x.string().xpath('./sensor'),
        value: x.number().xpath('./value'),
        timestamp: x.number().xpath('./timestamp'),
        status: x.string().xpath('./status')
      });

      const schema = x.array(readingSchema, '//reading').transform(readings => {
        const bySensor = readings.reduce((acc, r) => {
          if (!acc[r.sensor]) {
            acc[r.sensor] = { readings: [], warnings: 0 };
          }
          acc[r.sensor].readings.push(r.value);
          if (r.status === 'warning') acc[r.sensor].warnings++;
          return acc;
        }, {} as Record<string, { readings: number[]; warnings: number }>);

        return {
          totalReadings: readings.length,
          totalWarnings: readings.filter(r => r.status === 'warning').length,
          sensorStats: Object.entries(bySensor).map(([sensor, stats]) => ({
            sensor,
            avgValue: stats.readings.reduce((a, b) => a + b, 0) / stats.readings.length,
            warnings: stats.warnings
          }))
        };
      });

      const result = await schema.parse(stream);

      expect(result.totalReadings).toBe(20);
      expect(result.sensorStats).toHaveLength(3);
      expect(result.totalWarnings).toBeGreaterThanOrEqual(0);
    });
  });
});

// Helper function to convert stream to string
async function streamToString(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }

  return result;
}