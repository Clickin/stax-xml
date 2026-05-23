# Candidate Headroom Cross-Process Stability

Generated: 2026-05-23T19:43:07.392Z

This report repeats the selected candidate-headroom rows in fresh runtime processes.
It is cross-process timing evidence for the recorded machine, not a proof that JavaScript runtimes have no further headroom.
Projection rows report projected record counts and selected-field checksums; they are not full StAX parity rows.

## Options

- Runtimes: node, bun
- Process runs: 3
- Child warmups: 0
- Fixture shape: projection-cycle
- Size GiB: 1
- Diverse cycle size: 4096
- Batch size: 16
- Bounded RSS gate: 512.0 MiB
- Cases: stringFull, eventObjectFull, rawFrameNameId, projectionLowSelectivity, projectionHighSelectivity

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\candidate-headroom-projection-release
- Committed: no

## Runtime: node

- Engine: V8
- Node: v24.15.0
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1073742077

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| stringFull | stream-events | 93.26 MiB/s | 91.60 MiB/s | 96.34 MiB/s | 5.1% | 91.84, 91.60, 96.34 | yes | yes | not-found | 74.0 MiB |
| eventObjectFull | stream-events | 59.03 MiB/s | 56.17 MiB/s | 60.61 MiB/s | 7.5% | 60.61, 56.17, 60.30 | yes | yes | not-found | 135.1 MiB |
| rawFrameNameId | stream-events | 83.25 MiB/s | 81.85 MiB/s | 85.49 MiB/s | 4.4% | 85.49, 82.42, 81.85 | yes | yes | not-found | 144.4 MiB |
| projectionLowSelectivity | projected-records | 129.68 MiB/s | 128.14 MiB/s | 131.25 MiB/s | 2.4% | 131.25, 128.14, 129.65 | yes | yes | not-found | 158.8 MiB |
| projectionHighSelectivity | projected-records | 99.84 MiB/s | 99.24 MiB/s | 100.95 MiB/s | 1.7% | 99.24, 99.33, 100.95 | yes | yes | not-found | 158.9 MiB |

### Parity

- Stream/full rows stable across processes: yes
- Stream/full rows: stringFull, eventObjectFull, rawFrameNameId
- Projection rows stable across processes: yes
- Projection rows: projectionLowSelectivity, projectionHighSelectivity

## Runtime: bun

- Engine: JavaScriptCore
- Node: v24.3.0
- Bun: 1.3.13
- WebKit: 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1073742077

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| stringFull | stream-events | 97.52 MiB/s | 96.27 MiB/s | 98.73 MiB/s | 2.5% | 98.73, 97.55, 96.27 | yes | yes | not-found | 203.5 MiB |
| eventObjectFull | stream-events | 62.98 MiB/s | 62.75 MiB/s | 63.22 MiB/s | 0.7% | 62.98, 62.75, 63.22 | yes | yes | not-found | 203.6 MiB |
| rawFrameNameId | stream-events | 83.76 MiB/s | 83.16 MiB/s | 84.41 MiB/s | 1.5% | 83.71, 84.41, 83.16 | yes | yes | not-found | 185.8 MiB |
| projectionLowSelectivity | projected-records | 126.86 MiB/s | 126.66 MiB/s | 127.19 MiB/s | 0.4% | 127.19, 126.66, 126.73 | yes | yes | not-found | 205.0 MiB |
| projectionHighSelectivity | projected-records | 68.86 MiB/s | 67.89 MiB/s | 69.38 MiB/s | 2.2% | 69.32, 67.89, 69.38 | yes | yes | not-found | 205.1 MiB |

### Parity

- Stream/full rows stable across processes: yes
- Stream/full rows: stringFull, eventObjectFull, rawFrameNameId
- Projection rows stable across processes: yes
- Projection rows: projectionLowSelectivity, projectionHighSelectivity

## Findings

- independent-process-rerun (BENCH_FACT): Each sample was measured by a separate runtime process, unlike same-process runs-based timing stability.
  - node: processRuns=3
  - bun: processRuns=3
- projection-contract-separated (BENCH_FACT): Projection rows are reported as selected-field projected records and are not full StAX event-parity rows.
  - node: projectionLowSelectivity
  - node: projectionHighSelectivity
  - bun: projectionLowSelectivity
  - bun: projectionHighSelectivity
- full-stax-counterexample-search (BENCH_FACT): No full-string row reported a 200 MiB/s bounded-memory counterexample in these independent process samples.
  - counterexample=not-found
