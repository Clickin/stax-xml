import {
  XmlEventType,
  type AnyXmlEvent,
} from '../types.js';

export type StaxXmlWasmSpanTable = ArrayBuffer | ArrayBufferView;

export interface StaxXmlWasmIterableParserOptions {
  decodeEntities?: boolean;
}

const SPAN_TABLE_MAGIC = 0x31545053;
const SPAN_TABLE_HEADER_WORDS = 7;
const EVENT_STRIDE_BYTES = 28;
const ATTR_STRIDE_BYTES = 16;
const DEFAULT_ENTITY_REGEX = /&(lt|gt|quot|apos|amp);/g;
const DEFAULT_ENTITY_MAP: Record<string, string> = {
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  amp: '&',
};

type SpanTable = {
  view: DataView;
  eventCount: number;
  attrCount: number;
  eventBase: number;
  attrBase: number;
  byteLength: number;
};

export class StaxXmlWasmIterableParser implements IterableIterator<AnyXmlEvent> {
  readonly eventCount: number;
  readonly attrCount: number;
  readonly spanTableBytes: number;

  private readonly decodeEntities: boolean;
  private index = 0;

  constructor(
    private readonly input: string,
    table: StaxXmlWasmSpanTable,
    options: StaxXmlWasmIterableParserOptions = {},
  ) {
    const spanTable = readSpanTable(input, table);
    this.table = spanTable;
    this.eventCount = spanTable.eventCount;
    this.attrCount = spanTable.attrCount;
    this.spanTableBytes = spanTable.byteLength;
    this.decodeEntities = options.decodeEntities ?? true;
  }

  private readonly table: SpanTable;

  static fromSpanTable(
    input: string,
    table: StaxXmlWasmSpanTable,
    options?: StaxXmlWasmIterableParserOptions,
  ): StaxXmlWasmIterableParser {
    return new StaxXmlWasmIterableParser(input, table, options);
  }

  [Symbol.iterator](): IterableIterator<AnyXmlEvent> {
    return this;
  }

  next(): IteratorResult<AnyXmlEvent> {
    if (this.index >= this.eventCount) {
      return { value: undefined, done: true };
    }

    const event = this.readEvent(this.index);
    this.index++;
    return { value: event, done: false };
  }

  return(): IteratorResult<AnyXmlEvent> {
    this.index = this.eventCount;
    return { value: undefined, done: true };
  }

  private readEvent(index: number): AnyXmlEvent {
    const offset = this.table.eventBase + index * EVENT_STRIDE_BYTES;
    const type = this.table.view.getUint32(offset, true);
    const nameStart = this.table.view.getInt32(offset + 4, true);
    const nameEnd = this.table.view.getInt32(offset + 8, true);
    const textStart = this.table.view.getInt32(offset + 12, true);
    const textEnd = this.table.view.getInt32(offset + 16, true);
    const attrStart = this.table.view.getUint32(offset + 20, true);
    const attrCount = this.table.view.getUint32(offset + 24, true);

    if (type === 0) {
      return { type: XmlEventType.START_DOCUMENT };
    }
    if (type === 1) {
      return { type: XmlEventType.END_DOCUMENT };
    }
    if (type === 2) {
      return {
        type: XmlEventType.START_ELEMENT,
        name: this.input.slice(nameStart, nameEnd),
        attributes: this.readAttributes(attrStart, attrCount),
      };
    }
    if (type === 3) {
      return {
        type: XmlEventType.END_ELEMENT,
        name: this.input.slice(nameStart, nameEnd),
      };
    }
    if (type === 4) {
      return {
        type: XmlEventType.CHARACTERS,
        value: this.decode(this.input.slice(textStart, textEnd)),
      };
    }
    if (type === 5) {
      return {
        type: XmlEventType.CDATA,
        value: this.input.slice(textStart, textEnd),
      };
    }

    return {
      type: XmlEventType.ERROR,
      error: new Error(`Unsupported wasm span table event type: ${type}`),
    };
  }

  private readAttributes(attrStart: number, attrCount: number): Record<string, string> {
    const attributes: Record<string, string> = {};
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      const offset = this.table.attrBase + (attrStart + attrIndex) * ATTR_STRIDE_BYTES;
      const nameStart = this.table.view.getInt32(offset, true);
      const nameEnd = this.table.view.getInt32(offset + 4, true);
      const valueStart = this.table.view.getInt32(offset + 8, true);
      const valueEnd = this.table.view.getInt32(offset + 12, true);
      attributes[this.input.slice(nameStart, nameEnd)] = this.decode(this.input.slice(valueStart, valueEnd));
    }
    return attributes;
  }

  private decode(value: string): string {
    if (!this.decodeEntities || value.indexOf('&') === -1) {
      return value;
    }
    DEFAULT_ENTITY_REGEX.lastIndex = 0;
    return value.replace(DEFAULT_ENTITY_REGEX, (_match, entity: string) => DEFAULT_ENTITY_MAP[entity]!);
  }
}

function readSpanTable(input: string, table: StaxXmlWasmSpanTable): SpanTable {
  const view = table instanceof ArrayBuffer
    ? new DataView(table)
    : new DataView(table.buffer, table.byteOffset, table.byteLength);

  const magic = view.getUint32(0, true);
  if (magic !== SPAN_TABLE_MAGIC) {
    throw new Error(`Invalid wasm span table magic: 0x${magic.toString(16)}`);
  }

  const eventCount = view.getUint32(4, true);
  const attrCount = view.getUint32(8, true);
  const inputUnits = view.getUint32(12, true);
  const eventStrideBytes = view.getUint32(16, true);
  const attrStrideBytes = view.getUint32(20, true);

  if (inputUnits !== input.length) {
    throw new Error(`Wasm span table input length mismatch: ${inputUnits}/${input.length}`);
  }
  if (eventStrideBytes !== EVENT_STRIDE_BYTES || attrStrideBytes !== ATTR_STRIDE_BYTES) {
    throw new Error(`Unsupported wasm span table strides: ${eventStrideBytes}/${attrStrideBytes}`);
  }

  const eventBase = SPAN_TABLE_HEADER_WORDS * 4;
  const attrBase = eventBase + eventCount * EVENT_STRIDE_BYTES;
  const expectedBytes = attrBase + attrCount * ATTR_STRIDE_BYTES;
  if (expectedBytes !== view.byteLength) {
    throw new Error(`Wasm span table length mismatch: ${expectedBytes}/${view.byteLength}`);
  }

  return {
    view,
    eventCount,
    attrCount,
    eventBase,
    attrBase,
    byteLength: view.byteLength,
  };
}
