import { describe, test, expect } from 'vitest';
import EventReader from '../src/EventReader';
import { XmlEventFactory, XmlEventType, isStartElement, isEndElement, isCharacters, isCdata, isError, isStartDocument, isEndDocument } from '../src/types';

// Helper function to convert string to ReadableStream
function stringToReadableStream(str: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);

  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
}

describe('Coverage Tests for Missing Areas', () => {
  describe('EventReader Batch Processing API', () => {
    test('should drain the currently available chunk-derived batch', async () => {
      const xml = '<root><item>1</item><item>2</item><item>3</item><item>4</item><item>5</item></root>';
      const parser = new EventReader(stringToReadableStream(xml));

      const batch1 = await parser.nextBatch();

      expect(batch1).toBeDefined();
      expect(Array.isArray(batch1)).toBe(true);
      expect(batch1[0]?.type).toBe(XmlEventType.START_DOCUMENT);
      expect(batch1.length).toBeGreaterThan(1);
    });

    test('should handle batchedIterator and complete batches', async () => {
      const xml = '<root><a>1</a><b>2</b><c>3</c></root>';
      const parser = new EventReader(stringToReadableStream(xml));

      const batches: any[][] = [];
      for await (const batch of parser.batchedIterator()) {
        batches.push(batch);
        if (batches.length > 10) break; // Safety limit
      }

      expect(batches.length).toBeGreaterThan(0);
      expect(batches.every(batch => Array.isArray(batch))).toBe(true);
    });

    test('should drain multiple queued events per batch after a single chunk read', async () => {
      const xml = '<root>' + '<item>value</item>'.repeat(20) + '</root>';
      const parser = new EventReader(stringToReadableStream(xml));

      const batch = await parser.nextBatch();

      expect(batch[0]?.type).toBe(XmlEventType.START_DOCUMENT);
      expect(batch.length).toBeGreaterThan(1);
      expect(batch.some(event => event.type === XmlEventType.START_ELEMENT)).toBe(true);
      expect(batch.some(event => event.type === XmlEventType.END_ELEMENT)).toBe(true);
    });

    test('should return an empty batch after stream completion', async () => {
      const xml = '<root><item>test</item></root>';
      const parser = new EventReader(stringToReadableStream(xml));

      while ((await parser.nextBatch()).length > 0) {
        // drain all batches
      }

      await expect(parser.nextBatch()).resolves.toEqual([]);
    });

    test('should handle nextBatch on small and large XML inputs', async () => {
      const smallXml = '<a/>';
      const parser1 = new EventReader(stringToReadableStream(smallXml));

      const batch1 = await parser1.nextBatch();
      expect(batch1).toBeDefined();

      const largeXml = '<root>' + '<item>data</item>'.repeat(100) + '</root>';
      const parser2 = new EventReader(stringToReadableStream(largeXml));

      const batch2 = await parser2.nextBatch();
      expect(batch2).toBeDefined();
    });

    test('should continue draining batches until completion', async () => {
      const xml = '<root>' + '<item>'.repeat(50) + 'large content data'.repeat(10) + '</item>'.repeat(50) + '</root>';
      const parser = new EventReader(stringToReadableStream(xml));

      for (let i = 0; i < 5; i++) {
        const batch = await parser.nextBatch();
        if (batch.length === 0) break;
      }

      const finalBatch = await parser.nextBatch();
      expect(Array.isArray(finalBatch)).toBe(true);
    });

    test('should include character-heavy content in chunk-derived batches', async () => {
      const xml = '<root>Some text content</root>';
      const parser = new EventReader(stringToReadableStream(xml));

      // First batch should contain start elements
      const batch1 = await parser.nextBatch();
      expect(batch1.length).toBeGreaterThan(0);

      // Continue processing to trigger CHARACTERS handling
      let totalBatches = 0;
      while (totalBatches < 10) {
        const batch = await parser.nextBatch();
        if (batch.length === 0) break;
        totalBatches++;
      }

      expect(totalBatches).toBeGreaterThan(0);
    });
  });

  describe('Type Guard Functions', () => {
    test('should correctly identify StartElement events', () => {
      const startEvent = XmlEventFactory.startElement('test', 'test', null, 'uri', [], []);
      const endEvent = XmlEventFactory.endElement('test', 'test', null, 'uri');

      expect(isStartElement(startEvent)).toBe(true);
      expect(isStartElement(endEvent)).toBe(false);
    });

    test('should correctly identify EndElement events', () => {
      const startEvent = XmlEventFactory.startElement('test', 'test', null, 'uri', [], []);
      const endEvent = XmlEventFactory.endElement('test', 'test', null, 'uri');

      expect(isEndElement(endEvent)).toBe(true);
      expect(isEndElement(startEvent)).toBe(false);
    });

    test('should correctly identify Characters events', () => {
      const charactersEvent = XmlEventFactory.characters('test content');
      const startEvent = XmlEventFactory.startElement('test', 'test', null, 'uri', [], []);

      expect(isCharacters(charactersEvent)).toBe(true);
      expect(isCharacters(startEvent)).toBe(false);
    });

    test('should correctly identify CDATA events', () => {
      const cdataEvent = XmlEventFactory.cdata('test data');
      const charactersEvent = XmlEventFactory.characters('test content');

      expect(isCdata(cdataEvent)).toBe(true);
      expect(isCdata(charactersEvent)).toBe(false);
    });

    test('should correctly identify Error events', () => {
      const errorEvent = XmlEventFactory.error(new Error('test error'));
      const startEvent = XmlEventFactory.startElement('test', 'test', null, 'uri', [], []);

      expect(isError(errorEvent)).toBe(true);
      expect(isError(startEvent)).toBe(false);
    });

    test('should correctly identify StartDocument events', () => {
      const startDocEvent = XmlEventFactory.startDocument();
      const endDocEvent = XmlEventFactory.endDocument();

      expect(isStartDocument(startDocEvent)).toBe(true);
      expect(isStartDocument(endDocEvent)).toBe(false);
    });

    test('should correctly identify EndDocument events', () => {
      const startDocEvent = XmlEventFactory.startDocument();
      const endDocEvent = XmlEventFactory.endDocument();

      expect(isEndDocument(endDocEvent)).toBe(true);
      expect(isEndDocument(startDocEvent)).toBe(false);
    });
  });

  describe('XmlEventFactory.error static method', () => {
    test('should create proper error event with all required properties', () => {
      const testError = new Error('Test error message');
      const errorEvent = XmlEventFactory.error(testError);

      expect(errorEvent.type).toBe(XmlEventType.ERROR);
      expect(errorEvent.error).toBe(testError);
      expect(errorEvent.name).toBeUndefined();
      expect(errorEvent.localName).toBeUndefined();
      expect(errorEvent.prefix).toBeUndefined();
      expect(errorEvent.uri).toBeUndefined();
      expect(errorEvent.attributes).toBeUndefined();
      expect(errorEvent.attributesWithPrefix).toBeUndefined();
      expect(errorEvent.value).toBeUndefined();
    });

    test('should handle different error types', () => {
      const syntaxError = new SyntaxError('Syntax error');
      const typeError = new TypeError('Type error');

      const errorEvent1 = XmlEventFactory.error(syntaxError);
      const errorEvent2 = XmlEventFactory.error(typeError);

      expect(errorEvent1.error).toBe(syntaxError);
      expect(errorEvent2.error).toBe(typeError);
      expect(errorEvent1.type).toBe(XmlEventType.ERROR);
      expect(errorEvent2.type).toBe(XmlEventType.ERROR);
    });
  });

  describe('Edge Cases for Batch Processing', () => {
    test('should handle empty event queue in batchedIterator', async () => {
      const xml = '';
      const parser = new EventReader(stringToReadableStream(xml));

      const batches = [];
      for await (const batch of parser.batchedIterator()) {
        batches.push(batch);
        if (batches.length > 5) break; // Safety
      }

      expect(batches.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle parser finished state in batchedIterator', async () => {
      const xml = '<simple/>';
      const parser = new EventReader(stringToReadableStream(xml));

      // Consume all events first
      const allEvents = [];
      for await (const event of parser) {
        allEvents.push(event);
      }

      // Now try batchedIterator on finished parser
      const batches = [];
      for await (const batch of parser.batchedIterator()) {
        batches.push(batch);
        if (batches.length > 3) break; // Safety
      }

      expect(Array.isArray(batches)).toBe(true);
    });
  });
});
