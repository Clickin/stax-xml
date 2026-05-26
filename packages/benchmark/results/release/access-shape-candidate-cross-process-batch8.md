# Candidate Headroom Cross-Process Stability

Generated: 2026-05-26T08:52:45.022Z

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
- Batch size: 8
- Bounded RSS gate: 512.0 MiB
- Cases: cursorAccessor, rawFrameNameId

## Source Contract

- Multi-chunk batch cost: Each child process invokes candidate-headroom-large.mjs. With the current sync cursor, batchSize=1 can scan a single Uint8Array view, while batchSize>1 groups chunks and triggers multi-chunk concatenation before parser scanning.
- Child source contract: The current sync cursor can use a single Uint8Array batch item as a view, but a batch containing multiple Uint8Array chunks is concatenated into one parser buffer before scanning.

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\access-shape-candidate-batch8-stability
- Committed: no

## Runtime: node

- Engine: V8
- Node: v24.15.0
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1073744736

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| cursorAccessor | stream-events | 156.70 MiB/s | 156.11 MiB/s | 157.14 MiB/s | 0.7% | 156.86, 157.14, 156.11 | yes | yes | not-found | 59.4 MiB |
| rawFrameNameId | stream-events | 172.66 MiB/s | 169.86 MiB/s | 175.09 MiB/s | 3.0% | 173.02, 175.09, 169.86 | yes | yes | not-found | 60.1 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: cursorAccessor, rawFrameNameId
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
| cursorAccessor | stream-events | 157.32 MiB/s | 156.52 MiB/s | 158.68 MiB/s | 1.4% | 156.76, 156.52, 158.68 | yes | yes | not-found | 219.9 MiB |
| rawFrameNameId | stream-events | 167.07 MiB/s | 166.19 MiB/s | 167.94 MiB/s | 1.0% | 167.08, 166.19, 167.94 | yes | yes | not-found | 220.0 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: cursorAccessor, rawFrameNameId
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
- multi-chunk-batch-copy-path (SOURCE_FACT): This cross-process run intentionally exercises grouped Uint8Array[] batches; current candidate-headroom children concatenate multi-chunk batches before parser scanning.
  - batchSize=8
  - childHarness=candidate-headroom-large.mjs
  - singleChunk=direct view, multiChunk=concat
