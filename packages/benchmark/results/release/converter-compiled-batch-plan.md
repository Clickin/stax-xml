# Converter Compiled Batch-Plan Benchmark

Generated: 2026-05-22T15:19:10.466Z

This benchmark compares a manual `StreamReaderSync` projection with converter schemas that are auto-lowered or explicitly lowered to the compiled batch dispatch plan.
It measures the pure JavaScript path and does not use native addons, Wasm modules, or backend selection.

## Results

| Case | Throughput | Average | Min | Max | Books | Checksum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| manual-streamreader-sync | 74.37 MiB/s | 215.16 ms | 190.89 ms | 247.45 ms | 139458 | -1845341048 |
| converter-auto-compiled-batch-plan | 38.81 MiB/s | 412.26 ms | 375.41 ms | 513.36 ms | 139458 | -1845341048 |
| converter-explicit-compiled-batch-plan | 42.08 MiB/s | 380.21 ms | 344.72 ms | 402.04 ms | 139458 | -1845341048 |
