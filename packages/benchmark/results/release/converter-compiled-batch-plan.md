# Converter Compiled Batch-Plan Benchmark

Generated: 2026-07-18T12:38:48.532Z

This benchmark compares a manual `StreamReaderSync` projection with the public IR JIT converter `schema.parseSync` path.

## Results

| Case | Throughput | Average | Min | Max | Events | Checksum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| manual-cursor-reader-sync | 110.61 MiB/s | 144.65 ms | 142.07 ms | 146.22 ms | 139458 | -1845341048 |
| converter-auto-compiled-batch-plan | 83.18 MiB/s | 192.35 ms | 188.91 ms | 195.70 ms | 139458 | -1845341048 |
