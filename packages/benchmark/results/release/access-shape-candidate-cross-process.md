# Candidate Headroom Cross-Process Stability

Generated: 2026-05-25T07:36:35.064Z

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

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\access-shape-candidate-stability
- Committed: no

## Runtime: node

- Engine: V8
- Node: v24.15.0
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1073744736

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| cursorAccessor | stream-events | 161.48 MiB/s | 158.69 MiB/s | 166.29 MiB/s | 4.7% | 166.29, 158.69, 159.47 | yes | yes | not-found | 70.7 MiB |
| rawFrameDirect | stream-events | 136.98 MiB/s | 107.58 MiB/s | 153.09 MiB/s | 33.2% | 107.58, 153.09, 150.28 | yes | yes | not-found | 71.1 MiB |
| rawFrameNameId | stream-events | 147.13 MiB/s | 93.16 MiB/s | 174.93 MiB/s | 55.6% | 93.16, 174.93, 173.31 | yes | yes | not-found | 71.8 MiB |

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
| cursorAccessor | stream-events | 167.04 MiB/s | 162.90 MiB/s | 170.78 MiB/s | 4.7% | 167.44, 162.90, 170.78 | yes | yes | not-found | 195.6 MiB |
| rawFrameDirect | stream-events | 139.83 MiB/s | 139.17 MiB/s | 140.29 MiB/s | 0.8% | 140.04, 140.29, 139.17 | yes | yes | not-found | 195.5 MiB |
| rawFrameNameId | stream-events | 177.34 MiB/s | 173.98 MiB/s | 179.70 MiB/s | 3.2% | 173.98, 178.34, 179.70 | yes | yes | not-found | 189.4 MiB |

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
