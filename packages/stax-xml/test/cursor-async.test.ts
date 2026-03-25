import { describe, expect, it } from 'vitest';
import { StaxXmlCursor } from '../src/StaxXmlCursor';
import { XmlEventType } from '../src/types';
import { createChunkedStream, stringToReadableStream } from './helpers/parser-trace';

describe('StaxXmlCursor', () => {
  it('should expose token state across chunked input', async () => {
    const cursor = new StaxXmlCursor(
      createChunkedStream('<root xmlns:a="urn:a"><a:item attr="value">text</a:item></root>', 4)
    );

    await expect(cursor.next()).resolves.toBe(XmlEventType.START_DOCUMENT);

    await expect(cursor.next()).resolves.toBe(XmlEventType.START_ELEMENT);
    expect(cursor.name).toBe('root');
    expect(cursor.getAttributes()).toEqual({
      'xmlns:a': 'urn:a',
    });

    await expect(cursor.next()).resolves.toBe(XmlEventType.START_ELEMENT);
    expect(cursor.name).toBe('a:item');
    expect(cursor.localName).toBe('item');
    expect(cursor.prefix).toBe('a');
    expect(cursor.uri).toBe('urn:a');
    expect(cursor.getAttributeValue('attr')).toBe('value');

    await expect(cursor.next()).resolves.toBe(XmlEventType.CHARACTERS);
    expect(cursor.getText()).toBe('text');

    await expect(cursor.next()).resolves.toBe(XmlEventType.END_ELEMENT);
    expect(cursor.name).toBe('a:item');
    await expect(cursor.next()).resolves.toBe(XmlEventType.END_ELEMENT);
    await expect(cursor.next()).resolves.toBe(XmlEventType.END_DOCUMENT);
    expect(cursor.hasNext()).toBe(false);
  });

  it('should enforce the single-consumer contract while a pull is in flight', async () => {
    const cursor = new StaxXmlCursor(createChunkedStream('<root><item/></root>', 1));

    const pendingNext = cursor.next();

    expect(() => cursor.hasNext()).toThrow('Concurrent cursor access is not allowed.');
    await expect(cursor.next()).rejects.toThrow('Concurrent cursor access is not allowed.');

    await expect(pendingNext).resolves.toBe(XmlEventType.START_DOCUMENT);
  });

  it('should fail on malformed XML and rethrow the same error after failure', async () => {
    const cursor = new StaxXmlCursor(stringToReadableStream('<root><item></root>'));

    await expect(cursor.next()).resolves.toBe(XmlEventType.START_DOCUMENT);
    await expect(cursor.next()).resolves.toBe(XmlEventType.START_ELEMENT);
    await expect(cursor.next()).resolves.toBe(XmlEventType.START_ELEMENT);

    await expect(cursor.next()).rejects.toThrow('Mismatched closing tag');
    expect(cursor.hasNext()).toBe(false);
    await expect(cursor.next()).rejects.toThrow('Mismatched closing tag');
  });
});
