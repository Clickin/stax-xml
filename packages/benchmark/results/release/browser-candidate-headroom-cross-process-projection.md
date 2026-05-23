# Browser Candidate Headroom Cross-Process Stability

Generated: 2026-05-23T20:36:29.930Z

This report repeats selected browser candidate-headroom rows in fresh browser processes.
It is browser-runtime timing evidence for the recorded machine, not proof that JavaScript runtimes have no further headroom.
Projection rows report projected record counts and selected-field checksums; they are workload headroom rows, not full StAX parity rows.
Variant memory is browser JS heap. Host process-tree memory is summarized separately and must not be mixed with Node/Bun RSS rows as the same memory proof.

## Options

- Process runs: 3
- Child warmups: 0
- Fixture shape: projection-cycle
- Size GiB: 1
- Diverse cycle size: 4096
- Batch size: 16
- Bounded JS heap gate: 512.0 MiB
- Cases: stringFull, eventObjectFull, rawFrameNameId, projectionLowSelectivity, projectionHighSelectivity
- Browser executable: C:\Program Files\Google\Chrome\Application\chrome.exe

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\browser-candidate-headroom-projection-release
- Committed: no

## Environment

- Browser: Chrome 148.0.0.0
- Engine: V8
- Platform: Win32
- Host platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- User agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36

## Fixture

- Source: generated
- Shape: projection-cycle
- Actual bytes: 1073742077
- Size GiB: 1.0000002356246114
- Row cycle size: 4096

## Results

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded JS heap all | Counterexample | Max JS heap |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| stringFull | stream-events | 63.63 MiB/s | 62.87 MiB/s | 64.84 MiB/s | 3.1% | 63.17, 62.87, 64.84 | yes | yes | not-found | 11.5 MiB |
| eventObjectFull | stream-events | 48.33 MiB/s | 47.69 MiB/s | 48.72 MiB/s | 2.1% | 47.69, 48.72, 48.57 | yes | yes | not-found | 21.5 MiB |
| rawFrameNameId | stream-events | 60.34 MiB/s | 59.67 MiB/s | 61.12 MiB/s | 2.4% | 59.67, 60.22, 61.12 | yes | yes | not-found | 33.6 MiB |
| projectionLowSelectivity | projected-records | 104.64 MiB/s | 103.81 MiB/s | 105.30 MiB/s | 1.4% | 104.81, 103.81, 105.30 | yes | yes | not-found | 32.5 MiB |
| projectionHighSelectivity | projected-records | 70.78 MiB/s | 70.07 MiB/s | 71.78 MiB/s | 2.4% | 71.78, 70.07, 70.51 | yes | yes | not-found | 14.6 MiB |

## Parity

- Stream/full rows stable across processes: yes
- Stream/full rows: stringFull, eventObjectFull, rawFrameNameId
- Projection rows stable across processes: yes
- Projection rows: projectionLowSelectivity, projectionHighSelectivity

## Host Process Memory

Host process-tree memory is inherited from each child report and is process-level browser memory, not a portable per-variant JS heap measurement.

- Scope: windows-process-tree
- Max working set: 449.0 MiB
- Max private bytes: 215.1 MiB
- Max process count: 10

| Browser run | Scope | Max working set | Max private bytes | Max process count |
| ---: | --- | ---: | ---: | ---: |
| 1 | windows-process-tree | 448.9 MiB | 212.7 MiB | 10 |
| 2 | windows-process-tree | 445.0 MiB | 210.9 MiB | 10 |
| 3 | windows-process-tree | 449.0 MiB | 215.1 MiB | 10 |

## Findings

- independent-browser-process-rerun (BENCH_FACT): Each sample launched a fresh browser process through the browser candidate harness.
  - processRuns=3
  - browser=Chrome 148.0.0.0
- browser-memory-scope (BENCH_FACT): Variant memory is browser JS heap. Host process-tree memory is reported separately and is not mixed with Node/Bun RSS evidence.
  - stringFull: maxJsHeap=11.5 MiB
  - eventObjectFull: maxJsHeap=21.5 MiB
  - rawFrameNameId: maxJsHeap=33.6 MiB
  - projectionLowSelectivity: maxJsHeap=32.5 MiB
  - projectionHighSelectivity: maxJsHeap=14.6 MiB
- projection-contract-separated (BENCH_FACT): Projection rows are selected-field projected-record workloads, not full StAX event-parity rows.
  - projectionLowSelectivity
  - projectionHighSelectivity
- full-stax-counterexample-search (BENCH_FACT): No full-string row reported a 200 MiB/s bounded-memory browser counterexample in these fresh process samples.
  - counterexample=not-found
- browser-v8-scope (BENCH_FACT): This report is browser evidence for the recorded Chromium/V8 build only; it is not JSC/SpiderMonkey browser evidence.
  - engine=V8
  - userAgent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36
