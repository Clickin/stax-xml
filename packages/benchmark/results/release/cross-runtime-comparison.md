# Cross-Runtime Parser Comparator

Generated: 2026-04-26T05:00:16.835Z

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
| stax-xml JS on Node | 183.7 MiB/s | 87.12 ms | 1.00x | ok |
| stax-xml native addon (Buffer) | 1063.7 MiB/s | 15.04 ms | 5.79x | ok |
| stax-xml native addon (file) | 781.0 MiB/s | 20.49 ms | 4.25x | ok |
| Woodstox on Java 8 | 341.2 MiB/s | 46.89 ms | 1.86x | ok |
| quick-xml | 303.6 MiB/s | 52.70 ms | 1.65x | ok |
| simdxml structural index (file) | 382.5 MiB/s | 41.83 ms | 2.08x | ok |
| simdxml structural index (memory) | 446.1 MiB/s | 35.87 ms | 2.43x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 140.9 MiB/s | 113.52 ms | 1.00x | ok |
| stax-xml native addon (Buffer) | 1131.8 MiB/s | 14.14 ms | 8.03x | ok |
| stax-xml native addon (file) | 781.9 MiB/s | 20.46 ms | 5.55x | ok |
| Woodstox on Java 8 | 332.5 MiB/s | 48.12 ms | 2.36x | ok |
| quick-xml | 265.7 MiB/s | 60.21 ms | 1.89x | ok |
| simdxml structural index (file) | 354.2 MiB/s | 45.17 ms | 2.51x | ok |
| simdxml structural index (memory) | 417.0 MiB/s | 38.37 ms | 2.96x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 111.0 MiB/s | 144.18 ms | 1.00x | ok |
| stax-xml native addon (Buffer) | 1062.9 MiB/s | 15.05 ms | 9.58x | ok |
| stax-xml native addon (file) | 779.3 MiB/s | 20.53 ms | 7.02x | ok |
| Woodstox on Java 8 | 330.1 MiB/s | 48.47 ms | 2.97x | ok |
| quick-xml | 280.4 MiB/s | 57.05 ms | 2.53x | ok |
| simdxml structural index (file) | 364.7 MiB/s | 43.87 ms | 3.29x | ok |
| simdxml structural index (memory) | 405.5 MiB/s | 39.46 ms | 3.65x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 128.6 MiB/s | 124.44 ms | 1.00x | ok |
| stax-xml native addon (Buffer) | 1083.0 MiB/s | 14.77 ms | 8.42x | ok |
| stax-xml native addon (file) | 775.3 MiB/s | 20.64 ms | 6.03x | ok |
| Woodstox on Java 8 | 304.2 MiB/s | 52.59 ms | 2.37x | ok |
| quick-xml | 289.8 MiB/s | 55.21 ms | 2.25x | ok |
| simdxml structural index (file) | 384.7 MiB/s | 41.59 ms | 2.99x | ok |
| simdxml structural index (memory) | 441.1 MiB/s | 36.27 ms | 3.43x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 103.1 MiB/s | 155.17 ms | 1.00x | ok |
| stax-xml native addon (Buffer) | 651.2 MiB/s | 24.57 ms | 6.32x | ok |
| stax-xml native addon (file) | 528.5 MiB/s | 30.28 ms | 5.12x | ok |
| Woodstox on Java 8 | 262.4 MiB/s | 60.98 ms | 2.54x | ok |
| quick-xml | 227.9 MiB/s | 70.20 ms | 2.21x | ok |
| simdxml structural index (file) | 321.6 MiB/s | 49.75 ms | 3.12x | ok |
| simdxml structural index (memory) | 360.9 MiB/s | 44.33 ms | 3.50x | ok |


## Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Java 25 avg | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| count-only | 341.2 MiB/s | 290.8 MiB/s | -14.8% | 55.01 ms | ok |
| name-string-only | 332.5 MiB/s | 267.4 MiB/s | -19.6% | 59.83 ms | ok |
| text-string-only | 330.1 MiB/s | 289.4 MiB/s | -12.3% | 55.28 ms | ok |
| attr-value-string-only | 304.2 MiB/s | 259.8 MiB/s | -14.6% | 61.58 ms | ok |
| full-string | 262.4 MiB/s | 228.9 MiB/s | -12.8% | 69.89 ms | ok |

## Contract

- namespace off
- XML declaration/comment/PI/DOCTYPE skipped
- CDATA remains a separate event
- whitespace-only text skipped
- text trimmed before checksum
- entity decode off

Checksum and event counts are preserved by the compared rows for the current fixture. If a future fixture introduces namespaces or entity-heavy content, this contract must be reviewed before publishing the table.
