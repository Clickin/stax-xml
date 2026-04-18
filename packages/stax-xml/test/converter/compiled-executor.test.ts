import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';
import { CompiledRootProcessor } from '../../src/converter/CompiledRootProcessor.js';

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
});
