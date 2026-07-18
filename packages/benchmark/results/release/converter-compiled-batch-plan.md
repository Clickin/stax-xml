# Converter Compiled Batch-Plan Benchmark

Generated: 2026-07-18T13:44:29.624Z

This benchmark compares a manual `StreamReaderSync` projection with the public IR JIT converter `schema.parseSync` path.

## Results

| Case | Throughput | Average | Min | Max | Heap delta | RSS delta | Events | Checksum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| manual-cursor-reader-sync | 109.15 MiB/s | 146.59 ms | 137.21 ms | 160.57 ms | 57.52 MiB | 3.27 MiB | 139458 | -1845341048 |
| converter-auto-compiled-batch-plan | 85.75 MiB/s | 186.60 ms | 183.99 ms | 188.03 ms | 60.69 MiB | 3.63 MiB | 139458 | -1845341048 |
