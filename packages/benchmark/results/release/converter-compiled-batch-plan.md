# Converter Compiled Batch-Plan Benchmark

Generated: 2026-07-19T07:37:29.869Z

This benchmark compares a manual `StreamReaderSync` projection with the public IR JIT converter `schema.parseSync` path.

## Results

| Case | Throughput | Average | Min | Max | Heap delta | RSS delta | Events | Checksum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| manual-cursor-reader-sync | 108.48 MiB/s | 147.49 ms | 138.72 ms | 160.53 ms | 57.68 MiB | 3.34 MiB | 139458 | -1845341048 |
| converter-auto-compiled-batch-plan | 86.86 MiB/s | 184.21 ms | 179.27 ms | 188.85 ms | 60.83 MiB | 3.52 MiB | 139458 | -1845341048 |
