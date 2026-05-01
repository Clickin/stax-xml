# Benchmarks

Generated: 2026-04-28T11:23:07.922Z
Run ID: 2026-04-28T11-23-07-922Z

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
| pnpm | n/a | spawnSync cmd.exe EPERM |
| bun | n/a | spawnSync cmd.exe EPERM |
| deno | n/a | spawnSync cmd.exe EPERM |
| java | n/a | spawnSync cmd.exe EPERM |
| rustc | n/a | spawnSync cmd.exe EPERM |
| cargo | n/a | spawnSync cmd.exe EPERM |

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
| **txml** | 9.41 µs | ~106,278 ops/sec | 1.88 kb | Lightweight object parser |
| **stax-xml to object** | 264.29 µs | ~3,784 ops/sec | 77.02 kb | Object conversion |
| stax-xml JS event parser | 283.26 µs | ~3,530 ops/sec | 87.82 kb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 283.83 µs | ~3,523 ops/sec | 85.27 kb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 196.70 µs | ~5,084 ops/sec | 36.39 kb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native NodeIterableReader** | 171.29 µs | ~5,838 ops/sec | 25.01 kb | Public stax-xml/iterable/node reader surface with native runtime backend |
| fast-xml-parser | 411.20 µs | ~2,432 ops/sec | 196.13 kb | Object parser |
| xml2js | 547.71 µs | ~1,826 ops/sec | 217.67 kb | Callback object parser |

#### Medium Documents (4KB)

For larger API responses and data files (books.xml):

Benchmark source: [parser-4kb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-4kb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 18.43 µs | ~54,249 ops/sec | 5.18 kb | Lightweight object parser |
| **stax-xml to object** | 355.08 µs | ~2,816 ops/sec | 111.81 kb | Object conversion |
| stax-xml JS event parser | 403.53 µs | ~2,478 ops/sec | 144.50 kb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 405.54 µs | ~2,466 ops/sec | 146.67 kb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 276.75 µs | ~3,613 ops/sec | 35.31 kb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native NodeIterableReader** | 243.50 µs | ~4,107 ops/sec | 21.35 kb | Public stax-xml/iterable/node reader surface with native runtime backend |
| fast-xml-parser | 581.72 µs | ~1,719 ops/sec | 817.63 kb | Object parser |
| xml2js | 848.50 µs | ~1,179 ops/sec | 623.17 kb | Callback object parser |

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
| stax-xml EventReaderSync (JS) | 394.01 µs | ~2,538 ops/sec | 121.28 kb | Public string event reader, JS backend |
| stax-xml IterableReader (JS) | 278.17 µs | ~3,595 ops/sec | 36.66 kb | Public byte iterable reader, JS backend |
| **stax-xml NodeIterableReader (native)** | 239.46 µs | ~4,176 ops/sec | 21.26 kb | Public stax-xml/iterable/node reader, native runtime backend |
| fast-xml-parser XMLParser | 571.78 µs | ~1,749 ops/sec | 865.84 kb | Object parser |
| txml parse | 18.12 µs | ~55,173 ops/sec | 5.18 kb | Lightweight object parser |
| xml2js parseString | 840.26 µs | ~1,190 ops/sec | 665.96 kb | Callback object parser |
| sax strict event parser | 645.01 µs | ~1,550 ops/sec | 531.68 kb | Strict SAX event parser |
| saxes event parser | 502.09 µs | ~1,992 ops/sec | 154.87 kb | Maintained SAX-style non-validating parser |
| htmlparser2 xmlMode parser | 528.25 µs | ~1,893 ops/sec | 449.49 kb | Fast HTML/XML event parser in xmlMode |

#### Medium-Large Documents (13MB)

Performance results on midsize.xml (13MB):

Benchmark source: [parser-13mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-13mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| xml2js | 518.19 µs | ~1,930 ops/sec | 443.54 kb | Invalid comparator: first top-level element only* |
| **stax-xml to object** | 241.18 ms | ~4.15 ops/sec | 180.05 mb | Object conversion |
| stax-xml JS event parser | 280.32 ms | ~3.57 ops/sec | 180.20 mb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 284.75 ms | ~3.51 ops/sec | 180.35 mb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 104.36 ms | ~9.58 ops/sec | 26.36 mb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native NodeIterableReader** | 116.69 ms | ~8.57 ops/sec | 19.98 mb | Public stax-xml/iterable/node reader surface with native runtime backend |
| **txml** | 111.62 ms | ~8.96 ops/sec | 117.59 mb | Lightweight object parser |
| fast-xml-parser | 657.87 ms | ~1.52 ops/sec | 167.03 mb | Object parser |

*xml2js is not a valid whole-document comparator for this fixture. `midsize.xml` contains repeated top-level `<any_name>` roots, and xml2js returns only the first top-level element shape.

#### Large Documents (98MB)

Performance results on large.xml (98MB):

Benchmark source: [parser-98mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-98mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **stax-xml to object** | 1.97 s | ~0.51 ops/sec | 1.05 gb | Memory efficient |
| stax-xml JS event parser | 2.03 s | ~0.49 ops/sec | 1.08 gb | String API-native path; XML string is prepared outside the timed region |
| stax-xml JS event parser (decode+parse) | 2.08 s | ~0.48 ops/sec | 1.09 gb | Byte-source path: Buffer.toString plus public string event parser |
| stax-xml JS Uint8Array iterable | 689.12 ms | ~1.45 ops/sec | 18.41 mb | Byte-source API-native path; reusable Iterable<Uint8Array[]> batches |
| **stax-xml native NodeIterableReader** | 787.58 ms | ~1.27 ops/sec | 34.39 mb | Public stax-xml/iterable/node reader surface with native runtime backend |
| **txml** | 930.24 ms | ~1.07 ops/sec | 859.78 mb | Object parser |
| fast-xml-parser | 5.35 s | ~0.19 ops/sec | 1.06 gb | Object parser |
| xml2js | 5.56 s | ~0.18 ops/sec | 634.67 mb | Callback object parser |

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
| 1MiB temp file | **sync Iterable parser** | 17.45 ms | 12.65 mb | Baseline, 57.29 MiB/s |
| 1MiB temp file | async Iterable parser | 18.79 ms | 12.58 mb | 1.08x slower, 53.22 MiB/s |
| 10MiB temp file | **sync Iterable parser** | 74.68 ms | 32.47 mb | Baseline, 133.91 MiB/s |
| 10MiB temp file | async Iterable parser | 77.02 ms | 32.55 mb | 1.03x slower, 129.83 MiB/s |
| 100MiB temp file | **sync Iterable parser** | 637.00 ms | 42.41 mb | Baseline, 156.99 MiB/s |
| 100MiB temp file | async Iterable parser | 657.26 ms | 38.44 mb | 1.03x slower, 152.15 MiB/s |
| 1GiB temp file | **sync Iterable parser** | 6.32 s | 70.39 mb | Baseline, 162.00 MiB/s |
| 1GiB temp file | async Iterable parser | 6.48 s | 49.72 mb | 1.02x slower, 158.08 MiB/s |
| 4GiB temp file | **sync Iterable parser** | 25.11 s | 72.03 mb | Baseline, 163.13 MiB/s |
| 4GiB temp file | async Iterable parser | 25.55 s | 61.02 mb | 1.02x slower, 160.32 MiB/s |

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
| node | 24.15.0 | public-sync-full-string | 38.6 MiB/s | 414.24 ms | -746772258 |
| node | 24.15.0 | iterable-count-only | 198.2 MiB/s | 80.71 ms | 2078515073 |
| node | 24.15.0 | iterable-full-string | 114.6 MiB/s | 139.63 ms | 1007437756 |
| bun | 1.3.13 | public-sync-full-string | 68.4 MiB/s | 234.04 ms | -746772258 |
| bun | 1.3.13 | iterable-count-only | 246.1 MiB/s | 65.01 ms | 2078515073 |
| bun | 1.3.13 | iterable-full-string | 150.4 MiB/s | 106.39 ms | 1007437756 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 35.5 MiB/s | 451.16 ms | -746772258 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-count-only | 209.0 MiB/s | 76.54 ms | 2078515073 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-full-string | 126.9 MiB/s | 126.05 ms | 1007437756 |

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
| stax-xml JS on Node | 186.3 MiB/s | 85.87 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 187.9 MiB/s | 85.15 ms | 1.01x | ok |
| Woodstox on Java 8 | 344.4 MiB/s | 46.45 ms | 1.85x | ok |
| quick-xml | 315.8 MiB/s | 50.67 ms | 1.69x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 147.7 MiB/s | 108.29 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 169.2 MiB/s | 94.59 ms | 1.14x | ok |
| Woodstox on Java 8 | 354.6 MiB/s | 45.12 ms | 2.40x | ok |
| quick-xml | 272.6 MiB/s | 58.70 ms | 1.84x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 111.0 MiB/s | 144.09 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 147.1 MiB/s | 108.80 ms | 1.32x | ok |
| Woodstox on Java 8 | 343.1 MiB/s | 46.63 ms | 3.09x | ok |
| quick-xml | 291.8 MiB/s | 54.84 ms | 2.63x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 133.8 MiB/s | 119.61 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 158.1 MiB/s | 101.18 ms | 1.18x | ok |
| Woodstox on Java 8 | 322.3 MiB/s | 49.65 ms | 2.41x | ok |
| quick-xml | 297.1 MiB/s | 53.85 ms | 2.22x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 105.5 MiB/s | 151.62 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 102.4 MiB/s | 156.30 ms | 0.97x | ok |
| Woodstox on Java 8 | 263.0 MiB/s | 60.83 ms | 2.49x | ok |
| quick-xml | 236.9 MiB/s | 67.53 ms | 2.25x | ok |

### Woodstox Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Status |
| --- | ---: | ---: | ---: | --- |
| count-only | 344.4 MiB/s | 289.6 MiB/s | -15.9% | ok |
| name-string-only | 354.6 MiB/s | 287.2 MiB/s | -19.0% | ok |
| text-string-only | 343.1 MiB/s | 286.5 MiB/s | -16.5% | ok |
| attr-value-string-only | 322.3 MiB/s | 275.5 MiB/s | -14.5% | ok |
| full-string | 263.0 MiB/s | 222.3 MiB/s | -15.5% | ok |

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
| plain parser | **3.22 ms** | Lowest overhead, handwritten state machine |
| converter api | **3.37 ms** | Declarative schema with automatic dispatch plan |
| converter api compiled | **3.21 ms** | Explicit compile() with cached dispatch plan |

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
| **fast-xml-parser builder** | 193.40 µs | ~5,171 ops/sec | 80.65 kb | fast-xml-parser builder |
| stax-xml writer | 249.26 µs | ~4,012 ops/sec | 265.53 kb | Writer API |
| **stax-xml writer sync** | 5.40 µs | ~185,033 ops/sec | 13.41 kb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 118.45 µs | ~8,442 ops/sec | 45.73 kb | Sync streaming sink API |
| xml2js builder | 293.48 µs | ~3,407 ops/sec | 127.22 kb | xml2js builder |

### Large Document Building (1MB)

Building large XML documents from big JSON data:

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **fast-xml-parser builder** | 24.52 ms | ~40.78 ops/sec | 26.80 mb | fast-xml-parser builder |
| **stax-xml writer sync** | 5.78 ms | ~172.98 ops/sec | 9.09 mb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 6.95 ms | ~143.81 ops/sec | 10.14 mb | Sync streaming sink API |
| stax-xml writer | 40.64 ms | ~24.61 ops/sec | 44.03 mb | Writer API |

### Async vs Sync Writer Comparison

This comparison measures the writer APIs themselves on the same generated document shape. It includes async file output, sync string output followed by file write, and the sync sink path with an in-memory file-like target.
It is intended to show `stax-xml` async vs sync overhead and sink overhead, not to imply that all paths have identical durability guarantees.

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Element Count | Async Writer | Sync Writer + File | Sync Writer + Sink | Performance Ratio |
|---------------|--------------|--------------------|--------------------|-------------------|
| 1K elements | 6.76 ms | 2.88 ms | 2.18 ms | 3.10x faster (sink) |
| 5K elements | 24.59 ms | 6.75 ms | 5.47 ms | 4.49x faster (sink) |
| 10K elements | 46.77 ms | 11.33 ms | 8.55 ms | 5.47x faster (sink) |

### 1GiB Writer Comparison

This one-shot benchmark writes a 1GiB XML document through both async writer and sync sink writer paths.
It includes in-memory targets and temp-file targets to separate writer overhead from file I/O cost.

Benchmark source: [writer-1gb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/writer-1gb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Target | Time | Throughput | Peak Heap | Peak RSS | Written | Records |
|--------|-----:|-----------:|----------:|---------:|--------:|--------:|
| Async writer + memory WritableStream | 15.52 s | 66.00 MiB/s | 107.09 mb | 227.36 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + memory sink** | 3.07 s | 333.24 MiB/s | 74.29 mb | 227.20 mb | 1.00 gb | 1,164,225 |
| Async writer + temp file | 16.43 s | 62.34 MiB/s | 62.33 mb | 228.13 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + temp file** | 3.34 s | 306.37 MiB/s | 73.48 mb | 227.68 mb | 1.00 gb | 1,164,225 |

Based on this run, `WriterSyncSink` is the recommended path for large XML file output. It provides the highest write throughput, and peak RSS stays in the same range as async writing.
