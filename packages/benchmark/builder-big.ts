import { XMLBuilder } from 'fast-xml-parser';
import { barplot, bench, summary } from 'mitata';
import { StaxXmlWriter, StaxXmlWriterSync } from 'stax-xml';
import { parseMitataCliArgs, runMitataWithCli, shouldPrintHumanReadableBanner } from './common/mitata-cli.js';
import { normalizeFxpWriterTree, writeWriterTreeAsync, writeWriterTreeSync } from './common/writer-tree.js';
import { ASSET_PATHS, loadJsonFile } from './common/utils.js';

const cli = parseMitataCliArgs();

const bigJsonContent = loadJsonFile(ASSET_PATHS.big); // 1MB
const bigWriterTree = normalizeFxpWriterTree(bigJsonContent);

// fast-xml-parser 벤치마크 (big.json)
function fastXmlParserBigJsonBuilder() {
  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
  });
  builder.build(bigJsonContent);
}

// StaxXmlWriter 벤치마크 (big.json)
async function staxXmlWriterBigJsonBuilder() {
  const stream = new WritableStream<Uint8Array>()
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
    bench('stax-xml writer (big.json)', () => staxXmlWriterBigJsonBuilder()).gc('inner');
    bench('stax-xml writer sync (big.json)', () => staxXmlWriterBigJsonBuilderSync()).gc('inner');
  });
});

await runMitataWithCli(cli);
