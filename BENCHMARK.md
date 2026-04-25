# Benchmarks

Generated: 2026-04-25T15:46:00.282Z

Environment:
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K (~4.85 GHz)
- Runtime: node 24.15.0 (x64-win32)

This report is generated from the canonical release benchmark set. The docs benchmark pages are derived from the same raw JSON results.

## Benchmark Environment

The refreshed benchmark tables on this page were rerun with:
- **CPU**: 13th Gen Intel(R) Core(TM) i5-13600K (~4.85 GHz)
- **Runtime**: node 24.15.0 (x64-win32) with garbage collection exposed (`--expose-gc`)
- **Tool**: [Mitata](https://github.com/evanw/mitata)
- **Canonical Set**: parser 2KB / 4KB / 13MB / 98MB, async size-comparison, writer small / big / async, converter parity

## Parser Performance

<details>
<summary>Scenario contract: Node parser library comparisons</summary>

Sample XML shape, shortened:

~~~xml
<catalog>
  <book id="..." category="...">
    <title>...</title>
    <author>...</author>
    <price currency="USD">...</price>
    <tags><tag>...</tag></tags>
  </book>
</catalog>
~~~

Consumer/output shape, expressed without library-specific syntax:

~~~text
consume-only:
  for each parser event:
    count or inspect the event
    do not retain a full output tree

object-output:
  document = {
    catalog: {
      book: [
        { attributes, title, author, price, tags }
      ]
    }
  }
~~~

Runtime methods:

- `stax-xml consume`: `StaxXmlParserSync` event loop; events are consumed and no retained object tree is produced.
- `stax-xml to object`: `StaxXmlParserSync` plus a local projection into the benchmark object shape.
- `txml`, `fast-xml-parser`, and `xml2js`: each library uses its native object/DOM-style parse API.
- The 13 MiB `xml2js` outlier is preserved as measured instead of normalized away.

</details>

### Small Documents (2KB)

For typical web service responses and configuration files (complex.xml):

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 9.56 µs | ~104,579 ops/sec | 1.88 kb | Fastest, lightweight |
| **stax-xml to object** | 266.51 µs | ~3,752 ops/sec | 73.59 kb | Object conversion |
| **stax-xml consume** | 298.20 µs | ~3,353 ops/sec | 64.70 kb | Stream processing |
| fast-xml-parser | 670.21 µs | ~1,492 ops/sec | 195.42 kb | DOM-based |
| xml2js | 761.65 µs | ~1,313 ops/sec | 205.69 kb | Callback-based, memory intensive |

### Medium Documents (4KB)

For larger API responses and data files (books.xml):

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 19.10 µs | ~52,366 ops/sec | 5.18 kb | Fastest, lightweight |
| **stax-xml consume** | 487.19 µs | ~2,053 ops/sec | 98.72 kb | Stream processing |
| **stax-xml to object** | 474.17 µs | ~2,109 ops/sec | 104.89 kb | Object conversion |
| fast-xml-parser | 717.83 µs | ~1,393 ops/sec | 871.37 kb | Good balance |
| xml2js | 1.10 ms | ~910.74 ops/sec | 587.04 kb | Memory intensive |

### Large Documents (1MB to 1GB)

For processing large XML files (RSS feeds, data exports, etc.):

<details>
<summary>Scenario contract: large-file sync, async stream, and iterable parsing</summary>

Generated XML shape, shortened:

~~~xml
<?xml version="1.0" encoding="UTF-8"?>
<root>
  <book id="book-N">
    <title>Sample Book Title Number N ...</title>
    <author>Author Name N</author>
    <description>...</description>
    <chapters>
      <chapter number="1">...</chapter>
    </chapters>
  </book>
</root>
~~~

Consumer/output shape:

~~~text
parse-result = {
  events: number,
  checksum: fold(event type, element name, text, attributes)
}
~~~

Parsing methods:

- Public sync string parsing reads the fixture into one string and runs `StaxXmlParserSync`.
- Public async stream parsing reads file chunks asynchronously, then feeds the parser without requiring one retained input string.
- Synchronous iterable byte-batch parsing accepts `Iterable<Uint8Array>` / byte batches, parses synchronously, and is suitable for blocking batch jobs when the caller already controls chunking.

</details>

| File Size | Parser Type | Processing Time | Memory Usage | Performance Ratio |
|-----------|-------------|-----------------|--------------|-------------------|
| 1MB | **sync parser** | 17.89 ms | 18.93 mb | Baseline |
| 1MB | async parser | 16.47 ms | 38.74 mb | 0.92x slower |
| 10MB | **sync parser** | 116.64 ms | 58.08 mb | Baseline |
| 10MB | async parser | 123.45 ms | 18.55 mb | 1.06x slower |
| 100MB | **sync parser** | 1.34 s | 522.77 mb | Baseline |
| 100MB | async parser | 1.14 s | 26.89 mb | 0.86x slower |
| 1GB | async parser | 10.86 s | 50.62 mb | Memory efficient |

**Key Insights:**
- Sync parsing is the direct in-memory path; async parsing trades some scheduling overhead for flatter memory behavior.
- The relative timing can move by fixture and runtime, so the generated table is the source of truth.
- For files above 100MB, avoid the public full-string sync path when retaining the full XML string is not acceptable; use async streams for non-blocking work or the synchronous iterable byte-batch backend for blocking batch jobs.

## Runtime Matrix And Native Direction

The same built JavaScript implementation was measured on Node, Bun, and Deno with a generated single-root 16.00 MiB XML fixture. This is a runtime-codegen and compatibility check, not a native-addon benchmark.

<details>
<summary>Scenario contract: Node, Bun, and Deno runtime matrix</summary>

The matrix uses one generated single-root 16.00 MiB XML fixture.

Sample XML shape, shortened:

~~~xml
<?xml version="1.0" encoding="UTF-8"?>
<root>
  <book id="book-N" lang="en" code="...">
    <title>Runtime Benchmark N</title>
    <author>Author ...</author>
    <description>Full string checksum text payload ...</description>
    <chapter number="1">Intro ...</chapter>
    <chapter number="2">Body ...</chapter>
  </book>
</root>
~~~

Output shape:

~~~text
runtime-result = {
  scenario: "public-sync-full-string" | "iterable-count-only" | "iterable-full-string",
  eventCount: number,
  checksum: fold(event type, names, text, attr names, attr values),
  peakHeapUsedBytes: number
}
~~~

Runtime methods:

- Node reads text with `fs.readFileSync`, then runs the built package through `node --expose-gc`.
- Bun reads text with `Bun.file(path).text()`, then runs the same built JavaScript package.
- Deno reads text with `Deno.readTextFile` under `--allow-read --allow-env`, then runs the same built JavaScript package.
- `public-sync-full-string` uses `StaxXmlParserSync` over one string.
- `iterable-count-only` and `iterable-full-string` use the browser-compatible synchronous iterable byte-batch backend; they are not async parser rows.
- This matrix intentionally excludes native addons.

</details>

| Runtime | Version | Scenario | Throughput | Average | Checksum |
| --- | --- | --- | ---: | ---: | ---: |
| node | 24.15.0 | public-sync-full-string | 55.0 MiB/s | 290.78 ms | -746772258 |
| node | 24.15.0 | iterable-count-only | 213.0 MiB/s | 75.11 ms | 2078515073 |
| node | 24.15.0 | iterable-full-string | 116.5 MiB/s | 137.36 ms | 1007437756 |
| bun | 1.3.13 | public-sync-full-string | 84.9 MiB/s | 188.52 ms | -746772258 |
| bun | 1.3.13 | iterable-count-only | 259.0 MiB/s | 61.77 ms | 2078515073 |
| bun | 1.3.13 | iterable-full-string | 161.6 MiB/s | 99.01 ms | 1007437756 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 57.3 MiB/s | 279.28 ms | -746772258 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-count-only | 220.5 MiB/s | 72.55 ms | 2078515073 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-full-string | 124.9 MiB/s | 128.10 ms | 1007437756 |

The non-JS comparator uses the same event-count and checksum contract. Woodstox is reported on Java 8 for the public baseline because Java 8 is its minimum supported runtime target; Java 25 is measured only as a verification check.

<details>
<summary>Scenario contract: stax-xml, Woodstox, and quick-xml comparator</summary>

The comparator uses the same generated 16.00 MiB XML fixture shape as the runtime matrix.

Output shape:

~~~text
comparator-result = {
  tier: "count-only" | "name-string-only" | "attr-value-string-only" | "text-string-only" | "full-string",
  eventCount: number,
  checksum: fold(selected event data for tier)
}
~~~

Parsing methods:

- `stax-xml on Node`: built JavaScript iterable backend, run on Node, with tier-specific checksum folding.
- Woodstox: Java StAX `XMLStreamReader`, namespace-aware parsing disabled, coalescing enabled, DTD/external entities disabled, buffered file input.
- `quick-xml`: Rust `Reader` over buffered file input; declaration, PI, doctype, and comments are skipped; text is trimmed for checksum parity.
- Java 8 is the public Woodstox row because it is Woodstox's minimum runtime target; Java 25 is a separate verification row.

</details>

| Tier | stax-xml on Node | Woodstox on Java 8 | quick-xml | Node/Woodstox | Node/quick-xml |
| --- | ---: | ---: | ---: | ---: | ---: |
| count-only | 180.2 MiB/s | 346.3 MiB/s | 304.5 MiB/s | 0.52x | 0.59x |
| name-string-only | 141.6 MiB/s | 314.9 MiB/s | 268.9 MiB/s | 0.45x | 0.53x |
| text-string-only | 111.3 MiB/s | 315.8 MiB/s | 284.7 MiB/s | 0.35x | 0.39x |
| attr-value-string-only | 130.8 MiB/s | 315.2 MiB/s | 285.4 MiB/s | 0.41x | 0.46x |
| full-string | 100.9 MiB/s | 257.1 MiB/s | 228.9 MiB/s | 0.39x | 0.44x |

### Woodstox Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Status |
| --- | ---: | ---: | ---: | --- |
| count-only | 346.3 MiB/s | 301.4 MiB/s | -13.0% | ok |
| name-string-only | 314.9 MiB/s | 271.7 MiB/s | -13.7% | ok |
| text-string-only | 315.8 MiB/s | 292.8 MiB/s | -7.3% | ok |
| attr-value-string-only | 315.2 MiB/s | 248.6 MiB/s | -21.1% | ok |
| full-string | 257.1 MiB/s | 237.6 MiB/s | -7.6% | ok |

### Why Native Addons Are The Acceleration Path

The JavaScript parser remains the compatibility fallback, but it is not the release performance ceiling. Prior pure-JS optimization work improved the iterable event-frame backend, yet full-string workloads still stayed behind native parser baselines, especially `quick-xml`. The remaining costs are delimiter scanning, string materialization, and stable object/API shapes around attributes and text.

The Rust native path is intended to move the hot tokenizer and string/span aggregation work into code that can use native and SIMD-oriented scanning strategies, closer in direction to native parsers such as `quick-xml` and simdjson-style designs. The package topology therefore keeps `stax-xml` as the facade while adding optional native/Wasm acceleration packages; environments that cannot load binaries continue to use the JavaScript fallback.


### Sync Parser Library Comparison

#### Medium-Large Documents (13MB)

Performance results on midsize.xml (13MB):

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **xml2js** | 593.45 µs | ~1,685 ops/sec | 479.01 kb | Exceptional performance* |
| **stax-xml to object** | 223.37 ms | ~4.48 ops/sec | 145.60 mb | Object conversion |
| **stax-xml consume** | 208.24 ms | ~4.8 ops/sec | 144.61 mb | Stream processing |
| **txml** | 118.36 ms | ~8.45 ops/sec | 117.61 mb | Lightweight DOM |
| fast-xml-parser | 720.42 ms | ~1.39 ops/sec | 177.81 mb | Memory intensive |

*xml2js remains an outlier on this fixture, likely because the document shape heavily favors its DOM-oriented parsing model.

#### Large Documents (98MB)

Performance results on large.xml (98MB):

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **stax-xml consume** | 1.93 s | ~0.52 ops/sec | 945.98 mb | Best overall |
| **stax-xml to object** | 1.82 s | ~0.55 ops/sec | 997.51 mb | Memory efficient |
| **txml** | 1.15 s | ~0.87 ops/sec | 859.21 mb | High memory |
| fast-xml-parser | 6.22 s | ~0.16 ops/sec | 1021.58 mb | Slow, memory intensive |
| xml2js | 6.71 s | ~0.15 ops/sec | 650.50 mb | Slowest performance |

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
| plain parser | **4.63 ms** | Lowest overhead, handwritten state machine |
| converter api | **172.70 ms** | Declarative but uncompiled |
| converter api compiled | **4.40 ms** | Declarative schema with compiled root processor |

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
| **fast-xml-parser builder** | 332.00 µs | ~3,012 ops/sec | 80.61 kb | fast-xml-parser builder |
| stax-xml writer | 414.26 µs | ~2,414 ops/sec | 265.36 kb | Writer API |
| **stax-xml writer sync** | 6.34 µs | ~157,691 ops/sec | 13.45 kb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 141.86 µs | ~7,049 ops/sec | 31.87 kb | Sync streaming sink API |
| xml2js builder | 376.19 µs | ~2,658 ops/sec | 127.69 kb | xml2js builder |

### Large Document Building (1MB)

Building large XML documents from big JSON data:

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **fast-xml-parser builder** | 32.56 ms | ~30.71 ops/sec | 27.54 mb | fast-xml-parser builder |
| **stax-xml writer sync** | 9.05 ms | ~110.46 ops/sec | 9.67 mb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 10.17 ms | ~98.36 ops/sec | 10.43 mb | Sync streaming sink API |
| stax-xml writer | 47.73 ms | ~20.95 ops/sec | 44.12 mb | Writer API |

### Async vs Sync Writer Comparison

This comparison measures the writer APIs themselves on the same generated document shape. It includes async file output, sync string output followed by file write, and the sync sink path with an in-memory file-like target.
It is intended to show `stax-xml` async vs sync overhead and sink overhead, not to imply that all paths have identical durability guarantees.

| Element Count | Async Writer | Sync Writer + File | Sync Writer + Sink | Performance Ratio |
|---------------|--------------|--------------------|--------------------|-------------------|
| 1K elements | 11.41 ms | 4.43 ms | 2.68 ms | 4.26x faster (sink) |
| 5K elements | 30.18 ms | 8.09 ms | 7.76 ms | 3.89x faster (sink) |
| 10K elements | 73.45 ms | 13.99 ms | 11.53 ms | 6.37x faster (sink) |

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


