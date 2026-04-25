# JavaScript Runtime Benchmark Matrix

Generated: 2026-04-25T13:37:08.570Z

This fixture compares the same built `stax-xml` JavaScript implementation on Node, Bun, and Deno.
It does not compare native addons; native and non-JS runtimes are covered by `cross-runtime-comparison.json`.

## Environment

- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: G:\programming\stax-xml-spike-rust-native\packages\benchmark\test-data\runtime-comparison-16mib.xml
- Fixture size: 16.00 MiB
- Runs: warmups=1, runs=3

## Results

| Runtime | Version | Scenario | Throughput | Average | Events | Checksum | Peak heap | Status |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| node | 24.15.0 | public-sync-full-string | 52.2 MiB/s | 306.54 ms | 967967 | -746772258 | 199.8 MiB | ok |
| node | 24.15.0 | iterable-count-only | 197.1 MiB/s | 81.18 ms | 967967 | 2078515073 | 26.7 MiB | ok |
| node | 24.15.0 | iterable-full-string | 112.6 MiB/s | 142.07 ms | 967967 | 1007437756 | 54.5 MiB | ok |
| bun | 1.3.13 | public-sync-full-string | 78.7 MiB/s | 203.39 ms | 967967 | -746772258 | 77.0 MiB | ok |
| bun | 1.3.13 | iterable-count-only | 265.8 MiB/s | 60.20 ms | 967967 | 2078515073 | 263.3 MiB | ok |
| bun | 1.3.13 | iterable-full-string | 158.9 MiB/s | 100.72 ms | 967967 | 1007437756 | 68.4 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 56.5 MiB/s | 283.10 ms | 967967 | -746772258 | 191.8 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-count-only | 204.0 MiB/s | 78.42 ms | 967967 | 2078515073 | 30.4 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-full-string | 123.0 MiB/s | 130.05 ms | 967967 | 1007437756 | 26.2 MiB | ok |

## Contract

- `public-sync-full-string` uses `StaxXmlParserSync` and folds element names, text, attribute names, and attribute values into a checksum.
- `iterable-count-only` uses the browser-compatible iterable event-frame backend without string materialization.
- `iterable-full-string` uses the same event-frame backend and materializes the same full string checksum workload.
- All runtime rows must preserve event count and checksum for the same scenario.
