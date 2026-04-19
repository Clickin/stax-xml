import { XMLBuilder } from 'fast-xml-parser';
import { barplot, bench, summary } from 'mitata';
import { Builder } from 'xml2js';
import { StaxXmlWriter, StaxXmlWriterSync, StaxXmlWriterSyncSink } from 'stax-xml';
import { parseMitataCliArgs, runMitataWithCli, shouldPrintHumanReadableBanner } from './common/mitata-cli.mjs';
import { normalizeOrderedWriterTree, writeWriterTreeAsync, writeWriterTreeSync } from './common/writer-tree.mjs';
import { ASSET_PATHS, loadJsonFile } from './common/utils.mjs';

const cli = parseMitataCliArgs();
const jsonOrderedContent = loadJsonFile(ASSET_PATHS.testOrdered);
const jsonContent = loadJsonFile(ASSET_PATHS.test);
const orderedWriterTree = normalizeOrderedWriterTree(jsonOrderedContent);

function fastXmlParserBuilder() {
  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
  });
  builder.build(jsonOrderedContent);
}

async function staxXmlWriterBuilder() {
  const stream = new WritableStream();
  const writer = new StaxXmlWriter(stream, {
    prettyPrint: true,
    indentString: '  ',
  });

  await writer.writeStartDocument();
  await writeWriterTreeAsync(writer, orderedWriterTree);
  await writer.writeEndDocument();
}

function staxXmlWriterBuilderSync() {
  const writer = new StaxXmlWriterSync({
    prettyPrint: true,
    indentString: '  ',
  });

  writer.writeStartDocument();
  writeWriterTreeSync(writer, orderedWriterTree);
  writer.writeEndDocument();
  return writer.getXmlString();
}

function createCountingSink() {
  let charsWritten = 0;

  return {
    sink: {
      write(chunk) {
        charsWritten += chunk.length;
      }
    },
    getCharsWritten: () => charsWritten
  };
}

function staxXmlWriterBuilderSyncSink() {
  const { sink, getCharsWritten } = createCountingSink();
  const writer = new StaxXmlWriterSyncSink(sink, {
    prettyPrint: true,
    indentString: '  ',
  });

  writer.writeStartDocument();
  writeWriterTreeSync(writer, orderedWriterTree);
  writer.writeEndDocument();
  return getCharsWritten();
}

function xml2jsBuilder() {
  const builder = new Builder({});
  builder.buildObject(jsonContent);
}

if (shouldPrintHumanReadableBanner(cli)) {
  console.log('📊 XML Builder Benchmark - Small files (test_ordered.json)');
}

barplot(() => {
  summary(() => {
    bench('fast-xml-parser builder', () => fastXmlParserBuilder()).gc('inner');
    bench('stax-xml writer', async () => await staxXmlWriterBuilder()).gc('inner');
    bench('stax-xml writer sync', () => staxXmlWriterBuilderSync()).gc('inner');
    bench('stax-xml writer sync sink', () => staxXmlWriterBuilderSyncSink()).gc('inner');
    bench('xml2js builder', () => xml2jsBuilder()).gc('inner');
  });
});

await runMitataWithCli(cli);
