# Cross-Language Reader Benchmark

Generated: 2026-07-18T17:12:53.113Z

The same UTF-8 XML file is read and parsed through public pull-reader APIs. Each timed run includes file I/O and materializes start/end elements, non-whitespace text, and every attribute name/value into the same checksum.

| Reader | Median throughput | Median time | Events | Checksum |
| --- | ---: | ---: | ---: | ---: |
| stax-xml | 91.6 MiB/s | 174.75 ms | 967965 | 36104832 |
| woodstox | 333.4 MiB/s | 47.99 ms | 967965 | 36104832 |
| quick-xml | 570.1 MiB/s | 28.07 ms | 967965 | 36104832 |
