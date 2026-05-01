# simdxml Upstream Fixture Comparator

Generated: 2026-04-28T14:27:44.571Z

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
| patent_medium | 0.10 MiB | 2174.9 MiB/s (0.05 ms) | 126.0 MiB/s (0.80 ms) | 118.4 MiB/s (0.05x) |
| patent_large | 1.01 MiB | 2120.3 MiB/s (0.48 ms) | 203.0 MiB/s (4.97 ms) | 303.8 MiB/s (0.14x) |
| patent_xlarge | 10.07 MiB | 2341.5 MiB/s (4.30 ms) | 303.0 MiB/s (33.24 ms) | 475.0 MiB/s (0.20x) |
| attrheavy_large | 1.01 MiB | 2885.8 MiB/s (0.35 ms) | 85.8 MiB/s (11.81 ms) | 115.2 MiB/s (0.04x) |
| textheavy_large | 1.00 MiB | 15481.6 MiB/s (0.06 ms) | 538.8 MiB/s (1.86 ms) | 985.6 MiB/s (0.06x) |
| nested_large | 1.02 MiB | 2281.1 MiB/s (0.45 ms) | 174.1 MiB/s (5.87 ms) | 420.4 MiB/s (0.18x) |

## shape

| Case | Size | simdxml parse | stax public iterable | stax native NodeIterableReader |
| --- | ---: | ---: | ---: | ---: |
| patent | 1.01 MiB | 2323.4 MiB/s (0.43 ms) | 216.2 MiB/s (4.66 ms) | 431.7 MiB/s (0.19x) |
| attrheavy | 1.01 MiB | 2790.9 MiB/s (0.36 ms) | 93.2 MiB/s (10.88 ms) | 115.1 MiB/s (0.04x) |
| textheavy | 1.00 MiB | 14366.9 MiB/s (0.07 ms) | 478.8 MiB/s (2.09 ms) | 980.3 MiB/s (0.07x) |
| nested | 1.02 MiB | 2160.4 MiB/s (0.47 ms) | 230.3 MiB/s (4.43 ms) | 444.7 MiB/s (0.21x) |

## scaling

| Case | Size | simdxml parse | stax public iterable | stax native NodeIterableReader |
| --- | ---: | ---: | ---: | ---: |
| 1KB | 0.00 MiB | 962.0 MiB/s (0.00 ms) | 20.7 MiB/s (0.12 ms) | 20.0 MiB/s (0.02x) |
| 100KB | 0.10 MiB | 1943.8 MiB/s (0.05 ms) | 92.4 MiB/s (1.09 ms) | 213.8 MiB/s (0.11x) |
| 1MB | 1.01 MiB | 2238.9 MiB/s (0.45 ms) | 229.4 MiB/s (4.40 ms) | 330.0 MiB/s (0.15x) |
| 10MB | 10.07 MiB | 2579.2 MiB/s (3.91 ms) | 301.4 MiB/s (33.42 ms) | 481.0 MiB/s (0.19x) |

## Contract Notes

The comparison intentionally keeps the upstream simdxml parse workload separate from the stax event workload. This avoids claiming XPath or CLI parity while still using upstream data shape, file sizes, and parse-benchmark case selection.
The stax native row is reported only through `NodeIterableReader`, the public Node parser surface used by application code.
