# Candidate Headroom Cross-Process Stability

Generated: 2026-05-25T05:53:03.817Z

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
- Cases: scanAllNoDecode, attrNameStringOnly, attrValueStringOnly, nameStringOnly

## Source Contract

- Multi-chunk batch cost: Each child process invokes candidate-headroom-large.mjs. With the current sync cursor, batchSize=1 can scan a single Uint8Array view, while batchSize>1 groups chunks and triggers multi-chunk concatenation before parser scanning.
- Child source contract: The current sync cursor can use a single Uint8Array batch item as a view, but a batch containing multiple Uint8Array chunks is concatenated into one parser buffer before scanning.

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\cross-process\candidate-headroom-books-corpus-partial
- Committed: no

## Runtime: node

- Engine: V8
- Node: v24.15.0
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture bytes: 1073744736

| Variant | Count kind | Avg throughput | Min | Max | Spread | Samples | Stable result | Bounded all | Counterexample | Max RSS |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| scanAllNoDecode | stream-events | 245.06 MiB/s | 227.08 MiB/s | 274.91 MiB/s | 19.5% | 233.20, 274.91, 227.08 | yes | yes | not-found | 68.7 MiB |
| attrNameStringOnly | stream-events | 154.61 MiB/s | 150.19 MiB/s | 158.15 MiB/s | 5.1% | 155.49, 150.19, 158.15 | yes | yes | not-found | 72.8 MiB |
| attrValueStringOnly | stream-events | 154.51 MiB/s | 152.47 MiB/s | 156.88 MiB/s | 2.8% | 156.88, 152.47, 154.18 | yes | yes | not-found | 72.9 MiB |
| nameStringOnly | stream-events | 133.34 MiB/s | 130.06 MiB/s | 135.26 MiB/s | 3.9% | 130.06, 134.70, 135.26 | yes | yes | not-found | 73.4 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: n/a
- Partial stream rows stable across processes: yes
- Partial stream rows: scanAllNoDecode, attrNameStringOnly, attrValueStringOnly, nameStringOnly
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
| scanAllNoDecode | stream-events | 314.50 MiB/s | 300.90 MiB/s | 326.65 MiB/s | 8.2% | 300.90, 326.65, 315.97 | yes | yes | not-found | 170.0 MiB |
| attrNameStringOnly | stream-events | 173.56 MiB/s | 172.15 MiB/s | 175.46 MiB/s | 1.9% | 173.07, 175.46, 172.15 | yes | yes | not-found | 169.9 MiB |
| attrValueStringOnly | stream-events | 166.49 MiB/s | 164.78 MiB/s | 169.41 MiB/s | 2.8% | 164.78, 169.41, 165.27 | yes | yes | not-found | 170.3 MiB |
| nameStringOnly | stream-events | 149.76 MiB/s | 147.14 MiB/s | 151.37 MiB/s | 2.8% | 147.14, 151.37, 150.76 | yes | yes | not-found | 171.7 MiB |

### Parity

- Full-string stream rows stable across processes: yes
- Full-string stream rows: n/a
- Partial stream rows stable across processes: yes
- Partial stream rows: scanAllNoDecode, attrNameStringOnly, attrValueStringOnly, nameStringOnly
- Projection rows stable across processes: yes
- Projection rows: n/a

## Findings

- independent-process-rerun (BENCH_FACT): Each sample was measured by a separate runtime process, unlike same-process runs-based timing stability.
  - node: processRuns=3
  - bun: processRuns=3
- projection-contract-separated (BENCH_FACT): Projection rows are reported as selected-field projected records and are not full StAX event-parity rows.
- partial-contract-separated (BENCH_FACT): Partial stream rows report selected parser work and are not full StAX event-parity rows.
  - node: scanAllNoDecode
  - node: attrNameStringOnly
  - node: attrValueStringOnly
  - node: nameStringOnly
  - bun: scanAllNoDecode
  - bun: attrNameStringOnly
  - bun: attrValueStringOnly
  - bun: nameStringOnly
- full-stax-counterexample-search (BENCH_FACT): No full-string row reported a 200 MiB/s bounded-memory counterexample in these independent process samples.
  - counterexample=not-found
