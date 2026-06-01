# EventReader Byte-Batch Cross-Process Stability

Generated: 2026-06-01T06:16:11.184Z

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

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\event-reader-byte-batch-corpus
- Committed: no

## Runtime: node

- Engine: undefined
- Node: undefined
- Platform: win32-x64
- CPU: undefined
- Fixture bytes: 1073744736

| Variant | Family | Source mode | Parser input | Direct stream | Async boundary | Backpressure | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| readableStreamBatch16 | readable-stream | web-readable-stream-pull | ReadableStream<Uint8Array> | yes | yes | yes | 51.27 MiB/s | 50.13 MiB/s | 52.63 MiB/s | 4.9% | 50.13, 52.63, 51.05 | yes | yes | not-found | 196.2 MiB |
| asyncByteBatch16 | async-byte-batch | async-iterable-byte-batches | AsyncIterable<Uint8Array[]> | no | yes | yes | 46.94 MiB/s | 44.95 MiB/s | 48.60 MiB/s | 7.8% | 44.95, 47.27, 48.60 | yes | yes | not-found | 196.3 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 74.33 MiB/s | 73.26 MiB/s | 75.78 MiB/s | 3.4% | 75.78, 73.96, 73.26 | yes | yes | not-found | 204.9 MiB |
| syncFileIterableBatch16 | sync-file-iterable-byte-batch | file-backed-sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 66.28 MiB/s | 65.24 MiB/s | 67.69 MiB/s | 3.7% | 67.69, 65.24, 65.90 | yes | yes | not-found | 217.1 MiB |

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
| readableStreamBatch16 | readable-stream | web-readable-stream-pull | ReadableStream<Uint8Array> | yes | yes | yes | 39.09 MiB/s | 38.87 MiB/s | 39.52 MiB/s | 1.7% | 38.87, 38.89, 39.52 | yes | yes | not-found | 204.5 MiB |
| asyncByteBatch16 | async-byte-batch | async-iterable-byte-batches | AsyncIterable<Uint8Array[]> | no | yes | yes | 36.50 MiB/s | 36.39 MiB/s | 36.70 MiB/s | 0.8% | 36.39, 36.70, 36.40 | yes | yes | not-found | 211.3 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 52.45 MiB/s | 52.25 MiB/s | 52.57 MiB/s | 0.6% | 52.25, 52.57, 52.55 | yes | yes | not-found | 210.3 MiB |
| syncFileIterableBatch16 | sync-file-iterable-byte-batch | file-backed-sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 49.33 MiB/s | 49.04 MiB/s | 49.62 MiB/s | 1.2% | 49.04, 49.62, 49.32 | yes | yes | not-found | 211.9 MiB |

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
| readableStreamBatch16 | readable-stream | web-readable-stream-pull | ReadableStream<Uint8Array> | yes | yes | yes | 46.86 MiB/s | 45.04 MiB/s | 48.35 MiB/s | 7.1% | 47.18, 48.35, 45.04 | yes | yes | not-found | 131.1 MiB |
| asyncByteBatch16 | async-byte-batch | async-iterable-byte-batches | AsyncIterable<Uint8Array[]> | no | yes | yes | 42.32 MiB/s | 41.52 MiB/s | 42.82 MiB/s | 3.1% | 42.62, 42.82, 41.52 | yes | yes | not-found | 131.8 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 65.69 MiB/s | 64.96 MiB/s | 66.53 MiB/s | 2.4% | 66.53, 65.57, 64.96 | yes | yes | not-found | 136.0 MiB |
| syncFileIterableBatch16 | sync-file-iterable-byte-batch | file-backed-sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 61.83 MiB/s | 61.23 MiB/s | 62.23 MiB/s | 1.6% | 61.23, 62.05, 62.23 | yes | yes | not-found | 142.9 MiB |

### Parity

- Full rows stable across processes: yes
- Rows: readableStreamBatch16, asyncByteBatch16, syncIterableBatch16, syncFileIterableBatch16

## Findings

- independent-process-rerun (BENCH_FACT): Each sample was measured by a separate runtime process.
  - node: processRuns=3
  - bun: processRuns=3
  - deno: processRuns=3
- sync-iterable-source-headroom (BENCH_FACT): Prepared and file-backed sync iterable byte batches isolate async source overhead while keeping the same public event-object checksum contract.
  - node: syncIterableBatch16 avg=74.33 MiB/s spread=3.4%
  - node: syncFileIterableBatch16 avg=66.28 MiB/s spread=3.7%
  - bun: syncIterableBatch16 avg=52.45 MiB/s spread=0.6%
  - bun: syncFileIterableBatch16 avg=49.33 MiB/s spread=1.2%
  - deno: syncIterableBatch16 avg=65.69 MiB/s spread=2.4%
  - deno: syncFileIterableBatch16 avg=61.83 MiB/s spread=1.6%
- source-consumption-shape-comparison (BENCH_FACT): The same full-string checksum contract is compared across direct ReadableStream, async Iterable<Uint8Array[]>, prepared sync Iterable<Uint8Array[]>, and file-backed sync Iterable<Uint8Array[]> source shapes.
  - node: readableStreamBatch16 parserInput=ReadableStream<Uint8Array> directReadableStream=true asyncBoundary=true respectsBackpressure=true fullArrayBufferParserInput=false avg=51.27 MiB/s
  - node: asyncByteBatch16 parserInput=AsyncIterable<Uint8Array[]> directReadableStream=false asyncBoundary=true respectsBackpressure=true fullArrayBufferParserInput=false avg=46.94 MiB/s ratioToReadable=0.92x
  - node: syncIterableBatch16 parserInput=Iterable<Uint8Array[]> directReadableStream=false asyncBoundary=false respectsBackpressure=true fullArrayBufferParserInput=false avg=74.33 MiB/s ratioToReadable=1.45x
  - node: syncFileIterableBatch16 parserInput=Iterable<Uint8Array[]> sourceMode=file-backed-sync-iterable-byte-batches directReadableStream=false asyncBoundary=false respectsBackpressure=true fullArrayBufferParserInput=false avg=66.28 MiB/s ratioToReadable=1.29x
  - bun: readableStreamBatch16 parserInput=ReadableStream<Uint8Array> directReadableStream=true asyncBoundary=true respectsBackpressure=true fullArrayBufferParserInput=false avg=39.09 MiB/s
  - bun: asyncByteBatch16 parserInput=AsyncIterable<Uint8Array[]> directReadableStream=false asyncBoundary=true respectsBackpressure=true fullArrayBufferParserInput=false avg=36.50 MiB/s ratioToReadable=0.93x
  - bun: syncIterableBatch16 parserInput=Iterable<Uint8Array[]> directReadableStream=false asyncBoundary=false respectsBackpressure=true fullArrayBufferParserInput=false avg=52.45 MiB/s ratioToReadable=1.34x
  - bun: syncFileIterableBatch16 parserInput=Iterable<Uint8Array[]> sourceMode=file-backed-sync-iterable-byte-batches directReadableStream=false asyncBoundary=false respectsBackpressure=true fullArrayBufferParserInput=false avg=49.33 MiB/s ratioToReadable=1.26x
  - deno: readableStreamBatch16 parserInput=ReadableStream<Uint8Array> directReadableStream=true asyncBoundary=true respectsBackpressure=true fullArrayBufferParserInput=false avg=46.86 MiB/s
  - deno: asyncByteBatch16 parserInput=AsyncIterable<Uint8Array[]> directReadableStream=false asyncBoundary=true respectsBackpressure=true fullArrayBufferParserInput=false avg=42.32 MiB/s ratioToReadable=0.90x
  - deno: syncIterableBatch16 parserInput=Iterable<Uint8Array[]> directReadableStream=false asyncBoundary=false respectsBackpressure=true fullArrayBufferParserInput=false avg=65.69 MiB/s ratioToReadable=1.40x
  - deno: syncFileIterableBatch16 parserInput=Iterable<Uint8Array[]> sourceMode=file-backed-sync-iterable-byte-batches directReadableStream=false asyncBoundary=false respectsBackpressure=true fullArrayBufferParserInput=false avg=61.83 MiB/s ratioToReadable=1.32x
- file-backed-sync-source (BENCH_FACT): syncFileIterableBatch rows read corpus chunks from the OS file source on demand in each fresh process.
  - node: syncFileIterableBatch16 avg=66.28 MiB/s spread=3.7%
  - bun: syncFileIterableBatch16 avg=49.33 MiB/s spread=1.2%
  - deno: syncFileIterableBatch16 avg=61.83 MiB/s spread=1.6%
- full-stax-counterexample-search (BENCH_FACT): No selected row reported a 200 MiB/s bounded-memory counterexample in these fresh process samples.
  - counterexample=not-found
