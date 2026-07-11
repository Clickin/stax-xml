import { describe, expect, it } from 'vitest';
import { CursorReaderSync, StreamEventType } from 'stax-xml-sync';

const encoder = new TextEncoder();

describe('CursorReaderSync', () => {
  it('computes stable full-string checksum fields', () => {
    const xml = [
      '<root id="1" ns:name="top">',
      '<item code="a">hello</item>',
      '<empty enabled/>',
      '<![CDATA[cdata text]]>',
      '</root>',
    ].join('');
    const bytes = encoder.encode(xml);

    expect(consumeCursor(bytes)).toEqual({ eventCount: 10, checksum: -1060273185 });
  });

  it('keeps distinct names that collide under the internal hash', () => {
    const reader = new CursorReaderSync(encoder.encode('<root><aaaaaaaaa/><abBaaaaaa/></root>'));
    const names: string[] = [];

    while (reader.next()) {
      if (reader.eventType() === StreamEventType.START_ELEMENT) {
        names.push(reader.name()!);
      }
    }

    expect(names).toEqual(['root', 'aaaaaaaaa', 'abBaaaaaa']);
  });

  it('reuses interned ids for repeated names that collide under the internal hash', () => {
    const reader = new CursorReaderSync(encoder.encode([
      '<root>',
      '<aaaaaaaaa/>',
      '<abBaaaaaa/>',
      '<aaaaaaaaa/>',
      '<abBaaaaaa/>',
      '</root>',
    ].join('')));
    const ids: number[] = [];

    while (reader.next()) {
      if (reader.eventType() === StreamEventType.START_ELEMENT && reader.name() !== 'root') {
        ids.push(reader.nameId());
      }
    }

    expect(ids[0]).not.toBe(ids[1]);
    expect(ids[0]).toBe(ids[2]);
    expect(ids[1]).toBe(ids[3]);
  });

  it('reuses interned ids for repeated names that collide in the name table slot', () => {
    const reader = new CursorReaderSync(encoder.encode([
      '<root>',
      '<x27/>',
      '<xQab/>',
      '<x27/>',
      '<xQab/>',
      '</root>',
    ].join('')));
    const ids: number[] = [];

    while (reader.next()) {
      if (reader.eventType() === StreamEventType.START_ELEMENT && reader.name() !== 'root') {
        ids.push(reader.nameId());
      }
    }

    expect(ids[0]).not.toBe(ids[1]);
    expect(ids[0]).toBe(ids[2]);
    expect(ids[1]).toBe(ids[3]);
  });

  it('rejects mismatched closing tags', () => {
    const reader = new CursorReaderSync(encoder.encode('<root><a></b></root>'));

    expect(() => {
      while (reader.next()) {
        // consume all events
      }
    }).toThrow(/Mismatched closing tag/);
  });

  it('rejects mismatched closing tags that collide under the internal hash', () => {
    const reader = new CursorReaderSync(encoder.encode('<root><aaaaaaaaa></abBaaaaaa></root>'));

    expect(() => {
      while (reader.next()) {
        // consume all events
      }
    }).toThrow(/Mismatched closing tag/);
  });

  it('exposes local names without event objects', () => {
    const reader = new CursorReaderSync(encoder.encode('<ns:root ns:id="7"/>'));
    const seen: Array<[string | undefined, string | undefined, string | undefined]> = [];

    while (reader.next()) {
      if (reader.eventType() === StreamEventType.START_ELEMENT) {
        seen.push([reader.name(), reader.localName(), reader.attributeLocalName(0)]);
      }
    }

    expect(seen).toEqual([['ns:root', 'root', 'id']]);
  });

  it('reuses local name ids for prefixed element and attribute names', () => {
    const reader = new CursorReaderSync(encoder.encode([
      '<root>',
      '<a:item a:id="1"/>',
      '<b:item b:id="2"/>',
      '</root>',
    ].join('')));
    const elementLocalIds: number[] = [];
    const attrLocalIds: number[] = [];

    while (reader.next()) {
      if (reader.eventType() === StreamEventType.START_ELEMENT && reader.localName() === 'item') {
        elementLocalIds.push(reader.localNameId());
        attrLocalIds.push(reader.attributeLocalNameId(0));
      }
    }

    expect(elementLocalIds[0]).toBeGreaterThanOrEqual(0);
    expect(elementLocalIds[0]).toBe(elementLocalIds[1]);
    expect(attrLocalIds[0]).toBeGreaterThanOrEqual(0);
    expect(attrLocalIds[0]).toBe(attrLocalIds[1]);
  });

  it('honors the configured interned name capacity', () => {
    const reader = new CursorReaderSync(encoder.encode('<root><a/><b/></root>'), { maxInternedNames: 1 });
    const ids: number[] = [];

    while (reader.next()) {
      if (reader.eventType() === StreamEventType.START_ELEMENT) {
        ids.push(reader.nameId());
      }
    }

    expect(ids).toEqual([0, -1, -1]);
  });

  it('rejects invalid interned name capacity', () => {
    expect(() => new CursorReaderSync(encoder.encode('<root/>'), { maxInternedNames: 0 })).toThrow(/maxInternedNames/);
  });

  it('accepts whitespace before the end tag delimiter', () => {
    const reader = new CursorReaderSync(encoder.encode('<root><item>value</item ></root>'));
    const seen: string[] = [];

    while (reader.next()) {
      if (reader.eventType() === StreamEventType.END_ELEMENT) {
        seen.push(reader.name()!);
      }
    }

    expect(seen).toEqual(['item', 'root']);
  });

  it('exposes prefixed local names on end tags', () => {
    const reader = new CursorReaderSync(encoder.encode('<ns:root><ns:item>value</ns:item ></ns:root>'));
    const seen: string[] = [];

    while (reader.next()) {
      if (reader.eventType() === StreamEventType.END_ELEMENT) {
        seen.push(reader.localName()!);
      }
    }

    expect(seen).toEqual(['item', 'root']);
  });

  it('reads double-quoted, single-quoted, and implicit attribute values', () => {
    const reader = new CursorReaderSync(encoder.encode('<root a="1" b=\'2\' enabled c="true" d="false"/>'));
    const values: Array<string | undefined> = [];

    while (reader.next()) {
      if (reader.eventType() === StreamEventType.START_ELEMENT) {
        values.push(
          reader.attributeValueAt(0),
          reader.attributeValueAt(1),
          reader.attributeValueAt(2),
          reader.attributeValueAt(3),
          reader.attributeValueAt(4),
        );
      }
    }

    expect(values).toEqual(['1', '2', 'true', 'true', 'false']);
  });

  it('invalidates memoized text and attribute values between events', () => {
    const reader = new CursorReaderSync(encoder.encode('<root><item code="a">one</item><item code="b">two</item></root>'));
    const attrValues: string[] = [];
    const textValues: string[] = [];

    while (reader.next()) {
      if (reader.eventType() === StreamEventType.START_ELEMENT && reader.name() === 'item') {
        attrValues.push(`${reader.attributeValueAt(0)}:${reader.attributeValue(0)}`);
      }
      if (reader.eventType() === StreamEventType.CHARACTERS) {
        textValues.push(`${reader.text()}:${reader.text()}`);
      }
    }

    expect(attrValues).toEqual(['a:a', 'b:b']);
    expect(textValues).toEqual(['one:one', 'two:two']);
  });

  it('exposes trimmed text without changing the raw text accessor', () => {
    const reader = new CursorReaderSync(encoder.encode('<root>  value  </root>'));
    const seen: Array<[string | undefined, string | undefined]> = [];

    while (reader.next()) {
      if (reader.eventType() === StreamEventType.CHARACTERS) {
        seen.push([reader.text(), reader.textTrimmed()]);
      }
    }

    expect(seen).toEqual([['  value  ', 'value']]);
  });

  it('decodes selected ASCII fast-path spans', () => {
    const longName = 'abcdefghijklmnopqrstuvwxyzABCDEFGH';
    const value21 = 'abcdefghijklmnopqrstu';
    const reader = new CursorReaderSync(encoder.encode(
      `<abcdefghijklmn value="abcdefghijklm">abcdefghijklmn</abcdefghijklmn>`
        + `<${longName} value="${value21}">${longName}</${longName}>`,
    ));
    const seen: Array<[string | undefined, string | undefined, string | undefined]> = [];

    while (reader.next()) {
      if (reader.eventType() === StreamEventType.START_ELEMENT) {
        seen.push([reader.localName(), reader.attributeValueAt(0), undefined]);
      }
      if (reader.eventType() === StreamEventType.CHARACTERS) {
        seen.push([undefined, undefined, reader.textTrimmed()]);
      }
    }

    expect(seen).toEqual([
      ['abcdefghijklmn', 'abcdefghijklm', undefined],
      [undefined, undefined, 'abcdefghijklmn'],
      [longName, value21, undefined],
      [undefined, undefined, longName],
    ]);
  });

  it('does not expose stale name, text, or attributes on unrelated event types', () => {
    const reader = new CursorReaderSync(encoder.encode('<root id="1">text</root>'));
    const seen: Array<[number, number, string | undefined, string | undefined, number, string | undefined]> = [];

    while (reader.next()) {
      seen.push([
        reader.eventType(),
        reader.nameId(),
        reader.name(),
        reader.text(),
        reader.getAttributeCount(),
        reader.attributeName(0),
      ]);
    }

    expect(seen).toEqual([
      [StreamEventType.START_DOCUMENT, -1, undefined, undefined, 0, undefined],
      [StreamEventType.START_ELEMENT, 0, 'root', undefined, 1, 'id'],
      [StreamEventType.CHARACTERS, -1, undefined, 'text', 0, undefined],
      [StreamEventType.END_ELEMENT, 0, 'root', undefined, 0, undefined],
      [StreamEventType.END_DOCUMENT, -1, undefined, undefined, 0, undefined],
    ]);
  });

  it('accepts direct byte chunk iterables across chunk boundaries', () => {
    const xml = '<root id="1"><ns:item ns:code="a">hello</ns:item><![CDATA[cdata text]]></root>';
    const bytes = encoder.encode(xml);
    const chunks = Array.from(chunkBytes(bytes, 7));

    expect(consumeCursor(chunks)).toEqual({ eventCount: 8, checksum: 1138204163 });

    const reader = new CursorReaderSync(chunks);
    const localNames: Array<[string | undefined, string | undefined]> = [];
    while (reader.next()) {
      if (reader.eventType() === StreamEventType.START_ELEMENT) {
        localNames.push([reader.localName(), reader.attributeLocalName(0)]);
      }
    }

    expect(localNames).toEqual([
      ['root', 'id'],
      ['item', 'code'],
    ]);
  });

  it('keeps byte-batch iterable compatibility across chunk boundaries', () => {
    const xml = '<root id="1"><ns:item ns:code="a">hello</ns:item><![CDATA[cdata text]]></root>';
    const bytes = encoder.encode(xml);
    const batches = Array.from(batchBytes(bytes, 7));

    expect(consumeCursor(batches)).toEqual({ eventCount: 8, checksum: 1138204163 });
  });
});

function consumeCursor(input: Uint8Array | Iterable<Uint8Array | readonly Uint8Array[]>): { eventCount: number; checksum: number } {
  const reader = new CursorReaderSync(input);
  let eventCount = 0;
  let checksum = 0;

  while (reader.next()) {
    const type = reader.eventType();
    eventCount++;
    checksum = mixChecksum(checksum, type);
    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      checksum = foldString(checksum, reader.name());
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      checksum = foldString(checksum, reader.text()?.trim());
    }
    if (type === StreamEventType.START_ELEMENT) {
      const attrCount = reader.getAttributeCount();
      checksum = mixChecksum(checksum, attrCount);
      for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
        checksum = foldString(checksum, reader.attributeName(attrIndex));
        checksum = foldString(checksum, reader.attributeValue(attrIndex));
      }
    }
  }

  return { eventCount, checksum };
}

function* chunkBytes(bytes: Uint8Array, chunkSize: number): Iterable<Uint8Array> {
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    yield bytes.subarray(offset, Math.min(bytes.byteLength, offset + chunkSize));
  }
}

function* batchBytes(bytes: Uint8Array, chunkSize: number): Iterable<readonly Uint8Array[]> {
  for (const chunk of chunkBytes(bytes, chunkSize)) {
    yield [chunk];
  }
}

function mixChecksum(seed: number, value: number): number {
  return Math.imul(seed ^ value, 16777619) | 0;
}

function foldString(seed: number, value: string | undefined): number {
  if (value === undefined) {
    return mixChecksum(seed, 0);
  }
  let checksum = mixChecksum(seed, value.length);
  for (let index = 0; index < value.length; index++) {
    checksum = mixChecksum(checksum, value.charCodeAt(index));
  }
  return checksum;
}
