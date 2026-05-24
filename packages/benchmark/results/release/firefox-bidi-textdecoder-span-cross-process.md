# Browser Candidate Headroom Cross-Process Stability

Generated: 2026-05-24T06:19:27.426Z

This report repeats Firefox TextDecoder span rows in fresh Firefox browser processes.
It is browser-runtime timing evidence for the recorded machine, not proof that JavaScript runtimes have no further headroom.
All selected rows preserve full-string StAX parity; no projection rows are included.
Firefox does not expose Chromium performance.memory, so variant JS heap is unavailable. Host process-tree memory is summarized separately and must not be mixed with Node/Bun RSS rows as the same memory proof.

## Options

- Process runs: 3
- Harness: firefox-bidi-textdecoder
- Child warmups: 0
- Fixture shape: diverse-cycle
- Size GiB: 1
- Diverse cycle size: 4096
- Batch size: 16
- Bounded JS heap gate: 512.0 MiB
- Cases: subarraySharedDecoder, viewSharedDecoder, sliceCopySharedDecoder, subarrayNewDecoder, shortAsciiSubarraySharedDecoder
- Browser executable: C:\Program Files\Mozilla Firefox\firefox.exe

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\firefox-bidi-textdecoder-span-release
- Committed: no

## Environment

- Browser: Firefox 143.0
- Engine: SpiderMonkey
- Platform: Win32
- Host platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- User agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0

## Fixture

- Source: generated
- Shape: diverse-cycle
- Actual bytes: 1073742038
- Size GiB: 1.000000199303031
- Row cycle size: 4096

## Results

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded JS heap all | Counterexample | Max JS heap |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| subarraySharedDecoder | stream-events | 34.81 MiB/s | 34.63 MiB/s | 35.13 MiB/s | 1.4% | 35.13, 34.63, 34.67 | yes | no | not-found | n/a |
| viewSharedDecoder | stream-events | 34.43 MiB/s | 34.21 MiB/s | 34.72 MiB/s | 1.5% | 34.72, 34.21, 34.36 | yes | no | not-found | n/a |
| sliceCopySharedDecoder | stream-events | 29.55 MiB/s | 29.38 MiB/s | 29.90 MiB/s | 1.8% | 29.90, 29.38, 29.38 | yes | no | not-found | n/a |
| subarrayNewDecoder | stream-events | 18.57 MiB/s | 18.45 MiB/s | 18.64 MiB/s | 1.0% | 18.64, 18.62, 18.45 | yes | no | not-found | n/a |
| shortAsciiSubarraySharedDecoder | stream-events | 49.96 MiB/s | 49.76 MiB/s | 50.24 MiB/s | 0.9% | 50.24, 49.76, 49.88 | yes | no | not-found | n/a |

## Parity

- Stream/full rows stable across processes: yes
- Stream/full rows: subarraySharedDecoder, viewSharedDecoder, sliceCopySharedDecoder, subarrayNewDecoder, shortAsciiSubarraySharedDecoder
- Projection rows stable across processes: yes
- Projection rows: n/a

## Host Process Memory

Host process-tree memory is inherited from each child report and is process-level browser memory, not a portable per-variant JS heap measurement.

- Scope: windows-process-tree
- Max working set: 1020.3 MiB
- Max private bytes: 849.7 MiB
- Max process count: 12

| Browser run | Scope | Max working set | Max private bytes | Max process count |
| ---: | --- | ---: | ---: | ---: |
| 1 | windows-process-tree | 1020.3 MiB | 849.7 MiB | 12 |
| 2 | windows-process-tree | 1013.5 MiB | 845.2 MiB | 12 |
| 3 | windows-process-tree | 1011.6 MiB | 841.7 MiB | 12 |

## Findings

- independent-browser-process-rerun (BENCH_FACT): Each sample launched a fresh browser process through the firefox-bidi-textdecoder harness.
  - processRuns=3
  - browser=Firefox 143.0
- browser-memory-scope (BENCH_FACT): Firefox does not expose Chromium performance.memory, so variant JS heap is unavailable. Host process-tree memory is reported separately and is not mixed with Node/Bun RSS evidence.
  - subarraySharedDecoder: maxJsHeap=n/a
  - viewSharedDecoder: maxJsHeap=n/a
  - sliceCopySharedDecoder: maxJsHeap=n/a
  - subarrayNewDecoder: maxJsHeap=n/a
  - shortAsciiSubarraySharedDecoder: maxJsHeap=n/a
- projection-contract-separated (BENCH_FACT): No projection rows were selected; all reported variants are full-string StAX parity rows.
  - projection rows not selected
- full-stax-counterexample-search (BENCH_FACT): No full-string row reported a 200 MiB/s bounded-memory browser counterexample in these fresh process samples.
  - counterexample=not-found
- browser-v8-scope (BENCH_FACT): This report is browser evidence for the recorded Firefox/SpiderMonkey build only; it is not Chromium/V8, Safari/JSC, codegen, or allocation evidence.
  - engine=SpiderMonkey
  - userAgent=Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0
