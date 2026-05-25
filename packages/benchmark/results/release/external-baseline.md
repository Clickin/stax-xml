# External Parser Baseline Matrix

Generated: 2026-05-25T15:28:25.674Z

This benchmark compares full string-return checksum consumers against external parser baselines.
Rows are comparable only because they share the same generated XML fixture and checksum contract.

## Environment

- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\runtime-comparison-16mib.xml
- Fixture size: 16.00 MiB
- Runs: warmups=1, runs=3
- Bounded RSS gate: 512.0 MiB

## Woodstox Target

Target: reach at least 0.9x Woodstox throughput on the same full-string checksum workload.
Current target throughput: 272.8 MiB/s.

| Tool | Implementation | Throughput | Peak RSS | Woodstox ratio | 0.9x target | Average | Events | Checksum | Status |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| stax-scan-all-no-decode | Node + stax-xml StreamReaderSync scan-only preloaded Uint8Array | 167.9 MiB/s | 134.2 MiB | 0.55x | below | 95.29 ms | 967967 | -141941271 | ok |
| stax-raw-frame-semantic-checksum | Node + stax-xml nextRawBatch semantic byte-fold preloaded Uint8Array | 105.5 MiB/s | 134.3 MiB | 0.35x | below | 151.68 ms | 967967 | -746772258 | ok |
| stax-stream | Node + stax-xml StreamReaderSync preloaded Uint8Array | 99.3 MiB/s | 134.9 MiB | 0.33x | below | 161.17 ms | 967967 | -746772258 | ok |
| stax-raw-frame-name-id | Node + stax-xml nextRawBatch name-id cache preloaded Uint8Array | 119.1 MiB/s | 135.0 MiB | 0.39x | below | 134.39 ms | 967967 | -746772258 | ok |
| stax-raw-frame-name-id-fold-trim | Node + stax-xml nextRawBatch name-id cache fold-trim preloaded Uint8Array | 109.8 MiB/s | 135.1 MiB | 0.36x | below | 145.72 ms | 967967 | -746772258 | ok |
| stax-raw-frame-string-cache | Node + stax-xml nextRawBatch name-id cache plus bounded value string cache preloaded Uint8Array | 29.4 MiB/s | 358.8 MiB | 0.10x | below | 544.23 ms | 967967 | -746772258 | ok |
| stax-event | Node + stax-xml EventReaderSync | 84.8 MiB/s | 312.5 MiB | 0.28x | below | 188.58 ms | 967967 | -746772258 | ok |
| woodstox | Java + Woodstox 7.2.0 | 303.1 MiB/s | 121.6 MiB | 1.00x | met | 52.79 ms | 967967 | -746772258 | ok |
| quick-xml | Rust + quick-xml 0.40.1 | 243.4 MiB/s | 4.8 MiB | 0.80x | below | 65.73 ms | 967967 | -746772258 | ok |

## Contract

- Workload: full-string checksum over event type, element names, trimmed text, attribute names, and attribute values.
- `stax-scan-all-no-decode` is a partial row: event types plus start-element attribute counts only.
- `stax-raw-frame-semantic-checksum` is a same-fields checksum row that avoids JavaScript string materialization on ASCII spans; it is not a full-string materialization row.
- `stax-stream`, `stax-raw-frame-name-id`, `stax-raw-frame-name-id-fold-trim`, and `stax-raw-frame-string-cache` use `stax-xml` `StreamReaderSync` byte batches; source mode: `preloaded`, chunkKiB=64, batchSize=1.
- `stax-event` uses `stax-xml` `EventReaderSync` public event objects.
- `woodstox` uses Java `XMLStreamReader` from Woodstox with namespace awareness off, coalescing on, DTD and external entities disabled, and whitespace-only text skipped.
- `quick-xml` uses Rust `quick-xml` reader events and folds UTF-8 string views into the same UTF-16-code-unit checksum.
- Comparable rows should preserve event count and checksum. A mismatch means the row is not a valid speed comparison.
- External parser rows record child-process peak RSS when the platform sampler can observe the process for long enough; missing RSS is not bounded-memory evidence.
