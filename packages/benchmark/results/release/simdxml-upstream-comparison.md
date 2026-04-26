# simdxml Upstream Fixture Comparator

Generated: 2026-04-26T06:11:23.276Z

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
| patent_medium | 0.10 MiB | 2181.4 MiB/s (0.05 ms) | 2208.2 MiB/s (1.01x) | 2390.0 MiB/s (1.10x) | 2819.7 MiB/s (1.29x) | 1837.0 MiB/s (0.84x) | 2020.0 MiB/s (0.93x) | 2070.5 MiB/s (0.95x) | 867.7 MiB/s (0.40x) |
| patent_large | 1.01 MiB | 2242.2 MiB/s (0.45 ms) | 4892.2 MiB/s (2.18x) | 4504.5 MiB/s (2.01x) | 4422.4 MiB/s (1.97x) | 3829.2 MiB/s (1.71x) | 3075.5 MiB/s (1.37x) | 3191.3 MiB/s (1.42x) | 1067.0 MiB/s (0.48x) |
| patent_xlarge | 10.07 MiB | 1980.9 MiB/s (5.08 ms) | 5381.9 MiB/s (2.72x) | 4348.1 MiB/s (2.20x) | 4610.8 MiB/s (2.33x) | 3382.8 MiB/s (1.71x) | 3047.0 MiB/s (1.54x) | 2996.2 MiB/s (1.51x) | 1071.8 MiB/s (0.54x) |
| attrheavy_large | 1.01 MiB | 2918.9 MiB/s (0.35 ms) | 7768.6 MiB/s (2.66x) | 2314.7 MiB/s (0.79x) | 3118.6 MiB/s (1.07x) | 2281.0 MiB/s (0.78x) | 1122.8 MiB/s (0.38x) | 3266.8 MiB/s (1.12x) | 733.7 MiB/s (0.25x) |
| textheavy_large | 1.00 MiB | 15344.1 MiB/s (0.07 ms) | 9609.2 MiB/s (0.63x) | 20138.0 MiB/s (1.31x) | 17996.1 MiB/s (1.17x) | 16778.3 MiB/s (1.09x) | 16823.3 MiB/s (1.10x) | 16145.4 MiB/s (1.05x) | 1419.6 MiB/s (0.09x) |
| nested_large | 1.02 MiB | 2069.2 MiB/s (0.49 ms) | 2077.7 MiB/s (1.00x) | 1991.7 MiB/s (0.96x) | 1981.0 MiB/s (0.96x) | 1830.3 MiB/s (0.88x) | 1741.9 MiB/s (0.84x) | 1770.3 MiB/s (0.86x) | 1477.8 MiB/s (0.71x) |

## shape

| Case | Size | simdxml parse | stax raw > | stax event unchecked | stax auto event | stax event checked | stax attr count | stax auto count | stax full string |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| patent | 1.01 MiB | 2367.3 MiB/s (0.43 ms) | 5558.9 MiB/s (2.35x) | 4778.2 MiB/s (2.02x) | 4387.3 MiB/s (1.85x) | 3760.4 MiB/s (1.59x) | 3132.4 MiB/s (1.32x) | 3362.0 MiB/s (1.42x) | 1076.2 MiB/s (0.45x) |
| attrheavy | 1.01 MiB | 2886.8 MiB/s (0.35 ms) | 8071.8 MiB/s (2.80x) | 2477.1 MiB/s (0.86x) | 4189.7 MiB/s (1.45x) | 2333.5 MiB/s (0.81x) | 1134.6 MiB/s (0.39x) | 3316.2 MiB/s (1.15x) | 691.3 MiB/s (0.24x) |
| textheavy | 1.00 MiB | 15558.6 MiB/s (0.06 ms) | 14228.2 MiB/s (0.91x) | 12809.0 MiB/s (0.82x) | 17246.3 MiB/s (1.11x) | 16281.9 MiB/s (1.05x) | 17122.4 MiB/s (1.10x) | 18549.3 MiB/s (1.19x) | 1468.3 MiB/s (0.09x) |
| nested | 1.02 MiB | 2305.1 MiB/s (0.44 ms) | 2033.5 MiB/s (0.88x) | 2004.1 MiB/s (0.87x) | 2001.6 MiB/s (0.87x) | 1779.2 MiB/s (0.77x) | 1676.6 MiB/s (0.73x) | 1765.7 MiB/s (0.77x) | 1490.3 MiB/s (0.65x) |

## scaling

| Case | Size | simdxml parse | stax raw > | stax event unchecked | stax auto event | stax event checked | stax attr count | stax auto count | stax full string |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1KB | 0.00 MiB | 984.6 MiB/s (0.00 ms) | 153.5 MiB/s (0.16x) | 177.0 MiB/s (0.18x) | 185.6 MiB/s (0.19x) | 185.1 MiB/s (0.19x) | 195.4 MiB/s (0.20x) | 188.1 MiB/s (0.19x) | 172.4 MiB/s (0.18x) |
| 100KB | 0.10 MiB | 2040.4 MiB/s (0.05 ms) | 3249.7 MiB/s (1.59x) | 3340.0 MiB/s (1.64x) | 2961.9 MiB/s (1.45x) | 2485.3 MiB/s (1.22x) | 2309.1 MiB/s (1.13x) | 2144.4 MiB/s (1.05x) | 855.2 MiB/s (0.42x) |
| 1MB | 1.01 MiB | 2196.2 MiB/s (0.46 ms) | 5287.8 MiB/s (2.41x) | 4807.3 MiB/s (2.19x) | 5056.1 MiB/s (2.30x) | 3891.6 MiB/s (1.77x) | 3321.9 MiB/s (1.51x) | 3317.1 MiB/s (1.51x) | 1046.3 MiB/s (0.48x) |
| 10MB | 10.07 MiB | 2162.3 MiB/s (4.66 ms) | 4990.0 MiB/s (2.31x) | 4530.8 MiB/s (2.10x) | 4198.0 MiB/s (1.94x) | 3530.8 MiB/s (1.63x) | 2929.1 MiB/s (1.35x) | 2970.9 MiB/s (1.37x) | 1054.7 MiB/s (0.49x) |

## Contract Notes

The comparison intentionally keeps the upstream simdxml parse workload separate from the stax event workload. This avoids claiming XPath or CLI parity while still using upstream data shape, file sizes, and parse-benchmark case selection.
