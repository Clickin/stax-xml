# EventReader Byte-Batch Cross-Process Stability

Generated: 2026-05-26T20:58:24.319Z

This report repeats selected EventReader byte-batch source rows in fresh runtime processes.
All selected rows preserve the public event-object full-string checksum contract and demand-driven source consumption.
syncFileIterableBatch rows keep the synchronous parser pull shape but read corpus chunks from the OS file source on demand.
It is cross-process timing evidence for the recorded machine, not a proof that JavaScript runtimes have no further headroom.

## Options

- Runtimes: node, bun, deno
- Process runs: 3
- Child warmups: 0
- Fixture shape: corpus-cycle
- Corpus file: G:\programming\stax-xml\packages\benchmark\assets\midsize.xml
- Corpus chunk: 64 KiB
- Size GiB: 1
- Batch size: 16
- Bounded RSS gate: 512.0 MiB
- Variants: readableStreamBatch16, asyncByteBatch16, syncIterableBatch16, syncFileIterableBatch16

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\event-reader-byte-batch-midsize-corpus-release
- Committed: no

## Runtime: node

- Engine: undefined
- Node: undefined
- Platform: win32-x64
- CPU: undefined
- Fixture bytes: 1079349964

| Variant | Family | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| readableStreamBatch16 | readable-stream | 30.43 MiB/s | 29.92 MiB/s | 31.23 MiB/s | 4.3% | 30.15, 29.92, 31.23 | yes | yes | not-found | 386.3 MiB |
| asyncByteBatch16 | async-byte-batch | 28.90 MiB/s | 28.19 MiB/s | 29.73 MiB/s | 5.3% | 28.79, 28.19, 29.73 | yes | yes | not-found | 378.8 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | 59.03 MiB/s | 58.12 MiB/s | 59.63 MiB/s | 2.6% | 59.35, 59.63, 58.12 | yes | yes | not-found | 381.6 MiB |
| syncFileIterableBatch16 | sync-file-iterable-byte-batch | 56.73 MiB/s | 55.81 MiB/s | 58.07 MiB/s | 4.0% | 56.30, 58.07, 55.81 | yes | yes | not-found | 381.0 MiB |

### Parity

- Full rows stable across processes: yes
- Rows: readableStreamBatch16, asyncByteBatch16, syncIterableBatch16, syncFileIterableBatch16

## Runtime: bun

- Engine: undefined
- Node: undefined
- Bun: 1.3.13
- Platform: win32-x64
- CPU: undefined
- Fixture bytes: 1079349964

| Variant | Family | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| readableStreamBatch16 | readable-stream | 29.86 MiB/s | 29.14 MiB/s | 30.22 MiB/s | 3.6% | 29.14, 30.22, 30.21 | yes | yes | not-found | 387.2 MiB |
| asyncByteBatch16 | async-byte-batch | 28.88 MiB/s | 28.59 MiB/s | 29.10 MiB/s | 1.7% | 29.10, 28.59, 28.94 | yes | yes | not-found | 383.1 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | 45.96 MiB/s | 45.63 MiB/s | 46.38 MiB/s | 1.6% | 46.38, 45.86, 45.63 | yes | yes | not-found | 394.3 MiB |
| syncFileIterableBatch16 | sync-file-iterable-byte-batch | 44.19 MiB/s | 43.70 MiB/s | 45.03 MiB/s | 3.0% | 43.83, 43.70, 45.03 | yes | yes | not-found | 416.1 MiB |

### Parity

- Full rows stable across processes: yes
- Rows: readableStreamBatch16, asyncByteBatch16, syncIterableBatch16, syncFileIterableBatch16

## Runtime: deno

- Engine: undefined
- Node: undefined
- Deno: 2.7.13
- Platform: win32-x64
- CPU: undefined
- Fixture bytes: 1079349964

| Variant | Family | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| readableStreamBatch16 | readable-stream | 29.91 MiB/s | 29.19 MiB/s | 30.42 MiB/s | 4.1% | 29.19, 30.11, 30.42 | yes | yes | not-found | 290.5 MiB |
| asyncByteBatch16 | async-byte-batch | 26.47 MiB/s | 24.80 MiB/s | 28.27 MiB/s | 13.1% | 26.34, 24.80, 28.27 | yes | yes | not-found | 292.0 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | 51.86 MiB/s | 51.38 MiB/s | 52.53 MiB/s | 2.2% | 51.66, 52.53, 51.38 | yes | yes | not-found | 234.4 MiB |
| syncFileIterableBatch16 | sync-file-iterable-byte-batch | 50.57 MiB/s | 49.67 MiB/s | 51.32 MiB/s | 3.3% | 49.67, 51.32, 50.74 | yes | yes | not-found | 239.2 MiB |

### Parity

- Full rows stable across processes: yes
- Rows: readableStreamBatch16, asyncByteBatch16, syncIterableBatch16, syncFileIterableBatch16

## Findings

- independent-process-rerun (BENCH_FACT): Each sample was measured by a separate runtime process.
  - node: processRuns=3
  - bun: processRuns=3
  - deno: processRuns=3
- sync-iterable-source-headroom (BENCH_FACT): Prepared and file-backed sync iterable byte batches isolate async source overhead while keeping the same public event-object checksum contract.
  - node: syncIterableBatch16 avg=59.03 MiB/s spread=2.6%
  - node: syncFileIterableBatch16 avg=56.73 MiB/s spread=4.0%
  - bun: syncIterableBatch16 avg=45.96 MiB/s spread=1.6%
  - bun: syncFileIterableBatch16 avg=44.19 MiB/s spread=3.0%
  - deno: syncIterableBatch16 avg=51.86 MiB/s spread=2.2%
  - deno: syncFileIterableBatch16 avg=50.57 MiB/s spread=3.3%
- file-backed-sync-source (BENCH_FACT): syncFileIterableBatch rows read corpus chunks from the OS file source on demand in each fresh process.
  - node: syncFileIterableBatch16 avg=56.73 MiB/s spread=4.0%
  - bun: syncFileIterableBatch16 avg=44.19 MiB/s spread=3.0%
  - deno: syncFileIterableBatch16 avg=50.57 MiB/s spread=3.3%
- full-stax-counterexample-search (BENCH_FACT): No selected row reported a 200 MiB/s bounded-memory counterexample in these fresh process samples.
  - counterexample=not-found
