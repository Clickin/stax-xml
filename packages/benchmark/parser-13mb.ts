import { XMLParser } from 'fast-xml-parser';
import { barplot, bench, run, summary } from 'mitata';
//@ts-ignore
import { StaxXmlParserSync, StaxXmlStreamReaderSync, XmlEventType, type AnyXmlEvent } from 'stax-xml';
import * as txml from 'txml';
import xml2js from 'xml2js';
import { ASSET_PATHS, loadXmlFile } from './common/utils.js';

const xmlString = loadXmlFile(ASSET_PATHS.midsize); // 4KB

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

function staxXmlCursorConsume() {
  const cursor = new StaxXmlStreamReaderSync(xmlString);
  while (cursor.hasNext()) {
    switch (cursor.next()) {
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
        throw new Error('XmlEventType.ERROR');
    }
  }
}

async function xml2jsParser() {
  xml2js.parseString(xmlString, function (err) {
    if (err) {
      throw err;
    }
  });
}

function txmlParser() {
  txml.parse(xmlString);
}

console.log('📊 XML Parser Benchmark - 13MB file (midsize.xml)');

barplot(() => {
  summary(() => {
    bench('stax-xml to object', () => staxXmlParserObject()).gc('inner');
    bench('stax-xml consume', () => staxXmlParserConsume()).gc('inner');
    bench('stax-xml cursor consume', () => staxXmlCursorConsume()).gc('inner');
    bench('xml2js', async () => await xml2jsParser()).gc('inner');
    bench('fast-xml-parser', () => fastXmlParser()).gc('inner');
    bench('txml', () => txmlParser()).gc('inner');
  });
});

await run();
