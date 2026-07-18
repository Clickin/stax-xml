# Cross-Language Reader Benchmark

Generated: 2026-07-18T15:09:14.043Z

The same UTF-8 XML file is read and parsed through public pull-reader APIs. Each timed run includes file I/O and materializes start/end elements, non-whitespace text, and every attribute name/value into the same checksum.

| Reader | Median throughput | Median time | Events | Checksum |
| --- | ---: | ---: | ---: | ---: |
| stax-xml | 93.3 MiB/s | 171.51 ms | 967965 | 36104832 |
| woodstox | 321.7 MiB/s | 49.73 ms | 967965 | 36104832 |
| quick-xml | 562.6 MiB/s | 28.44 ms | 967965 | 36104832 |
