import { Buffer } from 'node:buffer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { XmlSchemaBase, type ParseInput } from '../../src/converter/base.js';
import { SchemaType, type ParseOptions, type XmlWriteOptions } from '../../src/converter/types.js';

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

vi.mock('../../src/runtime/native-backend.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/runtime/native-backend.js')>('../../src/runtime/native-backend.js');
  return {
    ...actual,
    resolveStaxXmlRuntimeBackend: mocks.resolveBackend,
  };
});

import { x } from '../../src/converter/index.js';
import { initStaxXml } from '../../src/index.js';
import { resetStaxXmlRuntimeForTests } from '../../src/runtime/index.js';

describe('compiled converter native projection fast path', () => {
  beforeEach(() => {
    mocks.resolveBackend.mockReset();
    resetStaxXmlRuntimeForTests();
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

  it('prefers native object records projection for required generic object-array byte schemas', async () => {
    const xml = '<root><entry code="js"><label>fallback</label><score>1</score></entry></root>';
    const input = new TextEncoder().encode(xml);
    const parseObjectRecordsUint8Array = vi.fn(() => ({
      inputBytes: input.byteLength,
      eventCount: 8,
      maxDepth: 3,
      fieldCount: 3,
      rowCount: 1,
      json: '[{"code":"record","label":"native","score":42}]',
    }));
    const parseObjectRowsUint8Array = vi.fn(() => {
      throw new Error('column projection should not be used when record projection is available');
    });
    const createObjectProjectionPlan = vi.fn(() => ({
      projectRecords: parseObjectRecordsUint8Array,
      projectRows: parseObjectRowsUint8Array,
    }));
    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createObjectProjectionPlan,
        parseObjectRowsUint8Array,
      }),
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
      .resolves.toEqual([{ code: 'record', label: 'native', score: 42 }]);
    expect(createObjectProjectionPlan).toHaveBeenCalledOnce();
    expect(parseObjectRecordsUint8Array).toHaveBeenCalledOnce();
    expect(parseObjectRowsUint8Array).not.toHaveBeenCalled();
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

  it('hydrates optional string native projection values and accepts non-Uint8Array views', async () => {
    const xml = '<root><entry code="js"><label>fallback</label><score>1</score></entry></root>';
    const bytes = new TextEncoder().encode(xml);
    const input = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const schema = x.array(
      x.object({
        code: x.string().xpath('./@code'),
        label: x.string().xpath('./label').optional(),
        score: x.number().xpath('./score').int(),
      }),
      '//entry',
    ).compile();

    for (const [decodeEntities, expectedLabel] of [
      [true, 'Native & Label'],
      [false, 'Native &amp; Label'],
    ] as const) {
      const parseObjectRowsViaTableUint8Array = vi.fn(() => ({
        inputBytes: bytes.byteLength,
        eventCount: 8,
        maxDepth: 3,
        fieldCount: 3,
        rowCount: 1,
        columns: [
          { present: [true], values: ['native'] },
          { present: [true], values: ['Native &amp; Label'] },
          { present: [true], numberValues: [42] },
        ],
      }));
      mocks.resolveBackend.mockResolvedValueOnce({
        kind: 'native',
        packageName: '@stax-xml/native-test',
        module: { parseObjectRowsViaTableUint8Array },
        errors: [],
      });

      await expect(schema.parse(input, {
        acceleration: { backend: 'native' },
        decodeEntities,
      })).resolves.toEqual([{ code: 'native', label: expectedLabel, score: 42 }]);
      expect(parseObjectRowsViaTableUint8Array.mock.calls[0]?.[0]).toBeInstanceOf(Uint8Array);
    }
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

  it('decodes multibyte UTF-8 span columns from non-Buffer native projection inputs', async () => {
    const xml = '<root><entry code="한글"><label>안녕🙂</label><score>42</score></entry></root>';
    const bytes = new TextEncoder().encode(xml);
    const prefixBytes = 5;
    const prefixed = new Uint8Array(bytes.byteLength + prefixBytes);
    prefixed.set(bytes, prefixBytes);
    const input = new DataView(prefixed.buffer, prefixBytes, bytes.byteLength);
    const code = span(bytes, '한글');
    const label = span(bytes, '안녕🙂');
    const originalBuffer = (globalThis as { Buffer?: typeof Buffer }).Buffer;
    const parseObjectRowsViaTableUint8Array = vi.fn((actual: Uint8Array) => {
      expect(actual.byteOffset).toBe(prefixBytes);
      expect(actual.byteLength).toBe(bytes.byteLength);
      return {
        inputBytes: actual.byteLength,
        eventCount: 8,
        maxDepth: 3,
        fieldCount: 3,
        rowCount: 1,
      columns: [
        { present: [true], values: [], spanStarts: [code.start], spanEnds: [code.end] },
        { present: [true], values: [], spanStarts: [label.start], spanEnds: [label.end] },
        { present: [true], numberValues: [42] },
      ],
      };
    });
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

    try {
      (globalThis as { Buffer?: typeof Buffer }).Buffer = undefined;
      await expect(schema.parse(input, { acceleration: { backend: 'native' } }))
        .resolves.toEqual([{ code: '한글', label: '안녕🙂', score: 42 }]);
    } finally {
      (globalThis as { Buffer?: typeof Buffer }).Buffer = originalBuffer;
    }
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

  it('does not retry the JavaScript parser when native item projection fails', async () => {
    const xml = '<root><item id="1"><name>JS</name><value>fallback</value></item></root>';
    const input = new TextEncoder().encode(xml);
    const parseItemRowsViaTableUint8Array = vi.fn(() => {
      throw new Error('native item projection failed');
    });
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
      '//item',
    ).compile();

    await expect(schema.parse(input, { acceleration: { backend: 'native' } }))
      .rejects.toThrow('native item projection failed');
  });

  it('fails clearly when explicit native acceleration cannot satisfy a projection plan', async () => {
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
      .rejects.toThrow(/does not provide structuralIndexUtf8 capability/);
    expect(parseItemRowsViaTableUint8Array).not.toHaveBeenCalled();
  });

  it('keeps unsupported object-row shapes on the internal JavaScript path when acceleration is not requested', async () => {
    const xml = '<root><entry code="js"><label>label</label><child id="c"><value>nested</value></child></entry></root>';
    const input = new TextEncoder().encode(xml);
    const cases = [
      [
        x.array(x.object({ childId: x.string().xpath('./child/@id') }), '//entry').compile(),
        [{ childId: 'c' }],
      ],
      [
        x.array(x.object({ nested: x.string().xpath('./child/value') }), '//entry').compile(),
        [{ nested: 'nested' }],
      ],
      [
        x.array(x.object({ child: x.object({ value: x.string().xpath('./value') }).xpath('./child') }), '//entry').compile(),
        [{ child: { value: 'nested' } }],
      ],
      [
        x.array(x.object({ label: x.string().xpath('./label[1]') }), '//entry').compile(),
        [{ label: 'label' }],
      ],
      [
        x.array(x.object({ label: x.string().xpath('./label').transform(value => `${value}!`) }), '//entry').compile(),
        [{ label: 'label!' }],
      ],
      [
        x.array(x.object({}), '//entry').compile(),
        [{}],
      ],
    ] as const;

    for (const [schema, expected] of cases) {
      await expect(schema.parse(input)).resolves.toEqual(expected);
    }
    expect(mocks.resolveBackend).not.toHaveBeenCalled();
  });

  it('skips acceleration for non-fast-path modes and fails when requested native capabilities are absent', async () => {
    const xml = '<root><entry code="js"><label>label</label><score>1</score></entry></root>';
    const input = new TextEncoder().encode(xml);
    const schema = genericEntrySchema();

    await expect(schema.parse(input, {
      documentMode: 'document',
      acceleration: { backend: 'native' },
    })).resolves.toEqual([{ code: 'js', label: 'label', score: 1 }]);
    expect(mocks.resolveBackend).not.toHaveBeenCalled();

    await expect(schema.parse(input, { acceleration: { simd: 'avx2' } }))
      .resolves.toEqual([{ code: 'js', label: 'label', score: 1 }]);
    expect(mocks.resolveBackend).not.toHaveBeenCalled();

    mocks.resolveBackend.mockResolvedValue({ kind: 'native', module: {}, errors: [] });
    await expect(schema.parse(input, { acceleration: { backend: 'native' } }))
      .rejects.toThrow(/does not provide structuralIndexUtf8 capability/);

    mocks.resolveBackend.mockReset();
    mocks.resolveBackend.mockResolvedValue({ kind: 'wasm', module: {}, errors: [] });
    await expect(schema.parse(input, { acceleration: { backend: 'wasm' } }))
      .rejects.toThrow(/does not provide structuralIndexUtf8 capability/);
  });

  it('uses structural native tables for unsupported string and byte compiled plans', async () => {
    const stringXml = '<root><value>string-table</value></root>';
    const byteXml = '<root><value>byte-table</value></root>';
    const byteInput = new TextEncoder().encode(byteXml);
    const stringTable = encodeStructuralIndex(stringXml.length, 0, [
      event(0),
      event(2, span(stringXml, 'root')),
      event(2, span(stringXml, 'value')),
      event(4, none(), span(stringXml, 'string-table')),
      event(3, span(stringXml, 'value')),
      event(3, span(stringXml, 'root')),
      event(1),
    ], []);
    const byteTable = encodeStructuralIndex(byteInput.byteLength, 1, [
      event(0),
      event(2, span(byteInput, 'root')),
      event(2, span(byteInput, 'value')),
      event(4, none(), span(byteInput, 'byte-table')),
      event(3, span(byteInput, 'value')),
      event(3, span(byteInput, 'root')),
      event(1),
    ], []);
    const parseStructuralIndexStringUtf16 = vi.fn(() => stringTable);
    const parseStructuralIndexUint8Array = vi.fn(() => byteTable);
    mocks.resolveBackend.mockResolvedValue({
      kind: 'native',
      packageName: '@stax-xml/native-test',
      module: {
        parseStructuralIndexStringUtf16,
        parseStructuralIndexUint8Array,
      },
      errors: [],
    });

    const schema = x.object({ value: x.string().xpath('/root/value') }).compile();

    await expect(schema.parse(stringXml, { acceleration: { backend: 'native' } }))
      .resolves.toEqual({ value: 'string-table' });
    await expect(schema.parse(byteInput, { acceleration: { backend: 'native' } }))
      .resolves.toEqual({ value: 'byte-table' });
    expect(parseStructuralIndexStringUtf16).toHaveBeenCalledOnce();
    expect(parseStructuralIndexUint8Array).toHaveBeenCalledOnce();
  });

  it('uses fallback structural string builders and skips acceleration when absent', async () => {
    const stringXml = '<root><value>span-table</value></root>';
    const stringTable = encodeStructuralIndex(stringXml.length, 0, [
      event(0),
      event(2, span(stringXml, 'root')),
      event(2, span(stringXml, 'value')),
      event(4, none(), span(stringXml, 'span-table')),
      event(3, span(stringXml, 'value')),
      event(3, span(stringXml, 'root')),
      event(1),
    ], []);
    const parseSpanTableStringUtf16 = vi.fn(() => stringTable);
    const schema = x.object({ value: x.string().xpath('/root/value') }).compile();

    mocks.resolveBackend.mockResolvedValueOnce({
      kind: 'native',
      packageName: '@stax-xml/native-test',
      module: { parseSpanTableStringUtf16 },
      errors: [],
    });
    await expect(schema.parse(stringXml, { acceleration: { backend: 'native' } }))
      .resolves.toEqual({ value: 'span-table' });
    expect(parseSpanTableStringUtf16).toHaveBeenCalledOnce();

    mocks.resolveBackend.mockResolvedValueOnce({
      kind: 'native',
      packageName: '@stax-xml/native-test',
      module: {},
      errors: [],
    });
    await expect(schema.parse('<root><value>fallback</value></root>', {
      acceleration: { backend: 'native' },
    })).rejects.toThrow(/does not provide structuralIndexUtf16 capability/);
  });

  it('reads missing lazy attributes from structural native tables as absent', async () => {
    const xml = '<root><entry other="x"><label>label</label></entry></root>';
    const input = new TextEncoder().encode(xml);
    const table = encodeStructuralIndex(input.byteLength, 1, [
      event(0),
      event(2, span(input, 'root')),
      event(2, span(input, 'entry'), none(), 0, 1),
      event(2, span(input, 'label')),
      event(4, none(), span(input, 'label')),
      event(3, span(input, 'label')),
      event(3, span(input, 'entry')),
      event(3, span(input, 'root')),
      event(1),
    ], [
      { name: span(input, 'other'), value: span(input, 'x') },
    ]);
    mocks.resolveBackend.mockResolvedValue({
      kind: 'native',
      packageName: '@stax-xml/native-test',
      module: { parseStructuralIndexUint8Array: vi.fn(() => table) },
      errors: [],
    });

    const schema = x.array(
      x.object({
        code: x.string().xpath('./@code'),
        label: x.string().xpath('./label'),
      }),
      '//entry',
    ).compile();

    await expect(schema.parse(input, { acceleration: { backend: 'native' } }))
      .resolves.toEqual([{ code: '', label: 'label' }]);
  });

  it('does not retry JavaScript when native projection or structural table construction throws', async () => {
    const xml = '<root><entry code="js"><label>label</label><score>1</score></entry></root>';
    const input = new TextEncoder().encode(xml);
    const schema = genericEntrySchema();

    mocks.resolveBackend.mockResolvedValue({
      kind: 'native',
      packageName: '@stax-xml/native-test',
      module: {
        parseObjectRowsViaTableUint8Array: vi.fn(() => {
          throw new Error('native projection failed');
        }),
      },
      errors: [],
    });
    await expect(schema.parse(input, { acceleration: { backend: 'native' } }))
      .rejects.toThrow('native projection failed');

    mocks.resolveBackend.mockResolvedValueOnce({
      kind: 'native',
      packageName: '@stax-xml/native-test',
      module: {
        parseStructuralIndexUint8Array: vi.fn(() => {
          throw new Error('table failed');
        }),
      },
      errors: [],
    });
    await expect(x.string().xpath('/root/value').compile().parse(
      new TextEncoder().encode('<root><value>fallback</value></root>'),
      { acceleration: { backend: 'native' } },
    )).rejects.toThrow('table failed');

    mocks.resolveBackend.mockResolvedValueOnce({
      kind: 'native',
      packageName: '@stax-xml/native-test',
      module: {
        parseStructuralIndexUint8Array: vi.fn(() => {
          throw new Error('table failed without fallback');
        }),
      },
      errors: [],
    });
    await expect(x.string().xpath('/root/value').compile().parse(
      new TextEncoder().encode('<root><value>fallback</value></root>'),
      { acceleration: { backend: 'native' } },
    )).rejects.toThrow('table failed without fallback');
  });

  it('validates malformed generic native projection results', async () => {
    const cases: Array<[Partial<NativeObjectRowsResultForTest>, string]> = [
      [{ eventCount: 99, maxDepth: 3, fieldCount: 3, rowCount: 1, columns: validColumns() }, 'XML event limit exceeded'],
      [{ eventCount: 8, maxDepth: 9, fieldCount: 3, rowCount: 1, columns: validColumns() }, 'XML depth limit exceeded'],
      [{ eventCount: 8, maxDepth: 3, fieldCount: 2, rowCount: 1, columns: validColumns() }, 'unexpected field count'],
      [{ eventCount: 8, maxDepth: 3, fieldCount: 3, rowCount: 1, columns: undefined }, 'did not return columns'],
      [{ eventCount: 8, maxDepth: 3, fieldCount: 3, rowCount: 1, columns: validColumns().slice(0, 2) }, 'invalid column count'],
      [{ eventCount: 8, maxDepth: 3, fieldCount: 3, rowCount: 1, columns: [{ present: 'bad' }, ...validColumns().slice(1)] }, 'invalid column'],
      [{ eventCount: 8, maxDepth: 3, fieldCount: 3, rowCount: 2, columns: validColumns() }, 'invalid column height'],
      [{ eventCount: 8, maxDepth: 3, fieldCount: 3, rowCount: 2, columns: [{ present: [true, true], values: ['a'] }, ...validColumns().slice(1)] }, 'invalid column height'],
      [{ eventCount: 8, maxDepth: 3, fieldCount: 3, rowCount: 2, columns: [{ present: [true, true], spanStarts: [0], spanEnds: [1, 2], values: ['a', 'b'] }, ...validColumns().slice(1)] }, 'invalid column height'],
      [{ eventCount: 8, maxDepth: 3, fieldCount: 3, rowCount: 2, columns: [{ present: [true, true], spanStarts: [0, 1], spanEnds: [1], values: ['a', 'b'] }, ...validColumns().slice(1)] }, 'invalid column height'],
      [{ eventCount: 8, maxDepth: 3, fieldCount: 3, rowCount: 1, columns: [{ present: [true], values: [{}] }, ...validColumns().slice(1)] }, 'non-string value'],
      [{ eventCount: 8, maxDepth: 3, fieldCount: 3, rowCount: 1, columns: [validColumns()[0]!, validColumns()[1]!, { present: [true], values: [{}] }] }, 'non-number value'],
      [{ eventCount: 8, maxDepth: 3, fieldCount: 3, rowCount: 1, columns: [validColumns()[0]!, validColumns()[1]!, { present: [true], numberValues: 'bad' }] }, 'invalid number column'],
      [{ eventCount: 8, maxDepth: 3, fieldCount: 3, rowCount: 1, columns: [{ present: [true], spanStarts: 'bad', spanEnds: [1] }, ...validColumns().slice(1)] }, 'invalid span column'],
      [{ eventCount: 8, maxDepth: 3, fieldCount: 3, rowCount: 1, columns: [{ present: [true], spanEnds: 'bad' }, ...validColumns().slice(1)] }, 'invalid span column'],
      [{ eventCount: 8, maxDepth: 3, fieldCount: 3, rowCount: 1, columns: [{ present: [true] }, ...validColumns().slice(1)] }, 'invalid column'],
    ];

    for (const [result, message] of cases) {
      await expect(expectGenericNativeProjection(result)).rejects.toThrow(message);
    }
  });

  it('hydrates missing, optional, constrained, and span-backed generic native projection values', async () => {
    const xml = '<root><entry code="js"><label>Native &amp; Label</label><score>5</score><optional>kept</optional></entry></root>';
    const input = Buffer.from(xml);
    const codeStart = xml.indexOf('js');
    const codeEnd = codeStart + 2;
    const labelEnd = xml.indexOf('Native') + 'Native &amp; Label'.length;
    const parseObjectRowsViaTableUint8Array = vi.fn(() => ({
      event_count: 8,
      max_depth: 3,
      field_count: 4,
      row_count: 1,
      columns: [
        { present: [true], span_starts: [codeStart], span_ends: [codeEnd] },
        { present: [true], span_starts: [-1], span_ends: [labelEnd], values: ['Native &amp; Label'] },
        { present: [true], number_values: [5] },
        { present: [false], values: ['ignored'] },
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
        score: x.number().xpath('./score').min(1).max(10).int(),
        optional: x.string().xpath('./optional').optional(),
      }),
      '//entry',
    ).compile();

    await expect(schema.parse(input, {
      acceleration: { backend: 'native' },
      decodeEntities: true,
    })).resolves.toEqual([{ code: 'js', label: 'Native & Label', score: 5, optional: undefined }]);
  });

  it('decodes span columns without the Node Buffer global', async () => {
    const xml = '<root><entry code="native"><label>label</label><score>42</score></entry></root>';
    const input = new TextEncoder().encode(xml);
    const originalBuffer = (globalThis as { Buffer?: typeof Buffer }).Buffer;
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

    try {
      (globalThis as { Buffer?: typeof Buffer }).Buffer = undefined;
      await expect(genericEntrySchema().parse(input, { acceleration: { backend: 'native' } }))
        .resolves.toEqual([{ code: 'native', label: 'label', score: 42 }]);
    } finally {
      (globalThis as { Buffer?: typeof Buffer }).Buffer = originalBuffer;
    }
  });

  it('validates native number projection constraints', async () => {
    await expect(expectGenericNativeProjection({
      eventCount: 8,
      maxDepth: 3,
      fieldCount: 3,
      rowCount: 1,
      columns: [validColumns()[0]!, validColumns()[1]!, { present: [true], numberValues: [NaN] }],
    })).rejects.toThrow('Invalid number');
    await expect(expectGenericNativeProjection({
      eventCount: 8,
      maxDepth: 3,
      fieldCount: 3,
      rowCount: 1,
      columns: [validColumns()[0]!, validColumns()[1]!, { present: [true], numberValues: [0] }],
    }, x.number().xpath('./score').min(1))).rejects.toThrow('less than minimum');
    await expect(expectGenericNativeProjection({
      eventCount: 8,
      maxDepth: 3,
      fieldCount: 3,
      rowCount: 1,
      columns: [validColumns()[0]!, validColumns()[1]!, { present: [true], numberValues: [11] }],
    }, x.number().xpath('./score').max(10))).rejects.toThrow('greater than maximum');
    await expect(expectGenericNativeProjection({
      eventCount: 8,
      maxDepth: 3,
      fieldCount: 3,
      rowCount: 1,
      columns: [validColumns()[0]!, validColumns()[1]!, { present: [true], numberValues: [1.5] }],
    })).rejects.toThrow('Expected integer');
    await expect(expectGenericNativeProjection({
      eventCount: 8,
      maxDepth: 3,
      fieldCount: 3,
      rowCount: 1,
      columns: [validColumns()[0]!, validColumns()[1]!, { present: [true], numberValues: [2] }],
    }, new XPathNumberWithoutOptions('./score'))).resolves.toEqual([{ code: 'native', label: 'label', score: 2 }]);
  });

  it('validates native item projection result shape and snake_case counters', async () => {
    const xml = '<root><item id="1"><name>JS</name><value>fallback</value></item></root>';
    const input = new TextEncoder().encode(xml);
    const schema = x.array(
      x.object({
        id: x.number().xpath('./@id').int(),
        name: x.string().xpath('./name'),
        value: x.string().xpath('./value'),
      }),
      '//item',
    ).compile();

    mocks.resolveBackend.mockResolvedValueOnce({
      kind: 'native',
      packageName: '@stax-xml/native-test',
      module: {
        parseItemRowsViaTableUint8Array: vi.fn(() => ({
          event_count: 8,
          max_depth: 3,
          rows: [{ id: '2', name: 'Native &amp; Name', value: 'Fast &amp; Safe' }],
        })),
      },
      errors: [],
    });
    await expect(schema.parse(input, {
      acceleration: { backend: 'native' },
      decodeEntities: true,
    })).resolves.toEqual([{ id: 2, name: 'Native & Name', value: 'Fast & Safe' }]);

    for (const [result, message, options] of [
      [{ eventCount: 99, maxDepth: 3, rows: [] }, 'XML event limit exceeded', { maxEvents: 1 }],
      [{ eventCount: 8, maxDepth: 9, rows: [] }, 'XML depth limit exceeded', { maxDepth: 1 }],
      [{ eventCount: 8, maxDepth: 3, rows: undefined }, 'did not return rows', {}],
      [{ eventCount: 'bad', maxDepth: 3, rows: [] }, 'eventCount', {}],
    ] as const) {
      mocks.resolveBackend.mockResolvedValueOnce({
        kind: 'native',
        packageName: '@stax-xml/native-test',
        module: {
          parseItemRowsViaTableUint8Array: vi.fn(() => result),
        },
        errors: [],
      });
      await expect(schema.parse(input, {
        acceleration: { backend: 'native' },
        ...options,
      })).rejects.toThrow(message);
    }
  });
});

type Span = { start: number; end: number };
type EventRecord = {
  type: number;
  name: Span;
  text: Span;
  attrStart: number;
  attrCount: number;
};
type AttrRecord = { name: Span; value: Span };
type NativeObjectRowsResultForTest = {
  eventCount?: unknown;
  maxDepth?: unknown;
  fieldCount?: unknown;
  rowCount?: unknown;
  columns?: unknown;
};

class XPathNumberWithoutOptions extends XmlSchemaBase<number, number> {
  readonly schemaType = SchemaType.NUMBER;

  constructor(readonly xpath: string) {
    super();
  }

  _parse(_input: ParseInput, _options?: ParseOptions): number {
    return 0;
  }

  async _parseAsync(_input: ParseInput, _options?: ParseOptions): Promise<number> {
    return 0;
  }

  _writeSync(_data: number, _options?: XmlWriteOptions): string {
    return '';
  }

  async _write(
    _data: number,
    _stream: WritableStream<Uint8Array>,
    _options?: XmlWriteOptions,
  ): Promise<void> {}
}

const EVENT_BYTES = 28;
const ATTR_BYTES = 16;
const HEADER_BYTES = 28;

function genericEntrySchema(score = x.number().xpath('./score').int()) {
  return x.array(
    x.object({
      code: x.string().xpath('./@code'),
      label: x.string().xpath('./label'),
      score,
    }),
    '//entry',
  ).compile();
}

async function expectGenericNativeProjection(
  result: Partial<NativeObjectRowsResultForTest>,
  score = x.number().xpath('./score').int(),
) {
  const xml = '<root><entry code="js"><label>label</label><score>1</score></entry></root>';
  const input = new TextEncoder().encode(xml);
  mocks.resolveBackend.mockResolvedValueOnce({
    kind: 'native',
    packageName: '@stax-xml/native-test',
    module: {
      parseObjectRowsViaTableUint8Array: vi.fn(() => result),
    },
    errors: [],
  });
  return genericEntrySchema(score).parse(input, { acceleration: { backend: 'native' }, maxEvents: 50, maxDepth: 5 });
}

function validColumns() {
  return [
    { present: [true], values: ['native'] },
    { present: [true], values: ['label'] },
    { present: [true], values: ['1'] },
  ];
}

function none(): Span {
  return { start: -1, end: -1 };
}

function span(input: string | Uint8Array, value: string): Span {
  if (typeof input === 'string') {
    const start = input.indexOf(value);
    if (start === -1) throw new Error(`Missing span value: ${value}`);
    return { start, end: start + value.length };
  }
  const needle = new TextEncoder().encode(value);
  for (let start = 0; start <= input.byteLength - needle.byteLength; start++) {
    let matched = true;
    for (let index = 0; index < needle.byteLength; index++) {
      if (input[start + index] !== needle[index]) {
        matched = false;
        break;
      }
    }
    if (matched) return { start, end: start + needle.byteLength };
  }
  throw new Error(`Missing byte span value: ${value}`);
}

function event(
  type: number,
  name: Span = none(),
  text: Span = none(),
  attrStart = 0,
  attrCount = 0,
): EventRecord {
  return { type, name, text, attrStart, attrCount };
}

function encodeStructuralIndex(
  sourceUnits: number,
  flags: number,
  events: EventRecord[],
  attrs: AttrRecord[],
): Uint8Array {
  const buffer = new ArrayBuffer(HEADER_BYTES + events.length * EVENT_BYTES + attrs.length * ATTR_BYTES);
  const view = new DataView(buffer);
  view.setUint32(0, 0x31545053, true);
  view.setUint32(4, events.length, true);
  view.setUint32(8, attrs.length, true);
  view.setUint32(12, sourceUnits, true);
  view.setUint32(16, EVENT_BYTES, true);
  view.setUint32(20, ATTR_BYTES, true);
  view.setUint32(24, flags, true);

  let offset = HEADER_BYTES;
  for (const record of events) {
    view.setUint32(offset, record.type, true);
    view.setInt32(offset + 4, record.name.start, true);
    view.setInt32(offset + 8, record.name.end, true);
    view.setInt32(offset + 12, record.text.start, true);
    view.setInt32(offset + 16, record.text.end, true);
    view.setUint32(offset + 20, record.attrStart, true);
    view.setUint32(offset + 24, record.attrCount, true);
    offset += EVENT_BYTES;
  }

  for (const record of attrs) {
    view.setInt32(offset, record.name.start, true);
    view.setInt32(offset + 4, record.name.end, true);
    view.setInt32(offset + 8, record.value.start, true);
    view.setInt32(offset + 12, record.value.end, true);
    offset += ATTR_BYTES;
  }

  return new Uint8Array(buffer);
}
