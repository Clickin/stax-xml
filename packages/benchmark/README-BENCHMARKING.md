# Benchmarking Infrastructure

Comprehensive benchmarking suite for measuring performance, GC pressure, and memory allocation patterns in stax-xml optimizations.

## Overview

This benchmarking infrastructure was created to address the limitations discovered during optimization work, particularly:

- **Memory regression detection**: The inlining optimization showed +180% memory increase
- **GC pressure measurement**: Object pooling failed due to V8 hidden class conflicts
- **Statistical significance**: Need to know if optimizations are real improvements or noise

## Tools

### 1. GC Pressure Benchmark (`benchmark-gc-pressure.ts`)

Measures garbage collection metrics during benchmarks:

```typescript
import { benchmarkWithGC } from './benchmark-gc-pressure';

const result = await benchmarkWithGC(
  'my-test',
  () => {
    // code to benchmark
  },
  100  // iterations
);

console.log(`Major GCs: ${result.gcMetrics.majorGCCount}`);
console.log(`Minor GCs: ${result.gcMetrics.minorGCCount}`);
console.log(`Heap delta: ${result.gcMetrics.heapUsedDelta} MB`);
```

**Metrics captured:**
- Major/minor GC counts
- Total GC time
- Average/max GC pause times
- Heap memory delta
- Individual GC events with timestamps

### 2. Memory Tracker (`memory-tracker.ts`)

Continuous memory profiling during operations:

```typescript
import { MemoryTracker, withMemoryTracking } from './memory-tracker';

const { result, memoryReport } = await withMemoryTracking(
  () => parseXml(largeFile),
  { sampleInterval: 50, label: 'Large File Parse' }
);

console.log(`Peak heap: ${memoryReport.peakHeapUsed} MB`);
console.log(`Growth rate: ${memoryReport.growthRate} MB/s`);
```

**Utilities:**
- `MemoryTracker` - Continuous sampling
- `HeapProfiler` - Snapshot and statistics
- `AllocationProfiler` - Allocation rate tracking

### 3. Statistical Analysis (`statistical-analysis.ts`)

Statistical significance testing for benchmark comparisons:

```typescript
import { welchTTest, formatStatisticalReport } from './statistical-analysis';

const tTest = welchTTest(baselineTimes, optimizedTimes);

if (tTest.significant && tTest.improvement > 5) {
  console.log('✓ Statistically significant improvement!');
}
```

**Features:**
- Welch's t-test (robust, doesn't assume equal variance)
- Student's t-test
- Effect size (Cohen's d)
- Confidence intervals
- Outlier detection
- Descriptive statistics

### 4. Comprehensive Benchmark (`benchmark-optimizations.ts`)

Full benchmark suite comparing all parser/writer variants:

```bash
node --expose-gc benchmark-optimizations.js [options]

Options:
  --iterations, -i <n>   Number of iterations (default: 100)
  --warmup, -w <n>       Warmup iterations (default: 10)
  --no-save              Don't save results to JSON
  --no-compare           Don't compare to baseline
```

**Tests:**
- All parser variants (baseline, current, inlined)
- All writer variants (baseline, string-array)
- Multiple test patterns (small, medium, attribute-heavy, text-heavy, mixed)
- Automatic statistical comparison
- Recommendations based on results

### 5. Quick Benchmark (`quick-benchmark.ts`)

Fast iteration tool for development:

```bash
node --expose-gc quick-benchmark.js \
  ../stax-xml/src/StaxXmlParserSync.baseline.js \
  ../stax-xml/src/StaxXmlParserSync.js \
  --size medium --iterations 50 --heap
```

**Use cases:**
- Rapid iteration during optimization work
- Focused testing of specific variants
- Detailed heap analysis
- Quick accept/reject decisions

## Usage Workflow

### 1. Generate Test Data

```bash
pnpm tsx generate-test-xmls.ts
```

This creates test XML files in `test-data/`:
- small-simple.xml (~500B)
- medium-nested.xml (~50KB)
- attribute-heavy.xml (~1MB)
- text-heavy.xml (~2MB)
- mixed-content.xml (~1MB)

### 2. Run Comprehensive Benchmark

```bash
# Full benchmark suite
pnpm bench:full

# Or manually with custom options
node --expose-gc benchmark-optimizations.js --iterations 200
```

Results saved to `results/benchmark-<timestamp>.json`

### 3. Quick Iteration

```bash
# Quick test during development
pnpm bench:quick

# Or compare specific files
node --expose-gc quick-benchmark.js \
  ../stax-xml/src/StaxXmlParserSync.baseline.js \
  ../stax-xml/src/StaxXmlParserSync.inlined.js
```

### 4. Analyze Results

The benchmark output includes:

**Performance Table:**
```
Variant              Pattern              Time (ms)      Speedup   GCs       Heap (MB)
---------------------------------------------------------------------------------------
baseline             medium-nested        12.45          -         5/23      2.3
current              medium-nested        11.20          1.11x     4/20      2.1
```

**Statistical Analysis:**
```
=== Statistical Analysis ===

Baseline:
  Mean: 12.450 ms
  Std Dev: 0.823 ms

Optimized:
  Mean: 11.203 ms
  Std Dev: 0.765 ms

Comparison:
  Improvement: 10.01%
  Speedup: 1.11x

Statistical Significance:
  p-value: 0.000234
  Significant: YES (95% confidence)
  Effect size (Cohen's d): 1.589 (large)

✓ Performance improvement is statistically significant
```

**Recommendations:**
```
Successful Optimizations:
  ✓ current on medium-nested: 10.0% faster, 8.7% memory improvement

Issues Detected:
  ⚠️  inlined on text-heavy: 15.3% slower (p=0.0012)
  ⚠️  inlined on mixed-content: 180.4% more memory usage
```

## Important Flags

### --expose-gc

**Required for accurate GC measurements.**

All benchmarks should be run with:
```bash
node --expose-gc <script>.js
```

Or via package.json:
```json
{
  "scripts": {
    "bench:full": "node --expose-gc benchmark-optimizations.js"
  }
}
```

Without `--expose-gc`, you'll see a warning:
```
WARNING: --expose-gc not enabled. GC measurements may be inaccurate.
```

## Interpreting Results

### Accept Optimization If:
1. ✓ Statistically significant improvement (p < 0.05)
2. ✓ Performance gain > 5%
3. ✓ Memory regression < 10%
4. ✓ GC pressure doesn't increase significantly

### Reject Optimization If:
1. ✗ Statistically significant regression (p < 0.05)
2. ✗ Memory increase > 50%
3. ✗ GC events increase > 50%
4. ✗ Performance gain < 5% but memory increases

### Example: Inlining Failure

The inlining optimization was rejected because:
- ✗ Memory usage: +180% (heap delta from 2.3 MB to 6.4 MB)
- ✗ Performance gain: Only 3-5% on some patterns
- ✗ GC pressure: +45% more GC events
- Verdict: **REJECT** - memory regression too severe

## Best Practices

### 1. Always Compare to Baseline

```typescript
const baseline = await benchmarkWithGC('baseline', baselineFn);
const optimized = await benchmarkWithGC('optimized', optimizedFn);
const comparison = compareBenchmarks(baseline, optimized);
```

### 2. Use Multiple Test Patterns

Different XML patterns stress different code paths:
- `attribute-heavy` - Tests attribute parsing
- `text-heavy` - Tests text content handling
- `mixed-content` - Tests overall balance

### 3. Check Statistical Significance

Don't trust small differences without statistical validation:

```typescript
const tTest = welchTTest(baseline.times, optimized.times);
if (!tTest.significant) {
  console.log('Difference may be noise, not real improvement');
}
```

### 4. Force GC Between Iterations

For consistent measurements:

```typescript
import { forceGC } from './benchmark-gc-pressure';

for (let i = 0; i < iterations; i++) {
  if (i % 10 === 0) forceGC();
  // run test
}
```

### 5. Warmup Phase

Always include warmup to let JIT compile:

```typescript
await benchmarkWithGC(
  'test',
  fn,
  100,    // iterations
  10      // warmup iterations
);
```

## Output Files

### Benchmark Results JSON

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "iterations": 100,
  "warmup": 10,
  "results": [
    {
      "variant": "baseline",
      "pattern": "medium-nested",
      "avgTime": 12.45,
      "medianTime": 12.30,
      "stdDev": 0.82,
      "throughput": 80.3,
      "gcMetrics": {
        "majorGCCount": 5,
        "minorGCCount": 23,
        "totalGCTime": 45.6,
        "heapUsedDelta": 2.3
      }
    }
  ]
}
```

## Troubleshooting

### High Variance in Results

If you see high coefficient of variation (>10%):
- Close other applications
- Run more warmup iterations
- Increase iteration count
- Check for background tasks

### GC Not Detected

If GC counts are always 0:
- Ensure `--expose-gc` flag is used
- Check that `global.gc` is available
- Increase test data size

### Memory Numbers Don't Make Sense

- Force GC before each measurement
- Use longer settling time between tests
- Check for memory leaks in test harness

## Integration with CI/CD

Add performance regression detection to CI:

```bash
# Run benchmark and check for regressions
node --expose-gc benchmark-optimizations.js --iterations 50

# Parse results and fail if regression > 10%
node check-regression.js results/latest.json
```

## Future Enhancements

Potential additions:
- [ ] Flame graph generation integration
- [ ] CPU profiling integration
- [ ] Heap snapshot diff analysis
- [ ] Continuous performance tracking
- [ ] Performance budget enforcement
- [ ] Automated regression detection in CI
