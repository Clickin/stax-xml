# File-Backed Public Consumer Shape Sweep

Generated: 2026-05-25T00:25:08.081Z

Runs public StreamBatch full-string checksum consumer variants in separate Node processes over the same file-backed Iterable<Uint8Array[]> source. This tests whether small JavaScript consumer-shape changes expose headroom without changing the StAX API or checksum contract.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Source shape: file-backed sync Iterable<Uint8Array[]>
- Chunk KiB: 64
- Batch size: 1
- Fastest row: public-baseline 96.22 MiB/s, RSS 68.15 MiB
- Fastest / baseline ratio: 1.00x
- 200 MiB/s bounded full-string counterexamples: 0

## Rows

| Row | Implementation | MiB/s | Bounded | Max RSS | Events | Checksum |
| --- | --- | ---: | --- | ---: | ---: | ---: |
| `public-baseline` | public StreamBatch accessor loop matching external-baseline stax-stream | 96.22 | yes | 68.15 MiB | 61236571 | -716099804 |
| `public-no-optional-text` | public StreamBatch accessor loop with explicit text undefined check instead of optional chaining | 93.87 | yes | 67.72 MiB | 61236571 | -716099804 |
| `public-switch-dispatch` | public StreamBatch accessor loop using switch dispatch and explicit text undefined check | 85.00 | yes | 68.30 MiB | 61236571 | -716099804 |

## Findings

- same-contract-preserved (CONTRACT_FACT): All public consumer-shape rows preserve the same full-string checksum contract.
  - eventCounts=61236571
  - checksums=-716099804
- consumer-shape-headroom (BENCH_FACT): Fastest public consumer shape was public-baseline at 96.22 MiB/s (1.00x baseline).
  - public-baseline=96.22 MiB/s rss=68.15 MiB
  - public-no-optional-text=93.87 MiB/s rss=67.72 MiB
  - public-switch-dispatch=85.00 MiB/s rss=68.30 MiB
- bounded-counterexample-search (COUNTEREXAMPLE_NOT_FOUND): The consumer-shape sweep applies the same 200 MiB/s bounded full-string counterexample rule.
  - public-baseline: bounded=true, mibPerSec=96.22
  - public-no-optional-text: bounded=true, mibPerSec=93.87
  - public-switch-dispatch: bounded=true, mibPerSec=85.00

## Limits

- This changes only JavaScript consumer shape over the public StreamBatch API; it does not change parser internals.
- A missing counterexample in this artifact is not a JavaScript runtime ceiling proof.
- This should be read together with `file-backed-v8-codegen-trace.md` because throughput and deopt behavior are separate evidence types.

