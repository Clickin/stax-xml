# simdxml Upstream Fixture Comparator

Generated: 2026-04-27T11:05:06.898Z

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
| patent_medium | 0.10 MiB | 2225.7 MiB/s (0.05 ms) | 1575.2 MiB/s (0.71x) | 1940.8 MiB/s (0.87x) | 2230.6 MiB/s (1.00x) | 1918.0 MiB/s (0.86x) | 1981.2 MiB/s (0.89x) | 1877.3 MiB/s (0.84x) | 912.1 MiB/s (0.41x) |
| patent_large | 1.01 MiB | 2305.9 MiB/s (0.44 ms) | 4790.9 MiB/s (2.08x) | 4238.3 MiB/s (1.84x) | 4718.3 MiB/s (2.05x) | 3555.7 MiB/s (1.54x) | 2747.5 MiB/s (1.19x) | 3024.2 MiB/s (1.31x) | 1038.3 MiB/s (0.45x) |
| patent_xlarge | 10.07 MiB | 2311.5 MiB/s (4.36 ms) | 5691.1 MiB/s (2.46x) | 4652.2 MiB/s (2.01x) | 4733.6 MiB/s (2.05x) | 3858.3 MiB/s (1.67x) | 3286.1 MiB/s (1.42x) | 3157.6 MiB/s (1.37x) | 1058.1 MiB/s (0.46x) |
| attrheavy_large | 1.01 MiB | 3035.9 MiB/s (0.33 ms) | 5794.0 MiB/s (1.91x) | 2257.1 MiB/s (0.74x) | 3381.5 MiB/s (1.11x) | 2161.0 MiB/s (0.71x) | 1088.4 MiB/s (0.36x) | 2987.5 MiB/s (0.98x) | 675.0 MiB/s (0.22x) |
| textheavy_large | 1.00 MiB | 14821.9 MiB/s (0.07 ms) | 10595.1 MiB/s (0.71x) | 11837.2 MiB/s (0.80x) | 15334.7 MiB/s (1.03x) | 14025.0 MiB/s (0.95x) | 13819.8 MiB/s (0.93x) | 11463.3 MiB/s (0.77x) | 1428.9 MiB/s (0.10x) |
| nested_large | 1.02 MiB | 2431.0 MiB/s (0.42 ms) | 4416.8 MiB/s (1.82x) | 4209.6 MiB/s (1.73x) | 4318.5 MiB/s (1.78x) | 3971.3 MiB/s (1.63x) | 3295.8 MiB/s (1.36x) | 3294.3 MiB/s (1.36x) | 2504.8 MiB/s (1.03x) |

## shape

| Case | Size | simdxml parse | stax raw > | stax event unchecked | stax auto event | stax event checked | stax attr count | stax auto count | stax full string |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| patent | 1.01 MiB | 2438.1 MiB/s (0.41 ms) | 5591.6 MiB/s (2.29x) | 4918.0 MiB/s (2.02x) | 4568.2 MiB/s (1.87x) | 3451.5 MiB/s (1.42x) | 2996.5 MiB/s (1.23x) | 3118.7 MiB/s (1.28x) | 1043.1 MiB/s (0.43x) |
| attrheavy | 1.01 MiB | 3055.8 MiB/s (0.33 ms) | 8264.0 MiB/s (2.70x) | 2166.3 MiB/s (0.71x) | 3298.5 MiB/s (1.08x) | 2169.4 MiB/s (0.71x) | 1115.9 MiB/s (0.37x) | 3132.7 MiB/s (1.03x) | 662.8 MiB/s (0.22x) |
| textheavy | 1.00 MiB | 15749.4 MiB/s (0.06 ms) | 14765.1 MiB/s (0.94x) | 15804.1 MiB/s (1.00x) | 18528.7 MiB/s (1.18x) | 14782.5 MiB/s (0.94x) | 16716.7 MiB/s (1.06x) | 16885.7 MiB/s (1.07x) | 1468.2 MiB/s (0.09x) |
| nested | 1.02 MiB | 2364.3 MiB/s (0.43 ms) | 4309.1 MiB/s (1.82x) | 4036.2 MiB/s (1.71x) | 4055.5 MiB/s (1.72x) | 3952.8 MiB/s (1.67x) | 3333.3 MiB/s (1.41x) | 3370.9 MiB/s (1.43x) | 2465.9 MiB/s (1.04x) |

## scaling

| Case | Size | simdxml parse | stax raw > | stax event unchecked | stax auto event | stax event checked | stax attr count | stax auto count | stax full string |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1KB | 0.00 MiB | 947.6 MiB/s (0.00 ms) | 164.1 MiB/s (0.17x) | 200.0 MiB/s (0.21x) | 162.0 MiB/s (0.17x) | 165.6 MiB/s (0.17x) | 172.2 MiB/s (0.18x) | 155.0 MiB/s (0.16x) | 100.9 MiB/s (0.11x) |
| 100KB | 0.10 MiB | 2138.0 MiB/s (0.05 ms) | 2581.8 MiB/s (1.21x) | 2577.9 MiB/s (1.21x) | 2854.7 MiB/s (1.34x) | 2201.4 MiB/s (1.03x) | 2037.1 MiB/s (0.95x) | 1885.8 MiB/s (0.88x) | 768.8 MiB/s (0.36x) |
| 1MB | 1.01 MiB | 2206.3 MiB/s (0.46 ms) | 4944.5 MiB/s (2.24x) | 4264.9 MiB/s (1.93x) | 4560.8 MiB/s (2.07x) | 3569.0 MiB/s (1.62x) | 3140.2 MiB/s (1.42x) | 3171.0 MiB/s (1.44x) | 1038.3 MiB/s (0.47x) |
| 10MB | 10.07 MiB | 2266.3 MiB/s (4.44 ms) | 5883.1 MiB/s (2.60x) | 4485.2 MiB/s (1.98x) | 4660.3 MiB/s (2.06x) | 3537.2 MiB/s (1.56x) | 3159.3 MiB/s (1.39x) | 3101.9 MiB/s (1.37x) | 1067.4 MiB/s (0.47x) |

## Contract Notes

The comparison intentionally keeps the upstream simdxml parse workload separate from the stax event workload. This avoids claiming XPath or CLI parity while still using upstream data shape, file sizes, and parse-benchmark case selection.
