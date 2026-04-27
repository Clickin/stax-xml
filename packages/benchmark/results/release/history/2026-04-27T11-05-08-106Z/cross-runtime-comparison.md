# Cross-Runtime Parser Comparator

Generated: 2026-04-27T11:05:05.230Z

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
| stax-xml JS on Node | 173.5 MiB/s | 92.23 ms | 1.00x | ok |
| stax-xml native addon (Buffer) | 1080.8 MiB/s | 14.80 ms | 6.23x | ok |
| stax-xml native addon (file) | 696.4 MiB/s | 22.97 ms | 4.01x | ok |
| Woodstox on Java 8 | 347.6 MiB/s | 46.03 ms | 2.00x | ok |
| quick-xml | 311.3 MiB/s | 51.39 ms | 1.79x | ok |
| simdxml structural index (file) | 361.1 MiB/s | 44.30 ms | 2.08x | ok |
| simdxml structural index (memory) | 442.6 MiB/s | 36.15 ms | 2.55x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 134.6 MiB/s | 118.87 ms | 1.00x | ok |
| stax-xml native addon (Buffer) | 965.9 MiB/s | 16.56 ms | 7.18x | ok |
| stax-xml native addon (file) | 745.5 MiB/s | 21.46 ms | 5.54x | ok |
| Woodstox on Java 8 | 337.1 MiB/s | 47.46 ms | 2.50x | ok |
| quick-xml | 261.7 MiB/s | 61.15 ms | 1.94x | ok |
| simdxml structural index (file) | 341.2 MiB/s | 46.89 ms | 2.54x | ok |
| simdxml structural index (memory) | 424.0 MiB/s | 37.74 ms | 3.15x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 106.0 MiB/s | 150.93 ms | 1.00x | ok |
| stax-xml native addon (Buffer) | 938.8 MiB/s | 17.04 ms | 8.86x | ok |
| stax-xml native addon (file) | 726.4 MiB/s | 22.03 ms | 6.85x | ok |
| Woodstox on Java 8 | 329.1 MiB/s | 48.62 ms | 3.10x | ok |
| quick-xml | 286.2 MiB/s | 55.91 ms | 2.70x | ok |
| simdxml structural index (file) | 369.7 MiB/s | 43.28 ms | 3.49x | ok |
| simdxml structural index (memory) | 419.8 MiB/s | 38.11 ms | 3.96x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 144.7 MiB/s | 110.54 ms | 1.00x | ok |
| stax-xml native addon (Buffer) | 899.5 MiB/s | 17.79 ms | 6.21x | ok |
| stax-xml native addon (file) | 676.9 MiB/s | 23.64 ms | 4.68x | ok |
| Woodstox on Java 8 | 304.7 MiB/s | 52.50 ms | 2.11x | ok |
| quick-xml | 295.7 MiB/s | 54.10 ms | 2.04x | ok |
| simdxml structural index (file) | 387.7 MiB/s | 41.27 ms | 2.68x | ok |
| simdxml structural index (memory) | 449.0 MiB/s | 35.64 ms | 3.10x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 109.2 MiB/s | 146.47 ms | 1.00x | ok |
| stax-xml native addon (Buffer) | 610.8 MiB/s | 26.20 ms | 5.59x | ok |
| stax-xml native addon (file) | 493.0 MiB/s | 32.46 ms | 4.51x | ok |
| Woodstox on Java 8 | 255.5 MiB/s | 62.62 ms | 2.34x | ok |
| quick-xml | 238.4 MiB/s | 67.12 ms | 2.18x | ok |
| simdxml structural index (file) | 342.3 MiB/s | 46.75 ms | 3.13x | ok |
| simdxml structural index (memory) | 359.6 MiB/s | 44.49 ms | 3.29x | ok |


## Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Java 25 avg | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| count-only | 347.6 MiB/s | 303.2 MiB/s | -12.8% | 52.78 ms | ok |
| name-string-only | 337.1 MiB/s | 280.5 MiB/s | -16.8% | 57.04 ms | ok |
| text-string-only | 329.1 MiB/s | 294.1 MiB/s | -10.6% | 54.40 ms | ok |
| attr-value-string-only | 304.7 MiB/s | 259.1 MiB/s | -15.0% | 61.76 ms | ok |
| full-string | 255.5 MiB/s | 230.3 MiB/s | -9.9% | 69.47 ms | ok |

## Contract

- namespace off
- XML declaration/comment/PI/DOCTYPE skipped
- CDATA remains a separate event
- whitespace-only text skipped
- text trimmed before checksum
- entity decode off

Checksum and event counts are preserved by the compared rows for the current fixture. If a future fixture introduces namespaces or entity-heavy content, this contract must be reviewed before publishing the table.
