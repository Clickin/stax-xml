import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { StaxXmlParserSync } from '../src/StaxXmlParserSync';
import { StaxXmlStreamReaderSync } from '../src/StaxXmlStreamReaderSync';
import { XmlEventType } from '../src/types';

const comprehensivePath = path.resolve(__dirname, './samples/comprehensive.xml');
const complexPath = path.resolve(__dirname, './samples/complex.xml');

function collectEventsFromParser(xml: string): any[] {
  const ParserClass = StaxXmlParserSync as any;
  if (!ParserClass) throw new Error('StaxXmlParserSync not available');
  const parser = new ParserClass(xml);
  const events: any[] = [];
  for (const ev of parser as any) {
    events.push(ev);
  }
  // Drop START_DOCUMENT if present to align with cursor flow (END_DOCUMENT will exist on close)
  if (events.length > 0) {
    const first = events[0];
    if ((first?.type === XmlEventType.START_DOCUMENT) || first?.name === 'START_DOCUMENT') {
      events.shift();
    }
  }
  return events;
}

function collectTokensFromReader(xml: string): any[] {
  const ReaderClass = StaxXmlStreamReaderSync as any;
  const reader = new ReaderClass(xml);
  const tokens: any[] = [];
  if (typeof reader.hasNext === 'function' && typeof reader.next === 'function') {
    while (reader.hasNext()) {
      const token = reader.next();
      switch (token) {
        case XmlEventType.START_ELEMENT:
        case XmlEventType.END_ELEMENT:
          tokens.push({
            name: reader.getName?.(),
            localName: reader.getLocalName?.(),
            prefix: reader.getPrefix?.(),
            uri: reader.getUri?.(),
          });
          break;
        case XmlEventType.CHARACTERS:
        case XmlEventType.CDATA:
          tokens.push({
            type: token,
            value: reader.getText?.(),
          });
          break;
        default:
          tokens.push({
            type: token,
          });
          break;
      }
    }
  } else {
    throw new Error('Unsupported reader interface');
  }
  return tokens;
}

function serializeEvent(ev: any): any {
  const out: any = {};
  if (!ev) return out;
  if (typeof ev.getName === 'function') out.name = ev.getName();
  if (typeof ev.getLocalName === 'function') out.localName = ev.getLocalName();
  if (typeof ev.getPrefix === 'function') out.prefix = ev.getPrefix();
  if (typeof ev.getUri === 'function') out.uri = ev.getUri();
  if (typeof ev.getText === 'function') out.text = ev.getText();
  if (out.name == null && typeof ev.name === 'string') out.name = ev.name;
  if (out.localName == null && typeof ev.localName === 'string') out.localName = ev.localName;
  if (out.prefix == null && typeof ev.prefix === 'string') out.prefix = ev.prefix;
  if (out.uri == null && typeof ev.uri === 'string') out.uri = ev.uri;
  // Attributes (cursor-based) - optional
  if (typeof ev.getAttributeCount === 'function') {
    const count = ev.getAttributeCount();
    const attrs: any[] = [];
    for (let i = 0; i < count; i++) {
      const name = typeof ev.getAttributeLocalName === 'function' ? ev.getAttributeLocalName(i) : `attr${i}`;
      const value = typeof ev.getAttributeValue === 'function' ? ev.getAttributeValue(i) : (ev as any).attributes?.[i];
      attrs.push({ name, value });
    }
    if (attrs.length > 0) out.attrs = attrs;
  }
  if (Object.keys(out).length === 0) {
    // Fallback to a simple representation
    return { raw: ev };
  }
  return out;
}

function serializeEventString(ev: any): string {
  return JSON.stringify(serializeEvent(ev));
}

describe('StreamReaderSync equivalence', () => {
  it('equivalence - comprehensive.xml', () => {
    const xml = fs.readFileSync(comprehensivePath, 'utf8');
    const a = collectEventsFromParser(xml).map(serializeEventString);
    const b = collectTokensFromReader(xml).map(serializeEventString);
    expect(a).toEqual(b);
  });

  it('equivalence - complex.xml (optional)', () => {
    if (!fs.existsSync(complexPath)) {
      // nothing to compare if fixture not present
      expect(true).toBe(true);
      return;
    }
    const xml = fs.readFileSync(complexPath, 'utf8');
    const a = collectEventsFromParser(xml).map(serializeEventString);
    const b = collectTokensFromReader(xml).map(serializeEventString);
    expect(a).toEqual(b);
  });

  it('invalid XML should throw from StaxXmlStreamReaderSync.next()', () => {
    const invalidXml = '<root><child></root>';
    expect(() => {
      const reader = new StaxXmlStreamReaderSync(invalidXml);
      while (reader.hasNext()) {
        reader.next();
      }
    }).toThrow();
  });
});
