import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveBackend: vi.fn(),
}));

vi.mock('../../src/runtime/index.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/runtime/index.js')>('../../src/runtime/index.js');
  return {
    ...actual,
    resolveStaxXmlRuntimeBackend: mocks.resolveBackend,
  };
});

import { x } from '../../src/converter/index.js';

describe('compiled converter native projection fast path', () => {
  beforeEach(() => {
    mocks.resolveBackend.mockReset();
  });

  it('uses generic native table projection rows for supported object-array byte schemas', async () => {
    const xml = '<root><entry code="js"><label>fallback</label><score>1</score></entry></root>';
    const input = new TextEncoder().encode(xml);
    const parseObjectRowsViaTableUint8Array = vi.fn(() => ({
      inputBytes: input.byteLength,
      eventCount: 8,
      maxDepth: 3,
      fieldCount: 3,
      rowCount: 1,
      columns: [
        { present: [true], values: ['native'] },
        { present: [true], values: ['Native &amp; Label'] },
        { present: [true], values: ['42'] },
      ],
    }));
    const parseItemRowsViaTableUint8Array = vi.fn(() => {
      throw new Error('hardcoded item projection should not be used for generic plans');
    });
    const parseStructuralIndexUint8Array = vi.fn(() => {
      throw new Error('JS table wrapper should not be used for supported generic projection');
    });
    mocks.resolveBackend.mockResolvedValue({
      kind: 'native',
      packageName: '@stax-xml/native-test',
      module: {
        parseObjectRowsViaTableUint8Array,
        parseItemRowsViaTableUint8Array,
        parseStructuralIndexUint8Array,
      },
      errors: [],
    });

    const schema = x.array(
      x.object({
        code: x.string().xpath('./@code'),
        label: x.string().xpath('./label'),
        score: x.number().xpath('./score').int(),
      }),
      '//entry',
    ).compile();

    await expect(schema.parse(input, {
      acceleration: { backend: 'native' },
      decodeEntities: true,
    })).resolves.toEqual([{ code: 'native', label: 'Native & Label', score: 42 }]);
    expect(parseObjectRowsViaTableUint8Array).toHaveBeenCalledWith(input, {
      itemName: 'entry',
      fields: [
        { outputName: 'code', valueKind: 'string', sourceKind: 'attribute', sourceName: 'code', textMode: 'direct' },
        { outputName: 'label', valueKind: 'string', sourceKind: 'element', sourceName: 'label', textMode: 'subtree' },
        { outputName: 'score', valueKind: 'number', sourceKind: 'element', sourceName: 'score', textMode: 'subtree' },
      ],
    });
    expect(parseItemRowsViaTableUint8Array).not.toHaveBeenCalled();
    expect(parseStructuralIndexUint8Array).not.toHaveBeenCalled();
  });

  it('prefers direct generic native projection over table projection when available', async () => {
    const xml = '<root><entry code="js"><label>fallback</label><score>1</score></entry></root>';
    const input = new TextEncoder().encode(xml);
    const parseObjectRowsUint8Array = vi.fn(() => ({
      inputBytes: input.byteLength,
      eventCount: 8,
      maxDepth: 3,
      fieldCount: 3,
      rowCount: 1,
      columns: [
        { present: [true], values: ['direct'] },
        { present: [true], values: ['label'] },
        { present: [true], numberValues: [7] },
      ],
    }));
    const parseObjectRowsViaTableUint8Array = vi.fn(() => {
      throw new Error('table projection should not be used when direct projection is available');
    });
    mocks.resolveBackend.mockResolvedValue({
      kind: 'native',
      packageName: '@stax-xml/native-test',
      module: {
        parseObjectRowsUint8Array,
        parseObjectRowsViaTableUint8Array,
      },
      errors: [],
    });

    const schema = x.array(
      x.object({
        code: x.string().xpath('./@code'),
        label: x.string().xpath('./label'),
        score: x.number().xpath('./score').int(),
      }),
      '//entry',
    ).compile();

    await expect(schema.parse(input, { acceleration: { backend: 'native' } }))
      .resolves.toEqual([{ code: 'direct', label: 'label', score: 7 }]);
    expect(parseObjectRowsUint8Array).toHaveBeenCalledOnce();
    expect(parseObjectRowsViaTableUint8Array).not.toHaveBeenCalled();
  });

  it('applies compiled number validation to native projection row values', async () => {
    const xml = '<root><entry code="js"><label>fallback</label><score>1</score></entry></root>';
    const input = new TextEncoder().encode(xml);
    const parseObjectRowsViaTableUint8Array = vi.fn(() => ({
      inputBytes: input.byteLength,
      eventCount: 8,
      maxDepth: 3,
      fieldCount: 3,
      rowCount: 1,
      columns: [
        { present: [true], values: ['native'] },
        { present: [true], values: ['label'] },
        { present: [true], values: ['1.5'] },
      ],
    }));
    mocks.resolveBackend.mockResolvedValue({
      kind: 'native',
      packageName: '@stax-xml/native-test',
      module: { parseObjectRowsViaTableUint8Array },
      errors: [],
    });

    const schema = x.array(
      x.object({
        code: x.string().xpath('./@code'),
        label: x.string().xpath('./label'),
        score: x.number().xpath('./score').int(),
      }),
      '//entry',
    ).compile();

    await expect(schema.parse(input, { acceleration: { backend: 'native' } }))
      .rejects.toThrow('Expected integer');
  });

  it('accepts typed number columns from generic native projection rows', async () => {
    const xml = '<root><entry code="js"><label>fallback</label><score>1</score></entry></root>';
    const input = new TextEncoder().encode(xml);
    const parseObjectRowsViaTableUint8Array = vi.fn(() => ({
      inputBytes: input.byteLength,
      eventCount: 8,
      maxDepth: 3,
      fieldCount: 3,
      rowCount: 1,
      columns: [
        { present: [true], values: ['native'] },
        { present: [true], values: ['label'] },
        { present: [true], numberValues: [42] },
      ],
    }));
    mocks.resolveBackend.mockResolvedValue({
      kind: 'native',
      packageName: '@stax-xml/native-test',
      module: { parseObjectRowsViaTableUint8Array },
      errors: [],
    });

    const schema = x.array(
      x.object({
        code: x.string().xpath('./@code'),
        label: x.string().xpath('./label'),
        score: x.number().xpath('./score').int(),
      }),
      '//entry',
    ).compile();

    await expect(schema.parse(input, { acceleration: { backend: 'native' } }))
      .resolves.toEqual([{ code: 'native', label: 'label', score: 42 }]);
  });

  it('accepts string span columns from generic native projection rows', async () => {
    const xml = '<root><entry code="native"><label>label</label><score>42</score></entry></root>';
    const input = new TextEncoder().encode(xml);
    const codeStart = xml.indexOf('native');
    const codeEnd = codeStart + 'native'.length;
    const labelStart = xml.indexOf('label');
    const labelEnd = labelStart + 'label'.length;
    const parseObjectRowsViaTableUint8Array = vi.fn(() => ({
      inputBytes: input.byteLength,
      eventCount: 8,
      maxDepth: 3,
      fieldCount: 3,
      rowCount: 1,
      columns: [
        { present: [true], spanStarts: [codeStart], spanEnds: [codeEnd] },
        { present: [true], spanStarts: [labelStart], spanEnds: [labelEnd] },
        { present: [true], numberValues: [42] },
      ],
    }));
    mocks.resolveBackend.mockResolvedValue({
      kind: 'native',
      packageName: '@stax-xml/native-test',
      module: { parseObjectRowsViaTableUint8Array },
      errors: [],
    });

    const schema = x.array(
      x.object({
        code: x.string().xpath('./@code'),
        label: x.string().xpath('./label'),
        score: x.number().xpath('./score').int(),
      }),
      '//entry',
    ).compile();

    await expect(schema.parse(input, { acceleration: { backend: 'native' } }))
      .resolves.toEqual([{ code: 'native', label: 'label', score: 42 }]);
  });

  it('uses native table projection rows for the supported item-object byte schema', async () => {
    const xml = '<root><item id="1"><name>JS</name><value>fallback</value></item></root>';
    const input = new TextEncoder().encode(xml);
    const rows = [{ id: 9, name: 'Native', value: 'Fast' }];
    const parseItemRowsViaTableUint8Array = vi.fn(() => ({
      inputBytes: input.byteLength,
      eventCount: 8,
      maxDepth: 3,
      rows,
    }));
    const parseStructuralIndexUint8Array = vi.fn(() => {
      throw new Error('JS table wrapper should not be used for supported native projection');
    });
    mocks.resolveBackend.mockResolvedValue({
      kind: 'native',
      packageName: '@stax-xml/native-test',
      module: {
        parseItemRowsViaTableUint8Array,
        parseStructuralIndexUint8Array,
      },
      errors: [],
    });

    const schema = x.array(
      x.object({
        id: x.number().xpath('./@id').int(),
        name: x.string().xpath('./name'),
        value: x.string().xpath('./value'),
      }),
      '//item',
    ).compile();

    await expect(schema.parse(input, { acceleration: { backend: 'native' } }))
      .resolves.toEqual(rows);
    expect(parseItemRowsViaTableUint8Array).toHaveBeenCalledWith(input);
    expect(parseStructuralIndexUint8Array).not.toHaveBeenCalled();
  });

  it('falls back to the normal parser for unsupported native projection plans', async () => {
    const xml = '<root><entry id="1"><name>JS</name><value>fallback</value></entry></root>';
    const input = new TextEncoder().encode(xml);
    const parseItemRowsViaTableUint8Array = vi.fn(() => ({
      inputBytes: input.byteLength,
      eventCount: 8,
      maxDepth: 3,
      rows: [{ id: 9, name: 'Native', value: 'Fast' }],
    }));
    mocks.resolveBackend.mockResolvedValue({
      kind: 'native',
      packageName: '@stax-xml/native-test',
      module: { parseItemRowsViaTableUint8Array },
      errors: [],
    });

    const schema = x.array(
      x.object({
        id: x.number().xpath('./@id').int(),
        name: x.string().xpath('./name'),
        value: x.string().xpath('./value'),
      }),
      '//entry',
    ).compile();

    await expect(schema.parse(input, { acceleration: { backend: 'native' } }))
      .resolves.toEqual([{ id: 1, name: 'JS', value: 'fallback' }]);
    expect(parseItemRowsViaTableUint8Array).not.toHaveBeenCalled();
  });
});
