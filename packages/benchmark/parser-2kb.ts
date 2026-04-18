import { XMLParser } from 'fast-xml-parser';
import { barplot, bench, summary } from 'mitata';
import { StaxXmlParserSync, XmlEventType, type AnyXmlEvent } from 'stax-xml';
import { CursorEventType, XmlCursorReader } from 'stax-xml/cursor';
//@ts-ignore
import * as txml from 'txml';
import xml2js from 'xml2js';
import { parseMitataCliArgs, runMitataWithCli, shouldPrintHumanReadableBanner } from './common/mitata-cli.js';
import { ASSET_PATHS, loadXmlFile } from './common/utils.js';

const cli = parseMitataCliArgs();

const xmlString = loadXmlFile(ASSET_PATHS.complex); // 2KB

// XML을 JavaScript 객체로 변환하는 함수
function parseXmlToObject(xmlString: string) {
  const parser = new StaxXmlParserSync(xmlString);
  let elementStack: AnyXmlEvent[] = [];
  let root = null;

  for (const event of parser) {
    elementStack.push(event);
    // simulate actual behavior. large xml processing case usually does not store all events in memory.
    if (elementStack.length > 100) {
      elementStack.splice(0, elementStack.length);
    }
  }

  return root;
}

function fastXmlParser() {
  const parser = new XMLParser();
  parser.parse(xmlString);
}

function staxXmlParserObject() {
  parseXmlToObject(xmlString);
}

function staxXmlParserConsume() {
  const parser = new StaxXmlParserSync(xmlString);
  for (const event of parser) {
    switch (event.type) {
      case XmlEventType.START_DOCUMENT:
      case XmlEventType.END_DOCUMENT:
        break;
      case XmlEventType.START_ELEMENT:
      case XmlEventType.CHARACTERS:
      case XmlEventType.CDATA:
      case XmlEventType.END_ELEMENT:
        // Do nothing, just consume the events
        break;
      case XmlEventType.ERROR:
        throw event.error;
    }
  }
}

function xml2jsParser() {
  xml2js.parseString(xmlString, function (err) {
    if (err) {
      throw err;
    }
  });
}

function txmlParser() {
  txml.parse(xmlString);
}

/**
 * Cursor consume — reads ALL the same information the event parser materialises.
 * For every START_ELEMENT:  name, localName, prefix, uri, and every attr name/localName/prefix/value/uri
 * For every END_ELEMENT:    name, localName, prefix, uri
 * For CHARACTERS/CDATA:     text (entity-decoded)
 */
function staxCursorConsume() {
  const cursor = new XmlCursorReader(xmlString);
  while (cursor.next()) {
    const t = cursor.eventType();
    switch (t) {
      case CursorEventType.START_ELEMENT: {
        cursor.name();
        cursor.localName();
        cursor.prefix();
        cursor.uri();
        const ac = cursor.getAttributeCount();
        for (let i = 0; i < ac; i++) {
          cursor.getAttributeName(i);
          cursor.getAttributeLocalName(i);
          cursor.getAttributePrefix(i);
          cursor.getAttributeValue(i);
          cursor.getAttributeUri(i);
        }
        break;
      }
      case CursorEventType.END_ELEMENT:
        cursor.name();
        cursor.localName();
        cursor.prefix();
        cursor.uri();
        break;
      case CursorEventType.CHARACTERS:
      case CursorEventType.CDATA:
        cursor.text();
        break;
    }
  }
}

if (shouldPrintHumanReadableBanner(cli)) {
  console.log('📊 XML Parser Benchmark - 2KB file (complex.xml)');
}

barplot(() => {
  summary(() => {
    bench('stax-xml cursor consume', () => staxCursorConsume()).gc('inner');
    bench('stax-xml to object', () => staxXmlParserObject()).gc('inner');
    bench('stax-xml consume', () => staxXmlParserConsume()).gc('inner');
    bench('xml2js', () => xml2jsParser()).gc('inner');
    bench('fast-xml-parser', () => fastXmlParser()).gc('inner');
    bench('txml', () => txmlParser()).gc('inner');
  });
});

await runMitataWithCli(cli);
