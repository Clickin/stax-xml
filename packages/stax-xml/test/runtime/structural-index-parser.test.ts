import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter';
import { getIterableEventTable } from '../../src/IterableEventBackend';
import { IterableEventType } from '../../src/IterableReader';
import {
  StaxXmlStructuralIndexParser,
  type StructuralIndexTable,
} from '../../src/runtime';
import { XmlEventType } from '../../src/types';

const EVENT_BYTES = 28;
const ATTR_BYTES = 16;
const HEADER_BYTES = 28;

describe('StaxXmlStructuralIndexParser', () => {
  it('reads UTF-8 byte spans and keeps the source alive for table access', () => {
    const input = Buffer.from('<r a="x&amp;y">안녕</r>');
    const table = encodeStructuralIndex(input.byteLength, 1, [
      event(0),
      event(2, span(input, 'r'), none(), 0, 1),
      event(4, none(), span(input, '안녕')),
      event(3, span(input, 'r')),
      event(1),
    ], [
      attr(span(input, 'a'), span(input, 'x&amp;y')),
    ]);

    const parser = new StaxXmlStructuralIndexParser(input, table);

    expect(parser.sourceKind).toBe('utf8');
    expect(parser.eventCount).toBe(5);
    expect(parser.indexBytes).toBe(HEADER_BYTES + 5 * EVENT_BYTES + ATTR_BYTES);
    expect(parser.eventType(2)).toBe(IterableEventType.CHARACTERS);
    expect(parser.copyAttrValueByName(1, 'a')).toBe('x&amp;y');

    expect(parser.next().value).toEqual({ type: XmlEventType.START_DOCUMENT });
    expect(parser.next().value).toEqual({
      type: XmlEventType.START_ELEMENT,
      name: 'r',
      attributes: { a: 'x&y' },
    });
    expect(parser.next().value).toEqual({ type: XmlEventType.CHARACTERS, value: '안녕' });
    expect(parser.next().value).toEqual({ type: XmlEventType.END_ELEMENT, name: 'r' });
    expect(parser.next().value).toEqual({ type: XmlEventType.END_DOCUMENT });
    expect(parser.next()).toEqual({ value: undefined, done: true });
  });

  it('exposes a compiled event-table provider before iterator consumption', async () => {
    const input = '<r><person id="7"><name>Alice</name></person></r>';
    const table = encodeStructuralIndex(input.length, 0, [
      event(0),
      event(2, span(input, 'r')),
      event(2, span(input, 'person'), none(), 0, 1),
      event(2, span(input, 'name')),
      event(4, none(), span(input, 'Alice')),
      event(3, span(input, 'name')),
      event(3, span(input, 'person')),
      event(3, span(input, 'r')),
      event(1),
    ], [
      attr(span(input, 'id'), span(input, '7')),
    ]);
    const parser = new StaxXmlStructuralIndexParser(input, table);
    const eventTable = getIterableEventTable(parser);

    expect(eventTable).toBe(parser);
    expect(parser.copyAttrValueByName(2, 'id')).toBe('7');
    parser.copyAttrName = () => {
      throw new Error('compiled attribute selector should use copyAttrValueByName');
    };

    const schema = x.array(
      x.object({
        id: x.number().xpath('./@id').int(),
        name: x.string().xpath('./name'),
      }),
      '//person',
    );

    await expect(schema.compile().parse(parser)).resolves.toEqual([{ id: 7, name: 'Alice' }]);
    expect(getIterableEventTable(parser)).toBeUndefined();
  });

  it('lets compiled converters parse ArrayBufferView input through the JS fallback path', async () => {
    const input = new TextEncoder().encode('<r><name>Alice</name></r>');
    const schema = x.object({
      name: x.string().xpath('/r/name'),
    }).compile();

    await expect(schema.parse(input, { acceleration: { backend: 'js' } }))
      .resolves.toEqual({ name: 'Alice' });
  });

  it('rejects malformed metadata before exposing table data', () => {
    const input = '<r />';
    const valid = encodeStructuralIndex(input.length, 0, [event(0)], []);

    expect(() => new StaxXmlStructuralIndexParser(input, mutate(valid, 0, 0)))
      .toThrow(/Invalid structural index magic/);
    expect(() => new StaxXmlStructuralIndexParser(input, valid, { sourceKind: 'utf8' }))
      .toThrow(/source kind mismatch/);
    expect(() => new StaxXmlStructuralIndexParser(`${input}x`, valid))
      .toThrow(/input length mismatch/);
    expect(() => new StaxXmlStructuralIndexParser(input, mutate(valid, 16, 24)))
      .toThrow(/Unsupported structural index strides/);
    expect(() => new StaxXmlStructuralIndexParser(input, valid.slice(0, valid.byteLength - 4)))
      .toThrow(/length mismatch/);
  });

  it('materializes UTF-16 ArrayBuffer tables and malformed spans deterministically', () => {
    const input = '<r a="x" b="">text<![CDATA[raw]]></r>';
    const table = encodeStructuralIndex(input.length, 0, [
      event(0),
      event(2, span(input, 'r'), none(), 0, 3),
      event(4, none(), span(input, 'text')),
      event(5, none(), span(input, 'raw')),
      event(3, span(input, 'r')),
      event(1),
    ], [
      attr(span(input, 'a'), span(input, 'x')),
      attr(span(input, 'b'), none()),
      attr(none(), span(input, 'x')),
    ]);
    const parser = new StaxXmlStructuralIndexParser(input, table.buffer);

    expect(parser.eventType(3)).toBe(IterableEventType.CDATA);
    expect(parser.copyAttrValueByName(1, 'missing')).toBeUndefined();
    expect(parser.copyAttrValueByName(1, 'b')).toBeUndefined();
    expect([...parser]).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'r', attributes: { a: 'x' } },
      { type: XmlEventType.CHARACTERS, value: 'text' },
      { type: XmlEventType.CDATA, value: 'raw' },
      { type: XmlEventType.END_ELEMENT, name: 'r' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('reports unsupported structural event types without throwing from iteration', () => {
    const input = '<r />';
    const parser = new StaxXmlStructuralIndexParser(input, encodeStructuralIndex(input.length, 0, [
      event(99),
    ], []));

    expect(() => parser.eventType(0)).toThrow(/Unsupported structural index event type/);
    const result = parser.next();
    expect(result.done).toBe(false);
    expect(result.value.type).toBe(XmlEventType.ERROR);
    expect(result.value).toMatchObject({ error: expect.any(Error) });
  });

  it('decodes non-Buffer ArrayBufferView sources through TextDecoder', () => {
    const bytes = new TextEncoder().encode('<r>ok</r>');
    const source = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const table = encodeStructuralIndex(source.byteLength, 1, [
      event(2, span(bytes, 'r')),
      event(4, none(), span(bytes, 'ok')),
    ], []);
    const parser = new StaxXmlStructuralIndexParser(source, table);

    expect(parser.sourceKind).toBe('utf8');
    expect(parser.copyName(0)).toBe('r');
    expect(parser.next().value).toEqual({
      type: XmlEventType.START_ELEMENT,
      name: 'r',
      attributes: {},
    });
    expect(parser.next().value).toEqual({ type: XmlEventType.CHARACTERS, value: 'ok' });
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

function attr(name: Span, value: Span): AttrRecord {
  return { name, value };
}

function encodeStructuralIndex(
  sourceUnits: number,
  flags: number,
  events: EventRecord[],
  attrs: AttrRecord[],
): StructuralIndexTable {
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

function mutate(source: StructuralIndexTable, byteOffset: number, value: number): Uint8Array {
  const copy = new Uint8Array(source instanceof ArrayBuffer ? source : source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
  const mutated = copy.slice();
  new DataView(mutated.buffer, mutated.byteOffset, mutated.byteLength).setUint32(byteOffset, value, true);
  return mutated;
}
