# File-Backed Core Decomposition

Generated: 2026-05-24T23:47:11.808Z

Runs each parser-core consumption shape in a fresh Node process over the same demand-driven file-backed byte batches. Partial rows expose parser/frame headroom but are not full-string StAX counterexamples.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 256
- Batch size: 1
- Fastest row: stax-scan-all-no-decode 178.46 MiB/s, RSS 67.43 MiB
- Fastest full-string row: stax-stream 95.08 MiB/s, RSS 68.86 MiB
- 200 MiB/s bounded full-string counterexamples: 0
- 200 MiB/s bounded partial/headroom rows: 0

## Rows

| Row | Family | MiB/s | Full string | Bounded | Max RSS | Events | Checksum |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: |
| `stax-scan-all-no-decode` | partial-scan | 178.46 | no | yes | 67.43 MiB | 61236571 | -1830981171 |
| `stax-raw-frame-semantic-checksum` | same-fields-no-string-materialization | 103.38 | no | yes | 129.43 MiB | 61236571 | -716099804 |
| `stax-stream` | full-string-materialization | 95.08 | yes | yes | 68.86 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id` | full-string-materialization | 83.66 | yes | yes | 69.14 MiB | 61236571 | -716099804 |

## Findings

- fresh-process-parser-core-decomposition (BENCH_FACT): Parser-core consumption shapes were measured in separate Node processes over the same file-backed source contract.
  - stax-scan-all-no-decode=178.46 MiB/s fullString=false
  - stax-raw-frame-semantic-checksum=103.38 MiB/s fullString=false
  - stax-stream=95.08 MiB/s fullString=true
  - stax-raw-frame-name-id=83.66 MiB/s fullString=true
- same-fields-without-string-materialization (HEADROOM_EVIDENCE): The semantic byte-fold row preserves event count and checksum of the full-string row while avoiding JavaScript string materialization on ASCII spans.
  - stax-raw-frame-semantic-checksum: events=61236571, checksum=-716099804, mibPerSec=103.38
  - stax-stream: events=61236571, checksum=-716099804, mibPerSec=95.08
  - stax-raw-frame-name-id: events=61236571, checksum=-716099804, mibPerSec=83.66
- bounded-counterexample-search (COUNTEREXAMPLE_NOT_FOUND): Fastest bounded full-string row was stax-stream at 95.08 MiB/s.
  - fastest=stax-scan-all-no-decode 178.46 MiB/s
  - fastestFullString=stax-stream 95.08 MiB/s

## Limits

- Partial and semantic byte-fold rows are headroom evidence, not full-string materialization counterexamples.
- This isolates parser consumption shape over file-backed byte batches, not OS-cache-neutral disk throughput.
- A missing counterexample in this artifact is not a JavaScript runtime ceiling proof.
