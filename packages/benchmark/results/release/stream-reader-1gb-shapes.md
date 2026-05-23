# StreamReaderSync Large Shape Benchmark

Generated: 2026-05-23T08:21:58.395Z

This benchmark uses `StreamReaderSync` over generated `Uint8Array` batches and consumes each row without loading a complete XML document string.
It measures the public pure JavaScript stream reader path and does not use native addons, Wasm modules, or backend selection.
Raw-frame rows keep the same full-string checksum contract while separating index-accessor and numeric name-id cache overhead.

## Environment

- Package: stax-xml 1.0.0
- Runtime: Node 24.15.0 / V8 13.6.233.17-node.48 (win32-x64)
- Fixture: generated repeated person rows, 1.00 GiB
- Runs: warmups=0, runs=1

## Results

| Style | Throughput | Average | Min | Max | Events | Checksum | String fields | Raw span materializations |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| index-for | 94.60 MiB/s | 10824.96 ms | 10824.96 ms | 10824.96 ms | 143165586 | -1871242243 | 178956980 | 0 |
| raw-frame-direct | 87.31 MiB/s | 11728.92 ms | 11728.92 ms | 11728.92 ms | 143165586 | -1871242243 | 178956980 | 178956980 |
| raw-frame-name-id | 98.45 MiB/s | 10401.67 ms | 10401.67 ms | 10401.67 ms | 143165586 | -1871242243 | 178956980 | 53687098 |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Style | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| index-for | +0.5 MiB | +5.4 MiB | 5.2 MiB | 58.5 MiB |
| raw-frame-direct | +2.2 MiB | +1.2 MiB | 7.1 MiB | 59.4 MiB |
| raw-frame-name-id | +1.3 MiB | +4.8 MiB | 6.3 MiB | 64.3 MiB |

## Materialization Counters

String fields are the names, text values, attribute names, and attribute values consumed by the checksum contract. Raw span materializations are string creations performed by the raw-frame benchmark code rather than by public accessors.

| Style | Names | Text | Attr names | Attr values | Raw name spans | Raw text spans | Raw attr-name spans | Raw attr-value spans | Name cache hit/miss | Implicit attr values | Event objects |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| index-for | 107374188 | 35791396 | 17895698 | 17895698 | 0 | 0 | 0 | 0 | 0/0 | 0 | 0 |
| raw-frame-direct | 107374188 | 35791396 | 17895698 | 17895698 | 107374188 | 35791396 | 17895698 | 17895698 | 0/0 | 0 | 0 |
| raw-frame-name-id | 107374188 | 35791396 | 17895698 | 17895698 | 3 | 35791396 | 1 | 17895698 | 125269882/4 | 0 | 0 |

## Parity

Status: ok
Events: 143165586
Checksum: -1871242243
