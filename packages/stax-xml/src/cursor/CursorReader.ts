import type { EntityDefinition } from '../IterableEventBackend.js';
import { ByteCursorFacadeSync } from './ByteCursorFacadeSync.js';
import { CursorEventType, type CursorEventType as CursorEventTypeValue, type CursorReaderOptions } from './types.js';

export class CursorReader {
  private readonly byteCursor: ByteCursorFacadeSync;

  constructor(input: string | Iterable<readonly Uint8Array[]>, options: CursorReaderOptions = {}) {
    if (typeof input !== 'string' && !isByteBatchIterable(input)) {
      throw new Error('xml must be a string or sync Iterable<Uint8Array[]>.');
    }

    this.byteCursor = new ByteCursorFacadeSync(typeof input === 'string' ? input : input, {
      autoDecodeEntities: options.autoDecodeEntities ?? true,
      namespaceAware: options.namespaceAware,
      addEntities: options.addEntities as EntityDefinition[] | undefined,
    });
  }

  next(): boolean {
    return this.byteCursor.next();
  }

  eventType(): CursorEventTypeValue {
    return this.byteCursor.eventType();
  }

  name(): string | undefined {
    return this.byteCursor.name();
  }

  localName(): string | undefined {
    return this.byteCursor.localName();
  }

  prefix(): string | undefined {
    return this.byteCursor.prefix();
  }

  uri(): string | undefined {
    return this.byteCursor.uri();
  }

  text(): string | undefined {
    return this.byteCursor.text();
  }

  getAttributeCount(): number {
    return this.byteCursor.getAttributeCount();
  }

  getAttributeName(index: number): string | undefined {
    return this.byteCursor.getAttributeName(index);
  }

  getAttributeLocalName(index: number): string | undefined {
    return this.byteCursor.getAttributeLocalName(index);
  }

  getAttributePrefix(index: number): string | undefined {
    return this.byteCursor.getAttributePrefix(index);
  }

  getAttributeValue(indexOrName: number | string): string | undefined {
    return this.byteCursor.getAttributeValue(indexOrName);
  }

  getAttributeUri(index: number): string | undefined {
    return this.byteCursor.getAttributeUri(index);
  }

  depth(): number {
    return this.byteCursor.depth();
  }
}

export { CursorEventType };

function isByteBatchIterable(value: unknown): value is Iterable<readonly Uint8Array[]> {
  return !!value && typeof value === 'object' && Symbol.iterator in value;
}
