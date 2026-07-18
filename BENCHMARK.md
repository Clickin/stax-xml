# StAX-XML Benchmarks

Generated: 2026-07-18T15:29:09.428Z
Run ID: 2026-07-18T15-29-09-427Z

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
| stax-xml EventReaderSync (JS object) | 173.47 us | 8.99 MB/s | 5,765 ops/sec | 59.1 KiB |
| stax-xml StreamReaderSync (JS object) | 161.63 us | 9.65 MB/s | 6,187 ops/sec | 32.2 KiB |
| stax-xml Converter API (JS object) | 198.70 us | 7.85 MB/s | 5,033 ops/sec | 45.0 KiB |
| fast-xml-parser XMLParser (JS object) | 258.23 us | 6.04 MB/s | 3,872 ops/sec | 212.5 KiB |
| txml parse (JS object) | 7.66 us | 203.53 MB/s | 130,468 ops/sec | 3.9 KiB |
| xml2js parseString (JS object) | 328.86 us | 4.74 MB/s | 3,041 ops/sec | 196.3 KiB |

### 4 KiB

| Library | Average | MB/s | Ops/sec | Heap |
| --- | --- | --- | --- | --- |
| stax-xml EventReaderSync (JS object) | 286.79 us | 15.45 MB/s | 3,487 ops/sec | 120.0 KiB |
| stax-xml StreamReaderSync (JS object) | 259.85 us | 17.05 MB/s | 3,848 ops/sec | 66.0 KiB |
| stax-xml Converter API (JS object) | 303.54 us | 14.60 MB/s | 3,294 ops/sec | 124.9 KiB |
| fast-xml-parser XMLParser (JS object) | 434.80 us | 10.19 MB/s | 2,300 ops/sec | 744.3 KiB |
| txml parse (JS object) | 18.58 us | 238.48 MB/s | 53,821 ops/sec | 2.9 KiB |
| xml2js parseString (JS object) | 518.51 us | 8.55 MB/s | 1,929 ops/sec | 536.6 KiB |

### 13 MiB

| Library | Average | MB/s | Ops/sec | Heap |
| --- | --- | --- | --- | --- |
| stax-xml EventReaderSync (JS object) | 122.02 ms | 111.33 MB/s | 8.2 ops/sec | 30.3 MiB |
| stax-xml StreamReaderSync (JS object) | 104.20 ms | 130.36 MB/s | 9.6 ops/sec | 17.8 MiB |
| stax-xml Converter API (JS object) | 103.96 ms | 130.66 MB/s | 9.62 ops/sec | 11.7 MiB |
| fast-xml-parser XMLParser (JS object) | 503.01 ms | 27.01 MB/s | 1.99 ops/sec | 134.9 MiB |
| txml parse (JS object) | 94.30 ms | 144.06 MB/s | 10.6 ops/sec | 126.9 MiB |
| xml2js parseString (JS object) | 464.08 ms | 29.27 MB/s | 2.15 ops/sec | 95.3 MiB |

### 98 MiB

| Library | Average | MB/s | Ops/sec | Heap |
| --- | --- | --- | --- | --- |
| stax-xml EventReaderSync (JS object) | 872.36 ms | 116.79 MB/s | 1.15 ops/sec | 29.5 MiB |
| stax-xml StreamReaderSync (JS object) | 715.07 ms | 142.48 MB/s | 1.4 ops/sec | 40.8 MiB |
| stax-xml Converter API (JS object) | 668.76 ms | 152.35 MB/s | 1.5 ops/sec | 32.1 MiB |
| fast-xml-parser XMLParser (JS object) | 3.78 s | 26.97 MB/s | 0.26 ops/sec | 960.1 MiB |
| txml parse (JS object) | 835.36 ms | 121.96 MB/s | 1.2 ops/sec | 873.3 MiB |
| xml2js parseString (JS object) | 3.62 s | 28.18 MB/s | 0.28 ops/sec | 643.2 MiB |

## Maintained Node XML Parser Comparison

| Library | Average | Ops/sec | Heap |
| --- | --- | --- | --- |
| stax-xml EventReaderSync (JS event checksum) | 302.99 us | 3,300 ops/sec | 139.1 KiB |
| stax-xml StreamReaderSync (JS event checksum) | 281.78 us | 3,549 ops/sec | 100.1 KiB |
| fast-xml-parser XMLParser | 383.79 us | 2,606 ops/sec | 721.9 KiB |
| txml parse | 71.92 us | 13,903 ops/sec | 85.0 KiB |
| xml2js parseString | 504.25 us | 1,983 ops/sec | 589.6 KiB |
| sax strict event parser | 387.35 us | 2,582 ops/sec | 380.4 KiB |
| saxes event parser | 247.66 us | 4,038 ops/sec | 92.4 KiB |
| htmlparser2 xmlMode parser | 352.86 us | 2,834 ops/sec | 259.3 KiB |

## StreamReaderSync Incremental Size Series

| Size | Throughput | Average | Heap delta | RSS delta |
| --- | --- | --- | --- | --- |
| (1MiB generated chunks) | 49.37 MiB/s | 20.26 ms | 3.9 MiB | 432.0 KiB |
| (10MiB generated chunks) | 75.24 MiB/s | 132.91 ms | 4.3 MiB | 656.0 KiB |
| (100MiB generated chunks) | 77.90 MiB/s | 1.28 s | 7.5 MiB | 33.1 MiB |
| (1GiB generated chunks) | 78.58 MiB/s | 13.03 s | 27.1 MiB | 66.7 MiB |
| (4GiB generated chunks) | 85.95 MiB/s | 47.65 s | 29.4 MiB | 78.1 MiB |

## Runtime Matrix

The same generated 16 MiB fixture and checksum workloads run on Node, Bun, and Deno. Memory columns are absolute measured-run endpoint peaks for each runtime process.

| Runtime | Workload | Throughput | Average | Peak heap | Peak RSS | Events | Checksum |
| --- | --- | --- | --- | --- | --- | --- | --- |
| node 26.5.0 | stream-sync-type-only | 115.68 MiB/s | 138.31 ms | 7.5 MiB | 132.7 MiB | 1,024,909 | 879435954 |
| node 26.5.0 | stream-sync-name-text | 78.51 MiB/s | 203.80 ms | 7.2 MiB | 133.5 MiB | 1,024,909 | -1201287088 |
| node 26.5.0 | stream-sync-full | 61.46 MiB/s | 260.32 ms | 20.2 MiB | 153.9 MiB | 1,024,909 | -855783368 |
| node 26.5.0 | event-sync-full | 55.45 MiB/s | 288.55 ms | 14.8 MiB | 154.0 MiB | 1,024,909 | -855783368 |
| bun 1.3.14 | stream-sync-type-only | 187.22 MiB/s | 85.46 ms | 33.0 MiB | 181.0 MiB | 1,024,909 | 879435954 |
| bun 1.3.14 | stream-sync-name-text | 145.88 MiB/s | 109.68 ms | 32.9 MiB | 210.9 MiB | 1,024,909 | -1201287088 |
| bun 1.3.14 | stream-sync-full | 100.19 MiB/s | 159.70 ms | 33.0 MiB | 220.1 MiB | 1,024,909 | -855783368 |
| bun 1.3.14 | event-sync-full | 107.92 MiB/s | 148.25 ms | 17.0 MiB | 259.2 MiB | 1,024,909 | -855783368 |
| deno 2.9.3 (v8 14.9.207.2-rusty) | stream-sync-type-only | 127.73 MiB/s | 125.27 ms | 28.3 MiB | 117.9 MiB | 1,024,909 | 879435954 |
| deno 2.9.3 (v8 14.9.207.2-rusty) | stream-sync-name-text | 119.51 MiB/s | 133.88 ms | 24.7 MiB | 118.3 MiB | 1,024,909 | -1201287088 |
| deno 2.9.3 (v8 14.9.207.2-rusty) | stream-sync-full | 63.07 MiB/s | 253.69 ms | 36.0 MiB | 137.4 MiB | 1,024,909 | -855783368 |
| deno 2.9.3 (v8 14.9.207.2-rusty) | event-sync-full | 60.56 MiB/s | 264.21 ms | 31.5 MiB | 138.1 MiB | 1,024,909 | -855783368 |

## Cross-Language Reader Comparison

The same UTF-8 file is read and parsed by public pull-reader APIs in Node, Java, and Rust. Every timed run includes file I/O; all element names, non-whitespace text, and attribute names/values are materialized and must preserve the same event count and checksum.

| Reader | Median throughput | Median time | Events | Checksum |
| --- | --- | --- | --- | --- |
| stax-xml StreamReaderSync (v26.5.0) | 94.8 MiB/s | 168.75 ms | 967,965 | 36104832 |
| Woodstox 6.7.0 (Java 25.0.2) | 322.0 MiB/s | 49.68 ms | 967,965 | 36104832 |
| quick-xml 0.40.1 (Rust 1.95.0) | 572.8 MiB/s | 27.93 ms | 967,965 | 36104832 |

## Converter IR Projection

Converter section generated: 2026-07-18T15:28:29.900Z

| Projection | Throughput | Average | Heap delta | RSS delta | Checksum |
| --- | --- | --- | --- | --- | --- |
| Manual StreamReaderSync projection | 105.78 MiB/s | 151.26 ms | 57.6 MiB | 3.5 MiB | -1845341048 |
| Converter schema.parseSync(bytes) | 83.42 MiB/s | 191.80 ms | 60.8 MiB | 3.7 MiB | -1845341048 |

The converter row uses `schema.parseSync(bytes)`: schema is lowered to IR, then executed by generated code when runtime code generation is available. It is compared only with the equivalent manual object projection on this catalog fixture.

## Cross-Language Writer Comparison

The public writer APIs in Node, Java, and Rust generate the same compact XML workload and write it to a real file sink. Rows are medians of three end-to-end runs.

| Writer | Median throughput | Median time | Written | Records |
| --- | --- | --- | --- | --- |
| stax-xml WriterSyncSink (v26.5.0) | 195.7 MiB/s | 52.52 ms | 10.3 MiB | 12,798 |
| Woodstox 6.7.0 (Java 25.0.2) | 121.8 MiB/s | 84.39 ms | 10.3 MiB | 12,798 |
| quick-xml 0.40.1 (Rust 1.95.0) | 290.9 MiB/s | 35.32 ms | 10.3 MiB | 12,798 |

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
