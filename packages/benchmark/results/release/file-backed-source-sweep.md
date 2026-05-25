# File-Backed Source Sweep

Generated: 2026-05-25T02:54:58.771Z

Sweeps file-backed StreamReaderSync chunk size with demand-driven Iterable<Uint8Array[]> batches. This isolates source chunk sizing from Woodstox/quick-xml external parser comparisons; it is not an OS-cache-neutral disk benchmark.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk sizes: 16, 64, 256, 1024 KiB
- Batch size: 1
- Rows: 4
- Fastest: stax-stream-chunk-16kib 129.21 MiB/s, RSS 70.86 MiB
- Slowest: stax-stream-chunk-256kib 105.81 MiB/s, RSS 71.19 MiB
- Fastest/slowest ratio: 1.22x
- 200 MiB/s bounded counterexamples: 0

## Rows

| Row | Tool | Chunk KiB | MiB/s | Bounded | Max RSS | Events | Checksum |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: |
| `stax-stream-chunk-16kib` | stax-stream | 16 | 129.21 | yes | 70.86 MiB | 61236571 | -716099804 |
| `stax-stream-chunk-64kib` | stax-stream | 64 | 120.05 | yes | 71.27 MiB | 61236571 | -716099804 |
| `stax-stream-chunk-256kib` | stax-stream | 256 | 105.81 | yes | 71.19 MiB | 61236571 | -716099804 |
| `stax-stream-chunk-1024kib` | stax-stream | 1024 | 125.22 | yes | 123.52 MiB | 61236571 | -716099804 |

## Findings

- same-contract-preserved (CONTRACT_FACT): All sweep rows preserve a full-string checksum contract.
  - 61236571:-716099804
- chunk-size-headroom (BENCH_FACT): The fastest chunk size in this sweep was 16 KiB at 129.21 MiB/s; the slowest was 256 KiB at 105.81 MiB/s.
  - stax-stream-chunk-16kib=129.21 MiB/s rss=70.86 MiB
  - stax-stream-chunk-64kib=120.05 MiB/s rss=71.27 MiB
  - stax-stream-chunk-256kib=105.81 MiB/s rss=71.19 MiB
  - stax-stream-chunk-1024kib=125.22 MiB/s rss=123.52 MiB
- bounded-counterexample-search (COUNTEREXAMPLE_NOT_FOUND): The file-backed source chunk sweep applies the same 200 MiB/s bounded full-string counterexample rule to its rows.
  - stax-stream-chunk-16kib: bounded=true, mibPerSec=129.21
  - stax-stream-chunk-64kib: bounded=true, mibPerSec=120.05
  - stax-stream-chunk-256kib: bounded=true, mibPerSec=105.81
  - stax-stream-chunk-1024kib: bounded=true, mibPerSec=125.22

## Limits

- Rows are demand-driven file-backed byte-batch parser inputs, but this is not an OS-cache-neutral disk benchmark.
- `batchSize > 1` still triggers the current parser multi-chunk concat boundary; use batch size 1 to isolate chunk length.
- A missing counterexample in this sweep is not a JavaScript runtime ceiling proof.
