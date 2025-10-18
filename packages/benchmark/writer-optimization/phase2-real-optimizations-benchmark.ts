/**
 * Phase 2: Real Optimizations Benchmark
 *
 * Purpose: Test 3 specific optimizations that should actually work:
 * 1. Regex caching in _escapeXml() - avoid creating regex on every call
 * 2. Attribute string batching - reduce _write() call overhead
 * 3. Early entity check - skip regex when text has no entities to escape
 *
 * Decision Criteria:
 * ✅ ACCEPT: Average improvement > +5% AND no regressions
 * ⚠️  CONDITIONAL: Average improvement +3-5%
 * ❌ REJECT: Average improvement < +3% OR any regression > -5%
 */

import { performance } from 'node:perf_hooks';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import implementations
import { StaxXmlWriterSync as BaselineSync } from '../../stax-xml/src/StaxXmlWriterSync.baseline';
import { StaxXmlWriterSync as OptimizedSync } from '../../stax-xml/src/StaxXmlWriterSync.optimized';

interface TestResult {
  name: string;
  elementCount: number;
  baseline: {
    totalTime: number;
    avgTimePerElement: number;
    throughput: number; // elements per second
  };
  optimized: {
    totalTime: number;
    avgTimePerElement: number;
    throughput: number;
  };
  improvement: number; // percentage
  speedup: number; // multiplier
}

interface BenchmarkSummary {
  timestamp: string;
  tests: TestResult[];
  summary: {
    averageImprovement: number;
    bestImprovement: number;
    worstImprovement: number;
    bestTest: string;
    worstTest: string;
    decision: 'accept' | 'conditional' | 'reject';
    reason: string;
  };
}

/**
 * Run a benchmark test with specific XML pattern
 */
function runBenchmark(
  testName: string,
  elementCount: number,
  generateXml: (WriterClass: any, count: number) => string
): TestResult {
  console.log(`\nTest: ${testName} (${elementCount.toLocaleString()} elements)`);

  // Warmup
  for (let i = 0; i < 3; i++) {
    generateXml(BaselineSync, Math.min(100, elementCount));
    generateXml(OptimizedSync, Math.min(100, elementCount));
  }

  // Benchmark baseline
  const baselineStart = performance.now();
  const baselineXml = generateXml(BaselineSync, elementCount);
  const baselineEnd = performance.now();
  const baselineTime = baselineEnd - baselineStart;

  // Benchmark optimized
  const optimizedStart = performance.now();
  const optimizedXml = generateXml(OptimizedSync, elementCount);
  const optimizedEnd = performance.now();
  const optimizedTime = optimizedEnd - optimizedStart;

  // Verify output is identical
  if (baselineXml !== optimizedXml) {
    throw new Error(`Output mismatch for test ${testName}!`);
  }

  // Calculate metrics
  const improvement = ((baselineTime - optimizedTime) / baselineTime) * 100;
  const speedup = baselineTime / optimizedTime;

  console.log(`  Baseline:   ${baselineTime.toFixed(2)}ms`);
  console.log(`  Optimized:  ${optimizedTime.toFixed(2)}ms`);
  console.log(`  Improvement: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}% ${improvement > 5 ? '✓' : improvement > 3 ? '~' : improvement > 0 ? '·' : '✗'}`);

  return {
    name: testName,
    elementCount,
    baseline: {
      totalTime: baselineTime,
      avgTimePerElement: baselineTime / elementCount,
      throughput: (elementCount / baselineTime) * 1000
    },
    optimized: {
      totalTime: optimizedTime,
      avgTimePerElement: optimizedTime / elementCount,
      throughput: (elementCount / optimizedTime) * 1000
    },
    improvement,
    speedup
  };
}

/**
 * Test 1: Attribute-heavy XML
 * Should benefit from Optimization #2 (attribute batching)
 */
function generateAttributeHeavy(WriterClass: any, count: number): string {
  const writer = new WriterClass();
  writer.writeStartDocument();
  writer.writeStartElement('root');

  for (let i = 0; i < count; i++) {
    writer.writeStartElement('item', {
      attributes: {
        id: String(i),
        type: 'product',
        category: 'electronics',
        status: 'active',
        priority: String(i % 10),
        version: '1.0'
      }
    });
    writer.writeCharacters('data');
    writer.writeEndElement();
  }

  writer.writeEndElement();
  writer.writeEndDocument();
  return writer.getXmlString();
}

/**
 * Test 2: Text-heavy XML with entities
 * Should benefit from Optimization #1 (regex caching) and #3 (early check)
 */
function generateTextHeavy(WriterClass: any, count: number): string {
  const writer = new WriterClass();
  writer.writeStartDocument();
  writer.writeStartElement('root');

  for (let i = 0; i < count; i++) {
    writer.writeStartElement('item');
    // Text with entities that need escaping
    writer.writeCharacters(`Text with <special> characters & "quotes" and 'apostrophes' - item ${i}`);
    writer.writeEndElement();
  }

  writer.writeEndElement();
  writer.writeEndDocument();
  return writer.getXmlString();
}

/**
 * Test 3: Text without entities
 * Should benefit significantly from Optimization #3 (early entity check)
 */
function generateTextNoEntities(WriterClass: any, count: number): string {
  const writer = new WriterClass();
  writer.writeStartDocument();
  writer.writeStartElement('root');

  for (let i = 0; i < count; i++) {
    writer.writeStartElement('item');
    // Clean text with no entities
    writer.writeCharacters(`Plain text without any special characters - item ${i}`);
    writer.writeEndElement();
  }

  writer.writeEndElement();
  writer.writeEndDocument();
  return writer.getXmlString();
}

/**
 * Test 4: Mixed content (attributes + text with entities)
 * Should benefit from all 3 optimizations
 */
function generateMixedContent(WriterClass: any, count: number): string {
  const writer = new WriterClass();
  writer.writeStartDocument();
  writer.writeStartElement('root');

  for (let i = 0; i < count; i++) {
    writer.writeStartElement('item', {
      attributes: {
        id: String(i),
        name: `Item ${i}`,
        type: 'mixed'
      }
    });
    writer.writeCharacters(`Content with <tags> & "quotes" - ${i}`);
    writer.writeEndElement();
  }

  writer.writeEndElement();
  writer.writeEndDocument();
  return writer.getXmlString();
}

/**
 * Test 5: Deeply nested structure with attributes
 * Tests optimization under different call patterns
 */
function generateDeepNested(WriterClass: any, count: number): string {
  const writer = new WriterClass();
  writer.writeStartDocument();
  writer.writeStartElement('root');

  const depth = 5;
  const itemsPerLevel = Math.ceil(Math.pow(count, 1 / depth));

  function writeLevel(currentDepth: number, remaining: number): number {
    if (currentDepth >= depth || remaining <= 0) return remaining;

    const itemsThisLevel = Math.min(itemsPerLevel, remaining);
    for (let i = 0; i < itemsThisLevel; i++) {
      writer.writeStartElement('node', {
        attributes: {
          level: String(currentDepth),
          index: String(i),
          path: `L${currentDepth}I${i}`
        }
      });
      writer.writeCharacters(`Level ${currentDepth} Item ${i}`);
      remaining = writeLevel(currentDepth + 1, remaining - 1);
      writer.writeEndElement();
    }
    return remaining;
  }

  writeLevel(0, count);
  writer.writeEndElement();
  writer.writeEndDocument();
  return writer.getXmlString();
}

/**
 * Test 6: Realistic document structure
 * Mix of all patterns as would appear in real-world XML
 */
function generateRealistic(WriterClass: any, count: number): string {
  const writer = new WriterClass();
  writer.writeStartDocument();
  writer.writeStartElement('catalog');

  for (let i = 0; i < count; i++) {
    writer.writeStartElement('product', {
      attributes: {
        id: String(i),
        sku: `SKU-${1000 + i}`
      }
    });

    writer.writeStartElement('name');
    writer.writeCharacters(`Product ${i}`);
    writer.writeEndElement();

    writer.writeStartElement('description');
    writer.writeCharacters(`High-quality product with <advanced> features & "premium" materials`);
    writer.writeEndElement();

    writer.writeStartElement('price', {
      attributes: {
        currency: 'USD',
        taxIncluded: 'true'
      }
    });
    writer.writeCharacters(String(19.99 + i * 0.5));
    writer.writeEndElement();

    writer.writeStartElement('metadata');
    writer.writeCharacters('additional data without special chars');
    writer.writeEndElement();

    writer.writeEndElement();
  }

  writer.writeEndElement();
  writer.writeEndDocument();
  return writer.getXmlString();
}

/**
 * Main benchmark execution
 */
function runAllBenchmarks(): BenchmarkSummary {
  console.log('=== Real Optimizations Benchmark ===\n');
  console.log('Testing 3 optimizations:');
  console.log('  1. Regex caching in _escapeXml()');
  console.log('  2. Attribute string batching');
  console.log('  3. Early entity check before regex execution');
  console.log();

  const results: TestResult[] = [];

  // Small document tests (1,000 elements)
  console.log('--- Small Documents (1,000 elements) ---');
  results.push(runBenchmark('attribute-heavy-small', 1000, generateAttributeHeavy));
  results.push(runBenchmark('text-with-entities-small', 1000, generateTextHeavy));
  results.push(runBenchmark('text-no-entities-small', 1000, generateTextNoEntities));
  results.push(runBenchmark('mixed-content-small', 1000, generateMixedContent));
  results.push(runBenchmark('deep-nested-small', 1000, generateDeepNested));
  results.push(runBenchmark('realistic-small', 1000, generateRealistic));

  // Large document tests (50,000 elements)
  console.log('\n--- Large Documents (50,000 elements) ---');
  results.push(runBenchmark('attribute-heavy-large', 50000, generateAttributeHeavy));
  results.push(runBenchmark('text-with-entities-large', 50000, generateTextHeavy));
  results.push(runBenchmark('text-no-entities-large', 50000, generateTextNoEntities));
  results.push(runBenchmark('mixed-content-large', 50000, generateMixedContent));
  results.push(runBenchmark('deep-nested-large', 50000, generateDeepNested));
  results.push(runBenchmark('realistic-large', 50000, generateRealistic));

  // Calculate summary statistics
  const improvements = results.map(r => r.improvement);
  const averageImprovement = improvements.reduce((a, b) => a + b, 0) / improvements.length;
  const bestImprovement = Math.max(...improvements);
  const worstImprovement = Math.min(...improvements);
  const bestTest = results.find(r => r.improvement === bestImprovement)!.name;
  const worstTest = results.find(r => r.improvement === worstImprovement)!.name;

  // Decision logic
  let decision: 'accept' | 'conditional' | 'reject';
  let reason: string;

  const hasRegression = worstImprovement < -5;
  const allPositive = worstImprovement >= 0;

  if (hasRegression) {
    decision = 'reject';
    reason = `Significant regression detected (${worstImprovement.toFixed(1)}% in ${worstTest}). Optimizations are not safe.`;
  } else if (averageImprovement >= 5 && allPositive) {
    decision = 'accept';
    reason = `Strong improvement (${averageImprovement.toFixed(1)}% average) with no regressions. All optimizations working as expected.`;
  } else if (averageImprovement >= 3) {
    decision = 'conditional';
    reason = `Moderate improvement (${averageImprovement.toFixed(1)}% average). Consider accepting if specific use cases benefit more.`;
  } else {
    decision = 'reject';
    reason = `Insufficient improvement (${averageImprovement.toFixed(1)}% average, below +3% threshold). Optimizations provide minimal benefit.`;
  }

  // Print summary
  console.log('\n=== Summary ===\n');
  console.log(`Average improvement: ${averageImprovement >= 0 ? '+' : ''}${averageImprovement.toFixed(1)}%`);
  console.log(`Best case: ${bestImprovement >= 0 ? '+' : ''}${bestImprovement.toFixed(1)}% (${bestTest})`);
  console.log(`Worst case: ${worstImprovement >= 0 ? '+' : ''}${worstImprovement.toFixed(1)}% (${worstTest})`);
  console.log();
  console.log(`Decision: ${decision === 'accept' ? '✅ ACCEPT' : decision === 'conditional' ? '⚠️  CONDITIONAL' : '❌ REJECT'}`);
  console.log(`Reason: ${reason}`);
  console.log();

  return {
    timestamp: new Date().toISOString(),
    tests: results,
    summary: {
      averageImprovement,
      bestImprovement,
      worstImprovement,
      bestTest,
      worstTest,
      decision,
      reason
    }
  };
}

/**
 * Save results to JSON
 */
function saveResults(summary: BenchmarkSummary): void {
  const resultsDir = path.join(__dirname, 'results');
  mkdirSync(resultsDir, { recursive: true });

  const resultsPath = path.join(resultsDir, 'phase2-results.json');
  writeFileSync(resultsPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`Results saved to: ${resultsPath}`);
}

/**
 * Generate detailed report in Markdown
 */
function generateReport(summary: BenchmarkSummary): void {
  const resultsDir = path.join(__dirname, 'results');
  mkdirSync(resultsDir, { recursive: true });

  let markdown = `# Real Optimizations Benchmark Report\n\n`;
  markdown += `**Date:** ${new Date(summary.timestamp).toLocaleString()}\n\n`;

  // Decision
  const decisionEmoji = summary.summary.decision === 'accept' ? '✅' : summary.summary.decision === 'conditional' ? '⚠️' : '❌';
  markdown += `## Decision: ${decisionEmoji} ${summary.summary.decision.toUpperCase()}\n\n`;
  markdown += `${summary.summary.reason}\n\n`;

  // Summary Statistics
  markdown += `## Summary Statistics\n\n`;
  markdown += `| Metric | Value |\n`;
  markdown += `|--------|-------|\n`;
  markdown += `| Average Improvement | ${summary.summary.averageImprovement >= 0 ? '+' : ''}${summary.summary.averageImprovement.toFixed(1)}% |\n`;
  markdown += `| Best Case | ${summary.summary.bestImprovement >= 0 ? '+' : ''}${summary.summary.bestImprovement.toFixed(1)}% (${summary.summary.bestTest}) |\n`;
  markdown += `| Worst Case | ${summary.summary.worstImprovement >= 0 ? '+' : ''}${summary.summary.worstImprovement.toFixed(1)}% (${summary.summary.worstTest}) |\n\n`;

  // Optimizations Tested
  markdown += `## Optimizations Tested\n\n`;
  markdown += `1. **Regex Caching**: Pre-compile regex patterns at construction time instead of creating them on every _escapeXml() call\n`;
  markdown += `2. **Attribute String Batching**: Build complete attribute string before calling _write() to reduce function call overhead\n`;
  markdown += `3. **Early Entity Check**: Use fast string.includes() checks to skip regex execution when text has no entities\n\n`;

  // Detailed Results
  markdown += `## Detailed Results\n\n`;
  markdown += `### Small Documents (1,000 elements)\n\n`;
  markdown += `| Test | Baseline | Optimized | Improvement | Speedup |\n`;
  markdown += `|------|----------|-----------|-------------|----------|\n`;
  summary.tests.filter(t => t.elementCount === 1000).forEach(result => {
    markdown += `| ${result.name} | ${result.baseline.totalTime.toFixed(2)}ms | ${result.optimized.totalTime.toFixed(2)}ms | ${result.improvement >= 0 ? '+' : ''}${result.improvement.toFixed(1)}% | ${result.speedup.toFixed(2)}x |\n`;
  });

  markdown += `\n### Large Documents (50,000 elements)\n\n`;
  markdown += `| Test | Baseline | Optimized | Improvement | Speedup |\n`;
  markdown += `|------|----------|-----------|-------------|----------|\n`;
  summary.tests.filter(t => t.elementCount === 50000).forEach(result => {
    markdown += `| ${result.name} | ${result.baseline.totalTime.toFixed(2)}ms | ${result.optimized.totalTime.toFixed(2)}ms | ${result.improvement >= 0 ? '+' : ''}${result.improvement.toFixed(1)}% | ${result.speedup.toFixed(2)}x |\n`;
  });

  // Analysis by Test Type
  markdown += `\n## Analysis by Test Type\n\n`;

  const testTypes = [
    { pattern: 'attribute-heavy', name: 'Attribute-Heavy', expectedBenefit: 'Optimization #2 (attribute batching)' },
    { pattern: 'text-with-entities', name: 'Text with Entities', expectedBenefit: 'Optimizations #1 (regex caching) and #3 (early check)' },
    { pattern: 'text-no-entities', name: 'Text without Entities', expectedBenefit: 'Optimization #3 (early entity check - should be biggest win)' },
    { pattern: 'mixed-content', name: 'Mixed Content', expectedBenefit: 'All 3 optimizations' },
    { pattern: 'deep-nested', name: 'Deep Nested', expectedBenefit: 'All 3 optimizations under different call patterns' },
    { pattern: 'realistic', name: 'Realistic Document', expectedBenefit: 'All 3 optimizations in real-world scenario' }
  ];

  testTypes.forEach(type => {
    const typeResults = summary.tests.filter(t => t.name.includes(type.pattern));
    const avgImprovement = typeResults.reduce((sum, r) => sum + r.improvement, 0) / typeResults.length;

    markdown += `### ${type.name}\n\n`;
    markdown += `**Expected benefit:** ${type.expectedBenefit}\n\n`;
    markdown += `**Average improvement:** ${avgImprovement >= 0 ? '+' : ''}${avgImprovement.toFixed(1)}%\n\n`;
    markdown += `| Size | Improvement |\n`;
    markdown += `|------|-------------|\n`;
    typeResults.forEach(result => {
      markdown += `| ${result.elementCount.toLocaleString()} | ${result.improvement >= 0 ? '+' : ''}${result.improvement.toFixed(1)}% |\n`;
    });
    markdown += `\n`;
  });

  // Recommendations
  markdown += `## Recommendations\n\n`;

  if (summary.summary.decision === 'accept') {
    markdown += `The optimizations show consistent, meaningful improvement across all test cases. Recommended next steps:\n\n`;
    markdown += `1. **Apply to main codebase**: Replace baseline implementation with optimized version\n`;
    markdown += `2. **Update async Writer**: Apply same optimizations to StaxXmlWriterAsync\n`;
    markdown += `3. **Add benchmarks to CI**: Include these benchmarks in continuous integration to detect regressions\n`;
    markdown += `4. **Document optimizations**: Add comments explaining the optimization techniques for future maintainers\n\n`;
  } else if (summary.summary.decision === 'conditional') {
    markdown += `The optimizations show moderate improvement. Consider:\n\n`;
    markdown += `1. **Profile specific use cases**: If your primary use case matches the tests with higher improvement, accept\n`;
    markdown += `2. **Investigate further**: Some optimizations may work better than others - consider applying selectively\n`;
    markdown += `3. **Measure in production**: Test with real-world data patterns before committing\n\n`;
  } else {
    markdown += `The optimizations do not provide sufficient benefit or show regressions. Recommended actions:\n\n`;
    markdown += `1. **Keep baseline implementation**: Current implementation is already well-optimized\n`;
    markdown += `2. **Investigate regressions**: If any test shows regression, investigate why\n`;
    markdown += `3. **Look for other opportunities**: Consider different optimization strategies\n\n`;
  }

  // Optimization Impact Analysis
  markdown += `## Optimization Impact Analysis\n\n`;
  markdown += `Based on the results, estimated individual contribution of each optimization:\n\n`;

  const textNoEntitiesAvg = summary.tests
    .filter(t => t.name.includes('text-no-entities'))
    .reduce((sum, r) => sum + r.improvement, 0) / 2;
  const attributeHeavyAvg = summary.tests
    .filter(t => t.name.includes('attribute-heavy'))
    .reduce((sum, r) => sum + r.improvement, 0) / 2;
  const textWithEntitiesAvg = summary.tests
    .filter(t => t.name.includes('text-with-entities'))
    .reduce((sum, r) => sum + r.improvement, 0) / 2;

  markdown += `| Optimization | Estimated Impact | Evidence |\n`;
  markdown += `|--------------|-----------------|----------|\n`;
  markdown += `| #3: Early Entity Check | ${textNoEntitiesAvg >= 0 ? '+' : ''}${textNoEntitiesAvg.toFixed(1)}% | text-no-entities tests show pure impact |\n`;
  markdown += `| #2: Attribute Batching | ${attributeHeavyAvg >= 0 ? '+' : ''}${attributeHeavyAvg.toFixed(1)}% | attribute-heavy tests emphasize this |\n`;
  markdown += `| #1: Regex Caching | ${textWithEntitiesAvg >= 0 ? '+' : ''}${textWithEntitiesAvg.toFixed(1)}% | text-with-entities combined with early check |\n\n`;

  // Technical Details
  markdown += `## Technical Details\n\n`;
  markdown += `### Implementation Changes\n\n`;
  markdown += `#### Optimization 1: Regex Caching\n`;
  markdown += `\`\`\`typescript\n`;
  markdown += `// Before: Created on every _escapeXml() call\n`;
  markdown += `const regex = new RegExp(Object.keys(entityMap).join('|'), 'g');\n\n`;
  markdown += `// After: Created once at construction time\n`;
  markdown += `private static readonly BASIC_ENTITY_REGEX = /[&<>"']/g;\n`;
  markdown += `private customEntityRegex?: RegExp; // Built in constructor if needed\n`;
  markdown += `\`\`\`\n\n`;

  markdown += `#### Optimization 2: Attribute String Batching\n`;
  markdown += `\`\`\`typescript\n`;
  markdown += `// Before: Multiple _write() calls\n`;
  markdown += `this._write(\` \${key}="\${value}"\`);\n\n`;
  markdown += `// After: Single _write() with batched string\n`;
  markdown += `let attrString = '';\n`;
  markdown += `// ... build attrString ...\n`;
  markdown += `this._write(attrString);\n`;
  markdown += `\`\`\`\n\n`;

  markdown += `#### Optimization 3: Early Entity Check\n`;
  markdown += `\`\`\`typescript\n`;
  markdown += `// Fast check before regex\n`;
  markdown += `const hasBasicEntities = text.includes('&') || text.includes('<') || ...;\n`;
  markdown += `if (!hasBasicEntities && !hasCustomEntities) {\n`;
  markdown += `  return text; // Skip expensive regex\n`;
  markdown += `}\n`;
  markdown += `\`\`\`\n\n`;

  // Footer
  markdown += `---\n\n`;
  markdown += `*Generated by phase2-real-optimizations-benchmark.ts*\n`;

  const reportPath = path.join(resultsDir, 'real-optimizations-report.md');
  writeFileSync(reportPath, markdown, 'utf-8');
  console.log(`Report saved to: ${reportPath}`);
}

// Run the benchmark
const summary = runAllBenchmarks();
saveResults(summary);
generateReport(summary);

// Exit with appropriate code
process.exit(summary.summary.decision === 'reject' ? 1 : 0);
