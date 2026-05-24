# Candidate Headroom Cross-Process Stability

Generated: 2026-05-24T14:21:44.056Z

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
- Cases: stringFull, eventObjectFull, rawFrameNameId, rawFrameSemanticChecksum, rawFrameStringCache

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
| stringFull | stream-events | 161.07 MiB/s | 156.50 MiB/s | 165.92 MiB/s | 5.8% | 156.50, 165.92, 160.80 | yes | yes | not-found | 66.1 MiB |
| eventObjectFull | stream-events | 128.12 MiB/s | 122.52 MiB/s | 131.17 MiB/s | 6.7% | 122.52, 131.17, 130.66 | yes | yes | not-found | 132.7 MiB |
| rawFrameNameId | stream-events | 170.81 MiB/s | 155.73 MiB/s | 180.08 MiB/s | 14.3% | 155.73, 180.08, 176.61 | yes | yes | not-found | 142.3 MiB |
| rawFrameSemanticChecksum | stream-events | 157.70 MiB/s | 152.18 MiB/s | 166.29 MiB/s | 8.9% | 154.62, 166.29, 152.18 | yes | yes | not-found | 143.3 MiB |
| rawFrameStringCache | stream-events | 119.59 MiB/s | 108.68 MiB/s | 126.41 MiB/s | 14.8% | 123.69, 126.41, 108.68 | yes | yes | not-found | 143.9 MiB |

### Parity

- Stream/full rows stable across processes: yes
- Stream/full rows: stringFull, eventObjectFull, rawFrameNameId, rawFrameSemanticChecksum, rawFrameStringCache
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
| stringFull | stream-events | 156.83 MiB/s | 143.75 MiB/s | 170.51 MiB/s | 17.1% | 143.75, 170.51, 156.24 | yes | yes | not-found | 188.8 MiB |
| eventObjectFull | stream-events | 127.91 MiB/s | 120.74 MiB/s | 134.56 MiB/s | 10.8% | 120.74, 134.56, 128.42 | yes | yes | not-found | 189.6 MiB |
| rawFrameNameId | stream-events | 173.22 MiB/s | 169.34 MiB/s | 177.18 MiB/s | 4.5% | 169.34, 177.18, 173.15 | yes | yes | not-found | 189.9 MiB |
| rawFrameSemanticChecksum | stream-events | 85.27 MiB/s | 83.49 MiB/s | 87.06 MiB/s | 4.2% | 83.49, 87.06, 85.26 | yes | yes | not-found | 177.1 MiB |
| rawFrameStringCache | stream-events | 135.77 MiB/s | 132.90 MiB/s | 138.81 MiB/s | 4.4% | 135.60, 132.90, 138.81 | yes | yes | not-found | 178.4 MiB |

### Parity

- Stream/full rows stable across processes: yes
- Stream/full rows: stringFull, eventObjectFull, rawFrameNameId, rawFrameSemanticChecksum, rawFrameStringCache
- Projection rows stable across processes: yes
- Projection rows: n/a

## Findings

- independent-process-rerun (BENCH_FACT): Each sample was measured by a separate runtime process, unlike same-process runs-based timing stability.
  - node: processRuns=3
  - bun: processRuns=3
- projection-contract-separated (BENCH_FACT): Projection rows are reported as selected-field projected records and are not full StAX event-parity rows.
- full-stax-counterexample-search (BENCH_FACT): No full-string row reported a 200 MiB/s bounded-memory counterexample in these independent process samples.
  - counterexample=not-found
