import { describe, it, expect } from 'vitest';
import { CursorReader, CursorEventType } from '../../src/cursor/index';

function drainCursor(cursor: CursorReader): void {
  while (cursor.next()) { /* drain */ }
}

function syncByteBatches(xml: string, chunkSize: number): Iterable<readonly Uint8Array[]> {
  const bytes = new TextEncoder().encode(xml);
  return {
    *[Symbol.iterator]() {
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        yield [bytes.slice(offset, Math.min(offset + chunkSize, bytes.length))];
      }
    },
  };
}

describe('CursorReader (sync)', () => {
  // ── Basic parsing ─────────────────────────────────────────────────

  it('should produce START_DOCUMENT and END_DOCUMENT for empty-ish XML', () => {
    const cursor = new CursorReader('<root/>');
    const events: number[] = [];
    while (cursor.next()) {
      events.push(cursor.eventType());
    }
    expect(events).toEqual([
      CursorEventType.START_DOCUMENT,
      CursorEventType.START_ELEMENT,
      CursorEventType.END_ELEMENT,
      CursorEventType.END_DOCUMENT,
    ]);
  });

  it('should parse a simple XML document', () => {
    const cursor = new CursorReader('<root><item>text</item></root>');
    const events: { type: number; name?: string; text?: string }[] = [];

    while (cursor.next()) {
      const et = cursor.eventType();
      events.push({
        type: et,
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

  it('should accept sync Iterable<Uint8Array[]> input without pre-materializing the full document', () => {
    const cursor = new CursorReader(syncByteBatches('<root><item>text</item></root>', 3));
    const events: { type: number; name?: string; text?: string }[] = [];

    while (cursor.next()) {
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

  // ── Self-closing tags ─────────────────────────────────────────────

  it('should handle self-closing tags', () => {
    const cursor = new CursorReader('<root><empty/><item/></root>');
    const names: (string | undefined)[] = [];
    const types: number[] = [];

    while (cursor.next()) {
      types.push(cursor.eventType());
      names.push(cursor.name());
    }

    expect(types).toEqual([
      CursorEventType.START_DOCUMENT,
      CursorEventType.START_ELEMENT, // root
      CursorEventType.START_ELEMENT, // empty
      CursorEventType.END_ELEMENT,   // /empty
      CursorEventType.START_ELEMENT, // item
      CursorEventType.END_ELEMENT,   // /item
      CursorEventType.END_ELEMENT,   // /root
      CursorEventType.END_DOCUMENT,
    ]);

    expect(names[2]).toBe('empty');
    expect(names[3]).toBe('empty');
    expect(names[4]).toBe('item');
    expect(names[5]).toBe('item');
  });

  // ── Attributes ────────────────────────────────────────────────────

  it('should parse attributes', () => {
    const cursor = new CursorReader('<root attr1="value1" attr2="value2"><child/></root>');

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT <root>

    expect(cursor.eventType()).toBe(CursorEventType.START_ELEMENT);
    expect(cursor.name()).toBe('root');
    expect(cursor.getAttributeCount()).toBe(2);
    expect(cursor.getAttributeName(0)).toBe('attr1');
    expect(cursor.getAttributeValue(0)).toBe('value1');
    expect(cursor.getAttributeName(1)).toBe('attr2');
    expect(cursor.getAttributeValue(1)).toBe('value2');

    // Lookup by name
    expect(cursor.getAttributeValue('attr1')).toBe('value1');
    expect(cursor.getAttributeValue('attr2')).toBe('value2');
    expect(cursor.getAttributeValue('nonexistent')).toBeUndefined();
  });

  it('should have zero attributes after self-closing END_ELEMENT', () => {
    const cursor = new CursorReader('<root><item id="1"/></root>');

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT <root>
    cursor.next(); // START_ELEMENT <item>
    expect(cursor.getAttributeCount()).toBe(1);
    expect(cursor.getAttributeValue('id')).toBe('1');

    cursor.next(); // END_ELEMENT </item> (from self-closing)
    expect(cursor.eventType()).toBe(CursorEventType.END_ELEMENT);
    expect(cursor.getAttributeCount()).toBe(0);
  });

  // ── Namespace handling ────────────────────────────────────────────

  it('should parse namespaced elements', () => {
    const xml = '<ns:root xmlns:ns="http://example.com"><ns:child/></ns:root>';
    const cursor = new CursorReader(xml);

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT ns:root

    expect(cursor.name()).toBe('ns:root');
    expect(cursor.localName()).toBe('root');
    expect(cursor.prefix()).toBe('ns');
    expect(cursor.uri()).toBe('http://example.com');

    cursor.next(); // START_ELEMENT ns:child
    expect(cursor.localName()).toBe('child');
    expect(cursor.prefix()).toBe('ns');
    expect(cursor.uri()).toBe('http://example.com');
  });

  it('should handle default namespace', () => {
    const xml = '<root xmlns="http://default.ns"><child/></root>';
    const cursor = new CursorReader(xml);

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT <root>
    expect(cursor.localName()).toBe('root');
    expect(cursor.prefix()).toBeUndefined();
    expect(cursor.uri()).toBe('http://default.ns');

    cursor.next(); // START_ELEMENT <child>
    expect(cursor.localName()).toBe('child');
    expect(cursor.uri()).toBe('http://default.ns');
  });

  it('should handle multiple namespace prefixes', () => {
    const xml = '<root xmlns:a="http://a.com" xmlns:b="http://b.com"><a:x/><b:y/></root>';
    const cursor = new CursorReader(xml);

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT root
    cursor.next(); // START_ELEMENT a:x
    expect(cursor.prefix()).toBe('a');
    expect(cursor.uri()).toBe('http://a.com');

    cursor.next(); // END_ELEMENT a:x
    cursor.next(); // START_ELEMENT b:y
    expect(cursor.prefix()).toBe('b');
    expect(cursor.uri()).toBe('http://b.com');
  });

  it('should handle namespace on attributes', () => {
    const xml = '<root xmlns:ns="http://example.com" ns:attr="val"><child/></root>';
    const cursor = new CursorReader(xml);

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT root

    // Find ns:attr
    let found = false;
    for (let i = 0; i < cursor.getAttributeCount(); i++) {
      const attrName = cursor.getAttributeName(i)!;
      if (attrName === 'ns:attr') {
        expect(cursor.getAttributeLocalName(i)).toBe('attr');
        expect(cursor.getAttributePrefix(i)).toBe('ns');
        expect(cursor.getAttributeUri(i)).toBe('http://example.com');
        expect(cursor.getAttributeValue(i)).toBe('val');
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  // ── CDATA ─────────────────────────────────────────────────────────

  it('should parse CDATA sections', () => {
    const xml = '<root><![CDATA[<data>text</data>]]></root>';
    const cursor = new CursorReader(xml);

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT root
    cursor.next(); // CDATA

    expect(cursor.eventType()).toBe(CursorEventType.CDATA);
    expect(cursor.text()).toBe('<data>text</data>');
  });

  // ── Comments and PI ───────────────────────────────────────────────

  it('should skip comments and processing instructions', () => {
    const xml = '<root><!-- comment --><?pi target data?><item/></root>';
    const cursor = new CursorReader(xml);
    const names: (string | undefined)[] = [];
    const types: number[] = [];

    while (cursor.next()) {
      types.push(cursor.eventType());
      names.push(cursor.name());
    }

    expect(types).toEqual([
      CursorEventType.START_DOCUMENT,
      CursorEventType.START_ELEMENT,
      CursorEventType.START_ELEMENT,
      CursorEventType.END_ELEMENT,
      CursorEventType.END_ELEMENT,
      CursorEventType.END_DOCUMENT,
    ]);
    expect(names[2]).toBe('item');
  });

  it('should skip XML declaration', () => {
    const xml = '<?xml version="1.0" encoding="UTF-8"?><root/>';
    const cursor = new CursorReader(xml);
    const types: number[] = [];

    while (cursor.next()) types.push(cursor.eventType());

    expect(types).toEqual([
      CursorEventType.START_DOCUMENT,
      CursorEventType.START_ELEMENT,
      CursorEventType.END_ELEMENT,
      CursorEventType.END_DOCUMENT,
    ]);
  });

  it('should skip DOCTYPE', () => {
    const xml = '<!DOCTYPE html><root/>';
    const cursor = new CursorReader(xml);
    const types: number[] = [];

    while (cursor.next()) types.push(cursor.eventType());

    expect(types).toEqual([
      CursorEventType.START_DOCUMENT,
      CursorEventType.START_ELEMENT,
      CursorEventType.END_ELEMENT,
      CursorEventType.END_DOCUMENT,
    ]);
  });

  it('should skip unknown bang markup', () => {
    const cursor = new CursorReader('<!BROKEN><root/>');
    const types: number[] = [];

    while (cursor.next()) types.push(cursor.eventType());

    expect(types).toEqual([
      CursorEventType.START_DOCUMENT,
      CursorEventType.START_ELEMENT,
      CursorEventType.END_ELEMENT,
      CursorEventType.END_DOCUMENT,
    ]);
  });

  // ── Entity decoding ───────────────────────────────────────────────

  it('should decode XML entities in text', () => {
    const xml = '<root>&lt;hello&gt; &amp; &quot;world&quot;</root>';
    const cursor = new CursorReader(xml);

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT root
    cursor.next(); // CHARACTERS

    expect(cursor.text()).toBe('<hello> & "world"');
  });

  it('should decode entities in attribute values', () => {
    const xml = '<root attr="a&amp;b"/>';
    const cursor = new CursorReader(xml);

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT root

    expect(cursor.getAttributeValue('attr')).toBe('a&b');
  });

  it('should support custom entities', () => {
    const xml = '<root>&copy; text</root>';
    const cursor = new CursorReader(xml, {
      addEntities: [{ entity: 'copy', value: '©' }],
    });

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT root
    cursor.next(); // CHARACTERS

    expect(cursor.text()).toBe('© text');
  });

  it('should support custom entities declared with entity delimiters', () => {
    const xml = '<root>&copy; &smile;</root>';
    const cursor = new CursorReader(xml, {
      addEntities: [
        { entity: '&copy;', value: 'C' },
        { entity: 'smile', value: ':)' },
      ],
    });

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT root
    cursor.next(); // CHARACTERS

    expect(cursor.text()).toBe('C :)');
  });

  it('should not decode entities when autoDecodeEntities is false', () => {
    const xml = '<root>&lt;test&gt;</root>';
    const cursor = new CursorReader(xml, { autoDecodeEntities: false });

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT root
    cursor.next(); // CHARACTERS

    expect(cursor.text()).toBe('&lt;test&gt;');
  });

  // ── Depth tracking ────────────────────────────────────────────────

  it('should track element depth', () => {
    const xml = '<a><b><c/></b></a>';
    const cursor = new CursorReader(xml);
    const depths: number[] = [];

    while (cursor.next()) {
      depths.push(cursor.depth());
    }

    // START_DOC(0), a(1), b(2), c(3), /c(2), /b(1), /a(0), END_DOC(0)
    expect(depths).toEqual([0, 1, 2, 3, 2, 1, 0, 0]);
  });

  // ── Error handling ────────────────────────────────────────────────

  it('should throw on mismatched closing tag', () => {
    const xml = '<root><item></wrong></root>';
    const cursor = new CursorReader(xml);

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT root
    cursor.next(); // START_ELEMENT item

    expect(() => cursor.next()).toThrow('Mismatched closing tag');
  });

  it('should throw on unclosed tag', () => {
    const xml = '<root><item';
    const cursor = new CursorReader(xml);

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT root

    expect(() => cursor.next()).toThrow('Unclosed start tag');
  });

  it('should throw on closing tag with no open elements', () => {
    const xml = '</root>';
    const cursor = new CursorReader(xml);

    cursor.next(); // START_DOCUMENT
    expect(() => cursor.next()).toThrow('No open elements');
  });

  it('should throw on same-length mismatched closing tag names', () => {
    const cursor = new CursorReader('<root><item></itxm></root>');

    expect(() => drainCursor(cursor)).toThrow('Expected </item>');
  });

  it('should throw on malformed markup variants', () => {
    const cases: Array<[string, string]> = [
      ['<root></root', 'Unclosed end tag'],
      ['<root><![CDATA[text</root>', 'Unclosed CDATA section'],
      ['<root><!-- comment</root>', 'Unclosed comment'],
      ['<!DOCTYPE html', 'Unclosed DOCTYPE declaration'],
      ['<root><?pi target</root>', 'Unclosed processing instruction'],
      ['<!BROKEN', 'Unclosed markup'],
      ['<root/', 'Unclosed start tag'],
      ['<root attr="unterminated', 'Unclosed start tag'],
    ];

    for (const [xml, message] of cases) {
      expect(() => drainCursor(new CursorReader(xml))).toThrow(message);
    }
  });

  // ── Whitespace handling ───────────────────────────────────────────

  it('should skip whitespace-only text', () => {
    const xml = '<root>  \n  <item>text</item>  \n  </root>';
    const cursor = new CursorReader(xml);
    const types: number[] = [];

    while (cursor.next()) types.push(cursor.eventType());

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

  it('should trim leading document whitespace and padded end tags', () => {
    const cursor = new CursorReader(' \u00A0 <root></ root >');
    const names: Array<string | undefined> = [];

    while (cursor.next()) names.push(cursor.name());

    expect(names).toEqual([undefined, 'root', 'root', undefined]);
  });

  // ── Boundary conditions ───────────────────────────────────────────

  it('should return false after END_DOCUMENT', () => {
    const cursor = new CursorReader('<r/>');
    while (cursor.next()) { /* drain */ }

    expect(cursor.next()).toBe(false);
    expect(cursor.next()).toBe(false);
  });

  it('should emit top-level trailing text when no tags are present', () => {
    const cursor = new CursorReader('  trailing text  ');

    expect(cursor.next()).toBe(true);
    expect(cursor.eventType()).toBe(CursorEventType.START_DOCUMENT);
    expect(cursor.next()).toBe(true);
    expect(cursor.eventType()).toBe(CursorEventType.CHARACTERS);
    expect(cursor.text()).toBe('trailing text');
    expect(cursor.next()).toBe(true);
    expect(cursor.eventType()).toBe(CursorEventType.END_DOCUMENT);
    expect(cursor.next()).toBe(false);
  });

  it('should emit END_DOCUMENT for top-level whitespace-only input', () => {
    const cursor = new CursorReader('  \n  ');

    expect(cursor.next()).toBe(true);
    expect(cursor.eventType()).toBe(CursorEventType.START_DOCUMENT);
    expect(cursor.next()).toBe(true);
    expect(cursor.eventType()).toBe(CursorEventType.END_DOCUMENT);
    expect(cursor.next()).toBe(false);
  });

  it('should handle single-character elements', () => {
    const cursor = new CursorReader('<a><b/></a>');
    const names: string[] = [];

    while (cursor.next()) {
      const n = cursor.name();
      if (n !== undefined) names.push(n);
    }

    expect(names).toEqual(['a', 'b', 'b', 'a']);
  });

  // ── Attribute edge cases ──────────────────────────────────────────

  it('should handle single-quoted attributes', () => {
    const xml = "<root attr='value'/>";
    const cursor = new CursorReader(xml);

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT root

    expect(cursor.getAttributeValue('attr')).toBe('value');
  });

  it('should handle attributes with spaces around =', () => {
    const xml = '<root attr = "value" />';
    const cursor = new CursorReader(xml);

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT root

    expect(cursor.getAttributeValue('attr')).toBe('value');
  });

  it('should expose attribute accessor variants', () => {
    const xml = '<root plain="v" empty="" xmlns:ns="urn:ns" ns:attr="namespaced" other="a&gt;b"/>';
    const cursor = new CursorReader(xml);

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT root

    expect(cursor.getAttributeCount()).toBe(5);
    expect(cursor.getAttributeLocalName(0)).toBe('plain');
    expect(cursor.getAttributePrefix(0)).toBeUndefined();
    expect(cursor.getAttributeUri(0)).toBeUndefined();
    expect(cursor.getAttributeLocalName(3)).toBe('attr');
    expect(cursor.getAttributePrefix(3)).toBe('ns');
    expect(cursor.getAttributeUri(3)).toBe('urn:ns');
    expect(cursor.getAttributeValue(1)).toBe('');
    expect(cursor.getAttributeValue('empty')).toBe('');
    expect(cursor.getAttributeValue('other')).toBe('a>b');
    expect(cursor.getAttributeValue('plaxx')).toBeUndefined();
    expect(cursor.getAttributeLocalName(-1)).toBeUndefined();
    expect(cursor.getAttributeLocalName(99)).toBeUndefined();
    expect(cursor.getAttributePrefix(-1)).toBeUndefined();
    expect(cursor.getAttributePrefix(99)).toBeUndefined();
    expect(cursor.getAttributeUri(-1)).toBeUndefined();
    expect(cursor.getAttributeUri(99)).toBeUndefined();
  });

  it('should tolerate valueless attributes in lazy and namespace-aware paths', () => {
    const lazy = new CursorReader('<root disabled bare/>');

    lazy.next(); // START_DOCUMENT
    lazy.next(); // START_ELEMENT root
    expect(lazy.getAttributeCount()).toBe(2);
    expect(lazy.getAttributeValue('disabled')).toBe('disabled');
    expect(lazy.getAttributeValue('bare')).toBe('bare');

    const namespaceAware = new CursorReader('<root xmlns:ns="urn:ns" disabled ns:flag/>');

    namespaceAware.next(); // START_DOCUMENT
    namespaceAware.next(); // START_ELEMENT root
    expect(namespaceAware.getAttributeValue('disabled')).toBe('disabled');
    expect(namespaceAware.getAttributeLocalName(2)).toBe('flag');
    expect(namespaceAware.getAttributeValue('ns:flag')).toBe('ns:flag');
  });

  it('should parse lazy attribute names with prefixes', () => {
    const cursor = new CursorReader('<root ns:attr="value" ns:flag/>');

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT root

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

  it('should allow namespaceAware false to skip namespace-expanded metadata', () => {
    const cursor = new CursorReader('<ns:root xmlns:ns="urn:ns" ns:flag="x"><ns:item/></ns:root>', {
      namespaceAware: false,
    });

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT ns:root
    expect(cursor.name()).toBe('ns:root');
    expect(cursor.localName()).toBeUndefined();
    expect(cursor.prefix()).toBeUndefined();
    expect(cursor.uri()).toBeUndefined();
    expect(cursor.getAttributeName(1)).toBe('ns:flag');
    expect(cursor.getAttributeValue('ns:flag')).toBe('x');
    expect(cursor.getAttributeLocalName(1)).toBeUndefined();
    expect(cursor.getAttributePrefix(1)).toBeUndefined();
    expect(cursor.getAttributeUri(1)).toBeUndefined();
  });

  it('should stop lazy attribute parsing on malformed separators', () => {
    const emptyName = new CursorReader('<root = "value"/>');
    emptyName.next(); // START_DOCUMENT
    emptyName.next(); // START_ELEMENT root
    expect(emptyName.getAttributeCount()).toBe(0);

    const missingValue = new CursorReader('<root attr=/>');
    missingValue.next(); // START_DOCUMENT
    missingValue.next(); // START_ELEMENT root
    expect(missingValue.getAttributeCount()).toBe(0);

    const unquoted = new CursorReader('<root attr=value/>');
    unquoted.next(); // START_DOCUMENT
    unquoted.next(); // START_ELEMENT root
    expect(unquoted.getAttributeCount()).toBe(0);
  });

  it('should return undefined for out-of-range attribute index', () => {
    const cursor = new CursorReader('<root attr="val"/>');

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT root

    expect(cursor.getAttributeName(-1)).toBeUndefined();
    expect(cursor.getAttributeName(99)).toBeUndefined();
    expect(cursor.getAttributeValue(-1)).toBeUndefined();
    expect(cursor.getAttributeValue(99)).toBeUndefined();
  });

  // ── Complex document ──────────────────────────────────────────────

  it('should parse a complex nested document correctly', () => {
    const xml = `<library xmlns:bk="http://books.example.com">
      <bk:book id="1" lang="en">
        <bk:title>XML Parsing</bk:title>
        <bk:author>John Doe</bk:author>
      </bk:book>
      <bk:book id="2" lang="ko">
        <bk:title>StAX Guide</bk:title>
      </bk:book>
    </library>`;

    const cursor = new CursorReader(xml);
    const books: { id: string; title: string }[] = [];
    let currentBook: { id: string; title: string } | null = null;
    let inTitle = false;

    while (cursor.next()) {
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
        if (cursor.localName() === 'title') {
          inTitle = false;
        } else if (cursor.localName() === 'book' && currentBook) {
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

  // ── Accessor on wrong event type ──────────────────────────────────

  it('should return undefined for name/localName/prefix on non-element events', () => {
    const cursor = new CursorReader('<r>text</r>');

    cursor.next(); // START_DOCUMENT
    expect(cursor.name()).toBeUndefined();
    expect(cursor.localName()).toBeUndefined();
    expect(cursor.prefix()).toBeUndefined();
    expect(cursor.uri()).toBeUndefined();
    expect(cursor.text()).toBeUndefined();

    cursor.next(); // START_ELEMENT r
    expect(cursor.text()).toBeUndefined();

    cursor.next(); // CHARACTERS
    expect(cursor.name()).toBeUndefined();
  });

  it('should return undefined uri for text inside a namespaced element', () => {
    const cursor = new CursorReader('<root xmlns="urn:default">text</root>');

    cursor.next(); // START_DOCUMENT
    cursor.next(); // START_ELEMENT root
    expect(cursor.uri()).toBe('urn:default');
    cursor.next(); // CHARACTERS

    expect(cursor.uri()).toBeUndefined();
  });
});
