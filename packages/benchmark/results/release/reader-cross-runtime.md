# Cross-Language Reader Benchmark

Generated: 2026-07-18T15:26:02.600Z

The same UTF-8 XML file is read and parsed through public pull-reader APIs. Each timed run includes file I/O and materializes start/end elements, non-whitespace text, and every attribute name/value into the same checksum.

| Reader | Median throughput | Median time | Events | Checksum |
| --- | ---: | ---: | ---: | ---: |
| stax-xml | 94.8 MiB/s | 168.75 ms | 967965 | 36104832 |
| woodstox | 322.0 MiB/s | 49.68 ms | 967965 | 36104832 |
| quick-xml | 572.8 MiB/s | 27.93 ms | 967965 | 36104832 |
