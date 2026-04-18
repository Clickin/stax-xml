# Benchmarks

Generated: 2026-04-18T15:59:23.445Z

Environment:
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K (~4.87 GHz)
- Runtime: node 24.12.0 (x64-win32)

This report is generated from the canonical release benchmark set. The docs benchmark pages are derived from the same raw JSON results.

## Benchmark Environment

The refreshed benchmark tables on this page were rerun with:
- **CPU**: 13th Gen Intel(R) Core(TM) i5-13600K (~4.87 GHz)
- **Runtime**: node 24.12.0 (x64-win32) with garbage collection exposed (`--expose-gc`)
- **Tool**: [Mitata](https://github.com/evanw/mitata)
- **Canonical Set**: parser 2KB / 4KB / 13MB / 98MB, async size-comparison, writer small / big / async, converter parity

## Parser Performance

### Small Documents (2KB)

For typical web service responses and configuration files (complex.xml):

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 9.51 µs | ~105,170 ops/sec | 1.87 kb | Fastest, lightweight |
| **stax-xml to object** | 197.88 µs | ~5,054 ops/sec | 27.94 kb | Object conversion |
| **stax-xml consume** | 196.93 µs | ~5,078 ops/sec | 23.32 kb | Stream processing |
| fast-xml-parser | 325.18 µs | ~3,075 ops/sec | 124.33 kb | DOM-based |
| xml2js | 665.22 µs | ~1,503 ops/sec | 210.15 kb | Callback-based, memory intensive |

### Medium Documents (4KB)

For larger API responses and data files (books.xml):

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 112.03 µs | ~8,926 ops/sec | 106.84 kb | Fastest, lightweight |
| **stax-xml consume** | 253.51 µs | ~3,945 ops/sec | 45.08 kb | Stream processing |
| **stax-xml to object** | 252.62 µs | ~3,958 ops/sec | 51.71 kb | Object conversion |
| fast-xml-parser | 453.15 µs | ~2,207 ops/sec | 553.23 kb | Good balance |
| xml2js | 1.17 ms | ~851.4 ops/sec | 611.52 kb | Memory intensive |

### Large Documents (1MB to 1GB)

For processing large XML files (RSS feeds, data exports, etc.):

| File Size | Parser Type | Processing Time | Memory Usage | Performance Ratio |
|-----------|-------------|-----------------|--------------|-------------------|
| 1MB | **sync parser** | 8.44 ms | 14.47 mb | Baseline |
| 1MB | async parser | 14.23 ms | 28.49 mb | 1.69x slower |
| 10MB | **sync parser** | 68.15 ms | 21.02 mb | Baseline |
| 10MB | async parser | 115.09 ms | 64.23 mb | 1.69x slower |
| 100MB | **sync parser** | 619.36 ms | 142.88 mb | Baseline |
| 100MB | async parser | 1.09 s | 46.55 mb | 1.75x slower |
| 1GB | async parser | 11.14 s | 107.61 mb | Memory efficient |

**Key Insights:**
- Sync parser is faster for smaller files.
- Async parser keeps memory usage flatter as file size grows.
- For files above 100MB, async parsing is the practical low-memory path.

### Sync Parser Library Comparison

#### Medium-Large Documents (13MB)

Performance results on midsize.xml (13MB):

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **xml2js** | 645.30 µs | ~1,550 ops/sec | 396.01 kb | Exceptional performance* |
| **stax-xml to object** | 90.31 ms | ~11.07 ops/sec | 35.45 mb | Object conversion |
| **stax-xml consume** | 86.67 ms | ~11.54 ops/sec | 5.00 mb | Stream processing |
| **txml** | 107.19 ms | ~9.33 ops/sec | 117.61 mb | Lightweight DOM |
| fast-xml-parser | 589.97 ms | ~1.7 ops/sec | 149.89 mb | Memory intensive |

*xml2js remains an outlier on this fixture, likely because the document shape heavily favors its DOM-oriented parsing model.

#### Large Documents (98MB)

Performance results on large.xml (98MB):

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **stax-xml consume** | 627.98 ms | ~1.59 ops/sec | 35.13 mb | Best overall |
| **stax-xml to object** | 648.09 ms | ~1.54 ops/sec | 7.49 mb | Memory efficient |
| **txml** | 993.94 ms | ~1.01 ops/sec | 859.26 mb | High memory |
| fast-xml-parser | 4.80 s | ~0.21 ops/sec | 1.21 gb | Slow, memory intensive |
| xml2js | 5.73 s | ~0.17 ops/sec | 662.99 mb | Slowest performance |

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
| plain parser | **1.44 ms** | Lowest overhead, handwritten state machine |
| converter api | **151.07 ms** | Declarative but uncompiled |
| converter api compiled | **148.14 ms** | Declarative schema with compiled root processor |

Interpretation:

- The handwritten parser remains the raw-throughput ceiling.
- The uncompiled converter API pays a large abstraction cost.
- The compiled converter path still carries meaningful overhead, but it is faster than the uncompiled converter path on this fixture.

## Writer Performance

### Small Document Building

Building XML documents from small JSON data:

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **fast-xml-parser builder** | 214.49 µs | ~4,662 ops/sec | 47.56 kb | Fastest |
| stax-xml writer | 755.40 µs | ~1,324 ops/sec | 563.56 kb | Writer API |
| **stax-xml writer sync** | 251.77 µs | ~3,972 ops/sec | 106.02 kb | Sync writer API |
| xml2js builder | 430.25 µs | ~2,324 ops/sec | 127.10 kb | xml2js builder |

### Large Document Building (1MB)

Building large XML documents from big JSON data:

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **fast-xml-parser builder** | 19.19 ms | ~52.1 ops/sec | 17.51 mb | Fastest |
| **stax-xml writer sync** | 42.31 ms | ~23.64 ops/sec | 56.02 mb | Sync writer API |
| stax-xml writer | 140.30 ms | ~7.13 ops/sec | 62.31 mb | Writer API |

### Async vs Sync Writer Comparison

| Element Count | Async Writer | Sync Writer | Performance Ratio |
|---------------|--------------|-------------|-------------------|
| 1K elements | 13.22 ms | 3.89 ms | 3.40x faster (sync) |
| 5K elements | 49.27 ms | 9.38 ms | 5.25x faster (sync) |
| 10K elements | 97.35 ms | 16.91 ms | 5.76x faster (sync) |

## Memory Efficiency

### Large File Memory Usage

```
File Size: 100MB XML Document

stax-xml async parser:     ~46.55 MB peak memory
stax-xml sync parser:      ~142.88 MB peak memory

File Size: 1GB XML Document

stax-xml async parser:     ~107.61 MB peak memory
```

