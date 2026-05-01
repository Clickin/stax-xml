# simdxml Upstream Fixture Comparator

Generated: 2026-05-01T15:17:26.803Z

This benchmark reuses the upstream simdxml benchmark fixture lists and XML fixture files from `https://github.com/simdxml/simdxml`, then compares `simdxml::parse(&data)` with public stax-xml event-reader rows over the same read-once in-memory bytes.
The stax-xml native row initializes the package with `initStaxXml({ backend: "native" })` and measures only the public `StreamReaderSync` surface. It does not import or call private native diagnostic entry points directly.

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
- `stax-xml-native-stream-reader` uses `StreamReaderSync` with a native streaming runtime backend. This is the only stax native row published by this comparator.
- Historical `--native-tiers` and `--native-simd` arguments are accepted and ignored so old command lines keep running, but this published report no longer exposes direct native diagnostic tiers.

## parse-throughput

| Case | Size | simdxml parse | stax EventReaderSync JS | stax StreamReaderSync native |
| --- | ---: | ---: | ---: | ---: |
| patent_medium | 0.10 MiB | 2263.6 MiB/s (0.04 ms) | 41.5 MiB/s (2.43 ms) | 79.7 MiB/s (0.04x) |
| patent_large | 1.01 MiB | 2328.7 MiB/s (0.43 ms) | 101.3 MiB/s (9.96 ms) | 123.3 MiB/s (0.05x) |
| patent_xlarge | 10.07 MiB | 2672.5 MiB/s (3.77 ms) | 149.6 MiB/s (67.31 ms) | 132.6 MiB/s (0.05x) |
| attrheavy_large | 1.01 MiB | 2842.7 MiB/s (0.36 ms) | 36.9 MiB/s (27.48 ms) | 15.1 MiB/s (0.01x) |
| textheavy_large | 1.00 MiB | 14260.6 MiB/s (0.07 ms) | 234.5 MiB/s (4.27 ms) | 780.0 MiB/s (0.05x) |
| nested_large | 1.02 MiB | 2368.9 MiB/s (0.43 ms) | 101.5 MiB/s (10.06 ms) | 225.1 MiB/s (0.10x) |

## shape

| Case | Size | simdxml parse | stax EventReaderSync JS | stax StreamReaderSync native |
| --- | ---: | ---: | ---: | ---: |
| patent | 1.01 MiB | 2332.2 MiB/s (0.43 ms) | 113.0 MiB/s (8.92 ms) | 188.2 MiB/s (0.08x) |
| attrheavy | 1.01 MiB | 2684.6 MiB/s (0.38 ms) | 37.8 MiB/s (26.84 ms) | 14.3 MiB/s (0.01x) |
| textheavy | 1.00 MiB | 16545.5 MiB/s (0.06 ms) | 197.2 MiB/s (5.08 ms) | 501.9 MiB/s (0.03x) |
| nested | 1.02 MiB | 2377.3 MiB/s (0.43 ms) | 94.6 MiB/s (10.80 ms) | 171.3 MiB/s (0.07x) |

## scaling

| Case | Size | simdxml parse | stax EventReaderSync JS | stax StreamReaderSync native |
| --- | ---: | ---: | ---: | ---: |
| 1KB | 0.00 MiB | 977.0 MiB/s (0.00 ms) | 10.1 MiB/s (0.25 ms) | 11.7 MiB/s (0.01x) |
| 100KB | 0.10 MiB | 2319.7 MiB/s (0.04 ms) | 47.3 MiB/s (2.14 ms) | 82.6 MiB/s (0.04x) |
| 1MB | 1.01 MiB | 2359.5 MiB/s (0.43 ms) | 112.2 MiB/s (8.98 ms) | 201.6 MiB/s (0.09x) |
| 10MB | 10.07 MiB | 2656.2 MiB/s (3.79 ms) | 144.0 MiB/s (69.93 ms) | 137.9 MiB/s (0.05x) |

## Contract Notes

The comparison intentionally keeps the upstream simdxml parse workload separate from the stax event workload. This avoids claiming XPath or CLI parity while still using upstream data shape, file sizes, and parse-benchmark case selection.
The stax native row is reported only through `StreamReaderSync`, the public parser surface used by the native-wrapper gate.
