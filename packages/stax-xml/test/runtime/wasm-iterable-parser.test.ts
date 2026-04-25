import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter';
import { getIterableEventTable, STAX_XML_EVENT_TABLE } from '../../src/IterableEventBackend';
import { IterableEventType } from '../../src/StaxXmlIterableParser';
import {
  StaxXmlWasmIterableParser,
  type StaxXmlWasmSpanTable,
} from '../../src/runtime';
import { XmlEventType } from '../../src/types';

const EVENT_BYTES = 28;
const ATTR_BYTES = 16;
const HEADER_BYTES = 28;

describe('StaxXmlWasmIterableParser', () => {
  it('materializes wasm span table events as an explicit sync parser', () => {
    const input = '<r a="x&amp;y" b="plain">A&amp;B<![CDATA[raw&value]]></r>';
    const table = encodeSpanTable(input, [
      event(0),
      event(2, span(input, 'r'), none(), 0, 2),
      event(4, none(), span(input, 'A&amp;B')),
      event(5, none(), span(input, 'raw&value')),
      event(3, span(input, 'r')),
      event(1),
    ], [
      attr(span(input, 'a'), span(input, 'x&amp;y')),
      attr(span(input, 'b'), span(input, 'plain')),
    ], 'view');

    const parser = StaxXmlWasmIterableParser.fromSpanTable(input, table);
    expect(parser.eventCount).toBe(6);
    expect(parser.attrCount).toBe(2);
    expect(parser.spanTableBytes).toBe(HEADER_BYTES + 6 * EVENT_BYTES + 2 * ATTR_BYTES);
    expect(parser.eventType(3)).toBe(IterableEventType.CDATA);

    expect(parser.next().value).toEqual({ type: XmlEventType.START_DOCUMENT });
    expect(parser.next().value).toEqual({
      type: XmlEventType.START_ELEMENT,
      name: 'r',
      attributes: { a: 'x&y', b: 'plain' },
    });
    expect(parser.next().value).toEqual({ type: XmlEventType.CHARACTERS, value: 'A&B' });
    expect(parser.next().value).toEqual({ type: XmlEventType.CDATA, value: 'raw&value' });
    expect(parser.next().value).toEqual({ type: XmlEventType.END_ELEMENT, name: 'r' });
    expect(parser.next().value).toEqual({ type: XmlEventType.END_DOCUMENT });
    expect(parser.next()).toEqual({ value: undefined, done: true });
  });

  it('can preserve entity references and stop iteration early', () => {
    const input = '<r a="x&amp;y">A&amp;B</r>';
    const table = encodeSpanTable(input, [
      event(2, span(input, 'r'), none(), 0, 1),
      event(4, none(), span(input, 'A&amp;B')),
    ], [
      attr(span(input, 'a'), span(input, 'x&amp;y')),
    ], 'buffer');

    const parser = new StaxXmlWasmIterableParser(input, table, { decodeEntities: false });
    expect(parser[Symbol.iterator]()).toBe(parser);
    expect(parser.next().value).toEqual({
      type: XmlEventType.START_ELEMENT,
      name: 'r',
      attributes: { a: 'x&amp;y' },
    });
    expect(parser.return()).toEqual({ value: undefined, done: true });
    expect(parser.next()).toEqual({ value: undefined, done: true });
  });

  it('reports unsupported span event types as error events', () => {
    const input = '<r />';
    const parser = new StaxXmlWasmIterableParser(input, encodeSpanTable(input, [
      event(99),
    ], [], 'view'));
    expect(() => parser.eventType(0)).toThrow(/Unsupported wasm span table event type/);
    const result = parser.next();
    expect(result.done).toBe(false);
    expect(result.value.type).toBe(XmlEventType.ERROR);
    expect(result.value).toMatchObject({
      error: expect.any(Error),
    });
  });

  it('rejects malformed span table metadata', () => {
    const input = '<r />';
    const valid = encodeSpanTable(input, [event(0)], [], 'view') as Uint8Array;

    expect(() => new StaxXmlWasmIterableParser(input, mutate(valid, 0, 0)))
      .toThrow(/Invalid wasm span table magic/);
    expect(() => new StaxXmlWasmIterableParser(`${input}x`, valid))
      .toThrow(/input length mismatch/);
    expect(() => new StaxXmlWasmIterableParser(input, mutate(valid, 16, 24)))
      .toThrow(/Unsupported wasm span table strides/);
    expect(() => new StaxXmlWasmIterableParser(input, valid.slice(0, valid.byteLength - 4)))
      .toThrow(/length mismatch/);
  });

  it('exposes a compiled event-table view before iterator consumption', () => {
    const input = '<r a="x">text</r>';
    const parser = new StaxXmlWasmIterableParser(input, encodeSpanTable(input, [
      event(0),
      event(2, span(input, 'r'), none(), 0, 2),
      event(4, none(), span(input, 'text')),
      event(3, span(input, 'r')),
      event(1),
    ], [
      attr(span(input, 'a'), span(input, 'x')),
      attr(none(), none()),
    ], 'view'));

    expect(getIterableEventTable(null)).toBeUndefined();
    expect(getIterableEventTable({})).toBeUndefined();
    const table = parser[STAX_XML_EVENT_TABLE]();
    expect(table).toBe(parser);
    expect(parser.copyName(0)).toBeUndefined();
    expect(parser.copyText(0)).toBeUndefined();
    expect(parser.copyName(1)).toBe('r');
    expect(parser.eventAttrCount(1)).toBe(2);
    expect(parser.copyAttrName(1, 0)).toBe('a');
    expect(parser.copyAttrValue(1, 0)).toBe('x');
    expect(parser.copyAttrName(1, 1)).toBeUndefined();
    expect(parser.copyAttrValue(1, 1)).toBeUndefined();
    expect(parser.copyText(2)).toBe('text');
    expect(parser.nextBatch()).toBe(true);
    expect(parser.nextBatch()).toBe(false);
    expect(parser[STAX_XML_EVENT_TABLE]()).toBeUndefined();
    expect(parser.next()).toEqual({ value: undefined, done: true });
  });

  it('lets transformed array converters consume wasm span tables without event iterator materialization', async () => {
    const input = '<r><person id="7"><name>Alice</name></person></r>';
    const parser = new StaxXmlWasmIterableParser(input, encodeSpanTable(input, [
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
    ], 'view'));
    parser.next = () => {
      throw new Error('event iterator should not be used by compiled converter path');
    };

    const schema = x.array(
      x.object({
        id: x.number().xpath('./@id').int(),
        name: x.string().xpath('./name'),
      }),
      '//person'
    ).transform(people => ({
      personCount: people.length,
      firstName: people[0]?.name,
    }));

    await expect(schema.compile().parse(parser)).resolves.toEqual({ personCount: 1, firstName: 'Alice' });
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

function span(input: string, value: string): Span {
  const start = input.indexOf(value);
  if (start === -1) {
    throw new Error(`Missing span value: ${value}`);
  }
  return { start, end: start + value.length };
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

function encodeSpanTable(
  input: string,
  events: EventRecord[],
  attrs: AttrRecord[],
  mode: 'buffer' | 'view',
): StaxXmlWasmSpanTable {
  const buffer = new ArrayBuffer(HEADER_BYTES + events.length * EVENT_BYTES + attrs.length * ATTR_BYTES);
  const view = new DataView(buffer);
  writeHeader(view, input, events.length, attrs.length);

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

  return mode === 'buffer' ? buffer : new Uint8Array(buffer);
}

function writeHeader(view: DataView, input: string, eventCount: number, attrCount: number): void {
  view.setUint32(0, 0x31545053, true);
  view.setUint32(4, eventCount, true);
  view.setUint32(8, attrCount, true);
  view.setUint32(12, input.length, true);
  view.setUint32(16, EVENT_BYTES, true);
  view.setUint32(20, ATTR_BYTES, true);
  view.setUint32(24, 0, true);
}

function mutate(source: Uint8Array, byteOffset: number, value: number): Uint8Array {
  const copy = source.slice();
  new DataView(copy.buffer, copy.byteOffset, copy.byteLength).setUint32(byteOffset, value, true);
  return copy;
}
