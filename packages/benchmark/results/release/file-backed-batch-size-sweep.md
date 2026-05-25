# File-Backed Batch Size Sweep

Generated: 2026-05-25T17:46:19.902Z

Sweeps the number of Uint8Array chunks yielded per demand-driven Iterable<Uint8Array[]> batch at a fixed file chunk size. This tests whether array batching itself exposes headroom without switching to direct ReadableStream consumption or pre-materializing the XML file.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 64
- Batch sizes: 1, 2, 4, 8, 16
- Rows: 10
- Fastest: stax-raw-frame-name-id-batch-4 146.08 MiB/s, RSS 73.26 MiB
- Slowest: stax-stream-batch-2 115.66 MiB/s, RSS 72.05 MiB
- Fastest/slowest ratio: 1.26x
- 200 MiB/s bounded counterexamples: 0

## Rows

| Row | Tool | Batch Size | MiB/s | Bounded | Max RSS | Events | Checksum |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: |
| `stax-stream-batch-1` | stax-stream | 1 | 130.99 | yes | 71.31 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-batch-1` | stax-raw-frame-name-id | 1 | 145.57 | yes | 71.85 MiB | 61236571 | -716099804 |
| `stax-stream-batch-2` | stax-stream | 2 | 115.66 | yes | 72.05 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-batch-2` | stax-raw-frame-name-id | 2 | 145.30 | yes | 72.24 MiB | 61236571 | -716099804 |
| `stax-stream-batch-4` | stax-stream | 4 | 137.08 | yes | 70.92 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-batch-4` | stax-raw-frame-name-id | 4 | 146.08 | yes | 73.26 MiB | 61236571 | -716099804 |
| `stax-stream-batch-8` | stax-stream | 8 | 135.97 | yes | 128.02 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-batch-8` | stax-raw-frame-name-id | 8 | 141.93 | yes | 72.77 MiB | 61236571 | -716099804 |
| `stax-stream-batch-16` | stax-stream | 16 | 128.60 | yes | 135.66 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-batch-16` | stax-raw-frame-name-id | 16 | 141.38 | yes | 94.96 MiB | 61236571 | -716099804 |

## Findings

- same-contract-preserved (CONTRACT_FACT): All batch-size rows preserve a full-string checksum contract.
  - 61236571:-716099804
- batch-size-headroom (BENCH_FACT): The fastest batch size in this sweep was 4 at 146.08 MiB/s; the slowest was 2 at 115.66 MiB/s.
  - stax-stream-batch-1=130.99 MiB/s rss=71.31 MiB
  - stax-raw-frame-name-id-batch-1=145.57 MiB/s rss=71.85 MiB
  - stax-stream-batch-2=115.66 MiB/s rss=72.05 MiB
  - stax-raw-frame-name-id-batch-2=145.30 MiB/s rss=72.24 MiB
  - stax-stream-batch-4=137.08 MiB/s rss=70.92 MiB
  - stax-raw-frame-name-id-batch-4=146.08 MiB/s rss=73.26 MiB
  - stax-stream-batch-8=135.97 MiB/s rss=128.02 MiB
  - stax-raw-frame-name-id-batch-8=141.93 MiB/s rss=72.77 MiB
  - stax-stream-batch-16=128.60 MiB/s rss=135.66 MiB
  - stax-raw-frame-name-id-batch-16=141.38 MiB/s rss=94.96 MiB
- bounded-counterexample-search (COUNTEREXAMPLE_NOT_FOUND): The file-backed batch-size sweep applies the same 200 MiB/s bounded full-string counterexample rule to its rows.
  - stax-stream-batch-1: bounded=true, mibPerSec=130.99
  - stax-raw-frame-name-id-batch-1: bounded=true, mibPerSec=145.57
  - stax-stream-batch-2: bounded=true, mibPerSec=115.66
  - stax-raw-frame-name-id-batch-2: bounded=true, mibPerSec=145.30
  - stax-stream-batch-4: bounded=true, mibPerSec=137.08
  - stax-raw-frame-name-id-batch-4: bounded=true, mibPerSec=146.08
  - stax-stream-batch-8: bounded=true, mibPerSec=135.97
  - stax-raw-frame-name-id-batch-8: bounded=true, mibPerSec=141.93
  - stax-stream-batch-16: bounded=true, mibPerSec=128.60
  - stax-raw-frame-name-id-batch-16: bounded=true, mibPerSec=141.38

## Limits

- Rows are demand-driven file-backed `Iterable<Uint8Array[]>` parser inputs; each yielded array contains at most the configured number of chunks.
- This is not a direct Web `ReadableStream` row and does not pre-materialize the full XML file.
- A missing counterexample in this sweep is not a JavaScript runtime ceiling proof.
