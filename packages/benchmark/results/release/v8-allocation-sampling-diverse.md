# V8 Allocation Sampling

Generated: 2026-05-23T09:56:05.953Z

This report is a TRACE_FACT for one Node/V8 build and one fixture.
It uses inspector `HeapProfiler.startSampling` / `HeapProfiler.stopSampling` around each full-string reader shape.
It is not a proof that JavaScript runtimes have no further headroom.

## Environment

- Node: v24.15.0
- V8: 13.6.233.17-node.48
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: generated
- Fixture shape: diverse
- Fixture size: 16.0 MiB (16776986 bytes)
- Runs: warmups=1, iterations=4
- Sampling interval: 2048 bytes

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\v8-allocation\diverse-release
- Committed: no

## Results

| Case | Avg time | Events | Checksum | Sampled bytes | Samples | Target function bytes | stax-xml source bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| public-accessor | 222.81 ms | 662215 | -2075823699 | 248.3 KiB | 94 | 11.3 KiB | 61.0 KiB |
| event-reader-object | 417.58 ms | 662215 | -2075823699 | 71.6 KiB | 21 | 0 B | 16.5 KiB |
| raw-frame-direct-decode | 244.60 ms | 662215 | -2075823699 | 68.2 KiB | 22 | 2.1 KiB | 49.8 KiB |
| raw-frame-name-id-cache | 211.86 ms | 662215 | -2075823699 | 76.0 KiB | 23 | 7.9 KiB | 46.6 KiB |

## Top Frames

### public-accessor

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| post | 52.7 KiB | 21.2% | node:inspector:115:7 |
| compileForInternalLoader | 30.3 KiB | 12.2% | node:internal/bootstrap/realm:383:27 |
| set | 16.8 KiB | 6.8% | (native or anonymous) |
| p | 16.7 KiB | 6.7% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:15738 |
| addEvent | 14.2 KiB | 5.7% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:13698 |
| (anonymous) | 10.6 KiB | 4.3% | node:internal/perf/observe:1:1 |
| compileForInternalLoader | 10.5 KiB | 4.2% | node:internal/bootstrap/realm:383:27 |
| foldString | 9.0 KiB | 3.6% | file:///G:/programming/stax-xml/packages/benchmark/v8-allocation-sampling.mjs:896:20 |

### event-reader-object

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| indexOf | 27.5 KiB | 38.4% | (native or anonymous) |
| trim | 16.9 KiB | 23.6% | (native or anonymous) |
| publicEventTypeCode | 10.2 KiB | 14.2% | file:///G:/programming/stax-xml/packages/benchmark/v8-allocation-sampling.mjs:628:29 |
| charCodeAt | 4.2 KiB | 5.8% | (native or anonymous) |
| charCodeAt | 2.4 KiB | 3.4% | (native or anonymous) |
| parseNextEvent | 2.1 KiB | 2.9% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:35818 |
| createCharactersEvent | 2.1 KiB | 2.9% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:39474 |
| parseNextEvent | 2.1 KiB | 2.9% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:35818 |

### raw-frame-direct-decode

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| assertValidName | 16.4 KiB | 24.1% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:12019 |
| get byteLength | 14.4 KiB | 21.1% | (native or anonymous) |
| p | 11.7 KiB | 17.2% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:15738 |
| ensureElementCapacity | 6.2 KiB | 9.1% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:14945 |
| parseAttributes | 6.0 KiB | 8.8% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:10558 |
| TextDecoder | 4.0 KiB | 5.9% | node:internal/encoding:431:14 |
| (anonymous) | 2.8 KiB | 4.2% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:841 |
| finish | 2.3 KiB | 3.3% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:6533 |

### raw-frame-name-id-cache

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| get | 25.2 KiB | 33.2% | (native or anonymous) |
| addEvent | 16.2 KiB | 21.3% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:13698 |
| re | 13.3 KiB | 17.5% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:19476 |
| decodeSpan | 7.9 KiB | 10.4% | file:///G:/programming/stax-xml/packages/benchmark/v8-allocation-sampling.mjs:750:20 |
| ensureElementCapacity | 7.2 KiB | 9.4% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:14945 |
| delete | 2.1 KiB | 2.7% | (native or anonymous) |
| push | 2.1 KiB | 2.7% | (native or anonymous) |
| parseEndTag | 2.0 KiB | 2.7% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:9073 |

## Parity

Status: ok
Events: 662215
Checksum: -2075823699

## Findings

- same-contract-result (TRACE_FACT): All sampled shapes preserved the same event count and checksum during allocation sampling.
  - public-accessor: events=662215, checksum=-2075823699
  - event-reader-object: events=662215, checksum=-2075823699
  - raw-frame-direct-decode: events=662215, checksum=-2075823699
  - raw-frame-name-id-cache: events=662215, checksum=-2075823699
- sampled-allocation-shape (TRACE_FACT): HeapProfiler sampled JavaScript allocation bytes per full-string reader shape in this Node/V8 build.
  - public-accessor: sampledBytes=254272, targetFunctionBytes=11552, staxXmlSourceBytes=62456
  - event-reader-object: sampledBytes=73304, targetFunctionBytes=0, staxXmlSourceBytes=16856
  - raw-frame-direct-decode: sampledBytes=69824, targetFunctionBytes=2160, staxXmlSourceBytes=50952
  - raw-frame-name-id-cache: sampledBytes=77784, targetFunctionBytes=8104, staxXmlSourceBytes=47728
- less-repetitive-generated-fixture (TRACE_FACT): This run used a less-repetitive generated fixture with varied names, attributes, and text values to reduce single-pattern sampling bias.
  - fixtureBytes=16776986
  - targetBytes=16777216
- sampling-attribution-limit (TRACE_FACT_LIMIT): Function/source byte attribution is based on sampled self-size frames and can attribute work to native frames instead of the JavaScript caller.
  - A zero source-byte bucket in this report does not mean the reader performed no work or allocated no values.
- allocation-sampling-not-ceiling-proof (TRACE_FACT_LIMIT): This is statistical allocation evidence for one runtime/build/input, not a proof that JavaScript runtimes have no further headroom.
  - Need larger fixtures, browser/Bun/JSC runs, and deeper source/asm evidence before promoting runtime-limit claims.
