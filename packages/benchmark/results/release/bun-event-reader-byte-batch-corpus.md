# EventReader Byte Batch Benchmark

Generated: 2026-05-24T16:30:24.108Z

Compares direct ReadableStream chunk consumption with an AsyncIterable<Uint8Array[]> source that yields already-grouped byte batches. Both sources are demand-driven and do not enqueue/read the next batch until the reader asks for it.

## Options

- Size GiB: 1
- Runs: 1
- Warmups: 0
- Runtime: Bun/JSC
- Fixture shape: corpus-cycle
- Corpus file: G:\programming\stax-xml\packages\stax-xml\performance\samples\treebank_e.xml
- Corpus chunk KiB: 64
- Diverse cycle size: 4096
- Fixture source bytes: 85.4 MiB
- Fixture chunk bytes: 65536
- Batch sizes: 1, 16, 64
- Bounded RSS gate: 512.0 MiB

## Results

| Variant | Family | Batch size | Throughput | Events | Checksum | Source reads | Source batches | Bounded | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| readableStreamBatch1 | readable-stream | 1 | 56.64 MiB/s | 75206126 | 1421140645 | 16405 | 16404 | yes | 501.3 MiB |
| readableStreamBatch16 | readable-stream | 16 | 56.03 MiB/s | 75206126 | 1421140645 | 16405 | 16404 | no | 728.4 MiB |
| readableStreamBatch64 | readable-stream | 64 | 52.92 MiB/s | 75206126 | 1421140645 | 16405 | 16404 | no | 1084.9 MiB |
| asyncByteBatch16 | async-byte-batch | 16 | 53.58 MiB/s | 75206126 | 1421140645 | 16404 | 1026 | no | 1057.7 MiB |
| asyncByteBatch64 | async-byte-batch | 64 | 55.08 MiB/s | 75206126 | 1421140645 | 16404 | 257 | no | 1101.4 MiB |

## Findings

- backpressure-preserved (SOURCE_FACT): Both benchmark sources are demand-driven. The ReadableStream source enqueues in pull(), and the async byte-batch source yields one batch only when next() is awaited.
  - readableStreamBatch1: sourceReads=16405, sourceBatches=16404
  - readableStreamBatch16: sourceReads=16405, sourceBatches=16404
  - readableStreamBatch64: sourceReads=16405, sourceBatches=16404
  - asyncByteBatch16: sourceReads=16404, sourceBatches=1026
  - asyncByteBatch64: sourceReads=16404, sourceBatches=257
- async-byte-batch-headroom (BENCH_FACT): At batch size 16, async byte batches were 0.96x the ReadableStream row on this run.
  - readableStreamBatch16=56.03 MiB/s
  - asyncByteBatch16=53.58 MiB/s
