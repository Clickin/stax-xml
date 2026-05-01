# Cross-Runtime Parser Comparator

Generated: 2026-04-28T13:39:38.527Z

This artifact compares the published Node stax-xml iterable backend, the public NodeIterableReader surface backed by the native runtime, and non-JS parser baselines under the same checksum contract.
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
<summary>Scenario contract: stax-xml JS/native NodeIterableReader, Woodstox, quick-xml, and simdxml comparator</summary>

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
  implementation: "stax-xml-js-node" | "stax-xml-native-node-iterable-reader" | "woodstox-java8" | "quick-xml" | "simdxml-file" | "simdxml-memory",
  eventCount: number,
  checksum: fold(selected event data for tier)
}
~~~

Parsing methods:

- `stax-xml JS on Node`: built JavaScript iterable backend, run on Node, with tier-specific checksum folding.
- `stax-xml native NodeIterableReader`: initializes `stax-xml` with `initStaxXml({ backend: "native" })`, then measures the public `stax-xml/iterable/node` reader surface over in-memory bytes. It does not import or call private native diagnostic entry points directly.
- Woodstox: Java StAX `XMLStreamReader`, namespace-aware parsing disabled, coalescing enabled, DTD/external entities disabled, buffered file input.
- `quick-xml`: Rust `Reader` over buffered file input; declaration, PI, doctype, and comments are skipped; text is trimmed for checksum parity.
- simdxml structural index (file): Rust `simdxml::parse` after reading the fixture inside each measured sample; skipped above 64 MiB by default to avoid excessive memory use.
- simdxml structural index (memory): the same adapter with the fixture read once before warmup.
- `--native-simd` is retained for historical CLI compatibility but does not change the public `NodeIterableReader` measurement path.
- Java 8 is the public Woodstox row because it is Woodstox's minimum runtime target; Java 25 is a separate verification row.

</details>

## Public Comparator Tables

### count-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 184.8 MiB/s | 86.57 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 265.5 MiB/s | 60.27 ms | 1.44x | ok |
| Woodstox on Java 8 | 342.2 MiB/s | 46.75 ms | 1.85x | ok |
| quick-xml | 308.9 MiB/s | 51.80 ms | 1.67x | ok |
| simdxml structural index (file) | 410.1 MiB/s | 39.02 ms | 2.22x | ok |
| simdxml structural index (memory) | 471.2 MiB/s | 33.96 ms | 2.55x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 147.8 MiB/s | 108.26 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 240.2 MiB/s | 66.62 ms | 1.62x | ok |
| Woodstox on Java 8 | 348.0 MiB/s | 45.98 ms | 2.35x | ok |
| quick-xml | 271.6 MiB/s | 58.92 ms | 1.84x | ok |
| simdxml structural index (file) | 390.1 MiB/s | 41.01 ms | 2.64x | ok |
| simdxml structural index (memory) | 437.0 MiB/s | 36.61 ms | 2.96x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 106.1 MiB/s | 150.87 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 194.6 MiB/s | 82.21 ms | 1.84x | ok |
| Woodstox on Java 8 | 302.8 MiB/s | 52.84 ms | 2.86x | ok |
| quick-xml | 289.2 MiB/s | 55.33 ms | 2.73x | ok |
| simdxml structural index (file) | 372.2 MiB/s | 42.99 ms | 3.51x | ok |
| simdxml structural index (memory) | 427.6 MiB/s | 37.42 ms | 4.03x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 132.6 MiB/s | 120.65 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 200.3 MiB/s | 79.89 ms | 1.51x | ok |
| Woodstox on Java 8 | 312.1 MiB/s | 51.26 ms | 2.35x | ok |
| quick-xml | 296.8 MiB/s | 53.90 ms | 2.24x | ok |
| simdxml structural index (file) | 400.0 MiB/s | 40.00 ms | 3.02x | ok |
| simdxml structural index (memory) | 466.0 MiB/s | 34.33 ms | 3.51x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 104.5 MiB/s | 153.05 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 118.9 MiB/s | 134.52 ms | 1.14x | ok |
| Woodstox on Java 8 | 254.5 MiB/s | 62.86 ms | 2.43x | ok |
| quick-xml | 237.6 MiB/s | 67.35 ms | 2.27x | ok |
| simdxml structural index (file) | 350.3 MiB/s | 45.68 ms | 3.35x | ok |
| simdxml structural index (memory) | 392.7 MiB/s | 40.75 ms | 3.76x | ok |


## Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Java 25 avg | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| count-only | 342.2 MiB/s | 305.4 MiB/s | -10.8% | 52.38 ms | ok |
| name-string-only | 348.0 MiB/s | 297.0 MiB/s | -14.6% | 53.86 ms | ok |
| text-string-only | 302.8 MiB/s | 279.6 MiB/s | -7.7% | 57.23 ms | ok |
| attr-value-string-only | 312.1 MiB/s | 244.7 MiB/s | -21.6% | 65.38 ms | ok |
| full-string | 254.5 MiB/s | 227.2 MiB/s | -10.7% | 70.42 ms | ok |

## Contract

- namespace off
- XML declaration/comment/PI/DOCTYPE skipped
- CDATA remains a separate event
- whitespace-only text skipped
- text trimmed before checksum
- entity decode off

Checksum and event counts are preserved by the compared rows for the current fixture. If a future fixture introduces namespaces or entity-heavy content, this contract must be reviewed before publishing the table.
