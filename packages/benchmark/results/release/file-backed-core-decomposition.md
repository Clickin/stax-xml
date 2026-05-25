# File-Backed Core Decomposition

Generated: 2026-05-25T22:37:57.833Z

Runs each parser-core consumption shape in a fresh Node process over the same demand-driven file-backed byte batches. Partial rows expose parser/frame headroom but are not full-string StAX counterexamples.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 32
- Batch size: 4
- Fastest row: stax-scan-all-no-decode 237.08 MiB/s, RSS 58.91 MiB
- Fastest full-string row: stax-raw-frame-name-id 148.64 MiB/s, RSS 60.72 MiB
- 200 MiB/s bounded full-string counterexamples: 0
- 200 MiB/s bounded partial/headroom rows: 1

## Rows

| Row | Family | MiB/s | Full string | Bounded | Max RSS | Events | Checksum |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: |
| `stax-scan-all-no-decode` | partial-scan | 237.08 | no | yes | 58.91 MiB | 61236571 | -1830981171 |
| `stax-raw-frame-semantic-checksum` | same-fields-no-string-materialization | 142.07 | no | yes | 60.53 MiB | 61236571 | -716099804 |
| `stax-stream` | full-string-materialization | 144.41 | yes | yes | 60.70 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id` | full-string-materialization | 148.64 | yes | yes | 60.72 MiB | 61236571 | -716099804 |

## Findings

- fresh-process-parser-core-decomposition (BENCH_FACT): Parser-core consumption shapes were measured in separate Node processes over the same file-backed source contract.
  - stax-scan-all-no-decode=237.08 MiB/s fullString=false
  - stax-raw-frame-semantic-checksum=142.07 MiB/s fullString=false
  - stax-stream=144.41 MiB/s fullString=true
  - stax-raw-frame-name-id=148.64 MiB/s fullString=true
- same-fields-without-string-materialization (HEADROOM_EVIDENCE): The semantic byte-fold row preserves event count and checksum of the full-string row while avoiding JavaScript string materialization on ASCII spans.
  - stax-raw-frame-semantic-checksum: events=61236571, checksum=-716099804, mibPerSec=142.07
  - stax-stream: events=61236571, checksum=-716099804, mibPerSec=144.41
  - stax-raw-frame-name-id: events=61236571, checksum=-716099804, mibPerSec=148.64
- bounded-counterexample-search (COUNTEREXAMPLE_NOT_FOUND): Fastest bounded full-string row was stax-raw-frame-name-id at 148.64 MiB/s.
  - fastest=stax-scan-all-no-decode 237.08 MiB/s
  - fastestFullString=stax-raw-frame-name-id 148.64 MiB/s

## Limits

- Partial and semantic byte-fold rows are headroom evidence, not full-string materialization counterexamples.
- This isolates parser consumption shape over file-backed byte batches, not OS-cache-neutral disk throughput.
- A missing counterexample in this artifact is not a JavaScript runtime ceiling proof.
