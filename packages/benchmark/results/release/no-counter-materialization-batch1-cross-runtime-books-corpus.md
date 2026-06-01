# Candidate Headroom Cross-Process Stability

Generated: 2026-06-01T07:27:30.089Z

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
- Cases: rawFrameNameId, rawFrameNameIdNoCountersNameFoldCache, rawFrameNameIdNoCountersStringFoldCache, withoutTextStrings

## Source Contract

- Multi-chunk batch cost: Each child process invokes candidate-headroom-large.mjs. With the current sync cursor, batchSize=1 can scan a single Uint8Array view, while batchSize>1 groups chunks and triggers multi-chunk concatenation before parser scanning.
- Child source contract: The current sync cursor can use a single Uint8Array batch item as a view, but a batch containing multiple Uint8Array chunks is concatenated into one parser buffer before scanning.

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\no-counter-materialization-batch1-runtime
- Committed: no

## Runtime: node

- Engine: V8
- Node: v24.15.0
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1073744736

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| rawFrameNameId | stream-events | 114.40 MiB/s | 114.29 MiB/s | 114.55 MiB/s | 0.2% | 114.55, 114.37, 114.29 | yes | yes | not-found | 65.7 MiB |
| rawFrameNameIdNoCountersNameFoldCache | stream-events | 95.74 MiB/s | 94.51 MiB/s | 97.38 MiB/s | 3.0% | 94.51, 95.34, 97.38 | yes | yes | not-found | 66.4 MiB |
| rawFrameNameIdNoCountersStringFoldCache | stream-events | 92.19 MiB/s | 88.14 MiB/s | 96.16 MiB/s | 8.7% | 96.16, 92.28, 88.14 | yes | yes | not-found | 66.7 MiB |
| withoutTextStrings | stream-events | 117.65 MiB/s | 115.42 MiB/s | 119.54 MiB/s | 3.5% | 119.54, 115.42, 117.98 | yes | yes | not-found | 69.1 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: rawFrameNameId, rawFrameNameIdNoCountersNameFoldCache, rawFrameNameIdNoCountersStringFoldCache
- Partial stream rows stable across processes: yes
- Partial stream rows: withoutTextStrings
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
| rawFrameNameId | stream-events | 121.23 MiB/s | 118.18 MiB/s | 123.32 MiB/s | 4.2% | 118.18, 122.21, 123.32 | yes | yes | not-found | 179.0 MiB |
| rawFrameNameIdNoCountersNameFoldCache | stream-events | 101.04 MiB/s | 100.26 MiB/s | 101.84 MiB/s | 1.6% | 100.26, 101.02, 101.84 | yes | yes | not-found | 178.0 MiB |
| rawFrameNameIdNoCountersStringFoldCache | stream-events | 97.54 MiB/s | 96.11 MiB/s | 98.45 MiB/s | 2.4% | 98.05, 96.11, 98.45 | yes | yes | not-found | 178.4 MiB |
| withoutTextStrings | stream-events | 132.29 MiB/s | 132.08 MiB/s | 132.50 MiB/s | 0.3% | 132.08, 132.27, 132.50 | yes | yes | not-found | 178.5 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: rawFrameNameId, rawFrameNameIdNoCountersNameFoldCache, rawFrameNameIdNoCountersStringFoldCache
- Partial stream rows stable across processes: yes
- Partial stream rows: withoutTextStrings
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
| rawFrameNameId | stream-events | 109.47 MiB/s | 108.92 MiB/s | 110.28 MiB/s | 1.2% | 110.28, 108.92, 109.22 | yes | yes | not-found | 66.4 MiB |
| rawFrameNameIdNoCountersNameFoldCache | stream-events | 84.23 MiB/s | 83.73 MiB/s | 84.83 MiB/s | 1.3% | 84.83, 83.73, 84.15 | yes | yes | not-found | 66.4 MiB |
| rawFrameNameIdNoCountersStringFoldCache | stream-events | 85.01 MiB/s | 80.27 MiB/s | 87.75 MiB/s | 8.8% | 87.75, 87.00, 80.27 | yes | yes | not-found | 66.9 MiB |
| withoutTextStrings | stream-events | 112.28 MiB/s | 108.74 MiB/s | 114.81 MiB/s | 5.4% | 114.81, 108.74, 113.29 | yes | yes | not-found | 68.5 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: rawFrameNameId, rawFrameNameIdNoCountersNameFoldCache, rawFrameNameIdNoCountersStringFoldCache
- Partial stream rows stable across processes: yes
- Partial stream rows: withoutTextStrings
- Projection rows stable across processes: yes
- Projection rows: n/a

## Findings

- independent-process-rerun (BENCH_FACT): Each sample was measured by a separate runtime process, unlike same-process runs-based timing stability.
  - node: processRuns=3
  - bun: processRuns=3
  - deno: processRuns=3
- projection-contract-separated (BENCH_FACT): Projection rows are reported as selected-field projected records and are not full StAX event-parity rows.
- partial-contract-separated (BENCH_FACT): Partial stream rows report selected parser work and are not full StAX event-parity rows.
  - node: withoutTextStrings
  - bun: withoutTextStrings
  - deno: withoutTextStrings
- full-stax-counterexample-search (BENCH_FACT): No full-string row reported a 200 MiB/s bounded-memory counterexample in these independent process samples.
  - counterexample=not-found
