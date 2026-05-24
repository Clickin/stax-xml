# EventReader Byte Batch Benchmark

Generated: 2026-05-24T17:45:45.431Z

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

## Results

| Variant | Family | Batch size | Throughput | Events | Checksum | Source reads | Source batches | Bounded | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| readableStreamBatch1 | readable-stream | 1 | 79.74 MiB/s | 57096514 | 45154785 | 235937 | 235936 | yes | 195.3 MiB |
| readableStreamBatch16 | readable-stream | 16 | 80.41 MiB/s | 57096514 | 45154785 | 235937 | 235936 | yes | 196.2 MiB |
| readableStreamBatch64 | readable-stream | 64 | 77.20 MiB/s | 57096514 | 45154785 | 235937 | 235936 | yes | 289.0 MiB |
| asyncByteBatch16 | async-byte-batch | 16 | 79.89 MiB/s | 57096514 | 45154785 | 235936 | 14746 | yes | 280.8 MiB |
| asyncByteBatch64 | async-byte-batch | 64 | 75.07 MiB/s | 57096514 | 45154785 | 235936 | 3687 | yes | 285.1 MiB |
| syncIterableBatch1 | sync-iterable-byte-batch | 1 | 132.57 MiB/s | 57096514 | 45154785 | 235936 | 235936 | yes | 289.4 MiB |
| syncIterableBatch16 | sync-iterable-byte-batch | 16 | 128.30 MiB/s | 57096514 | 45154785 | 235936 | 14746 | yes | 281.3 MiB |
| syncIterableBatch64 | sync-iterable-byte-batch | 64 | 131.17 MiB/s | 57096514 | 45154785 | 235936 | 3687 | yes | 291.7 MiB |

## Findings

- backpressure-preserved (SOURCE_FACT): All benchmark sources are demand-driven. The ReadableStream source enqueues in pull(), the async byte-batch source yields one batch only when next() is awaited, and the sync iterable source yields one batch per parser pull.
  - readableStreamBatch1: sourceReads=235937, sourceBatches=235936
  - readableStreamBatch16: sourceReads=235937, sourceBatches=235936
  - readableStreamBatch64: sourceReads=235937, sourceBatches=235936
  - asyncByteBatch16: sourceReads=235936, sourceBatches=14746
  - asyncByteBatch64: sourceReads=235936, sourceBatches=3687
  - syncIterableBatch1: sourceReads=235936, sourceBatches=235936
  - syncIterableBatch16: sourceReads=235936, sourceBatches=14746
  - syncIterableBatch64: sourceReads=235936, sourceBatches=3687
- async-byte-batch-headroom (BENCH_FACT): At batch size 16, async byte batches were 0.99x the ReadableStream row on this run.
  - readableStreamBatch16=80.41 MiB/s
  - asyncByteBatch16=79.89 MiB/s
- sync-iterable-byte-batch-headroom (BENCH_FACT): At batch size 16, sync iterable byte batches were 1.60x the ReadableStream row on this run.
  - readableStreamBatch16=80.41 MiB/s
  - syncIterableBatch16=128.30 MiB/s
