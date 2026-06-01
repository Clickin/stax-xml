# EventReader Byte-Batch Cross-Process Stability

Generated: 2026-06-01T06:20:15.107Z

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

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\event-reader-byte-batch-midsize-corpus
- Committed: no

## Runtime: node

- Engine: undefined
- Node: undefined
- Platform: win32-x64
- CPU: undefined
- Fixture bytes: 1079349964

| Variant | Family | Source mode | Parser input | Direct stream | Async boundary | Backpressure | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| readableStreamBatch16 | readable-stream | web-readable-stream-pull | ReadableStream<Uint8Array> | yes | yes | yes | 32.46 MiB/s | 31.89 MiB/s | 33.11 MiB/s | 3.8% | 32.37, 33.11, 31.89 | yes | yes | not-found | 380.9 MiB |
| asyncByteBatch16 | async-byte-batch | async-iterable-byte-batches | AsyncIterable<Uint8Array[]> | no | yes | yes | 30.16 MiB/s | 29.59 MiB/s | 30.74 MiB/s | 3.8% | 30.74, 29.59, 30.16 | yes | yes | not-found | 380.3 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 59.97 MiB/s | 59.49 MiB/s | 60.61 MiB/s | 1.9% | 60.61, 59.49, 59.80 | yes | yes | not-found | 380.7 MiB |
| syncFileIterableBatch16 | sync-file-iterable-byte-batch | file-backed-sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 56.76 MiB/s | 56.07 MiB/s | 57.13 MiB/s | 1.9% | 56.07, 57.08, 57.13 | yes | yes | not-found | 380.1 MiB |

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

| Variant | Family | Source mode | Parser input | Direct stream | Async boundary | Backpressure | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| readableStreamBatch16 | readable-stream | web-readable-stream-pull | ReadableStream<Uint8Array> | yes | yes | yes | 30.16 MiB/s | 30.05 MiB/s | 30.30 MiB/s | 0.8% | 30.05, 30.14, 30.30 | yes | yes | not-found | 391.3 MiB |
| asyncByteBatch16 | async-byte-batch | async-iterable-byte-batches | AsyncIterable<Uint8Array[]> | no | yes | yes | 28.71 MiB/s | 28.40 MiB/s | 29.08 MiB/s | 2.4% | 28.64, 29.08, 28.40 | yes | yes | not-found | 384.0 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 47.51 MiB/s | 47.00 MiB/s | 48.23 MiB/s | 2.6% | 48.23, 47.29, 47.00 | yes | yes | not-found | 394.0 MiB |
| syncFileIterableBatch16 | sync-file-iterable-byte-batch | file-backed-sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 46.85 MiB/s | 46.53 MiB/s | 47.07 MiB/s | 1.2% | 47.07, 46.53, 46.94 | yes | yes | not-found | 405.3 MiB |

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

| Variant | Family | Source mode | Parser input | Direct stream | Async boundary | Backpressure | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| readableStreamBatch16 | readable-stream | web-readable-stream-pull | ReadableStream<Uint8Array> | yes | yes | yes | 30.08 MiB/s | 28.93 MiB/s | 30.73 MiB/s | 6.0% | 28.93, 30.73, 30.60 | yes | yes | not-found | 287.9 MiB |
| asyncByteBatch16 | async-byte-batch | async-iterable-byte-batches | AsyncIterable<Uint8Array[]> | no | yes | yes | 28.16 MiB/s | 27.82 MiB/s | 28.51 MiB/s | 2.5% | 27.82, 28.14, 28.51 | yes | yes | not-found | 286.7 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 53.25 MiB/s | 52.35 MiB/s | 54.16 MiB/s | 3.4% | 54.16, 52.35, 53.25 | yes | yes | not-found | 258.3 MiB |
| syncFileIterableBatch16 | sync-file-iterable-byte-batch | file-backed-sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 50.87 MiB/s | 50.64 MiB/s | 51.18 MiB/s | 1.1% | 50.79, 51.18, 50.64 | yes | yes | not-found | 265.9 MiB |

### Parity

- Full rows stable across processes: yes
- Rows: readableStreamBatch16, asyncByteBatch16, syncIterableBatch16, syncFileIterableBatch16

## Findings

- independent-process-rerun (BENCH_FACT): Each sample was measured by a separate runtime process.
  - node: processRuns=3
  - bun: processRuns=3
  - deno: processRuns=3
- sync-iterable-source-headroom (BENCH_FACT): Prepared and file-backed sync iterable byte batches isolate async source overhead while keeping the same public event-object checksum contract.
  - node: syncIterableBatch16 avg=59.97 MiB/s spread=1.9%
  - node: syncFileIterableBatch16 avg=56.76 MiB/s spread=1.9%
  - bun: syncIterableBatch16 avg=47.51 MiB/s spread=2.6%
  - bun: syncFileIterableBatch16 avg=46.85 MiB/s spread=1.2%
  - deno: syncIterableBatch16 avg=53.25 MiB/s spread=3.4%
  - deno: syncFileIterableBatch16 avg=50.87 MiB/s spread=1.1%
- source-consumption-shape-comparison (BENCH_FACT): The same full-string checksum contract is compared across direct ReadableStream, async Iterable<Uint8Array[]>, prepared sync Iterable<Uint8Array[]>, and file-backed sync Iterable<Uint8Array[]> source shapes.
  - node: readableStreamBatch16 parserInput=ReadableStream<Uint8Array> directReadableStream=true asyncBoundary=true respectsBackpressure=true fullArrayBufferParserInput=false avg=32.46 MiB/s
  - node: asyncByteBatch16 parserInput=AsyncIterable<Uint8Array[]> directReadableStream=false asyncBoundary=true respectsBackpressure=true fullArrayBufferParserInput=false avg=30.16 MiB/s ratioToReadable=0.93x
  - node: syncIterableBatch16 parserInput=Iterable<Uint8Array[]> directReadableStream=false asyncBoundary=false respectsBackpressure=true fullArrayBufferParserInput=false avg=59.97 MiB/s ratioToReadable=1.85x
  - node: syncFileIterableBatch16 parserInput=Iterable<Uint8Array[]> sourceMode=file-backed-sync-iterable-byte-batches directReadableStream=false asyncBoundary=false respectsBackpressure=true fullArrayBufferParserInput=false avg=56.76 MiB/s ratioToReadable=1.75x
  - bun: readableStreamBatch16 parserInput=ReadableStream<Uint8Array> directReadableStream=true asyncBoundary=true respectsBackpressure=true fullArrayBufferParserInput=false avg=30.16 MiB/s
  - bun: asyncByteBatch16 parserInput=AsyncIterable<Uint8Array[]> directReadableStream=false asyncBoundary=true respectsBackpressure=true fullArrayBufferParserInput=false avg=28.71 MiB/s ratioToReadable=0.95x
  - bun: syncIterableBatch16 parserInput=Iterable<Uint8Array[]> directReadableStream=false asyncBoundary=false respectsBackpressure=true fullArrayBufferParserInput=false avg=47.51 MiB/s ratioToReadable=1.58x
  - bun: syncFileIterableBatch16 parserInput=Iterable<Uint8Array[]> sourceMode=file-backed-sync-iterable-byte-batches directReadableStream=false asyncBoundary=false respectsBackpressure=true fullArrayBufferParserInput=false avg=46.85 MiB/s ratioToReadable=1.55x
  - deno: readableStreamBatch16 parserInput=ReadableStream<Uint8Array> directReadableStream=true asyncBoundary=true respectsBackpressure=true fullArrayBufferParserInput=false avg=30.08 MiB/s
  - deno: asyncByteBatch16 parserInput=AsyncIterable<Uint8Array[]> directReadableStream=false asyncBoundary=true respectsBackpressure=true fullArrayBufferParserInput=false avg=28.16 MiB/s ratioToReadable=0.94x
  - deno: syncIterableBatch16 parserInput=Iterable<Uint8Array[]> directReadableStream=false asyncBoundary=false respectsBackpressure=true fullArrayBufferParserInput=false avg=53.25 MiB/s ratioToReadable=1.77x
  - deno: syncFileIterableBatch16 parserInput=Iterable<Uint8Array[]> sourceMode=file-backed-sync-iterable-byte-batches directReadableStream=false asyncBoundary=false respectsBackpressure=true fullArrayBufferParserInput=false avg=50.87 MiB/s ratioToReadable=1.69x
- file-backed-sync-source (BENCH_FACT): syncFileIterableBatch rows read corpus chunks from the OS file source on demand in each fresh process.
  - node: syncFileIterableBatch16 avg=56.76 MiB/s spread=1.9%
  - bun: syncFileIterableBatch16 avg=46.85 MiB/s spread=1.2%
  - deno: syncFileIterableBatch16 avg=50.87 MiB/s spread=1.1%
- full-stax-counterexample-search (BENCH_FACT): No selected row reported a 200 MiB/s bounded-memory counterexample in these fresh process samples.
  - counterexample=not-found
