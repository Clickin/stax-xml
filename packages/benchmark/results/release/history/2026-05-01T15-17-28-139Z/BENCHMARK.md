# Benchmarks

Generated: 2026-05-01T15:17:28.139Z
Run ID: 2026-05-01T15-17-28-139Z

Environment:
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K (~4.81 GHz)
- Runtime: node 24.15.0 (x64-win32)

This report is generated from the canonical release benchmark set. The docs benchmark pages are derived from the same raw JSON results.
Historical runs are indexed at [packages/benchmark/results/release/history/README.md](packages/benchmark/results/release/history/README.md).

## Benchmark Environment

The refreshed benchmark tables on this page were rerun with:
- **CPU**: 13th Gen Intel(R) Core(TM) i5-13600K (~4.81 GHz)
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

API selection guidance:

- Prefer the converter API when the target XML-to-object shape is known.
- For whole-XML traversal with light per-event work, start with `EventReader` or `EventReaderSync`.
- For heavier unknown-schema projection or object materialization, use `ProjectionReader` and the `stax-xml/projection` helpers.

- `stax-xml EventReaderSync (native)`: public lean string event reader backed by `initStaxXml({ backend: "native" })`; no private native diagnostic entry point is imported or called directly.
- `stax-xml ProjectionReader parseXmlNodes (native)`: public unknown-schema object projection returning txml-style nodes through `stax-xml/projection`.
- `stax-xml to object`: `parseXmlNodesSync` through the JavaScript fallback, kept as the stax object-shape reference row.
- `txml`, `fast-xml-parser`, and `xml2js`: each library uses its string API-native object/DOM-style parse API.
- The 13 MiB `xml2js` row is marked as an invalid comparator: `midsize.xml` has repeated top-level elements and xml2js reports only the first top-level element shape instead of the whole document.
- The stax-xml backend/surface rows are embedded directly in each parser table so the fixture and run environment are identical to the third-party rows.

</details>

### Parser Fixture Series

The `parser-*` series is the comparable parser-library fixture set. Read these tables together, in fixture-size order, before comparing the separate EventReader stream traversal and runtime matrices.

#### Small Documents (2KB)

For typical web service responses and configuration files (complex.xml):

Benchmark source: [parser-2kb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-2kb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 9.39 µs | ~106,497 ops/sec | 1.88 kb | Lightweight object parser |
| **stax-xml to object** | 271.09 µs | ~3,689 ops/sec | 99.49 kb | Object conversion |
| **stax-xml StreamReaderSync (native)** | 280.19 µs | ~3,569 ops/sec | 34.75 kb | Public lean byte-stream reader backed by the initialized native streaming runtime |
| stax-xml EventReaderSync (native reference) | 281.22 µs | ~3,556 ops/sec | 59.01 kb | Ergonomic string event iterator retained as a reference row, not the native-wrapper gate |
| fast-xml-parser | 475.69 µs | ~2,102 ops/sec | 194.97 kb | Object parser |
| xml2js | 662.73 µs | ~1,509 ops/sec | 214.37 kb | Callback object parser |

#### Medium Documents (4KB)

For larger API responses and data files (books.xml):

Benchmark source: [parser-4kb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-4kb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 18.74 µs | ~53,363 ops/sec | 5.17 kb | Lightweight object parser |
| **stax-xml to object** | 360.07 µs | ~2,777 ops/sec | 190.17 kb | Object conversion |
| **stax-xml StreamReaderSync (native)** | 366.82 µs | ~2,726 ops/sec | 45.52 kb | Public lean byte-stream reader backed by the initialized native streaming runtime |
| stax-xml EventReaderSync (native reference) | 371.54 µs | ~2,691 ops/sec | 102.34 kb | Ergonomic string event iterator retained as a reference row, not the native-wrapper gate |
| fast-xml-parser | 674.99 µs | ~1,481 ops/sec | 838.78 kb | Object parser |
| xml2js | 930.11 µs | ~1,075 ops/sec | 586.19 kb | Callback object parser |

#### Medium-Large Documents (13MB)

Performance results on midsize.xml (13MB):

Benchmark source: [parser-13mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-13mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| xml2js | 870.09 µs | ~1,149 ops/sec | 420.80 kb | Invalid comparator: first top-level element only* |
| **stax-xml to object** | 460.33 ms | ~2.17 ops/sec | 272.69 mb | Object conversion |
| **stax-xml StreamReaderSync (native)** | 141.81 ms | ~7.05 ops/sec | 60.76 mb | Public lean byte-stream reader backed by the initialized native streaming runtime |
| stax-xml EventReaderSync (native reference) | 155.45 ms | ~6.43 ops/sec | 2.65 mb | Ergonomic string event iterator retained as a reference row, not the native-wrapper gate |
| **txml** | 119.39 ms | ~8.38 ops/sec | 117.60 mb | Lightweight object parser |
| fast-xml-parser | 739.91 ms | ~1.35 ops/sec | 174.86 mb | Object parser |

*xml2js is not a valid whole-document comparator for this fixture. `midsize.xml` contains repeated top-level `<any_name>` roots, and xml2js returns only the first top-level element shape.

#### Large Documents (98MB)

Performance results on large.xml (98MB):

Benchmark source: [parser-98mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-98mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **stax-xml to object** | 4.26 s | ~0.23 ops/sec | 2.51 gb | Memory efficient |
| **stax-xml StreamReaderSync (native)** | 881.07 ms | ~1.13 ops/sec | 83.82 mb | Public lean byte-stream reader backed by the initialized native streaming runtime |
| stax-xml EventReaderSync (native reference) | 998.49 ms | ~1 ops/sec | 92.50 mb | Ergonomic string event iterator retained as a reference row, not the native-wrapper gate |
| **txml** | 1.02 s | ~0.98 ops/sec | 859.79 mb | Object parser |
| fast-xml-parser | 5.77 s | ~0.17 ops/sec | 1.05 gb | Object parser |
| xml2js | 5.81 s | ~0.17 ops/sec | 630.97 mb | Callback object parser |

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
| **stax-xml EventReaderSync (native)** | 386.56 µs | ~2,587 ops/sec | 81.69 kb | Public lean string event reader, native runtime backend |
| **stax-xml ProjectionReader parseXmlNodes (native)** | 193.58 µs | ~5,166 ops/sec | 56.47 kb | Public unknown-schema object projection through stax-xml/projection |
| fast-xml-parser XMLParser | 777.82 µs | ~1,286 ops/sec | 875.16 kb | Object parser |
| txml parse | 19.23 µs | ~51,989 ops/sec | 5.17 kb | Lightweight object parser |
| xml2js parseString | 1.02 ms | ~979.98 ops/sec | 593.04 kb | Callback object parser |
| sax strict event parser | 891.01 µs | ~1,122 ops/sec | 495.57 kb | Strict SAX event parser |
| saxes event parser | 484.05 µs | ~2,066 ops/sec | 103.44 kb | Maintained SAX-style non-validating parser |
| htmlparser2 xmlMode parser | 669.43 µs | ~1,494 ops/sec | 443.99 kb | Fast HTML/XML event parser in xmlMode |

### EventReader File Traversal (1MiB to 1GiB)

For processing large XML files (RSS feeds, data exports, etc.):

<details>
<summary>Scenario contract: EventReader stream JS and native file traversal</summary>

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

</details>

The default release set stops at 1GiB; the 4GiB traversal is available with `release:update -- --include-stress`.

Benchmark source: [sync/async release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| File Size | Parser Type | Processing Time | Memory Usage | Throughput |
|-----------|-------------|-----------------|--------------|------------|
| 1MiB temp file | **EventReader stream native** | 565.70 ms | 53.77 mb | 1.77 MiB/s |
| 10MiB temp file | **EventReader stream native** | 527.99 ms | 53.18 mb | 18.94 MiB/s |
| 100MiB temp file | **EventReader stream native** | 4.83 s | 53.50 mb | 20.69 MiB/s |
| 1GiB temp file | **EventReader stream native** | 43.65 s | 201.70 mb | 23.46 MiB/s |

**Key Insights:**
- This section is the public stream reader throughput view, not a full-object materialization benchmark.
- The JS and native rows share the same `EventReader` stream API; the difference is the initialized runtime backend.
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
| node | 24.15.0 | public-sync-full-string | 66.7 MiB/s | 239.79 ms | -746772258 |
| node | 24.15.0 | event-count-only | 73.1 MiB/s | 218.80 ms | 2078515073 |
| node | 24.15.0 | event-full-string | 63.3 MiB/s | 252.83 ms | 1007437756 |
| bun | 1.3.13 | public-sync-full-string | 96.8 MiB/s | 165.31 ms | -746772258 |
| bun | 1.3.13 | event-count-only | 107.2 MiB/s | 149.21 ms | 2078515073 |
| bun | 1.3.13 | event-full-string | 63.5 MiB/s | 251.80 ms | 1007437756 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 65.8 MiB/s | 243.24 ms | -746772258 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | event-count-only | 77.9 MiB/s | 205.48 ms | 2078515073 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | event-full-string | 67.7 MiB/s | 236.17 ms | 1007437756 |

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
| stax-xml JS on Node | 70.6 MiB/s | 226.70 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 113.7 MiB/s | 140.75 ms | 1.61x | ok |
| Woodstox on Java 8 | 342.7 MiB/s | 46.68 ms | 4.86x | ok |
| quick-xml | 302.6 MiB/s | 52.87 ms | 4.29x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 62.6 MiB/s | 255.66 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 98.6 MiB/s | 162.34 ms | 1.57x | ok |
| Woodstox on Java 8 | 311.5 MiB/s | 51.37 ms | 4.98x | ok |
| quick-xml | 254.8 MiB/s | 62.79 ms | 4.07x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 54.9 MiB/s | 291.32 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 41.3 MiB/s | 387.77 ms | 0.75x | ok |
| Woodstox on Java 8 | 337.4 MiB/s | 47.42 ms | 6.14x | ok |
| quick-xml | 287.7 MiB/s | 55.60 ms | 5.24x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 61.6 MiB/s | 259.93 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 46.8 MiB/s | 341.91 ms | 0.76x | ok |
| Woodstox on Java 8 | 302.6 MiB/s | 52.88 ms | 4.92x | ok |
| quick-xml | 290.7 MiB/s | 55.04 ms | 4.72x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 63.2 MiB/s | 253.00 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 31.8 MiB/s | 502.81 ms | 0.50x | ok |
| Woodstox on Java 8 | 254.5 MiB/s | 62.86 ms | 4.02x | ok |
| quick-xml | 234.7 MiB/s | 68.18 ms | 3.71x | ok |

### Woodstox Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Status |
| --- | ---: | ---: | ---: | --- |
| count-only | 342.7 MiB/s | 302.2 MiB/s | -11.8% | ok |
| name-string-only | 311.5 MiB/s | 285.4 MiB/s | -8.4% | ok |
| text-string-only | 337.4 MiB/s | 287.4 MiB/s | -14.8% | ok |
| attr-value-string-only | 302.6 MiB/s | 237.1 MiB/s | -21.6% | ok |
| full-string | 254.5 MiB/s | 230.0 MiB/s | -9.6% | ok |

### Why Native Runtime Acceleration Is The Performance Path

The JavaScript parser remains the compatibility fallback, but it is not the release performance ceiling. Prior pure-JS optimization work improved the internal event-frame backend, yet full-string workloads still stayed behind native parser baselines, especially `quick-xml`. The remaining costs are delimiter scanning, string materialization, and stable object/API shapes around attributes and text.

The Rust native path is intended to move the hot tokenizer and string/span aggregation work into code that can use native and SIMD-oriented scanning strategies, closer in direction to native parsers such as `quick-xml` and simdjson-style designs. Published benchmark rows now measure that path through public reader surfaces rather than direct native diagnostic entry points. The package topology keeps `stax-xml` as the facade while adding optional native/Wasm acceleration packages; environments that cannot load binaries continue to use the JavaScript fallback.


## Converter API vs Plain Parser

The benchmark below compares three ways to build the **same object output**:

- A handwritten plain parser built directly on `EventReaderSync`
- The declarative converter API with automatic dispatch-plan routing
- The converter API with `.compile()` enabled

Recommendation: when this kind of target object shape is known, prefer the converter API over ad-hoc event parsing. Keep `EventReaderSync` for light whole-XML traversal and use `ProjectionReader` for heavier unknown-schema materialization.

Current fixture:

- `catalog` document
- `800` `<featured>` elements
- `800` `<book>` elements
- result includes root object fields, root arrays, direct scalar fields, and transformed derived fields

Benchmark source: [converter-plain-output-benchmark.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/converter-plain-output-benchmark.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Implementation | Average time | Notes |
| --- | ---: | --- |
| plain parser | **2.66 ms** | Lowest overhead, handwritten state machine |
| converter api | **3.71 ms** | Declarative schema with automatic dispatch plan |
| converter api compiled | **3.86 ms** | Explicit compile() with cached dispatch plan |
| converter api compiled js byte projection | **11.06 ms** | Projection-lowerable byte input through the JavaScript converter path |
| converter api compiled native byte projection | **7.92 ms** | Projection-lowerable byte input through public native projection |
| ProjectionReader native object rows | **9.08 ms** | Public stax-xml/projection fast surface returning native columnar rows |

Interpretation:

- The handwritten parser remains the raw-throughput ceiling.
- The normal converter API now auto-routes dispatch-friendly schemas onto the projection backend and caches the plan on the schema object.
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
| **fast-xml-parser builder** | 268.70 µs | ~3,722 ops/sec | 80.82 kb | fast-xml-parser builder |
| stax-xml writer | 331.04 µs | ~3,021 ops/sec | 265.90 kb | Writer API |
| **stax-xml writer sync** | 5.89 µs | ~169,734 ops/sec | 13.42 kb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 163.04 µs | ~6,134 ops/sec | 32.44 kb | Sync streaming sink API |
| xml2js builder | 387.67 µs | ~2,579 ops/sec | 128.08 kb | xml2js builder |

### Large Document Building (1MB)

Building large XML documents from big JSON data:

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **fast-xml-parser builder** | 26.21 ms | ~38.15 ops/sec | 26.60 mb | fast-xml-parser builder |
| **stax-xml writer sync** | 7.15 ms | ~139.94 ops/sec | 9.69 mb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 11.32 ms | ~88.35 ops/sec | 10.37 mb | Sync streaming sink API |
| stax-xml writer | 47.35 ms | ~21.12 ops/sec | 44.09 mb | Writer API |

### Async vs Sync Writer Comparison

This comparison measures the writer APIs themselves on the same generated document shape. It includes async file output, sync string output followed by file write, and the sync sink path with an in-memory file-like target.
It is intended to show `stax-xml` async vs sync overhead and sink overhead, not to imply that all paths have identical durability guarantees.

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Element Count | Async Writer | Sync Writer + File | Sync Writer + Sink | Performance Ratio |
|---------------|--------------|--------------------|--------------------|-------------------|
| 1K elements | 8.46 ms | 3.57 ms | 2.74 ms | 3.08x faster (sink) |
| 5K elements | 31.22 ms | 8.66 ms | 6.43 ms | 4.85x faster (sink) |
| 10K elements | 53.11 ms | 14.02 ms | 10.26 ms | 5.18x faster (sink) |

### 1GiB Writer Comparison

This one-shot benchmark writes a 1GiB XML document through both async writer and sync sink writer paths.
It includes in-memory targets and temp-file targets to separate writer overhead from file I/O cost.

Benchmark source: [writer-1gb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/writer-1gb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Target | Time | Throughput | Peak Heap | Peak RSS | Written | Records |
|--------|-----:|-----------:|----------:|---------:|--------:|--------:|
| Async writer + memory WritableStream | 16.02 s | 63.93 MiB/s | 90.94 mb | 215.84 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + memory sink** | 3.43 s | 298.12 MiB/s | 74.39 mb | 215.75 mb | 1.00 gb | 1,164,225 |
| Async writer + temp file | 17.34 s | 59.04 MiB/s | 62.30 mb | 217.09 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + temp file** | 3.51 s | 291.65 MiB/s | 73.48 mb | 216.73 mb | 1.00 gb | 1,164,225 |

Based on this run, `WriterSyncSink` is the recommended path for large XML file output. It provides the highest write throughput, and peak RSS stays in the same range as async writing.
