import v8 from 'node:v8';

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
}

export interface MemoryReport {
  peakHeapUsed: number;
  avgHeapUsed: number;
  peakHeapTotal: number;
  avgHeapTotal: number;
  peakRSS: number;
  avgRSS: number;
  peakExternal: number;
  avgExternal: number;
  samples: number;
  timeline: MemorySnapshot[];
  growthRate: number;  // MB per second
  totalGrowth: number;  // MB from start to end
}

export class MemoryTracker {
  private snapshots: MemorySnapshot[] = [];
  private interval: NodeJS.Timeout | null = null;
  private startTime: number = 0;

  startTracking(intervalMs: number = 100): void {
    this.snapshots = [];
    this.startTime = Date.now();

    // Take initial snapshot
    this.takeSnapshot();

    this.interval = setInterval(() => {
      this.takeSnapshot();
    }, intervalMs);
  }

  private takeSnapshot(): void {
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

  stopTracking(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    // Take final snapshot
    this.takeSnapshot();
  }

  getReport(): MemoryReport | null {
    if (this.snapshots.length === 0) return null;

    const heapUsed = this.snapshots.map(s => s.heapUsed);
    const heapTotal = this.snapshots.map(s => s.heapTotal);
    const rss = this.snapshots.map(s => s.rss);
    const external = this.snapshots.map(s => s.external);

    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const avg = (arr: number[]) => sum(arr) / arr.length;

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

  reset(): void {
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
  static takeHeapSnapshot(): v8.HeapSnapshot {
    return v8.getHeapSnapshot();
  }

  /**
   * Get detailed heap statistics
   */
  static getHeapStatistics(): v8.HeapStatistics {
    return v8.getHeapStatistics();
  }

  /**
   * Get heap space statistics (useful for understanding memory layout)
   */
  static getHeapSpaceStatistics(): v8.HeapSpaceStatistics[] {
    return v8.getHeapSpaceStatistics();
  }

  /**
   * Print detailed heap information
   */
  static printHeapInfo(label: string = 'Heap Info'): void {
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
  private samples: Array<{ timestamp: number; heapUsed: number }> = [];
  private interval: NodeJS.Timeout | null = null;
  private startHeap: number = 0;

  start(sampleIntervalMs: number = 10): void {
    this.samples = [];
    this.startHeap = process.memoryUsage().heapUsed;

    this.interval = setInterval(() => {
      this.samples.push({
        timestamp: performance.now(),
        heapUsed: process.memoryUsage().heapUsed
      });
    }, sampleIntervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getReport(): {
    totalAllocated: number;
    allocationRate: number;  // bytes per ms
    peakHeap: number;
    samples: number;
  } | null {
    if (this.samples.length === 0) return null;

    const endHeap = process.memoryUsage().heapUsed;
    const totalAllocated = endHeap - this.startHeap;

    const duration = this.samples[this.samples.length - 1].timestamp - this.samples[0].timestamp;
    const allocationRate = duration > 0 ? totalAllocated / duration : 0;

    const peakHeap = Math.max(...this.samples.map(s => s.heapUsed));

    return {
      totalAllocated: totalAllocated / 1024 / 1024,  // MB
      allocationRate: allocationRate / 1024,  // KB per ms
      peakHeap: peakHeap / 1024 / 1024,  // MB
      samples: this.samples.length
    };
  }
}

// Utility to monitor memory during a specific operation
export async function withMemoryTracking<T>(
  fn: () => T | Promise<T>,
  options: { sampleInterval?: number; label?: string } = {}
): Promise<{ result: T; memoryReport: MemoryReport | null }> {
  const { sampleInterval = 50, label = 'Operation' } = options;

  const tracker = new MemoryTracker();
  tracker.startTracking(sampleInterval);

  let result: T;
  try {
    result = await fn();
  } finally {
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