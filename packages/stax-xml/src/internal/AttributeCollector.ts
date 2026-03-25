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
  private entryIndex = new Map<string, number>();
  private attributesCache?: Record<string, string>;
  private attributesWithPrefixCache?: Record<string, AttributeInfo>;

  constructor(private readonly decodeValue: (text: string) => string) {}

  reset(source: string): void {
    this.source = source;
    this.entries = [];
    this.entryIndex.clear();
    this.attributesCache = undefined;
    this.attributesWithPrefixCache = undefined;
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
    return this.entries.length === 0;
  }

  getAttributeValue(rawName: string): string | undefined {
    const index = this.entryIndex.get(rawName);
    if (index === undefined) {
      return undefined;
    }

    return this.materializeValue(this.entries[index]);
  }

  getAttributes(): Record<string, string> {
    if (!this.attributesCache) {
      this.attributesCache = {};
      for (const entry of this.entries) {
        this.attributesCache[entry.rawName] = this.materializeValue(entry);
      }
    }

    return this.attributesCache;
  }

  getAttributesWithPrefix(): Record<string, AttributeInfo> {
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
    this.entryIndex.set(entry.rawName, this.entries.length);
    this.entries.push(entry);
    this.attributesCache = undefined;
    this.attributesWithPrefixCache = undefined;
  }

  private materializeValue(entry: AttributeEntry): string {
    if (entry.value === undefined) {
      entry.value = this.decodeValue(this.source.slice(entry.sourceStart, entry.sourceEnd));
    }

    return entry.value;
  }
}
