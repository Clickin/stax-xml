# Benchmarks

Generated: 2026-04-27T10:29:32.029Z
Run ID: 2026-04-27T10-29-32-029Z

Environment:
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K (~4.82 GHz)
- Runtime: node 24.15.0 (x64-win32)

This report is generated from the canonical release benchmark set. The docs benchmark pages are derived from the same raw JSON results.
Historical runs are indexed at [packages/benchmark/results/release/history/README.md](packages/benchmark/results/release/history/README.md).

## Benchmark Environment

The refreshed benchmark tables on this page were rerun with:
- **CPU**: 13th Gen Intel(R) Core(TM) i5-13600K (~4.82 GHz)
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

- `stax-xml JS fallback event parser`: `StaxXmlParserSync` event loop with a checksum over event type, names, text, and attributes. The XML string is prepared outside the timed region, matching string-only library API-native rows.
- `stax-xml JS fallback event parser (decode+parse)`: byte-source application path that pays `Buffer.toString("utf8")` inside the timed region before running `StaxXmlParserSync`.
- `stax-xml JS Uint8Array iterable`: `StaxXmlIterableParser` byte-frame loop over a reusable `Iterable<Uint8Array[]>` with the same checksum contract.
- `stax-xml native addon event aggregate`: native aggregate probe using the event-object tier inside Rust; it is not a public per-event JavaScript iterator.
- `stax-xml native addon raw aggregate`: native aggregate probe using a coarse Buffer call and direct string materialization inside Rust.
- `stax-xml to object`: `StaxXmlParserSync` plus a local projection into the benchmark object shape.
- `txml`, `fast-xml-parser`, and `xml2js`: each library uses its string API-native object/DOM-style parse API.
- The 13 MiB `xml2js` row is marked as an invalid comparator: `midsize.xml` has repeated top-level elements and xml2js reports only the first top-level element shape instead of the whole document.
- The stax-xml backend/surface rows are embedded directly in each parser table so the fixture and run environment are identical to the third-party rows.

</details>

### Parser Fixture Series

The `parser-*` series is the comparable parser-library fixture set. Read these tables together, in fixture-size order, before comparing the separate iterable file-traversal and runtime matrices.

#### Small Documents (2KB)

For typical web service responses and configuration files (complex.xml):

Benchmark source: [parser-2kb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-2kb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 9.45 µs | ~105,777 ops/sec | 1.87 kb | Lightweight object parser |
| **stax-xml to object** | 241.01 µs | ~4,149 ops/sec | 73.56 kb | Object conversion |
| stax-xml JS event parser | 258.65 µs | ~3,866 ops/sec | 80.68 kb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 257.44 µs | ~3,884 ops/sec | 80.28 kb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 182.08 µs | ~5,492 ops/sec | 32.08 kb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native event aggregate** | 8.12 µs | ~123,139 ops/sec | 0.19 kb | N-API aggregate probe; event-like objects stay inside Rust |
| **stax-xml native raw aggregate** | 3.18 µs | ~314,462 ops/sec | 0.19 kb | N-API aggregate probe; coarse Buffer call |
| fast-xml-parser | 423.92 µs | ~2,359 ops/sec | 195.76 kb | Object parser |
| xml2js | 543.76 µs | ~1,839 ops/sec | 213.95 kb | Callback object parser |

#### Medium Documents (4KB)

For larger API responses and data files (books.xml):

Benchmark source: [parser-4kb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-4kb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 18.60 µs | ~53,770 ops/sec | 5.18 kb | Lightweight object parser |
| **stax-xml to object** | 344.10 µs | ~2,906 ops/sec | 105.48 kb | Object conversion |
| stax-xml JS event parser | 363.48 µs | ~2,751 ops/sec | 132.98 kb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 369.23 µs | ~2,708 ops/sec | 135.25 kb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 247.60 µs | ~4,039 ops/sec | 33.23 kb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native event aggregate** | 17.96 µs | ~55,683 ops/sec | 0.19 kb | N-API aggregate probe; event-like objects stay inside Rust |
| **stax-xml native raw aggregate** | 6.58 µs | ~151,909 ops/sec | 0.19 kb | N-API aggregate probe; coarse Buffer call |
| fast-xml-parser | 638.27 µs | ~1,567 ops/sec | 914.73 kb | Object parser |
| xml2js | 833.00 µs | ~1,200 ops/sec | 660.97 kb | Callback object parser |

#### Medium-Large Documents (13MB)

Performance results on midsize.xml (13MB):

Benchmark source: [parser-13mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-13mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| xml2js | 558.63 µs | ~1,790 ops/sec | 468.12 kb | Invalid comparator: first top-level element only* |
| **stax-xml to object** | 220.67 ms | ~4.53 ops/sec | 145.52 mb | Object conversion |
| stax-xml JS event parser | 244.34 ms | ~4.09 ops/sec | 166.75 mb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 246.45 ms | ~4.06 ops/sec | 166.90 mb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 102.41 ms | ~9.76 ops/sec | 26.36 mb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native event aggregate** | 97.93 ms | ~10.21 ops/sec | 3.09 kb | N-API aggregate probe; event-like objects stay inside Rust |
| **stax-xml native raw aggregate** | 20.61 ms | ~48.51 ops/sec | 3.72 kb | N-API aggregate probe; coarse Buffer call |
| **txml** | 114.40 ms | ~8.74 ops/sec | 117.59 mb | Lightweight object parser |
| fast-xml-parser | 667.04 ms | ~1.5 ops/sec | 173.86 mb | Object parser |

*xml2js is not a valid whole-document comparator for this fixture. `midsize.xml` contains repeated top-level `<any_name>` roots, and xml2js returns only the first top-level element shape.

#### Large Documents (98MB)

Performance results on large.xml (98MB):

Benchmark source: [parser-98mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-98mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **stax-xml to object** | 1.77 s | ~0.57 ops/sec | 978.45 mb | Memory efficient |
| stax-xml JS event parser | 1.86 s | ~0.54 ops/sec | 1007.23 mb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 1.86 s | ~0.54 ops/sec | 1006.40 mb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 692.23 ms | ~1.44 ops/sec | 18.41 mb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native event aggregate** | 779.63 ms | ~1.28 ops/sec | 3.09 kb | N-API aggregate probe; event-like objects stay inside Rust |
| **stax-xml native raw aggregate** | 155.79 ms | ~6.42 ops/sec | 3.09 kb | N-API aggregate probe; coarse Buffer call |
| **txml** | 942.81 ms | ~1.06 ops/sec | 859.83 mb | Object parser |
| fast-xml-parser | 5.36 s | ~0.19 ops/sec | 1022.81 mb | Object parser |
| xml2js | 5.58 s | ~0.18 ops/sec | 630.61 mb | Callback object parser |

### Iterable File Traversal (1MiB to 4GiB)

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
| 1MiB temp file | **sync Iterable parser** | 14.30 ms | 12.52 mb | Baseline, 69.91 MiB/s |
| 1MiB temp file | async Iterable parser | 19.12 ms | 10.98 mb | 1.34x slower, 52.29 MiB/s |
| 10MiB temp file | **sync Iterable parser** | 67.19 ms | 26.18 mb | Baseline, 148.84 MiB/s |
| 10MiB temp file | async Iterable parser | 70.16 ms | 26.15 mb | 1.04x slower, 142.53 MiB/s |
| 100MiB temp file | **sync Iterable parser** | 542.94 ms | 11.44 mb | Baseline, 184.18 MiB/s |
| 100MiB temp file | async Iterable parser | 555.09 ms | 43.50 mb | 1.02x slower, 180.15 MiB/s |
| 1GiB temp file | **sync Iterable parser** | 5.39 s | 43.26 mb | Baseline, 190.07 MiB/s |
| 1GiB temp file | async Iterable parser | 5.57 s | 47.51 mb | 1.03x slower, 183.78 MiB/s |
| 4GiB temp file | **sync Iterable parser** | 21.45 s | 45.91 mb | Baseline, 190.99 MiB/s |
| 4GiB temp file | async Iterable parser | 21.81 s | 51.53 mb | 1.02x slower, 187.77 MiB/s |

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
| node | 24.15.0 | public-sync-full-string | 59.4 MiB/s | 269.44 ms | -746772258 |
| node | 24.15.0 | iterable-count-only | 205.1 MiB/s | 77.99 ms | 2078515073 |
| node | 24.15.0 | iterable-full-string | 117.0 MiB/s | 136.79 ms | 1007437756 |
| bun | 1.3.13 | public-sync-full-string | 86.8 MiB/s | 184.26 ms | -746772258 |
| bun | 1.3.13 | iterable-count-only | 260.4 MiB/s | 61.44 ms | 2078515073 |
| bun | 1.3.13 | iterable-full-string | 160.6 MiB/s | 99.63 ms | 1007437756 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 57.3 MiB/s | 279.13 ms | -746772258 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-count-only | 210.5 MiB/s | 75.99 ms | 2078515073 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-full-string | 126.0 MiB/s | 126.99 ms | 1007437756 |

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
| stax-xml JS on Node | 185.0 MiB/s | 86.49 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 1092.6 MiB/s | 14.64 ms | 5.91x | ok |
| Woodstox on Java 8 | 341.7 MiB/s | 46.83 ms | 1.85x | ok |
| quick-xml | 312.3 MiB/s | 51.24 ms | 1.69x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 142.3 MiB/s | 112.47 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 988.2 MiB/s | 16.19 ms | 6.95x | ok |
| Woodstox on Java 8 | 329.2 MiB/s | 48.60 ms | 2.31x | ok |
| quick-xml | 273.6 MiB/s | 58.47 ms | 1.92x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 110.4 MiB/s | 144.93 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 916.8 MiB/s | 17.45 ms | 8.30x | ok |
| Woodstox on Java 8 | 332.6 MiB/s | 48.11 ms | 3.01x | ok |
| quick-xml | 290.0 MiB/s | 55.16 ms | 2.63x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 132.8 MiB/s | 120.44 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 902.8 MiB/s | 17.72 ms | 6.80x | ok |
| Woodstox on Java 8 | 319.9 MiB/s | 50.02 ms | 2.41x | ok |
| quick-xml | 300.4 MiB/s | 53.26 ms | 2.26x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 103.7 MiB/s | 154.29 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 612.4 MiB/s | 26.12 ms | 5.91x | ok |
| Woodstox on Java 8 | 265.6 MiB/s | 60.24 ms | 2.56x | ok |
| quick-xml | 236.8 MiB/s | 67.57 ms | 2.28x | ok |

### Woodstox Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Status |
| --- | ---: | ---: | ---: | --- |
| count-only | 341.7 MiB/s | 307.5 MiB/s | -10.0% | ok |
| name-string-only | 329.2 MiB/s | 285.6 MiB/s | -13.3% | ok |
| text-string-only | 332.6 MiB/s | 292.1 MiB/s | -12.2% | ok |
| attr-value-string-only | 319.9 MiB/s | 260.3 MiB/s | -18.6% | ok |
| full-string | 265.6 MiB/s | 233.6 MiB/s | -12.1% | ok |

### Why Native Addons Are The Acceleration Path

The JavaScript parser remains the compatibility fallback, but it is not the release performance ceiling. Prior pure-JS optimization work improved the iterable event-frame backend, yet full-string workloads still stayed behind native parser baselines, especially `quick-xml`. The remaining costs are delimiter scanning, string materialization, and stable object/API shapes around attributes and text.

The Rust native path is intended to move the hot tokenizer and string/span aggregation work into code that can use native and SIMD-oriented scanning strategies, closer in direction to native parsers such as `quick-xml` and simdjson-style designs. The package topology therefore keeps `stax-xml` as the facade while adding optional native/Wasm acceleration packages; environments that cannot load binaries continue to use the JavaScript fallback.


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
| plain parser | **2.63 ms** | Lowest overhead, handwritten state machine |
| converter api | **3.42 ms** | Declarative schema with automatic dispatch plan |
| converter api compiled | **3.15 ms** | Explicit compile() with cached dispatch plan |

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
| **fast-xml-parser builder** | 192.31 µs | ~5,200 ops/sec | 80.36 kb | fast-xml-parser builder |
| stax-xml writer | 259.96 µs | ~3,847 ops/sec | 265.51 kb | Writer API |
| **stax-xml writer sync** | 5.53 µs | ~180,945 ops/sec | 13.39 kb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 122.51 µs | ~8,163 ops/sec | 35.86 kb | Sync streaming sink API |
| xml2js builder | 303.28 µs | ~3,297 ops/sec | 128.36 kb | xml2js builder |

### Large Document Building (1MB)

Building large XML documents from big JSON data:

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **fast-xml-parser builder** | 25.82 ms | ~38.72 ops/sec | 26.70 mb | fast-xml-parser builder |
| **stax-xml writer sync** | 6.38 ms | ~156.75 ops/sec | 9.74 mb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 8.20 ms | ~121.88 ops/sec | 10.43 mb | Sync streaming sink API |
| stax-xml writer | 41.01 ms | ~24.38 ops/sec | 44.03 mb | Writer API |

### Async vs Sync Writer Comparison

This comparison measures the writer APIs themselves on the same generated document shape. It includes async file output, sync string output followed by file write, and the sync sink path with an in-memory file-like target.
It is intended to show `stax-xml` async vs sync overhead and sink overhead, not to imply that all paths have identical durability guarantees.

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Element Count | Async Writer | Sync Writer + File | Sync Writer + Sink | Performance Ratio |
|---------------|--------------|--------------------|--------------------|-------------------|
| 1K elements | 7.11 ms | 3.03 ms | 2.47 ms | 2.88x faster (sink) |
| 5K elements | 24.19 ms | 7.39 ms | 5.88 ms | 4.11x faster (sink) |
| 10K elements | 46.81 ms | 12.83 ms | 9.48 ms | 4.94x faster (sink) |

### 1GiB Writer Comparison

This one-shot benchmark writes a 1GiB XML document through both async writer and sync sink writer paths.
It includes in-memory targets and temp-file targets to separate writer overhead from file I/O cost.

Benchmark source: [writer-1gb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/writer-1gb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Target | Time | Throughput | Peak Heap | Peak RSS | Written | Records |
|--------|-----:|-----------:|----------:|---------:|--------:|--------:|
| Async writer + memory WritableStream | 15.21 s | 67.33 MiB/s | 108.31 mb | 226.27 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + memory sink** | 3.11 s | 329.11 MiB/s | 74.02 mb | 227.14 mb | 1.00 gb | 1,164,225 |
| Async writer + temp file | 16.32 s | 62.75 MiB/s | 62.00 mb | 227.38 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + temp file** | 3.40 s | 301.60 MiB/s | 73.39 mb | 227.29 mb | 1.00 gb | 1,164,225 |

Based on this run, `StaxXmlWriterSyncSink` is the recommended path for large XML file output. It provides the highest write throughput, and peak RSS stays in the same range as async writing.


