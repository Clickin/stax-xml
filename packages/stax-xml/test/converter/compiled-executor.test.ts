import { describe, expect, it } from 'vitest';
import { EventReaderSync } from '../../src/EventReaderSync.js';
import { x } from '../../src/converter/index.js';
import { CompiledRootProcessor } from '../../src/converter/CompiledRootProcessor.js';
import { XmlEventFactory, type AnyXmlEvent } from '../../src/types.js';

async function* asyncEventsFromXml(xml: string): AsyncGenerator<AnyXmlEvent> {
  for (const event of new EventReaderSync(xml)) {
    yield event;
  }
}

function streamFromXml(xml: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(xml));
      controller.close();
    }
  });
}

function compiledProcessor(schema: ReturnType<typeof x.object> | ReturnType<typeof x.string> | ReturnType<typeof x.number> | ReturnType<typeof x.array>): CompiledRootProcessor {
  const compiled = schema.compile();
  expect(compiled.compiledPlan.kind).toBe('dispatch');
  return new CompiledRootProcessor(compiled.compiledPlan);
}

describe('CompiledRootProcessor', () => {
  it('matches compiled schema output for complex nested sync parsing', () => {
    const xml = `
      <orders>
        <order id="100" status="paid">
          <customer>
            <name>Alice</name>
            <tier>2</tier>
          </customer>
          <lines>
            <line sku="sku-1">
              <qty>1</qty>
              <price>19.5</price>
            </line>
            <line sku="sku-2">
              <qty>3</qty>
              <price>5.25</price>
            </line>
          </lines>
        </order>
        <order id="101" status="pending">
          <customer>
            <name>Bob</name>
            <tier>1</tier>
          </customer>
          <lines>
            <line sku="sku-3">
              <qty>2</qty>
              <price>11</price>
            </line>
          </lines>
        </order>
      </orders>
    `;

    const schema = x.object({
      orders: x.array(
        x.object({
          id: x.string().xpath('./@id'),
          status: x.string().xpath('./@status'),
          customer: x.object({
            name: x.string().xpath('./name'),
            tier: x.number().xpath('./tier').int()
          }).xpath('./customer'),
          lines: x.array(
            x.object({
              sku: x.string().xpath('./@sku'),
              qty: x.number().xpath('./qty').int(),
              price: x.number().xpath('./price')
            }),
            './lines/line'
          )
        }),
        '/orders/order'
      )
    });

    const compiled = schema.compile();
    const executor = new CompiledRootProcessor(compiled.compiledPlan);

    expect(executor.parseSync(xml, schema)).toEqual(compiled.parseSync(xml));
  });

  it('matches compiled schema output for complex nested async parsing', async () => {
    const xml = `
      <catalog>
        <book id="b1">
          <title>Compiler Design</title>
          <author>Alice</author>
          <meta>
            <pages>320</pages>
            <rating>5</rating>
          </meta>
        </book>
        <book id="b2">
          <title>Streaming XML</title>
          <meta>
            <pages>280</pages>
            <rating>4</rating>
          </meta>
        </book>
      </catalog>
    `;

    const schema = x.object({
      books: x.array(
        x.object({
          id: x.string().xpath('./@id'),
          title: x.string().xpath('./title'),
          author: x.string().xpath('./author').optional(),
          meta: x.object({
            pages: x.number().xpath('./pages').int(),
            rating: x.number().xpath('./rating').int()
          }).xpath('./meta')
        }).transform((book) => ({
          ...book,
          score: book.meta.pages + book.meta.rating
        })),
        '/catalog/book'
      ),
      averageRating: x.array(x.number(), '/catalog/book/meta/rating').transform((ratings) =>
        ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      )
    });

    const compiled = schema.compile();
    const executor = new CompiledRootProcessor(compiled.compiledPlan);

    expect(await executor.parse(xml, schema)).toEqual(await compiled.parse(xml));
  });

  it('handles single root-array object schemas directly', () => {
    const xml = `
      <orders>
        <order id="100" status="paid">
          <customer>
            <name>Alice</name>
            <tier>2</tier>
          </customer>
        </order>
        <order id="101" status="pending">
          <customer>
            <name>Bob</name>
            <tier>1</tier>
          </customer>
        </order>
      </orders>
    `;

    const schema = x.object({
      orders: x.array(
        x.object({
          id: x.string().xpath('./@id'),
          status: x.string().xpath('./@status'),
          customer: x.object({
            name: x.string().xpath('./name'),
            tier: x.number().xpath('./tier').int()
          }).xpath('./customer')
        }),
        '/orders/order'
      )
    });

    const compiled = schema.compile();
    const executor = new CompiledRootProcessor(compiled.compiledPlan);

    expect(executor.parseSync(xml)).toEqual(compiled.parseSync(xml));
  });

  it('handles array roots plus sibling fields directly', () => {
    const xml = `
      <catalog>
        <book id="b1">
          <title>Compiler Design</title>
          <author>Alice</author>
          <meta>
            <pages>320</pages>
            <rating>5</rating>
          </meta>
        </book>
        <book id="b2">
          <title>Streaming XML</title>
          <meta>
            <pages>280</pages>
            <rating>4</rating>
          </meta>
        </book>
      </catalog>
    `;

    const schema = x.object({
      books: x.array(
        x.object({
          id: x.string().xpath('./@id'),
          title: x.string().xpath('./title'),
          author: x.string().xpath('./author').optional(),
          meta: x.object({
            pages: x.number().xpath('./pages').int(),
            rating: x.number().xpath('./rating').int()
          }).xpath('./meta')
        }).transform((book) => ({
          ...book,
          score: book.meta.pages + book.meta.rating
        })),
        '/catalog/book'
      ),
      averageRating: x.array(x.number(), '/catalog/book/meta/rating').transform((ratings) =>
        ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      )
    });

    const compiled = schema.compile();
    const executor = new CompiledRootProcessor(compiled.compiledPlan);

    expect(executor.parseSync(xml)).toEqual(compiled.parseSync(xml));
  });

  it('handles direct object and direct array<object> roots directly', () => {
    const xml = `
      <catalog>
        <summary>
          <totalBooks>2</totalBooks>
          <source>bench</source>
        </summary>
        <featured id="f1">
          <title>Compiler Design</title>
        </featured>
        <featured id="f2">
          <title>Streaming XML</title>
        </featured>
        <book id="b1">
          <title>Compiler Design</title>
          <meta><rating>5</rating></meta>
        </book>
        <book id="b2">
          <title>Streaming XML</title>
          <meta><rating>4</rating></meta>
        </book>
      </catalog>
    `;

    const schema = x.object({
      books: x.array(
        x.object({
          id: x.string().xpath('./@id'),
          title: x.string().xpath('./title'),
          meta: x.object({
            rating: x.number().xpath('./rating').int()
          }).xpath('./meta')
        }),
        '/catalog/book'
      ),
      summary: x.object({
        totalBooks: x.number().xpath('./totalBooks').int(),
        source: x.string().xpath('./source')
      }).xpath('/catalog/summary'),
      featured: x.array(
        x.object({
          id: x.string().xpath('./@id'),
          title: x.string().xpath('./title')
        }).transform((item) => ({ ...item, slug: item.title.toLowerCase().replace(/\s+/g, '-') })),
        '/catalog/featured'
      )
    });

    const compiled = schema.compile();
    const executor = new CompiledRootProcessor(compiled.compiledPlan);

    expect(executor.parseSync(xml)).toEqual(compiled.parseSync(xml));
  });

  it('handles plans with no root array fast lane', () => {
    const xml = `
      <report>
        <meta>
          <title>Quarterly</title>
          <version>3</version>
        </meta>
        <summary>
          <total>42</total>
        </summary>
      </report>
    `;

    const schema = x.object({
      meta: x.object({
        title: x.string().xpath('./title'),
        version: x.number().xpath('./version').int()
      }).xpath('/report/meta'),
      total: x.number().xpath('/report/summary/total').int()
    });

    const compiled = schema.compile();
    const executor = new CompiledRootProcessor(compiled.compiledPlan);

    expect(executor.parseSync(xml)).toEqual(compiled.parseSync(xml));
  });

  it('handles overlapping root subtree lanes without dropping nested object output', () => {
    const xml = `
      <report>
        <meta>
          <title>Quarterly</title>
          <version>3</version>
          <details>
            <owner>platform</owner>
            <region>apac</region>
          </details>
        </meta>
      </report>
    `;

    const schema = x.object({
      meta: x.object({
        title: x.string().xpath('./title'),
        version: x.number().xpath('./version').int(),
        details: x.object({
          owner: x.string().xpath('./owner'),
          region: x.string().xpath('./region')
        }).xpath('./details')
      }).xpath('/report/meta'),
      details: x.object({
        owner: x.string().xpath('./owner'),
        region: x.string().xpath('./region')
      }).xpath('/report/meta/details')
    });

    const compiled = schema.compile();
    const executor = new CompiledRootProcessor(compiled.compiledPlan);

    expect(executor.parseSync(xml)).toEqual(compiled.parseSync(xml));
  });

  it('handles compiled primitive scalar roots from elements and attributes', async () => {
    const xml = `
      <doc id="d-1">
        <title>Streaming XML</title>
        <pages>320</pages>
      </doc>
    `;

    const titleSchema = x.string().xpath('/doc/title').compile();
    const idSchema = x.string().xpath('/doc/@id').compile();
    const pagesSchema = x.number().xpath('/doc/pages').int().compile();

    expect(titleSchema.parseSync(xml)).toBe('Streaming XML');
    await expect(titleSchema.parse(asyncEventsFromXml(xml))).resolves.toBe('Streaming XML');
    expect(idSchema.parseSync(xml)).toBe('d-1');
    await expect(pagesSchema.parse(streamFromXml(xml))).resolves.toBe(320);
  });

  it('handles compiled primitive arrays from element text and attributes', async () => {
    const xml = `
      <catalog>
        <item code="a"><qty>2</qty></item>
        <item code="b"><qty>4</qty></item>
      </catalog>
    `;

    const schema = x.object({
      codes: x.array(x.string(), '/catalog/item/@code'),
      quantities: x.array(x.number().int(), '/catalog/item/qty')
    });
    const compiled = schema.compile();

    expect(compiled.parseSync(xml)).toEqual(schema.parseSync(xml));
    await expect(compiled.parse(asyncEventsFromXml(xml))).resolves.toEqual({
      codes: ['a', 'b'],
      quantities: [2, 4]
    });
  });

  it('uses the iterable sync path for entity decoding, CDATA, and filtered text', () => {
    const xml = '<root id="a&amp;b"><title>Hi &lt;there&gt;</title><skip><![CDATA[ignored]]></skip><item code="x"><text>one</text></item><item code="y"><text><![CDATA[two]]></text></item></root>';
    const schema = x.object({
      id: x.string().xpath('/root/@id'),
      title: x.string().xpath('/root/title'),
      items: x.array(
        x.object({
          code: x.string().xpath('./@code'),
          text: x.string().xpath('./text')
        }),
        '/root/item'
      )
    }).compile();

    expect(schema.parseSync(xml)).toEqual({
      id: 'a&amp;b',
      title: 'Hi &lt;there&gt;',
      items: [
        { code: 'x', text: 'one' },
        { code: 'y', text: 'two' }
      ]
    });

    expect(schema.parseSync(xml, { decodeEntities: true })).toEqual({
      id: 'a&b',
      title: 'Hi <there>',
      items: [
        { code: 'x', text: 'one' },
        { code: 'y', text: 'two' }
      ]
    });

    expect(x.string().xpath('/root/@id').compile().parseSync('<root id="only-attr">filtered text<![CDATA[filtered cdata]]></root>'))
      .toBe('only-attr');
  });

  it('keeps benchmark-shaped schemas on the compiled byte dispatch path', () => {
    const bytes = new TextEncoder().encode(
      '<catalog><book id="a&amp;b"><title>One</title><author>Alice</author><price>12.5</price></book></catalog>'
    );
    const bookSchema = x.object({
      id: x.string().xpath('./@id'),
      title: x.string().xpath('./title'),
      author: x.string().xpath('./author'),
      price: x.number().xpath('./price'),
      featured: x.string().xpath('./featured').optional()
    });
    const schema = x.object({
      books: x.array(bookSchema, '/catalog/book'),
      firstTitle: x.string().xpath('/catalog/book/title').optional()
    });
    const compiled = schema.compile();

    expect(compiled.compiledPlan.kind).toBe('dispatch');
    expect(compiled.compiledPlan.eventFilter).toEqual({
      includeAttributes: true,
      includeCharacters: true,
      includeCdata: true
    });
    expect(compiled.parseSync(bytes, { decodeEntities: true })).toEqual({
      books: [{ id: 'a&b', title: 'One', author: 'Alice', price: 12.5, featured: undefined }],
      firstTitle: 'One'
    });
  });

  it('accepts sync event iterables and surfaces parser error events', async () => {
    const xml = '<root><value>ok</value></root>';
    const schema = x.object({
      value: x.string().xpath('/root/value')
    });
    const processor = compiledProcessor(schema);

    expect(await processor.parse(Array.from(new EventReaderSync(xml)))).toEqual({ value: 'ok' });

    async function* errorEvents(): AsyncGenerator<AnyXmlEvent> {
      yield XmlEventFactory.error(new Error('compiled event failure'));
    }

    await expect(processor.parse(errorEvents())).rejects.toThrow('compiled event failure');
  });

  it('enforces compiled depth and event limits', async () => {
    const schema = x.object({
      value: x.string().xpath('/root/a/b')
    });
    const processor = compiledProcessor(schema);

    expect(() => processor.parseSync('<root><a><b>deep</b></a></root>', { maxDepth: 2 }))
      .toThrow('XML depth limit exceeded: 2');
    await expect(processor.parse(streamFromXml('<root><a><b>deep</b></a></root>'), { maxEvents: 1 }))
      .rejects.toThrow('XML event limit exceeded: 1');
  });

  it('handles missing attribute selectors and xpath-scoped object roots', () => {
    const xml = '<root><item><name>Alice</name></item><item id="b"><name>Bob</name></item></root>';

    const objectRoot = x.object({
      id: x.string().xpath('./@id'),
      name: x.string().xpath('./name')
    }).xpath('/root/item');
    expect(compiledProcessor(objectRoot).parseSync(xml)).toEqual({
      id: '',
      name: 'Alice'
    });

    const fieldAttribute = x.object({
      id: x.string().xpath('/root/missing/@id'),
      name: x.string().xpath('/root/item/name')
    });
    expect(compiledProcessor(fieldAttribute).parseSync(xml)).toEqual({
      id: '',
      name: 'Alice'
    });
  });

  it('handles direct text selectors, selector misses, and optional empty arrays', () => {
    const textXml = '<root><value>before<nested>inside</nested>after</value></root>';
    expect(compiledProcessor(x.object({
      direct: x.string().xpath('/root/value/text()'),
      subtree: x.string().xpath('/root/value')
    })).parseSync(textXml)).toEqual({
      direct: 'beforeafter',
      subtree: 'beforeinsideafter'
    });

    const missXml = '<item>too shallow</item><other><item>wrong</item></other><root><wrapper><item>deep</item></wrapper><object><wrapper><name>too deep</name></wrapper><other><name>wrong parent</name></other></object><entry code="a"/><entry/></root>';
    expect(compiledProcessor(x.object({
      absolute: x.string().xpath('/root/item'),
      descendant: x.string().xpath('//root/item'),
      optionalItems: x.array(x.string(), '/root/missing').optional(),
      codes: x.array(x.string(), '/root/entry/@code'),
      object: x.object({
        shallow: x.string().xpath('./name'),
        nested: x.string().xpath('./meta/name')
      }).xpath('/root/object')
    })).parseSync(missXml)).toEqual({
      absolute: '',
      descendant: '',
      optionalItems: undefined,
      codes: ['a'],
      object: {
        shallow: '',
        nested: ''
      }
    });

    expect(compiledProcessor(x.string().xpath('/root/@missing')).parseSync('<root/>')).toBe('');
  });

  it('handles streamable positive position predicates in compiled selectors', () => {
    const xml = '<root><item>A</item><item>B</item><item>C</item></root>';
    expect(compiledProcessor(x.object({
      first: x.string().xpath('/root/item[1]'),
      firstFn: x.string().xpath('/root/item[first()]'),
      second: x.string().xpath('/root/item[position() = 2]')
    })).parseSync(xml)).toEqual({
      first: 'A',
      firstFn: 'A',
      second: 'B'
    });
  });
});
