import { XMLParser } from 'fast-xml-parser';
import { barplot, bench, summary } from 'mitata';
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';
import * as txml from 'txml';
import xml2js from 'xml2js';
import { parseMitataCliArgs, runMitataWithCli, shouldPrintHumanReadableBanner } from './common/mitata-cli.mjs';
import { ASSET_PATHS, loadXmlFile } from './common/utils.mjs';

const cli = parseMitataCliArgs();
const xmlString = loadXmlFile(ASSET_PATHS.books);

function parseXmlToObjectBaseline(xml) {
  const parser = new StaxXmlParserSync(xml);
  const elementStack = [];
  let root = null;

  for (const event of parser) {
    elementStack.push(event);
    if (elementStack.length > 100) {
      elementStack.splice(0, elementStack.length);
    }
  }

  return root;
}

function consumeStaxXml() {
  const parser = new StaxXmlParserSync(xmlString);
  for (const event of parser) {
    switch (event.type) {
      case XmlEventType.START_DOCUMENT:
      case XmlEventType.END_DOCUMENT:
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

if (shouldPrintHumanReadableBanner(cli)) {
  console.log('📊 XML Parser Benchmark - 4KB file (books.xml)');
}

barplot(() => {
  summary(() => {
    bench('stax-xml to object', () => parseXmlToObjectBaseline(xmlString)).gc('inner');
    bench('stax-xml consume', () => consumeStaxXml()).gc('inner');
    bench('xml2js', () => {
      xml2js.parseString(xmlString, (err) => {
        if (err) throw err;
      });
    }).gc('inner');
    bench('fast-xml-parser', () => {
      new XMLParser().parse(xmlString);
    }).gc('inner');
    bench('txml', () => {
      txml.parse(xmlString);
    }).gc('inner');
  });
});

await runMitataWithCli(cli);
