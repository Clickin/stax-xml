import type { EntityDefinition } from '../IterableEventBackend.js';
import {
  getStaxXmlRuntimeForSyncApi,
} from '../runtime/native-backend.js';
import { StaxXmlStructuralIndexParser } from '../runtime/structural-index-parser.js';
import { CursorEventView } from './CursorEventView.js';
import { ByteCursorFacadeSync } from './ByteCursorFacadeSync.js';
import { CursorEventType, type CursorEventType as CursorEventTypeValue, type CursorReaderOptions } from './types.js';

const textEncoder = new TextEncoder();

export class CursorReader {
  private readonly byteCursor?: ByteCursorFacadeSync;
  private readonly tableParser?: StaxXmlStructuralIndexParser;
  private readonly view = new CursorEventView();
  private tableIndex = 0;
  private done = false;
  private readonly viewOptions: {
    autoDecodeEntities: boolean;
    addEntities?: EntityDefinition[];
    implicitAttributeValue: 'name';
  };

  constructor(input: string | Iterable<readonly Uint8Array[]>, options: CursorReaderOptions = {}) {
    if (typeof input !== 'string' && !isByteBatchIterable(input)) {
      throw new Error('xml must be a string or sync Iterable<Uint8Array[]>.');
    }

    const xmlBytes = typeof input === 'string' ? textEncoder.encode(input) : undefined;
    this.viewOptions = {
      autoDecodeEntities: options.autoDecodeEntities ?? true,
      addEntities: options.addEntities as EntityDefinition[] | undefined,
      implicitAttributeValue: 'name',
    };

    const runtime = getStaxXmlRuntimeForSyncApi(undefined);
    const buildTable = runtime?.capabilities.structuralIndexUtf8;
    let forceJavaScriptReader = false;
    if ((options.namespaceAware ?? true) !== false && xmlBytes && runtime?.backend.kind !== 'js' && buildTable) {
      try {
        this.tableParser = new StaxXmlStructuralIndexParser(xmlBytes, buildTable(xmlBytes), {
          decodeEntities: false,
          sourceKind: 'utf8',
        });
        return;
      } catch (error) {
        if (options.fallbackOnParseError !== true) {
          throw error;
        }
        forceJavaScriptReader = true;
      }
    }

    this.byteCursor = new ByteCursorFacadeSync(typeof input === 'string' ? input : input, {
      autoDecodeEntities: options.autoDecodeEntities ?? true,
      namespaceAware: options.namespaceAware,
      addEntities: options.addEntities as EntityDefinition[] | undefined,
      fallbackOnParseError: options.fallbackOnParseError,
    });
  }

  next(): boolean {
    if (this.tableParser) {
      return this.nextTableEvent();
    }
    return this.byteCursor?.next() ?? false;
  }

  eventType(): CursorEventTypeValue {
    if (!this.tableParser) {
      return this.byteCursor!.eventType();
    }
    return this.view.eventType();
  }

  name(): string | undefined {
    if (!this.tableParser) {
      return this.byteCursor!.name();
    }
    return this.view.name();
  }

  localName(): string | undefined {
    if (!this.tableParser) {
      return this.byteCursor!.localName();
    }
    return this.view.localName();
  }

  prefix(): string | undefined {
    if (!this.tableParser) {
      return this.byteCursor!.prefix();
    }
    return this.view.prefix();
  }

  uri(): string | undefined {
    if (!this.tableParser) {
      return this.byteCursor!.uri();
    }
    return this.view.uri();
  }

  text(): string | undefined {
    if (!this.tableParser) {
      return this.byteCursor!.text();
    }
    return this.view.text();
  }

  getAttributeCount(): number {
    if (!this.tableParser) {
      return this.byteCursor!.getAttributeCount();
    }
    return this.view.getAttributeCount();
  }

  getAttributeName(index: number): string | undefined {
    if (!this.tableParser) {
      return this.byteCursor!.getAttributeName(index);
    }
    return this.view.getAttributeName(index);
  }

  getAttributeLocalName(index: number): string | undefined {
    if (!this.tableParser) {
      return this.byteCursor!.getAttributeLocalName(index);
    }
    return this.view.getAttributeLocalName(index);
  }

  getAttributePrefix(index: number): string | undefined {
    if (!this.tableParser) {
      return this.byteCursor!.getAttributePrefix(index);
    }
    return this.view.getAttributePrefix(index);
  }

  getAttributeValue(indexOrName: number | string): string | undefined {
    if (!this.tableParser) {
      return this.byteCursor!.getAttributeValue(indexOrName);
    }
    return this.view.getAttributeValue(indexOrName);
  }

  getAttributeUri(index: number): string | undefined {
    if (!this.tableParser) {
      return this.byteCursor!.getAttributeUri(index);
    }
    return this.view.getAttributeUri(index);
  }

  depth(): number {
    if (!this.tableParser) {
      return this.byteCursor!.depth();
    }
    return this.view.depth();
  }

  private nextTableEvent(): boolean {
    if (this.done) {
      return false;
    }

    while (this.tableIndex < this.tableParser!.eventCount) {
      if (this.view.moveToTable(this.tableParser!, this.tableIndex++, this.viewOptions)) {
        return true;
      }
    }

    this.done = true;
    this.view.reset();
    return false;
  }
}

export { CursorEventType };

function isByteBatchIterable(value: unknown): value is Iterable<readonly Uint8Array[]> {
  return !!value && typeof value === 'object' && Symbol.iterator in value;
}
