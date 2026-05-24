# Candidate Headroom Cross-Process Stability

Generated: 2026-05-24T09:22:05.452Z

This report repeats the selected candidate-headroom rows in fresh runtime processes.
It is cross-process timing evidence for the recorded machine, not a proof that JavaScript runtimes have no further headroom.
Projection rows report projected record counts and selected-field checksums; they are not full StAX parity rows.

## Options

- Runtimes: node, bun
- Process runs: 3
- Child warmups: 0
- Fixture shape: corpus-cycle
- Size GiB: 1
- Diverse cycle size: 4096
- Batch size: 1
- Bounded RSS gate: 512.0 MiB
- Cases: stringFull, eventObjectFull, rawFrameNameId

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\candidate-headroom-large-asset-corpus-release
- Committed: no

## Runtime: node

- Engine: V8
- Node: v24.15.0
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1156446940

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| stringFull | stream-events | 130.10 MiB/s | 118.78 MiB/s | 139.02 MiB/s | 15.6% | 132.51, 118.78, 139.02 | yes | yes | not-found | 399.2 MiB |
| eventObjectFull | stream-events | 105.86 MiB/s | 96.67 MiB/s | 117.47 MiB/s | 19.6% | 96.67, 103.44, 117.47 | yes | yes | not-found | 495.3 MiB |
| rawFrameNameId | stream-events | 146.11 MiB/s | 135.93 MiB/s | 158.52 MiB/s | 15.5% | 135.93, 143.87, 158.52 | yes | yes | not-found | 495.3 MiB |

### Parity

- Stream/full rows stable across processes: yes
- Stream/full rows: stringFull, eventObjectFull, rawFrameNameId
- Projection rows stable across processes: yes
- Projection rows: n/a

## Runtime: bun

- Engine: JavaScriptCore
- Node: v24.3.0
- Bun: 1.3.13
- WebKit: 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1156446940

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| stringFull | stream-events | 99.71 MiB/s | 93.15 MiB/s | 109.90 MiB/s | 16.8% | 109.90, 93.15, 96.07 | yes | no | not-found | 1956.7 MiB |
| eventObjectFull | stream-events | 62.79 MiB/s | 61.97 MiB/s | 64.34 MiB/s | 3.8% | 61.97, 62.07, 64.34 | yes | no | not-found | 1849.2 MiB |
| rawFrameNameId | stream-events | 82.95 MiB/s | 81.59 MiB/s | 84.61 MiB/s | 3.6% | 81.59, 82.65, 84.61 | yes | no | not-found | 1849.7 MiB |

### Parity

- Stream/full rows stable across processes: yes
- Stream/full rows: stringFull, eventObjectFull, rawFrameNameId
- Projection rows stable across processes: yes
- Projection rows: n/a

## Findings

- independent-process-rerun (BENCH_FACT): Each sample was measured by a separate runtime process, unlike same-process runs-based timing stability.
  - node: processRuns=3
  - bun: processRuns=3
- projection-contract-separated (BENCH_FACT): Projection rows are reported as selected-field projected records and are not full StAX event-parity rows.
- full-stax-counterexample-search (BENCH_FACT): No full-string row reported a 200 MiB/s bounded-memory counterexample in these independent process samples.
  - counterexample=not-found
