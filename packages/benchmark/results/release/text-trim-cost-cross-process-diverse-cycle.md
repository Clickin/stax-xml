# Candidate Headroom Cross-Process Stability

Generated: 2026-05-31T23:12:41.260Z

This report repeats the selected candidate-headroom rows in fresh runtime processes.
It is cross-process timing evidence for the recorded machine, not a proof that JavaScript runtimes have no further headroom.
Partial rows preserve only selected fields; projection rows report projected record counts. Neither is a full StAX parity row.

## Options

- Runtimes: node, bun, deno
- Process runs: 3
- Child warmups: 0
- Fixture shape: diverse-cycle
- Size GiB: 1
- Diverse cycle size: 4096
- Batch size: 1
- Bounded RSS gate: 512.0 MiB
- Cases: rawFrameNameId, rawFrameNameIdNoTrim, rawFrameNameIdFoldTrim, withoutTextStrings

## Source Contract

- Multi-chunk batch cost: Each child process invokes candidate-headroom-large.mjs. With the current sync cursor, batchSize=1 can scan a single Uint8Array view, while batchSize>1 groups chunks and triggers multi-chunk concatenation before parser scanning.
- Child source contract: The current sync cursor can use a single Uint8Array batch item as a view, but a batch containing multiple Uint8Array chunks is concatenated into one parser buffer before scanning.

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\text-trim-cost-diverse-cycle
- Committed: no

## Runtime: node

- Engine: V8
- Node: v24.15.0
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1073742038

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| rawFrameNameId | stream-events | 57.31 MiB/s | 56.77 MiB/s | 57.67 MiB/s | 1.6% | 56.77, 57.67, 57.50 | yes | yes | not-found | 74.3 MiB |
| rawFrameNameIdNoTrim | stream-events | 51.34 MiB/s | 50.40 MiB/s | 52.57 MiB/s | 4.2% | 50.40, 51.05, 52.57 | yes | yes | not-found | 83.1 MiB |
| rawFrameNameIdFoldTrim | stream-events | 49.00 MiB/s | 47.50 MiB/s | 49.83 MiB/s | 4.8% | 49.83, 49.69, 47.50 | yes | yes | not-found | 83.2 MiB |
| withoutTextStrings | stream-events | 62.78 MiB/s | 62.50 MiB/s | 63.08 MiB/s | 0.9% | 62.76, 63.08, 62.50 | yes | yes | not-found | 100.0 MiB |

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
- Fixture bytes: 1073742038

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| rawFrameNameId | stream-events | 55.13 MiB/s | 54.68 MiB/s | 55.56 MiB/s | 1.6% | 54.68, 55.16, 55.56 | yes | yes | not-found | 182.5 MiB |
| rawFrameNameIdNoTrim | stream-events | 48.08 MiB/s | 47.21 MiB/s | 48.63 MiB/s | 2.9% | 48.41, 47.21, 48.63 | yes | yes | not-found | 187.6 MiB |
| rawFrameNameIdFoldTrim | stream-events | 48.24 MiB/s | 48.08 MiB/s | 48.35 MiB/s | 0.5% | 48.08, 48.29, 48.35 | yes | yes | not-found | 186.8 MiB |
| withoutTextStrings | stream-events | 59.77 MiB/s | 58.73 MiB/s | 61.80 MiB/s | 5.1% | 58.77, 58.73, 61.80 | yes | yes | not-found | 184.8 MiB |

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
- Fixture bytes: 1073742038

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| rawFrameNameId | stream-events | 53.89 MiB/s | 53.60 MiB/s | 54.07 MiB/s | 0.9% | 54.07, 54.00, 53.60 | yes | yes | not-found | 75.7 MiB |
| rawFrameNameIdNoTrim | stream-events | 47.40 MiB/s | 46.31 MiB/s | 48.50 MiB/s | 4.6% | 48.50, 47.39, 46.31 | yes | yes | not-found | 87.4 MiB |
| rawFrameNameIdFoldTrim | stream-events | 45.37 MiB/s | 45.02 MiB/s | 45.76 MiB/s | 1.6% | 45.02, 45.76, 45.35 | yes | yes | not-found | 88.0 MiB |
| withoutTextStrings | stream-events | 64.04 MiB/s | 63.98 MiB/s | 64.11 MiB/s | 0.2% | 64.03, 63.98, 64.11 | yes | yes | not-found | 106.7 MiB |

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
