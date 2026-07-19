# StAX-XML Benchmarks

Generated: 2026-07-19T09:30:01.566Z
Run ID: 2026-07-19T09-30-01-566Z

The core release tables measure public pure JavaScript surfaces. Explicit cross-language reader and writer sections compare equivalent public pull APIs and real file sinks without changing that core contract.

## Environment

- Runtime: Node 26.5.0 (arm64-darwin)
- CPU: Apple M4 (~2.40 GHz)
- Package manager: pnpm@11.12.0

## Parser Fixture Series

Every row parses the same XML and returns the same canonical JavaScript record array. The benchmark validates full-result parity before measuring parse-plus-projection time.

### 2 KiB

| Library | Average | MB/s | Ops/sec | Heap |
| --- | --- | --- | --- | --- |
| stax-xml EventReaderSync (JS object) | 180.46 us | 8.64 MB/s | 5,542 ops/sec | 68.0 KiB |
| stax-xml StreamReaderSync (JS object) | 160.27 us | 9.73 MB/s | 6,239 ops/sec | 34.5 KiB |
| stax-xml Converter API (JS object) | 198.77 us | 7.85 MB/s | 5,031 ops/sec | 48.9 KiB |
| fast-xml-parser XMLParser (JS object) | 246.27 us | 6.33 MB/s | 4,061 ops/sec | 201.9 KiB |
| txml parse (JS object) | 7.48 us | 208.59 MB/s | 133,710 ops/sec | 3.9 KiB |
| xml2js parseString (JS object) | 321.65 us | 4.85 MB/s | 3,109 ops/sec | 193.0 KiB |

### 4 KiB

| Library | Average | MB/s | Ops/sec | Heap |
| --- | --- | --- | --- | --- |
| stax-xml EventReaderSync (JS object) | 290.84 us | 15.23 MB/s | 3,438 ops/sec | 158.0 KiB |
| stax-xml StreamReaderSync (JS object) | 239.02 us | 18.54 MB/s | 4,184 ops/sec | 104.4 KiB |
| stax-xml Converter API (JS object) | 305.01 us | 14.53 MB/s | 3,279 ops/sec | 118.7 KiB |
| fast-xml-parser XMLParser (JS object) | 413.99 us | 10.70 MB/s | 2,415 ops/sec | 706.4 KiB |
| txml parse (JS object) | 18.01 us | 246.06 MB/s | 55,531 ops/sec | 2.9 KiB |
| xml2js parseString (JS object) | 594.72 us | 7.45 MB/s | 1,681 ops/sec | 497.7 KiB |

### 13 MiB

| Library | Average | MB/s | Ops/sec | Heap |
| --- | --- | --- | --- | --- |
| stax-xml EventReaderSync (JS object) | 124.75 ms | 108.89 MB/s | 8.02 ops/sec | 8.4 MiB |
| stax-xml StreamReaderSync (JS object) | 115.81 ms | 117.30 MB/s | 8.63 ops/sec | 17.8 MiB |
| stax-xml Converter API (JS object) | 113.80 ms | 119.37 MB/s | 8.79 ops/sec | 11.8 MiB |
| fast-xml-parser XMLParser (JS object) | 542.04 ms | 25.06 MB/s | 1.84 ops/sec | 135.3 MiB |
| txml parse (JS object) | 91.54 ms | 148.39 MB/s | 10.92 ops/sec | 126.8 MiB |
| xml2js parseString (JS object) | 463.21 ms | 29.33 MB/s | 2.16 ops/sec | 105.5 MiB |

### 98 MiB

| Library | Average | MB/s | Ops/sec | Heap |
| --- | --- | --- | --- | --- |
| stax-xml EventReaderSync (JS object) | 825.55 ms | 123.41 MB/s | 1.21 ops/sec | 21.4 MiB |
| stax-xml StreamReaderSync (JS object) | 691.88 ms | 147.26 MB/s | 1.45 ops/sec | 40.6 MiB |
| stax-xml Converter API (JS object) | 635.84 ms | 160.23 MB/s | 1.57 ops/sec | 51.6 MiB |
| fast-xml-parser XMLParser (JS object) | 3.59 s | 28.37 MB/s | 0.28 ops/sec | 962.8 MiB |
| txml parse (JS object) | 704.22 ms | 144.67 MB/s | 1.42 ops/sec | 874.3 MiB |
| xml2js parseString (JS object) | 3.44 s | 29.66 MB/s | 0.29 ops/sec | 638.7 MiB |

## Maintained Node XML Parser Comparison

| Library | Average | Ops/sec | Heap |
| --- | --- | --- | --- |
| stax-xml EventReaderSync (JS event checksum) | 322.49 us | 3,101 ops/sec | 180.3 KiB |
| stax-xml StreamReaderSync (JS event checksum) | 293.57 us | 3,406 ops/sec | 93.0 KiB |
| fast-xml-parser XMLParser | 384.37 us | 2,602 ops/sec | 761.0 KiB |
| txml parse | 66.74 us | 14,984 ops/sec | 82.9 KiB |
| xml2js parseString | 472.70 us | 2,116 ops/sec | 545.4 KiB |
| sax strict event parser | 370.79 us | 2,697 ops/sec | 385.7 KiB |
| saxes event parser | 238.26 us | 4,197 ops/sec | 92.6 KiB |
| htmlparser2 xmlMode parser | 334.91 us | 2,986 ops/sec | 287.3 KiB |

## StreamReaderSync Incremental Size Series

| Size | Throughput | Average | Heap delta | RSS delta |
| --- | --- | --- | --- | --- |
| (1MiB generated chunks) | 50.18 MiB/s | 19.93 ms | 4.1 MiB | 752.0 KiB |
| (10MiB generated chunks) | 76.00 MiB/s | 131.57 ms | 3.8 MiB | 512.0 KiB |
| (100MiB generated chunks) | 79.42 MiB/s | 1.26 s | 7.0 MiB | 33.2 MiB |
| (1GiB generated chunks) | 77.83 MiB/s | 13.16 s | 32.2 MiB | 66.4 MiB |
| (4GiB generated chunks) | 87.72 MiB/s | 46.69 s | 32.5 MiB | 77.5 MiB |

## Runtime Matrix

The same generated 16 MiB fixture and checksum workloads run on Node, Bun, and Deno. Memory columns are absolute measured-run endpoint peaks for each runtime process.

| Runtime | Workload | Throughput | Average | Peak heap | Peak RSS | Events | Checksum |
| --- | --- | --- | --- | --- | --- | --- | --- |
| node 26.5.0 | stream-sync-type-only | 118.12 MiB/s | 135.45 ms | 7.5 MiB | 132.0 MiB | 1,024,909 | 879435954 |
| node 26.5.0 | stream-sync-name-text | 81.27 MiB/s | 196.86 ms | 8.7 MiB | 132.9 MiB | 1,024,909 | -1201287088 |
| node 26.5.0 | stream-sync-full | 64.04 MiB/s | 249.85 ms | 21.2 MiB | 153.8 MiB | 1,024,909 | -855783368 |
| node 26.5.0 | event-sync-full | 55.44 MiB/s | 288.57 ms | 8.4 MiB | 154.2 MiB | 1,024,909 | -855783368 |
| bun 1.3.14 | stream-sync-type-only | 195.12 MiB/s | 82.00 ms | 33.1 MiB | 189.8 MiB | 1,024,909 | 879435954 |
| bun 1.3.14 | stream-sync-name-text | 143.15 MiB/s | 111.77 ms | 32.9 MiB | 219.9 MiB | 1,024,909 | -1201287088 |
| bun 1.3.14 | stream-sync-full | 85.82 MiB/s | 186.44 ms | 33.0 MiB | 227.8 MiB | 1,024,909 | -855783368 |
| bun 1.3.14 | event-sync-full | 72.36 MiB/s | 221.11 ms | 17.0 MiB | 268.7 MiB | 1,024,909 | -855783368 |
| deno 2.9.3 (v8 14.9.207.2-rusty) | stream-sync-type-only | 132.61 MiB/s | 120.65 ms | 26.2 MiB | 118.7 MiB | 1,024,909 | 879435954 |
| deno 2.9.3 (v8 14.9.207.2-rusty) | stream-sync-name-text | 86.09 MiB/s | 185.85 ms | 29.3 MiB | 119.3 MiB | 1,024,909 | -1201287088 |
| deno 2.9.3 (v8 14.9.207.2-rusty) | stream-sync-full | 67.07 MiB/s | 238.57 ms | 31.5 MiB | 139.0 MiB | 1,024,909 | -855783368 |
| deno 2.9.3 (v8 14.9.207.2-rusty) | event-sync-full | 59.98 MiB/s | 266.74 ms | 36.8 MiB | 139.3 MiB | 1,024,909 | -855783368 |

## Cross-Language Reader Comparison

The same UTF-8 file is read and parsed by public pull-reader APIs in Node, Java, and Rust. Every timed run includes file I/O; all element names, non-whitespace text, and attribute names/values are materialized and must preserve the same event count and checksum.

| Reader | Median throughput | Median time | Events | Checksum |
| --- | --- | --- | --- | --- |
| stax-xml StreamReaderSync (v26.5.0) | 97.4 MiB/s | 164.21 ms | 967,965 | 36104832 |
| Woodstox 6.7.0 (Java 25.0.2) | 284.4 MiB/s | 56.25 ms | 967,965 | 36104832 |
| quick-xml 0.40.1 (Rust 1.95.0) | 597.6 MiB/s | 26.77 ms | 967,965 | 36104832 |

## Converter IR Projection

Converter section generated: 2026-07-19T07:37:29.869Z

| Projection | Throughput | Average | Heap delta | RSS delta | Checksum |
| --- | --- | --- | --- | --- | --- |
| Manual StreamReaderSync projection | 108.48 MiB/s | 147.49 ms | 57.7 MiB | 3.3 MiB | -1845341048 |
| Converter schema.parseSync(bytes) | 86.86 MiB/s | 184.21 ms | 60.8 MiB | 3.5 MiB | -1845341048 |

The converter row uses `schema.parseSync(bytes)`: schema is lowered to IR, then executed by generated code when runtime code generation is available. It is compared only with the equivalent manual object projection on this catalog fixture.

## Cross-Language Writer Comparison

The public writer APIs in Node, Java, and Rust generate the same compact XML workload and write it to a real file sink. Rows are medians of three end-to-end runs.

| Writer | Median throughput | Median time | Written | Records |
| --- | --- | --- | --- | --- |
| stax-xml WriterSyncSink (v26.5.0) | 149.1 MiB/s | 68.93 ms | 10.3 MiB | 12,798 |
| Woodstox 6.7.0 (Java 25.0.2) | 106.5 MiB/s | 96.46 ms | 10.3 MiB | 12,798 |
| quick-xml 0.40.1 (Rust 1.95.0) | 185.9 MiB/s | 55.28 ms | 10.3 MiB | 12,798 |

### Reader/Writer Throughput Asymmetry

The 1 GiB rows are intentionally different workloads. `WriterSyncSink` writing to a temp file is mostly deterministic append work: the caller already knows each element name, attribute, and text value, so the writer validates its own state, encodes known JavaScript strings, and flushes large sequential chunks to the file descriptor. It does not search arbitrary XML for delimiters, recover tokens across chunk boundaries, or discover names, text, and attributes from incoming bytes.

`StreamReaderSync` is a CPU-bound parsing path. The current 1 GiB row uses generated byte batches rather than disk I/O, so storage speed is not the limiter. The reader must scan every byte, classify markup versus text, maintain XML state, keep the accessor API stable, and decode/materialize JavaScript strings for names, text, and attributes when the consumer asks for them. The main restriction is pure-JavaScript byte scanning plus UTF-8 span decoding/string materialization; native parsers such as Woodstox or quick-xml can put delimiter search and tokenization in JVM/Rust code with lower-level buffer access.

Native-addon or FFI-style experiments do not change that public-contract boundary. A Rust, C, or C++ tokenizer can reduce delimiter-search cost, and a lower-level boundary can expose pointers, buffers, or spans more directly. It still cannot hand ordinary JavaScript consumers a ready-made zero-copy StAX event stream with JavaScript strings. Once the benchmark contract requires JavaScript strings and events, V8 heap objects must be created or copied, and that materialization cost dominates the tokenizer-language or boundary choice.

## Release Artifacts

- Runtime matrix: `packages/benchmark/results/release/runtime-matrix.json`
- Cross-language reader comparison: `packages/benchmark/results/release/reader-cross-runtime.json`
- 4 GiB cursor reader: `packages/benchmark/results/release/stream-reader-4gb.json`
- Converter compiled batch plan: `packages/benchmark/results/release/converter-compiled-batch-plan.json`
- 1 GiB writer raw result: `packages/benchmark/results/release/raw/writer-1gb.json`
- Cross-language writer comparison: `packages/benchmark/results/release/writer-cross-runtime.json`
