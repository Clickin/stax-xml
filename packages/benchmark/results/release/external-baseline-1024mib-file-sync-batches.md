# External Parser Baseline Matrix

Generated: 2026-05-24T23:20:58.552Z

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
Current target throughput: 292.1 MiB/s.

| Tool | Implementation | Throughput | Woodstox ratio | 0.9x target | Average | Events | Checksum | Status |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | --- |
| stax-stream | Node + stax-xml StreamReaderSync file-backed Iterable<Uint8Array[]> | 93.8 MiB/s | 0.29x | below | 10916.14 ms | 61236571 | -716099804 | ok |
| stax-raw-frame-name-id | Node + stax-xml nextRawBatch name-id cache file-backed Iterable<Uint8Array[]> | 77.3 MiB/s | 0.24x | below | 13253.53 ms | 61236571 | -716099804 | ok |
| woodstox | Java + Woodstox 7.2.0 | 324.5 MiB/s | 1.00x | met | 3155.32 ms | 61236571 | -716099804 | ok |
| quick-xml | Rust + quick-xml 0.40.1 | 290.9 MiB/s | 0.90x | below | 3519.92 ms | 61236571 | -716099804 | ok |

## Contract

- Workload: full-string checksum over event type, element names, trimmed text, attribute names, and attribute values.
- `stax-stream` and `stax-raw-frame-name-id` use `stax-xml` `StreamReaderSync` byte batches; source mode: `file-sync-batches`, chunkKiB=64, batchSize=1.
- `stax-event` uses `stax-xml` `EventReaderSync` public event objects.
- `woodstox` uses Java `XMLStreamReader` from Woodstox with namespace awareness off, coalescing on, DTD and external entities disabled, and whitespace-only text skipped.
- `quick-xml` uses Rust `quick-xml` reader events and folds UTF-8 string views into the same UTF-16-code-unit checksum.
- Comparable rows should preserve event count and checksum. A mismatch means the row is not a valid speed comparison.
- In file-sync-batches mode, `stax-stream` reads the next chunk with `readSync` only when `StreamReaderSync` pulls the next `Uint8Array[]` batch; it does not pre-materialize the full XML file.
