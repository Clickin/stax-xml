/**
 * Example demonstrating the GC pressure benchmark tools
 * Run with: node --expose-gc example-gc-benchmark.js
 */
import { benchmarkWithGC, compareBenchmarks, forceGC } from './benchmark-gc-pressure.mjs';
import { formatStatisticalReport } from './statistical-analysis.mjs';
import { HeapProfiler } from './memory-tracker.mjs';
// Example: Compare two different string concatenation approaches
async function exampleStringConcatenation() {
    console.log('Example: String Concatenation vs Array Join\n');
    const iterations = 1000;
    const numStrings = 1000;
    // Approach 1: String concatenation
    const concatResult = await benchmarkWithGC('String Concatenation', () => {
        let result = '';
        for (let i = 0; i < numStrings; i++) {
            result += `item-${i},`;
        }
        return result;
    }, iterations, 10);
    console.log('\n---\n');
    // Approach 2: Array join
    const joinResult = await benchmarkWithGC('Array Join', () => {
        const parts = [];
        for (let i = 0; i < numStrings; i++) {
            parts.push(`item-${i}`);
        }
        return parts.join(',');
    }, iterations, 10);
    // Compare results
    console.log('\n=== COMPARISON ===\n');
    const comparison = compareBenchmarks(concatResult, joinResult);
    console.log(comparison.analysis);
    // Statistical test
    const stats = formatStatisticalReport(concatResult.times, joinResult.times, 'String Concatenation', 'Array Join');
    console.log(stats);
}
// Example: Demonstrate memory tracking
async function exampleMemoryTracking() {
    console.log('\n\n=== Memory Tracking Example ===\n');
    HeapProfiler.printHeapInfo('Before Large Allocation');
    // Allocate some memory
    const largeArray = Array.from({ length: 1_000_000 }, (_, i) => ({
        id: i,
        data: Math.random().toString(36),
        nested: { value: i * 2 }
    }));
    HeapProfiler.printHeapInfo('After Large Allocation');
    // Force GC to reclaim memory
    console.log('Forcing garbage collection...\n');
    forceGC();
    await new Promise(resolve => setTimeout(resolve, 100));
    HeapProfiler.printHeapInfo('After Garbage Collection');
    // Keep reference so it's not optimized away
    console.log(`Array length: ${largeArray.length}`);
}
// Example: Show GC event details
async function exampleGCDetails() {
    console.log('\n\n=== GC Event Details Example ===\n');
    const result = await benchmarkWithGC('Object Creation', () => {
        // Create objects that will trigger GC
        const objects = [];
        for (let i = 0; i < 10000; i++) {
            const dataValue = Math.random();
            objects.push({
                id: i,
                name: `object-${i}`,
                data: Array.from({ length: 100 }, () => dataValue)
            });
        }
        return objects;
    }, 50, 5);
    console.log('\nGC Events Timeline:');
    result.gcMetrics.gcEvents.forEach((event, idx) => {
        console.log(`  ${idx + 1}. ${event.kind.padEnd(12)} @ ${event.timestamp.toFixed(2)}ms (${event.duration.toFixed(2)}ms)`);
    });
    console.log('\nGC Summary:');
    console.log(`  Total GC events: ${result.gcMetrics.gcEvents.length}`);
    console.log(`  Major GCs: ${result.gcMetrics.majorGCCount}`);
    console.log(`  Minor GCs: ${result.gcMetrics.minorGCCount}`);
    console.log(`  Total GC time: ${result.gcMetrics.totalGCTime.toFixed(2)}ms`);
    console.log(`  Avg GC pause: ${result.gcMetrics.avgGCPause.toFixed(2)}ms`);
    console.log(`  Max GC pause: ${result.gcMetrics.maxGCPause.toFixed(2)}ms`);
    console.log(`  Heap delta: ${result.gcMetrics.heapUsedDelta.toFixed(2)}MB`);
}
// Run all examples
async function main() {
    console.log('='.repeat(80));
    console.log('GC PRESSURE BENCHMARK EXAMPLES');
    console.log('='.repeat(80));
    if (!global.gc) {
        console.error('\nERROR: --expose-gc flag not set!');
        console.error('Run with: node --expose-gc example-gc-benchmark.js\n');
        process.exit(1);
    }
    await exampleStringConcatenation();
    await exampleMemoryTracking();
    await exampleGCDetails();
    console.log('\n' + '='.repeat(80));
    console.log('Examples complete!');
    console.log('='.repeat(80) + '\n');
}
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
    main().catch(console.error);
}
export { exampleStringConcatenation, exampleMemoryTracking, exampleGCDetails };
