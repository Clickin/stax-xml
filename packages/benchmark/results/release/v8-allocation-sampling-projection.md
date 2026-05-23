# V8 Allocation Sampling

Generated: 2026-05-23T19:17:36.737Z

This report is a TRACE_FACT for one Node/V8 build and one fixture.
It uses inspector `HeapProfiler.startSampling` / `HeapProfiler.stopSampling` around full-string reader shapes and optional selected-field projection rows.
It is not a proof that JavaScript runtimes have no further headroom.
Projection rows report projected record counts and selected-field checksums; they are not full StAX parity rows.

## Environment

- Node: v24.15.0
- V8: 13.6.233.17-node.48
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: generated
- Fixture shape: projection-cycle
- Fixture size: 16.0 MiB (16777181 bytes)
- Runs: warmups=1, iterations=4
- Sampling interval: 2048 bytes

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\v8-allocation\projection-cycle-release
- Committed: no

## Results

| Case | Count kind | Avg time | Events | Checksum | Sampled bytes | Samples | Target function bytes | stax-xml source bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| public-accessor | stream-events | 174.01 ms | 932199 | 765158370 | 230.3 KiB | 88 | 29.3 KiB | 88.8 KiB |
| event-reader-object | stream-events | 302.92 ms | 932199 | 765158370 | 72.9 KiB | 22 | 0 B | 21.8 KiB |
| raw-frame-direct-decode | stream-events | 219.83 ms | 932199 | 765158370 | 59.5 KiB | 18 | 0 B | 45.1 KiB |
| raw-frame-name-id-cache | stream-events | 278.26 ms | 932199 | 765158370 | 65.1 KiB | 19 | 4.4 KiB | 29.6 KiB |
| projection-low-selectivity | projected-records | 178.99 ms | 506 | -1924876833 | 125.7 KiB | 45 | 4.3 KiB | 93.9 KiB |
| projection-high-selectivity | projected-records | 317.74 ms | 49063 | 970928115 | 104.3 KiB | 35 | 0 B | 69.9 KiB |

## Top Frames

### public-accessor

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| post | 39.4 KiB | 17.1% | node:inspector:115:7 |
| compileForInternalLoader | 34.5 KiB | 15.0% | node:internal/bootstrap/realm:383:27 |
| materializeName | 26.7 KiB | 11.6% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:13442 |
| addEvent | 23.4 KiB | 10.2% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:13698 |
| ensureElementCapacity | 20.5 KiB | 8.9% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:14945 |
| (anonymous) | 12.8 KiB | 5.5% | node:internal/histogram:1:1 |
| compileForInternalLoader | 10.6 KiB | 4.6% | node:internal/bootstrap/realm:383:27 |
| (anonymous) | 7.2 KiB | 3.1% | node:internal/perf/resource_timing:1:1 |

### event-reader-object

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| trim | 19.0 KiB | 26.1% | (native or anonymous) |
| entries | 15.3 KiB | 20.9% | (native or anonymous) |
| parseNextEvent | 13.2 KiB | 18.2% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:35818 |
| get | 5.0 KiB | 6.9% | (native or anonymous) |
| charCodeAt | 4.5 KiB | 6.1% | (native or anonymous) |
| nextEvent | 4.2 KiB | 5.7% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:45626 |
| imul | 3.2 KiB | 4.4% | (native or anonymous) |
| Me | 2.4 KiB | 3.3% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:43521 |

### raw-frame-direct-decode

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| parseStartTag | 16.4 KiB | 27.6% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:9790 |
| assertValidName | 13.7 KiB | 23.1% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:12019 |
| l | 10.7 KiB | 18.0% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:15457 |
| get byteLength | 9.2 KiB | 15.5% | (native or anonymous) |
| set | 5.2 KiB | 8.7% | (native or anonymous) |
| o | 2.2 KiB | 3.6% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:2157 |
| nextRawBatch | 2.0 KiB | 3.4% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:33679 |

### raw-frame-name-id-cache

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| get | 16.2 KiB | 24.9% | (native or anonymous) |
| addEvent | 13.6 KiB | 20.9% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:13698 |
| get | 11.7 KiB | 18.0% | (native or anonymous) |
| p | 6.2 KiB | 9.5% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:15738 |
| imul | 5.5 KiB | 8.4% | (native or anonymous) |
| parseStartTag | 3.4 KiB | 5.2% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:9790 |
| materializeName | 2.3 KiB | 3.5% | file:///G:/programming/stax-xml/packages/benchmark/v8-allocation-sampling.mjs:865:25 |
| post | 2.2 KiB | 3.3% | node:inspector:115:7 |

### projection-low-selectivity

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| y | 19.5 KiB | 15.5% | file:///G:/programming/stax-xml/packages/stax-xml/dist/projection.js:1:4029 |
| parseStartTag | 18.9 KiB | 15.1% | file:///G:/programming/stax-xml/packages/stax-xml/dist/StreamReaderSync-BFR_N_Sp.js:1:9669 |
| get | 16.5 KiB | 13.1% | (native or anonymous) |
| parseAttributes | 10.8 KiB | 8.6% | file:///G:/programming/stax-xml/packages/stax-xml/dist/StreamReaderSync-BFR_N_Sp.js:1:10436 |
| C | 9.7 KiB | 7.7% | file:///G:/programming/stax-xml/packages/stax-xml/dist/projection.js:1:4821 |
| w | 9.6 KiB | 7.6% | file:///G:/programming/stax-xml/packages/stax-xml/dist/projection.js:1:5008 |
| assertValidName | 6.2 KiB | 4.9% | file:///G:/programming/stax-xml/packages/stax-xml/dist/StreamReaderSync-BFR_N_Sp.js:1:11897 |
| next | 5.8 KiB | 4.6% | (native or anonymous) |

### projection-high-selectivity

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| parseStartTag | 18.5 KiB | 17.7% | file:///G:/programming/stax-xml/packages/stax-xml/dist/StreamReaderSync-BFR_N_Sp.js:1:9669 |
| get | 14.6 KiB | 14.0% | (native or anonymous) |
| parseEndTag | 11.1 KiB | 10.6% | file:///G:/programming/stax-xml/packages/stax-xml/dist/StreamReaderSync-BFR_N_Sp.js:1:8952 |
| decode | 10.3 KiB | 9.9% | node:internal/encoding:482:9 |
| y | 9.5 KiB | 9.2% | file:///G:/programming/stax-xml/packages/stax-xml/dist/projection.js:1:4029 |
| set | 5.7 KiB | 5.5% | (native or anonymous) |
| E | 5.2 KiB | 5.0% | file:///G:/programming/stax-xml/packages/stax-xml/dist/projection.js:1:5454 |
| addEvent | 4.7 KiB | 4.5% | file:///G:/programming/stax-xml/packages/stax-xml/dist/StreamReaderSync-BFR_N_Sp.js:1:13575 |

## Parity

Stream-event status: ok
Stream-event rows: public-accessor, event-reader-object, raw-frame-direct-decode, raw-frame-name-id-cache
Stream-event events: 932199
Stream-event checksum: 765158370
Projection status: ok
Projection rows: projection-low-selectivity, projection-high-selectivity

## Findings

- same-contract-result (TRACE_FACT): All sampled stream-event shapes preserved the same event count and checksum during allocation sampling.
  - public-accessor: events=932199, checksum=765158370
  - event-reader-object: events=932199, checksum=765158370
  - raw-frame-direct-decode: events=932199, checksum=765158370
  - raw-frame-name-id-cache: events=932199, checksum=765158370
- sampled-allocation-shape (TRACE_FACT): HeapProfiler sampled JavaScript allocation bytes per full-string reader shape in this Node/V8 build.
  - public-accessor: sampledBytes=235832, targetFunctionBytes=30032, staxXmlSourceBytes=90944
  - event-reader-object: sampledBytes=74664, targetFunctionBytes=0, staxXmlSourceBytes=22360
  - raw-frame-direct-decode: sampledBytes=60928, targetFunctionBytes=0, staxXmlSourceBytes=46176
  - raw-frame-name-id-cache: sampledBytes=66672, targetFunctionBytes=4464, staxXmlSourceBytes=30272
  - projection-low-selectivity: sampledBytes=128680, targetFunctionBytes=4440, staxXmlSourceBytes=96184
  - projection-high-selectivity: sampledBytes=106824, targetFunctionBytes=0, staxXmlSourceBytes=71576
- projection-cycle-generated-fixture (TRACE_FACT): This run used a projection-shaped generated fixture with repeated /root/book rows, selected attributes/text, and ignored negative-path fields.
  - fixtureBytes=16777181
  - targetBytes=16777216
- projection-selected-field-sampling (TRACE_FACT): Projection rows report projected record counts and selected-field checksums during allocation sampling, not full StAX event parity.
  - projection-low-selectivity: records=506, checksum=-1924876833, sampledBytes=128680
  - projection-high-selectivity: records=49063, checksum=970928115, sampledBytes=106824
- sampling-attribution-limit (TRACE_FACT_LIMIT): Function/source byte attribution is based on sampled self-size frames and can attribute work to native frames instead of the JavaScript caller.
  - A zero source-byte bucket in this report does not mean the reader performed no work or allocated no values.
- allocation-sampling-not-ceiling-proof (TRACE_FACT_LIMIT): This is statistical allocation evidence for one runtime/build/input, not a proof that JavaScript runtimes have no further headroom.
  - Need larger fixtures, browser/Bun/JSC runs, and deeper source/asm evidence before promoting runtime-limit claims.
