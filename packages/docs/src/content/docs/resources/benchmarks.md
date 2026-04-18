---
title: Benchmarks
description: Performance comparisons and benchmark results for StAX-XML
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/resources/benchmarks.png
  - tag: meta
    attrs:
      property: og:image:width
      content: "1200"
  - tag: meta
    attrs:
      property: og:image:height
      content: "630"
  - tag: meta
    attrs:
      name: twitter:image
      content: https://clickin.github.io/stax-xml/og/resources/benchmarks.png
---

StAX-XML is designed for high performance across various XML processing scenarios. This page presents benchmark results comparing StAX-XML with other popular XML parsing libraries.

## Benchmark Environment

The refreshed parser comparison tables on this page were rerun with:
- **CPU**: 13th Gen Intel(R) Core(TM) i5-13600K (~4.70-4.80 GHz)
- **Runtime**: Node.js 24.12.0 (x64-win32) with garbage collection exposed (`--expose-gc`)
- **Tool**: [Mitata](https://github.com/evanw/mitata) for accurate performance measurement
- **Libraries Compared**: fast-xml-parser, xml2js, txml, and StAX-XML

Writer sections later on this page are older reference measurements and were not rerun as part of this release.

## Parser Performance

### Small Documents (2KB)

For typical web service responses and configuration files (complex.xml):

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 140.73 µs | ~7,106 ops/sec | 25.90 kb | Fastest, lightweight |
| **stax-xml to object** | 288.04 µs | ~3,472 ops/sec | 28.70 kb | Object conversion |
| **stax-xml consume** | 294.19 µs | ~3,399 ops/sec | 24.75 kb | Stream processing |
| fast-xml-parser | 568.46 µs | ~1,759 ops/sec | 125.91 kb | DOM-based |
| xml2js | 1.03 ms | ~971 ops/sec | 204.75 kb | Callback-based, memory intensive |

### Medium Documents (4KB)

For larger API responses and data files (books.xml):

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 167.32 µs | ~5,977 ops/sec | 46.68 kb | Fastest, lightweight |
| **stax-xml consume** | 365.77 µs | ~2,734 ops/sec | 44.32 kb | Stream processing |
| **stax-xml to object** | 367.73 µs | ~2,719 ops/sec | 53.85 kb | Object conversion |
| fast-xml-parser | 897.18 µs | ~1,115 ops/sec | 470.77 kb | Good balance |
| xml2js | 1.59 ms | ~629 ops/sec | 489.41 kb | Memory intensive |

### Large Documents (1MB to 1GB)

For processing large XML files (RSS feeds, data exports, etc.):

| File Size | Parser Type | Processing Time | Memory Usage | Performance Ratio |
|-----------|-------------|-----------------|--------------|-------------------|
| 1MB | **sync parser** | 16.73 ms | 14.36 mb | Baseline |
| 1MB | async parser | 29.82 ms | 28.88 mb | 1.78x slower |
| 10MB | **sync parser** | 138.98 ms | 20.99 mb | Baseline |
| 10MB | async parser | 266.30 ms | 28.16 mb | 1.92x slower |
| 100MB | **sync parser** | 772.70 ms | 143.40 mb | Baseline |
| 100MB | async parser | 1.31 s | 42.58 mb | 1.70x slower |
| 1GB | async parser | 11.90 s | 35.88 mb | Memory efficient |

**Key Insights:**
- Sync parser is faster for smaller files but uses more memory
- Async parser maintains low memory usage even for very large files
- For files >100MB, async parser becomes essential for memory management

### Sync Parser Library Comparison

Detailed comparison of sync parsers across different file sizes:

#### Medium-Large Documents (13MB)

Performance results on midsize.xml (13MB):

| Library | Average Time | Operations/sec | Memory Usage | Performance Notes |
|---------|--------------|----------------|--------------|------------------|
| **xml2js** | 1.00 ms | ~1,000 ops/sec | 310.71 kb | Exceptional performance* |
| **stax-xml to object** | 163.03 ms | ~6.13 ops/sec | 35.40 mb | Object conversion |
| **stax-xml consume** | 167.10 ms | ~5.98 ops/sec | 4.92 mb | Stream processing |
| **txml** | 178.27 ms | ~5.61 ops/sec | 126.93 mb | Lightweight DOM |
| fast-xml-parser | 781.16 ms | ~1.28 ops/sec | 148.02 mb | Memory intensive |

*xml2js shows exceptional performance on this 13MB file (1000x faster than normal), likely due to the XML structure being optimized for DOM parsing environments with frequent element reuse and shallow nesting.

#### Large Documents (98MB)

Performance results on large.xml (98MB):

| Library | Average Time | Operations/sec | Memory Usage | Performance Notes |
|---------|--------------|----------------|--------------|------------------|
| **stax-xml consume** | 755.27 ms | ~1.32 ops/sec | 35.10 mb | Best overall |
| **stax-xml to object** | 1.06 s | ~0.94 ops/sec | 7.45 mb | Memory efficient |
| **txml** | 1.23 s | ~0.81 ops/sec | 890.25 mb | High memory |
| fast-xml-parser | 5.26 s | ~0.19 ops/sec | 1.03 gb | Slow, memory intensive |
| xml2js | 6.83 s | ~0.15 ops/sec | 651.69 mb | Slowest performance |

**Performance Crossover Analysis:**
- **Small files (2-4KB)**: txml still leads raw parser throughput
- **Medium files (13MB)**: xml2js remains an anomalous outlier on this fixture, while `stax-xml consume` and `stax-xml to object` stay in the same general throughput band
- **Large files (98MB)**: StAX-XML provides best balance of speed and memory efficiency
- **Very large files (1GB+)**: Only async parsers remain viable

## Converter API vs Plain Parser

The benchmark below compares three ways to build the **same object output**:

- A handwritten plain parser built directly on `StaxXmlParserSync`
- The declarative converter API
- The converter API with `.compile()` enabled

Fixture used in the current workspace run:

- `catalog` document
- `800` `<featured>` elements
- `800` `<book>` elements
- output includes:
  - root object field
  - root array of objects
  - direct scalar field
  - transformed derived field

Local loop-average run on the same Node.js 24.12.0 / i5-13600K environment:

| Implementation | Average time | Notes |
| --- | ---: | --- |
| plain parser | **3.01 ms** | Lowest overhead, handwritten state machine |
| converter api | 311.49 ms | Declarative but uncompiled |
| converter api compiled | **248.05 ms** | Declarative schema with compiled root processor |

What this means:

- The handwritten parser is still the raw-throughput ceiling for this fixture.
- The uncompiled converter API pays a large abstraction cost.
- The compiled converter path still carries substantial abstraction overhead on this fixture, but it now beats the uncompiled converter path.

The benchmark script verifies that all three implementations produce identical JSON before measuring:

```bash
pnpm --filter=benchmark run dev:converter:plain-output
```

The script also writes a markdown summary under:

```text
packages/benchmark/results/converter-plain-output-benchmark.md
```

## Writer Performance

### Small Document Building

Building XML documents from small JSON data (test_ordered.json):

| Library | Average Time | Operations/sec | Memory Usage | Performance Ratio |
|---------|--------------|----------------|--------------|-------------------|
| **fast-xml-parser builder** | 130.68 µs | ~7,652 ops/sec | 48.31 kb | Fastest |
| **stax-xml writer sync** | 170.92 µs | ~5,851 ops/sec | 87.92 kb | 1.31x slower |
| xml2js builder | 305.88 µs | ~3,269 ops/sec | 133.29 kb | 2.34x slower |
| stax-xml writer | 450.07 µs | ~2,222 ops/sec | 521.40 kb | 3.44x slower |

### Large Document Building (1MB)

Building large XML documents from big JSON data:

| Library | Average Time | Operations/sec | Memory Usage | Performance Ratio |
|---------|--------------|----------------|--------------|-------------------|
| **fast-xml-parser builder** | 13.77 ms | ~72.6 ops/sec | 2.82 mb | Fastest |
| **stax-xml writer sync** | 58.56 ms | ~17.1 ops/sec | 17.30 mb | 4.25x slower |
| stax-xml writer | 122.45 ms | ~8.2 ops/sec | 1.44 mb | 8.89x slower |

### Async vs Sync Writer Comparison

Comparing async and sync writers across different element counts:

| Element Count | Async Writer | Sync Writer | Performance Ratio |
|---------------|--------------|-------------|-------------------|
| 1K elements | 42.25 ms | 14.27 ms | 2.96x faster (sync) |
| 5K elements | 179.80 ms | 62.12 ms | 2.89x faster (sync) |
| 10K elements | 350.53 ms | 122.74 ms | 2.86x faster (sync) |

**Key Insights:**
- Sync writer consistently ~3x faster than async writer
- Fast-xml-parser has the best builder performance for both small and large documents
- Sync writer uses more memory but provides better throughput
- Async writer is better for memory-constrained environments

## Memory Efficiency

### Memory Usage Patterns

**StAX-XML Advantages:**
- **Constant memory usage** for streaming operations
- **Minimal object allocation** during parsing
- **Garbage collection friendly** with short-lived objects
- **Low memory overhead** compared to DOM-based parsers

**Real Benchmark Results:**
```
File Size: 10MB XML Document

stax-xml async parser:     ~10.30 MB peak memory
stax-xml sync parser:      ~24.03 MB peak memory
fast-xml-parser:           ~513.58 kb (4KB file)
xml2js:                    ~773.91 kb (4KB file)
txml:                      ~3.17 kb (4KB file)
```

**Large File Memory Usage:**
```
File Size: 100MB XML Document

stax-xml async parser:     ~9.82 MB peak memory (98% reduction)
stax-xml sync parser:      ~209.26 MB peak memory

File Size: 1GB XML Document

stax-xml async parser:     ~4.81 MB peak memory (99.5% reduction)
```

## Benchmark Scripts

You can run these benchmarks yourself using the included benchmark suite:

```bash
# Run all benchmarks
npm run dev:bench:all

# Run specific benchmark categories
npm run dev:bench:sync       # Sync parser and writer benchmarks
npm run dev:bench:async      # Async parser and writer benchmarks

# Individual benchmarks
npm run dev:parser:2kb       # Small document parsing (2KB)
npm run dev:parser:4kb       # Medium document parsing (4KB)
npm run dev:parser:13mb      # Medium-large document parsing (13MB)
npm run dev:parser:98mb      # Large document parsing (98MB)
npm run dev:builder:small    # Small document building
npm run dev:builder:big      # Large document building (1MB)
npm run dev:converter:plain-output   # Plain parser vs converter API parity benchmark
npm run dev:async:parser     # Async parser with various file sizes
npm run dev:async:writer     # Async vs sync writer comparison
```

### Custom Benchmark

Create your own performance test:

```typescript
import { bench, run } from 'mitata';
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

const testXml = '<root><item>test</item></root>';

bench('StAX-XML Parsing', () => {
  const parser = new StaxXmlParserSync(testXml);
  let count = 0;

  for (const event of parser) {
    if (event.type === XmlEventType.START_ELEMENT) {
      count++;
    }
  }

  return count;
});

await run();
```

## Performance Tips

### Optimization Strategies

1. **Choose the Right Parser**
   - Use `StaxXmlParserSync` for documents <10MB
   - Use `StaxXmlParser` for larger files or streaming scenarios

2. **Minimize Memory Allocation**
   - Process events as they arrive rather than storing them
   - Use object pooling for frequently created objects
   - Avoid string concatenation in hot paths

3. **Efficient Event Handling**
   - Use switch statements instead of if-else chains
   - Pre-compile regular expressions outside parsing loops
   - Use Set for element name lookups instead of arrays

4. **Streaming Best Practices**
   - Configure appropriate chunk sizes (default 64KB)
   - Implement backpressure handling for writers
   - Use async iteration for non-blocking processing

### Performance Monitoring

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

function benchmarkParsing(xml: string, iterations: number = 1000) {
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const parser = new StaxXmlParserSync(xml);
    let eventCount = 0;

    for (const event of parser) {
      eventCount++;
    }
  }

  const end = performance.now();
  const totalTime = end - start;
  const avgTime = totalTime / iterations;
  const opsPerSec = 1000 / avgTime;

  console.log(`Average time per parse: ${avgTime.toFixed(2)}ms`);
  console.log(`Operations per second: ${opsPerSec.toFixed(0)}`);
}
```

## Continuous Benchmarking

We continuously monitor performance to ensure StAX-XML maintains its speed advantages:

- **Automated benchmarks** run on every release
- **Regression testing** prevents performance degradation
- **Memory profiling** ensures efficient resource usage
- **Cross-platform testing** on Node.js, Bun, and Deno

## Contributing Benchmarks

Help improve our benchmarks:

1. **Add new test cases** for your specific use cases
2. **Report performance issues** with reproducible examples
3. **Submit optimizations** with benchmark evidence
4. **Test on different platforms** and share results

See our [GitHub repository](https://github.com/Clickin/stax-xml) for contribution guidelines.
