# Runtime Counterexample Scan

Generated: 2026-05-26T12:58:50.035Z

This scan walks recognized throughput rows in primary release JSON artifacts and applies the broad counterexample rule mechanically: JavaScript runtime, 1 GiB+ fixture, full-string parity, bounded memory, and throughput at or above the threshold.

## Summary

- Scanned artifacts: 166
- Ignored derived artifacts: 5
- Measured rows recognized: 861
- Aggregate rows recognized: 93
- 1 GiB+ JS full-string rows recognized: 536
- 1 GiB+ JS full-string aggregate rows recognized: 73
- Rows with recognized source mode: 284
- 1 GiB+ JS full-string rows with recognized source mode: 206
- Rows with unknown full-string parity: 0
- Rows with unknown bounded-memory flag: 20
  - Unknown bounded-memory JS rows: 4
  - Unknown bounded-memory full-string rows: 20
  - Unknown bounded-memory 1 GiB+ JS full-string rows: 0
  - Unknown bounded-memory rows with memory counters: 10
- Counterexamples found: 0
- Partial/projection threshold rows: 37
- Text/CDATA materialization headroom rows: 12
- Full-string rows failing bounded-memory criterion: 91
  - Explicit boundedMemory=false rows: 91
  - Bounded flag without row-level memory proof: 0
  - Unknown bounded-memory flag rows: 0
  - Rows missing row-level memory proof: 48
- Fastest 1 GiB+ JS full-string row: Node/V8 rawFrameNameId from text-trim-cost-decomposition.json at 185.50 MiB/s (yes, process-rss)
- Fastest 1 GiB+ JS full-string row with memory proof: Node/V8 rawFrameNameId from text-trim-cost-decomposition.json at 185.50 MiB/s (yes, process-rss)
- Fastest 1 GiB+ JS full-string aggregate row with memory proof: Bun/JSC rawFrameNameId from access-shape-candidate-cross-process.json at avg 177.34 MiB/s (yes, process-rss, samples 3, spread 3.23%)
- Fastest partial/projection threshold row: Node/V8 grouped-segment-scan from segment-scan-headroom.json at 682.83 MiB/s (yes, process-rss)
- Fastest text/CDATA materialization headroom row: Node/V8 withoutTextStrings from text-trim-cost-decomposition-4gib.json at 252.36 MiB/s (yes, process-rss)

## Counterexamples

| Artifact | Runtime | Row | Size GiB | MiB/s | Memory | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: |
| none | | | | | | | |

## Fastest 1 GiB+ Full-String JS Rows With Memory Proof

| Artifact | Runtime | Row | Size GiB | MiB/s | Bounded | Memory | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: |
| `text-trim-cost-decomposition.json` | Node/V8 | `rawFrameNameId` | 1.00 | 185.50 | yes | process-rss | 57096514 | -540013997 |
| `text-trim-cost-decomposition-2gib.json` | Node/V8 | `rawFrameNameId` | 2.00 | 184.92 | yes | process-rss | 114192784 | 1903859545 |
| `text-trim-cost-decomposition-8gib.json` | Node/V8 | `rawFrameNameId` | 8.00 | 184.03 | yes | process-rss | 456770888 | 734413569 |
| `access-shape-candidate-cross-process.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 179.70 | yes | process-rss | 57096514 | -540013997 |
| `text-trim-cost-decomposition-4gib.json` | Node/V8 | `rawFrameNameId` | 4.00 | 178.86 | yes | process-rss | 228385566 | -1067702969 |
| `bun-candidate-headroom-books-corpus-stability.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 178.52 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 178.34 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-books-corpus-stability.json` | Node/V8 | `rawFrameNameId` | 1.00 | 176.47 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-stability.json` | Node/V8 | `rawFrameNameId` | 1.00 | 175.40 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process-batch8.json` | Node/V8 | `rawFrameNameId` | 1.00 | 175.09 | yes | process-rss | 57096514 | -540013997 |
| `text-cache-materialization-candidate-stability.json` | Node/V8 | `rawFrameNameId` | 1.00 | 175.02 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Node/V8 | `rawFrameNameId` | 1.00 | 174.93 | yes | process-rss | 57096514 | -540013997 |

## Fastest 1 GiB+ Full-String JS Rows Regardless Of Memory Proof

Rows in this table are useful for throughput triage, but rows without a row-level memory counter are not bounded-memory counterexamples.

| Artifact | Runtime | Row | Size GiB | MiB/s | Bounded | Memory | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: |
| `text-trim-cost-decomposition.json` | Node/V8 | `rawFrameNameId` | 1.00 | 185.50 | yes | process-rss | 57096514 | -540013997 |
| `text-trim-cost-decomposition-2gib.json` | Node/V8 | `rawFrameNameId` | 2.00 | 184.92 | yes | process-rss | 114192784 | 1903859545 |
| `text-trim-cost-decomposition-8gib.json` | Node/V8 | `rawFrameNameId` | 8.00 | 184.03 | yes | process-rss | 456770888 | 734413569 |
| `access-shape-candidate-cross-process.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 179.70 | yes | process-rss | 57096514 | -540013997 |
| `text-trim-cost-decomposition-4gib.json` | Node/V8 | `rawFrameNameId` | 4.00 | 178.86 | yes | process-rss | 228385566 | -1067702969 |
| `bun-candidate-headroom-books-corpus-stability.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 178.52 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 178.34 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-books-corpus-stability.json` | Node/V8 | `rawFrameNameId` | 1.00 | 176.47 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-stability.json` | Node/V8 | `rawFrameNameId` | 1.00 | 175.40 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process-batch8.json` | Node/V8 | `rawFrameNameId` | 1.00 | 175.09 | yes | process-rss | 57096514 | -540013997 |
| `text-cache-materialization-candidate-stability.json` | Node/V8 | `rawFrameNameId` | 1.00 | 175.02 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Node/V8 | `rawFrameNameId` | 1.00 | 174.93 | yes | process-rss | 57096514 | -540013997 |

## Fastest 1 GiB+ Full-String JS Cross-Process Aggregate Rows With Memory Proof

Rows in this table are averages or aggregate summaries from cross-process artifacts. They are shown separately from individual child samples.

| Artifact | Runtime | Row | Size GiB | Avg MiB/s | Min | Max | Spread | Samples | Bounded | Memory | Events | Checksum |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: |
| `access-shape-candidate-cross-process.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 177.34 | 173.98 | 179.70 | 3.23% | 3 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process-batch8.json` | Node/V8 | `rawFrameNameId` | 1.00 | 172.66 | 169.86 | 175.09 | 3.03% | 3 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process-batch8.json` | Bun/JSC | `rawFrameNameId` | 1.00 | 167.07 | 166.19 | 167.94 | 1.05% | 3 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Bun/JSC | `cursorAccessor` | 1.00 | 167.04 | 162.90 | 170.78 | 4.71% | 3 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Node/V8 | `cursorAccessor` | 1.00 | 161.48 | 158.69 | 166.29 | 4.70% | 3 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process-batch8.json` | Bun/JSC | `cursorAccessor` | 1.00 | 157.32 | 156.52 | 158.68 | 1.38% | 3 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process-batch8.json` | Node/V8 | `cursorAccessor` | 1.00 | 156.70 | 156.11 | 157.14 | 0.66% | 3 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Node/V8 | `rawFrameNameId` | 1.00 | 147.13 | 93.16 | 174.93 | 55.58% | 3 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-cross-process-large-asset-corpus.json` | Node/V8 | `rawFrameNameId` | 1.08 | 146.11 | 135.93 | 158.52 | 15.46% | 3 | yes | process-rss | 83635224 | -2136498212 |
| `access-shape-candidate-cross-process.json` | Bun/JSC | `rawFrameDirect` | 1.00 | 139.83 | 139.17 | 140.29 | 0.80% | 3 | yes | process-rss | 57096514 | -540013997 |
| `access-shape-candidate-cross-process.json` | Node/V8 | `rawFrameDirect` | 1.00 | 136.98 | 107.58 | 153.09 | 33.23% | 3 | yes | process-rss | 57096514 | -540013997 |
| `candidate-headroom-cross-process-large-asset-corpus.json` | Node/V8 | `stringFull` | 1.08 | 130.10 | 118.78 | 139.02 | 15.56% | 3 | yes | process-rss | 83635224 | -2136498212 |

## Source Mode Breakdown For 1 GiB+ Full-String JS Rows

This table records input-consumption metadata when release rows or their source contracts expose it. It keeps synchronous byte-batch rows separate from direct ReadableStream rows and separates parser-demand-driven sources from Web Stream backpressure.

| Source mode | Rows | Full rows | Bounded full rows | Fastest MiB/s | Fastest row | Demand-driven rows | Direct ReadableStream rows | Stream backpressure rows | Not full ArrayBuffer rows |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| `generated-sync-iterable-byte-batches` | 156 | 156 | 147 | 185.50 | Node/V8 rawFrameNameId from text-trim-cost-decomposition.json | 156 | 0 | 0 | 156 |
| `file-backed-sync-iterable-byte-batches` | 47 | 47 | 46 | 152.11 | Node/V8 stax-raw-frame-name-id stax-raw-frame-name-id-batch-8 from file-backed-batch-size-sweep.json | 47 | 0 | 0 | 47 |
| `complete-js-string` | 1 | 1 | 0 | 41.10 | Bun/JSC 3 from bun-event-reader-string-large.json | 0 | 0 | 0 | 1 |
| `sync-iterable-byte-batches` | 1 | 1 | 1 | 123.07 | Node/V8 sync-iterable-byte-batches from stream-source-consumption-shapes.json | 1 | 0 | 0 | 1 |
| `web-readable-stream-pull` | 1 | 1 | 1 | 111.56 | Node/V8 web-readable-stream-pull from stream-source-consumption-shapes.json | 1 | 1 | 1 | 1 |

## Partial Or Projection Threshold Rows

These rows may show runtime/parser headroom, but they do not preserve the full-string StAX contract and therefore are not runtime-limit counterexamples.

| Artifact | Runtime | Row | Size GiB | MiB/s | Contract | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: |
| `segment-scan-headroom.json` | Node/V8 | `grouped-segment-scan` | 1.00 | 682.83 | delimiter-byte-scan-no-xml-parse-no-string-materialization | 162096810 | -428951732 |
| `segment-scan-headroom.json` | Node/V8 | `grouped-concat-scan` | 1.00 | 589.23 | delimiter-byte-scan-no-xml-parse-no-string-materialization | 162096810 | -428951732 |
| `segment-scan-headroom.json` | Node/V8 | `singleton-segment-scan` | 1.00 | 575.24 | delimiter-byte-scan-no-xml-parse-no-string-materialization | 162096810 | -428951732 |
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
| `text-trim-cost-decomposition-4gib.json` | Node/V8 | `withoutTextStrings` | 4.00 | 252.36 | full-materialization-minus-text-cdata | 228385566 | -933264309 |
| `text-trim-cost-decomposition.json` | Node/V8 | `withoutTextStrings` | 1.00 | 249.13 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `bun-candidate-headroom-projection-large.json` | Bun/JSC | `scanAllNoDecode` | 1.00 | 245.41 | event-types-and-attribute-counts-only | 60416563 | 830926359 |
| `text-trim-cost-decomposition-2gib.json` | Node/V8 | `withoutTextStrings` | 2.00 | 243.31 | full-materialization-minus-text-cdata | 114192784 | 223378117 |
| `segment-tokenizer-string-frontier.json` | Node/V8 | `tokenOnly` | 1.00 | 239.61 | xml-token-boundary-string-materialization-frontier | 61236569 | -1381363934 |
| `candidate-headroom-books-corpus.json` | Node/V8 | `nameStringOnly` | 1.00 | 239.05 | event-types-attribute-counts-and-element-names | 57096514 | -929151437 |
| `text-trim-cost-decomposition-8gib.json` | Node/V8 | `withoutTextStrings` | 8.00 | 237.38 | full-materialization-minus-text-cdata | 456770888 | 999272277 |
| `segment-tokenizer-headroom.json` | Node/V8 | `singleton-segment-tokenize` | 1.00 | 236.55 | xml-token-boundary-no-string-materialization | 61236569 | -1381363934 |
| `candidate-headroom-cross-process-books-corpus-partial.json` | Node/V8 | `scanAllNoDecode` | 1.00 | 233.20 | event-types-and-attribute-counts-only | 57096514 | -239086029 |
| `long-text-cache-materialization-candidate.json` | Node/V8 | `withoutTextStrings` | 1.00 | 229.15 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `candidate-headroom-cross-process-books-corpus-partial.json` | Node/V8 | `scanAllNoDecode` | 1.00 | 227.08 | event-types-and-attribute-counts-only | 57096514 | -239086029 |
| `medium-ascii-text-materialization-candidate.json` | Node/V8 | `withoutTextStrings` | 1.00 | 222.28 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `text-cdata-cost-decomposition.json` | Node/V8 | `withoutTextStrings` | 1.00 | 219.85 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `file-backed-core-decomposition.json` | Node/V8 | `stax-scan-all-no-decode` | 1.00 | 216.08 | partial-scan-no-string-materialization | 61236571 | -1830981171 |
| `offset-text-cache-materialization-candidate.json` | Node/V8 | `withoutTextStrings` | 1.00 | 216.04 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `unrolled-medium-ascii-text-trim-guard-candidate.json` | Node/V8 | `withoutTextStrings` | 1.00 | 215.70 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `unrolled-medium-ascii-text-materialization-candidate.json` | Node/V8 | `withoutTextStrings` | 1.00 | 214.41 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `medium-ascii-attr-value-materialization-candidate.json` | Node/V8 | `withoutTextStrings` | 1.00 | 213.11 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `file-backed-core-decomposition.json` | Node/V8 | `stax-raw-frame-span-stats` | 1.00 | 210.19 | partial-raw-frame-span-metadata-no-string-materialization | 61236571 | -1264359145 |
| `browser-candidate-headroom-books-corpus.json` | Chrome/V8 | `attrNameStringOnly` | 1.00 | 209.12 | event-types-attribute-counts-and-attribute-names | 57096514 | 878766131 |
| `long-ascii-text-materialization-candidate-stability.json` | Node/V8 | `withoutTextStrings` | 1.00 | 207.70 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `browser-candidate-headroom-books-corpus.json` | Chrome/V8 | `scanAllNoDecode` | 1.00 | 206.76 | event-types-and-attribute-counts-only | 57096514 | -239086029 |
| `browser-candidate-headroom-books-corpus.json` | Chrome/V8 | `attrValueStringOnly` | 1.00 | 204.77 | event-types-attribute-counts-and-attribute-values | 57096514 | -923412077 |

## Text/CDATA Materialization Headroom Rows

These near-full rows still materialize element names and attributes, but omit text/CDATA strings. They identify a current headroom axis without satisfying full-string StAX parity.

| Artifact | Runtime | Row | Size GiB | MiB/s | Contract | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: |
| `text-trim-cost-decomposition-4gib.json` | Node/V8 | `withoutTextStrings` | 4.00 | 252.36 | full-materialization-minus-text-cdata | 228385566 | -933264309 |
| `text-trim-cost-decomposition.json` | Node/V8 | `withoutTextStrings` | 1.00 | 249.13 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `text-trim-cost-decomposition-2gib.json` | Node/V8 | `withoutTextStrings` | 2.00 | 243.31 | full-materialization-minus-text-cdata | 114192784 | 223378117 |
| `text-trim-cost-decomposition-8gib.json` | Node/V8 | `withoutTextStrings` | 8.00 | 237.38 | full-materialization-minus-text-cdata | 456770888 | 999272277 |
| `long-text-cache-materialization-candidate.json` | Node/V8 | `withoutTextStrings` | 1.00 | 229.15 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `medium-ascii-text-materialization-candidate.json` | Node/V8 | `withoutTextStrings` | 1.00 | 222.28 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `text-cdata-cost-decomposition.json` | Node/V8 | `withoutTextStrings` | 1.00 | 219.85 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `offset-text-cache-materialization-candidate.json` | Node/V8 | `withoutTextStrings` | 1.00 | 216.04 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `unrolled-medium-ascii-text-trim-guard-candidate.json` | Node/V8 | `withoutTextStrings` | 1.00 | 215.70 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `unrolled-medium-ascii-text-materialization-candidate.json` | Node/V8 | `withoutTextStrings` | 1.00 | 214.41 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `medium-ascii-attr-value-materialization-candidate.json` | Node/V8 | `withoutTextStrings` | 1.00 | 213.11 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |
| `long-ascii-text-materialization-candidate-stability.json` | Node/V8 | `withoutTextStrings` | 1.00 | 207.70 | full-materialization-minus-text-cdata | 57096514 | 1372281363 |

## Findings

- bounded-full-string-counterexample-search (NOT_FOUND_IN_RECOGNIZED_RELEASE_ROWS): No recognized release row currently meets the 200 MiB/s bounded full-string JS rule.
- partial-headroom-not-stax-counterexample (HEADROOM_EVIDENCE_PRESENT): 37 recognized 1 GiB+ partial/projection JavaScript row(s) reach the threshold but are not full-string StAX counterexamples.
- text-materialization-headroom (HEADROOM_EVIDENCE_PRESENT): 12 recognized 1 GiB+ near-full row(s) cross the threshold only after omitting text/CDATA string materialization.
- unbounded-or-unknown-full-rows-not-counterexamples (LIMITED_EVIDENCE_PRESENT): 91 recognized 1 GiB+ full-string JavaScript row(s) fail the bounded-memory counterexample criterion: 91 explicit boundedMemory=false, 0 bounded flag without row-level memory proof, 0 unknown bounded flag.
- measured-row-classification-complete (LIMITED_EVIDENCE_PRESENT): 861 recognized measured row(s) include fullStringParity and boundedMemory classifications; 0 have unknown fullStringParity and 20 have unknown boundedMemory.
- cross-process-aggregate-rows-separated (AGGREGATE_EVIDENCE_PRESENT): Cross-process aggregate rows are reported separately from individual sample rows so fastest-row triage does not hide average-throughput evidence.
- source-consumption-modes-separated (SOURCE_MODE_EVIDENCE_PRESENT): Recognized 1 GiB+ full-string rows expose source-mode metadata for generated-sync-iterable-byte-batches:156, file-backed-sync-iterable-byte-batches:47, complete-js-string:1, sync-iterable-byte-batches:1, web-readable-stream-pull:1; not-full-ArrayBuffer parser-input rows are generated-sync-iterable-byte-batches:156/156, file-backed-sync-iterable-byte-batches:47/47, complete-js-string:1/1, sync-iterable-byte-batches:1/1, web-readable-stream-pull:1/1.

## Limits

- This scan recognizes rows by common release JSON fields such as `mibPerSec`, `fullStringParity`, `boundedMemory`, and fixture size. Rows without those fields are not used as counterexample proof.
- A row must carry row-level memory evidence, not only a derived bounded flag, before it can satisfy the bounded-memory counterexample rule.
- A missing counterexample in this scan is not an impossibility proof. It only says the current recognized release rows do not contain one.
- Derived summary artifacts are ignored to avoid circular evidence.
