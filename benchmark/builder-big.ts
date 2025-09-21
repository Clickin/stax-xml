import { XMLBuilder } from 'fast-xml-parser';
import { barplot, bench, run, summary } from 'mitata';
import { StaxXmlWriter } from '../dist/index.js';
import { ASSET_PATHS, loadJsonFile } from './common/utils.js';

const bigJsonContent = loadJsonFile(ASSET_PATHS.big); // 1MB

// fast-xml-parser 벤치마크 (big.json)
function fastXmlParserBigJsonBuilder() {
  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
  });
  builder.build(bigJsonContent);
}

// Helper function to convert fast-xml-parser's JSON output to XML using StaxXmlWriter
function jsonToStaxXml(writer: StaxXmlWriter, jsonNode: any): void {
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
        const attrsForWriter: Record<string, string> = {};
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
  const stream = new WritableStream<Uint8Array>()
  const writer = new StaxXmlWriter(stream, {
    prettyPrint: true,
    indentString: '  ',
  });

  writer.writeStartDocument();
  jsonToStaxXml(writer, bigJsonContent);
  writer.writeEndDocument();
  stream.close()
}

console.log('📊 XML Builder Benchmark - Big file (1MB big.json)');

barplot(() => {
  summary(() => {
    bench('fast-xml-parser builder (big.json)', () => fastXmlParserBigJsonBuilder()).gc('inner');
    bench('stax-xml writer (big.json)', () => staxXmlWriterBigJsonBuilder()).gc('inner');
  });
});

await run();