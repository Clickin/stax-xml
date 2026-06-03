import { describe, expect, it } from 'vitest';

describe('root import host API boundaries', () => {
  it('does not require TextEncoder to import and run the primary byte-batch sync reader', async () => {
    const originalTextEncoder = globalThis.TextEncoder;
    const globals = globalThis as typeof globalThis & { TextEncoder?: typeof TextEncoder };

    Reflect.deleteProperty(globals, 'TextEncoder');

    try {
      const module = await import('../src/index.ts?without-textencoder');
      const bytes = new Uint8Array([
        60, 114, 111, 111, 116, 32, 97, 61, 34, 98, 34, 62,
        116, 101, 120, 116,
        60, 47, 114, 111, 111, 116, 62,
      ]);
      const reader = new module.StreamReaderSync([[bytes]]);
      const batch = reader.nextBatch();

      expect(batch).not.toBeNull();
      expect(batch?.eventCount).toBeGreaterThan(0);
    } finally {
      Object.defineProperty(globalThis, 'TextEncoder', {
        configurable: true,
        writable: true,
        value: originalTextEncoder,
      });
    }
  });

  it('does not require TextEncoder to import converter and projection subpaths', async () => {
    const originalTextEncoder = globalThis.TextEncoder;
    const globals = globalThis as typeof globalThis & { TextEncoder?: typeof TextEncoder };

    Reflect.deleteProperty(globals, 'TextEncoder');

    try {
      const converter = await import('../src/converter/index.ts?without-textencoder');
      const projection = await import('../src/projection/index.ts?without-textencoder');

      expect(converter.x).toBeTypeOf('object');
      expect(projection.attr).toBeTypeOf('function');
      expect(projection.many).toBeTypeOf('function');
    } finally {
      Object.defineProperty(globalThis, 'TextEncoder', {
        configurable: true,
        writable: true,
        value: originalTextEncoder,
      });
    }
  });

  it('does not require TextDecoder for ASCII primary byte-batch sync strings', async () => {
    const originalTextDecoder = globalThis.TextDecoder;
    const globals = globalThis as typeof globalThis & { TextDecoder?: typeof TextDecoder };

    Reflect.deleteProperty(globals, 'TextDecoder');

    try {
      const module = await import('../src/index.ts?without-textdecoder');
      const bytes = new Uint8Array([
        60, 114, 111, 111, 116, 32, 97, 61, 34, 98, 34, 62,
        116, 101, 120, 116,
        60, 47, 114, 111, 111, 116, 62,
      ]);
      const reader = new module.StreamReaderSync([[bytes]]);
      const batch = reader.nextBatch();

      expect(batch).not.toBeNull();
      expect(batch?.nameAt(1)).toBe('root');
      expect(batch?.attributeNameAt(1, 0)).toBe('a');
      expect(batch?.attributeValueAt(1, 0)).toBe('b');
      expect(batch?.textAt(2)).toBe('text');
    } finally {
      Object.defineProperty(globalThis, 'TextDecoder', {
        configurable: true,
        writable: true,
        value: originalTextDecoder,
      });
    }
  });
});
