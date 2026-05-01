# simdxml Upstream Fixture Comparator

Generated: 2026-04-28T11:23:06.649Z

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
| patent_medium | 0.10 MiB | 2084.2 MiB/s (0.05 ms) | 126.9 MiB/s (0.80 ms) | 150.8 MiB/s (0.07x) |
| patent_large | 1.01 MiB | 2388.4 MiB/s (0.42 ms) | 190.8 MiB/s (5.28 ms) | 197.8 MiB/s (0.08x) |
| patent_xlarge | 10.07 MiB | 2698.0 MiB/s (3.73 ms) | 303.3 MiB/s (33.21 ms) | 306.9 MiB/s (0.11x) |
| attrheavy_large | 1.01 MiB | 2982.3 MiB/s (0.34 ms) | 84.7 MiB/s (11.96 ms) | 92.7 MiB/s (0.03x) |
| textheavy_large | 1.00 MiB | 14240.3 MiB/s (0.07 ms) | 503.5 MiB/s (1.99 ms) | 609.5 MiB/s (0.04x) |
| nested_large | 1.02 MiB | 2412.2 MiB/s (0.42 ms) | 176.7 MiB/s (5.78 ms) | 168.7 MiB/s (0.07x) |

## shape

| Case | Size | simdxml parse | stax public iterable | stax native NodeIterableReader |
| --- | ---: | ---: | ---: | ---: |
| patent | 1.01 MiB | 2278.2 MiB/s (0.44 ms) | 225.9 MiB/s (4.46 ms) | 220.5 MiB/s (0.10x) |
| attrheavy | 1.01 MiB | 2761.1 MiB/s (0.37 ms) | 97.2 MiB/s (10.43 ms) | 98.0 MiB/s (0.04x) |
| textheavy | 1.00 MiB | 12059.5 MiB/s (0.08 ms) | 493.2 MiB/s (2.03 ms) | 703.9 MiB/s (0.06x) |
| nested | 1.02 MiB | 2088.4 MiB/s (0.49 ms) | 197.9 MiB/s (5.16 ms) | 192.9 MiB/s (0.09x) |

## scaling

| Case | Size | simdxml parse | stax public iterable | stax native NodeIterableReader |
| --- | ---: | ---: | ---: | ---: |
| 1KB | 0.00 MiB | 940.5 MiB/s (0.00 ms) | 19.8 MiB/s (0.13 ms) | 25.3 MiB/s (0.03x) |
| 100KB | 0.10 MiB | 1999.2 MiB/s (0.05 ms) | 80.2 MiB/s (1.26 ms) | 85.1 MiB/s (0.04x) |
| 1MB | 1.01 MiB | 2227.8 MiB/s (0.45 ms) | 240.7 MiB/s (4.19 ms) | 241.9 MiB/s (0.11x) |
| 10MB | 10.07 MiB | 2490.3 MiB/s (4.04 ms) | 307.6 MiB/s (32.75 ms) | 328.1 MiB/s (0.13x) |

## Contract Notes

The comparison intentionally keeps the upstream simdxml parse workload separate from the stax event workload. This avoids claiming XPath or CLI parity while still using upstream data shape, file sizes, and parse-benchmark case selection.
The stax native row is reported only through `NodeIterableReader`, the public Node parser surface used by application code.
