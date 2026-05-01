# simdxml Upstream Fixture Comparator

Generated: 2026-04-28T13:22:47.944Z

This benchmark reuses the upstream simdxml benchmark fixture lists and XML fixture files from `https://github.com/simdxml/simdxml`, then compares `simdxml::parse(&data)` with public stax-xml `IterableReader` rows over the same read-once in-memory bytes.
The stax-xml native row initializes the package with `initStaxXml({ backend: "native" })` and measures only the public `stax-xml/iterable/node` reader surface. It does not import or call private native diagnostic entry points directly.

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
- `stax-xml-public-iterable` uses the JavaScript IterableReader backend explicitly, even when a native runtime has been initialized for the native row.
- `stax-xml-native-node-iterable-reader` uses the public NodeIterableReader API with a native runtime backend. This is the only stax native row published by this comparator.
- Historical `--native-tiers` and `--native-simd` arguments are accepted and ignored so old command lines keep running, but this published report no longer exposes direct native diagnostic tiers.

## parse-throughput

| Case | Size | simdxml parse | stax public iterable | stax native NodeIterableReader |
| --- | ---: | ---: | ---: | ---: |
| patent_medium | 0.10 MiB | 2356.5 MiB/s (0.04 ms) | 124.8 MiB/s (0.81 ms) | 130.3 MiB/s (0.06x) |
| patent_large | 1.01 MiB | 2138.3 MiB/s (0.47 ms) | 227.2 MiB/s (4.44 ms) | 205.2 MiB/s (0.10x) |
| patent_xlarge | 10.07 MiB | 2171.2 MiB/s (4.64 ms) | 299.2 MiB/s (33.66 ms) | 439.4 MiB/s (0.20x) |
| attrheavy_large | 1.01 MiB | 2912.5 MiB/s (0.35 ms) | 90.5 MiB/s (11.20 ms) | 105.1 MiB/s (0.04x) |
| textheavy_large | 1.00 MiB | 15167.5 MiB/s (0.07 ms) | 483.2 MiB/s (2.07 ms) | 864.1 MiB/s (0.06x) |
| nested_large | 1.02 MiB | 2240.0 MiB/s (0.46 ms) | 194.4 MiB/s (5.25 ms) | 407.1 MiB/s (0.18x) |

## shape

| Case | Size | simdxml parse | stax public iterable | stax native NodeIterableReader |
| --- | ---: | ---: | ---: | ---: |
| patent | 1.01 MiB | 2241.3 MiB/s (0.45 ms) | 197.1 MiB/s (5.12 ms) | 264.6 MiB/s (0.12x) |
| attrheavy | 1.01 MiB | 2522.4 MiB/s (0.40 ms) | 73.9 MiB/s (13.71 ms) | 105.2 MiB/s (0.04x) |
| textheavy | 1.00 MiB | 14896.8 MiB/s (0.07 ms) | 542.1 MiB/s (1.85 ms) | 1095.7 MiB/s (0.07x) |
| nested | 1.02 MiB | 2242.9 MiB/s (0.46 ms) | 193.6 MiB/s (5.28 ms) | 355.7 MiB/s (0.16x) |

## scaling

| Case | Size | simdxml parse | stax public iterable | stax native NodeIterableReader |
| --- | ---: | ---: | ---: | ---: |
| 1KB | 0.00 MiB | 947.6 MiB/s (0.00 ms) | 19.5 MiB/s (0.13 ms) | 17.7 MiB/s (0.02x) |
| 100KB | 0.10 MiB | 2317.6 MiB/s (0.04 ms) | 77.4 MiB/s (1.30 ms) | 115.3 MiB/s (0.05x) |
| 1MB | 1.01 MiB | 2212.7 MiB/s (0.46 ms) | 208.4 MiB/s (4.84 ms) | 384.4 MiB/s (0.17x) |
| 10MB | 10.07 MiB | 2361.2 MiB/s (4.27 ms) | 309.2 MiB/s (32.58 ms) | 467.2 MiB/s (0.20x) |

## Contract Notes

The comparison intentionally keeps the upstream simdxml parse workload separate from the stax event workload. This avoids claiming XPath or CLI parity while still using upstream data shape, file sizes, and parse-benchmark case selection.
The stax native row is reported only through `NodeIterableReader`, the public Node parser surface used by application code.
