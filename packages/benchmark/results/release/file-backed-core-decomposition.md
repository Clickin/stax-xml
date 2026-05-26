# File-Backed Core Decomposition

Generated: 2026-05-26T07:49:28.379Z

Runs each parser-core consumption shape in a fresh Node process over the same demand-driven file-backed byte batches. Partial rows expose parser/frame headroom but are not full-string StAX counterexamples.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 32
- Batch size: 4
- Fastest row: stax-scan-all-no-decode 216.08 MiB/s, RSS 64.37 MiB
- Fastest full-string row: stax-raw-frame-name-id 129.66 MiB/s, RSS 61.26 MiB
- 200 MiB/s bounded full-string counterexamples: 0
- 200 MiB/s bounded partial/headroom rows: 2

## Rows

| Row | Family | MiB/s | Full string | Bounded | Max RSS | Events | Checksum |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: |
| `stax-scan-all-no-decode` | partial-scan | 216.08 | no | yes | 64.37 MiB | 61236571 | -1830981171 |
| `stax-raw-frame-span-stats` | partial-span-metadata | 210.19 | no | yes | 63.83 MiB | 61236571 | -1264359145 |
| `stax-raw-frame-semantic-checksum` | same-fields-no-string-materialization | 132.13 | no | yes | 65.66 MiB | 61236571 | -716099804 |
| `stax-stream` | full-string-materialization | 125.99 | yes | yes | 61.66 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id` | full-string-materialization | 129.66 | yes | yes | 61.26 MiB | 61236571 | -716099804 |

## Findings

- fresh-process-parser-core-decomposition (BENCH_FACT): Parser-core consumption shapes were measured in separate Node processes over the same file-backed source contract.
  - stax-scan-all-no-decode=216.08 MiB/s fullString=false
  - stax-raw-frame-span-stats=210.19 MiB/s fullString=false
  - stax-raw-frame-semantic-checksum=132.13 MiB/s fullString=false
  - stax-stream=125.99 MiB/s fullString=true
  - stax-raw-frame-name-id=129.66 MiB/s fullString=true
- same-fields-without-string-materialization (HEADROOM_EVIDENCE): The semantic byte-fold row preserves event count and checksum of the full-string row while avoiding JavaScript string materialization on ASCII spans.
  - stax-raw-frame-semantic-checksum: events=61236571, checksum=-716099804, mibPerSec=132.13
  - stax-stream: events=61236571, checksum=-716099804, mibPerSec=125.99
  - stax-raw-frame-name-id: events=61236571, checksum=-716099804, mibPerSec=129.66
- bounded-counterexample-search (COUNTEREXAMPLE_NOT_FOUND): Fastest bounded full-string row was stax-raw-frame-name-id at 129.66 MiB/s.
  - fastest=stax-scan-all-no-decode 216.08 MiB/s
  - fastestFullString=stax-raw-frame-name-id 129.66 MiB/s

## Limits

- Partial and semantic byte-fold rows are headroom evidence, not full-string materialization counterexamples.
- This isolates parser consumption shape over file-backed byte batches, not OS-cache-neutral disk throughput.
- A missing counterexample in this artifact is not a JavaScript runtime ceiling proof.
