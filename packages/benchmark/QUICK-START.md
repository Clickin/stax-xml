# Quick Start Guide - GC Pressure Benchmarking

Fast start guide for using the GC pressure and memory benchmarking tools.

## 🚀 Quick Commands

```bash
# 1. Generate test data (run once)
pnpm generate:testdata

# 2. Run comprehensive benchmark
pnpm bench:gc:full

# 3. Quick comparison (during development)
pnpm bench:gc:quick

# 4. See examples
pnpm example:gc
```

## 📊 Common Use Cases

### 1. Testing a New Optimization

```bash
# Quick check (50 iterations)
node --expose-gc quick-benchmark.mjs \
  ../stax-xml/src/StaxXmlParserSync.baseline.js \
  ../stax-xml/src/StaxXmlParserSync.myoptimization.js \
  --size medium --iterations 50

# If looks good, run thorough test
node --expose-gc quick-benchmark.mjs \
  ../stax-xml/src/StaxXmlParserSync.baseline.js \
  ../stax-xml/src/StaxXmlParserSync.myoptimization.js \
  --size large --iterations 200
```

**Accept if:**
- ✓ Improvement > 5%
- ✓ p-value < 0.05 (statistically significant)
- ✓ Memory increase < 10%
- ✓ GC events don't increase significantly

**Reject if:**
- ✗ Memory increase > 50%
- ✗ Performance regression > 5%
- ✗ GC events increase > 50%

### 2. Full Benchmark Suite

```bash
# Fast benchmark (good for CI)
pnpm bench:gc:fast

# Thorough benchmark (for final validation)
pnpm bench:gc:thorough

# Results saved to: results/benchmark-<timestamp>.json
```

### 3. Generate Report

```bash
# Generate markdown report from latest results
pnpm report:latest

# Or specify a file
node generate-report.mjs results/benchmark-2024-01-15.json report.md
```

## 📖 Reading Results

### Console Output

```
=== COMPARISON ===

Performance: 1.15x faster
Memory: 8.2% less heap used
GC Pressure: 12.3% fewer collections
GC Time: baseline=45.6ms, optimized=39.2ms

=== Statistical Analysis ===

Baseline:
  Mean: 12.450 ms
  Median: 12.300 ms
  Std Dev: 0.823 ms

Optimized:
  Mean: 10.826 ms
  Median: 10.720 ms
  Std Dev: 0.715 ms

Comparison:
  Improvement: 13.0%
  Speedup: 1.15x

Statistical Significance:
  p-value: 0.000001
  Significant: YES (95% confidence)
  Effect size (Cohen's d): 2.134 (large)

✓ Performance improvement is statistically significant
```

### What to Look For

**Good signs:**
- p-value < 0.05 (significant)
- Improvement > 5%
- Effect size: "medium" or "large"
- Memory improvement or small increase (<10%)
- Fewer GC events

**Warning signs:**
- p-value > 0.05 (not significant)
- Memory increase > 50%
- More GC events (>50% increase)
- High variance (CV > 20%)

## 🔧 Advanced Usage

### Custom Test Data

```typescript
import { benchmarkWithGC } from './benchmark-gc-pressure';

const xml = '<root>' + '...your test XML...' + '</root>';

const result = await benchmarkWithGC(
  'my-test',
  () => {
    const parser = new MyParser();
    parser.write(xml);
    parser.end();
  },
  100,  // iterations
  10    // warmup
);
```

### Memory Tracking

```typescript
import { withMemoryTracking } from './memory-tracker';

const { result, memoryReport } = await withMemoryTracking(
  () => parseHugeFile(),
  { sampleInterval: 50, label: 'Huge File' }
);

console.log(`Peak heap: ${memoryReport.peakHeapUsed} MB`);
```

### Statistical Comparison

```typescript
import { welchTTest } from './statistical-analysis';

const tTest = welchTTest(baselineTimes, optimizedTimes);

if (tTest.significant && tTest.improvement > 5) {
  console.log('✓ Accept optimization');
} else {
  console.log('✗ Reject optimization');
}
```

## 🎯 Optimization Workflow

### Step 1: Establish Baseline

```bash
# Run baseline benchmark
node --expose-gc quick-benchmark.mjs \
  ../stax-xml/src/StaxXmlParserSync.baseline.js \
  ../stax-xml/src/StaxXmlParserSync.js \
  --size medium

# Save baseline results for reference
```

### Step 2: Implement Optimization

Create your optimized version:
- `StaxXmlParserSync.myopt.ts`

### Step 3: Quick Test

```bash
node --expose-gc quick-benchmark.mjs \
  ../stax-xml/src/StaxXmlParserSync.baseline.js \
  ../stax-xml/src/StaxXmlParserSync.myopt.js \
  --size small --iterations 50
```

**If looks promising, continue. Otherwise, go back to Step 2.**

### Step 4: Thorough Test

```bash
node --expose-gc quick-benchmark.mjs \
  ../stax-xml/src/StaxXmlParserSync.baseline.js \
  ../stax-xml/src/StaxXmlParserSync.myopt.js \
  --size large --iterations 200 --heap
```

### Step 5: Full Benchmark Suite

```bash
# Update benchmark-optimizations.mjs to include your variant
# Then run full suite
pnpm bench:gc:full
```

### Step 6: Make Decision

**Accept if:**
- All patterns show improvement or neutral
- No pattern shows >50% memory regression
- Statistical significance on key patterns

**Reject if:**
- Any pattern shows significant regression
- Memory increase >50% on any pattern
- Improvement too small to justify complexity

## 📝 Interpreting p-values

- **p < 0.001**: Very strong evidence of difference
- **p < 0.01**: Strong evidence of difference
- **p < 0.05**: Moderate evidence of difference (our threshold)
- **p > 0.05**: No significant difference (could be noise)

## 🔍 Troubleshooting

### High Variance (CV > 20%)

```bash
# Increase iterations
--iterations 200

# Close other applications
# Check CPU/memory is not saturated
```

### No GCs Detected

```bash
# Ensure --expose-gc is used
node --expose-gc script.mjs

# Increase test data size
--size large
```

### Inconsistent Results

```bash
# Use more warmup iterations
--warmup 20

# Force GC between runs
# (automatically done in benchmarkWithGC)

# Run multiple times and compare
```

## 📚 More Information

- Full documentation: `README-BENCHMARKING.md`
- Example usage: `pnpm example:gc`
- Statistical details: See `statistical-analysis.mjs`

## 💡 Tips

1. **Always run with --expose-gc** for accurate GC measurements
2. **Use multiple test patterns** to catch pattern-specific issues
3. **Check statistical significance** before trusting results
4. **Monitor memory closely** - the inlining failure was caught by memory metrics
5. **Start with quick tests** during development, use thorough tests for validation
6. **Save results** for future comparisons
7. **Generate reports** for documentation and review
