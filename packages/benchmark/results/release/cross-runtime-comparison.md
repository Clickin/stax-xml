# Cross-Runtime Parser Comparator

Generated: 2026-04-25T15:45:53.482Z

This artifact compares the Node stax-xml iterable backend with non-JS parser baselines under the same checksum contract.
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

## Scenario

<details>
<summary>Scenario contract: stax-xml, Woodstox, and quick-xml comparator</summary>

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
  eventCount: number,
  checksum: fold(selected event data for tier)
}
~~~

Parsing methods:

- `stax-xml on Node`: built JavaScript iterable backend, run on Node, with tier-specific checksum folding.
- Woodstox: Java StAX `XMLStreamReader`, namespace-aware parsing disabled, coalescing enabled, DTD/external entities disabled, buffered file input.
- `quick-xml`: Rust `Reader` over buffered file input; declaration, PI, doctype, and comments are skipped; text is trimmed for checksum parity.
- Java 8 is the public Woodstox row because it is Woodstox's minimum runtime target; Java 25 is a separate verification row.

</details>

## Public Comparator Table

| Tier | stax-xml on Node | Woodstox on Java 8 | quick-xml | Node/Woodstox | Node/quick-xml |
| --- | ---: | ---: | ---: | ---: | ---: |
| count-only | 180.2 MiB/s | 346.3 MiB/s | 304.5 MiB/s | 0.52x | 0.59x |
| name-string-only | 141.6 MiB/s | 314.9 MiB/s | 268.9 MiB/s | 0.45x | 0.53x |
| text-string-only | 111.3 MiB/s | 315.8 MiB/s | 284.7 MiB/s | 0.35x | 0.39x |
| attr-value-string-only | 130.8 MiB/s | 315.2 MiB/s | 285.4 MiB/s | 0.41x | 0.46x |
| full-string | 100.9 MiB/s | 257.1 MiB/s | 228.9 MiB/s | 0.39x | 0.44x |

## Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Java 25 avg | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| count-only | 346.3 MiB/s | 301.4 MiB/s | -13.0% | 53.09 ms | ok |
| name-string-only | 314.9 MiB/s | 271.7 MiB/s | -13.7% | 58.88 ms | ok |
| text-string-only | 315.8 MiB/s | 292.8 MiB/s | -7.3% | 54.65 ms | ok |
| attr-value-string-only | 315.2 MiB/s | 248.6 MiB/s | -21.1% | 64.37 ms | ok |
| full-string | 257.1 MiB/s | 237.6 MiB/s | -7.6% | 67.34 ms | ok |

## Contract

- namespace off
- XML declaration/comment/PI/DOCTYPE skipped
- CDATA remains a separate event
- whitespace-only text skipped
- text trimmed before checksum
- entity decode off

Checksum and event counts are preserved by the compared rows for the current fixture. If a future fixture introduces namespaces or entity-heavy content, this contract must be reviewed before publishing the table.
