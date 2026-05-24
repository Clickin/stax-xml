# File-Backed Source Sweep

Generated: 2026-05-24T23:31:05.334Z

Sweeps file-backed StreamReaderSync chunk size with demand-driven Iterable<Uint8Array[]> batches. This isolates source chunk sizing from Woodstox/quick-xml external parser comparisons; it is not an OS-cache-neutral disk benchmark.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk sizes: 16, 64, 256, 1024 KiB
- Batch size: 1
- Rows: 4
- Fastest: stax-stream-chunk-256kib 96.62 MiB/s, RSS 69.20 MiB
- Slowest: stax-stream-chunk-16kib 90.99 MiB/s, RSS 68.03 MiB
- Fastest/slowest ratio: 1.06x
- 200 MiB/s bounded counterexamples: 0

## Rows

| Row | Tool | Chunk KiB | MiB/s | Bounded | Max RSS | Events | Checksum |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: |
| `stax-stream-chunk-16kib` | stax-stream | 16 | 90.99 | yes | 68.03 MiB | 61236571 | -716099804 |
| `stax-stream-chunk-64kib` | stax-stream | 64 | 92.31 | yes | 67.93 MiB | 61236571 | -716099804 |
| `stax-stream-chunk-256kib` | stax-stream | 256 | 96.62 | yes | 69.20 MiB | 61236571 | -716099804 |
| `stax-stream-chunk-1024kib` | stax-stream | 1024 | 94.71 | yes | 135.53 MiB | 61236571 | -716099804 |

## Findings

- same-contract-preserved (CONTRACT_FACT): All sweep rows preserve a full-string checksum contract.
  - 61236571:-716099804
- chunk-size-headroom (BENCH_FACT): The fastest chunk size in this sweep was 256 KiB at 96.62 MiB/s; the slowest was 16 KiB at 90.99 MiB/s.
  - stax-stream-chunk-16kib=90.99 MiB/s rss=68.03 MiB
  - stax-stream-chunk-64kib=92.31 MiB/s rss=67.93 MiB
  - stax-stream-chunk-256kib=96.62 MiB/s rss=69.20 MiB
  - stax-stream-chunk-1024kib=94.71 MiB/s rss=135.53 MiB
- bounded-counterexample-search (COUNTEREXAMPLE_NOT_FOUND): The file-backed source chunk sweep applies the same 200 MiB/s bounded full-string counterexample rule to its rows.
  - stax-stream-chunk-16kib: bounded=true, mibPerSec=90.99
  - stax-stream-chunk-64kib: bounded=true, mibPerSec=92.31
  - stax-stream-chunk-256kib: bounded=true, mibPerSec=96.62
  - stax-stream-chunk-1024kib: bounded=true, mibPerSec=94.71

## Limits

- Rows are demand-driven file-backed byte-batch parser inputs, but this is not an OS-cache-neutral disk benchmark.
- `batchSize > 1` still triggers the current parser multi-chunk concat boundary; use batch size 1 to isolate chunk length.
- A missing counterexample in this sweep is not a JavaScript runtime ceiling proof.
