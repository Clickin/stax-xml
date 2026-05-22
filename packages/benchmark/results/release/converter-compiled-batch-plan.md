# Converter Compiled Batch-Plan Benchmark

Generated: 2026-05-22T14:39:37.430Z

This benchmark compares a manual `StreamReaderSync` projection with converter schemas that are auto-lowered or explicitly lowered to the compiled batch dispatch plan.
It measures the pure JavaScript path and does not use native addons, Wasm modules, or backend selection.

## Results

| Case | Throughput | Average | Min | Max | Books | Checksum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| manual-streamreader-sync | 75.50 MiB/s | 211.92 ms | 205.79 ms | 218.95 ms | 139458 | -1845341048 |
| converter-auto-compiled-batch-plan | 33.38 MiB/s | 479.30 ms | 422.97 ms | 619.89 ms | 139458 | -1845341048 |
| converter-explicit-compiled-batch-plan | 39.43 MiB/s | 405.75 ms | 356.70 ms | 466.90 ms | 139458 | -1845341048 |
