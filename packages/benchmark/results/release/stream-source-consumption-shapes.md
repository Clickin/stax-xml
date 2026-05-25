# Stream Source Consumption Shapes

Generated: 2026-05-25T09:59:49.105Z

Compares demand-driven sync Iterable<Uint8Array[]> consumption with direct Web ReadableStream<Uint8Array> consumption under the same StreamBatch full-string checksum contract. The ReadableStream row reads one chunk only from pull(), so it respects stream backpressure and does not pre-materialize the file.

## Source Contract

- Full checksum consumer: Both rows execute the same StreamBatch full-string checksum consumer and must preserve event count plus checksum parity before throughput is compared.
- Sync Iterable input: sync-iterable-byte-batches uses StreamReaderSync over a synchronous Iterable<Uint8Array[]> and yields one grouped batch per parser pull.
- ReadableStream input: web-readable-stream-pull uses StreamReader over a Web ReadableStream<Uint8Array> pull source.
- ReadableStream backpressure: The ReadableStream source reads one file chunk only inside pull(), so production is demand-driven by StreamReader.read().
- ArrayBuffer consumption: Neither measured row constructs one full XML string or one repeated 1 GiB ArrayBuffer parser input; file chunks are read on demand for the selected source shape.
- Chunk bytes: 65536
- Sync batch size: 1

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 64
- Sync Iterable batch size: 1
- Fastest row: sync-iterable-byte-batches 122.26 MiB/s, RSS 70.70 MiB
- ReadableStream / sync Iterable ratio: 0.92x
- 200 MiB/s bounded full-string counterexamples: 0

## Rows

| Row | Source shape | MiB/s | Bounded | Max RSS | Events | Checksum | Demand-driven | Stream backpressure |
| --- | --- | ---: | --- | ---: | ---: | ---: | --- | --- |
| `sync-iterable-byte-batches` | Node + stax-xml StreamReaderSync over demand-driven Iterable<Uint8Array[]> file batches | 122.26 | yes | 70.70 MiB | 61236571 | -716099804 | yes | n/a |
| `web-readable-stream-pull` | Node + stax-xml StreamReader over backpressure-respecting ReadableStream<Uint8Array> pull source | 112.08 | yes | 77.24 MiB | 61236571 | -716099804 | yes | yes |

## Findings

- same-contract-preserved (CONTRACT_FACT): All source-shape rows preserve the same full-string checksum contract.
  - 61236571:-716099804
- current-release-source-shape (CONTRACT_FACT): The current file-backed release comparison uses the sync Iterable<Uint8Array[]> shape, not direct Web ReadableStream consumption.
  - sync-iterable-byte-batches: 122.26 MiB/s
- readable-stream-overhead (HEADROOM_EVIDENCE): Direct ReadableStream consumption reached 112.08 MiB/s (0.92x of sync Iterable<Uint8Array[]>).
  - sync-iterable-byte-batches=122.26 MiB/s rss=70.70 MiB
  - web-readable-stream-pull=112.08 MiB/s rss=77.24 MiB
- backpressure-respected (CONTRACT_FACT): The ReadableStream row reads from the file only in pull(), so production is demand-driven by StreamReader.read().
  - web-readable-stream-pull: demandDrivenSource=true, respectsBackpressure=true

## Limits

- This compares source consumption shapes inside Node/V8; it does not cover browser File/Blob stream implementations.
- The ReadableStream row is useful as async overhead evidence, not as a JavaScript runtime ceiling proof.
- Both rows still execute the same StreamBatch full-string checksum consumer; this does not isolate parser tokenization cost.

