# V8 Allocation Sampling

Generated: 2026-05-24T17:38:02.177Z

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
- Fixture: generated
- Fixture shape: diverse
- Fixture size: 16.0 MiB (16776986 bytes)
- Runs: warmups=1, iterations=2
- Sampling interval: 8192 bytes

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\v8-allocation\deno-v8-allocation-release
- Committed: no

## Results

| Case | Count kind | Avg time | Events | Checksum | Sampled bytes | Samples | Target function bytes | stax-xml source bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| public-accessor | stream-events | 213.72 ms | 662215 | -2075823699 | 34.9 KiB | 4 | 0 B | 34.9 KiB |
| event-reader-object | stream-events | 281.82 ms | 662215 | -2075823699 | 48.2 KiB | 5 | 0 B | 16.2 KiB |
| raw-frame-direct-decode | stream-events | 214.77 ms | 662215 | -2075823699 | 0 B | 0 | 0 B | 0 B |
| raw-frame-name-id-cache | stream-events | 196.18 ms | 662215 | -2075823699 | 16.2 KiB | 2 | 8.0 KiB | 8.0 KiB |

## Top Frames

### public-accessor

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| attributeCountAt | 17.6 KiB | 50.5% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:30834 |
| parseStartTag | 9.0 KiB | 25.8% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:9791 |
| p | 8.3 KiB | 23.7% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:15742 |

### event-reader-object

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| indexOf | 18.8 KiB | 38.9% | (native or anonymous) |
| get | 13.3 KiB | 27.5% | (native or anonymous) |
| isWhitespace | 8.2 KiB | 17.0% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:38786 |
| parseNextEvent | 8.0 KiB | 16.6% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:34631 |

### raw-frame-direct-decode

- No sampled allocation frames.

### raw-frame-name-id-cache

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| trim | 8.2 KiB | 50.5% | (native or anonymous) |
| materializeName | 8.0 KiB | 49.5% | file:///G:/programming/stax-xml/packages/benchmark/v8-allocation-sampling.mjs:881:25 |

## Parity

Stream-event status: ok
Stream-event rows: public-accessor, event-reader-object, raw-frame-direct-decode, raw-frame-name-id-cache
Stream-event events: 662215
Stream-event checksum: -2075823699
Projection status: not-applicable
Projection rows: n/a

## Findings

- same-contract-result (TRACE_FACT): All sampled stream-event shapes preserved the same event count and checksum during allocation sampling.
  - public-accessor: events=662215, checksum=-2075823699
  - event-reader-object: events=662215, checksum=-2075823699
  - raw-frame-direct-decode: events=662215, checksum=-2075823699
  - raw-frame-name-id-cache: events=662215, checksum=-2075823699
- sampled-allocation-shape (TRACE_FACT): HeapProfiler sampled JavaScript allocation bytes per full-string reader shape in this Deno/V8 build.
  - public-accessor: sampledBytes=35696, targetFunctionBytes=0, staxXmlSourceBytes=35696
  - event-reader-object: sampledBytes=49384, targetFunctionBytes=0, staxXmlSourceBytes=16608
  - raw-frame-direct-decode: sampledBytes=0, targetFunctionBytes=0, staxXmlSourceBytes=0
  - raw-frame-name-id-cache: sampledBytes=16568, targetFunctionBytes=8208, staxXmlSourceBytes=8208
- less-repetitive-generated-fixture (TRACE_FACT): This run used a less-repetitive generated fixture with varied names, attributes, and text values to reduce single-pattern sampling bias.
  - fixtureBytes=16776986
  - targetBytes=16777216
- sampling-attribution-limit (TRACE_FACT_LIMIT): Function/source byte attribution is based on sampled self-size frames and can attribute work to native frames instead of the JavaScript caller.
  - A zero source-byte bucket in this report does not mean the reader performed no work or allocated no values.
- allocation-sampling-not-ceiling-proof (TRACE_FACT_LIMIT): This is statistical allocation evidence for one runtime/build/input, not a proof that JavaScript runtimes have no further headroom.
  - Need larger fixtures, browser/Bun/JSC runs, and deeper source/asm evidence before promoting runtime-limit claims.
