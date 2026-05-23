# V8 Allocation Sampling

Generated: 2026-05-23T09:36:02.229Z

This report is a TRACE_FACT for one Node/V8 build and one fixture.
It uses inspector `HeapProfiler.startSampling` / `HeapProfiler.stopSampling` around each full-string reader shape.
It is not a proof that JavaScript runtimes have no further headroom.

## Environment

- Node: v24.15.0
- V8: 13.6.233.17-node.48
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: file (G:\programming\stax-xml\packages\benchmark\test-data\runtime-comparison-16mib.xml)
- Fixture size: 16.0 MiB (16777038 bytes)
- Runs: warmups=1, iterations=2
- Sampling interval: 16384 bytes

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\v8-allocation\monomorphic-release
- Committed: no

## Results

| Case | Avg time | Events | Checksum | Sampled bytes | Samples | Target function bytes | stax-xml source bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| public-accessor | 157.11 ms | 967967 | -746772258 | 219.5 KiB | 13 | 16.3 KiB | 114.6 KiB |
| event-reader-object | 189.11 ms | 967967 | -746772258 | 39.6 KiB | 2 | 0 B | 39.6 KiB |
| raw-frame-direct-decode | 139.52 ms | 967967 | -746772258 | 123.7 KiB | 7 | 0 B | 89.8 KiB |
| raw-frame-name-id-cache | 129.65 ms | 967967 | -746772258 | 137.5 KiB | 8 | 0 B | 103.6 KiB |

## Top Frames

### public-accessor

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| post | 40.7 KiB | 18.5% | node:inspector:115:7 |
| l | 32.1 KiB | 14.6% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:15457 |
| internName | 17.5 KiB | 8.0% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:13268 |
| ensureElementCapacity | 16.3 KiB | 7.4% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:14945 |
| materializeName | 16.3 KiB | 7.4% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:13442 |
| parseStartTag | 16.3 KiB | 7.4% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:9790 |
| isInteger | 16.1 KiB | 7.3% | (native or anonymous) |
| (anonymous) | 16.1 KiB | 7.3% | node:internal/perf/timerify:1:1 |

### event-reader-object

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| parseNextEvent | 39.6 KiB | 100.0% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:35818 |

### raw-frame-direct-decode

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| parseStartTag | 51.1 KiB | 41.3% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:9790 |
| addAttribute | 38.7 KiB | 31.3% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:14002 |
| set | 17.6 KiB | 14.2% | (native or anonymous) |
| get byteLength | 16.3 KiB | 13.2% | (native or anonymous) |

### raw-frame-name-id-cache

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| p | 49.3 KiB | 35.9% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:15738 |
| addEvent | 19.1 KiB | 13.9% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:13698 |
| addAttribute | 18.9 KiB | 13.8% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:14002 |
| set | 17.9 KiB | 13.0% | (native or anonymous) |
| parseProcessingInstruction | 16.3 KiB | 11.8% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:8473 |
| set | 16.1 KiB | 11.7% | (native or anonymous) |

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
  - public-accessor: sampledBytes=224768, targetFunctionBytes=16704, staxXmlSourceBytes=117344
  - event-reader-object: sampledBytes=40528, targetFunctionBytes=0, staxXmlSourceBytes=40528
  - raw-frame-direct-decode: sampledBytes=126648, targetFunctionBytes=0, staxXmlSourceBytes=91944
  - raw-frame-name-id-cache: sampledBytes=140808, targetFunctionBytes=0, staxXmlSourceBytes=106048
- sampling-attribution-limit (TRACE_FACT_LIMIT): Function/source byte attribution is based on sampled self-size frames and can attribute work to native frames instead of the JavaScript caller.
  - A zero source-byte bucket in this report does not mean the reader performed no work or allocated no values.
- allocation-sampling-not-ceiling-proof (TRACE_FACT_LIMIT): This is statistical allocation evidence for one runtime/build/input, not a proof that JavaScript runtimes have no further headroom.
  - Need larger fixtures, browser/Bun/JSC runs, and deeper source/asm evidence before promoting runtime-limit claims.
