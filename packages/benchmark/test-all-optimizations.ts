/**
 * Simple test of all optimizations
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

// Import parsers
import { StaxXmlParserSync as Baseline } from './parsers/baseline';
import { StaxXmlParserSync as FastAttr } from './parsers/fastattr';
import { StaxXmlParserSync as FastEntity } from './parsers/fastentity';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseXML(ParserClass: typeof Baseline, xml: string): number {
  const parser = new ParserClass(xml);
  let eventCount = 0;
  for (const event of parser) {
    eventCount++;
  }
  return eventCount;
}

interface BenchResult {
  name: string;
  avgTime: number;
  minTime: number;
  maxTime: number;
  stdDev: number;
}

function benchmark(name: string, ParserClass: typeof Baseline, xml: string, iterations: number = 50): BenchResult {
  // Warmup
  for (let i = 0; i < 5; i++) {
    parseXML(ParserClass, xml);
    if (global.gc) global.gc();
  }

  // Measure
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    if (global.gc) global.gc();
    const start = performance.now();
    parseXML(ParserClass, xml);
    times.push(performance.now() - start);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);

  return {
    name,
    avgTime: avg,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    stdDev
  };
}

async function main() {
  console.log('=== Testing All Optimizations ===\n');

  const testPatterns = [
    'attribute-heavy.xml',
    'text-heavy.xml',
    'medium-nested.xml',
    'small-simple.xml'
  ];

  for (const pattern of testPatterns) {
    const testFile = path.join(__dirname, 'test-data', pattern);

    if (!fs.existsSync(testFile)) {
      console.log(`⚠️  ${pattern} not found, skipping...`);
      continue;
    }

    const xml = fs.readFileSync(testFile, 'utf8');
    const fileSize = fs.statSync(testFile).size;

    console.log('\n' + '='.repeat(80));
    console.log(`${pattern} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log('='.repeat(80));

    // Test all variants
    const results: BenchResult[] = [];

    console.log('Testing baseline...');
    results.push(benchmark('baseline', Baseline, xml));

    console.log('Testing parseAttributesFastV2...');
    results.push(benchmark('fastattr', FastAttr, xml));

    console.log('Testing fast entity decode...');
    results.push(benchmark('fastentity', FastEntity, xml));

    // Display results
    console.log('\nResults:');
    console.log('-'.repeat(80));
    console.log('Variant'.padEnd(20) + 'Avg (ms)'.padStart(12) + 'Min (ms)'.padStart(12) + 'Max (ms)'.padStart(12) + 'StdDev'.padStart(12));
    console.log('-'.repeat(80));

    for (const result of results) {
      console.log(
        result.name.padEnd(20) +
        result.avgTime.toFixed(2).padStart(12) +
        result.minTime.toFixed(2).padStart(12) +
        result.maxTime.toFixed(2).padStart(12) +
        result.stdDev.toFixed(2).padStart(12)
      );
    }

    // Comparison
    const baselineTime = results[0].avgTime;
    console.log('\nComparison to baseline:');
    console.log('-'.repeat(80));

    for (let i = 1; i < results.length; i++) {
      const improvement = ((baselineTime - results[i].avgTime) / baselineTime) * 100;
      const verdict = improvement > 5 ? '✅ Significant' : improvement > 0 ? '~ Minor' : '❌ Regression';
      console.log(`${results[i].name.padEnd(20)}: ${improvement > 0 ? '+' : ''}${improvement.toFixed(2)}% ${verdict}`);
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log('\nOptimizations tested:');
  console.log('  1. parseAttributesFastV2 - Manual attribute parsing (no regex)');
  console.log('  2. Fast entity decode - Fast path for common entities');
  console.log('\nBest results expected on:');
  console.log('  - attribute-heavy.xml (for parseAttributesFast)');
  console.log('  - text-heavy.xml (for entity decoding)');
}

main().catch(console.error);
