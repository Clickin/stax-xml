# Candidate Headroom Cross-Process Stability

Generated: 2026-05-31T17:45:45.681Z

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
- Cases: cursorAccessor, rawFrameDirect, rawFrameNameId

## Source Contract

- Multi-chunk batch cost: Each child process invokes candidate-headroom-large.mjs. With the current sync cursor, batchSize=1 can scan a single Uint8Array view, while batchSize>1 groups chunks and triggers multi-chunk concatenation before parser scanning.
- Child source contract: The current sync cursor can use a single Uint8Array batch item as a view, but a batch containing multiple Uint8Array chunks is concatenated into one parser buffer before scanning.

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\access-shape-rerun-books-corpus
- Committed: no

## Runtime: node

- Engine: V8
- Node: v24.15.0
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1073744736

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| cursorAccessor | stream-events | 107.04 MiB/s | 103.79 MiB/s | 111.38 MiB/s | 7.1% | 111.38, 103.79, 105.94 | yes | yes | not-found | 66.2 MiB |
| rawFrameDirect | stream-events | 76.43 MiB/s | 75.42 MiB/s | 77.02 MiB/s | 2.1% | 76.84, 75.42, 77.02 | yes | yes | not-found | 66.5 MiB |
| rawFrameNameId | stream-events | 85.55 MiB/s | 84.40 MiB/s | 87.55 MiB/s | 3.7% | 84.40, 87.55, 84.70 | yes | yes | not-found | 66.9 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: cursorAccessor, rawFrameDirect, rawFrameNameId
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
- Fixture bytes: 1073744736

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| cursorAccessor | stream-events | 114.05 MiB/s | 110.59 MiB/s | 117.03 MiB/s | 5.6% | 110.59, 114.51, 117.03 | yes | yes | not-found | 189.5 MiB |
| rawFrameDirect | stream-events | 75.84 MiB/s | 75.42 MiB/s | 76.29 MiB/s | 1.1% | 75.42, 75.82, 76.29 | yes | yes | not-found | 188.7 MiB |
| rawFrameNameId | stream-events | 93.33 MiB/s | 92.52 MiB/s | 94.04 MiB/s | 1.6% | 92.52, 93.42, 94.04 | yes | yes | not-found | 187.1 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: cursorAccessor, rawFrameDirect, rawFrameNameId
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
