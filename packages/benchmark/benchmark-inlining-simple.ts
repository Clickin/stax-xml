/**
 * Simplified benchmark for comparing inlined vs baseline parsers
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

// Import both parser variants
import { StaxXmlParserSync as BaselineParser } from './parsers/baseline';
import { StaxXmlParserSync as InlinedParser } from './parsers/inlined';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface BenchmarkResult {
  variant: string;
  testFile: string;
  fileSize: number;
  iterations: number;
  totalTime: number;
  avgTime: number;
  throughputMBps: number;
  eventsPerSecond: number;
}

function parseXML(ParserClass: typeof BaselineParser, xml: string): number {
  const parser = new ParserClass(xml);
  let eventCount = 0;

  for (const event of parser) {
    eventCount++;
  }

  return eventCount;
}

function benchmark(
  name: string,
  ParserClass: typeof BaselineParser,
  xml: string,
  iterations: number = 10
): BenchmarkResult {
  const fileSize = Buffer.byteLength(xml, 'utf8');

  // Warmup
  for (let i = 0; i < 3; i++) {
    parseXML(ParserClass, xml);
  }

  // Actual benchmark
  const times: number[] = [];
  let totalEvents = 0;

  for (let i = 0; i < iterations; i++) {
    if (global.gc) global.gc();

    const start = performance.now();
    const events = parseXML(ParserClass, xml);
    const end = performance.now();

    times.push(end - start);
    totalEvents = events;
  }

  const totalTime = times.reduce((a, b) => a + b, 0);
  const avgTime = totalTime / iterations;
  const throughputMBps = (fileSize / 1024 / 1024) / (avgTime / 1000);
  const eventsPerSecond = totalEvents / (avgTime / 1000);

  return {
    variant: name,
    testFile: 'unknown',
    fileSize,
    iterations,
    totalTime,
    avgTime,
    throughputMBps,
    eventsPerSecond
  };
}

function formatNumber(num: number, decimals: number = 2): string {
  return num.toFixed(decimals).padStart(10);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  console.log('=== XML Parser Inlining Benchmark (Simplified) ===');
  console.log(`Node.js: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log();

  const testDataDir = path.join(__dirname, 'test-data');
  const testFiles = fs.readdirSync(testDataDir)
    .filter(f => f.endsWith('.xml'))
    .sort();

  if (testFiles.length === 0) {
    console.error('No test files found. Run: pnpm run generate:testdata');
    process.exit(1);
  }

  const results: BenchmarkResult[] = [];

  for (const testFile of testFiles) {
    const filePath = path.join(testDataDir, testFile);
    const xml = fs.readFileSync(filePath, 'utf8');
    const fileSize = fs.statSync(filePath).size;

    console.log(`\n${'='.repeat(70)}`);
    console.log(`Testing: ${testFile} (${formatBytes(fileSize)})`);
    console.log('='.repeat(70));

    // Benchmark baseline
    console.log('\n  Running baseline...');
    const baselineResult = benchmark('baseline', BaselineParser, xml, 10);
    baselineResult.testFile = testFile;
    results.push(baselineResult);

    console.log(`    Avg time: ${formatNumber(baselineResult.avgTime)} ms`);
    console.log(`    Throughput: ${formatNumber(baselineResult.throughputMBps)} MB/s`);
    console.log(`    Events/sec: ${formatNumber(baselineResult.eventsPerSecond)}`);

    // Benchmark inlined
    console.log('\n  Running inlined...');
    const inlinedResult = benchmark('inlined', InlinedParser, xml, 10);
    inlinedResult.testFile = testFile;
    results.push(inlinedResult);

    console.log(`    Avg time: ${formatNumber(inlinedResult.avgTime)} ms`);
    console.log(`    Throughput: ${formatNumber(inlinedResult.throughputMBps)} MB/s`);
    console.log(`    Events/sec: ${formatNumber(inlinedResult.eventsPerSecond)}`);

    // Calculate improvement
    const timeImprovement = ((baselineResult.avgTime - inlinedResult.avgTime) / baselineResult.avgTime) * 100;
    const throughputImprovement = ((inlinedResult.throughputMBps - baselineResult.throughputMBps) / baselineResult.throughputMBps) * 100;

    console.log('\n  Comparison:');
    console.log(`    Time improvement: ${timeImprovement > 0 ? '+' : ''}${formatNumber(timeImprovement)}%`);
    console.log(`    Throughput improvement: ${throughputImprovement > 0 ? '+' : ''}${formatNumber(throughputImprovement)}%`);
  }

  // Save results
  const resultsFile = path.join(__dirname, 'results', `benchmark-${Date.now()}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));

  console.log(`\n\n${'='.repeat(70)}`);
  console.log('Results saved to:', resultsFile);
  console.log('='.repeat(70));

  // Summary table
  console.log('\n\nSummary:');
  console.log('-'.repeat(120));
  console.log('Test File'.padEnd(25) + 'Variant'.padEnd(12) + 'Avg Time (ms)'.padStart(15) + 'Throughput (MB/s)'.padStart(20) + 'Events/sec'.padStart(20));
  console.log('-'.repeat(120));

  for (const result of results) {
    console.log(
      result.testFile.padEnd(25) +
      result.variant.padEnd(12) +
      formatNumber(result.avgTime) +
      formatNumber(result.throughputMBps) +
      formatNumber(result.eventsPerSecond)
    );
  }
  console.log('-'.repeat(120));
}

main().catch(console.error);
