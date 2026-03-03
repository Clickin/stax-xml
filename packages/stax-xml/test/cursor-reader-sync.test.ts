import { describe, expect, it } from 'vitest';

import { createStaxXmlCursorReaderSync, StaxXmlCursorReaderSync } from '../src/StaxXmlCursorReaderSync';
import { XmlEventType } from '../src/types';

describe('StaxXmlCursorReaderSync', () => {
  it('reads events sequentially and exposes cursor accessors', () => {
    const reader = new StaxXmlCursorReaderSync('<root id="1"><child/></root>');

    const types: string[] = [];

    while (reader.read()) {
      const event = reader.requireEvent();
      types.push(event.type);

      if (event.type === XmlEventType.START_ELEMENT && event.name === 'root') {
        expect(event.getAttributeCount()).toBe(1);
        expect(event.getAttribute(0)?.name).toBe('id');
        expect(event.getAttribute(0)?.value).toBe('1');
        expect(event.getAttributeValue('id')).toBe('1');
      }
    }

    expect(types).toEqual([
      XmlEventType.START_DOCUMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.START_ELEMENT,
      XmlEventType.END_ELEMENT,
      XmlEventType.END_ELEMENT,
      XmlEventType.END_DOCUMENT
    ]);
  });

  it('supports hasNext lookahead and factory function', () => {
    const reader = createStaxXmlCursorReaderSync('<root><item>value</item></root>');

    expect(reader.hasNext()).toBe(true);
    expect(reader.read()).toBe(true);
    expect(reader.requireEvent().type).toBe(XmlEventType.START_DOCUMENT);

    expect(reader.hasNext()).toBe(true);
    expect(reader.hasNext()).toBe(true);
    expect(reader.read()).toBe(true);
    expect(reader.requireEvent().type).toBe(XmlEventType.START_ELEMENT);
  });
});
