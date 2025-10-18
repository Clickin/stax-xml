/**
 * Quick test for parseAttributesFast optimization
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

// Import both variants
import { StaxXmlParserSync as Baseline } from './parsers/baseline';
import { StaxXmlParserSync as FastAttr } from './parsers/fastattr';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseXML(ParserClass: typeof Baseline, xml: string): number {
  const parser = new ParserClass(xml);
  let eventCount = 0;
  for (const event of parser) {
    eventCount++;
  }
  return eventCount;
}

async function main() {
  console.log('=== Testing parseAttributesFast Optimization ===\n');

  // Test with attribute-heavy file (biggest impact expected)
  const testFile = path.join(__dirname, 'test-data', 'attribute-heavy.xml');

  if (!fs.existsSync(testFile)) {
    console.error('Test file not found. Run: pnpm run generate:testdata');
    process.exit(1);
  }

  const xml = fs.readFileSync(testFile, 'utf8');
  const fileSize = fs.statSync(testFile).size;

  console.log(`Test file: attribute-heavy.xml (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`This file has MANY attributes - perfect for testing attribute parsing!\n`);

  const iterations = 50;

  // Warmup
  console.log('Warming up...');
  for (let i = 0; i < 5; i++) {
    parseXML(Baseline, xml);
    parseXML(FastAttr, xml);
    if (global.gc) global.gc();
  }

  // Benchmark baseline
  console.log('\nBenchmarking baseline...');
  const baselineTimes: number[] = [];
  let baselineEvents = 0;

  for (let i = 0; i < iterations; i++) {
    if (global.gc) global.gc();
    const start = performance.now();
    baselineEvents = parseXML(Baseline, xml);
    baselineTimes.push(performance.now() - start);
  }

  const baselineAvg = baselineTimes.reduce((a, b) => a + b, 0) / baselineTimes.length;
  const baselineMin = Math.min(...baselineTimes);
  const baselineMax = Math.max(...baselineTimes);

  console.log(`  Average: ${baselineAvg.toFixed(2)} ms`);
  console.log(`  Min: ${baselineMin.toFixed(2)} ms`);
  console.log(`  Max: ${baselineMax.toFixed(2)} ms`);
  console.log(`  Events: ${baselineEvents}`);

  // Benchmark optimized
  console.log('\nBenchmarking optimized (parseAttributesFastV2)...');
  const optimizedTimes: number[] = [];
  let optimizedEvents = 0;

  for (let i = 0; i < iterations; i++) {
    if (global.gc) global.gc();
    const start = performance.now();
    optimizedEvents = parseXML(FastAttr, xml);
    optimizedTimes.push(performance.now() - start);
  }

  const optimizedAvg = optimizedTimes.reduce((a, b) => a + b, 0) / optimizedTimes.length;
  const optimizedMin = Math.min(...optimizedTimes);
  const optimizedMax = Math.max(...optimizedTimes);

  console.log(`  Average: ${optimizedAvg.toFixed(2)} ms`);
  console.log(`  Min: ${optimizedMin.toFixed(2)} ms`);
  console.log(`  Max: ${optimizedMax.toFixed(2)} ms`);
  console.log(`  Events: ${optimizedEvents}`);

  // Comparison
  const improvement = ((baselineAvg - optimizedAvg) / baselineAvg) * 100;
  const speedup = baselineAvg / optimizedAvg;

  console.log('\n' + '='.repeat(70));
  console.log('RESULTS');
  console.log('='.repeat(70));
  console.log(`Improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(2)}%`);
  console.log(`Speedup: ${speedup.toFixed(2)}x`);
  console.log(`Time saved: ${(baselineAvg - optimizedAvg).toFixed(2)} ms per parse`);

  if (improvement > 5) {
    console.log('\n✅ SIGNIFICANT IMPROVEMENT! This optimization is worth keeping.');
  } else if (improvement > 0) {
    console.log('\n~ Minor improvement. May be worth keeping depending on use case.');
  } else {
    console.log('\n❌ REGRESSION! This optimization made things worse.');
  }

  console.log('\nNote: parseAttributesFast was 59% of runtime in profiling.');
  console.log('Expected improvement: 15-25% overall if this optimization works.');
}

main().catch(console.error);
