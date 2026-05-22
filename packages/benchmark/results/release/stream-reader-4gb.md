# StreamReaderSync 4GiB Index-First Benchmark

Generated: 2026-05-22T14:39:28.832Z

This benchmark uses `StreamReaderSync` over generated `Uint8Array` batches and consumes each `StreamBatch` with `eventCount` plus index accessors.
It measures the public pure JavaScript stream reader path and does not use native addons, Wasm modules, or backend selection.

## Environment

- Package: stax-xml 1.0.0
- Runtime: Node 24.15.0 (win32-x64)
- Fixture: generated repeated person rows, 4.00 GiB
- Runs: warmups=0, runs=3

## Results

| Style | Throughput | Average | Min | Max | Events | Checksum | Avg RSS delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| index-for | 65.35 MiB/s | 62678.67 ms | 56697.89 ms | 72579.09 ms | 572662314 | -1788666544 | 4.0 MiB |
