# Converter Compiled Batch-Plan Benchmark

Generated: 2026-07-18T15:28:29.900Z

This benchmark compares a manual `StreamReaderSync` projection with the public IR JIT converter `schema.parseSync` path.

## Results

| Case | Throughput | Average | Min | Max | Heap delta | RSS delta | Events | Checksum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| manual-cursor-reader-sync | 105.78 MiB/s | 151.26 ms | 142.89 ms | 164.62 ms | 57.56 MiB | 3.54 MiB | 139458 | -1845341048 |
| converter-auto-compiled-batch-plan | 83.42 MiB/s | 191.80 ms | 189.44 ms | 193.48 ms | 60.79 MiB | 3.66 MiB | 139458 | -1845341048 |
