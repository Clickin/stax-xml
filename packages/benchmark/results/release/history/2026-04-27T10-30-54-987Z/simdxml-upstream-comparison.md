# simdxml Upstream Fixture Comparator

Generated: 2026-04-27T10:33:20.205Z

This benchmark reuses the upstream simdxml benchmark fixture lists and XML fixture files from `https://github.com/simdxml/simdxml`, then compares `simdxml::parse(&data)` with the stax-xml native aggregate addon over the same read-once in-memory bytes.
The stax-xml native rows are measured only through Node.js importing the napi-rs N-API addon (`@stax-xml/native-aggregate-probe`); this report does not call a standalone Rust binary or direct Rust library entry point for stax-xml.

## Environment

- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Platform: win32-x64
- Node: v24.15.0
- Runs: warmups=2, runs=5
- Native SIMD policy: auto
- Upstream: https://github.com/simdxml/simdxml
- Upstream ref: 539577043c27e537c2cf9e5a38e5e10d844e83b0
- Upstream HEAD: 539577043c27e537c2cf9e5a38e5e10d844e83b0
- Upstream parse bench: G:\programming\stax-xml\.omx\upstream\simdxml\crates\simdxml\benches\parse_bench.rs

## Scope

- Included upstream Criterion sections: `bench_parse_throughput`, `bench_parse_shapes`, and `bench_parse_scaling`.
- Fixture disclaimer: XML fixture names, grouping, and file contents are pulled from the simdxml repository at `539577043c27e537c2cf9e5a38e5e10d844e83b0`; they are used as benchmark input data, not as stax-xml-authored fixtures.
- Excluded: libxml2, Woodstox, roxmltree, xml-rs, CLI XPath scripts, persistent index, lazy parse, bloom, batch, and parallel parser sections.
- `simdxml-upstream-parse` is the upstream parse workload shape: parse the in-memory XML bytes and retain tag/text counts to prevent dead-code elimination.
- `stax-native-*` rows are Node+N-API measurements: the benchmark imports the JS wrapper, passes a Node Buffer across the N-API boundary once per measured sample, and reports the native aggregate result returned to Node.
- `stax-native-event-count-unsafe-gt` uses a raw `>` search for start-tag end detection; it is a quote-masking diagnostic lower bound and is unsafe for XML with `>` inside attribute values.
- `stax-native-event-count-byte-loop` and `stax-native-event-count-skip-quotes` are safe tag-end scanner diagnostics for comparing quote masking loop shapes.
- `stax-native-event-count-no-text` skips character/CDATA event handling and is a diagnostic upper bound for whitespace/text handling cost.
- `stax-native-event-count-no-checksum` keeps event detection but skips checksum folding to isolate benchmark-consumer overhead.
- `stax-native-event-count-no-text-no-checksum` combines those two diagnostic skips to expose the loop/markup lower bound.
- `stax-native-event-count-two-stage` uses a simdxml-style quote-masked structural bitmask walk for event counting.
- `stax-native-event-count-auto-stage` selects the two-stage event walk only when the first 4 KiB has a high quote-to-tag ratio.
- `stax-native-event-count-unchecked` skips attribute scanning and closing-tag stack/name validation; it is a diagnostic lower bound, not a conforming XML parser mode.
- `stax-native-event-count-only` skips attribute scanning but keeps closing-tag stack/name validation.
- `stax-native-count-only` is not a raw structural classifier; it emits the native aggregate event stream and folds event type plus attribute counts.
- `stax-native-count-eq-two-stage` counts quote-masked `=` positions as a well-formed XML attribute-count lower bound.
- `stax-native-count-auto-stage` applies the same quote-ratio dispatch to choose between count-only and the two-stage `=` count lower bound.
- `stax-native-full-string-direct` additionally folds element names, text, attribute names, and attribute values.
- `--native-simd=off|sse42|avx2|neon|auto` controls only the stax-xml native structural classifier behind two-stage and auto-stage tiers. It does not change the simdxml comparator row.
- Explicit SIMD policies fail instead of silently falling back when unavailable. On x86_64, `auto` tries AVX2 first, then SSE4.2, then scalar; on aarch64, `auto` uses NEON.
- Compare SIMD policies by rerunning this script with identical fixtures, tiers, warmups, and runs while changing only `--native-simd`. Keep `event-count-two-stage` / `count-eq-two-stage` as classifier diagnostics and `event-count-auto-stage` / `count-auto-stage` as representative heuristic tiers.

## parse-throughput

| Case | Size | simdxml parse | stax raw > | stax event unchecked | stax auto event | stax event checked | stax attr count | stax auto count | stax full string |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| patent_medium | 0.10 MiB | 2140.8 MiB/s (0.05 ms) | 2290.3 MiB/s (1.07x) | 2768.7 MiB/s (1.29x) | 2318.7 MiB/s (1.08x) | 2550.5 MiB/s (1.19x) | 2128.1 MiB/s (0.99x) | 1723.0 MiB/s (0.80x) | 753.1 MiB/s (0.35x) |
| patent_large | 1.01 MiB | 2316.4 MiB/s (0.44 ms) | 5081.6 MiB/s (2.19x) | 4154.9 MiB/s (1.79x) | 4341.6 MiB/s (1.87x) | 3803.8 MiB/s (1.64x) | 2965.7 MiB/s (1.28x) | 3009.6 MiB/s (1.30x) | 980.7 MiB/s (0.42x) |
| patent_xlarge | 10.07 MiB | 2583.9 MiB/s (3.90 ms) | 6092.3 MiB/s (2.36x) | 4641.2 MiB/s (1.80x) | 4644.9 MiB/s (1.80x) | 3473.3 MiB/s (1.34x) | 2937.4 MiB/s (1.14x) | 2992.9 MiB/s (1.16x) | 1055.0 MiB/s (0.41x) |
| attrheavy_large | 1.01 MiB | 2976.7 MiB/s (0.34 ms) | 6217.8 MiB/s (2.09x) | 2157.7 MiB/s (0.72x) | 3028.6 MiB/s (1.02x) | 2078.5 MiB/s (0.70x) | 1033.1 MiB/s (0.35x) | 3166.2 MiB/s (1.06x) | 658.7 MiB/s (0.22x) |
| textheavy_large | 1.00 MiB | 15419.7 MiB/s (0.06 ms) | 14404.1 MiB/s (0.93x) | 20955.3 MiB/s (1.36x) | 18172.4 MiB/s (1.18x) | 18311.9 MiB/s (1.19x) | 18332.0 MiB/s (1.19x) | 15685.3 MiB/s (1.02x) | 1360.3 MiB/s (0.09x) |
| nested_large | 1.02 MiB | 2349.0 MiB/s (0.43 ms) | 4354.3 MiB/s (1.85x) | 4502.1 MiB/s (1.92x) | 4267.6 MiB/s (1.82x) | 3706.9 MiB/s (1.58x) | 3165.9 MiB/s (1.35x) | 3316.0 MiB/s (1.41x) | 2581.6 MiB/s (1.10x) |

## shape

| Case | Size | simdxml parse | stax raw > | stax event unchecked | stax auto event | stax event checked | stax attr count | stax auto count | stax full string |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| patent | 1.01 MiB | 2286.8 MiB/s (0.44 ms) | 5885.3 MiB/s (2.57x) | 4943.1 MiB/s (2.16x) | 4800.5 MiB/s (2.10x) | 3743.6 MiB/s (1.64x) | 3135.1 MiB/s (1.37x) | 3262.5 MiB/s (1.43x) | 1078.9 MiB/s (0.47x) |
| attrheavy | 1.01 MiB | 3153.6 MiB/s (0.32 ms) | 8816.1 MiB/s (2.80x) | 2384.4 MiB/s (0.76x) | 3994.9 MiB/s (1.27x) | 2047.0 MiB/s (0.65x) | 1108.0 MiB/s (0.35x) | 3119.6 MiB/s (0.99x) | 678.5 MiB/s (0.22x) |
| textheavy | 1.00 MiB | 14857.0 MiB/s (0.07 ms) | 14865.9 MiB/s (1.00x) | 18165.8 MiB/s (1.22x) | 17672.2 MiB/s (1.19x) | 18231.9 MiB/s (1.23x) | 17438.4 MiB/s (1.17x) | 16415.3 MiB/s (1.10x) | 1401.1 MiB/s (0.09x) |
| nested | 1.02 MiB | 2330.9 MiB/s (0.44 ms) | 4353.5 MiB/s (1.87x) | 4203.0 MiB/s (1.80x) | 4280.2 MiB/s (1.84x) | 3587.9 MiB/s (1.54x) | 3381.8 MiB/s (1.45x) | 3276.2 MiB/s (1.41x) | 2613.6 MiB/s (1.12x) |

## scaling

| Case | Size | simdxml parse | stax raw > | stax event unchecked | stax auto event | stax event checked | stax attr count | stax auto count | stax full string |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1KB | 0.00 MiB | 919.9 MiB/s (0.00 ms) | 172.2 MiB/s (0.19x) | 122.5 MiB/s (0.13x) | 120.9 MiB/s (0.13x) | 165.0 MiB/s (0.18x) | 171.5 MiB/s (0.19x) | 198.2 MiB/s (0.22x) | 165.2 MiB/s (0.18x) |
| 100KB | 0.10 MiB | 2012.0 MiB/s (0.05 ms) | 3235.1 MiB/s (1.61x) | 3150.4 MiB/s (1.57x) | 3134.7 MiB/s (1.56x) | 2719.5 MiB/s (1.35x) | 2227.6 MiB/s (1.11x) | 2179.6 MiB/s (1.08x) | 908.1 MiB/s (0.45x) |
| 1MB | 1.01 MiB | 2281.9 MiB/s (0.44 ms) | 5593.4 MiB/s (2.45x) | 4666.3 MiB/s (2.04x) | 5159.0 MiB/s (2.26x) | 4017.2 MiB/s (1.76x) | 3265.7 MiB/s (1.43x) | 3243.6 MiB/s (1.42x) | 1081.5 MiB/s (0.47x) |
| 10MB | 10.07 MiB | 2576.7 MiB/s (3.91 ms) | 6036.6 MiB/s (2.34x) | 4712.4 MiB/s (1.83x) | 4789.0 MiB/s (1.86x) | 3701.0 MiB/s (1.44x) | 3175.3 MiB/s (1.23x) | 2806.5 MiB/s (1.09x) | 1050.1 MiB/s (0.41x) |

## Contract Notes

The comparison intentionally keeps the upstream simdxml parse workload separate from the stax event workload. This avoids claiming XPath or CLI parity while still using upstream data shape, file sizes, and parse-benchmark case selection.
