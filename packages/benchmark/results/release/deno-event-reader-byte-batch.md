# EventReader Byte Batch Benchmark

Generated: 2026-05-24T15:43:15.626Z

Compares direct ReadableStream chunk consumption with an AsyncIterable<Uint8Array[]> source that yields already-grouped byte batches. Both sources are demand-driven and do not enqueue/read the next batch until the reader asks for it.

## Options

- Size GiB: 1
- Runs: 1
- Warmups: 0
- Runtime: Deno/V8
- Diverse cycle size: 4096
- Batch sizes: 1, 16, 64
- Bounded RSS gate: 512.0 MiB

## Results

| Variant | Family | Batch size | Throughput | Events | Checksum | Source reads | Source batches | Bounded | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| readableStreamBatch1 | readable-stream | 1 | 20.17 MiB/s | 46195346 | -577171566 | 5774419 | 5774418 | yes | 97.1 MiB |
| readableStreamBatch16 | readable-stream | 16 | 28.39 MiB/s | 46195346 | -577171566 | 5774419 | 5774418 | yes | 132.1 MiB |
| readableStreamBatch64 | readable-stream | 64 | 29.38 MiB/s | 46195346 | -577171566 | 5774419 | 5774418 | yes | 134.0 MiB |
| asyncByteBatch16 | async-byte-batch | 16 | 30.59 MiB/s | 46195346 | -577171566 | 5774418 | 360902 | yes | 134.8 MiB |
| asyncByteBatch64 | async-byte-batch | 64 | 30.27 MiB/s | 46195346 | -577171566 | 5774418 | 90226 | yes | 136.1 MiB |

## Findings

- backpressure-preserved (SOURCE_FACT): Both benchmark sources are demand-driven. The ReadableStream source enqueues in pull(), and the async byte-batch source yields one batch only when next() is awaited.
  - readableStreamBatch1: sourceReads=5774419, sourceBatches=5774418
  - readableStreamBatch16: sourceReads=5774419, sourceBatches=5774418
  - readableStreamBatch64: sourceReads=5774419, sourceBatches=5774418
  - asyncByteBatch16: sourceReads=5774418, sourceBatches=360902
  - asyncByteBatch64: sourceReads=5774418, sourceBatches=90226
- async-byte-batch-headroom (BENCH_FACT): At batch size 16, async byte batches were 1.08x the ReadableStream row on this run.
  - readableStreamBatch16=28.39 MiB/s
  - asyncByteBatch16=30.59 MiB/s
