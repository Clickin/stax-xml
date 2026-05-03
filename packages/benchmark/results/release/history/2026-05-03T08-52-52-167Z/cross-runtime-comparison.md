# Cross-Runtime Parser Comparator

Generated: 2026-05-03T08:52:43.044Z

This artifact compares public stax-xml StreamReaderSync native rows, wrapper-overhead decomposition rows, EventReaderSync reference rows, a native addon full-spec control row, and non-JS parser baselines under the same checksum contract.
The public Woodstox row uses Java 8 because Woodstox supports Java 8 as its minimum runtime target; Java 25 is reported only as a verification check.

## Environment

- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Platform: win32-x64
- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\runtime-comparison-16mib.xml
- Fixture size: 16.00 MiB
- Runs: warmups=1, runs=3
- Native SIMD policy: auto
- simdxml max fixture: 64 MiB
- Java 8: openjdk version "1.8.0_472"
- Java 25 check: openjdk version "25.0.1" 2025-10-21 LTS
- quick-xml crate: 0.39.2
- simdxml crate: 0.2.1
- stax-xml native runtime: @stax-xml/native-win32-x64-msvc 1.0.0-rc3

## Scenario

<details>
<summary>Scenario contract: stax-xml native StreamReaderSync plus wrapper decomposition rows, native addon full-spec control, JS reference, Woodstox, quick-xml, and simdxml comparator</summary>

The comparator uses one generated single-root 16.00 MiB XML fixture.

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
comparator-result = {
  tier: "count-only" | "name-string-only" | "attr-value-string-only" | "text-string-only" | "full-string",
  implementation: "stax-xml-js-event-reader" | "stax-xml-native-stream-reader" | "stax-xml-native-stream-reader-indexed" | "stax-xml-native-stream-reader-raw" | "native-addon-full-spec" | "woodstox-java8" | "quick-xml" | "simdxml-file" | "simdxml-memory",
  eventCount: number,
  checksum: fold(selected event data for tier)
}
~~~

Parsing methods:

- `stax-xml JS on Node`: internal JavaScript reference reader, run on Node, with tier-specific checksum folding.
- `stax-xml native StreamReaderSync`: initializes `stax-xml` with `initStaxXml({ backend: "native" })`, then measures the public byte-stream reader surface.
- `stax-xml native StreamReaderSync indexed`: keeps the public batch API but uses `eventCount`/`typeAt()`/indexed accessors to remove iterator and per-event view allocation.
- `stax-xml native StreamReaderSync raw`: uses the experimental raw batch table/frame view to isolate wrapper object overhead from native parsing and table handoff.
- `native-addon-full-spec`: control row from `node-string-return.mjs` that calls the native aggregate addon full-spec file-input tier directly. Public native StreamReaderSync must remain at least 0.90x this row before it can be treated as wrapper-thin enough for headline claims; misses stay as optimization evidence for raising the public surface, not as a reason to remove the row or lower the final spec.
- Woodstox: Java StAX `XMLStreamReader`, namespace-aware parsing disabled, coalescing enabled, DTD/external entities disabled, buffered file input.
- `quick-xml`: Rust `Reader` over buffered file input; declaration, PI, doctype, and comments are skipped; text is trimmed for checksum parity.
- simdxml structural index (file): Rust `simdxml::parse` after reading the fixture inside each measured sample; skipped above 64 MiB by default to avoid excessive memory use.
- simdxml structural index (memory): the same adapter with the fixture read once before warmup.
- `--native-simd` is retained for historical CLI compatibility but does not change the public `StreamReaderSync` measurement path.
- Java 8 is the public Woodstox row because it is Woodstox's minimum runtime target; Java 25 is a separate verification row.

</details>

## Public Comparator Tables

### count-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Relative to native full spec | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 16.1 MiB/s | 994.62 ms | 1.00x | 0.02x | ok |
| stax-xml native StreamReaderSync (event view) | 64.1 MiB/s | 249.78 ms | 3.98x | 0.08x | ok |
| stax-xml native StreamReaderSync (indexed batch) | 83.7 MiB/s | 191.21 ms | 5.20x | 0.11x | ok |
| stax-xml native StreamReaderSync (raw batch) | 83.2 MiB/s | 192.26 ms | 5.17x | 0.11x | ok |
| native addon full spec control | 777.9 MiB/s | 20.57 ms | 48.36x | 1.00x | ok |
| Woodstox on Java 8 | 335.5 MiB/s | 47.69 ms | 20.85x | 0.43x | ok |
| quick-xml | 312.5 MiB/s | 51.20 ms | 19.43x | 0.40x | ok |
| simdxml structural index (file) | 407.2 MiB/s | 39.29 ms | 25.32x | 0.52x | ok |
| simdxml structural index (memory) | 478.4 MiB/s | 33.44 ms | 29.74x | 0.62x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Relative to native full spec | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 19.8 MiB/s | 806.69 ms | 1.00x | 0.03x | ok |
| stax-xml native StreamReaderSync (event view) | 64.0 MiB/s | 249.88 ms | 3.23x | 0.09x | ok |
| stax-xml native StreamReaderSync (indexed batch) | 60.5 MiB/s | 264.55 ms | 3.05x | 0.08x | ok |
| stax-xml native StreamReaderSync (raw batch) | 62.3 MiB/s | 256.87 ms | 3.14x | 0.09x | ok |
| native addon full spec control | 726.9 MiB/s | 22.01 ms | 36.65x | 1.00x | ok |
| Woodstox on Java 8 | 300.9 MiB/s | 53.17 ms | 15.17x | 0.41x | ok |
| quick-xml | 270.6 MiB/s | 59.12 ms | 13.64x | 0.37x | ok |
| simdxml structural index (file) | 386.6 MiB/s | 41.38 ms | 19.49x | 0.53x | ok |
| simdxml structural index (memory) | 456.0 MiB/s | 35.09 ms | 22.99x | 0.63x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Relative to native full spec | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 17.7 MiB/s | 903.43 ms | 1.00x | 0.02x | ok |
| stax-xml native StreamReaderSync (event view) | 35.7 MiB/s | 448.04 ms | 2.02x | 0.05x | ok |
| stax-xml native StreamReaderSync (indexed batch) | 32.3 MiB/s | 495.11 ms | 1.82x | 0.05x | ok |
| stax-xml native StreamReaderSync (raw batch) | 50.9 MiB/s | 314.22 ms | 2.88x | 0.07x | ok |
| native addon full spec control | 712.7 MiB/s | 22.45 ms | 40.24x | 1.00x | ok |
| Woodstox on Java 8 | 338.8 MiB/s | 47.23 ms | 19.13x | 0.48x | ok |
| quick-xml | 287.6 MiB/s | 55.63 ms | 16.24x | 0.40x | ok |
| simdxml structural index (file) | 355.4 MiB/s | 45.02 ms | 20.07x | 0.50x | ok |
| simdxml structural index (memory) | 416.5 MiB/s | 38.42 ms | 23.52x | 0.58x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Relative to native full spec | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 19.0 MiB/s | 842.12 ms | 1.00x | 0.03x | ok |
| stax-xml native StreamReaderSync (event view) | 36.9 MiB/s | 433.05 ms | 1.94x | 0.05x | ok |
| stax-xml native StreamReaderSync (indexed batch) | 32.0 MiB/s | 499.35 ms | 1.69x | 0.05x | ok |
| stax-xml native StreamReaderSync (raw batch) | 50.8 MiB/s | 315.19 ms | 2.67x | 0.07x | ok |
| native addon full spec control | 686.9 MiB/s | 23.29 ms | 36.15x | 1.00x | ok |
| Woodstox on Java 8 | 314.6 MiB/s | 50.86 ms | 16.56x | 0.46x | ok |
| quick-xml | 297.0 MiB/s | 53.86 ms | 15.63x | 0.43x | ok |
| simdxml structural index (file) | 398.0 MiB/s | 40.20 ms | 20.95x | 0.58x | ok |
| simdxml structural index (memory) | 445.2 MiB/s | 35.94 ms | 23.43x | 0.65x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Relative to native full spec | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 18.2 MiB/s | 876.89 ms | 1.00x | 0.04x | ok |
| stax-xml native StreamReaderSync (event view) | 27.6 MiB/s | 578.95 ms | 1.51x | 0.06x | ok |
| stax-xml native StreamReaderSync (indexed batch) | 22.4 MiB/s | 714.74 ms | 1.23x | 0.04x | ok |
| stax-xml native StreamReaderSync (raw batch) | 39.5 MiB/s | 404.85 ms | 2.17x | 0.08x | ok |
| native addon full spec control | 501.8 MiB/s | 31.88 ms | 27.50x | 1.00x | ok |
| Woodstox on Java 8 | 257.5 MiB/s | 62.12 ms | 14.12x | 0.51x | ok |
| quick-xml | 238.7 MiB/s | 67.03 ms | 13.08x | 0.48x | ok |
| simdxml structural index (file) | 347.2 MiB/s | 46.08 ms | 19.03x | 0.69x | ok |
| simdxml structural index (memory) | 387.3 MiB/s | 41.31 ms | 21.23x | 0.77x | ok |


## Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Java 25 avg | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| count-only | 335.5 MiB/s | 300.2 MiB/s | -10.5% | 53.29 ms | ok |
| name-string-only | 300.9 MiB/s | 295.7 MiB/s | -1.7% | 54.10 ms | ok |
| text-string-only | 338.8 MiB/s | 293.9 MiB/s | -13.2% | 54.44 ms | ok |
| attr-value-string-only | 314.6 MiB/s | 270.7 MiB/s | -14.0% | 59.12 ms | ok |
| full-string | 257.5 MiB/s | 231.8 MiB/s | -10.0% | 69.01 ms | ok |

## Contract

- namespace off
- XML declaration/comment/PI/DOCTYPE skipped
- CDATA remains a separate event
- whitespace-only text skipped
- text trimmed before checksum
- entity decode off
- public StreamReaderSync native wrapper must stay >= 0.90x the native addon full-spec file-input control row; EventReaderSync native remains a reference row
- StreamReaderSync indexed and raw rows are wrapper-overhead decomposition rows and must preserve the public wrapper checksum

Checksum and event counts are preserved by the compared rows for the current fixture. If a future fixture introduces namespaces or entity-heavy content, this contract must be reviewed before publishing the table.
