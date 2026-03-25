import type { AttributeInfo } from '../types';

interface AttributeEntry {
  rawName: string;
  localName: string;
  prefix?: string;
  uri?: string;
  value?: string;
  sourceStart?: number;
  sourceEnd?: number;
}

export class AttributeCollector {
  private source = '';
  private entries: AttributeEntry[] = [];
  private entryIndex?: Map<string, number>;
  private attributesCache?: Record<string, string>;
  private attributesWithPrefixCache?: Record<string, AttributeInfo>;
  private deferredStart?: number;
  private deferredEnd?: number;
  private deferredNamespaces?: Map<string, string>;
  private deferredIsWhitespace?: (code: number) => boolean;

  constructor(private readonly decodeValue: (text: string) => string) {}

  reset(source: string): void {
    this.source = source;
    this.entries = [];
    this.entryIndex = undefined;
    this.attributesCache = undefined;
    this.attributesWithPrefixCache = undefined;
    this.deferredStart = undefined;
    this.deferredEnd = undefined;
    this.deferredNamespaces = undefined;
    this.deferredIsWhitespace = undefined;
  }

  defer(
    source: string,
    start: number,
    end: number,
    namespaces: Map<string, string>,
    isWhitespace: (code: number) => boolean
  ): void {
    this.reset(source);
    this.deferredStart = start;
    this.deferredEnd = end;
    this.deferredNamespaces = namespaces;
    this.deferredIsWhitespace = isWhitespace;
  }

  addDecoded(
    rawName: string,
    localName: string,
    prefix: string | undefined,
    uri: string | undefined,
    value: string
  ): void {
    this.addEntry({
      rawName,
      localName,
      prefix,
      uri,
      value,
    });
  }

  addLazy(
    rawName: string,
    localName: string,
    prefix: string | undefined,
    uri: string | undefined,
    sourceStart: number,
    sourceEnd: number
  ): void {
    this.addEntry({
      rawName,
      localName,
      prefix,
      uri,
      sourceStart,
      sourceEnd,
    });
  }

  isEmpty(): boolean {
    if (this.deferredStart !== undefined) {
      return false;
    }
    return this.entries.length === 0;
  }

  getAttributeValue(rawName: string): string | undefined {
    this.materializeDeferredEntries();
    const index = this.getEntryIndex().get(rawName);
    if (index === undefined) {
      return undefined;
    }

    return this.materializeValue(this.entries[index]);
  }

  getAttributes(): Record<string, string> {
    this.materializeDeferredEntries();
    if (!this.attributesCache) {
      this.attributesCache = {};
      for (const entry of this.entries) {
        this.attributesCache[entry.rawName] = this.materializeValue(entry);
      }
    }

    return this.attributesCache;
  }

  getAttributesWithPrefix(): Record<string, AttributeInfo> {
    this.materializeDeferredEntries();
    if (!this.attributesWithPrefixCache) {
      this.attributesWithPrefixCache = {};
      for (const entry of this.entries) {
        this.attributesWithPrefixCache[entry.rawName] = {
          value: this.materializeValue(entry),
          localName: entry.localName,
          prefix: entry.prefix,
          uri: entry.uri,
        };
      }
    }

    return this.attributesWithPrefixCache;
  }

  private addEntry(entry: AttributeEntry): void {
    this.entries.push(entry);
    this.attributesCache = undefined;
    this.attributesWithPrefixCache = undefined;
  }

  private getEntryIndex(): Map<string, number> {
    if (!this.entryIndex) {
      this.entryIndex = new Map<string, number>();
      for (let index = 0; index < this.entries.length; index++) {
        this.entryIndex.set(this.entries[index].rawName, index);
      }
    }

    return this.entryIndex;
  }

  private materializeValue(entry: AttributeEntry): string {
    if (entry.value === undefined) {
      entry.value = this.decodeValue(this.source.slice(entry.sourceStart, entry.sourceEnd));
    }

    return entry.value;
  }

  private materializeDeferredEntries(): void {
    if (
      this.deferredStart === undefined ||
      this.deferredEnd === undefined ||
      !this.deferredNamespaces ||
      !this.deferredIsWhitespace
    ) {
      return;
    }

    let index = this.deferredStart;
    while (index < this.deferredEnd) {
      while (index < this.deferredEnd && this.deferredIsWhitespace(this.source.charCodeAt(index))) {
        index++;
      }
      if (index >= this.deferredEnd) {
        break;
      }

      const nameStart = index;
      while (index < this.deferredEnd) {
        const code = this.source.charCodeAt(index);
        if (code === 61 || this.deferredIsWhitespace(code)) {
          break;
        }
        index++;
      }

      if (index === nameStart) {
        break;
      }

      const rawName = this.source.slice(nameStart, index);
      const colonIndex = rawName.indexOf(':');
      const prefix = colonIndex === -1 ? undefined : rawName.slice(0, colonIndex);
      const localName = colonIndex === -1 ? rawName : rawName.slice(colonIndex + 1);
      const uri = prefix ? this.deferredNamespaces.get(prefix) : undefined;

      while (index < this.deferredEnd && this.deferredIsWhitespace(this.source.charCodeAt(index))) {
        index++;
      }

      if (index >= this.deferredEnd || this.source.charCodeAt(index) !== 61) {
        this.addDecoded(rawName, localName, prefix, uri, 'true');
        continue;
      }

      index++;
      while (index < this.deferredEnd && this.deferredIsWhitespace(this.source.charCodeAt(index))) {
        index++;
      }
      if (index >= this.deferredEnd) {
        break;
      }

      const quote = this.source.charCodeAt(index);
      if (quote !== 34 && quote !== 39) {
        break;
      }

      index++;
      const valueStart = index;
      while (index < this.deferredEnd && this.source.charCodeAt(index) !== quote) {
        index++;
      }
      if (index >= this.deferredEnd) {
        break;
      }

      this.addLazy(rawName, localName, prefix, uri, valueStart, index);
      index++;
    }

    this.deferredStart = undefined;
    this.deferredEnd = undefined;
    this.deferredNamespaces = undefined;
    this.deferredIsWhitespace = undefined;
  }
}
