# Benchmarks

Generated: 2026-04-19T07:07:50.177Z

Environment:
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K (~4.85 GHz)
- Runtime: node 24.12.0 (x64-win32)

This report is generated from the canonical release benchmark set. The docs benchmark pages are derived from the same raw JSON results.

## Benchmark Environment

The refreshed benchmark tables on this page were rerun with:
- **CPU**: 13th Gen Intel(R) Core(TM) i5-13600K (~4.85 GHz)
- **Runtime**: node 24.12.0 (x64-win32) with garbage collection exposed (`--expose-gc`)
- **Tool**: [Mitata](https://github.com/evanw/mitata)
- **Canonical Set**: parser 2KB / 4KB / 13MB / 98MB, async size-comparison, writer small / big / async, converter parity

## Parser Performance

### Small Documents (2KB)

For typical web service responses and configuration files (complex.xml):

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 9.85 µs | ~101,473 ops/sec | 1.88 kb | Fastest, lightweight |
| **stax-xml to object** | 148.07 µs | ~6,754 ops/sec | 27.47 kb | Object conversion |
| **stax-xml consume** | 146.28 µs | ~6,836 ops/sec | 22.94 kb | Stream processing |
| fast-xml-parser | 254.28 µs | ~3,933 ops/sec | 126.32 kb | DOM-based |
| xml2js | 528.98 µs | ~1,890 ops/sec | 210.91 kb | Callback-based, memory intensive |

### Medium Documents (4KB)

For larger API responses and data files (books.xml):

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 123.33 µs | ~8,108 ops/sec | 118.19 kb | Fastest, lightweight |
| **stax-xml consume** | 207.45 µs | ~4,820 ops/sec | 45.56 kb | Stream processing |
| **stax-xml to object** | 216.37 µs | ~4,622 ops/sec | 52.03 kb | Object conversion |
| fast-xml-parser | 434.20 µs | ~2,303 ops/sec | 578.27 kb | Good balance |
| xml2js | 864.76 µs | ~1,156 ops/sec | 628.32 kb | Memory intensive |

### Large Documents (1MB to 1GB)

For processing large XML files (RSS feeds, data exports, etc.):

| File Size | Parser Type | Processing Time | Memory Usage | Performance Ratio |
|-----------|-------------|-----------------|--------------|-------------------|
| 1MB | **sync parser** | 9.17 ms | 14.42 mb | Baseline |
| 1MB | async parser | 14.79 ms | 28.61 mb | 1.61x slower |
| 10MB | **sync parser** | 73.80 ms | 21.03 mb | Baseline |
| 10MB | async parser | 105.28 ms | 28.05 mb | 1.43x slower |
| 100MB | **sync parser** | 664.91 ms | 143.23 mb | Baseline |
| 100MB | async parser | 1.01 s | 43.92 mb | 1.52x slower |
| 1GB | async parser | 9.66 s | 28.73 mb | Memory efficient |

**Key Insights:**
- Sync parser is faster for smaller files.
- Async parser keeps memory usage flatter as file size grows.
- For files above 100MB, async parsing is the practical low-memory path.

### Sync Parser Library Comparison

#### Medium-Large Documents (13MB)

Performance results on midsize.xml (13MB):

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **xml2js** | 533.23 µs | ~1,875 ops/sec | 478.35 kb | Exceptional performance* |
| **stax-xml to object** | 99.01 ms | ~10.1 ops/sec | 35.46 mb | Object conversion |
| **stax-xml consume** | 95.41 ms | ~10.48 ops/sec | 5.02 mb | Stream processing |
| **txml** | 104.01 ms | ~9.61 ops/sec | 117.61 mb | Lightweight DOM |
| fast-xml-parser | 564.54 ms | ~1.77 ops/sec | 148.07 mb | Memory intensive |

*xml2js remains an outlier on this fixture, likely because the document shape heavily favors its DOM-oriented parsing model.

#### Large Documents (98MB)

Performance results on large.xml (98MB):

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **stax-xml consume** | 728.92 ms | ~1.37 ops/sec | 35.16 mb | Best overall |
| **stax-xml to object** | 749.06 ms | ~1.34 ops/sec | 7.48 mb | Memory efficient |
| **txml** | 1.08 s | ~0.93 ops/sec | 859.27 mb | High memory |
| fast-xml-parser | 5.32 s | ~0.19 ops/sec | 1.13 gb | Slow, memory intensive |
| xml2js | 6.04 s | ~0.17 ops/sec | 647.87 mb | Slowest performance |

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
| plain parser | **1.42 ms** | Lowest overhead, handwritten state machine |
| converter api | **148.60 ms** | Declarative but uncompiled |
| converter api compiled | **2.77 ms** | Declarative schema with compiled root processor |

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
| **fast-xml-parser builder** | 195.89 µs | ~5,105 ops/sec | 47.75 kb | fast-xml-parser builder |
| stax-xml writer | 391.74 µs | ~2,553 ops/sec | 262.76 kb | Writer API |
| **stax-xml writer sync** | 141.24 µs | ~7,080 ops/sec | 20.68 kb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 171.67 µs | ~5,825 ops/sec | 23.85 kb | Sync streaming sink API |
| xml2js builder | 399.02 µs | ~2,506 ops/sec | 127.23 kb | xml2js builder |

### Large Document Building (1MB)

Building large XML documents from big JSON data:

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **fast-xml-parser builder** | 16.79 ms | ~59.58 ops/sec | 17.48 mb | fast-xml-parser builder |
| **stax-xml writer sync** | 6.81 ms | ~146.74 ops/sec | 9.69 mb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 8.46 ms | ~118.23 ops/sec | 10.62 mb | Sync streaming sink API |
| stax-xml writer | 41.45 ms | ~24.12 ops/sec | 42.38 mb | Writer API |

### Async vs Sync Writer Comparison

This comparison measures the writer APIs themselves on the same generated document shape. It includes async file output, sync string output followed by file write, and the sync sink path with an in-memory file-like target.
It is intended to show `stax-xml` async vs sync overhead and sink overhead, not to imply that all paths have identical durability guarantees.

| Element Count | Async Writer | Sync Writer + File | Sync Writer + Sink | Performance Ratio |
|---------------|--------------|--------------------|--------------------|-------------------|
| 1K elements | 8.75 ms | 3.40 ms | 2.54 ms | 3.45x faster (sink) |
| 5K elements | 27.51 ms | 7.81 ms | 6.80 ms | 4.05x faster (sink) |
| 10K elements | 57.10 ms | 14.13 ms | 10.15 ms | 5.63x faster (sink) |

### 1GiB Writer Comparison

This one-shot benchmark writes a 1GiB XML document through both async writer and sync sink writer paths.
It includes in-memory targets and temp-file targets to separate writer overhead from file I/O cost.

| Target | Time | Throughput | Peak Heap | Peak RSS | Written | Records |
|--------|-----:|-----------:|----------:|---------:|--------:|--------:|
| Async writer + memory WritableStream | 15.98 s | 64.10 MiB/s | 106.55 mb | 222.95 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + memory sink** | 3.11 s | 328.78 MiB/s | 74.15 mb | 222.46 mb | 1.00 gb | 1,164,225 |
| Async writer + temp file | 20.37 s | 50.26 MiB/s | 62.09 mb | 226.27 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + temp file** | 4.05 s | 252.61 MiB/s | 73.35 mb | 223.68 mb | 1.00 gb | 1,164,225 |

Based on this run, `StaxXmlWriterSyncSink` is the recommended path for large XML file output. It provides the highest write throughput, and peak RSS stays in the same range as async writing.


