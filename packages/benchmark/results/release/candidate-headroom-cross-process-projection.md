# Candidate Headroom Cross-Process Stability

Generated: 2026-05-23T20:15:35.112Z

This report repeats the selected candidate-headroom rows in fresh runtime processes.
It is cross-process timing evidence for the recorded machine, not a proof that JavaScript runtimes have no further headroom.
Projection rows report projected record counts and selected-field checksums; they are not full StAX parity rows.

## Options

- Runtimes: node, bun, deno
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
| stringFull | stream-events | 90.40 MiB/s | 80.80 MiB/s | 95.52 MiB/s | 16.3% | 95.52, 80.80, 94.87 | yes | yes | not-found | 73.8 MiB |
| eventObjectFull | stream-events | 57.56 MiB/s | 55.15 MiB/s | 58.90 MiB/s | 6.5% | 55.15, 58.90, 58.62 | yes | yes | not-found | 135.2 MiB |
| rawFrameNameId | stream-events | 82.01 MiB/s | 81.07 MiB/s | 82.53 MiB/s | 1.8% | 82.43, 81.07, 82.53 | yes | yes | not-found | 143.3 MiB |
| projectionLowSelectivity | projected-records | 128.98 MiB/s | 126.69 MiB/s | 131.00 MiB/s | 3.3% | 131.00, 129.26, 126.69 | yes | yes | not-found | 160.2 MiB |
| projectionHighSelectivity | projected-records | 99.42 MiB/s | 98.84 MiB/s | 100.03 MiB/s | 1.2% | 98.84, 100.03, 99.37 | yes | yes | not-found | 159.5 MiB |

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
| stringFull | stream-events | 97.67 MiB/s | 97.48 MiB/s | 97.82 MiB/s | 0.3% | 97.82, 97.70, 97.48 | yes | yes | not-found | 192.1 MiB |
| eventObjectFull | stream-events | 63.09 MiB/s | 62.02 MiB/s | 64.82 MiB/s | 4.4% | 64.82, 62.02, 62.43 | yes | yes | not-found | 192.2 MiB |
| rawFrameNameId | stream-events | 83.82 MiB/s | 82.68 MiB/s | 84.97 MiB/s | 2.7% | 84.97, 82.68, 83.82 | yes | yes | not-found | 185.5 MiB |
| projectionLowSelectivity | projected-records | 125.78 MiB/s | 125.14 MiB/s | 126.31 MiB/s | 0.9% | 125.89, 125.14, 126.31 | yes | yes | not-found | 205.1 MiB |
| projectionHighSelectivity | projected-records | 69.87 MiB/s | 66.89 MiB/s | 72.68 MiB/s | 8.3% | 72.68, 70.02, 66.89 | yes | yes | not-found | 205.3 MiB |

### Parity

- Stream/full rows stable across processes: yes
- Stream/full rows: stringFull, eventObjectFull, rawFrameNameId
- Projection rows stable across processes: yes
- Projection rows: projectionLowSelectivity, projectionHighSelectivity

## Runtime: deno

- Engine: V8
- Node: v24.2.0
- Deno: 2.7.13
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1073742077

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| stringFull | stream-events | 87.42 MiB/s | 87.28 MiB/s | 87.62 MiB/s | 0.4% | 87.28, 87.37, 87.62 | yes | yes | not-found | 70.0 MiB |
| eventObjectFull | stream-events | 56.53 MiB/s | 56.18 MiB/s | 56.85 MiB/s | 1.2% | 56.55, 56.18, 56.85 | yes | yes | not-found | 135.1 MiB |
| rawFrameNameId | stream-events | 76.92 MiB/s | 76.26 MiB/s | 77.65 MiB/s | 1.8% | 76.86, 76.26, 77.65 | yes | yes | not-found | 145.9 MiB |
| projectionLowSelectivity | projected-records | 120.77 MiB/s | 120.47 MiB/s | 121.29 MiB/s | 0.7% | 120.54, 120.47, 121.29 | yes | yes | not-found | 159.7 MiB |
| projectionHighSelectivity | projected-records | 91.39 MiB/s | 90.64 MiB/s | 92.05 MiB/s | 1.5% | 92.05, 90.64, 91.48 | yes | yes | not-found | 159.7 MiB |

### Parity

- Stream/full rows stable across processes: yes
- Stream/full rows: stringFull, eventObjectFull, rawFrameNameId
- Projection rows stable across processes: yes
- Projection rows: projectionLowSelectivity, projectionHighSelectivity

## Findings

- independent-process-rerun (BENCH_FACT): Each sample was measured by a separate runtime process, unlike same-process runs-based timing stability.
  - node: processRuns=3
  - bun: processRuns=3
  - deno: processRuns=3
- projection-contract-separated (BENCH_FACT): Projection rows are reported as selected-field projected records and are not full StAX event-parity rows.
  - node: projectionLowSelectivity
  - node: projectionHighSelectivity
  - bun: projectionLowSelectivity
  - bun: projectionHighSelectivity
  - deno: projectionLowSelectivity
  - deno: projectionHighSelectivity
- full-stax-counterexample-search (BENCH_FACT): No full-string row reported a 200 MiB/s bounded-memory counterexample in these independent process samples.
  - counterexample=not-found
