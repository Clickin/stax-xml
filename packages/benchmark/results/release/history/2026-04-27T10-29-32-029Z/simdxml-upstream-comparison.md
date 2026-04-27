# simdxml Upstream Fixture Comparator

Generated: 2026-04-27T10:29:30.849Z

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
| patent_medium | 0.10 MiB | 1985.9 MiB/s (0.05 ms) | 1932.7 MiB/s (0.97x) | 2783.9 MiB/s (1.40x) | 2355.4 MiB/s (1.19x) | 2155.4 MiB/s (1.09x) | 2075.6 MiB/s (1.05x) | 2041.2 MiB/s (1.03x) | 856.2 MiB/s (0.43x) |
| patent_large | 1.01 MiB | 2429.4 MiB/s (0.42 ms) | 5629.0 MiB/s (2.32x) | 4492.1 MiB/s (1.85x) | 4602.4 MiB/s (1.89x) | 3491.6 MiB/s (1.44x) | 3214.5 MiB/s (1.32x) | 3189.9 MiB/s (1.31x) | 1073.4 MiB/s (0.44x) |
| patent_xlarge | 10.07 MiB | 2558.5 MiB/s (3.94 ms) | 6252.9 MiB/s (2.44x) | 4927.6 MiB/s (1.93x) | 4843.1 MiB/s (1.89x) | 3898.7 MiB/s (1.52x) | 3284.6 MiB/s (1.28x) | 3179.2 MiB/s (1.24x) | 1048.6 MiB/s (0.41x) |
| attrheavy_large | 1.01 MiB | 3059.1 MiB/s (0.33 ms) | 7709.5 MiB/s (2.52x) | 2310.2 MiB/s (0.76x) | 5621.8 MiB/s (1.84x) | 2273.1 MiB/s (0.74x) | 1107.0 MiB/s (0.36x) | 2822.2 MiB/s (0.92x) | 677.4 MiB/s (0.22x) |
| textheavy_large | 1.00 MiB | 13035.7 MiB/s (0.08 ms) | 13823.7 MiB/s (1.06x) | 16383.1 MiB/s (1.26x) | 15062.6 MiB/s (1.16x) | 13931.3 MiB/s (1.07x) | 16960.1 MiB/s (1.30x) | 17420.2 MiB/s (1.34x) | 1460.8 MiB/s (0.11x) |
| nested_large | 1.02 MiB | 2342.2 MiB/s (0.44 ms) | 4508.4 MiB/s (1.92x) | 4259.8 MiB/s (1.82x) | 4377.8 MiB/s (1.87x) | 3986.8 MiB/s (1.70x) | 3004.0 MiB/s (1.28x) | 3386.5 MiB/s (1.45x) | 2498.4 MiB/s (1.07x) |

## shape

| Case | Size | simdxml parse | stax raw > | stax event unchecked | stax auto event | stax event checked | stax attr count | stax auto count | stax full string |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| patent | 1.01 MiB | 2356.9 MiB/s (0.43 ms) | 4698.9 MiB/s (1.99x) | 4813.8 MiB/s (2.04x) | 4611.2 MiB/s (1.96x) | 3656.8 MiB/s (1.55x) | 3149.2 MiB/s (1.34x) | 3212.9 MiB/s (1.36x) | 1055.6 MiB/s (0.45x) |
| attrheavy | 1.01 MiB | 2959.3 MiB/s (0.34 ms) | 7991.6 MiB/s (2.70x) | 2432.5 MiB/s (0.82x) | 4161.2 MiB/s (1.41x) | 2113.5 MiB/s (0.71x) | 1116.4 MiB/s (0.38x) | 2910.0 MiB/s (0.98x) | 669.3 MiB/s (0.23x) |
| textheavy | 1.00 MiB | 14994.9 MiB/s (0.07 ms) | 14325.8 MiB/s (0.96x) | 11933.1 MiB/s (0.80x) | 12150.2 MiB/s (0.81x) | 11274.9 MiB/s (0.75x) | 11916.0 MiB/s (0.79x) | 11879.3 MiB/s (0.79x) | 1264.8 MiB/s (0.08x) |
| nested | 1.02 MiB | 2246.9 MiB/s (0.45 ms) | 3764.8 MiB/s (1.68x) | 3902.1 MiB/s (1.74x) | 4076.5 MiB/s (1.81x) | 3330.7 MiB/s (1.48x) | 2934.1 MiB/s (1.31x) | 3074.4 MiB/s (1.37x) | 2443.9 MiB/s (1.09x) |

## scaling

| Case | Size | simdxml parse | stax raw > | stax event unchecked | stax auto event | stax event checked | stax attr count | stax auto count | stax full string |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1KB | 0.00 MiB | 947.6 MiB/s (0.00 ms) | 115.3 MiB/s (0.12x) | 92.4 MiB/s (0.10x) | 80.3 MiB/s (0.08x) | 169.8 MiB/s (0.18x) | 101.9 MiB/s (0.11x) | 179.8 MiB/s (0.19x) | 154.1 MiB/s (0.16x) |
| 100KB | 0.10 MiB | 2028.9 MiB/s (0.05 ms) | 3174.1 MiB/s (1.56x) | 3115.4 MiB/s (1.54x) | 2785.5 MiB/s (1.37x) | 2642.6 MiB/s (1.30x) | 2282.0 MiB/s (1.12x) | 2299.7 MiB/s (1.13x) | 950.9 MiB/s (0.47x) |
| 1MB | 1.01 MiB | 2446.1 MiB/s (0.41 ms) | 5723.6 MiB/s (2.34x) | 5001.9 MiB/s (2.04x) | 5077.5 MiB/s (2.08x) | 4021.6 MiB/s (1.64x) | 3064.1 MiB/s (1.25x) | 3225.8 MiB/s (1.32x) | 1035.1 MiB/s (0.42x) |
| 10MB | 10.07 MiB | 2624.7 MiB/s (3.84 ms) | 6342.0 MiB/s (2.42x) | 4853.5 MiB/s (1.85x) | 5042.9 MiB/s (1.92x) | 3798.1 MiB/s (1.45x) | 3124.1 MiB/s (1.19x) | 3147.8 MiB/s (1.20x) | 1055.9 MiB/s (0.40x) |

## Contract Notes

The comparison intentionally keeps the upstream simdxml parse workload separate from the stax event workload. This avoids claiming XPath or CLI parity while still using upstream data shape, file sizes, and parse-benchmark case selection.

