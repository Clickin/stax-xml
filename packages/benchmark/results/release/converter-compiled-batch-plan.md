# Converter Compiled Batch-Plan Benchmark

Generated: 2026-07-18T17:15:22.230Z

This benchmark compares a manual `StreamReaderSync` projection with the public IR JIT converter `schema.parseSync` path.

## Results

| Case | Throughput | Average | Min | Max | Heap delta | RSS delta | Events | Checksum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| manual-cursor-reader-sync | 102.43 MiB/s | 156.21 ms | 145.70 ms | 169.46 ms | 57.79 MiB | 3.78 MiB | 139458 | -1845341048 |
| converter-auto-compiled-batch-plan | 82.49 MiB/s | 193.96 ms | 192.20 ms | 198.77 ms | 60.97 MiB | 3.53 MiB | 139458 | -1845341048 |
