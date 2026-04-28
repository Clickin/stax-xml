import { describe, expect, afterEach, it } from 'vitest';
import {
  StaxXmlParser,
  initStaxXml,
  getStaxXmlRuntime,
} from '../src/index';
import { StaxXmlIterableParser, toByteBatches } from '../src/StaxXmlIterableParser';
import { x } from '../src/converter';
import { WASM_PACKAGE_NAME, resetStaxXmlRuntimeForTests, resolveStaxXmlRuntimeBackend } from '../src/runtime';

const encoder = new TextEncoder();
const EVENT_BYTES = 28;
const ATTR_BYTES = 16;
const HEADER_BYTES = 28;

afterEach(() => {
  resetStaxXmlRuntimeForTests();
});

describe('stax-xml runtime init cache', () => {
  it('starts uninitialized and keeps no-init public APIs on the JavaScript backend', async () => {
    expect(getStaxXmlRuntime()).toMatchObject({
      initialized: false,
      backend: { kind: 'js' },
      capabilities: {},
    });

    const parser = new StaxXmlParser(streamFrom('<r>ok</r>'));
    await expect(collectNames(parser)).resolves.toEqual(['r', 'r']);
  });

  it('initializes native capabilities once and exposes the shared cache', async () => {
    const module = {
      parseStructuralIndexStringUtf16: (input: string) => encodeStructuralIndex(input, [
        event(0),
        event(2, span(input, 'r')),
        event(2, span(input, 'name')),
        event(4, none(), span(input, 'Alice')),
        event(3, span(input, 'name')),
        event(3, span(input, 'r')),
        event(1),
      ], []),
      parseStructuralIndexUint8Array: (input: Uint8Array) => encodeStructuralIndex(input, [], []),
      parseObjectRowsUint8Array: () => ({ rowCount: 0, columns: [] }),
    };
    const runtime = await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => module,
    });

    expect(runtime).toBe(getStaxXmlRuntime());
    expect(runtime.backend.kind).toBe('native');
    expect(runtime.capabilities.structuralIndexUtf16).toBe(module.parseStructuralIndexStringUtf16);
    expect(runtime.capabilities.structuralIndexUtf8).toBe(module.parseStructuralIndexUint8Array);
    expect(runtime.capabilities.objectRowsProjection).toBe(module.parseObjectRowsUint8Array);

    const schema = x.object({ name: x.string().xpath('/r/name') }).compile();
    await expect(schema.parse('<r><name>Alice</name></r>')).resolves.toEqual({ name: 'Alice' });
  });

  it('uses the configured fallback order for auto and throws on explicit load failure', async () => {
    const calls: string[] = [];
    const backend = await resolveStaxXmlRuntimeBackend({
      platform: { platform: 'darwin', arch: 'arm64' },
      importPackage: async (packageName) => {
        calls.push(packageName);
        if (packageName === WASM_PACKAGE_NAME) {
          return { parseStructuralIndexUint8Array: () => new Uint8Array() };
        }
        throw new Error(`missing ${packageName}`);
      },
    });

    expect(calls).toEqual(['@stax-xml/native-darwin-arm64', WASM_PACKAGE_NAME]);
    expect(backend.kind).toBe('wasm');

    await expect(resolveStaxXmlRuntimeBackend({
      backend: 'native',
      platform: { platform: 'freebsd', arch: 'x64' },
      importPackage: async () => {
        throw new Error('should not be called');
      },
    })).rejects.toThrow(/Unable to initialize stax-xml native backend/);
  });

  it('lets backend js disable acceleration even after cache initialization', () => {
    expect(() => new StaxXmlIterableParser(
      toByteBatches([encoder.encode('<r/>')], { batchSize: 1 }),
      { backend: 'native' },
    )).toThrow(/Call initStaxXml/);

    const parser = new StaxXmlIterableParser(
      toByteBatches([encoder.encode('<r/>')], { batchSize: 1 }),
      { backend: 'js' },
    );
    expect(parser.nextBatch()).toBe(true);
  });

  it('routes ReadableStream input through initialized streaming event batches chunk by chunk', async () => {
    const pushed: Array<{ chunk: string; isFinal: boolean }> = [];
    await initStaxXml({
      backend: 'native',
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({
        createStreamingEventBatchParser: () => ({
          pushChunk(chunk: Uint8Array, isFinal: boolean) {
            pushed.push({ chunk: new TextDecoder().decode(chunk), isFinal });
            if (isFinal) {
              return { buffer: new Uint8Array(0), table: encodeStructuralIndex(new Uint8Array(0), [], []) };
            }
            if (pushed.length === 1) {
              return { buffer: encoder.encode('<r'), table: encodeStructuralIndex(encoder.encode('<r'), [], []) };
            }
            if (pushed.length === 2) {
              const buffer = encoder.encode('<r>ok');
              return {
                buffer,
                table: encodeStructuralIndex(buffer, [
                  event(0),
                  event(2, span(buffer, 'r')),
                  event(4, none(), span(buffer, 'ok')),
                ], []),
              };
            }
            const buffer = encoder.encode('</r>');
            return {
              buffer,
              table: encodeStructuralIndex(buffer, [
                event(3, span(buffer, 'r')),
                event(1),
              ], []),
            };
          },
        }),
      }),
    });

    const events = [];
    for await (const event of new StaxXmlParser(streamFromChunks(['<r', '>ok', '</r>']))) {
      events.push(event);
    }

    expect(pushed).toEqual([
      { chunk: '<r', isFinal: false },
      { chunk: '>ok', isFinal: false },
      { chunk: '</r>', isFinal: false },
      { chunk: '', isFinal: true },
    ]);
    expect(events.map(event => 'name' in event ? event.name : 'value' in event ? event.value : event.type))
      .toEqual(['START_DOCUMENT', 'r', 'ok', 'r', 'END_DOCUMENT']);
  });
});

async function collectNames(parser: StaxXmlParser): Promise<string[]> {
  const names: string[] = [];
  for await (const event of parser) {
    if ('name' in event && event.name) {
      names.push(event.name);
    }
  }
  return names;
}

function streamFrom(input: string): ReadableStream<Uint8Array> {
  return streamFromChunks([input]);
}

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

type Span = { start: number; end: number };
type EventRecord = {
  type: number;
  name: Span;
  text: Span;
  attrStart: number;
  attrCount: number;
};
type AttrRecord = { name: Span; value: Span };

function none(): Span {
  return { start: -1, end: -1 };
}

function span(input: string | Uint8Array, value: string): Span {
  if (typeof input === 'string') {
    const start = input.indexOf(value);
    if (start === -1) throw new Error(`Missing span value: ${value}`);
    return { start, end: start + value.length };
  }
  const needle = encoder.encode(value);
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
  input: string | Uint8Array,
  events: EventRecord[],
  attrs: AttrRecord[],
): Uint8Array {
  const sourceUnits = typeof input === 'string' ? input.length : input.byteLength;
  const flags = typeof input === 'string' ? 0 : 1;
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
