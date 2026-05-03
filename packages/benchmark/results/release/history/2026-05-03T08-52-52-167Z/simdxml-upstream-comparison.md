# simdxml Upstream Fixture Comparator

Generated: 2026-05-03T08:52:50.763Z

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
| patent_medium | 0.10 MiB | 1952.1 MiB/s (0.05 ms) | 39.5 MiB/s (2.56 ms) | 60.4 MiB/s (0.03x) |
| patent_large | 1.01 MiB | 2482.5 MiB/s (0.41 ms) | 58.7 MiB/s (17.17 ms) | 130.2 MiB/s (0.05x) |
| patent_xlarge | 10.07 MiB | 2563.3 MiB/s (3.93 ms) | 68.6 MiB/s (146.83 ms) | 115.4 MiB/s (0.05x) |
| attrheavy_large | 1.01 MiB | 3147.5 MiB/s (0.32 ms) | 10.5 MiB/s (96.90 ms) | 14.7 MiB/s (0.00x) |
| textheavy_large | 1.00 MiB | 13256.5 MiB/s (0.08 ms) | 194.6 MiB/s (5.15 ms) | 242.4 MiB/s (0.02x) |
| nested_large | 1.02 MiB | 2460.5 MiB/s (0.42 ms) | 73.7 MiB/s (13.86 ms) | 179.7 MiB/s (0.07x) |

## shape

| Case | Size | simdxml parse | stax EventReaderSync JS | stax StreamReaderSync native |
| --- | ---: | ---: | ---: | ---: |
| patent | 1.01 MiB | 2532.6 MiB/s (0.40 ms) | 63.9 MiB/s (15.77 ms) | 120.1 MiB/s (0.05x) |
| attrheavy | 1.01 MiB | 3000.1 MiB/s (0.34 ms) | 9.6 MiB/s (105.98 ms) | 14.9 MiB/s (0.00x) |
| textheavy | 1.00 MiB | 13747.8 MiB/s (0.07 ms) | 237.0 MiB/s (4.23 ms) | 422.2 MiB/s (0.03x) |
| nested | 1.02 MiB | 2519.0 MiB/s (0.41 ms) | 83.8 MiB/s (12.18 ms) | 198.5 MiB/s (0.08x) |

## scaling

| Case | Size | simdxml parse | stax EventReaderSync JS | stax StreamReaderSync native |
| --- | ---: | ---: | ---: | ---: |
| 1KB | 0.00 MiB | 900.2 MiB/s (0.00 ms) | 11.6 MiB/s (0.22 ms) | 10.7 MiB/s (0.01x) |
| 100KB | 0.10 MiB | 2013.6 MiB/s (0.05 ms) | 42.3 MiB/s (2.39 ms) | 83.2 MiB/s (0.04x) |
| 1MB | 1.01 MiB | 2375.5 MiB/s (0.42 ms) | 63.8 MiB/s (15.80 ms) | 149.4 MiB/s (0.06x) |
| 10MB | 10.07 MiB | 2542.3 MiB/s (3.96 ms) | 69.4 MiB/s (145.20 ms) | 114.7 MiB/s (0.05x) |

## Contract Notes

The comparison intentionally keeps the upstream simdxml parse workload separate from the stax event workload. This avoids claiming XPath or CLI parity while still using upstream data shape, file sizes, and parse-benchmark case selection.
The stax native row is reported only through `StreamReaderSync`, the public parser surface used by the native-wrapper gate.
