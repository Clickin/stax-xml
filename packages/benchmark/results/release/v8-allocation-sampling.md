# V8 Allocation Sampling

Generated: 2026-05-23T09:59:26.516Z

This report is a TRACE_FACT for one Node/V8 build and one fixture.
It uses inspector `HeapProfiler.startSampling` / `HeapProfiler.stopSampling` around each full-string reader shape.
It is not a proof that JavaScript runtimes have no further headroom.

## Environment

- Node: v24.15.0
- V8: 13.6.233.17-node.48
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: file (G:\programming\stax-xml\packages\benchmark\test-data\runtime-comparison-16mib.xml)
- Fixture shape: runtime-comparison
- Fixture size: 16.0 MiB (16777038 bytes)
- Runs: warmups=1, iterations=4
- Sampling interval: 2048 bytes

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\v8-allocation\monomorphic-release
- Committed: no

## Results

| Case | Avg time | Events | Checksum | Sampled bytes | Samples | Target function bytes | stax-xml source bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| public-accessor | 178.39 ms | 967967 | -746772258 | 238.4 KiB | 88 | 18.4 KiB | 74.3 KiB |
| event-reader-object | 308.13 ms | 967967 | -746772258 | 79.3 KiB | 25 | 0 B | 65.1 KiB |
| raw-frame-direct-decode | 196.55 ms | 967967 | -746772258 | 81.5 KiB | 27 | 2.0 KiB | 49.1 KiB |
| raw-frame-name-id-cache | 159.46 ms | 967967 | -746772258 | 97.4 KiB | 31 | 2.3 KiB | 55.6 KiB |

## Top Frames

### public-accessor

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| post | 47.4 KiB | 19.9% | node:inspector:115:7 |
| parseEndTag | 18.9 KiB | 7.9% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:9073 |
| materializeName | 15.6 KiB | 6.6% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:13442 |
| get | 14.2 KiB | 6.0% | (native or anonymous) |
| compileForInternalLoader | 12.3 KiB | 5.2% | node:internal/bootstrap/realm:383:27 |
| compileForInternalLoader | 12.2 KiB | 5.1% | node:internal/bootstrap/realm:383:27 |
| parseStartTag | 11.4 KiB | 4.8% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:9790 |
| trim | 9.1 KiB | 3.8% | (native or anonymous) |

### event-reader-object

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| parseNextEvent | 21.3 KiB | 26.8% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:35818 |
| parseEndTag | 14.7 KiB | 18.6% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:36599 |
| publicEventTypeCode | 13.6 KiB | 17.1% | file:///G:/programming/stax-xml/packages/benchmark/v8-allocation-sampling.mjs:628:29 |
| get | 9.4 KiB | 11.8% | (native or anonymous) |
| (anonymous) | 7.1 KiB | 9.0% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:41042 |
| nextEvent | 4.3 KiB | 5.4% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:45626 |
| trim | 2.6 KiB | 3.3% | (native or anonymous) |
| charCodeAt | 2.1 KiB | 2.7% | (native or anonymous) |

### raw-frame-direct-decode

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| p | 16.4 KiB | 20.2% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:15738 |
| set | 12.3 KiB | 15.1% | (native or anonymous) |
| parseStartTag | 11.2 KiB | 13.7% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:9790 |
| get | 8.1 KiB | 10.0% | (native or anonymous) |
| assertValidCharacterData | 6.2 KiB | 7.6% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:12416 |
| get byteLength | 5.0 KiB | 6.2% | (native or anonymous) |
| (anonymous) | 2.8 KiB | 3.5% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:841 |
| trim | 2.5 KiB | 3.1% | (native or anonymous) |

### raw-frame-name-id-cache

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| ensureElementCapacity | 17.2 KiB | 17.7% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:14945 |
| parseEndTag | 16.2 KiB | 16.6% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:9073 |
| get | 14.8 KiB | 15.2% | (native or anonymous) |
| p | 11.8 KiB | 12.1% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:15738 |
| get byteLength | 11.8 KiB | 12.1% | (native or anonymous) |
| get | 10.7 KiB | 11.0% | (native or anonymous) |
| trim | 4.5 KiB | 4.6% | (native or anonymous) |
| decodeSpan | 2.3 KiB | 2.3% | file:///G:/programming/stax-xml/packages/benchmark/v8-allocation-sampling.mjs:750:20 |

## Parity

Status: ok
Events: 967967
Checksum: -746772258

## Findings

- same-contract-result (TRACE_FACT): All sampled shapes preserved the same event count and checksum during allocation sampling.
  - public-accessor: events=967967, checksum=-746772258
  - event-reader-object: events=967967, checksum=-746772258
  - raw-frame-direct-decode: events=967967, checksum=-746772258
  - raw-frame-name-id-cache: events=967967, checksum=-746772258
- sampled-allocation-shape (TRACE_FACT): HeapProfiler sampled JavaScript allocation bytes per full-string reader shape in this Node/V8 build.
  - public-accessor: sampledBytes=244144, targetFunctionBytes=18824, staxXmlSourceBytes=76064
  - event-reader-object: sampledBytes=81152, targetFunctionBytes=0, staxXmlSourceBytes=66688
  - raw-frame-direct-decode: sampledBytes=83464, targetFunctionBytes=2064, staxXmlSourceBytes=50248
  - raw-frame-name-id-cache: sampledBytes=99696, targetFunctionBytes=2304, staxXmlSourceBytes=56960
- sampling-attribution-limit (TRACE_FACT_LIMIT): Function/source byte attribution is based on sampled self-size frames and can attribute work to native frames instead of the JavaScript caller.
  - A zero source-byte bucket in this report does not mean the reader performed no work or allocated no values.
- allocation-sampling-not-ceiling-proof (TRACE_FACT_LIMIT): This is statistical allocation evidence for one runtime/build/input, not a proof that JavaScript runtimes have no further headroom.
  - Need larger fixtures, browser/Bun/JSC runs, and deeper source/asm evidence before promoting runtime-limit claims.
