# Browser Candidate Headroom Cross-Process Stability

Generated: 2026-05-24T06:40:14.984Z

This report repeats Firefox TextDecoder span rows in fresh Firefox browser processes.
It is browser-runtime timing evidence for the recorded machine, not proof that JavaScript runtimes have no further headroom.
All selected rows preserve full-string StAX parity; no projection rows are included.
Firefox does not expose Chromium performance.memory, so variant JS heap is unavailable. Host process-tree memory is summarized separately and must not be mixed with Node/Bun RSS rows as the same memory proof.

## Options

- Process runs: 3
- Harness: firefox-bidi-textdecoder
- Child warmups: 0
- Fixture shape: corpus-cycle
- Size GiB: 1
- Diverse cycle size: 4096
- Batch size: 1
- Bounded JS heap gate: 512.0 MiB
- Cases: subarraySharedDecoder, viewSharedDecoder, sliceCopySharedDecoder, subarrayNewDecoder, shortAsciiSubarraySharedDecoder
- Browser executable: C:\Program Files\Mozilla Firefox\firefox.exe

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\firefox-bidi-textdecoder-span-corpus-release
- Committed: no

## Environment

- Browser: Firefox 143.0
- Engine: SpiderMonkey
- Platform: Win32
- Host platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- User agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0

## Fixture

- Source: corpus-file
- Shape: corpus-cycle
- Actual bytes: 1074787404
- Size GiB: 1.0009737722575665
- Row cycle size: 1

## Results

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded JS heap all | Counterexample | Max JS heap |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| subarraySharedDecoder | stream-events | 49.44 MiB/s | 48.89 MiB/s | 50.47 MiB/s | 3.2% | 50.47, 48.96, 48.89 | yes | no | not-found | n/a |
| viewSharedDecoder | stream-events | 49.25 MiB/s | 48.65 MiB/s | 49.95 MiB/s | 2.6% | 49.95, 48.65, 49.16 | yes | no | not-found | n/a |
| sliceCopySharedDecoder | stream-events | 41.80 MiB/s | 41.58 MiB/s | 42.23 MiB/s | 1.5% | 42.23, 41.58, 41.60 | yes | no | not-found | n/a |
| subarrayNewDecoder | stream-events | 25.91 MiB/s | 25.87 MiB/s | 25.96 MiB/s | 0.3% | 25.87, 25.96, 25.91 | yes | no | not-found | n/a |
| shortAsciiSubarraySharedDecoder | stream-events | 69.09 MiB/s | 68.11 MiB/s | 69.98 MiB/s | 2.7% | 69.16, 68.11, 69.98 | yes | no | not-found | n/a |

## Parity

- Stream/full rows stable across processes: yes
- Stream/full rows: subarraySharedDecoder, viewSharedDecoder, sliceCopySharedDecoder, subarrayNewDecoder, shortAsciiSubarraySharedDecoder
- Projection rows stable across processes: yes
- Projection rows: n/a

## Host Process Memory

Host process-tree memory is inherited from each child report and is process-level browser memory, not a portable per-variant JS heap measurement.

- Scope: windows-process-tree
- Max working set: 9.19 GiB
- Max private bytes: 9.20 GiB
- Max process count: 12

| Browser run | Scope | Max working set | Max private bytes | Max process count |
| ---: | --- | ---: | ---: | ---: |
| 1 | windows-process-tree | 8.95 GiB | 8.96 GiB | 12 |
| 2 | windows-process-tree | 9.19 GiB | 9.20 GiB | 12 |
| 3 | windows-process-tree | 9.04 GiB | 9.05 GiB | 12 |

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
