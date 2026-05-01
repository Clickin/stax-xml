type ByteCacheEntry = {
  bytes: Uint8Array;
  value: string;
};

type StringCacheEntry = {
  value: string;
};

export const VALUE_ID_CACHE_MAX_ENTRIES = 4096;

export class ShortValueStringCache {
  private readonly byteBuckets = new Map<number, ByteCacheEntry[]>();
  private readonly stringBuckets = new Map<number, StringCacheEntry[]>();
  private byteEntryCount = 0;
  private stringEntryCount = 0;

  constructor(
    private readonly maxSpanUnits = 32,
    private readonly maxEntries = 256,
  ) {}

  rememberBytes(
    buffer: Uint8Array,
    start: number,
    end: number,
    materialize: () => string,
  ): string {
    if (start < 0 || end < 0 || end - start > this.maxSpanUnits) {
      return materialize();
    }

    const key = byteSpanKey(buffer, start, end);
    const bucket = this.byteBuckets.get(key);
    if (bucket) {
      for (let index = 0; index < bucket.length; index++) {
        const entry = bucket[index]!;
        if (entry.bytes.byteLength !== end - start) {
          continue;
        }
        if (equalBytes(entry.bytes, buffer, start, end)) {
          this.byteBuckets.delete(key);
          this.byteBuckets.set(key, bucket);
          return entry.value;
        }
      }
    }

    const value = materialize();
    const entry = { bytes: buffer.slice(start, end), value };
    if (bucket) {
      bucket.push(entry);
      this.byteBuckets.delete(key);
      this.byteBuckets.set(key, bucket);
    } else {
      this.byteBuckets.set(key, [entry]);
    }
    this.byteEntryCount++;
    this.evictByteEntries();
    return value;
  }

  rememberString(
    source: string,
    start: number,
    end: number,
    materialize: () => string,
  ): string {
    if (start < 0 || end < 0 || end - start > this.maxSpanUnits) {
      return materialize();
    }

    const key = stringSpanKey(source, start, end);
    const bucket = this.stringBuckets.get(key);
    if (bucket) {
      for (let index = 0; index < bucket.length; index++) {
        const entry = bucket[index]!;
        if (entry.value.length !== end - start) {
          continue;
        }
        if (equalStringSpan(source, start, end, entry.value)) {
          this.stringBuckets.delete(key);
          this.stringBuckets.set(key, bucket);
          return entry.value;
        }
      }
    }

    const value = materialize();
    if (bucket) {
      bucket.push({ value });
      this.stringBuckets.delete(key);
      this.stringBuckets.set(key, bucket);
    } else {
      this.stringBuckets.set(key, [{ value }]);
    }
    this.stringEntryCount++;
    this.evictStringEntries();
    return value;
  }

  private evictByteEntries(): void {
    while (this.byteEntryCount > this.maxEntries) {
      const oldestKey = this.byteBuckets.keys().next().value as number | undefined;
      if (oldestKey === undefined) {
        return;
      }
      const bucket = this.byteBuckets.get(oldestKey);
      this.byteBuckets.delete(oldestKey);
      this.byteEntryCount -= bucket?.length ?? 0;
    }
  }

  private evictStringEntries(): void {
    while (this.stringEntryCount > this.maxEntries) {
      const oldestKey = this.stringBuckets.keys().next().value as number | undefined;
      if (oldestKey === undefined) {
        return;
      }
      const bucket = this.stringBuckets.get(oldestKey);
      this.stringBuckets.delete(oldestKey);
      this.stringEntryCount -= bucket?.length ?? 0;
    }
  }
}

export function rememberNumericIdString(
  cache: Map<number, string>,
  id: number,
  materialize: () => string,
  maxEntries?: number,
): string {
  const cached = cache.get(id);
  if (cached !== undefined) {
    if (maxEntries !== undefined) {
      cache.delete(id);
      cache.set(id, cached);
    }
    return cached;
  }

  const value = materialize();
  cache.set(id, value);
  if (maxEntries !== undefined && cache.size > maxEntries) {
    const oldestId = cache.keys().next().value as number | undefined;
    if (oldestId !== undefined) {
      cache.delete(oldestId);
    }
  }
  return value;
}

export function decodeShortAsciiSpan(
  buffer: Uint8Array,
  start: number,
  end: number,
): string | undefined {
  switch (end - start) {
    case 0:
      return '';
    case 1: {
      const b0 = buffer[start]!;
      return b0 <= 0x7f ? String.fromCharCode(b0) : undefined;
    }
    case 2: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      return (b0 | b1) <= 0x7f ? String.fromCharCode(b0, b1) : undefined;
    }
    case 3: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      return (b0 | b1 | b2) <= 0x7f ? String.fromCharCode(b0, b1, b2) : undefined;
    }
    case 4: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      const b3 = buffer[start + 3]!;
      return (b0 | b1 | b2 | b3) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3) : undefined;
    }
    case 5: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      const b3 = buffer[start + 3]!;
      const b4 = buffer[start + 4]!;
      return (b0 | b1 | b2 | b3 | b4) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4) : undefined;
    }
    case 6: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      const b3 = buffer[start + 3]!;
      const b4 = buffer[start + 4]!;
      const b5 = buffer[start + 5]!;
      return (b0 | b1 | b2 | b3 | b4 | b5) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5) : undefined;
    }
    case 7: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      const b3 = buffer[start + 3]!;
      const b4 = buffer[start + 4]!;
      const b5 = buffer[start + 5]!;
      const b6 = buffer[start + 6]!;
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6) : undefined;
    }
    case 8: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      const b3 = buffer[start + 3]!;
      const b4 = buffer[start + 4]!;
      const b5 = buffer[start + 5]!;
      const b6 = buffer[start + 6]!;
      const b7 = buffer[start + 7]!;
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7) : undefined;
    }
    case 9: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      const b3 = buffer[start + 3]!;
      const b4 = buffer[start + 4]!;
      const b5 = buffer[start + 5]!;
      const b6 = buffer[start + 6]!;
      const b7 = buffer[start + 7]!;
      const b8 = buffer[start + 8]!;
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8) : undefined;
    }
    case 10: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      const b3 = buffer[start + 3]!;
      const b4 = buffer[start + 4]!;
      const b5 = buffer[start + 5]!;
      const b6 = buffer[start + 6]!;
      const b7 = buffer[start + 7]!;
      const b8 = buffer[start + 8]!;
      const b9 = buffer[start + 9]!;
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9) : undefined;
    }
    case 11: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      const b3 = buffer[start + 3]!;
      const b4 = buffer[start + 4]!;
      const b5 = buffer[start + 5]!;
      const b6 = buffer[start + 6]!;
      const b7 = buffer[start + 7]!;
      const b8 = buffer[start + 8]!;
      const b9 = buffer[start + 9]!;
      const b10 = buffer[start + 10]!;
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10) : undefined;
    }
    case 12: {
      const b0 = buffer[start]!;
      const b1 = buffer[start + 1]!;
      const b2 = buffer[start + 2]!;
      const b3 = buffer[start + 3]!;
      const b4 = buffer[start + 4]!;
      const b5 = buffer[start + 5]!;
      const b6 = buffer[start + 6]!;
      const b7 = buffer[start + 7]!;
      const b8 = buffer[start + 8]!;
      const b9 = buffer[start + 9]!;
      const b10 = buffer[start + 10]!;
      const b11 = buffer[start + 11]!;
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11) : undefined;
    }
    default:
      return undefined;
  }
}

export function byteSpanKey(buffer: Uint8Array, start: number, end: number): number {
  let hash = 2166136261;
  for (let index = start; index < end; index++) {
    hash ^= buffer[index]!;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash + ((end - start) * 0x1_0000_0000);
}

export function stringSpanKey(source: string, start: number, end: number): number {
  let hash = 2166136261;
  for (let index = start; index < end; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash + ((end - start) * 0x1_0000_0000);
}

function equalBytes(entry: Uint8Array, buffer: Uint8Array, start: number, end: number): boolean {
  for (let index = 0; index < entry.byteLength; index++) {
    if (entry[index] !== buffer[start + index]) {
      return false;
    }
  }
  return entry.byteLength === end - start;
}

function equalStringSpan(source: string, start: number, end: number, value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    if (source.charCodeAt(start + index) !== value.charCodeAt(index)) {
      return false;
    }
  }
  return value.length === end - start;
}
