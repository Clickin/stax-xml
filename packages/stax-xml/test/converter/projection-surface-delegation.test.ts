import { beforeEach, describe, expect, it, vi } from 'vitest';

const projectionMocks = vi.hoisted(() => ({
  projectXmlObjectRows: vi.fn(),
  projectXmlObjectRowsSync: vi.fn(),
  projectXmlItemRows: vi.fn(),
  projectXmlItemRowsSync: vi.fn(),
}));

vi.mock('../../src/projection/index.js', () => ({
  projectXmlObjectRows: projectionMocks.projectXmlObjectRows,
  projectXmlObjectRowsSync: projectionMocks.projectXmlObjectRowsSync,
  projectXmlItemRows: projectionMocks.projectXmlItemRows,
  projectXmlItemRowsSync: projectionMocks.projectXmlItemRowsSync,
}));

import { x } from '../../src/converter/index.js';

describe('compiled converter projection surface delegation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes supported byte-input object-array schemas through the public projection surface', async () => {
    const input = new TextEncoder().encode('<root><entry code="js"><score>1</score></entry></root>');
    projectionMocks.projectXmlObjectRows.mockResolvedValue({
      inputBytes: input.byteLength,
      eventCount: 5,
      maxDepth: 3,
      fieldCount: 2,
      rowCount: 1,
      columns: [
        { present: [true], values: ['native'] },
        { present: [true], numberValues: [42] },
      ],
    });

    const schema = x.array(
      x.object({
        code: x.string().xpath('./@code'),
        score: x.number().xpath('./score').int(),
      }),
      '//entry',
    ).compile();

    await expect(schema.parse(input, { acceleration: { backend: 'native' } }))
      .resolves.toEqual([{ code: 'native', score: 42 }]);
    expect(projectionMocks.projectXmlObjectRows).toHaveBeenCalledWith(input, {
      itemName: 'entry',
      fields: [
        { outputName: 'code', valueKind: 'string', sourceKind: 'attribute', sourceName: 'code', textMode: 'direct' },
        { outputName: 'score', valueKind: 'number', sourceKind: 'element', sourceName: 'score', textMode: 'subtree' },
      ],
    }, expect.objectContaining({ backend: 'native' }));
    expect(projectionMocks.projectXmlItemRows).not.toHaveBeenCalled();
  });

  it('routes supported byte-input parseSync schemas through the public sync projection surface', () => {
    const input = new TextEncoder().encode('<root><entry code="sync"><score>7</score></entry></root>');
    projectionMocks.projectXmlObjectRowsSync.mockReturnValue({
      inputBytes: input.byteLength,
      eventCount: 5,
      maxDepth: 3,
      fieldCount: 2,
      rowCount: 1,
      columns: [
        { present: [true], values: ['native-sync'] },
        { present: [true], numberValues: [77] },
      ],
    });

    const schema = x.array(
      x.object({
        code: x.string().xpath('./@code'),
        score: x.number().xpath('./score').int(),
      }),
      '//entry',
    ).compile();

    expect(schema.parseSync(input, { acceleration: { backend: 'native' } }))
      .toEqual([{ code: 'native-sync', score: 77 }]);
    expect(projectionMocks.projectXmlObjectRowsSync).toHaveBeenCalledWith(input, {
      itemName: 'entry',
      fields: [
        { outputName: 'code', valueKind: 'string', sourceKind: 'attribute', sourceName: 'code', textMode: 'direct' },
        { outputName: 'score', valueKind: 'number', sourceKind: 'element', sourceName: 'score', textMode: 'subtree' },
      ],
    }, expect.objectContaining({ backend: 'native' }));
    expect(projectionMocks.projectXmlItemRowsSync).not.toHaveBeenCalled();
  });
});
