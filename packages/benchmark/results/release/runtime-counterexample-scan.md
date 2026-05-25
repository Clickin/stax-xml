# Runtime Counterexample Scan

Generated: 2026-05-25T15:47:37.103Z

This scan walks recognized throughput rows in primary release JSON artifacts and applies the broad counterexample rule mechanically: JavaScript runtime, 1 GiB+ fixture, full-string parity, bounded memory, and throughput at or above the threshold.

## Summary

- Scanned artifacts: 139
- Ignored derived artifacts: 5
- Measured rows recognized: 754
- Aggregate rows recognized: 89
- 1 GiB+ JS full-string rows recognized: 463
- 1 GiB+ JS full-string aggregate rows recognized: 69
- Rows with recognized source mode: 178
- 1 GiB+ JS full-string rows with recognized source mode: 129
- Rows with unknown full-string parity: 0
- Rows with unknown bounded-memory flag: 20
  - Unknown bounded-memory JS rows: 4
  - Unknown bounded-memory full-string rows: 20
  - Unknown bounded-memory 1 GiB+ JS full-string rows: 0
  - Unknown bounded-memory rows with memory counters: 10
- Counterexamples found: 0
- Partial/projection threshold rows: 22
- Text/CDATA materialization headroom rows: 3
- Full-string rows failing bounded-memory criterion: 91
  - Explicit boundedMemory=false rows: 91
  - Bounded flag without row-level memory proof: 0
  - Unknown bounded-memory flag rows: 0
  - Rows missing row-level memory proof: 48
- Fastest 1 GiB+ JS full-string row: Bun/JSC rawFrameNameId from access-shape-candidate-cross-process.json at 179.70 MiB/s (yes, process-rss)
- Fastest 1 GiB+ JS full-string row with memory proof: Bun/JSC rawFrameNameId from access-shape-candidate-cross-process.json at 179.70 MiB/s (yes, process-rss)
- Fastest 1 GiB+ JS full-string aggregate row with memory proof: Bun/JSC rawFrameNameId from access-shape-candidate-cross-process.json at avg 177.34 MiB/s (yes, process-rss, samples 3, spread 3.23%)
- Fastest partial/projection threshold row: Bun/JSC scanAllNoDecode from candidate-headroom-cross-process-books-corpus-partial.json at 326.65 MiB/s (yes, process-rss)
- Fastest text/CDATA materialization headroom row: Node/V8 withoutTextStrings from long-text-cache-materialization-candidate.json at 229.15 MiB/s (yes, process-rss)

## Counterexamples

| Artifact | Runtime | Row | Size GiB | MiB/s | Memory | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: |
| none | | | | | | | |

## Fastest 1 GiB+ Full-String JS Rows With Memory Proof

| Artifact | Runtime | Row | Size GiB | MiB/s | Bounded | Memory | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: |
| `access-shape-candidate-cross-process.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 179.70 | yes | process-rss | 57096514 | -540013997 |
| `bun-candidate-headroom-books-corpus-stability.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 178.52 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 178.34 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-books-corpus-stability.json` | Node/V8 | `rawFrameNameId` | 1.00 | 176.47 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-stability.json` | Node/V8 | `rawFrameNameId` | 1.00 | 175.40 | yes | process-rss | 57096514 | -540013997 |
| `text-cache-materialization-candidate-stability.json` | Node/V8 | `rawFrameNameId` | 1.00 | 175.02 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Node/V8 | `rawFrameNameId` | 1.00 | 174.93 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 173.98 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Node/V8 | `rawFrameNameId` | 1.00 | 173.31 | yes | process-rss | 57096514 | -540013997 |
| `long-ascii-text-materialization-candidate-stability.json` | Node/V8 | `rawFrameNameId` | 1.00 | 172.85 | yes | process-rss | 57096514 | -540013997 |
| `bun-candidate-headroom-books-corpus-stability.json` | Bun/JSC | `stringFull` | 1.00 | 171.35 | yes | process-rss | 57096514 | -540013997 |
| `text-cdata-cost-decomposition.json` | Node/V8 | `rawFrameNameId` | 1.00 | 170.95 | yes | process-rss | 57096514 | -540013997 |

## Fastest 1 GiB+ Full-String JS Rows Regardless Of Memory Proof

Rows in this table are useful for throughput triage, but rows without a row-level memory counter are not bounded-memory counterexamples.

| Artifact | Runtime | Row | Size GiB | MiB/s | Bounded | Memory | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: |
| `access-shape-candidate-cross-process.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 179.70 | yes | process-rss | 57096514 | -540013997 |
| `bun-candidate-headroom-books-corpus-stability.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 178.52 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 178.34 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-books-corpus-stability.json` | Node/V8 | `rawFrameNameId` | 1.00 | 176.47 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-stability.json` | Node/V8 | `rawFrameNameId` | 1.00 | 175.40 | yes | process-rss | 57096514 | -540013997 |
| `text-cache-materialization-candidate-stability.json` | Node/V8 | `rawFrameNameId` | 1.00 | 175.02 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Node/V8 | `rawFrameNameId` | 1.00 | 174.93 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 173.98 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Node/V8 | `rawFrameNameId` | 1.00 | 173.31 | yes | process-rss | 57096514 | -540013997 |
| `long-ascii-text-materialization-candidate-stability.json` | Node/V8 | `rawFrameNameId` | 1.00 | 172.85 | yes | process-rss | 57096514 | -540013997 |
| `bun-candidate-headroom-books-corpus-stability.json` | Bun/JSC | `stringFull` | 1.00 | 171.35 | yes | process-rss | 57096514 | -540013997 |
| `text-cdata-cost-decomposition.json` | Node/V8 | `rawFrameNameId` | 1.00 | 170.95 | yes | process-rss | 57096514 | -540013997 |

## Fastest 1 GiB+ Full-String JS Cross-Process Aggregate Rows With Memory Proof

Rows in this table are averages or aggregate summaries from cross-process artifacts. They are shown separately from individual child samples.

| Artifact | Runtime | Row | Size GiB | Avg MiB/s | Min | Max | Spread | Samples | Bounded | Memory | Events | Checksum |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: |
| `access-shape-candidate-cross-process.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 177.34 | 173.98 | 179.70 | 3.23% | 3 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Bun/JSC | `cursorAccessor` | 1.00 | 167.04 | 162.90 | 170.78 | 4.71% | 3 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Node/V8 | `cursorAccessor` | 1.00 | 161.48 | 158.69 | 166.29 | 4.70% | 3 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Node/V8 | `rawFrameNameId` | 1.00 | 147.13 | 93.16 | 174.93 | 55.58% | 3 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-cross-process-large-asset-corpus.json` | Node/V8 | `rawFrameNameId` | 1.08 | 146.11 | 135.93 | 158.52 | 15.46% | 3 | yes | process-rss | 83635224 | -2136498212 |
| `access-shape-candidate-cross-process.json` | Bun/JSC | `rawFrameDirect` | 1.00 | 139.83 | 139.17 | 140.29 | 0.80% | 3 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Node/V8 | `rawFrameDirect` | 1.00 | 136.98 | 107.58 | 153.09 | 33.23% | 3 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-cross-process-large-asset-corpus.json` | Node/V8 | `stringFull` | 1.08 | 130.10 | 118.78 | 139.02 | 15.56% | 3 | yes | process-rss | 83635224 | -2136498212 |
| `browser-candidate-headroom-cross-process-books-corpus.json` | Chrome/V8 | `rawFrameNameId` | 1.00 | 129.02 | 127.74 | 130.32 | 2.00% | 3 | yes | browser-js-heap | 57096514 | -540013997 |
| `candidate-headroom-cross-process-books-corpus-batch16.json` | Bun/JSC | `stringFull` | 1.00 | 123.45 | 122.87 | 123.76 | 0.72% | 3 | yes | process-rss | 57096514 | -540013997 |
| `browser-candidate-headroom-cross-process-books-corpus.json` | Chrome/V8 | `stringFull` | 1.00 | 121.27 | 120.26 | 123.09 | 2.33% | 3 | yes | browser-js-heap | 57096514 | -540013997 |
| `candidate-headroom-cross-process-books-corpus.json` | Bun/JSC | `stringFull` | 1.00 | 120.18 | 119.61 | 120.69 | 0.91% | 3 | yes | process-rss | 57096514 | -540013997 |

## Source Mode Breakdown For 1 GiB+ Full-String JS Rows

This table records input-consumption metadata when release rows or their source contracts expose it. It keeps synchronous byte-batch rows separate from direct ReadableStream rows and separates parser-demand-driven sources from Web Stream backpressure.

| Source mode | Rows | Full rows | Bounded full rows | Fastest MiB/s | Fastest row | Demand-driven rows | Stream backpressure rows |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| `generated-sync-iterable-byte-batches` | 108 | 108 | 99 | 179.70 | Bun/JSC rawFrameNameId from access-shape-candidate-cross-process.json | 108 | 0 |
| `file-backed-sync-iterable-byte-batches` | 18 | 18 | 18 | 135.13 | Node/V8 stax-stream stax-stream-batch-2 from file-backed-batch-size-sweep.json | 18 | 0 |
| `complete-js-string` | 1 | 1 | 0 | 41.10 | Bun/JSC 3 from bun-event-reader-string-large.json | 0 | 0 |
| `sync-iterable-byte-batches` | 1 | 1 | 1 | 124.49 | Node/V8 sync-iterable-byte-batches from stream-source-consumption-shapes.json | 1 | 0 |
| `web-readable-stream-pull` | 1 | 1 | 1 | 110.32 | Node/V8 web-readable-stream-pull from stream-source-consumption-shapes.json | 1 | 1 |

## Partial Or Projection Threshold Rows

These rows may show runtime/parser headroom, but they do not preserve the full-string StAX contract and therefore are not runtime-limit counterexamples.

| Artifact | Runtime | Row | Size GiB | MiB/s | Contract | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: |
| `candidate-headroom-cross-process-books-corpus-partial.json` | Bun/JSC | `scanAllNoDecode` | 1.00 | 326.65 | event-types-and-attribute-counts-only | 57096514 | -239086029 |
| `candidate-headroom-cross-process-books-corpus-partial.json` | Bun/JSC | `scanAllNoDecode` | 1.00 | 315.97 | event-types-and-attribute-counts-only | 57096514 | -239086029 |
| `candidate-headroom-cross-process-books-corpus-partial.json` | Bun/JSC | `scanAllNoDecode` | 1.00 | 300.90 | event-types-and-attribute-counts-only | 57096514 | -239086029 |
| `bun-candidate-headroom-books-corpus.json` | Bun/JSC | `attrNameStringOnly` | 1.00 | 293.91 | event-types-attribute-counts-and-attribute-names | 57096514 | 878766131 |
| `bun-candidate-headroom-books-corpus.json` | Bun/JSC | `scanAllNoDecode` | 1.00 | 292.97 | event-types-and-attribute-counts-only | 57096514 | -239086029 |
| `bun-candidate-headroom-books-corpus.json` | Bun/JSC | `attrValueStringOnly` | 1.00 | 277.37 | event-types-attribute-counts-and-attribute-values | 57096514 | -923412077 |
| `candidate-headroom-cross-process-books-corpus-partial.json` | Node/V8 | `scanAllNoDecode` | 1.00 | 274.91 | event-types-and-attribute-counts-only | 57096514 | -239086029 |
| `bun-candidate-headroom-books-corpus.json` | Bun/JSC | `nameStringOnly` | 1.00 | 265.67 | event-types-attribute-counts-and-element-names | 57096514 | -929151437 |
| `candidate-headroom-books-corpus.json` | Node/V8 | `attrNameStringOnly` | 1.00 | 265.23 | event-types-attribute-counts-and-attribute-names | 57096514 | 878766131 |
| `candidate-headroom-books-corpus.json` | Node/V8 | `scanAllNoDecode` | 1.00 | 261.73 | event-types-and-attribute-counts-only | 57096514 | -239086029 |
| `candidate-headroom-books-corpus.json` | Node/V8 | `attrValueStringOnly` | 1.00 | 259.73 | event-types-attribute-counts-and-attribute-values | 57096514 | -923412077 |
| `bun-candidate-headroom-projection-large.json` | Bun/JSC | `scanAllNoDecode` | 1.00 | 245.41 | event-types-and-attribute-counts-only | 60416563 | 830926359 |
| `candidate-headroom-books-corpus.json` | Node/V8 | `nameStringOnly` | 1.00 | 239.05 | event-types-attribute-counts-and-element-names | 57096514 | -929151437 |
| `candidate-headroom-cross-process-books-corpus-partial.json` | Node/V8 | `scanAllNoDecode` | 1.00 | 233.20 | event-types-and-attribute-counts-only | 57096514 | -239086029 |
| `long-text-cache-materialization-candidate.json` | Node/V8 | `withoutTextStrings` | 1.00 | 229.15 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `candidate-headroom-cross-process-books-corpus-partial.json` | Node/V8 | `scanAllNoDecode` | 1.00 | 227.08 | event-types-and-attribute-counts-only | 57096514 | -239086029 |
| `text-cdata-cost-decomposition.json` | Node/V8 | `withoutTextStrings` | 1.00 | 219.85 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `file-backed-core-decomposition.json` | Node/V8 | `stax-scan-all-no-decode` | 1.00 | 214.79 | partial-scan-no-string-materialization | 61236571 | -1830981171 |
| `browser-candidate-headroom-books-corpus.json` | Chrome/V8 | `attrNameStringOnly` | 1.00 | 209.12 | event-types-attribute-counts-and-attribute-names | 57096514 | 878766131 |
| `long-ascii-text-materialization-candidate-stability.json` | Node/V8 | `withoutTextStrings` | 1.00 | 207.70 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `browser-candidate-headroom-books-corpus.json` | Chrome/V8 | `scanAllNoDecode` | 1.00 | 206.76 | event-types-and-attribute-counts-only | 57096514 | -239086029 |
| `browser-candidate-headroom-books-corpus.json` | Chrome/V8 | `attrValueStringOnly` | 1.00 | 204.77 | event-types-attribute-counts-and-attribute-values | 57096514 | -923412077 |

## Text/CDATA Materialization Headroom Rows

These near-full rows still materialize element names and attributes, but omit text/CDATA strings. They identify a current headroom axis without satisfying full-string StAX parity.

| Artifact | Runtime | Row | Size GiB | MiB/s | Contract | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: |
| `long-text-cache-materialization-candidate.json` | Node/V8 | `withoutTextStrings` | 1.00 | 229.15 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `text-cdata-cost-decomposition.json` | Node/V8 | `withoutTextStrings` | 1.00 | 219.85 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `long-ascii-text-materialization-candidate-stability.json` | Node/V8 | `withoutTextStrings` | 1.00 | 207.70 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |

## Findings

- bounded-full-string-counterexample-search (NOT_FOUND_IN_RECOGNIZED_RELEASE_ROWS): No recognized release row currently meets the 200 MiB/s bounded full-string JS rule.
- partial-headroom-not-stax-counterexample (HEADROOM_EVIDENCE_PRESENT): 22 recognized 1 GiB+ partial/projection JavaScript row(s) reach the threshold but are not full-string StAX counterexamples.
- text-materialization-headroom (HEADROOM_EVIDENCE_PRESENT): 3 recognized 1 GiB+ near-full row(s) cross the threshold only after omitting text/CDATA string materialization.
- unbounded-or-unknown-full-rows-not-counterexamples (LIMITED_EVIDENCE_PRESENT): 91 recognized 1 GiB+ full-string JavaScript row(s) fail the bounded-memory counterexample criterion: 91 explicit boundedMemory=false, 0 bounded flag without row-level memory proof, 0 unknown bounded flag.
- measured-row-classification-complete (LIMITED_EVIDENCE_PRESENT): 754 recognized measured row(s) include fullStringParity and boundedMemory classifications; 0 have unknown fullStringParity and 20 have unknown boundedMemory.
- cross-process-aggregate-rows-separated (AGGREGATE_EVIDENCE_PRESENT): Cross-process aggregate rows are reported separately from individual sample rows so fastest-row triage does not hide average-throughput evidence.
- source-consumption-modes-separated (SOURCE_MODE_EVIDENCE_PRESENT): Recognized 1 GiB+ full-string rows expose source-mode metadata for generated-sync-iterable-byte-batches:108, file-backed-sync-iterable-byte-batches:18, complete-js-string:1, sync-iterable-byte-batches:1, web-readable-stream-pull:1.

## Limits

- This scan recognizes rows by common release JSON fields such as `mibPerSec`, `fullStringParity`, `boundedMemory`, and fixture size. Rows without those fields are not used as counterexample proof.
- A row must carry row-level memory evidence, not only a derived bounded flag, before it can satisfy the bounded-memory counterexample rule.
- A missing counterexample in this scan is not an impossibility proof. It only says the current recognized release rows do not contain one.
- Derived summary artifacts are ignored to avoid circular evidence.
