import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/converter/index.js';

describe('converter XPath v1 contract', () => {
  it.each([
    '/root/item',
    '//item/name',
    './item[2]/@id',
    './item[2]/text()',
    './@id',
    '.',
    '/p:root/p:item'
  ])('accepts the supported streaming subset at schema construction: %s', xpath => {
    expect(() => x.string(xpath)).not.toThrow();
  });

  it.each([
    '',
    'item',
    '/',
    './',
    '///item',
    '/root//item',
    '//root//item',
    '/root/',
    '/root/@id/value',
    '/root/text()/value',
    '/root/*',
    '/root[item]',
    '/root[@id="1"]',
    '/root[last()]',
    '/root[first()]',
    '/root[position()=1]',
    '/root[0]',
    '/root[1][2]',
    '/root|/other',
    '/child::root',
    '/root/name()',
    '//@id',
    '/text()'
  ])('rejects unsupported syntax before parse or precompile: %s', xpath => {
    expect(() => x.string(xpath)).toThrow();
    expect(() => x.number().xpath(xpath)).toThrow();
    expect(() => x.array(x.string(), xpath)).toThrow();
  });

  it('keeps positive literal positions operational', () => {
    const schema = x.object({
      id: x.string('./entry[2]/@id'),
      text: x.string('./entry[2]/text()')
    }).xpath('/root');

    expect(schema.parseSync('<root><entry id="a">A</entry><entry id="b">B</entry></root>'))
      .toEqual({ id: 'b', text: 'B' });
  });
});
