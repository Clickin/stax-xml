# File-Backed Public Consumer Shape Sweep

Generated: 2026-05-26T21:50:19.460Z

Runs public StreamBatch full-string checksum consumer variants in separate Node processes over the same file-backed Iterable<Uint8Array[]> source. This tests whether small JavaScript consumer-shape changes expose headroom without changing the StAX API or checksum contract.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Source shape: file-backed sync Iterable<Uint8Array[]>
- Chunk KiB: 16
- Batch size: 1
- Fastest row: public-baseline 85.78 MiB/s, RSS 66.90 MiB
- Fastest / baseline ratio: 1.00x
- 200 MiB/s bounded full-string counterexamples: 0

## Rows

| Row | Implementation | MiB/s | Bounded | Max RSS | Events | Checksum |
| --- | --- | ---: | --- | ---: | ---: | ---: |
| `public-baseline` | public StreamBatch accessor loop matching external-baseline stax-stream | 85.78 | yes | 66.90 MiB | 61236571 | -716099804 |
| `public-no-optional-text` | public StreamBatch accessor loop with explicit text undefined check instead of optional chaining | 85.05 | yes | 67.08 MiB | 61236571 | -716099804 |
| `public-switch-dispatch` | public StreamBatch accessor loop using switch dispatch and explicit text undefined check | 80.63 | yes | 67.11 MiB | 61236571 | -716099804 |
| `public-event-object` | public event objects materialized from file-backed StreamBatch rows | 60.71 | yes | 133.07 MiB | 61236571 | -716099804 |
| `public-event-object-stable-shape` | public event objects with stable own-property shape `{ type, name, value, attributes }` | 62.32 | yes | 133.71 MiB | 61236571 | -716099804 |

## Findings

- same-contract-preserved (CONTRACT_FACT): All public consumer-shape rows preserve the same full-string checksum contract.
  - eventCounts=61236571
  - checksums=-716099804
- consumer-shape-headroom (BENCH_FACT): Fastest public consumer shape was public-baseline at 85.78 MiB/s (1.00x baseline).
  - public-baseline=85.78 MiB/s rss=66.90 MiB
  - public-no-optional-text=85.05 MiB/s rss=67.08 MiB
  - public-switch-dispatch=80.63 MiB/s rss=67.11 MiB
  - public-event-object=60.71 MiB/s rss=133.07 MiB
  - public-event-object-stable-shape=62.32 MiB/s rss=133.71 MiB
- streaming-public-object-contract (CONTRACT_FACT): The public-event-object row materializes per-event JavaScript objects from file-backed StreamBatch data without full XML string preload.
  - events=61236571, objects=61236571, source=file-backed-sync-iterable-byte-batches
- bounded-counterexample-search (COUNTEREXAMPLE_NOT_FOUND): The consumer-shape sweep applies the same 200 MiB/s bounded full-string counterexample rule.
  - public-baseline: bounded=true, mibPerSec=85.78
  - public-no-optional-text: bounded=true, mibPerSec=85.05
  - public-switch-dispatch: bounded=true, mibPerSec=80.63
  - public-event-object: bounded=true, mibPerSec=60.71
  - public-event-object-stable-shape: bounded=true, mibPerSec=62.32

## Limits

- This changes only JavaScript consumer shape over the public StreamBatch API; it does not change parser internals.
- `public-event-object` creates public JavaScript event objects from file-backed `StreamBatch` rows; it is not the full-string `EventReaderSync(readFileSync(..., "utf8"))` path.
- A missing counterexample in this artifact is not a JavaScript runtime ceiling proof.
- This should be read together with `file-backed-v8-codegen-trace.md` because throughput and deopt behavior are separate evidence types.

