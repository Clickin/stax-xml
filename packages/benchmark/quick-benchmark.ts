/**
 * Quick benchmark runner for rapid iteration during optimization work
 * Focuses on a single test pattern with detailed GC and memory analysis
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { benchmarkWithGC, compareBenchmarks, forceGC } from './benchmark-gc-pressure.js';
import { MemoryTracker, HeapProfiler } from './memory-tracker.js';
import { welchTTest, formatStatisticalReport } from './statistical-analysis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Simple XML generator for quick tests
function generateQuickTestXML(size: 'small' | 'medium' | 'large'): string {
  switch (size) {
    case 'small':
      return `<?xml version="1.0"?>
<root>
  ${Array.from({ length: 100 }, (_, i) =>
    `<item id="${i}" name="item${i}" value="${Math.random()}">${Math.random().toString(36)}</item>`
  ).join('\n  ')}
</root>`;

    case 'medium':
      return `<?xml version="1.0"?>
<root>
  ${Array.from({ length: 1000 }, (_, i) => `
  <record id="${i}">
    <data>${Array.from({ length: 10 }, (_, j) =>
      `<field name="field${j}">${Math.random().toString(36)}</field>`
    ).join('')}</data>
  </record>`).join('')}
</root>`;

    case 'large':
      return `<?xml version="1.0"?>
<catalog>
  ${Array.from({ length: 5000 }, (_, i) => `
  <product id="P${i}" sku="SKU${i}" category="cat${i % 10}">
    <name>Product ${i}</name>
    <description>${Math.random().toString(36).repeat(10)}</description>
    <price>${(Math.random() * 1000).toFixed(2)}</price>
    <attributes>
      ${Array.from({ length: 5 }, (_, j) =>
        `<attr name="attr${j}" value="${Math.random().toString(36)}"/>`
      ).join('\n      ')}
    </attributes>
  </product>`).join('')}
</catalog>`;
  }
}

// Quick benchmark function
async function quickBenchmark(options: {
  baseline: string;
  optimized: string;
  testSize?: 'small' | 'medium' | 'large';
  iterations?: number;
  showHeapInfo?: boolean;
}): Promise<void> {
  const {
    baseline: baselinePath,
    optimized: optimizedPath,
    testSize = 'medium',
    iterations = 50,
    showHeapInfo = false
  } = options;

  console.log('='.repeat(80));
  console.log('QUICK BENCHMARK');
  console.log('='.repeat(80));
  console.log(`Test size: ${testSize}`);
  console.log(`Iterations: ${iterations}`);
  console.log(`Baseline: ${baselinePath}`);
  console.log(`Optimized: ${optimizedPath}`);
  console.log('');

  // Check --expose-gc
  if (!(global as any).gc) {
    console.warn('⚠️  WARNING: --expose-gc not enabled');
    console.warn('   Run with: node --expose-gc quick-benchmark.js\n');
  }

  // Generate test XML
  const xml = generateQuickTestXML(testSize);
  console.log(`Generated test XML: ${(xml.length / 1024).toFixed(2)} KB\n`);

  // Import modules dynamically
  const baselineModule = await import(baselinePath);
  const optimizedModule = await import(optimizedPath);

  const BaselineParser = baselineModule.StaxXmlParserSync || baselineModule.default;
  const OptimizedParser = optimizedModule.StaxXmlParserSync || optimizedModule.default;

  if (!BaselineParser || !OptimizedParser) {
    console.error('ERROR: Could not load parser classes');
    process.exit(1);
  }

  // Show initial heap info
  if (showHeapInfo) {
    HeapProfiler.printHeapInfo('Initial Heap State');
  }

  // Force GC and settle
  forceGC();
  await new Promise(resolve => setTimeout(resolve, 100));

  // === BASELINE BENCHMARK ===
  console.log('Running BASELINE benchmark...');
  const baselineResult = await benchmarkWithGC(
    'baseline',
    () => {
      const parser = new BaselineParser();
      parser.write(xml);
      parser.end();
      parser.getEvents();
    },
    iterations,
    10
  );

  if (showHeapInfo) {
    HeapProfiler.printHeapInfo('After Baseline');
  }

  // Force GC and settle
  forceGC();
  await new Promise(resolve => setTimeout(resolve, 100));

  // === OPTIMIZED BENCHMARK ===
  console.log('\nRunning OPTIMIZED benchmark...');
  const optimizedResult = await benchmarkWithGC(
    'optimized',
    () => {
      const parser = new OptimizedParser();
      parser.write(xml);
      parser.end();
      parser.getEvents();
    },
    iterations,
    10
  );

  if (showHeapInfo) {
    HeapProfiler.printHeapInfo('After Optimized');
  }

  // === COMPARISON ===
  console.log('\n' + '='.repeat(80));
  console.log('COMPARISON');
  console.log('='.repeat(80));

  const comparison = compareBenchmarks(baselineResult, optimizedResult);
  console.log('\n' + comparison.analysis);

  // Statistical analysis
  const stats = formatStatisticalReport(
    baselineResult.times,
    optimizedResult.times,
    'Baseline',
    'Optimized'
  );
  console.log(stats);

  // Detailed GC comparison
  console.log('\n' + '='.repeat(80));
  console.log('GC DETAILS');
  console.log('='.repeat(80));
  console.log('\nBaseline:');
  console.log(`  Major GCs: ${baselineResult.gcMetrics.majorGCCount}`);
  console.log(`  Minor GCs: ${baselineResult.gcMetrics.minorGCCount}`);
  console.log(`  Total GC time: ${baselineResult.gcMetrics.totalGCTime.toFixed(2)} ms`);
  console.log(`  Avg GC pause: ${baselineResult.gcMetrics.avgGCPause.toFixed(2)} ms`);
  console.log(`  Max GC pause: ${baselineResult.gcMetrics.maxGCPause.toFixed(2)} ms`);
  console.log(`  Heap delta: ${baselineResult.gcMetrics.heapUsedDelta.toFixed(2)} MB`);

  console.log('\nOptimized:');
  console.log(`  Major GCs: ${optimizedResult.gcMetrics.majorGCCount}`);
  console.log(`  Minor GCs: ${optimizedResult.gcMetrics.minorGCCount}`);
  console.log(`  Total GC time: ${optimizedResult.gcMetrics.totalGCTime.toFixed(2)} ms`);
  console.log(`  Avg GC pause: ${optimizedResult.gcMetrics.avgGCPause.toFixed(2)} ms`);
  console.log(`  Max GC pause: ${optimizedResult.gcMetrics.maxGCPause.toFixed(2)} ms`);
  console.log(`  Heap delta: ${optimizedResult.gcMetrics.heapUsedDelta.toFixed(2)} MB`);

  // === VERDICT ===
  console.log('\n' + '='.repeat(80));
  console.log('VERDICT');
  console.log('='.repeat(80));

  const tTest = welchTTest(baselineResult.times, optimizedResult.times);

  if (tTest.significant) {
    if (tTest.improvement > 5) {
      console.log('✓ ACCEPT: Statistically significant performance improvement');
      console.log(`  - ${tTest.improvement.toFixed(1)}% faster`);
      console.log(`  - Speedup: ${comparison.speedup.toFixed(2)}x`);
    } else if (tTest.improvement < -5) {
      console.log('✗ REJECT: Statistically significant performance regression');
      console.log(`  - ${Math.abs(tTest.improvement).toFixed(1)}% slower`);
      console.log(`  - Speedup: ${comparison.speedup.toFixed(2)}x`);
    } else {
      console.log('~ NEUTRAL: Minimal performance difference');
    }
  } else {
    console.log('~ INCONCLUSIVE: No statistically significant difference');
    console.log(`  - Performance change: ${tTest.improvement.toFixed(1)}%`);
    console.log(`  - p-value: ${tTest.pValue.toFixed(4)} (not significant at 95% confidence)`);
  }

  // Check memory regression
  if (comparison.memoryImprovement < -50) {
    console.log('✗ WARNING: Significant memory regression detected!');
    console.log(`  - ${Math.abs(comparison.memoryImprovement).toFixed(1)}% more heap usage`);
    console.log('  - This optimization should be rejected');
  } else if (comparison.memoryImprovement < -10) {
    console.log('⚠️  CAUTION: Minor memory regression detected');
    console.log(`  - ${Math.abs(comparison.memoryImprovement).toFixed(1)}% more heap usage`);
  }

  // Check GC pressure
  if (comparison.gcReduction < -50) {
    console.log('✗ WARNING: Significant GC pressure increase!');
    console.log(`  - ${Math.abs(comparison.gcReduction).toFixed(1)}% more GC events`);
  }

  console.log('');
}

// CLI interface
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node --expose-gc quick-benchmark.js <baseline-path> <optimized-path> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --size <small|medium|large>  Test data size (default: medium)');
    console.log('  --iterations <n>             Number of iterations (default: 50)');
    console.log('  --heap                       Show detailed heap info');
    console.log('');
    console.log('Example:');
    console.log('  node --expose-gc quick-benchmark.js \\');
    console.log('    ../stax-xml/src/StaxXmlParserSync.baseline.js \\');
    console.log('    ../stax-xml/src/StaxXmlParserSync.js \\');
    console.log('    --size medium --iterations 100');
    process.exit(1);
  }

  const options = {
    baseline: args[0],
    optimized: args[1],
    testSize: 'medium' as 'small' | 'medium' | 'large',
    iterations: 50,
    showHeapInfo: false
  };

  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--size') {
      options.testSize = args[++i] as 'small' | 'medium' | 'large';
    } else if (args[i] === '--iterations') {
      options.iterations = parseInt(args[++i], 10);
    } else if (args[i] === '--heap') {
      options.showHeapInfo = true;
    }
  }

  quickBenchmark(options).catch(console.error);
}

export { quickBenchmark, generateQuickTestXML };
