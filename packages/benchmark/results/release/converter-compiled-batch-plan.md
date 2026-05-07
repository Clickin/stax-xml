# Converter Compiled Batch-Plan Benchmark

Generated: 2026-05-06T10:52:39.270Z

This benchmark compares a manual `StreamReaderSync` projection with converter schemas that are auto-lowered or explicitly lowered to the compiled batch dispatch plan.
It measures the pure JavaScript path and does not use native addons, Wasm modules, or backend selection.

## Results

| Case | Throughput | Average | Min | Max | Books | Checksum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| manual-streamreader-sync | 82.14 MiB/s | 194.80 ms | 188.31 ms | 198.48 ms | 139458 | -1845341048 |
| converter-auto-compiled-batch-plan | 52.16 MiB/s | 306.77 ms | 297.58 ms | 321.76 ms | 139458 | -1845341048 |
| converter-explicit-compiled-batch-plan | 49.62 MiB/s | 322.42 ms | 307.13 ms | 344.55 ms | 139458 | -1845341048 |
