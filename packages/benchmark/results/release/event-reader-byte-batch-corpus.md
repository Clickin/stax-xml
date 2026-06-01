# EventReader Byte Batch Benchmark

Generated: 2026-06-01T05:58:03.658Z

Compares direct ReadableStream chunk consumption with AsyncIterable<Uint8Array[]> and Iterable<Uint8Array[]> sources that yield already-grouped byte batches. All sources are demand-driven and do not enqueue/read the next batch until the reader asks for it.

## Options

- Size GiB: 1
- Runs: 1
- Warmups: 0
- Runtime: Node/V8
- Fixture shape: corpus-cycle
- Corpus file: G:\programming\stax-xml\packages\benchmark\assets\books.xml
- Corpus chunk KiB: 64
- Diverse cycle size: 4096
- Fixture source bytes: 0.0 MiB
- Fixture chunk bytes: 65536
- Batch sizes: 1, 16, 64
- Bounded RSS gate: 512.0 MiB

## Source Contract

- ArrayBuffer consumption: The corpus seed is split into Uint8Array chunks; measured parser rows consume ReadableStream pulls, AsyncIterable<Uint8Array[]> batches, synchronous Iterable<Uint8Array[]> batches, or readSync-backed Uint8Array batches rather than a pure full-ArrayBuffer parser input.
- ReadableStream: ReadableStream<Uint8Array> enqueues one chunk from pull().
- Async byte batch: AsyncIterable<Uint8Array[]> yields one grouped batch only when next() is awaited.
- Sync iterable: Iterable<Uint8Array[]> yields one grouped batch per synchronous parser pull.
- Sync file iterable: File-backed Iterable<Uint8Array[]> reads corpus chunks with readSync only when the parser pulls the next batch.
- Scope: Prepared rows replay generated or pre-chunked corpus bytes. File-backed rows read corpus chunks with readSync on demand and replay complete corpus cycles to the target byte count; this is still a synchronous file-source benchmark, not a browser fetch streaming proof.

## Parity

- Full-string parity: ok
- Events: 57096514
- Checksum: 45154785
- Rows: readableStreamBatch1, readableStreamBatch16, readableStreamBatch64, asyncByteBatch16, asyncByteBatch64, syncIterableBatch1, syncIterableBatch16, syncIterableBatch64, syncFileIterableBatch1, syncFileIterableBatch16, syncFileIterableBatch64

## Results

| Variant | Family | Source mode | Parser input | Direct stream | Async boundary | Backpressure | Batch size | Throughput | Events | Checksum | Source reads | Source batches | Bounded | Max RSS |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| readableStreamBatch1 | readable-stream | web-readable-stream-pull | ReadableStream<Uint8Array> | yes | yes | yes | 1 | 48.18 MiB/s | 57096514 | 45154785 | 235937 | 235936 | yes | 192.9 MiB |
| readableStreamBatch16 | readable-stream | web-readable-stream-pull | ReadableStream<Uint8Array> | yes | yes | yes | 16 | 45.79 MiB/s | 57096514 | 45154785 | 235937 | 235936 | yes | 194.5 MiB |
| readableStreamBatch64 | readable-stream | web-readable-stream-pull | ReadableStream<Uint8Array> | yes | yes | yes | 64 | 42.44 MiB/s | 57096514 | 45154785 | 235937 | 235936 | yes | 286.9 MiB |
| asyncByteBatch16 | async-byte-batch | async-iterable-byte-batches | AsyncIterable<Uint8Array[]> | no | yes | yes | 16 | 45.68 MiB/s | 57096514 | 45154785 | 235936 | 14746 | yes | 278.0 MiB |
| asyncByteBatch64 | async-byte-batch | async-iterable-byte-batches | AsyncIterable<Uint8Array[]> | no | yes | yes | 64 | 40.46 MiB/s | 57096514 | 45154785 | 235936 | 3687 | yes | 283.2 MiB |
| syncIterableBatch1 | sync-iterable-byte-batch | sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 1 | 72.55 MiB/s | 57096514 | 45154785 | 235936 | 235936 | yes | 287.5 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 16 | 72.46 MiB/s | 57096514 | 45154785 | 235936 | 14746 | yes | 288.3 MiB |
| syncIterableBatch64 | sync-iterable-byte-batch | sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 64 | 76.13 MiB/s | 57096514 | 45154785 | 235936 | 3687 | yes | 289.9 MiB |
| syncFileIterableBatch1 | sync-file-iterable-byte-batch | file-backed-sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 1 | 63.46 MiB/s | 57096514 | 45154785 | 235936 | 235936 | yes | 299.3 MiB |
| syncFileIterableBatch16 | sync-file-iterable-byte-batch | file-backed-sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 16 | 67.75 MiB/s | 57096514 | 45154785 | 235936 | 14746 | yes | 296.2 MiB |
| syncFileIterableBatch64 | sync-file-iterable-byte-batch | file-backed-sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 64 | 67.71 MiB/s | 57096514 | 45154785 | 235936 | 3687 | yes | 300.6 MiB |

## Findings

- full-string-parity (CONTRACT_FACT): All selected source-consumption rows preserve the same public event-object full-string checksum contract.
  - status=ok
  - events=57096514
  - checksum=45154785
  - rows=readableStreamBatch1, readableStreamBatch16, readableStreamBatch64, asyncByteBatch16, asyncByteBatch64, syncIterableBatch1, syncIterableBatch16, syncIterableBatch64, syncFileIterableBatch1, syncFileIterableBatch16, syncFileIterableBatch64
- backpressure-preserved (SOURCE_FACT): All benchmark sources are demand-driven. The ReadableStream source enqueues in pull(), the async byte-batch source yields one batch only when next() is awaited, and the sync iterable source yields one batch per parser pull; no row preconsumes the whole target XML as one parser input.
  - readableStreamBatch1: sourceReads=235937, sourceBatches=235936
  - readableStreamBatch16: sourceReads=235937, sourceBatches=235936
  - readableStreamBatch64: sourceReads=235937, sourceBatches=235936
  - asyncByteBatch16: sourceReads=235936, sourceBatches=14746
  - asyncByteBatch64: sourceReads=235936, sourceBatches=3687
  - syncIterableBatch1: sourceReads=235936, sourceBatches=235936
  - syncIterableBatch16: sourceReads=235936, sourceBatches=14746
  - syncIterableBatch64: sourceReads=235936, sourceBatches=3687
  - syncFileIterableBatch1: sourceReads=235936, sourceBatches=235936
  - syncFileIterableBatch16: sourceReads=235936, sourceBatches=14746
  - syncFileIterableBatch64: sourceReads=235936, sourceBatches=3687
- fixture-cycle-source-scope (SOURCE_FACT): Prepared rows replay fixture chunks; file-backed rows read corpus chunks from the OS file source on demand while preserving the same parser/checksum contract.
  - fixtureSource=corpus-cycle
  - fixtureRows=1
  - sourceBytes=4551
  - actualBytes=1073744736
  - fileBackedRows=syncFileIterableBatch1, syncFileIterableBatch16, syncFileIterableBatch64
- async-byte-batch-headroom (BENCH_FACT): At batch size 16, async byte batches were 1.00x the ReadableStream row on this run; this row avoids direct ReadableStream consumption but still crosses an AsyncIterator source boundary.
  - readableStreamBatch16=45.79 MiB/s
  - asyncByteBatch16=45.68 MiB/s
- sync-iterable-byte-batch-headroom (BENCH_FACT): At batch size 16, sync iterable byte batches were 1.58x the ReadableStream row on this run; this is the row that removes the ReadableStream and AsyncIterator source boundary while preserving demand-driven pulls.
  - readableStreamBatch16=45.79 MiB/s
  - syncIterableBatch16=72.46 MiB/s
