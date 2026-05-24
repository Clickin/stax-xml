# Browser Candidate Headroom Cross-Process Stability

Generated: 2026-05-24T05:22:13.460Z

This report repeats selected browser candidate-headroom rows in fresh browser processes.
It is browser-runtime timing evidence for the recorded machine, not proof that JavaScript runtimes have no further headroom.
Projection rows report projected record counts and selected-field checksums; they are workload headroom rows, not full StAX parity rows.
Firefox does not expose Chromium performance.memory, so variant JS heap is unavailable. Host process-tree memory is summarized separately and must not be mixed with Node/Bun RSS rows as the same memory proof.

## Options

- Process runs: 3
- Harness: firefox-bidi
- Child warmups: 0
- Fixture shape: projection-cycle
- Size GiB: 1
- Diverse cycle size: 4096
- Batch size: 16
- Bounded JS heap gate: 512.0 MiB
- Cases: stringFull, eventObjectFull, rawFrameNameId, projectionLowSelectivity, projectionHighSelectivity
- Browser executable: C:\Program Files\Mozilla Firefox\firefox.exe

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\firefox-bidi-candidate-headroom-projection-release
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
- Shape: projection-cycle
- Actual bytes: 1073742077
- Size GiB: 1.0000002356246114
- Row cycle size: 4096

## Results

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded JS heap all | Counterexample | Max JS heap |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| stringFull | stream-events | 63.42 MiB/s | 62.97 MiB/s | 63.68 MiB/s | 1.1% | 62.97, 63.62, 63.68 | yes | no | not-found | n/a |
| eventObjectFull | stream-events | 53.75 MiB/s | 53.53 MiB/s | 53.95 MiB/s | 0.8% | 53.78, 53.53, 53.95 | yes | no | not-found | n/a |
| rawFrameNameId | stream-events | 69.08 MiB/s | 68.35 MiB/s | 69.68 MiB/s | 1.9% | 68.35, 69.19, 69.68 | yes | no | not-found | n/a |
| projectionLowSelectivity | projected-records | 119.99 MiB/s | 118.35 MiB/s | 121.27 MiB/s | 2.4% | 120.36, 121.27, 118.35 | yes | no | not-found | n/a |
| projectionHighSelectivity | projected-records | 88.26 MiB/s | 87.96 MiB/s | 88.50 MiB/s | 0.6% | 88.32, 88.50, 87.96 | yes | no | not-found | n/a |

## Parity

- Stream/full rows stable across processes: yes
- Stream/full rows: stringFull, eventObjectFull, rawFrameNameId
- Projection rows stable across processes: yes
- Projection rows: projectionLowSelectivity, projectionHighSelectivity

## Host Process Memory

Host process-tree memory is inherited from each child report and is process-level browser memory, not a portable per-variant JS heap measurement.

- Scope: windows-process-tree
- Max working set: 900.3 MiB
- Max private bytes: 733.1 MiB
- Max process count: 12

| Browser run | Scope | Max working set | Max private bytes | Max process count |
| ---: | --- | ---: | ---: | ---: |
| 1 | windows-process-tree | 895.7 MiB | 728.0 MiB | 12 |
| 2 | windows-process-tree | 900.3 MiB | 733.1 MiB | 12 |
| 3 | windows-process-tree | 862.7 MiB | 694.9 MiB | 12 |

## Findings

- independent-browser-process-rerun (BENCH_FACT): Each sample launched a fresh browser process through the firefox-bidi candidate harness.
  - processRuns=3
  - browser=Firefox 143.0
- browser-memory-scope (BENCH_FACT): Firefox does not expose Chromium performance.memory, so variant JS heap is unavailable. Host process-tree memory is reported separately and is not mixed with Node/Bun RSS evidence.
  - stringFull: maxJsHeap=n/a
  - eventObjectFull: maxJsHeap=n/a
  - rawFrameNameId: maxJsHeap=n/a
  - projectionLowSelectivity: maxJsHeap=n/a
  - projectionHighSelectivity: maxJsHeap=n/a
- projection-contract-separated (BENCH_FACT): Projection rows are selected-field projected-record workloads, not full StAX event-parity rows.
  - projectionLowSelectivity
  - projectionHighSelectivity
- full-stax-counterexample-search (BENCH_FACT): No full-string row reported a 200 MiB/s bounded-memory browser counterexample in these fresh process samples.
  - counterexample=not-found
- browser-v8-scope (BENCH_FACT): This report is browser evidence for the recorded Firefox/SpiderMonkey build only; it is not Chromium/V8, Safari/JSC, codegen, or allocation evidence.
  - engine=SpiderMonkey
  - userAgent=Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0
