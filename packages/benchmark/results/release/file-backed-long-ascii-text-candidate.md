# External Parser Baseline Matrix

Generated: 2026-05-26T00:02:04.013Z

This benchmark compares full string-return checksum consumers against external parser baselines.
Rows are comparable only because they share the same generated XML fixture and checksum contract.

## Environment

- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Runs: warmups=0, runs=3
- Bounded RSS gate: 512.0 MiB

## Woodstox Target

Target: reach at least 0.9x Woodstox throughput on the same full-string checksum workload.
Current target throughput: 277.3 MiB/s.

| Tool | Implementation | Throughput | Peak RSS | Woodstox ratio | 0.9x target | Average | Events | Checksum | Status |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| stax-raw-frame-name-id | Node + stax-xml nextRawBatch name-id cache file-backed Iterable<Uint8Array[]> | 141.3 MiB/s | 61.3 MiB | 0.46x | below | 7247.52 ms | 61236571 | -716099804 | ok |
| stax-raw-frame-name-id-long-ascii-text | Node + stax-xml nextRawBatch name-id cache plus long ASCII text string path file-backed Iterable<Uint8Array[]> | 77.5 MiB/s | 99.6 MiB | 0.25x | below | 13209.59 ms | 61236571 | -716099804 | ok |
| woodstox | Java + Woodstox 7.2.0 | 308.1 MiB/s | 310.9 MiB | 1.00x | met | 3324.05 ms | 61236571 | -716099804 | ok |
| quick-xml | Rust + quick-xml 0.40.1 | 272.3 MiB/s | 4.8 MiB | 0.88x | below | 3760.14 ms | 61236571 | -716099804 | ok |

## Contract

- Workload: full-string checksum over event type, element names, trimmed text, attribute names, and attribute values.
- `stax-scan-all-no-decode` is a partial row: event types plus start-element attribute counts only.
- `stax-raw-frame-semantic-checksum` is a same-fields checksum row that avoids JavaScript string materialization on ASCII spans; it is not a full-string materialization row.
- `stax-stream`, `stax-raw-frame-name-id`, `stax-raw-frame-name-id-long-ascii-text`, `stax-raw-frame-name-id-fold-trim`, `stax-raw-frame-name-id-trim-boundary-check`, `stax-raw-frame-string-cache`, and `stax-raw-frame-short-attr-value-cache` use `stax-xml` `StreamReaderSync` byte batches; source mode: `file-sync-batches`, chunkKiB=32, batchSize=4.
- `stax-event` uses `stax-xml` `EventReaderSync` public event objects.
- `woodstox` uses Java `XMLStreamReader` from Woodstox with namespace awareness off, coalescing on, DTD and external entities disabled, and whitespace-only text skipped.
- `quick-xml` uses Rust `quick-xml` reader events and folds UTF-8 string views into the same UTF-16-code-unit checksum.
- Comparable rows should preserve event count and checksum. A mismatch means the row is not a valid speed comparison.
- External parser rows record child-process peak RSS when the platform sampler can observe the process for long enough; missing RSS is not bounded-memory evidence.
- In file-sync-batches mode, `stax-stream` reads the next chunk with `readSync` only when `StreamReaderSync` pulls the next `Uint8Array[]` batch; it does not pre-materialize the full XML file.
