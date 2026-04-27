import { describe, expect, it } from 'vitest';
import {
  buildXPathDocumentFromAsyncEvents,
  buildXPathDocumentFromEvents,
  buildXPathDocumentFromString,
  evaluateXPath,
  xpathStringValue,
  xpathValueToNodes,
  xpathValueToString,
  type XPathDocument,
  type XPathNode,
} from '../../src/converter/XPath1Engine.js';
import { XmlEventFactory } from '../../src/types.js';

const XML = `<?xml version="1.0"?>
<?work go?>
<!DOCTYPE root [
  <!ENTITY sample "value > quoted">
]>
<root xmlns="urn:default" xmlns:p="urn:p" xml:lang="en-US">
  <!--root-comment-->
  <before>Before</before>
  <section id="s1">
    <item id="a" p:code="A">
      <name>A</name>
      <leaf>LeafA</leaf>
    </item>
    <item id="b">
      <name>B</name>
      <leaf>LeafB</leaf>
    </item>
    <tail>Tail</tail>
  </section>
  <ids>a b</ids>
  <after><mark>After</mark></after>
  <empty />
</root>`;

describe('XPath 1.0 evaluator branch coverage', () => {
  function document(xml = XML): XPathDocument {
    return buildXPathDocumentFromString(xml, {
      xpathNamespaces: { d: 'urn:default', p: 'urn:p' }
    });
  }

  function root(doc = document()): XPathNode {
    return doc.document;
  }

  function evalAt(xpath: string, doc = document(), node: XPathNode = root(doc)) {
    return evaluateXPath(xpath, node, doc, {
      xpathNamespaces: { d: 'urn:default', p: 'urn:p' }
    });
  }

  function stringAt(xpath: string, doc = document(), node: XPathNode = root(doc)): string {
    return xpathValueToString(evalAt(xpath, doc, node));
  }

  function numberAt(xpath: string, doc = document(), node: XPathNode = root(doc)): number {
    return evalAt(xpath, doc, node) as number;
  }

  function booleanAt(xpath: string, doc = document(), node: XPathNode = root(doc)): boolean {
    return evalAt(xpath, doc, node) as boolean;
  }

  it('builds XPath documents from string edge markup', () => {
    const doc = document();

    expect(stringAt('name(/*)', doc)).toBe('root');
    expect(stringAt('string(/processing-instruction())', doc)).toBe('go');
    expect(stringAt('string(/processing-instruction("work"))', doc)).toBe('go');
    expect(xpathValueToString(evaluateXPath('string(/processing-instruction("solo"))', buildXPathDocumentFromString('<?solo?><root/>').document, buildXPathDocumentFromString('<?solo?><root/>'))))
      .toBe('');
    expect(stringAt('string(/d:root/comment())', doc)).toBe('root-comment');
    expect(stringAt('string(/d:root/d:empty)', doc)).toBe('');

    const raw = buildXPathDocumentFromString('<root attr="&amp;"><![CDATA[]]>&amp;<!SKIP ignored></root>', {
      decodeEntities: false
    });
    expect(xpathStringValue(xpathValueToNodes(evaluateXPath('/root/@attr', raw.document, raw))[0]!)).toBe('&amp;');
    expect(xpathValueToString(evaluateXPath('/root', raw.document, raw))).toBe('&amp;');
  });

  it('throws for malformed XML tree-builder input', () => {
    for (const [xml, message] of [
      ['<root><!--', 'Unclosed comment'],
      ['<root><![CDATA[x', 'Unclosed CDATA'],
      ['<root><?work', 'Unclosed processing instruction'],
      ['<root><a></b></root>', 'Mismatched end tag'],
      ['<root><a></root>', 'Mismatched end tag'],
      ['<root><a>', 'Unclosed tag'],
      ['<root><a x></a></root>', 'Malformed attribute'],
      ['<root><a x=1></a></root>', 'Malformed quoted attribute'],
      ['<root><a x="1></a></root>', 'Unclosed markup'],
      ['<!DOCTYPE root [', 'Unclosed DOCTYPE'],
    ] as const) {
      expect(() => buildXPathDocumentFromString(xml)).toThrow(message);
    }

    expect(() => buildXPathDocumentFromString('<a><b/></a>', { maxDepth: 1 }))
      .toThrow('XML depth limit exceeded');
    expect(() => buildXPathDocumentFromString('<root><a/><b/></root>', { maxEvents: 2 }))
      .toThrow('XML event limit exceeded');
  });

  it('builds XPath documents from sync and async event streams', async () => {
    const events = [
      XmlEventFactory.startDocument(),
      XmlEventFactory.startElement('p:root', 'root', 'p', 'urn:p', {
        xmlns: 'urn:default',
        'xmlns:p': 'urn:p',
        'p:id': 'r1',
      }, {
        'p:id': { value: 'r1', localName: 'id', prefix: 'p', uri: 'urn:p' },
      }),
      XmlEventFactory.startElement('child', 'child', undefined, 'urn:default', {}),
      XmlEventFactory.characters('text'),
      XmlEventFactory.cdata(' cdata'),
      XmlEventFactory.endElement('child', 'child', undefined, 'urn:default'),
      XmlEventFactory.endElement('p:root', 'root', 'p', 'urn:p'),
      XmlEventFactory.endDocument(),
    ];
    const doc = buildXPathDocumentFromEvents(events);

    expect(xpathValueToString(evaluateXPath('string(/p:root/@p:id)', doc.document, doc, {
      xpathNamespaces: { p: 'urn:p' }
    }))).toBe('r1');
    expect(xpathValueToString(evaluateXPath('string(/p:root/child)', doc.document, doc, {
      xpathNamespaces: { p: 'urn:p' }
    }))).toBe('text cdata');

    async function* asyncEvents() {
      for (const event of events) yield event;
    }
    const asyncDoc = await buildXPathDocumentFromAsyncEvents(asyncEvents());
    expect(xpathValueToString(evaluateXPath('string(/p:root/child)', asyncDoc.document, asyncDoc, {
      xpathNamespaces: { p: 'urn:p' }
    }))).toBe('text cdata');

    expect(() => buildXPathDocumentFromEvents([XmlEventFactory.error(new Error('event failed'))]))
      .toThrow('event failed');
    expect(() => buildXPathDocumentFromEvents([
      XmlEventFactory.startElement('a', undefined, undefined, undefined, {}),
      XmlEventFactory.endElement('b', undefined, undefined, undefined),
    ])).toThrow('Mismatched end tag');
    expect(() => buildXPathDocumentFromEvents([
      XmlEventFactory.startElement('a', undefined, undefined, undefined, {}),
    ])).toThrow('Unclosed tag');

    const sparseDoc = buildXPathDocumentFromEvents([
      { type: 'START_ELEMENT', name: 'root' } as never,
      XmlEventFactory.characters('text'),
      XmlEventFactory.endElement('root', undefined, undefined, undefined),
    ]);
    expect(xpathValueToString(evaluateXPath('string(/root)', sparseDoc.document, sparseDoc))).toBe('text');
  });

  it('evaluates XPath operators, filters, and conversion helpers', () => {
    const doc = document();

    expect(xpathValueToNodes(true)).toEqual([]);
    expect(xpathValueToNodes(evalAt('/d:root/d:section/d:item', doc)).length).toBe(2);
    expect(stringAt('name(/)', doc)).toBe('');
    expect(stringAt('name(/d:root/d:section/d:item[1]/d:name/..)', doc)).toBe('item');
    expect(stringAt('string(/d:root/d:section/d:item[1]/d:name/.)', doc)).toBe('A');
    expect(stringAt('string((/d:root/d:section)/d:item[2]/d:name)', doc)).toBe('B');
    expect(stringAt('name((/d:root/d:section//d:leaf)[2])', doc)).toBe('leaf');
    expect(stringAt('name((/d:root/d:before | /d:root/d:after)[2])', doc)).toBe('after');
    expect(stringAt('string((/d:root)//d:tail)', doc)).toBe('Tail');
    expect(numberAt('count(/parent::node())', doc)).toBe(0);
    expect(numberAt('count(/d:root | /d:root)', doc)).toBe(1);

    expect(booleanAt('false() or true()', doc)).toBe(true);
    expect(booleanAt('true() or $missing', doc)).toBe(true);
    expect(booleanAt('true() and true()', doc)).toBe(true);
    expect(booleanAt('false() and $missing', doc)).toBe(false);
    expect(booleanAt('/d:root/d:section/d:item[1]/@id = "a"', doc)).toBe(true);
    expect(booleanAt('/d:root/d:section/d:item[1]/@id != "b"', doc)).toBe(true);
    expect(booleanAt('true() = true()', doc)).toBe(true);
    expect(booleanAt('1 = 1', doc)).toBe(true);
    expect(booleanAt("'1' = 1", doc)).toBe(true);
    expect(booleanAt("'a' = 'a'", doc)).toBe(true);
    expect(booleanAt('1 = /d:root/d:section/d:item[1]/@id', doc)).toBe(false);
    expect(booleanAt('2 < 3 and 3 <= 3 and 4 > 3 and 4 >= 4', doc)).toBe(true);
    expect(booleanAt('1 < /d:root/d:section/d:item[1]/@id', doc)).toBe(false);
    expect(numberAt('5 - 2', doc)).toBe(3);
    expect(numberAt('6 div 2', doc)).toBe(3);
    expect(numberAt('7 mod 4', doc)).toBe(3);
    expect(numberAt('-2 + 5', doc)).toBe(3);
    expect(numberAt('.5 + .5', doc)).toBe(1);
    expect(numberAt('1. + 1', doc)).toBe(2);
    expect(numberAt('1.2', doc)).toBe(1.2);
    expect(xpathStringValue(doc.document)).toContain('Before');
    expect(xpathValueToString(evalAt('/d:root/d:section', doc))).toContain('LeafA');
    expect(xpathValueToString(true)).toBe('true');
    expect(xpathValueToString(false)).toBe('false');
    expect(xpathValueToString(Number.NaN)).toBe('NaN');
    expect(xpathValueToString(-0)).toBe('0');
  });

  it('evaluates XPath functions and node name conversions', () => {
    const doc = document();
    const item = xpathValueToNodes(evalAt('/d:root/d:section/d:item[1]', doc))[0]!;
    const name = xpathValueToNodes(evalAt('/d:root/d:section/d:item[1]/d:name', doc))[0]!;

    expect(numberAt('count(/d:root/d:section/d:item)', doc)).toBe(2);
    expect(stringAt("string(id('a')/d:name)", doc)).toBe('A');
    expect(stringAt('string(id(/d:root/d:ids)[2]/d:name)', doc)).toBe('B');
    expect(numberAt("count(id(' '))", doc)).toBe(0);
    expect(stringAt('local-name(/d:root/d:section/d:item[1]/@p:code)', doc)).toBe('code');
    expect(stringAt('namespace-uri(/d:root/d:section/d:item[1]/@p:code)', doc)).toBe('urn:p');
    expect(stringAt('name(namespace::p)', doc, item)).toBe('p');
    expect(stringAt('name()', doc, item)).toBe('item');
    expect(stringAt('local-name(namespace::p)', doc, item)).toBe('p');
    expect(stringAt('local-name(/d:root/d:missing)', doc)).toBe('');
    expect(stringAt('local-name(/processing-instruction())', doc)).toBe('work');
    expect(stringAt('local-name(/d:root/comment())', doc)).toBe('');
    expect(stringAt('namespace-uri(namespace::p)', doc, item)).toBe('urn:p');
    expect(stringAt('namespace-uri(/d:root/d:missing)', doc)).toBe('');
    expect(stringAt('namespace-uri(/d:root/comment())', doc)).toBe('');
    expect(stringAt('name(/d:root/d:missing)', doc)).toBe('');
    expect(stringAt('name(/processing-instruction())', doc)).toBe('work');
    expect(stringAt('string()', doc, item)).toContain('LeafA');
    expect(stringAt("concat('a', 'b', 'c')", doc)).toBe('abc');
    expect(booleanAt("starts-with('abc', 'ab')", doc)).toBe(true);
    expect(stringAt("substring-before('abc.def', '.')", doc)).toBe('abc');
    expect(stringAt("substring-before('abcdef', 'x')", doc)).toBe('');
    expect(stringAt("substring-after('abc.def', '.')", doc)).toBe('def');
    expect(stringAt("substring-after('abcdef', 'x')", doc)).toBe('');
    expect(stringAt("substring('abcdef', 3)", doc)).toBe('cdef');
    expect(stringAt("substring('abcdef', number('nan'))", doc)).toBe('');
    expect(stringAt("substring('abcdef', 1, number('nan'))", doc)).toBe('');
    expect(stringAt("substring('abcdef', 1, 0)", doc)).toBe('');
    expect(numberAt('string-length()', doc, name)).toBe(1);
    expect(numberAt("string-length('abc')", doc)).toBe(3);
    expect(stringAt('normalize-space()', doc, item)).toBe('A LeafA');
    expect(stringAt("translate('abc', 'bc', 'B')", doc)).toBe('aB');
    expect(booleanAt('boolean(/d:root)', doc)).toBe(true);
    expect(booleanAt('boolean(1)', doc)).toBe(true);
    expect(booleanAt('boolean(0)', doc)).toBe(false);
    expect(booleanAt("boolean(number('nan'))", doc)).toBe(false);
    expect(booleanAt("boolean('x')", doc)).toBe(true);
    expect(booleanAt('not(false())', doc)).toBe(true);
    expect(booleanAt('lang("en")', doc, name)).toBe(true);
    expect(booleanAt('lang("fr")', doc, name)).toBe(false);
    expect(Number.isNaN(numberAt('number()', doc, name))).toBe(true);
    expect(numberAt('floor(1.9)', doc)).toBe(1);
    expect(numberAt('ceiling(1.1)', doc)).toBe(2);
    expect(numberAt('round(1.5)', doc)).toBe(2);

    const langDoc = buildXPathDocumentFromEvents([
      XmlEventFactory.startElement('root', 'root', undefined, undefined, { lang: 'en-GB' }, {
        lang: { value: 'en-GB', localName: 'lang', prefix: 'xml', uri: 'http://www.w3.org/XML/1998/namespace' },
      }),
      XmlEventFactory.startElement('child', 'child', undefined, undefined, {}),
      XmlEventFactory.endElement('child', 'child', undefined, undefined),
      XmlEventFactory.endElement('root', 'root', undefined, undefined),
    ]);
    const child = xpathValueToNodes(evaluateXPath('/root/child', langDoc.document, langDoc))[0]!;
    expect(evaluateXPath("lang('en')", child, langDoc)).toBe(true);
    expect(evaluateXPath("lang('en')", xpathValueToNodes(evaluateXPath('/root/@lang', langDoc.document, langDoc))[0]!, langDoc))
      .toBe(true);
  });

  it('evaluates namespace, wildcard, and non-principal axis cases', () => {
    const doc = document();
    const item = xpathValueToNodes(evalAt('/d:root/d:section/d:item[1]', doc))[0]!;

    expect(stringAt('string(@p:*)', doc, item)).toBe('A');
    expect(xpathValueToString(evaluateXPath('string(@p:*)', item, doc))).toBe('A');
    expect(numberAt('count(@*/following-sibling::*)', doc, item)).toBe(0);
    expect(stringAt('name(@id/parent::d:item)', doc, item)).toBe('item');
    expect(stringAt('name(namespace::p/parent::d:item)', doc, item)).toBe('item');
    expect(stringAt('name(@id/following::d:tail)', doc, item)).toBe('tail');
    expect(stringAt('name(@id/preceding::d:before)', doc, item)).toBe('before');
    expect(numberAt('count(@id/descendant::*)', doc, item)).toBe(0);
    expect(numberAt('count(@id/child::*)', doc, item)).toBe(0);
    expect(numberAt('count(@id/attribute::*)', doc, item)).toBe(0);
    expect(numberAt('count(@id/namespace::*)', doc, item)).toBe(0);
  });

  it('reports XPath syntax, arity, and unsupported feature errors', () => {
    const doc = document();

    for (const [xpath, message] of [
      ['$missing', 'XPath variable references'],
      ['unknown()', 'Unsupported XPath function'],
      ["concat('a')", 'expects at least 2 arguments'],
      ['count()', 'expects 1 arguments'],
      ['count(1)', 'must evaluate to a node-set'],
      ['string(1, 2)', 'expects 0-1 arguments'],
      ['/d:root/bogus::x', 'Unknown XPath axis'],
      ['/d:root/[', 'Expected XPath node test'],
      ['/d:root/', 'Expected XPath node test'],
      ['(', 'Expected XPath expression'],
      ["'unterminated", 'Unclosed XPath string literal'],
      ['1 ; 2', 'Invalid characters in XPath'],
      ['#', 'Invalid XPath character'],
      ['/d:root/d:item]', 'Expected eof'],
      ['/d:root/d:item[1', 'Expected ]'],
    ] as const) {
      expect(() => evalAt(xpath, doc)).toThrow(message);
    }
  });
});
