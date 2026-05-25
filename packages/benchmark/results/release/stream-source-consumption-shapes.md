# Stream Source Consumption Shapes

Generated: 2026-05-25T04:47:09.193Z

Compares demand-driven sync Iterable<Uint8Array[]> consumption with direct Web ReadableStream<Uint8Array> consumption under the same StreamBatch full-string checksum contract. The ReadableStream row reads one chunk only from pull(), so it respects stream backpressure and does not pre-materialize the file.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 16
- Sync Iterable batch size: 1
- Fastest row: sync-iterable-byte-batches 97.54 MiB/s, RSS 71.37 MiB
- ReadableStream / sync Iterable ratio: 0.95x
- 200 MiB/s bounded full-string counterexamples: 0

## Rows

| Row | Source shape | MiB/s | Bounded | Max RSS | Events | Checksum | Backpressure |
| --- | --- | ---: | --- | ---: | ---: | ---: | --- |
| `sync-iterable-byte-batches` | Node + stax-xml StreamReaderSync over demand-driven Iterable<Uint8Array[]> file batches | 97.54 | yes | 71.37 MiB | 61236571 | -716099804 | n/a |
| `web-readable-stream-pull` | Node + stax-xml StreamReader over backpressure-respecting ReadableStream<Uint8Array> pull source | 92.50 | yes | 78.07 MiB | 61236571 | -716099804 | yes |

## Findings

- same-contract-preserved (CONTRACT_FACT): All source-shape rows preserve the same full-string checksum contract.
  - 61236571:-716099804
- current-release-source-shape (CONTRACT_FACT): The current file-backed release comparison uses the sync Iterable<Uint8Array[]> shape, not direct Web ReadableStream consumption.
  - sync-iterable-byte-batches: 97.54 MiB/s
- readable-stream-overhead (HEADROOM_EVIDENCE): Direct ReadableStream consumption reached 92.50 MiB/s (0.95x of sync Iterable<Uint8Array[]>).
  - sync-iterable-byte-batches=97.54 MiB/s rss=71.37 MiB
  - web-readable-stream-pull=92.50 MiB/s rss=78.07 MiB
- backpressure-respected (CONTRACT_FACT): The ReadableStream row reads from the file only in pull(), so production is demand-driven by StreamReader.read().
  - web-readable-stream-pull: respectsBackpressure=true

## Limits

- This compares source consumption shapes inside Node/V8; it does not cover browser File/Blob stream implementations.
- The ReadableStream row is useful as async overhead evidence, not as a JavaScript runtime ceiling proof.
- Both rows still execute the same StreamBatch full-string checksum consumer; this does not isolate parser tokenization cost.

