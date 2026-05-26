# File-Backed Core Decomposition

Generated: 2026-05-26T00:51:18.133Z

Runs each parser-core consumption shape in a fresh Node process over the same demand-driven file-backed byte batches. Partial rows expose parser/frame headroom but are not full-string StAX counterexamples.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 32
- Batch size: 4
- Fastest row: stax-scan-all-no-decode 241.63 MiB/s, RSS 64.20 MiB
- Fastest full-string row: stax-raw-frame-name-id 140.68 MiB/s, RSS 60.87 MiB
- 200 MiB/s bounded full-string counterexamples: 0
- 200 MiB/s bounded partial/headroom rows: 1

## Rows

| Row | Family | MiB/s | Full string | Bounded | Max RSS | Events | Checksum |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: |
| `stax-scan-all-no-decode` | partial-scan | 241.63 | no | yes | 64.20 MiB | 61236571 | -1830981171 |
| `stax-raw-frame-semantic-checksum` | same-fields-no-string-materialization | 142.24 | no | yes | 65.55 MiB | 61236571 | -716099804 |
| `stax-stream` | full-string-materialization | 126.32 | yes | yes | 62.37 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id` | full-string-materialization | 140.68 | yes | yes | 60.87 MiB | 61236571 | -716099804 |

## Findings

- fresh-process-parser-core-decomposition (BENCH_FACT): Parser-core consumption shapes were measured in separate Node processes over the same file-backed source contract.
  - stax-scan-all-no-decode=241.63 MiB/s fullString=false
  - stax-raw-frame-semantic-checksum=142.24 MiB/s fullString=false
  - stax-stream=126.32 MiB/s fullString=true
  - stax-raw-frame-name-id=140.68 MiB/s fullString=true
- same-fields-without-string-materialization (HEADROOM_EVIDENCE): The semantic byte-fold row preserves event count and checksum of the full-string row while avoiding JavaScript string materialization on ASCII spans.
  - stax-raw-frame-semantic-checksum: events=61236571, checksum=-716099804, mibPerSec=142.24
  - stax-stream: events=61236571, checksum=-716099804, mibPerSec=126.32
  - stax-raw-frame-name-id: events=61236571, checksum=-716099804, mibPerSec=140.68
- bounded-counterexample-search (COUNTEREXAMPLE_NOT_FOUND): Fastest bounded full-string row was stax-raw-frame-name-id at 140.68 MiB/s.
  - fastest=stax-scan-all-no-decode 241.63 MiB/s
  - fastestFullString=stax-raw-frame-name-id 140.68 MiB/s

## Limits

- Partial and semantic byte-fold rows are headroom evidence, not full-string materialization counterexamples.
- This isolates parser consumption shape over file-backed byte batches, not OS-cache-neutral disk throughput.
- A missing counterexample in this artifact is not a JavaScript runtime ceiling proof.
