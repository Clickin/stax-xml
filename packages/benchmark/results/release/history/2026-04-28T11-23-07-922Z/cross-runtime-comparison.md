# Cross-Runtime Parser Comparator

Generated: 2026-04-28T11:23:04.057Z

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
| stax-xml JS on Node | 186.3 MiB/s | 85.87 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 187.9 MiB/s | 85.15 ms | 1.01x | ok |
| Woodstox on Java 8 | 344.4 MiB/s | 46.45 ms | 1.85x | ok |
| quick-xml | 315.8 MiB/s | 50.67 ms | 1.69x | ok |
| simdxml structural index (file) | 414.4 MiB/s | 38.61 ms | 2.22x | ok |
| simdxml structural index (memory) | 470.5 MiB/s | 34.01 ms | 2.52x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 147.7 MiB/s | 108.29 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 169.2 MiB/s | 94.59 ms | 1.14x | ok |
| Woodstox on Java 8 | 354.6 MiB/s | 45.12 ms | 2.40x | ok |
| quick-xml | 272.6 MiB/s | 58.70 ms | 1.84x | ok |
| simdxml structural index (file) | 389.8 MiB/s | 41.05 ms | 2.64x | ok |
| simdxml structural index (memory) | 442.4 MiB/s | 36.17 ms | 2.99x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 111.0 MiB/s | 144.09 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 147.1 MiB/s | 108.80 ms | 1.32x | ok |
| Woodstox on Java 8 | 343.1 MiB/s | 46.63 ms | 3.09x | ok |
| quick-xml | 291.8 MiB/s | 54.84 ms | 2.63x | ok |
| simdxml structural index (file) | 387.9 MiB/s | 41.25 ms | 3.49x | ok |
| simdxml structural index (memory) | 432.7 MiB/s | 36.98 ms | 3.90x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 133.8 MiB/s | 119.61 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 158.1 MiB/s | 101.18 ms | 1.18x | ok |
| Woodstox on Java 8 | 322.3 MiB/s | 49.65 ms | 2.41x | ok |
| quick-xml | 297.1 MiB/s | 53.85 ms | 2.22x | ok |
| simdxml structural index (file) | 410.7 MiB/s | 38.96 ms | 3.07x | ok |
| simdxml structural index (memory) | 462.1 MiB/s | 34.63 ms | 3.45x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 105.5 MiB/s | 151.62 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 102.4 MiB/s | 156.30 ms | 0.97x | ok |
| Woodstox on Java 8 | 263.0 MiB/s | 60.83 ms | 2.49x | ok |
| quick-xml | 236.9 MiB/s | 67.53 ms | 2.25x | ok |
| simdxml structural index (file) | 349.3 MiB/s | 45.81 ms | 3.31x | ok |
| simdxml structural index (memory) | 393.0 MiB/s | 40.71 ms | 3.72x | ok |


## Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Java 25 avg | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| count-only | 344.4 MiB/s | 289.6 MiB/s | -15.9% | 55.25 ms | ok |
| name-string-only | 354.6 MiB/s | 287.2 MiB/s | -19.0% | 55.70 ms | ok |
| text-string-only | 343.1 MiB/s | 286.5 MiB/s | -16.5% | 55.84 ms | ok |
| attr-value-string-only | 322.3 MiB/s | 275.5 MiB/s | -14.5% | 58.08 ms | ok |
| full-string | 263.0 MiB/s | 222.3 MiB/s | -15.5% | 71.98 ms | ok |

## Contract

- namespace off
- XML declaration/comment/PI/DOCTYPE skipped
- CDATA remains a separate event
- whitespace-only text skipped
- text trimmed before checksum
- entity decode off

Checksum and event counts are preserved by the compared rows for the current fixture. If a future fixture introduces namespaces or entity-heavy content, this contract must be reviewed before publishing the table.
