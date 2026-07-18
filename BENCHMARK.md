# StAX-XML Benchmarks

Generated: 2026-07-18T12:39:24.663Z
Run ID: 2026-07-18T12-39-24-662Z

This release benchmark set measures public pure JavaScript surfaces. It keeps parser fixture series, maintained npm XML parser comparisons, incremental large-input measurements, converter rows, and writer rows together so docs do not publish a narrowed subset by accident.

## Environment

- Runtime: Node 24.15.0 (arm64-darwin)
- CPU: Apple M4 (~2.40 GHz)
- Package manager: pnpm@11.12.0

## Parser Fixture Series

Every row parses the same XML and returns the same canonical JavaScript record array. The benchmark validates full-result parity before measuring parse-plus-projection time.

### 2 KiB

| Library | Average | MB/s | Ops/sec | Heap |
| --- | --- | --- | --- | --- |
| stax-xml EventReaderSync (JS object) | 170.12 us | 9.17 MB/s | 5,878 ops/sec | 61.9 KiB |
| stax-xml StreamReaderSync (JS object) | 157.65 us | 9.90 MB/s | 6,343 ops/sec | 33.7 KiB |
| stax-xml Converter API (JS object) | 201.84 us | 7.73 MB/s | 4,954 ops/sec | 46.5 KiB |
| fast-xml-parser XMLParser (JS object) | 247.82 us | 6.29 MB/s | 4,035 ops/sec | 204.0 KiB |
| txml parse (JS object) | 7.63 us | 204.34 MB/s | 130,988 ops/sec | 3.8 KiB |
| xml2js parseString (JS object) | 323.36 us | 4.82 MB/s | 3,093 ops/sec | 209.9 KiB |

### 4 KiB

| Library | Average | MB/s | Ops/sec | Heap |
| --- | --- | --- | --- | --- |
| stax-xml EventReaderSync (JS object) | 300.15 us | 14.76 MB/s | 3,332 ops/sec | 140.2 KiB |
| stax-xml StreamReaderSync (JS object) | 246.78 us | 17.96 MB/s | 4,052 ops/sec | 120.6 KiB |
| stax-xml Converter API (JS object) | 349.46 us | 12.68 MB/s | 2,862 ops/sec | 86.4 KiB |
| fast-xml-parser XMLParser (JS object) | 369.54 us | 11.99 MB/s | 2,706 ops/sec | 954.7 KiB |
| txml parse (JS object) | 17.28 us | 256.44 MB/s | 57,875 ops/sec | 2.6 KiB |
| xml2js parseString (JS object) | 527.73 us | 8.40 MB/s | 1,895 ops/sec | 642.3 KiB |

### 13 MiB

| Library | Average | MB/s | Ops/sec | Heap |
| --- | --- | --- | --- | --- |
| stax-xml EventReaderSync (JS object) | 119.92 ms | 113.28 MB/s | 8.34 ops/sec | 29.3 MiB |
| stax-xml StreamReaderSync (JS object) | 97.62 ms | 139.16 MB/s | 10.24 ops/sec | 16.6 MiB |
| stax-xml Converter API (JS object) | 96.07 ms | 141.40 MB/s | 10.41 ops/sec | 39.7 MiB |
| fast-xml-parser XMLParser (JS object) | 487.26 ms | 27.88 MB/s | 2.05 ops/sec | 151.3 MiB |
| txml parse (JS object) | 93.88 ms | 144.71 MB/s | 10.65 ops/sec | 123.2 MiB |
| xml2js parseString (JS object) | 446.38 ms | 30.43 MB/s | 2.24 ops/sec | 88.8 MiB |

### 98 MiB

| Library | Average | MB/s | Ops/sec | Heap |
| --- | --- | --- | --- | --- |
| stax-xml EventReaderSync (JS object) | 885.55 ms | 115.05 MB/s | 1.13 ops/sec | 57.7 MiB |
| stax-xml StreamReaderSync (JS object) | 676.21 ms | 150.67 MB/s | 1.48 ops/sec | 39.0 MiB |
| stax-xml Converter API (JS object) | 654.15 ms | 155.75 MB/s | 1.53 ops/sec | 79.0 MiB |
| fast-xml-parser XMLParser (JS object) | 3.62 s | 28.17 MB/s | 0.28 ops/sec | 955.3 MiB |
| txml parse (JS object) | 804.11 ms | 126.70 MB/s | 1.24 ops/sec | 913.8 MiB |
| xml2js parseString (JS object) | 3.40 s | 29.99 MB/s | 0.29 ops/sec | 649.1 MiB |

## Maintained Node XML Parser Comparison

| Library | Average | Ops/sec | Heap |
| --- | --- | --- | --- |
| stax-xml EventReaderSync (JS event checksum) | 338.80 us | 2,952 ops/sec | 119.7 KiB |
| stax-xml StreamReaderSync (JS event checksum) | 323.10 us | 3,095 ops/sec | 71.8 KiB |
| fast-xml-parser XMLParser | 385.58 us | 2,593 ops/sec | 897.4 KiB |
| txml parse | 140.18 us | 7,134 ops/sec | 188.9 KiB |
| xml2js parseString | 605.22 us | 1,652 ops/sec | 732.4 KiB |
| sax strict event parser | 431.46 us | 2,318 ops/sec | 466.7 KiB |
| saxes event parser | 242.11 us | 4,130 ops/sec | 94.6 KiB |
| htmlparser2 xmlMode parser | 297.61 us | 3,360 ops/sec | 454.6 KiB |

## StreamReaderSync Incremental Size Series

| Size | Throughput | Average | RSS delta |
| --- | --- | --- | --- |
| (1MiB generated chunks) | 52.42 MiB/s | 19.08 ms | 16.0 KiB |
| (10MiB generated chunks) | 72.63 MiB/s | 137.68 ms | 0.0 KiB |
| (100MiB generated chunks) | 73.87 MiB/s | 1.35 s | 0.0 KiB |
| (1GiB generated chunks) | 73.46 MiB/s | 13.94 s | -89.3 MiB |
| (4GiB generated chunks) | 86.95 MiB/s | 47.11 s | 47.5 MiB |

## Converter IR Projection

Converter section generated: 2026-07-18T12:38:48.532Z

| Projection | Throughput | Average | Checksum |
| --- | --- | --- | --- |
| Manual StreamReaderSync projection | 110.61 MiB/s | 144.65 ms | -1845341048 |
| Converter schema.parseSync(bytes) | 83.18 MiB/s | 192.35 ms | -1845341048 |

The converter row uses `schema.parseSync(bytes)`: schema is lowered to IR, then executed by generated code when runtime code generation is available. It is compared only with the equivalent manual object projection on this catalog fixture.

### Reader/Writer Throughput Asymmetry

The 1 GiB rows are intentionally different workloads. `WriterSyncSink` writing to a temp file is mostly deterministic append work: the caller already knows each element name, attribute, and text value, so the writer validates its own state, encodes known JavaScript strings, and flushes large sequential chunks to the file descriptor. It does not search arbitrary XML for delimiters, recover tokens across chunk boundaries, or discover names, text, and attributes from incoming bytes.

`StreamReaderSync` is a CPU-bound parsing path. The current 1 GiB row uses generated byte batches rather than disk I/O, so storage speed is not the limiter. The reader must scan every byte, classify markup versus text, maintain XML state, keep the accessor API stable, and decode/materialize JavaScript strings for names, text, and attributes when the consumer asks for them. The main restriction is pure-JavaScript byte scanning plus UTF-8 span decoding/string materialization; native parsers such as Woodstox or quick-xml can put delimiter search and tokenization in JVM/Rust code with lower-level buffer access.

Native-addon or FFI-style experiments do not change that public-contract boundary. A Rust, C, or C++ tokenizer can reduce delimiter-search cost, and a lower-level boundary can expose pointers, buffers, or spans more directly. It still cannot hand ordinary JavaScript consumers a ready-made zero-copy StAX event stream with JavaScript strings. Once the benchmark contract requires JavaScript strings and events, V8 heap objects must be created or copied, and that materialization cost dominates the tokenizer-language or boundary choice.

## Release Artifacts

- Runtime matrix: `packages/benchmark/results/release/runtime-matrix.json`
- 4 GiB cursor reader: `packages/benchmark/results/release/stream-reader-4gb.json`
- Converter compiled batch plan: `packages/benchmark/results/release/converter-compiled-batch-plan.json`
- 1 GiB writer raw result: `packages/benchmark/results/release/raw/writer-1gb.json`
