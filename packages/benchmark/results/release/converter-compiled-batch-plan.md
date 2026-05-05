# Converter Compiled Batch-Plan Benchmark

Generated: 2026-05-05T02:23:55.933Z

This benchmark compares a manual `StreamReaderSync` projection with converter schemas that are auto-lowered or explicitly lowered to the compiled batch dispatch plan.
It measures the pure JavaScript path and does not use native addons, Wasm modules, or backend selection.

## Results

| Case | Throughput | Average | Min | Max | Books | Checksum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| manual-streamreader-sync | 80.17 MiB/s | 199.58 ms | 190.92 ms | 208.29 ms | 139458 | -1845341048 |
| converter-auto-compiled-batch-plan | 47.11 MiB/s | 339.63 ms | 325.52 ms | 347.43 ms | 139458 | -1845341048 |
| converter-explicit-compiled-batch-plan | 46.03 MiB/s | 347.61 ms | 342.23 ms | 354.07 ms | 139458 | -1845341048 |
