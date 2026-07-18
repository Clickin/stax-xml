import { XMLBuilder } from 'fast-xml-parser';
import { barplot, bench, summary } from 'mitata';
import { Writer, WriterSync, WriterSyncSink } from 'stax-xml';
import { parseMitataCliArgs, runMitataWithCli, shouldPrintHumanReadableBanner } from './common/mitata-cli.mjs';
import { normalizeFxpWriterTree, writeWriterTreeAsync, writeWriterTreeSync } from './common/writer-tree.mjs';
import { ASSET_PATHS, loadJsonFile } from './common/utils.mjs';

const cli = parseMitataCliArgs();
const bigJsonContent = loadJsonFile(ASSET_PATHS.big);
const bigWriterTree = normalizeFxpWriterTree(bigJsonContent);

function fastXmlParserBigJsonBuilder() {
  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
  });
  builder.build(bigJsonContent);
}

async function staxXmlWriterBigJsonBuilder() {
  const stream = new WritableStream();
  const writer = new Writer(stream);
  await writeWriterTreeAsync(writer, bigWriterTree);
  await writer.writeEndDocument();
}

function staxXmlWriterBigJsonBuilderSync() {
  const writer = new WriterSync();
  writeWriterTreeSync(writer, bigWriterTree);
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

function staxXmlWriterBigJsonBuilderSyncSink() {
  const { sink, getCharsWritten } = createCountingSink();
  const writer = new WriterSyncSink(sink);
  writeWriterTreeSync(writer, bigWriterTree);
  writer.writeEndDocument();
  return getCharsWritten();
}

if (shouldPrintHumanReadableBanner(cli)) {
  console.log('📊 XML Builder Benchmark - Big file (1MB big.json)');
}

barplot(() => {
  summary(() => {
    bench('fast-xml-parser builder (big.json)', () => fastXmlParserBigJsonBuilder()).gc('inner');
    bench('stax-xml writer (big.json)', async () => await staxXmlWriterBigJsonBuilder()).gc('inner');
    bench('stax-xml writer sync (big.json)', () => staxXmlWriterBigJsonBuilderSync()).gc('inner');
    bench('stax-xml writer sync sink (big.json)', () => staxXmlWriterBigJsonBuilderSyncSink()).gc('inner');
  });
});

await runMitataWithCli(cli);
