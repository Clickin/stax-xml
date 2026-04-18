import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { barplot, bench, run, summary } from 'mitata';
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';
import { CursorEventType, XmlCursorReader } from 'stax-xml/cursor';
import { XMLParser } from 'fast-xml-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const xmlString = readFileSync(join(__dirname, 'assets/complex.xml'), 'utf8');

function staxCursorConsume() {
  const cursor = new XmlCursorReader(xmlString);
  while (cursor.next()) {
    const t = cursor.eventType();
    switch (t) {
      case CursorEventType.START_ELEMENT: {
        const n = cursor.localName();
        const ac = cursor.getAttributeCount();
        for (let i = 0; i < ac; i++) {
          cursor.getAttributeLocalName(i);
          cursor.getAttributeValue(i);
        }
        break;
      }
      case CursorEventType.CHARACTERS:
      case CursorEventType.CDATA:
        cursor.text();
        break;
    }
  }
}

function staxCursorMinimal() {
  const cursor = new XmlCursorReader(xmlString);
  while (cursor.next()) {
    // just advance — no accessor calls
  }
}

function staxEventConsume() {
  const parser = new StaxXmlParserSync(xmlString);
  for (const event of parser) {
    switch (event.type) {
      case XmlEventType.START_ELEMENT:
      case XmlEventType.CHARACTERS:
      case XmlEventType.CDATA:
      case XmlEventType.END_ELEMENT:
        break;
      case XmlEventType.ERROR:
        throw event.error;
    }
  }
}

function fastXmlParser() {
  const parser = new XMLParser({ ignoreAttributes: false });
  parser.parse(xmlString);
}

console.log('📊 Cursor vs Event Parser Benchmark — 2KB (complex.xml)');
console.log(`   Input size: ${(xmlString.length / 1024).toFixed(1)} KB\n`);

barplot(() => {
  summary(() => {
    bench('stax cursor (consume)', () => staxCursorConsume()).gc('inner');
    bench('stax cursor (minimal)', () => staxCursorMinimal()).gc('inner');
    bench('stax event parser', () => staxEventConsume()).gc('inner');
    bench('fast-xml-parser', () => fastXmlParser()).gc('inner');
  });
});

await run({ format: 'mitata', throw: true });
