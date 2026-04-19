import v8 from 'node:v8';
export class MemoryTracker {
    snapshots = [];
    interval = null;
    startTime = 0;
    startTracking(intervalMs = 100) {
        this.snapshots = [];
        this.startTime = Date.now();
        // Take initial snapshot
        this.takeSnapshot();
        this.interval = setInterval(() => {
            this.takeSnapshot();
        }, intervalMs);
    }
    takeSnapshot() {
        const mem = process.memoryUsage();
        this.snapshots.push({
            timestamp: Date.now() - this.startTime,
            heapUsed: mem.heapUsed / 1024 / 1024,
            heapTotal: mem.heapTotal / 1024 / 1024,
            external: mem.external / 1024 / 1024,
            arrayBuffers: mem.arrayBuffers / 1024 / 1024,
            rss: mem.rss / 1024 / 1024
        });
    }
    stopTracking() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        // Take final snapshot
        this.takeSnapshot();
    }
    getReport() {
        if (this.snapshots.length === 0)
            return null;
        const heapUsed = this.snapshots.map(s => s.heapUsed);
        const heapTotal = this.snapshots.map(s => s.heapTotal);
        const rss = this.snapshots.map(s => s.rss);
        const external = this.snapshots.map(s => s.external);
        const sum = (arr) => arr.reduce((a, b) => a + b, 0);
        const avg = (arr) => sum(arr) / arr.length;
        const durationSeconds = (this.snapshots[this.snapshots.length - 1].timestamp -
            this.snapshots[0].timestamp) / 1000;
        const totalGrowth = heapUsed[heapUsed.length - 1] - heapUsed[0];
        const growthRate = durationSeconds > 0 ? totalGrowth / durationSeconds : 0;
        return {
            peakHeapUsed: Math.max(...heapUsed),
            avgHeapUsed: avg(heapUsed),
            peakHeapTotal: Math.max(...heapTotal),
            avgHeapTotal: avg(heapTotal),
            peakRSS: Math.max(...rss),
            avgRSS: avg(rss),
            peakExternal: Math.max(...external),
            avgExternal: avg(external),
            samples: this.snapshots.length,
            timeline: this.snapshots,
            growthRate,
            totalGrowth
        };
    }
    reset() {
        this.snapshots = [];
        this.startTime = Date.now();
    }
}
// Heap snapshot utilities
export class HeapProfiler {
    /**
     * Take a V8 heap snapshot
     * Warning: This can be expensive for large heaps
     */
    static takeHeapSnapshot() {
        return v8.getHeapSnapshot();
    }
    /**
     * Get detailed heap statistics
     */
    static getHeapStatistics() {
        return v8.getHeapStatistics();
    }
    /**
     * Get heap space statistics (useful for understanding memory layout)
     */
    static getHeapSpaceStatistics() {
        return v8.getHeapSpaceStatistics();
    }
    /**
     * Print detailed heap information
     */
    static printHeapInfo(label = 'Heap Info') {
        const stats = this.getHeapStatistics();
        const spaces = this.getHeapSpaceStatistics();
        console.log(`\n=== ${label} ===`);
        console.log(`Total Heap Size: ${(stats.total_heap_size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Used Heap Size: ${(stats.used_heap_size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Heap Size Limit: ${(stats.heap_size_limit / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Malloced Memory: ${(stats.malloced_memory / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Peak Malloced Memory: ${(stats.peak_malloced_memory / 1024 / 1024).toFixed(2)} MB`);
        console.log('\nHeap Spaces:');
        spaces.forEach(space => {
            const used = (space.space_used_size / 1024 / 1024).toFixed(2);
            const size = (space.space_size / 1024 / 1024).toFixed(2);
            const available = (space.space_available_size / 1024 / 1024).toFixed(2);
            console.log(`  ${space.space_name.padEnd(25)}: ${used}/${size} MB (${available} MB available)`);
        });
        console.log('');
    }
}
// Allocation profiler using sampling
export class AllocationProfiler {
    samples = [];
    interval = null;
    startHeap = 0;
    start(sampleIntervalMs = 10) {
        this.samples = [];
        this.startHeap = process.memoryUsage().heapUsed;
        this.interval = setInterval(() => {
            this.samples.push({
                timestamp: performance.now(),
                heapUsed: process.memoryUsage().heapUsed
            });
        }, sampleIntervalMs);
    }
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
    getReport() {
        if (this.samples.length === 0)
            return null;
        const endHeap = process.memoryUsage().heapUsed;
        const totalAllocated = endHeap - this.startHeap;
        const duration = this.samples[this.samples.length - 1].timestamp - this.samples[0].timestamp;
        const allocationRate = duration > 0 ? totalAllocated / duration : 0;
        const peakHeap = Math.max(...this.samples.map(s => s.heapUsed));
        return {
            totalAllocated: totalAllocated / 1024 / 1024, // MB
            allocationRate: allocationRate / 1024, // KB per ms
            peakHeap: peakHeap / 1024 / 1024, // MB
            samples: this.samples.length
        };
    }
}
// Utility to monitor memory during a specific operation
export async function withMemoryTracking(fn, options = {}) {
    const { sampleInterval = 50, label = 'Operation' } = options;
    const tracker = new MemoryTracker();
    tracker.startTracking(sampleInterval);
    let result;
    try {
        result = await fn();
    }
    finally {
        tracker.stopTracking();
    }
    const memoryReport = tracker.getReport();
    if (memoryReport && label) {
        console.log(`\n${label} - Memory Report:`);
        console.log(`  Peak Heap Used: ${memoryReport.peakHeapUsed.toFixed(2)} MB`);
        console.log(`  Avg Heap Used: ${memoryReport.avgHeapUsed.toFixed(2)} MB`);
        console.log(`  Total Growth: ${memoryReport.totalGrowth.toFixed(2)} MB`);
        console.log(`  Growth Rate: ${memoryReport.growthRate.toFixed(2)} MB/s`);
        console.log(`  Samples: ${memoryReport.samples}`);
    }
    return { result, memoryReport };
}
