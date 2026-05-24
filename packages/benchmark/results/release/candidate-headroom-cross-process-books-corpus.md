# Candidate Headroom Cross-Process Stability

Generated: 2026-05-24T07:45:06.680Z

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
- Cases: stringFull, eventObjectFull, rawFrameNameId

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
| stringFull | stream-events | 158.21 MiB/s | 154.61 MiB/s | 163.48 MiB/s | 5.6% | 156.55, 154.61, 163.48 | yes | yes | not-found | 65.7 MiB |
| eventObjectFull | stream-events | 125.85 MiB/s | 121.18 MiB/s | 130.62 MiB/s | 7.5% | 125.75, 121.18, 130.62 | yes | yes | not-found | 127.7 MiB |
| rawFrameNameId | stream-events | 166.68 MiB/s | 164.10 MiB/s | 170.10 MiB/s | 3.6% | 165.85, 164.10, 170.10 | yes | yes | not-found | 129.7 MiB |

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
| stringFull | stream-events | 165.30 MiB/s | 158.18 MiB/s | 171.65 MiB/s | 8.1% | 166.06, 158.18, 171.65 | yes | yes | not-found | 189.0 MiB |
| eventObjectFull | stream-events | 131.21 MiB/s | 124.91 MiB/s | 134.60 MiB/s | 7.4% | 134.60, 124.91, 134.13 | yes | yes | not-found | 188.8 MiB |
| rawFrameNameId | stream-events | 171.04 MiB/s | 168.25 MiB/s | 173.63 MiB/s | 3.1% | 171.25, 168.25, 173.63 | yes | yes | not-found | 188.8 MiB |

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
