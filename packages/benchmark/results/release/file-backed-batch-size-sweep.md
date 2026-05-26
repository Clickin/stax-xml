# File-Backed Batch Size Sweep

Generated: 2026-05-26T01:52:12.602Z

Sweeps the number of Uint8Array chunks yielded per demand-driven Iterable<Uint8Array[]> batch at a fixed file chunk size. This tests whether array batching itself exposes headroom without switching to direct ReadableStream consumption or pre-materializing the XML file.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 32
- Batch sizes: 1, 2, 4, 8, 16, 32, 64
- Rows: 14
- Fastest: stax-raw-frame-name-id-batch-8 152.11 MiB/s, RSS 61.77 MiB
- Slowest: stax-raw-frame-name-id-batch-1 130.09 MiB/s, RSS 60.42 MiB
- Fastest/slowest ratio: 1.17x
- 200 MiB/s bounded counterexamples: 0

## Rows

| Row | Tool | Batch Size | MiB/s | Bounded | Max RSS | Events | Checksum |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: |
| `stax-stream-batch-1` | stax-stream | 1 | 140.55 | yes | 60.19 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-batch-1` | stax-raw-frame-name-id | 1 | 130.09 | yes | 60.42 MiB | 61236571 | -716099804 |
| `stax-stream-batch-2` | stax-stream | 2 | 139.20 | yes | 60.55 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-batch-2` | stax-raw-frame-name-id | 2 | 130.30 | yes | 60.83 MiB | 61236571 | -716099804 |
| `stax-stream-batch-4` | stax-stream | 4 | 140.89 | yes | 60.95 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-batch-4` | stax-raw-frame-name-id | 4 | 130.57 | yes | 61.64 MiB | 61236571 | -716099804 |
| `stax-stream-batch-8` | stax-stream | 8 | 138.89 | yes | 60.25 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-batch-8` | stax-raw-frame-name-id | 8 | 152.11 | yes | 61.77 MiB | 61236571 | -716099804 |
| `stax-stream-batch-16` | stax-stream | 16 | 144.45 | yes | 95.80 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-batch-16` | stax-raw-frame-name-id | 16 | 148.07 | yes | 63.54 MiB | 61236571 | -716099804 |
| `stax-stream-batch-32` | stax-stream | 32 | 136.20 | yes | 98.45 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-batch-32` | stax-raw-frame-name-id | 32 | 148.69 | yes | 69.52 MiB | 61236571 | -716099804 |
| `stax-stream-batch-64` | stax-stream | 64 | 136.92 | yes | 121.50 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-batch-64` | stax-raw-frame-name-id | 64 | 148.68 | yes | 87.03 MiB | 61236571 | -716099804 |

## Findings

- same-contract-preserved (CONTRACT_FACT): All batch-size rows preserve a full-string checksum contract.
  - 61236571:-716099804
- batch-size-headroom (BENCH_FACT): The fastest batch size in this sweep was 8 at 152.11 MiB/s; the slowest was 1 at 130.09 MiB/s.
  - stax-stream-batch-1=140.55 MiB/s rss=60.19 MiB
  - stax-raw-frame-name-id-batch-1=130.09 MiB/s rss=60.42 MiB
  - stax-stream-batch-2=139.20 MiB/s rss=60.55 MiB
  - stax-raw-frame-name-id-batch-2=130.30 MiB/s rss=60.83 MiB
  - stax-stream-batch-4=140.89 MiB/s rss=60.95 MiB
  - stax-raw-frame-name-id-batch-4=130.57 MiB/s rss=61.64 MiB
  - stax-stream-batch-8=138.89 MiB/s rss=60.25 MiB
  - stax-raw-frame-name-id-batch-8=152.11 MiB/s rss=61.77 MiB
  - stax-stream-batch-16=144.45 MiB/s rss=95.80 MiB
  - stax-raw-frame-name-id-batch-16=148.07 MiB/s rss=63.54 MiB
  - stax-stream-batch-32=136.20 MiB/s rss=98.45 MiB
  - stax-raw-frame-name-id-batch-32=148.69 MiB/s rss=69.52 MiB
  - stax-stream-batch-64=136.92 MiB/s rss=121.50 MiB
  - stax-raw-frame-name-id-batch-64=148.68 MiB/s rss=87.03 MiB
- bounded-counterexample-search (COUNTEREXAMPLE_NOT_FOUND): The file-backed batch-size sweep applies the same 200 MiB/s bounded full-string counterexample rule to its rows.
  - stax-stream-batch-1: bounded=true, mibPerSec=140.55
  - stax-raw-frame-name-id-batch-1: bounded=true, mibPerSec=130.09
  - stax-stream-batch-2: bounded=true, mibPerSec=139.20
  - stax-raw-frame-name-id-batch-2: bounded=true, mibPerSec=130.30
  - stax-stream-batch-4: bounded=true, mibPerSec=140.89
  - stax-raw-frame-name-id-batch-4: bounded=true, mibPerSec=130.57
  - stax-stream-batch-8: bounded=true, mibPerSec=138.89
  - stax-raw-frame-name-id-batch-8: bounded=true, mibPerSec=152.11
  - stax-stream-batch-16: bounded=true, mibPerSec=144.45
  - stax-raw-frame-name-id-batch-16: bounded=true, mibPerSec=148.07
  - stax-stream-batch-32: bounded=true, mibPerSec=136.20
  - stax-raw-frame-name-id-batch-32: bounded=true, mibPerSec=148.69
  - stax-stream-batch-64: bounded=true, mibPerSec=136.92
  - stax-raw-frame-name-id-batch-64: bounded=true, mibPerSec=148.68

## Limits

- Rows are demand-driven file-backed `Iterable<Uint8Array[]>` parser inputs; each yielded array contains at most the configured number of chunks.
- This is not a direct Web `ReadableStream` row and does not pre-materialize the full XML file.
- A missing counterexample in this sweep is not a JavaScript runtime ceiling proof.
