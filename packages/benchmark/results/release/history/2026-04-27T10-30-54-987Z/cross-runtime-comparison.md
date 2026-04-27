# Cross-Runtime Parser Comparator

Generated: 2026-04-27T10:29:29.247Z

This artifact compares the Node stax-xml iterable backend, the native addon through its JavaScript package wrapper, and non-JS parser baselines under the same checksum contract.
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
- stax-xml native addon: 0.0.0

## Scenario

<details>
<summary>Scenario contract: stax-xml JS/native, Woodstox, quick-xml, and simdxml comparator</summary>

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
  implementation: "stax-xml-js-node" | "stax-xml-native-addon-buffer" | "stax-xml-native-addon-file" | "woodstox-java8" | "quick-xml" | "simdxml-file" | "simdxml-memory",
  eventCount: number,
  checksum: fold(selected event data for tier)
}
~~~

Parsing methods:

- `stax-xml JS on Node`: built JavaScript iterable backend, run on Node, with tier-specific checksum folding.
- `stax-xml native addon (Buffer)`: JS package wrapper imports the napi-rs N-API aggregate addon before sampling, reads the fixture into one Node Buffer, and each measured sample calls through the wrapper and N-API boundary in the same Node process. This row does not execute a standalone Rust binary or direct Rust benchmark entry point.
- `stax-xml native addon (file)`: the same Node wrapper calls the N-API native file helper each sample, so this row includes Rust-side file read and allocation cost but is still measured from Node through N-API.
- Woodstox: Java StAX `XMLStreamReader`, namespace-aware parsing disabled, coalescing enabled, DTD/external entities disabled, buffered file input.
- `quick-xml`: Rust `Reader` over buffered file input; declaration, PI, doctype, and comments are skipped; text is trimmed for checksum parity.
- simdxml structural index (file): Rust `simdxml::parse` after reading the fixture inside each measured sample; skipped above 64 MiB by default to avoid excessive memory use.
- simdxml structural index (memory): the same adapter with the fixture read once before warmup, so it is the closest comparator to the native Buffer row.
- `--native-simd` controls only stax-xml native addon structural classifier tiers when those tiers are selected by the native aggregate implementation; it does not affect the JavaScript, Woodstox, quick-xml, or simdxml rows.
- Java 8 is the public Woodstox row because it is Woodstox's minimum runtime target; Java 25 is a separate verification row.

</details>

## Public Comparator Tables

### count-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 185.0 MiB/s | 86.49 ms | 1.00x | ok |
| stax-xml native addon (Buffer) | 1092.6 MiB/s | 14.64 ms | 5.91x | ok |
| stax-xml native addon (file) | 773.9 MiB/s | 20.67 ms | 4.18x | ok |
| Woodstox on Java 8 | 341.7 MiB/s | 46.83 ms | 1.85x | ok |
| quick-xml | 312.3 MiB/s | 51.24 ms | 1.69x | ok |
| simdxml structural index (file) | 400.9 MiB/s | 39.91 ms | 2.17x | ok |
| simdxml structural index (memory) | 449.7 MiB/s | 35.58 ms | 2.43x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 142.3 MiB/s | 112.47 ms | 1.00x | ok |
| stax-xml native addon (Buffer) | 988.2 MiB/s | 16.19 ms | 6.95x | ok |
| stax-xml native addon (file) | 731.7 MiB/s | 21.87 ms | 5.14x | ok |
| Woodstox on Java 8 | 329.2 MiB/s | 48.60 ms | 2.31x | ok |
| quick-xml | 273.6 MiB/s | 58.47 ms | 1.92x | ok |
| simdxml structural index (file) | 377.8 MiB/s | 42.35 ms | 2.66x | ok |
| simdxml structural index (memory) | 421.0 MiB/s | 38.01 ms | 2.96x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 110.4 MiB/s | 144.93 ms | 1.00x | ok |
| stax-xml native addon (Buffer) | 916.8 MiB/s | 17.45 ms | 8.30x | ok |
| stax-xml native addon (file) | 726.1 MiB/s | 22.04 ms | 6.58x | ok |
| Woodstox on Java 8 | 332.6 MiB/s | 48.11 ms | 3.01x | ok |
| quick-xml | 290.0 MiB/s | 55.16 ms | 2.63x | ok |
| simdxml structural index (file) | 370.6 MiB/s | 43.17 ms | 3.36x | ok |
| simdxml structural index (memory) | 409.4 MiB/s | 39.08 ms | 3.71x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 132.8 MiB/s | 120.44 ms | 1.00x | ok |
| stax-xml native addon (Buffer) | 902.8 MiB/s | 17.72 ms | 6.80x | ok |
| stax-xml native addon (file) | 699.1 MiB/s | 22.89 ms | 5.26x | ok |
| Woodstox on Java 8 | 319.9 MiB/s | 50.02 ms | 2.41x | ok |
| quick-xml | 300.4 MiB/s | 53.26 ms | 2.26x | ok |
| simdxml structural index (file) | 396.4 MiB/s | 40.36 ms | 2.98x | ok |
| simdxml structural index (memory) | 425.4 MiB/s | 37.61 ms | 3.20x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 103.7 MiB/s | 154.29 ms | 1.00x | ok |
| stax-xml native addon (Buffer) | 612.4 MiB/s | 26.12 ms | 5.91x | ok |
| stax-xml native addon (file) | 510.5 MiB/s | 31.34 ms | 4.92x | ok |
| Woodstox on Java 8 | 265.6 MiB/s | 60.24 ms | 2.56x | ok |
| quick-xml | 236.8 MiB/s | 67.57 ms | 2.28x | ok |
| simdxml structural index (file) | 339.7 MiB/s | 47.10 ms | 3.28x | ok |
| simdxml structural index (memory) | 376.3 MiB/s | 42.51 ms | 3.63x | ok |


## Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Java 25 avg | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| count-only | 341.7 MiB/s | 307.5 MiB/s | -10.0% | 52.03 ms | ok |
| name-string-only | 329.2 MiB/s | 285.6 MiB/s | -13.3% | 56.03 ms | ok |
| text-string-only | 332.6 MiB/s | 292.1 MiB/s | -12.2% | 54.78 ms | ok |
| attr-value-string-only | 319.9 MiB/s | 260.3 MiB/s | -18.6% | 61.46 ms | ok |
| full-string | 265.6 MiB/s | 233.6 MiB/s | -12.1% | 68.50 ms | ok |

## Contract

- namespace off
- XML declaration/comment/PI/DOCTYPE skipped
- CDATA remains a separate event
- whitespace-only text skipped
- text trimmed before checksum
- entity decode off

Checksum and event counts are preserved by the compared rows for the current fixture. If a future fixture introduces namespaces or entity-heavy content, this contract must be reviewed before publishing the table.
