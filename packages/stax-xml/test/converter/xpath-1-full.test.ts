import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

const XML = `<?work go?>
<root xmlns:p="urn:p">
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
  <after><mark>After</mark></after>
</root>`;

describe('XPath 1.0 full evaluator', () => {
  function stringAt(xpath: string): string {
    return x.string().xpath(xpath).parseSync(XML, {
      xpathNamespaces: { p: 'urn:p' }
    });
  }

  it.each([
    ['ancestor', 'name(/root/section/item[1]/leaf/ancestor::section)', 'section'],
    ['ancestor-or-self', 'name(/root/section/item[1]/ancestor-or-self::item)', 'item'],
    ['attribute', 'string(/root/section/item[1]/attribute::id)', 'a'],
    ['child', 'string(/root/section/child::item[1]/child::name)', 'A'],
    ['descendant', 'string(/root/descendant::leaf[1])', 'LeafA'],
    ['descendant-or-self', 'name(/root/section/item[1]/descendant-or-self::leaf)', 'leaf'],
    ['following', 'string(/root/section/item[1]/following::tail)', 'Tail'],
    ['following-sibling', 'string(/root/section/item[1]/following-sibling::item/name)', 'B'],
    ['namespace', 'string(/root/section/item[1]/namespace::p)', 'urn:p'],
    ['parent', 'name(/root/section/item[1]/parent::section)', 'section'],
    ['preceding', 'string(/root/section/item[2]/preceding::before)', 'Before'],
    ['preceding-sibling', 'string(/root/section/item[2]/preceding-sibling::item/name)', 'A'],
    ['self', 'name(/root/section/item[1]/self::item)', 'item'],
  ])('supports the %s axis', (_axis, xpath, expected) => {
    expect(stringAt(xpath)).toBe(expected);
  });

  it('supports XPath 1.0 predicate context with last and position', () => {
    expect(stringAt('string((//item)[last()]/@id)')).toBe('b');
    expect(stringAt('string(/root/section/item[position() = 2]/name)')).toBe('B');
    expect(stringAt('string(/root/section/item[@id = "b" and contains(name, "B")]/leaf)')).toBe('LeafB');
  });

  it('supports XPath 1.0 node tests for comments, processing instructions, and text', () => {
    expect(stringAt('string(/root/comment())')).toBe('root-comment');
    expect(stringAt("string(/processing-instruction('work'))")).toBe('go');
    expect(stringAt('normalize-space(/root/section/item[1]/name/text())')).toBe('A');
  });

  it('supports XPath 1.0 core functions and arithmetic operators', () => {
    const xml = '<root><n>1</n><n>2</n><n>3</n><word>abcdef</word></root>';
    expect(x.number().xpath('sum(/root/n)').parseSync(xml)).toBe(6);
    expect(x.number().xpath('count(/root/n) * 2 + 1').parseSync(xml)).toBe(7);
    expect(x.string().xpath('substring(/root/word, 2, 3)').parseSync(xml)).toBe('bcd');
    expect(x.string().xpath("translate('bar', 'ab', 'AB')").parseSync(xml)).toBe('BAr');
  });

  it('routes compiled schemas that need XPath 1.0 through the runtime evaluator', () => {
    const schema = x.object({
      lastName: x.string().xpath('string((//item)[last()]/name)'),
      names: x.array(x.string(), '//item/name')
    }).compile();

    expect(schema.parseSync(XML)).toEqual({
      lastName: 'B',
      names: ['A', 'B']
    });
  });
});
