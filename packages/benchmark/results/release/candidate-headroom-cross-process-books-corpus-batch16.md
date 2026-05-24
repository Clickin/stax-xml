# Candidate Headroom Cross-Process Stability

Generated: 2026-05-24T22:47:39.897Z

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
- Batch size: 16
- Bounded RSS gate: 512.0 MiB
- Cases: stringFull, eventObjectFull, rawFrameNameId

## Source Contract

- Multi-chunk batch cost: Each child process invokes candidate-headroom-large.mjs. With the current sync cursor, batchSize=1 can scan a single Uint8Array view, while batchSize>1 groups chunks and triggers multi-chunk concatenation before parser scanning.
- Child source contract: The current sync cursor can use a single Uint8Array batch item as a view, but a batch containing multiple Uint8Array chunks is concatenated into one parser buffer before scanning.

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\candidate-headroom-books-corpus-batch16
- Committed: no

## Runtime: node

- Engine: V8
- Node: v24.15.0
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1073744736

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| stringFull | stream-events | 119.66 MiB/s | 118.32 MiB/s | 120.36 MiB/s | 1.7% | 120.36, 120.30, 118.32 | yes | yes | not-found | 67.7 MiB |
| eventObjectFull | stream-events | 78.90 MiB/s | 76.60 MiB/s | 80.96 MiB/s | 5.5% | 79.14, 80.96, 76.60 | yes | yes | not-found | 132.0 MiB |
| rawFrameNameId | stream-events | 99.83 MiB/s | 99.43 MiB/s | 100.35 MiB/s | 0.9% | 99.72, 100.35, 99.43 | yes | yes | not-found | 137.2 MiB |

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
- Fixture bytes: 1073744736

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| stringFull | stream-events | 123.45 MiB/s | 122.87 MiB/s | 123.76 MiB/s | 0.7% | 123.72, 123.76, 122.87 | yes | yes | not-found | 199.6 MiB |
| eventObjectFull | stream-events | 76.71 MiB/s | 74.71 MiB/s | 77.74 MiB/s | 4.0% | 77.68, 74.71, 77.74 | yes | yes | not-found | 198.9 MiB |
| rawFrameNameId | stream-events | 92.49 MiB/s | 82.87 MiB/s | 99.30 MiB/s | 17.8% | 82.87, 95.29, 99.30 | yes | yes | not-found | 179.3 MiB |

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
- multi-chunk-batch-copy-path (SOURCE_FACT): This cross-process run intentionally exercises grouped Uint8Array[] batches; current candidate-headroom children concatenate multi-chunk batches before parser scanning.
  - batchSize=16
  - childHarness=candidate-headroom-large.mjs
  - singleChunk=direct view, multiChunk=concat
