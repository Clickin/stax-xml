# V8 Allocation Sampling

Generated: 2026-05-23T09:25:00.555Z

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
| public-accessor | 151.82 ms | 967967 | -746772258 | 273.5 KiB | 16 | 0 B | 119.2 KiB |
| raw-frame-direct-decode | 141.31 ms | 967967 | -746772258 | 50.4 KiB | 3 | 0 B | 16.3 KiB |
| raw-frame-name-id-cache | 126.03 ms | 967967 | -746772258 | 71.2 KiB | 4 | 0 B | 51.3 KiB |

## Top Frames

### public-accessor

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| parseEndTag | 52.5 KiB | 19.2% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:9073 |
| C | 50.7 KiB | 18.5% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:19148 |
| fromCharCode | 33.4 KiB | 12.2% | (native or anonymous) |
| compileForInternalLoader | 32.2 KiB | 11.8% | node:internal/bootstrap/realm:383:27 |
| post | 24.4 KiB | 8.9% | node:inspector:115:7 |
| compileForInternalLoader | 16.1 KiB | 5.9% | node:internal/bootstrap/realm:383:27 |
| isInteger | 16.1 KiB | 5.9% | (native or anonymous) |
| Map | 16.0 KiB | 5.9% | (native or anonymous) |

### raw-frame-direct-decode

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| set | 17.9 KiB | 35.4% | (native or anonymous) |
| p | 16.3 KiB | 32.4% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:15738 |
| post | 16.2 KiB | 32.2% | node:inspector:115:7 |

### raw-frame-name-id-cache

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| b | 34.4 KiB | 48.4% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:18698 |
| imul | 19.9 KiB | 27.9% | (native or anonymous) |
| lookupNameId | 16.9 KiB | 23.7% | file:///G:/programming/stax-xml/packages/stax-xml/dist/index.js:1:13597 |

## Parity

Status: ok
Events: 967967
Checksum: -746772258

## Findings

- same-contract-result (TRACE_FACT): All sampled shapes preserved the same event count and checksum during allocation sampling.
  - public-accessor: events=967967, checksum=-746772258
  - raw-frame-direct-decode: events=967967, checksum=-746772258
  - raw-frame-name-id-cache: events=967967, checksum=-746772258
- sampled-allocation-shape (TRACE_FACT): HeapProfiler sampled JavaScript allocation bytes per monomorphic shape in this Node/V8 build.
  - public-accessor: sampledBytes=280080, targetFunctionBytes=0, staxXmlSourceBytes=122024
  - raw-frame-direct-decode: sampledBytes=51592, targetFunctionBytes=0, staxXmlSourceBytes=16704
  - raw-frame-name-id-cache: sampledBytes=72912, targetFunctionBytes=0, staxXmlSourceBytes=52560
- allocation-sampling-not-ceiling-proof (TRACE_FACT_LIMIT): This is statistical allocation evidence for one runtime/build/input, not a proof that JavaScript runtimes have no further headroom.
  - Need larger fixtures, browser/Bun/JSC runs, and deeper source/asm evidence before promoting runtime-limit claims.
