import { CursorEventType } from './cursor/types.js';
import type { TableBackedEventSource } from './stream-reader-core.js';

export interface StreamCursor {
  eventType(): number;
  name(): string | undefined;
  text(): string | undefined;
  getAttributeCount(): number;
  getAttributeName(index: number): string | undefined;
  getAttributeValue(indexOrName: number | string): string | undefined;
}

export class CursorStreamBatchSource implements TableBackedEventSource {
  private eventTypes = new Uint8Array(64);
  private names: Array<string | undefined> = [];
  private texts: Array<string | undefined> = [];
  private attrStarts = new Int32Array(64);
  private attrCounts = new Int32Array(64);
  private attrNames: Array<string | undefined> = [];
  private attrValues: Array<string | undefined> = [];
  private eventCursor = 0;
  private attrCursor = 0;

  append(cursor: StreamCursor): void {
    this.ensureEventCapacity(this.eventCursor + 1);

    const eventIndex = this.eventCursor++;
    const attrCount = cursor.getAttributeCount();
    this.eventTypes[eventIndex] = cursor.eventType();
    this.names[eventIndex] = cursor.name();
    this.texts[eventIndex] = cursor.text();
    this.attrStarts[eventIndex] = this.attrCursor;
    this.attrCounts[eventIndex] = attrCount;

    if (attrCount === 0) {
      return;
    }

    this.ensureAttrCapacity(this.attrCursor + attrCount);
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      const target = this.attrCursor++;
      this.attrNames[target] = cursor.getAttributeName(attrIndex);
      this.attrValues[target] = cursor.getAttributeValue(attrIndex);
    }
  }

  appendEvent(type: number, name?: string, text?: string): void {
    this.ensureEventCapacity(this.eventCursor + 1);
    const eventIndex = this.eventCursor++;
    this.eventTypes[eventIndex] = type;
    this.names[eventIndex] = name;
    this.texts[eventIndex] = text;
    this.attrStarts[eventIndex] = this.attrCursor;
    this.attrCounts[eventIndex] = 0;
  }

  eventCount(): number {
    return this.eventCursor;
  }

  eventType(index: number): number {
    return this.eventTypes[index]!;
  }

  attrCount(index: number): number {
    return this.isStartElement(index) ? this.attrCounts[index]! : 0;
  }

  copyName(index: number): string | undefined {
    return this.names[index];
  }

  copyText(index: number): string | undefined {
    return this.texts[index];
  }

  copyAttrName(eventIndex: number, attrIndex: number): string | undefined {
    if (!this.isValidAttrIndex(eventIndex, attrIndex)) {
      return undefined;
    }
    return this.attrNames[this.attrStarts[eventIndex]! + attrIndex];
  }

  copyAttrValue(eventIndex: number, attrIndex: number): string | undefined {
    if (!this.isValidAttrIndex(eventIndex, attrIndex)) {
      return undefined;
    }
    return this.attrValues[this.attrStarts[eventIndex]! + attrIndex];
  }

  isImplicitAttributeValue(_eventIndex: number, _attrIndex: number): boolean {
    return false;
  }

  private isStartElement(index: number): boolean {
    return this.eventTypes[index] === CursorEventType.START_ELEMENT;
  }

  private isValidAttrIndex(eventIndex: number, attrIndex: number): boolean {
    return this.isStartElement(eventIndex)
      && attrIndex >= 0
      && attrIndex < this.attrCounts[eventIndex]!;
  }

  private ensureEventCapacity(size: number): void {
    if (size <= this.eventTypes.length) {
      return;
    }
    let nextSize = this.eventTypes.length;
    while (nextSize < size) nextSize *= 2;
    const eventTypes = new Uint8Array(nextSize);
    eventTypes.set(this.eventTypes);
    this.eventTypes = eventTypes;
    this.attrStarts = growInt32(this.attrStarts, nextSize);
    this.attrCounts = growInt32(this.attrCounts, nextSize);
  }

  private ensureAttrCapacity(size: number): void {
    if (size <= this.attrNames.length) {
      return;
    }
    const nextSize = Math.max(size, this.attrNames.length === 0 ? 64 : this.attrNames.length * 2);
    this.attrNames.length = nextSize;
    this.attrValues.length = nextSize;
  }
}

function growInt32(source: Int32Array<ArrayBufferLike>, size: number): Int32Array<ArrayBuffer> {
  const next = new Int32Array(size);
  next.set(source);
  return next;
}
