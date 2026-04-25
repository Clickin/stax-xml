import { XMLParser } from 'fast-xml-parser';
import { barplot, bench, summary } from 'mitata';
import * as txml from 'txml';
import xml2js from 'xml2js';
import { parseMitataCliArgs, runMitataWithCli, shouldPrintHumanReadableBanner } from './common/mitata-cli.mjs';
import {
  createStaxParserSurfaceRunners,
  loadNativeAggregateProbe,
  parseXmlToObjectBaseline,
} from './common/parser-scenarios.mjs';
import { ASSET_PATHS, loadXmlBuffer } from './common/utils.mjs';

const cli = parseMitataCliArgs();
const inputBuffer = loadXmlBuffer(ASSET_PATHS.large);
const xmlString = inputBuffer.toString('utf8');
const nativeAggregate = await loadNativeAggregateProbe();
const staxSurfaceRunners = createStaxParserSurfaceRunners({ xmlString, inputBuffer, native: nativeAggregate });

if (shouldPrintHumanReadableBanner(cli)) {
  console.log('📊 XML Parser Benchmark - 98MB file (large.xml)');
}

barplot(() => {
  summary(() => {
    bench('stax-xml to object', () => parseXmlToObjectBaseline(xmlString)).gc('inner');
    for (const scenario of staxSurfaceRunners) {
      bench(scenario.label, scenario.run).gc('inner');
    }
    bench('xml2js', () => {
      xml2js.parseString(xmlString, (err) => {
        if (err) throw err;
      });
    }).gc('inner');
    bench('fast-xml-parser', () => {
      new XMLParser().parse(xmlString);
    }).gc('inner');
    bench('txml', () => {
      txml.parse(xmlString);
    }).gc('inner');
  });
});

await runMitataWithCli(cli);
