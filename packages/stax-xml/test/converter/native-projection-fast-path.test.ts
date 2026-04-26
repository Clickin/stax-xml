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
