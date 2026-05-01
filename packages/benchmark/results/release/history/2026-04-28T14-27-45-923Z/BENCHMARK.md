# Benchmarks

Generated: 2026-04-28T14:27:45.923Z
Run ID: 2026-04-28T14-27-45-923Z

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
- **Canonical Set**: parser 2KB / 4KB / 13MB / 98MB with stax-xml backend/surface rows, a separate maintained Node npm XML parser comparison, iterable sync/async size comparison from 1MiB to 4GiB, writer small / big / async, converter parity

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

- `stax-xml JS fallback event parser`: `EventReaderSync` event loop with a checksum over event type, names, text, and attributes. The XML string is prepared outside the timed region, matching string-only library API-native rows.
- `stax-xml JS fallback event parser (decode+parse)`: byte-source application path that pays `Buffer.toString("utf8")` inside the timed region before running `EventReaderSync`.
- `stax-xml JS Uint8Array iterable`: `IterableReader` byte-frame loop over a reusable `Iterable<Uint8Array[]>` with the same checksum contract.
- `stax-xml native NodeIterableReader`: public `stax-xml/iterable/node` reader loop backed by `initStaxXml({ backend: "native" })`; no private native diagnostic entry point is imported or called directly.
- `stax-xml to object`: `EventReaderSync` plus a local projection into the benchmark object shape.
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
| **txml** | 62.14 µs | ~16,092 ops/sec | 27.81 kb | Lightweight object parser |
| **stax-xml to object** | 274.40 µs | ~3,644 ops/sec | 76.67 kb | Object conversion |
| stax-xml JS event parser | 316.35 µs | ~3,161 ops/sec | 88.72 kb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 298.70 µs | ~3,348 ops/sec | 85.42 kb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 231.09 µs | ~4,327 ops/sec | 35.69 kb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native NodeIterableReader** | 163.67 µs | ~6,110 ops/sec | 24.35 kb | Public stax-xml/iterable/node reader surface with native runtime backend |
| fast-xml-parser | 438.37 µs | ~2,281 ops/sec | 195.80 kb | Object parser |
| xml2js | 577.90 µs | ~1,730 ops/sec | 214.43 kb | Callback object parser |

#### Medium Documents (4KB)

For larger API responses and data files (books.xml):

Benchmark source: [parser-4kb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-4kb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 18.95 µs | ~52,774 ops/sec | 5.23 kb | Lightweight object parser |
| **stax-xml to object** | 381.82 µs | ~2,619 ops/sec | 112.08 kb | Object conversion |
| stax-xml JS event parser | 420.09 µs | ~2,380 ops/sec | 144.02 kb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 416.25 µs | ~2,402 ops/sec | 147.55 kb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 287.28 µs | ~3,481 ops/sec | 37.32 kb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native NodeIterableReader** | 209.36 µs | ~4,776 ops/sec | 28.00 kb | Public stax-xml/iterable/node reader surface with native runtime backend |
| fast-xml-parser | 666.26 µs | ~1,501 ops/sec | 870.97 kb | Object parser |
| xml2js | 899.52 µs | ~1,112 ops/sec | 600.78 kb | Callback object parser |

### Node npm XML Parsers

This separate section compares maintained public npm XML parser packages on one representative Node fixture. It is intentionally not mixed into the parser fixture series above because event parsers, object parsers, and the stax public reader surfaces have different output shapes.

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
- stax-xml rows are included only as local reference rows and use public `EventReaderSync` or `IterableReader` surfaces. The native row initializes `stax-xml` with the native backend, then measures only `IterableReader`.

</details>

Benchmark source: [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs), [books fixture](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/test-data/books.xml).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| stax-xml EventReaderSync (JS) | 471.12 µs | ~2,123 ops/sec | 121.39 kb | Public string event reader, JS backend |
| stax-xml IterableReader (JS) | 306.89 µs | ~3,258 ops/sec | 36.19 kb | Public byte iterable reader, JS backend |
| **stax-xml NodeIterableReader (native)** | 251.80 µs | ~3,971 ops/sec | 25.36 kb | Public stax-xml/iterable/node reader, native runtime backend |
| fast-xml-parser XMLParser | 694.35 µs | ~1,440 ops/sec | 785.55 kb | Object parser |
| txml parse | 18.18 µs | ~54,999 ops/sec | 5.18 kb | Lightweight object parser |
| xml2js parseString | 905.22 µs | ~1,105 ops/sec | 646.36 kb | Callback object parser |
| sax strict event parser | 673.72 µs | ~1,484 ops/sec | 541.29 kb | Strict SAX event parser |
| saxes event parser | 587.50 µs | ~1,702 ops/sec | 155.31 kb | Maintained SAX-style non-validating parser |
| htmlparser2 xmlMode parser | 547.12 µs | ~1,828 ops/sec | 451.70 kb | Fast HTML/XML event parser in xmlMode |

#### Medium-Large Documents (13MB)

Performance results on midsize.xml (13MB):

Benchmark source: [parser-13mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-13mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| xml2js | 535.59 µs | ~1,867 ops/sec | 452.28 kb | Invalid comparator: first top-level element only* |
| **stax-xml to object** | 252.67 ms | ~3.96 ops/sec | 180.04 mb | Object conversion |
| stax-xml JS event parser | 310.17 ms | ~3.22 ops/sec | 179.65 mb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 300.85 ms | ~3.32 ops/sec | 180.04 mb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 106.62 ms | ~9.38 ops/sec | 26.36 mb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native NodeIterableReader** | 80.12 ms | ~12.48 ops/sec | 19.42 mb | Public stax-xml/iterable/node reader surface with native runtime backend |
| **txml** | 127.03 ms | ~7.87 ops/sec | 117.60 mb | Lightweight object parser |
| fast-xml-parser | 704.76 ms | ~1.42 ops/sec | 167.97 mb | Object parser |

*xml2js is not a valid whole-document comparator for this fixture. `midsize.xml` contains repeated top-level `<any_name>` roots, and xml2js returns only the first top-level element shape.

#### Large Documents (98MB)

Performance results on large.xml (98MB):

Benchmark source: [parser-98mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-98mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **stax-xml to object** | 2.15 s | ~0.46 ops/sec | 1.07 gb | Memory efficient |
| stax-xml JS event parser | 2.24 s | ~0.45 ops/sec | 1.11 gb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 2.24 s | ~0.45 ops/sec | 1.11 gb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 697.75 ms | ~1.43 ops/sec | 18.41 mb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native NodeIterableReader** | 502.38 ms | ~1.99 ops/sec | 16.62 mb | Public stax-xml/iterable/node reader surface with native runtime backend |
| **txml** | 983.77 ms | ~1.02 ops/sec | 859.81 mb | Object parser |
| fast-xml-parser | 5.57 s | ~0.18 ops/sec | 1.06 gb | Object parser |
| xml2js | 5.63 s | ~0.18 ops/sec | 631.89 mb | Callback object parser |

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
| 1MiB temp file | **sync Iterable parser** | 10.94 ms | 11.69 mb | Baseline, 91.37 MiB/s |
| 1MiB temp file | async Iterable parser | 107.09 ms | 11.62 mb | 9.79x slower, 9.34 MiB/s |
| 10MiB temp file | **sync Iterable parser** | 65.97 ms | 27.32 mb | Baseline, 151.59 MiB/s |
| 10MiB temp file | async Iterable parser | 67.29 ms | 27.42 mb | 1.02x slower, 148.61 MiB/s |
| 100MiB temp file | **sync Iterable parser** | 612.02 ms | 36.83 mb | Baseline, 163.39 MiB/s |
| 100MiB temp file | async Iterable parser | 706.46 ms | 31.23 mb | 1.15x slower, 141.55 MiB/s |
| 1GiB temp file | **sync Iterable parser** | 6.37 s | 24.85 mb | Baseline, 160.65 MiB/s |
| 1GiB temp file | async Iterable parser | 6.66 s | 37.90 mb | 1.04x slower, 153.85 MiB/s |
| 4GiB temp file | **sync Iterable parser** | 26.44 s | 39.62 mb | Baseline, 154.91 MiB/s |
| 4GiB temp file | async Iterable parser | 27.04 s | 37.95 mb | 1.02x slower, 151.50 MiB/s |

**Key Insights:**
- This section is the iterable backend throughput view, not a public string parser vs stream parser API comparison.
- The sync and async rows share the same tokenization/event-frame path; the difference is synchronous file reads versus awaited file batches.
- Async iterable parsing can still block the main event loop while each CPU parse batch runs; use a Worker or worker thread when visible latency matters.
- For files above 100MiB, avoid the public full-string sync path when retaining the full XML string is not acceptable; use async streams for non-blocking API ergonomics or the synchronous iterable byte-batch backend for blocking batch jobs.

## Runtime Matrix And Native Direction

The same built JavaScript implementation was measured on Node, Bun, and Deno with a generated single-root 16.00 MiB XML fixture. This is a runtime-codegen and compatibility check; native runtime comparison is reported separately through public IterableReader rows.

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
- `public-sync-full-string` uses `EventReaderSync` over one string.
- `iterable-count-only` and `iterable-full-string` use the browser-compatible synchronous iterable byte-batch backend; they are not async parser rows.
- This matrix intentionally excludes native runtime rows.

</details>

Benchmark source: [runtime-matrix.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/runtime-matrix.mjs).

| Runtime | Version | Scenario | Throughput | Average | Checksum |
| --- | --- | --- | ---: | ---: | ---: |
| node | 24.15.0 | public-sync-full-string | 37.9 MiB/s | 422.51 ms | -746772258 |
| node | 24.15.0 | iterable-count-only | 201.2 MiB/s | 79.52 ms | 2078515073 |
| node | 24.15.0 | iterable-full-string | 115.1 MiB/s | 138.97 ms | 1007437756 |
| bun | 1.3.13 | public-sync-full-string | 68.5 MiB/s | 233.61 ms | -746772258 |
| bun | 1.3.13 | iterable-count-only | 249.1 MiB/s | 64.23 ms | 2078515073 |
| bun | 1.3.13 | iterable-full-string | 152.3 MiB/s | 105.08 ms | 1007437756 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 33.7 MiB/s | 474.93 ms | -746772258 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-count-only | 200.9 MiB/s | 79.64 ms | 2078515073 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-full-string | 120.3 MiB/s | 132.96 ms | 1007437756 |

The non-JS comparator uses the same event-count and checksum contract. It reports stax-xml JS on Node, stax-xml native runtime through the public `IterableReader`, Woodstox on Java 8, and quick-xml. Woodstox is reported on Java 8 for the public baseline because Java 8 is its minimum supported runtime target; Java 25 is measured only as a verification check.

<details>
<summary>Scenario contract: stax-xml JS/native NodeIterableReader, Woodstox, and quick-xml comparator</summary>

The comparator uses the same generated 16.00 MiB XML fixture shape as the runtime matrix.

Output shape:

~~~text
comparator-result = {
  tier: "count-only" | "name-string-only" | "attr-value-string-only" | "text-string-only" | "full-string",
  implementation: "stax-xml-js-node" | "stax-xml-native-node-iterable-reader" | "woodstox-java8" | "quick-xml",
  eventCount: number,
  checksum: fold(selected event data for tier)
}
~~~

Parsing methods:

- `stax-xml JS on Node`: built JavaScript iterable backend, run on Node, with tier-specific checksum folding.
- `stax-xml native NodeIterableReader`: initializes `stax-xml` with `initStaxXml({ backend: "native" })`, then measures the public `stax-xml/iterable/node` reader surface over in-memory bytes.
- Woodstox: Java StAX `XMLStreamReader`, namespace-aware parsing disabled, coalescing enabled, DTD/external entities disabled, buffered file input.
- `quick-xml`: Rust `Reader` over buffered file input; declaration, PI, doctype, and comments are skipped; text is trimmed for checksum parity.
- Java 8 is the public Woodstox row because it is Woodstox's minimum runtime target; Java 25 is a separate verification row.

</details>

Benchmark source: [cross-runtime-comparison.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/cross-runtime-comparison.mjs).

### count-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 171.0 MiB/s | 93.56 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 275.1 MiB/s | 58.17 ms | 1.61x | ok |
| Woodstox on Java 8 | 346.9 MiB/s | 46.12 ms | 2.03x | ok |
| quick-xml | 303.6 MiB/s | 52.70 ms | 1.78x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 143.4 MiB/s | 111.59 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 247.0 MiB/s | 64.77 ms | 1.72x | ok |
| Woodstox on Java 8 | 340.7 MiB/s | 46.97 ms | 2.38x | ok |
| quick-xml | 268.0 MiB/s | 59.70 ms | 1.87x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 111.2 MiB/s | 143.86 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 191.7 MiB/s | 83.45 ms | 1.72x | ok |
| Woodstox on Java 8 | 321.6 MiB/s | 49.75 ms | 2.89x | ok |
| quick-xml | 280.3 MiB/s | 57.07 ms | 2.52x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 128.2 MiB/s | 124.85 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 200.5 MiB/s | 79.80 ms | 1.56x | ok |
| Woodstox on Java 8 | 312.2 MiB/s | 51.24 ms | 2.44x | ok |
| quick-xml | 301.1 MiB/s | 53.14 ms | 2.35x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 102.9 MiB/s | 155.47 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 116.7 MiB/s | 137.14 ms | 1.13x | ok |
| Woodstox on Java 8 | 265.7 MiB/s | 60.21 ms | 2.58x | ok |
| quick-xml | 238.6 MiB/s | 67.06 ms | 2.32x | ok |

### Woodstox Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Status |
| --- | ---: | ---: | ---: | --- |
| count-only | 346.9 MiB/s | 314.5 MiB/s | -9.4% | ok |
| name-string-only | 340.7 MiB/s | 285.3 MiB/s | -16.3% | ok |
| text-string-only | 321.6 MiB/s | 292.9 MiB/s | -8.9% | ok |
| attr-value-string-only | 312.2 MiB/s | 267.8 MiB/s | -14.2% | ok |
| full-string | 265.7 MiB/s | 231.0 MiB/s | -13.1% | ok |

### Why Native Runtime Acceleration Is The Performance Path

The JavaScript parser remains the compatibility fallback, but it is not the release performance ceiling. Prior pure-JS optimization work improved the iterable event-frame backend, yet full-string workloads still stayed behind native parser baselines, especially `quick-xml`. The remaining costs are delimiter scanning, string materialization, and stable object/API shapes around attributes and text.

The Rust native path is intended to move the hot tokenizer and string/span aggregation work into code that can use native and SIMD-oriented scanning strategies, closer in direction to native parsers such as `quick-xml` and simdjson-style designs. Published benchmark rows now measure that path through public reader surfaces rather than direct native diagnostic entry points. The package topology keeps `stax-xml` as the facade while adding optional native/Wasm acceleration packages; environments that cannot load binaries continue to use the JavaScript fallback.


## Converter API vs Plain Parser

The benchmark below compares three ways to build the **same object output**:

- A handwritten plain parser built directly on `EventReaderSync`
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
| plain parser | **2.15 ms** | Lowest overhead, handwritten state machine |
| converter api | **2.19 ms** | Declarative schema with automatic dispatch plan |
| converter api compiled | **2.21 ms** | Explicit compile() with cached dispatch plan |
| converter api compiled js byte projection | **12.41 ms** | Projection-lowerable byte input through the JavaScript converter path |
| converter api compiled native byte projection | **9.26 ms** | Projection-lowerable byte input through public native projection |
| ProjectionReader native object rows | **8.99 ms** | Public stax-xml/projection fast surface returning native columnar rows |

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
| **fast-xml-parser builder** | 240.07 µs | ~4,165 ops/sec | 80.54 kb | fast-xml-parser builder |
| stax-xml writer | 271.36 µs | ~3,685 ops/sec | 265.91 kb | Writer API |
| **stax-xml writer sync** | 5.45 µs | ~183,339 ops/sec | 13.39 kb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 129.63 µs | ~7,714 ops/sec | 40.07 kb | Sync streaming sink API |
| xml2js builder | 312.80 µs | ~3,197 ops/sec | 128.18 kb | xml2js builder |

### Large Document Building (1MB)

Building large XML documents from big JSON data:

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **fast-xml-parser builder** | 27.00 ms | ~37.03 ops/sec | 27.80 mb | fast-xml-parser builder |
| **stax-xml writer sync** | 6.38 ms | ~156.84 ops/sec | 9.66 mb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 8.09 ms | ~123.6 ops/sec | 10.39 mb | Sync streaming sink API |
| stax-xml writer | 42.22 ms | ~23.68 ops/sec | 44.05 mb | Writer API |

### Async vs Sync Writer Comparison

This comparison measures the writer APIs themselves on the same generated document shape. It includes async file output, sync string output followed by file write, and the sync sink path with an in-memory file-like target.
It is intended to show `stax-xml` async vs sync overhead and sink overhead, not to imply that all paths have identical durability guarantees.

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Element Count | Async Writer | Sync Writer + File | Sync Writer + Sink | Performance Ratio |
|---------------|--------------|--------------------|--------------------|-------------------|
| 1K elements | 7.17 ms | 3.24 ms | 2.54 ms | 2.82x faster (sink) |
| 5K elements | 26.00 ms | 7.48 ms | 6.11 ms | 4.25x faster (sink) |
| 10K elements | 47.95 ms | 13.28 ms | 9.64 ms | 4.97x faster (sink) |

### 1GiB Writer Comparison

This one-shot benchmark writes a 1GiB XML document through both async writer and sync sink writer paths.
It includes in-memory targets and temp-file targets to separate writer overhead from file I/O cost.

Benchmark source: [writer-1gb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/writer-1gb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Target | Time | Throughput | Peak Heap | Peak RSS | Written | Records |
|--------|-----:|-----------:|----------:|---------:|--------:|--------:|
| Async writer + memory WritableStream | 15.43 s | 66.35 MiB/s | 107.40 mb | 226.86 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + memory sink** | 3.16 s | 324.00 MiB/s | 74.39 mb | 226.57 mb | 1.00 gb | 1,164,225 |
| Async writer + temp file | 16.53 s | 61.93 MiB/s | 62.30 mb | 228.00 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + temp file** | 3.51 s | 292.05 MiB/s | 73.40 mb | 227.91 mb | 1.00 gb | 1,164,225 |

Based on this run, `WriterSyncSink` is the recommended path for large XML file output. It provides the highest write throughput, and peak RSS stays in the same range as async writing.
