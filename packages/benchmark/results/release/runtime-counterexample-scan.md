# Runtime Counterexample Scan

Generated: 2026-05-25T01:03:55.798Z

This scan walks recognized throughput rows in primary release JSON artifacts and applies the broad counterexample rule mechanically: JavaScript runtime, 1 GiB+ fixture, full-string parity, bounded memory, and throughput at or above the threshold.

## Summary

- Scanned artifacts: 115
- Ignored derived artifacts: 5
- Measured rows recognized: 665
- 1 GiB+ JS full-string rows recognized: 405
- Counterexamples found: 0
- Partial/projection threshold rows: 12
- Full-string rows without bounded-memory proof: 90
- Fastest 1 GiB+ JS full-string row: Node/V8 rawFrameNameId from candidate-headroom-cross-process-books-corpus.json at 180.08 MiB/s (yes, process-rss)
- Fastest 1 GiB+ JS full-string row with memory proof: Node/V8 rawFrameNameId from candidate-headroom-cross-process-books-corpus.json at 180.08 MiB/s (yes, process-rss)
- Fastest partial/projection threshold row: Bun/JSC attrNameStringOnly from bun-candidate-headroom-books-corpus.json at 293.91 MiB/s (yes, process-rss)

## Counterexamples

| Artifact | Runtime | Row | Size GiB | MiB/s | Memory | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: |
| none | | | | | | | |

## Fastest 1 GiB+ Full-String JS Rows With Memory Proof

| Artifact | Runtime | Row | Size GiB | MiB/s | Bounded | Memory | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: |
| `candidate-headroom-cross-process-books-corpus.json` | Node/V8 | `rawFrameNameId` | 1.00 | 180.08 | yes | process-rss | 57096514 | -540013997 |
| `bun-candidate-headroom-books-corpus-stability.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 178.52 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-cross-process-books-corpus.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 177.18 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-cross-process-books-corpus.json` | Node/V8 | `rawFrameNameId` | 1.00 | 176.61 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-books-corpus-stability.json` | Node/V8 | `rawFrameNameId` | 1.00 | 176.47 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-cross-process-books-corpus.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 173.15 | yes | process-rss | 57096514 | -540013997 |
| `bun-candidate-headroom-books-corpus-stability.json` | Bun/JSC | `stringFull` | 1.00 | 171.35 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-cross-process-books-corpus.json` | Bun/JSC | `stringFull` | 1.00 | 170.51 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-cross-process-books-corpus.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 169.34 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-books-corpus.json` | Node/V8 | `rawFrameNameId` | 1.00 | 166.27 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-cross-process-books-corpus.json` | Node/V8 | `stringFull` | 1.00 | 165.92 | yes | process-rss | 57096514 | -540013997 |
| `bun-candidate-headroom-books-corpus.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 163.24 | yes | process-rss | 57096514 | -540013997 |

## Fastest 1 GiB+ Full-String JS Rows Regardless Of Memory Proof

Rows in this table are useful for throughput triage, but rows without a row-level memory counter are not bounded-memory counterexamples.

| Artifact | Runtime | Row | Size GiB | MiB/s | Bounded | Memory | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: |
| `candidate-headroom-cross-process-books-corpus.json` | Node/V8 | `rawFrameNameId` | 1.00 | 180.08 | yes | process-rss | 57096514 | -540013997 |
| `bun-candidate-headroom-books-corpus-stability.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 178.52 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-cross-process-books-corpus.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 177.18 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-cross-process-books-corpus.json` | Node/V8 | `rawFrameNameId` | 1.00 | 176.61 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-books-corpus-stability.json` | Node/V8 | `rawFrameNameId` | 1.00 | 176.47 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-cross-process-books-corpus.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 173.15 | yes | process-rss | 57096514 | -540013997 |
| `bun-candidate-headroom-books-corpus-stability.json` | Bun/JSC | `stringFull` | 1.00 | 171.35 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-cross-process-books-corpus.json` | Bun/JSC | `stringFull` | 1.00 | 170.51 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-cross-process-books-corpus.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 169.34 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-books-corpus.json` | Node/V8 | `rawFrameNameId` | 1.00 | 166.27 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-cross-process-books-corpus.json` | Node/V8 | `stringFull` | 1.00 | 165.92 | yes | process-rss | 57096514 | -540013997 |
| `bun-candidate-headroom-books-corpus.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 163.24 | yes | process-rss | 57096514 | -540013997 |

## Partial Or Projection Threshold Rows

These rows may show runtime/parser headroom, but they do not preserve the full-string StAX contract and therefore are not runtime-limit counterexamples.

| Artifact | Runtime | Row | Size GiB | MiB/s | Contract | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: |
| `bun-candidate-headroom-books-corpus.json` | Bun/JSC | `attrNameStringOnly` | 1.00 | 293.91 | event-types-attribute-counts-and-attribute-names | 57096514 | 878766131 |
| `bun-candidate-headroom-books-corpus.json` | Bun/JSC | `scanAllNoDecode` | 1.00 | 292.97 | event-types-and-attribute-counts-only | 57096514 | -239086029 |
| `bun-candidate-headroom-books-corpus.json` | Bun/JSC | `attrValueStringOnly` | 1.00 | 277.37 | event-types-attribute-counts-and-attribute-values | 57096514 | -923412077 |
| `bun-candidate-headroom-books-corpus.json` | Bun/JSC | `nameStringOnly` | 1.00 | 265.67 | event-types-attribute-counts-and-element-names | 57096514 | -929151437 |
| `candidate-headroom-books-corpus.json` | Node/V8 | `attrNameStringOnly` | 1.00 | 265.23 | event-types-attribute-counts-and-attribute-names | 57096514 | 878766131 |
| `candidate-headroom-books-corpus.json` | Node/V8 | `scanAllNoDecode` | 1.00 | 261.73 | event-types-and-attribute-counts-only | 57096514 | -239086029 |
| `candidate-headroom-books-corpus.json` | Node/V8 | `attrValueStringOnly` | 1.00 | 259.73 | event-types-attribute-counts-and-attribute-values | 57096514 | -923412077 |
| `bun-candidate-headroom-projection-large.json` | Bun/JSC | `scanAllNoDecode` | 1.00 | 245.41 | event-types-and-attribute-counts-only | 60416563 | 830926359 |
| `candidate-headroom-books-corpus.json` | Node/V8 | `nameStringOnly` | 1.00 | 239.05 | event-types-attribute-counts-and-element-names | 57096514 | -929151437 |
| `browser-candidate-headroom-books-corpus.json` | Chrome/V8 | `attrNameStringOnly` | 1.00 | 209.12 | event-types-attribute-counts-and-attribute-names | 57096514 | 878766131 |
| `browser-candidate-headroom-books-corpus.json` | Chrome/V8 | `scanAllNoDecode` | 1.00 | 206.76 | event-types-and-attribute-counts-only | 57096514 | -239086029 |
| `browser-candidate-headroom-books-corpus.json` | Chrome/V8 | `attrValueStringOnly` | 1.00 | 204.77 | event-types-attribute-counts-and-attribute-values | 57096514 | -923412077 |

## Findings

- bounded-full-string-counterexample-search (NOT_FOUND_IN_RECOGNIZED_RELEASE_ROWS): No recognized release row currently meets the 200 MiB/s bounded full-string JS rule.
- partial-headroom-not-stax-counterexample (HEADROOM_EVIDENCE_PRESENT): 12 recognized 1 GiB+ partial/projection JavaScript row(s) reach the threshold but are not full-string StAX counterexamples.
- unbounded-or-unknown-full-rows-not-counterexamples (LIMITED_EVIDENCE_PRESENT): 90 recognized 1 GiB+ full-string JavaScript row(s) lack bounded-memory proof and cannot close the counterexample rule.

## Limits

- This scan recognizes rows by common release JSON fields such as `mibPerSec`, `fullStringParity`, `boundedMemory`, and fixture size. Rows without those fields are not used as counterexample proof.
- A row must carry row-level memory evidence, not only a derived bounded flag, before it can satisfy the bounded-memory counterexample rule.
- A missing counterexample in this scan is not an impossibility proof. It only says the current recognized release rows do not contain one.
- Derived summary artifacts are ignored to avoid circular evidence.
