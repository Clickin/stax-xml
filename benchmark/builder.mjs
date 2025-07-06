import { readFileSync } from 'fs';
import { bench, run } from 'mitata';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLBuilder } from 'fast-xml-parser';
import { StaxXmlWriter } from '../dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(__dirname, './assets/test_ordered.json');
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
  builder.build(jsonContent);
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
  buildElement(jsonContent);
  writer.writeEndDocument();
  writer.getXmlString();
}

bench('fast-xml-parser builder', () => fastXmlParserBuilder()).gc('inner');
bench('stax-xml writer', () => staxXmlWriterBuilder()).gc('inner');

await run();
