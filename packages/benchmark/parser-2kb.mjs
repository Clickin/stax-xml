import { barplot, bench, summary } from 'mitata';
import { parseMitataCliArgs, runMitataWithCli, shouldPrintHumanReadableBanner } from './common/mitata-cli.mjs';
import {
  assertStaxParserSurfaceParity,
  createStaxParserSurfaceRunners,
} from './common/parser-scenarios.mjs';
import { ASSET_PATHS, loadXmlBuffer } from './common/utils.mjs';

const cli = parseMitataCliArgs();
const inputBuffer = loadXmlBuffer(ASSET_PATHS.complex);
const xmlString = inputBuffer.toString('utf8');
assertStaxParserSurfaceParity({ assetPath: ASSET_PATHS.complex, xmlString, inputBuffer });
const staxSurfaceRunners = createStaxParserSurfaceRunners({ assetPath: ASSET_PATHS.complex, xmlString, inputBuffer });

if (shouldPrintHumanReadableBanner(cli)) {
  console.log('📊 XML Parser Benchmark - 2KB file (complex.xml)');
}

barplot(() => {
  summary(() => {
    for (const scenario of staxSurfaceRunners) {
      bench(scenario.label, scenario.run).gc('inner');
    }
  });
});

await runMitataWithCli(cli);
