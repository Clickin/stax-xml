# Stream Source Consumption Shapes

Generated: 2026-05-26T14:35:01.789Z

Compares demand-driven sync Iterable<Uint8Array[]> consumption with direct Web ReadableStream<Uint8Array> consumption under the same StreamBatch full-string checksum contract. The ReadableStream row reads one chunk only from pull(), so it respects stream backpressure and does not pre-materialize the file.

## Source Contract

- Full checksum consumer: Both rows execute the same StreamBatch full-string checksum consumer and must preserve event count plus checksum parity before throughput is compared.
- Sync Iterable input: sync-iterable-byte-batches uses StreamReaderSync over a synchronous Iterable<Uint8Array[]> and yields one grouped batch per parser pull.
- Primary large comparison input: The file-backed release comparison rows call external-baseline with --stax-stream-source file-sync-batches, which records synchronous Iterable<Uint8Array[]> parser input and directReadableStream=false.
- ReadableStream input: web-readable-stream-pull uses StreamReader over a Web ReadableStream<Uint8Array> pull source.
- ReadableStream async boundary: The direct ReadableStream row includes the public StreamReader await reader.read() boundary; its throughput is source-shape evidence, not a parser/runtime ceiling for sync byte batches.
- ReadableStream backpressure: The ReadableStream source reads one file chunk only inside pull(), so production is demand-driven by StreamReader.read().
- ArrayBuffer consumption: Neither measured row constructs one full XML string or one repeated 1 GiB ArrayBuffer parser input; file chunks are read on demand for the selected source shape.
- Chunk bytes: 65536
- Sync batch sizes: 1, 8, 16

## Source Facts

- Status: source-facts-confirmed
- Files:
  - packages/benchmark/stream-source-consumption-shapes.mjs (766 lines)
  - packages/stax-xml/src/StreamReaderSync.ts (135 lines)
  - packages/stax-xml/src/StreamReader.ts (152 lines)
  - packages/stax-xml/src/IterableEventBackend.ts (659 lines)
  - packages/benchmark/file-backed-core-decomposition.mjs (366 lines)
  - packages/benchmark/external-baseline.mjs (1638 lines)
- sync-iterable-byte-batches (SOURCE_FACT): The sync comparison row feeds StreamReaderSync with demand-driven Iterable<Uint8Array[]> batches, not a full-file string or full-file ArrayBuffer.
  - packages/benchmark/stream-source-consumption-shapes.mjs:360: for (const batch of new StreamReaderSync(byteBatches))
  - packages/benchmark/stream-source-consumption-shapes.mjs:404: function* createFileByteBatches(filePath, chunkBytes, batchSize)
  - packages/benchmark/stream-source-consumption-shapes.mjs:416: yield batch
- single-arraybuffer-direct-batch (SOURCE_FACT): A direct Uint8Array StreamReaderSync input is wrapped as one single-item byte batch.
  - packages/stax-xml/src/StreamReaderSync.ts:52: const batches = source instanceof Uint8Array ? singleByteBatch(source) : source
  - packages/stax-xml/src/StreamReaderSync.ts:133: yield [source]
- stream-reader-single-chunk-push (SOURCE_FACT): The public StreamReader ReadableStream path awaits reader.read() and pushes each read chunk as one single-item byte batch into the parser core.
  - packages/stax-xml/src/StreamReader.ts:117: readResult = await this.reader.read()
  - packages/stax-xml/src/StreamReader.ts:135: this.streamingBatches.pushByteBatch([readResult.value], false)
- event-reader-async-byte-batches (SOURCE_FACT): The public EventReader ReadableStream adapter converts stream chunks into AsyncIterable<Uint8Array[]> batches before materializing events.
  - packages/stax-xml/src/IterableEventBackend.ts:247: yield* toAsyncByteBatches(readReadableStreamChunksIncrementally(stream, options.maxChunkBytes)
  - packages/stax-xml/src/IterableEventBackend.ts:259: const result = await reader.read()
  - packages/stax-xml/src/IterableEventBackend.ts:282: const result = await reader.read()
  - packages/stax-xml/src/IterableEventBackend.ts:265: yield chunk
  - packages/stax-xml/src/IterableEventBackend.ts:269: yield chunk
- benchmark-readable-stream-backpressure (SOURCE_FACT): The direct ReadableStream benchmark source reads exactly one file chunk inside pull(), so it respects Web Stream backpressure.
  - packages/benchmark/stream-source-consumption-shapes.mjs:436: pull(controller)
  - packages/benchmark/stream-source-consumption-shapes.mjs:411: const bytesRead = readSync(fd, buffer, 0, chunkBytes, null)
  - packages/benchmark/stream-source-consumption-shapes.mjs:438: const bytesRead = readSync(fd, buffer, 0, chunkBytes, null)
  - packages/benchmark/stream-source-consumption-shapes.mjs:444: controller.enqueue(bytesRead === chunkBytes ? buffer : buffer.subarray(0, bytesRead))
- file-backed-release-sync-batches (SOURCE_FACT): The current file-backed core decomposition invokes external-baseline in file-sync-batches mode, so large release rows use demand-driven synchronous Iterable<Uint8Array[]> input rather than direct ReadableStream consumption.
  - packages/benchmark/file-backed-core-decomposition.mjs:144: --stax-stream-source
  - packages/benchmark/file-backed-core-decomposition.mjs:145: file-sync-batches
  - packages/benchmark/external-baseline.mjs:1060: parserInput: 'synchronous Iterable<Uint8Array[]>'
  - packages/benchmark/external-baseline.mjs:1067: directReadableStream: false

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 64
- Sync Iterable batch sizes: 1, 8, 16
- Fastest row: sync-iterable-byte-batches-batch-8 128.29 MiB/s, RSS 75.69 MiB
- Fastest sync Iterable row: sync-iterable-byte-batches-batch-8 128.29 MiB/s, RSS 75.69 MiB
- ReadableStream / batch-1 sync Iterable ratio: 1.06x
- ReadableStream / fastest sync Iterable ratio: 0.98x
- 200 MiB/s bounded full-string counterexamples: 0

## Rows

| Row | Source shape | Batch size | MiB/s | Samples | Spread | Bounded | Max RSS | Events | Checksum | Demand-driven | Stream backpressure |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- | --- |
| `sync-iterable-byte-batches` | Node + stax-xml StreamReaderSync over demand-driven Iterable<Uint8Array[]> file batches (batchSize=1) | 1 | 118.57 | 3 | 14.2% | yes | 67.43 MiB | 61236571 | -716099804 | yes | n/a |
| `sync-iterable-byte-batches-batch-8` | Node + stax-xml StreamReaderSync over demand-driven Iterable<Uint8Array[]> file batches (batchSize=8) | 8 | 128.29 | 3 | 4.5% | yes | 75.69 MiB | 61236571 | -716099804 | yes | n/a |
| `sync-iterable-byte-batches-batch-16` | Node + stax-xml StreamReaderSync over demand-driven Iterable<Uint8Array[]> file batches (batchSize=16) | 16 | 124.65 | 3 | 0.7% | yes | 85.80 MiB | 61236571 | -716099804 | yes | n/a |
| `web-readable-stream-pull` | Node + stax-xml StreamReader over backpressure-respecting ReadableStream<Uint8Array> pull source | n/a | 125.22 | 3 | 1.7% | yes | 85.46 MiB | 61236571 | -716099804 | yes | yes |

## Findings

- same-contract-preserved (CONTRACT_FACT): All source-shape rows preserve the same full-string checksum contract.
  - 61236571:-716099804
- current-release-source-shape (CONTRACT_FACT): The current file-backed release comparison uses the sync Iterable<Uint8Array[]> shape, not direct Web ReadableStream consumption; grouped sync rows remain demand-driven parser pulls.
  - sync-iterable-byte-batches: batchSize=1, 118.57 MiB/s
  - sync-iterable-byte-batches-batch-8: batchSize=8, 128.29 MiB/s
  - sync-iterable-byte-batches-batch-16: batchSize=16, 124.65 MiB/s
- sync-batch-size-headroom (BENCH_FACT): The fastest sync Iterable<Uint8Array[]> row was sync-iterable-byte-batches-batch-8 at 128.29 MiB/s; this isolates grouped byte-batch source shape from direct ReadableStream async overhead.
  - sync-iterable-byte-batches: batchSize=1, rss=67.43 MiB, checksum=-716099804
  - sync-iterable-byte-batches-batch-8: batchSize=8, rss=75.69 MiB, checksum=-716099804
  - sync-iterable-byte-batches-batch-16: batchSize=16, rss=85.80 MiB, checksum=-716099804
- readable-stream-direct-source-shape (BENCH_FACT): Direct ReadableStream consumption reached 125.22 MiB/s (0.98x of the fastest sync Iterable<Uint8Array[]> row); this is a separate source-shape row, not the current release comparison source.
  - sync-iterable-byte-batches=118.57 MiB/s rss=67.43 MiB
  - sync-iterable-byte-batches-batch-8=128.29 MiB/s rss=75.69 MiB
  - sync-iterable-byte-batches-batch-16=124.65 MiB/s rss=85.80 MiB
  - web-readable-stream-pull=125.22 MiB/s rss=85.46 MiB
- backpressure-respected (CONTRACT_FACT): The ReadableStream row reads from the file only in pull(), so production is demand-driven by StreamReader.read().
  - web-readable-stream-pull: demandDrivenSource=true, respectsBackpressure=true

## Limits

- This compares source consumption shapes inside Node/V8; it does not cover browser File/Blob stream implementations.
- The ReadableStream row is direct source-shape evidence, not the current release comparison source and not a JavaScript runtime ceiling proof. If it is faster or slower than the sync row in a given run, keep that as a benchmark fact rather than a global async-overhead conclusion.
- Both rows still execute the same StreamBatch full-string checksum consumer; this does not isolate parser tokenization cost.

