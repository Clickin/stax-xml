# Converter Compiled Batch-Plan Benchmark

Generated: 2026-07-12T02:36:24.937Z

This benchmark compares a manual `StreamReaderSync` projection with converter schemas that are auto-lowered or explicitly lowered to the compiled cursor dispatch plan.

## Results

| Case | Throughput | Average | Min | Max | Events | Checksum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| manual-cursor-reader-sync | 119.62 MiB/s | 133.76 ms | 131.54 ms | 137.03 ms | 139458 | -1845341048 |
| converter-auto-compiled-batch-plan | 72.10 MiB/s | 221.93 ms | 219.68 ms | 223.85 ms | 139458 | -1845341048 |
| converter-explicit-compiled-batch-plan | 71.26 MiB/s | 224.52 ms | 222.15 ms | 230.16 ms | 139458 | -1845341048 |
