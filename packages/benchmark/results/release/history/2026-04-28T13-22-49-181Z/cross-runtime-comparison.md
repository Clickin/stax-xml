# Cross-Runtime Parser Comparator

Generated: 2026-04-28T13:22:45.591Z

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
| stax-xml JS on Node | 183.1 MiB/s | 87.38 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 273.5 MiB/s | 58.50 ms | 1.49x | ok |
| Woodstox on Java 8 | 344.5 MiB/s | 46.44 ms | 1.88x | ok |
| quick-xml | 312.5 MiB/s | 51.19 ms | 1.71x | ok |
| simdxml structural index (file) | 409.5 MiB/s | 39.07 ms | 2.24x | ok |
| simdxml structural index (memory) | 488.5 MiB/s | 32.75 ms | 2.67x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 149.4 MiB/s | 107.10 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 239.8 MiB/s | 66.73 ms | 1.60x | ok |
| Woodstox on Java 8 | 346.0 MiB/s | 46.25 ms | 2.32x | ok |
| quick-xml | 274.5 MiB/s | 58.29 ms | 1.84x | ok |
| simdxml structural index (file) | 394.4 MiB/s | 40.57 ms | 2.64x | ok |
| simdxml structural index (memory) | 451.8 MiB/s | 35.41 ms | 3.02x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 109.7 MiB/s | 145.81 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 201.4 MiB/s | 79.43 ms | 1.84x | ok |
| Woodstox on Java 8 | 334.9 MiB/s | 47.77 ms | 3.05x | ok |
| quick-xml | 290.6 MiB/s | 55.06 ms | 2.65x | ok |
| simdxml structural index (file) | 390.2 MiB/s | 41.00 ms | 3.56x | ok |
| simdxml structural index (memory) | 439.9 MiB/s | 36.37 ms | 4.01x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 127.2 MiB/s | 125.81 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 212.0 MiB/s | 75.49 ms | 1.67x | ok |
| Woodstox on Java 8 | 323.8 MiB/s | 49.41 ms | 2.55x | ok |
| quick-xml | 298.9 MiB/s | 53.53 ms | 2.35x | ok |
| simdxml structural index (file) | 407.4 MiB/s | 39.27 ms | 3.20x | ok |
| simdxml structural index (memory) | 472.2 MiB/s | 33.89 ms | 3.71x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 99.6 MiB/s | 160.69 ms | 1.00x | ok |
| stax-xml native NodeIterableReader | 111.8 MiB/s | 143.15 ms | 1.12x | ok |
| Woodstox on Java 8 | 248.6 MiB/s | 64.36 ms | 2.50x | ok |
| quick-xml | 240.3 MiB/s | 66.59 ms | 2.41x | ok |
| simdxml structural index (file) | 353.8 MiB/s | 45.22 ms | 3.55x | ok |
| simdxml structural index (memory) | 396.7 MiB/s | 40.33 ms | 3.98x | ok |


## Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Java 25 avg | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| count-only | 344.5 MiB/s | 307.4 MiB/s | -10.8% | 52.04 ms | ok |
| name-string-only | 346.0 MiB/s | 289.1 MiB/s | -16.5% | 55.35 ms | ok |
| text-string-only | 334.9 MiB/s | 267.5 MiB/s | -20.2% | 59.82 ms | ok |
| attr-value-string-only | 323.8 MiB/s | 265.0 MiB/s | -18.2% | 60.37 ms | ok |
| full-string | 248.6 MiB/s | 224.1 MiB/s | -9.9% | 71.40 ms | ok |

## Contract

- namespace off
- XML declaration/comment/PI/DOCTYPE skipped
- CDATA remains a separate event
- whitespace-only text skipped
- text trimmed before checksum
- entity decode off

Checksum and event counts are preserved by the compared rows for the current fixture. If a future fixture introduces namespaces or entity-heavy content, this contract must be reviewed before publishing the table.
