# EventReader Byte-Batch Cross-Process Stability

Generated: 2026-05-24T18:18:06.233Z

This report repeats selected EventReader byte-batch source rows in fresh runtime processes.
All selected rows preserve the public event-object full-string checksum contract and demand-driven source consumption.
It is cross-process timing evidence for the recorded machine, not a proof that JavaScript runtimes have no further headroom.

## Options

- Runtimes: node, bun, deno
- Process runs: 3
- Child warmups: 0
- Fixture shape: corpus-cycle
- Corpus file: G:\programming\stax-xml\packages\benchmark\assets\books.xml
- Corpus chunk: 64 KiB
- Size GiB: 1
- Batch size: 16
- Bounded RSS gate: 512.0 MiB
- Variants: readableStreamBatch16, asyncByteBatch16, syncIterableBatch16

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\event-reader-byte-batch-corpus-release
- Committed: no

## Runtime: node

- Engine: undefined
- Node: undefined
- Platform: win32-x64
- CPU: undefined
- Fixture bytes: 1073744736

| Variant | Family | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| readableStreamBatch16 | readable-stream | 52.45 MiB/s | 52.20 MiB/s | 52.66 MiB/s | 0.9% | 52.20, 52.66, 52.50 | yes | yes | not-found | 197.6 MiB |
| asyncByteBatch16 | async-byte-batch | 47.44 MiB/s | 47.00 MiB/s | 48.08 MiB/s | 2.3% | 47.00, 47.25, 48.08 | yes | yes | not-found | 197.2 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | 74.68 MiB/s | 73.99 MiB/s | 75.93 MiB/s | 2.6% | 75.93, 73.99, 74.11 | yes | yes | not-found | 205.7 MiB |

### Parity

- Full rows stable across processes: yes
- Rows: readableStreamBatch16, asyncByteBatch16, syncIterableBatch16

## Runtime: bun

- Engine: undefined
- Node: undefined
- Bun: 1.3.13
- Platform: win32-x64
- CPU: undefined
- Fixture bytes: 1073744736

| Variant | Family | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| readableStreamBatch16 | readable-stream | 39.31 MiB/s | 38.90 MiB/s | 39.96 MiB/s | 2.7% | 39.08, 38.90, 39.96 | yes | yes | not-found | 202.3 MiB |
| asyncByteBatch16 | async-byte-batch | 36.77 MiB/s | 36.34 MiB/s | 37.01 MiB/s | 1.8% | 36.34, 37.01, 36.96 | yes | yes | not-found | 205.3 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | 53.38 MiB/s | 52.94 MiB/s | 53.69 MiB/s | 1.4% | 52.94, 53.69, 53.51 | yes | yes | not-found | 209.4 MiB |

### Parity

- Full rows stable across processes: yes
- Rows: readableStreamBatch16, asyncByteBatch16, syncIterableBatch16

## Runtime: deno

- Engine: undefined
- Node: undefined
- Deno: 2.7.13
- Platform: win32-x64
- CPU: undefined
- Fixture bytes: 1073744736

| Variant | Family | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| readableStreamBatch16 | readable-stream | 48.50 MiB/s | 48.38 MiB/s | 48.62 MiB/s | 0.5% | 48.38, 48.50, 48.62 | yes | yes | not-found | 130.0 MiB |
| asyncByteBatch16 | async-byte-batch | 43.91 MiB/s | 43.53 MiB/s | 44.11 MiB/s | 1.3% | 44.10, 44.11, 43.53 | yes | yes | not-found | 130.9 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | 67.76 MiB/s | 67.69 MiB/s | 67.81 MiB/s | 0.2% | 67.81, 67.79, 67.69 | yes | yes | not-found | 135.7 MiB |

### Parity

- Full rows stable across processes: yes
- Rows: readableStreamBatch16, asyncByteBatch16, syncIterableBatch16

## Findings

- independent-process-rerun (BENCH_FACT): Each sample was measured by a separate runtime process.
  - node: processRuns=3
  - bun: processRuns=3
  - deno: processRuns=3
- sync-iterable-source-headroom (BENCH_FACT): Sync iterable byte batches isolate async source overhead while keeping the same public event-object checksum contract.
  - node: syncIterableBatch16 avg=74.68 MiB/s spread=2.6%
  - bun: syncIterableBatch16 avg=53.38 MiB/s spread=1.4%
  - deno: syncIterableBatch16 avg=67.76 MiB/s spread=0.2%
- full-stax-counterexample-search (BENCH_FACT): No selected row reported a 200 MiB/s bounded-memory counterexample in these fresh process samples.
  - counterexample=not-found
