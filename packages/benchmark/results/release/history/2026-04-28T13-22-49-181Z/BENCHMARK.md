# Benchmarks

Generated: 2026-04-28T13:22:49.181Z
Run ID: 2026-04-28T13-22-49-181Z

Environment:
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K (~4.86 GHz)
- Runtime: node 24.15.0 (x64-win32)

This report is generated from the canonical release benchmark set. The docs benchmark pages are derived from the same raw JSON results.
Historical runs are indexed at [packages/benchmark/results/release/history/README.md](packages/benchmark/results/release/history/README.md).

## Benchmark Environment

The refreshed benchmark tables on this page were rerun with:
- **CPU**: 13th Gen Intel(R) Core(TM) i5-13600K (~4.86 GHz)
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
| **txml** | 9.38 µs | ~106,580 ops/sec | 1.87 kb | Lightweight object parser |
| **stax-xml to object** | 258.43 µs | ~3,870 ops/sec | 77.36 kb | Object conversion |
| stax-xml JS event parser | 304.02 µs | ~3,289 ops/sec | 87.20 kb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 286.16 µs | ~3,495 ops/sec | 85.26 kb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 196.88 µs | ~5,079 ops/sec | 35.32 kb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native NodeIterableReader** | 175.62 µs | ~5,694 ops/sec | 26.51 kb | Public stax-xml/iterable/node reader surface with native runtime backend |
| fast-xml-parser | 444.09 µs | ~2,252 ops/sec | 195.22 kb | Object parser |
| xml2js | 612.92 µs | ~1,632 ops/sec | 217.64 kb | Callback object parser |

#### Medium Documents (4KB)

For larger API responses and data files (books.xml):

Benchmark source: [parser-4kb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-4kb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 18.85 µs | ~53,055 ops/sec | 5.16 kb | Lightweight object parser |
| **stax-xml to object** | 377.38 µs | ~2,650 ops/sec | 111.84 kb | Object conversion |
| stax-xml JS event parser | 412.34 µs | ~2,425 ops/sec | 144.02 kb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 406.75 µs | ~2,459 ops/sec | 147.59 kb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 317.42 µs | ~3,150 ops/sec | 36.46 kb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native NodeIterableReader** | 227.79 µs | ~4,390 ops/sec | 33.66 kb | Public stax-xml/iterable/node reader surface with native runtime backend |
| fast-xml-parser | 615.57 µs | ~1,625 ops/sec | 852.83 kb | Object parser |
| xml2js | 859.04 µs | ~1,164 ops/sec | 639.81 kb | Callback object parser |

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
| stax-xml EventReaderSync (JS) | 415.89 µs | ~2,404 ops/sec | 121.90 kb | Public string event reader, JS backend |
| stax-xml IterableReader (JS) | 305.25 µs | ~3,276 ops/sec | 36.41 kb | Public byte iterable reader, JS backend |
| **stax-xml NodeIterableReader (native)** | 235.01 µs | ~4,255 ops/sec | 33.50 kb | Public stax-xml/iterable/node reader, native runtime backend |
| fast-xml-parser XMLParser | 595.08 µs | ~1,680 ops/sec | 869.19 kb | Object parser |
| txml parse | 18.11 µs | ~55,217 ops/sec | 5.18 kb | Lightweight object parser |
| xml2js parseString | 847.22 µs | ~1,180 ops/sec | 642.83 kb | Callback object parser |
| sax strict event parser | 647.99 µs | ~1,543 ops/sec | 528.62 kb | Strict SAX event parser |
| saxes event parser | 528.67 µs | ~1,892 ops/sec | 156.12 kb | Maintained SAX-style non-validating parser |
| htmlparser2 xmlMode parser | 542.07 µs | ~1,845 ops/sec | 488.35 kb | Fast HTML/XML event parser in xmlMode |

#### Medium-Large Documents (13MB)

Performance results on midsize.xml (13MB):

Benchmark source: [parser-13mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-13mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| xml2js | 530.75 µs | ~1,884 ops/sec | 443.46 kb | Invalid comparator: first top-level element only* |
| **stax-xml to object** | 239.07 ms | ~4.18 ops/sec | 180.05 mb | Object conversion |
| stax-xml JS event parser | 281.71 ms | ~3.55 ops/sec | 179.82 mb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 286.50 ms | ~3.49 ops/sec | 180.26 mb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 105.10 ms | ~9.51 ops/sec | 26.36 mb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native NodeIterableReader** | 88.28 ms | ~11.33 ops/sec | 20.13 mb | Public stax-xml/iterable/node reader surface with native runtime backend |
| **txml** | 115.67 ms | ~8.64 ops/sec | 117.60 mb | Lightweight object parser |
| fast-xml-parser | 667.19 ms | ~1.5 ops/sec | 172.85 mb | Object parser |

*xml2js is not a valid whole-document comparator for this fixture. `midsize.xml` contains repeated top-level `<any_name>` roots, and xml2js returns only the first top-level element shape.

#### Large Documents (98MB)

Performance results on large.xml (98MB):

Benchmark source: [parser-98mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-98mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **stax-xml to object** | 1.93 s | ~0.52 ops/sec | 1.05 gb | Memory efficient |
| stax-xml JS event parser | 2.11 s | ~0.47 ops/sec | 1.10 gb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 2.09 s | ~0.48 ops/sec | 1.10 gb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 706.50 ms | ~1.42 ops/sec | 18.41 mb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native NodeIterableReader** | 552.74 ms | ~1.81 ops/sec | 21.92 mb | Public stax-xml/iterable/node reader surface with native runtime backend |
| **txml** | 1.10 s | ~0.91 ops/sec | 859.74 mb | Object parser |
| fast-xml-parser | 7.56 s | ~0.13 ops/sec | 1.08 gb | Object parser |
| xml2js | 6.11 s | ~0.16 ops/sec | 631.61 mb | Callback object parser |

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
| 1MiB temp file | **sync Iterable parser** | 13.86 ms | 11.71 mb | Baseline, 72.15 MiB/s |
| 1MiB temp file | async Iterable parser | 141.65 ms | 11.59 mb | 10.22x slower, 7.06 MiB/s |
| 10MiB temp file | **sync Iterable parser** | 87.12 ms | 27.31 mb | Baseline, 114.79 MiB/s |
| 10MiB temp file | async Iterable parser | 75.37 ms | 27.55 mb | 1.16x faster, 132.68 MiB/s |
| 100MiB temp file | **sync Iterable parser** | 680.68 ms | 37.09 mb | Baseline, 146.91 MiB/s |
| 100MiB temp file | async Iterable parser | 719.62 ms | 35.45 mb | 1.06x slower, 138.96 MiB/s |
| 1GiB temp file | **sync Iterable parser** | 7.12 s | 39.56 mb | Baseline, 143.82 MiB/s |
| 1GiB temp file | async Iterable parser | 7.73 s | 27.13 mb | 1.09x slower, 132.47 MiB/s |
| 4GiB temp file | **sync Iterable parser** | 32.91 s | 39.57 mb | Baseline, 124.48 MiB/s |
| 4GiB temp file | async Iterable parser | 30.82 s | 37.90 mb | 1.07x faster, 132.91 MiB/s |

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
| node | 24.15.0 | public-sync-full-string | 38.6 MiB/s | 414.32 ms | -746772258 |
| node | 24.15.0 | iterable-count-only | 196.1 MiB/s | 81.57 ms | 2078515073 |
| node | 24.15.0 | iterable-full-string | 110.5 MiB/s | 144.74 ms | 1007437756 |
| bun | 1.3.13 | public-sync-full-string | 62.7 MiB/s | 255.23 ms | -746772258 |
| bun | 1.3.13 | iterable-count-only | 235.2 MiB/s | 68.03 ms | 2078515073 |
| bun | 1.3.13 | iterable-full-string | 150.1 MiB/s | 106.62 ms | 1007437756 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 35.3 MiB/s | 453.62 ms | -746772258 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-count-only | 201.8 MiB/s | 79.27 ms | 2078515073 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-full-string | 119.6 MiB/s | 133.82 ms | 1007437756 |

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
| stax-xml JS on Node | 183.1 MiB/s | 87.38 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 273.5 MiB/s | 58.50 ms | 1.49x | ok |
| Woodstox on Java 8 | 344.5 MiB/s | 46.44 ms | 1.88x | ok |
| quick-xml | 312.5 MiB/s | 51.19 ms | 1.71x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 149.4 MiB/s | 107.10 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 239.8 MiB/s | 66.73 ms | 1.60x | ok |
| Woodstox on Java 8 | 346.0 MiB/s | 46.25 ms | 2.32x | ok |
| quick-xml | 274.5 MiB/s | 58.29 ms | 1.84x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 109.7 MiB/s | 145.81 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 201.4 MiB/s | 79.43 ms | 1.84x | ok |
| Woodstox on Java 8 | 334.9 MiB/s | 47.77 ms | 3.05x | ok |
| quick-xml | 290.6 MiB/s | 55.06 ms | 2.65x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 127.2 MiB/s | 125.81 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 212.0 MiB/s | 75.49 ms | 1.67x | ok |
| Woodstox on Java 8 | 323.8 MiB/s | 49.41 ms | 2.55x | ok |
| quick-xml | 298.9 MiB/s | 53.53 ms | 2.35x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 99.6 MiB/s | 160.69 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 111.8 MiB/s | 143.15 ms | 1.12x | ok |
| Woodstox on Java 8 | 248.6 MiB/s | 64.36 ms | 2.50x | ok |
| quick-xml | 240.3 MiB/s | 66.59 ms | 2.41x | ok |

### Woodstox Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Status |
| --- | ---: | ---: | ---: | --- |
| count-only | 344.5 MiB/s | 307.4 MiB/s | -10.8% | ok |
| name-string-only | 346.0 MiB/s | 289.1 MiB/s | -16.5% | ok |
| text-string-only | 334.9 MiB/s | 267.5 MiB/s | -20.2% | ok |
| attr-value-string-only | 323.8 MiB/s | 265.0 MiB/s | -18.2% | ok |
| full-string | 248.6 MiB/s | 224.1 MiB/s | -9.9% | ok |

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
| plain parser | **3.23 ms** | Lowest overhead, handwritten state machine |
| converter api | **3.65 ms** | Declarative schema with automatic dispatch plan |
| converter api compiled | **3.19 ms** | Explicit compile() with cached dispatch plan |

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
| **fast-xml-parser builder** | 256.22 µs | ~3,903 ops/sec | 80.95 kb | fast-xml-parser builder |
| stax-xml writer | 249.62 µs | ~4,006 ops/sec | 264.80 kb | Writer API |
| **stax-xml writer sync** | 108.54 µs | ~9,213 ops/sec | 20.70 kb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 152.74 µs | ~6,547 ops/sec | 23.35 kb | Sync streaming sink API |
| xml2js builder | 329.98 µs | ~3,031 ops/sec | 127.39 kb | xml2js builder |

### Large Document Building (1MB)

Building large XML documents from big JSON data:

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **fast-xml-parser builder** | 26.63 ms | ~37.55 ops/sec | 27.46 mb | fast-xml-parser builder |
| **stax-xml writer sync** | 6.48 ms | ~154.31 ops/sec | 9.81 mb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 8.27 ms | ~120.96 ops/sec | 10.46 mb | Sync streaming sink API |
| stax-xml writer | 40.56 ms | ~24.65 ops/sec | 44.04 mb | Writer API |

### Async vs Sync Writer Comparison

This comparison measures the writer APIs themselves on the same generated document shape. It includes async file output, sync string output followed by file write, and the sync sink path with an in-memory file-like target.
It is intended to show `stax-xml` async vs sync overhead and sink overhead, not to imply that all paths have identical durability guarantees.

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Element Count | Async Writer | Sync Writer + File | Sync Writer + Sink | Performance Ratio |
|---------------|--------------|--------------------|--------------------|-------------------|
| 1K elements | 6.78 ms | 2.98 ms | 2.53 ms | 2.68x faster (sink) |
| 5K elements | 24.10 ms | 7.60 ms | 6.12 ms | 3.94x faster (sink) |
| 10K elements | 46.13 ms | 12.95 ms | 9.78 ms | 4.72x faster (sink) |

### 1GiB Writer Comparison

This one-shot benchmark writes a 1GiB XML document through both async writer and sync sink writer paths.
It includes in-memory targets and temp-file targets to separate writer overhead from file I/O cost.

Benchmark source: [writer-1gb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/writer-1gb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Target | Time | Throughput | Peak Heap | Peak RSS | Written | Records |
|--------|-----:|-----------:|----------:|---------:|--------:|--------:|
| Async writer + memory WritableStream | 16.22 s | 63.15 MiB/s | 106.69 mb | 227.52 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + memory sink** | 3.27 s | 312.94 MiB/s | 74.39 mb | 227.74 mb | 1.00 gb | 1,164,225 |
| Async writer + temp file | 17.15 s | 59.70 MiB/s | 62.30 mb | 228.59 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + temp file** | 3.42 s | 299.29 MiB/s | 73.48 mb | 228.38 mb | 1.00 gb | 1,164,225 |

Based on this run, `WriterSyncSink` is the recommended path for large XML file output. It provides the highest write throughput, and peak RSS stays in the same range as async writing.
