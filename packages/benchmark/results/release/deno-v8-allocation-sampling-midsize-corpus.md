# V8 Allocation Sampling

Generated: 2026-05-31T18:09:06.619Z

This report is a TRACE_FACT for one Deno/V8 build and one fixture.
It uses inspector `HeapProfiler.startSampling` / `HeapProfiler.stopSampling` around full-string reader shapes and optional selected-field projection rows.
It is not a proof that JavaScript runtimes have no further headroom.

## Environment

- Runtime: Deno/V8
- Deno: 2.7.13
- Node compatibility: v24.2.0
- V8: 14.7.173.20-rusty
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: file (G:\programming\stax-xml\packages\benchmark\assets\midsize.xml)
- Fixture shape: runtime-comparison
- Fixture size: 13.4 MiB (14017532 bytes)
- Runs: warmups=0, iterations=1
- Sampling interval: 8192 bytes

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\v8-allocation\deno-v8-allocation-midsize-corpus
- Committed: no

## Results

| Case | Count kind | Avg time | Events | Checksum | Sampled bytes | Samples | Target function bytes | stax-xml source bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| event-reader-object | stream-events | 170.63 ms | 1013762 | 1553514899 | 98.9 KiB | 10 | 8.0 KiB | 32.9 KiB |
| raw-frame-name-id-cache | stream-events | 136.16 ms | 1013762 | 1553514899 | 124.4 KiB | 13 | 26.7 KiB | 61.3 KiB |

## Top Frames

### event-reader-object

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| post | 26.2 KiB | 26.5% | node:inspector:78:7 |
| indexOf | 17.1 KiB | 17.3% | (native or anonymous) |
| entries | 14.1 KiB | 14.3% | (native or anonymous) |
| parseEndTag | 8.6 KiB | 8.7% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:35804 |
| trim | 8.5 KiB | 8.6% | (native or anonymous) |
| parseNextEvent | 8.2 KiB | 8.2% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:35023 |
| e | 8.1 KiB | 8.2% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:34294 |
| consumeEventReaderObject | 8.0 KiB | 8.1% | file:///G:/programming/stax-xml/packages/benchmark/v8-allocation-sampling.mjs:733:34 |

### raw-frame-name-id-cache

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| set | 46.1 KiB | 37.1% | (native or anonymous) |
| decodeShortAsciiSpan | 18.6 KiB | 15.0% | file:///G:/programming/stax-xml/packages/benchmark/v8-allocation-sampling.mjs:902:30 |
| get byteLength | 17.0 KiB | 13.6% | (native or anonymous) |
| parseEndTag | 9.2 KiB | 7.4% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:9087 |
| parseStartTag | 9.1 KiB | 7.3% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:9805 |
| parseBuffer | 8.2 KiB | 6.6% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:6979 |
| z | 8.1 KiB | 6.5% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:32618 |
| consumeRawFrameNameIdCache | 8.1 KiB | 6.5% | file:///G:/programming/stax-xml/packages/benchmark/v8-allocation-sampling.mjs:796:36 |

## Parity

Stream-event status: ok
Stream-event rows: event-reader-object, raw-frame-name-id-cache
Stream-event events: 1013762
Stream-event checksum: 1553514899
Projection status: not-applicable
Projection rows: n/a

## Findings

- same-contract-result (TRACE_FACT): All sampled stream-event shapes preserved the same event count and checksum during allocation sampling.
  - event-reader-object: events=1013762, checksum=1553514899
  - raw-frame-name-id-cache: events=1013762, checksum=1553514899
- sampled-allocation-shape (TRACE_FACT): HeapProfiler sampled JavaScript allocation bytes per full-string reader shape in this Deno/V8 build.
  - event-reader-object: sampledBytes=101248, targetFunctionBytes=8224, staxXmlSourceBytes=33736
  - raw-frame-name-id-cache: sampledBytes=127384, targetFunctionBytes=27336, staxXmlSourceBytes=62792
- sampling-attribution-limit (TRACE_FACT_LIMIT): Function/source byte attribution is based on sampled self-size frames and can attribute work to native frames instead of the JavaScript caller.
  - A zero source-byte bucket in this report does not mean the reader performed no work or allocated no values.
- allocation-sampling-not-ceiling-proof (TRACE_FACT_LIMIT): This is statistical allocation evidence for one runtime/build/input, not a proof that JavaScript runtimes have no further headroom.
  - Need larger fixtures, browser/Bun/JSC runs, and deeper source/asm evidence before promoting runtime-limit claims.
