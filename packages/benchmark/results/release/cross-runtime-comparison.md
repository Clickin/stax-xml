# Cross-Runtime Parser Comparator

Generated: 2026-04-25T17:05:49.148Z

This artifact compares the Node stax-xml iterable backend, the native addon through its JavaScript package wrapper, and non-JS parser baselines under the same checksum contract.
The public Woodstox row uses Java 8 because Woodstox supports Java 8 as its minimum runtime target; Java 25 is reported only as a verification check.

## Environment

- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Platform: win32-x64
- Fixture: G:\programming\stax-xml-spike-rust-native\packages\benchmark\test-data\runtime-comparison-16mib.xml
- Fixture size: 16.00 MiB
- Runs: warmups=1, runs=3
- Java 8: openjdk version "1.8.0_472"
- Java 25 check: openjdk version "25.0.1" 2025-10-21 LTS
- quick-xml crate: 0.39.2
- stax-xml native addon: 0.0.0

## Scenario

<details>
<summary>Scenario contract: stax-xml JS/native, Woodstox, and quick-xml comparator</summary>

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
  implementation: "stax-xml-js-node" | "stax-xml-native-addon" | "woodstox-java8" | "quick-xml",
  eventCount: number,
  checksum: fold(selected event data for tier)
}
~~~

Parsing methods:

- `stax-xml JS on Node`: built JavaScript iterable backend, run on Node, with tier-specific checksum folding.
- `stax-xml native addon`: JS package wrapper imports the N-API aggregate addon before sampling; each measured sample calls through the wrapper and N-API boundary in the same Node process.
- Woodstox: Java StAX `XMLStreamReader`, namespace-aware parsing disabled, coalescing enabled, DTD/external entities disabled, buffered file input.
- `quick-xml`: Rust `Reader` over buffered file input; declaration, PI, doctype, and comments are skipped; text is trimmed for checksum parity.
- Java 8 is the public Woodstox row because it is Woodstox's minimum runtime target; Java 25 is a separate verification row.

</details>

## Public Comparator Tables

### count-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 183.1 MiB/s | 87.37 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 740.6 MiB/s | 21.60 ms | 4.04x | ok |
| Woodstox on Java 8 | 346.4 MiB/s | 46.19 ms | 1.89x | ok |
| quick-xml | 304.4 MiB/s | 52.55 ms | 1.66x | ok |

### name-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 140.5 MiB/s | 113.85 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 629.1 MiB/s | 25.43 ms | 4.48x | ok |
| Woodstox on Java 8 | 322.0 MiB/s | 49.69 ms | 2.29x | ok |
| quick-xml | 270.7 MiB/s | 59.11 ms | 1.93x | ok |

### text-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 111.3 MiB/s | 143.74 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 614.2 MiB/s | 26.05 ms | 5.52x | ok |
| Woodstox on Java 8 | 326.2 MiB/s | 49.05 ms | 2.93x | ok |
| quick-xml | 285.6 MiB/s | 56.03 ms | 2.57x | ok |

### attr-value-string-only

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 129.6 MiB/s | 123.41 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 706.2 MiB/s | 22.66 ms | 5.45x | ok |
| Woodstox on Java 8 | 307.8 MiB/s | 51.98 ms | 2.37x | ok |
| quick-xml | 283.9 MiB/s | 56.36 ms | 2.19x | ok |

### full-string

| Implementation | Throughput | Average | Relative to stax-xml JS | Status |
| --- | ---: | ---: | ---: | --- |
| stax-xml JS on Node | 90.8 MiB/s | 176.22 ms | 1.00x | ok |
| stax-xml native addon (JS wrapper) | 434.5 MiB/s | 36.83 ms | 4.79x | ok |
| Woodstox on Java 8 | 236.3 MiB/s | 67.71 ms | 2.60x | ok |
| quick-xml | 229.3 MiB/s | 69.78 ms | 2.53x | ok |


## Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Java 25 avg | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| count-only | 346.4 MiB/s | 300.4 MiB/s | -13.3% | 53.26 ms | ok |
| name-string-only | 322.0 MiB/s | 282.1 MiB/s | -12.4% | 56.71 ms | ok |
| text-string-only | 326.2 MiB/s | 291.4 MiB/s | -10.7% | 54.90 ms | ok |
| attr-value-string-only | 307.8 MiB/s | 258.7 MiB/s | -16.0% | 61.85 ms | ok |
| full-string | 236.3 MiB/s | 232.8 MiB/s | -1.5% | 68.73 ms | ok |

## Contract

- namespace off
- XML declaration/comment/PI/DOCTYPE skipped
- CDATA remains a separate event
- whitespace-only text skipped
- text trimmed before checksum
- entity decode off

Checksum and event counts are preserved by the compared rows for the current fixture. If a future fixture introduces namespaces or entity-heavy content, this contract must be reviewed before publishing the table.
