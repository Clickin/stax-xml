# Candidate Headroom Cross-Process Stability

Generated: 2026-05-31T17:09:17.494Z

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
- Cases: rawFrameNameId, rawFrameNameIdNoCounters, rawFrameNameIdNoCountersMediumAsciiText, rawFrameNameIdNoCountersUnrolledMediumAsciiText

## Source Contract

- Multi-chunk batch cost: Each child process invokes candidate-headroom-large.mjs. With the current sync cursor, batchSize=1 can scan a single Uint8Array view, while batchSize>1 groups chunks and triggers multi-chunk concatenation before parser scanning.
- Child source contract: The current sync cursor can use a single Uint8Array batch item as a view, but a batch containing multiple Uint8Array chunks is concatenated into one parser buffer before scanning.

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\no-counter-medium-ascii-text-books-corpus-warmup
- Committed: no

## Runtime: node

- Engine: V8
- Node: v24.15.0
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1073744736

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| rawFrameNameId | stream-events | 87.13 MiB/s | 86.15 MiB/s | 88.23 MiB/s | 2.4% | 86.15, 88.23, 87.00 | yes | yes | not-found | 66.6 MiB |
| rawFrameNameIdNoCounters | stream-events | 92.63 MiB/s | 90.90 MiB/s | 95.85 MiB/s | 5.3% | 90.90, 95.85, 91.14 | yes | yes | not-found | 72.8 MiB |
| rawFrameNameIdNoCountersMediumAsciiText | stream-events | 94.43 MiB/s | 92.57 MiB/s | 95.44 MiB/s | 3.0% | 95.27, 95.44, 92.57 | yes | yes | not-found | 73.2 MiB |
| rawFrameNameIdNoCountersUnrolledMediumAsciiText | stream-events | 93.35 MiB/s | 91.04 MiB/s | 94.69 MiB/s | 3.9% | 94.32, 94.69, 91.04 | yes | yes | not-found | 73.2 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: rawFrameNameId, rawFrameNameIdNoCounters, rawFrameNameIdNoCountersMediumAsciiText, rawFrameNameIdNoCountersUnrolledMediumAsciiText
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
| rawFrameNameId | stream-events | 92.40 MiB/s | 90.65 MiB/s | 94.94 MiB/s | 4.6% | 91.60, 90.65, 94.94 | yes | yes | not-found | 199.3 MiB |
| rawFrameNameIdNoCounters | stream-events | 96.82 MiB/s | 95.81 MiB/s | 98.12 MiB/s | 2.4% | 96.52, 95.81, 98.12 | yes | yes | not-found | 195.0 MiB |
| rawFrameNameIdNoCountersMediumAsciiText | stream-events | 93.40 MiB/s | 89.40 MiB/s | 98.32 MiB/s | 9.6% | 92.48, 89.40, 98.32 | yes | yes | not-found | 184.4 MiB |
| rawFrameNameIdNoCountersUnrolledMediumAsciiText | stream-events | 94.75 MiB/s | 91.59 MiB/s | 96.58 MiB/s | 5.3% | 91.59, 96.58, 96.09 | yes | yes | not-found | 187.8 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: rawFrameNameId, rawFrameNameIdNoCounters, rawFrameNameIdNoCountersMediumAsciiText, rawFrameNameIdNoCountersUnrolledMediumAsciiText
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
