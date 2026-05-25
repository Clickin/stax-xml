# File-Backed Source Sweep

Generated: 2026-05-25T22:29:38.413Z

Sweeps file-backed StreamReaderSync chunk size with demand-driven Iterable<Uint8Array[]> batches at a fixed batch size. This isolates chunk sizing inside the same JavaScript source contract from Woodstox/quick-xml external parser comparisons; it is not an OS-cache-neutral disk benchmark.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk sizes: 16, 32, 64, 128, 256, 512 KiB
- Batch size: 4
- Rows: 12
- Fastest: stax-raw-frame-name-id-chunk-32kib 151.70 MiB/s, RSS 59.23 MiB
- Slowest: stax-stream-chunk-16kib 135.59 MiB/s, RSS 59.01 MiB
- Fastest/slowest ratio: 1.12x
- 200 MiB/s bounded counterexamples: 0

## Rows

| Row | Tool | Chunk KiB | MiB/s | Bounded | Max RSS | Events | Checksum |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: |
| `stax-stream-chunk-16kib` | stax-stream | 16 | 135.59 | yes | 59.01 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-chunk-16kib` | stax-raw-frame-name-id | 16 | 149.22 | yes | 59.05 MiB | 61236571 | -716099804 |
| `stax-stream-chunk-32kib` | stax-stream | 32 | 139.10 | yes | 59.11 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-chunk-32kib` | stax-raw-frame-name-id | 32 | 151.70 | yes | 59.23 MiB | 61236571 | -716099804 |
| `stax-stream-chunk-64kib` | stax-stream | 64 | 139.41 | yes | 59.74 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-chunk-64kib` | stax-raw-frame-name-id | 64 | 149.77 | yes | 60.63 MiB | 61236571 | -716099804 |
| `stax-stream-chunk-128kib` | stax-stream | 128 | 142.74 | yes | 80.66 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-chunk-128kib` | stax-raw-frame-name-id | 128 | 142.12 | yes | 62.48 MiB | 61236571 | -716099804 |
| `stax-stream-chunk-256kib` | stax-stream | 256 | 138.80 | yes | 123.99 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-chunk-256kib` | stax-raw-frame-name-id | 256 | 148.83 | yes | 121.28 MiB | 61236571 | -716099804 |
| `stax-stream-chunk-512kib` | stax-stream | 512 | 138.27 | yes | 112.02 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-chunk-512kib` | stax-raw-frame-name-id | 512 | 146.17 | yes | 110.47 MiB | 61236571 | -716099804 |

## Findings

- same-contract-preserved (CONTRACT_FACT): All sweep rows preserve a full-string checksum contract.
  - 61236571:-716099804
- chunk-size-headroom (BENCH_FACT): The fastest chunk size in this sweep was 32 KiB at 151.70 MiB/s; the slowest was 16 KiB at 135.59 MiB/s.
  - stax-stream-chunk-16kib=135.59 MiB/s rss=59.01 MiB
  - stax-raw-frame-name-id-chunk-16kib=149.22 MiB/s rss=59.05 MiB
  - stax-stream-chunk-32kib=139.10 MiB/s rss=59.11 MiB
  - stax-raw-frame-name-id-chunk-32kib=151.70 MiB/s rss=59.23 MiB
  - stax-stream-chunk-64kib=139.41 MiB/s rss=59.74 MiB
  - stax-raw-frame-name-id-chunk-64kib=149.77 MiB/s rss=60.63 MiB
  - stax-stream-chunk-128kib=142.74 MiB/s rss=80.66 MiB
  - stax-raw-frame-name-id-chunk-128kib=142.12 MiB/s rss=62.48 MiB
  - stax-stream-chunk-256kib=138.80 MiB/s rss=123.99 MiB
  - stax-raw-frame-name-id-chunk-256kib=148.83 MiB/s rss=121.28 MiB
  - stax-stream-chunk-512kib=138.27 MiB/s rss=112.02 MiB
  - stax-raw-frame-name-id-chunk-512kib=146.17 MiB/s rss=110.47 MiB
- bounded-counterexample-search (COUNTEREXAMPLE_NOT_FOUND): The file-backed source chunk sweep applies the same 200 MiB/s bounded full-string counterexample rule to its rows.
  - stax-stream-chunk-16kib: bounded=true, mibPerSec=135.59
  - stax-raw-frame-name-id-chunk-16kib: bounded=true, mibPerSec=149.22
  - stax-stream-chunk-32kib: bounded=true, mibPerSec=139.10
  - stax-raw-frame-name-id-chunk-32kib: bounded=true, mibPerSec=151.70
  - stax-stream-chunk-64kib: bounded=true, mibPerSec=139.41
  - stax-raw-frame-name-id-chunk-64kib: bounded=true, mibPerSec=149.77
  - stax-stream-chunk-128kib: bounded=true, mibPerSec=142.74
  - stax-raw-frame-name-id-chunk-128kib: bounded=true, mibPerSec=142.12
  - stax-stream-chunk-256kib: bounded=true, mibPerSec=138.80
  - stax-raw-frame-name-id-chunk-256kib: bounded=true, mibPerSec=148.83
  - stax-stream-chunk-512kib: bounded=true, mibPerSec=138.27
  - stax-raw-frame-name-id-chunk-512kib: bounded=true, mibPerSec=146.17

## Limits

- Rows are demand-driven file-backed byte-batch parser inputs, but this is not an OS-cache-neutral disk benchmark.
- `batchSize > 1` intentionally keeps the parser on its current multi-chunk concat boundary while chunk length varies.
- A missing counterexample in this sweep is not a JavaScript runtime ceiling proof.
