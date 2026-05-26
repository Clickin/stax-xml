# File-Backed Core Decomposition

Generated: 2026-05-26T01:03:19.165Z

Runs each parser-core consumption shape in a fresh Node process over the same demand-driven file-backed byte batches. Partial rows expose parser/frame headroom but are not full-string StAX counterexamples.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 32
- Batch size: 4
- Fastest row: stax-raw-frame-span-stats 240.08 MiB/s, RSS 64.04 MiB
- Fastest full-string row: stax-raw-frame-name-id 142.25 MiB/s, RSS 61.13 MiB
- 200 MiB/s bounded full-string counterexamples: 0
- 200 MiB/s bounded partial/headroom rows: 2

## Rows

| Row | Family | MiB/s | Full string | Bounded | Max RSS | Events | Checksum |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: |
| `stax-scan-all-no-decode` | partial-scan | 234.57 | no | yes | 63.70 MiB | 61236571 | -1830981171 |
| `stax-raw-frame-span-stats` | partial-span-metadata | 240.08 | no | yes | 64.04 MiB | 61236571 | -1264359145 |
| `stax-raw-frame-semantic-checksum` | same-fields-no-string-materialization | 144.67 | no | yes | 66.12 MiB | 61236571 | -716099804 |
| `stax-stream` | full-string-materialization | 113.62 | yes | yes | 61.69 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id` | full-string-materialization | 142.25 | yes | yes | 61.13 MiB | 61236571 | -716099804 |

## Findings

- fresh-process-parser-core-decomposition (BENCH_FACT): Parser-core consumption shapes were measured in separate Node processes over the same file-backed source contract.
  - stax-scan-all-no-decode=234.57 MiB/s fullString=false
  - stax-raw-frame-span-stats=240.08 MiB/s fullString=false
  - stax-raw-frame-semantic-checksum=144.67 MiB/s fullString=false
  - stax-stream=113.62 MiB/s fullString=true
  - stax-raw-frame-name-id=142.25 MiB/s fullString=true
- same-fields-without-string-materialization (HEADROOM_EVIDENCE): The semantic byte-fold row preserves event count and checksum of the full-string row while avoiding JavaScript string materialization on ASCII spans.
  - stax-raw-frame-semantic-checksum: events=61236571, checksum=-716099804, mibPerSec=144.67
  - stax-stream: events=61236571, checksum=-716099804, mibPerSec=113.62
  - stax-raw-frame-name-id: events=61236571, checksum=-716099804, mibPerSec=142.25
- bounded-counterexample-search (COUNTEREXAMPLE_NOT_FOUND): Fastest bounded full-string row was stax-raw-frame-name-id at 142.25 MiB/s.
  - fastest=stax-raw-frame-span-stats 240.08 MiB/s
  - fastestFullString=stax-raw-frame-name-id 142.25 MiB/s

## Limits

- Partial and semantic byte-fold rows are headroom evidence, not full-string materialization counterexamples.
- This isolates parser consumption shape over file-backed byte batches, not OS-cache-neutral disk throughput.
- A missing counterexample in this artifact is not a JavaScript runtime ceiling proof.
