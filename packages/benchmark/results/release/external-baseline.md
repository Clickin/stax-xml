# External Parser Baseline Matrix

Generated: 2026-05-23T04:59:35.707Z

This benchmark compares full string-return checksum consumers against external parser baselines.
Rows are comparable only because they share the same generated XML fixture and checksum contract.

## Environment

- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\runtime-comparison-16mib.xml
- Fixture size: 16.00 MiB
- Runs: warmups=1, runs=3

## Woodstox Target

Target: reach at least 0.9x Woodstox throughput on the same full-string checksum workload.
Current target throughput: 296.4 MiB/s.

| Tool | Implementation | Throughput | Woodstox ratio | 0.9x target | Average | Events | Checksum | Status |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | --- |
| stax-stream | Node + stax-xml StreamReaderSync | 106.4 MiB/s | 0.32x | below | 150.44 ms | 967967 | -746772258 | ok |
| stax-event | Node + stax-xml EventReaderSync | 93.5 MiB/s | 0.28x | below | 171.17 ms | 967967 | -746772258 | ok |
| woodstox | Java + Woodstox 7.2.0 | 329.3 MiB/s | 1.00x | met | 48.59 ms | 967967 | -746772258 | ok |
| quick-xml | Rust + quick-xml 0.40.1 | 302.3 MiB/s | 0.92x | met | 52.92 ms | 967967 | -746772258 | ok |

## Contract

- Workload: full-string checksum over event type, element names, trimmed text, attribute names, and attribute values.
- `stax-stream` uses `stax-xml` `StreamReaderSync` byte batches and index accessors.
- `stax-event` uses `stax-xml` `EventReaderSync` public event objects.
- `woodstox` uses Java `XMLStreamReader` from Woodstox with namespace awareness off, coalescing on, DTD and external entities disabled, and whitespace-only text skipped.
- `quick-xml` uses Rust `quick-xml` reader events and folds UTF-8 string views into the same UTF-16-code-unit checksum.
- Comparable rows should preserve event count and checksum. A mismatch means the row is not a valid speed comparison.
