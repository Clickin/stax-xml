/**
 * Comprehensive benchmark suite for comparing inlined vs non-inlined XML parsers
 */
import { bench, group, run } from 'mitata';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { EventReaderSync } from 'stax-xml';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Helper class for memory and GC tracking
class PerformanceMonitor {
    initialMemory;
    gcStartTime = 0;
    gcDuration = 0;
    constructor() {
        this.initialMemory = process.memoryUsage().heapUsed;
        // Set up GC tracking if available
        if (global.gc) {
            performance.mark('gc-tracking-start');
        }
    }
    triggerGC() {
        if (global.gc) {
            const startTime = performance.now();
            global.gc();
            this.gcDuration += performance.now() - startTime;
        }
    }
    getMemoryUsed() {
        return (process.memoryUsage().heapUsed - this.initialMemory) / 1024 / 1024;
    }
    getGCTime() {
        return this.gcDuration;
    }
    reset() {
        this.initialMemory = process.memoryUsage().heapUsed;
        this.gcDuration = 0;
    }
}
// Load parser variants
async function loadParserVariants() {
    const variants = [];
    // Load the baseline (non-inlined) parser
    try {
        const baselineModule = await import('../../stax-xml/src/EventReaderSync.baseline.ts');
        variants.push({
            name: 'baseline',
            parser: baselineModule.EventReaderSync,
            description: 'Non-inlined baseline parser'
        });
    }
    catch (error) {
        console.warn('Baseline parser not found, using default parser as baseline');
        variants.push({
            name: 'baseline',
            parser: EventReaderSync,
            description: 'Default parser (baseline)'
        });
    }
    // Load the inlined (optimized) parser
    try {
        const inlinedModule = await import('../../stax-xml/src/EventReaderSync.inlined.ts');
        variants.push({
            name: 'inlined',
            parser: inlinedModule.EventReaderSync,
            description: 'Inlined optimized parser'
        });
    }
    catch (error) {
        console.warn('Inlined parser not found, using default parser');
        variants.push({
            name: 'inlined',
            parser: EventReaderSync,
            description: 'Default parser (inlined)'
        });
    }
    return variants;
}
// Load test files
function loadTestFiles() {
    const testDataDir = path.join(__dirname, 'test-data');
    const testFiles = new Map();
    if (!fs.existsSync(testDataDir)) {
        console.log('Test data directory not found. Generating test files...');
        // Import and run the generator
        return testFiles;
    }
    const files = fs.readdirSync(testDataDir)
        .filter(f => f.endsWith('.xml'))
        .sort((a, b) => {
        const sizeA = fs.statSync(path.join(testDataDir, a)).size;
        const sizeB = fs.statSync(path.join(testDataDir, b)).size;
        return sizeA - sizeB;
    });
    for (const file of files) {
        const filePath = path.join(testDataDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        testFiles.set(file, content);
    }
    return testFiles;
}
// Count XML events in a document
function countXmlEvents(xml, parser) {
    let eventCount = 0;
    const p = new parser();
    for (const event of p.parse(xml)) {
        eventCount++;
    }
    return eventCount;
}
// Run a single benchmark iteration
function runBenchmarkIteration(xml, parser, warmup = false) {
    const startTime = performance.now();
    const p = new parser();
    let eventCount = 0;
    for (const event of p.parse(xml)) {
        eventCount++;
        // Simulate minimal processing to prevent dead code elimination
        if (event.type === 'error') {
            throw new Error('Parse error');
        }
    }
    const duration = performance.now() - startTime;
    return duration;
}
// Calculate statistics from samples
function calculateStats(samples) {
    const sorted = [...samples].sort((a, b) => a - b);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const p50 = sorted[Math.floor(samples.length * 0.5)];
    const p95 = sorted[Math.floor(samples.length * 0.95)];
    const p99 = sorted[Math.floor(samples.length * 0.99)];
    const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / samples.length;
    const stdDev = Math.sqrt(variance);
    return { mean, p50, p95, p99, stdDev };
}
// Run benchmarks for a specific test file
async function runFileBenchmark(fileName, xml, variants, config) {
    const results = [];
    const fileSize = Buffer.byteLength(xml, 'utf8');
    console.log(`\nBenchmarking ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    for (const variant of variants) {
        console.log(`  Running ${variant.name}...`);
        const monitor = new PerformanceMonitor();
        const samples = [];
        // Warmup runs
        for (let i = 0; i < config.warmupRuns; i++) {
            runBenchmarkIteration(xml, variant.parser, true);
            if (config.gcBetweenRuns && global.gc) {
                global.gc();
            }
        }
        // Reset monitoring after warmup
        monitor.reset();
        // Measurement runs
        const eventCount = countXmlEvents(xml, variant.parser);
        for (let i = 0; i < config.measurementRuns; i++) {
            if (config.gcBetweenRuns) {
                monitor.triggerGC();
            }
            const duration = runBenchmarkIteration(xml, variant.parser);
            samples.push(duration);
        }
        // Calculate statistics
        const stats = calculateStats(samples);
        const throughputMBps = (fileSize / 1024 / 1024) / (stats.mean / 1000);
        const eventsPerSecond = eventCount / (stats.mean / 1000);
        results.push({
            variant: variant.name,
            testFile: fileName,
            fileSize,
            metrics: {
                throughputMBps,
                eventsPerSecond,
                meanLatencyMs: stats.mean,
                p50LatencyMs: stats.p50,
                p95LatencyMs: stats.p95,
                p99LatencyMs: stats.p99,
                memoryUsedMB: monitor.getMemoryUsed(),
                gcTimeMs: monitor.getGCTime()
            },
            samples
        });
        console.log(`    Throughput: ${throughputMBps.toFixed(2)} MB/s`);
        console.log(`    Events/sec: ${eventsPerSecond.toFixed(0)}`);
        console.log(`    Latency (p50/p95/p99): ${stats.p50.toFixed(2)}/${stats.p95.toFixed(2)}/${stats.p99.toFixed(2)} ms`);
    }
    return results;
}
// Main benchmark runner using mitata
async function runMitataBenchmarks(variants, testFiles) {
    console.log('\n=== Running Mitata Benchmarks ===\n');
    for (const [fileName, xml] of testFiles) {
        const fileSize = Buffer.byteLength(xml, 'utf8');
        const sizeMB = (fileSize / 1024 / 1024).toFixed(2);
        group(`${fileName} (${sizeMB} MB)`, () => {
            for (const variant of variants) {
                bench(variant.name, () => {
                    const parser = new variant.parser();
                    for (const event of parser.parse(xml)) {
                        // Process event
                        if (event.type === 'error') {
                            throw new Error('Parse error');
                        }
                    }
                });
            }
        });
    }
    await run({
        avg: true,
        json: false,
        colors: true,
        min_max: true,
        percentiles: true
    });
}
// Generate comparative analysis
function generateComparison(allResults) {
    let report = '\n=== INLINING PERFORMANCE COMPARISON ===\n\n';
    // Group results by test file
    const byFile = new Map();
    for (const result of allResults) {
        if (!byFile.has(result.testFile)) {
            byFile.set(result.testFile, []);
        }
        byFile.get(result.testFile).push(result);
    }
    // Generate comparison for each file
    for (const [fileName, results] of byFile) {
        report += `\n${fileName} (${(results[0].fileSize / 1024 / 1024).toFixed(2)} MB)\n`;
        report += '─'.repeat(60) + '\n';
        const baseline = results.find(r => r.variant === 'baseline');
        const inlined = results.find(r => r.variant === 'inlined');
        if (baseline && inlined) {
            const throughputImprovement = ((inlined.metrics.throughputMBps / baseline.metrics.throughputMBps - 1) * 100).toFixed(1);
            const latencyImprovement = ((baseline.metrics.p50LatencyMs / inlined.metrics.p50LatencyMs - 1) * 100).toFixed(1);
            const memoryDiff = ((inlined.metrics.memoryUsedMB / baseline.metrics.memoryUsedMB - 1) * 100).toFixed(1);
            report += `Throughput:\n`;
            report += `  Baseline: ${baseline.metrics.throughputMBps.toFixed(2)} MB/s\n`;
            report += `  Inlined:  ${inlined.metrics.throughputMBps.toFixed(2)} MB/s\n`;
            report += `  Improvement: ${throughputImprovement}%\n\n`;
            report += `Latency (p50/p95/p99):\n`;
            report += `  Baseline: ${baseline.metrics.p50LatencyMs.toFixed(2)}/${baseline.metrics.p95LatencyMs.toFixed(2)}/${baseline.metrics.p99LatencyMs.toFixed(2)} ms\n`;
            report += `  Inlined:  ${inlined.metrics.p50LatencyMs.toFixed(2)}/${inlined.metrics.p95LatencyMs.toFixed(2)}/${inlined.metrics.p99LatencyMs.toFixed(2)} ms\n`;
            report += `  Improvement: ${latencyImprovement}%\n\n`;
            report += `Memory Usage:\n`;
            report += `  Baseline: ${baseline.metrics.memoryUsedMB.toFixed(2)} MB\n`;
            report += `  Inlined:  ${inlined.metrics.memoryUsedMB.toFixed(2)} MB\n`;
            report += `  Difference: ${memoryDiff}%\n`;
        }
    }
    // Overall summary
    report += '\n\n=== OVERALL SUMMARY ===\n';
    const baselineAvgThroughput = allResults
        .filter(r => r.variant === 'baseline')
        .reduce((sum, r) => sum + r.metrics.throughputMBps, 0) / allResults.filter(r => r.variant === 'baseline').length;
    const inlinedAvgThroughput = allResults
        .filter(r => r.variant === 'inlined')
        .reduce((sum, r) => sum + r.metrics.throughputMBps, 0) / allResults.filter(r => r.variant === 'inlined').length;
    const overallImprovement = ((inlinedAvgThroughput / baselineAvgThroughput - 1) * 100).toFixed(1);
    report += `Average Throughput Improvement: ${overallImprovement}%\n`;
    report += `Baseline Avg: ${baselineAvgThroughput.toFixed(2)} MB/s\n`;
    report += `Inlined Avg:  ${inlinedAvgThroughput.toFixed(2)} MB/s\n`;
    return report;
}
// Save results to file
function saveResults(results, outputPath) {
    const output = {
        timestamp: new Date().toISOString(),
        platform: process.platform,
        nodeVersion: process.version,
        v8Version: process.versions.v8,
        results
    };
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`\nResults saved to: ${outputPath}`);
}
// Main execution
async function main() {
    console.log('=== XML Parser Inlining Benchmark Suite ===');
    console.log(`Node.js: ${process.version}`);
    console.log(`V8: ${process.versions.v8}`);
    console.log(`Platform: ${process.platform} ${process.arch}\n`);
    // Check for --expose-gc flag
    if (!global.gc) {
        console.warn('Warning: --expose-gc flag not set. GC control disabled.');
        console.warn('Run with: node --expose-gc benchmark-inlining.js\n');
    }
    const config = {
        warmupRuns: 3,
        measurementRuns: 10,
        gcBetweenRuns: !!global.gc,
        testFiles: [],
        variants: []
    };
    // Load variants and test files
    const variants = await loadParserVariants();
    const testFiles = loadTestFiles();
    if (testFiles.size === 0) {
        console.error('No test files found. Please run generate-test-xmls.mjs first.');
        process.exit(1);
    }
    config.variants = variants;
    // Run detailed benchmarks
    const allResults = [];
    for (const [fileName, xml] of testFiles) {
        const results = await runFileBenchmark(fileName, xml, variants, config);
        allResults.push(...results);
    }
    // Generate and display comparison
    const comparison = generateComparison(allResults);
    console.log(comparison);
    // Save results
    const resultsDir = path.join(__dirname, 'results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsPath = path.join(resultsDir, `inlining-benchmark-${timestamp}.json`);
    saveResults(allResults, resultsPath);
    // Save comparison report
    const reportPath = path.join(resultsDir, `inlining-comparison-${timestamp}.txt`);
    fs.writeFileSync(reportPath, comparison, 'utf8');
    console.log(`Comparison report saved to: ${reportPath}`);
    // Run mitata benchmarks for additional validation
    console.log('\n' + '='.repeat(60));
    await runMitataBenchmarks(variants, testFiles);
}
// Run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
    main().catch(console.error);
}
export { main as runInliningBenchmarks };
