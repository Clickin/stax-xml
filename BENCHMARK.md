# Benchmarks

Generated: 2026-04-18T17:14:32.868Z

Environment:
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K (~4.84 GHz)
- Runtime: node 24.12.0 (x64-win32)

This report is generated from the canonical release benchmark set. The docs benchmark pages are derived from the same raw JSON results.

## Benchmark Environment

The refreshed benchmark tables on this page were rerun with:
- **CPU**: 13th Gen Intel(R) Core(TM) i5-13600K (~4.84 GHz)
- **Runtime**: node 24.12.0 (x64-win32) with garbage collection exposed (`--expose-gc`)
- **Tool**: [Mitata](https://github.com/evanw/mitata)
- **Canonical Set**: parser 2KB / 4KB / 13MB / 98MB, async size-comparison, writer small / big / async, converter parity

## Parser Performance

### Small Documents (2KB)

For typical web service responses and configuration files (complex.xml):

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 103.59 µs | ~9,654 ops/sec | 24.95 kb | Fastest, lightweight |
| **stax-xml to object** | 269.30 µs | ~3,713 ops/sec | 28.66 kb | Object conversion |
| **stax-xml consume** | 273.10 µs | ~3,662 ops/sec | 23.45 kb | Stream processing |
| fast-xml-parser | 530.77 µs | ~1,884 ops/sec | 129.45 kb | DOM-based |
| xml2js | 937.49 µs | ~1,067 ops/sec | 212.32 kb | Callback-based, memory intensive |

### Medium Documents (4KB)

For larger API responses and data files (books.xml):

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 18.95 µs | ~52,767 ops/sec | 5.23 kb | Fastest, lightweight |
| **stax-xml consume** | 298.34 µs | ~3,352 ops/sec | 45.26 kb | Stream processing |
| **stax-xml to object** | 296.61 µs | ~3,371 ops/sec | 51.61 kb | Object conversion |
| fast-xml-parser | 627.70 µs | ~1,593 ops/sec | 629.38 kb | Good balance |
| xml2js | 1.16 ms | ~862.19 ops/sec | 635.69 kb | Memory intensive |

### Large Documents (1MB to 1GB)

For processing large XML files (RSS feeds, data exports, etc.):

| File Size | Parser Type | Processing Time | Memory Usage | Performance Ratio |
|-----------|-------------|-----------------|--------------|-------------------|
| 1MB | **sync parser** | 8.83 ms | 14.33 mb | Baseline |
| 1MB | async parser | 14.40 ms | 28.53 mb | 1.63x slower |
| 10MB | **sync parser** | 72.25 ms | 21.02 mb | Baseline |
| 10MB | async parser | 115.42 ms | 63.83 mb | 1.60x slower |
| 100MB | **sync parser** | 638.57 ms | 143.35 mb | Baseline |
| 100MB | async parser | 1.21 s | 27.15 mb | 1.89x slower |
| 1GB | async parser | 11.47 s | 109.57 mb | Memory efficient |

**Key Insights:**
- Sync parser is faster for smaller files.
- Async parser keeps memory usage flatter as file size grows.
- For files above 100MB, async parsing is the practical low-memory path.

### Sync Parser Library Comparison

#### Medium-Large Documents (13MB)

Performance results on midsize.xml (13MB):

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **xml2js** | 734.63 µs | ~1,361 ops/sec | 470.44 kb | Exceptional performance* |
| **stax-xml to object** | 91.75 ms | ~10.9 ops/sec | 35.45 mb | Object conversion |
| **stax-xml consume** | 87.03 ms | ~11.49 ops/sec | 5.00 mb | Stream processing |
| **txml** | 117.84 ms | ~8.49 ops/sec | 117.60 mb | Lightweight DOM |
| fast-xml-parser | 586.30 ms | ~1.71 ops/sec | 140.82 mb | Memory intensive |

*xml2js remains an outlier on this fixture, likely because the document shape heavily favors its DOM-oriented parsing model.

#### Large Documents (98MB)

Performance results on large.xml (98MB):

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **stax-xml consume** | 613.11 ms | ~1.63 ops/sec | 35.14 mb | Best overall |
| **stax-xml to object** | 678.97 ms | ~1.47 ops/sec | 7.49 mb | Memory efficient |
| **txml** | 1.12 s | ~0.89 ops/sec | 858.90 mb | High memory |
| fast-xml-parser | 4.93 s | ~0.2 ops/sec | 1.09 gb | Slow, memory intensive |
| xml2js | 6.50 s | ~0.15 ops/sec | 650.59 mb | Slowest performance |

## Converter API vs Plain Parser

The benchmark below compares three ways to build the **same object output**:

- A handwritten plain parser built directly on `StaxXmlParserSync`
- The declarative converter API
- The converter API with `.compile()` enabled

Current fixture:

- `catalog` document
- `800` `<featured>` elements
- `800` `<book>` elements
- result includes root object fields, root arrays, direct scalar fields, and transformed derived fields

| Implementation | Average time | Notes |
| --- | ---: | --- |
| plain parser | **1.49 ms** | Lowest overhead, handwritten state machine |
| converter api | **174.81 ms** | Declarative but uncompiled |
| converter api compiled | **163.65 ms** | Declarative schema with compiled root processor |

Interpretation:

- The handwritten parser remains the raw-throughput ceiling.
- The uncompiled converter API pays a large abstraction cost.
- The compiled converter path still carries meaningful overhead, but it is faster than the uncompiled converter path on this fixture.

## Writer Performance

These builder benchmarks use a builder-friendly intermediate representation on each side.
`fast-xml-parser` consumes its ordered object tree directly, while the `stax-xml` writer benchmarks normalize the source fixture once into a writer-friendly precompiled tree outside the timed region.
The measured time therefore focuses on XML emission throughput rather than repeated JSON-shape adaptation.
The memory column is Mitata's average heap footprint for the benchmark case, so it includes fixture/tree residency and harness overhead rather than only the incremental output buffer.

### Small Document Building

Building XML documents from small JSON data:

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **fast-xml-parser builder** | 202.28 µs | ~4,944 ops/sec | 47.95 kb | fast-xml-parser builder |
| stax-xml writer | 338.22 µs | ~2,957 ops/sec | 261.86 kb | Writer API |
| **stax-xml writer sync** | 5.35 µs | ~187,079 ops/sec | 13.46 kb | Fastest, Sync writer API |
| xml2js builder | 423.16 µs | ~2,363 ops/sec | 127.05 kb | xml2js builder |

### Large Document Building (1MB)

Building large XML documents from big JSON data:

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **fast-xml-parser builder** | 19.12 ms | ~52.31 ops/sec | 17.54 mb | fast-xml-parser builder |
| **stax-xml writer sync** | 5.95 ms | ~168.16 ops/sec | 9.07 mb | Fastest, Sync writer API |
| stax-xml writer | 44.96 ms | ~22.24 ops/sec | 42.36 mb | Writer API |

### Async vs Sync Writer Comparison

This comparison measures the writer APIs themselves on the same generated document shape.
It is intended to show `stax-xml` async vs sync overhead, not to imply that the async writer should match a synchronous DOM-style builder.

| Element Count | Async Writer | Sync Writer | Performance Ratio |
|---------------|--------------|-------------|-------------------|
| 1K elements | 6.56 ms | 2.73 ms | 2.40x faster (sync) |
| 5K elements | 24.31 ms | 6.60 ms | 3.68x faster (sync) |
| 10K elements | 46.17 ms | 11.63 ms | 3.97x faster (sync) |

## Memory Efficiency

### Large File Memory Usage

```
File Size: 100MB XML Document

stax-xml async parser:     ~27.15 MB peak memory
stax-xml sync parser:      ~143.35 MB peak memory

File Size: 1GB XML Document

stax-xml async parser:     ~109.57 MB peak memory
```

