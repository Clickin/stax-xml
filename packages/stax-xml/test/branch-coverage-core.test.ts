import { describe, expect, it } from 'vitest';
import {
  StaxXmlParser,
  StaxXmlParserSync,
  StaxXmlCursorReader,
  StaxXmlWriter,
  StaxXmlWriterSync,
  StaxXmlWriterSyncSink,
  createStaxXmlParser,
  CursorEventType,
  XmlEventType,
  type AnyXmlEvent
} from '../src/index';
import { createBunSyncTextSink } from '../src/adapters/bun';
import { createDenoSyncTextSink } from '../src/adapters/deno';
import { createNodeFileSyncTextSink, createNodeSyncTextSink } from '../src/adapters/node';
import { CursorEventView } from '../src/cursor/CursorEventView';

function streamFrom(xml: string, chunkSize?: number): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(xml);

  return new ReadableStream({
    start(controller) {
      if (!chunkSize) {
        controller.enqueue(bytes);
      } else {
        for (let i = 0; i < bytes.length; i += chunkSize) {
          controller.enqueue(bytes.slice(i, i + chunkSize));
        }
      }
      controller.close();
    }
  });
}

function createAsyncWriter(options?: ConstructorParameters<typeof StaxXmlWriter>[1]) {
  const chunks: Uint8Array[] = [];
  const writer = new StaxXmlWriter(
    new WritableStream<Uint8Array>({
      write(chunk) {
        chunks.push(chunk.slice());
      }
    }),
    options
  );

  return {
    writer,
    output() {
      return chunks.map(chunk => new TextDecoder().decode(chunk)).join('');
    }
  };
}

async function drainBatches(parser: StaxXmlParser): Promise<void> {
  while ((await parser.nextBatch()).length > 0) { /* drain */ }
}

describe('core branch coverage guards', () => {
  describe('async parser branches', () => {
    it('should reject non-web streams', () => {
      expect(() => new StaxXmlParser({} as ReadableStream<Uint8Array>))
        .toThrow('xmlStream must be a web standard ReadableStream');
    });

    it('should support batched iteration until the empty finished batch', async () => {
      const parser = new StaxXmlParser(streamFrom('<root><a/><b/></root>'), {
        initialQueueCapacity: 1
      });
      const batches: number[][] = [];

      for await (const batch of parser.batchedIterator()) {
        batches.push(batch.map(event => event.type));
      }

      expect(batches.flat()).toEqual([
        XmlEventType.START_DOCUMENT,
        XmlEventType.START_ELEMENT,
        XmlEventType.START_ELEMENT,
        XmlEventType.END_ELEMENT,
        XmlEventType.START_ELEMENT,
        XmlEventType.END_ELEMENT,
        XmlEventType.END_ELEMENT,
        XmlEventType.END_DOCUMENT
      ]);
      expect(await parser.nextBatch()).toEqual([]);
    });

    it('should filter characters, attributes, and cdata events', async () => {
      const parser = new StaxXmlParser(
        streamFrom('<root attr="value"><![CDATA[cdata]]><child>text</child></root>'),
        {
          eventFilter: {
            includeCharacters: false,
            includeCdata: false,
            includeAttributes: false
          }
        }
      );
      const events: AnyXmlEvent[] = [];

      for await (const event of parser) {
        events.push(event);
      }

      expect(events.map(event => event.type)).toEqual([
        XmlEventType.START_DOCUMENT,
        XmlEventType.START_ELEMENT,
        XmlEventType.START_ELEMENT,
        XmlEventType.END_ELEMENT,
        XmlEventType.END_ELEMENT,
        XmlEventType.END_DOCUMENT
      ]);
      expect(events[1]?.attributes).toEqual({});
    });

    it('should surface malformed final chunks through nextBatch', async () => {
      const parser = new StaxXmlParser(streamFrom('<root', 2));

      await expect(drainBatches(parser)).rejects.toThrow('Unclosed start tag');
      await expect(parser.nextBatch()).rejects.toThrow('Unclosed start tag');
      expect(() => parser.next()).toThrow('Unclosed start tag');
    });

    it('should surface unclosed final markup variants', async () => {
      const cases: Array<[string, string]> = [
        ['<?xml version="1.0"', 'Unclosed XML declaration'],
        ['<root><!-- comment', 'Unclosed comment'],
        ['<root><![CDATA[text', 'Unclosed CDATA section'],
        ['<!DOCTYPE root', 'Unclosed DOCTYPE declaration'],
        ['<root><?pi data', 'Unclosed processing instruction'],
        ['<root></root', 'Unclosed end tag'],
        ['</root>', 'No open elements'],
        ['<root attr=', 'Unclosed start tag'],
        ['<root><child></root>', 'Expected </child>']
      ];

      for (const [xml, message] of cases) {
        const parser = new StaxXmlParser(streamFrom(xml));
        await expect(drainBatches(parser)).rejects.toThrow(message);
      }
    });

    it('should decode custom entities and leave unmatched entities unchanged', async () => {
      const parser = new StaxXmlParser(
        streamFrom('<root attr="&copy; &unknown;">&copy; &unknown;</root>'),
        { addEntities: [{ entity: '&copy;', value: 'C' }] }
      );
      const events: AnyXmlEvent[] = [];

      for await (const event of parser) {
        events.push(event);
      }

      const start = events.find(event => event.type === XmlEventType.START_ELEMENT);
      const text = events.find(event => event.type === XmlEventType.CHARACTERS);
      expect(start?.attributes).toEqual({ attr: 'C &unknown;' });
      expect(text?.value).toBe('C &unknown;');
    });

    it('should keep parser factory defaults and buffered batch leftovers stable', async () => {
      const parser = createStaxXmlParser(streamFrom('<root><a/></root>'));

      await expect(parser.next()).resolves.toMatchObject({
        value: { type: XmlEventType.START_DOCUMENT },
        done: false
      });
      const remaining = await parser.nextBatch();

      expect(remaining.map(event => event.type)).toEqual([
        XmlEventType.START_ELEMENT,
        XmlEventType.START_ELEMENT,
        XmlEventType.END_ELEMENT,
        XmlEventType.END_ELEMENT
      ]);
      expect((await parser.nextBatch()).map(event => event.type)).toEqual([
        XmlEventType.END_DOCUMENT
      ]);
    });
  });

  describe('sync parser branches', () => {
    it('should cover filters and top-level trailing text', () => {
      const filtered = Array.from(new StaxXmlParserSync('<root attr="value"><![CDATA[cdata]]>text</root>', {
        eventFilter: {
          includeAttributes: false,
          includeCharacters: false,
          includeCdata: false
        }
      }));

      expect(filtered.map(event => event.type)).toEqual([
        XmlEventType.START_DOCUMENT,
        XmlEventType.START_ELEMENT,
        XmlEventType.END_ELEMENT,
        XmlEventType.END_DOCUMENT
      ]);
      expect(filtered[1]?.attributes).toEqual({});

      const trailing = Array.from(new StaxXmlParserSync(' text '));
      expect(trailing.map(event => event.type)).toEqual([
        XmlEventType.START_DOCUMENT,
        XmlEventType.CHARACTERS,
        XmlEventType.END_DOCUMENT
      ]);

    });

    it('should throw for malformed sync markup variants', () => {
      const cases: Array<[string, string]> = [
        ['<root></root', 'Unclosed end tag'],
        ['</root>', 'No open elements'],
        ['<root><![CDATA[text', 'Unclosed CDATA section'],
        ['<root><!-- comment', 'Unclosed comment'],
        ['<!DOCTYPE html', 'Unclosed DOCTYPE declaration'],
        ['<root><?pi data', 'Unclosed processing instruction'],
        ['<root attr=', 'Unclosed start tag'],
        ['<root><child></root>', 'Expected </child>']
      ];

      for (const [xml, message] of cases) {
        expect(() => Array.from(new StaxXmlParserSync(xml))).toThrow(message);
      }
    });

    it('should decode custom entities and preserve unmatched replacements', () => {
      const parser = new StaxXmlParserSync(
        '<root attr="&copy; &unknown;">&copy; &unknown;</root>',
        { addEntities: [{ entity: '&copy;', value: 'C' }] }
      );
      const events = Array.from(parser);

      expect(events.find(event => event.type === XmlEventType.START_ELEMENT)?.attributes)
        .toEqual({ attr: 'C &unknown;' });
      expect(events.find(event => event.type === XmlEventType.CHARACTERS)?.value)
        .toBe('C &unknown;');
    });

    it('should expose iterator return and filtered-empty batch control flow', () => {
      const returned = new StaxXmlParserSync('<root/>');
      expect(returned.return()).toEqual({ value: undefined, done: true });
      expect(returned.next()).toEqual({ value: undefined, done: true });

      const filtered = Array.from(new StaxXmlParserSync('text', {
        eventFilter: {
          includeAttributes: true,
          includeCharacters: false,
          includeCdata: true
        }
      }));
      expect(filtered.map(event => event.type)).toEqual([
        XmlEventType.START_DOCUMENT,
        XmlEventType.END_DOCUMENT
      ]);

      const internal = new StaxXmlParserSync('<root/>') as unknown as {
        parser: { nextBatch(): boolean };
        materializer: { materializeBatch(): AnyXmlEvent[] };
      };
      let parserCalls = 0;
      let materializerCalls = 0;
      internal.parser = {
        nextBatch() {
          parserCalls++;
          return parserCalls <= 2;
        }
      };
      internal.materializer = {
        materializeBatch() {
          materializerCalls++;
          return materializerCalls === 1
            ? []
            : [{ type: XmlEventType.START_DOCUMENT }];
        }
      };

      expect((internal as unknown as StaxXmlParserSync).next()).toEqual({
        value: { type: XmlEventType.START_DOCUMENT },
        done: false
      });
    });
  });

  describe('cursor event view branches', () => {
    it('should reject non-string sync cursor input', () => {
      expect(() => new StaxXmlCursorReader(null as unknown as string))
        .toThrow('xml must be a string');
    });

    it('should cover defensive cursor view accessors', () => {
      const view = new CursorEventView();

      expect(view.getAttributeValue('missing')).toBeUndefined();

      view.moveTo({
        type: XmlEventType.START_ELEMENT,
        name: 'root',
        attributes: {
          plain: 'a',
          'p:name': 'b'
        }
      });

      expect(view.getAttributeLocalName(0)).toBe('plain');
      expect(view.getAttributePrefix(0)).toBeUndefined();
      expect(view.getAttributeLocalName(1)).toBe('name');
      expect(view.getAttributePrefix(1)).toBe('p');
      expect(view.getAttributeValue(99)).toBeUndefined();
      expect(view.getAttributeUri(99)).toBeUndefined();

      view.moveTo({ type: XmlEventType.ERROR, error: new Error('boom') });
      expect(view.eventType()).toBe(CursorEventType.ERROR);
    });
  });

  describe('writer branches', () => {
    it('should cover sync writer closed/error guards and option branches', () => {
      const writer = new StaxXmlWriterSync({
        prettyPrint: true,
        autoEncodeEntities: false
      });

      writer.writeStartDocument('1.0');
      writer.writeStartElement('root');
      writer.writeNamespace('', 'urn:default');
      writer.writeAttribute('id', '<raw>', 'p');
      writer.writeCharacters('');
      writer.writeCData('content');
      writer.writeComment('ok');
      writer.writeProcessingInstruction('pi');
      writer.writeEndDocument();
      writer.writeEndDocument();

      expect(writer.getXmlString()).toContain('p:id="<raw>"');
      expect(() => writer.writeCharacters('after')).toThrow('closed or in error');
      expect(() => writer.writeCData('after')).toThrow('closed or in error');
      expect(() => writer.writeComment('after')).toThrow('closed or in error');
      expect(() => writer.writeProcessingInstruction('after')).toThrow('closed or in error');
      writer.writeRaw('after');
      expect(writer.getXmlString()).not.toContain('after');
    });

    it('should cover sync writer namespace attributes, invalid content, and custom entities', () => {
      new StaxXmlWriterSync({
        addEntities: [
          { entity: '', value: 'ignored' },
          { entity: '@empty@', value: '' }
        ]
      });

      const writer = new StaxXmlWriterSync({
        addEntities: [{ entity: '@copy@', value: '(c)' }]
      });

      writer.writeStartDocument('1.0', 'utf-16');
      writer.writeStartElement('root', {
        prefix: 'r',
        uri: 'urn:r',
        attributes: {
          skip: undefined,
          plain: 'A&B',
          attr: { prefix: 'r', value: '@copy@' },
          local: { value: 'local' }
        }
      });
      writer.writeCharacters('safe');
      writer.writeEndDocument();

      expect(writer.getXmlString()).toContain('encoding="UTF-16"');
      expect(writer.getXmlString()).not.toContain('skip=');
      expect(writer.getXmlString()).toContain('plain="A&amp;B"');
      expect(writer.getXmlString()).toContain('r:attr="(c)"');

      expect(() => new StaxXmlWriterSync().writeCData('bad ]]> data')).toThrow('CDATA section');
      expect(() => new StaxXmlWriterSync().writeComment('bad -- data')).toThrow('comment');
      expect(() => new StaxXmlWriterSync().writeProcessingInstruction('pi', 'bad ?> data')).toThrow('Processing instruction');
      const piWriter = new StaxXmlWriterSync({ prettyPrint: false });
      piWriter.writeProcessingInstruction('pi');
      expect(piWriter.getXmlString()).toBe('<?pi?>');
      expect(() => new StaxXmlWriterSync().writeStartElement('root', {
        attributes: { attr: { prefix: 'missing', value: 'value' } }
      })).toThrow("Namespace prefix 'missing' is not defined");
    });

    it('should cover sync sink buffer edge cases', () => {
      const chunks: string[] = [];
      const writer = new StaxXmlWriterSyncSink({
        write(chunk) {
          chunks.push(chunk);
        }
      }, {
        bufferSize: 5,
        flushThreshold: 10,
        enableAutoFlush: true
      });

      writer.writeRaw('');
      writer.writeRaw('123456789');
      writer.flush();
      writer.writeRaw('abc');
      writer.flush();

      expect(chunks.join('')).toBe('123456789abc');
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should cover async writer branches', async () => {
      createAsyncWriter({
        addEntities: [
          { entity: '', value: 'ignored' },
          { entity: '@empty@', value: '' }
        ]
      });

      const { writer, output } = createAsyncWriter({
        bufferSize: 6,
        flushThreshold: 3,
        enableAutoFlush: true,
        addEntities: [{ entity: '@copy@', value: '(c)' }]
      });

      await writer.writeStartDocument('1.0');
      await writer.writeStartElement('root', {
        prefix: 'r',
        uri: 'urn:r',
        attributes: {
          skip: undefined,
          plain: 'A&B',
          attr: { prefix: 'r', value: '@copy@' },
          local: { value: 'local' }
        }
      });
      await writer.writeCharacters('');
      await writer.writeCData('content');
      await writer.writeComment('ok');
      await writer.writeRaw('raw');
      await writer.writeEndDocument();
      await writer.writeEndDocument();

      expect(output()).not.toContain('skip=');
      expect(output()).toContain('plain="A&amp;B"');
      expect(output()).toContain('r:attr="(c)"');
      expect(writer.getMetrics().flushCount).toBeGreaterThan(0);
      await expect(writer.writeCharacters('after')).rejects.toThrow('closed or in error');

      await expect(new StaxXmlWriter(new WritableStream()).writeCData('bad ]]> data')).rejects.toThrow('CDATA section');
      await expect(new StaxXmlWriter(new WritableStream()).writeStartElement('root', {
        attributes: { attr: { prefix: 'missing', value: 'value' } }
      })).rejects.toThrow("Namespace prefix 'missing' is not defined");

      const tiny = createAsyncWriter({
        bufferSize: 4,
        flushThreshold: 999,
        enableAutoFlush: false
      });
      await tiny.writer.writeRaw('abcdef');
      await tiny.writer.writeEndDocument();
      expect(tiny.output()).toBe('abcdef');

      const tinyUtf8 = createAsyncWriter({
        bufferSize: 1,
        flushThreshold: 999,
        enableAutoFlush: false
      });
      await tinyUtf8.writer.writeRaw('é');
      await tinyUtf8.writer.writeEndDocument();
      expect(tinyUtf8.output()).toBe('é');

      const plain = createAsyncWriter({ prettyPrint: false });
      await plain.writer.writeStartElement('empty', { selfClosing: true });
      await plain.writer.writeCData('top');
      await plain.writer.writeEndDocument();
      expect(plain.output()).toBe('<empty/><![CDATA[top]]>');
    });
  });

  describe('adapter branches', () => {
    it('should cover node close fallbacks', () => {
      const calls: string[] = [];

      createNodeSyncTextSink({ write() {} }).flush?.();

      createNodeSyncTextSink({
        write() {},
        end() {
          calls.push('explicit-end');
        }
      }, { closeMethod: 'end' }).close?.();

      createNodeSyncTextSink({
        write() {}
      }, { closeMethod: 'end' }).close?.();

      createNodeSyncTextSink({
        write() {},
        close() {
          calls.push('close-fallback');
        }
      }).close?.();

      createNodeSyncTextSink({
        write() {},
        destroy() {
          calls.push('destroy-fallback');
        }
      }).close?.();

      createNodeSyncTextSink({ write() {} }).close?.();
      createNodeFileSyncTextSink(0, { closeOnExit: false }).close?.();

      expect(calls).toEqual(['explicit-end', 'close-fallback', 'destroy-fallback']);
    });

    it('should cover bun close fallbacks', () => {
      const calls: string[] = [];

      createBunSyncTextSink({ write() {} }).flush?.();

      createBunSyncTextSink({
        write() {},
        end() {
          calls.push('explicit-end');
        }
      }, { closeMethod: 'end' }).close?.();

      createBunSyncTextSink({
        write() {},
        close() {
          calls.push('close-fallback');
        }
      }).close?.();

      createBunSyncTextSink({ write() {} }).close?.();

      expect(calls).toEqual(['explicit-end', 'close-fallback']);
    });

    it('should cover deno empty lifecycle fallbacks', () => {
      const sink = createDenoSyncTextSink({
        writeTextSync() {}
      });

      sink.flush?.();
      sink.close?.();
    });
  });
});
