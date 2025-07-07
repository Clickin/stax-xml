import { XMLBuilder } from 'fast-xml-parser';
import { readFileSync } from 'fs';
import { barplot, bench, run, summary } from 'mitata';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Builder } from "xml2js";
import { StaxXmlWriter } from '../dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonOrderedPath = join(__dirname, './assets/test_ordered.json');
const jsonPath = join(__dirname, './assets/test.json');
const bigJsonPath = join(__dirname, './assets/big.json'); // 1MB

const jsonOrderedContent = JSON.parse(readFileSync(jsonOrderedPath, 'utf8'));
const jsonContent = JSON.parse(readFileSync(jsonPath, 'utf8'));
const bigJsonContent = JSON.parse(readFileSync(bigJsonPath, 'utf8'));

// fast-xml-parser 벤치마크
function fastXmlParserBuilder() {
  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
    selfClosingTags: true,
  });
  builder.build(jsonOrderedContent);
}
function fastXmlParserBigJsonBuilder() {
  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
    selfClosingTags: true,
  });
  builder.build(bigJsonContent);
}

// stax-xml 벤치마크 (test_ordered.json)
function staxXmlWriterBuilder() {
  const writer = new StaxXmlWriter({
    prettyPrint: true,
    indentString: '  ',
  });

  function buildElement(element) {
    if (Array.isArray(element)) {
      element.forEach(item => buildElement(item));
      return;
    }

    const tagName = Object.keys(element)[0];
    const content = element[tagName];

    if (Array.isArray(content)) {
      content.forEach(item => {
        if (item['#text'] !== undefined) {
          writer.writeStartElement(tagName);
          writer.writeCharacters(String(item['#text']));
          writer.writeEndElement();
        } else if (Object.keys(item).length === 0) { // emptyNode, selfclosing
          writer.writeStartElement(tagName, { selfClosing: true });
        } else {
          writer.writeStartElement(tagName);
          buildElement(item);
          writer.writeEndElement();
        }
      });
    } else if (content['#text'] !== undefined) {
      writer.writeStartElement(tagName);
      writer.writeCharacters(String(content['#text']));
      writer.writeEndElement();
    } else if (Object.keys(content).length === 0) { // emptyNode, selfclosing
      writer.writeStartElement(tagName, { selfClosing: true });
    } else {
      writer.writeStartElement(tagName);
      buildElement(content);
      writer.writeEndElement();
    }
  }

  writer.writeStartDocument();
  buildElement(jsonOrderedContent);
  writer.writeEndDocument();
  writer.getXmlString();
}

// xml2js 벤치마크
function xml2jsBuilder() {
  const builder = new Builder({});
  builder.buildObject(jsonContent);
}

// Helper function to convert fast-xml-parser's JSON output to XML using StaxXmlWriter
function jsonToStaxXml(writer, jsonNode) {
  if (Array.isArray(jsonNode)) {
    for (const item of jsonNode) {
      jsonToStaxXml(writer, item);
    }
  } else if (typeof jsonNode === 'object' && jsonNode !== null) {
    for (const key in jsonNode) {
      if (key === '_attr') {
        // Attributes are handled when writing the start element
        continue;
      } else if (key === '__text') {
        // Text content is handled after writing the start element
        continue;
      } else {
        const tagName = key;
        const content = jsonNode[key];
        const attributes = jsonNode[key]._attr || {};
        const textContent = jsonNode[key].__text;

        // Convert attributes object to a simple string-string map for StaxXmlWriter
        const attrsForWriter = {};
        for (const attrKey in attributes) {
          attrsForWriter[attrKey.startsWith('@_') ? attrKey.substring(2) : attrKey] = attributes[attrKey];
        }

        if (Object.keys(content).length === 0 && !textContent) { // Self-closing tag
          writer.writeStartElement(tagName, { attributes: attrsForWriter, selfClosing: true });
        } else {
          writer.writeStartElement(tagName, { attributes: attrsForWriter });
          if (textContent !== undefined) {
            writer.writeCharacters(String(textContent));
          }
          jsonToStaxXml(writer, content); // Recursively handle child elements
          writer.writeEndElement();
        }
      }
    }
  } else if (jsonNode !== undefined && jsonNode !== null) {
    // Handle primitive values as text content if they are directly under an element
    // This case is typically handled by the __text property, but as a fallback
    writer.writeCharacters(String(jsonNode));
  }
}

// StaxXmlWriter 벤치마크 (big.json)
function staxXmlWriterBigJsonBuilder() {
  const writer = new StaxXmlWriter({
    prettyPrint: true,
    indentString: '  ',
  });

  writer.writeStartDocument();
  jsonToStaxXml(writer, bigJsonContent);
  writer.writeEndDocument();
  writer.getXmlString();
}

barplot(() => {
  summary(() => {
    bench('fast-xml-parser builder', () => fastXmlParserBuilder()).gc('inner');
    bench('stax-xml writer (test_ordered.json)', () => staxXmlWriterBuilder()).gc('inner');
    bench('xml2js builder', () => xml2jsBuilder()).gc('inner');
    bench('fast-xml-parser builder (big.json)', () => fastXmlParserBigJsonBuilder()).gc('inner');
    bench('stax-xml writer (big.json)', () => staxXmlWriterBigJsonBuilder()).gc('inner');
  });
});

await run();
