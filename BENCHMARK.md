# Benchmarks

Generated: 2026-04-29T13:24:14.087Z
Run ID: 2026-04-29T13-24-14-087Z

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

API selection guidance:

- Prefer the converter API when the target XML-to-object shape is known.
- For whole-XML traversal with light per-event work, start with `EventReader` or `EventReaderSync`.
- For heavier unknown-schema projection or object materialization, use `ProjectionReader` and the `stax-xml/projection` helpers.

- `stax-xml JS reference event parser`: internal lean `EventReaderSync` reference loop with a checksum over event type, names, text, and attributes. It is kept as an appendix/reference row, not as the public Node performance fallback.
- `stax-xml JS reference event parser (decode+parse)`: byte-source reference path that pays `Buffer.toString("utf8")` inside the timed region before running lean `EventReaderSync`.
- `stax-xml StreamReaderSync (native)`: public lean byte-batch pull reader backed by `initStaxXml({ backend: "native" })` and the native streaming runtime. Headline native wrapper claims require this public wrapper row to stay at least `0.90x` the direct native addon full-spec file-input control row. Falling below that floor is an optimization target for the public surface, not a reason to remove the row or lower the final spec.
- `stax-xml EventReaderSync (native reference)`: ergonomic string event iterator backed by the native runtime. It remains measured as a reference row for object/iterator overhead, but it is not the 0.9x gate target.
- `stax-xml ProjectionReader parseXmlNodes (native)`: public unknown-schema object projection returning txml-style nodes through `stax-xml/projection`.
- `stax-xml to object`: `parseXmlNodesSync` object-shape reference row. Native `ProjectionReader` rows are the public performance evidence for object materialization.
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
| **txml** | 9.46 µs | ~105,665 ops/sec | 1.87 kb | Lightweight object parser |
| **stax-xml to object** | 191.91 µs | ~5,211 ops/sec | 89.42 kb | Object conversion |
| stax-xml EventReaderSync (JS reference) | 292.88 µs | ~3,414 ops/sec | 71.83 kb | Internal JavaScript reference reader; not a public Node performance fallback |
| stax-xml EventReaderSync (JS decode+parse) | 290.80 µs | ~3,439 ops/sec | 66.55 kb | Byte-source path: Buffer.toString plus public lean string event reader |
| **stax-xml EventReaderSync (native)** | 170.82 µs | ~5,854 ops/sec | 46.21 kb | Public lean string event reader backed by the initialized native runtime |
| fast-xml-parser | 452.64 µs | ~2,209 ops/sec | 195.90 kb | Object parser |
| xml2js | 570.43 µs | ~1,753 ops/sec | 215.06 kb | Callback object parser |

#### Medium Documents (4KB)

For larger API responses and data files (books.xml):

Benchmark source: [parser-4kb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-4kb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **txml** | 18.90 µs | ~52,914 ops/sec | 5.18 kb | Lightweight object parser |
| **stax-xml to object** | 267.04 µs | ~3,745 ops/sec | 161.77 kb | Object conversion |
| stax-xml EventReaderSync (JS reference) | 396.37 µs | ~2,523 ops/sec | 101.00 kb | Internal JavaScript reference reader; not a public Node performance fallback |
| stax-xml EventReaderSync (JS decode+parse) | 399.91 µs | ~2,501 ops/sec | 106.76 kb | Byte-source path: Buffer.toString plus public lean string event reader |
| **stax-xml EventReaderSync (native)** | 247.28 µs | ~4,044 ops/sec | 80.14 kb | Public lean string event reader backed by the initialized native runtime |
| fast-xml-parser | 686.83 µs | ~1,456 ops/sec | 870.47 kb | Object parser |
| xml2js | 873.52 µs | ~1,145 ops/sec | 623.38 kb | Callback object parser |

#### Medium-Large Documents (13MB)

Performance results on midsize.xml (13MB):

Benchmark source: [parser-13mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-13mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| xml2js | 548.69 µs | ~1,823 ops/sec | 449.14 kb | Invalid comparator: first top-level element only* |
| **stax-xml to object** | 395.83 ms | ~2.53 ops/sec | 372.66 mb | Object conversion |
| stax-xml EventReaderSync (JS reference) | 165.81 ms | ~6.03 ops/sec | 22.97 mb | Internal JavaScript reference reader; not a public Node performance fallback |
| stax-xml EventReaderSync (JS decode+parse) | 165.17 ms | ~6.05 ops/sec | 22.84 mb | Byte-source path: Buffer.toString plus public lean string event reader |
| **stax-xml EventReaderSync (native)** | 100.90 ms | ~9.91 ops/sec | 32.00 mb | Public lean string event reader backed by the initialized native runtime |
| **txml** | 111.67 ms | ~8.96 ops/sec | 117.59 mb | Lightweight object parser |
| fast-xml-parser | 676.84 ms | ~1.48 ops/sec | 169.68 mb | Object parser |

*xml2js is not a valid whole-document comparator for this fixture. `midsize.xml` contains repeated top-level `<any_name>` roots, and xml2js returns only the first top-level element shape.

#### Large Documents (98MB)

Performance results on large.xml (98MB):

Benchmark source: [parser-98mb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/parser-98mb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **stax-xml to object** | 3.67 s | ~0.27 ops/sec | 2.57 gb | Memory efficient |
| stax-xml EventReaderSync (JS reference) | 1.13 s | ~0.89 ops/sec | 61.89 mb | Internal JavaScript reference reader; not a public Node performance fallback |
| stax-xml EventReaderSync (JS decode+parse) | 1.15 s | ~0.87 ops/sec | 62.04 mb | Byte-source path: Buffer.toString plus public lean string event reader |
| **stax-xml EventReaderSync (native)** | 690.41 ms | ~1.45 ops/sec | 19.16 mb | Public lean string event reader backed by the initialized native runtime |
| **txml** | 970.24 ms | ~1.03 ops/sec | 859.82 mb | Object parser |
| fast-xml-parser | 5.49 s | ~0.18 ops/sec | 1.09 gb | Object parser |
| xml2js | 5.68 s | ~0.18 ops/sec | 639.29 mb | Callback object parser |

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
| stax-xml EventReaderSync (JS) | 442.07 µs | ~2,262 ops/sec | 80.82 kb | Public lean string event reader, JS backend |
| **stax-xml EventReaderSync (native)** | 284.72 µs | ~3,512 ops/sec | 59.98 kb | Public lean string event reader, native runtime backend |
| **stax-xml ProjectionReader parseXmlNodes (native)** | 154.84 µs | ~6,458 ops/sec | 55.10 kb | Public unknown-schema object projection through stax-xml/projection |
| fast-xml-parser XMLParser | 650.89 µs | ~1,536 ops/sec | 856.25 kb | Object parser |
| txml parse | 87.68 µs | ~11,405 ops/sec | 98.22 kb | Lightweight object parser |
| xml2js parseString | 868.21 µs | ~1,152 ops/sec | 655.83 kb | Callback object parser |
| sax strict event parser | 670.17 µs | ~1,492 ops/sec | 521.72 kb | Strict SAX event parser |
| saxes event parser | 539.01 µs | ~1,855 ops/sec | 195.77 kb | Maintained SAX-style non-validating parser |
| htmlparser2 xmlMode parser | 570.01 µs | ~1,754 ops/sec | 452.29 kb | Fast HTML/XML event parser in xmlMode |

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
- `EventReader stream JS reference` measures the internal JavaScript reference reader. It is not the advertised Node performance path.
- `EventReader stream native` initializes the package with the native backend before measuring the same stream reader API.
- XML tokenization is CPU-intensive. Async file reads do not make the parse loop non-blocking; if this work would run on a latency-sensitive main event loop thread, offload parsing to a Worker or worker thread.
- These rows intentionally use a structural checksum rather than building a full object tree so the table measures stream tokenization and event materialization.

</details>

The default release set stops at 1GiB; the 4GiB traversal is available with `release:update -- --include-stress`.

Benchmark source: [sync/async release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| File Size | Parser Type | Processing Time | Memory Usage | Performance Ratio |
|-----------|-------------|-----------------|--------------|-------------------|
| 1MiB temp file | **EventReader stream JS reference** | 239.32 ms | 20.79 mb | Reference, 4.18 MiB/s |
| 1MiB temp file | EventReader stream native | 33.73 ms | 46.97 mb | 7.09x faster, 29.64 MiB/s |
| 10MiB temp file | **EventReader stream JS reference** | 442.02 ms | 104.36 mb | Reference, 22.62 MiB/s |
| 10MiB temp file | EventReader stream native | 297.01 ms | 74.26 mb | 1.49x faster, 33.67 MiB/s |
| 100MiB temp file | **EventReader stream JS reference** | 4.09 s | 115.86 mb | Reference, 24.47 MiB/s |
| 100MiB temp file | EventReader stream native | 2.97 s | 59.67 mb | 1.38x faster, 33.70 MiB/s |
| 1GiB temp file | **EventReader stream JS reference** | 41.91 s | 189.49 mb | Reference, 24.43 MiB/s |
| 1GiB temp file | EventReader stream native | 30.42 s | 205.03 mb | 1.38x faster, 33.66 MiB/s |

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
| node | 24.15.0 | public-sync-full-string | 66.5 MiB/s | 240.66 ms | -746772258 |
| node | 24.15.0 | event-count-only | 76.8 MiB/s | 208.21 ms | 2078515073 |
| node | 24.15.0 | event-full-string | 65.4 MiB/s | 244.76 ms | 1007437756 |
| bun | 1.3.13 | public-sync-full-string | 96.0 MiB/s | 166.66 ms | -746772258 |
| bun | 1.3.13 | event-count-only | 103.4 MiB/s | 154.68 ms | 2078515073 |
| bun | 1.3.13 | event-full-string | 62.7 MiB/s | 255.22 ms | 1007437756 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 63.7 MiB/s | 251.09 ms | -746772258 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | event-count-only | 76.3 MiB/s | 209.73 ms | 2078515073 |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | event-full-string | 68.5 MiB/s | 233.53 ms | 1007437756 |

The native comparator uses the same event-count and checksum contract. It reports stax-xml native runtime through public `StreamReaderSync`, keeps `EventReaderSync` as an ergonomic/reference row, and carries a direct native addon full-spec file-input control row. Public wrapper rows below `0.90x` of the full-spec control are treated as gate failures and tracked optimization targets rather than headline evidence. The target is to raise the public final spec toward the native control, not to discard failing surfaces. Woodstox is reported on Java 8 for the public baseline because Java 8 is its minimum supported runtime target; Java 25 is measured only as a verification check.

<details>
<summary>Scenario contract: stax-xml native StreamReaderSync plus EventReaderSync reference, native addon full-spec control, JS reference, Woodstox, and quick-xml comparator</summary>

The comparator uses the same generated 16.00 MiB XML fixture shape as the runtime matrix.

Output shape:

~~~text
comparator-result = {
  tier: "count-only" | "name-string-only" | "attr-value-string-only" | "text-string-only" | "full-string",
  implementation: "stax-xml-js-event-reader" | "stax-xml-native-stream-reader" | "stax-xml-native-event-reader-reference" | "native-addon-full-spec" | "woodstox-java8" | "quick-xml",
  eventCount: number,
  checksum: fold(selected event data for tier)
}
~~~

Parsing methods:

- `stax-xml JS on Node`: internal JavaScript reference reader, run on Node, with tier-specific checksum folding.
- `stax-xml native StreamReaderSync`: initializes `stax-xml` with `initStaxXml({ backend: "native" })`, then measures the public byte-batch pull reader surface through accessor-only checksum consumers.
- `stax-xml native EventReaderSync reference`: keeps the native object/string iterator surface visible for ergonomic cost tracking, but it is not the native wrapper gate target.
- `native-addon-full-spec`: direct native aggregate addon control row over buffered file input. Public native `StreamReaderSync` must remain at least `0.90x` this row before it can be treated as wrapper-thin enough for headline claims. If it misses, keep the evidence and optimize the public surface rather than removing the comparison.
- Woodstox: Java StAX `XMLStreamReader`, namespace-aware parsing disabled, coalescing enabled, DTD/external entities disabled, buffered file input.
- `quick-xml`: Rust `Reader` over buffered file input; declaration, PI, doctype, and comments are skipped; text is trimmed for checksum parity.
- Java 8 is the public Woodstox row because it is Woodstox's minimum runtime target; Java 25 is a separate verification row.

</details>

Benchmark source: [cross-runtime-comparison.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/cross-runtime-comparison.mjs).

### count-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 68.2 MiB/s | 234.45 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 140.0 MiB/s | 114.28 ms | 2.05x | ok |
| Woodstox on Java 8 | 296.5 MiB/s | 53.96 ms | 4.35x | ok |
| quick-xml | 305.4 MiB/s | 52.39 ms | 4.47x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 54.4 MiB/s | 294.10 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 138.5 MiB/s | 115.51 ms | 2.55x | ok |
| Woodstox on Java 8 | 302.1 MiB/s | 52.97 ms | 5.55x | ok |
| quick-xml | 258.8 MiB/s | 61.82 ms | 4.76x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 54.8 MiB/s | 291.79 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 128.5 MiB/s | 124.53 ms | 2.34x | ok |
| Woodstox on Java 8 | 309.8 MiB/s | 51.65 ms | 5.65x | ok |
| quick-xml | 291.5 MiB/s | 54.89 ms | 5.32x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 61.5 MiB/s | 260.35 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 137.7 MiB/s | 116.22 ms | 2.24x | ok |
| Woodstox on Java 8 | 316.7 MiB/s | 50.53 ms | 5.15x | ok |
| quick-xml | 297.0 MiB/s | 53.87 ms | 4.83x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 57.9 MiB/s | 276.53 ms | 1.00x | ok |
| stax-xml native EventReaderSync | 109.2 MiB/s | 146.58 ms | 1.89x | ok |
| Woodstox on Java 8 | 264.1 MiB/s | 60.58 ms | 4.56x | ok |
| quick-xml | 236.1 MiB/s | 67.75 ms | 4.08x | ok |

### Woodstox Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Status |
| --- | ---: | ---: | ---: | --- |
| count-only | 296.5 MiB/s | 306.9 MiB/s | +3.5% | ok |
| name-string-only | 302.1 MiB/s | 275.0 MiB/s | -8.9% | ok |
| text-string-only | 309.8 MiB/s | 293.9 MiB/s | -5.1% | ok |
| attr-value-string-only | 316.7 MiB/s | 258.0 MiB/s | -18.5% | ok |
| full-string | 264.1 MiB/s | 233.8 MiB/s | -11.5% | ok |

### Why Native Runtime Acceleration Is The Performance Path

The JavaScript parser remains an internal/reference implementation, but it is not the public Node performance fallback. Prior pure-JS optimization work improved the internal event-frame backend, yet full-string workloads still stayed behind native parser baselines, especially `quick-xml`. The remaining costs are delimiter scanning, string materialization, and stable object/API shapes around attributes and text.

The Rust native path is intended to move the hot tokenizer and string/span aggregation work into code that can use native and SIMD-oriented scanning strategies, closer in direction to native parsers such as `quick-xml` and simdjson-style designs. Published benchmark rows now measure that path through public reader surfaces rather than direct native diagnostic entry points. The package topology keeps `stax-xml` as the facade while adding optional native/Wasm acceleration packages; environments that cannot load binaries should opt into the Wasm compatibility backend rather than relying on silent JavaScript fallback.


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
| plain parser | **1.29 ms** | Lowest overhead, handwritten state machine |
| converter api | **2.38 ms** | Declarative schema with automatic dispatch plan |
| converter api compiled | **2.40 ms** | Explicit compile() with cached dispatch plan |
| converter api compiled js byte projection | **12.23 ms** | Projection-lowerable byte input through the JavaScript converter path |
| converter api compiled native byte projection | **8.01 ms** | Projection-lowerable byte input through public native projection |
| ProjectionReader native object rows | **9.26 ms** | Public stax-xml/projection fast surface returning native columnar rows |

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
| **fast-xml-parser builder** | 208.02 µs | ~4,807 ops/sec | 80.86 kb | fast-xml-parser builder |
| stax-xml writer | 256.28 µs | ~3,902 ops/sec | 265.11 kb | Writer API |
| **stax-xml writer sync** | 5.49 µs | ~182,200 ops/sec | 13.41 kb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 135.83 µs | ~7,362 ops/sec | 37.00 kb | Sync streaming sink API |
| xml2js builder | 440.74 µs | ~2,269 ops/sec | 128.77 kb | xml2js builder |

### Large Document Building (1MB)

Building large XML documents from big JSON data:

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Library | Average Time | Operations/sec | Memory Usage | Notes |
|---------|--------------|----------------|--------------|-------|
| **fast-xml-parser builder** | 25.15 ms | ~39.76 ops/sec | 26.04 mb | fast-xml-parser builder |
| **stax-xml writer sync** | 7.67 ms | ~130.45 ops/sec | 9.53 mb | Fastest, Sync writer API |
| **stax-xml writer sync sink** | 8.95 ms | ~111.68 ops/sec | 10.50 mb | Sync streaming sink API |
| stax-xml writer | 42.46 ms | ~23.55 ops/sec | 44.09 mb | Writer API |

### Async vs Sync Writer Comparison

This comparison measures the writer APIs themselves on the same generated document shape. It includes async file output, sync string output followed by file write, and the sync sink path with an in-memory file-like target.
It is intended to show `stax-xml` async vs sync overhead and sink overhead, not to imply that all paths have identical durability guarantees.

Benchmark source: [writer release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Element Count | Async Writer | Sync Writer + File | Sync Writer + Sink | Performance Ratio |
|---------------|--------------|--------------------|--------------------|-------------------|
| 1K elements | 8.36 ms | 3.96 ms | 3.12 ms | 2.68x faster (sink) |
| 5K elements | 28.13 ms | 8.45 ms | 6.87 ms | 4.09x faster (sink) |
| 10K elements | 55.85 ms | 15.03 ms | 9.71 ms | 5.75x faster (sink) |

### 1GiB Writer Comparison

This one-shot benchmark writes a 1GiB XML document through both async writer and sync sink writer paths.
It includes in-memory targets and temp-file targets to separate writer overhead from file I/O cost.

Benchmark source: [writer-1gb.mjs](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/writer-1gb.mjs), [release aggregation](https://github.com/Clickin/stax-xml/blob/master/packages/benchmark/update-release-benchmarks.mjs).

| Target | Time | Throughput | Peak Heap | Peak RSS | Written | Records |
|--------|-----:|-----------:|----------:|---------:|--------:|--------:|
| Async writer + memory WritableStream | 15.65 s | 65.45 MiB/s | 103.98 mb | 227.45 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + memory sink** | 3.13 s | 327.48 MiB/s | 74.30 mb | 227.34 mb | 1.00 gb | 1,164,225 |
| Async writer + temp file | 17.08 s | 59.95 MiB/s | 62.28 mb | 228.44 mb | 1.00 gb | 1,164,225 |
| **Sync sink writer + temp file** | 3.42 s | 299.51 MiB/s | 73.46 mb | 228.48 mb | 1.00 gb | 1,164,225 |

Based on this run, `WriterSyncSink` is the recommended path for large XML file output. It provides the highest write throughput, and peak RSS stays in the same range as async writing.
