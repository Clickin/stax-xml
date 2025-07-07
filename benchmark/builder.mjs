import { XMLBuilder } from 'fast-xml-parser';
import { readFileSync } from 'fs';
import { bench, run } from 'mitata';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Builder } from "xml2js";
import { StaxXmlWriter } from '../dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonOrderedPath = join(__dirname, './assets/test_ordered.json');
const jsonPath = join(__dirname, './assets/test.json');
const jsonOrderedContent = JSON.parse(readFileSync(jsonOrderedPath, 'utf8'));
const jsonContent = JSON.parse(readFileSync(jsonPath, 'utf8'));
// fast-xml-parser 벤치마크
function fastXmlParserBuilder() {
  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
    // fast-xml-parser의 기본 옵션과 유사하게 설정
    // StaxXmlWriter와 비교를 위해 selfClosingTags: true로 설정
    selfClosingTags: true,
  });
  builder.build(jsonOrderedContent);
}

// stax-xml 벤치마크
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
function xml2jsBuilder() {

  const builder = new Builder({

  });
  builder.buildObject(jsonContent);
}

bench('fast-xml-parser builder', () => fastXmlParserBuilder()).gc('inner');
bench('stax-xml writer', () => staxXmlWriterBuilder()).gc('inner');
bench('xml2js builder', () => xml2jsBuilder()).gc('inner');
await run();
