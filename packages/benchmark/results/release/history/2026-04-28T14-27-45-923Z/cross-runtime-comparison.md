# Cross-Runtime Parser Comparator

Generated: 2026-04-28T14:27:42.330Z

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
| stax-xml JS on Node | 171.0 MiB/s | 93.56 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 275.1 MiB/s | 58.17 ms | 1.61x | ok |
| Woodstox on Java 8 | 346.9 MiB/s | 46.12 ms | 2.03x | ok |
| quick-xml | 303.6 MiB/s | 52.70 ms | 1.78x | ok |
| simdxml structural index (file) | 393.9 MiB/s | 40.62 ms | 2.30x | ok |
| simdxml structural index (memory) | 472.3 MiB/s | 33.88 ms | 2.76x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 143.4 MiB/s | 111.59 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 247.0 MiB/s | 64.77 ms | 1.72x | ok |
| Woodstox on Java 8 | 340.7 MiB/s | 46.97 ms | 2.38x | ok |
| quick-xml | 268.0 MiB/s | 59.70 ms | 1.87x | ok |
| simdxml structural index (file) | 375.0 MiB/s | 42.66 ms | 2.62x | ok |
| simdxml structural index (memory) | 450.9 MiB/s | 35.48 ms | 3.15x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 111.2 MiB/s | 143.86 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 191.7 MiB/s | 83.45 ms | 1.72x | ok |
| Woodstox on Java 8 | 321.6 MiB/s | 49.75 ms | 2.89x | ok |
| quick-xml | 280.3 MiB/s | 57.07 ms | 2.52x | ok |
| simdxml structural index (file) | 377.1 MiB/s | 42.43 ms | 3.39x | ok |
| simdxml structural index (memory) | 438.9 MiB/s | 36.46 ms | 3.95x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 128.2 MiB/s | 124.85 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 200.5 MiB/s | 79.80 ms | 1.56x | ok |
| Woodstox on Java 8 | 312.2 MiB/s | 51.24 ms | 2.44x | ok |
| quick-xml | 301.1 MiB/s | 53.14 ms | 2.35x | ok |
| simdxml structural index (file) | 408.2 MiB/s | 39.20 ms | 3.18x | ok |
| simdxml structural index (memory) | 467.7 MiB/s | 34.21 ms | 3.65x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 102.9 MiB/s | 155.47 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 116.7 MiB/s | 137.14 ms | 1.13x | ok |
| Woodstox on Java 8 | 265.7 MiB/s | 60.21 ms | 2.58x | ok |
| quick-xml | 238.6 MiB/s | 67.06 ms | 2.32x | ok |
| simdxml structural index (file) | 338.7 MiB/s | 47.24 ms | 3.29x | ok |
| simdxml structural index (memory) | 395.0 MiB/s | 40.50 ms | 3.84x | ok |


## Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Java 25 avg | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| count-only | 346.9 MiB/s | 314.5 MiB/s | -9.4% | 50.88 ms | ok |
| name-string-only | 340.7 MiB/s | 285.3 MiB/s | -16.3% | 56.09 ms | ok |
| text-string-only | 321.6 MiB/s | 292.9 MiB/s | -8.9% | 54.62 ms | ok |
| attr-value-string-only | 312.2 MiB/s | 267.8 MiB/s | -14.2% | 59.75 ms | ok |
| full-string | 265.7 MiB/s | 231.0 MiB/s | -13.1% | 69.27 ms | ok |

## Contract

- namespace off
- XML declaration/comment/PI/DOCTYPE skipped
- CDATA remains a separate event
- whitespace-only text skipped
- text trimmed before checksum
- entity decode off

Checksum and event counts are preserved by the compared rows for the current fixture. If a future fixture introduces namespaces or entity-heavy content, this contract must be reviewed before publishing the table.
