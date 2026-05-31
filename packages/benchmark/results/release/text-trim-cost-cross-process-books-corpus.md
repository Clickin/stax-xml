# Candidate Headroom Cross-Process Stability

Generated: 2026-05-31T23:19:10.156Z

This report repeats the selected candidate-headroom rows in fresh runtime processes.
It is cross-process timing evidence for the recorded machine, not a proof that JavaScript runtimes have no further headroom.
Partial rows preserve only selected fields; projection rows report projected record counts. Neither is a full StAX parity row.

## Options

- Runtimes: node, bun, deno
- Process runs: 3
- Child warmups: 0
- Fixture shape: corpus-cycle
- Size GiB: 1
- Diverse cycle size: 4096
- Batch size: 1
- Bounded RSS gate: 512.0 MiB
- Cases: rawFrameNameId, rawFrameNameIdNoTrim, rawFrameNameIdFoldTrim, withoutTextStrings

## Source Contract

- Multi-chunk batch cost: Each child process invokes candidate-headroom-large.mjs. With the current sync cursor, batchSize=1 can scan a single Uint8Array view, while batchSize>1 groups chunks and triggers multi-chunk concatenation before parser scanning.
- Child source contract: The current sync cursor can use a single Uint8Array batch item as a view, but a batch containing multiple Uint8Array chunks is concatenated into one parser buffer before scanning.

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\text-trim-cost-books-corpus
- Committed: no

## Runtime: node

- Engine: V8
- Node: v24.15.0
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1073744736

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| rawFrameNameId | stream-events | 115.55 MiB/s | 111.21 MiB/s | 118.14 MiB/s | 6.0% | 111.21, 118.14, 117.31 | yes | yes | not-found | 65.8 MiB |
| rawFrameNameIdNoTrim | stream-events | 89.37 MiB/s | 88.23 MiB/s | 91.38 MiB/s | 3.5% | 88.23, 91.38, 88.52 | yes | yes | not-found | 66.5 MiB |
| rawFrameNameIdFoldTrim | stream-events | 82.43 MiB/s | 81.77 MiB/s | 82.92 MiB/s | 1.4% | 81.77, 82.92, 82.59 | yes | yes | not-found | 67.1 MiB |
| withoutTextStrings | stream-events | 117.63 MiB/s | 116.26 MiB/s | 119.56 MiB/s | 2.8% | 117.07, 116.26, 119.56 | yes | yes | not-found | 68.9 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: rawFrameNameId, rawFrameNameIdFoldTrim
- Partial stream rows stable across processes: yes
- Partial stream rows: rawFrameNameIdNoTrim, withoutTextStrings
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
| rawFrameNameId | stream-events | 119.21 MiB/s | 118.96 MiB/s | 119.64 MiB/s | 0.6% | 118.96, 119.04, 119.64 | yes | yes | not-found | 178.5 MiB |
| rawFrameNameIdNoTrim | stream-events | 97.81 MiB/s | 97.17 MiB/s | 98.51 MiB/s | 1.4% | 97.17, 97.74, 98.51 | yes | yes | not-found | 178.0 MiB |
| rawFrameNameIdFoldTrim | stream-events | 95.76 MiB/s | 95.35 MiB/s | 96.22 MiB/s | 0.9% | 95.70, 95.35, 96.22 | yes | yes | not-found | 177.8 MiB |
| withoutTextStrings | stream-events | 133.74 MiB/s | 132.64 MiB/s | 134.54 MiB/s | 1.4% | 132.64, 134.54, 134.03 | yes | yes | not-found | 177.5 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: rawFrameNameId, rawFrameNameIdFoldTrim
- Partial stream rows stable across processes: yes
- Partial stream rows: rawFrameNameIdNoTrim, withoutTextStrings
- Projection rows stable across processes: yes
- Projection rows: n/a

## Runtime: deno

- Engine: V8
- Node: v24.2.0
- Deno: 2.7.13
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1073744736

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| rawFrameNameId | stream-events | 108.68 MiB/s | 106.56 MiB/s | 110.54 MiB/s | 3.7% | 108.92, 106.56, 110.54 | yes | yes | not-found | 65.8 MiB |
| rawFrameNameIdNoTrim | stream-events | 86.68 MiB/s | 86.16 MiB/s | 87.21 MiB/s | 1.2% | 86.16, 87.21, 86.68 | yes | yes | not-found | 66.7 MiB |
| rawFrameNameIdFoldTrim | stream-events | 77.41 MiB/s | 76.89 MiB/s | 78.32 MiB/s | 1.9% | 77.02, 78.32, 76.89 | yes | yes | not-found | 66.9 MiB |
| withoutTextStrings | stream-events | 114.46 MiB/s | 112.03 MiB/s | 118.57 MiB/s | 5.7% | 112.80, 112.03, 118.57 | yes | yes | not-found | 67.5 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: rawFrameNameId, rawFrameNameIdFoldTrim
- Partial stream rows stable across processes: yes
- Partial stream rows: rawFrameNameIdNoTrim, withoutTextStrings
- Projection rows stable across processes: yes
- Projection rows: n/a

## Findings

- independent-process-rerun (BENCH_FACT): Each sample was measured by a separate runtime process, unlike same-process runs-based timing stability.
  - node: processRuns=3
  - bun: processRuns=3
  - deno: processRuns=3
- projection-contract-separated (BENCH_FACT): Projection rows are reported as selected-field projected records and are not full StAX event-parity rows.
- partial-contract-separated (BENCH_FACT): Partial stream rows report selected parser work and are not full StAX event-parity rows.
  - node: rawFrameNameIdNoTrim
  - node: withoutTextStrings
  - bun: rawFrameNameIdNoTrim
  - bun: withoutTextStrings
  - deno: rawFrameNameIdNoTrim
  - deno: withoutTextStrings
- full-stax-counterexample-search (BENCH_FACT): No full-string row reported a 200 MiB/s bounded-memory counterexample in these independent process samples.
  - counterexample=not-found
