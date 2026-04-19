/**
 * Comprehensive benchmark for testing parser/writer optimizations
 * Measures time, GC pressure, memory allocation, and statistical significance
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { benchmarkWithGC, compareBenchmarks } from './benchmark-gc-pressure.mjs';
import { welchTTest, formatStatisticalReport } from './statistical-analysis.mjs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Import parser/writer variants
import { StaxXmlParserSync as BaselineParser } from '../stax-xml/src/StaxXmlParserSync.baseline.js';
import { StaxXmlParserSync as InlinedParser } from '../stax-xml/src/StaxXmlParserSync.inlined.js';
import { StaxXmlParserSync as CurrentParser } from '../stax-xml/src/StaxXmlParserSync.js';
import { StaxXmlWriterSync as BaselineWriter } from '../stax-xml/src/StaxXmlWriterSync.js';
import { StaxXmlWriterSync as StringArrayWriter } from '../stax-xml/src/StaxXmlWriterSync.stringarray.js';
const parserVariants = [
    {
        name: 'baseline',
        description: 'Original implementation without optimizations',
        Parser: BaselineParser
    },
    {
        name: 'current',
        description: 'Current implementation with applied optimizations',
        Parser: CurrentParser
    },
    {
        name: 'inlined',
        description: 'Experimental inlined version (previously failed)',
        Parser: InlinedParser
    }
];
const writerVariants = [
    {
        name: 'baseline',
        description: 'Original string concatenation implementation',
        Writer: BaselineWriter
    },
    {
        name: 'string-array',
        description: 'String array with join() optimization',
        Writer: StringArrayWriter
    }
];
// Load test patterns
function getTestPatterns() {
    const testDataDir = path.join(__dirname, 'test-data');
    const patterns = [
        {
            name: 'small-simple',
            description: 'Small XML (~500B)',
            filePath: path.join(testDataDir, 'small-simple.xml')
        },
        {
            name: 'medium-nested',
            description: 'Medium nested XML (~50KB)',
            filePath: path.join(testDataDir, 'medium-nested.xml')
        },
        {
            name: 'attribute-heavy',
            description: 'Many attributes per element (~1MB)',
            filePath: path.join(testDataDir, 'attribute-heavy.xml')
        },
        {
            name: 'text-heavy',
            description: 'Large text content (~2MB)',
            filePath: path.join(testDataDir, 'text-heavy.xml')
        },
        {
            name: 'mixed-content',
            description: 'Mixed content types (~1MB)',
            filePath: path.join(testDataDir, 'mixed-content.xml')
        }
    ];
    // Load content for patterns that exist
    for (const pattern of patterns) {
        if (fs.existsSync(pattern.filePath)) {
            pattern.content = fs.readFileSync(pattern.filePath, 'utf8');
        }
    }
    // Filter to only patterns with content
    return patterns.filter(p => p.content !== undefined);
}
// Main benchmark runner
async function runComprehensiveBenchmark(options) {
    const { iterations = 100, warmup = 10, saveResults = true, compareToBaseline = true } = options;
    console.log('='.repeat(80));
    console.log('COMPREHENSIVE OPTIMIZATION BENCHMARK');
    console.log('='.repeat(80));
    console.log(`Iterations: ${iterations}, Warmup: ${warmup}`);
    console.log('');
    // Check if --expose-gc is enabled
    if (!global.gc) {
        console.warn('WARNING: --expose-gc not enabled. GC measurements may be inaccurate.');
        console.warn('Run with: node --expose-gc benchmark-optimizations.js\n');
    }
    const patterns = getTestPatterns();
    if (patterns.length === 0) {
        console.error('No test patterns found!');
        console.error('Run: pnpm run generate:testdata');
        process.exit(1);
    }
    console.log(`Test patterns: ${patterns.map(p => p.name).join(', ')}\n`);
    const allResults = [];
    const baselineResults = new Map();
    // === PARSER BENCHMARKS ===
    console.log('\n' + '='.repeat(80));
    console.log('PARSER BENCHMARKS');
    console.log('='.repeat(80) + '\n');
    for (const pattern of patterns) {
        console.log(`\nPattern: ${pattern.name} - ${pattern.description}`);
        console.log('-'.repeat(80));
        for (const variant of parserVariants) {
            console.log(`\nVariant: ${variant.name} - ${variant.description}`);
            try {
                const parser = new variant.Parser();
                const xml = pattern.content;
                // Run benchmark
                const result = await benchmarkWithGC(`${variant.name}-parser-${pattern.name}`, () => {
                    parser.reset();
                    parser.write(xml);
                    parser.end();
                    parser.getEvents();
                }, iterations, warmup);
                // Store result
                const comprehensiveResult = {
                    variant: variant.name,
                    pattern: pattern.name,
                    benchmark: result
                };
                // Compare to baseline
                if (variant.name === 'baseline') {
                    baselineResults.set(`parser-${pattern.name}`, result);
                }
                else if (compareToBaseline) {
                    const baseline = baselineResults.get(`parser-${pattern.name}`);
                    if (baseline) {
                        comprehensiveResult.comparison = compareBenchmarks(baseline, result);
                        comprehensiveResult.statisticalTest = welchTTest(baseline.times, result.times);
                        console.log('\n--- Comparison to Baseline ---');
                        console.log(comprehensiveResult.comparison.analysis);
                        console.log(formatStatisticalReport(baseline.times, result.times, 'Baseline', variant.name));
                    }
                }
                allResults.push(comprehensiveResult);
            }
            catch (error) {
                console.error(`  ERROR: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    // === WRITER BENCHMARKS ===
    console.log('\n' + '='.repeat(80));
    console.log('WRITER BENCHMARKS');
    console.log('='.repeat(80) + '\n');
    // For writer benchmarks, we'll write the parsed events back out
    for (const pattern of patterns) {
        console.log(`\nPattern: ${pattern.name} - ${pattern.description}`);
        console.log('-'.repeat(80));
        // Parse once to get events
        const parser = new BaselineParser();
        parser.write(pattern.content);
        parser.end();
        const events = parser.getEvents();
        for (const variant of writerVariants) {
            console.log(`\nVariant: ${variant.name} - ${variant.description}`);
            try {
                // Run benchmark
                const result = await benchmarkWithGC(`${variant.name}-writer-${pattern.name}`, () => {
                    const writer = new variant.Writer();
                    for (const event of events) {
                        switch (event.type) {
                            case 'startElement':
                                writer.startElement(event.name, event.attributes);
                                break;
                            case 'endElement':
                                writer.endElement();
                                break;
                            case 'text':
                                writer.writeText(event.text);
                                break;
                            case 'cdata':
                                writer.writeCData(event.text);
                                break;
                            case 'comment':
                                writer.writeComment(event.text);
                                break;
                        }
                    }
                    writer.end();
                }, iterations, warmup);
                // Store result
                const comprehensiveResult = {
                    variant: variant.name,
                    pattern: pattern.name,
                    benchmark: result
                };
                // Compare to baseline
                if (variant.name === 'baseline') {
                    baselineResults.set(`writer-${pattern.name}`, result);
                }
                else if (compareToBaseline) {
                    const baseline = baselineResults.get(`writer-${pattern.name}`);
                    if (baseline) {
                        comprehensiveResult.comparison = compareBenchmarks(baseline, result);
                        comprehensiveResult.statisticalTest = welchTTest(baseline.times, result.times);
                        console.log('\n--- Comparison to Baseline ---');
                        console.log(comprehensiveResult.comparison.analysis);
                        console.log(formatStatisticalReport(baseline.times, result.times, 'Baseline', variant.name));
                    }
                }
                allResults.push(comprehensiveResult);
            }
            catch (error) {
                console.error(`  ERROR: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    // === SUMMARY REPORT ===
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY REPORT');
    console.log('='.repeat(80) + '\n');
    printSummaryTable(allResults);
    // === SAVE RESULTS ===
    if (saveResults) {
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        const resultsPath = path.join(__dirname, 'results', `benchmark-${timestamp}.json`);
        const resultsDir = path.dirname(resultsPath);
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }
        fs.writeFileSync(resultsPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            iterations,
            warmup,
            results: allResults.map(r => ({
                variant: r.variant,
                pattern: r.pattern,
                avgTime: r.benchmark.avgTime,
                medianTime: r.benchmark.medianTime,
                stdDev: r.benchmark.stdDev,
                throughput: r.benchmark.throughput,
                gcMetrics: r.benchmark.gcMetrics,
                comparison: r.comparison,
                statisticalTest: r.statisticalTest
            }))
        }, null, 2), 'utf8');
        console.log(`\nResults saved to: ${resultsPath}`);
    }
    // === RECOMMENDATIONS ===
    console.log('\n' + '='.repeat(80));
    console.log('RECOMMENDATIONS');
    console.log('='.repeat(80) + '\n');
    generateRecommendations(allResults);
}
// Print summary table
function printSummaryTable(results) {
    console.log('Performance Summary:');
    console.log('');
    console.log('Variant'.padEnd(20) + 'Pattern'.padEnd(20) + 'Time (ms)'.padEnd(15) + 'Speedup'.padEnd(10) + 'GCs'.padEnd(10) + 'Heap (MB)');
    console.log('-'.repeat(95));
    for (const result of results) {
        const time = result.benchmark.avgTime.toFixed(2);
        const speedup = result.comparison ? `${result.comparison.speedup.toFixed(2)}x` : '-';
        const gcs = `${result.benchmark.gcMetrics.majorGCCount}/${result.benchmark.gcMetrics.minorGCCount}`;
        const heap = result.benchmark.gcMetrics.heapUsedDelta.toFixed(1);
        console.log(result.variant.padEnd(20) +
            result.pattern.padEnd(20) +
            time.padEnd(15) +
            speedup.padEnd(10) +
            gcs.padEnd(10) +
            heap);
    }
    console.log('');
}
// Generate recommendations based on results
function generateRecommendations(results) {
    const issues = [];
    const successes = [];
    for (const result of results) {
        if (!result.comparison || !result.statisticalTest)
            continue;
        const { variant, pattern } = result;
        const { speedup, memoryImprovement, gcReduction } = result.comparison;
        const { significant, improvement } = result.statisticalTest;
        // Check for regressions
        if (significant && improvement < -5) {
            issues.push(`⚠️  ${variant} on ${pattern}: ${Math.abs(improvement).toFixed(1)}% slower (p=${result.statisticalTest.pValue.toFixed(4)})`);
        }
        // Check for memory regressions
        if (memoryImprovement < -50) {
            issues.push(`⚠️  ${variant} on ${pattern}: ${Math.abs(memoryImprovement).toFixed(1)}% more memory usage`);
        }
        // Check for excessive GC
        if (gcReduction < -50) {
            issues.push(`⚠️  ${variant} on ${pattern}: ${Math.abs(gcReduction).toFixed(1)}% more GC events`);
        }
        // Check for successes
        if (significant && improvement > 5 && memoryImprovement > -10) {
            successes.push(`✓ ${variant} on ${pattern}: ${improvement.toFixed(1)}% faster, ${memoryImprovement.toFixed(1)}% memory improvement`);
        }
    }
    if (successes.length > 0) {
        console.log('Successful Optimizations:');
        successes.forEach(s => console.log(`  ${s}`));
        console.log('');
    }
    if (issues.length > 0) {
        console.log('Issues Detected:');
        issues.forEach(i => console.log(`  ${i}`));
        console.log('');
        console.log('Action Required:');
        console.log('  - Review optimizations with significant regressions');
        console.log('  - Consider reverting changes that increase memory by >50%');
        console.log('  - Investigate excessive GC pressure');
        console.log('');
    }
    else {
        console.log('✓ No significant regressions detected');
        console.log('');
    }
}
// CLI interface
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
    const args = process.argv.slice(2);
    const options = {
        iterations: 100,
        warmup: 10,
        saveResults: true,
        compareToBaseline: true
    };
    // Parse CLI arguments
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--iterations' || args[i] === '-i') {
            options.iterations = parseInt(args[++i], 10);
        }
        else if (args[i] === '--warmup' || args[i] === '-w') {
            options.warmup = parseInt(args[++i], 10);
        }
        else if (args[i] === '--no-save') {
            options.saveResults = false;
        }
        else if (args[i] === '--no-compare') {
            options.compareToBaseline = false;
        }
    }
    runComprehensiveBenchmark(options).catch(console.error);
}
export { runComprehensiveBenchmark, getTestPatterns };
