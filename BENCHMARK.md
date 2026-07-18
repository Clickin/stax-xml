# StAX-XML Benchmarks

Generated: 2026-07-18T17:16:41.036Z
Run ID: 2026-07-18T17-16-41-036Z

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
| stax-xml EventReaderSync (JS object) | 176.77 us | 8.82 MB/s | 5,657 ops/sec | 64.9 KiB |
| stax-xml StreamReaderSync (JS object) | 161.26 us | 9.67 MB/s | 6,201 ops/sec | 32.6 KiB |
| stax-xml Converter API (JS object) | 195.94 us | 7.96 MB/s | 5,104 ops/sec | 45.0 KiB |
| fast-xml-parser XMLParser (JS object) | 256.96 us | 6.07 MB/s | 3,892 ops/sec | 201.4 KiB |
| txml parse (JS object) | 7.73 us | 201.78 MB/s | 129,348 ops/sec | 3.9 KiB |
| xml2js parseString (JS object) | 322.96 us | 4.83 MB/s | 3,096 ops/sec | 198.2 KiB |

### 4 KiB

| Library | Average | MB/s | Ops/sec | Heap |
| --- | --- | --- | --- | --- |
| stax-xml EventReaderSync (JS object) | 284.06 us | 15.60 MB/s | 3,520 ops/sec | 132.1 KiB |
| stax-xml StreamReaderSync (JS object) | 260.87 us | 16.99 MB/s | 3,833 ops/sec | 69.6 KiB |
| stax-xml Converter API (JS object) | 299.33 us | 14.80 MB/s | 3,341 ops/sec | 125.9 KiB |
| fast-xml-parser XMLParser (JS object) | 382.64 us | 11.58 MB/s | 2,613 ops/sec | 691.1 KiB |
| txml parse (JS object) | 17.57 us | 252.18 MB/s | 56,914 ops/sec | 2.9 KiB |
| xml2js parseString (JS object) | 487.47 us | 9.09 MB/s | 2,051 ops/sec | 578.1 KiB |

### 13 MiB

| Library | Average | MB/s | Ops/sec | Heap |
| --- | --- | --- | --- | --- |
| stax-xml EventReaderSync (JS object) | 122.59 ms | 110.81 MB/s | 8.16 ops/sec | 19.1 MiB |
| stax-xml StreamReaderSync (JS object) | 105.05 ms | 129.32 MB/s | 9.52 ops/sec | 17.8 MiB |
| stax-xml Converter API (JS object) | 104.16 ms | 130.42 MB/s | 9.6 ops/sec | 12.0 MiB |
| fast-xml-parser XMLParser (JS object) | 504.04 ms | 26.95 MB/s | 1.98 ops/sec | 134.6 MiB |
| txml parse (JS object) | 98.82 ms | 137.47 MB/s | 10.12 ops/sec | 126.9 MiB |
| xml2js parseString (JS object) | 468.81 ms | 28.98 MB/s | 2.13 ops/sec | 94.9 MiB |

### 98 MiB

| Library | Average | MB/s | Ops/sec | Heap |
| --- | --- | --- | --- | --- |
| stax-xml EventReaderSync (JS object) | 883.15 ms | 115.36 MB/s | 1.13 ops/sec | 38.0 MiB |
| stax-xml StreamReaderSync (JS object) | 709.20 ms | 143.66 MB/s | 1.41 ops/sec | 40.5 MiB |
| stax-xml Converter API (JS object) | 664.24 ms | 153.38 MB/s | 1.51 ops/sec | 32.7 MiB |
| fast-xml-parser XMLParser (JS object) | 3.72 s | 27.38 MB/s | 0.27 ops/sec | 951.3 MiB |
| txml parse (JS object) | 745.66 ms | 136.63 MB/s | 1.34 ops/sec | 873.8 MiB |
| xml2js parseString (JS object) | 3.49 s | 29.22 MB/s | 0.29 ops/sec | 645.6 MiB |

## Maintained Node XML Parser Comparison

| Library | Average | Ops/sec | Heap |
| --- | --- | --- | --- |
| stax-xml EventReaderSync (JS event checksum) | 299.24 us | 3,342 ops/sec | 158.0 KiB |
| stax-xml StreamReaderSync (JS event checksum) | 278.47 us | 3,591 ops/sec | 101.9 KiB |
| fast-xml-parser XMLParser | 390.05 us | 2,564 ops/sec | 768.8 KiB |
| txml parse | 70.92 us | 14,100 ops/sec | 82.7 KiB |
| xml2js parseString | 505.31 us | 1,979 ops/sec | 603.1 KiB |
| sax strict event parser | 407.04 us | 2,457 ops/sec | 387.0 KiB |
| saxes event parser | 268.13 us | 3,730 ops/sec | 92.4 KiB |
| htmlparser2 xmlMode parser | 328.90 us | 3,040 ops/sec | 286.4 KiB |

## StreamReaderSync Incremental Size Series

| Size | Throughput | Average | Heap delta | RSS delta |
| --- | --- | --- | --- | --- |
| (1MiB generated chunks) | 48.89 MiB/s | 20.45 ms | 4.1 MiB | 464.0 KiB |
| (10MiB generated chunks) | 74.35 MiB/s | 134.50 ms | 4.3 MiB | 528.0 KiB |
| (100MiB generated chunks) | 77.50 MiB/s | 1.29 s | 7.4 MiB | 33.2 MiB |
| (1GiB generated chunks) | 77.84 MiB/s | 13.16 s | 27.8 MiB | 67.2 MiB |
| (4GiB generated chunks) | 84.97 MiB/s | 48.21 s | 27.8 MiB | 78.1 MiB |

## Runtime Matrix

The same generated 16 MiB fixture and checksum workloads run on Node, Bun, and Deno. Memory columns are absolute measured-run endpoint peaks for each runtime process.

| Runtime | Workload | Throughput | Average | Peak heap | Peak RSS | Events | Checksum |
| --- | --- | --- | --- | --- | --- | --- | --- |
| node 26.5.0 | stream-sync-type-only | 117.88 MiB/s | 135.73 ms | 8.1 MiB | 132.8 MiB | 1,024,909 | 879435954 |
| node 26.5.0 | stream-sync-name-text | 77.64 MiB/s | 206.07 ms | 8.7 MiB | 133.8 MiB | 1,024,909 | -1201287088 |
| node 26.5.0 | stream-sync-full | 61.84 MiB/s | 258.74 ms | 21.2 MiB | 155.7 MiB | 1,024,909 | -855783368 |
| node 26.5.0 | event-sync-full | 53.41 MiB/s | 299.57 ms | 11.8 MiB | 156.0 MiB | 1,024,909 | -855783368 |
| bun 1.3.14 | stream-sync-type-only | 188.39 MiB/s | 84.93 ms | 33.0 MiB | 185.4 MiB | 1,024,909 | 879435954 |
| bun 1.3.14 | stream-sync-name-text | 144.89 MiB/s | 110.43 ms | 32.9 MiB | 215.6 MiB | 1,024,909 | -1201287088 |
| bun 1.3.14 | stream-sync-full | 99.04 MiB/s | 161.56 ms | 33.1 MiB | 223.8 MiB | 1,024,909 | -855783368 |
| bun 1.3.14 | event-sync-full | 100.60 MiB/s | 159.05 ms | 17.0 MiB | 264.0 MiB | 1,024,909 | -855783368 |
| deno 2.9.3 (v8 14.9.207.2-rusty) | stream-sync-type-only | 126.50 MiB/s | 126.48 ms | 26.0 MiB | 118.9 MiB | 1,024,909 | 879435954 |
| deno 2.9.3 (v8 14.9.207.2-rusty) | stream-sync-name-text | 116.62 MiB/s | 137.20 ms | 29.3 MiB | 119.3 MiB | 1,024,909 | -1201287088 |
| deno 2.9.3 (v8 14.9.207.2-rusty) | stream-sync-full | 62.53 MiB/s | 255.87 ms | 29.0 MiB | 138.4 MiB | 1,024,909 | -855783368 |
| deno 2.9.3 (v8 14.9.207.2-rusty) | event-sync-full | 57.47 MiB/s | 278.38 ms | 34.3 MiB | 138.7 MiB | 1,024,909 | -855783368 |

## Cross-Language Reader Comparison

The same UTF-8 file is read and parsed by public pull-reader APIs in Node, Java, and Rust. Every timed run includes file I/O; all element names, non-whitespace text, and attribute names/values are materialized and must preserve the same event count and checksum.

| Reader | Median throughput | Median time | Events | Checksum |
| --- | --- | --- | --- | --- |
| stax-xml StreamReaderSync (v26.5.0) | 91.6 MiB/s | 174.75 ms | 967,965 | 36104832 |
| Woodstox 6.7.0 (Java 25.0.2) | 333.4 MiB/s | 47.99 ms | 967,965 | 36104832 |
| quick-xml 0.40.1 (Rust 1.95.0) | 570.1 MiB/s | 28.07 ms | 967,965 | 36104832 |

## Converter IR Projection

Converter section generated: 2026-07-18T17:15:22.230Z

| Projection | Throughput | Average | Heap delta | RSS delta | Checksum |
| --- | --- | --- | --- | --- | --- |
| Manual StreamReaderSync projection | 102.43 MiB/s | 156.21 ms | 57.8 MiB | 3.8 MiB | -1845341048 |
| Converter schema.parseSync(bytes) | 82.49 MiB/s | 193.96 ms | 61.0 MiB | 3.5 MiB | -1845341048 |

The converter row uses `schema.parseSync(bytes)`: schema is lowered to IR, then executed by generated code when runtime code generation is available. It is compared only with the equivalent manual object projection on this catalog fixture.

## Cross-Language Writer Comparison

The public writer APIs in Node, Java, and Rust generate the same compact XML workload and write it to a real file sink. Rows are medians of three end-to-end runs.

| Writer | Median throughput | Median time | Written | Records |
| --- | --- | --- | --- | --- |
| stax-xml WriterSyncSink (v26.5.0) | 187.1 MiB/s | 54.93 ms | 10.3 MiB | 12,798 |
| Woodstox 6.7.0 (Java 25.0.2) | 125.6 MiB/s | 81.84 ms | 10.3 MiB | 12,798 |
| quick-xml 0.40.1 (Rust 1.95.0) | 528.4 MiB/s | 19.45 ms | 10.3 MiB | 12,798 |

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
