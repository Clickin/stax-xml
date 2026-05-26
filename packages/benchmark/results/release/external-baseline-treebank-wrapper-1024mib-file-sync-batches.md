# External Parser Baseline Matrix

Generated: 2026-05-26T16:33:17.477Z

This benchmark compares full string-return checksum consumers against external parser baselines.
Rows are comparable only because they share the same generated XML fixture and checksum contract.

## Environment

- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: G:\tmp\stax-treebank-wrapper-1024mib.xml
- Fixture size: 1025.00 MiB
- Runs: warmups=0, runs=3
- Bounded RSS gate: 512.0 MiB

## Fixture Preparation

- Source seed: `packages/stax-xml/performance/samples/treebank_e.xml`
- Source seed bytes: 89565617
- Wrapper: synthetic `<ROOT>` document containing 12 complete copies of the treebank_e.xml `<FILE>` seed plus a closing `</ROOT>` tag.
- Purpose: candidate-headroom corpus-cycle rows replay the seed as byte batches; this external parser baseline wraps complete seed documents so Java/Woodstox and Rust/quick-xml can parse a single well-formed XML file under the same checksum contract.

## Woodstox Target

Target: reach at least 0.9x Woodstox throughput on the same full-string checksum workload.
Current target throughput: 149.4 MiB/s.

| Tool | Implementation | Throughput | Peak RSS | Woodstox ratio | 0.9x target | Average | Events | Checksum | Status |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| stax-stream | Node + stax-xml StreamReaderSync file-backed Iterable<Uint8Array[]> | 65.2 MiB/s | 73.9 MiB | 0.39x | below | 15726.60 ms | 75206128 | -1234990902 | ok |
| stax-raw-frame-name-id | Node + stax-xml nextRawBatch name-id cache file-backed Iterable<Uint8Array[]> | 68.2 MiB/s | 74.8 MiB | 0.41x | below | 15025.26 ms | 75206128 | -1234990902 | ok |
| woodstox | Java + Woodstox 7.2.0 | 166.0 MiB/s | 309.1 MiB | 1.00x | met | 6172.84 ms | 75206128 | -1234990902 | ok |
| quick-xml | Rust + quick-xml 0.40.1 | 175.8 MiB/s | 4.8 MiB | 1.06x | met | 5829.83 ms | 75206128 | -1234990902 | ok |

## Contract

- Workload: full-string checksum over event type, element names, trimmed text, attribute names, and attribute values.
- `stax-scan-all-no-decode` is a partial row: event types plus start-element attribute counts only.
- `stax-raw-frame-span-stats` is a partial row: raw frame event types, name ids, and span lengths only.
- `stax-raw-frame-semantic-checksum` is a same-fields checksum row that avoids JavaScript string materialization on ASCII spans; it is not a full-string materialization row.
- `stax-stream`, `stax-raw-frame-name-id`, `stax-raw-frame-name-id-long-ascii-text`, `stax-raw-frame-name-id-fold-trim`, `stax-raw-frame-name-id-trim-boundary-check`, `stax-raw-frame-string-cache`, and `stax-raw-frame-short-attr-value-cache` use `stax-xml` `StreamReaderSync` byte batches; source mode: `file-sync-batches`, chunkKiB=64, batchSize=1.
- `stax-event` uses `stax-xml` `EventReaderSync` public event objects.
- `woodstox` uses Java `XMLStreamReader` from Woodstox with namespace awareness off, coalescing on, DTD and external entities disabled, and whitespace-only text skipped.
- `quick-xml` uses Rust `quick-xml` reader events and folds UTF-8 string views into the same UTF-16-code-unit checksum.
- Comparable rows should preserve event count and checksum. A mismatch means the row is not a valid speed comparison.
- External parser rows record child-process peak RSS when the platform sampler can observe the process for long enough; missing RSS is not bounded-memory evidence.
- In file-sync-batches mode and related file-backed source modes, `stax-stream` reads with `readSync` only when `StreamReaderSync` pulls the next `Uint8Array[]` batch; it does not pre-materialize the full XML file.
