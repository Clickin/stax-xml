/**
 * Phase 1: Quick Benchmark
 *
 * Purpose: Fast initial validation to determine if optimizations are worth pursuing
 *
 * Decision Criteria:
 * ✅ Proceed: Any approach shows +10% improvement
 * ❌ Stop: All approaches < +10%
 */
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Import all implementations
import { StaxXmlWriterSync as BaselineSync } from '../../stax-xml/src/StaxXmlWriterSync.baseline';
import { StaxXmlWriterSync as StringArraySync } from '../../stax-xml/src/StaxXmlWriterSync.stringarray';
import { StaxXmlWriterSync as Uint8ArraySync } from '../../stax-xml/src/StaxXmlWriterSync.uint8array';
/**
 * Run a quick benchmark on a single implementation
 */
function quickBenchmark(name, WriterClass, iterations = 10000) {
    const writer = new WriterClass();
    // Simple XML chunk that exercises the _write method
    const chunk = '<element attr="value">text content</element>';
    // Warmup
    for (let i = 0; i < 100; i++) {
        writer['_write'](chunk);
    }
    // Reset for actual benchmark
    const testWriter = new WriterClass();
    // Benchmark
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        testWriter['_write'](chunk);
    }
    const end = performance.now();
    const totalTime = end - start;
    // Get result to ensure work was actually done
    const result = testWriter.getXmlString();
    const avgTime = totalTime / iterations;
    const throughput = 1000 / avgTime; // ops per second
    return {
        name,
        iterations,
        totalTime,
        avgTime,
        throughput,
        resultLength: result.length
    };
}
/**
 * Test with realistic Writer API usage
 */
function realisticBenchmark(name, WriterClass, elementCount = 1000) {
    const writer = new WriterClass();
    const start = performance.now();
    writer.writeStartDocument();
    writer.writeStartElement('root');
    for (let i = 0; i < elementCount; i++) {
        writer.writeStartElement('item', {
            attributes: {
                id: String(i),
                type: 'test',
                index: String(i)
            }
        });
        writer.writeCharacters(`Text content for item ${i}`);
        writer.writeEndElement();
    }
    writer.writeEndElement();
    writer.writeEndDocument();
    const xml = writer.getXmlString();
    const end = performance.now();
    const totalTime = end - start;
    return {
        name,
        iterations: elementCount,
        totalTime,
        avgTime: totalTime / elementCount,
        throughput: 1000 / (totalTime / elementCount),
        resultLength: xml.length
    };
}
/**
 * Main benchmark execution
 */
function runQuickBenchmark() {
    console.log('=== Phase 1: Quick Benchmark ===\n');
    console.log('Testing low-level _write() performance with 10,000 iterations...\n');
    // Low-level _write() benchmark
    console.log('1. Low-level _write() test:');
    const baseline = quickBenchmark('Baseline (String Concat)', BaselineSync, 10000);
    console.log(`  ✓ Baseline: ${baseline.totalTime.toFixed(2)}ms (${baseline.throughput.toFixed(0)} ops/sec)`);
    const stringArray = quickBenchmark('String Array', StringArraySync, 10000);
    console.log(`  ✓ String Array: ${stringArray.totalTime.toFixed(2)}ms (${stringArray.throughput.toFixed(0)} ops/sec)`);
    const uint8Array = quickBenchmark('Uint8Array', Uint8ArraySync, 10000);
    console.log(`  ✓ Uint8Array: ${uint8Array.totalTime.toFixed(2)}ms (${uint8Array.throughput.toFixed(0)} ops/sec)`);
    console.log('\n2. Realistic API usage test (1,000 elements):');
    const baselineRealistic = realisticBenchmark('Baseline', BaselineSync, 1000);
    console.log(`  ✓ Baseline: ${baselineRealistic.totalTime.toFixed(2)}ms`);
    const stringArrayRealistic = realisticBenchmark('String Array', StringArraySync, 1000);
    console.log(`  ✓ String Array: ${stringArrayRealistic.totalTime.toFixed(2)}ms`);
    const uint8ArrayRealistic = realisticBenchmark('Uint8Array', Uint8ArraySync, 1000);
    console.log(`  ✓ Uint8Array: ${uint8ArrayRealistic.totalTime.toFixed(2)}ms`);
    // Calculate improvements (use realistic test results)
    const speedupStringArray = baselineRealistic.totalTime / stringArrayRealistic.totalTime;
    const speedupUint8Array = baselineRealistic.totalTime / uint8ArrayRealistic.totalTime;
    const improvementStringArray = ((baselineRealistic.totalTime - stringArrayRealistic.totalTime) / baselineRealistic.totalTime) * 100;
    const improvementUint8Array = ((baselineRealistic.totalTime - uint8ArrayRealistic.totalTime) / baselineRealistic.totalTime) * 100;
    // Decision logic
    const bestImprovement = Math.max(improvementStringArray, improvementUint8Array);
    const decision = bestImprovement >= 10 ? 'proceed' : 'stop';
    let reason;
    if (decision === 'proceed') {
        if (improvementStringArray >= 10 && improvementUint8Array >= 10) {
            reason = `Both approaches show significant improvement (String Array: +${improvementStringArray.toFixed(1)}%, Uint8Array: +${improvementUint8Array.toFixed(1)}%). Proceeding to Phase 2.`;
        }
        else if (improvementStringArray >= 10) {
            reason = `String Array shows significant improvement (+${improvementStringArray.toFixed(1)}%). Proceeding to Phase 2 with String Array.`;
        }
        else {
            reason = `Uint8Array shows significant improvement (+${improvementUint8Array.toFixed(1)}%). Proceeding to Phase 2 with Uint8Array.`;
        }
    }
    else {
        reason = `Insufficient improvement (String Array: +${improvementStringArray.toFixed(1)}%, Uint8Array: +${improvementUint8Array.toFixed(1)}%). Both < +10% threshold. STOPPING - current implementation may already be optimal.`;
    }
    // Print comparison
    console.log('\n=== Results ===\n');
    console.log('Realistic API Usage Test (1,000 elements):');
    console.log('─'.repeat(70));
    console.log(`Implementation      | Time (ms) | Speedup | Improvement`);
    console.log('─'.repeat(70));
    console.log(`Baseline            | ${baselineRealistic.totalTime.toFixed(2).padStart(9)} | 1.00x   | baseline`);
    console.log(`String Array        | ${stringArrayRealistic.totalTime.toFixed(2).padStart(9)} | ${speedupStringArray.toFixed(2)}x   | ${improvementStringArray >= 0 ? '+' : ''}${improvementStringArray.toFixed(1)}%`);
    console.log(`Uint8Array          | ${uint8ArrayRealistic.totalTime.toFixed(2).padStart(9)} | ${speedupUint8Array.toFixed(2)}x   | ${improvementUint8Array >= 0 ? '+' : ''}${improvementUint8Array.toFixed(1)}%`);
    console.log('─'.repeat(70));
    console.log('\n=== Decision ===\n');
    console.log(`Status: ${decision === 'proceed' ? '✅ PROCEED' : '❌ STOP'}`);
    console.log(`Reason: ${reason}`);
    console.log();
    const result = {
        baseline: baselineRealistic,
        stringArray: stringArrayRealistic,
        uint8Array: uint8ArrayRealistic,
        speedupStringArray,
        speedupUint8Array,
        improvementStringArray,
        improvementUint8Array,
        decision,
        reason
    };
    return result;
}
/**
 * Save results to JSON file
 */
function saveResults(result) {
    const resultsPath = path.join(__dirname, 'results', 'phase1-results.json');
    const output = {
        timestamp: new Date().toISOString(),
        phase: 'Phase 1: Quick Benchmark',
        decision: result.decision,
        reason: result.reason,
        results: {
            baseline: result.baseline,
            stringArray: result.stringArray,
            uint8Array: result.uint8Array
        },
        comparison: {
            speedupStringArray: result.speedupStringArray,
            speedupUint8Array: result.speedupUint8Array,
            improvementStringArray: result.improvementStringArray,
            improvementUint8Array: result.improvementUint8Array
        }
    };
    writeFileSync(resultsPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`Results saved to: ${resultsPath}`);
}
// Run benchmark
const result = runQuickBenchmark();
saveResults(result);
// Exit with appropriate code
process.exit(result.decision === 'proceed' ? 0 : 1);
