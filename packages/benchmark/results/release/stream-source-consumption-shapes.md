# Stream Source Consumption Shapes

Generated: 2026-05-26T04:20:31.857Z

Compares demand-driven sync Iterable<Uint8Array[]> consumption with direct Web ReadableStream<Uint8Array> consumption under the same StreamBatch full-string checksum contract. The ReadableStream row reads one chunk only from pull(), so it respects stream backpressure and does not pre-materialize the file.

## Source Contract

- Full checksum consumer: Both rows execute the same StreamBatch full-string checksum consumer and must preserve event count plus checksum parity before throughput is compared.
- Sync Iterable input: sync-iterable-byte-batches uses StreamReaderSync over a synchronous Iterable<Uint8Array[]> and yields one grouped batch per parser pull.
- ReadableStream input: web-readable-stream-pull uses StreamReader over a Web ReadableStream<Uint8Array> pull source.
- ReadableStream backpressure: The ReadableStream source reads one file chunk only inside pull(), so production is demand-driven by StreamReader.read().
- ArrayBuffer consumption: Neither measured row constructs one full XML string or one repeated 1 GiB ArrayBuffer parser input; file chunks are read on demand for the selected source shape.
- Chunk bytes: 32768
- Sync batch size: 4

## Source Facts

- Status: source-facts-confirmed
- Files:
  - packages/benchmark/stream-source-consumption-shapes.mjs (698 lines)
  - packages/stax-xml/src/StreamReaderSync.ts (135 lines)
  - packages/stax-xml/src/StreamReader.ts (152 lines)
  - packages/stax-xml/src/IterableEventBackend.ts (659 lines)
- sync-iterable-byte-batches (SOURCE_FACT): The sync comparison row feeds StreamReaderSync with demand-driven Iterable<Uint8Array[]> batches, not a full-file string or full-file ArrayBuffer.
  - packages/benchmark/stream-source-consumption-shapes.mjs:323: for (const batch of new StreamReaderSync(byteBatches))
  - packages/benchmark/stream-source-consumption-shapes.mjs:367: function* createFileByteBatches(filePath, chunkBytes, batchSize)
  - packages/benchmark/stream-source-consumption-shapes.mjs:379: yield batch
- single-arraybuffer-direct-batch (SOURCE_FACT): A direct Uint8Array StreamReaderSync input is wrapped as one single-item byte batch.
  - packages/stax-xml/src/StreamReaderSync.ts:52: const batches = source instanceof Uint8Array ? singleByteBatch(source) : source
  - packages/stax-xml/src/StreamReaderSync.ts:133: yield [source]
- stream-reader-single-chunk-push (SOURCE_FACT): The public StreamReader ReadableStream path pushes each read chunk as one single-item byte batch into the parser core.
  - packages/stax-xml/src/StreamReader.ts:117: readResult = await this.reader.read()
  - packages/stax-xml/src/StreamReader.ts:135: this.streamingBatches.pushByteBatch([readResult.value], false)
- event-reader-async-byte-batches (SOURCE_FACT): The public EventReader ReadableStream adapter converts stream chunks into AsyncIterable<Uint8Array[]> batches before materializing events.
  - packages/stax-xml/src/IterableEventBackend.ts:247: yield* toAsyncByteBatches(readReadableStreamChunksIncrementally(stream, options.maxChunkBytes)
  - packages/stax-xml/src/IterableEventBackend.ts:259: const result = await reader.read()
  - packages/stax-xml/src/IterableEventBackend.ts:282: const result = await reader.read()
  - packages/stax-xml/src/IterableEventBackend.ts:265: yield chunk
  - packages/stax-xml/src/IterableEventBackend.ts:269: yield chunk
- benchmark-readable-stream-backpressure (SOURCE_FACT): The direct ReadableStream benchmark source reads exactly one file chunk inside pull(), so it respects Web Stream backpressure.
  - packages/benchmark/stream-source-consumption-shapes.mjs:399: pull(controller)
  - packages/benchmark/stream-source-consumption-shapes.mjs:374: const bytesRead = readSync(fd, buffer, 0, chunkBytes, null)
  - packages/benchmark/stream-source-consumption-shapes.mjs:401: const bytesRead = readSync(fd, buffer, 0, chunkBytes, null)
  - packages/benchmark/stream-source-consumption-shapes.mjs:407: controller.enqueue(bytesRead === chunkBytes ? buffer : buffer.subarray(0, bytesRead))

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 32
- Sync Iterable batch size: 4
- Fastest row: sync-iterable-byte-batches 138.89 MiB/s, RSS 59.85 MiB
- ReadableStream / sync Iterable ratio: 0.88x
- 200 MiB/s bounded full-string counterexamples: 0

## Rows

| Row | Source shape | MiB/s | Bounded | Max RSS | Events | Checksum | Demand-driven | Stream backpressure |
| --- | --- | ---: | --- | ---: | ---: | ---: | --- | --- |
| `sync-iterable-byte-batches` | Node + stax-xml StreamReaderSync over demand-driven Iterable<Uint8Array[]> file batches | 138.89 | yes | 59.85 MiB | 61236571 | -716099804 | yes | n/a |
| `web-readable-stream-pull` | Node + stax-xml StreamReader over backpressure-respecting ReadableStream<Uint8Array> pull source | 122.02 | yes | 65.87 MiB | 61236571 | -716099804 | yes | yes |

## Findings

- same-contract-preserved (CONTRACT_FACT): All source-shape rows preserve the same full-string checksum contract.
  - 61236571:-716099804
- current-release-source-shape (CONTRACT_FACT): The current file-backed release comparison uses the sync Iterable<Uint8Array[]> shape, not direct Web ReadableStream consumption.
  - sync-iterable-byte-batches: 138.89 MiB/s
- readable-stream-direct-source-shape (BENCH_FACT): Direct ReadableStream consumption reached 122.02 MiB/s (0.88x of sync Iterable<Uint8Array[]>); this is a separate source-shape row, not the current release comparison source.
  - sync-iterable-byte-batches=138.89 MiB/s rss=59.85 MiB
  - web-readable-stream-pull=122.02 MiB/s rss=65.87 MiB
- backpressure-respected (CONTRACT_FACT): The ReadableStream row reads from the file only in pull(), so production is demand-driven by StreamReader.read().
  - web-readable-stream-pull: demandDrivenSource=true, respectsBackpressure=true

## Limits

- This compares source consumption shapes inside Node/V8; it does not cover browser File/Blob stream implementations.
- The ReadableStream row is direct source-shape evidence, not the current release comparison source and not a JavaScript runtime ceiling proof. If it is faster or slower than the sync row in a given run, keep that as a benchmark fact rather than a global async-overhead conclusion.
- Both rows still execute the same StreamBatch full-string checksum consumer; this does not isolate parser tokenization cost.

