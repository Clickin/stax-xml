"use strict";

import { XMLParser } from 'fast-xml-parser';
import { readFileSync } from 'fs';
import { bench, run } from 'mitata';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XmlEventType } from 'stax-xml';
import xml2js from 'xml2js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const xmlPath = join(__dirname, './assets/large.xml'); // 98MB

function fastXmlParser() {
  const parser = new XMLParser();
  const xmlString = readFileSync(xmlPath, 'utf8').toString();
  parser.parse(xmlString);
}


// XML을 JavaScript 객체로 변환하는 함수
function parseXmlToObject(xmlString) {
  const parser = new StaxXmlParser(xmlString);

  const elementStack = [];
  let currentElement = null;
  let root = null;

  for (const event of parser) {
    elementStack.push(event);
  }
  for (const event of elementStack.values()) {
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

function staxXmlParser() {
  const xmlString = readFileSync(xmlPath, 'utf8').toString();
  parseXmlToObject(xmlString);
}

function xml2jsParser() {
  const xmlString = readFileSync(xmlPath, 'utf8').toString();
  xml2js.parseString(xmlString, function (err) {
    if (err) {
      throw err;
    }
  })
}

bench('stax-xml', () => staxXmlParser()).gc('inner');
bench('xml2js', () => xml2jsParser()).gc('inner');
bench('fast-xml-parser', () => fastXmlParser()).gc('inner');

await run();