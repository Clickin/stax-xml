# Cross-Runtime Parser Comparator

Generated: 2026-05-01T14:59:26.116Z

This artifact compares public stax-xml StreamReaderSync native rows, EventReaderSync reference rows, a native addon full-spec control row, and non-JS parser baselines under the same checksum contract.
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
<summary>Scenario contract: stax-xml native StreamReaderSync plus native addon full-spec control, JS reference, Woodstox, quick-xml, and simdxml comparator</summary>

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
  implementation: "stax-xml-js-event-reader" | "stax-xml-native-stream-reader" | "native-addon-full-spec" | "woodstox-java8" | "quick-xml" | "simdxml-file" | "simdxml-memory",
  eventCount: number,
  checksum: fold(selected event data for tier)
}
~~~

Parsing methods:

- `stax-xml JS on Node`: internal JavaScript reference reader, run on Node, with tier-specific checksum folding.
- `stax-xml native StreamReaderSync`: initializes `stax-xml` with `initStaxXml({ backend: "native" })`, then measures the public byte-stream reader surface.
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
| stax-xml JS on Node | 69.8 MiB/s | 229.26 ms | 1.00x | 0.08x | ok |
| stax-xml native StreamReaderSync | 114.9 MiB/s | 139.31 ms | 1.65x | 0.13x | ok |
| native addon full spec control | 852.1 MiB/s | 18.78 ms | 12.21x | 1.00x | ok |
| Woodstox on Java 8 | 339.9 MiB/s | 47.07 ms | 4.87x | 0.40x | ok |
| quick-xml | 305.7 MiB/s | 52.34 ms | 4.38x | 0.36x | ok |
| simdxml structural index (file) | 415.2 MiB/s | 38.54 ms | 5.95x | 0.49x | ok |
| simdxml structural index (memory) | 474.9 MiB/s | 33.69 ms | 6.80x | 0.56x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Relative to native full spec | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 60.8 MiB/s | 262.98 ms | 1.00x | 0.08x | ok |
| stax-xml native StreamReaderSync | 98.5 MiB/s | 162.37 ms | 1.62x | 0.12x | ok |
| native addon full spec control | 797.2 MiB/s | 20.07 ms | 13.10x | 1.00x | ok |
| Woodstox on Java 8 | 330.3 MiB/s | 48.44 ms | 5.43x | 0.41x | ok |
| quick-xml | 267.3 MiB/s | 59.86 ms | 4.39x | 0.34x | ok |
| simdxml structural index (file) | 395.0 MiB/s | 40.51 ms | 6.49x | 0.50x | ok |
| simdxml structural index (memory) | 435.2 MiB/s | 36.77 ms | 7.15x | 0.55x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Relative to native full spec | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 55.0 MiB/s | 290.88 ms | 1.00x | 0.08x | ok |
| stax-xml native StreamReaderSync | 41.9 MiB/s | 382.25 ms | 0.76x | 0.06x | ok |
| native addon full spec control | 672.7 MiB/s | 23.79 ms | 12.23x | 1.00x | ok |
| Woodstox on Java 8 | 320.8 MiB/s | 49.88 ms | 5.83x | 0.48x | ok |
| quick-xml | 286.4 MiB/s | 55.86 ms | 5.21x | 0.43x | ok |
| simdxml structural index (file) | 378.8 MiB/s | 42.23 ms | 6.89x | 0.56x | ok |
| simdxml structural index (memory) | 428.7 MiB/s | 37.32 ms | 7.79x | 0.64x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Relative to native full spec | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 61.7 MiB/s | 259.26 ms | 1.00x | 0.09x | ok |
| stax-xml native StreamReaderSync | 46.7 MiB/s | 342.91 ms | 0.76x | 0.07x | ok |
| native addon full spec control | 710.5 MiB/s | 22.52 ms | 11.51x | 1.00x | ok |
| Woodstox on Java 8 | 305.9 MiB/s | 52.31 ms | 4.96x | 0.43x | ok |
| quick-xml | 280.8 MiB/s | 56.98 ms | 4.55x | 0.40x | ok |
| simdxml structural index (file) | 405.1 MiB/s | 39.49 ms | 6.56x | 0.57x | ok |
| simdxml structural index (memory) | 425.8 MiB/s | 37.58 ms | 6.90x | 0.60x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Relative to native full spec | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 59.3 MiB/s | 269.97 ms | 1.00x | 0.12x | ok |
| stax-xml native StreamReaderSync | 32.0 MiB/s | 500.59 ms | 0.54x | 0.06x | ok |
| native addon full spec control | 500.4 MiB/s | 31.97 ms | 8.44x | 1.00x | ok |
| Woodstox on Java 8 | 259.4 MiB/s | 61.67 ms | 4.38x | 0.52x | ok |
| quick-xml | 237.0 MiB/s | 67.50 ms | 4.00x | 0.47x | ok |
| simdxml structural index (file) | 353.8 MiB/s | 45.23 ms | 5.97x | 0.71x | ok |
| simdxml structural index (memory) | 389.9 MiB/s | 41.04 ms | 6.58x | 0.78x | ok |


## Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Java 25 avg | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| count-only | 339.9 MiB/s | 306.7 MiB/s | -9.8% | 52.17 ms | ok |
| name-string-only | 330.3 MiB/s | 281.2 MiB/s | -14.9% | 56.90 ms | ok |
| text-string-only | 320.8 MiB/s | 283.8 MiB/s | -11.5% | 56.37 ms | ok |
| attr-value-string-only | 305.9 MiB/s | 270.1 MiB/s | -11.7% | 59.24 ms | ok |
| full-string | 259.4 MiB/s | 232.4 MiB/s | -10.4% | 68.84 ms | ok |

## Contract

- namespace off
- XML declaration/comment/PI/DOCTYPE skipped
- CDATA remains a separate event
- whitespace-only text skipped
- text trimmed before checksum
- entity decode off
- public StreamReaderSync native wrapper must stay >= 0.90x the native addon full-spec file-input control row; EventReaderSync native remains a reference row

Checksum and event counts are preserved by the compared rows for the current fixture. If a future fixture introduces namespaces or entity-heavy content, this contract must be reviewed before publishing the table.
