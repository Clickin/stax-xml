# External Parser Baseline Matrix

Generated: 2026-05-25T00:44:58.278Z

This benchmark compares full string-return checksum consumers against external parser baselines.
Rows are comparable only because they share the same generated XML fixture and checksum contract.

## Environment

- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Runs: warmups=0, runs=1
- Bounded RSS gate: 512.0 MiB

## Woodstox Target

Target: reach at least 0.9x Woodstox throughput on the same full-string checksum workload.
Current target throughput: n/a until the Woodstox row is available.

| Tool | Implementation | Throughput | Woodstox ratio | 0.9x target | Average | Events | Checksum | Status |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | --- |
| stax-raw-frame-name-id | Node + stax-xml nextRawBatch name-id cache file-backed Iterable<Uint8Array[]> | 98.2 MiB/s | n/a | unknown | 10425.31 ms | 61236571 | -716099804 | ok |
| stax-raw-frame-string-cache | Node + stax-xml nextRawBatch name-id cache plus bounded value string cache file-backed Iterable<Uint8Array[]> | 28.9 MiB/s | n/a | unknown | 35439.95 ms | 61236571 | -716099804 | ok |

## Contract

- Workload: full-string checksum over event type, element names, trimmed text, attribute names, and attribute values.
- `stax-scan-all-no-decode` is a partial row: event types plus start-element attribute counts only.
- `stax-raw-frame-semantic-checksum` is a same-fields checksum row that avoids JavaScript string materialization on ASCII spans; it is not a full-string materialization row.
- `stax-stream`, `stax-raw-frame-name-id`, `stax-raw-frame-name-id-fold-trim`, and `stax-raw-frame-string-cache` use `stax-xml` `StreamReaderSync` byte batches; source mode: `file-sync-batches`, chunkKiB=64, batchSize=1.
- `stax-event` uses `stax-xml` `EventReaderSync` public event objects.
- `woodstox` uses Java `XMLStreamReader` from Woodstox with namespace awareness off, coalescing on, DTD and external entities disabled, and whitespace-only text skipped.
- `quick-xml` uses Rust `quick-xml` reader events and folds UTF-8 string views into the same UTF-16-code-unit checksum.
- Comparable rows should preserve event count and checksum. A mismatch means the row is not a valid speed comparison.
- In file-sync-batches mode, `stax-stream` reads the next chunk with `readSync` only when `StreamReaderSync` pulls the next `Uint8Array[]` batch; it does not pre-materialize the full XML file.
