/**
 * Controlled benchmark runner for CPU-limited testing
 * Designed to be run under cpulimit for consistent results
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
// Import parsers
import { StaxXmlParserSync as BaselineParser } from './parsers/baseline';
import { StaxXmlParserSync as InlinedParser } from './parsers/inlined';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
function parseXML(ParserClass, xml) {
    const parser = new ParserClass(xml);
    let eventCount = 0;
    for (const event of parser) {
        eventCount++;
    }
    return eventCount;
}
function calculateStats(times) {
    const sorted = [...times].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
    const stddev = Math.sqrt(variance);
    return {
        min: sorted[0],
        max: sorted[n - 1],
        mean,
        median: sorted[Math.floor(n / 2)],
        stddev,
        p95: sorted[Math.floor(n * 0.95)],
        p99: sorted[Math.floor(n * 0.99)]
    };
}
function benchmark(variant, ParserClass, xml, testFile, warmupRuns = 3, measurementRuns = 10) {
    const fileSize = Buffer.byteLength(xml, 'utf8');
    // Warmup
    console.log(`  Warmup (${warmupRuns} runs)...`);
    for (let i = 0; i < warmupRuns; i++) {
        parseXML(ParserClass, xml);
        if (global.gc)
            global.gc();
    }
    // Actual measurements
    console.log(`  Measuring (${measurementRuns} runs)...`);
    const times = [];
    let totalEvents = 0;
    const memBefore = process.memoryUsage().heapUsed;
    for (let i = 0; i < measurementRuns; i++) {
        if (global.gc)
            global.gc();
        const start = performance.now();
        const events = parseXML(ParserClass, xml);
        const end = performance.now();
        times.push(end - start);
        totalEvents = events;
    }
    const memAfter = process.memoryUsage().heapUsed;
    const memoryUsedMB = (memAfter - memBefore) / 1024 / 1024;
    const stats = calculateStats(times);
    const throughputMBps = (fileSize / 1024 / 1024) / (stats.mean / 1000);
    const eventsPerSecond = totalEvents / (stats.mean / 1000);
    return {
        timestamp: Date.now(),
        variant,
        testFile,
        fileSize,
        warmupRuns,
        measurementRuns,
        times,
        stats,
        throughputMBps,
        eventsPerSecond,
        memoryUsedMB
    };
}
async function main() {
    const variant = process.argv[2];
    const testFileName = process.argv[3];
    const outputFile = process.argv[4];
    if (!variant || !testFileName || !outputFile) {
        console.error('Usage: benchmark-controlled-runner.mjs <variant> <testFile> <outputFile>');
        process.exit(1);
    }
    const ParserClass = variant === 'baseline' ? BaselineParser : InlinedParser;
    const testDataDir = path.join(__dirname, 'test-data');
    const testFile = path.join(testDataDir, testFileName);
    if (!fs.existsSync(testFile)) {
        console.error(`Test file not found: ${testFile}`);
        process.exit(1);
    }
    const xml = fs.readFileSync(testFile, 'utf8');
    console.log(`Running controlled benchmark for ${variant} with ${testFileName}`);
    console.log(`File size: ${(fs.statSync(testFile).size / 1024 / 1024).toFixed(2)} MB`);
    console.log('');
    const result = benchmark(variant, ParserClass, xml, testFileName);
    console.log('Results:');
    console.log(`  Mean time: ${result.stats.mean.toFixed(2)} ms`);
    console.log(`  Median time: ${result.stats.median.toFixed(2)} ms`);
    console.log(`  Std dev: ${result.stats.stddev.toFixed(2)} ms`);
    console.log(`  P95: ${result.stats.p95.toFixed(2)} ms`);
    console.log(`  P99: ${result.stats.p99.toFixed(2)} ms`);
    console.log(`  Throughput: ${result.throughputMBps.toFixed(2)} MB/s`);
    console.log(`  Memory: ${result.memoryUsedMB.toFixed(2)} MB`);
    console.log('');
    // Append to output file
    let results = [];
    if (fs.existsSync(outputFile)) {
        results = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    }
    results.push(result);
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`Result appended to: ${outputFile}`);
}
main().catch(console.error);
