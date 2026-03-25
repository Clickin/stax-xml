import { describe, expect, it } from 'vitest';
import { StaxXmlCursorSync } from '../src/StaxXmlCursorSync';
import { XmlEventType } from '../src/types';

describe('StaxXmlCursorSync', () => {
  it('should expose token state and lazy attributes for the current START_ELEMENT', () => {
    const cursor = new StaxXmlCursorSync('<root xmlns:a="urn:a" a:flag="on"><a:item attr="value">text</a:item></root>');

    expect(cursor.hasNext()).toBe(true);
    expect(cursor.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(() => cursor.getAttributes()).toThrow('Current token does not expose attributes.');

    expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
    expect(cursor.name).toBe('root');
    expect(cursor.localName).toBe('root');
    expect(cursor.uri).toBeUndefined();
    expect(cursor.getAttributeValue('a:flag')).toBe('on');
    expect(cursor.getAttributes()).toEqual({
      'a:flag': 'on',
      'xmlns:a': 'urn:a',
    });

    expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
    expect(cursor.name).toBe('a:item');
    expect(cursor.localName).toBe('item');
    expect(cursor.prefix).toBe('a');
    expect(cursor.uri).toBe('urn:a');
    expect(cursor.getAttributeValue('attr')).toBe('value');

    expect(cursor.next()).toBe(XmlEventType.CHARACTERS);
    expect(cursor.getText()).toBe('text');
    expect(() => cursor.getAttributes()).toThrow('Current token does not expose attributes.');

    expect(cursor.next()).toBe(XmlEventType.END_ELEMENT);
    expect(cursor.name).toBe('a:item');
    expect(cursor.uri).toBe('urn:a');

    expect(cursor.next()).toBe(XmlEventType.END_ELEMENT);
    expect(cursor.name).toBe('root');

    expect(cursor.next()).toBe(XmlEventType.END_DOCUMENT);
    expect(cursor.hasNext()).toBe(false);
  });

  it('should keep self-closing namespace declarations scoped to that element', () => {
    const cursor = new StaxXmlCursorSync('<root><item xmlns="urn:item"/><sibling/></root>');

    expect(cursor.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
    expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
    expect(cursor.name).toBe('item');
    expect(cursor.uri).toBe('urn:item');

    expect(cursor.next()).toBe(XmlEventType.END_ELEMENT);
    expect(cursor.name).toBe('item');
    expect(cursor.uri).toBe('urn:item');

    expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
    expect(cursor.name).toBe('sibling');
    expect(cursor.uri).toBeUndefined();
  });

  it('should keep namespace overrides scoped to the overridden subtree', () => {
    const cursor = new StaxXmlCursorSync('<root xmlns="urn:root"><child xmlns="urn:child"><leaf/></child><sibling/></root>');

    expect(cursor.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
    expect(cursor.uri).toBe('urn:root');

    expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
    expect(cursor.name).toBe('child');
    expect(cursor.uri).toBe('urn:child');

    expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
    expect(cursor.name).toBe('leaf');
    expect(cursor.uri).toBe('urn:child');

    expect(cursor.next()).toBe(XmlEventType.END_ELEMENT);
    expect(cursor.name).toBe('leaf');
    expect(cursor.uri).toBe('urn:child');

    expect(cursor.next()).toBe(XmlEventType.END_ELEMENT);
    expect(cursor.name).toBe('child');
    expect(cursor.uri).toBe('urn:child');

    expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
    expect(cursor.name).toBe('sibling');
    expect(cursor.uri).toBe('urn:root');
  });

  it('should fail on malformed XML and rethrow the same error after failure', () => {
    const cursor = new StaxXmlCursorSync('<root><item></root>');

    expect(cursor.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);
    expect(cursor.next()).toBe(XmlEventType.START_ELEMENT);

    expect(() => cursor.next()).toThrow('Mismatched closing tag');
    expect(cursor.hasNext()).toBe(false);
    expect(() => cursor.next()).toThrow('Mismatched closing tag');
  });
});
