import { XMLBuilder } from 'fast-xml-parser';
import { barplot, bench, run, summary } from 'mitata';
import { Builder } from "xml2js";
import { StaxXmlWriter } from '../dist/index.js';
import { ASSET_PATHS, loadJsonFile } from './common/utils.js';

const jsonOrderedContent = loadJsonFile(ASSET_PATHS.testOrdered);
const jsonContent = loadJsonFile(ASSET_PATHS.test);

// fast-xml-parser 벤치마크
function fastXmlParserBuilder() {
  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
  });
  builder.build(jsonOrderedContent);
}

// stax-xml 벤치마크 (test_ordered.json)
function staxXmlWriterBuilder() {
  const stream = new WritableStream<Uint8Array>()
  const writer = new StaxXmlWriter(stream, {
    prettyPrint: true,
    indentString: '  ',
  });

  function buildElement(element: any): void {
    if (Array.isArray(element)) {
      element.forEach(item => buildElement(item));
      return;
    }

    const tagName = Object.keys(element)[0] as string;
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
  stream.close();
}

// xml2js 벤치마크
function xml2jsBuilder() {
  const builder = new Builder({});
  builder.buildObject(jsonContent);
}

console.log('📊 XML Builder Benchmark - Small files (test_ordered.json)');

barplot(() => {
  summary(() => {
    bench('fast-xml-parser builder', () => fastXmlParserBuilder()).gc('inner');
    bench('stax-xml writer', () => staxXmlWriterBuilder()).gc('inner');
    bench('xml2js builder', () => xml2jsBuilder()).gc('inner');
  });
});

await run();