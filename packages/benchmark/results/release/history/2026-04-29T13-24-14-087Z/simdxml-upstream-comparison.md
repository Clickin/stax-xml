# simdxml Upstream Fixture Comparator

Generated: 2026-04-29T13:23:49.265Z

This benchmark reuses the upstream simdxml benchmark fixture lists and XML fixture files from `https://github.com/simdxml/simdxml`, then compares `simdxml::parse(&data)` with public stax-xml `EventReaderSync` rows over the same read-once in-memory bytes.
The stax-xml native row initializes the package with `initStaxXml({ backend: "native" })` and measures only the public `EventReaderSync` surface. It does not import or call private native diagnostic entry points directly.

## Environment

- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Platform: win32-x64
- Node: v24.15.0
- Runs: warmups=2, runs=5
- Upstream: https://github.com/simdxml/simdxml
- Upstream ref: 539577043c27e537c2cf9e5a38e5e10d844e83b0
- Upstream HEAD: 539577043c27e537c2cf9e5a38e5e10d844e83b0
- Upstream parse bench: G:\programming\stax-xml\.omx\upstream\simdxml\crates\simdxml\benches\parse_bench.rs

## Scope

- Included upstream Criterion sections: `bench_parse_throughput`, `bench_parse_shapes`, and `bench_parse_scaling`.
- Fixture disclaimer: XML fixture names, grouping, and file contents are pulled from the simdxml repository at `539577043c27e537c2cf9e5a38e5e10d844e83b0`; they are used as benchmark input data, not as stax-xml-authored fixtures.
- Excluded: libxml2, Woodstox, roxmltree, xml-rs, CLI XPath scripts, persistent index, lazy parse, bloom, batch, and parallel parser sections.
- `simdxml-upstream-parse` is the upstream parse workload shape: parse the in-memory XML bytes and retain tag/text counts to prevent dead-code elimination.
- `stax-xml-js-event-reader` uses `EventReaderSync` with the JavaScript backend explicitly, even when a native runtime has been initialized for the native row.
- `stax-xml-native-event-reader` uses `EventReaderSync` with a native runtime backend. This is the only stax native row published by this comparator.
- Historical `--native-tiers` and `--native-simd` arguments are accepted and ignored so old command lines keep running, but this published report no longer exposes direct native diagnostic tiers.

## parse-throughput

| Case | Size | simdxml parse | stax EventReaderSync JS | stax EventReaderSync native |
| --- | ---: | ---: | ---: | ---: |
| patent_medium | 0.10 MiB | 2204.3 MiB/s (0.05 ms) | 43.0 MiB/s (2.35 ms) | 81.5 MiB/s (0.04x) |
| patent_large | 1.01 MiB | 2406.2 MiB/s (0.42 ms) | 88.9 MiB/s (11.34 ms) | 153.0 MiB/s (0.06x) |
| patent_xlarge | 10.07 MiB | 2655.6 MiB/s (3.79 ms) | 144.9 MiB/s (69.53 ms) | 253.3 MiB/s (0.10x) |
| attrheavy_large | 1.01 MiB | 2632.9 MiB/s (0.38 ms) | 36.3 MiB/s (27.92 ms) | 77.2 MiB/s (0.03x) |
| textheavy_large | 1.00 MiB | 14857.0 MiB/s (0.07 ms) | 258.7 MiB/s (3.87 ms) | 409.3 MiB/s (0.03x) |
| nested_large | 1.02 MiB | 2383.2 MiB/s (0.43 ms) | 131.3 MiB/s (7.78 ms) | 180.5 MiB/s (0.08x) |

## shape

| Case | Size | simdxml parse | stax EventReaderSync JS | stax EventReaderSync native |
| --- | ---: | ---: | ---: | ---: |
| patent | 1.01 MiB | 1604.9 MiB/s (0.63 ms) | 97.4 MiB/s (10.35 ms) | 176.0 MiB/s (0.11x) |
| attrheavy | 1.01 MiB | 1992.0 MiB/s (0.51 ms) | 35.5 MiB/s (28.56 ms) | 64.6 MiB/s (0.03x) |
| textheavy | 1.00 MiB | 13687.7 MiB/s (0.07 ms) | 274.1 MiB/s (3.65 ms) | 397.0 MiB/s (0.03x) |
| nested | 1.02 MiB | 2228.6 MiB/s (0.46 ms) | 120.5 MiB/s (8.48 ms) | 181.6 MiB/s (0.08x) |

## scaling

| Case | Size | simdxml parse | stax EventReaderSync JS | stax EventReaderSync native |
| --- | ---: | ---: | ---: | ---: |
| 1KB | 0.00 MiB | 900.2 MiB/s (0.00 ms) | 18.8 MiB/s (0.13 ms) | 25.2 MiB/s (0.03x) |
| 100KB | 0.10 MiB | 2239.5 MiB/s (0.05 ms) | 48.5 MiB/s (2.08 ms) | 89.3 MiB/s (0.04x) |
| 1MB | 1.01 MiB | 2174.3 MiB/s (0.46 ms) | 98.5 MiB/s (10.24 ms) | 123.9 MiB/s (0.06x) |
| 10MB | 10.07 MiB | 2271.3 MiB/s (4.43 ms) | 141.5 MiB/s (71.18 ms) | 269.6 MiB/s (0.12x) |

## Contract Notes

The comparison intentionally keeps the upstream simdxml parse workload separate from the stax event workload. This avoids claiming XPath or CLI parity while still using upstream data shape, file sizes, and parse-benchmark case selection.
The stax native row is reported only through `EventReaderSync`, the public parser surface used by application code.
