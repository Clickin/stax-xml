# XML Parser Benchmarking & Profiling Infrastructure

Comprehensive benchmarking and profiling suite for testing XML parser performance, specifically designed to compare inlined vs non-inlined parser implementations.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Test Data Generation](#test-data-generation)
- [Running Benchmarks](#running-benchmarks)
- [Profiling & Flame Graphs](#profiling--flame-graphs)
- [Results Analysis](#results-analysis)
- [Configuration](#configuration)
- [Understanding the Results](#understanding-the-results)
- [Best Practices](#best-practices)

## Overview

This benchmarking infrastructure provides:

- **Multiple XML test patterns**: Small to huge files with varying characteristics
- **Statistical benchmarking**: Warmup runs, multiple iterations, percentile latencies
- **Profiling integration**: V8 profiling, Inspector protocol, clinic.js
- **Flame graph generation**: Visual CPU profile analysis
- **Comparative analysis**: Side-by-side comparison of baseline vs inlined parsers
- **Multiple output formats**: Console, JSON, CSV, Markdown, HTML

## Native SIMD and simdxml comparator contract

The simdxml comparator has a stricter contract than the older local parser
microbenchmarks.

- simdxml fixture input comes from `https://github.com/simdxml/simdxml`.
  The `simdxml-upstream-comparison.mjs` harness clones or reads that repository
  at the pinned upstream ref and reuses its benchmark fixture groups and XML
  files. Treat those fixtures as upstream comparator input data, not as
  stax-xml-authored fixtures.
- stax-xml native rows must be measured through Node.js plus napi-rs N-API.
  The benchmark imports `@stax-xml/native-aggregate-probe`, passes a Node
  `Buffer` or file path through the JavaScript wrapper, and measures the result
  returned to Node. Do not replace these rows with a standalone Rust binary or
  direct Rust library call when comparing stax-xml native addon performance.
- `--native-simd` affects only stax-xml native aggregate structural classifier
  paths. It does not change simdxml, quick-xml, Woodstox, or JavaScript rows.
  Explicit policies fail if unavailable instead of silently falling back.
- On x86_64, `--native-simd=auto` selects AVX2 when available, then SSE4.2,
  then scalar. On aarch64, `auto` selects NEON.
- Use `event-count-two-stage` and `count-eq-two-stage` to isolate classifier
  cost. Use `event-count-auto-stage` and `count-auto-stage` for representative
  heuristic behavior, because they can avoid full-byte classification on
  text-heavy input.

Reproduce the simdxml fixture comparator:

```bash
pnpm --filter benchmark run build:native-aggregate
pnpm --filter benchmark run bench:simdxml-upstream -- \
  --skip-fetch --skip-build \
  --groups shape \
  --runs 7 --warmups 2 \
  --native-tiers event-count-auto-stage,count-auto-stage,event-count-two-stage,count-eq-two-stage \
  --native-simd avx2
```

To compare SIMD policies, rerun the same command while changing only
`--native-simd` to `off`, `sse42`, `avx2`, and `auto`.

Recent local snapshot on a 13th Gen Intel Core i5-13600K, Windows x64,
Node v24.15.0, `shape` group, `runs=7`, `warmups=2`:

| Fixture | simdxml parse | stax auto event AVX2 | Ratio | stax auto count AVX2 | Ratio |
| --- | ---: | ---: | ---: | ---: | ---: |
| patent | 2289.9 MiB/s | 4485.7 MiB/s | 1.96x | 3296.8 MiB/s | 1.44x |
| attrheavy | 2737.4 MiB/s | 3572.1 MiB/s | 1.30x | 3019.0 MiB/s | 1.10x |
| textheavy | 14136.4 MiB/s | 16706.3 MiB/s | 1.18x | 18326.3 MiB/s | 1.30x |
| nested | 2373.3 MiB/s | 4203.4 MiB/s | 1.77x | 3285.4 MiB/s | 1.38x |

Forced two-stage classifier snapshot on the same shape fixtures:

| Policy | patent | attrheavy | textheavy | nested |
| --- | ---: | ---: | ---: | ---: |
| scalar/off | 1343.3 MiB/s | 1543.7 MiB/s | 1842.2 MiB/s | 1208.2 MiB/s |
| SSE4.2 | 3035.3 MiB/s | 3841.3 MiB/s | 4393.0 MiB/s | 2118.3 MiB/s |
| AVX2 | 3176.2 MiB/s | 3235.5 MiB/s | 6632.9 MiB/s | 2020.7 MiB/s |
| auto | 2271.1 MiB/s | 3152.8 MiB/s | 4620.2 MiB/s | 1994.2 MiB/s |

The forced two-stage table is diagnostic and may be noisier on 1 MiB fixtures.
The representative comparator rows are the auto-stage tiers above, because they
allow the heuristic to avoid classifying every byte on text-heavy input.

## Cursor regression contract

Node async cursor regression measurement depends on the native async buffer path. The previous `AsyncIterable<Buffer> -> ReadableStream adapter -> StaxXmlParser` compare logic was invalid for Node hot path regression measurement, so it should not be used again.

Mainline carries only the contract and evidence documents for this regression. If you need to rerun the cursor-vs-parser experiment or regenerate the published-regression snapshots, switch back to the `feat/cursor-optimizations` branch and use the harness there.

Only two benchmark rows are approved for this contract:

* `buffered-small`, which includes read time
* `streaming-large`, which compares the native current async buffer cursor with the published `ReadableStream` parser

For this regression, do not route Node async cursor hot paths through `ReadableStream`.

## Quick Start

### 1. Generate Test Data

First, generate the XML test files:

```bash
pnpm run generate:testdata
```

This creates 9 different XML patterns in `test-data/`:
- small-simple.xml (~500 bytes)
- medium-nested.xml (~50 KB)
- large-complex.xml (~5 MB)
- huge-document.xml (~50 MB)
- attribute-heavy.xml (~1 MB)
- text-heavy.xml (~2 MB)
- cdata-heavy.xml (~500 KB)
- namespace-heavy.xml (~100 KB)
- mixed-content.xml (~1 MB)

### 2. Run Complete Workflow

Run the full benchmark workflow:

```bash
pnpm run workflow:full
```

This will:
1. Generate test data (if not already present)
2. Run inlining benchmarks
3. Display comparison results

### 3. View Results

Results are saved to `results/` directory:
- `inlining-benchmark-*.json` - Raw benchmark data
- `inlining-comparison-*.txt` - Text comparison report

## Test Data Generation

### Generate All Test Files

```bash
pnpm run generate:testdata
```

### Manual Generation

```bash
node generate-test-xmls.mjs
```

### Custom Test Files

You can add custom XML files to `test-data/` directory. The benchmark suite will automatically include them.

## Running Benchmarks

### Inlining Comparison Benchmark

Compare baseline (non-inlined) vs inlined parser performance:

```bash
pnpm run bench:inlining
```

**Output includes:**
- Throughput (MB/s)
- Events per second
- Latency percentiles (P50, P95, P99)
- Memory usage
- GC time

### Configuration Options

Set environment variables to customize benchmark behavior:

```bash
# Use quick config (fewer runs, smaller files)
BENCHMARK_CONFIG=quick pnpm run bench:inlining

# Use comprehensive config (more runs, all files)
BENCHMARK_CONFIG=comprehensive pnpm run bench:inlining

# Use CI config (optimized for CI/CD)
BENCHMARK_CONFIG=ci pnpm run bench:inlining
```

### Important: GC Control

For accurate memory measurements, always run with `--expose-gc`:

```bash
node --expose-gc benchmark-inlining.mjs
```

The `--expose-gc` flag is already included in the npm scripts.

## Profiling & Flame Graphs

### Profile Specific Variant

Profile the inlined parser:

```bash
pnpm run profile:inlined
```

Profile the baseline parser:

```bash
pnpm run profile:baseline
```

### Generate Flame Graphs

Using V8 profiling (built-in):

```bash
pnpm run profile:flamegraph
```

Using clinic.js (requires installation):

```bash
pnpm run profile:clinic
```

### Profile All Variants

Profile both baseline and inlined with multiple test files:

```bash
pnpm run profile:all
```

### Custom Profiling

```bash
# Profile specific variant, test file, method, and iterations
node profile-parsers.mjs <variant> <testfile> <method> <iterations>

# Examples:
node profile-parsers.mjs inlined medium-nested.xml inspector 100
node profile-parsers.mjs baseline large-complex.xml v8-prof 50
```

**Profiling methods:**
- `inspector` - Chrome DevTools compatible CPU profile
- `v8-prof` - V8 internal profiler with text output
- `clinic` - clinic.js flame graphs (requires clinic.js)

### Analyzing Profiles

#### Inspector Profiles (.cpuprofile)

1. Open Chrome DevTools
2. Go to Performance tab
3. Click "Load profile" button
4. Select the `.cpuprofile` file

#### V8 Profiles (.txt)

Text-based call tree with time percentages. Read directly or use with flamegraph tools.

#### Clinic Profiles (.html)

Open the generated HTML file in any browser to view interactive flame graphs.

## Results Analysis

### Compare Latest Results

Display comparison in console:

```bash
pnpm run compare:latest
```

### Generate HTML Report

```bash
pnpm run compare:html
```

Open the generated HTML file in a browser for visual analysis.

### Generate CSV Export

```bash
pnpm run compare:csv
```

Import into spreadsheet software for custom analysis.

### Generate Markdown Report

```bash
pnpm run compare:markdown
```

Include in documentation or GitHub comments.

### Manual Comparison

```bash
node compare-results.mjs <results-file.json> --format=<format>

# Example:
node compare-results.mjs results/inlining-benchmark-2024-01-15.json --format=html
```

## Configuration

### Benchmark Configuration

Edit `benchmark.config.mjs` to customize:

- **warmupRuns**: Number of warmup iterations (default: 3)
- **measurementRuns**: Number of measured iterations (default: 10)
- **gcBetweenRuns**: Force GC between runs (default: true)
- **testPatterns**: Enable/disable specific test files

### Predefined Configurations

```typescript
import { quickConfig, comprehensiveConfig, ciConfig } from './benchmark.config';

// Quick benchmarks (development)
const config = quickConfig;

// Comprehensive benchmarks (release validation)
const config = comprehensiveConfig;

// CI/CD benchmarks (automated testing)
const config = ciConfig;
```

## Understanding the Results

### Throughput

**MB/s (Megabytes per second)**: How fast the parser processes XML data.

- Higher is better
- Varies significantly based on XML structure
- Compare within same file, not across files

### Latency

**P50 (Median)**: Half of requests complete faster than this time

**P95**: 95% of requests complete faster than this time

**P99**: 99% of requests complete faster than this time

- Lower is better
- P95/P99 show worst-case behavior
- Important for real-time applications

### Events Per Second

Number of XML events (start element, end element, text, etc.) parsed per second.

- Higher is better
- Indicates parser throughput independent of document size

### Memory Usage

Memory allocated during parsing (heap usage).

- Lower is better
- Important for large document processing
- Consider both peak and average usage

### Improvement Percentages

```
Positive % (green) = Inlined is faster/better
Negative % (red) = Baseline is faster/better
```

## Best Practices

### 1. Warm Up the JIT

Always include warmup runs before measurements:

```typescript
warmupRuns: 3, // Minimum
measurementRuns: 10
```

### 2. Control Garbage Collection

Run with `--expose-gc` and force GC between iterations:

```typescript
gcBetweenRuns: true
```

### 3. Run Multiple Iterations

More iterations = more reliable statistics:

```typescript
measurementRuns: 10 // Minimum
// Use 20+ for production validation
```

### 4. Test Multiple File Sizes

Different optimizations work better at different scales:

- Small files: Startup overhead matters
- Large files: Throughput matters
- Huge files: Memory efficiency matters

### 5. Compare Like with Like

Only compare results from:
- Same machine
- Same Node.js version
- Same test data
- Same time period (avoid thermal throttling)

### 6. Use Version Control

Save benchmark results with version tags:

```bash
git tag benchmark-v1.0.0
pnpm run bench:inlining
mv results/inlining-benchmark-*.json results/benchmark-v1.0.0.json
```

### 7. Automate in CI/CD

Add to CI pipeline:

```yaml
- name: Run benchmarks
  run: pnpm run bench:inlining
  env:
    BENCHMARK_CONFIG: ci

- name: Compare results
  run: pnpm run compare:markdown
```

### 8. Profile When Optimizing

Before optimizing:
```bash
pnpm run profile:baseline
```

After optimizing:
```bash
pnpm run profile:inlined
```

Compare flame graphs to verify improvements.

## Troubleshooting

### "No test files found"

Run `pnpm run generate:testdata` first.

### "Baseline parser not found"

Ensure `StaxXmlParserSync.baseline.ts` exists in the source directory.

### High variability in results

- Close other applications
- Disable CPU frequency scaling
- Increase measurement runs
- Check for thermal throttling

### Out of memory errors

- Disable huge file tests
- Increase Node.js memory limit: `NODE_OPTIONS=--max-old-space-size=4096`

### Profiling fails

- Ensure you have write permissions to `profiles/` directory
- For clinic.js: Install with `npm install -g clinic`

## Advanced Usage

### Custom Test Patterns

Add to `generate-test-xmls.mjs`:

```typescript
{
  name: 'custom-pattern',
  description: 'Custom XML pattern',
  targetSize: 1_000_000,
  generate: () => {
    // Your custom XML generation logic
    return xml;
  }
}
```

### Integration with Other Tools

Export results to other analysis tools:

```typescript
import { loadBenchmarkResults } from './compare-results.js';

const data = loadBenchmarkResults('results/latest.json');
// Process with your own analysis logic
```

### Continuous Benchmarking

Set up automated benchmarking:

```bash
# Run benchmarks daily
cron: "0 2 * * *"
  - pnpm run workflow:full
  - Upload results to storage
```

## Related Documentation

- [XML Parser API](../stax-xml/README.md)
- [Performance Optimization Guide](../../docs/performance.md)
- [Contributing](../../CONTRIBUTING.md)

## License

MIT
