# Benchmarks

Generated: 2026-04-27T11:05:08.106Z
Run ID: 2026-04-27T11-05-08-106Z

Environment:
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K (~4.84 GHz)
- Runtime: node 24.15.0 (x64-win32)

This report is generated from the canonical release benchmark set. The docs benchmark pages are derived from the same raw JSON results.
Historical runs are indexed at [packages/benchmark/results/release/history/README.md](packages/benchmark/results/release/history/README.md).

## Benchmark Environment

The refreshed benchmark tables on this page were rerun with:
- **CPU**: 13th Gen Intel(R) Core(TM) i5-13600K (~4.84 GHz)
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
| **txml** | 9.29 µs | ~107,603 ops/sec | 1.88 kb | Lightweight object parser |
| **stax-xml to object** | 253.66 µs | ~3,942 ops/sec | 72.76 kb | Object conversion |
| stax-xml JS event parser | 285.54 µs | ~3,502 ops/sec | 81.20 kb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 290.19 µs | ~3,446 ops/sec | 80.30 kb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 185.69 µs | ~5,385 ops/sec | 31.91 kb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native event aggregate** | 9.09 µs | ~110,015 ops/sec | 0.19 kb | N-API aggregate probe; event-like objects stay inside Rust |
| **stax-xml native raw aggregate** | 3.22 µs | ~310,949 ops/sec | 0.19 kb | N-API aggregate probe; coarse Buffer call |
| fast-xml-parser | 441.56 µs | ~2,265 ops/sec | 194.89 kb | Object parser |
| xml2js | 575.11 µs | ~1,739 ops/sec | 214.93 kb | Callback object parser |

#### Medium Documents (4KB)

For larger API responses and data files (books.xml):

Benchmark source: [parser-4kb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-4kb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 18.66 µs | ~53,577 ops/sec | 5.18 kb | Lightweight object parser |
| **stax-xml to object** | 365.60 µs | ~2,735 ops/sec | 105.63 kb | Object conversion |
| stax-xml JS event parser | 390.56 µs | ~2,560 ops/sec | 133.94 kb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 377.86 µs | ~2,646 ops/sec | 135.84 kb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 262.51 µs | ~3,809 ops/sec | 33.13 kb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native event aggregate** | 18.74 µs | ~53,366 ops/sec | 0.19 kb | N-API aggregate probe; event-like objects stay inside Rust |
| **stax-xml native raw aggregate** | 6.87 µs | ~145,527 ops/sec | 0.19 kb | N-API aggregate probe; coarse Buffer call |
| fast-xml-parser | 607.31 µs | ~1,647 ops/sec | 848.38 kb | Object parser |
| xml2js | 972.57 µs | ~1,028 ops/sec | 640.40 kb | Callback object parser |

#### Medium-Large Documents (13MB)

Performance results on midsize.xml (13MB):

Benchmark source: [parser-13mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-13mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| xml2js | 593.00 µs | ~1,686 ops/sec | 477.45 kb | Invalid comparator: first top-level element only* |
| **stax-xml to object** | 225.28 ms | ~4.44 ops/sec | 145.54 mb | Object conversion |
| stax-xml JS event parser | 251.33 ms | ~3.98 ops/sec | 166.75 mb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 258.59 ms | ~3.87 ops/sec | 166.00 mb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 104.32 ms | ~9.59 ops/sec | 26.36 mb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native event aggregate** | 101.54 ms | ~9.85 ops/sec | 3.09 kb | N-API aggregate probe; event-like objects stay inside Rust |
| **stax-xml native raw aggregate** | 20.81 ms | ~48.04 ops/sec | 3.09 kb | N-API aggregate probe; coarse Buffer call |
| **txml** | 116.76 ms | ~8.56 ops/sec | 117.59 mb | Lightweight object parser |
| fast-xml-parser | 672.25 ms | ~1.49 ops/sec | 177.34 mb | Object parser |

*xml2js is not a valid whole-document comparator for this fixture. `midsize.xml` contains repeated top-level `<any_name>` roots, and xml2js returns only the first top-level element shape.

#### Large Documents (98MB)

Performance results on large.xml (98MB):

Benchmark source: [parser-98mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-98mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **stax-xml to object** | 1.89 s | ~0.53 ops/sec | 974.18 mb | Memory efficient |
| stax-xml JS event parser | 1.90 s | ~0.53 ops/sec | 1006.68 mb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 1.94 s | ~0.52 ops/sec | 1014.64 mb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 695.09 ms | ~1.44 ops/sec | 18.41 mb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native event aggregate** | 790.53 ms | ~1.26 ops/sec | 3.09 kb | N-API aggregate probe; event-like objects stay inside Rust |
| **stax-xml native raw aggregate** | 155.21 ms | ~6.44 ops/sec | 3.09 kb | N-API aggregate probe; coarse Buffer call |
| **txml** | 973.22 ms | ~1.03 ops/sec | 859.81 mb | Object parser |
| fast-xml-parser | 5.43 s | ~0.18 ops/sec | 1017.29 mb | Object parser |
| xml2js | 5.65 s | ~0.18 ops/sec | 634.97 mb | Callback object parser |

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
| 1MiB temp file | **sync Iterable parser** | 16.84 ms | 12.28 mb | Baseline, 59.38 MiB/s |
| 1MiB temp file | async Iterable parser | 19.01 ms | 10.94 mb | 1.13x slower, 52.61 MiB/s |
| 10MiB temp file | **sync Iterable parser** | 68.94 ms | 26.17 mb | Baseline, 145.05 MiB/s |
| 10MiB temp file | async Iterable parser | 69.78 ms | 26.17 mb | 1.01x slower, 143.30 MiB/s |
| 100MiB temp file | **sync Iterable parser** | 564.47 ms | 11.51 mb | Baseline, 177.16 MiB/s |
| 100MiB temp file | async Iterable parser | 569.63 ms | 47.50 mb | 1.01x slower, 175.55 MiB/s |
| 1GiB temp file | **sync Iterable parser** | 5.67 s | 43.34 mb | Baseline, 180.75 MiB/s |
| 1GiB temp file | async Iterable parser | 5.81 s | 40.90 mb | 1.03x slower, 176.32 MiB/s |
| 4GiB temp file | **sync Iterable parser** | 22.74 s | 45.99 mb | Baseline, 180.11 MiB/s |
| 4GiB temp file | async Iterable parser | 23.50 s | 52.86 mb | 1.03x slower, 174.29 MiB/s |

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
| node | 24.15.0 | public-sync-full-string | 56.2 MiB/s | 284.87 ms | -746772258 |
| node | 24.15.0 | iterable-count-only | 196.7 MiB/s | 81.36 ms | 2078515073 |
| node | 24.15.0 | iterable-full-string | 117.3 MiB/s | 136.35 ms | 1007437756 |
| bun | 1.3.13 | public-sync-full-string | 84.6 MiB/s | 189.06 ms | -746772258 |
| bun | 1.3.13 | iterable-count-only | 254.8 MiB/s | 62.79 ms | 2078515073 |
| bun | 1.3.13 | iterable-full-string | 158.5 MiB/s | 100.96 ms | 1007437756 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 56.5 MiB/s | 283.35 ms | -746772258 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-count-only | 202.0 MiB/s | 79.19 ms | 2078515073 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-full-string | 128.7 MiB/s | 124.31 ms | 1007437756 |

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
| stax-xml JS on Node | 173.5 MiB/s | 92.23 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 1080.8 MiB/s | 14.80 ms | 6.23x | ok |
| Woodstox on Java 8 | 347.6 MiB/s | 46.03 ms | 2.00x | ok |
| quick-xml | 311.3 MiB/s | 51.39 ms | 1.79x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 134.6 MiB/s | 118.87 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 965.9 MiB/s | 16.56 ms | 7.18x | ok |
| Woodstox on Java 8 | 337.1 MiB/s | 47.46 ms | 2.50x | ok |
| quick-xml | 261.7 MiB/s | 61.15 ms | 1.94x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 106.0 MiB/s | 150.93 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 938.8 MiB/s | 17.04 ms | 8.86x | ok |
| Woodstox on Java 8 | 329.1 MiB/s | 48.62 ms | 3.10x | ok |
| quick-xml | 286.2 MiB/s | 55.91 ms | 2.70x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 144.7 MiB/s | 110.54 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 899.5 MiB/s | 17.79 ms | 6.21x | ok |
| Woodstox on Java 8 | 304.7 MiB/s | 52.50 ms | 2.11x | ok |
| quick-xml | 295.7 MiB/s | 54.10 ms | 2.04x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 109.2 MiB/s | 146.47 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 610.8 MiB/s | 26.20 ms | 5.59x | ok |
| Woodstox on Java 8 | 255.5 MiB/s | 62.62 ms | 2.34x | ok |
| quick-xml | 238.4 MiB/s | 67.12 ms | 2.18x | ok |

### Woodstox Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Status |
| --- | ---: | ---: | ---: | --- |
| count-only | 347.6 MiB/s | 303.2 MiB/s | -12.8% | ok |
| name-string-only | 337.1 MiB/s | 280.5 MiB/s | -16.8% | ok |
| text-string-only | 329.1 MiB/s | 294.1 MiB/s | -10.6% | ok |
| attr-value-string-only | 304.7 MiB/s | 259.1 MiB/s | -15.0% | ok |
| full-string | 255.5 MiB/s | 230.3 MiB/s | -9.9% | ok |

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
| plain parser | **2.68 ms** | Lowest overhead, handwritten state machine |
| converter api | **3.40 ms** | Declarative schema with automatic dispatch plan |
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
| **fast-xml-parser builder** | 210.18 µs | ~4,758 ops/sec | 80.57 kb | fast-xml-parser builder |
| stax-xml writer | 296.07 µs | ~3,378 ops/sec | 266.10 kb | Writer API |
| **stax-xml writer sync** | 5.58 µs | ~179,156 ops/sec | 13.40 kb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 152.43 µs | ~6,560 ops/sec | 29.55 kb | Sync streaming sink API |
| xml2js builder | 308.50 µs | ~3,241 ops/sec | 128.27 kb | xml2js builder |

### Large Document Building (1MB)

Building large XML documents from big JSON data:

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **fast-xml-parser builder** | 25.67 ms | ~38.95 ops/sec | 26.92 mb | fast-xml-parser builder |
| **stax-xml writer sync** | 6.85 ms | ~146.05 ops/sec | 9.58 mb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 8.19 ms | ~122.15 ops/sec | 10.44 mb | Sync streaming sink API |
| stax-xml writer | 42.11 ms | ~23.74 ops/sec | 44.05 mb | Writer API |

### Async vs Sync Writer Comparison

This comparison measures the writer APIs themselves on the same generated document shape. It includes async file output, sync string output followed by file write, and the sync sink path with an in-memory file-like target.
It is intended to show `stax-xml` async vs sync overhead and sink overhead, not to imply that all paths have identical durability guarantees.

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Element Count | Async Writer | Sync Writer + File | Sync Writer + Sink | Performance Ratio |
|---------------|--------------|--------------------|--------------------|-------------------|
| 1K elements | 7.20 ms | 3.16 ms | 2.58 ms | 2.79x faster (sink) |
| 5K elements | 25.35 ms | 7.61 ms | 5.97 ms | 4.25x faster (sink) |
| 10K elements | 48.73 ms | 13.36 ms | 9.92 ms | 4.91x faster (sink) |

### 1GiB Writer Comparison

This one-shot benchmark writes a 1GiB XML document through both async writer and sync sink writer paths.
It includes in-memory targets and temp-file targets to separate writer overhead from file I/O cost.

Benchmark source: [writer-1gb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/writer-1gb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Target | Time | Throughput | Peak Heap | Peak RSS | Written | Records |
|--------|-----:|-----------:|----------:|---------:|--------:|--------:|
| Async writer + memory WritableStream | 15.67 s | 65.35 MiB/s | 104.87 mb | 227.34 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + memory sink** | 3.10 s | 330.10 MiB/s | 74.30 mb | 227.23 mb | 1.00 gb | 1,164,225 |
| Async writer + temp file | 16.93 s | 60.50 MiB/s | 62.21 mb | 228.14 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + temp file** | 3.59 s | 284.88 MiB/s | 73.39 mb | 227.86 mb | 1.00 gb | 1,164,225 |

Based on this run, `StaxXmlWriterSyncSink` is the recommended path for large XML file output. It provides the highest write throughput, and peak RSS stays in the same range as async writing.
