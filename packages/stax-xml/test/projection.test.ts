import { describe, expect, it } from 'vitest';
import {
  attr,
  attrEquals,
  childText,
  compileProjection,
  many,
  projectXmlSync,
} from '../src/projection/index';

const encoder = new TextEncoder();

function bytes(xml: string): Uint8Array {
  return encoder.encode(xml);
}

function* byteBatches(xml: string, chunkSize: number, batchSize: number): Iterable<readonly Uint8Array[]> {
  const chunks: Uint8Array[] = [];
  const source = bytes(xml);
  for (let offset = 0; offset < source.byteLength; offset += chunkSize) {
    chunks.push(source.slice(offset, offset + chunkSize));
  }

  for (let index = 0; index < chunks.length; index += batchSize) {
    yield chunks.slice(index, index + batchSize);
  }
}

describe('stax-xml/projection', () => {
  it('projects repeated records from a byte input', () => {
    const projection = compileProjection({
      books: many('/catalog/book', {
        id: attr('id'),
        category: attr('category').optional(),
        title: childText('title'),
        author: childText('author').optional(),
      }),
    });

    const records = Array.from(projectXmlSync(bytes([
      '<catalog>',
      '<book id="b1" category="fiction"><title>One</title><author>Alice</author><ignored>skip</ignored></book>',
      '<magazine id="m1"><title>Wrong</title></magazine>',
      '<book id="b2"><title>Two</title></book>',
      '</catalog>',
    ].join('')), projection));

    expect(records).toEqual([
      { id: 'b1', category: 'fiction', title: 'One', author: 'Alice' },
      { id: 'b2', category: undefined, title: 'Two', author: undefined },
    ]);
    expect(Object.keys(records[1]!)).toEqual(['id', 'category', 'title', 'author']);
  });

  it('keeps projection matching across chunked byte batches and supports callback sinks', () => {
    const projection = compileProjection({
      books: many('/catalog/book', {
        id: attr('id'),
        title: childText('title'),
      }, {
        where: attrEquals('lang', 'ko'),
      }),
    });
    const captured: Array<{ id: string; title: string }> = [];

    const result = projectXmlSync(byteBatches([
      '<catalog>',
      '<book id="b1" lang="en"><title>Skip</title></book>',
      '<book id="b2" lang="ko"><title>선택</title></book>',
      '<book id="b3" lang="ko"><title>Split Text</title></book>',
      '</catalog>',
    ].join(''), 7, 2), projection, {
      onRecord(record) {
        captured.push(record);
      },
    });

    expect(result).toBeUndefined();
    expect(captured).toEqual([
      { id: 'b2', title: '선택' },
      { id: 'b3', title: 'Split Text' },
    ]);
  });

  it('does not emit records that are missing required fields', () => {
    const projection = compileProjection({
      books: many('/catalog/book', {
        id: attr('id'),
        title: childText('title'),
        author: childText('author').optional(),
      }),
    });

    const records = Array.from(projectXmlSync(bytes([
      '<catalog>',
      '<book id="missing-title"><author>Alice</author></book>',
      '<book><title>Missing id</title></book>',
      '<book id="ok"><title>Kept</title></book>',
      '</catalog>',
    ].join('')), projection));

    expect(records).toEqual([
      { id: 'ok', title: 'Kept', author: undefined },
    ]);
  });
});
