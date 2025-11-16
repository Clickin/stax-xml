import { describe, it, expect } from 'vitest';
import { StaxXmlParserSync } from '../src/StaxXmlParserSync.js';
import { StaxXmlParser } from '../src/StaxXmlParser.js';

describe('Security: Prototype Pollution Protection', () => {
  describe('StaxXmlParserSync', () => {
    it('should prevent prototype pollution via __proto__ attribute', () => {
      const maliciousXml = '<root __proto__="polluted">test</root>';
      const parser = new StaxXmlParserSync(maliciousXml);

      for (const event of parser) {
        if (event.type === 'START_ELEMENT') {
          // Verify __proto__ is stored as a regular property
          expect(event.attributes['__proto__']).toBe('polluted');

          // Verify attributes object has no prototype
          expect(Object.getPrototypeOf(event.attributes)).toBe(null);

          // Verify new objects are not polluted
          const newObj = {};
          expect('polluted' in newObj).toBe(false);
        }
      }
    });

    it('should prevent prototype pollution via constructor attribute', () => {
      const maliciousXml = '<root constructor="malicious">test</root>';
      const parser = new StaxXmlParserSync(maliciousXml);

      for (const event of parser) {
        if (event.type === 'START_ELEMENT') {
          // Verify constructor is stored as a regular property
          expect(event.attributes['constructor']).toBe('malicious');

          // Verify attributes object has no prototype
          expect(Object.getPrototypeOf(event.attributes)).toBe(null);
        }
      }
    });

    it('should prevent prototype pollution via prototype attribute', () => {
      const maliciousXml = '<root prototype="evil">test</root>';
      const parser = new StaxXmlParserSync(maliciousXml);

      for (const event of parser) {
        if (event.type === 'START_ELEMENT') {
          // Verify prototype is stored as a regular property
          expect(event.attributes['prototype']).toBe('evil');

          // Verify attributes object has no prototype
          expect(Object.getPrototypeOf(event.attributes)).toBe(null);
        }
      }
    });

    it('should still handle normal attributes correctly', () => {
      const normalXml = '<root id="123" name="test" class="item">content</root>';
      const parser = new StaxXmlParserSync(normalXml);

      for (const event of parser) {
        if (event.type === 'START_ELEMENT') {
          expect(event.attributes['id']).toBe('123');
          expect(event.attributes['name']).toBe('test');
          expect(event.attributes['class']).toBe('item');

          // Verify attributes object has no prototype
          expect(Object.getPrototypeOf(event.attributes)).toBe(null);
        }
      }
    });
  });

  describe('StaxXmlParser (async)', () => {
    it('should prevent prototype pollution via __proto__ attribute', async () => {
      const maliciousXml = '<root __proto__="polluted">test</root>';
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(maliciousXml));
          controller.close();
        }
      });

      const parser = new StaxXmlParser(stream);

      for await (const event of parser) {
        if (event.type === 'START_ELEMENT') {
          // Verify __proto__ is stored as a regular property
          expect(event.attributes['__proto__']).toBe('polluted');

          // Verify attributes object has no prototype
          expect(Object.getPrototypeOf(event.attributes)).toBe(null);

          // Verify new objects are not polluted
          const newObj = {};
          expect('polluted' in newObj).toBe(false);
        }
      }
    });

    it('should prevent pollution with multiple dangerous attributes', async () => {
      const maliciousXml = '<root __proto__="p1" constructor="p2" prototype="p3">test</root>';
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(maliciousXml));
          controller.close();
        }
      });

      const parser = new StaxXmlParser(stream);

      for await (const event of parser) {
        if (event.type === 'START_ELEMENT') {
          // All dangerous properties should be regular properties
          expect(event.attributes['__proto__']).toBe('p1');
          expect(event.attributes['constructor']).toBe('p2');
          expect(event.attributes['prototype']).toBe('p3');

          // Verify attributes object has no prototype
          expect(Object.getPrototypeOf(event.attributes)).toBe(null);
        }
      }
    });
  });

  describe('attributesWithPrefix protection', () => {
    it('should prevent pollution in attributesWithPrefix object', () => {
      const maliciousXml = '<root __proto__="polluted" xmlns:evil="http://evil.com">test</root>';
      const parser = new StaxXmlParserSync(maliciousXml);

      for (const event of parser) {
        if (event.type === 'START_ELEMENT') {
          // Verify attributesWithPrefix also uses Object.create(null)
          expect(Object.getPrototypeOf(event.attributesWithPrefix)).toBe(null);
        }
      }
    });
  });
});
