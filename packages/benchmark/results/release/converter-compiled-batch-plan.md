# Converter Compiled Batch-Plan Benchmark

Generated: 2026-07-12T07:53:13.620Z

This benchmark compares a manual `StreamReaderSync` projection with the public converter schema.parseSync path.

## Results

| Case | Throughput | Average | Min | Max | Events | Checksum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| manual-cursor-reader-sync | 120.95 MiB/s | 132.29 ms | 130.02 ms | 135.16 ms | 139458 | -1845341048 |
| converter-auto-compiled-batch-plan | 76.23 MiB/s | 209.89 ms | 206.43 ms | 213.13 ms | 139458 | -1845341048 |
