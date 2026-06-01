# EventReader Byte Batch Benchmark

Generated: 2026-06-01T05:57:59.078Z

Compares direct ReadableStream chunk consumption with AsyncIterable<Uint8Array[]> and Iterable<Uint8Array[]> sources that yield already-grouped byte batches. All sources are demand-driven and do not enqueue/read the next batch until the reader asks for it.

## Options

- Size GiB: 1
- Runs: 1
- Warmups: 0
- Runtime: Node/V8
- Fixture shape: diverse-cycle
- Diverse cycle size: 4096
- Fixture source bytes: 0.7 MiB
- Batch sizes: 1, 16, 64
- Bounded RSS gate: 512.0 MiB

## Source Contract

- ArrayBuffer consumption: Generated fixture rows are Uint8Array chunks; measured parser rows consume ReadableStream pulls, AsyncIterable<Uint8Array[]> batches, or synchronous Iterable<Uint8Array[]> batches rather than a pure full-ArrayBuffer parser input.
- ReadableStream: ReadableStream<Uint8Array> enqueues one chunk from pull().
- Async byte batch: AsyncIterable<Uint8Array[]> yields one grouped batch only when next() is awaited.
- Sync iterable: Iterable<Uint8Array[]> yields one grouped batch per synchronous parser pull.
- Sync file iterable: File-backed Iterable<Uint8Array[]> rows are available only for corpus-cycle fixtures.
- Scope: The fixture rows are generated before timing and replayed to the target byte count. This isolates parser/source API overhead; it is not an OS, network, or browser fetch streaming proof.

## Parity

- Full-string parity: ok
- Events: 46195346
- Checksum: -577171566
- Rows: readableStreamBatch1, readableStreamBatch16, readableStreamBatch64, asyncByteBatch16, asyncByteBatch64, syncIterableBatch1, syncIterableBatch16, syncIterableBatch64

## Results

| Variant | Family | Source mode | Parser input | Direct stream | Async boundary | Backpressure | Batch size | Throughput | Events | Checksum | Source reads | Source batches | Bounded | Max RSS |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| readableStreamBatch1 | readable-stream | web-readable-stream-pull | ReadableStream<Uint8Array> | yes | yes | yes | 1 | 15.52 MiB/s | 46195346 | -577171566 | 5774419 | 5774418 | yes | 98.9 MiB |
| readableStreamBatch16 | readable-stream | web-readable-stream-pull | ReadableStream<Uint8Array> | yes | yes | yes | 16 | 18.58 MiB/s | 46195346 | -577171566 | 5774419 | 5774418 | yes | 198.6 MiB |
| readableStreamBatch64 | readable-stream | web-readable-stream-pull | ReadableStream<Uint8Array> | yes | yes | yes | 64 | 20.77 MiB/s | 46195346 | -577171566 | 5774419 | 5774418 | yes | 200.1 MiB |
| asyncByteBatch16 | async-byte-batch | async-iterable-byte-batches | AsyncIterable<Uint8Array[]> | no | yes | yes | 16 | 22.95 MiB/s | 46195346 | -577171566 | 5774418 | 360902 | yes | 200.3 MiB |
| asyncByteBatch64 | async-byte-batch | async-iterable-byte-batches | AsyncIterable<Uint8Array[]> | no | yes | yes | 64 | 23.73 MiB/s | 46195346 | -577171566 | 5774418 | 90226 | yes | 200.1 MiB |
| syncIterableBatch1 | sync-iterable-byte-batch | sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 1 | 36.32 MiB/s | 46195346 | -577171566 | 5774418 | 5774418 | yes | 201.2 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 16 | 41.70 MiB/s | 46195346 | -577171566 | 5774418 | 360902 | yes | 209.5 MiB |
| syncIterableBatch64 | sync-iterable-byte-batch | sync-iterable-byte-batches | Iterable<Uint8Array[]> | no | no | yes | 64 | 44.09 MiB/s | 46195346 | -577171566 | 5774418 | 90226 | yes | 204.4 MiB |

## Findings

- full-string-parity (CONTRACT_FACT): All selected source-consumption rows preserve the same public event-object full-string checksum contract.
  - status=ok
  - events=46195346
  - checksum=-577171566
  - rows=readableStreamBatch1, readableStreamBatch16, readableStreamBatch64, asyncByteBatch16, asyncByteBatch64, syncIterableBatch1, syncIterableBatch16, syncIterableBatch64
- backpressure-preserved (SOURCE_FACT): All benchmark sources are demand-driven. The ReadableStream source enqueues in pull(), the async byte-batch source yields one batch only when next() is awaited, and the sync iterable source yields one batch per parser pull; no row preconsumes the whole target XML as one parser input.
  - readableStreamBatch1: sourceReads=5774419, sourceBatches=5774418
  - readableStreamBatch16: sourceReads=5774419, sourceBatches=5774418
  - readableStreamBatch64: sourceReads=5774419, sourceBatches=5774418
  - asyncByteBatch16: sourceReads=5774418, sourceBatches=360902
  - asyncByteBatch64: sourceReads=5774418, sourceBatches=90226
  - syncIterableBatch1: sourceReads=5774418, sourceBatches=5774418
  - syncIterableBatch16: sourceReads=5774418, sourceBatches=360902
  - syncIterableBatch64: sourceReads=5774418, sourceBatches=90226
- fixture-cycle-source-scope (SOURCE_FACT): The benchmark isolates parser/source API overhead by replaying prepared fixture rows, not by streaming the full target size from OS, network, or browser fetch.
  - fixtureSource=generated-diverse-cycle
  - fixtureRows=4096
  - sourceBytes=761644
  - actualBytes=1073741863
  - fileBackedRows=none
- async-byte-batch-headroom (BENCH_FACT): At batch size 16, async byte batches were 1.24x the ReadableStream row on this run; this row avoids direct ReadableStream consumption but still crosses an AsyncIterator source boundary.
  - readableStreamBatch16=18.58 MiB/s
  - asyncByteBatch16=22.95 MiB/s
- sync-iterable-byte-batch-headroom (BENCH_FACT): At batch size 16, sync iterable byte batches were 2.24x the ReadableStream row on this run; this is the row that removes the ReadableStream and AsyncIterator source boundary while preserving demand-driven pulls.
  - readableStreamBatch16=18.58 MiB/s
  - syncIterableBatch16=41.70 MiB/s
