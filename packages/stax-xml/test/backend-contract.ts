import assert from 'node:assert/strict';
import {
  NEED_INPUT, jsTokenBackendFactory,
  type TokenBackendFactory, type TokenCursorSpi, type TokenCursorOptions,
} from '../src/experimental/backend.js';

export const contractDocuments = [
  '', '<r/>', 'outside<a/><b/>tail', '\uFEFF<?xml version="1.0" encoding="UTF-8" standalone="yes"?><r/>',
  '<r a="A&amp;&#x42;" b="&#10;&#x1F600;">before&amp;&#67;after</r>',
  '<r xmlns="urn:r" xmlns:p="urn:p" p:a="1"><p:c xmlns:p="urn:inner"/><p:c/><c xmlns=""/></r>',
  '<?work  data \t?><r><!--comment--><![CDATA[a<&]]></r>',
  '<r><?p x?><c/><?p y?></r>',
  '\uFEFF\uFEFF<r/>',
  '<é:根 xmlns:é="urn:é" é:属="한글😀">é한😀</é:根>',
  '<𐀀 a𐀀="ok"/>', '<À/><A‿/><ﷰ/>',
  '<!DOCTYPE r [<!ELEMENT r ANY><!-- can\'t let [ ] matter -->]><r/>',
  '<!DOCTYPE r SYSTEM "a>b"><r/>',
  ...['<X>', '<!X>', '<!-X>', '<!--a-x-->', '<!--a--x-->', '<!--a---x-->'].map(x => `<!DOCTYPE r [${x}]><r/>`),
  '<r a = "x" first="closed" second="open"></r   >',
  '<r xmlns:p="urn:p" p:id="7">&word;</r>',
  `<root>${`<r${Array.from({length:20}, (_, i) => ` a${i}="${i}"`).join('')}/>` .repeat(2)}</root>`,
];
export const invalidDocuments = [
  '<r a="1"b="2"/>', '<r / >', '<r>]]></r>', '<r a="&broken"/>', '<r>&broken</r>',
  '<r a="&#0;"/>', '<r>&#xFFFF;</r>', '<r>&#1;</r>', '<r>&#xD800;</r>',
  '<r>&#1114112;</r>', '<r>&#12x;</r>', '<r>&#x1g;</r>', '<r>&#X58;</r>',
  '<r>\u0000</r>', '<r a="\u0000"/>', '<?p \u0000?><r/>', '<!--\u0000--><r/>',
  '<r><![CDATA[\u0000]]></r>', '<!DOCTYPE r [\u0000]><r/>', '<r>\uFFFF</r>',
  '<r><!--', '<r><![CDATA[', '<r><?p ', '<r></r', '<r a="', '<r /',
  '<!DOCTYPE r [', '<!DOCTYPE ><r/>', '<!ENTITY x "y">',
  '<r a />', '<r a=x/>', '<a:b:c/>', '<r a:b:c="x"/>', '<r 1bad="x"/>',
  '<r a="1" a="2"/>', '<r xmlns:p="u" xmlns:q="u" p:a="1" q:a="2"/>',
  '<p:r/>', '<r p:a="1"/>', '<r><c></r>', '<r><!--a--b--></r>',
  '<r/><?xml version="1.0"?>', '<?XML version="1.0"?><r/>',
  '<̳/>', '<×/>', '<\u{f0000}/>', '<\ufffe/>',
];

export function snapshot(cursor: TokenCursorSpi): unknown {
  return {
    type: cursor.eventType(), name: cursor.name(), text: cursor.text(),
    localName: cursor.localName(), prefix: cursor.prefix(), uri: cursor.namespaceURI(),
    selfClosing: cursor.selfClosing(), declaration: cursor.documentDeclaration(),
    namespaces: ['', 'xml', 'xmlns', 'p', 'é', 'missing'].map(p => cursor.namespaceURIForPrefix(p)),
    attributes: Array.from({length: cursor.attributeCount()}, (_, i) => [
      cursor.attributeName(i), cursor.attributeLocalName(i), cursor.attributePrefix(i),
      cursor.attributeNamespaceURI(i), cursor.attributeValue(i),
    ]),
  };
}

export function collectBytes(factory: TokenBackendFactory, bytes: Uint8Array, cuts: number[], options: TokenCursorOptions = {}): { tokens: unknown[]; error?: string } {
  const tokens: unknown[] = [];
  let session;
  try {
    session = factory.createByteSession({...options, encoding: 'utf-8'});
    let offset = 0;
    let cut = 0;
    let final = false;
    for (;;) {
      const result = session.cursor.next();
      if (result === NEED_INPUT) {
        assert.equal(final, false, 'backend requested input after final');
        const end = cuts[cut++] ?? bytes.length;
        final = end === bytes.length;
        session.pushBytes(bytes.subarray(offset, end), final);
        offset = end;
      } else if (result === null) {
        return {tokens};
      } else {
        const token = snapshot(session.cursor);
        assert.deepEqual(snapshot(session.cursor), token, 'repeated access must be stable');
        tokens.push(token);
      }
    }
  } catch (error) {
    return {tokens, error: error instanceof Error ? error.message : String(error)};
  } finally {
    session?.dispose();
  }
}

function errorCategory(message: string): string {
  if (/encod|utf-?8/i.test(message)) return 'encoding';
  if (/entity/i.test(message)) return 'entity';
  if (/namespace|prefix|expanded attribute/i.test(message)) return 'namespace';
  if (/XML character/i.test(message)) return 'character';
  if (/XML name|instruction target/i.test(message)) return 'name';
  if (/duplicate attribute/i.test(message)) return 'duplicate';
  if (/unterminated|incomplete|unclosed/i.test(message)) return 'incomplete';
  return 'syntax';
}

export function runBackendContract(factory: TokenBackendFactory): void {
  const encoder = new TextEncoder();
  const options: TokenCursorOptions[] = [
    {}, {namespaceAware:false}, {autoDecodeEntities:false},
    {addEntities:[{entity:'word',value:'hello'}]},
  ];
  for (const settings of options) {
    for (const xml of contractDocuments) {
      if (xml.includes('&word;') && !settings.addEntities) continue;
      const bytes = encoder.encode(xml);
      const expected = collectBytes(jsTokenBackendFactory, bytes, [], settings);
      assert.equal(expected.error, undefined, xml);
      for (let split = 0; split <= bytes.length; split++) {
        assert.deepEqual(collectBytes(factory, bytes, [split], settings), expected, `split=${split} XML=${xml}`);
      }
      assert.deepEqual(collectBytes(factory, bytes, Array.from({length:bytes.length}, (_,i)=>i+1), settings), expected, `one-byte XML=${xml}`);
    }
  }
  for (const xml of invalidDocuments) {
    const bytes = encoder.encode(xml);
    const expected = collectBytes(jsTokenBackendFactory, bytes, []);
    assert.ok(expected.error, `invalid oracle XML=${xml}`);
    for (let split = 0; split <= bytes.length; split++) {
      const actual = collectBytes(factory, bytes, [split]);
      assert.ok(actual.error, `accepted invalid split=${split} XML=${xml}`);
      const reference = collectBytes(jsTokenBackendFactory, bytes, [split]);
      assert.equal(errorCategory(actual.error), errorCategory(reference.error!), `failure category split=${split} XML=${xml}: ${actual.error}`);
    }
  }
  for (const xml of ['', '<a/><b/>', 'x<r/>', '<r/>x', '&#x20;<r/>', '<![CDATA[x]]><r/>', '<!DOCTYPE expected><actual/>']) {
    const result = collectBytes(factory, encoder.encode(xml), [], {documentMode:'document'});
    assert.ok(result.error, `accepted invalid document XML=${xml}`);
  }
  const validDocument = encoder.encode(' \t\r\n<r/>');
  assert.deepEqual(collectBytes(factory, validDocument, [1], {documentMode:'document'}), collectBytes(jsTokenBackendFactory, validDocument, [], {documentMode:'document'}));
  for (const bytes of [new Uint8Array([0xc0,0xaf]),new Uint8Array([0xed,0xa0,0x80]),new Uint8Array([0xf4,0x90,0x80,0x80]),new Uint8Array([0xe2,0x82])]) {
    assert.ok(collectBytes(factory, bytes, [1]).error, 'invalid UTF-8 must fail');
  }
  const session = factory.createByteSession({encoding:'utf-8'});
  assert.equal(session.cursor.next(), NEED_INPUT);
  session.pushBytes(encoder.encode('<r>'));
  session.cursor.next(); session.cursor.next();
  session.dispose(); session.dispose();
  assert.equal(session.cursor.next(), null);
  assert.throws(()=>session.pushBytes(encoder.encode('x')));
  const payload = 'x'.repeat(16_384);
  const xml = `<!DOCTYPE r [${' '.repeat(16_384)}]><?work ${payload}?><r a="${payload}">${payload}<!--${payload}--><![CDATA[${payload}]]><c${' '.repeat(16_384)}/></r>`;
  const bytes = encoder.encode(xml);
  assert.deepEqual(collectBytes(factory, bytes, Array.from({length:bytes.length}, (_,i)=>i+1)), collectBytes(jsTokenBackendFactory, bytes, []));
}

/** Deterministic structures and malformed mutations; failures include a replayable seed/input. */
export function runDifferentialFuzz(factory: TokenBackendFactory, seed = 0x5a17c0de, cases = 300): void {
  let state = seed >>> 0;
  const random = (n: number) => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) % n;
  };
  const words = ['ascii', 'é', '한글', '😀', '&amp;', '&#x1F600;', '&word;', ' \t\r\n'];
  const element = (depth: number): string => {
    const name = ['r', 'p:根', 'é', '𐀀'][random(4)]!;
    const attributes = Array.from({length:random(20)}, (_, i) => ` a${i}="${words[random(words.length)]}"`).join('');
    const start = `<${name} xmlns:p="urn:${random(4)}"${attributes}`;
    if (random(4) === 0) return `${start}/>`;
    let body = words[random(words.length)]!;
    if (depth < 4) for (let i = random(3); i > 0; i--) body += element(depth + 1);
    if (random(3) === 0) body += '<!--comment--><![CDATA[<é>]]><?pi data?>';
    return `${start}>${body}</${name}>`;
  };
  for (let sample = 0; sample < cases; sample++) {
    let xml = element(0);
    switch (random(5)) {
      case 0: xml = xml.slice(0, random(xml.length)); break;
      case 1: xml = xml.replace(' a0=', ' a1='); break;
      case 2: xml = xml.replace('>', '>&unknown;'); break;
    }
    const bytes = new TextEncoder().encode(xml);
    const cuts: number[] = [];
    for (let end = 0; end < bytes.length;) {
      end = Math.min(bytes.length, end + 1 + random(67)); cuts.push(end);
    }
    const options: TokenCursorOptions = {
      namespaceAware: random(2) === 0,
      autoDecodeEntities: random(2) === 0,
      addEntities: [{entity:'word',value:'hello'}],
    };
    const expected = collectBytes(jsTokenBackendFactory, bytes, cuts, options);
    const actual = collectBytes(factory, bytes, cuts, options);
    const context = JSON.stringify({seed, sample, xml, cuts, options});
    if (expected.error) {
      assert.ok(actual.error, context);
    } else {
      assert.deepEqual(actual, expected, context);
    }
  }
}
