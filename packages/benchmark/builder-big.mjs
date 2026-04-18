import { XMLBuilder } from 'fast-xml-parser';
import { barplot, bench, summary } from 'mitata';
import { StaxXmlWriter, StaxXmlWriterSync } from 'stax-xml';
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
  const writer = new StaxXmlWriter(stream);
  await writer.writeStartDocument();
  await writeWriterTreeAsync(writer, bigWriterTree);
  await writer.writeEndDocument();
}

function staxXmlWriterBigJsonBuilderSync() {
  const writer = new StaxXmlWriterSync();
  writer.writeStartDocument();
  writeWriterTreeSync(writer, bigWriterTree);
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
