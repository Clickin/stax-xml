import { describe, expect, it } from 'vitest';
import { StreamEventType, StreamReaderSync } from '../src/StreamReaderSync';

describe('StreamReaderSync', () => {
  it('keeps distinct element names that collide under the internal hash', () => {
    const xml = '<root><aSd3njyge/><aSXRYquSd/></root>';
    const bytes = new TextEncoder().encode(xml);
    const names = [];

    for (const batch of new StreamReaderSync(bytes)) {
      for (let index = 0; index < batch.eventCount; index++) {
        if (batch.typeAt(index) === StreamEventType.START_ELEMENT) {
          names.push(batch.nameAt(index));
        }
      }
    }

    expect(names).toEqual(['root', 'aSd3njyge', 'aSXRYquSd']);
  });

  it('rejects mismatched closing tags that collide under the internal hash', () => {
    const xml = '<root><aSd3njyge></aSXRYquSd></root>';
    const bytes = new TextEncoder().encode(xml);

    expect(() => Array.from(new StreamReaderSync(bytes))).toThrow(/Mismatched closing tag/);
  });

  it('keeps distinct attribute names that collide under the internal hash', () => {
    const xml = '<root aSd3njyge="one" aSXRYquSd="two"/>';
    const bytes = new TextEncoder().encode(xml);
    const attributes: Array<[string | undefined, string | undefined]> = [];

    for (const batch of new StreamReaderSync(bytes)) {
      for (let index = 0; index < batch.eventCount; index++) {
        if (batch.typeAt(index) !== StreamEventType.START_ELEMENT || batch.nameAt(index) !== 'root') {
          continue;
        }
        for (let attrIndex = 0; attrIndex < batch.attributeCountAt(index); attrIndex++) {
          attributes.push([
            batch.attributeNameAt(index, attrIndex),
            batch.attributeValueAt(index, attrIndex),
          ]);
        }
      }
    }

    expect(attributes).toEqual([
      ['aSd3njyge', 'one'],
      ['aSXRYquSd', 'two'],
    ]);
  });
});
