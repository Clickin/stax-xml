# Candidate Headroom Cross-Process Stability

Generated: 2026-05-26T20:14:41.192Z

This report repeats the selected candidate-headroom rows in fresh runtime processes.
It is cross-process timing evidence for the recorded machine, not a proof that JavaScript runtimes have no further headroom.
Partial rows preserve only selected fields; projection rows report projected record counts. Neither is a full StAX parity row.

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

## Source Contract

- Multi-chunk batch cost: Each child process invokes candidate-headroom-large.mjs. With the current sync cursor, batchSize=1 can scan a single Uint8Array view, while batchSize>1 groups chunks and triggers multi-chunk concatenation before parser scanning.
- Child source contract: The current sync cursor can use a single Uint8Array batch item as a view, but a batch containing multiple Uint8Array chunks is concatenated into one parser buffer before scanning.

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\candidate-headroom-midsize-corpus-release
- Committed: no

## Runtime: node

- Engine: V8
- Node: v24.15.0
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1079349964

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| stringFull | stream-events | 86.51 MiB/s | 85.48 MiB/s | 87.91 MiB/s | 2.8% | 85.48, 86.13, 87.91 | yes | yes | not-found | 106.3 MiB |
| eventObjectFull | stream-events | 61.51 MiB/s | 59.87 MiB/s | 63.02 MiB/s | 5.1% | 63.02, 59.87, 61.62 | yes | yes | not-found | 192.6 MiB |
| rawFrameNameId | stream-events | 79.06 MiB/s | 77.07 MiB/s | 80.94 MiB/s | 4.9% | 77.07, 80.94, 79.17 | yes | yes | not-found | 192.3 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: stringFull, eventObjectFull, rawFrameNameId
- Partial stream rows stable across processes: yes
- Partial stream rows: n/a
- Projection rows stable across processes: yes
- Projection rows: n/a

## Runtime: bun

- Engine: JavaScriptCore
- Node: v24.3.0
- Bun: 1.3.13
- WebKit: 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1079349964

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| stringFull | stream-events | 91.17 MiB/s | 89.21 MiB/s | 92.73 MiB/s | 3.9% | 89.21, 92.73, 91.56 | yes | yes | not-found | 420.2 MiB |
| eventObjectFull | stream-events | 61.62 MiB/s | 61.05 MiB/s | 62.53 MiB/s | 2.4% | 61.28, 62.53, 61.05 | yes | yes | not-found | 419.0 MiB |
| rawFrameNameId | stream-events | 77.74 MiB/s | 76.49 MiB/s | 79.03 MiB/s | 3.3% | 79.03, 77.70, 76.49 | yes | yes | not-found | 420.6 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: stringFull, eventObjectFull, rawFrameNameId
- Partial stream rows stable across processes: yes
- Partial stream rows: n/a
- Projection rows stable across processes: yes
- Projection rows: n/a

## Findings

- independent-process-rerun (BENCH_FACT): Each sample was measured by a separate runtime process, unlike same-process runs-based timing stability.
  - node: processRuns=3
  - bun: processRuns=3
- projection-contract-separated (BENCH_FACT): Projection rows are reported as selected-field projected records and are not full StAX event-parity rows.
- partial-contract-separated (NOT_APPLICABLE): No partial stream rows were selected in this run.
  - partial=none
- full-stax-counterexample-search (BENCH_FACT): No full-string row reported a 200 MiB/s bounded-memory counterexample in these independent process samples.
  - counterexample=not-found
