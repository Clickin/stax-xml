# Browser Candidate Headroom Cross-Process Stability

Generated: 2026-05-24T08:08:26.657Z

This report repeats selected browser candidate-headroom rows in fresh browser processes.
It is browser-runtime timing evidence for the recorded machine, not proof that JavaScript runtimes have no further headroom.
All selected rows preserve full-string StAX parity; no projection rows are included.
Variant memory is browser JS heap. Host process-tree memory is summarized separately and must not be mixed with Node/Bun RSS rows as the same memory proof.

## Options

- Process runs: 3
- Harness: browser
- Child warmups: 0
- Fixture shape: corpus-cycle
- Size GiB: 1
- Diverse cycle size: 4096
- Batch size: 1
- Bounded JS heap gate: 512.0 MiB
- Cases: stringFull, eventObjectFull, rawFrameNameId
- Browser executable: C:\Program Files\Google\Chrome\Application\chrome.exe

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\browser-candidate-headroom-books-corpus-release
- Committed: no

## Environment

- Browser: Chrome 148.0.0.0
- Engine: V8
- Platform: Win32
- Host platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- User agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36

## Fixture

- Source: corpus-file
- Shape: corpus-cycle
- Actual bytes: 1073744736
- Size GiB: 1.0000027120113373
- Row cycle size: 1

## Results

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded JS heap all | Counterexample | Max JS heap |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| stringFull | stream-events | 121.27 MiB/s | 120.26 MiB/s | 123.09 MiB/s | 2.3% | 120.46, 123.09, 120.26 | yes | yes | not-found | 12.2 MiB |
| eventObjectFull | stream-events | 104.90 MiB/s | 100.98 MiB/s | 107.00 MiB/s | 5.7% | 100.98, 106.70, 107.00 | yes | yes | not-found | 22.6 MiB |
| rawFrameNameId | stream-events | 129.02 MiB/s | 127.74 MiB/s | 130.32 MiB/s | 2.0% | 127.74, 128.99, 130.32 | yes | yes | not-found | 32.2 MiB |

## Parity

- Stream/full rows stable across processes: yes
- Stream/full rows: stringFull, eventObjectFull, rawFrameNameId
- Projection rows stable across processes: yes
- Projection rows: n/a

## Host Process Memory

Host process-tree memory is inherited from each child report and is process-level browser memory, not a portable per-variant JS heap measurement.

- Scope: windows-process-tree
- Max working set: 559.2 MiB
- Max private bytes: 258.7 MiB
- Max process count: 13

| Browser run | Scope | Max working set | Max private bytes | Max process count |
| ---: | --- | ---: | ---: | ---: |
| 1 | windows-process-tree | 546.8 MiB | 250.0 MiB | 13 |
| 2 | windows-process-tree | 559.2 MiB | 258.7 MiB | 13 |
| 3 | windows-process-tree | 549.7 MiB | 253.0 MiB | 13 |

## Findings

- independent-browser-process-rerun (BENCH_FACT): Each sample launched a fresh browser process through the browser harness.
  - processRuns=3
  - browser=Chrome 148.0.0.0
- browser-memory-scope (BENCH_FACT): Variant memory is browser JS heap. Host process-tree memory is reported separately and is not mixed with Node/Bun RSS evidence.
  - stringFull: maxJsHeap=12.2 MiB
  - eventObjectFull: maxJsHeap=22.6 MiB
  - rawFrameNameId: maxJsHeap=32.2 MiB
- projection-contract-separated (BENCH_FACT): No projection rows were selected; all reported variants are full-string StAX parity rows.
  - projection rows not selected
- full-stax-counterexample-search (BENCH_FACT): No full-string row reported a 200 MiB/s bounded-memory browser counterexample in these fresh process samples.
  - counterexample=not-found
- browser-v8-scope (BENCH_FACT): This report is browser evidence for the recorded Chromium/V8 build only; it is not JSC/SpiderMonkey browser evidence.
  - engine=V8
  - userAgent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36
