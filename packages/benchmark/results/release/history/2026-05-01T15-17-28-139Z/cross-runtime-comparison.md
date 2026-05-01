# Cross-Runtime Parser Comparator

Generated: 2026-05-01T15:17:21.657Z

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
| stax-xml JS on Node | 70.6 MiB/s | 226.70 ms | 1.00x | 0.08x | ok |
| stax-xml native StreamReaderSync | 113.7 MiB/s | 140.75 ms | 1.61x | 0.13x | ok |
| native addon full spec control | 846.0 MiB/s | 18.91 ms | 11.99x | 1.00x | ok |
| Woodstox on Java 8 | 342.7 MiB/s | 46.68 ms | 4.86x | 0.41x | ok |
| quick-xml | 302.6 MiB/s | 52.87 ms | 4.29x | 0.36x | ok |
| simdxml structural index (file) | 401.5 MiB/s | 39.85 ms | 5.69x | 0.47x | ok |
| simdxml structural index (memory) | 470.6 MiB/s | 34.00 ms | 6.67x | 0.56x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Relative to native full spec | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 62.6 MiB/s | 255.66 ms | 1.00x | 0.08x | ok |
| stax-xml native StreamReaderSync | 98.6 MiB/s | 162.34 ms | 1.57x | 0.12x | ok |
| native addon full spec control | 797.8 MiB/s | 20.06 ms | 12.75x | 1.00x | ok |
| Woodstox on Java 8 | 311.5 MiB/s | 51.37 ms | 4.98x | 0.39x | ok |
| quick-xml | 254.8 MiB/s | 62.79 ms | 4.07x | 0.32x | ok |
| simdxml structural index (file) | 372.1 MiB/s | 43.00 ms | 5.95x | 0.47x | ok |
| simdxml structural index (memory) | 441.8 MiB/s | 36.21 ms | 7.06x | 0.55x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Relative to native full spec | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 54.9 MiB/s | 291.32 ms | 1.00x | 0.07x | ok |
| stax-xml native StreamReaderSync | 41.3 MiB/s | 387.77 ms | 0.75x | 0.06x | ok |
| native addon full spec control | 732.5 MiB/s | 21.84 ms | 13.34x | 1.00x | ok |
| Woodstox on Java 8 | 337.4 MiB/s | 47.42 ms | 6.14x | 0.46x | ok |
| quick-xml | 287.7 MiB/s | 55.60 ms | 5.24x | 0.39x | ok |
| simdxml structural index (file) | 376.5 MiB/s | 42.49 ms | 6.86x | 0.51x | ok |
| simdxml structural index (memory) | 436.3 MiB/s | 36.68 ms | 7.94x | 0.60x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Relative to native full spec | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 61.6 MiB/s | 259.93 ms | 1.00x | 0.08x | ok |
| stax-xml native StreamReaderSync | 46.8 MiB/s | 341.91 ms | 0.76x | 0.06x | ok |
| native addon full spec control | 728.3 MiB/s | 21.97 ms | 11.83x | 1.00x | ok |
| Woodstox on Java 8 | 302.6 MiB/s | 52.88 ms | 4.92x | 0.42x | ok |
| quick-xml | 290.7 MiB/s | 55.04 ms | 4.72x | 0.40x | ok |
| simdxml structural index (file) | 401.0 MiB/s | 39.90 ms | 6.52x | 0.55x | ok |
| simdxml structural index (memory) | 469.3 MiB/s | 34.09 ms | 7.62x | 0.64x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Relative to native full spec | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 63.2 MiB/s | 253.00 ms | 1.00x | 0.12x | ok |
| stax-xml native StreamReaderSync | 31.8 MiB/s | 502.81 ms | 0.50x | 0.06x | ok |
| native addon full spec control | 510.5 MiB/s | 31.34 ms | 8.07x | 1.00x | ok |
| Woodstox on Java 8 | 254.5 MiB/s | 62.86 ms | 4.02x | 0.50x | ok |
| quick-xml | 234.7 MiB/s | 68.18 ms | 3.71x | 0.46x | ok |
| simdxml structural index (file) | 349.2 MiB/s | 45.82 ms | 5.52x | 0.68x | ok |
| simdxml structural index (memory) | 393.3 MiB/s | 40.68 ms | 6.22x | 0.77x | ok |


## Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Java 25 avg | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| count-only | 342.7 MiB/s | 302.2 MiB/s | -11.8% | 52.95 ms | ok |
| name-string-only | 311.5 MiB/s | 285.4 MiB/s | -8.4% | 56.06 ms | ok |
| text-string-only | 337.4 MiB/s | 287.4 MiB/s | -14.8% | 55.67 ms | ok |
| attr-value-string-only | 302.6 MiB/s | 237.1 MiB/s | -21.6% | 67.48 ms | ok |
| full-string | 254.5 MiB/s | 230.0 MiB/s | -9.6% | 69.56 ms | ok |

## Contract

- namespace off
- XML declaration/comment/PI/DOCTYPE skipped
- CDATA remains a separate event
- whitespace-only text skipped
- text trimmed before checksum
- entity decode off
- public StreamReaderSync native wrapper must stay >= 0.90x the native addon full-spec file-input control row; EventReaderSync native remains a reference row

Checksum and event counts are preserved by the compared rows for the current fixture. If a future fixture introduces namespaces or entity-heavy content, this contract must be reviewed before publishing the table.
