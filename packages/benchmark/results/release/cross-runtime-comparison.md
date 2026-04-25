# Cross-Runtime Parser Comparator

Generated: 2026-04-25T13:37:23.824Z

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

## Public Comparator Table

| Tier | stax-xml on Node | Woodstox on Java 8 | quick-xml | Node/Woodstox | Node/quick-xml |
| --- | ---: | ---: | ---: | ---: | ---: |
| count-only | 182.7 MiB/s | 309.4 MiB/s | 303.4 MiB/s | 0.59x | 0.60x |
| name-string-only | 138.2 MiB/s | 323.1 MiB/s | 256.5 MiB/s | 0.43x | 0.54x |
| text-string-only | 104.8 MiB/s | 316.2 MiB/s | 271.0 MiB/s | 0.33x | 0.39x |
| attr-value-string-only | 113.6 MiB/s | 294.1 MiB/s | 297.3 MiB/s | 0.39x | 0.38x |
| full-string | 93.1 MiB/s | 246.0 MiB/s | 214.8 MiB/s | 0.38x | 0.43x |

## Java 25 Verification

| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Java 25 avg | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| count-only | 309.4 MiB/s | 303.0 MiB/s | -2.1% | 52.80 ms | ok |
| name-string-only | 323.1 MiB/s | 276.2 MiB/s | -14.5% | 57.93 ms | ok |
| text-string-only | 316.2 MiB/s | 272.7 MiB/s | -13.8% | 58.68 ms | ok |
| attr-value-string-only | 294.1 MiB/s | 239.3 MiB/s | -18.6% | 66.85 ms | ok |
| full-string | 246.0 MiB/s | 226.2 MiB/s | -8.0% | 70.72 ms | ok |

## Contract

- namespace off
- XML declaration/comment/PI/DOCTYPE skipped
- CDATA remains a separate event
- whitespace-only text skipped
- text trimmed before checksum
- entity decode off

Checksum and event counts are preserved by the compared rows for the current fixture. If a future fixture introduces namespaces or entity-heavy content, this contract must be reviewed before publishing the table.
