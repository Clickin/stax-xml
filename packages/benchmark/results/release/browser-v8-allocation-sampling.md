# Browser V8 Allocation Sampling

Generated: 2026-05-23T21:23:40.687Z

This report is a TRACE_FACT for one browser/V8 build and one byte-batch fixture.
It uses CDP `HeapProfiler.startSampling` / `HeapProfiler.stopSampling` around same-contract browser reader variants.
It is not a proof that JavaScript runtimes have no further headroom.

## Environment

- Browser: Chrome 148.0.0.0
- JavaScript engine: V8
- User agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36
- CDP V8 version: 14.8.178.22
- Host Node: v24.15.0
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture shape: diverse-cycle
- Fixture size: 16.0 MiB (16777217 bytes)
- Sampling interval: 8192 bytes

## Results

| Variant | Throughput | Events | Checksum | Sampled bytes | Samples | Top function | Max browser JS heap |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| stringFull | 67.61 MiB/s | 706,158 | 1039217453 | 119.8 KiB | 14 | countStringField | 14.9 MiB |
| eventObjectFull | 51.44 MiB/s | 706,158 | 1039217453 | 41.7 KiB | 5 | trim | 17.8 MiB |
| rawFrameNameId | 65.85 MiB/s | 706,158 | 1039217453 | 73.0 KiB | 7 | imul | 16.4 MiB |

## Top Functions

### stringFull

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| countStringField | 36.4 KiB | 30.4% | http://127.0.0.1:54047/runner.js:463:26 |
| addText | 17.9 KiB | 14.9% | http://127.0.0.1:54047/stax/index.js:1:11727 |
| trim | 9.0 KiB | 7.5% | (native or anonymous) |
| imul | 8.3 KiB | 6.9% | (native or anonymous) |
| y | 8.1 KiB | 6.7% | http://127.0.0.1:54047/stax/index.js:1:17005 |
| filter | 8.1 KiB | 6.7% | (native or anonymous) |
| typeAt | 8.0 KiB | 6.7% | http://127.0.0.1:54047/stax/index.js:1:27397 |
| run | 8.0 KiB | 6.7% | http://127.0.0.1:54047/runner.js:68:12 |

### eventObjectFull

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| trim | 17.2 KiB | 41.2% | (native or anonymous) |
| get byteLength | 8.4 KiB | 20.2% | (native or anonymous) |
| run | 8.0 KiB | 19.3% | http://127.0.0.1:54047/runner.js:76:12 |
| publicEventTypeCode | 8.0 KiB | 19.2% | http://127.0.0.1:54047/runner.js:291:29 |

### rawFrameNameId

| Function | Self size | Percent | Source |
| --- | ---: | ---: | --- |
| imul | 30.0 KiB | 41.2% | (native or anonymous) |
| countStringField | 24.2 KiB | 33.2% | http://127.0.0.1:54047/runner.js:463:26 |
| trim | 18.7 KiB | 25.7% | (native or anonymous) |

## Memory Scope

Per-variant memory values use browser JS heap snapshots from `performance.memory`; they are not host process RSS.

## Parity

- Event-count parity: ok, events=706158, rows=stringFull, eventObjectFull, rawFrameNameId
- Full-string parity: ok, events=706158, checksum=1039217453, rows=stringFull, eventObjectFull, rawFrameNameId

## Findings

- same-contract-result (TRACE_FACT): All sampled browser full-materialization variants preserved the same event count and checksum.
  - stringFull: events=706158, checksum=1039217453
  - eventObjectFull: events=706158, checksum=1039217453
  - rawFrameNameId: events=706158, checksum=1039217453
- browser-allocation-sampling (TRACE_FACT): Chrome/Edge CDP HeapProfiler sampled JavaScript allocation self-size around each browser variant.
  - stringFull: sampledBytes=122724, samples=14
  - eventObjectFull: sampledBytes=42672, samples=5
  - rawFrameNameId: sampledBytes=74712, samples=7
- browser-memory-scope (TRACE_FACT_LIMIT): Per-variant memory values are browser JS heap snapshots, not host process RSS or full browser process private bytes.
  - stringFull: maxJsHeapUsedBytes=15591206
  - eventObjectFull: maxJsHeapUsedBytes=18679192
  - rawFrameNameId: maxJsHeapUsedBytes=17226023
- browser-allocation-sampling-not-ceiling-proof (TRACE_FACT_LIMIT): This report narrows the Chrome/V8 browser allocation-attribution gap, but it does not prove that JavaScript runtimes have no further headroom.
  - fixture=diverse-cycle, bytes=16777217
  - Need non-V8 browser allocation/codegen evidence, broader fixtures, and source-level runtime proof before promoting runtime-limit claims.
