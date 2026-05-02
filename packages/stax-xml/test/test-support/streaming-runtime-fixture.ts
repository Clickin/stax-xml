import { Buffer } from 'node:buffer';
import { StreamEventType } from '../../src/index.js';

const encoder = new TextEncoder();

const EVENT_BYTES = 28;
const ATTR_BYTES = 16;
const HEADER_BYTES = 28;
const NAME_IDS_FLAG = 1 << 8;
const VALUE_IDS_FLAG = 1 << 9;

export type Span = { start: number; end: number };
export type EventRecord = {
  type: number;
  name: Span;
  text: Span;
  attrStart: number;
  attrCount: number;
};
export type AttrRecord = { name: Span; value: Span };

export function utf8(value: string): Uint8Array {
  return encoder.encode(value);
}

export function buffer(value: string): Buffer {
  return Buffer.from(value);
}

export function none(): Span {
  return { start: -1, end: -1 };
}

export function span(input: Uint8Array, value: string): Span {
  const needle = encoder.encode(value);
  for (let start = 0; start <= input.byteLength - needle.byteLength; start++) {
    let matched = true;
    for (let index = 0; index < needle.byteLength; index++) {
      if (input[start + index] !== needle[index]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return { start, end: start + needle.byteLength };
    }
  }
  throw new Error(`Missing byte span value: ${value}`);
}

export function event(
  type: number,
  name: Span = none(),
  text: Span = none(),
  attrStart = 0,
  attrCount = 0,
): EventRecord {
  return { type, name, text, attrStart, attrCount };
}

export function attr(name: Span, value: Span): AttrRecord {
  return { name, value };
}

export function encodeStructuralIndex(
  input: Uint8Array,
  events: EventRecord[],
  attrs: AttrRecord[],
  options: { includeValueIds?: boolean } = {},
): Uint8Array {
  const allNameIds = internNameIds(
    input,
    [...events.map(record => record.name), ...attrs.map(record => record.name)],
    value => spanBytes(input, value.start, value.end),
  );
  const eventNameIds = allNameIds.slice(0, events.length);
  const attrNameIds = allNameIds.slice(events.length);
  const allValueIds = options.includeValueIds
    ? internValueIds(
        input,
        [...events.map(record => record.text), ...attrs.map(record => record.value)],
        value => spanBytes(input, value.start, value.end),
      )
    : [];
  const eventValueIds = allValueIds.slice(0, events.length);
  const attrValueIds = allValueIds.slice(events.length);
  const buffer = new ArrayBuffer(
    HEADER_BYTES
      + events.length * EVENT_BYTES
      + attrs.length * ATTR_BYTES
      + eventNameIds.length * 4
      + attrNameIds.length * 4
      + (options.includeValueIds ? (eventValueIds.length + attrValueIds.length) * 4 : 0),
  );
  const view = new DataView(buffer);
  view.setUint32(0, 0x31545053, true);
  view.setUint32(4, events.length, true);
  view.setUint32(8, attrs.length, true);
  view.setUint32(12, input.byteLength, true);
  view.setUint32(16, EVENT_BYTES, true);
  view.setUint32(20, ATTR_BYTES, true);
  view.setUint32(24, 1 | NAME_IDS_FLAG | (options.includeValueIds ? VALUE_IDS_FLAG : 0), true);

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

  for (const nameId of eventNameIds) {
    view.setUint32(offset, nameId, true);
    offset += 4;
  }
  for (const nameId of attrNameIds) {
    view.setUint32(offset, nameId, true);
    offset += 4;
  }
  if (options.includeValueIds) {
    for (const valueId of eventValueIds) {
      view.setUint32(offset, valueId, true);
      offset += 4;
    }
    for (const valueId of attrValueIds) {
      view.setUint32(offset, valueId, true);
      offset += 4;
    }
  }

  return new Uint8Array(buffer);
}

export function simpleRuntimeBatches() {
  const first = buffer('<root id="r1">');
  const second = buffer('hello');
  const third = buffer('</root>');
  return {
    first,
    second,
    third,
    nativeBatches: [
      {
        buffer: first,
        table: encodeStructuralIndex(first, [
          event(StreamEventType.START_DOCUMENT),
          event(StreamEventType.START_ELEMENT, span(first, 'root'), none(), 0, 1),
        ], [
          attr(span(first, 'id'), span(first, 'r1')),
        ]),
      },
      {
        buffer: second,
        table: encodeStructuralIndex(second, [
          event(StreamEventType.CHARACTERS, none(), span(second, 'hello')),
        ], []),
      },
      {
        buffer: third,
        table: encodeStructuralIndex(third, [
          event(StreamEventType.END_ELEMENT, span(third, 'root')),
        ], []),
      },
      {
        buffer: new Uint8Array(0),
        table: encodeStructuralIndex(new Uint8Array(0), [
          event(StreamEventType.END_DOCUMENT),
        ], []),
      },
    ],
  };
}

function internNameIds<T extends Span>(
  input: Uint8Array,
  spans: T[],
  readBytes: (span: T) => Uint8Array,
): number[] {
  const ids = new Map<string, number>();
  let nextId = 1;
  return spans.map((item) => {
    if (item.start < 0 || item.end < 0) {
      return 0;
    }
    const key = Buffer.from(readBytes(item)).toString('latin1');
    const cached = ids.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const id = nextId++;
    ids.set(key, id);
    return id;
  });
}

function internValueIds<T extends Span>(
  input: Uint8Array,
  spans: T[],
  readBytes: (span: T) => Uint8Array,
): number[] {
  const ids = new Map<string, number>();
  let nextId = 1;
  return spans.map((item) => {
    const length = item.end - item.start;
    if (item.start < 0 || item.end < 0 || length <= 0 || length > 32) {
      return 0;
    }
    const key = Buffer.from(readBytes(item)).toString('latin1');
    const cached = ids.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const id = nextId++;
    ids.set(key, id);
    return id;
  });
}

function spanBytes(input: Uint8Array, start: number, end: number): Uint8Array {
  return input.subarray(start, end);
}
