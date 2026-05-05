# Converter Compiled Batch-Plan Benchmark

Generated: 2026-05-05T03:50:47.714Z

This benchmark compares a manual `StreamReaderSync` projection with converter schemas that are auto-lowered or explicitly lowered to the compiled batch dispatch plan.
It measures the pure JavaScript path and does not use native addons, Wasm modules, or backend selection.

## Results

| Case | Throughput | Average | Min | Max | Books | Checksum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| manual-streamreader-sync | 81.62 MiB/s | 196.04 ms | 188.15 ms | 201.46 ms | 139458 | -1845341048 |
| converter-auto-compiled-batch-plan | 51.28 MiB/s | 312.00 ms | 300.26 ms | 322.13 ms | 139458 | -1845341048 |
| converter-explicit-compiled-batch-plan | 50.06 MiB/s | 319.63 ms | 304.71 ms | 328.22 ms | 139458 | -1845341048 |
