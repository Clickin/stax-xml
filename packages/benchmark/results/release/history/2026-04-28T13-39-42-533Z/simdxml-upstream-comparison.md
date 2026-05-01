# simdxml Upstream Fixture Comparator

Generated: 2026-04-28T13:39:40.779Z

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
| patent_medium | 0.10 MiB | 2217.8 MiB/s (0.05 ms) | 117.6 MiB/s (0.86 ms) | 118.8 MiB/s (0.05x) |
| patent_large | 1.01 MiB | 2444.5 MiB/s (0.41 ms) | 229.0 MiB/s (4.40 ms) | 298.5 MiB/s (0.12x) |
| patent_xlarge | 10.07 MiB | 2783.3 MiB/s (3.62 ms) | 304.3 MiB/s (33.10 ms) | 479.4 MiB/s (0.17x) |
| attrheavy_large | 1.01 MiB | 2952.9 MiB/s (0.34 ms) | 86.9 MiB/s (11.66 ms) | 119.2 MiB/s (0.04x) |
| textheavy_large | 1.00 MiB | 14839.4 MiB/s (0.07 ms) | 562.7 MiB/s (1.78 ms) | 1027.2 MiB/s (0.07x) |
| nested_large | 1.02 MiB | 2441.3 MiB/s (0.42 ms) | 172.0 MiB/s (5.94 ms) | 385.5 MiB/s (0.16x) |

## shape

| Case | Size | simdxml parse | stax public iterable | stax native NodeIterableReader |
| --- | ---: | ---: | ---: | ---: |
| patent | 1.01 MiB | 2395.6 MiB/s (0.42 ms) | 206.2 MiB/s (4.89 ms) | 450.1 MiB/s (0.19x) |
| attrheavy | 1.01 MiB | 2963.3 MiB/s (0.34 ms) | 99.3 MiB/s (10.20 ms) | 117.5 MiB/s (0.04x) |
| textheavy | 1.00 MiB | 16088.4 MiB/s (0.06 ms) | 555.7 MiB/s (1.80 ms) | 1313.0 MiB/s (0.08x) |
| nested | 1.02 MiB | 2288.9 MiB/s (0.45 ms) | 208.1 MiB/s (4.91 ms) | 394.5 MiB/s (0.17x) |

## scaling

| Case | Size | simdxml parse | stax public iterable | stax native NodeIterableReader |
| --- | ---: | ---: | ---: | ---: |
| 1KB | 0.00 MiB | 792.6 MiB/s (0.00 ms) | 21.3 MiB/s (0.12 ms) | 26.5 MiB/s (0.03x) |
| 100KB | 0.10 MiB | 2297.6 MiB/s (0.04 ms) | 81.1 MiB/s (1.24 ms) | 154.8 MiB/s (0.07x) |
| 1MB | 1.01 MiB | 2420.9 MiB/s (0.42 ms) | 241.2 MiB/s (4.18 ms) | 367.4 MiB/s (0.15x) |
| 10MB | 10.07 MiB | 2795.8 MiB/s (3.60 ms) | 296.0 MiB/s (34.03 ms) | 497.3 MiB/s (0.18x) |

## Contract Notes

The comparison intentionally keeps the upstream simdxml parse workload separate from the stax event workload. This avoids claiming XPath or CLI parity while still using upstream data shape, file sizes, and parse-benchmark case selection.
The stax native row is reported only through `NodeIterableReader`, the public Node parser surface used by application code.
