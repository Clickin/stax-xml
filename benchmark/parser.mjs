"use strict";

import { XMLParser } from 'fast-xml-parser';
import { readFileSync } from 'fs';
import { barplot, bench, run, summary } from 'mitata';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as txml from 'txml';
import xml2js from 'xml2js';
import { StaxXmlParserSync, XmlEventType } from '../dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const xmlPath = join(__dirname, './assets/large.xml'); // 98MB
//const xmlPath = join(__dirname, './assets/midsize.xml'); // 13MB
//const xmlPath = join(__dirname, './assets/complex.xml'); // 2KB
//const xmlPath = join(__dirname, './assets/books.xml'); // 4KB
//const xmlPath = join(__dirname, './assets/sample.xml'); // 1.5KB
const xmlString = readFileSync(xmlPath, 'utf8').toString();

// XML을 JavaScript 객체로 변환하는 함수
function parseXmlToObject(xmlString) {
  const parser = new StaxXmlParserSync(xmlString);
  let elementStack = [];
  let currentElement = null;
  let root = null;

  for (const event of parser) {
    switch (event.type) {
      case XmlEventType.START_DOCUMENT:
        // 문서 시작 - 아무것도 하지 않음
        break;

      case XmlEventType.START_ELEMENT:
        const startEvent = event;
        const newElement = {
          name: startEvent.name,
          attributes: { ...startEvent.attributes },
          children: [],
          text: ''
        };

        if (currentElement) {
          currentElement.children.push(newElement);
          elementStack.push(currentElement);
        } else {
          root = newElement;
        }
        currentElement = newElement;
        break;

      case XmlEventType.CHARACTERS:
        const charEvent = event;
        if (currentElement && charEvent.value.trim()) {
          currentElement.text += charEvent.value;
        }
        break;

      case XmlEventType.CDATA:
        const cdataEvent = event;
        if (currentElement) {
          currentElement.text += cdataEvent.value;
        }
        break;

      case XmlEventType.END_ELEMENT:
        if (elementStack.length > 0) {
          currentElement = elementStack.pop();
        } else {
          currentElement = null;
        }
        break;

      case XmlEventType.END_DOCUMENT:
        // 문서 끝
        break;

      case XmlEventType.ERROR:
        throw (event).error;
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
  })
}
function txmlParser() {
  txml.parse(xmlString);
}
barplot(() => {
  summary(() => {

    bench('stax-xml to object', () => staxXmlParserObject()).gc('inner');
    bench('stax-xml consume', () => staxXmlParserConsume()).gc('inner');
    bench('xml2js', () => xml2jsParser()).gc('inner')
    bench('fast-xml-parser', () => fastXmlParser()).gc('inner')
    bench('txml', () => txmlParser()).gc('inner')
  })
})

await run();