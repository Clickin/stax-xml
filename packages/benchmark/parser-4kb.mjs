import { barplot, bench, summary } from 'mitata';
import { parseMitataCliArgs, runMitataWithCli, shouldPrintHumanReadableBanner } from './common/mitata-cli.mjs';
import {
  assertParserSurfaceParity,
  createStaxParserSurfaceRunners,
} from './common/parser-scenarios.mjs';
import { ASSET_PATHS, loadXmlBuffer } from './common/utils.mjs';

const cli = parseMitataCliArgs();
const inputBuffer = loadXmlBuffer(ASSET_PATHS.books);
const xmlString = inputBuffer.toString('utf8');
await assertParserSurfaceParity({ assetPath: ASSET_PATHS.books, xmlString, inputBuffer });
const staxSurfaceRunners = createStaxParserSurfaceRunners({ assetPath: ASSET_PATHS.books, xmlString, inputBuffer });

if (shouldPrintHumanReadableBanner(cli)) {
  console.log('📊 XML Parser Benchmark - 4KB file (books.xml)');
}

barplot(() => {
  summary(() => {
    for (const scenario of staxSurfaceRunners) {
      bench(scenario.label, scenario.run).gc('inner');
    }
  });
});

await runMitataWithCli(cli);
