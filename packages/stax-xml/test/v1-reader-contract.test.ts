import { describe, expect, it } from 'vitest';

import {
  EventReader,
  EventReaderSync,
  StreamReader,
  StreamReaderSync,
  XmlEventType,
  type AnyXmlEvent,
} from 'stax-xml';

const encoder = new TextEncoder();

function chunks(xml: string, size = 1): Uint8Array[] {
  const bytes = encoder.encode(xml);
  const result: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += size) {
    result.push(bytes.slice(offset, offset + size));
  }
  return result;
}

type CurrentTokenReader = Pick<StreamReaderSync,
  | 'eventType'
  | 'name'
  | 'localName'
  | 'prefix'
  | 'namespaceURI'
  | 'text'
  | 'attributeCount'
  | 'attributeName'
  | 'attributeLocalName'
  | 'attributePrefix'
  | 'attributeNamespaceURI'
  | 'attributeValue'>;

function currentToken(reader: CurrentTokenReader): unknown[] {
  const type = reader.eventType();
  if (type === XmlEventType.START_ELEMENT) {
    return [
      type,
      reader.name(),
      reader.localName(),
      reader.prefix(),
      reader.namespaceURI(),
      Array.from({ length: reader.attributeCount() }, (_, index) => [
        reader.attributeName(index),
        reader.attributeLocalName(index),
        reader.attributePrefix(index),
        reader.attributeNamespaceURI(index),
        reader.attributeValue(index),
      ]),
    ];
  }
  if (type === XmlEventType.END_ELEMENT) {
    return [type, reader.name(), reader.localName(), reader.prefix(), reader.namespaceURI()];
  }
  if (type === XmlEventType.CHARACTERS || type === XmlEventType.CDATA) {
    return [type, reader.text()];
  }
  if (type === XmlEventType.COMMENT || type === XmlEventType.DTD) {
    return [type, reader.text()];
  }
  if (type === XmlEventType.PROCESSING_INSTRUCTION) {
    return [type, reader.name(), reader.text()];
  }
  return [type];
}

function eventToken(event: AnyXmlEvent): unknown[] {
  if (event.type === XmlEventType.START_ELEMENT) {
    return [
      event.type,
      event.name,
      event.localName,
      event.prefix,
      event.namespaceURI,
      event.attributes.map((attribute) => [
        attribute.name,
        attribute.localName,
        attribute.prefix,
        attribute.namespaceURI,
        attribute.value,
      ]),
    ];
  }
  if (event.type === XmlEventType.END_ELEMENT) {
    return [event.type, event.name, event.localName, event.prefix, event.namespaceURI];
  }
  if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
    return [event.type, event.value];
  }
  if (event.type === XmlEventType.COMMENT || event.type === XmlEventType.DTD) {
    return [event.type, event.value];
  }
  if (event.type === XmlEventType.PROCESSING_INSTRUCTION) {
    return [event.type, event.target, event.data];
  }
  return [event.type];
}

interface ReaderOptions {
  documentMode?: 'document' | 'fragment';
  namespaceAware?: boolean;
  autoDecodeEntities?: boolean;
  addEntities?: { entity: string; value: string }[];
  encoding?: string;
}

function collectSync(input: string | Uint8Array | Iterable<Uint8Array>, options?: ReaderOptions): unknown[][] {
  const reader = new StreamReaderSync(input, options);
  const result: unknown[][] = [];
  while (reader.next() !== null) result.push(currentToken(reader));
  return result;
}

async function collectAsync(input: AsyncIterable<Uint8Array>, options?: ReaderOptions): Promise<unknown[][]> {
  const reader = new StreamReader(input, options);
  const result: unknown[][] = [];
  while (await reader.next() !== null) result.push(currentToken(reader));
  return result;
}

async function* asyncChunks(xml: string, size = 1): AsyncGenerator<Uint8Array> {
  yield* chunks(xml, size);
}

function utf16Bytes(text: string, littleEndian: boolean): Uint8Array {
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes[0] = littleEndian ? 0xff : 0xfe;
  bytes[1] = littleEndian ? 0xfe : 0xff;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    bytes[2 + index * 2] = littleEndian ? code & 0xff : code >>> 8;
    bytes[3 + index * 2] = littleEndian ? code >>> 8 : code & 0xff;
  }
  return bytes;
}

async function* byteChunks(bytes: Uint8Array, size: number): AsyncGenerator<Uint8Array> {
  for (let offset = 0; offset < bytes.length; offset += size) {
    yield bytes.slice(offset, offset + size);
  }
}

describe('v1 reader public surface', () => {
  it('exports exactly the four reader roles from the package root', () => {
    expect(StreamReaderSync).toBeTypeOf('function');
    expect(StreamReader).toBeTypeOf('function');
    expect(EventReaderSync).toBeTypeOf('function');
    expect(EventReader).toBeTypeOf('function');
  });
});

describe('v1 current-token reader contract', () => {
  it('uses the configured fatal TextDecoder encoding for byte readers', async () => {
    const xml = '<?xml version="1.0" encoding="UTF-16"?><root>한글</root>';
    const expected = collectSync(xml);
    const littleEndian = utf16Bytes(xml, true);
    const bigEndian = utf16Bytes(xml, false);

    expect(collectSync(littleEndian, { encoding: 'utf-16le' })).toEqual(expected);
    expect(Array.from(new EventReaderSync(littleEndian, { encoding: 'utf-16le' })).map(eventToken))
      .toEqual(Array.from(new EventReaderSync(xml)).map(eventToken));
    await expect(collectAsync(byteChunks(bigEndian, 3), { encoding: 'utf-16be' })).resolves.toEqual(expected);

    const asyncEvents: unknown[][] = [];
    for await (const event of new EventReader(byteChunks(bigEndian, 3), { encoding: 'utf-16be' })) {
      asyncEvents.push(eventToken(event));
    }
    expect(asyncEvents).toEqual(Array.from(new EventReaderSync(xml)).map(eventToken));

    expect(() => collectSync(littleEndian.slice(0, -1), { encoding: 'utf-16le' })).toThrow();
    expect(() => new StreamReaderSync(littleEndian, { encoding: 'not-an-encoding' })).toThrow();
    expect(() => new StreamReader(byteChunks(bigEndian, 3), { encoding: 'not-an-encoding' })).toThrow();
  });

  it('has a deterministic document lifecycle and stays exhausted', () => {
    const reader = new StreamReaderSync('<root/>');

    expect(reader.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(reader.eventType()).toBe(XmlEventType.START_DOCUMENT);
    expect(reader.next()).toBe(XmlEventType.START_ELEMENT);
    expect(reader.name()).toBe('root');
    expect(reader.next()).toBe(XmlEventType.END_ELEMENT);
    expect(reader.name()).toBe('root');
    expect(reader.next()).toBe(XmlEventType.END_DOCUMENT);
    expect(reader.next()).toBeNull();
    expect(reader.next()).toBeNull();
  });

  it('preserves whitespace and mixed content', () => {
    expect(collectSync('<root> before <b/> after </root>')).toEqual([
      [XmlEventType.START_DOCUMENT],
      [XmlEventType.START_ELEMENT, 'root', 'root', '', '', []],
      [XmlEventType.CHARACTERS, ' before '],
      [XmlEventType.START_ELEMENT, 'b', 'b', '', '', []],
      [XmlEventType.END_ELEMENT, 'b', 'b', '', ''],
      [XmlEventType.CHARACTERS, ' after '],
      [XmlEventType.END_ELEMENT, 'root', 'root', '', ''],
      [XmlEventType.END_DOCUMENT],
    ]);
  });

  it('resolves inherited namespaces and leaves unprefixed attributes unqualified', () => {
    const reader = new StreamReaderSync(
      '<r xmlns="urn:default" xmlns:p="urn:p"><p:item id="1" p:id="2"/></r>',
    );

    while (reader.next() !== null) {
      if (reader.eventType() !== XmlEventType.START_ELEMENT || reader.name() !== 'p:item') continue;
      expect(reader.localName()).toBe('item');
      expect(reader.prefix()).toBe('p');
      expect(reader.namespaceURI()).toBe('urn:p');
      expect(reader.attributeValue('id')).toBe('1');
      expect(reader.attributeNamespaceURI(0)).toBe('');
      expect(reader.attributeValue('p:id')).toBe('2');
      expect(reader.attributeNamespaceURI(1)).toBe('urn:p');
      expect(reader.namespaceURIForPrefix('')).toBe('urn:default');
      expect(reader.namespaceURIForPrefix('p')).toBe('urn:p');
      return;
    }
    throw new Error('missing p:item start element');
  });

  it('can disable namespace processing for raw qualified-name workloads', async () => {
    const xml = '<r xmlns="urn:default" xmlns:p="urn:p"><p:item id="1" p:id="2"/></r>';
    const options = { namespaceAware: false };
    const expected = [
      [XmlEventType.START_DOCUMENT],
      [XmlEventType.START_ELEMENT, 'r', 'r', '', '', [
        ['xmlns', 'xmlns', '', '', 'urn:default'],
        ['xmlns:p', 'p', 'xmlns', '', 'urn:p'],
      ]],
      [XmlEventType.START_ELEMENT, 'p:item', 'item', 'p', '', [
        ['id', 'id', '', '', '1'],
        ['p:id', 'id', 'p', '', '2'],
      ]],
      [XmlEventType.END_ELEMENT, 'p:item', 'item', 'p', ''],
      [XmlEventType.END_ELEMENT, 'r', 'r', '', ''],
      [XmlEventType.END_DOCUMENT],
    ];

    expect(collectSync(xml, options)).toEqual(expected);
    expect(await collectAsync(asyncChunks(xml), options)).toEqual(expected);
    expect([...new EventReaderSync(xml, options)].map(eventToken)).toEqual(expected);

    const asyncEvents: unknown[][] = [];
    for await (const event of new EventReader(asyncChunks(xml), options)) asyncEvents.push(eventToken(event));
    expect(asyncEvents).toEqual(expected);

    const reader = new StreamReaderSync(xml, options);
    while (reader.next() !== XmlEventType.START_ELEMENT || reader.name() !== 'p:item') { /* advance */ }
    expect(reader.namespaceURIForPrefix('p')).toBe('');
    expect(reader.namespaceURIForPrefix('xml')).toBe('');
    expect(collectSync('<p:raw/>', options)).toContainEqual([
      XmlEventType.START_ELEMENT, 'p:raw', 'raw', 'p', '', [],
    ]);
    expect(() => collectSync('<p:raw/>')).toThrow(/undeclared namespace prefix/i);
  });

  it('decodes predefined and numeric character references', () => {
    expect(collectSync('<r a="&quot;&#65;&#x42;">&lt;&amp;&gt;&#x1F600;</r>')).toContainEqual([
      XmlEventType.CHARACTERS,
      '<&>😀',
    ]);
    const reader = new StreamReaderSync('<r a="&quot;&#65;&#x42;"/>');
    while (reader.next() !== XmlEventType.START_ELEMENT) { /* advance */ }
    expect(reader.attributeValue(0)).toBe('"AB');
  });

  it('decodes numeric references once and leaves CDATA literal', () => {
    expect(collectSync('<mi>&#x398;&#920;&amp;#x398;<![CDATA[&#x398;]]></mi>')).toEqual([
      [XmlEventType.START_DOCUMENT],
      [XmlEventType.START_ELEMENT, 'mi', 'mi', '', '', []],
      [XmlEventType.CHARACTERS, 'ΘΘ&#x398;'],
      [XmlEventType.CDATA, '&#x398;'],
      [XmlEventType.END_ELEMENT, 'mi', 'mi', '', ''],
      [XmlEventType.END_DOCUMENT],
    ]);

    const reader = new StreamReaderSync('<root title="&#x398;"/>');
    while (reader.next() !== XmlEventType.START_ELEMENT) { /* advance */ }
    expect(reader.attributeValue('title')).toBe('Θ');
  });

  it('can preserve raw entity spelling while still validating references', async () => {
    const xml = '<r a="&#x398;&product;">&#920;&product;&amp;product;<![CDATA[&product;]]></r>';
    const options = {
      autoDecodeEntities: false,
      addEntities: [{ entity: 'product', value: 'StAX-XML' }],
    };
    const expected = [
      [XmlEventType.START_DOCUMENT],
      [XmlEventType.START_ELEMENT, 'r', 'r', '', '', [
        ['a', 'a', '', '', '&#x398;&product;'],
      ]],
      [XmlEventType.CHARACTERS, '&#920;&product;&amp;product;'],
      [XmlEventType.CDATA, '&product;'],
      [XmlEventType.END_ELEMENT, 'r', 'r', '', ''],
      [XmlEventType.END_DOCUMENT],
    ];

    expect(collectSync(xml, options)).toEqual(expected);
    await expect(collectAsync(asyncChunks(xml), options)).resolves.toEqual(expected);
    expect(collectSync('<r xmlns:p="urn:&product;"><p:x/></r>', options)).toContainEqual([
      XmlEventType.START_ELEMENT, 'p:x', 'x', 'p', 'urn:StAX-XML', [],
    ]);
    expect(collectSync('<r xmlns:p="urn:&product;"/>', { ...options, namespaceAware: false }))
      .toContainEqual([
        XmlEventType.START_ELEMENT, 'r', 'r', '', '', [
          ['xmlns:p', 'p', 'xmlns', '', 'urn:&product;'],
        ],
      ]);
    expect(() => collectSync('<r>&unknown;</r>', { autoDecodeEntities: false })).toThrow(/unknown|entity/i);
    expect(() => collectSync('<r>&#0;</r>', { autoDecodeEntities: false })).toThrow(/unknown|invalid|entity/i);
  });

  it('uses trusted custom entities without recursive expansion or DTD processing', async () => {
    const xml = '<r a="&product;">&product;&amp;product;<![CDATA[&product;]]></r>';
    const options = { addEntities: [{ entity: '&product;', value: 'StAX & XML' }] };
    const expected = [
      [XmlEventType.START_DOCUMENT],
      [XmlEventType.START_ELEMENT, 'r', 'r', '', '', [
        ['a', 'a', '', '', 'StAX & XML'],
      ]],
      [XmlEventType.CHARACTERS, 'StAX & XML&product;'],
      [XmlEventType.CDATA, '&product;'],
      [XmlEventType.END_ELEMENT, 'r', 'r', '', ''],
      [XmlEventType.END_DOCUMENT],
    ];

    expect(collectSync(xml, options)).toEqual(expected);
    await expect(collectAsync(asyncChunks(xml), options)).resolves.toEqual(expected);
  });

  it('validates custom entity definitions eagerly', () => {
    expect(() => new StreamReaderSync('<r/>', {
      addEntities: [{ entity: 'bad name', value: 'x' }],
    })).toThrow(/invalid custom entity name/i);
    expect(() => new StreamReaderSync('<r/>', {
      addEntities: [{ entity: 'amp', value: 'override' }],
    })).toThrow(/predefined/i);
    expect(() => new StreamReaderSync('<r/>', {
      addEntities: [{ entity: 'copy', value: '©' }, { entity: '&copy;', value: 'duplicate' }],
    })).toThrow(/duplicate/i);
    expect(() => new StreamReaderSync('<r/>', {
      addEntities: [{ entity: 'bad', value: '\0' }],
    })).toThrow(/invalid XML character/i);
    expect(() => collectSync('<r a="&markup;"/>', {
      addEntities: [{ entity: 'markup', value: '<' }],
    })).toThrow(/attribute/i);
  });

  it('rejects unknown entities instead of performing external I/O', () => {
    expect(() => collectSync('<r>&unknown;</r>')).toThrow(/unknown|entity/i);
  });

  it('defaults to fragment mode and enforces document mode when requested', () => {
    expect(collectSync('<a/>tail<b/>')).toContainEqual([
      XmlEventType.CHARACTERS,
      'tail',
    ]);
    expect(() => collectSync('<a/><b/>', { documentMode: 'document' })).toThrow();
    expect(() => collectSync('<a/>tail', { documentMode: 'document' })).toThrow();
  });

  it('produces the same tokens for strings, bytes, and every-byte chunking', () => {
    const xml = '<!DOCTYPE r [<!ELEMENT r ANY>]><!--note--><?work now?><r xmlns:p="u"><p:x a="&amp;😀"> one <![CDATA[<two>]]></p:x></r>';
    expect(collectSync(encoder.encode(xml))).toEqual(collectSync(xml));
    expect(collectSync(chunks(xml))).toEqual(collectSync(xml));
  });

  it('treats one leading BOM identically for strings and decoded bytes', async () => {
    const xml = '\uFEFF<?xml version="1.0"?><root xml:lang="en"/>';
    const expected = collectSync(xml);
    expect(collectSync(encoder.encode(xml))).toEqual(expected);
    expect(collectSync(chunks(xml))).toEqual(expected);
    expect(await collectAsync(asyncChunks(xml))).toEqual(expected);
    expect(expected).not.toContainEqual([XmlEventType.CHARACTERS, '\uFEFF']);
  });

  it('resolves the predefined xml namespace without a declaration', () => {
    const reader = new StreamReaderSync('<root xml:lang="en"/>');
    while (reader.next() !== XmlEventType.START_ELEMENT) { /* advance */ }
    expect(reader.attributeNamespaceURI(0)).toBe('http://www.w3.org/XML/1998/namespace');
  });

  it('rejects duplicate expanded attribute names on narrow and wide tags', () => {
    expect(() => collectSync('<r xmlns:a="u" xmlns:b="u" a:x="1" b:x="2"/>')).toThrow(/duplicate/i);
    const attributes = Array.from({ length: 17 }, (_, index) => `a:x${index}="${index}"`);
    attributes.push('b:x0="duplicate"');
    expect(() => collectSync(`<r xmlns:a="u" xmlns:b="u" ${attributes.join(' ')}/>`)).toThrow(/duplicate/i);
  });

  it('decodes entity references split at every byte boundary', async () => {
    const xml = '<r a="A&amp;&#x42;">&lt;&#65;&#x1F600;&gt;</r>';
    const expected = collectSync(xml);

    expect(collectSync(chunks(xml))).toEqual(expected);
    expect(await collectAsync(asyncChunks(xml))).toEqual(expected);
  });

  it('accepts a large non-ASCII string without changing token semantics', () => {
    const text = '한글😀é'.repeat(4_096);
    const xml = `<root>${text}</root>`;
    expect(collectSync(xml)).toEqual(collectSync(encoder.encode(xml)));
  });

  it('scans string input without requiring TextEncoder', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'TextEncoder');
    Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: undefined });
    try {
      expect(collectSync('<root>한글😀</root>')).toContainEqual([XmlEventType.CHARACTERS, '한글😀']);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'TextEncoder', descriptor);
    }
  });

  it('exposes comment, processing-instruction, and DTD tokens without DOM buffering', () => {
    const tokens = collectSync('<!DOCTYPE root [<!ELEMENT root ANY>]><!--note--><?work now?><root/>');
    expect(tokens).toContainEqual([XmlEventType.COMMENT, 'note']);
    expect(tokens).toContainEqual([XmlEventType.PROCESSING_INSTRUCTION, 'work', 'now']);
    expect(tokens).toContainEqual([XmlEventType.DTD, 'DOCTYPE root [<!ELEMENT root ANY>]']);
  });

  it('restores namespace bindings after a nested shadowing scope', () => {
    const reader = new StreamReaderSync(
      '<r xmlns="urn:outer" xmlns:p="urn:p0"><p:a><b xmlns="urn:inner" xmlns:p="urn:p1"><p:c p:x="1" x="2"/></b><p:d/></p:a></r>',
    );
    const starts = new Map<string, {
      uri: string;
      defaultURI: string;
      pURI: string;
      qualifiedAttributeURI?: string;
      unqualifiedAttributeURI?: string;
      qualifiedAttributeValue?: string;
      unqualifiedAttributeValue?: string;
    }>();

    while (reader.next() !== null) {
      if (reader.eventType() !== XmlEventType.START_ELEMENT) continue;
      const name = reader.name()!;
      starts.set(name, {
        uri: reader.namespaceURI(),
        defaultURI: reader.namespaceURIForPrefix(''),
        pURI: reader.namespaceURIForPrefix('p'),
        qualifiedAttributeURI: name === 'p:c' ? reader.attributeNamespaceURI(0) : undefined,
        unqualifiedAttributeURI: name === 'p:c' ? reader.attributeNamespaceURI(1) : undefined,
        qualifiedAttributeValue: name === 'p:c' ? reader.attributeValue('urn:p1', 'x') : undefined,
        unqualifiedAttributeValue: name === 'p:c' ? reader.attributeValue('', 'x') : undefined,
      });
    }

    expect(starts.get('b')).toMatchObject({ uri: 'urn:inner', defaultURI: 'urn:inner', pURI: 'urn:p1' });
    expect(starts.get('p:c')).toEqual({
      uri: 'urn:p1',
      defaultURI: 'urn:inner',
      pURI: 'urn:p1',
      qualifiedAttributeURI: 'urn:p1',
      unqualifiedAttributeURI: '',
      qualifiedAttributeValue: '1',
      unqualifiedAttributeValue: '2',
    });
    expect(starts.get('p:d')).toMatchObject({ uri: 'urn:p0', defaultURI: 'urn:outer', pURI: 'urn:p0' });
  });

  it('uses a self-closing element binding for both events and restores its sibling scope', () => {
    const reader = new StreamReaderSync(
      '<root xmlns:p="urn:outer"><p:item xmlns:p="urn:inner"/><p:item/></root>',
    );
    const itemEvents: Array<[string, string, string]> = [];

    while (reader.next() !== null) {
      if ((reader.eventType() === XmlEventType.START_ELEMENT || reader.eventType() === XmlEventType.END_ELEMENT)
        && reader.name() === 'p:item') {
        itemEvents.push([reader.eventType(), reader.namespaceURI(), reader.namespaceURIForPrefix('p')]);
      }
    }

    expect(itemEvents).toEqual([
      [XmlEventType.START_ELEMENT, 'urn:inner', 'urn:inner'],
      [XmlEventType.END_ELEMENT, 'urn:inner', 'urn:inner'],
      [XmlEventType.START_ELEMENT, 'urn:outer', 'urn:outer'],
      [XmlEventType.END_ELEMENT, 'urn:outer', 'urn:outer'],
    ]);
  });

  it('exhausts 1,000 nested unique namespace-prefix scopes correctly', () => {
    const depth = 1_000;
    const starts = Array.from(
      { length: depth },
      (_, index) => `<p${index}:item xmlns:p${index}="urn:${index}">`,
    );
    const ends = Array.from(
      { length: depth },
      (_, offset) => `</p${depth - offset - 1}:item>`,
    );
    const reader = new StreamReaderSync(`<root>${starts.join('')}${ends.join('')}</root>`);
    let startIndex = 0;
    let endIndex = depth - 1;

    while (reader.next() !== null) {
      if (reader.name() === 'root') continue;
      if (reader.eventType() === XmlEventType.START_ELEMENT) {
        expect(reader.name()).toBe(`p${startIndex}:item`);
        expect(reader.namespaceURI()).toBe(`urn:${startIndex}`);
        expect(reader.namespaceURIForPrefix(`p${startIndex}`)).toBe(`urn:${startIndex}`);
        startIndex++;
      } else if (reader.eventType() === XmlEventType.END_ELEMENT) {
        expect(reader.name()).toBe(`p${endIndex}:item`);
        expect(reader.namespaceURI()).toBe(`urn:${endIndex}`);
        expect(reader.namespaceURIForPrefix(`p${endIndex}`)).toBe(`urn:${endIndex}`);
        endIndex--;
      }
    }

    expect({ startIndex, endIndex }).toEqual({ startIndex: depth, endIndex: -1 });
  });

  it.each([64, 256])('accepts %i unique attributes including a final hash collision', (count) => {
    // These two valid names collide under the reader's current 32-bit name hash.
    // They must still be distinguished by their complete public names.
    const names = Array.from({ length: count }, (_, index) => `a${index}`);
    names[count - 2] = 'aahorqvqp';
    names[count - 1] = 'aupstazkt';
    const attributes = names.map((name, index) => `${name}="${index}"`).join(' ');
    const reader = new StreamReaderSync(`<root ${attributes}/>`);

    while (reader.next() !== XmlEventType.START_ELEMENT) { /* advance */ }

    expect(reader.attributeCount()).toBe(count);
    for (let index = 0; index < count; index++) {
      expect(reader.attributeName(index)).toBe(names[index]);
      expect(reader.attributeValue(index)).toBe(String(index));
      expect(reader.attributeValue(names[index]!)).toBe(String(index));
    }
    while (reader.next() !== null) { /* exhaust */ }
  });

  it.each([64, 256])('rejects a duplicate attribute in the final slot of %i attributes', (count) => {
    const names = Array.from({ length: count }, (_, index) => `a${index}`);
    names[count - 1] = names[0]!;
    const attributes = names.map((name, index) => `${name}="${index}"`).join(' ');

    expect(() => collectSync(`<root ${attributes}/>`)).toThrow(/duplicate|attribute/i);
  });

  it.each([
    ['mismatched closing tag', '<r><x></r>'],
    ['unclosed element', '<r><x></x>'],
    ['unterminated start tag', '<r'],
    ['unterminated comment', '<!-- note'],
    ['invalid leading name character', '<1root/>'],
    ['multiple namespace separators', '<a:b:c xmlns:a="urn:a"/>'],
    ['empty namespace prefix', '<:r/>'],
    ['empty local name', '<p: xmlns:p="urn:p"/>'],
    ['duplicate attributes', '<r a="1" a="2"/>'],
    ['undeclared namespace prefix', '<p:r/>'],
    ['unterminated entity', '<r>bare & value</r>'],
    ['attribute containing markup', '<r a="bad<value"/>'],
    ['invalid namespace binding for xml', '<r xmlns:xml="urn:bad"/>'],
    ['reserved XML URI on another prefix', '<r xmlns:p="http://www.w3.org/XML/1998/namespace"/>'],
    ['reserved xmlns prefix', '<r xmlns:xmlns="urn:bad"/>'],
    ['reserved xmlns namespace URI', '<r xmlns:p="http://www.w3.org/2000/xmlns/"/>'],
    ['prefixed namespace undeclaration', '<r xmlns:p=""/>'],
    ['invalid PI target', '<?1bad?><r/>'],
    ['reserved uppercase XML PI target', '<?XML version="1.0"?><r/>'],
    ['misplaced XML declaration', '<r><?xml version="1.0"?></r>'],
    ['invalid XML declaration', '<?xml?><r/>'],
    ['unsupported XML 1.1 declaration', '<?xml version="1.1"?><r/>'],
    ['comment containing internal double hyphen', '<!--a--b--><r/>'],
    ['repeated DOCTYPE', '<!DOCTYPE r><!DOCTYPE r><r/>'],
    ['misplaced DOCTYPE', '<r/><!DOCTYPE r>'],
    ['DOCTYPE root mismatch', '<!DOCTYPE expected><actual/>'],
    ['whitespace after end-tag opener', '<r></ r>'],
  ])('rejects malformed XML: %s', async (_label, xml) => {
    expect(() => collectSync(xml)).toThrow();
    expect(() => collectSync(encoder.encode(xml))).toThrow();
    expect(() => collectSync(chunks(xml))).toThrow();
    await expect(collectAsync(asyncChunks(xml))).rejects.toThrow();
  });

  it('keeps previously returned strings valid after advancing', () => {
    const reader = new StreamReaderSync('<root><first attr="value">text</first></root>');
    while (reader.next() !== XmlEventType.START_ELEMENT || reader.name() !== 'first') { /* advance */ }
    const name = reader.name();
    const value = reader.attributeValue(0);
    while (reader.next() !== null) { /* exhaust */ }
    expect([name, value]).toEqual(['first', 'value']);
  });
});

describe('v1 sync/async parity and async lifecycle', () => {
  it('rejects invalid sync iterable chunks before batching and closes the source', () => {
    let closed = false;
    function* invalidChunks(): Generator<Uint8Array | string> {
      try {
        yield encoder.encode('<root>');
        yield 'not bytes';
      } finally {
        closed = true;
      }
    }

    const reader = new StreamReaderSync(invalidChunks() as Iterable<Uint8Array>);
    expect(() => {
      while (reader.next() !== null) { /* exhaust */ }
    }).toThrow('Reader chunks must be Uint8Array values.');
    expect(closed).toBe(true);
  });

  it('produces identical current tokens across sync and async readers', async () => {
    const xml = '<r> a <x n="1"/> b </r>';
    expect(await collectAsync(asyncChunks(xml))).toEqual(collectSync(xml));
  });

  it('pulls at most one input chunk per pending read', async () => {
    let pulls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const source = async function* (): AsyncGenerator<Uint8Array> {
      pulls++;
      yield encoder.encode('<root');
      await gate;
      pulls++;
      yield encoder.encode('/>');
    };
    const reader = new StreamReader(source());
    expect(await reader.next()).toBe(XmlEventType.START_DOCUMENT);
    const pending = reader.next();
    await Promise.resolve();
    expect(pulls).toBe(1);
    release();
    expect(await pending).toBe(XmlEventType.START_ELEMENT);
  });

  it('rejects concurrent next calls', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    async function* source(): AsyncGenerator<Uint8Array> {
      await gate;
      yield encoder.encode('<root/>');
    }
    const reader = new StreamReader(source());
    expect(await reader.next()).toBe(XmlEventType.START_DOCUMENT);
    const first = reader.next();
    await expect(reader.next()).rejects.toThrow(/concurrent|pending|progress/i);
    release();
    await first;
  });

  it('cancels the input iterator when closed early', async () => {
    let returned = false;
    async function* source(): AsyncGenerator<Uint8Array> {
      try {
        yield encoder.encode('<root>');
        yield encoder.encode('<child/>');
        yield encoder.encode('</root>');
      } finally {
        returned = true;
      }
    }
    const reader = new StreamReader(source());
    await reader.next();
    await reader.next();
    await reader.close();
    expect(returned).toBe(true);
    expect(await reader.next()).toBeNull();
  });

  it('closes an async source exactly once after a parse error', async () => {
    let returned = 0;
    async function* source(): AsyncGenerator<Uint8Array> {
      try { yield encoder.encode('<root></wrong>'); }
      finally { returned++; }
    }
    const reader = new StreamReader(source());
    await reader.next();
    await reader.next();

    await expect(reader.next()).rejects.toThrow(/mismatched/i);
    await reader.close();
    expect(returned).toBe(1);
    expect(await reader.next()).toBeNull();
  });

  it('closes an async source after a UTF-8 decode error', async () => {
    let returned = false;
    async function* source(): AsyncGenerator<Uint8Array> {
      try { yield new Uint8Array([0xff]); }
      finally { returned = true; }
    }
    const reader = new StreamReader(source());
    await reader.next();

    await expect(reader.next()).rejects.toThrow();
    expect(returned).toBe(true);
  });

  it('cancels a pending ReadableStream read exactly once', async () => {
    let cancels = 0;
    const source = new ReadableStream<Uint8Array>({
      cancel() { cancels++; },
    });
    const reader = new StreamReader(source);
    await reader.next();
    const pending = reader.next();

    await Promise.all([reader.close(), reader.close()]);
    await expect(pending).resolves.toBeNull();
    expect(cancels).toBe(1);
  });
});

describe('v1 event reader contract', () => {
  it('accepts strings and byte chunks with identical sync results', () => {
    const xml = '<root> text <child id="1"/></root>';
    expect(Array.from(new EventReaderSync(chunks(xml)))).toEqual(Array.from(new EventReaderSync(xml)));
  });

  it('closes a sync source exactly once on return and parse error', () => {
    let earlyReturns = 0;
    function* earlySource(): Generator<Uint8Array> {
      try { yield encoder.encode('<root><child/></root>'); }
      finally { earlyReturns++; }
    }
    const early = new EventReaderSync(earlySource());
    early.next();
    early.next();
    early.return();
    early.return();
    expect(earlyReturns).toBe(1);

    let errorReturns = 0;
    function* invalidSource(): Generator<Uint8Array> {
      try { yield encoder.encode('<root></wrong>'); }
      finally { errorReturns++; }
    }
    const invalid = new EventReaderSync(invalidSource());
    invalid.next();
    invalid.next();
    expect(() => invalid.next()).toThrow(/mismatched/i);
    expect(errorReturns).toBe(1);
  });

  it('materializes stable sync events', () => {
    const reader = new EventReaderSync('<root><item id="1">one</item><item id="2">two</item></root>');
    const events = Array.from(reader);
    const firstItem = events.find((event) => event.type === XmlEventType.START_ELEMENT && event.name === 'item');
    const firstText = events.find((event) => event.type === XmlEventType.CHARACTERS);

    expect(firstItem).toMatchObject({
      type: XmlEventType.START_ELEMENT,
      name: 'item',
      localName: 'item',
      attributes: [{ name: 'id', localName: 'id', value: '1' }],
    });
    expect(firstText).toMatchObject({ type: XmlEventType.CHARACTERS, value: 'one' });
  });

  it('materializes comment, processing-instruction, and DTD payloads', () => {
    const events = Array.from(new EventReaderSync('<!DOCTYPE root><!--note--><?work now?><root/>'));

    expect(events).toContainEqual({ type: XmlEventType.DTD, value: 'DOCTYPE root' });
    expect(events).toContainEqual({ type: XmlEventType.COMMENT, value: 'note' });
    expect(events).toContainEqual({ type: XmlEventType.PROCESSING_INSTRUCTION, target: 'work', data: 'now' });
  });

  it('keeps sync and async event shapes equivalent across chunk boundaries', async () => {
    const xml = '<r xmlns:p="u"><p:x id="1"/> text </r>';
    const syncEvents = Array.from(new EventReaderSync(chunks(xml)));
    const asyncEvents = [];
    for await (const event of new EventReader(asyncChunks(xml))) asyncEvents.push(event);
    expect(asyncEvents).toEqual(syncEvents);
  });

  it('matches StreamReader tokens without reading beyond the same async source', async () => {
    const xml = '<!DOCTYPE r><!--note--><?work now?><r xmlns:p="u"><p:x id="&amp;"/> text </r>';
    const streamTokens = await collectAsync(asyncChunks(xml));
    const eventTokens: unknown[][] = [];

    for await (const event of new EventReader(asyncChunks(xml))) eventTokens.push(eventToken(event));

    expect(eventTokens).toEqual(streamTokens);
  });

  it('rejects concurrent EventReader next calls', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    async function* source(): AsyncGenerator<Uint8Array> {
      await gate;
      yield encoder.encode('<root/>');
    }
    const reader = new EventReader(source());
    expect((await reader.next()).value).toEqual({ type: XmlEventType.START_DOCUMENT });

    const first = reader.next();
    await expect(reader.next()).rejects.toThrow(/concurrent|pending|progress/i);
    release();
    await expect(first).resolves.toMatchObject({ done: false, value: { type: XmlEventType.START_ELEMENT, name: 'root' } });
  });

  it('cancels the EventReader source when iteration returns early', async () => {
    let returned = false;
    async function* source(): AsyncGenerator<Uint8Array> {
      try {
        yield encoder.encode('<root>');
        yield encoder.encode('<child/>');
        yield encoder.encode('</root>');
      } finally {
        returned = true;
      }
    }
    const reader = new EventReader(source());
    await reader.next();
    await reader.next();

    await expect(reader.return()).resolves.toEqual({ value: undefined, done: true });
    expect(returned).toBe(true);
    await expect(reader.next()).resolves.toEqual({ value: undefined, done: true });
  });

  it('exposes idempotent close methods on both event readers', async () => {
    const sync = new EventReaderSync('<root/>');
    sync.next();
    sync.close();
    sync.close();
    expect(sync.next()).toEqual({ value: undefined, done: true });

    const asyncReader = new EventReader(asyncChunks('<root/>'));
    await asyncReader.next();
    await Promise.all([asyncReader.close(), asyncReader.close()]);
    await expect(asyncReader.next()).resolves.toEqual({ value: undefined, done: true });
  });

  it('does not read ahead while buffered EventReader events remain', async () => {
    let pulls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    async function* source(): AsyncGenerator<Uint8Array> {
      pulls++;
      yield encoder.encode('<root><child/>');
      await gate;
      pulls++;
      yield encoder.encode('</root>');
    }
    const reader = new EventReader(source());

    expect((await reader.next()).value).toEqual({ type: XmlEventType.START_DOCUMENT });
    expect(pulls).toBe(0);
    expect((await reader.next()).value).toMatchObject({ type: XmlEventType.START_ELEMENT, name: 'root' });
    expect((await reader.next()).value).toMatchObject({ type: XmlEventType.START_ELEMENT, name: 'child' });
    expect((await reader.next()).value).toMatchObject({ type: XmlEventType.END_ELEMENT, name: 'child' });
    expect(pulls).toBe(1);

    const pending = reader.next();
    await Promise.resolve();
    expect(pulls).toBe(1);
    release();
    await expect(pending).resolves.toMatchObject({ done: false, value: { type: XmlEventType.END_ELEMENT, name: 'root' } });
    expect(pulls).toBe(2);
  });

  it('keeps prior async IteratorResult events and attributes stable after advancing', async () => {
    const reader = new EventReader(asyncChunks('<root><item id="1">one</item><item id="2">two</item></root>'));
    let saved!: IteratorYieldResult<AnyXmlEvent>;

    while (true) {
      const result = await reader.next();
      if (result.done) throw new Error('missing first item');
      if (result.value.type === XmlEventType.START_ELEMENT && result.value.name === 'item') {
        saved = result;
        break;
      }
    }
    const event = saved.value;
    if (event.type !== XmlEventType.START_ELEMENT) throw new Error('expected start element');
    const attributes = event.attributes;
    const attribute = attributes[0];

    while (!(await reader.next()).done) { /* exhaust */ }

    expect(saved).toEqual({
      done: false,
      value: {
        type: XmlEventType.START_ELEMENT,
        name: 'item',
        localName: 'item',
        prefix: '',
        namespaceURI: '',
        attributes: [{ name: 'id', localName: 'id', prefix: '', namespaceURI: '', value: '1' }],
      },
    });
    expect(event.attributes).toBe(attributes);
    expect(event.attributes[0]).toBe(attribute);
  });
});
