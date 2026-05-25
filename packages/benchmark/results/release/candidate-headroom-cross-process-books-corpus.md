# Candidate Headroom Cross-Process Stability

Generated: 2026-05-25T06:10:21.112Z

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
- Cases: stringFull, eventObjectFull, rawFrameNameId, rawFrameSemanticChecksum, rawFrameStringCache

## Source Contract

- Multi-chunk batch cost: Each child process invokes candidate-headroom-large.mjs. With the current sync cursor, batchSize=1 can scan a single Uint8Array view, while batchSize>1 groups chunks and triggers multi-chunk concatenation before parser scanning.
- Child source contract: The current sync cursor can use a single Uint8Array batch item as a view, but a batch containing multiple Uint8Array chunks is concatenated into one parser buffer before scanning.

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\candidate-headroom-books-corpus-release
- Committed: no

## Runtime: node

- Engine: V8
- Node: v24.15.0
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1073744736

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| stringFull | stream-events | 113.79 MiB/s | 112.49 MiB/s | 114.44 MiB/s | 1.7% | 114.44, 114.44, 112.49 | yes | yes | not-found | 70.7 MiB |
| eventObjectFull | stream-events | 72.76 MiB/s | 71.89 MiB/s | 73.34 MiB/s | 2.0% | 71.89, 73.05, 73.34 | yes | yes | not-found | 136.9 MiB |
| rawFrameNameId | stream-events | 94.98 MiB/s | 94.34 MiB/s | 95.45 MiB/s | 1.2% | 95.45, 95.16, 94.34 | yes | yes | not-found | 147.6 MiB |
| rawFrameSemanticChecksum | stream-events | 98.26 MiB/s | 96.50 MiB/s | 99.95 MiB/s | 3.5% | 99.95, 96.50, 98.34 | yes | yes | not-found | 148.8 MiB |
| rawFrameStringCache | stream-events | 68.32 MiB/s | 66.56 MiB/s | 69.67 MiB/s | 4.6% | 69.67, 66.56, 68.74 | yes | yes | not-found | 149.0 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: stringFull, eventObjectFull, rawFrameNameId, rawFrameStringCache
- Partial stream rows stable across processes: yes
- Partial stream rows: rawFrameSemanticChecksum
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
| stringFull | stream-events | 120.18 MiB/s | 119.61 MiB/s | 120.69 MiB/s | 0.9% | 120.23, 119.61, 120.69 | yes | yes | not-found | 190.2 MiB |
| eventObjectFull | stream-events | 76.84 MiB/s | 75.66 MiB/s | 77.73 MiB/s | 2.7% | 75.66, 77.12, 77.73 | yes | yes | not-found | 190.2 MiB |
| rawFrameNameId | stream-events | 97.84 MiB/s | 95.30 MiB/s | 99.46 MiB/s | 4.3% | 95.30, 98.76, 99.46 | yes | yes | not-found | 176.3 MiB |
| rawFrameSemanticChecksum | stream-events | 45.42 MiB/s | 45.25 MiB/s | 45.51 MiB/s | 0.6% | 45.25, 45.51, 45.51 | yes | yes | not-found | 176.5 MiB |
| rawFrameStringCache | stream-events | 80.29 MiB/s | 79.53 MiB/s | 80.81 MiB/s | 1.6% | 80.54, 79.53, 80.81 | yes | yes | not-found | 159.4 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: stringFull, eventObjectFull, rawFrameNameId, rawFrameStringCache
- Partial stream rows stable across processes: yes
- Partial stream rows: rawFrameSemanticChecksum
- Projection rows stable across processes: yes
- Projection rows: n/a

## Findings

- independent-process-rerun (BENCH_FACT): Each sample was measured by a separate runtime process, unlike same-process runs-based timing stability.
  - node: processRuns=3
  - bun: processRuns=3
- projection-contract-separated (BENCH_FACT): Projection rows are reported as selected-field projected records and are not full StAX event-parity rows.
- partial-contract-separated (BENCH_FACT): Partial stream rows report selected parser work and are not full StAX event-parity rows.
  - node: rawFrameSemanticChecksum
  - bun: rawFrameSemanticChecksum
- full-stax-counterexample-search (BENCH_FACT): No full-string row reported a 200 MiB/s bounded-memory counterexample in these independent process samples.
  - counterexample=not-found
