import { describe, expect, it } from 'vitest';

import { NEED_INPUT, TokenCursor, XmlEventType } from '@stax-xml/core';

function collect(xml: string, chunkSize?: number): unknown[][] {
  const cursor = chunkSize === undefined
    ? new TokenCursor(xml, true)
    : new TokenCursor('', false);
  const tokens: unknown[][] = [];
  let offset = 0;

  while (true) {
    const type = cursor.next();
    if (type === NEED_INPUT) {
      if (chunkSize === undefined || offset >= xml.length) throw new Error('cursor requested unexpected input');
      const chunk = xml.slice(offset, offset + chunkSize);
      offset += chunk.length;
      cursor.push(chunk, offset === xml.length);
      continue;
    }
    if (type === null) return tokens;

    if (type === XmlEventType.START_ELEMENT) {
      tokens.push([
        type,
        cursor.name(),
        Array.from({ length: cursor.attributeCount() }, (_, index) => [
          cursor.attribute(index)?.name,
          cursor.attribute(index)?.value,
        ]),
      ]);
    } else if (type === XmlEventType.END_ELEMENT) {
      tokens.push([type, cursor.name()]);
    } else if (type === XmlEventType.PROCESSING_INSTRUCTION) {
      tokens.push([type, cursor.name(), cursor.text()]);
    } else if (type === XmlEventType.CHARACTERS
      || type === XmlEventType.COMMENT
      || type === XmlEventType.CDATA
      || type === XmlEventType.DTD) {
      tokens.push([type, cursor.text()]);
    } else {
      tokens.push([type]);
    }
  }
}

describe('TokenCursor resumable token scans', () => {
  it('matches complete input when long tokens cross one-code-unit chunks', () => {
    const payload = 'x'.repeat(16_384);
    const dtdPadding = ' '.repeat(16_384);
    const startPadding = ' '.repeat(16_384);
    const xml = `<!DOCTYPE root [${dtdPadding}]><?work ${payload}?><root value="${payload}">${payload}<!--${payload}--><![CDATA[${payload}]]><child${startPadding}/></root>`;
    const expected = collect(xml);

    expect(collect(xml, 1)).toEqual(expected);
    expect(expected).toContainEqual([XmlEventType.PROCESSING_INSTRUCTION, 'work', payload]);
    expect(expected).toContainEqual([XmlEventType.START_ELEMENT, 'root', [['value', payload]]]);
    expect(expected).toContainEqual([XmlEventType.CHARACTERS, payload]);
    expect(expected).toContainEqual([XmlEventType.COMMENT, payload]);
    expect(expected).toContainEqual([XmlEventType.CDATA, payload]);
    expect(expected).toContainEqual([XmlEventType.DTD, `DOCTYPE root [${dtdPadding}]`]);
    expect(expected).toContainEqual([XmlEventType.START_ELEMENT, 'child', []]);
  });

  it('ignores quotes and brackets inside incrementally scanned DOCTYPE comments', () => {
    const xml = `<!DOCTYPE foo [
      <!ELEMENT foo ANY>
      <!-- can't let [ or ] affect the subset, and we'll keep scanning -->
    ]><foo/>`;

    expect(collect(xml, 1)).toEqual(collect(xml));
    expect(collect(xml)).toContainEqual([
      XmlEventType.DTD,
      `DOCTYPE foo [
      <!ELEMENT foo ANY>
      <!-- can't let [ or ] affect the subset, and we'll keep scanning -->
    ]`,
    ]);
  });

  it('keeps strict entity and character validation across every chunk size', () => {
    const xml = '<root value="A&amp;&#x42;">before&amp;&#67;after</root>';
    const expected = collect(xml);
    for (let chunkSize = 1; chunkSize <= xml.length; chunkSize++) {
      expect(collect(xml, chunkSize)).toEqual(expected);
    }

    for (const invalid of ['<r a="&broken"/>', '<r>&broken</r>', '<r a="&#0;"/>', '<r>&#xFFFF;</r>']) {
      expect(() => collect(invalid)).toThrow(/entity/i);
      expect(() => collect(invalid, 1)).toThrow(/entity/i);
    }
  });

  it.each(['<r a="1"b="2"/>', '<r / >', '<r>]]></r>'])('rejects malformed XML in complete and chunked input: %s', (xml) => {
    expect(() => collect(xml)).toThrow();
    expect(() => collect(xml, 1)).toThrow();
  });
});

describe('TokenCursor XML character checks', () => {
  it.each([
    ['text', '<r>\u0000</r>'],
    ['attribute', '<r value="\u0000"/>'],
    ['processing instruction', '<?work \u0000?><r/>'],
    ['comment', '<!--\u0000--><r/>'],
    ['CDATA', '<r><![CDATA[\u0000]]></r>'],
    ['DOCTYPE', '<!DOCTYPE r [\u0000]><r/>'],
    ['unpaired surrogate', '<r>\ud800</r>'],
  ])('rejects forbidden characters in %s', (_label, xml) => {
    expect(() => collect(xml)).toThrow(/invalid XML character/i);
  });

  it.each(['<r>&#1;</r>', '<r>&#xFFFF;</r>', '<r>&#12x;</r>', '<r>&#x1g;</r>', '<r>&#X58;</r>'])('rejects invalid character references', (xml) => {
    expect(() => collect(xml)).toThrow(/invalid entity/i);
  });

  it('allows only literal XML whitespace outside the document element', () => {
    const collectDocument = (xml: string) => {
      const cursor = new TokenCursor(xml, true, { documentMode: 'document' });
      while (cursor.next() !== null) { /* consume */ }
    };
    expect(() => collectDocument(' \t\r\n<r/>')).not.toThrow();
    expect(() => collectDocument('&#x20;<r/>')).toThrow(/outside the root element/i);
    expect(() => collectDocument('<r/>&#xA;')).toThrow(/outside the root element/i);
  });
});
