import { describe, expect, it } from 'vitest';

const EXPECTED_ROOT_EXPORTS = [
  'EventReader',
  'EventReaderSync',
  'StreamReader',
  'StreamReaderSync',
  'Writer',
  'WriterSync',
  'WriterSyncSink',
  'XmlEventType',
  'isCdata',
  'isCharacters',
  'isEndDocument',
  'isEndElement',
  'isStartDocument',
  'isStartElement',
].sort();

describe('root import host API boundaries', () => {
  it('exposes exactly the v1 root runtime surface', async () => {
    const module = await import('../src/index.ts?canonical-root');
    expect(Object.keys(module).sort()).toEqual(EXPECTED_ROOT_EXPORTS);
  });

  it('does not require text codecs merely to import the public surface', async () => {
    const textEncoder = Object.getOwnPropertyDescriptor(globalThis, 'TextEncoder');
    const textDecoder = Object.getOwnPropertyDescriptor(globalThis, 'TextDecoder');

    Reflect.deleteProperty(globalThis, 'TextEncoder');
    Reflect.deleteProperty(globalThis, 'TextDecoder');

    try {
      const module = await import('../src/index.ts?without-text-codecs');
      expect(module.StreamReaderSync).toBeTypeOf('function');
      expect(module.EventReaderSync).toBeTypeOf('function');
      expect(module.StreamReader).toBeTypeOf('function');
      expect(module.EventReader).toBeTypeOf('function');

      const converter = await import('../src/converter.ts?without-text-codecs');
      expect(converter.x).toBeTypeOf('object');
    } finally {
      if (textEncoder) Object.defineProperty(globalThis, 'TextEncoder', textEncoder);
      if (textDecoder) Object.defineProperty(globalThis, 'TextDecoder', textDecoder);
    }
  });

  it('does not expose retired reader, adapter, or tree helper APIs', async () => {
    const module = await import('../src/index.ts?without-retired-surface');
    for (const name of [
      'CursorReaderSync',
      'StreamEventType',
      'Uint8ArrayCurrentCursor',
      'parseXmlObject',
      'parseXmlObjectSync',
      'parseXmlTree',
      'parseXmlTreeSync',
      'x',
    ]) {
      expect(name in module).toBe(false);
    }
  });
});
