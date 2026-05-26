# EventReader Byte-Batch Cross-Process Stability

Generated: 2026-05-26T23:38:31.272Z

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

| Variant | Family | Source mode | Parser input | Direct stream | Async boundary | Backpressure | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| readableStreamBatch16 | readable-stream | web-readable-stream-pull | ReadableStream<Uint8Array> | yes | yes | yes | 52.76 MiB/s | 52.65 MiB/s | 52.93 MiB/s | 0.5% | 52.65, 52.71, 52.93 | yes | yes | not-found | 197.8 MiB |
| asyncByteBatch16 | async-byte-batch | async-iterable-byte-batches | AsyncIterable<Uint8Array[]> | no | yes | yes | 47.82 MiB/s | 46.95 MiB/s | 48.42 MiB/s | 3.1% | 48.09, 46.95, 48.42 | yes | yes | not-found | 197.5 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 75.62 MiB/s | 73.75 MiB/s | 76.68 MiB/s | 3.9% | 76.41, 76.68, 73.75 | yes | yes | not-found | 206.3 MiB |
| syncFileIterableBatch16 | sync-file-iterable-byte-batch | file-backed-sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 67.30 MiB/s | 67.15 MiB/s | 67.53 MiB/s | 0.6% | 67.21, 67.15, 67.53 | yes | yes | not-found | 218.2 MiB |

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

| Variant | Family | Source mode | Parser input | Direct stream | Async boundary | Backpressure | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| readableStreamBatch16 | readable-stream | web-readable-stream-pull | ReadableStream<Uint8Array> | yes | yes | yes | 38.74 MiB/s | 38.07 MiB/s | 39.34 MiB/s | 3.3% | 39.34, 38.07, 38.80 | yes | yes | not-found | 205.7 MiB |
| asyncByteBatch16 | async-byte-batch | async-iterable-byte-batches | AsyncIterable<Uint8Array[]> | no | yes | yes | 35.65 MiB/s | 34.64 MiB/s | 36.71 MiB/s | 5.8% | 36.71, 35.59, 34.64 | yes | yes | not-found | 211.9 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 51.13 MiB/s | 50.37 MiB/s | 52.14 MiB/s | 3.5% | 52.14, 50.86, 50.37 | yes | yes | not-found | 206.9 MiB |
| syncFileIterableBatch16 | sync-file-iterable-byte-batch | file-backed-sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 47.98 MiB/s | 47.72 MiB/s | 48.42 MiB/s | 1.5% | 48.42, 47.81, 47.72 | yes | yes | not-found | 210.0 MiB |

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

| Variant | Family | Source mode | Parser input | Direct stream | Async boundary | Backpressure | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| readableStreamBatch16 | readable-stream | web-readable-stream-pull | ReadableStream<Uint8Array> | yes | yes | yes | 45.92 MiB/s | 44.70 MiB/s | 46.59 MiB/s | 4.1% | 46.47, 46.59, 44.70 | yes | yes | not-found | 129.8 MiB |
| asyncByteBatch16 | async-byte-batch | async-iterable-byte-batches | AsyncIterable<Uint8Array[]> | no | yes | yes | 41.51 MiB/s | 41.09 MiB/s | 42.12 MiB/s | 2.5% | 42.12, 41.32, 41.09 | yes | yes | not-found | 131.0 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 64.72 MiB/s | 64.37 MiB/s | 64.90 MiB/s | 0.8% | 64.88, 64.90, 64.37 | yes | yes | not-found | 135.6 MiB |
| syncFileIterableBatch16 | sync-file-iterable-byte-batch | file-backed-sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 59.59 MiB/s | 57.89 MiB/s | 61.04 MiB/s | 5.3% | 57.89, 61.04, 59.83 | yes | yes | not-found | 142.6 MiB |

### Parity

- Full rows stable across processes: yes
- Rows: readableStreamBatch16, asyncByteBatch16, syncIterableBatch16, syncFileIterableBatch16

## Findings

- independent-process-rerun (BENCH_FACT): Each sample was measured by a separate runtime process.
  - node: processRuns=3
  - bun: processRuns=3
  - deno: processRuns=3
- sync-iterable-source-headroom (BENCH_FACT): Prepared and file-backed sync iterable byte batches isolate async source overhead while keeping the same public event-object checksum contract.
  - node: syncIterableBatch16 avg=75.62 MiB/s spread=3.9%
  - node: syncFileIterableBatch16 avg=67.30 MiB/s spread=0.6%
  - bun: syncIterableBatch16 avg=51.13 MiB/s spread=3.5%
  - bun: syncFileIterableBatch16 avg=47.98 MiB/s spread=1.5%
  - deno: syncIterableBatch16 avg=64.72 MiB/s spread=0.8%
  - deno: syncFileIterableBatch16 avg=59.59 MiB/s spread=5.3%
- source-consumption-shape-comparison (BENCH_FACT): The same full-string checksum contract is compared across direct ReadableStream, async Iterable<Uint8Array[]>, prepared sync Iterable<Uint8Array[]>, and file-backed sync Iterable<Uint8Array[]> source shapes.
  - node: readableStreamBatch16 parserInput=ReadableStream<Uint8Array> directReadableStream=true asyncBoundary=true respectsBackpressure=true fullArrayBufferParserInput=false avg=52.76 MiB/s
  - node: asyncByteBatch16 parserInput=AsyncIterable<Uint8Array[]> directReadableStream=false asyncBoundary=true respectsBackpressure=true fullArrayBufferParserInput=false avg=47.82 MiB/s ratioToReadable=0.91x
  - node: syncIterableBatch16 parserInput=Iterable<Uint8Array[]> directReadableStream=false asyncBoundary=false respectsBackpressure=true fullArrayBufferParserInput=false avg=75.62 MiB/s ratioToReadable=1.43x
  - node: syncFileIterableBatch16 parserInput=Iterable<Uint8Array[]> sourceMode=file-backed-sync-iterable-byte-batches directReadableStream=false asyncBoundary=false respectsBackpressure=true fullArrayBufferParserInput=false avg=67.30 MiB/s ratioToReadable=1.28x
  - bun: readableStreamBatch16 parserInput=ReadableStream<Uint8Array> directReadableStream=true asyncBoundary=true respectsBackpressure=true fullArrayBufferParserInput=false avg=38.74 MiB/s
  - bun: asyncByteBatch16 parserInput=AsyncIterable<Uint8Array[]> directReadableStream=false asyncBoundary=true respectsBackpressure=true fullArrayBufferParserInput=false avg=35.65 MiB/s ratioToReadable=0.92x
  - bun: syncIterableBatch16 parserInput=Iterable<Uint8Array[]> directReadableStream=false asyncBoundary=false respectsBackpressure=true fullArrayBufferParserInput=false avg=51.13 MiB/s ratioToReadable=1.32x
  - bun: syncFileIterableBatch16 parserInput=Iterable<Uint8Array[]> sourceMode=file-backed-sync-iterable-byte-batches directReadableStream=false asyncBoundary=false respectsBackpressure=true fullArrayBufferParserInput=false avg=47.98 MiB/s ratioToReadable=1.24x
  - deno: readableStreamBatch16 parserInput=ReadableStream<Uint8Array> directReadableStream=true asyncBoundary=true respectsBackpressure=true fullArrayBufferParserInput=false avg=45.92 MiB/s
  - deno: asyncByteBatch16 parserInput=AsyncIterable<Uint8Array[]> directReadableStream=false asyncBoundary=true respectsBackpressure=true fullArrayBufferParserInput=false avg=41.51 MiB/s ratioToReadable=0.90x
  - deno: syncIterableBatch16 parserInput=Iterable<Uint8Array[]> directReadableStream=false asyncBoundary=false respectsBackpressure=true fullArrayBufferParserInput=false avg=64.72 MiB/s ratioToReadable=1.41x
  - deno: syncFileIterableBatch16 parserInput=Iterable<Uint8Array[]> sourceMode=file-backed-sync-iterable-byte-batches directReadableStream=false asyncBoundary=false respectsBackpressure=true fullArrayBufferParserInput=false avg=59.59 MiB/s ratioToReadable=1.30x
- file-backed-sync-source (BENCH_FACT): syncFileIterableBatch rows read corpus chunks from the OS file source on demand in each fresh process.
  - node: syncFileIterableBatch16 avg=67.30 MiB/s spread=0.6%
  - bun: syncFileIterableBatch16 avg=47.98 MiB/s spread=1.5%
  - deno: syncFileIterableBatch16 avg=59.59 MiB/s spread=5.3%
- full-stax-counterexample-search (BENCH_FACT): No selected row reported a 200 MiB/s bounded-memory counterexample in these fresh process samples.
  - counterexample=not-found
