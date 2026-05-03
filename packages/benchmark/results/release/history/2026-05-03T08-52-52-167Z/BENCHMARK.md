# Benchmarks

Generated: 2026-05-03T08:52:52.167Z
Run ID: 2026-05-03T08-52-52-167Z

Environment:
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K (~4.85 GHz)
- Runtime: node 24.15.0 (x64-win32)

This report is generated from the canonical release benchmark set. The docs benchmark pages are derived from the same raw JSON results.
Historical runs are indexed at [packages/benchmark/results/release/history/README.md](packages/benchmark/results/release/history/README.md).

## Benchmark Environment

The refreshed benchmark tables on this page were rerun with:
- **CPU**: 13th Gen Intel(R) Core(TM) i5-13600K (~4.85 GHz)
- **Runtime**: node 24.15.0 (x64-win32) with garbage collection exposed (`--expose-gc`)
- **Tool**: [Mitata](https://github.com/evanw/mitata)
- **Canonical Set**: parser 2KB / 4KB / 13MB / 98MB with stax-xml backend/surface rows, a separate maintained Node npm XML parser comparison, EventReader stream size comparison from 1MiB to 4GiB, writer small / big / async, converter parity

<details>
<summary>Resolved package and runtime versions</summary>

| Benchmark package | Resolved version | Declared range | Source |
| --- | ---: | --- | --- |
| fast-xml-parser | 5.7.2 | ^5.2.5 | npm |
| htmlparser2 | 12.0.0 | ^12.0.0 | npm |
| mitata | 1.0.34 | ^1.0.34 | npm |
| sax | 1.6.0 | ^1.4.1 | npm |
| saxes | 6.0.0 | ^6.0.0 | npm |
| saxophone | 0.8.0 | ^0.8.0 | npm |
| stax-xml | 1.0.0-rc3 | workspace:* | workspace |
| txml | 5.2.1 | ^5.1.1 | npm |
| xml-stream | 0.4.5 | ^0.4.5 | npm |
| xml2js | 0.6.2 | ^0.6.2 | npm |

| Runtime/tool | Version | Status |
| --- | --- | --- |
| node | v24.15.0 | ok |
| pnpm | 10.33.2 | ok |
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
books fixture output:
  Array<{ id, title, author, price }>

person fixtures output:
  Array<{ id, name, age }>
~~~

Measurement policy:

- This parser fixture series compares public stax-xml surfaces against one another, not against third-party parsers.
- Every row builds the same final JavaScript object array for the fixture before returning.
- `EventReaderSync`: native-backed public string event iterator with a manual object builder.
- `StreamReaderSync`: native-backed public byte-stream pull reader with a manual object builder.
- `ProjectionReader`: native-backed public object-record projection returning the same object shape.
- `Converter`: public declarative converter schema compiled once and returning the same object shape through `schema.parseSync()`.
- Because the converter targets XPath 1.0 selectors plus field transforms, most selector-style `if` branches can move into declarative predicates, positions, descendant paths, and attribute tests instead of event-by-event manual dispatch.
- Keep `EventReaderSync` or `StreamReaderSync` when the logic depends on imperative stream state, early exit, side effects, or mutable cross-record state that XPath selection cannot express.
- The fixture input is loaded into memory as bytes, and `EventReaderSync` also receives the decoded string. This is an in-memory sync comparison, not the low-memory large-file traversal benchmark.
- The memory column for these parser tables is Mitata average heap footprint for the benchmarked call. It is not a bounded-reader peak RSS metric.

</details>

### Parser Fixture Series

The `parser-*` series compares public stax-xml surfaces that all produce the same final JavaScript object shape for each fixture. Read these tables together, in fixture-size order, before comparing the separate EventReader stream traversal and runtime matrices.

#### Small Documents (2KB)

For typical web service responses and configuration files (complex.xml):

Benchmark source: [parser-2kb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-2kb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **EventReaderSync** | 347.52 µs | ~2,878 ops/sec | 87.45 kb | Public string event iterator building the same object shape manually |
| **StreamReaderSync** | 302.28 µs | ~3,308 ops/sec | 50.28 kb | Public byte-stream pull reader building the same object shape manually |
| **ProjectionReader** | 5.80 µs | ~172,394 ops/sec | 0.41 kb | Public projection surface returning the same object shape through object records |
| **Converter** | 217.20 µs | ~4,604 ops/sec | 49.14 kb | Declarative schema compiled once and returning the same object shape through the public converter API |

#### Medium Documents (4KB)

For larger API responses and data files (books.xml):

Benchmark source: [parser-4kb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-4kb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **EventReaderSync** | 483.91 µs | ~2,066 ops/sec | 131.75 kb | Public string event iterator building the same object shape manually |
| **StreamReaderSync** | 367.35 µs | ~2,722 ops/sec | 90.44 kb | Public byte-stream pull reader building the same object shape manually |
| **ProjectionReader** | 18.95 µs | ~52,778 ops/sec | 2.82 kb | Public projection surface returning the same object shape through object records |
| **Converter** | 353.89 µs | ~2,826 ops/sec | 120.92 kb | Declarative schema compiled once and returning the same object shape through the public converter API |

#### Medium-Large Documents (13MB)

Performance results on midsize.xml (13MB):

Benchmark source: [parser-13mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-13mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **EventReaderSync** | 309.68 ms | ~3.23 ops/sec | 187.28 mb | Public string event iterator building the same object shape manually |
| **StreamReaderSync** | 187.53 ms | ~5.33 ops/sec | 77.12 mb | Public byte-stream pull reader building the same object shape manually |
| **ProjectionReader** | 33.91 ms | ~29.49 ops/sec | 1.66 mb | Public projection surface returning the same object shape through object records |
| **Converter** | 115.61 ms | ~8.65 ops/sec | 5.05 mb | Declarative schema compiled once and returning the same object shape through the public converter API |

#### Large Documents (98MB)

Performance results on large.xml (98MB):

Benchmark source: [parser-98mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-98mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **EventReaderSync** | 2.75 s | ~0.36 ops/sec | 1.15 gb | Public string event iterator building the same object shape manually |
| **StreamReaderSync** | 1.80 s | ~0.56 ops/sec | 568.45 mb | Public byte-stream pull reader building the same object shape manually |
| **ProjectionReader** | 295.44 ms | ~3.38 ops/sec | 12.46 mb | Public projection surface returning the same object shape through object records |
| **Converter** | 812.42 ms | ~1.23 ops/sec | 78.51 mb | Declarative schema compiled once and returning the same object shape through the public converter API |

### Node npm XML Parsers

This separate section compares maintained public npm XML parser packages on one representative Node fixture. It is intentionally placed after the parser fixture series because event parsers, object parsers, and the stax public reader surfaces have different output shapes.

<details>
<summary>Scenario contract: maintained Node npm XML parser comparison</summary>

This section uses one representative XML fixture, `books.xml`, so npm parser packages can be compared in one place without mixing the result into the broader parser fixture series.

Candidate policy:

- Included packages must be public npm packages with a current Node XML parsing surface already present in the benchmark workspace.
- Excluded packages include internal probes, old package names superseded by a scoped package, packages with very old last publish dates, and packages whose own documentation presents the parser as non-compliant or intentionally minimal.
- The section therefore includes `fast-xml-parser`, `txml`, `xml2js`, `sax`, `saxes`, and `htmlparser2` with `xmlMode` enabled.
- `@xmldom/xmldom` was evaluated as a DOM candidate, but its current npm install path reports a deprecation warning, so it is not included in the maintained-comparator set.

Measurement policy:

- Object/DOM-style libraries use their natural string-to-object parse API.
- SAX/event-style libraries consume events and fold names, text, and attributes into a checksum so the parser work is retained.
- stax-xml rows are included only as local reference rows and use public `EventReaderSync` or `ProjectionReader` surfaces. Native rows initialize `stax-xml` with the native backend, then measure only those public package surfaces.

</details>

Benchmark source: [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs), [books fixture](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/test-data/books.xml).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **stax-xml EventReaderSync (native)** | 524.92 µs | ~1,905 ops/sec | 146.12 kb | Public lean string event reader, native runtime backend |
| **stax-xml ProjectionReader parseXmlNodes (native)** | 142.70 µs | ~7,008 ops/sec | 55.75 kb | Public unknown-schema object projection through stax-xml/projection |
| fast-xml-parser XMLParser | 700.77 µs | ~1,427 ops/sec | 828.81 kb | Object parser |
| txml parse | 135.71 µs | ~7,368 ops/sec | 49.10 kb | Lightweight object parser |
| xml2js parseString | 1.38 ms | ~725.82 ops/sec | 488.42 kb | Callback object parser |
| sax strict event parser | 992.24 µs | ~1,008 ops/sec | 405.50 kb | Strict SAX event parser |
| saxes event parser | 806.15 µs | ~1,240 ops/sec | 166.11 kb | Maintained SAX-style non-validating parser |
| htmlparser2 xmlMode parser | 708.77 µs | ~1,411 ops/sec | 396.13 kb | Fast HTML/XML event parser in xmlMode |

### EventReader File Traversal (1MiB to 1GiB)

For processing large XML files (RSS feeds, data exports, etc.):

<details>
<summary>Scenario contract: EventReader stream native file traversal</summary>

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

- Every row in this section uses the public `EventReader` stream API over bounded temp-file chunks.
- `EventReader stream native` initializes the package with the native backend before measuring the same stream reader API.
- XML tokenization is CPU-intensive. Async file reads do not make the parse loop non-blocking; if this work would run on a latency-sensitive main event loop thread, offload parsing to a Worker or worker thread.
- These rows intentionally use a structural checksum rather than building a full object tree so the table measures stream tokenization and event materialization.
- The memory column in the rendered table is peak JS heap for the traversal run. Peak RSS is tracked in the raw JSON, but it must be measured in an isolated process to stay meaningful.

</details>

The default release set stops at 1GiB; the 4GiB traversal is available with `release:update -- --include-stress`.

Benchmark source: [sync/async release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| File Size | Parser Type | Processing Time | Memory Usage | Throughput |
|-----------|-------------|-----------------|--------------|------------|
| 1MiB temp file | **EventReader stream native** | 75.08 ms | 26.10 mb | 13.32 MiB/s |
| 10MiB temp file | **EventReader stream native** | 479.13 ms | 96.25 mb | 20.87 MiB/s |
| 100MiB temp file | **EventReader stream native** | 4.48 s | 224.81 mb | 22.34 MiB/s |
| 1GiB temp file | **EventReader stream native** | 45.73 s | 230.57 mb | 22.39 MiB/s |

**Key Insights:**
- This section is the public stream reader throughput view, not a full-object materialization benchmark.
- The rows use the public native-backed `EventReader` stream API over bounded file chunks.
- Async stream parsing can still block the main event loop while each CPU parse batch runs; use a Worker or worker thread when visible latency matters.
- For files above 100MiB, avoid the public full-string sync path when retaining the full XML string is not acceptable; use async streams for bounded input buffering.

## Runtime Matrix And Native Direction

The same built JavaScript implementation was measured on Node, Bun, and Deno with a generated single-root 16.00 MiB XML fixture. This is a runtime-codegen and compatibility check; native runtime comparison is reported separately through public EventReader rows.

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
  scenario: "public-sync-full-string" | "event-count-only" | "event-full-string",
  eventCount: number,
  checksum: fold(event type, names, text, attr names, attr values),
  peakHeapUsedBytes: number
}
~~~

Runtime methods:

- Node reads text with `fs.readFileSync`, then runs the built package through `node --expose-gc`.
- Bun reads text with `Bun.file(path).text()`, then runs the same built JavaScript package.
- Deno reads text with `Deno.readTextFile` under `--allow-read --allow-env`, then runs the same built JavaScript package.
- `public-sync-full-string` uses `EventReaderSync` over one string.
- `event-count-only` and `event-full-string` use public event reader checksums without constructing a full object tree; they are not async parser rows.
- This matrix intentionally excludes native runtime rows.

</details>

Benchmark source: [runtime-matrix.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/runtime-matrix.mjs).

| Runtime | Version | Scenario | Throughput | Average | Checksum |
| --- | --- | --- | ---: | ---: | ---: |
| node | 24.15.0 | public-sync-full-string | 39.0 MiB/s | 409.76 ms | -746772258 |
| node | 24.15.0 | event-count-only | 39.6 MiB/s | 403.71 ms | 2078515073 |
| node | 24.15.0 | event-full-string | 37.0 MiB/s | 431.85 ms | 1007437756 |
| bun | 1.3.13 | public-sync-full-string | 69.1 MiB/s | 231.58 ms | -746772258 |
| bun | 1.3.13 | event-count-only | 79.9 MiB/s | 200.22 ms | 2078515073 |
| bun | 1.3.13 | event-full-string | 53.6 MiB/s | 298.65 ms | 1007437756 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 35.3 MiB/s | 453.13 ms | -746772258 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | event-count-only | 38.7 MiB/s | 413.56 ms | 2078515073 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | event-full-string | 37.2 MiB/s | 430.29 ms | 1007437756 |

The non-JS comparator uses the same event-count and checksum contract. It reports stax-xml JS on Node, stax-xml native runtime through public `EventReaderSync`, Woodstox on Java 8, and quick-xml. Woodstox is reported on Java 8 for the public baseline because Java 8 is its minimum supported runtime target; Java 25 is measured only as a verification check.

<details>
<summary>Scenario contract: stax-xml JS/native EventReaderSync, Woodstox, and quick-xml comparator</summary>

The comparator uses the same generated 16.00 MiB XML fixture shape as the runtime matrix.

Output shape:

~~~text
comparator-result = {
  tier: "count-only" | "name-string-only" | "attr-value-string-only" | "text-string-only" | "full-string",
  implementation: "stax-xml-js-event-reader" | "stax-xml-native-event-reader" | "woodstox-java8" | "quick-xml",
  eventCount: number,
  checksum: fold(selected event data for tier)
}
~~~

Parsing methods:

- `stax-xml JS on Node`: public `EventReaderSync` with the JavaScript backend, run on Node, with tier-specific checksum folding.
- `stax-xml native EventReaderSync`: initializes `stax-xml` with `initStaxXml({ backend: "native" })`, then measures the public string event reader surface.
- Woodstox: Java StAX `XMLStreamReader`, namespace-aware parsing disabled, coalescing enabled, DTD/external entities disabled, buffered file input.
- `quick-xml`: Rust `Reader` over buffered file input; declaration, PI, doctype, and comments are skipped; text is trimmed for checksum parity.
- Java 8 is the public Woodstox row because it is Woodstox's minimum runtime target; Java 25 is a separate verification row.

</details>

Benchmark source: [cross-runtime-comparison.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/cross-runtime-comparison.mjs).

### count-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 16.1 MiB/s | 994.62 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 64.1 MiB/s | 249.78 ms | 3.98x | ok |
| Woodstox on Java 8 | 335.5 MiB/s | 47.69 ms | 20.85x | ok |
| quick-xml | 312.5 MiB/s | 51.20 ms | 19.43x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 19.8 MiB/s | 806.69 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 64.0 MiB/s | 249.88 ms | 3.23x | ok |
| Woodstox on Java 8 | 300.9 MiB/s | 53.17 ms | 15.17x | ok |
| quick-xml | 270.6 MiB/s | 59.12 ms | 13.64x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 17.7 MiB/s | 903.43 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 35.7 MiB/s | 448.04 ms | 2.02x | ok |
| Woodstox on Java 8 | 338.8 MiB/s | 47.23 ms | 19.13x | ok |
| quick-xml | 287.6 MiB/s | 55.63 ms | 16.24x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 19.0 MiB/s | 842.12 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 36.9 MiB/s | 433.05 ms | 1.94x | ok |
| Woodstox on Java 8 | 314.6 MiB/s | 50.86 ms | 16.56x | ok |
| quick-xml | 297.0 MiB/s | 53.86 ms | 15.63x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 18.2 MiB/s | 876.89 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 27.6 MiB/s | 578.95 ms | 1.51x | ok |
| Woodstox on Java 8 | 257.5 MiB/s | 62.12 ms | 14.12x | ok |
| quick-xml | 238.7 MiB/s | 67.03 ms | 13.08x | ok |

### Woodstox Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Status |
| --- | ---: | ---: | ---: | --- |
| count-only | 335.5 MiB/s | 300.2 MiB/s | -10.5% | ok |
| name-string-only | 300.9 MiB/s | 295.7 MiB/s | -1.7% | ok |
| text-string-only | 338.8 MiB/s | 293.9 MiB/s | -13.2% | ok |
| attr-value-string-only | 314.6 MiB/s | 270.7 MiB/s | -14.0% | ok |
| full-string | 257.5 MiB/s | 231.8 MiB/s | -10.0% | ok |

### Why Native Runtime Acceleration Is The Performance Path

The JavaScript parser remains the compatibility fallback, but it is not the release performance ceiling. Prior pure-JS optimization work improved the internal event-frame backend, yet full-string workloads still stayed behind native parser baselines, especially `quick-xml`. The remaining costs are delimiter scanning, string materialization, and stable object/API shapes around attributes and text.

The Rust native path is intended to move the hot tokenizer and string/span aggregation work into code that can use native and SIMD-oriented scanning strategies, closer in direction to native parsers such as `quick-xml` and simdjson-style designs. Published benchmark rows now measure that path through public reader surfaces rather than direct native diagnostic entry points. The package topology keeps `stax-xml` as the facade while adding optional native/Wasm acceleration packages; environments that cannot load binaries continue to use the JavaScript fallback.


## Converter API vs Plain Parser

The benchmark below compares three ways to build the **same object output**:

- A handwritten plain parser built directly on `EventReaderSync`
- The declarative converter API with automatic dispatch-plan routing
- The converter API with `.compile()` enabled

Recommendation: when this kind of target object shape is known, prefer the converter API over ad-hoc event parsing. XPath 1.0 selectors and field transforms absorb most selector-style `if` logic; keep `EventReaderSync` for light whole-XML traversal and use `ProjectionReader` for heavier unknown-schema materialization or when the logic remains stream-imperative.

Current fixture:

- `catalog` document
- `800` `<featured>` elements
- `800` `<book>` elements
- result includes root object fields, root arrays, direct scalar fields, and transformed derived fields

Benchmark source: [converter-plain-output-benchmark.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/converter-plain-output-benchmark.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Implementation | Average time | Notes |
| --- | ---: | --- |
| plain parser | **5.17 ms** | Lowest overhead, handwritten state machine |
| converter api | **3.62 ms** | Declarative schema with automatic dispatch plan |
| converter api compiled | **3.64 ms** | Explicit compile() with cached dispatch plan |
| converter api compiled js byte projection | **11.12 ms** | Projection-lowerable byte input through the JavaScript converter path |
| converter api compiled native byte projection | **8.99 ms** | Projection-lowerable byte input through public native projection |
| ProjectionReader native object rows | **9.98 ms** | Public stax-xml/projection fast surface returning native columnar rows |

Interpretation:

- The handwritten parser remains the raw-throughput ceiling.
- The normal converter API now auto-routes dispatch-friendly schemas onto the projection backend and caches the plan on the schema object.
- `.compile()` keeps the same output contract while making that dispatch choice explicit and reusable.
- XPath 1.0 selectors plus field transforms cover most structural branch logic; imperative stream-order control, side effects, and early-stop traversal still belong on the StAX reader surfaces.

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
| **fast-xml-parser builder** | 243.27 µs | ~4,111 ops/sec | 80.78 kb | fast-xml-parser builder |
| stax-xml writer | 328.84 µs | ~3,041 ops/sec | 267.23 kb | Writer API |
| **stax-xml writer sync** | 5.58 µs | ~179,353 ops/sec | 13.41 kb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 168.71 µs | ~5,927 ops/sec | 31.67 kb | Sync streaming sink API |
| xml2js builder | 346.84 µs | ~2,883 ops/sec | 127.16 kb | xml2js builder |

### Large Document Building (1MB)

Building large XML documents from big JSON data:

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **fast-xml-parser builder** | 25.81 ms | ~38.75 ops/sec | 26.81 mb | fast-xml-parser builder |
| **stax-xml writer sync** | 6.42 ms | ~155.76 ops/sec | 9.74 mb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 8.13 ms | ~122.97 ops/sec | 10.40 mb | Sync streaming sink API |
| stax-xml writer | 40.88 ms | ~24.46 ops/sec | 44.04 mb | Writer API |

### Async vs Sync Writer Comparison

This comparison measures the writer APIs themselves on the same generated document shape. It includes async file output, sync string output followed by file write, and the sync sink path with an in-memory file-like target.
It is intended to show `stax-xml` async vs sync overhead and sink overhead, not to imply that all paths have identical durability guarantees.

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Element Count | Async Writer | Sync Writer + File | Sync Writer + Sink | Performance Ratio |
|---------------|--------------|--------------------|--------------------|-------------------|
| 1K elements | 6.89 ms | 3.06 ms | 2.69 ms | 2.56x faster (sink) |
| 5K elements | 25.47 ms | 7.26 ms | 6.01 ms | 4.24x faster (sink) |
| 10K elements | 47.03 ms | 13.01 ms | 9.77 ms | 4.81x faster (sink) |

### 1GiB Writer Comparison

This one-shot benchmark writes a 1GiB XML document through both async writer and sync sink writer paths.
It includes in-memory targets and temp-file targets to separate writer overhead from file I/O cost.

Benchmark source: [writer-1gb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/writer-1gb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Target | Time | Throughput | Peak Heap | Peak RSS | Written | Records |
|--------|-----:|-----------:|----------:|---------:|--------:|--------:|
| Async writer + memory WritableStream | 15.13 s | 67.68 MiB/s | 103.90 mb | 227.08 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + memory sink** | 3.18 s | 321.57 MiB/s | 74.37 mb | 226.82 mb | 1.00 gb | 1,164,225 |
| Async writer + temp file | 17.12 s | 59.83 MiB/s | 62.32 mb | 228.13 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + temp file** | 3.50 s | 292.51 MiB/s | 73.53 mb | 228.01 mb | 1.00 gb | 1,164,225 |

Based on this run, `WriterSyncSink` is the recommended path for large XML file output. It provides the highest write throughput, and peak RSS stays in the same range as async writing.
