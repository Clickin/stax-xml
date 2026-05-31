# Candidate Headroom Cross-Process Stability

Generated: 2026-05-31T17:32:02.029Z

This report repeats the selected candidate-headroom rows in fresh runtime processes.
It is cross-process timing evidence for the recorded machine, not a proof that JavaScript runtimes have no further headroom.
Partial rows preserve only selected fields; projection rows report projected record counts. Neither is a full StAX parity row.

## Options

- Runtimes: deno
- Process runs: 3
- Child warmups: 1
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

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\deno-candidate-headroom-books-corpus
- Committed: no

## Runtime: deno

- Engine: V8
- Node: v24.2.0
- Deno: 2.7.13
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1073744736

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| stringFull | stream-events | 81.48 MiB/s | 80.06 MiB/s | 83.16 MiB/s | 3.8% | 80.06, 81.21, 83.16 | yes | yes | not-found | 66.4 MiB |
| eventObjectFull | stream-events | 64.71 MiB/s | 64.44 MiB/s | 65.08 MiB/s | 1.0% | 64.44, 64.62, 65.08 | yes | yes | not-found | 133.1 MiB |
| rawFrameNameId | stream-events | 80.96 MiB/s | 78.00 MiB/s | 83.91 MiB/s | 7.3% | 78.00, 80.96, 83.91 | yes | yes | not-found | 143.6 MiB |
| rawFrameSemanticChecksum | stream-events | 85.93 MiB/s | 83.62 MiB/s | 90.29 MiB/s | 7.8% | 83.86, 90.29, 83.62 | yes | yes | not-found | 145.1 MiB |
| rawFrameStringCache | stream-events | 68.99 MiB/s | 68.16 MiB/s | 70.34 MiB/s | 3.2% | 68.46, 70.34, 68.16 | yes | yes | not-found | 174.3 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: stringFull, eventObjectFull, rawFrameNameId, rawFrameStringCache
- Partial stream rows stable across processes: yes
- Partial stream rows: rawFrameSemanticChecksum
- Projection rows stable across processes: yes
- Projection rows: n/a

## Findings

- independent-process-rerun (BENCH_FACT): Each sample was measured by a separate runtime process, unlike same-process runs-based timing stability.
  - deno: processRuns=3
- projection-contract-separated (BENCH_FACT): Projection rows are reported as selected-field projected records and are not full StAX event-parity rows.
- partial-contract-separated (BENCH_FACT): Partial stream rows report selected parser work and are not full StAX event-parity rows.
  - deno: rawFrameSemanticChecksum
- full-stax-counterexample-search (BENCH_FACT): No full-string row reported a 200 MiB/s bounded-memory counterexample in these independent process samples.
  - counterexample=not-found
