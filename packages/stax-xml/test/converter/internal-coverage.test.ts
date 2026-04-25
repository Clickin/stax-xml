import { describe, expect, it } from 'vitest';
import { StaxXmlParser } from '../../src/StaxXmlParser.js';
import { StaxXmlParserSync } from '../../src/StaxXmlParserSync.js';
import { StaxXmlWriter } from '../../src/StaxXmlWriter.js';
import { StaxXmlWriterSyncSink } from '../../src/StaxXmlWriterSync.js';
import { AsyncEventBatchIterator } from '../../src/converter/AsyncEventBatchIterator.js';
import { CompiledRootProcessor } from '../../src/converter/CompiledRootProcessor.js';
import { CompiledXmlSchema, tryParseWithCompiledPlan } from '../../src/converter/CompiledXmlSchema.js';
import { XmlOptionalSchema } from '../../src/converter/XmlOptionalSchema.js';
import { XmlParserInternal } from '../../src/converter/XmlParserInternal.js';
import {
  isArrayCollector,
  isNumberCollector,
  isObjectCollector,
  isStringCollector,
  XmlParsingStateMachine
} from '../../src/converter/XmlParsingStateMachine.js';
import { createXPathMatcherTemplate, XPathCompiler, XPathMatcher } from '../../src/converter/XPathEngine.js';
import { AUTO_PARSE_UNHANDLED, XmlSchemaBase } from '../../src/converter/base.js';
import { x } from '../../src/converter/index.js';
import { SchemaType } from '../../src/converter/types.js';
import { XmlEventFactory, isEndElement, isStartElement, type AnyXmlEvent, type StartElementEvent } from '../../src/types.js';

class NoTextSchema extends XmlSchemaBase<string, string> {
  readonly schemaType = SchemaType.STRING;
  readonly options = { xpath: '/root/value' };

  _parse(): string {
    return 'parsed';
  }

  async _parseAsync(): Promise<string> {
    return 'parsed-async';
  }

  _writeSync(data: string): string {
    return data;
  }

  async _write(data: string, stream: WritableStream<Uint8Array>): Promise<void> {
    const writer = stream.getWriter();
    await writer.write(new TextEncoder().encode(data));
    await writer.close();
    writer.releaseLock();
  }
}

class UnknownSchema extends XmlSchemaBase<string, string> {
  readonly schemaType = 'UNKNOWN' as typeof SchemaType.STRING;

  constructor(readonly options: { xpath?: string } = {}) {
    super();
  }

  _parse(): string {
    return 'unknown';
  }

  async _parseAsync(): Promise<string> {
    return 'unknown';
  }

  _writeSync(data: string): string {
    return data;
  }

  async _write(): Promise<void> {}
}

class NoOptionsStringSchema extends XmlSchemaBase<string, string> {
  readonly schemaType = SchemaType.STRING;

  _parse(): string {
    return 'no-options';
  }

  async _parseAsync(): Promise<string> {
    return 'no-options';
  }

  _writeSync(data: string): string {
    return data;
  }

  async _write(): Promise<void> {}
}

class NumericXPathSchema extends XmlSchemaBase<string, string> {
  readonly schemaType = SchemaType.STRING;
  readonly options = { xpath: 123 };

  _parse(): string {
    return 'numeric-xpath';
  }

  async _parseAsync(): Promise<string> {
    return 'numeric-xpath';
  }

  _writeSync(data: string): string {
    return data;
  }

  async _write(): Promise<void> {}
}

class ThrowingObjectSchema extends XmlSchemaBase<Record<string, unknown>, Record<string, unknown>> {
  readonly schemaType = SchemaType.OBJECT;
  private shapeReads = 0;

  get shape(): Record<string, XmlSchemaBase<unknown, unknown>> {
    this.shapeReads++;
    if (this.shapeReads > 1) {
      throw new Error('shape exploded');
    }
    return {};
  }

  _parse(): Record<string, unknown> {
    return {};
  }

  async _parseAsync(): Promise<Record<string, unknown>> {
    return {};
  }

  _writeSync(): string {
    return '';
  }

  async _write(): Promise<void> {}
}

class DoneAfterBufferedBatchIterator extends AsyncEventBatchIterator {
  private ensured = false;
  private returnedDone = false;

  constructor() {
    super({
      async next() {
        return { value: undefined, done: true };
      }
    });
  }

  override async ensureBatch(): Promise<boolean> {
    if (this.ensured || this.returnedDone) {
      return false;
    }
    this.ensured = true;
    return true;
  }

  override hasBufferedEvents(): boolean {
    return this.ensured && !this.returnedDone;
  }

  override nextBuffered(): IteratorResult<AnyXmlEvent> {
    this.ensured = false;
    this.returnedDone = true;
    return { value: undefined, done: true };
  }
}

function eventsFromXml(xml: string): AnyXmlEvent[] {
  return Array.from(new StaxXmlParserSync(xml));
}

function streamFrom(xml: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(xml);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
}

function findStartPosition(events: AnyXmlEvent[], name: string): { index: number; event: StartElementEvent; depth: number } {
  let depth = 0;
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    if (isStartElement(event)) {
      depth++;
      if (event.name === name) {
        return { index, event, depth };
      }
    } else if (isEndElement(event)) {
      depth--;
    }
  }
  throw new Error(`Could not find ${name}`);
}

function syncIteratorFrom(events: AnyXmlEvent[], startIndex: number): Iterator<AnyXmlEvent> {
  let index = startIndex;
  return {
    next(): IteratorResult<AnyXmlEvent> {
      if (index >= events.length) {
        return { value: undefined, done: true };
      }
      return { value: events[index++], done: false };
    }
  };
}

async function* asyncIteratorFrom(events: AnyXmlEvent[], startIndex: number): AsyncGenerator<AnyXmlEvent> {
  for (let index = startIndex; index < events.length; index++) {
    yield events[index];
  }
}

function start(name: string, attributes: Record<string, string> = {}): StartElementEvent {
  return XmlEventFactory.startElement(name, undefined, undefined, undefined, attributes);
}

function end(name: string): AnyXmlEvent {
  return XmlEventFactory.endElement(name, undefined, undefined, undefined);
}

function text(value: string): AnyXmlEvent {
  return XmlEventFactory.characters(value);
}

function cdata(value: string): AnyXmlEvent {
  return XmlEventFactory.cdata(value);
}

function writableChunks(): { stream: WritableStream<Uint8Array>; chunks: Uint8Array[] } {
  const chunks: Uint8Array[] = [];
  return {
    chunks,
    stream: new WritableStream<Uint8Array>({
      write(chunk) {
        chunks.push(chunk);
      }
    })
  };
}

describe('Converter internal coverage guard rails', () => {
  describe('XPath compiler and matcher edge cases', () => {
    it('covers cache eviction, relative forms, predicate variants, and reset', () => {
      XPathCompiler.clearCache();
      for (let index = 0; index <= 1000; index++) {
        XPathCompiler.compile(`/root/item${index}`);
      }

      expect(XPathCompiler.compile('./child').segments[0].name).toBe('child');
      expect(XPathCompiler.compile('.').segments).toHaveLength(0);
      expect(XPathCompiler.compile('./@id').segments[0].isAttribute).toBe(true);
      expect(XPathCompiler.compile('./title/text()').segments[1].isTextNode).toBe(true);
      expect(XPathCompiler.compile('/book[@id="b1"]').segments[0].predicates[0].value).toBe('b1');
      expect(XPathCompiler.compile('/items/item[first()]').segments[1].predicates[0].position).toBe(1);
      expect(XPathCompiler.compile('/items/item[last()]').segments[1].predicates[0].position).toBe(-1);
      expect(XPathCompiler.compile('/items/item[position() = 2]').segments[1].predicates[0].position).toBe(2);
      expect(() => XPathCompiler.compile('//root//item')).toThrow('Nested descendant-or-self');
      expect(() => XPathCompiler.compile('/root/[')).toThrow('Invalid XPath segment');
      expect(() => XPathCompiler.compile('/items/item[unknown()]')).toThrow('Unsupported predicate');
      expect(createXPathMatcherTemplate(XPathCompiler.compile('/root/@id')).attributeName).toBe('id');

      const currentMatcher = new XPathMatcher('.');
      const root = start('root');
      currentMatcher.onStartElement(root);
      expect(currentMatcher.matches(root)).toBe(true);
      currentMatcher.reset();
      currentMatcher.onStartElement(root);
      expect(currentMatcher.matches(root)).toBe(true);

      const lastMatcher = new XPathMatcher('/root/item[last()]');
      const item = start('item');
      lastMatcher.onStartElement(root);
      lastMatcher.onStartElement(item);
      expect(lastMatcher.matches(item)).toBe(false);
      expect((lastMatcher as any).matchesPredicate({ type: 'unknown' }, item, 0)).toBe(false);
    });
  });

  describe('compiled schema edge cases', () => {
    it('delegates parse, write, parseText, writer, and double compilation', async () => {
      const compiled = x.string().xpath('/root/value').compile();
      const compiledAgain = compiled.compile();
      const noTextCompiled = new CompiledXmlSchema(new NoTextSchema());
      const events = eventsFromXml('<root><value>iterator</value></root>');

      expect(compiledAgain.compiledPlan).toBe(compiled.compiledPlan);
      expect(compiled.schemaType).toBe('STRING');
      expect(compiled.parseSync('<root><value>ok</value></root>')).toBe('ok');
      await expect(compiled.parse('<root><value>async</value></root>')).resolves.toBe('async');
      expect((compiled as any)._parse('<root><value>direct</value></root>')).toBe('direct');
      await expect((compiled as any)._parseAsync('<root><value>direct-async</value></root>')).resolves.toBe('direct-async');
      expect(() => (compiled as any)._parse(syncIteratorFrom(events, 0))).toThrow('xml must be a string');
      expect((compiled as any)._parseText('raw')).toBe('raw');
      expect(compiled.writer({ element: 'value' }).writeSync('written', { rootElement: 'root' })).toContain(
        '<value>written</value>'
      );

      const { stream, chunks } = writableChunks();
      await compiled.writeToStream('streamed', stream, { rootElement: 'root', includeDeclaration: false });
      const xml = chunks.map(chunk => new TextDecoder().decode(chunk, { stream: true })).join('');
      expect(xml).toContain('<value>streamed</value>');
      expect((noTextCompiled as any)._parseText('fallback')).toBe('fallback');
      expect(noTextCompiled.parseSync('<root><value>raw</value></root>')).toBe('raw');
      await expect(noTextCompiled.parse('<root><value>raw-async</value></root>')).resolves.toBe('raw-async');
    });

    it('covers automatic compiled-plan fallback and backend extraction branches', async () => {
      const eligible = x.object({
        values: x.array(x.string(), '/root/value')
      });
      const events = eventsFromXml('<root><value>A</value></root>');

      expect(tryParseWithCompiledPlan(eligible, syncIteratorFrom(events, 0))).toBe(AUTO_PARSE_UNHANDLED);

      const throwing = new ThrowingObjectSchema();
      expect(throwing.parseSync('<root></root>')).toEqual({});

      const originalSync = XmlSchemaBase._tryParseWithCompiledPlan;
      const originalAsync = XmlSchemaBase._tryParseAsyncWithCompiledPlan;
      XmlSchemaBase._tryParseWithCompiledPlan = undefined;
      XmlSchemaBase._tryParseAsyncWithCompiledPlan = undefined;
      try {
        expect(x.string().xpath('/root/value').parseSync('<root><value>sync</value></root>')).toBe('sync');
        await expect(x.string().xpath('/root/value').parse('<root><value>async</value></root>')).resolves.toBe('async');
      } finally {
        XmlSchemaBase._tryParseWithCompiledPlan = originalSync;
        XmlSchemaBase._tryParseAsyncWithCompiledPlan = originalAsync;
      }

      const parser = new StaxXmlParser(streamFrom('<root><value>backend</value></root>'));
      await expect(x.string().xpath('/root/value').parse(parser as unknown as AsyncIterator<AnyXmlEvent>))
        .resolves.toBe('backend');

      expect(x.array(x.string(), '/root/missing').optional().compile().parseSync('<root></root>')).toEqual([]);
    });

    it('builds default, object, and element-xpath array compiled plans', async () => {
      const emptyObjectCompiled = x.object({
        empty: x.object({})
      }).compile();
      expect(emptyObjectCompiled.compiledPlan.eventFilter).toEqual({
        includeAttributes: true,
        includeCharacters: true,
        includeCdata: true
      });

      const objectCompiled = x.object({
        meta: x.object({
          title: x.string().xpath('/doc/title')
        })
      }).compile();
      expect(objectCompiled.parseSync('<doc><title>Title</title></doc>')).toEqual({
        meta: { title: 'Title' }
      });

      const arrayCompiled = x.object({
        values: x.array(x.string().xpath('/doc/item'))
      }).compile();
      expect(arrayCompiled.parseSync('<doc><item>A</item><item>B</item></doc>')).toEqual({
        values: ['A', 'B']
      });

      const bareElementArray = x.array(x.string().xpath('/doc/item')).compile();
      expect(bareElementArray.parseSync('<doc><item>A</item><item>B</item></doc>')).toEqual(['A', 'B']);

      const reused = x.string().xpath('/doc/title');
      expect(x.object({ first: reused, second: reused }).compile().compiledPlan.kind).toBe('dispatch');

      const relativeCompiled = x.object({
        item: x.object({
          id: x.string().xpath('./@id'),
          childId: x.string().xpath('./child/@id'),
          name: x.string().xpath('./name/text()'),
          descendant: x.string().xpath('//descendant'),
          meta: x.object({
            title: x.string().xpath('./title')
          }).xpath('./meta'),
          custom: new UnknownSchema({ xpath: './custom' }) as any
        })
      }).compile();
      expect(relativeCompiled.compiledPlan.kind).toBe('runtime');
      expect(relativeCompiled.parseSync('<root />')).toEqual({
        item: {
          id: '',
          childId: '',
          name: '',
          descendant: '',
          meta: {},
          custom: ''
        }
      });

      const syntheticDefaultCompiled = new CompiledXmlSchema(new UnknownSchema({ xpath: '/root/value' }) as any);
      expect(syntheticDefaultCompiled.compiledPlan.rootFieldName).toBe('__root__');
      expect(syntheticDefaultCompiled.compiledPlan.kind).toBe('runtime');

      const wildcardCompiled = x.string().xpath('/root/*').compile();
      expect(wildcardCompiled.compiledPlan.kind).toBe('runtime');
      expect(wildcardCompiled.parseSync('<root><value>wild</value></root>')).toBe('wild');
      await expect(wildcardCompiled.parse('<root><value>wild-async</value></root>')).resolves.toBe('wild-async');

      const predicateCompiled = x.string().xpath("//item[@id='2']").compile();
      expect(predicateCompiled.compiledPlan.kind).toBe('runtime');
      expect(predicateCompiled.parseSync('<root><item id="1">A</item><item id="2">B</item></root>')).toBe('B');
    });

    it('rejects unsupported compile shapes', () => {
      expect(() => x.string().compile()).toThrow('compile() requires an xpath');
      expect(() => new CompiledXmlSchema(new NoOptionsStringSchema())).toThrow('compile() requires an xpath');
      expect(() => new CompiledXmlSchema(new NumericXPathSchema())).toThrow('compile() requires an xpath');
      expect(() => new CompiledXmlSchema(new ThrowingObjectSchema())).toThrow('shape exploded');

      const runtimeFallbacks = [
        x.object({ value: x.string() }),
        x.object({ value: x.object({}).xpath('/root/@id') }),
        x.object({ values: x.array(x.string().xpath('./value'), '/root/item') }),
        x.object({ values: x.array(x.array(x.string(), './value'), '/root/item') }),
        x.object({ values: x.array(x.array(x.string()), '/root/item') }),
        x.object({ values: x.array(x.object({ id: x.string().xpath('./@id') }), '/root/item/@id') }),
        x.object({ values: x.array(x.string()) }),
        x.object({ value: x.string().xpath('value') }),
        x.object({ value: x.string().xpath('.') }),
        x.string().xpath('/@id')
      ];

      for (const schema of runtimeFallbacks) {
        expect(schema.compile().compiledPlan.kind).toBe('runtime');
      }

      const compiledChild = x.string().xpath('/root/value').compile();
      expect(() => x.object({ child: compiledChild }).compile()).toThrow('compile() must be called only on the root schema');
    });
  });

  describe('compiled root processor branches', () => {
    it('covers supports and dispatch execution', () => {
      const compiled = x.object({
        value: x.string().xpath('/root/value')
      }).compile();
      const processor = new CompiledRootProcessor(compiled.compiledPlan);
      const runtimeCompiled = new CompiledXmlSchema(new UnknownSchema({ xpath: '/root/value' }) as any);

      expect(CompiledRootProcessor.supports(compiled.compiledPlan)).toBe(true);
      expect(CompiledRootProcessor.supports(runtimeCompiled.compiledPlan)).toBe(false);
      expect(compiled.compiledPlan.kind).toBe('dispatch');
      expect(processor.parseSync('<root><value>ok</value></root>')).toEqual({ value: 'ok' });
    });
  });

  describe('parser internal direct branches', () => {
    it('uses non-compiled parseWithSchema and async parseWithSchema paths', async () => {
      const parser = new XmlParserInternal();
      const schema = x.string().xpath('/root/value');

      expect(parser.parseWithSchema('<root><value>sync</value></root>', schema)).toBe('sync');
      await expect(parser.parseWithSchemaAsync('<root><value>async</value></root>', schema)).resolves.toBe('async');

      const dispatchCompiled = x.object({
        value: x.string().xpath('/root/value')
      }).compile();
      const dispatchParser = new XmlParserInternal(undefined, dispatchCompiled.compiledPlan);
      expect(dispatchParser.parseWithSchema('<root><value>compiled</value></root>', dispatchCompiled)).toEqual({
        value: 'compiled'
      });
      await expect(dispatchParser.parseWithSchemaAsync(
        '<root><value>compiled-async</value></root>',
        dispatchCompiled
      )).resolves.toEqual({ value: 'compiled-async' });
      expect(dispatchParser.parseWithSchema({} as any, new UnknownSchema())).toBe('unknown');

      const runtimeCompiled = new CompiledXmlSchema(new UnknownSchema({ xpath: '/root/value' }) as any);
      const runtimeParser = new XmlParserInternal(undefined, runtimeCompiled.compiledPlan);
      expect(runtimeParser.parseWithSchema('<root><value>runtime</value></root>', new UnknownSchema())).toBe('unknown');
      await expect(runtimeParser.parseWithSchemaAsync(
        '<root><value>runtime-async</value></root>',
        new UnknownSchema()
      )).resolves.toBe('unknown');
    });

    it('uses compiled parseObject branches and compiled transform helpers', async () => {
      const xml = '<root><value>5</value></root>';
      const compiled = x.object({
        value: x.number().xpath('/root/value').transform(value => value + 1)
      }).compile();
      const parser = new XmlParserInternal(undefined, compiled.compiledPlan);

      expect(parser.parseObject(xml, {}, {})).toEqual({ value: 6 });
      await expect(parser.parseObjectAsync(xml, {}, {})).resolves.toEqual({ value: 6 });
      expect(parser.applyCompiledSchemaTransforms(
        x.number().transform(value => value + 1).transform(value => value * 2),
        4
      )).toBe(10);
    });

    it('registers unscoped object fields, unscoped arrays, and fallback collectors', async () => {
      const xml = '<root><name>Alice</name><item>A</item><item>B</item><fallback>ignored</fallback></root>';
      const fakeSchema = {
        schemaType: 'UNKNOWN',
        options: { xpath: '/root/fallback' }
      };
      const shape = {
        inline: x.object({
          name: x.string().xpath('/root/name'),
          skipped: x.string()
        }),
        values: x.array(x.string().xpath('/root/item')),
        skippedValues: x.array(x.string()),
        fallback: fakeSchema as any
      };
      const parser = new XmlParserInternal();

      expect(parser.parseObject(xml, shape as any, {})).toEqual({
        inline: { name: 'Alice' },
        values: ['A', 'B'],
        fallback: ''
      });
      await expect(parser.parseObjectAsync(xml, shape as any, {})).resolves.toEqual({
        inline: { name: 'Alice' },
        values: ['A', 'B'],
        fallback: ''
      });
    });

    it('parses direct array position branches for simple, element-xpath, and object items', async () => {
      const xml = `
        <root>
          <section>
            <item>A</item>
            <item>B</item>
            <record><value>1<nested>ignored</nested></value></record>
            <record><value>2</value></record>
            <user><name>Alice</name></user>
            <withAttr code="x">ignored</withAttr>
            <withAttr>missing</withAttr>
          </section>
        </root>
      `;
      const events = eventsFromXml(xml);
      const position = findStartPosition(events, 'section');
      const parser = new XmlParserInternal();

      expect((parser as any).parseArrayFromPositionSync(
        syncIteratorFrom(events, position.index + 1),
        position.event,
        1,
        x.string(),
        './item'
      )).toEqual(['A', 'B']);

      await expect((parser as any).parseArrayFromPosition(
        asyncIteratorFrom(events, position.index + 1),
        position.event,
        1,
        x.string(),
        './item'
      )).resolves.toEqual(['A', 'B']);

      expect((parser as any).parseArrayFromPositionSync(
        syncIteratorFrom(events, position.index + 1),
        position.event,
        1,
        x.string(),
        '/section/item'
      )).toEqual(['A', 'B']);

      await expect((parser as any).parseArrayFromPosition(
        asyncIteratorFrom(events, position.index + 1),
        position.event,
        1,
        x.string(),
        '/section/item'
      )).resolves.toEqual(['A', 'B']);

      expect((parser as any).parseArrayFromPositionSync(
        syncIteratorFrom(events, position.index + 1),
        position.event,
        1,
        x.number().xpath('./value').int(),
        './record'
      )).toEqual([1]);

      await expect((parser as any).parseArrayFromPosition(
        asyncIteratorFrom(events, position.index + 1),
        position.event,
        1,
        x.number().xpath('./value').int(),
        './record'
      )).resolves.toEqual([1]);

      expect((parser as any).parseArrayFromPositionSync(
        syncIteratorFrom(events, position.index + 1),
        position.event,
        1,
        x.object({ name: x.string().xpath('./name') }),
        './user'
      )).toEqual([{ name: 'Alice' }]);

      await expect((parser as any).parseArrayFromPosition(
        asyncIteratorFrom(events, position.index + 1),
        position.event,
        1,
        x.object({ name: x.string().xpath('./name') }),
        './user'
      )).resolves.toEqual([{ name: 'Alice' }]);

      expect((parser as any).parseArrayFromPositionSync(
        syncIteratorFrom(events, position.index + 1),
        position.event,
        1,
        x.string().xpath('./@code'),
        './withAttr'
      )).toEqual(['x']);

      await expect((parser as any).parseArrayFromPosition(
        asyncIteratorFrom(events, position.index + 1),
        position.event,
        1,
        x.string().xpath('./@code'),
        './withAttr'
      )).resolves.toEqual(['x']);

      await expect((parser as any).parseArrayFromPosition(
        new DoneAfterBufferedBatchIterator(),
        start('section'),
        1,
        x.string(),
        './item'
      )).resolves.toEqual([]);
    });

    it('hydrates parent-context attributes and covers parser private extract fallbacks', async () => {
      const xml = '<root><book id="b1" pages="9"><title>Title</title></book></root>';
      const events = eventsFromXml(xml);
      const position = findStartPosition(events, 'book');
      const parser = new XmlParserInternal();
      const shape = {
        id: x.string().xpath('./@id'),
        pages: x.number().xpath('./@pages').int(),
        title: x.string().xpath('./title'),
        skipped: x.string()
      };
      const parentContext = {
        schema: x.object(shape),
        unwrappedSchema: x.object(shape),
        xpath: '/root/book',
        matcher: new XPathMatcher('/root/book'),
        isArraySchema: false,
        isAttributeSelector: false,
        isTextNodeSelector: false,
        matchProfile: { mode: 'default' },
        depth: position.depth,
        collector: { type: 'object', fields: new Map() },
        context: { contextElement: position.event, contextDepth: position.depth }
      };

      expect((parser as any).parseObjectFromPositionSync(
        syncIteratorFrom(events, position.index + 1),
        position.event,
        position.depth,
        shape,
        {},
        undefined,
        parentContext
      )).toEqual({ id: 'b1', pages: 9, title: '' });

      const populatedParentContext = {
        ...parentContext,
        collector: {
          type: 'object',
          fields: new Map([['title', { type: 'string', buffer: '', value: 'preloaded' }]])
        }
      };
      expect((parser as any).parseObjectFromPositionSync(
        syncIteratorFrom(events, position.index + 1),
        position.event,
        position.depth,
        shape,
        {},
        undefined,
        populatedParentContext
      )).toEqual({ title: 'preloaded' });

      const asyncParentContext = {
        ...parentContext,
        collector: { type: 'object', fields: new Map() }
      };
      await expect((parser as any).parseObjectFromPosition(
        asyncIteratorFrom(events, position.index + 1),
        position.event,
        position.depth,
        shape,
        {},
        undefined,
        asyncParentContext
      )).resolves.toEqual({ id: 'b1', pages: 9, title: '' });

      await expect((parser as any).parseObjectFromPosition(
        asyncIteratorFrom(events, position.index + 1),
        position.event,
        position.depth,
        shape,
        {},
        undefined,
        {
          ...asyncParentContext,
          collector: {
            type: 'object',
            fields: new Map([['title', { type: 'string', buffer: '', value: 'preloaded-async' }]])
          }
        }
      )).resolves.toEqual({ title: 'preloaded-async' });

      expect((parser as any).extractXPath(null)).toBeUndefined();
      expect((parser as any).extractXPath({})).toBeUndefined();
      expect((parser as any).extractXPath({ schemaType: SchemaType.OPTIONAL, schema: null })).toBeUndefined();
      expect((parser as any).extractXPath(x.array(x.string(), '//item'))).toBe('//item');
      expect((parser as any).extractXPath(new NumericXPathSchema())).toBeUndefined();
      expect((parser as any).isOptionalSchemaWrapper(null)).toBe(false);
      await expect((parser as any).collectTextUntilClose(
        asyncIteratorFrom([start('inner'), cdata('nested'), end('inner'), cdata('tail'), end('value')], 0),
        1
      )).resolves.toBe('tail');
      expect((parser as any).collectTextUntilCloseSync(
        syncIteratorFrom([start('inner'), cdata('nested'), end('inner'), cdata('tail'), end('value')], 0),
        1
      )).toBe('tail');
      await expect((parser as any).consumeAsyncEvents(new DoneAfterBufferedBatchIterator(), () => {
        throw new Error('done guard failed');
      })).resolves.toBeUndefined();

      await expect(parser.parseObjectAsync(
        asyncIteratorFrom(eventsFromXml('<root><value>fallback</value></root>'), 0),
        { value: x.string().xpath('/root/value') },
        {}
      )).resolves.toEqual({ value: 'fallback' });
    });
  });

  describe('schema position and writer branches', () => {
    it('routes array and object _parseFromPosition through sync and async paths', async () => {
      const xml = '<root><section><item>A</item><item>B</item><name>Alice</name></section></root>';
      const events = eventsFromXml(xml);
      const position = findStartPosition(events, 'section');
      const arraySchema = x.array(x.string(), './item');
      const objectSchema = x.object({ name: x.string().xpath('./name') });

      expect((arraySchema as any)._parseFromPosition(
        syncIteratorFrom(events, position.index + 1),
        position.event,
        1
      )).toEqual(['A', 'B']);
      await expect((arraySchema as any)._parseFromPosition(
        asyncIteratorFrom(events, position.index + 1),
        position.event,
        1
      )).resolves.toEqual(['A', 'B']);

      expect((objectSchema as any)._parseFromPosition(
        syncIteratorFrom(events, position.index + 1),
        position.event,
        position.depth
      )).toEqual({ name: 'Alice' });
      await expect((objectSchema as any)._parseFromPosition(
        asyncIteratorFrom(events, position.index + 1),
        position.event,
        position.depth
      )).resolves.toEqual({ name: 'Alice' });
    });

    it('covers truncated async primitive position parsing returns', async () => {
      await expect((x.string() as any)._parseFromPosition(
        asyncIteratorFrom([text('partial')], 0),
        start('value'),
        1
      )).resolves.toBe('partial');

      await expect((x.number() as any)._parseFromPosition(
        asyncIteratorFrom([text('42')], 0),
        start('value'),
        1
      )).resolves.toBe(42);

      await expect((x.string() as any)._parseFromPosition(
        new DoneAfterBufferedBatchIterator(),
        start('value'),
        1
      )).resolves.toBe('');

      await expect((x.number() as any)._parseFromPosition(
        new DoneAfterBufferedBatchIterator(),
        start('value'),
        1
      )).rejects.toThrow('No number content found');
    });

    it('covers transform position and text parsing branches', async () => {
      const xml = '<root><value>hello</value></root>';
      const events = eventsFromXml(xml);
      const position = findStartPosition(events, 'value');
      const schema = x.string().transform(value => value.toUpperCase());

      expect((schema as any)._parseFromPosition(
        syncIteratorFrom(events, position.index + 1),
        position.event,
        position.depth
      )).toBe('HELLO');
      await expect((schema as any)._parseFromPosition(
        asyncIteratorFrom(events, position.index + 1),
        position.event,
        position.depth
      )).resolves.toBe('HELLO');
      expect((schema as any)._parseText('text')).toBe('TEXT');
    });

    it('covers optional parseText and async write delegation', async () => {
      const schemaWithoutParseText = new XmlOptionalSchema({} as any);
      expect((schemaWithoutParseText as any)._parseText('ignored')).toBeUndefined();

      const { stream, chunks } = writableChunks();
      await x.string().writer({ element: 'value' }).optional().writeToStream('present', stream, {
        rootElement: 'root',
        includeDeclaration: false
      });
      const xml = chunks.map(chunk => new TextDecoder().decode(chunk, { stream: true })).join('');
      expect(xml).toContain('<value>present</value>');
    });

    it('covers primitive and object injected writer branches', async () => {
      const sinkChunks: string[] = [];
      const sinkWriter = new StaxXmlWriterSyncSink({ write: chunk => sinkChunks.push(chunk) }, { flushOnClose: true });
      expect(x.string().writer({ element: 'value' }).writeSync('sink', { writer: sinkWriter })).toBe('');
      sinkWriter.writeEndDocument();
      expect(sinkChunks.join('')).toContain('sink');

      const numberXml = x.number().writer({ element: 'count', comment: 'count value' }).writeSync(7, {
        rootElement: 'root',
        includeDeclaration: false
      });
      expect(numberXml).toContain('<count>7</count>');

      const numberSinkChunks: string[] = [];
      const numberSink = new StaxXmlWriterSyncSink({ write: chunk => numberSinkChunks.push(chunk) }, { flushOnClose: true });
      expect(x.number().writeSync(9, { writer: numberSink })).toBe('');
      numberSink.writeEndDocument();
      expect(numberSinkChunks.join('')).toContain('9');

      const { stream } = writableChunks();
      const asyncWriter = new StaxXmlWriter(stream);
      await (x.number() as any)._write(11, stream, { writer: asyncWriter });
      await asyncWriter.writeEndDocument();

      const numberWithDeclaration = x.number().writer({ element: 'count' }).writeSync(12, { rootElement: 'root' });
      expect(numberWithDeclaration).toMatch(/^<\?xml/);

      const arraySinkChunks: string[] = [];
      const arraySink = new StaxXmlWriterSyncSink({ write: chunk => arraySinkChunks.push(chunk) }, { flushOnClose: true });
      expect(x.array(x.string().writer({ element: 'item' })).writeSync(['a'], { writer: arraySink })).toBe('');
      arraySink.writeEndDocument();
      expect(arraySinkChunks.join('')).toContain('<item>a</item>');

      const { stream: arrayStream } = writableChunks();
      const arrayAsyncWriter = new StaxXmlWriter(arrayStream);
      await (x.array(x.string().writer({ element: 'item' })) as any)._write(['a'], arrayStream, { writer: arrayAsyncWriter });
      await arrayAsyncWriter.writeEndDocument();

      const objectSchema = x.object({
        id: x.string().writer({ asAttribute: 'id' }),
        title: x.string().writer({ element: 'title', cdata: true }),
        values: x.array(x.number().writer({ element: 'value' })).writer({ element: 'values' })
      });
      const objectXml = objectSchema.writeSync(
        { id: 'o-1', title: '<raw>', values: [1, 2] },
        { rootElement: 'object', includeDeclaration: false }
      );
      expect(objectXml).toContain('id="o-1"');
      expect(objectXml).toContain('<![CDATA[<raw>]]>');
      expect(objectXml).toContain('<value>1</value>');

      await expect(objectSchema.write({ id: 'o-1', title: '<raw>', values: [1] }, {
        rootElement: 'object',
        includeDeclaration: false
      })).rejects.toThrow('CDATA section cannot contain');
      expect(() => objectSchema.writeSync({ id: 'x', title: 'bad', values: [] }, { writer: {} as any })).toThrow(
        'writeSync requires StaxXmlWriterSync or StaxXmlWriterSyncSink instance'
      );
      await expect(objectSchema.write({ id: 'x', title: 'bad', values: [] }, { writer: {} as any })).rejects.toThrow(
        'write requires StaxXmlWriter instance'
      );

      const contentSchema = x.object({
        id: x.string().writer({ asAttribute: 'id' }),
        missing: x.string().writer({ element: 'missing' }),
        text: x.string().writer({ element: 'text' }),
        raw: new UnknownSchema() as any
      });
      expect((contentSchema as any)._writeContent({
        id: 'id-1',
        missing: undefined,
        text: 'hello',
        raw: '<raw>'
      })).toBe('hello&lt;raw&gt;');

      const bareSchema = {
        schemaType: SchemaType.STRING,
        _parse: () => 'bare',
        _parseAsync: async () => 'bare',
        _writeContent: (data: string) => data,
        _writeSync: (data: string, options?: { writer?: { writeRaw(xml: string): unknown } }) => {
          options?.writer?.writeRaw(String(data));
          return String(data);
        },
        _write: async () => {}
      };
      const mixedObjectSchema = x.object({
        id: x.string().writer({ asAttribute: 'id' }),
        bare: bareSchema as never,
        named: x.string()
      });
      expect((mixedObjectSchema as any)._writeContent({ id: 'skip', bare: 'B', named: 'N' })).toBe('BN');

      const rootWithoutAttribute = mixedObjectSchema.writeSync(
        { id: null, bare: 'B', named: 'N' } as never,
        { rootElement: 'mixed', includeDeclaration: false }
      );
      expect(rootWithoutAttribute).not.toContain('id=');
      expect(rootWithoutAttribute).toContain('<bare>B</bare>');
      expect(rootWithoutAttribute).toContain('<named>N</named>');

      const noRoot = mixedObjectSchema.writeSync(
        { id: undefined, bare: 'B', named: 'N' } as never,
        { includeDeclaration: false }
      );
      expect(noRoot).toContain('<bare>B</bare>');
      expect(noRoot).toContain('<named>N</named>');

      const asyncNoRoot = await mixedObjectSchema.write(
        { id: undefined, bare: 'B', named: 'N' } as never,
        { includeDeclaration: false }
      );
      expect(asyncNoRoot).toContain('<bare>B</bare>');
      expect(asyncNoRoot).toContain('<named>N</named>');

      const asyncRootWithoutAttribute = await mixedObjectSchema.write(
        { id: null, bare: 'B', named: 'N' } as never,
        { rootElement: 'mixed', includeDeclaration: false }
      );
      expect(asyncRootWithoutAttribute).not.toContain('id=');
      expect(asyncRootWithoutAttribute).toContain('<bare>B</bare>');
    });
  });

  describe('state machine direct branches', () => {
    it('covers collector guards, async aliases, limits, reset, and private extractors', async () => {
      expect(isStringCollector({ type: 'string', buffer: '' })).toBe(true);
      expect(isNumberCollector({ type: 'number', buffer: '' })).toBe(true);
      expect(isArrayCollector({ type: 'array', items: [] })).toBe(true);
      expect(isObjectCollector({ type: 'object', fields: new Map() })).toBe(true);

      const sm = new XmlParsingStateMachine();
      await sm.processEvent(start('root'));
      await sm.processEventAsync(end('root'));
      sm.reset();

      const limited = new XmlParsingStateMachine({ maxEvents: 0 });
      limited.processEventSync(start('root'));
      expect(() => limited.processEventSync(end('root'))).toThrow('XML event limit exceeded');

      expect((sm as any).extractXPath(x.array(x.string(), '//item'))).toBe('//item');
      expect((sm as any).extractXPath({ schemaType: 'UNKNOWN' })).toBeUndefined();
      expect((sm as any).getCollectorKind({ schemaType: 'UNKNOWN' })).toBe('string');
      expect((sm as any).createCollectorForKind('object')).toEqual({ type: 'object', fields: new Map() });
      expect((sm as any).createCollectorForKind('string')).toEqual({ type: 'string', buffer: '' });
      expect((sm as any).extractSimpleValue({ type: 'number', buffer: ' 12 ' }, false)).toBe(12);
      expect((sm as any).extractSimpleValue({
        type: 'object',
        fields: new Map([['child', { type: 'string', buffer: '', value: 'value' }]])
      }, false)).toEqual({ child: 'value' });
      expect((sm as any).extractSimpleValue({ type: 'unknown' }, false)).toBeUndefined();

      const descendantMatcher = new XPathMatcher('//descendant');
      const descendant = start('descendant');
      descendantMatcher.onStartElement(descendant);
      (sm as any).currentDepth = 1;
      expect((sm as any).matchesInContext(descendant, {
        context: { contextDepth: 0 },
        matchProfile: { mode: 'descendant' },
        matcher: descendantMatcher
      })).toBe(true);
      const defaultMatcher = new XPathMatcher('/other');
      const other = start('other');
      defaultMatcher.onStartElement(other);
      expect((sm as any).matchesInContext(other, {
        context: { contextDepth: 0 },
        matchProfile: { mode: 'default' },
        matcher: defaultMatcher
      })).toBe(true);

      (sm as any).currentDepth = 1;
      expect((sm as any).matchesInContext(start('item', { id: 'a' }), {
        context: { contextDepth: 1 },
        matchProfile: { mode: 'relative-attribute' },
        matcher: { matches: () => false }
      })).toBe(false);
      expect((sm as any).createMatchProfile('./')).toEqual({ mode: 'default' });

      const compiledTemplateSchema = x.object({ value: x.string().xpath('./value') });
      const compiledTemplates = new WeakMap();
      compiledTemplates.set(compiledTemplateSchema, []);
      expect((new XmlParsingStateMachine({}, compiledTemplates) as any).getObjectFieldTemplates(compiledTemplateSchema))
        .toEqual([]);
      expect((sm as any).getObjectFieldTemplates(x.object({ skipped: x.string() }))).toEqual([]);
      expect((sm as any).extractObjectFromCollector({
        type: 'object',
        fields: new Map([['missing', { type: 'string', buffer: '', value: 'nope' }]])
      }, x.object({}))).toEqual({});
      expect((sm as any).getAllTransforms(x.string().optional())).toEqual([]);
    });

    it('handles immediate relative object attributes and text node number deactivation', () => {
      const schema = x.object({
        item: x.object({
          id: x.string().xpath('./@id'),
          qty: x.number().xpath('./@qty').int(),
          value: x.number().xpath('./value/text()').int()
        }).xpath('/root/item')
      });

      expect(schema.parseSync('<root><item id="a" qty="2"><value>42</value></item></root>')).toEqual({
        item: { id: 'a', qty: 2, value: 42 }
      });

      const sm = new XmlParsingStateMachine();
      const collector = { type: 'array', items: [] };
      sm.registerSchema(x.string().xpath('./@id') as any, './@id', collector as any);
      sm.processEventSync(start('item', { id: 'a' }));
      expect(collector.items).toEqual(['a']);

      const activeArray = new XmlParsingStateMachine() as any;
      const arrayCollector = { type: 'array', items: [] };
      const activation = activeArray.registerSchema(x.array(x.string(), './item') as any, './item', arrayCollector);
      activation.depth = 1;
      activeArray.processEventSync(start('item'));
      expect(arrayCollector.currentItem).toEqual({ depth: 1, buffer: '' });

      const directObjectActivation = new XmlParsingStateMachine() as any;
      const directObjectCollector = { type: 'object', fields: new Map() };
      directObjectActivation.currentDepth = 1;
      directObjectActivation.onSchemaActivatedSync({
        isAttributeSelector: false,
        collector: directObjectCollector,
        unwrappedSchema: x.object({
          code: x.string().xpath('@code'),
          missing: x.string().xpath('@missing'),
          count: x.number().xpath('@count').int(),
          meta: x.object({}).xpath('@meta')
        }),
        context: undefined,
        xpath: '/root/item'
      }, start('item', { code: 'b', count: '3', meta: 'm' }));
      expect(directObjectCollector.fields.get('code')).toMatchObject({ value: 'b' });
      expect(directObjectCollector.fields.get('count')).toMatchObject({ value: 3 });
      expect(directObjectCollector.fields.get('missing')).toMatchObject({ buffer: '' });

      const shorthandAttrArray = new XmlParsingStateMachine() as any;
      const shorthandCollector = { type: 'array', items: [] };
      const shorthandActivation = shorthandAttrArray.registerSchema(
        x.array(
          x.object({
            id: x.string().xpath('@id'),
            qty: x.number().xpath('@qty').int(),
            meta: x.object({}).xpath('@meta'),
            missing: x.string().xpath('@missing')
          }),
          '/root/item'
        ) as any,
        '/root/item',
        shorthandCollector
      );
      shorthandAttrArray.currentDepth = 1;
      shorthandAttrArray.createArrayItemSync(shorthandActivation, start('item', { id: 'a', qty: '2', meta: 'm' }));
      expect(shorthandCollector.currentItem.fields.get('id')).toMatchObject({ value: 'a' });
      expect(shorthandCollector.currentItem.fields.get('qty')).toMatchObject({ value: 2 });
      expect(shorthandCollector.currentItem.fields.get('missing')).toMatchObject({ buffer: '' });

      const nestedArrayWithoutXPath = new XmlParsingStateMachine() as any;
      const nestedArrayCollector = { type: 'array', items: [] };
      const nestedArrayActivation = nestedArrayWithoutXPath.registerSchema(
        x.array(x.array(x.string()), '/root/group') as any,
        '/root/group',
        nestedArrayCollector
      );
      nestedArrayWithoutXPath.currentDepth = 1;
      nestedArrayWithoutXPath.createArrayItemSync(nestedArrayActivation, start('group'));
      expect(nestedArrayCollector.currentItem).toEqual({ type: 'array', items: [] });

      const direct = new XmlParsingStateMachine() as any;
      direct.onSchemaActivatedSync({
        isAttributeSelector: true,
        attributeName: 'n',
        collector: { type: 'number', buffer: '' },
        schema: { schemaType: SchemaType.NUMBER },
        unwrappedSchema: { schemaType: SchemaType.NUMBER }
      }, start('item', { n: '7' }));
      direct.onSchemaDeactivatedSync({
        isTextNodeSelector: true,
        collector: { type: 'number', buffer: '7' },
        unwrappedSchema: { schemaType: SchemaType.NUMBER },
        depth: 1
      });
      direct.onSchemaDeactivatedSync({
        isTextNodeSelector: false,
        collector: { type: 'number', buffer: '8' },
        unwrappedSchema: { schemaType: SchemaType.NUMBER },
        depth: 1
      });
      const mismatchedArrayCollector = {
        type: 'array',
        items: [],
        currentItem: { type: 'array', items: [] }
      };
      direct.onSchemaDeactivatedSync({
        isTextNodeSelector: false,
        collector: mismatchedArrayCollector,
        unwrappedSchema: x.array(x.object({})),
        depth: 1
      });
      expect(mismatchedArrayCollector.items).toEqual([]);
      direct.currentDepth = 1;
      direct.onSchemaCollectText({
        isTextNodeSelector: true,
        collector: { type: 'object', fields: new Map() },
        depth: 1
      }, 'ignored');
      direct.onSchemaCollectText({
        isTextNodeSelector: true,
        collector: { type: 'array', items: [] },
        depth: 1
      }, 'ignored');
    });
  });
});
