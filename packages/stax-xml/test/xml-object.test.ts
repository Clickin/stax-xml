import { describe, expect, it } from 'vitest';
import {
  parseXmlObject,
  parseXmlObjectSync,
  parseXmlTree,
  parseXmlTreeSync,
} from '../src/index';

describe('XML object helpers', () => {
  const encoder = new TextEncoder();

  it('builds an order-preserving tree for mixed content', () => {
    const tree = parseXmlTreeSync('<root id="1">Hello <b>World</b><![CDATA[!]]></root>');

    expect(tree.children).toHaveLength(1);
    const root = tree.children[0]!;
    expect(root.type).toBe('element');
    if (root.type !== 'element') return;

    expect(root.name).toBe('root');
    expect(Object.getPrototypeOf(root.attributes)).toBe(null);
    expect(root.attributes.id).toBe('1');
    expect(root.children).toEqual([
      { type: 'text', value: 'Hello ' },
      {
        type: 'element',
        name: 'b',
        attributes: expect.any(Object),
        children: [{ type: 'text', value: 'World' }],
      },
      { type: 'cdata', value: '!' },
    ]);
    expect(Object.getPrototypeOf((root.children[1] as { attributes: object }).attributes)).toBe(null);
  });

  it('builds compact objects with attributes, scalar leaves, and repeated children', () => {
    const result = parseXmlObjectSync(`
      <catalog>
        <book id="1">
          <title>One</title>
          <tag>a</tag>
          <tag>b</tag>
        </book>
      </catalog>
    `);

    expect(Object.getPrototypeOf(result)).toBe(null);
    const catalog = result.catalog as Record<string, unknown>;
    expect(Object.getPrototypeOf(catalog)).toBe(null);
    const book = catalog.book as Record<string, unknown>;
    expect(Object.getPrototypeOf(book)).toBe(null);
    expect(book['@id']).toBe('1');
    expect(book.title).toBe('One');
    expect(book.tag).toEqual(['a', 'b']);
  });

  it('can force child elements to arrays', () => {
    const result = parseXmlObjectSync('<root><item>one</item></root>', { alwaysArray: true });
    const root = (result.root as Array<Record<string, unknown>>)[0]!;

    expect(root.item).toEqual(['one']);
  });

  it('accepts sync helper inputs without forcing strings', async () => {
    const syncTree = await parseXmlTree('<root><item>ok</item></root>');
    expect(syncTree.children[0]).toMatchObject({ type: 'element', name: 'root' });

    const bytesTree = parseXmlTreeSync(encoder.encode('<root><item>bytes</item></root>'));
    expect(bytesTree.children[0]).toMatchObject({ type: 'element', name: 'root' });

    const chunkTree = parseXmlTreeSync([
      encoder.encode('<root>'),
      encoder.encode('<item>chunks</item></root>'),
    ]);
    expect(chunkTree.children[0]).toMatchObject({ type: 'element', name: 'root' });
  });

  it('keeps mixed content in explicit compact keys', () => {
    const result = parseXmlObjectSync('<root>Hello <b>World</b><![CDATA[!]]></root>');
    const root = result.root as Record<string, unknown>;

    expect(root['#text']).toBe('Hello');
    expect(root.b).toBe('World');
    expect(root['#cdata']).toBe('!');
  });

  it('keeps top-level text and cdata in compact keys', () => {
    const result = parseXmlObjectSync('hello<![CDATA[raw]]><empty/>');

    expect(result['#text']).toBe('hello');
    expect(result['#cdata']).toBe('raw');
    expect(result.empty).toBe('');
  });

  it('supports custom compact keys and repeated array appends', () => {
    const result = parseXmlObjectSync(
      '<root id="1"><item>a</item><item>b</item><item>c</item><![CDATA[raw]]></root>',
      { attributePrefix: '$', textKey: 'text', cdataKey: 'cdata' },
    );
    const root = result.root as Record<string, unknown>;

    expect(root.$id).toBe('1');
    expect(root.item).toEqual(['a', 'b', 'c']);
    expect(root.cdata).toBe('raw');
  });

  it('uses null-prototype objects for prototype pollution keys', () => {
    const result = parseXmlObjectSync(
      '<root __proto__="attr"><__proto__ polluted="yes">value</__proto__><constructor><prototype>bad</prototype></constructor></root>',
    );
    const root = result.root as Record<string, unknown>;
    const protoElement = root.__proto__ as Record<string, unknown>;
    const constructorElement = root.constructor as Record<string, unknown>;

    expect(Object.getPrototypeOf(result)).toBe(null);
    expect(Object.getPrototypeOf(root)).toBe(null);
    expect(Object.hasOwn(root, '@__proto__')).toBe(true);
    expect(root['@__proto__']).toBe('attr');
    expect(Object.hasOwn(root, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(protoElement)).toBe(null);
    expect(protoElement['@polluted']).toBe('yes');
    expect(protoElement['#text']).toBe('value');
    expect(Object.getPrototypeOf(constructorElement)).toBe(null);
    expect(constructorElement.prototype).toBe('bad');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects invalid batch sizes', () => {
    expect(() => parseXmlTreeSync('<root/>', { batchSize: 0 })).toThrow('batchSize must be a positive integer.');
  });

  it('parses ReadableStream input asynchronously', async () => {
    const bytes = encoder.encode('<root><item id="1">ok</item></root>');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.subarray(0, 12));
        controller.enqueue(bytes.subarray(12));
        controller.close();
      },
    });

    const result = await parseXmlObject(stream);
    const item = (result.root as Record<string, unknown>).item as Record<string, unknown>;

    expect(item['@id']).toBe('1');
    expect(item['#text']).toBe('ok');
  });

  it('parses async byte iterables into tree documents', async () => {
    async function* chunks() {
      yield encoder.encode('<ro');
      yield encoder.encode('ot>');
      yield encoder.encode('<item>ok</item></root>');
    }

    const tree = await parseXmlTree(chunks(), { trimText: true, batchSize: 1 });

    expect(tree.children[0]).toMatchObject({
      type: 'element',
      name: 'root',
    });
  });
});
