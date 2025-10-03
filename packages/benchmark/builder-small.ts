import { XMLBuilder } from 'fast-xml-parser';
import { barplot, bench, run, summary } from 'mitata';
import { Builder } from "xml2js";
import { StaxXmlWriter, StaxXmlWriterSync } from 'stax-xml';
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
async function staxXmlWriterBuilder() {
  const stream = new WritableStream<Uint8Array>()
  const writer = new StaxXmlWriter(stream, {
    prettyPrint: true,
    indentString: '  ',
  });

  async function buildElement(element: any): Promise<void> {
    if (Array.isArray(element)) {
      for (const item of element) {
        await buildElement(item);
      }
      return;
    }

    const tagName = Object.keys(element)[0] as string;
    const content = element[tagName];

    if (Array.isArray(content)) {
      if (content.length === 0) {
        // Handle empty arrays as empty elements
        await writer.writeStartElement(tagName);
        await writer.writeEndElement();
      } else {
        for (const item of content) {
          if (item['#text'] !== undefined) {
            await writer.writeStartElement(tagName);
            await writer.writeCharacters(String(item['#text']));
            await writer.writeEndElement();
          } else if (Object.keys(item).length === 0) { // emptyNode, empty element
            await writer.writeStartElement(tagName);
            await writer.writeEndElement();
          } else {
            await writer.writeStartElement(tagName);
            await buildElement(item);
            await writer.writeEndElement();
          }
        }
      }
    } else if (content['#text'] !== undefined) {
      await writer.writeStartElement(tagName);
      await writer.writeCharacters(String(content['#text']));
      await writer.writeEndElement();
    } else if (Object.keys(content).length === 0) { // emptyNode, empty element
      await writer.writeStartElement(tagName);
      await writer.writeEndElement();
    } else {
      await writer.writeStartElement(tagName);
      await buildElement(content);
      await writer.writeEndElement();
    }
  }

  await writer.writeStartDocument();
  await buildElement(jsonOrderedContent);
  await writer.writeEndDocument();
}

// stax-xml 벤치마크 (test_ordered.json)
function staxXmlWriterBuilderSync() {
  const stream = new WritableStream<Uint8Array>()
  const writer = new StaxXmlWriterSync({
    prettyPrint: true,
    indentString: '  ',
  });

  function buildElement(element: any): void {
    if (Array.isArray(element)) {
      for (const item of element) {
        buildElement(item);
      }
      return;
    }

    const tagName = Object.keys(element)[0] as string;
    const content = element[tagName];

    if (Array.isArray(content)) {
      if (content.length === 0) {
        // Handle empty arrays as empty elements
        writer.writeStartElement(tagName);
        writer.writeEndElement();
      } else {
        for (const item of content) {
          if (item['#text'] !== undefined) {
            writer.writeStartElement(tagName);
            writer.writeCharacters(String(item['#text']));
            writer.writeEndElement();
          } else if (Object.keys(item).length === 0) { // emptyNode, empty element
            writer.writeStartElement(tagName);
            writer.writeEndElement();
          } else {
            writer.writeStartElement(tagName);
            buildElement(item);
            writer.writeEndElement();
          }
        }
      }
    } else if (content['#text'] !== undefined) {
      writer.writeStartElement(tagName);
      writer.writeCharacters(String(content['#text']));
      writer.writeEndElement();
    } else if (Object.keys(content).length === 0) { // emptyNode, empty element
      writer.writeStartElement(tagName);
      writer.writeEndElement();
    } else {
      writer.writeStartElement(tagName);
      buildElement(content);
      writer.writeEndElement();
    }
  }

  writer.writeStartDocument();
  buildElement(jsonOrderedContent);
  writer.writeEndDocument();
  return writer.getXmlString();
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
    bench('stax-xml writer', async () => await staxXmlWriterBuilder()).gc('inner');
    bench('stax-xml writer sync', () => staxXmlWriterBuilderSync()).gc('inner');
    bench('xml2js builder', () => xml2jsBuilder()).gc('inner');
  });
});

await run();