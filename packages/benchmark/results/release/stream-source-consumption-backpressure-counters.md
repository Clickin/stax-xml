# Stream Source Consumption Shapes

Generated: 2026-06-01T05:28:42.014Z

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
- Sync batch sizes: 8
- Async batch sizes: 8
- ReadableStream batch sizes: 8

## Source Facts

- Status: source-facts-confirmed
- Files:
  - packages/benchmark/stream-source-consumption-shapes.mjs (1224 lines)
  - packages/stax-xml/src/StreamReaderSync.ts (135 lines)
  - packages/stax-xml/src/StreamReader.ts (297 lines)
  - packages/stax-xml/src/EventReader.ts (412 lines)
  - packages/stax-xml/src/IterableEventBackend.ts (659 lines)
  - packages/benchmark/file-backed-core-decomposition.mjs (366 lines)
  - packages/benchmark/external-baseline.mjs (1638 lines)
- sync-iterable-byte-batches (SOURCE_FACT): The sync comparison row feeds StreamReaderSync with demand-driven Iterable<Uint8Array[]> batches, not a full-file string or full-file ArrayBuffer.
  - packages/benchmark/stream-source-consumption-shapes.mjs:469: for (const batch of new StreamReaderSync(byteBatches))
  - packages/benchmark/stream-source-consumption-shapes.mjs:668: function* createFileByteBatches(filePath, chunkBytes, batchSize, sourceCounters = createSourceCounters())
  - packages/benchmark/stream-source-consumption-shapes.mjs:685: yield batch
  - packages/benchmark/stream-source-consumption-shapes.mjs:710: yield batch
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
- event-reader-direct-readable-stream-source (SOURCE_FACT): The public EventReader ReadableStream adapter reads bounded byte batches directly into the parser/materializer instead of routing through an async byte-batch generator.
  - packages/stax-xml/src/EventReader.ts:47: const source = new ReadableStreamEventSource(xmlStream
  - packages/stax-xml/src/EventReader.ts:230: class ReadableStreamEventSource implements AsyncEventBatchSource
  - packages/stax-xml/src/EventReader.ts:291: while (!this.sourceDone && byteBatch.length < this.batchSize)
  - packages/stax-xml/src/EventReader.ts:308: result = await this.reader.read()
  - packages/stax-xml/src/EventReader.ts:266: this.parser.pushByteBatch(byteBatch, false)
- benchmark-readable-stream-backpressure (SOURCE_FACT): The direct ReadableStream benchmark source reads exactly one file chunk inside pull(), and StreamReader caps grouped consumption by configured batch size.
  - packages/benchmark/stream-source-consumption-shapes.mjs:732: pull(controller)
  - packages/benchmark/stream-source-consumption-shapes.mjs:676: const bytesRead = readSync(fd, buffer, 0, chunkBytes, null)
  - packages/benchmark/stream-source-consumption-shapes.mjs:701: const bytesRead = readSync(fd, buffer, 0, chunkBytes, null)
  - packages/benchmark/stream-source-consumption-shapes.mjs:736: const bytesRead = readSync(fd, buffer, 0, chunkBytes, null)
  - packages/benchmark/stream-source-consumption-shapes.mjs:745: controller.enqueue(bytesRead === chunkBytes ? buffer : buffer.subarray(0, bytesRead))
  - packages/benchmark/stream-source-consumption-shapes.mjs:480: new StreamReader(stream, { batchSize })
- file-backed-release-sync-batches (SOURCE_FACT): The current file-backed core decomposition invokes external-baseline in file-sync-batches mode, so large release rows use demand-driven synchronous Iterable<Uint8Array[]> input rather than direct ReadableStream consumption.
  - packages/benchmark/file-backed-core-decomposition.mjs:144: --stax-stream-source
  - packages/benchmark/file-backed-core-decomposition.mjs:145: file-sync-batches
  - packages/benchmark/external-baseline.mjs:1060: parserInput: 'synchronous Iterable<Uint8Array[]>'
  - packages/benchmark/external-baseline.mjs:1067: directReadableStream: false

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 64
- Sync Iterable batch sizes: 8
- Async Iterable batch sizes: 8
- Fastest row: async-iterable-raw-frame-ascii-batch-8 77.56 MiB/s, RSS 88.06 MiB
- Fastest sync Iterable row: sync-iterable-byte-batches-batch-8 71.96 MiB/s, RSS 74.51 MiB
- Fastest async Iterable row: async-iterable-raw-frame-ascii-batch-8 77.56 MiB/s, RSS 88.06 MiB
- Fastest ReadableStream row: web-readable-stream-raw-frame-ascii-batch-8 76.53 MiB/s, RSS 110.88 MiB
- Async Iterable / batch-1 sync Iterable ratio: n/ax
- Fastest async Iterable / fastest sync Iterable ratio: 1.08x
- ReadableStream / batch-1 sync Iterable ratio: n/ax
- ReadableStream / fastest sync Iterable ratio: n/ax
- Fastest ReadableStream / fastest sync Iterable ratio: 1.06x
- 200 MiB/s bounded full-string counterexamples: 0

## Rows

| Row | Source shape | Batch size | MiB/s | Samples | Spread | Bounded | Max RSS | Events | Checksum | Source reads | Source batches | Stream pulls | Demand-driven | Stream backpressure |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `sync-iterable-byte-batches-batch-8` | Node + stax-xml StreamReaderSync over demand-driven Iterable<Uint8Array[]> file batches (batchSize=8) | 8 | 71.96 | 3 | 13.2% | yes | 74.51 MiB | 61236571 | -716099804 | 16385 | 2048 | 0 | yes | n/a |
| `async-iterable-byte-batches-batch-8` | Node + stax-xml StreamReader over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=8) | 8 | 75.59 | 3 | 5.2% | yes | 86.88 MiB | 61236571 | -716099804 | 16385 | 2048 | 0 | yes | yes |
| `async-iterable-raw-frame-batch-8` | Node + stax-xml StreamReader.nextRawBatch over demand-driven AsyncIterable<Uint8Array[]> file batches (batchSize=8) | 8 | 65.25 | 3 | 4.2% | yes | 85.36 MiB | 61236571 | -716099804 | 16385 | 2048 | 0 | yes | yes |
| `async-iterable-raw-frame-ascii-batch-8` | Node + stax-xml StreamReader.nextRawBatch over demand-driven AsyncIterable<Uint8Array[]> file batches with short ASCII span materialization (batchSize=8) | 8 | 77.56 | 3 | 2.5% | yes | 88.06 MiB | 61236571 | -716099804 | 16385 | 2048 | 0 | yes | yes |
| `web-readable-stream-pull-batch-8` | Node + stax-xml StreamReader over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=8) | 8 | 75.49 | 3 | 1.3% | yes | 110.23 MiB | 61236571 | -716099804 | 16385 | 0 | 16385 | yes | yes |
| `web-readable-stream-raw-frame-batch-8` | Node + stax-xml StreamReader.nextRawBatch over backpressure-respecting ReadableStream<Uint8Array> pull source (batchSize=8) | 8 | 64.73 | 3 | 3.1% | yes | 106.11 MiB | 61236571 | -716099804 | 16385 | 0 | 16385 | yes | yes |
| `web-readable-stream-raw-frame-ascii-batch-8` | Node + stax-xml StreamReader.nextRawBatch over backpressure-respecting ReadableStream<Uint8Array> pull source with short ASCII span materialization (batchSize=8) | 8 | 76.53 | 3 | 2.4% | yes | 110.88 MiB | 61236571 | -716099804 | 16385 | 0 | 16385 | yes | yes |

## Findings

- same-contract-preserved (CONTRACT_FACT): All source-shape rows preserve the same full-string checksum contract.
  - 61236571:-716099804
- current-release-source-shape (CONTRACT_FACT): The current file-backed release comparison uses the sync Iterable<Uint8Array[]> shape, not direct Web ReadableStream consumption; grouped sync rows remain demand-driven parser pulls.
  - sync-iterable-byte-batches-batch-8: batchSize=8, 71.96 MiB/s
- sync-batch-size-headroom (BENCH_FACT): The fastest sync Iterable<Uint8Array[]> row was sync-iterable-byte-batches-batch-8 at 71.96 MiB/s; this isolates grouped byte-batch source shape from direct ReadableStream async overhead.
  - sync-iterable-byte-batches-batch-8: batchSize=8, rss=74.51 MiB, checksum=-716099804
- async-byte-batch-source-shape (BENCH_FACT): The fastest AsyncIterable<Uint8Array[]> row was async-iterable-raw-frame-ascii-batch-8 at 77.56 MiB/s (1.08x of the fastest sync row); this isolates an async batch boundary without direct ReadableStream reads.
  - async-iterable-byte-batches-batch-8: batchSize=8, rss=86.88 MiB, checksum=-716099804
  - async-iterable-raw-frame-batch-8: batchSize=8, rss=85.36 MiB, checksum=-716099804
  - async-iterable-raw-frame-ascii-batch-8: batchSize=8, rss=88.06 MiB, checksum=-716099804
- async-raw-frame-source-shape (BENCH_FACT): The fastest AsyncIterable nextRawBatch row was async-iterable-raw-frame-ascii-batch-8 at 77.56 MiB/s; this tests the async source with wrapper-free raw frame traversal.
  - async-iterable-raw-frame-batch-8: batchSize=8, rss=85.36 MiB, checksum=-716099804
  - async-iterable-raw-frame-ascii-batch-8: batchSize=8, rss=88.06 MiB, checksum=-716099804
- readable-stream-direct-source-shape (BENCH_FACT): Direct ReadableStream consumption reached 76.53 MiB/s (1.06x of the fastest sync Iterable<Uint8Array[]> row); this is a separate source-shape row, not the current release comparison source.
  - sync-iterable-byte-batches-batch-8=71.96 MiB/s rss=74.51 MiB
  - async-iterable-byte-batches-batch-8=75.59 MiB/s rss=86.88 MiB
  - async-iterable-raw-frame-batch-8=65.25 MiB/s rss=85.36 MiB
  - async-iterable-raw-frame-ascii-batch-8=77.56 MiB/s rss=88.06 MiB
  - web-readable-stream-pull-batch-8=75.49 MiB/s rss=110.23 MiB
  - web-readable-stream-raw-frame-batch-8=64.73 MiB/s rss=106.11 MiB
  - web-readable-stream-raw-frame-ascii-batch-8=76.53 MiB/s rss=110.88 MiB
- readable-stream-batch-size-headroom (BENCH_FACT): The fastest bounded ReadableStream batch row was web-readable-stream-raw-frame-ascii-batch-8 at 76.53 MiB/s; this tests whether grouping chunks behind the ReadableStream async boundary exposes headroom.
  - web-readable-stream-pull-batch-8: batchSize=8, rss=110.23 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-batch-8: batchSize=8, rss=106.11 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-ascii-batch-8: batchSize=8, rss=110.88 MiB, checksum=-716099804
- readable-stream-raw-frame-source-shape (BENCH_FACT): The fastest ReadableStream nextRawBatch row was web-readable-stream-raw-frame-ascii-batch-8 at 76.53 MiB/s; this tests whether direct ReadableStream rows gain from wrapper-free raw frame traversal.
  - web-readable-stream-raw-frame-batch-8: batchSize=8, rss=106.11 MiB, checksum=-716099804
  - web-readable-stream-raw-frame-ascii-batch-8: batchSize=8, rss=110.88 MiB, checksum=-716099804
- backpressure-respected (CONTRACT_FACT): The async byte-batch rows advance the source iterator only from StreamReader.nextBatch(), and the ReadableStream rows read from the file only in pull(). Source counters record stable per-run read, batch/yield, pull, and enqueue counts.
  - async-iterable-byte-batches-batch-8: demandDrivenSource=true, respectsBackpressure=true, batchSize=8, reads=16385, batches=2048, pulls=0, enqueues=0, stable=true
  - async-iterable-raw-frame-batch-8: demandDrivenSource=true, respectsBackpressure=true, batchSize=8, reads=16385, batches=2048, pulls=0, enqueues=0, stable=true
  - async-iterable-raw-frame-ascii-batch-8: demandDrivenSource=true, respectsBackpressure=true, batchSize=8, reads=16385, batches=2048, pulls=0, enqueues=0, stable=true
  - web-readable-stream-pull-batch-8: demandDrivenSource=true, respectsBackpressure=true, batchSize=8, reads=16385, batches=0, pulls=16385, enqueues=16384, stable=true
  - web-readable-stream-raw-frame-batch-8: demandDrivenSource=true, respectsBackpressure=true, batchSize=8, reads=16385, batches=0, pulls=16385, enqueues=16384, stable=true
  - web-readable-stream-raw-frame-ascii-batch-8: demandDrivenSource=true, respectsBackpressure=true, batchSize=8, reads=16385, batches=0, pulls=16385, enqueues=16384, stable=true
- source-counter-audit (CONTRACT_FACT): Measured rows retain source producer counters so source-shape comparisons can be audited without inferring producer behavior from throughput alone.
  - sync-iterable-byte-batches-batch-8: bytes=1073741644, chunks=16384, iteratorYields=2048, pullCalls=0
  - async-iterable-byte-batches-batch-8: bytes=1073741644, chunks=16384, iteratorYields=2048, pullCalls=0
  - async-iterable-raw-frame-batch-8: bytes=1073741644, chunks=16384, iteratorYields=2048, pullCalls=0
  - async-iterable-raw-frame-ascii-batch-8: bytes=1073741644, chunks=16384, iteratorYields=2048, pullCalls=0
  - web-readable-stream-pull-batch-8: bytes=1073741644, chunks=16384, iteratorYields=0, pullCalls=16385
  - web-readable-stream-raw-frame-batch-8: bytes=1073741644, chunks=16384, iteratorYields=0, pullCalls=16385
  - web-readable-stream-raw-frame-ascii-batch-8: bytes=1073741644, chunks=16384, iteratorYields=0, pullCalls=16385

## Limits

- This compares source consumption shapes inside Node/V8; it does not cover browser File/Blob stream implementations.
- The ReadableStream row is direct source-shape evidence, not the current release comparison source and not a JavaScript runtime ceiling proof. If it is faster or slower than the sync row in a given run, keep that as a benchmark fact rather than a global async-overhead conclusion.
- Rows preserve the same full-string checksum contract, but StreamBatch and raw-frame rows use different access surfaces; this does not isolate parser tokenization cost.

