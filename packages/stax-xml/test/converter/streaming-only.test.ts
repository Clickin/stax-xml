import { describe, expect, it } from 'vitest';
import { x } from '../../../stax-xml-converter/src/index.js';
import { XmlEventType, type AnyXmlEvent } from 'stax-xml-core';

describe('streaming-only converter', () => {
  it('automatically uses the dispatch plan for supported selectors', () => {
    const schema = x.object({
      title: x.string().xpath('/book/title'),
      id: x.string().xpath('/book/@id')
    });

    expect(schema.parseSync('<book id="7"><title>XML</title></book>')).toEqual({
      title: 'XML',
      id: '7'
    });
  });

  it('rejects selectors that require a tree evaluator', () => {
    const schema = x.object({ title: x.string().xpath('/book/*') });

    expect(() => schema.parseSync('<book><title>XML</title></book>'))
      .toThrow('Unsupported streaming XPath');
  });

  it('finalizes an array item with an unselected nested object', () => {
    const schema = x.array(
      x.object({
        value: x.string().xpath('./value'),
        nested: x.object({ detail: x.string().xpath('./detail') })
      }),
      '//item'
    );

    expect(schema.parseSync('<root><item><value>A</value><detail>B</detail></item></root>'))
      .toEqual([{ value: 'A', nested: { detail: 'B' } }]);
  });

  it('finalizes sibling unselected objects and arrays without reviving removed state', () => {
    const schema = x.array(
      x.object({
        left: x.object({
          value: x.string().xpath('./left'),
          values: x.array(x.string(), './left-item')
        }),
        right: x.object({
          value: x.string().xpath('./right'),
          values: x.array(x.string(), './right-item')
        }),
        first: x.array(x.string(), './first'),
        second: x.array(x.string(), './second')
      }),
      '//item'
    );

    const result = schema.parseSync(
      '<root><item><left>L</left><left-item>1</left-item><right>R</right>' +
      '<right-item>2</right-item><first>A</first><second>B</second></item></root>'
    );
    expect(result).toEqual([{
      left: { value: 'L', values: ['1'] },
      right: { value: 'R', values: ['2'] },
      first: ['A'],
      second: ['B']
    }]);
  });

  it('dispatches indexed relative attributes and position filters in field order', () => {
    const assignments: string[] = [];
    const schema = x.array(
      x.object({
        id: x.string().xpath('./entry[2]/@id').transform(value => {
          assignments.push(`id:${value}`);
          return value;
        }),
        text: x.string().xpath('./entry[2]/text()').transform(value => {
          assignments.push(`text:${value}`);
          return value;
        })
      }),
      '//group'
    );

    expect(schema.parseSync(
      '<root><group><entry id="1">A</entry><entry id="2">B</entry></group></root>'
    )).toEqual([{ id: '2', text: 'B' }]);
    expect(assignments).toEqual(['id:', 'text:', 'id:2', 'text:B']);
  });

  it('parses fragment and document strings without runtime UTF-8 encoding', async () => {
    const fragment = x.array(x.string(), '//item');
    const document = x.object({ id: x.string('/book/@id') });
    const scalar = x.string();
    fragment.parseSync('<item>warm</item>');
    document.parseSync('<book id="warm"/>', { documentMode: 'document' });

    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'TextEncoder');
    Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: undefined });
    try {
      const fragmentXml = '<item>A</item><item>B</item>';
      const documentXml = '<book id="7"/>';
      expect(fragment.parseSync(fragmentXml, { documentMode: 'fragment' })).toEqual(['A', 'B']);
      await expect(fragment.parse(fragmentXml, { documentMode: 'fragment' })).resolves.toEqual(['A', 'B']);
      expect(document.parseSync(documentXml, { documentMode: 'document' })).toEqual({ id: '7' });
      await expect(document.parse(documentXml, { documentMode: 'document' })).resolves.toEqual({ id: '7' });
      await expect(scalar.parse('<root>value</root>')).resolves.toBe('value');
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'TextEncoder', descriptor);
    }
  });

  it('uses the document root subtree for xpath-less scalars', () => {
    let transformCalls = 0;
    const text = x.string().transform(value => {
      transformCalls++;
      return value.toLowerCase();
    });
    const number = x.number().int().transform(value => value * 2);

    expect(text.parseSync('<root>A<![CDATA[B]]><nested>C</nested>D</root>')).toBe('abcd');
    expect(transformCalls).toBe(1);
    expect(number.parseSync('<root><![CDATA[42]]></root>')).toBe(84);
  });

  it('accepts async byte iterables and closes failed iterables', async () => {
    const encoder = new TextEncoder();
    async function* chunks(): AsyncGenerator<Uint8Array> {
      yield encoder.encode('<root>');
      yield encoder.encode('value</root>');
    }

    await expect(x.string().parse(chunks())).resolves.toBe('value');

    let syncClosed = false;
    function* invalidSync(): Generator<Uint8Array | string> {
      try {
        yield encoder.encode('<root>');
        yield 'not bytes';
      } finally {
        syncClosed = true;
      }
    }
    expect(() => x.string().parseSync(invalidSync() as Iterable<Uint8Array>))
      .toThrow('Byte iterables must contain only Uint8Array values or byte batches.');
    expect(syncClosed).toBe(true);

    let asyncClosed = false;
    async function* invalidAsync(): AsyncGenerator<Uint8Array | string> {
      try {
        yield encoder.encode('<root>');
        yield 'not bytes';
      } finally {
        asyncClosed = true;
      }
    }
    await expect(x.string().parse(invalidAsync() as AsyncIterable<Uint8Array>))
      .rejects.toThrow('Byte iterables must contain only Uint8Array values or byte batches.');
    expect(asyncClosed).toBe(true);
  });

  it('does not materialize event attributes when the plan does not select them', () => {
    const start = {
      type: XmlEventType.START_ELEMENT,
      name: 'root',
      get attributes(): never { throw new Error('attributes should stay lazy'); }
    } as AnyXmlEvent;
    const events: AnyXmlEvent[] = [
      { type: XmlEventType.START_DOCUMENT },
      start,
      { type: XmlEventType.CHARACTERS, value: 'value' },
      { type: XmlEventType.END_ELEMENT, name: 'root' },
      { type: XmlEventType.END_DOCUMENT },
    ];

    expect(x.string('/root').parseSync(events)).toBe('value');
  });

  it('defaults to document conformance and only enforces explicit resource caps', () => {
    expect(() => x.array(x.string(), '//item').parseSync('<item>A</item><item>B</item>'))
      .toThrow('exactly one root element');

    const deepXml = '<x>'.repeat(1_100) + 'value' + '</x>'.repeat(1_100);
    expect(x.string().parseSync(deepXml)).toBe('value');
    expect(() => x.string().parseSync('<root>value</root>', { maxEvents: 4 }))
      .toThrow('XML event limit exceeded: 4');
    expect(x.string().parseSync('<root>value</root>', { maxEvents: 5 })).toBe('value');
  });
});
