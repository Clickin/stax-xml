import { describe, it, expect } from 'vitest';
import { XmlCursorReaderAsync, CursorEventType } from '../../src/cursor/index';

/** Helper to create a ReadableStream from a string, optionally split into chunks. */
function streamFrom(xml: string, chunkSize?: number): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(xml);

  if (!chunkSize) {
    // Single chunk
    return new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
  }

  // Multiple chunks
  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        controller.enqueue(bytes.slice(i, i + chunkSize));
      }
      controller.close();
    },
  });
}

async function drainCursor(cursor: XmlCursorReaderAsync): Promise<void> {
  while (await cursor.next()) { /* drain */ }
}

describe('XmlCursorReaderAsync', () => {
  // ── Basic parsing ─────────────────────────────────────────────────

  it('should parse a simple XML document', async () => {
    const cursor = new XmlCursorReaderAsync(streamFrom('<root><item>text</item></root>'));
    const events: { type: number; name?: string; text?: string }[] = [];

    while (await cursor.next()) {
      events.push({
        type: cursor.eventType(),
        name: cursor.name() ?? undefined,
        text: cursor.text() ?? undefined,
      });
    }

    expect(events).toEqual([
      { type: CursorEventType.START_DOCUMENT, name: undefined, text: undefined },
      { type: CursorEventType.START_ELEMENT, name: 'root', text: undefined },
      { type: CursorEventType.START_ELEMENT, name: 'item', text: undefined },
      { type: CursorEventType.CHARACTERS, name: undefined, text: 'text' },
      { type: CursorEventType.END_ELEMENT, name: 'item', text: undefined },
      { type: CursorEventType.END_ELEMENT, name: 'root', text: undefined },
      { type: CursorEventType.END_DOCUMENT, name: undefined, text: undefined },
    ]);
  });

  it('should produce START_DOCUMENT and END_DOCUMENT for self-closing root', async () => {
    const cursor = new XmlCursorReaderAsync(streamFrom('<root/>'));
    const events: number[] = [];
    while (await cursor.next()) events.push(cursor.eventType());
    expect(events).toEqual([
      CursorEventType.START_DOCUMENT,
      CursorEventType.START_ELEMENT,
      CursorEventType.END_ELEMENT,
      CursorEventType.END_DOCUMENT,
    ]);
  });

  it('should reject non-web streams', () => {
    expect(() => new XmlCursorReaderAsync({} as ReadableStream<Uint8Array>))
      .toThrow('stream must be a web standard ReadableStream');
  });

  // ── Chunk boundary handling ───────────────────────────────────────

  it('should handle tag split across chunks', async () => {
    // '<root>' split: '<ro' + 'ot>'
    const cursor = new XmlCursorReaderAsync(streamFrom('<root><item>hello</item></root>', 3));
    const names: string[] = [];

    while (await cursor.next()) {
      const n = cursor.name();
      if (n) names.push(n);
    }

    expect(names).toEqual(['root', 'item', 'item', 'root']);
  });

  it('should handle attributes split across chunks', async () => {
    const xml = '<root attr1="value1" attr2="value2"><child/></root>';
    // Small chunk size to force splits
    const cursor = new XmlCursorReaderAsync(streamFrom(xml, 5));

    await cursor.next(); // START_DOCUMENT
    await cursor.next(); // START_ELEMENT root

    expect(cursor.getAttributeCount()).toBe(2);
    expect(cursor.getAttributeValue('attr1')).toBe('value1');
    expect(cursor.getAttributeValue('attr2')).toBe('value2');
  });

  it('should handle CDATA split across chunks', async () => {
    const xml = '<root><![CDATA[content here]]></root>';
    const cursor = new XmlCursorReaderAsync(streamFrom(xml, 7));

    await cursor.next(); // START_DOCUMENT
    await cursor.next(); // START_ELEMENT root
    await cursor.next(); // CDATA

    expect(cursor.eventType()).toBe(CursorEventType.CDATA);
    expect(cursor.text()).toBe('content here');
  });

  it('should handle comment split across chunks', async () => {
    const xml = '<root><!-- a long comment --><item/></root>';
    const cursor = new XmlCursorReaderAsync(streamFrom(xml, 4));
    const types: number[] = [];

    while (await cursor.next()) types.push(cursor.eventType());

    expect(types).toEqual([
      CursorEventType.START_DOCUMENT,
      CursorEventType.START_ELEMENT,
      CursorEventType.START_ELEMENT,
      CursorEventType.END_ELEMENT,
      CursorEventType.END_ELEMENT,
      CursorEventType.END_DOCUMENT,
    ]);
  });

  it('should skip DOCTYPE and unknown bang markup', async () => {
    const cursor = new XmlCursorReaderAsync(streamFrom('<!DOCTYPE html><!BROKEN><root/>', 3));
    const types: number[] = [];

    while (await cursor.next()) types.push(cursor.eventType());

    expect(types).toEqual([
      CursorEventType.START_DOCUMENT,
      CursorEventType.START_ELEMENT,
      CursorEventType.END_ELEMENT,
      CursorEventType.END_DOCUMENT,
    ]);
  });

  // ── Self-closing tags ─────────────────────────────────────────────

  it('should handle self-closing tags', async () => {
    const cursor = new XmlCursorReaderAsync(streamFrom('<root><empty/><item/></root>'));
    const types: number[] = [];

    while (await cursor.next()) types.push(cursor.eventType());

    expect(types).toEqual([
      CursorEventType.START_DOCUMENT,
      CursorEventType.START_ELEMENT,
      CursorEventType.START_ELEMENT,
      CursorEventType.END_ELEMENT,
      CursorEventType.START_ELEMENT,
      CursorEventType.END_ELEMENT,
      CursorEventType.END_ELEMENT,
      CursorEventType.END_DOCUMENT,
    ]);
  });

  // ── Namespace handling ────────────────────────────────────────────

  it('should parse namespaced elements', async () => {
    const xml = '<ns:root xmlns:ns="http://example.com"><ns:child/></ns:root>';
    const cursor = new XmlCursorReaderAsync(streamFrom(xml));

    await cursor.next(); // START_DOCUMENT
    await cursor.next(); // ns:root

    expect(cursor.name()).toBe('ns:root');
    expect(cursor.localName()).toBe('root');
    expect(cursor.prefix()).toBe('ns');
    expect(cursor.uri()).toBe('http://example.com');

    await cursor.next(); // ns:child
    expect(cursor.localName()).toBe('child');
    expect(cursor.uri()).toBe('http://example.com');
  });

  it('should handle default namespace', async () => {
    const xml = '<root xmlns="http://default.ns"><child/></root>';
    const cursor = new XmlCursorReaderAsync(streamFrom(xml));

    await cursor.next(); // START_DOCUMENT
    await cursor.next(); // root
    expect(cursor.uri()).toBe('http://default.ns');

    await cursor.next(); // child
    expect(cursor.uri()).toBe('http://default.ns');
  });

  // ── Entity decoding ───────────────────────────────────────────────

  it('should decode XML entities', async () => {
    const xml = '<root>&lt;hello&gt; &amp; &quot;world&quot;</root>';
    const cursor = new XmlCursorReaderAsync(streamFrom(xml));

    await cursor.next(); // START_DOCUMENT
    await cursor.next(); // START_ELEMENT
    await cursor.next(); // CHARACTERS

    expect(cursor.text()).toBe('<hello> & "world"');
  });

  it('should decode entities in attributes', async () => {
    const xml = '<root attr="a&amp;b"/>';
    const cursor = new XmlCursorReaderAsync(streamFrom(xml));

    await cursor.next(); // START_DOCUMENT
    await cursor.next(); // START_ELEMENT

    expect(cursor.getAttributeValue('attr')).toBe('a&b');
  });

  it('should expose attribute accessor variants', async () => {
    const xml = '<root plain="v" empty="" xmlns:ns="urn:ns" ns:attr="namespaced" other="a&gt;b"/>';
    const cursor = new XmlCursorReaderAsync(streamFrom(xml));

    await cursor.next(); // START_DOCUMENT
    await cursor.next(); // START_ELEMENT root

    expect(cursor.getAttributeCount()).toBe(5);
    expect(cursor.getAttributeName(-1)).toBeUndefined();
    expect(cursor.getAttributeName(99)).toBeUndefined();
    expect(cursor.getAttributeLocalName(-1)).toBeUndefined();
    expect(cursor.getAttributeLocalName(99)).toBeUndefined();
    expect(cursor.getAttributeLocalName(0)).toBe('plain');
    expect(cursor.getAttributeLocalName(3)).toBe('attr');
    expect(cursor.getAttributePrefix(-1)).toBeUndefined();
    expect(cursor.getAttributePrefix(0)).toBeUndefined();
    expect(cursor.getAttributePrefix(3)).toBe('ns');
    expect(cursor.getAttributePrefix(99)).toBeUndefined();
    expect(cursor.getAttributeValue(-1)).toBeUndefined();
    expect(cursor.getAttributeValue(1)).toBe('');
    expect(cursor.getAttributeValue(99)).toBeUndefined();
    expect(cursor.getAttributeValue('empty')).toBe('');
    expect(cursor.getAttributeValue('other')).toBe('a>b');
    expect(cursor.getAttributeValue('plaxx')).toBeUndefined();
    expect(cursor.getAttributeUri(-1)).toBeUndefined();
    expect(cursor.getAttributeUri(0)).toBeUndefined();
    expect(cursor.getAttributeUri(3)).toBe('urn:ns');
    expect(cursor.getAttributeUri(99)).toBeUndefined();
  });

  it('should tolerate valueless attributes', async () => {
    const cursor = new XmlCursorReaderAsync(streamFrom('<root disabled bare/>'));

    await cursor.next(); // START_DOCUMENT
    await cursor.next(); // START_ELEMENT root

    expect(cursor.getAttributeCount()).toBe(2);
    expect(cursor.getAttributeValue('disabled')).toBe('disabled');
    expect(cursor.getAttributeValue('bare')).toBe('bare');
    expect(cursor.getAttributeUri(0)).toBeUndefined();
  });

  it('should parse attribute names with prefixes', async () => {
    const cursor = new XmlCursorReaderAsync(streamFrom('<root ns:attr="value" ns:flag/>'));

    await cursor.next(); // START_DOCUMENT
    await cursor.next(); // START_ELEMENT root

    expect(cursor.getAttributeCount()).toBe(2);
    expect(cursor.getAttributeName(0)).toBe('ns:attr');
    expect(cursor.getAttributeLocalName(0)).toBe('attr');
    expect(cursor.getAttributePrefix(0)).toBe('ns');
    expect(cursor.getAttributeValue('ns:attr')).toBe('value');
    expect(cursor.getAttributeName(1)).toBe('ns:flag');
    expect(cursor.getAttributeLocalName(1)).toBe('flag');
    expect(cursor.getAttributePrefix(1)).toBe('ns');
    expect(cursor.getAttributeValue('ns:flag')).toBe('ns:flag');
  });

  it('should stop attribute parsing on malformed separators', async () => {
    const emptyName = new XmlCursorReaderAsync(streamFrom('<root = "value"/>'));
    await emptyName.next(); // START_DOCUMENT
    await emptyName.next(); // START_ELEMENT root
    expect(emptyName.getAttributeCount()).toBe(0);

    const missingValue = new XmlCursorReaderAsync(streamFrom('<root attr=/>'));
    await missingValue.next(); // START_DOCUMENT
    await missingValue.next(); // START_ELEMENT root
    expect(missingValue.getAttributeCount()).toBe(0);

    const unquoted = new XmlCursorReaderAsync(streamFrom('<root attr=value/>'));
    await unquoted.next(); // START_DOCUMENT
    await unquoted.next(); // START_ELEMENT root
    expect(unquoted.getAttributeCount()).toBe(0);
  });

  // ── Error handling ────────────────────────────────────────────────

  it('should throw on mismatched closing tag', async () => {
    const cursor = new XmlCursorReaderAsync(streamFrom('<root><item></wrong></root>'));

    await cursor.next(); // START_DOCUMENT
    await cursor.next(); // root
    await cursor.next(); // item

    await expect(cursor.next()).rejects.toThrow('Mismatched closing tag');
  });

  it('should throw on unclosed elements at end of stream', async () => {
    const cursor = new XmlCursorReaderAsync(streamFrom('<root><item>text</item>'));

    // Drain until error
    await expect(async () => {
      while (await cursor.next()) { /* drain */ }
    }).rejects.toThrow('Not all elements were closed');
  });

  it('should throw on malformed markup variants', async () => {
    const cases: Array<[string, string]> = [
      ['<', 'Incomplete markup at end of stream'],
      ['<root></root', 'Unclosed end tag'],
      ['</root>', 'No open elements'],
      ['<root><![CDATA[text', 'Unclosed CDATA section'],
      ['<root><!-- comment', 'Unclosed comment'],
      ['<!DOCTYPE html', 'Unclosed DOCTYPE declaration'],
      ['<root><?pi target', 'Unclosed processing instruction'],
      ['<!BROKEN', 'Unclosed markup'],
      ['<root attr="unterminated', 'Unclosed start tag'],
    ];

    for (const [xml, message] of cases) {
      await expect(drainCursor(new XmlCursorReaderAsync(streamFrom(xml))))
        .rejects.toThrow(message);
    }
  });

  // ── Depth tracking ────────────────────────────────────────────────

  it('should track depth', async () => {
    const cursor = new XmlCursorReaderAsync(streamFrom('<a><b><c/></b></a>'));
    const depths: number[] = [];

    while (await cursor.next()) depths.push(cursor.depth());

    expect(depths).toEqual([0, 1, 2, 3, 2, 1, 0, 0]);
  });

  // ── Close / cleanup ───────────────────────────────────────────────

  it('should support close()', async () => {
    const cursor = new XmlCursorReaderAsync(streamFrom('<root><item>text</item></root>'));

    await cursor.next(); // START_DOCUMENT
    await cursor.next(); // root
    await cursor.close();

    // After close, next should return false
    expect(await cursor.next()).toBe(false);
  });

  // ── Complex document with chunks ──────────────────────────────────

  it('should parse a complex document with small chunks', async () => {
    const xml = `<library xmlns:bk="http://books.example.com">
      <bk:book id="1" lang="en">
        <bk:title>XML Parsing</bk:title>
        <bk:author>John Doe</bk:author>
      </bk:book>
      <bk:book id="2" lang="ko">
        <bk:title>StAX Guide</bk:title>
      </bk:book>
    </library>`;

    const cursor = new XmlCursorReaderAsync(streamFrom(xml, 10));
    const books: { id: string; title: string }[] = [];
    let currentBook: { id: string; title: string } | null = null;
    let inTitle = false;

    while (await cursor.next()) {
      const et = cursor.eventType();
      if (et === CursorEventType.START_ELEMENT) {
        if (cursor.localName() === 'book') {
          currentBook = { id: cursor.getAttributeValue('id') ?? '', title: '' };
        } else if (cursor.localName() === 'title') {
          inTitle = true;
        }
      } else if (et === CursorEventType.CHARACTERS && inTitle && currentBook) {
        currentBook.title = cursor.text() ?? '';
      } else if (et === CursorEventType.END_ELEMENT) {
        if (cursor.localName() === 'title') inTitle = false;
        else if (cursor.localName() === 'book' && currentBook) {
          books.push(currentBook);
          currentBook = null;
        }
      }
    }

    expect(books).toEqual([
      { id: '1', title: 'XML Parsing' },
      { id: '2', title: 'StAX Guide' },
    ]);
  });

  it('should reuse element and namespace stack slots for sibling elements', async () => {
    const xml = '<root><a></a><b></b><c attr="1"></c><d attr="2"></d></root>';
    const cursor = new XmlCursorReaderAsync(streamFrom(xml));
    const starts: string[] = [];

    while (await cursor.next()) {
      if (cursor.eventType() === CursorEventType.START_ELEMENT) {
        starts.push(cursor.name() ?? '');
      }
    }

    expect(starts).toEqual(['root', 'a', 'b', 'c', 'd']);
  });

  // ── XML declaration ───────────────────────────────────────────────

  it('should skip XML declaration', async () => {
    const xml = '<?xml version="1.0" encoding="UTF-8"?><root/>';
    const cursor = new XmlCursorReaderAsync(streamFrom(xml));
    const types: number[] = [];

    while (await cursor.next()) types.push(cursor.eventType());

    expect(types).toEqual([
      CursorEventType.START_DOCUMENT,
      CursorEventType.START_ELEMENT,
      CursorEventType.END_ELEMENT,
      CursorEventType.END_DOCUMENT,
    ]);
  });

  // ── Whitespace handling ───────────────────────────────────────────

  it('should skip whitespace-only text', async () => {
    const xml = '<root>  \n  <item>text</item>  \n  </root>';
    const cursor = new XmlCursorReaderAsync(streamFrom(xml));
    const types: number[] = [];

    while (await cursor.next()) types.push(cursor.eventType());

    expect(types).toEqual([
      CursorEventType.START_DOCUMENT,
      CursorEventType.START_ELEMENT,
      CursorEventType.START_ELEMENT,
      CursorEventType.CHARACTERS,
      CursorEventType.END_ELEMENT,
      CursorEventType.END_ELEMENT,
      CursorEventType.END_DOCUMENT,
    ]);
  });

  it('should trim leading document whitespace and padded end tags', async () => {
    const cursor = new XmlCursorReaderAsync(streamFrom(' \u00A0 <root></ root >', 2));
    const names: Array<string | undefined> = [];

    while (await cursor.next()) names.push(cursor.name());

    expect(names).toEqual([undefined, 'root', 'root', undefined]);
  });

  it('should emit top-level trailing text when no tags are present', async () => {
    const cursor = new XmlCursorReaderAsync(streamFrom('  trailing text  ', 2));

    expect(await cursor.next()).toBe(true);
    expect(cursor.eventType()).toBe(CursorEventType.START_DOCUMENT);
    expect(await cursor.next()).toBe(true);
    expect(cursor.eventType()).toBe(CursorEventType.CHARACTERS);
    expect(cursor.text()).toBe('trailing text');
    expect(await cursor.next()).toBe(true);
    expect(cursor.eventType()).toBe(CursorEventType.END_DOCUMENT);
    expect(await cursor.next()).toBe(false);
  });

  it('should emit END_DOCUMENT for top-level whitespace-only input', async () => {
    const cursor = new XmlCursorReaderAsync(streamFrom('  \n  ', 2));

    expect(await cursor.next()).toBe(true);
    expect(cursor.eventType()).toBe(CursorEventType.START_DOCUMENT);
    expect(await cursor.next()).toBe(true);
    expect(cursor.eventType()).toBe(CursorEventType.END_DOCUMENT);
    expect(await cursor.next()).toBe(false);
  });

  // ── Accessor on wrong event type ──────────────────────────────────

  it('should return undefined for name on non-element events', async () => {
    const cursor = new XmlCursorReaderAsync(streamFrom('<r>text</r>'));

    await cursor.next(); // START_DOCUMENT
    expect(cursor.name()).toBeUndefined();
    expect(cursor.localName()).toBeUndefined();
    expect(cursor.prefix()).toBeUndefined();
    expect(cursor.uri()).toBeUndefined();
    expect(cursor.text()).toBeUndefined();

    await cursor.next(); // START_ELEMENT
    expect(cursor.text()).toBeUndefined();

    await cursor.next(); // CHARACTERS
    expect(cursor.name()).toBeUndefined();
    expect(cursor.localName()).toBeUndefined();
  });

  it('should return undefined uri for text inside a namespaced element', async () => {
    const cursor = new XmlCursorReaderAsync(streamFrom('<root xmlns="urn:default">text</root>'));

    await cursor.next(); // START_DOCUMENT
    await cursor.next(); // START_ELEMENT root
    expect(cursor.uri()).toBe('urn:default');
    await cursor.next(); // CHARACTERS

    expect(cursor.uri()).toBeUndefined();
  });
});
