# Benchmarks

Generated: 2026-04-28T13:39:42.533Z
Run ID: 2026-04-28T13-39-42-533Z

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
| **txml** | 9.38 µs | ~106,646 ops/sec | 1.88 kb | Lightweight object parser |
| **stax-xml to object** | 327.74 µs | ~3,051 ops/sec | 76.02 kb | Object conversion |
| stax-xml JS event parser | 299.87 µs | ~3,335 ops/sec | 88.73 kb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 355.69 µs | ~2,811 ops/sec | 85.43 kb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 277.26 µs | ~3,607 ops/sec | 36.57 kb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native NodeIterableReader** | 197.90 µs | ~5,053 ops/sec | 23.69 kb | Public stax-xml/iterable/node reader surface with native runtime backend |
| fast-xml-parser | 510.01 µs | ~1,961 ops/sec | 196.28 kb | Object parser |
| xml2js | 576.15 µs | ~1,736 ops/sec | 215.40 kb | Callback object parser |

#### Medium Documents (4KB)

For larger API responses and data files (books.xml):

Benchmark source: [parser-4kb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-4kb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 94.18 µs | ~10,618 ops/sec | 99.52 kb | Lightweight object parser |
| **stax-xml to object** | 411.78 µs | ~2,428 ops/sec | 111.60 kb | Object conversion |
| stax-xml JS event parser | 425.14 µs | ~2,352 ops/sec | 144.03 kb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 432.34 µs | ~2,313 ops/sec | 148.56 kb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 293.16 µs | ~3,411 ops/sec | 36.40 kb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native NodeIterableReader** | 225.71 µs | ~4,430 ops/sec | 28.90 kb | Public stax-xml/iterable/node reader surface with native runtime backend |
| fast-xml-parser | 645.22 µs | ~1,550 ops/sec | 864.09 kb | Object parser |
| xml2js | 902.38 µs | ~1,108 ops/sec | 612.94 kb | Callback object parser |

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
| stax-xml EventReaderSync (JS) | 421.88 µs | ~2,370 ops/sec | 121.12 kb | Public string event reader, JS backend |
| stax-xml IterableReader (JS) | 311.72 µs | ~3,208 ops/sec | 36.19 kb | Public byte iterable reader, JS backend |
| **stax-xml NodeIterableReader (native)** | 231.92 µs | ~4,312 ops/sec | 25.36 kb | Public stax-xml/iterable/node reader, native runtime backend |
| fast-xml-parser XMLParser | 657.11 µs | ~1,522 ops/sec | 860.82 kb | Object parser |
| txml parse | 93.20 µs | ~10,730 ops/sec | 106.23 kb | Lightweight object parser |
| xml2js parseString | 876.97 µs | ~1,140 ops/sec | 657.56 kb | Callback object parser |
| sax strict event parser | 660.12 µs | ~1,515 ops/sec | 542.97 kb | Strict SAX event parser |
| saxes event parser | 528.94 µs | ~1,891 ops/sec | 182.25 kb | Maintained SAX-style non-validating parser |
| htmlparser2 xmlMode parser | 527.79 µs | ~1,895 ops/sec | 495.99 kb | Fast HTML/XML event parser in xmlMode |

#### Medium-Large Documents (13MB)

Performance results on midsize.xml (13MB):

Benchmark source: [parser-13mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-13mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| xml2js | 583.63 µs | ~1,713 ops/sec | 449.04 kb | Invalid comparator: first top-level element only* |
| **stax-xml to object** | 242.56 ms | ~4.12 ops/sec | 180.06 mb | Object conversion |
| stax-xml JS event parser | 295.08 ms | ~3.39 ops/sec | 180.25 mb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 293.11 ms | ~3.41 ops/sec | 180.63 mb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 105.43 ms | ~9.48 ops/sec | 26.36 mb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native NodeIterableReader** | 78.03 ms | ~12.82 ops/sec | 19.42 mb | Public stax-xml/iterable/node reader surface with native runtime backend |
| **txml** | 118.06 ms | ~8.47 ops/sec | 117.60 mb | Lightweight object parser |
| fast-xml-parser | 703.72 ms | ~1.42 ops/sec | 167.45 mb | Object parser |

*xml2js is not a valid whole-document comparator for this fixture. `midsize.xml` contains repeated top-level `<any_name>` roots, and xml2js returns only the first top-level element shape.

#### Large Documents (98MB)

Performance results on large.xml (98MB):

Benchmark source: [parser-98mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-98mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **stax-xml to object** | 1.98 s | ~0.5 ops/sec | 1.05 gb | Memory efficient |
| stax-xml JS event parser | 2.16 s | ~0.46 ops/sec | 1.10 gb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 2.25 s | ~0.45 ops/sec | 1.09 gb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 714.86 ms | ~1.4 ops/sec | 18.41 mb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native NodeIterableReader** | 563.83 ms | ~1.77 ops/sec | 16.65 mb | Public stax-xml/iterable/node reader surface with native runtime backend |
| **txml** | 955.30 ms | ~1.05 ops/sec | 859.81 mb | Object parser |
| fast-xml-parser | 5.66 s | ~0.18 ops/sec | 1.01 gb | Object parser |
| xml2js | 5.70 s | ~0.18 ops/sec | 637.91 mb | Callback object parser |

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
| 1MiB temp file | **sync Iterable parser** | 10.48 ms | 11.63 mb | Baseline, 95.36 MiB/s |
| 1MiB temp file | async Iterable parser | 104.34 ms | 11.56 mb | 9.95x slower, 9.58 MiB/s |
| 10MiB temp file | **sync Iterable parser** | 65.56 ms | 27.27 mb | Baseline, 152.54 MiB/s |
| 10MiB temp file | async Iterable parser | 69.28 ms | 27.34 mb | 1.06x slower, 144.34 MiB/s |
| 100MiB temp file | **sync Iterable parser** | 630.59 ms | 36.93 mb | Baseline, 158.58 MiB/s |
| 100MiB temp file | async Iterable parser | 691.93 ms | 28.85 mb | 1.10x slower, 144.52 MiB/s |
| 1GiB temp file | **sync Iterable parser** | 6.41 s | 39.59 mb | Baseline, 159.71 MiB/s |
| 1GiB temp file | async Iterable parser | 6.67 s | 39.63 mb | 1.04x slower, 153.58 MiB/s |
| 4GiB temp file | **sync Iterable parser** | 25.59 s | 39.59 mb | Baseline, 160.07 MiB/s |
| 4GiB temp file | async Iterable parser | 28.05 s | 32.55 mb | 1.10x slower, 146.04 MiB/s |

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
| node | 24.15.0 | public-sync-full-string | 36.7 MiB/s | 436.33 ms | -746772258 |
| node | 24.15.0 | iterable-count-only | 192.9 MiB/s | 82.92 ms | 2078515073 |
| node | 24.15.0 | iterable-full-string | 112.5 MiB/s | 142.16 ms | 1007437756 |
| bun | 1.3.13 | public-sync-full-string | 68.0 MiB/s | 235.35 ms | -746772258 |
| bun | 1.3.13 | iterable-count-only | 252.5 MiB/s | 63.37 ms | 2078515073 |
| bun | 1.3.13 | iterable-full-string | 150.9 MiB/s | 106.00 ms | 1007437756 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 35.1 MiB/s | 455.82 ms | -746772258 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-count-only | 203.3 MiB/s | 78.70 ms | 2078515073 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-full-string | 121.8 MiB/s | 131.33 ms | 1007437756 |

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
| stax-xml JS on Node | 184.8 MiB/s | 86.57 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 265.5 MiB/s | 60.27 ms | 1.44x | ok |
| Woodstox on Java 8 | 342.2 MiB/s | 46.75 ms | 1.85x | ok |
| quick-xml | 308.9 MiB/s | 51.80 ms | 1.67x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 147.8 MiB/s | 108.26 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 240.2 MiB/s | 66.62 ms | 1.62x | ok |
| Woodstox on Java 8 | 348.0 MiB/s | 45.98 ms | 2.35x | ok |
| quick-xml | 271.6 MiB/s | 58.92 ms | 1.84x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 106.1 MiB/s | 150.87 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 194.6 MiB/s | 82.21 ms | 1.84x | ok |
| Woodstox on Java 8 | 302.8 MiB/s | 52.84 ms | 2.86x | ok |
| quick-xml | 289.2 MiB/s | 55.33 ms | 2.73x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 132.6 MiB/s | 120.65 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 200.3 MiB/s | 79.89 ms | 1.51x | ok |
| Woodstox on Java 8 | 312.1 MiB/s | 51.26 ms | 2.35x | ok |
| quick-xml | 296.8 MiB/s | 53.90 ms | 2.24x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 104.5 MiB/s | 153.05 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 118.9 MiB/s | 134.52 ms | 1.14x | ok |
| Woodstox on Java 8 | 254.5 MiB/s | 62.86 ms | 2.43x | ok |
| quick-xml | 237.6 MiB/s | 67.35 ms | 2.27x | ok |

### Woodstox Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Status |
| --- | ---: | ---: | ---: | --- |
| count-only | 342.2 MiB/s | 305.4 MiB/s | -10.8% | ok |
| name-string-only | 348.0 MiB/s | 297.0 MiB/s | -14.6% | ok |
| text-string-only | 302.8 MiB/s | 279.6 MiB/s | -7.7% | ok |
| attr-value-string-only | 312.1 MiB/s | 244.7 MiB/s | -21.6% | ok |
| full-string | 254.5 MiB/s | 227.2 MiB/s | -10.7% | ok |

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
| plain parser | **3.34 ms** | Lowest overhead, handwritten state machine |
| converter api | **3.59 ms** | Declarative schema with automatic dispatch plan |
| converter api compiled | **3.57 ms** | Explicit compile() with cached dispatch plan |

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
| **fast-xml-parser builder** | 223.43 µs | ~4,476 ops/sec | 80.78 kb | fast-xml-parser builder |
| stax-xml writer | 301.17 µs | ~3,320 ops/sec | 265.43 kb | Writer API |
| **stax-xml writer sync** | 5.72 µs | ~174,908 ops/sec | 13.42 kb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 163.42 µs | ~6,119 ops/sec | 30.38 kb | Sync streaming sink API |
| xml2js builder | 342.86 µs | ~2,917 ops/sec | 127.46 kb | xml2js builder |

### Large Document Building (1MB)

Building large XML documents from big JSON data:

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **fast-xml-parser builder** | 27.61 ms | ~36.22 ops/sec | 26.61 mb | fast-xml-parser builder |
| **stax-xml writer sync** | 9.30 ms | ~107.58 ops/sec | 9.48 mb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 12.17 ms | ~82.19 ops/sec | 10.53 mb | Sync streaming sink API |
| stax-xml writer | 55.35 ms | ~18.07 ops/sec | 44.08 mb | Writer API |

### Async vs Sync Writer Comparison

This comparison measures the writer APIs themselves on the same generated document shape. It includes async file output, sync string output followed by file write, and the sync sink path with an in-memory file-like target.
It is intended to show `stax-xml` async vs sync overhead and sink overhead, not to imply that all paths have identical durability guarantees.

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Element Count | Async Writer | Sync Writer + File | Sync Writer + Sink | Performance Ratio |
|---------------|--------------|--------------------|--------------------|-------------------|
| 1K elements | 8.07 ms | 3.42 ms | 2.69 ms | 3.00x faster (sink) |
| 5K elements | 26.05 ms | 7.78 ms | 6.69 ms | 3.89x faster (sink) |
| 10K elements | 53.17 ms | 13.12 ms | 12.78 ms | 4.16x faster (sink) |

### 1GiB Writer Comparison

This one-shot benchmark writes a 1GiB XML document through both async writer and sync sink writer paths.
It includes in-memory targets and temp-file targets to separate writer overhead from file I/O cost.

Benchmark source: [writer-1gb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/writer-1gb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Target | Time | Throughput | Peak Heap | Peak RSS | Written | Records |
|--------|-----:|-----------:|----------:|---------:|--------:|--------:|
| Async writer + memory WritableStream | 15.54 s | 65.88 MiB/s | 107.32 mb | 227.38 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + memory sink** | 3.12 s | 328.08 MiB/s | 74.39 mb | 227.16 mb | 1.00 gb | 1,164,225 |
| Async writer + temp file | 17.18 s | 59.61 MiB/s | 62.23 mb | 228.78 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + temp file** | 3.37 s | 304.01 MiB/s | 73.58 mb | 228.33 mb | 1.00 gb | 1,164,225 |

Based on this run, `WriterSyncSink` is the recommended path for large XML file output. It provides the highest write throughput, and peak RSS stays in the same range as async writing.
