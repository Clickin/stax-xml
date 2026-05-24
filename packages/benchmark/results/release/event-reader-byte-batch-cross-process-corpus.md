# EventReader Byte-Batch Cross-Process Stability

Generated: 2026-05-24T19:25:41.916Z

This report repeats selected EventReader byte-batch source rows in fresh runtime processes.
All selected rows preserve the public event-object full-string checksum contract and demand-driven source consumption.
syncFileIterableBatch rows keep the synchronous parser pull shape but read corpus chunks from the OS file source on demand.
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
- Variants: readableStreamBatch16, asyncByteBatch16, syncIterableBatch16, syncFileIterableBatch16

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
| readableStreamBatch16 | readable-stream | 53.57 MiB/s | 52.81 MiB/s | 54.05 MiB/s | 2.3% | 52.81, 53.84, 54.05 | yes | yes | not-found | 197.1 MiB |
| asyncByteBatch16 | async-byte-batch | 48.62 MiB/s | 47.27 MiB/s | 49.94 MiB/s | 5.5% | 49.94, 48.65, 47.27 | yes | yes | not-found | 197.4 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | 77.67 MiB/s | 76.46 MiB/s | 78.43 MiB/s | 2.5% | 78.43, 78.13, 76.46 | yes | yes | not-found | 204.9 MiB |
| syncFileIterableBatch16 | sync-file-iterable-byte-batch | 68.92 MiB/s | 68.60 MiB/s | 69.42 MiB/s | 1.2% | 68.75, 69.42, 68.60 | yes | yes | not-found | 217.8 MiB |

### Parity

- Full rows stable across processes: yes
- Rows: readableStreamBatch16, asyncByteBatch16, syncIterableBatch16, syncFileIterableBatch16

## Runtime: bun

- Engine: undefined
- Node: undefined
- Bun: 1.3.13
- Platform: win32-x64
- CPU: undefined
- Fixture bytes: 1073744736

| Variant | Family | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| readableStreamBatch16 | readable-stream | 38.92 MiB/s | 38.13 MiB/s | 39.83 MiB/s | 4.4% | 39.83, 38.79, 38.13 | yes | yes | not-found | 203.6 MiB |
| asyncByteBatch16 | async-byte-batch | 37.12 MiB/s | 36.92 MiB/s | 37.26 MiB/s | 0.9% | 37.26, 37.18, 36.92 | yes | yes | not-found | 208.9 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | 51.46 MiB/s | 48.52 MiB/s | 52.97 MiB/s | 8.6% | 52.97, 48.52, 52.89 | yes | yes | not-found | 207.8 MiB |
| syncFileIterableBatch16 | sync-file-iterable-byte-batch | 49.41 MiB/s | 48.85 MiB/s | 49.77 MiB/s | 1.9% | 49.60, 48.85, 49.77 | yes | yes | not-found | 208.7 MiB |

### Parity

- Full rows stable across processes: yes
- Rows: readableStreamBatch16, asyncByteBatch16, syncIterableBatch16, syncFileIterableBatch16

## Runtime: deno

- Engine: undefined
- Node: undefined
- Deno: 2.7.13
- Platform: win32-x64
- CPU: undefined
- Fixture bytes: 1073744736

| Variant | Family | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| readableStreamBatch16 | readable-stream | 47.67 MiB/s | 47.22 MiB/s | 48.03 MiB/s | 1.7% | 47.22, 48.03, 47.77 | yes | yes | not-found | 129.9 MiB |
| asyncByteBatch16 | async-byte-batch | 43.78 MiB/s | 43.20 MiB/s | 44.12 MiB/s | 2.1% | 43.20, 44.02, 44.12 | yes | yes | not-found | 130.4 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | 67.09 MiB/s | 65.91 MiB/s | 68.52 MiB/s | 3.9% | 65.91, 66.84, 68.52 | yes | yes | not-found | 134.9 MiB |
| syncFileIterableBatch16 | sync-file-iterable-byte-batch | 61.75 MiB/s | 59.96 MiB/s | 63.26 MiB/s | 5.3% | 59.96, 62.04, 63.26 | yes | yes | not-found | 142.0 MiB |

### Parity

- Full rows stable across processes: yes
- Rows: readableStreamBatch16, asyncByteBatch16, syncIterableBatch16, syncFileIterableBatch16

## Findings

- independent-process-rerun (BENCH_FACT): Each sample was measured by a separate runtime process.
  - node: processRuns=3
  - bun: processRuns=3
  - deno: processRuns=3
- sync-iterable-source-headroom (BENCH_FACT): Prepared and file-backed sync iterable byte batches isolate async source overhead while keeping the same public event-object checksum contract.
  - node: syncIterableBatch16 avg=77.67 MiB/s spread=2.5%
  - node: syncFileIterableBatch16 avg=68.92 MiB/s spread=1.2%
  - bun: syncIterableBatch16 avg=51.46 MiB/s spread=8.6%
  - bun: syncFileIterableBatch16 avg=49.41 MiB/s spread=1.9%
  - deno: syncIterableBatch16 avg=67.09 MiB/s spread=3.9%
  - deno: syncFileIterableBatch16 avg=61.75 MiB/s spread=5.3%
- file-backed-sync-source (BENCH_FACT): syncFileIterableBatch rows read corpus chunks from the OS file source on demand in each fresh process.
  - node: syncFileIterableBatch16 avg=68.92 MiB/s spread=1.2%
  - bun: syncFileIterableBatch16 avg=49.41 MiB/s spread=1.9%
  - deno: syncFileIterableBatch16 avg=61.75 MiB/s spread=5.3%
- full-stax-counterexample-search (BENCH_FACT): No selected row reported a 200 MiB/s bounded-memory counterexample in these fresh process samples.
  - counterexample=not-found
