# Cross-Language Reader Benchmark

Generated: 2026-07-18T13:42:06.596Z

The same in-memory UTF-8 XML fixture is parsed through public pull-reader APIs after file I/O. Start/end elements, non-whitespace text, and every attribute name/value are materialized and folded into the same checksum.

| Reader | Median throughput | Median time | Events | Checksum |
| --- | ---: | ---: | ---: | ---: |
| stax-xml | 98.9 MiB/s | 161.81 ms | 967965 | 36104832 |
| woodstox | 303.5 MiB/s | 52.72 ms | 967965 | 36104832 |
| quick-xml | 641.3 MiB/s | 24.95 ms | 967965 | 36104832 |
