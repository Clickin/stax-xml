import { describe, expect, it } from 'vitest';
import {
  collectAsyncTrace,
  collectSyncTrace,
  type NormalizedTraceRecord,
} from './helpers/parser-trace';

const namespaceScopeTrace: NormalizedTraceRecord[] = [
  { type: 'START_DOCUMENT' },
  {
    type: 'START_ELEMENT',
    name: 'root',
    localName: 'root',
    attributes: {
      'a:flag': 'on',
      'xmlns:a': 'urn:a',
    },
    attributesWithPrefix: [
      { name: 'a:flag', localName: 'flag', prefix: 'a', uri: 'urn:a', value: 'on' },
      { name: 'xmlns:a', localName: 'a', prefix: 'xmlns', value: 'urn:a' },
    ],
  },
  {
    type: 'START_ELEMENT',
    name: 'a:one',
    localName: 'one',
    prefix: 'a',
    uri: 'urn:a',
    attributes: {
      attr: '1',
    },
    attributesWithPrefix: [
      { name: 'attr', localName: 'attr', value: '1' },
    ],
  },
  {
    type: 'END_ELEMENT',
    name: 'a:one',
    localName: 'one',
    prefix: 'a',
    uri: 'urn:a',
  },
  {
    type: 'START_ELEMENT',
    name: 'two',
    localName: 'two',
    uri: 'urn:two',
    attributes: {
      xmlns: 'urn:two',
    },
    attributesWithPrefix: [
      { name: 'xmlns', localName: 'xmlns', value: 'urn:two' },
    ],
  },
  {
    type: 'END_ELEMENT',
    name: 'two',
    localName: 'two',
    uri: 'urn:two',
  },
  {
    type: 'START_ELEMENT',
    name: 'three',
    localName: 'three',
    attributes: {},
    attributesWithPrefix: [],
  },
  {
    type: 'END_ELEMENT',
    name: 'three',
    localName: 'three',
  },
  {
    type: 'END_ELEMENT',
    name: 'root',
    localName: 'root',
  },
  { type: 'END_DOCUMENT' },
];

describe('Parser Trace Oracle', () => {
  it('should normalize sync parser traces for namespace scope and self-closing tags', () => {
    const xml = '<root xmlns:a="urn:a" a:flag="on"><a:one attr="1"/><two xmlns="urn:two"/><three/></root>';

    expect(collectSyncTrace(xml)).toEqual(namespaceScopeTrace);
  });

  it('should normalize async parser traces for namespace scope and self-closing tags', async () => {
    const xml = '<root xmlns:a="urn:a" a:flag="on"><a:one attr="1"/><two xmlns="urn:two"/><three/></root>';

    await expect(collectAsyncTrace(xml)).resolves.toEqual(namespaceScopeTrace);
  });

  it('should produce the same async normalized trace for chunked input', async () => {
    const xml = '<root xmlns:a="urn:a" a:flag="on"><a:one attr="1"/><two xmlns="urn:two"/><three/></root>';

    await expect(collectAsyncTrace(xml, 5)).resolves.toEqual(namespaceScopeTrace);
  });
});
