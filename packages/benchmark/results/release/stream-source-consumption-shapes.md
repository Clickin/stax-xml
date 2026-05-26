# Stream Source Consumption Shapes

Generated: 2026-05-26T17:57:36.249Z

Compares demand-driven sync Iterable<Uint8Array[]>, async Iterable<Uint8Array[]>, and direct Web ReadableStream<Uint8Array> consumption under the same full-string checksum contract. The ReadableStream source reads only from pull(), and StreamReader groups at most the configured batch size per nextBatch() operation, so it stays bounded by consumer demand and does not pre-materialize the file.

## Source Contract

- Full checksum consumer: All rows preserve event count plus full-string checksum parity before throughput is compared. StreamBatch and raw-frame rows use different access surfaces but the same checksum contract.
- Sync Iterable input: sync-iterable-byte-batches uses StreamReaderSync over a synchronous Iterable<Uint8Array[]> and yields one grouped batch per parser pull.
- Async Iterable input: async-iterable-byte-batches uses StreamReader over an AsyncIterable<Uint8Array[]> and awaits one pre-grouped byte batch per parser pull.
- Primary large comparison input: The file-backed release comparison rows call external-baseline with --stax-stream-source file-sync-batches, which records synchronous Iterable<Uint8Array[]> parser input and directReadableStream=false.
- ReadableStream input: web-readable-stream-pull uses StreamReader over a Web ReadableStream<Uint8Array> pull source.
- ReadableStream async boundary: The direct ReadableStream rows include the public StreamReader await reader.read() boundary; batchSize controls how many chunks are grouped per bounded nextBatch() operation. Throughput is source-shape evidence, not a parser/runtime ceiling for sync byte batches.
- ReadableStream backpressure: The ReadableStream source reads only inside pull(); StreamReader consumes at most the configured readable batch size per nextBatch() operation, so production remains bounded by consumer demand.
- ArrayBuffer consumption: Neither measured row constructs one full XML string or one repeated 1 GiB ArrayBuffer parser input; file chunks are read on demand for the selected source shape.
- Chunk bytes: 65536
- Sync batch sizes: 1, 8, 16
- Async batch sizes: 1, 4, 8, 16
- ReadableStream batch sizes: 1, 4, 8, 16

## Source Facts

- Status: source-facts-confirmed
- Files:
  - packages/benchmark/stream-source-consumption-shapes.mjs (1050 lines)
  - packages/stax-xml/src/StreamReaderSync.ts (135 lines)
  - packages/stax-xml/src/StreamReader.ts (297 lines)
  - packages/stax-xml/src/IterableEventBackend.ts (659 lines)
  - packages/benchmark/file-backed-core-decomposition.mjs (366 lines)
  - packages/benchmark/external-baseline.mjs (1638 lines)
- sync-iterable-byte-batches (SOURCE_FACT): The sync comparison row feeds StreamReaderSync with demand-driven Iterable<Uint8Array[]> batches, not a full-file string or full-file ArrayBuffer.
  - packages/benchmark/stream-source-consumption-shapes.mjs:442: for (const batch of new StreamReaderSync(byteBatches))
  - packages/benchmark/stream-source-consumption-shapes.mjs:575: function* createFileByteBatches(filePath, chunkBytes, batchSize)
  - packages/benchmark/stream-source-consumption-shapes.mjs:587: yield batch
  - packages/benchmark/stream-source-consumption-shapes.mjs:606: yield batch
- single-arraybuffer-direct-batch (SOURCE_FACT): A direct Uint8Array StreamReaderSync input is wrapped as one single-item byte batch.
  - packages/stax-xml/src/StreamReaderSync.ts:52: const batches = source instanceof Uint8Array ? singleByteBatch(source) : source
  - packages/stax-xml/src/StreamReaderSync.ts:133: yield [source]
- stream-reader-single-chunk-push (SOURCE_FACT): The public StreamReader ReadableStream path awaits reader.read() and pushes bounded byte batches into the parser core.
  - packages/stax-xml/src/StreamReader.ts:222: readResult = await this.reader!.read()
  - packages/stax-xml/src/StreamReader.ts:219: byteBatch.length < this.batchSize
  - packages/stax-xml/src/StreamReader.ts:171: this.streamingBatches.pushByteBatch(byteBatch, false)
  - packages/stax-xml/src/StreamReader.ts:191: this.streamingBatches.pushByteBatch(byteBatch, false)
- stream-reader-async-byte-batches (SOURCE_FACT): The public StreamReader can consume demand-driven AsyncIterable<Uint8Array[]> batches without routing through ReadableStream.
  - packages/stax-xml/src/StreamReader.ts:14: AsyncIterable<StreamReaderSyncByteBatch>
  - packages/stax-xml/src/StreamReader.ts:264: AsyncIterable<StreamReaderSyncByteBatch>
  - packages/stax-xml/src/StreamReader.ts:69: this.byteBatchIterator = source[Symbol.asyncIterator]()
  - packages/stax-xml/src/StreamReader.ts:214: return await this.readNextAsyncIterableByteBatch()
- stream-reader-async-raw-batches (SOURCE_FACT): The public StreamReader can return raw frame batches from async sources without creating StreamBatch event wrapper objects.
  - packages/stax-xml/src/StreamReader.ts:101: async nextRawBatch(): Promise<StreamReaderSyncRawBatch | null>
  - packages/stax-xml/src/StreamReader.ts:108: return await this.readNextRawBatch()
  - packages/stax-xml/src/StreamReader.ts:192: return createRawBatch(this.streamingBatches.batchFrame())
  - packages/stax-xml/src/StreamReader.ts:198: return createRawBatch(this.streamingBatches.batchFrame())
- event-reader-async-byte-batches (SOURCE_FACT): The public EventReader ReadableStream adapter converts stream chunks into AsyncIterable<Uint8Array[]> batches before materializing events.
  - packages/stax-xml/src/IterableEventBackend.ts:247: yield* toAsyncByteBatches(readReadableStreamChunksIncrementally(stream, options.maxChunkBytes)
  - packages/stax-xml/src/IterableEventBackend.ts:259: const result = await reader.read()
  - packages/stax-xml/src/IterableEventBackend.ts:282: const result = await reader.read()
  - packages/stax-xml/src/IterableEventBackend.ts:265: yield chunk
  - packages/stax-xml/src/IterableEventBackend.ts:269: yield chunk
- benchmark-readable-stream-backpressure (SOURCE_FACT): The direct ReadableStream benchmark source reads exactly one file chunk inside pull(), and StreamReader caps grouped consumption by configured batch size.
  - packages/benchmark/stream-source-consumption-shapes.mjs:626: pull(controller)
  - packages/benchmark/stream-source-consumption-shapes.mjs:582: const bytesRead = readSync(fd, buffer, 0, chunkBytes, null)
  - packages/benchmark/stream-source-consumption-shapes.mjs:601: const bytesRead = readSync(fd, buffer, 0, chunkBytes, null)
  - packages/benchmark/stream-source-consumption-shapes.mjs:628: const bytesRead = readSync(fd, buffer, 0, chunkBytes, null)
  - packages/benchmark/stream-source-consumption-shapes.mjs:634: controller.enqueue(bytesRead === chunkBytes ? buffer : buffer.subarray(0, bytesRead))
  - packages/benchmark/stream-source-consumption-shapes.mjs:453: new StreamReader(stream, { batchSize })
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
- Async Iterable batch sizes: 1, 4, 8, 16
- Fastest row: web-readable-stream-pull-batch-16 75.09 MiB/s, RSS 109.36 MiB
- Fastest sync Iterable row: sync-iterable-byte-batches-batch-8 74.47 MiB/s, RSS 75.98 MiB
- Fastest async Iterable row: async-iterable-byte-batches-batch-8 74.61 MiB/s, RSS 88.09 MiB
- Fastest ReadableStream row: web-readable-stream-pull-batch-16 75.09 MiB/s, RSS 109.36 MiB
- Async Iterable / batch-1 sync Iterable ratio: 1.00x
- Fastest async Iterable / fastest sync Iterable ratio: 1.00x
- ReadableStream / batch-1 sync Iterable ratio: 0.99x
- ReadableStream / fastest sync Iterable ratio: 0.98x
- Fastest ReadableStream / fastest sync Iterable ratio: 1.01x
- 200 MiB/s bounded full-string counterexamples: 0

## Rows

| Row | Source shape | Batch size | MiB/s | Samples | Spread | Bounded | Max RSS | Events | Checksum | Demand-driven | Stream backpressure |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- | --- |
| `sync-iterable-byte-batches` | Node + stax-xml StreamReaderSync over demand-driven Iterable<Uint8Array[]> file batches (batchSize=1) | 1 | 73.83 | 3 | 24.0% | yes | 67.62 MiB | 61236571 | -716099804 | yes | n/a |
| `sync-iterable-byte-batches-batch-8` | Node + stax-xml StreamReaderSync over demand-driven Iterable<Uint8Array[]> file batches (batchSize=8) | 8 | 74.47 | 3 | 2.0% | yes | 75.98 MiB | 61236571 | -716099804 | yes | n/a |
| `sync-iterable-byte-batches-batch-16` | Node + stax-xml StreamReaderSync over demand-driven Iterable<Uint8Array[]> file batches (batchSize=16) | 16 | 73.16 | 3 | 1.2% | yes | 86.20 MiB | 61236571 | -716099804 | yes | n/a |
| `async-iterable-byte-batches` | Node + stax-xml StreamReader over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=1) | 1 | 73.60 | 3 | 1.1% | yes | 85.28 MiB | 61236571 | -716099804 | yes | yes |
| `async-iterable-byte-batches-batch-4` | Node + stax-xml StreamReader over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=4) | 4 | 72.22 | 3 | 6.8% | yes | 86.57 MiB | 61236571 | -716099804 | yes | yes |
| `async-iterable-byte-batches-batch-8` | Node + stax-xml StreamReader over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=8) | 8 | 74.61 | 3 | 1.8% | yes | 88.09 MiB | 61236571 | -716099804 | yes | yes |
| `async-iterable-byte-batches-batch-16` | Node + stax-xml StreamReader over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=16) | 16 | 74.27 | 3 | 2.1% | yes | 87.42 MiB | 61236571 | -716099804 | yes | yes |
| `async-iterable-raw-frame` | Node + stax-xml StreamReader.nextRawBatch over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=1) | 1 | 65.04 | 3 | 4.0% | yes | 102.75 MiB | 61236571 | -716099804 | yes | yes |
| `async-iterable-raw-frame-batch-4` | Node + stax-xml StreamReader.nextRawBatch over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=4) | 4 | 64.24 | 3 | 1.8% | yes | 104.72 MiB | 61236571 | -716099804 | yes | yes |
| `async-iterable-raw-frame-batch-8` | Node + stax-xml StreamReader.nextRawBatch over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=8) | 8 | 65.21 | 3 | 1.2% | yes | 106.11 MiB | 61236571 | -716099804 | yes | yes |
| `async-iterable-raw-frame-batch-16` | Node + stax-xml StreamReader.nextRawBatch over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=16) | 16 | 63.74 | 3 | 0.7% | yes | 108.85 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-pull` | Node + stax-xml StreamReader over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=1) | 1 | 73.20 | 3 | 0.9% | yes | 108.45 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-pull-batch-4` | Node + stax-xml StreamReader over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=4) | 4 | 73.12 | 3 | 2.9% | yes | 109.77 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-pull-batch-8` | Node + stax-xml StreamReader over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=8) | 8 | 73.79 | 3 | 2.4% | yes | 110.16 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-pull-batch-16` | Node + stax-xml StreamReader over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=16) | 16 | 75.09 | 3 | 3.4% | yes | 109.36 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-raw-frame` | Node + stax-xml StreamReader.nextRawBatch over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=1) | 1 | 63.64 | 3 | 0.7% | yes | 104.38 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-raw-frame-batch-4` | Node + stax-xml StreamReader.nextRawBatch over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=4) | 4 | 62.70 | 3 | 7.1% | yes | 105.87 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-raw-frame-batch-8` | Node + stax-xml StreamReader.nextRawBatch over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=8) | 8 | 65.24 | 3 | 2.0% | yes | 107.56 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-raw-frame-batch-16` | Node + stax-xml StreamReader.nextRawBatch over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=16) | 16 | 64.69 | 3 | 1.8% | yes | 148.05 MiB | 61236571 | -716099804 | yes | yes |

## Findings

- same-contract-preserved (CONTRACT_FACT): All source-shape rows preserve the same full-string checksum contract.
  - 61236571:-716099804
- current-release-source-shape (CONTRACT_FACT): The current file-backed release comparison uses the sync Iterable<Uint8Array[]> shape, not direct Web ReadableStream consumption; grouped sync rows remain demand-driven parser pulls.
  - sync-iterable-byte-batches: batchSize=1, 73.83 MiB/s
  - sync-iterable-byte-batches-batch-8: batchSize=8, 74.47 MiB/s
  - sync-iterable-byte-batches-batch-16: batchSize=16, 73.16 MiB/s
- sync-batch-size-headroom (BENCH_FACT): The fastest sync Iterable<Uint8Array[]> row was sync-iterable-byte-batches-batch-8 at 74.47 MiB/s; this isolates grouped byte-batch source shape from direct ReadableStream async overhead.
  - sync-iterable-byte-batches: batchSize=1, rss=67.62 MiB, checksum=-716099804
  - sync-iterable-byte-batches-batch-8: batchSize=8, rss=75.98 MiB, checksum=-716099804
  - sync-iterable-byte-batches-batch-16: batchSize=16, rss=86.20 MiB, checksum=-716099804
- async-byte-batch-source-shape (BENCH_FACT): The fastest AsyncIterable<Uint8Array[]> row was async-iterable-byte-batches-batch-8 at 74.61 MiB/s (1.00x of the fastest sync row); this isolates an async batch boundary without direct ReadableStream reads.
  - async-iterable-byte-batches: batchSize=1, rss=85.28 MiB, checksum=-716099804
  - async-iterable-byte-batches-batch-4: batchSize=4, rss=86.57 MiB, checksum=-716099804
  - async-iterable-byte-batches-batch-8: batchSize=8, rss=88.09 MiB, checksum=-716099804
  - async-iterable-byte-batches-batch-16: batchSize=16, rss=87.42 MiB, checksum=-716099804
  - async-iterable-raw-frame: batchSize=1, rss=102.75 MiB, checksum=-716099804
  - async-iterable-raw-frame-batch-4: batchSize=4, rss=104.72 MiB, checksum=-716099804
  - async-iterable-raw-frame-batch-8: batchSize=8, rss=106.11 MiB, checksum=-716099804
  - async-iterable-raw-frame-batch-16: batchSize=16, rss=108.85 MiB, checksum=-716099804
- async-raw-frame-source-shape (BENCH_FACT): The fastest AsyncIterable nextRawBatch row was async-iterable-raw-frame-batch-8 at 65.21 MiB/s; this tests the async source with wrapper-free raw frame traversal.
  - async-iterable-raw-frame: batchSize=1, rss=102.75 MiB, checksum=-716099804
  - async-iterable-raw-frame-batch-4: batchSize=4, rss=104.72 MiB, checksum=-716099804
  - async-iterable-raw-frame-batch-8: batchSize=8, rss=106.11 MiB, checksum=-716099804
  - async-iterable-raw-frame-batch-16: batchSize=16, rss=108.85 MiB, checksum=-716099804
- readable-stream-direct-source-shape (BENCH_FACT): Direct ReadableStream consumption reached 73.20 MiB/s (0.98x of the fastest sync Iterable<Uint8Array[]> row); this is a separate source-shape row, not the current release comparison source.
  - sync-iterable-byte-batches=73.83 MiB/s rss=67.62 MiB
  - sync-iterable-byte-batches-batch-8=74.47 MiB/s rss=75.98 MiB
  - sync-iterable-byte-batches-batch-16=73.16 MiB/s rss=86.20 MiB
  - async-iterable-byte-batches=73.60 MiB/s rss=85.28 MiB
  - async-iterable-byte-batches-batch-4=72.22 MiB/s rss=86.57 MiB
  - async-iterable-byte-batches-batch-8=74.61 MiB/s rss=88.09 MiB
  - async-iterable-byte-batches-batch-16=74.27 MiB/s rss=87.42 MiB
  - async-iterable-raw-frame=65.04 MiB/s rss=102.75 MiB
  - async-iterable-raw-frame-batch-4=64.24 MiB/s rss=104.72 MiB
  - async-iterable-raw-frame-batch-8=65.21 MiB/s rss=106.11 MiB
  - async-iterable-raw-frame-batch-16=63.74 MiB/s rss=108.85 MiB
  - web-readable-stream-pull=73.20 MiB/s rss=108.45 MiB
  - web-readable-stream-pull-batch-4=73.12 MiB/s rss=109.77 MiB
  - web-readable-stream-pull-batch-8=73.79 MiB/s rss=110.16 MiB
  - web-readable-stream-pull-batch-16=75.09 MiB/s rss=109.36 MiB
  - web-readable-stream-raw-frame=63.64 MiB/s rss=104.38 MiB
  - web-readable-stream-raw-frame-batch-4=62.70 MiB/s rss=105.87 MiB
  - web-readable-stream-raw-frame-batch-8=65.24 MiB/s rss=107.56 MiB
  - web-readable-stream-raw-frame-batch-16=64.69 MiB/s rss=148.05 MiB
- readable-stream-batch-size-headroom (BENCH_FACT): The fastest bounded ReadableStream batch row was web-readable-stream-pull-batch-16 at 75.09 MiB/s; this tests whether grouping chunks behind the ReadableStream async boundary exposes headroom.
  - web-readable-stream-pull: batchSize=1, rss=108.45 MiB, checksum=-716099804
  - web-readable-stream-pull-batch-4: batchSize=4, rss=109.77 MiB, checksum=-716099804
  - web-readable-stream-pull-batch-8: batchSize=8, rss=110.16 MiB, checksum=-716099804
  - web-readable-stream-pull-batch-16: batchSize=16, rss=109.36 MiB, checksum=-716099804
  - web-readable-stream-raw-frame: batchSize=1, rss=104.38 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-batch-4: batchSize=4, rss=105.87 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-batch-8: batchSize=8, rss=107.56 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-batch-16: batchSize=16, rss=148.05 MiB, checksum=-716099804
- readable-stream-raw-frame-source-shape (BENCH_FACT): The fastest ReadableStream nextRawBatch row was web-readable-stream-raw-frame-batch-8 at 65.24 MiB/s; this tests whether direct ReadableStream rows gain from wrapper-free raw frame traversal.
  - web-readable-stream-raw-frame: batchSize=1, rss=104.38 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-batch-4: batchSize=4, rss=105.87 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-batch-8: batchSize=8, rss=107.56 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-batch-16: batchSize=16, rss=148.05 MiB, checksum=-716099804
- backpressure-respected (CONTRACT_FACT): The async byte-batch rows advance the source iterator only from StreamReader.nextBatch(), and the ReadableStream rows read from the file only in pull().
  - async-iterable-byte-batches: demandDrivenSource=true, respectsBackpressure=true, batchSize=1
  - async-iterable-byte-batches-batch-4: demandDrivenSource=true, respectsBackpressure=true, batchSize=4
  - async-iterable-byte-batches-batch-8: demandDrivenSource=true, respectsBackpressure=true, batchSize=8
  - async-iterable-byte-batches-batch-16: demandDrivenSource=true, respectsBackpressure=true, batchSize=16
  - async-iterable-raw-frame: demandDrivenSource=true, respectsBackpressure=true, batchSize=1
  - async-iterable-raw-frame-batch-4: demandDrivenSource=true, respectsBackpressure=true, batchSize=4
  - async-iterable-raw-frame-batch-8: demandDrivenSource=true, respectsBackpressure=true, batchSize=8
  - async-iterable-raw-frame-batch-16: demandDrivenSource=true, respectsBackpressure=true, batchSize=16
  - web-readable-stream-pull: demandDrivenSource=true, respectsBackpressure=true, batchSize=1
  - web-readable-stream-pull-batch-4: demandDrivenSource=true, respectsBackpressure=true, batchSize=4
  - web-readable-stream-pull-batch-8: demandDrivenSource=true, respectsBackpressure=true, batchSize=8
  - web-readable-stream-pull-batch-16: demandDrivenSource=true, respectsBackpressure=true, batchSize=16
  - web-readable-stream-raw-frame: demandDrivenSource=true, respectsBackpressure=true, batchSize=1
  - web-readable-stream-raw-frame-batch-4: demandDrivenSource=true, respectsBackpressure=true, batchSize=4
  - web-readable-stream-raw-frame-batch-8: demandDrivenSource=true, respectsBackpressure=true, batchSize=8
  - web-readable-stream-raw-frame-batch-16: demandDrivenSource=true, respectsBackpressure=true, batchSize=16

## Limits

- This compares source consumption shapes inside Node/V8; it does not cover browser File/Blob stream implementations.
- The ReadableStream row is direct source-shape evidence, not the current release comparison source and not a JavaScript runtime ceiling proof. If it is faster or slower than the sync row in a given run, keep that as a benchmark fact rather than a global async-overhead conclusion.
- Rows preserve the same full-string checksum contract, but StreamBatch and raw-frame rows use different access surfaces; this does not isolate parser tokenization cost.

