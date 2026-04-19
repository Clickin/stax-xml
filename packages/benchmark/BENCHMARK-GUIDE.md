# StaxXML Benchmark Guide

Simple guide for running performance benchmarks on the StaxXML parser.

---

## Quick Start

```bash
# 1. Generate test XML files (one time)
pnpm run generate:testdata

# 2. Run baseline benchmark
pnpm run bench:baseline

# 3. View results
# Results are displayed in console and saved to results/ directory
```

---

## Available Benchmarks

### Main Benchmark
```bash
pnpm run bench:baseline
```
- Tests 5 different XML patterns
- 100 iterations per pattern
- Measures performance and GC pressure
- Outputs summary table

### Quick Benchmark (faster)
```bash
pnpm run bench:baseline:quick
```
- Same tests but only 50 iterations
- Good for rapid iteration during development

### GC Pressure Example
```bash
pnpm run example:gc
```
- Demonstrates GC monitoring capabilities
- Shows how to measure memory allocation patterns

### 1GiB Writer Comparison
```bash
# Quick smoke test, 16 MiB per case
pnpm run dev:writer:1gb

# Full 1 GiB comparison
pnpm run bench:writer:1gb
```
- Compares async writer and sync sink writer
- Runs both in-memory targets and temp-file targets
- Reports written bytes, records, elapsed time, throughput, peak RSS, and peak heap

---

## Understanding Results

### Performance Metrics

```
Average time:       10.50 ms      ← Time per parse
Min time:           8.71 ms       ← Best case
Max time:           16.35 ms      ← Worst case
Std deviation:      2.81 ms       ← Consistency (lower is better)
Throughput:         132.10 MB/s   ← Processing speed
Events/sec:         298220        ← Parser throughput
```

### GC Metrics

```
Major GCs:          0             ← Full garbage collections
Minor GCs:          40            ← Partial garbage collections
Total GC time:      78.72 ms      ← Time spent in GC
Avg GC pause:       1.49 ms       ← Average pause duration
Heap delta:         2.53 MB       ← Memory allocated
```

**Good GC metrics:**
- Major GCs: 0-5 (few is better)
- Minor GCs: Moderate (40-100 is normal)
- Avg GC pause: <2ms (lower is better)
- Heap delta: <10MB per parse (lower is better)

---

## Test XML Patterns

The benchmark tests these patterns:

| Pattern | Size | Description | Tests |
|---------|------|-------------|-------|
| **small-simple** | ~500B | Minimal XML | Overhead measurement |
| **attribute-heavy** | ~2MB | Many attributes | Attribute parsing |
| **text-heavy** | ~2MB | Large text content | Text processing |
| **medium-nested** | ~27MB | Nested structure | Real-world scenario |
| **large-complex** | ~19MB | Complex mixed | Stress test |

---

## Interpreting Results

### Throughput Expectations

```
Excellent:  >200 MB/s
Good:       150-200 MB/s
Acceptable: 100-150 MB/s
Poor:       <100 MB/s
```

**Note:** Actual throughput varies by:
- CPU speed and architecture
- Memory speed
- Node.js version
- XML complexity (attributes, nesting, text)

### Current Baseline Performance

Based on our testing:
```
Average throughput: 125 MB/s
Peak throughput:    270 MB/s (text-heavy)
Lowest throughput:  97 MB/s (large-complex)
GC pressure:        Very low (0 major GCs)
```

This is **competitive** with the JavaScript XML parser ecosystem.

---

## When to Benchmark

### Before Making Changes
```bash
# 1. Run baseline
pnpm run bench:baseline

# 2. Save results
cp results/baseline-*.json results/before-change.json
```

### After Making Changes
```bash
# 1. Run benchmark again
pnpm run bench:baseline

# 2. Compare
# Manually compare JSON files or use diff
```

### Decision Criteria

**Accept a change if:**
- ✅ Throughput improves by >5%
- ✅ GC events don't increase >50%
- ✅ Memory usage doesn't increase >10%
- ✅ No regressions on any test pattern

**Reject a change if:**
- ❌ Memory usage increases >50%
- ❌ Throughput decreases >5% (significant)
- ❌ GC events increase >50%
- ❌ Major regression on any pattern

---

## Advanced Usage

### Custom Iterations
```bash
# Modify benchmark-baseline.mjs
# Change: await benchmarkFile(testFile, 100)
# To:     await benchmarkFile(testFile, 500)
```

### Profile with Chrome DevTools
```bash
node --inspect --expose-gc benchmark-baseline.mjs

# Then open chrome://inspect
# Click "Open dedicated DevTools for Node"
# Go to Profiler tab
# Start profiling
```

### Memory Profiling
```bash
node --expose-gc --trace-gc benchmark-baseline.mjs

# Watch GC events in real-time
```

### CPU Profiling (V8)
```bash
node --prof --expose-gc benchmark-baseline.mjs
node --prof-process isolate-*.log > profile.txt

# Analyze profile.txt for hot functions
```

---

## Optimization Study Results

We conducted comprehensive optimization studies and found:

### What We Tested
1. ❌ **Function inlining** - Failed (-5% performance, +180% memory)
2. ❌ **Manual attribute parsing** - Failed (-1% performance)
3. ❌ **Fast entity decoding** - Failed (-0.8% performance)
4. ❌ **Object pooling** - Failed (V8 hidden class conflicts)

### Key Learnings
- ✅ **Baseline is already well-optimized**
- ✅ **V8 JIT does better optimization than manual attempts**
- ✅ **Trust the baseline implementation**

**Full report:** See `../stax-xml/OPTIMIZATION_STUDY_FINAL_REPORT.md`

---

## Troubleshooting

### "Test data not found"
```bash
# Generate test files
pnpm run generate:testdata
```

### "GC control not available"
```bash
# Always use --expose-gc flag
node --expose-gc benchmark-baseline.mjs
```

### Inconsistent Results
```bash
# 1. Close other applications
# 2. Disable CPU frequency scaling
# 3. Run multiple times and average
# 4. Consider using CPU limiting (see WSL guide in docs)
```

### Out of Memory
```bash
# Increase Node.js heap
node --max-old-space-size=8192 --expose-gc benchmark-baseline.mjs
```

---

## Related Documentation

- **Optimization Study:** `../stax-xml/OPTIMIZATION_STUDY_FINAL_REPORT.md`
- **Inlining Study:** `../stax-xml/INLINING_STUDY_SUMMARY.md`
- **GC Benchmarking:** `GC-BENCHMARK-README.md` (detailed GC tools)

---

## Contributing

If you improve performance:

1. Run `pnpm run bench:baseline` before changes
2. Make your changes
3. Run `pnpm run bench:baseline` after changes
4. Document improvements >5%
5. Include benchmark results in PR

**Remember:** Benchmark on multiple machines to confirm improvements are real, not noise.

---

**Last Updated:** October 18, 2025
**Baseline Performance:** 125 MB/s average throughput
**GC Pressure:** Very low (0 major GCs typical)
