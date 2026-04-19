import { PerformanceObserver } from 'node:perf_hooks';
import v8 from 'node:v8';
export class GCMonitor {
    gcEvents = [];
    heapBefore;
    heapAfter = null;
    observer;
    startTime;
    constructor() {
        this.heapBefore = v8.getHeapStatistics();
        this.startTime = performance.now();
        this.observer = new PerformanceObserver((items) => {
            items.getEntries().forEach((entry) => {
                this.gcEvents.push({
                    kind: this.getGCKind(entry.kind),
                    duration: entry.duration,
                    timestamp: entry.startTime
                });
            });
        });
        this.observer.observe({ entryTypes: ['gc'] });
    }
    getGCKind(kind) {
        // V8 GC kinds:
        // 1 = Scavenge (minor GC)
        // 2 = Mark-sweep-compact (major GC)
        // 4 = Incremental marking
        // 8 = Process weak callbacks
        // 16 = All (full GC)
        switch (kind) {
            case 1: return 'minor';
            case 2: return 'major';
            case 4: return 'incremental';
            case 8: return 'weak';
            case 16: return 'full';
            default: return `other(${kind})`;
        }
    }
    getMetrics() {
        this.heapAfter = v8.getHeapStatistics();
        const majorGCs = this.gcEvents.filter(e => e.kind === 'major' || e.kind === 'full');
        const minorGCs = this.gcEvents.filter(e => e.kind === 'minor');
        const incrementalGCs = this.gcEvents.filter(e => e.kind === 'incremental');
        const totalTime = this.gcEvents.reduce((sum, e) => sum + e.duration, 0);
        const maxPause = this.gcEvents.length > 0
            ? Math.max(...this.gcEvents.map(e => e.duration))
            : 0;
        return {
            majorGCCount: majorGCs.length,
            minorGCCount: minorGCs.length,
            incrementalGCCount: incrementalGCs.length,
            totalGCTime: totalTime,
            heapUsedBefore: this.heapBefore.used_heap_size / 1024 / 1024,
            heapUsedAfter: this.heapAfter.used_heap_size / 1024 / 1024,
            heapUsedDelta: (this.heapAfter.used_heap_size - this.heapBefore.used_heap_size) / 1024 / 1024,
            totalAllocated: this.heapAfter.total_heap_size / 1024 / 1024,
            avgGCPause: this.gcEvents.length > 0 ? totalTime / this.gcEvents.length : 0,
            maxGCPause: maxPause,
            gcEvents: this.gcEvents
        };
    }
    reset() {
        this.gcEvents = [];
        this.heapBefore = v8.getHeapStatistics();
        this.startTime = performance.now();
    }
    stop() {
        this.observer.disconnect();
    }
}
// Force a full GC if available (requires --expose-gc flag)
export function forceGC() {
    if (typeof global !== 'undefined' && global.gc) {
        global.gc();
    }
}
// Calculate statistics
function calculateStats(times) {
    const sorted = [...times].sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const variance = times.reduce((sum, x) => sum + Math.pow(x - avg, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);
    return { avg, median, min, max, stdDev };
}
// Main benchmarking function with GC monitoring
export async function benchmarkWithGC(name, fn, iterations = 100, warmupIterations = 10) {
    console.log(`Starting benchmark: ${name}`);
    // Warmup phase
    console.log(`  Warmup: ${warmupIterations} iterations...`);
    for (let i = 0; i < warmupIterations; i++) {
        await fn();
        if (i % 5 === 0)
            forceGC(); // GC every 5 warmup iterations
    }
    // Force GC before starting actual benchmark
    forceGC();
    await new Promise(resolve => setTimeout(resolve, 100)); // Let GC settle
    const monitor = new GCMonitor();
    // Actual benchmark
    console.log(`  Benchmark: ${iterations} iterations...`);
    const times = [];
    for (let i = 0; i < iterations; i++) {
        // Force GC before each iteration for consistent measurements
        if (i % 10 === 0) {
            forceGC();
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        const start = performance.now();
        await fn();
        const duration = performance.now() - start;
        times.push(duration);
        // Progress indicator
        if (i % Math.ceil(iterations / 10) === 0) {
            process.stdout.write('.');
        }
    }
    console.log(); // New line after progress dots
    const metrics = monitor.getMetrics();
    monitor.stop();
    const stats = calculateStats(times);
    const throughput = 1000 / stats.avg; // operations per second
    const result = {
        name,
        iterations,
        times,
        avgTime: stats.avg,
        medianTime: stats.median,
        minTime: stats.min,
        maxTime: stats.max,
        stdDev: stats.stdDev,
        gcMetrics: metrics,
        throughput
    };
    console.log(`  Complete: avg=${stats.avg.toFixed(2)}ms, GCs=${metrics.majorGCCount}/${metrics.minorGCCount}`);
    return result;
}
// Compare two benchmark results
export function compareBenchmarks(baseline, optimized) {
    const speedup = baseline.avgTime / optimized.avgTime;
    const memoryImprovement = (baseline.gcMetrics.heapUsedDelta - optimized.gcMetrics.heapUsedDelta) /
        baseline.gcMetrics.heapUsedDelta * 100;
    const baselineGCs = baseline.gcMetrics.majorGCCount + baseline.gcMetrics.minorGCCount;
    const optimizedGCs = optimized.gcMetrics.majorGCCount + optimized.gcMetrics.minorGCCount;
    const gcReduction = ((baselineGCs - optimizedGCs) / baselineGCs) * 100;
    const analysis = [
        `Performance: ${speedup.toFixed(2)}x ${speedup > 1 ? 'faster' : 'slower'}`,
        `Memory: ${Math.abs(memoryImprovement).toFixed(1)}% ${memoryImprovement > 0 ? 'less' : 'more'} heap used`,
        `GC Pressure: ${Math.abs(gcReduction).toFixed(1)}% ${gcReduction > 0 ? 'fewer' : 'more'} collections`,
        `GC Time: baseline=${baseline.gcMetrics.totalGCTime.toFixed(1)}ms, optimized=${optimized.gcMetrics.totalGCTime.toFixed(1)}ms`
    ].join('\n');
    return {
        speedup,
        memoryImprovement,
        gcReduction,
        analysis
    };
}
