import { XMLBuilder } from 'fast-xml-parser';
import { barplot, bench, summary } from 'mitata';
import { StaxXmlWriter, StaxXmlWriterSync } from 'stax-xml';
import { parseMitataCliArgs, runMitataWithCli, shouldPrintHumanReadableBanner } from './common/mitata-cli.mjs';
import { ASSET_PATHS, loadJsonFile } from './common/utils.mjs';

const cli = parseMitataCliArgs();
const bigJsonContent = loadJsonFile(ASSET_PATHS.big);

function fastXmlParserBigJsonBuilder() {
  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
  });
  builder.build(bigJsonContent);
}

async function jsonToStaxXml(writer, jsonNode) {
  if (Array.isArray(jsonNode)) {
    for (const item of jsonNode) {
      await jsonToStaxXml(writer, item);
    }
    return;
  }
  if (typeof jsonNode === 'object' && jsonNode !== null) {
    for (const key in jsonNode) {
      if (key === '_attr' || key === '__text') {
        continue;
      }

      const tagName = key;
      const content = jsonNode[key];
      const attributes = jsonNode[key]._attr || {};
      const textContent = jsonNode[key].__text;
      const attrsForWriter = {};

      for (const attrKey in attributes) {
        attrsForWriter[attrKey.startsWith('@_') ? attrKey.substring(2) : attrKey] = attributes[attrKey];
      }

      if (Object.keys(content).length === 0 && !textContent) {
        await writer.writeStartElement(tagName, { attributes: attrsForWriter, selfClosing: true });
      } else {
        await writer.writeStartElement(tagName, { attributes: attrsForWriter });
        if (textContent !== undefined) {
          await writer.writeCharacters(String(textContent));
        }
        await jsonToStaxXml(writer, content);
        await writer.writeEndElement();
      }
    }
    return;
  }

  if (jsonNode !== undefined && jsonNode !== null) {
    await writer.writeCharacters(String(jsonNode));
  }
}

async function staxXmlWriterBigJsonBuilder() {
  const stream = new WritableStream();
  const writer = new StaxXmlWriter(stream);
  await writer.writeStartDocument();
  await jsonToStaxXml(writer, bigJsonContent);
  await writer.writeEndDocument();
}

function jsonToStaxXmlSync(writer, jsonNode) {
  if (Array.isArray(jsonNode)) {
    for (const item of jsonNode) {
      jsonToStaxXmlSync(writer, item);
    }
    return;
  }
  if (typeof jsonNode === 'object' && jsonNode !== null) {
    for (const key in jsonNode) {
      if (key === '_attr' || key === '__text') {
        continue;
      }

      const tagName = key;
      const content = jsonNode[key];
      const attributes = jsonNode[key]._attr || {};
      const textContent = jsonNode[key].__text;
      const attrsForWriter = {};

      for (const attrKey in attributes) {
        attrsForWriter[attrKey.startsWith('@_') ? attrKey.substring(2) : attrKey] = attributes[attrKey];
      }

      if (Object.keys(content).length === 0 && !textContent) {
        writer.writeStartElement(tagName, { attributes: attrsForWriter, selfClosing: true });
      } else {
        writer.writeStartElement(tagName, { attributes: attrsForWriter });
        if (textContent !== undefined) {
          writer.writeCharacters(String(textContent));
        }
        jsonToStaxXmlSync(writer, content);
        writer.writeEndElement();
      }
    }
    return;
  }

  if (jsonNode !== undefined && jsonNode !== null) {
    writer.writeCharacters(String(jsonNode));
  }
}

function staxXmlWriterBigJsonBuilderSync() {
  const writer = new StaxXmlWriterSync();
  writer.writeStartDocument();
  jsonToStaxXmlSync(writer, bigJsonContent);
  writer.writeEndDocument();
  return writer.getXmlString();
}

if (shouldPrintHumanReadableBanner(cli)) {
  console.log('📊 XML Builder Benchmark - Big file (1MB big.json)');
}

barplot(() => {
  summary(() => {
    bench('fast-xml-parser builder (big.json)', () => fastXmlParserBigJsonBuilder()).gc('inner');
    bench('stax-xml writer (big.json)', async () => await staxXmlWriterBigJsonBuilder()).gc('inner');
    bench('stax-xml writer sync (big.json)', () => staxXmlWriterBigJsonBuilderSync()).gc('inner');
  });
});

await runMitataWithCli(cli);
