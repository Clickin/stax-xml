import { afterEach, describe, expect, it, vi } from 'vitest';
import { initStaxXml } from '../src/index';
import {
  ProjectionReader,
  parseXmlNodesSync,
  projectXmlObjectRecordsSync,
  projectXmlObjectRows,
  projectXmlObjectRowsSync,
} from '../src/projection/index';
import { resetStaxXmlRuntimeForTests } from '../src/runtime';

const spec = {
  itemName: 'entry',
  fields: [
    { outputName: 'code', valueKind: 'string', sourceKind: 'attribute', sourceName: 'code', textMode: 'direct' },
    { outputName: 'score', valueKind: 'number', sourceKind: 'element', sourceName: 'score', textMode: 'subtree' },
  ],
} as const;

afterEach(() => {
  vi.restoreAllMocks();
  resetStaxXmlRuntimeForTests();
});

describe('ProjectionReader public fast surface', () => {
  it('exposes a public reader name without a Node prefix', () => {
    expect(ProjectionReader.name).toBe('ProjectionReader');
  });

  it('materializes unknown-schema XML as txml-style nodes through the projection surface', () => {
    const result = parseXmlNodesSync('<root id="1">hi<a x="y"/>there</root>');

    expect(result).toEqual([
      {
        tagName: 'root',
        attributes: { id: '1' },
        children: [
          'hi',
          { tagName: 'a', attributes: { x: 'y' }, children: [] },
          'there',
        ],
      },
    ]);
    const root = result[0];
    expect(typeof root).toBe('object');
    if (typeof root === 'string') return;
    expect(Object.getPrototypeOf(root.attributes)).toBe(Object.prototype);
    expect(Object.hasOwn(root.attributes, 'id')).toBe(true);
  });

  it('keeps prototype-polluting XML names as own txml-style object properties', () => {
    const result = parseXmlNodesSync('<root __proto__="attr"><constructor>value</constructor></root>');
    const root = result[0];

    expect(typeof root).toBe('object');
    if (typeof root === 'string') return;
    expect(Object.hasOwn(root.attributes, '__proto__')).toBe(true);
    expect(root.attributes.__proto__).toBe('attr');
    expect(root.children).toEqual([
      { tagName: 'constructor', attributes: {}, children: ['value'] },
    ]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('decodes XML entities by default while keeping the txml-style node shape', () => {
    const result = parseXmlNodesSync('<root a="x&amp;y">&lt;ok&gt;</root>');

    expect(result).toEqual([
      {
        tagName: 'root',
        attributes: { a: 'x&y' },
        children: ['<ok>'],
      },
    ]);
  });

  it('applies custom entity mappings in txml-style node output', () => {
    const result = parseXmlNodesSync('<root mark="&copy;">&copy;</root>', {
      addEntities: [{ entity: '&copy;', value: '©' }],
    });

    expect(result).toEqual([
      {
        tagName: 'root',
        attributes: { mark: '©' },
        children: ['©'],
      },
    ]);
  });

  it('projects txml-style nodes through the initialized native runtime when available', async () => {
    const input = new TextEncoder().encode('<root id="1"><item>ok</item></root>');
    const parseDocumentNodesUint8Array = vi.fn((actual: Uint8Array, options: unknown) => {
      expect(actual).toBe(input);
      expect(options).toEqual({
        autoDecodeEntities: true,
        addEntities: [{ entity: '&copy;', value: '©' }],
      });
      return {
        inputBytes: actual.byteLength,
        nodeCount: 2,
        json: '[{"tagName":"root","attributes":{"id":"1"},"children":[{"tagName":"item","attributes":{},"children":["ok"]}]}]',
      };
    });
    const parseStructuralIndexUint8Array = vi.fn(() => {
      throw new Error('document-node projection should not build a JS structural event table');
    });
    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        parseDocumentNodesUint8Array,
        parseStructuralIndexUint8Array,
      }),
    });

    const result = parseXmlNodesSync(input, {
      backend: 'native',
      addEntities: [{ entity: '&copy;', value: '©' }],
    });

    expect(result).toEqual([
      {
        tagName: 'root',
        attributes: { id: '1' },
        children: [
          {
            tagName: 'item',
            attributes: {},
            children: ['ok'],
          },
        ],
      },
    ]);
    expect(parseDocumentNodesUint8Array).toHaveBeenCalledOnce();
    expect(parseStructuralIndexUint8Array).not.toHaveBeenCalled();
  });

  it('keeps string and byte node parsing aligned on the public native projection path', async () => {
    const input = '<root id="1">\n  <item>ok</item>\n</root>\n';
    const bytes = new TextEncoder().encode(input);
    const json = '[{"tagName":"root","attributes":{"id":"1"},"children":["\\n  ",{"tagName":"item","attributes":{},"children":["ok"]},"\\n"]},"\\n"]';
    const parseDocumentNodesUint8Array = vi.fn((actual: Uint8Array) => {
      expect(new TextDecoder().decode(actual)).toBe(input);
      return {
        inputBytes: actual.byteLength,
        nodeCount: 4,
        json,
      };
    });
    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        parseDocumentNodesUint8Array,
      }),
    });

    const stringResult = parseXmlNodesSync(input, { backend: 'native' });
    const byteResult = parseXmlNodesSync(bytes, { backend: 'native' });

    expect(stringResult).toEqual([
      {
        tagName: 'root',
        attributes: { id: '1' },
        children: [
          '\n  ',
          { tagName: 'item', attributes: {}, children: ['ok'] },
          '\n',
        ],
      },
      '\n',
    ]);
    expect(byteResult).toEqual(stringResult);
    expect(parseDocumentNodesUint8Array).toHaveBeenCalledTimes(2);
  });

  it('projects object rows through the initialized native runtime without event-reader hydration', async () => {
    const input = new TextEncoder().encode('<root><entry code="a"><score>7</score></entry></root>');
    const parseObjectRowsUint8Array = vi.fn((actual: Uint8Array, actualSpec: typeof spec) => {
      expect(actual).toBe(input);
      expect(actualSpec).toEqual(spec);
      return {
        inputBytes: actual.byteLength,
        eventCount: 5,
        maxDepth: 3,
        fieldCount: 2,
        rowCount: 1,
        columns: [
          { present: [true], values: ['a'] },
          { present: [true], numberValues: [7] },
        ],
      };
    });
    const parseStructuralIndexUint8Array = vi.fn(() => {
      throw new Error('projection surface should not build a JS structural event table');
    });
    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        parseObjectRowsUint8Array,
        parseStructuralIndexUint8Array,
      }),
    });

    const result = projectXmlObjectRowsSync(input, spec);

    expect(result.rowCount).toBe(1);
    expect(result.columns?.[0]?.values).toEqual(['a']);
    expect(parseObjectRowsUint8Array).toHaveBeenCalledOnce();
    expect(parseStructuralIndexUint8Array).not.toHaveBeenCalled();
  });

  it('passes ArrayBufferView projection input to native as a zero-copy Uint8Array view', async () => {
    const bytes = new TextEncoder().encode('xx<root><entry code="a"><score>7</score></entry></root>yy');
    const input = new DataView(bytes.buffer, bytes.byteOffset + 2, bytes.byteLength - 4);
    const parseObjectRowsUint8Array = vi.fn((actual: Uint8Array, actualSpec: typeof spec) => {
      expect(actual.buffer).toBe(input.buffer);
      expect(actual.byteOffset).toBe(input.byteOffset);
      expect(actual.byteLength).toBe(input.byteLength);
      expect(actualSpec).toEqual(spec);
      return {
        inputBytes: actual.byteLength,
        eventCount: 5,
        maxDepth: 3,
        fieldCount: 2,
        rowCount: 1,
        columns: [
          { present: [true], values: ['a'] },
          { present: [true], numberValues: [7] },
        ],
      };
    });
    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({ parseObjectRowsUint8Array }),
    });

    const result = projectXmlObjectRowsSync(input, spec);

    expect(result.rowCount).toBe(1);
    expect(parseObjectRowsUint8Array).toHaveBeenCalledOnce();
  });

  it('resolves the native backend for async projection when runtime is not preinitialized', async () => {
    const input = new Uint8Array(Buffer.from('<root><entry code="a"><score>7</score></entry></root>'));
    const parseObjectRowsUint8Array = vi.fn(() => ({
      inputBytes: input.byteLength,
      eventCount: 5,
      maxDepth: 3,
      fieldCount: 2,
      rowCount: 1,
      columns: [
        { present: [true], values: ['a'] },
        { present: [true], numberValues: [7] },
      ],
    }));

    const result = await projectXmlObjectRows(input, spec, {
      backend: 'native',
      importPackage: async () => ({ parseObjectRowsUint8Array }),
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
    });

    expect(result.eventCount).toBe(5);
    expect(parseObjectRowsUint8Array).toHaveBeenCalledOnce();
  });

  it('offers an instance API for repeated projection calls', async () => {
    const input = Buffer.from('<root><entry code="a"><score>7</score></entry></root>');
    const parseObjectRowsUint8Array = vi.fn(() => ({
      inputBytes: input.byteLength,
      eventCount: 5,
      maxDepth: 3,
      fieldCount: 2,
      rowCount: 1,
      columns: [
        { present: [true], values: ['a'] },
        { present: [true], numberValues: [7] },
      ],
    }));
    const reader = new ProjectionReader({
      backend: 'native',
      importPackage: async () => ({ parseObjectRowsUint8Array }),
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
    });

    await expect(reader.projectObjectRows(input, spec)).resolves.toMatchObject({
      rowCount: 1,
      fieldCount: 2,
    });
  });

  it('projects object records through the initialized native runtime', async () => {
    const input = new TextEncoder().encode('<root><entry code="a"><score>7</score></entry></root>');
    const parseObjectRecordsUint8Array = vi.fn((actual: Uint8Array, actualSpec: typeof spec) => {
      expect(actual).toBe(input);
      expect(actualSpec).toEqual(spec);
      return {
        inputBytes: actual.byteLength,
        eventCount: 5,
        maxDepth: 3,
        fieldCount: 2,
        rowCount: 1,
        json: '[{"code":"a","score":7}]',
      };
    });
    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({ parseObjectRecordsUint8Array }),
    });

    const result = projectXmlObjectRecordsSync(input, spec);

    expect(result.rows).toEqual([{ code: 'a', score: 7 }]);
    expect(parseObjectRecordsUint8Array).toHaveBeenCalledOnce();
  });
});
