# File-Backed Batch Size Sweep

Generated: 2026-05-25T02:49:32.983Z

Sweeps the number of Uint8Array chunks yielded per demand-driven Iterable<Uint8Array[]> batch at a fixed file chunk size. This tests whether array batching itself exposes headroom without switching to direct ReadableStream consumption or pre-materializing the XML file.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 64
- Batch sizes: 1, 2, 4, 8, 16
- Rows: 5
- Fastest: stax-stream-batch-2 135.13 MiB/s, RSS 71.22 MiB
- Slowest: stax-stream-batch-8 131.36 MiB/s, RSS 127.19 MiB
- Fastest/slowest ratio: 1.03x
- 200 MiB/s bounded counterexamples: 0

## Rows

| Row | Tool | Batch Size | MiB/s | Bounded | Max RSS | Events | Checksum |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: |
| `stax-stream-batch-1` | stax-stream | 1 | 134.15 | yes | 70.70 MiB | 61236571 | -716099804 |
| `stax-stream-batch-2` | stax-stream | 2 | 135.13 | yes | 71.22 MiB | 61236571 | -716099804 |
| `stax-stream-batch-4` | stax-stream | 4 | 133.10 | yes | 71.59 MiB | 61236571 | -716099804 |
| `stax-stream-batch-8` | stax-stream | 8 | 131.36 | yes | 127.19 MiB | 61236571 | -716099804 |
| `stax-stream-batch-16` | stax-stream | 16 | 132.76 | yes | 136.93 MiB | 61236571 | -716099804 |

## Findings

- same-contract-preserved (CONTRACT_FACT): All batch-size rows preserve a full-string checksum contract.
  - 61236571:-716099804
- batch-size-headroom (BENCH_FACT): The fastest batch size in this sweep was 2 at 135.13 MiB/s; the slowest was 8 at 131.36 MiB/s.
  - stax-stream-batch-1=134.15 MiB/s rss=70.70 MiB
  - stax-stream-batch-2=135.13 MiB/s rss=71.22 MiB
  - stax-stream-batch-4=133.10 MiB/s rss=71.59 MiB
  - stax-stream-batch-8=131.36 MiB/s rss=127.19 MiB
  - stax-stream-batch-16=132.76 MiB/s rss=136.93 MiB
- bounded-counterexample-search (COUNTEREXAMPLE_NOT_FOUND): The file-backed batch-size sweep applies the same 200 MiB/s bounded full-string counterexample rule to its rows.
  - stax-stream-batch-1: bounded=true, mibPerSec=134.15
  - stax-stream-batch-2: bounded=true, mibPerSec=135.13
  - stax-stream-batch-4: bounded=true, mibPerSec=133.10
  - stax-stream-batch-8: bounded=true, mibPerSec=131.36
  - stax-stream-batch-16: bounded=true, mibPerSec=132.76

## Limits

- Rows are demand-driven file-backed `Iterable<Uint8Array[]>` parser inputs; each yielded array contains at most the configured number of chunks.
- This is not a direct Web `ReadableStream` row and does not pre-materialize the full XML file.
- A missing counterexample in this sweep is not a JavaScript runtime ceiling proof.
