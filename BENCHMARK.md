# Benchmarks

Generated: 2026-04-25T17:26:43.191Z

Environment:
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K (~4.85 GHz)
- Runtime: node 24.15.0 (x64-win32)

This report is generated from the canonical release benchmark set. The docs benchmark pages are derived from the same raw JSON results.

## Benchmark Environment

The refreshed benchmark tables on this page were rerun with:
- **CPU**: 13th Gen Intel(R) Core(TM) i5-13600K (~4.85 GHz)
- **Runtime**: node 24.15.0 (x64-win32) with garbage collection exposed (`--expose-gc`)
- **Tool**: [Mitata](https://github.com/evanw/mitata)
- **Canonical Set**: parser 2KB / 4KB / 13MB / 98MB with stax-xml backend/surface rows, iterable sync/async size comparison from 1MiB to 4GiB, writer small / big / async, converter parity

<details>
<summary>Resolved package and runtime versions</summary>

| Benchmark package | Resolved version | Declared range | Source |
| --- | ---: | --- | --- |
| @stax-xml/native-aggregate-probe | 0.0.0 | workspace:* | workspace |
| fast-xml-parser | 5.7.2 | ^5.2.5 | npm |
| htmlparser2 | 12.0.0 | ^12.0.0 | npm |
| mitata | 1.0.34 | ^1.0.34 | npm |
| sax | 1.6.0 | ^1.4.1 | npm |
| saxes | 6.0.0 | ^6.0.0 | npm |
| saxophone | 0.8.0 | ^0.8.0 | npm |
| stax-xml | 0.7.0 | workspace:* | workspace |
| txml | 5.2.1 | ^5.1.1 | npm |
| xml-stream | 0.4.5 | ^0.4.5 | npm |
| xml2js | 0.6.2 | ^0.6.2 | npm |

| Runtime/tool | Version | Status |
| --- | --- | --- |
| node | v24.15.0 | ok |
| pnpm | 10.18.0 | ok |
| bun | 1.3.13 | ok |
| deno | deno 2.7.13 (stable, release, x86_64-pc-windows-msvc) | ok |
| java | openjdk version "1.8.0_472" | ok |
| rustc | rustc 1.94.1 (e408947bf 2026-03-25) | ok |
| cargo | cargo 1.94.1 (29ea6fb6a 2026-03-24) | ok |

| Node component | Version |
| --- | ---: |
| node | 24.15.0 |
| v8 | 13.6.233.17-node.48 |
| uv | 1.51.0 |
| openssl | 3.5.5 |
| zlib | 1.3.1-e00f703 |
| brotli | 1.2.0 |
| ares | 1.34.6 |
| icu | 78.2 |
| unicode | 17.0 |
| modules | 137 |
| napi | 10 |

</details>

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

- `stax-xml JS fallback event parser`: `StaxXmlParserSync` event loop with a checksum over event type, names, text, and attributes.
- `stax-xml JS fallback raw iterable`: `StaxXmlIterableParser` byte-frame loop with the same checksum contract.
- `stax-xml native addon event aggregate`: native aggregate probe using the event-object tier inside Rust; it is not a public per-event JavaScript iterator.
- `stax-xml native addon raw aggregate`: native aggregate probe using a coarse Buffer call and direct string materialization inside Rust.
- `stax-xml to object`: `StaxXmlParserSync` plus a local projection into the benchmark object shape.
- `txml`, `fast-xml-parser`, and `xml2js`: each library uses its native object/DOM-style parse API.
- The 13 MiB `xml2js` row is marked as an invalid comparator: `midsize.xml` has repeated top-level elements and xml2js reports only the first top-level element shape instead of the whole document.
- The stax-xml backend/surface rows are embedded directly in each parser table so the fixture and run environment are identical to the third-party rows.

</details>

### Small Documents (2KB)

For typical web service responses and configuration files (complex.xml):

Benchmark source: [parser-2kb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-2kb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 67.46 µs | ~14,823 ops/sec | 24.88 kb | Lightweight object parser |
| **stax-xml to object** | 281.47 µs | ~3,553 ops/sec | 72.70 kb | Object conversion |
| stax-xml JS event parser | 317.33 µs | ~3,151 ops/sec | 81.98 kb | Public StaxXmlParserSync event API |
| stax-xml JS raw iterable | 247.63 µs | ~4,038 ops/sec | 33.60 kb | Iterable byte frames with string materialization checksum |
| **stax-xml native event aggregate** | 9.54 µs | ~104,785 ops/sec | 0.19 kb | N-API aggregate probe; event-like objects stay inside Rust |
| **stax-xml native raw aggregate** | 3.72 µs | ~268,721 ops/sec | 0.19 kb | N-API aggregate probe; coarse Buffer call |
| fast-xml-parser | 458.36 µs | ~2,182 ops/sec | 193.73 kb | Object parser |
| xml2js | 598.23 µs | ~1,672 ops/sec | 216.39 kb | Callback object parser |

### Medium Documents (4KB)

For larger API responses and data files (books.xml):

Benchmark source: [parser-4kb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-4kb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 94.61 µs | ~10,570 ops/sec | 47.61 kb | Lightweight object parser |
| **stax-xml to object** | 351.69 µs | ~2,843 ops/sec | 105.39 kb | Object conversion |
| stax-xml JS event parser | 393.44 µs | ~2,542 ops/sec | 133.08 kb | Public StaxXmlParserSync event API |
| stax-xml JS raw iterable | 266.22 µs | ~3,756 ops/sec | 36.37 kb | Iterable byte frames with string materialization checksum |
| **stax-xml native event aggregate** | 19.12 µs | ~52,294 ops/sec | 0.19 kb | N-API aggregate probe; event-like objects stay inside Rust |
| **stax-xml native raw aggregate** | 7.56 µs | ~132,213 ops/sec | 0.19 kb | N-API aggregate probe; coarse Buffer call |
| fast-xml-parser | 672.39 µs | ~1,487 ops/sec | 869.92 kb | Object parser |
| xml2js | 936.41 µs | ~1,068 ops/sec | 609.84 kb | Callback object parser |

### Large Documents (1MiB to 4GiB)

For processing large XML files (RSS feeds, data exports, etc.):

<details>
<summary>Scenario contract: iterable parser sync and async file traversal</summary>

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
  checksum: structural fold(event type, element/text/attribute span lengths and boundary bytes)
}
~~~

Parsing methods:

- Every row in this section uses the same Node iterable event-frame parser over bounded temp-file chunks.
- `sync Iterable parser` uses synchronous file reads and `Iterable<Buffer[]>` batches.
- `async Iterable parser` uses asynchronous file reads as an `AsyncIterable<Buffer[]>`, then hands each awaited batch to the synchronous iterable parser frame loop without retaining one full XML string.
- XML tokenization is CPU-intensive. Async file reads do not make the parse loop non-blocking; if this work would run on a latency-sensitive main event loop thread, offload parsing to a Worker or worker thread.
- These rows intentionally use a structural checksum rather than full string materialization so the table measures iterable backend tokenization/event-frame traversal.

</details>

Benchmark source: [sync/async release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| File Size | Parser Type | Processing Time | Memory Usage | Performance Ratio |
|-----------|-------------|-----------------|--------------|-------------------|
| 1MiB temp file | **sync Iterable parser** | 17.10 ms | 8.36 mb | Baseline, 58.47 MiB/s |
| 1MiB temp file | async Iterable parser | 19.00 ms | 10.49 mb | 1.11x slower, 52.64 MiB/s |
| 10MiB temp file | **sync Iterable parser** | 74.16 ms | 10.34 mb | Baseline, 134.85 MiB/s |
| 10MiB temp file | async Iterable parser | 71.50 ms | 10.59 mb | 1.04x faster, 139.86 MiB/s |
| 100MiB temp file | **sync Iterable parser** | 545.43 ms | 9.41 mb | Baseline, 183.34 MiB/s |
| 100MiB temp file | async Iterable parser | 553.02 ms | 10.22 mb | 1.01x slower, 180.83 MiB/s |
| 1GiB temp file | **sync Iterable parser** | 5.52 s | 11.34 mb | Baseline, 185.59 MiB/s |
| 1GiB temp file | async Iterable parser | 5.68 s | 10.32 mb | 1.03x slower, 180.42 MiB/s |
| 4GiB temp file | **sync Iterable parser** | 24.27 s | 11.42 mb | Baseline, 168.79 MiB/s |
| 4GiB temp file | async Iterable parser | 23.21 s | 11.59 mb | 1.05x faster, 176.44 MiB/s |

**Key Insights:**
- This section is the iterable backend throughput view, not a public string parser vs stream parser API comparison.
- The sync and async rows share the same tokenization/event-frame path; the difference is synchronous file reads versus awaited file batches.
- Async iterable parsing can still block the main event loop while each CPU parse batch runs; use a Worker or worker thread when visible latency matters.
- For files above 100MiB, avoid the public full-string sync path when retaining the full XML string is not acceptable; use async streams for non-blocking API ergonomics or the synchronous iterable byte-batch backend for blocking batch jobs.

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

Benchmark source: [runtime-matrix.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/runtime-matrix.mjs).

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

The non-JS comparator uses the same event-count and checksum contract. It reports stax-xml JS on Node, the stax-xml native addon through its JavaScript package wrapper, Woodstox on Java 8, and quick-xml. Woodstox is reported on Java 8 for the public baseline because Java 8 is its minimum supported runtime target; Java 25 is measured only as a verification check.

<details>
<summary>Scenario contract: stax-xml JS/native, Woodstox, and quick-xml comparator</summary>

The comparator uses the same generated 16.00 MiB XML fixture shape as the runtime matrix.

Output shape:

~~~text
comparator-result = {
  tier: "count-only" | "name-string-only" | "attr-value-string-only" | "text-string-only" | "full-string",
  implementation: "stax-xml-js-node" | "stax-xml-native-addon" | "woodstox-java8" | "quick-xml",
  eventCount: number,
  checksum: fold(selected event data for tier)
}
~~~

Parsing methods:

- `stax-xml JS on Node`: built JavaScript iterable backend, run on Node, with tier-specific checksum folding.
- `stax-xml native addon`: JS package wrapper imports the N-API aggregate addon before sampling; each measured sample calls through the wrapper and N-API boundary in the same Node process.
- Woodstox: Java StAX `XMLStreamReader`, namespace-aware parsing disabled, coalescing enabled, DTD/external entities disabled, buffered file input.
- `quick-xml`: Rust `Reader` over buffered file input; declaration, PI, doctype, and comments are skipped; text is trimmed for checksum parity.
- Java 8 is the public Woodstox row because it is Woodstox's minimum runtime target; Java 25 is a separate verification row.

</details>

Benchmark source: [cross-runtime-comparison.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/cross-runtime-comparison.mjs).

### count-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 183.1 MiB/s | 87.37 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 740.6 MiB/s | 21.60 ms | 4.04x | ok |
| Woodstox on Java 8 | 346.4 MiB/s | 46.19 ms | 1.89x | ok |
| quick-xml | 304.4 MiB/s | 52.55 ms | 1.66x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 140.5 MiB/s | 113.85 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 629.1 MiB/s | 25.43 ms | 4.48x | ok |
| Woodstox on Java 8 | 322.0 MiB/s | 49.69 ms | 2.29x | ok |
| quick-xml | 270.7 MiB/s | 59.11 ms | 1.93x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 111.3 MiB/s | 143.74 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 614.2 MiB/s | 26.05 ms | 5.52x | ok |
| Woodstox on Java 8 | 326.2 MiB/s | 49.05 ms | 2.93x | ok |
| quick-xml | 285.6 MiB/s | 56.03 ms | 2.57x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 129.6 MiB/s | 123.41 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 706.2 MiB/s | 22.66 ms | 5.45x | ok |
| Woodstox on Java 8 | 307.8 MiB/s | 51.98 ms | 2.37x | ok |
| quick-xml | 283.9 MiB/s | 56.36 ms | 2.19x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 90.8 MiB/s | 176.22 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 434.5 MiB/s | 36.83 ms | 4.79x | ok |
| Woodstox on Java 8 | 236.3 MiB/s | 67.71 ms | 2.60x | ok |
| quick-xml | 229.3 MiB/s | 69.78 ms | 2.53x | ok |

### Woodstox Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Status |
| --- | ---: | ---: | ---: | --- |
| count-only | 346.4 MiB/s | 300.4 MiB/s | -13.3% | ok |
| name-string-only | 322.0 MiB/s | 282.1 MiB/s | -12.4% | ok |
| text-string-only | 326.2 MiB/s | 291.4 MiB/s | -10.7% | ok |
| attr-value-string-only | 307.8 MiB/s | 258.7 MiB/s | -16.0% | ok |
| full-string | 236.3 MiB/s | 232.8 MiB/s | -1.5% | ok |

### Why Native Addons Are The Acceleration Path

The JavaScript parser remains the compatibility fallback, but it is not the release performance ceiling. Prior pure-JS optimization work improved the iterable event-frame backend, yet full-string workloads still stayed behind native parser baselines, especially `quick-xml`. The remaining costs are delimiter scanning, string materialization, and stable object/API shapes around attributes and text.

The Rust native path is intended to move the hot tokenizer and string/span aggregation work into code that can use native and SIMD-oriented scanning strategies, closer in direction to native parsers such as `quick-xml` and simdjson-style designs. The package topology therefore keeps `stax-xml` as the facade while adding optional native/Wasm acceleration packages; environments that cannot load binaries continue to use the JavaScript fallback.


### Sync Parser Library Comparison

#### Medium-Large Documents (13MB)

Performance results on midsize.xml (13MB):

Benchmark source: [parser-13mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-13mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| xml2js | 592.18 µs | ~1,689 ops/sec | 428.72 kb | Invalid comparator: first top-level element only* |
| **stax-xml to object** | 219.49 ms | ~4.56 ops/sec | 145.51 mb | Object conversion |
| stax-xml JS event parser | 244.17 ms | ~4.1 ops/sec | 166.73 mb | Public StaxXmlParserSync event API |
| stax-xml JS raw iterable | 102.35 ms | ~9.77 ops/sec | 26.36 mb | Iterable byte frames with string materialization checksum |
| **stax-xml native event aggregate** | 72.00 ms | ~13.89 ops/sec | 3.09 kb | N-API aggregate probe; event-like objects stay inside Rust |
| **stax-xml native raw aggregate** | 25.99 ms | ~38.47 ops/sec | 3.09 kb | N-API aggregate probe; coarse Buffer call |
| **txml** | 114.61 ms | ~8.73 ops/sec | 117.60 mb | Lightweight object parser |
| fast-xml-parser | 668.43 ms | ~1.5 ops/sec | 177.72 mb | Object parser |

*xml2js is not a valid whole-document comparator for this fixture. `midsize.xml` contains repeated top-level `<any_name>` roots, and xml2js returns only the first top-level element shape.

#### Large Documents (98MB)

Performance results on large.xml (98MB):

Benchmark source: [parser-98mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-98mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **stax-xml to object** | 1.79 s | ~0.56 ops/sec | 970.78 mb | Memory efficient |
| stax-xml JS event parser | 1.83 s | ~0.55 ops/sec | 1005.67 mb | Public StaxXmlParserSync event API |
| stax-xml JS raw iterable | 685.25 ms | ~1.46 ops/sec | 18.40 mb | Iterable byte frames with string materialization checksum |
| **stax-xml native event aggregate** | 501.24 ms | ~2 ops/sec | 3.09 kb | N-API aggregate probe; event-like objects stay inside Rust |
| **stax-xml native raw aggregate** | 193.56 ms | ~5.17 ops/sec | 3.09 kb | N-API aggregate probe; coarse Buffer call |
| **txml** | 1.06 s | ~0.95 ops/sec | 859.80 mb | Object parser |
| fast-xml-parser | 5.62 s | ~0.18 ops/sec | 1019.00 mb | Object parser |
| xml2js | 5.69 s | ~0.18 ops/sec | 634.27 mb | Callback object parser |

## Converter API vs Plain Parser

The benchmark below compares three ways to build the **same object output**:

- A handwritten plain parser built directly on `StaxXmlParserSync`
- The declarative converter API with automatic dispatch-plan routing
- The converter API with `.compile()` enabled

Current fixture:

- `catalog` document
- `800` `<featured>` elements
- `800` `<book>` elements
- result includes root object fields, root arrays, direct scalar fields, and transformed derived fields

Benchmark source: [converter-plain-output-benchmark.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/converter-plain-output-benchmark.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Implementation | Average time | Notes |
| --- | ---: | --- |
| plain parser | **3.01 ms** | Lowest overhead, handwritten state machine |
| converter api | **3.35 ms** | Declarative schema with automatic dispatch plan |
| converter api compiled | **3.10 ms** | Explicit compile() with cached dispatch plan |

Interpretation:

- The handwritten parser remains the raw-throughput ceiling.
- The normal converter API now auto-routes dispatch-friendly schemas onto the iterable backend and caches the plan on the schema object.
- `.compile()` keeps the same output contract while making that dispatch choice explicit and reusable.

## Writer Performance

These builder benchmarks use a builder-friendly intermediate representation on each side.
`fast-xml-parser` consumes its ordered object tree directly, while the `stax-xml` writer benchmarks normalize the source fixture once into a writer-friendly precompiled tree outside the timed region.
The measured time therefore focuses on XML emission throughput rather than repeated JSON-shape adaptation.
The memory column is Mitata's average heap footprint for the benchmark case, so it includes fixture/tree residency and harness overhead rather than only the incremental output buffer.

### Small Document Building

Building XML documents from small JSON data:

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **fast-xml-parser builder** | 237.31 µs | ~4,214 ops/sec | 80.47 kb | fast-xml-parser builder |
| stax-xml writer | 247.84 µs | ~4,035 ops/sec | 266.29 kb | Writer API |
| **stax-xml writer sync** | 5.44 µs | ~183,851 ops/sec | 13.37 kb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 151.72 µs | ~6,591 ops/sec | 31.25 kb | Sync streaming sink API |
| xml2js builder | 479.50 µs | ~2,086 ops/sec | 129.16 kb | xml2js builder |

### Large Document Building (1MB)

Building large XML documents from big JSON data:

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **fast-xml-parser builder** | 54.61 ms | ~18.31 ops/sec | 28.01 mb | fast-xml-parser builder |
| **stax-xml writer sync** | 10.90 ms | ~91.78 ops/sec | 9.46 mb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 13.19 ms | ~75.83 ops/sec | 10.12 mb | Sync streaming sink API |
| stax-xml writer | 66.79 ms | ~14.97 ops/sec | 43.98 mb | Writer API |

### Async vs Sync Writer Comparison

This comparison measures the writer APIs themselves on the same generated document shape. It includes async file output, sync string output followed by file write, and the sync sink path with an in-memory file-like target.
It is intended to show `stax-xml` async vs sync overhead and sink overhead, not to imply that all paths have identical durability guarantees.

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Element Count | Async Writer | Sync Writer + File | Sync Writer + Sink | Performance Ratio |
|---------------|--------------|--------------------|--------------------|-------------------|
| 1K elements | 11.63 ms | 4.81 ms | 4.26 ms | 2.73x faster (sink) |
| 5K elements | 42.61 ms | 11.79 ms | 10.46 ms | 4.08x faster (sink) |
| 10K elements | 83.11 ms | 21.03 ms | 15.99 ms | 5.20x faster (sink) |

### 1GiB Writer Comparison

This one-shot benchmark writes a 1GiB XML document through both async writer and sync sink writer paths.
It includes in-memory targets and temp-file targets to separate writer overhead from file I/O cost.

Benchmark source: [writer-1gb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/writer-1gb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Target | Time | Throughput | Peak Heap | Peak RSS | Written | Records |
|--------|-----:|-----------:|----------:|---------:|--------:|--------:|
| Async writer + memory WritableStream | 15.98 s | 64.10 MiB/s | 106.55 mb | 222.95 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + memory sink** | 3.11 s | 328.78 MiB/s | 74.15 mb | 222.46 mb | 1.00 gb | 1,164,225 |
| Async writer + temp file | 20.37 s | 50.26 MiB/s | 62.09 mb | 226.27 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + temp file** | 4.05 s | 252.61 MiB/s | 73.35 mb | 223.68 mb | 1.00 gb | 1,164,225 |

Based on this run, `StaxXmlWriterSyncSink` is the recommended path for large XML file output. It provides the highest write throughput, and peak RSS stays in the same range as async writing.


