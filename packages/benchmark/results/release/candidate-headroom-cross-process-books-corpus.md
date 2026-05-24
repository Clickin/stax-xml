# Candidate Headroom Cross-Process Stability

Generated: 2026-05-24T13:21:16.185Z

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
- Batch size: 1
- Bounded RSS gate: 512.0 MiB
- Cases: stringFull, eventObjectFull, rawFrameNameId, rawFrameStringCache

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
| stringFull | stream-events | 164.68 MiB/s | 160.00 MiB/s | 167.83 MiB/s | 4.8% | 160.00, 166.21, 167.83 | yes | yes | not-found | 66.0 MiB |
| eventObjectFull | stream-events | 132.46 MiB/s | 130.53 MiB/s | 134.07 MiB/s | 2.7% | 134.07, 130.53, 132.77 | yes | yes | not-found | 131.3 MiB |
| rawFrameNameId | stream-events | 173.26 MiB/s | 171.73 MiB/s | 175.23 MiB/s | 2.0% | 175.23, 171.73, 172.82 | yes | yes | not-found | 140.4 MiB |
| rawFrameStringCache | stream-events | 126.66 MiB/s | 125.58 MiB/s | 127.57 MiB/s | 1.6% | 127.57, 126.82, 125.58 | yes | yes | not-found | 144.0 MiB |

### Parity

- Stream/full rows stable across processes: yes
- Stream/full rows: stringFull, eventObjectFull, rawFrameNameId, rawFrameStringCache
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
| stringFull | stream-events | 173.53 MiB/s | 172.48 MiB/s | 174.66 MiB/s | 1.3% | 174.66, 172.48, 173.46 | yes | yes | not-found | 189.4 MiB |
| eventObjectFull | stream-events | 137.90 MiB/s | 136.98 MiB/s | 139.34 MiB/s | 1.7% | 139.34, 136.98, 137.38 | yes | yes | not-found | 189.4 MiB |
| rawFrameNameId | stream-events | 181.51 MiB/s | 179.81 MiB/s | 183.10 MiB/s | 1.8% | 179.81, 181.61, 183.10 | yes | yes | not-found | 188.8 MiB |
| rawFrameStringCache | stream-events | 144.80 MiB/s | 143.30 MiB/s | 146.67 MiB/s | 2.3% | 146.67, 144.43, 143.30 | yes | yes | not-found | 180.0 MiB |

### Parity

- Stream/full rows stable across processes: yes
- Stream/full rows: stringFull, eventObjectFull, rawFrameNameId, rawFrameStringCache
- Projection rows stable across processes: yes
- Projection rows: n/a

## Findings

- independent-process-rerun (BENCH_FACT): Each sample was measured by a separate runtime process, unlike same-process runs-based timing stability.
  - node: processRuns=3
  - bun: processRuns=3
- projection-contract-separated (BENCH_FACT): Projection rows are reported as selected-field projected records and are not full StAX event-parity rows.
- full-stax-counterexample-search (BENCH_FACT): No full-string row reported a 200 MiB/s bounded-memory counterexample in these independent process samples.
  - counterexample=not-found
