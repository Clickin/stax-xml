# Cross-Language Reader Benchmark

Generated: 2026-07-19T07:35:05.785Z

The same UTF-8 XML file is read and parsed through public pull-reader APIs. Each timed run includes file I/O and materializes start/end elements, non-whitespace text, and every attribute name/value into the same checksum.

| Reader | Median throughput | Median time | Events | Checksum |
| --- | ---: | ---: | ---: | ---: |
| stax-xml | 97.4 MiB/s | 164.21 ms | 967965 | 36104832 |
| woodstox | 284.4 MiB/s | 56.25 ms | 967965 | 36104832 |
| quick-xml | 597.6 MiB/s | 26.77 ms | 967965 | 36104832 |
