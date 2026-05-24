# Browser Candidate Headroom Cross-Process Stability

Generated: 2026-05-24T08:31:23.804Z

This report repeats selected browser candidate-headroom rows in fresh browser processes.
It is browser-runtime timing evidence for the recorded machine, not proof that JavaScript runtimes have no further headroom.
All selected rows preserve full-string StAX parity; no projection rows are included.
Firefox does not expose Chromium performance.memory, so variant JS heap is unavailable. Host process-tree memory is summarized separately and must not be mixed with Node/Bun RSS rows as the same memory proof.

## Options

- Process runs: 3
- Harness: firefox-bidi
- Child warmups: 0
- Fixture shape: corpus-cycle
- Size GiB: 1
- Diverse cycle size: 4096
- Batch size: 1
- Bounded JS heap gate: 512.0 MiB
- Cases: stringFull, eventObjectFull, rawFrameNameId
- Browser executable: C:\Program Files\Mozilla Firefox\firefox.exe

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\firefox-bidi-candidate-headroom-books-corpus-release
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
- Actual bytes: 1073744736
- Size GiB: 1.0000027120113373
- Row cycle size: 1

## Results

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded JS heap all | Counterexample | Max JS heap |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| stringFull | stream-events | 62.55 MiB/s | 56.25 MiB/s | 72.41 MiB/s | 25.8% | 59.00, 56.25, 72.41 | yes | no | not-found | n/a |
| eventObjectFull | stream-events | 49.85 MiB/s | 44.73 MiB/s | 58.97 MiB/s | 28.6% | 45.85, 44.73, 58.97 | yes | no | not-found | n/a |
| rawFrameNameId | stream-events | 63.53 MiB/s | 55.52 MiB/s | 76.90 MiB/s | 33.7% | 58.16, 55.52, 76.90 | yes | no | not-found | n/a |

## Parity

- Stream/full rows stable across processes: yes
- Stream/full rows: stringFull, eventObjectFull, rawFrameNameId
- Projection rows stable across processes: yes
- Projection rows: n/a

## Host Process Memory

Host process-tree memory is inherited from each child report and is process-level browser memory, not a portable per-variant JS heap measurement.

- Scope: windows-process-tree
- Max working set: 839.8 MiB
- Max private bytes: 678.3 MiB
- Max process count: 12

| Browser run | Scope | Max working set | Max private bytes | Max process count |
| ---: | --- | ---: | ---: | ---: |
| 1 | windows-process-tree | 839.8 MiB | 678.3 MiB | 12 |
| 2 | windows-process-tree | 809.5 MiB | 646.3 MiB | 12 |
| 3 | windows-process-tree | 806.8 MiB | 650.2 MiB | 12 |

## Findings

- independent-browser-process-rerun (BENCH_FACT): Each sample launched a fresh browser process through the firefox-bidi harness.
  - processRuns=3
  - browser=Firefox 143.0
- browser-memory-scope (BENCH_FACT): Firefox does not expose Chromium performance.memory, so variant JS heap is unavailable. Host process-tree memory is reported separately and is not mixed with Node/Bun RSS evidence.
  - stringFull: maxJsHeap=n/a
  - eventObjectFull: maxJsHeap=n/a
  - rawFrameNameId: maxJsHeap=n/a
- projection-contract-separated (BENCH_FACT): No projection rows were selected; all reported variants are full-string StAX parity rows.
  - projection rows not selected
- full-stax-counterexample-search (BENCH_FACT): No full-string row reported a 200 MiB/s bounded-memory browser counterexample in these fresh process samples.
  - counterexample=not-found
- browser-v8-scope (BENCH_FACT): This report is browser evidence for the recorded Firefox/SpiderMonkey build only; it is not Chromium/V8, Safari/JSC, codegen, or allocation evidence.
  - engine=SpiderMonkey
  - userAgent=Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0
