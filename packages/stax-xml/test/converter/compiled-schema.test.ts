import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

describe('Compiled Schema', () => {
  it('supports bare array roots', () => {
    const xml = `
      <items>
        <item>
          <id>1</id>
          <value>a</value>
        </item>
        <item>
          <id>2</id>
          <value>b</value>
        </item>
      </items>
    `;

    const schema = x.array(
      x.object({
        id: x.number().xpath('./id').int(),
        value: x.string().xpath('./value')
      }),
      '//item'
    );

    expect(schema.compile().parseSync(xml)).toEqual(schema.parseSync(xml));
  });

  it('supports bare array roots asynchronously', async () => {
    const xml = `
      <items>
        <item>
          <id>1</id>
          <value>a</value>
        </item>
        <item>
          <id>2</id>
          <value>b</value>
        </item>
      </items>
    `;

    const schema = x.array(
      x.object({
        id: x.number().xpath('./id').int(),
        value: x.string().xpath('./value')
      }),
      '//item'
    );

    expect(await schema.compile().parse(xml)).toEqual(await schema.parse(xml));
  });

  it('matches uncompiled parsing for nested object arrays', () => {
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

    const baseline = schema.parseSync(xml);
    const compiled = schema.compile().parseSync(xml);

    expect(compiled).toEqual(baseline);
  });

  it('matches uncompiled async parsing with nested transforms and optionals', async () => {
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

    const baseline = await schema.parse(xml);
    const compiled = await schema.compile().parse(xml);

    expect(compiled).toEqual(baseline);
  });
});
