# File-Backed Batch Size Sweep

Generated: 2026-05-26T00:26:03.836Z

Sweeps the number of Uint8Array chunks yielded per demand-driven Iterable<Uint8Array[]> batch at a fixed file chunk size. This tests whether array batching itself exposes headroom without switching to direct ReadableStream consumption or pre-materializing the XML file.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 32
- Batch sizes: 1, 2, 4, 8, 16
- Rows: 10
- Fastest: stax-raw-frame-name-id-batch-16 150.90 MiB/s, RSS 69.70 MiB
- Slowest: stax-stream-batch-8 124.50 MiB/s, RSS 61.86 MiB
- Fastest/slowest ratio: 1.21x
- 200 MiB/s bounded counterexamples: 0

## Rows

| Row | Tool | Batch Size | MiB/s | Bounded | Max RSS | Events | Checksum |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: |
| `stax-stream-batch-1` | stax-stream | 1 | 131.66 | yes | 60.77 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-batch-1` | stax-raw-frame-name-id | 1 | 142.19 | yes | 66.44 MiB | 61236571 | -716099804 |
| `stax-stream-batch-2` | stax-stream | 2 | 133.61 | yes | 60.72 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-batch-2` | stax-raw-frame-name-id | 2 | 142.79 | yes | 66.99 MiB | 61236571 | -716099804 |
| `stax-stream-batch-4` | stax-stream | 4 | 133.46 | yes | 61.36 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-batch-4` | stax-raw-frame-name-id | 4 | 141.27 | yes | 67.03 MiB | 61236571 | -716099804 |
| `stax-stream-batch-8` | stax-stream | 8 | 124.50 | yes | 61.86 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-batch-8` | stax-raw-frame-name-id | 8 | 150.60 | yes | 68.58 MiB | 61236571 | -716099804 |
| `stax-stream-batch-16` | stax-stream | 16 | 128.93 | yes | 96.54 MiB | 61236571 | -716099804 |
| `stax-raw-frame-name-id-batch-16` | stax-raw-frame-name-id | 16 | 150.90 | yes | 69.70 MiB | 61236571 | -716099804 |

## Findings

- same-contract-preserved (CONTRACT_FACT): All batch-size rows preserve a full-string checksum contract.
  - 61236571:-716099804
- batch-size-headroom (BENCH_FACT): The fastest batch size in this sweep was 16 at 150.90 MiB/s; the slowest was 8 at 124.50 MiB/s.
  - stax-stream-batch-1=131.66 MiB/s rss=60.77 MiB
  - stax-raw-frame-name-id-batch-1=142.19 MiB/s rss=66.44 MiB
  - stax-stream-batch-2=133.61 MiB/s rss=60.72 MiB
  - stax-raw-frame-name-id-batch-2=142.79 MiB/s rss=66.99 MiB
  - stax-stream-batch-4=133.46 MiB/s rss=61.36 MiB
  - stax-raw-frame-name-id-batch-4=141.27 MiB/s rss=67.03 MiB
  - stax-stream-batch-8=124.50 MiB/s rss=61.86 MiB
  - stax-raw-frame-name-id-batch-8=150.60 MiB/s rss=68.58 MiB
  - stax-stream-batch-16=128.93 MiB/s rss=96.54 MiB
  - stax-raw-frame-name-id-batch-16=150.90 MiB/s rss=69.70 MiB
- bounded-counterexample-search (COUNTEREXAMPLE_NOT_FOUND): The file-backed batch-size sweep applies the same 200 MiB/s bounded full-string counterexample rule to its rows.
  - stax-stream-batch-1: bounded=true, mibPerSec=131.66
  - stax-raw-frame-name-id-batch-1: bounded=true, mibPerSec=142.19
  - stax-stream-batch-2: bounded=true, mibPerSec=133.61
  - stax-raw-frame-name-id-batch-2: bounded=true, mibPerSec=142.79
  - stax-stream-batch-4: bounded=true, mibPerSec=133.46
  - stax-raw-frame-name-id-batch-4: bounded=true, mibPerSec=141.27
  - stax-stream-batch-8: bounded=true, mibPerSec=124.50
  - stax-raw-frame-name-id-batch-8: bounded=true, mibPerSec=150.60
  - stax-stream-batch-16: bounded=true, mibPerSec=128.93
  - stax-raw-frame-name-id-batch-16: bounded=true, mibPerSec=150.90

## Limits

- Rows are demand-driven file-backed `Iterable<Uint8Array[]>` parser inputs; each yielded array contains at most the configured number of chunks.
- This is not a direct Web `ReadableStream` row and does not pre-materialize the full XML file.
- A missing counterexample in this sweep is not a JavaScript runtime ceiling proof.
