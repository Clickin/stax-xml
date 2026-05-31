# Candidate Headroom Cross-Process Stability

Generated: 2026-05-31T16:43:40.761Z

This report repeats the selected candidate-headroom rows in fresh runtime processes.
It is cross-process timing evidence for the recorded machine, not a proof that JavaScript runtimes have no further headroom.
Partial rows preserve only selected fields; projection rows report projected record counts. Neither is a full StAX parity row.

## Options

- Runtimes: node, bun
- Process runs: 3
- Child warmups: 1
- Fixture shape: corpus-cycle
- Size GiB: 1
- Diverse cycle size: 4096
- Batch size: 1
- Bounded RSS gate: 512.0 MiB
- Cases: rawFrameNameId, rawFrameNameIdMediumAsciiText, withoutTextStrings

## Source Contract

- Multi-chunk batch cost: Each child process invokes candidate-headroom-large.mjs. With the current sync cursor, batchSize=1 can scan a single Uint8Array view, while batchSize>1 groups chunks and triggers multi-chunk concatenation before parser scanning.
- Child source contract: The current sync cursor can use a single Uint8Array batch item as a view, but a batch containing multiple Uint8Array chunks is concatenated into one parser buffer before scanning.

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\medium-ascii-text-books-corpus-warmup
- Committed: no

## Runtime: node

- Engine: V8
- Node: v24.15.0
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1073744736

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| rawFrameNameId | stream-events | 88.82 MiB/s | 84.78 MiB/s | 91.43 MiB/s | 7.5% | 84.78, 90.23, 91.43 | yes | yes | not-found | 66.4 MiB |
| rawFrameNameIdMediumAsciiText | stream-events | 88.42 MiB/s | 85.22 MiB/s | 92.70 MiB/s | 8.5% | 87.34, 85.22, 92.70 | yes | yes | not-found | 72.8 MiB |
| withoutTextStrings | stream-events | 115.61 MiB/s | 112.87 MiB/s | 119.99 MiB/s | 6.2% | 112.87, 113.96, 119.99 | yes | yes | not-found | 76.9 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: rawFrameNameId, rawFrameNameIdMediumAsciiText
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
| rawFrameNameId | stream-events | 91.11 MiB/s | 84.81 MiB/s | 96.34 MiB/s | 12.7% | 84.81, 96.34, 92.17 | yes | yes | not-found | 200.2 MiB |
| rawFrameNameIdMediumAsciiText | stream-events | 91.98 MiB/s | 88.21 MiB/s | 93.90 MiB/s | 6.2% | 93.90, 93.84, 88.21 | yes | yes | not-found | 196.9 MiB |
| withoutTextStrings | stream-events | 128.96 MiB/s | 121.95 MiB/s | 134.37 MiB/s | 9.6% | 134.37, 130.56, 121.95 | yes | yes | not-found | 214.4 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: rawFrameNameId, rawFrameNameIdMediumAsciiText
- Partial stream rows stable across processes: yes
- Partial stream rows: withoutTextStrings
- Projection rows stable across processes: yes
- Projection rows: n/a

## Findings

- independent-process-rerun (BENCH_FACT): Each sample was measured by a separate runtime process, unlike same-process runs-based timing stability.
  - node: processRuns=3
  - bun: processRuns=3
- projection-contract-separated (BENCH_FACT): Projection rows are reported as selected-field projected records and are not full StAX event-parity rows.
- partial-contract-separated (BENCH_FACT): Partial stream rows report selected parser work and are not full StAX event-parity rows.
  - node: withoutTextStrings
  - bun: withoutTextStrings
- full-stax-counterexample-search (BENCH_FACT): No full-string row reported a 200 MiB/s bounded-memory counterexample in these independent process samples.
  - counterexample=not-found
