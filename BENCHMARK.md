# StAX-XML Benchmarks

Generated: 2026-07-18T13:45:07.836Z
Run ID: 2026-07-18T13-45-07-835Z

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
| stax-xml EventReaderSync (JS object) | 166.84 us | 9.35 MB/s | 5,994 ops/sec | 58.6 KiB |
| stax-xml StreamReaderSync (JS object) | 153.96 us | 10.13 MB/s | 6,495 ops/sec | 31.5 KiB |
| stax-xml Converter API (JS object) | 189.48 us | 8.23 MB/s | 5,278 ops/sec | 44.0 KiB |
| fast-xml-parser XMLParser (JS object) | 243.01 us | 6.42 MB/s | 4,115 ops/sec | 203.8 KiB |
| txml parse (JS object) | 7.48 us | 208.46 MB/s | 133,629 ops/sec | 3.9 KiB |
| xml2js parseString (JS object) | 315.50 us | 4.94 MB/s | 3,170 ops/sec | 199.3 KiB |

### 4 KiB

| Library | Average | MB/s | Ops/sec | Heap |
| --- | --- | --- | --- | --- |
| stax-xml EventReaderSync (JS object) | 280.62 us | 15.79 MB/s | 3,564 ops/sec | 130.2 KiB |
| stax-xml StreamReaderSync (JS object) | 234.99 us | 18.86 MB/s | 4,255 ops/sec | 101.6 KiB |
| stax-xml Converter API (JS object) | 315.19 us | 14.06 MB/s | 3,173 ops/sec | 102.7 KiB |
| fast-xml-parser XMLParser (JS object) | 370.74 us | 11.95 MB/s | 2,697 ops/sec | 696.9 KiB |
| txml parse (JS object) | 17.06 us | 259.68 MB/s | 58,606 ops/sec | 2.9 KiB |
| xml2js parseString (JS object) | 468.46 us | 9.46 MB/s | 2,135 ops/sec | 535.8 KiB |

### 13 MiB

| Library | Average | MB/s | Ops/sec | Heap |
| --- | --- | --- | --- | --- |
| stax-xml EventReaderSync (JS object) | 118.05 ms | 115.07 MB/s | 8.47 ops/sec | 30.4 MiB |
| stax-xml StreamReaderSync (JS object) | 101.56 ms | 133.75 MB/s | 9.85 ops/sec | 17.8 MiB |
| stax-xml Converter API (JS object) | 99.80 ms | 136.12 MB/s | 10.02 ops/sec | 11.1 MiB |
| fast-xml-parser XMLParser (JS object) | 486.28 ms | 27.94 MB/s | 2.06 ops/sec | 135.5 MiB |
| txml parse (JS object) | 91.12 ms | 149.08 MB/s | 10.97 ops/sec | 126.9 MiB |
| xml2js parseString (JS object) | 448.87 ms | 30.26 MB/s | 2.23 ops/sec | 105.7 MiB |

### 98 MiB

| Library | Average | MB/s | Ops/sec | Heap |
| --- | --- | --- | --- | --- |
| stax-xml EventReaderSync (JS object) | 840.14 ms | 121.27 MB/s | 1.19 ops/sec | 29.6 MiB |
| stax-xml StreamReaderSync (JS object) | 689.71 ms | 147.72 MB/s | 1.45 ops/sec | 40.7 MiB |
| stax-xml Converter API (JS object) | 644.12 ms | 158.17 MB/s | 1.55 ops/sec | 29.6 MiB |
| fast-xml-parser XMLParser (JS object) | 3.57 s | 28.54 MB/s | 0.28 ops/sec | 959.5 MiB |
| txml parse (JS object) | 706.71 ms | 144.17 MB/s | 1.42 ops/sec | 874.3 MiB |
| xml2js parseString (JS object) | 3.39 s | 30.06 MB/s | 0.3 ops/sec | 634.4 MiB |

## Maintained Node XML Parser Comparison

| Library | Average | Ops/sec | Heap |
| --- | --- | --- | --- |
| stax-xml EventReaderSync (JS event checksum) | 323.21 us | 3,094 ops/sec | 119.0 KiB |
| stax-xml StreamReaderSync (JS event checksum) | 306.37 us | 3,264 ops/sec | 74.4 KiB |
| fast-xml-parser XMLParser | 364.37 us | 2,744 ops/sec | 774.1 KiB |
| txml parse | 65.58 us | 15,248 ops/sec | 83.1 KiB |
| xml2js parseString | 469.86 us | 2,128 ops/sec | 540.8 KiB |
| sax strict event parser | 361.55 us | 2,766 ops/sec | 384.8 KiB |
| saxes event parser | 245.60 us | 4,072 ops/sec | 97.3 KiB |
| htmlparser2 xmlMode parser | 348.03 us | 2,873 ops/sec | 288.5 KiB |

## StreamReaderSync Incremental Size Series

| Size | Throughput | Average | Heap delta | RSS delta |
| --- | --- | --- | --- | --- |
| (1MiB generated chunks) | 50.96 MiB/s | 19.63 ms | 3.8 MiB | 272.0 KiB |
| (10MiB generated chunks) | 76.42 MiB/s | 130.86 ms | 4.3 MiB | 544.0 KiB |
| (100MiB generated chunks) | 79.86 MiB/s | 1.25 s | 22.2 MiB | 33.2 MiB |
| (1GiB generated chunks) | 80.21 MiB/s | 12.77 s | 27.1 MiB | 66.4 MiB |
| (4GiB generated chunks) | 88.44 MiB/s | 46.31 s | 27.8 MiB | 77.9 MiB |

## Runtime Matrix

The same generated 16 MiB fixture and checksum workloads run on Node, Bun, and Deno. Memory columns are absolute measured-run endpoint peaks for each runtime process.

| Runtime | Workload | Throughput | Average | Peak heap | Peak RSS | Events | Checksum |
| --- | --- | --- | --- | --- | --- | --- | --- |
| node 26.5.0 | stream-sync-type-only | 123.01 MiB/s | 130.06 ms | 11.4 MiB | 132.4 MiB | 1,024,909 | 879435954 |
| node 26.5.0 | stream-sync-name-text | 85.03 MiB/s | 188.17 ms | 7.5 MiB | 133.5 MiB | 1,024,909 | -1201287088 |
| node 26.5.0 | stream-sync-full | 66.84 MiB/s | 239.39 ms | 20.2 MiB | 153.6 MiB | 1,024,909 | -855783368 |
| node 26.5.0 | event-sync-full | 59.87 MiB/s | 267.23 ms | 14.9 MiB | 153.7 MiB | 1,024,909 | -855783368 |
| bun 1.3.14 | stream-sync-type-only | 196.44 MiB/s | 81.45 ms | 33.0 MiB | 183.1 MiB | 1,024,909 | 879435954 |
| bun 1.3.14 | stream-sync-name-text | 154.55 MiB/s | 103.52 ms | 32.9 MiB | 213.1 MiB | 1,024,909 | -1201287088 |
| bun 1.3.14 | stream-sync-full | 105.08 MiB/s | 152.27 ms | 33.1 MiB | 221.1 MiB | 1,024,909 | -855783368 |
| bun 1.3.14 | event-sync-full | 114.21 MiB/s | 140.09 ms | 17.0 MiB | 260.4 MiB | 1,024,909 | -855783368 |
| deno 2.9.3 (v8 14.9.207.2-rusty) | stream-sync-type-only | 136.24 MiB/s | 117.44 ms | 28.3 MiB | 117.8 MiB | 1,024,909 | 879435954 |
| deno 2.9.3 (v8 14.9.207.2-rusty) | stream-sync-name-text | 124.01 MiB/s | 129.02 ms | 24.7 MiB | 118.1 MiB | 1,024,909 | -1201287088 |
| deno 2.9.3 (v8 14.9.207.2-rusty) | stream-sync-full | 67.23 MiB/s | 237.99 ms | 36.0 MiB | 136.9 MiB | 1,024,909 | -855783368 |
| deno 2.9.3 (v8 14.9.207.2-rusty) | event-sync-full | 65.00 MiB/s | 246.15 ms | 31.4 MiB | 137.6 MiB | 1,024,909 | -855783368 |

## Cross-Language Reader Comparison

The same in-memory UTF-8 fixture is parsed by public pull-reader APIs in Node, Java, and Rust. File I/O is outside the timed region; all element names, non-whitespace text, and attribute names/values are materialized and must preserve the same event count and checksum.

| Reader | Median throughput | Median time | Events | Checksum |
| --- | --- | --- | --- | --- |
| stax-xml StreamReaderSync (v26.5.0) | 98.9 MiB/s | 161.81 ms | 967,965 | 36104832 |
| Woodstox 6.7.0 (Java 25.0.2) | 303.5 MiB/s | 52.72 ms | 967,965 | 36104832 |
| quick-xml 0.40.1 (Rust 1.95.0) | 641.3 MiB/s | 24.95 ms | 967,965 | 36104832 |

## Converter IR Projection

Converter section generated: 2026-07-18T13:44:29.624Z

| Projection | Throughput | Average | Heap delta | RSS delta | Checksum |
| --- | --- | --- | --- | --- | --- |
| Manual StreamReaderSync projection | 109.15 MiB/s | 146.59 ms | 57.5 MiB | 3.3 MiB | -1845341048 |
| Converter schema.parseSync(bytes) | 85.75 MiB/s | 186.60 ms | 60.7 MiB | 3.6 MiB | -1845341048 |

The converter row uses `schema.parseSync(bytes)`: schema is lowered to IR, then executed by generated code when runtime code generation is available. It is compared only with the equivalent manual object projection on this catalog fixture.

## Cross-Language Writer Comparison

The public writer APIs in Node, Java, and Rust generate the same compact XML workload and write it to a real file sink. Rows are medians of three end-to-end runs.

| Writer | Median throughput | Median time | Written | Records |
| --- | --- | --- | --- | --- |
| stax-xml WriterSyncSink (v26.5.0) | 204.8 MiB/s | 50.18 ms | 10.3 MiB | 12,798 |
| Woodstox 6.7.0 (Java 25.0.2) | 126.8 MiB/s | 81.06 ms | 10.3 MiB | 12,798 |
| quick-xml 0.40.1 (Rust 1.95.0) | 212.0 MiB/s | 48.46 ms | 10.3 MiB | 12,798 |

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
