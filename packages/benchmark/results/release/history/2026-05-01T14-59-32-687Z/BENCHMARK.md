# Benchmarks

Generated: 2026-05-01T14:59:32.687Z
Run ID: 2026-05-01T14-59-32-687Z

Environment:
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K (~4.70 GHz)
- Runtime: node 24.15.0 (x64-win32)

This report is generated from the canonical release benchmark set. The docs benchmark pages are derived from the same raw JSON results.
Historical runs are indexed at [packages/benchmark/results/release/history/README.md](packages/benchmark/results/release/history/README.md).

## Benchmark Environment

The refreshed benchmark tables on this page were rerun with:
- **CPU**: 13th Gen Intel(R) Core(TM) i5-13600K (~4.70 GHz)
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

- `stax-xml JS fallback event parser`: lean `EventReaderSync` event loop with a checksum over event type, names, text, and attributes. The XML string is prepared outside the timed region, matching string-only library API-native rows.
- `stax-xml JS fallback event parser (decode+parse)`: byte-source application path that pays `Buffer.toString("utf8")` inside the timed region before running lean `EventReaderSync`.
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
| **txml** | 12.24 µs | ~81,700 ops/sec | 1.88 kb | Lightweight object parser |
| **stax-xml to object** | 412.91 µs | ~2,422 ops/sec | 106.83 kb | Object conversion |
| stax-xml EventReaderSync (JS reference) | 482.30 µs | ~2,073 ops/sec | 71.31 kb | Internal JavaScript reference reader; not a public Node performance fallback |
| stax-xml EventReaderSync (JS reference decode+parse) | 460.23 µs | ~2,173 ops/sec | 72.58 kb | Reference byte-source path: Buffer.toString plus lean string event reader |
| **stax-xml StreamReaderSync (native)** | 459.56 µs | ~2,176 ops/sec | 33.62 kb | Public lean byte-stream reader backed by the initialized native streaming runtime |
| stax-xml EventReaderSync (native reference) | 393.95 µs | ~2,538 ops/sec | 59.16 kb | Ergonomic string event iterator retained as a reference row, not the native-wrapper gate |
| fast-xml-parser | 719.13 µs | ~1,391 ops/sec | 195.70 kb | Object parser |
| xml2js | 846.43 µs | ~1,181 ops/sec | 212.24 kb | Callback object parser |

#### Medium Documents (4KB)

For larger API responses and data files (books.xml):

Benchmark source: [parser-4kb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-4kb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 119.41 µs | ~8,375 ops/sec | 106.39 kb | Lightweight object parser |
| **stax-xml to object** | 572.36 µs | ~1,747 ops/sec | 196.02 kb | Object conversion |
| stax-xml EventReaderSync (JS reference) | 628.78 µs | ~1,590 ops/sec | 101.28 kb | Internal JavaScript reference reader; not a public Node performance fallback |
| stax-xml EventReaderSync (JS reference decode+parse) | 612.29 µs | ~1,633 ops/sec | 104.64 kb | Reference byte-source path: Buffer.toString plus lean string event reader |
| **stax-xml StreamReaderSync (native)** | 545.46 µs | ~1,833 ops/sec | 48.72 kb | Public lean byte-stream reader backed by the initialized native streaming runtime |
| stax-xml EventReaderSync (native reference) | 527.08 µs | ~1,897 ops/sec | 100.78 kb | Ergonomic string event iterator retained as a reference row, not the native-wrapper gate |
| fast-xml-parser | 837.58 µs | ~1,194 ops/sec | 866.53 kb | Object parser |
| xml2js | 1.15 ms | ~871.62 ops/sec | 594.40 kb | Callback object parser |

#### Medium-Large Documents (13MB)

Performance results on midsize.xml (13MB):

Benchmark source: [parser-13mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-13mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| xml2js | 633.80 µs | ~1,578 ops/sec | 457.78 kb | Invalid comparator: first top-level element only* |
| **stax-xml to object** | 544.26 ms | ~1.84 ops/sec | 261.02 mb | Object conversion |
| stax-xml EventReaderSync (JS reference) | 174.06 ms | ~5.75 ops/sec | 23.02 mb | Internal JavaScript reference reader; not a public Node performance fallback |
| stax-xml EventReaderSync (JS reference decode+parse) | 181.98 ms | ~5.5 ops/sec | 22.80 mb | Reference byte-source path: Buffer.toString plus lean string event reader |
| **stax-xml StreamReaderSync (native)** | 125.10 ms | ~7.99 ops/sec | 60.76 mb | Public lean byte-stream reader backed by the initialized native streaming runtime |
| stax-xml EventReaderSync (native reference) | 158.94 ms | ~6.29 ops/sec | 2.33 mb | Ergonomic string event iterator retained as a reference row, not the native-wrapper gate |
| **txml** | 114.59 ms | ~8.73 ops/sec | 117.60 mb | Lightweight object parser |
| fast-xml-parser | 789.94 ms | ~1.27 ops/sec | 154.59 mb | Object parser |

*xml2js is not a valid whole-document comparator for this fixture. `midsize.xml` contains repeated top-level `<any_name>` roots, and xml2js returns only the first top-level element shape.

#### Large Documents (98MB)

Performance results on large.xml (98MB):

Benchmark source: [parser-98mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-98mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **stax-xml to object** | 4.24 s | ~0.24 ops/sec | 2.51 gb | Memory efficient |
| stax-xml EventReaderSync (JS reference) | 1.14 s | ~0.87 ops/sec | 57.46 mb | Internal JavaScript reference reader; not a public Node performance fallback |
| stax-xml EventReaderSync (JS reference decode+parse) | 1.14 s | ~0.87 ops/sec | 62.17 mb | Reference byte-source path: Buffer.toString plus lean string event reader |
| **stax-xml StreamReaderSync (native)** | 839.34 ms | ~1.19 ops/sec | 84.02 mb | Public lean byte-stream reader backed by the initialized native streaming runtime |
| stax-xml EventReaderSync (native reference) | 978.94 ms | ~1.02 ops/sec | 91.57 mb | Ergonomic string event iterator retained as a reference row, not the native-wrapper gate |
| **txml** | 977.01 ms | ~1.02 ops/sec | 859.76 mb | Object parser |
| fast-xml-parser | 5.58 s | ~0.18 ops/sec | 1.06 gb | Object parser |
| xml2js | 5.78 s | ~0.17 ops/sec | 632.02 mb | Callback object parser |

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
| stax-xml EventReaderSync (JS) | 452.63 µs | ~2,209 ops/sec | 82.41 kb | Public lean string event reader, JS backend |
| **stax-xml EventReaderSync (native)** | 417.63 µs | ~2,394 ops/sec | 83.94 kb | Public lean string event reader, native runtime backend |
| **stax-xml ProjectionReader parseXmlNodes (native)** | 179.52 µs | ~5,570 ops/sec | 55.46 kb | Public unknown-schema object projection through stax-xml/projection |
| fast-xml-parser XMLParser | 934.34 µs | ~1,070 ops/sec | 833.67 kb | Object parser |
| txml parse | 18.81 µs | ~53,172 ops/sec | 5.17 kb | Lightweight object parser |
| xml2js parseString | 1.12 ms | ~892.6 ops/sec | 605.27 kb | Callback object parser |
| sax strict event parser | 780.92 µs | ~1,281 ops/sec | 512.41 kb | Strict SAX event parser |
| saxes event parser | 625.70 µs | ~1,598 ops/sec | 160.24 kb | Maintained SAX-style non-validating parser |
| htmlparser2 xmlMode parser | 653.20 µs | ~1,531 ops/sec | 493.35 kb | Fast HTML/XML event parser in xmlMode |

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
- `EventReader stream JS fallback` initializes the package with the JavaScript backend before measuring the stream reader.
- `EventReader stream native` initializes the package with the native backend before measuring the same stream reader API.
- XML tokenization is CPU-intensive. Async file reads do not make the parse loop non-blocking; if this work would run on a latency-sensitive main event loop thread, offload parsing to a Worker or worker thread.
- These rows intentionally use a structural checksum rather than building a full object tree so the table measures stream tokenization and event materialization.

</details>

The default release set stops at 1GiB; the 4GiB traversal is available with `release:update -- --include-stress`.

Benchmark source: [sync/async release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| File Size | Parser Type | Processing Time | Memory Usage | Performance Ratio |
|-----------|-------------|-----------------|--------------|-------------------|
| 1MiB temp file | **EventReader stream JS fallback** | 449.68 ms | 21.10 mb | Baseline, 2.22 MiB/s |
| 1MiB temp file | EventReader stream native | 50.19 ms | 52.13 mb | 8.96x faster, 19.92 MiB/s |
| 10MiB temp file | **EventReader stream JS fallback** | 440.73 ms | 104.67 mb | Baseline, 22.69 MiB/s |
| 10MiB temp file | EventReader stream native | 409.84 ms | 76.55 mb | 1.08x faster, 24.40 MiB/s |
| 100MiB temp file | **EventReader stream JS fallback** | 4.21 s | 116.20 mb | Baseline, 23.76 MiB/s |
| 100MiB temp file | EventReader stream native | 4.22 s | 125.85 mb | 1.00x slower, 23.70 MiB/s |
| 1GiB temp file | **EventReader stream JS fallback** | 42.25 s | 189.68 mb | Baseline, 24.24 MiB/s |
| 1GiB temp file | EventReader stream native | 43.85 s | 170.30 mb | 1.04x slower, 23.35 MiB/s |

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
| node | 24.15.0 | public-sync-full-string | 67.5 MiB/s | 237.14 ms | -746772258 |
| node | 24.15.0 | event-count-only | 76.0 MiB/s | 210.60 ms | 2078515073 |
| node | 24.15.0 | event-full-string | 62.7 MiB/s | 255.38 ms | 1007437756 |
| bun | 1.3.13 | public-sync-full-string | 96.8 MiB/s | 165.30 ms | -746772258 |
| bun | 1.3.13 | event-count-only | 109.5 MiB/s | 146.05 ms | 2078515073 |
| bun | 1.3.13 | event-full-string | 62.3 MiB/s | 256.99 ms | 1007437756 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 65.2 MiB/s | 245.42 ms | -746772258 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | event-count-only | 76.6 MiB/s | 208.91 ms | 2078515073 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | event-full-string | 62.7 MiB/s | 255.35 ms | 1007437756 |

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
| stax-xml JS on Node | 69.8 MiB/s | 229.26 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 114.9 MiB/s | 139.31 ms | 1.65x | ok |
| Woodstox on Java 8 | 339.9 MiB/s | 47.07 ms | 4.87x | ok |
| quick-xml | 305.7 MiB/s | 52.34 ms | 4.38x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 60.8 MiB/s | 262.98 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 98.5 MiB/s | 162.37 ms | 1.62x | ok |
| Woodstox on Java 8 | 330.3 MiB/s | 48.44 ms | 5.43x | ok |
| quick-xml | 267.3 MiB/s | 59.86 ms | 4.39x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 55.0 MiB/s | 290.88 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 41.9 MiB/s | 382.25 ms | 0.76x | ok |
| Woodstox on Java 8 | 320.8 MiB/s | 49.88 ms | 5.83x | ok |
| quick-xml | 286.4 MiB/s | 55.86 ms | 5.21x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 61.7 MiB/s | 259.26 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 46.7 MiB/s | 342.91 ms | 0.76x | ok |
| Woodstox on Java 8 | 305.9 MiB/s | 52.31 ms | 4.96x | ok |
| quick-xml | 280.8 MiB/s | 56.98 ms | 4.55x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 59.3 MiB/s | 269.97 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 32.0 MiB/s | 500.59 ms | 0.54x | ok |
| Woodstox on Java 8 | 259.4 MiB/s | 61.67 ms | 4.38x | ok |
| quick-xml | 237.0 MiB/s | 67.50 ms | 4.00x | ok |

### Woodstox Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Status |
| --- | ---: | ---: | ---: | --- |
| count-only | 339.9 MiB/s | 306.7 MiB/s | -9.8% | ok |
| name-string-only | 330.3 MiB/s | 281.2 MiB/s | -14.9% | ok |
| text-string-only | 320.8 MiB/s | 283.8 MiB/s | -11.5% | ok |
| attr-value-string-only | 305.9 MiB/s | 270.1 MiB/s | -11.7% | ok |
| full-string | 259.4 MiB/s | 232.4 MiB/s | -10.4% | ok |

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
| plain parser | **2.56 ms** | Lowest overhead, handwritten state machine |
| converter api | **3.92 ms** | Declarative schema with automatic dispatch plan |
| converter api compiled | **4.25 ms** | Explicit compile() with cached dispatch plan |
| converter api compiled js byte projection | **11.41 ms** | Projection-lowerable byte input through the JavaScript converter path |
| converter api compiled native byte projection | **8.00 ms** | Projection-lowerable byte input through public native projection |
| ProjectionReader native object rows | **8.99 ms** | Public stax-xml/projection fast surface returning native columnar rows |

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
| **fast-xml-parser builder** | 343.98 µs | ~2,907 ops/sec | 81.20 kb | fast-xml-parser builder |
| stax-xml writer | 399.30 µs | ~2,504 ops/sec | 267.53 kb | Writer API |
| **stax-xml writer sync** | 143.50 µs | ~6,969 ops/sec | 20.71 kb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 193.02 µs | ~5,181 ops/sec | 23.41 kb | Sync streaming sink API |
| xml2js builder | 460.41 µs | ~2,172 ops/sec | 129.75 kb | xml2js builder |

### Large Document Building (1MB)

Building large XML documents from big JSON data:

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **fast-xml-parser builder** | 25.68 ms | ~38.95 ops/sec | 27.09 mb | fast-xml-parser builder |
| **stax-xml writer sync** | 6.70 ms | ~149.2 ops/sec | 9.73 mb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 8.26 ms | ~121.03 ops/sec | 10.51 mb | Sync streaming sink API |
| stax-xml writer | 42.84 ms | ~23.34 ops/sec | 44.09 mb | Writer API |

### Async vs Sync Writer Comparison

This comparison measures the writer APIs themselves on the same generated document shape. It includes async file output, sync string output followed by file write, and the sync sink path with an in-memory file-like target.
It is intended to show `stax-xml` async vs sync overhead and sink overhead, not to imply that all paths have identical durability guarantees.

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Element Count | Async Writer | Sync Writer + File | Sync Writer + Sink | Performance Ratio |
|---------------|--------------|--------------------|--------------------|-------------------|
| 1K elements | 7.45 ms | 3.26 ms | 2.50 ms | 2.98x faster (sink) |
| 5K elements | 26.30 ms | 7.49 ms | 6.29 ms | 4.18x faster (sink) |
| 10K elements | 51.44 ms | 14.01 ms | 10.69 ms | 4.81x faster (sink) |

### 1GiB Writer Comparison

This one-shot benchmark writes a 1GiB XML document through both async writer and sync sink writer paths.
It includes in-memory targets and temp-file targets to separate writer overhead from file I/O cost.

Benchmark source: [writer-1gb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/writer-1gb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Target | Time | Throughput | Peak Heap | Peak RSS | Written | Records |
|--------|-----:|-----------:|----------:|---------:|--------:|--------:|
| Async writer + memory WritableStream | 15.75 s | 65.04 MiB/s | 106.60 mb | 227.45 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + memory sink** | 3.18 s | 321.78 MiB/s | 74.39 mb | 227.38 mb | 1.00 gb | 1,164,225 |
| Async writer + temp file | 17.71 s | 57.83 MiB/s | 62.33 mb | 228.20 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + temp file** | 3.40 s | 301.08 MiB/s | 73.48 mb | 228.07 mb | 1.00 gb | 1,164,225 |

Based on this run, `WriterSyncSink` is the recommended path for large XML file output. It provides the highest write throughput, and peak RSS stays in the same range as async writing.
