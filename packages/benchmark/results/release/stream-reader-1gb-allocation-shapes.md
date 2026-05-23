# StreamReaderSync Large Shape Benchmark

Generated: 2026-05-23T10:13:46.018Z

This benchmark uses `StreamReaderSync` over generated `Uint8Array` batches and consumes each row without loading a complete XML document string.
It measures the public pure JavaScript stream reader path and does not use native addons, Wasm modules, or backend selection.
Raw-frame rows keep the same full-string checksum contract while separating index-accessor and numeric name-id cache overhead.

## Environment

- Package: stax-xml 1.0.0
- Runtime: Node 24.15.0 / V8 13.6.233.17-node.48 (win32-x64)
- Fixture: generated repeated person rows, 1.00 GiB
- Runs: warmups=0, runs=1

## Results

| Style | Throughput | Average | Min | Max | Events | Checksum | String fields | Raw span materializations |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| index-for | 86.42 MiB/s | 11848.65 ms | 11848.65 ms | 11848.65 ms | 143165586 | -1871242243 | 178956980 | 0 |
| raw-frame-direct | 75.14 MiB/s | 13627.91 ms | 13627.91 ms | 13627.91 ms | 143165586 | -1871242243 | 178956980 | 178956980 |
| raw-frame-name-id | 89.60 MiB/s | 11429.04 ms | 11429.04 ms | 11429.04 ms | 143165586 | -1871242243 | 178956980 | 53687098 |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Style | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| index-for | +2.5 MiB | +5.8 MiB | 7.3 MiB | 59.8 MiB |
| raw-frame-direct | +1.3 MiB | +540.0 KiB | 6.3 MiB | 60.2 MiB |
| raw-frame-name-id | +3.4 MiB | +5.0 MiB | 8.4 MiB | 65.3 MiB |

## Materialization Counters

String fields are the names, text values, attribute names, and attribute values consumed by the checksum contract. Raw span materializations are string creations performed by the raw-frame benchmark code rather than by public accessors.

| Style | Names | Text | Attr names | Attr values | Raw name spans | Raw text spans | Raw attr-name spans | Raw attr-value spans | Name cache hit/miss | Implicit attr values | Event objects |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| index-for | 107374188 | 35791396 | 17895698 | 17895698 | 0 | 0 | 0 | 0 | 0/0 | 0 | 0 |
| raw-frame-direct | 107374188 | 35791396 | 17895698 | 17895698 | 107374188 | 35791396 | 17895698 | 17895698 | 0/0 | 0 | 0 |
| raw-frame-name-id | 107374188 | 35791396 | 17895698 | 17895698 | 3 | 35791396 | 1 | 17895698 | 125269882/4 | 0 | 0 |

## V8 Allocation Sampling

V8 HeapProfiler allocation sampling is statistical self-size evidence and not a deterministic allocation census.

- Sampling interval: 8192 bytes
- Raw output dir: G:\programming\stax-xml\packages\benchmark\results\v8-allocation\stream-reader-1gb-shapes
- Raw artifacts committed: no

| Style | Sampled bytes | Samples | stax-xml source bytes | Benchmark source bytes |
| --- | ---: | ---: | ---: | ---: |
| index-for | 171.7 KiB | 19 | 116.7 KiB | 25.3 KiB |
| raw-frame-direct | 121.3 KiB | 13 | 25.5 KiB | 28.3 KiB |
| raw-frame-name-id | 99.6 KiB | 11 | 99.6 KiB | 0 B |

### Top Frames

#### index-for

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| parseStartTag | 47.6 KiB | 27.7% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:9790 |
| parseStartTag | 24.4 KiB | 14.2% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:9790 |
| countStringField | 17.3 KiB | 10.1% | file:///G:/programming/stax-xml/packages/benchmark/stream-reader-4gb-consumption.mjs:555:26 |
| trim | 17.0 KiB | 9.9% | (native or anonymous) |
| post | 12.7 KiB | 7.4% | node:inspector:115:7 |
| parseBuffer | 10.0 KiB | 5.8% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:6966 |
| P | 9.9 KiB | 5.8% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:27016 |
| parseEndTag | 8.8 KiB | 5.1% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:9073 |

#### raw-frame-direct

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| imul | 40.2 KiB | 33.2% | (native or anonymous) |
| set | 27.2 KiB | 22.4% | (native or anonymous) |
| decodeShortAsciiSpan | 20.1 KiB | 16.5% | file:///G:/programming/stax-xml/packages/benchmark/stream-reader-4gb-consumption.mjs:461:30 |
| addText | 8.6 KiB | 7.1% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:11727 |
| assertValidName | 8.5 KiB | 7.0% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:12019 |
| p | 8.4 KiB | 6.9% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:15738 |
| consumeRawFrameStyle | 8.2 KiB | 6.8% | file:///G:/programming/stax-xml/packages/benchmark/stream-reader-4gb-consumption.mjs:348:30 |

#### raw-frame-name-id

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| parseStartTag | 37.0 KiB | 37.1% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:9790 |
| ensureElementCapacity | 26.4 KiB | 26.5% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:14945 |
| addEvent | 18.9 KiB | 19.0% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:13698 |
| addTextEvent | 8.9 KiB | 8.9% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:13655 |
| p | 8.4 KiB | 8.5% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:15738 |

## Parity

Status: ok
Events: 143165586
Checksum: -1871242243
