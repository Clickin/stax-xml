# Runtime Counterexample Scan

Generated: 2026-05-24T05:53:48.308Z

This scan walks recognized throughput rows in primary release JSON artifacts and applies the broad counterexample rule mechanically: JavaScript runtime, 1 GiB+ fixture, full-string parity, bounded memory, and throughput at or above the threshold.

## Summary

- Scanned artifacts: 65
- Ignored derived artifacts: 5
- Measured rows recognized: 378
- 1 GiB+ JS full-string rows recognized: 169
- Counterexamples found: 0
- Partial/projection threshold rows: 1
- Full-string rows without bounded-memory proof: 74
- Fastest 1 GiB+ JS full-string row: Bun/JSC stringFull from candidate-headroom-cross-process-projection.json at 97.82 MiB/s (flag-only, not-recorded)
- Fastest 1 GiB+ JS full-string row with memory proof: Bun/JSC rawFrameNameId from bun-candidate-headroom-projection-large.json at 84.68 MiB/s (yes, process-rss)
- Fastest partial/projection threshold row: Bun/JSC scanAllNoDecode from bun-candidate-headroom-projection-large.json at 245.41 MiB/s (yes, process-rss)

## Counterexamples

| Artifact | Runtime | Row | Size GiB | MiB/s | Memory | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: |
| none | | | | | | | |

## Fastest 1 GiB+ Full-String JS Rows With Memory Proof

| Artifact | Runtime | Row | Size GiB | MiB/s | Bounded | Memory | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: |
| `bun-candidate-headroom-projection-large.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 84.68 | yes | process-rss | 60416563 | 1441552024 |
| `bun-candidate-headroom-projection-stability.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 83.10 | yes | process-rss | 60416563 | 1441552024 |
| `candidate-headroom-projection-large.json` | Node/V8 | `rawFrameNameId` | 1.00 | 82.91 | yes | process-rss | 60416563 | 1441552024 |
| `candidate-headroom-projection-stability.json` | Node/V8 | `rawFrameNameId` | 1.00 | 82.47 | yes | process-rss | 60416563 | 1441552024 |
| `bun-candidate-headroom-projection-large.json` | Bun/JSC | `cursorAccessor` | 1.00 | 80.14 | yes | process-rss | 60416563 | 1441552024 |
| `bun-candidate-headroom-projection-stability.json` | Bun/JSC | `cursorAccessor` | 1.00 | 77.98 | yes | process-rss | 60416563 | 1441552024 |
| `candidate-headroom-projection-large.json` | Node/V8 | `cursorAccessor` | 1.00 | 77.29 | yes | process-rss | 60416563 | 1441552024 |
| `bun-candidate-headroom-projection-large.json` | Bun/JSC | `stringFull` | 1.00 | 77.04 | yes | process-rss | 60416563 | 1441552024 |
| `candidate-headroom-corpus.json` | Node/V8 | `rawFrameNameId` | 1.00 | 77.00 | yes | process-rss | 75206126 | -925527041 |
| `bun-candidate-headroom-projection-stability.json` | Bun/JSC | `stringFull` | 1.00 | 76.77 | yes | process-rss | 60416563 | 1441552024 |
| `candidate-headroom-projection-stability.json` | Node/V8 | `stringFull` | 1.00 | 75.94 | yes | process-rss | 60416563 | 1441552024 |
| `candidate-headroom-projection-large.json` | Node/V8 | `rawFrameDirect` | 1.00 | 74.48 | yes | process-rss | 60416563 | 1441552024 |

## Fastest 1 GiB+ Full-String JS Rows Regardless Of Memory Proof

Rows in this table are useful for throughput triage, but rows without a row-level memory counter are not bounded-memory counterexamples.

| Artifact | Runtime | Row | Size GiB | MiB/s | Bounded | Memory | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: |
| `candidate-headroom-cross-process-projection.json` | Bun/JSC | `stringFull` | 1.00 | 97.82 | flag-only | not-recorded | 60416563 | 1441552024 |
| `candidate-headroom-cross-process-projection.json` | Bun/JSC | `stringFull` | 1.00 | 97.70 | flag-only | not-recorded | 60416563 | 1441552024 |
| `candidate-headroom-cross-process-projection.json` | Bun/JSC | `stringFull` | 1.00 | 97.48 | flag-only | not-recorded | 60416563 | 1441552024 |
| `candidate-headroom-cross-process-projection.json` | Node/V8 | `stringFull` | 1.00 | 95.52 | flag-only | not-recorded | 60416563 | 1441552024 |
| `candidate-headroom-cross-process-projection.json` | Node/V8 | `stringFull` | 1.00 | 94.87 | flag-only | not-recorded | 60416563 | 1441552024 |
| `candidate-headroom-cross-process-projection.json` | Deno/V8 | `stringFull` | 1.00 | 87.62 | flag-only | not-recorded | 60416563 | 1441552024 |
| `candidate-headroom-cross-process-projection.json` | Deno/V8 | `stringFull` | 1.00 | 87.37 | flag-only | not-recorded | 60416563 | 1441552024 |
| `candidate-headroom-cross-process-projection.json` | Deno/V8 | `stringFull` | 1.00 | 87.28 | flag-only | not-recorded | 60416563 | 1441552024 |
| `candidate-headroom-cross-process-projection.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 84.97 | flag-only | not-recorded | 60416563 | 1441552024 |
| `bun-candidate-headroom-projection-large.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 84.68 | yes | process-rss | 60416563 | 1441552024 |
| `candidate-headroom-cross-process-projection.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 83.82 | flag-only | not-recorded | 60416563 | 1441552024 |
| `bun-candidate-headroom-projection-stability.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 83.10 | yes | process-rss | 60416563 | 1441552024 |

## Partial Or Projection Threshold Rows

These rows may show runtime/parser headroom, but they do not preserve the full-string StAX contract and therefore are not runtime-limit counterexamples.

| Artifact | Runtime | Row | Size GiB | MiB/s | Contract | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: |
| `bun-candidate-headroom-projection-large.json` | Bun/JSC | `scanAllNoDecode` | 1.00 | 245.41 | event-types-and-attribute-counts-only | 60416563 | 830926359 |

## Findings

- bounded-full-string-counterexample-search (NOT_FOUND_IN_RECOGNIZED_RELEASE_ROWS): No recognized release row currently meets the 200 MiB/s bounded full-string JS rule.
- partial-headroom-not-stax-counterexample (HEADROOM_EVIDENCE_PRESENT): 1 recognized 1 GiB+ partial/projection JavaScript row(s) reach the threshold but are not full-string StAX counterexamples.
- unbounded-or-unknown-full-rows-not-counterexamples (LIMITED_EVIDENCE_PRESENT): 74 recognized 1 GiB+ full-string JavaScript row(s) lack bounded-memory proof and cannot close the counterexample rule.

## Limits

- This scan recognizes rows by common release JSON fields such as `mibPerSec`, `fullStringParity`, `boundedMemory`, and fixture size. Rows without those fields are not used as counterexample proof.
- A row must carry row-level memory evidence, not only a derived bounded flag, before it can satisfy the bounded-memory counterexample rule.
- A missing counterexample in this scan is not an impossibility proof. It only says the current recognized release rows do not contain one.
- Derived summary artifacts are ignored to avoid circular evidence.
