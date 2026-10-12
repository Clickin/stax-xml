import { setFlagsFromString } from 'node:v8';
import { describe, expect, it } from 'vitest';

import { TokenCursor, type TokenAttribute } from '@stax-xml/core';

// %HaveSameMap compares V8 hidden classes. The flag must be enabled before the
// probe functions are compiled, so they are built through new Function.
setFlagsFromString('--allow-natives-syntax');
const haveSameMap = new Function('a', 'b', 'return %HaveSameMap(a, b)') as (a: object, b: object) => boolean;
const hasFastProperties = new Function('o', 'return %HasFastProperties(o)') as (o: object) => boolean;

const XML = '<?xml version="1.0"?><!DOCTYPE r><r xmlns:a="u" a:x="1" y="2"><!--c--><a:b/>t<![CDATA[x]]><?pi d?></r>';

interface Run {
  cursor: TokenCursor;
  frames: object[];
  attributes: TokenAttribute[];
}

function run(options: ConstructorParameters<typeof TokenCursor>[2], chunked: boolean): Run {
  const cursor = new TokenCursor(chunked ? '' : XML, !chunked, options);
  if (chunked) {
    for (const chunk of XML.match(/.{1,7}/g)!) cursor.push(chunk, false);
    cursor.push('', true);
  }
  const frames: object[] = [];
  const attributes: TokenAttribute[] = [];
  while (true) {
    const type = cursor.next();
    if (type === null) break;
    if (typeof type === 'symbol') continue;
    const frame = (cursor as unknown as { currentFrame?: object }).currentFrame;
    if (frame) frames.push(frame);
    for (let index = 0; index < cursor.attributeCount(); index++) attributes.push(cursor.attribute(index)!);
  }
  return { cursor, frames, attributes };
}

describe('TokenCursor hidden classes', () => {
  const direct = run({}, false);
  const chunked = run({ namespaceAware: false, autoDecodeEntities: false }, true);
  const document = run({ documentMode: 'document' }, false);

  it('keeps one cursor shape across options and input modes', () => {
    expect(haveSameMap(new TokenCursor('<a/>'), new TokenCursor('<b/>', true, { namespaceAware: false }))).toBe(true);
    expect(haveSameMap(direct.cursor, chunked.cursor)).toBe(true);
    expect(haveSameMap(direct.cursor, document.cursor)).toBe(true);
  });

  it('keeps one cursor shape mid-parse', () => {
    const left = new TokenCursor(XML, true);
    const right = new TokenCursor('', false, { autoDecodeEntities: false });
    right.push("<q a='1'>", false);
    left.next();
    left.next();
    right.next();
    right.next();
    expect(haveSameMap(left, right)).toBe(true);
  });

  it('creates frames and attributes with a single shape in fast mode', () => {
    const frames = [...direct.frames, ...chunked.frames];
    const attributes = [...direct.attributes, ...chunked.attributes];
    expect(frames.length).toBeGreaterThan(0);
    expect(attributes.length).toBeGreaterThan(0);
    expect(frames.every((frame) => haveSameMap(frame, frames[0]!))).toBe(true);
    expect(attributes.every((attribute) => haveSameMap(attribute, attributes[0]!))).toBe(true);
    for (const object of [direct.cursor, frames[0]!, attributes[0]!]) expect(hasFastProperties(object)).toBe(true);
  });
});
