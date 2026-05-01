# simdxml Upstream Fixture Comparator

Generated: 2026-05-01T14:59:31.376Z

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
| patent_medium | 0.10 MiB | 1910.0 MiB/s (0.05 ms) | 41.0 MiB/s (2.46 ms) | 75.7 MiB/s (0.04x) |
| patent_large | 1.01 MiB | 2470.0 MiB/s (0.41 ms) | 85.0 MiB/s (11.87 ms) | 120.6 MiB/s (0.05x) |
| patent_xlarge | 10.07 MiB | 2703.1 MiB/s (3.73 ms) | 148.4 MiB/s (67.88 ms) | 132.7 MiB/s (0.05x) |
| attrheavy_large | 1.01 MiB | 3319.0 MiB/s (0.31 ms) | 35.8 MiB/s (28.34 ms) | 14.5 MiB/s (0.00x) |
| textheavy_large | 1.00 MiB | 16083.2 MiB/s (0.06 ms) | 277.3 MiB/s (3.61 ms) | 581.6 MiB/s (0.04x) |
| nested_large | 1.02 MiB | 2231.8 MiB/s (0.46 ms) | 108.5 MiB/s (9.41 ms) | 231.5 MiB/s (0.10x) |

## shape

| Case | Size | simdxml parse | stax EventReaderSync JS | stax StreamReaderSync native |
| --- | ---: | ---: | ---: | ---: |
| patent | 1.01 MiB | 2282.9 MiB/s (0.44 ms) | 100.3 MiB/s (10.05 ms) | 199.7 MiB/s (0.09x) |
| attrheavy | 1.01 MiB | 3159.5 MiB/s (0.32 ms) | 37.8 MiB/s (26.82 ms) | 14.3 MiB/s (0.00x) |
| textheavy | 1.00 MiB | 12269.3 MiB/s (0.08 ms) | 176.6 MiB/s (5.67 ms) | 751.6 MiB/s (0.06x) |
| nested | 1.02 MiB | 2580.7 MiB/s (0.40 ms) | 82.3 MiB/s (12.41 ms) | 170.0 MiB/s (0.07x) |

## scaling

| Case | Size | simdxml parse | stax EventReaderSync JS | stax StreamReaderSync native |
| --- | ---: | ---: | ---: | ---: |
| 1KB | 0.00 MiB | 926.7 MiB/s (0.00 ms) | 12.1 MiB/s (0.21 ms) | 15.2 MiB/s (0.02x) |
| 100KB | 0.10 MiB | 1984.3 MiB/s (0.05 ms) | 36.1 MiB/s (2.80 ms) | 80.8 MiB/s (0.04x) |
| 1MB | 1.01 MiB | 2527.2 MiB/s (0.40 ms) | 73.3 MiB/s (13.76 ms) | 210.7 MiB/s (0.08x) |
| 10MB | 10.07 MiB | 2726.7 MiB/s (3.69 ms) | 144.1 MiB/s (69.92 ms) | 134.4 MiB/s (0.05x) |

## Contract Notes

The comparison intentionally keeps the upstream simdxml parse workload separate from the stax event workload. This avoids claiming XPath or CLI parity while still using upstream data shape, file sizes, and parse-benchmark case selection.
The stax native row is reported only through `StreamReaderSync`, the public parser surface used by the native-wrapper gate.
