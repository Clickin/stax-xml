# Cross-Runtime Parser Comparator

Generated: 2026-04-29T13:24:03.399Z

This artifact compares public stax-xml EventReaderSync JS/native rows and non-JS parser baselines under the same checksum contract.
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
<summary>Scenario contract: stax-xml JS/native EventReaderSync, Woodstox, quick-xml, and simdxml comparator</summary>

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
  implementation: "stax-xml-js-event-reader" | "stax-xml-native-event-reader" | "woodstox-java8" | "quick-xml" | "simdxml-file" | "simdxml-memory",
  eventCount: number,
  checksum: fold(selected event data for tier)
}
~~~

Parsing methods:

- `stax-xml JS on Node`: public `EventReaderSync` with the JavaScript backend, run on Node, with tier-specific checksum folding.
- `stax-xml native EventReaderSync`: initializes `stax-xml` with `initStaxXml({ backend: "native" })`, then measures the public string event reader surface. It does not import or call private native diagnostic entry points directly.
- Woodstox: Java StAX `XMLStreamReader`, namespace-aware parsing disabled, coalescing enabled, DTD/external entities disabled, buffered file input.
- `quick-xml`: Rust `Reader` over buffered file input; declaration, PI, doctype, and comments are skipped; text is trimmed for checksum parity.
- simdxml structural index (file): Rust `simdxml::parse` after reading the fixture inside each measured sample; skipped above 64 MiB by default to avoid excessive memory use.
- simdxml structural index (memory): the same adapter with the fixture read once before warmup.
- `--native-simd` is retained for historical CLI compatibility but does not change the public `EventReaderSync` measurement path.
- Java 8 is the public Woodstox row because it is Woodstox's minimum runtime target; Java 25 is a separate verification row.

</details>

## Public Comparator Tables

### count-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 68.2 MiB/s | 234.45 ms | 0.56x | ok |
| stax-xml native EventReaderSync | 140.0 MiB/s | 114.28 ms | 1.14x | ok |
| Woodstox on Java 8 | 296.5 MiB/s | 53.96 ms | 2.42x | ok |
| quick-xml | 305.4 MiB/s | 52.39 ms | 2.49x | ok |
| simdxml structural index (file) | 411.1 MiB/s | 38.92 ms | 3.36x | ok |
| simdxml structural index (memory) | 470.6 MiB/s | 34.00 ms | 3.84x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 54.4 MiB/s | 294.10 ms | 0.55x | ok |
| stax-xml native EventReaderSync | 138.5 MiB/s | 115.51 ms | 1.40x | ok |
| Woodstox on Java 8 | 302.1 MiB/s | 52.97 ms | 3.05x | ok |
| quick-xml | 258.8 MiB/s | 61.82 ms | 2.62x | ok |
| simdxml structural index (file) | 379.1 MiB/s | 42.21 ms | 3.83x | ok |
| simdxml structural index (memory) | 442.1 MiB/s | 36.19 ms | 4.47x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 54.8 MiB/s | 291.79 ms | 0.60x | ok |
| stax-xml native EventReaderSync | 128.5 MiB/s | 124.53 ms | 1.40x | ok |
| Woodstox on Java 8 | 309.8 MiB/s | 51.65 ms | 3.38x | ok |
| quick-xml | 291.5 MiB/s | 54.89 ms | 3.18x | ok |
| simdxml structural index (file) | 375.4 MiB/s | 42.62 ms | 4.10x | ok |
| simdxml structural index (memory) | 430.2 MiB/s | 37.19 ms | 4.69x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 61.5 MiB/s | 260.35 ms | 0.58x | ok |
| stax-xml native EventReaderSync | 137.7 MiB/s | 116.22 ms | 1.31x | ok |
| Woodstox on Java 8 | 316.7 MiB/s | 50.53 ms | 3.01x | ok |
| quick-xml | 297.0 MiB/s | 53.87 ms | 2.82x | ok |
| simdxml structural index (file) | 362.0 MiB/s | 44.20 ms | 3.44x | ok |
| simdxml structural index (memory) | 465.3 MiB/s | 34.39 ms | 4.42x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 57.9 MiB/s | 276.53 ms | 0.65x | ok |
| stax-xml native EventReaderSync | 109.2 MiB/s | 146.58 ms | 1.23x | ok |
| Woodstox on Java 8 | 264.1 MiB/s | 60.58 ms | 2.98x | ok |
| quick-xml | 236.1 MiB/s | 67.75 ms | 2.67x | ok |
| simdxml structural index (file) | 344.1 MiB/s | 46.50 ms | 3.89x | ok |
| simdxml structural index (memory) | 386.5 MiB/s | 41.40 ms | 4.36x | ok |


## Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Java 25 avg | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| count-only | 296.5 MiB/s | 306.9 MiB/s | +3.5% | 52.13 ms | ok |
| name-string-only | 302.1 MiB/s | 275.0 MiB/s | -8.9% | 58.17 ms | ok |
| text-string-only | 309.8 MiB/s | 293.9 MiB/s | -5.1% | 54.44 ms | ok |
| attr-value-string-only | 316.7 MiB/s | 258.0 MiB/s | -18.5% | 62.01 ms | ok |
| full-string | 264.1 MiB/s | 233.8 MiB/s | -11.5% | 68.45 ms | ok |

## Contract

- namespace off
- XML declaration/comment/PI/DOCTYPE skipped
- CDATA remains a separate event
- whitespace-only text skipped
- text trimmed before checksum
- entity decode off

Checksum and event counts are preserved by the compared rows for the current fixture. If a future fixture introduces namespaces or entity-heavy content, this contract must be reviewed before publishing the table.
