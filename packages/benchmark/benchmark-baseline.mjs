/**
 * Simple baseline benchmark with GC pressure measurement
 * Tests the current implementation without comparisons
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import v8 from 'node:v8';
// Import the baseline parser
import { EventReaderSync } from 'stax-xml';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
class GCMonitor {
    gcEvents = [];
    heapBefore;
    observer;
    constructor() {
        this.heapBefore = v8.getHeapStatistics();
        this.observer = new PerformanceObserver((items) => {
            items.getEntries().forEach((entry) => {
                this.gcEvents.push({
                    kind: entry.kind === 1 ? 'minor' : entry.kind === 2 ? 'major' : 'other',
                    duration: entry.duration
                });
            });
        });
        this.observer.observe({ entryTypes: ['gc'] });
    }
    getMetrics() {
        const heapAfter = v8.getHeapStatistics();
        const majorGCs = this.gcEvents.filter(e => e.kind === 'major').length;
        const minorGCs = this.gcEvents.filter(e => e.kind === 'minor').length;
        const totalTime = this.gcEvents.reduce((sum, e) => sum + e.duration, 0);
        return {
            majorGCCount: majorGCs,
            minorGCCount: minorGCs,
            totalGCTime: totalTime,
            heapUsedDelta: (heapAfter.used_heap_size - this.heapBefore.used_heap_size) / 1024 / 1024,
            avgGCPause: this.gcEvents.length > 0 ? totalTime / this.gcEvents.length : 0
        };
    }
    reset() {
        this.gcEvents = [];
        this.heapBefore = v8.getHeapStatistics();
    }
    stop() {
        this.observer.disconnect();
    }
}
function parseXML(xml) {
    const parser = new EventReaderSync(xml);
    let eventCount = 0;
    for (const event of parser) {
        eventCount++;
    }
    return eventCount;
}
async function benchmarkFile(testFile, iterations = 100) {
    const xml = fs.readFileSync(testFile, 'utf8');
    const fileSize = fs.statSync(testFile).size;
    console.log(`\nBenchmarking: ${path.basename(testFile)} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log('='.repeat(80));
    // Warmup
    console.log('  Warming up...');
    for (let i = 0; i < 10; i++) {
        parseXML(xml);
        if (global.gc)
            global.gc();
    }
    // Start monitoring
    const monitor = new GCMonitor();
    // Benchmark
    console.log(`  Running ${iterations} iterations...`);
    const times = [];
    let eventCount = 0;
    for (let i = 0; i < iterations; i++) {
        if (global.gc)
            global.gc();
        const start = performance.now();
        eventCount = parseXML(xml);
        times.push(performance.now() - start);
    }
    const gcMetrics = monitor.getMetrics();
    monitor.stop();
    // Calculate statistics
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);
    const throughputMBps = (fileSize / 1024 / 1024) / (avg / 1000);
    const eventsPerSecond = eventCount / (avg / 1000);
    return {
        testFile: path.basename(testFile),
        fileSize,
        iterations,
        times,
        avgTime: avg,
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
        stdDev,
        throughputMBps,
        eventsPerSecond,
        gcMetrics
    };
}
async function main() {
    console.log('='.repeat(80));
    console.log('StaxXML Baseline Performance Benchmark');
    console.log('='.repeat(80));
    console.log(`Node.js: ${process.version}`);
    console.log(`V8: ${process.versions.v8}`);
    console.log(`Platform: ${process.platform} ${process.arch}`);
    console.log('');
    const testDataDir = path.join(__dirname, 'test-data');
    if (!fs.existsSync(testDataDir)) {
        console.error('Test data not found. Run: pnpm run generate:testdata');
        process.exit(1);
    }
    const testFiles = [
        'small-simple.xml',
        'attribute-heavy.xml',
        'text-heavy.xml',
        'medium-nested.xml',
        'large-complex.xml'
    ].map(f => path.join(testDataDir, f))
        .filter(f => fs.existsSync(f));
    if (testFiles.length === 0) {
        console.error('No test files found. Run: pnpm run generate:testdata');
        process.exit(1);
    }
    const results = [];
    for (const testFile of testFiles) {
        const result = await benchmarkFile(testFile, 100);
        results.push(result);
        // Display results
        console.log('\n  Results:');
        console.log('  ' + '-'.repeat(76));
        console.log(`  Average time:       ${result.avgTime.toFixed(2)} ms`);
        console.log(`  Min time:           ${result.minTime.toFixed(2)} ms`);
        console.log(`  Max time:           ${result.maxTime.toFixed(2)} ms`);
        console.log(`  Std deviation:      ${result.stdDev.toFixed(2)} ms`);
        console.log(`  Throughput:         ${result.throughputMBps.toFixed(2)} MB/s`);
        console.log(`  Events/sec:         ${result.eventsPerSecond.toFixed(0)}`);
        console.log('');
        console.log('  GC Metrics:');
        console.log(`  Major GCs:          ${result.gcMetrics.majorGCCount}`);
        console.log(`  Minor GCs:          ${result.gcMetrics.minorGCCount}`);
        console.log(`  Total GC time:      ${result.gcMetrics.totalGCTime.toFixed(2)} ms`);
        console.log(`  Avg GC pause:       ${result.gcMetrics.avgGCPause.toFixed(2)} ms`);
        console.log(`  Heap delta:         ${result.gcMetrics.heapUsedDelta.toFixed(2)} MB`);
    }
    // Summary table
    console.log('\n\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log('\n' + 'Test File'.padEnd(25) + 'Avg (ms)'.padStart(12) + 'Throughput'.padStart(15) + 'GC Events'.padStart(12) + 'Heap (MB)'.padStart(12));
    console.log('-'.repeat(80));
    for (const result of results) {
        const totalGCs = result.gcMetrics.majorGCCount + result.gcMetrics.minorGCCount;
        console.log(result.testFile.padEnd(25) +
            result.avgTime.toFixed(2).padStart(12) +
            `${result.throughputMBps.toFixed(2)} MB/s`.padStart(15) +
            totalGCs.toString().padStart(12) +
            result.gcMetrics.heapUsedDelta.toFixed(2).padStart(12));
    }
    console.log('-'.repeat(80));
    console.log('\nOverall Performance:');
    const avgThroughput = results.reduce((sum, r) => sum + r.throughputMBps, 0) / results.length;
    const totalGCEvents = results.reduce((sum, r) => sum + r.gcMetrics.majorGCCount + r.gcMetrics.minorGCCount, 0);
    console.log(`  Average throughput: ${avgThroughput.toFixed(2)} MB/s`);
    console.log(`  Total GC events:    ${totalGCEvents}`);
    // Save results
    const resultsFile = path.join(__dirname, 'results', `baseline-${Date.now()}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${resultsFile}`);
}
main().catch(console.error);
