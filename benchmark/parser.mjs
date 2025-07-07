"use strict";

import { XMLParser } from 'fast-xml-parser';
import { readFileSync } from 'fs';
import { bench, run } from 'mitata';
import { dirname, join } from 'node:path';
import { ReadableStream } from 'node:stream/web';
import { fileURLToPath } from 'node:url';
import { TextEncoder } from 'node:util';
import * as txml from 'txml';
import xml2js from 'xml2js';
import { StaxXmlParserSync, XmlEventType } from '../dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
//const xmlPath = join(__dirname, './assets/large.xml'); // 98MB
//const xmlPath = join(__dirname, './assets/midsize.xml'); // 13MB
const xmlPath = join(__dirname, './assets/sample.xml'); // 1.5KB
function fastXmlParser() {
  const parser = new XMLParser();
  const xmlString = readFileSync(xmlPath, 'utf8').toString();
  parser.parse(xmlString);
}

// 웹 표준 API용 헬퍼 함수
function stringToReadableStream(str) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);

  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
}

// XML을 JavaScript 객체로 변환하는 함수
function parseXmlToObject(xmlContent) {
  const parser = new StaxXmlParserSync(xmlContent);
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
function txmlParser() {
  const xmlString = readFileSync(xmlPath, 'utf8').toString();
  txml.parse(xmlString);
}

bench('stax-xml', () => staxXmlParser()).gc('inner');
bench('xml2js', () => xml2jsParser()).gc('inner');
bench('fast-xml-parser', () => fastXmlParser()).gc('inner');
bench('txml', () => txmlParser()).gc('inner');

await run();