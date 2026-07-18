import { describe, expect, it, vi } from 'vitest';
import { x } from '../../src/converter/index.js';
import { XmlEventType, type AnyXmlEvent } from 'stax-xml-core';

function utf16le(text: string): Uint8Array {
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    bytes[2 + index * 2] = code & 0xff;
    bytes[3 + index * 2] = code >>> 8;
  }
  return bytes;
}

describe('streaming-only converter', () => {
  it('automatically uses the dispatch plan for supported selectors', () => {
    const schema = x.object({
      title: x.string().xpath('/book/title'),
      id: x.string().xpath('/book/@id')
    });

    expect('compile' in schema).toBe(false);
    expect(schema.parseSync('<book id="7"><title>XML</title></book>')).toEqual({
      title: 'XML',
      id: '7'
    });
  });

  it('precompiles the IR backend before parsing', () => {
    const schema = x.array(x.object({
      id: x.string().xpath('./@id'),
      values: x.array(x.object({ value: x.string().xpath('.') }), './values/value')
    }), '/root/row');

    expect(schema.precompile()).toBe(schema);
    expect(schema.parseSync(
      '<root><row id="1"><values><value>A</value></values></row></root>'
    )).toEqual([{ id: '1', values: [{ value: 'A' }] }]);
  });

  it('compiles fixed-path record projections from the schema shape', async () => {
    const schema = x.object({
      users: x.array(x.object({
        id: x.string().xpath('./@id'),
        name: x.string().xpath('./name'),
        score: x.number().xpath('./score').transform(value => value * 2),
        note: x.string().xpath('./note').optional()
      }), '/root/users/user'),
      codes: x.array(x.object({
        value: x.string().xpath('./@value'),
        label: x.string().xpath('./label')
      }), '/root/codes/code'),
      firstName: x.string().xpath('//user/name').optional()
    });

    const xml = '<root><users><user id="1"><name>A</name><score>4</score></user>' +
      '<user id="2"><name>B</name><score>5</score><note>ok</note></user></users>' +
      '<codes><code value="x"><label>X</label></code></codes></root>';
    const expected = {
      users: [
        { id: '1', name: 'A', score: 8, note: undefined },
        { id: '2', name: 'B', score: 10, note: 'ok' }
      ],
      codes: [{ value: 'x', label: 'X' }],
      firstName: 'A'
    };

    expect(schema.parseSync(xml)).toEqual(expected);
    await expect(schema.parse(xml)).resolves.toEqual(expected);
  });

  it('warns and falls back when runtime source generation is unavailable', () => {
    const schema = x.object({
      rows: x.array(x.object({
        id: x.string().xpath('./@id'),
        second: x.string().xpath('./value[2]'),
        nested: x.object({ detail: x.string().xpath('./detail') })
      }), '/root/row')
    });
    const flatSchema = x.object({
      rows: x.array(x.object({
        id: x.string().xpath('./@id'),
        value: x.string().xpath('./value')
      }), '/root/row')
    });
    const nestedArraySchema = x.array(x.object({
      id: x.string().xpath('./@id'),
      values: x.array(x.object({ value: x.string().xpath('.') }), './values/value')
    }), '/root/row');
    const sharedDepthSchema = x.array(x.object({
      detail: x.object({ value: x.string('./value') }).xpath('//detail')
    }), '//item');
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Function');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    Object.defineProperty(globalThis, 'Function', {
      configurable: true,
      value: () => { throw new EvalError('code generation disabled'); }
    });
    try {
      expect(nestedArraySchema.precompile()).toBe(nestedArraySchema);
      expect(schema.parseSync(
        '<root><row id="1"><value>A</value><value>B</value><detail>D</detail></row></root>'
      )).toEqual({ rows: [{ id: '1', second: 'B', nested: { detail: 'D' } }] });
      expect(flatSchema.parseSync('<root><row id="2"><value>V</value></row></root>'))
        .toEqual({ rows: [{ id: '2', value: 'V' }] });
      expect(nestedArraySchema.parseSync(
        '<root><row id="3"><values><value>A</value><value>B</value></values></row></root>'
      )).toEqual([{ id: '3', values: [{ value: 'A' }, { value: 'B' }] }]);
      expect(sharedDepthSchema.parseSync(
        '<root><item><item><detail><value>X</value></detail></item></item></root>'
      )).toEqual([{ detail: { value: 'X' } }, { detail: { value: 'X' } }]);
      expect(warn).toHaveBeenCalledWith(
        '[stax-xml] Runtime code generation is unavailable; using the slower compiled-plan executor.'
      );
    } finally {
      warn.mockRestore();
      if (descriptor) Object.defineProperty(globalThis, 'Function', descriptor);
    }
  });

  it('preserves event limits in compiled record projections', () => {
    const textSchema = x.object({
      rows: x.array(x.object({ value: x.string().xpath('./value') }), '/root/row')
    });
    const textXml = '<root><row><value>A</value></row></root>';
    expect(() => textSchema.parseSync(textXml, { maxEvents: 8 }))
      .toThrow('XML event limit exceeded: 8');
    expect(textSchema.parseSync(textXml, { maxEvents: 9 }))
      .toEqual({ rows: [{ value: 'A' }] });

    const attributeSchema = x.object({
      rows: x.array(x.object({ id: x.string().xpath('./@id') }), '/root/row')
    });
    const attributeXml = '<root><row id="1">ignored</row></root>';
    expect(() => attributeSchema.parseSync(attributeXml, { maxEvents: 6 }))
      .toThrow('XML event limit exceeded: 6');
    expect(attributeSchema.parseSync(attributeXml, { maxEvents: 7 }))
      .toEqual({ rows: [{ id: '1' }] });
  });

  it('rejects selectors that require a tree evaluator', () => {
    expect(() => x.object({ title: x.string().xpath('/book/*') }))
      .toThrow('Wildcard XPath is not supported');
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
    expect(assignments).toEqual(['id:2', 'text:B']);
  });

  it('keeps nested descendant array items in document order across inputs', () => {
    const schema = x.array(x.object({ value: x.string('./value') }), '//item');
    const xml = '<root><item><value>0</value><item><value>1</value></item></item></root>';
    const expected = [{ value: '0' }, { value: '1' }];

    expect(schema.parseSync(xml)).toEqual(expected);
    expect(schema.parseSync(new TextEncoder().encode(xml))).toEqual(expected);
  });

  it('keeps same-slot owners that share an exact depth', () => {
    const schema = x.array(x.object({
      label: x.string('./label'),
      detail: x.object({ value: x.string('./value') }).xpath('//detail')
    }), '//item');
    const xml = '<root><item><label>outer</label><item><label>inner</label>' +
      '<detail><value>X</value></detail></item></item></root>';

    expect(schema.parseSync(xml)).toEqual([
      { label: 'outer', detail: { value: 'X' } },
      { label: 'inner', detail: { value: 'X' } }
    ]);
  });

  it('scopes position predicates to same-name siblings', () => {
    const schema = x.array(x.object({
      first: x.string('./item[1]'),
      second: x.string('./item[2]')
    }), '//group');

    expect(schema.parseSync('<r><group><noise/><item>A</item><item>B</item></group></r>'))
      .toEqual([{ first: 'A', second: 'B' }]);
  });

  it('does not lock a scalar field after a missing attribute candidate', () => {
    const schema = x.object({
      rows: x.array(x.object({ v: x.string('./@v') }), '/r/seed'),
      id: x.string('//item/@id')
    });

    expect(schema.parseSync('<r><seed v="x"/><item/><item id="ok"/></r>'))
      .toEqual({ rows: [{ v: 'x' }], id: 'ok' });
  });

  it('captures current-context fields in array objects', () => {
    const schema = x.object({ self: x.array(x.object({ same: x.string('.') }), '.') }).xpath('/r');

    expect(schema.parseSync('<r>A<v>B</v>C</r>')).toEqual({ self: [{ same: 'ABC' }] });
  });

  it('keeps an outer descendant scalar capture active through nested matches', () => {
    const schema = x.object({
      rows: x.array(x.object({ id: x.string('./@id') }), '/r/row'),
      value: x.string('//item')
    });
    const xml = '<r><row id="1"/><item>A<item>B</item>C</item></r>';
    const expected = { rows: [{ id: '1' }], value: 'ABC' };

    expect(schema.parseSync(xml)).toEqual(expected);
    expect(schema.parseSync(new TextEncoder().encode(xml))).toEqual(expected);
  });

  it('creates __proto__ as an own data property', () => {
    const schema = x.object({ ['__proto__']: x.string('/r/value') });
    const value = schema.parseSync('<r><value>safe</value></r>');

    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(value, '__proto__')).toBe(true);
    expect(value).toEqual({ ['__proto__']: 'safe' });
  });

  it('applies a root array transform once, after the array is finalized', () => {
    let calls = 0;
    const schema = x.array(x.object({ value: x.string('./value') }), '//item').transform(items => {
      calls++;
      if (items.length === 0) throw new Error('root transform ran before items were collected');
      return items;
    });

    expect(schema.parseSync('<r><item><value>A</value></item></r>')).toEqual([{ value: 'A' }]);
    expect(calls).toBe(1);
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

  it('uses the configured TextDecoder encoding for converter byte input', async () => {
    const xml = '<?xml version="1.0" encoding="UTF-16"?><root>값</root>';
    const bytes = utf16le(xml);
    const schema = x.string('/root');

    expect(schema.parseSync(bytes, { encoding: 'utf-16le' })).toBe('값');
    async function* chunks(): AsyncGenerator<Uint8Array> {
      for (let offset = 0; offset < bytes.length; offset += 3) {
        yield bytes.slice(offset, offset + 3);
      }
    }
    await expect(schema.parse(chunks(), { encoding: 'utf-16le' })).resolves.toBe('값');
    expect(() => schema.parseSync(bytes, { encoding: 'not-an-encoding' })).toThrow();
  });

  it('preserves primary iterable errors when iterator cleanup also fails', async () => {
    const encoder = new TextEncoder();
    const syncInput = {
      [Symbol.iterator]() {
        let index = 0;
        return {
          next: () => index++ === 0
            ? { value: encoder.encode('<root>'), done: false as const }
            : { value: 'not bytes', done: false as const },
          return: () => { throw new Error('sync cleanup failed'); }
        };
      }
    };
    expect(() => x.string().parseSync(syncInput as Iterable<Uint8Array>))
      .toThrow('Byte iterables must contain only Uint8Array values or byte batches.');

    const asyncInput = {
      [Symbol.asyncIterator]() {
        let index = 0;
        return {
          next: async () => index++ === 0
            ? { value: encoder.encode('<root>'), done: false as const }
            : { value: 'not bytes', done: false as const },
          return: async () => { throw new Error('async cleanup failed'); }
        };
      }
    };
    await expect(x.string().parse(asyncInput as AsyncIterable<Uint8Array>))
      .rejects.toThrow('Byte iterables must contain only Uint8Array values or byte batches.');
  });

  it('validates empty and materialized-event inputs with the same document contract', async () => {
    expect(() => x.string().parseSync([] as Uint8Array[], { documentMode: 'document' })).toThrow();
    await expect(x.string().parse((async function* () {})(), { documentMode: 'document' })).rejects.toThrow();

    const twoRoots = [
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'a', attributes: [] },
      { type: XmlEventType.END_ELEMENT, name: 'a' },
      { type: XmlEventType.START_ELEMENT, name: 'b', attributes: [] },
      { type: XmlEventType.END_ELEMENT, name: 'b' },
      { type: XmlEventType.END_DOCUMENT }
    ] as AnyXmlEvent[];
    expect(() => x.string().parseSync(twoRoots, { documentMode: 'document' }))
      .toThrow(/multiple root/i);

    const mismatched = [
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'a', attributes: [] },
      { type: XmlEventType.END_ELEMENT, name: 'b' },
      { type: XmlEventType.END_DOCUMENT }
    ] as AnyXmlEvent[];
    expect(() => x.string().parseSync(mismatched)).toThrow(/mismatched closing/i);

    const mixed = [
      { type: XmlEventType.START_DOCUMENT },
      new TextEncoder().encode('<root/>')
    ] as unknown as AnyXmlEvent[];
    expect(() => x.string().parseSync(mixed)).toThrow(/only XML event values/i);
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

  it('defaults to fragment mode and only enforces explicit resource caps', () => {
    expect(x.array(x.string(), '//item').parseSync('<item>A</item><item>B</item>'))
      .toEqual(['A', 'B']);

    const deepXml = '<x>'.repeat(1_100) + 'value' + '</x>'.repeat(1_100);
    expect(x.string().parseSync(deepXml)).toBe('value');
    expect(() => x.string().parseSync('<root>value</root>', { maxEvents: 4 }))
      .toThrow('XML event limit exceeded: 4');
    expect(x.string().parseSync('<root>value</root>', { maxEvents: 5 })).toBe('value');
  });
});
