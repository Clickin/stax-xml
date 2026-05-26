# Stream Source Consumption Shapes

Generated: 2026-05-26T18:26:44.912Z

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
  - packages/benchmark/stream-source-consumption-shapes.mjs (1152 lines)
  - packages/stax-xml/src/StreamReaderSync.ts (135 lines)
  - packages/stax-xml/src/StreamReader.ts (297 lines)
  - packages/stax-xml/src/IterableEventBackend.ts (659 lines)
  - packages/benchmark/file-backed-core-decomposition.mjs (366 lines)
  - packages/benchmark/external-baseline.mjs (1638 lines)
- sync-iterable-byte-batches (SOURCE_FACT): The sync comparison row feeds StreamReaderSync with demand-driven Iterable<Uint8Array[]> batches, not a full-file string or full-file ArrayBuffer.
  - packages/benchmark/stream-source-consumption-shapes.mjs:466: for (const batch of new StreamReaderSync(byteBatches))
  - packages/benchmark/stream-source-consumption-shapes.mjs:665: function* createFileByteBatches(filePath, chunkBytes, batchSize)
  - packages/benchmark/stream-source-consumption-shapes.mjs:677: yield batch
  - packages/benchmark/stream-source-consumption-shapes.mjs:696: yield batch
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
  - packages/benchmark/stream-source-consumption-shapes.mjs:716: pull(controller)
  - packages/benchmark/stream-source-consumption-shapes.mjs:672: const bytesRead = readSync(fd, buffer, 0, chunkBytes, null)
  - packages/benchmark/stream-source-consumption-shapes.mjs:691: const bytesRead = readSync(fd, buffer, 0, chunkBytes, null)
  - packages/benchmark/stream-source-consumption-shapes.mjs:718: const bytesRead = readSync(fd, buffer, 0, chunkBytes, null)
  - packages/benchmark/stream-source-consumption-shapes.mjs:724: controller.enqueue(bytesRead === chunkBytes ? buffer : buffer.subarray(0, bytesRead))
  - packages/benchmark/stream-source-consumption-shapes.mjs:477: new StreamReader(stream, { batchSize })
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
- Fastest row: web-readable-stream-raw-frame-ascii-batch-8 76.87 MiB/s, RSS 156.87 MiB
- Fastest sync Iterable row: sync-iterable-byte-batches 75.36 MiB/s, RSS 67.79 MiB
- Fastest async Iterable row: async-iterable-raw-frame-ascii-batch-8 76.20 MiB/s, RSS 111.97 MiB
- Fastest ReadableStream row: web-readable-stream-raw-frame-ascii-batch-8 76.87 MiB/s, RSS 156.87 MiB
- Async Iterable / batch-1 sync Iterable ratio: 0.97x
- Fastest async Iterable / fastest sync Iterable ratio: 1.01x
- ReadableStream / batch-1 sync Iterable ratio: 0.95x
- ReadableStream / fastest sync Iterable ratio: 0.95x
- Fastest ReadableStream / fastest sync Iterable ratio: 1.02x
- 200 MiB/s bounded full-string counterexamples: 0

## Rows

| Row | Source shape | Batch size | MiB/s | Samples | Spread | Bounded | Max RSS | Events | Checksum | Demand-driven | Stream backpressure |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- | --- |
| `sync-iterable-byte-batches` | Node + stax-xml StreamReaderSync over demand-driven Iterable<Uint8Array[]> file batches (batchSize=1) | 1 | 75.36 | 3 | 23.5% | yes | 67.79 MiB | 61236571 | -716099804 | yes | n/a |
| `sync-iterable-byte-batches-batch-8` | Node + stax-xml StreamReaderSync over demand-driven Iterable<Uint8Array[]> file batches (batchSize=8) | 8 | 74.80 | 3 | 1.7% | yes | 75.98 MiB | 61236571 | -716099804 | yes | n/a |
| `sync-iterable-byte-batches-batch-16` | Node + stax-xml StreamReaderSync over demand-driven Iterable<Uint8Array[]> file batches (batchSize=16) | 16 | 73.11 | 3 | 2.2% | yes | 86.28 MiB | 61236571 | -716099804 | yes | n/a |
| `async-iterable-byte-batches` | Node + stax-xml StreamReader over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=1) | 1 | 73.30 | 3 | 2.9% | yes | 85.50 MiB | 61236571 | -716099804 | yes | yes |
| `async-iterable-byte-batches-batch-4` | Node + stax-xml StreamReader over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=4) | 4 | 72.16 | 3 | 4.9% | yes | 86.65 MiB | 61236571 | -716099804 | yes | yes |
| `async-iterable-byte-batches-batch-8` | Node + stax-xml StreamReader over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=8) | 8 | 72.88 | 3 | 2.8% | yes | 88.60 MiB | 61236571 | -716099804 | yes | yes |
| `async-iterable-byte-batches-batch-16` | Node + stax-xml StreamReader over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=16) | 16 | 72.55 | 3 | 1.9% | yes | 87.77 MiB | 61236571 | -716099804 | yes | yes |
| `async-iterable-raw-frame` | Node + stax-xml StreamReader.nextRawBatch over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=1) | 1 | 64.36 | 3 | 2.0% | yes | 103.80 MiB | 61236571 | -716099804 | yes | yes |
| `async-iterable-raw-frame-batch-4` | Node + stax-xml StreamReader.nextRawBatch over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=4) | 4 | 66.10 | 3 | 3.8% | yes | 104.58 MiB | 61236571 | -716099804 | yes | yes |
| `async-iterable-raw-frame-batch-8` | Node + stax-xml StreamReader.nextRawBatch over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=8) | 8 | 67.18 | 3 | 0.5% | yes | 106.16 MiB | 61236571 | -716099804 | yes | yes |
| `async-iterable-raw-frame-batch-16` | Node + stax-xml StreamReader.nextRawBatch over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=16) | 16 | 65.58 | 3 | 5.5% | yes | 105.35 MiB | 61236571 | -716099804 | yes | yes |
| `async-iterable-raw-frame-ascii` | Node + stax-xml StreamReader.nextRawBatch over demand-driven AsyncIterable<Uint8Array[]> file batches with short ASCII span materialization (batchSize=1) | 1 | 73.81 | 3 | 5.3% | yes | 108.66 MiB | 61236571 | -716099804 | yes | yes |
| `async-iterable-raw-frame-ascii-batch-4` | Node + stax-xml StreamReader.nextRawBatch over demand-driven AsyncIterable<Uint8Array[]> file batches with short ASCII span materialization (batchSize=4) | 4 | 74.92 | 3 | 3.7% | yes | 110.38 MiB | 61236571 | -716099804 | yes | yes |
| `async-iterable-raw-frame-ascii-batch-8` | Node + stax-xml StreamReader.nextRawBatch over demand-driven AsyncIterable<Uint8Array[]> file batches with short ASCII span materialization (batchSize=8) | 8 | 76.20 | 3 | 1.4% | yes | 111.97 MiB | 61236571 | -716099804 | yes | yes |
| `async-iterable-raw-frame-ascii-batch-16` | Node + stax-xml StreamReader.nextRawBatch over demand-driven AsyncIterable<Uint8Array[]> file batches with short ASCII span materialization (batchSize=16) | 16 | 75.46 | 3 | 1.7% | yes | 110.41 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-pull` | Node + stax-xml StreamReader over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=1) | 1 | 71.95 | 3 | 1.0% | yes | 109.13 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-pull-batch-4` | Node + stax-xml StreamReader over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=4) | 4 | 71.74 | 3 | 1.8% | yes | 110.88 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-pull-batch-8` | Node + stax-xml StreamReader over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=8) | 8 | 72.57 | 3 | 2.2% | yes | 112.22 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-pull-batch-16` | Node + stax-xml StreamReader over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=16) | 16 | 74.10 | 3 | 3.0% | yes | 110.53 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-raw-frame` | Node + stax-xml StreamReader.nextRawBatch over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=1) | 1 | 62.23 | 3 | 3.2% | yes | 143.03 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-raw-frame-batch-4` | Node + stax-xml StreamReader.nextRawBatch over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=4) | 4 | 62.79 | 3 | 2.3% | yes | 144.80 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-raw-frame-batch-8` | Node + stax-xml StreamReader.nextRawBatch over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=8) | 8 | 63.02 | 3 | 0.8% | yes | 146.07 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-raw-frame-batch-16` | Node + stax-xml StreamReader.nextRawBatch over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=16) | 16 | 64.04 | 3 | 1.1% | yes | 147.64 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-raw-frame-ascii` | Node + stax-xml StreamReader.nextRawBatch over backpressure-respecting ReadableStream<Uint8Array> pull source with short ASCII span materialization (batchSize=1) | 1 | 73.12 | 3 | 1.9% | yes | 151.33 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-raw-frame-ascii-batch-4` | Node + stax-xml StreamReader.nextRawBatch over backpressure-respecting ReadableStream<Uint8Array> pull source with short ASCII span materialization (batchSize=4) | 4 | 74.71 | 3 | 2.2% | yes | 154.71 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-raw-frame-ascii-batch-8` | Node + stax-xml StreamReader.nextRawBatch over backpressure-respecting ReadableStream<Uint8Array> pull source with short ASCII span materialization (batchSize=8) | 8 | 76.87 | 3 | 5.9% | yes | 156.87 MiB | 61236571 | -716099804 | yes | yes |
| `web-readable-stream-raw-frame-ascii-batch-16` | Node + stax-xml StreamReader.nextRawBatch over backpressure-respecting ReadableStream<Uint8Array> pull source with short ASCII span materialization (batchSize=16) | 16 | 75.04 | 3 | 1.7% | yes | 153.29 MiB | 61236571 | -716099804 | yes | yes |

## Findings

- same-contract-preserved (CONTRACT_FACT): All source-shape rows preserve the same full-string checksum contract.
  - 61236571:-716099804
- current-release-source-shape (CONTRACT_FACT): The current file-backed release comparison uses the sync Iterable<Uint8Array[]> shape, not direct Web ReadableStream consumption; grouped sync rows remain demand-driven parser pulls.
  - sync-iterable-byte-batches: batchSize=1, 75.36 MiB/s
  - sync-iterable-byte-batches-batch-8: batchSize=8, 74.80 MiB/s
  - sync-iterable-byte-batches-batch-16: batchSize=16, 73.11 MiB/s
- sync-batch-size-headroom (BENCH_FACT): The fastest sync Iterable<Uint8Array[]> row was sync-iterable-byte-batches at 75.36 MiB/s; this isolates grouped byte-batch source shape from direct ReadableStream async overhead.
  - sync-iterable-byte-batches: batchSize=1, rss=67.79 MiB, checksum=-716099804
  - sync-iterable-byte-batches-batch-8: batchSize=8, rss=75.98 MiB, checksum=-716099804
  - sync-iterable-byte-batches-batch-16: batchSize=16, rss=86.28 MiB, checksum=-716099804
- async-byte-batch-source-shape (BENCH_FACT): The fastest AsyncIterable<Uint8Array[]> row was async-iterable-raw-frame-ascii-batch-8 at 76.20 MiB/s (1.01x of the fastest sync row); this isolates an async batch boundary without direct ReadableStream reads.
  - async-iterable-byte-batches: batchSize=1, rss=85.50 MiB, checksum=-716099804
  - async-iterable-byte-batches-batch-4: batchSize=4, rss=86.65 MiB, checksum=-716099804
  - async-iterable-byte-batches-batch-8: batchSize=8, rss=88.60 MiB, checksum=-716099804
  - async-iterable-byte-batches-batch-16: batchSize=16, rss=87.77 MiB, checksum=-716099804
  - async-iterable-raw-frame: batchSize=1, rss=103.80 MiB, checksum=-716099804
  - async-iterable-raw-frame-batch-4: batchSize=4, rss=104.58 MiB, checksum=-716099804
  - async-iterable-raw-frame-batch-8: batchSize=8, rss=106.16 MiB, checksum=-716099804
  - async-iterable-raw-frame-batch-16: batchSize=16, rss=105.35 MiB, checksum=-716099804
  - async-iterable-raw-frame-ascii: batchSize=1, rss=108.66 MiB, checksum=-716099804
  - async-iterable-raw-frame-ascii-batch-4: batchSize=4, rss=110.38 MiB, checksum=-716099804
  - async-iterable-raw-frame-ascii-batch-8: batchSize=8, rss=111.97 MiB, checksum=-716099804
  - async-iterable-raw-frame-ascii-batch-16: batchSize=16, rss=110.41 MiB, checksum=-716099804
- async-raw-frame-source-shape (BENCH_FACT): The fastest AsyncIterable nextRawBatch row was async-iterable-raw-frame-ascii-batch-8 at 76.20 MiB/s; this tests the async source with wrapper-free raw frame traversal.
  - async-iterable-raw-frame: batchSize=1, rss=103.80 MiB, checksum=-716099804
  - async-iterable-raw-frame-batch-4: batchSize=4, rss=104.58 MiB, checksum=-716099804
  - async-iterable-raw-frame-batch-8: batchSize=8, rss=106.16 MiB, checksum=-716099804
  - async-iterable-raw-frame-batch-16: batchSize=16, rss=105.35 MiB, checksum=-716099804
  - async-iterable-raw-frame-ascii: batchSize=1, rss=108.66 MiB, checksum=-716099804
  - async-iterable-raw-frame-ascii-batch-4: batchSize=4, rss=110.38 MiB, checksum=-716099804
  - async-iterable-raw-frame-ascii-batch-8: batchSize=8, rss=111.97 MiB, checksum=-716099804
  - async-iterable-raw-frame-ascii-batch-16: batchSize=16, rss=110.41 MiB, checksum=-716099804
- readable-stream-direct-source-shape (BENCH_FACT): Direct ReadableStream consumption reached 71.95 MiB/s (0.95x of the fastest sync Iterable<Uint8Array[]> row); this is a separate source-shape row, not the current release comparison source.
  - sync-iterable-byte-batches=75.36 MiB/s rss=67.79 MiB
  - sync-iterable-byte-batches-batch-8=74.80 MiB/s rss=75.98 MiB
  - sync-iterable-byte-batches-batch-16=73.11 MiB/s rss=86.28 MiB
  - async-iterable-byte-batches=73.30 MiB/s rss=85.50 MiB
  - async-iterable-byte-batches-batch-4=72.16 MiB/s rss=86.65 MiB
  - async-iterable-byte-batches-batch-8=72.88 MiB/s rss=88.60 MiB
  - async-iterable-byte-batches-batch-16=72.55 MiB/s rss=87.77 MiB
  - async-iterable-raw-frame=64.36 MiB/s rss=103.80 MiB
  - async-iterable-raw-frame-batch-4=66.10 MiB/s rss=104.58 MiB
  - async-iterable-raw-frame-batch-8=67.18 MiB/s rss=106.16 MiB
  - async-iterable-raw-frame-batch-16=65.58 MiB/s rss=105.35 MiB
  - async-iterable-raw-frame-ascii=73.81 MiB/s rss=108.66 MiB
  - async-iterable-raw-frame-ascii-batch-4=74.92 MiB/s rss=110.38 MiB
  - async-iterable-raw-frame-ascii-batch-8=76.20 MiB/s rss=111.97 MiB
  - async-iterable-raw-frame-ascii-batch-16=75.46 MiB/s rss=110.41 MiB
  - web-readable-stream-pull=71.95 MiB/s rss=109.13 MiB
  - web-readable-stream-pull-batch-4=71.74 MiB/s rss=110.88 MiB
  - web-readable-stream-pull-batch-8=72.57 MiB/s rss=112.22 MiB
  - web-readable-stream-pull-batch-16=74.10 MiB/s rss=110.53 MiB
  - web-readable-stream-raw-frame=62.23 MiB/s rss=143.03 MiB
  - web-readable-stream-raw-frame-batch-4=62.79 MiB/s rss=144.80 MiB
  - web-readable-stream-raw-frame-batch-8=63.02 MiB/s rss=146.07 MiB
  - web-readable-stream-raw-frame-batch-16=64.04 MiB/s rss=147.64 MiB
  - web-readable-stream-raw-frame-ascii=73.12 MiB/s rss=151.33 MiB
  - web-readable-stream-raw-frame-ascii-batch-4=74.71 MiB/s rss=154.71 MiB
  - web-readable-stream-raw-frame-ascii-batch-8=76.87 MiB/s rss=156.87 MiB
  - web-readable-stream-raw-frame-ascii-batch-16=75.04 MiB/s rss=153.29 MiB
- readable-stream-batch-size-headroom (BENCH_FACT): The fastest bounded ReadableStream batch row was web-readable-stream-raw-frame-ascii-batch-8 at 76.87 MiB/s; this tests whether grouping chunks behind the ReadableStream async boundary exposes headroom.
  - web-readable-stream-pull: batchSize=1, rss=109.13 MiB, checksum=-716099804
  - web-readable-stream-pull-batch-4: batchSize=4, rss=110.88 MiB, checksum=-716099804
  - web-readable-stream-pull-batch-8: batchSize=8, rss=112.22 MiB, checksum=-716099804
  - web-readable-stream-pull-batch-16: batchSize=16, rss=110.53 MiB, checksum=-716099804
  - web-readable-stream-raw-frame: batchSize=1, rss=143.03 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-batch-4: batchSize=4, rss=144.80 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-batch-8: batchSize=8, rss=146.07 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-batch-16: batchSize=16, rss=147.64 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-ascii: batchSize=1, rss=151.33 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-ascii-batch-4: batchSize=4, rss=154.71 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-ascii-batch-8: batchSize=8, rss=156.87 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-ascii-batch-16: batchSize=16, rss=153.29 MiB, checksum=-716099804
- readable-stream-raw-frame-source-shape (BENCH_FACT): The fastest ReadableStream nextRawBatch row was web-readable-stream-raw-frame-ascii-batch-8 at 76.87 MiB/s; this tests whether direct ReadableStream rows gain from wrapper-free raw frame traversal.
  - web-readable-stream-raw-frame: batchSize=1, rss=143.03 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-batch-4: batchSize=4, rss=144.80 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-batch-8: batchSize=8, rss=146.07 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-batch-16: batchSize=16, rss=147.64 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-ascii: batchSize=1, rss=151.33 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-ascii-batch-4: batchSize=4, rss=154.71 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-ascii-batch-8: batchSize=8, rss=156.87 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-ascii-batch-16: batchSize=16, rss=153.29 MiB, checksum=-716099804
- backpressure-respected (CONTRACT_FACT): The async byte-batch rows advance the source iterator only from StreamReader.nextBatch(), and the ReadableStream rows read from the file only in pull().
  - async-iterable-byte-batches: demandDrivenSource=true, respectsBackpressure=true, batchSize=1
  - async-iterable-byte-batches-batch-4: demandDrivenSource=true, respectsBackpressure=true, batchSize=4
  - async-iterable-byte-batches-batch-8: demandDrivenSource=true, respectsBackpressure=true, batchSize=8
  - async-iterable-byte-batches-batch-16: demandDrivenSource=true, respectsBackpressure=true, batchSize=16
  - async-iterable-raw-frame: demandDrivenSource=true, respectsBackpressure=true, batchSize=1
  - async-iterable-raw-frame-batch-4: demandDrivenSource=true, respectsBackpressure=true, batchSize=4
  - async-iterable-raw-frame-batch-8: demandDrivenSource=true, respectsBackpressure=true, batchSize=8
  - async-iterable-raw-frame-batch-16: demandDrivenSource=true, respectsBackpressure=true, batchSize=16
  - async-iterable-raw-frame-ascii: demandDrivenSource=true, respectsBackpressure=true, batchSize=1
  - async-iterable-raw-frame-ascii-batch-4: demandDrivenSource=true, respectsBackpressure=true, batchSize=4
  - async-iterable-raw-frame-ascii-batch-8: demandDrivenSource=true, respectsBackpressure=true, batchSize=8
  - async-iterable-raw-frame-ascii-batch-16: demandDrivenSource=true, respectsBackpressure=true, batchSize=16
  - web-readable-stream-pull: demandDrivenSource=true, respectsBackpressure=true, batchSize=1
  - web-readable-stream-pull-batch-4: demandDrivenSource=true, respectsBackpressure=true, batchSize=4
  - web-readable-stream-pull-batch-8: demandDrivenSource=true, respectsBackpressure=true, batchSize=8
  - web-readable-stream-pull-batch-16: demandDrivenSource=true, respectsBackpressure=true, batchSize=16
  - web-readable-stream-raw-frame: demandDrivenSource=true, respectsBackpressure=true, batchSize=1
  - web-readable-stream-raw-frame-batch-4: demandDrivenSource=true, respectsBackpressure=true, batchSize=4
  - web-readable-stream-raw-frame-batch-8: demandDrivenSource=true, respectsBackpressure=true, batchSize=8
  - web-readable-stream-raw-frame-batch-16: demandDrivenSource=true, respectsBackpressure=true, batchSize=16
  - web-readable-stream-raw-frame-ascii: demandDrivenSource=true, respectsBackpressure=true, batchSize=1
  - web-readable-stream-raw-frame-ascii-batch-4: demandDrivenSource=true, respectsBackpressure=true, batchSize=4
  - web-readable-stream-raw-frame-ascii-batch-8: demandDrivenSource=true, respectsBackpressure=true, batchSize=8
  - web-readable-stream-raw-frame-ascii-batch-16: demandDrivenSource=true, respectsBackpressure=true, batchSize=16

## Limits

- This compares source consumption shapes inside Node/V8; it does not cover browser File/Blob stream implementations.
- The ReadableStream row is direct source-shape evidence, not the current release comparison source and not a JavaScript runtime ceiling proof. If it is faster or slower than the sync row in a given run, keep that as a benchmark fact rather than a global async-overhead conclusion.
- Rows preserve the same full-string checksum contract, but StreamBatch and raw-frame rows use different access surfaces; this does not isolate parser tokenization cost.

