# File-Backed Public Consumer Shape Sweep

Generated: 2026-05-25T02:38:48.697Z

Runs public StreamBatch full-string checksum consumer variants in separate Node processes over the same file-backed Iterable<Uint8Array[]> source. This tests whether small JavaScript consumer-shape changes expose headroom without changing the StAX API or checksum contract.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Source shape: file-backed sync Iterable<Uint8Array[]>
- Chunk KiB: 64
- Batch size: 1
- Fastest row: public-no-optional-text 133.67 MiB/s, RSS 70.91 MiB
- Fastest / baseline ratio: 1.03x
- 200 MiB/s bounded full-string counterexamples: 0

## Rows

| Row | Implementation | MiB/s | Bounded | Max RSS | Events | Checksum |
| --- | --- | ---: | --- | ---: | ---: | ---: |
| `public-baseline` | public StreamBatch accessor loop matching external-baseline stax-stream | 130.37 | yes | 70.68 MiB | 61236571 | -716099804 |
| `public-no-optional-text` | public StreamBatch accessor loop with explicit text undefined check instead of optional chaining | 133.67 | yes | 70.91 MiB | 61236571 | -716099804 |
| `public-switch-dispatch` | public StreamBatch accessor loop using switch dispatch and explicit text undefined check | 114.22 | yes | 71.02 MiB | 61236571 | -716099804 |
| `public-event-object` | public event objects materialized from file-backed StreamBatch rows | 95.35 | yes | 137.93 MiB | 61236571 | -716099804 |

## Findings

- same-contract-preserved (CONTRACT_FACT): All public consumer-shape rows preserve the same full-string checksum contract.
  - eventCounts=61236571
  - checksums=-716099804
- consumer-shape-headroom (HEADROOM_EVIDENCE): Fastest public consumer shape was public-no-optional-text at 133.67 MiB/s (1.03x baseline).
  - public-baseline=130.37 MiB/s rss=70.68 MiB
  - public-no-optional-text=133.67 MiB/s rss=70.91 MiB
  - public-switch-dispatch=114.22 MiB/s rss=71.02 MiB
  - public-event-object=95.35 MiB/s rss=137.93 MiB
- streaming-public-object-contract (CONTRACT_FACT): The public-event-object row materializes per-event JavaScript objects from file-backed StreamBatch data without full XML string preload.
  - events=61236571, objects=61236571, source=file-backed-sync-iterable-byte-batches
- bounded-counterexample-search (COUNTEREXAMPLE_NOT_FOUND): The consumer-shape sweep applies the same 200 MiB/s bounded full-string counterexample rule.
  - public-baseline: bounded=true, mibPerSec=130.37
  - public-no-optional-text: bounded=true, mibPerSec=133.67
  - public-switch-dispatch: bounded=true, mibPerSec=114.22
  - public-event-object: bounded=true, mibPerSec=95.35

## Limits

- This changes only JavaScript consumer shape over the public StreamBatch API; it does not change parser internals.
- `public-event-object` creates public JavaScript event objects from file-backed `StreamBatch` rows; it is not the full-string `EventReaderSync(readFileSync(..., "utf8"))` path.
- A missing counterexample in this artifact is not a JavaScript runtime ceiling proof.
- This should be read together with `file-backed-v8-codegen-trace.md` because throughput and deopt behavior are separate evidence types.

