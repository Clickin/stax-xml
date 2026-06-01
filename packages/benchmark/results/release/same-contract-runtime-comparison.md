# Same-Contract Runtime Comparison

Generated: 2026-06-01T09:33:02.839Z

This report aggregates existing release artifacts. It compares rows only through the same full-string checksum contract; it does not assert identical object shape, identical allocation models, or a JavaScript runtime ceiling.

## Summary

- Aggregated rows: 289
- 1 GiB+ JavaScript full-string rows: 239
- 200 MiB/s+ bounded-memory JavaScript counterexamples found: 0
- Fastest aggregated 1 GiB+ JS full-string row: Node/V8 rawFrameNameId at 185.50 MiB/s (process RSS max 60.45 MiB)
- Fastest JS full-string row vs 200 MiB/s: 0.93x, 14.50 MiB/s remaining
- Fastest JS full-string row vs 1024 MiB Woodstox reference: 0.55x Woodstox, 118.67 MiB/s below 0.9x reference target
- Same-fixture 1024 MiB JS row vs Woodstox target: stax-raw-frame-name-id-batch-8 at 0.43x Woodstox, 164.29 MiB/s below 0.9x target
- Same-fixture 1024 MiB JS row vs quick-xml target: stax-raw-frame-name-id-batch-8 at 0.55x quick-xml, 95.06 MiB/s below 0.9x target
- Same-fixture 1024 MiB process RSS snapshot: JS 61.77 MiB, Woodstox 312.71 MiB, quick-xml 4.78 MiB
- Fastest 1 GiB+ JS public event-object row: Node/V8 eventObjectFull at 141.62 MiB/s (process RSS max 203.27 MiB)
- Fastest bounded 1 GiB+ JS public event-object row: Node/V8 eventObjectFull at 141.62 MiB/s (process RSS max 203.27 MiB)
- Fastest bounded public event-object row vs 200 MiB/s: 0.71x, 58.38 MiB/s remaining
- Fastest bounded public event-object row vs 1024 MiB Woodstox reference: 0.42x Woodstox, 162.55 MiB/s below 0.9x reference target
- 1 GiB+ JS full-string memory frontier: 222/239 bounded rows; fastest bounded row Node/V8 rawFrameNameId at 185.50 MiB/s (process RSS max 60.45 MiB)
- 16 MiB Woodstox baseline: 303.10 MiB/s
- 16 MiB quick-xml baseline: 243.43 MiB/s (0.80x Woodstox)
- 1024 MiB file-backed stax-stream baseline: 124.62 MiB/s (0.37x Woodstox)
- 1024 MiB file-backed rawFrameNameId baseline: 132.54 MiB/s (0.39x Woodstox)
- 1024 MiB Woodstox baseline: 337.97 MiB/s
- 1024 MiB quick-xml baseline: 270.26 MiB/s (0.80x Woodstox)
- Recognized JS source modes: fetch-async-iterable-byte-batches, fetch-readable-stream-pull, file-backed-sync-iterable-byte-batches, sync-iterable-byte-batches
- 1 GiB+ JS full-string source-mode rows not using full ArrayBuffer parser input: 233/233
- 1 GiB+ source-mode rows replaying a corpus seed buffer: 150 (max seed 100.26 MiB, max seed/target 0.09)
- Text materialization frontier: fastest full row rawFrameNameId at 185.50 MiB/s, 14.50 MiB/s below 200 MiB/s; without-text rows crossing target: 4; negative candidates: 27
- Source consumption frontier: sync byte batches sync-iterable-byte-batches-batch-8 at 71.96 MiB/s; direct ReadableStream web-readable-stream-raw-frame-ascii-batch-8 at 76.53 MiB/s (1.06x sync); backpressure rows 6/6
- Browser live fetch source frontier: fetch ReadableStream fetchReadableStreamFull at 9.68 MiB/s; fetch async byte batches fetchAsyncByteBatchFull at 9.77 MiB/s; live backpressure rows 2/2

## Comparison Contract

- Semantic basis: Rows are comparable only through the same full-string event count and checksum contract.
- Object-shape equivalence: no
- Object-shape scope: JavaScript public event objects, Java/Woodstox XMLStreamReader cursor events, and Rust/quick-xml Event values are separate implementation shapes.
- Target-distance only: yes
- Primary JS public event case: `eventObjectFull`
- Source-mode equivalence: Source modes are reported separately; file-backed JavaScript rows use synchronous Iterable<Uint8Array[]> byte batches while external native baselines read their own file/input stream.
- Memory equivalence: no
- Memory scope: Process RSS, browser JS heap, Woodstox JFR allocation samples, and quick-xml allocator traffic are not normalized into one allocation model.

| Runtime | Comparator shape | Same JS public event object shape | Source evidence |
| --- | --- | --- | --- |
| Java/Woodstox | XMLStreamReader cursor API; benchmark folds event type, names, attributes, text, and CDATA without constructing JavaScript public event objects. | no | `packages/benchmark/external/woodstox/src/main/java/com/staxxml/benchmark/WoodstoxBench.java` |
| Rust/quick-xml | quick_xml::events::Event and BytesStart path; benchmark folds borrowed/decoded event data without constructing JavaScript public event objects. | no | `packages/benchmark/external/quick-xml/src/main.rs` |

## Fastest JS Rows By Group

| Group | Runtime | Case | MiB/s | Bounded | Memory | Source mode | Full ArrayBuffer input |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| `external-baseline-1024mib-file-sync-batches` | Node/V8 stax-raw-frame-name-id | `stax-raw-frame-name-id` | 132.54 | yes | process RSS max 67.59 MiB | `file-backed-sync-iterable-byte-batches` | no |
| `external-baseline-treebank-wrapper-1024mib-file-sync-batches` | Node/V8 stax-raw-frame-name-id | `stax-raw-frame-name-id` | 68.22 | yes | process RSS max 74.76 MiB | `file-backed-sync-iterable-byte-batches` | no |
| `file-backed-short-attr-value-cache-candidate` | Node/V8 stax-raw-frame-name-id | `stax-raw-frame-name-id` | 147.05 | yes | process RSS max 61.14 MiB | `file-backed-sync-iterable-byte-batches` | no |
| `file-backed-trim-boundary-check-candidate` | Node/V8 stax-raw-frame-name-id | `stax-raw-frame-name-id` | 143.35 | yes | process RSS max 61.40 MiB | `file-backed-sync-iterable-byte-batches` | no |
| `file-backed-long-ascii-text-candidate` | Node/V8 stax-raw-frame-name-id | `stax-raw-frame-name-id` | 141.29 | yes | process RSS max 61.34 MiB | `file-backed-sync-iterable-byte-batches` | no |
| `generated-1gib-candidate` | Chrome/V8 browser | `rawFrameNameId` | 69.90 | yes | JS heap max 39.55 MiB; host working set 500.10 MiB | `sync-iterable-byte-batches` | no |
| `corpus-1gib-candidate` | Node/V8 | `rawFrameNameId` | 77.00 | yes | process RSS max 419.31 MiB | `sync-iterable-byte-batches` | no |
| `browser-fetch-readable-stream-books-corpus` | Chrome/V8 browser | `eventObjectFull` | 64.56 | yes | JS heap max 16.54 MiB; host working set 644.96 MiB | `sync-iterable-byte-batches` | no |
| `projection-1gib-full` | Bun/JSC | `rawFrameNameId` | 84.68 | yes | process RSS max 199.15 MiB | `sync-iterable-byte-batches` | no |
| `generated-1gib-textdecoder` | Node/V8 | `shortAsciiSubarraySharedDecoder` | 51.60 | yes | process RSS max 83.91 MiB | n/a | unknown |
| `books-corpus-stability` | Bun/JSC | `rawFrameNameId` | 178.52 | yes | process RSS max 189.37 MiB | `sync-iterable-byte-batches` | no |
| `text-cache-negative-stability` | Node/V8 | `rawFrameNameId` | 175.02 | yes | process RSS max 71.23 MiB | `sync-iterable-byte-batches` | no |
| `offset-text-cache-negative` | Node/V8 | `rawFrameNameId` | 160.72 | yes | process RSS max 60.44 MiB | `sync-iterable-byte-batches` | no |
| `medium-ascii-text-negative` | Node/V8 | `rawFrameNameIdMediumAsciiText` | 170.16 | yes | process RSS max 66.70 MiB | `sync-iterable-byte-batches` | no |
| `unrolled-medium-ascii-text-negative` | Node/V8 | `rawFrameNameIdUnrolledMediumAsciiText` | 170.59 | yes | process RSS max 67.30 MiB | `sync-iterable-byte-batches` | no |
| `text-trim-guard-negative` | Node/V8 | `rawFrameNameId` | 109.66 | yes | process RSS max 77.91 MiB | `sync-iterable-byte-batches` | no |
| `unrolled-medium-ascii-text-trim-guard-negative` | Node/V8 | `rawFrameNameIdUnrolledMediumAsciiText` | 166.33 | yes | process RSS max 67.28 MiB | `sync-iterable-byte-batches` | no |
| `medium-ascii-attr-value-negative` | Node/V8 | `rawFrameNameIdMediumAsciiAttrValue` | 167.49 | yes | process RSS max 66.52 MiB | `sync-iterable-byte-batches` | no |
| `attr-value-cache-negative` | Node/V8 | `rawFrameNameId` | 161.24 | yes | process RSS max 60.58 MiB | `sync-iterable-byte-batches` | no |
| `bun-cache-candidates-books-corpus` | Bun/JSC | `rawFrameNameId` | 169.07 | yes | process RSS max 177.93 MiB | `sync-iterable-byte-batches` | no |
| `long-ascii-text-negative-stability` | Node/V8 | `rawFrameNameId` | 172.85 | yes | process RSS max 78.00 MiB | `sync-iterable-byte-batches` | no |
| `fold-trimmed-text-negative-stability` | Node/V8 | `rawFrameNameId` | 122.32 | yes | process RSS max 71.22 MiB | `sync-iterable-byte-batches` | no |
| `name-collision-safe-interning` | Node/V8 | `rawFrameNameId` | 96.99 | yes | process RSS max 218.93 MiB | `sync-iterable-byte-batches` | no |
| `no-counter-materialization-negative` | Node/V8 | `rawFrameNameIdNoCountersStringFoldCache` | 100.43 | yes | process RSS max 83.75 MiB | `sync-iterable-byte-batches` | no |
| `no-counter-materialization-batch1-negative` | Node/V8 | `rawFrameNameIdNoCountersNameFoldCache` | 94.71 | yes | process RSS max 73.32 MiB | `sync-iterable-byte-batches` | no |
| `text-trim-cost-decomposition` | Node/V8 | `rawFrameNameId` | 185.50 | yes | process RSS max 60.45 MiB | `sync-iterable-byte-batches` | no |
| `text-trim-cost-decomposition-2gib` | Node/V8 | `rawFrameNameId` | 184.92 | yes | process RSS max 66.48 MiB | `sync-iterable-byte-batches` | no |
| `text-trim-cost-decomposition-4gib` | Node/V8 | `rawFrameNameId` | 178.86 | yes | process RSS max 66.07 MiB | `sync-iterable-byte-batches` | no |
| `text-trim-cost-decomposition-8gib` | Node/V8 | `rawFrameNameId` | 184.03 | yes | process RSS max 76.94 MiB | `sync-iterable-byte-batches` | no |
| `text-checksum-consumer-decomposition` | Node/V8 | `rawFrameNameId` | 91.20 | yes | process RSS max 73.34 MiB | `sync-iterable-byte-batches` | no |
| `semantic-checksum-upper-bound` | Node/V8 | `rawFrameNameId` | 96.88 | yes | process RSS max 67.15 MiB | `sync-iterable-byte-batches` | no |
| `access-shape-rerun-cross-process-books-corpus` | Bun/JSC | `cursorAccessor` | 114.05 | yes | process RSS max 189.48 MiB | `sync-iterable-byte-batches` | no |
| `raw-frame-nameid-alone-cross-process-books-corpus` | Bun/JSC | `rawFrameNameId` | 118.58 | yes | process RSS max 178.65 MiB | `sync-iterable-byte-batches` | no |
| `cross-process-books-corpus` | Bun/JSC | `stringFull` | 120.18 | yes | process RSS max 190.20 MiB | `sync-iterable-byte-batches` | no |
| `deno-cross-process-books-corpus` | Deno/V8 | `stringFull` | 81.48 | yes | process RSS max 66.44 MiB | `sync-iterable-byte-batches` | no |
| `no-counter-name-fold-cache-cross-process-books-corpus` | Node/V8 | `rawFrameNameIdNoCounters` | 141.64 | yes | process RSS max 66.28 MiB | `sync-iterable-byte-batches` | no |
| `no-counter-materialization-batch1-cross-runtime-books-corpus` | Bun/JSC | `rawFrameNameId` | 121.23 | yes | process RSS max 179.04 MiB | `sync-iterable-byte-batches` | no |
| `warmup-full-cross-process-books-corpus` | Node/V8 | `rawFrameNameIdNoCounters` | 93.96 | yes | process RSS max 73.00 MiB | `sync-iterable-byte-batches` | no |
| `medium-ascii-text-cross-process-books-corpus-warmup` | Bun/JSC | `rawFrameNameIdMediumAsciiText` | 91.98 | yes | process RSS max 196.91 MiB | `sync-iterable-byte-batches` | no |
| `no-counter-medium-ascii-text-cross-process-books-corpus-warmup` | Bun/JSC | `rawFrameNameIdNoCounters` | 96.82 | yes | process RSS max 194.96 MiB | `sync-iterable-byte-batches` | no |
| `text-trim-cost-cross-process-books-corpus` | Bun/JSC | `rawFrameNameId` | 119.21 | yes | process RSS max 178.54 MiB | `sync-iterable-byte-batches` | no |
| `text-trim-cost-cross-process-diverse-cycle` | Node/V8 | `rawFrameNameId` | 57.31 | yes | process RSS max 74.26 MiB | `sync-iterable-byte-batches` | no |
| `cross-process-books-corpus-batch16` | Bun/JSC | `stringFull` | 123.45 | yes | process RSS max 199.61 MiB | `sync-iterable-byte-batches` | no |
| `cross-process-large-asset-corpus` | Node/V8 | `rawFrameNameId` | 146.11 | yes | process RSS max 495.31 MiB | `sync-iterable-byte-batches` | no |
| `cross-process-midsize-corpus` | Bun/JSC | `stringFull` | 91.17 | yes | process RSS max 420.17 MiB | `sync-iterable-byte-batches` | no |
| `deno-cross-process-midsize-corpus` | Deno/V8 | `stringFull` | 85.42 | yes | process RSS max 105.69 MiB | `sync-iterable-byte-batches` | no |
| `file-backed-batch-size-sweep` | Node/V8 | `stax-raw-frame-name-id-batch-8` | 152.11 | yes | process RSS max 61.77 MiB | `file-backed-sync-iterable-byte-batches` | no |
| `file-backed-source-sweep` | Node/V8 | `stax-raw-frame-name-id-chunk-32kib` | 151.70 | yes | process RSS max 59.23 MiB | `file-backed-sync-iterable-byte-batches` | no |

## 1024 MiB Books Fixture Woodstox 0.9x Target Distances

These rows compare the fastest JavaScript full-string row in each 1024 MiB books fixture family against the best available Woodstox row for that same fixture family. Rows whose Woodstox reference comes from a separate candidate artifact are still same-fixture target-distance rows, not object-shape or allocation-equivalence proof.

| Group | JS case | JS MiB/s | JS RSS | Source mode | Woodstox MiB/s | 0.9x target | Remaining to 0.9x | JS/Woodstox | Target met | Woodstox artifact | Reference scope |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| `file-backed-batch-size-sweep` | `stax-raw-frame-name-id-batch-8` | 152.11 | process RSS max 61.77 MiB | `file-backed-sync-iterable-byte-batches` | 351.56 | 316.40 | 164.29 | 0.43 | no | `file-backed-trim-boundary-check-candidate.json` | same books 1024 MiB fixture family, but Woodstox reference comes from a separate candidate artifact |
| `file-backed-source-sweep` | `stax-raw-frame-name-id-chunk-32kib` | 151.70 | process RSS max 59.23 MiB | `file-backed-sync-iterable-byte-batches` | 351.56 | 316.40 | 164.70 | 0.43 | no | `file-backed-trim-boundary-check-candidate.json` | same books 1024 MiB fixture family, but Woodstox reference comes from a separate candidate artifact |
| `file-backed-short-attr-value-cache-candidate` | `stax-raw-frame-name-id` | 147.05 | process RSS max 61.14 MiB | `file-backed-sync-iterable-byte-batches` | 338.14 | 304.33 | 157.28 | 0.43 | no | `file-backed-short-attr-value-cache-candidate.json` | same artifact Woodstox reference |
| `file-backed-trim-boundary-check-candidate` | `stax-raw-frame-name-id` | 143.35 | process RSS max 61.40 MiB | `file-backed-sync-iterable-byte-batches` | 351.56 | 316.40 | 173.05 | 0.41 | no | `file-backed-trim-boundary-check-candidate.json` | same artifact Woodstox reference |
| `file-backed-long-ascii-text-candidate` | `stax-raw-frame-name-id` | 141.29 | process RSS max 61.34 MiB | `file-backed-sync-iterable-byte-batches` | 308.06 | 277.25 | 135.96 | 0.46 | no | `file-backed-long-ascii-text-candidate.json` | same artifact Woodstox reference |
| `external-baseline-1024mib-file-sync-batches` | `stax-raw-frame-name-id` | 132.54 | process RSS max 67.59 MiB | `file-backed-sync-iterable-byte-batches` | 337.97 | 304.17 | 171.63 | 0.39 | no | `external-baseline-1024mib-file-sync-batches.json` | same artifact Woodstox reference |

## 1024 MiB Books Fixture quick-xml 0.9x Target Distances

These rows compare the fastest JavaScript full-string row in each 1024 MiB books fixture family against the best available quick-xml row for that same fixture family. Rows whose quick-xml reference comes from a separate candidate artifact are still same-fixture target-distance rows, not object-shape or allocation-equivalence proof.

| Group | JS case | JS MiB/s | JS RSS | Source mode | quick-xml MiB/s | 0.9x target | Remaining to 0.9x | JS/quick-xml | Target met | quick-xml artifact | Reference scope |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| `file-backed-batch-size-sweep` | `stax-raw-frame-name-id-batch-8` | 152.11 | process RSS max 61.77 MiB | `file-backed-sync-iterable-byte-batches` | 274.63 | 247.17 | 95.06 | 0.55 | no | `file-backed-short-attr-value-cache-candidate.json` | same books 1024 MiB fixture family, but quick-xml reference comes from a separate candidate artifact |
| `file-backed-source-sweep` | `stax-raw-frame-name-id-chunk-32kib` | 151.70 | process RSS max 59.23 MiB | `file-backed-sync-iterable-byte-batches` | 274.63 | 247.17 | 95.47 | 0.55 | no | `file-backed-short-attr-value-cache-candidate.json` | same books 1024 MiB fixture family, but quick-xml reference comes from a separate candidate artifact |
| `file-backed-short-attr-value-cache-candidate` | `stax-raw-frame-name-id` | 147.05 | process RSS max 61.14 MiB | `file-backed-sync-iterable-byte-batches` | 274.63 | 247.17 | 100.12 | 0.54 | no | `file-backed-short-attr-value-cache-candidate.json` | same artifact quick-xml reference |
| `file-backed-trim-boundary-check-candidate` | `stax-raw-frame-name-id` | 143.35 | process RSS max 61.40 MiB | `file-backed-sync-iterable-byte-batches` | 273.74 | 246.37 | 103.02 | 0.52 | no | `file-backed-trim-boundary-check-candidate.json` | same artifact quick-xml reference |
| `file-backed-long-ascii-text-candidate` | `stax-raw-frame-name-id` | 141.29 | process RSS max 61.34 MiB | `file-backed-sync-iterable-byte-batches` | 272.33 | 245.10 | 103.81 | 0.52 | no | `file-backed-long-ascii-text-candidate.json` | same artifact quick-xml reference |
| `external-baseline-1024mib-file-sync-batches` | `stax-raw-frame-name-id` | 132.54 | process RSS max 67.59 MiB | `file-backed-sync-iterable-byte-batches` | 270.26 | 243.23 | 110.69 | 0.49 | no | `external-baseline-1024mib-file-sync-batches.json` | same artifact quick-xml reference |

## Text Materialization Frontier

This summarizes the nearest current full-string headroom evidence. Rows that omit text/CDATA strings are headroom probes, not full-string StAX counterexamples.

| Scope | Row | MiB/s | Full string parity | Bounded memory | Artifact | Notes |
| --- | --- | ---: | --- | --- | --- | --- |
| Fastest full row | `rawFrameNameId` | 185.50 | yes | yes | `text-trim-cost-decomposition.json` | 14.50 MiB/s below 200 MiB/s; 1.08x speedup required |
| Fastest without text/CDATA strings | `withoutTextStrings` | 252.36 | no | yes | `text-trim-cost-decomposition-4gib.json` | 1.36x fastest full row; 4 row(s) cross 200 MiB/s |
| Fastest no-trim probe | `rawFrameNameIdNoTrim` | 186.97 | no | n/a | `text-trim-cost-decomposition-8gib.json` | 1.01x fastest full row; 0 row(s) cross 200 MiB/s |
| Fastest fold-trim probe | `rawFrameNameIdFoldTrim` | 148.58 | yes | n/a | `text-trim-cost-decomposition-2gib.json` | 0.80x fastest full row; 0 row(s) cross 200 MiB/s |

Interpretation: Text/CDATA omission crosses the target as headroom evidence, while trim-only, fold-trim, cache, and ASCII candidates remain negative for the current full-string contract.

## Public Event-Object Frontier

This keeps the public event-object API frontier separate from raw-frame, cursor-style, and direct ReadableStream rows. The current fastest bounded public event-object row consumes synchronous `Iterable<Uint8Array[]>` byte batches, not a direct Web `ReadableStream<Uint8Array>` pull loop. It is the closer API-shape proxy for Java/Woodstox-style StAX event consumption, while still not asserting identical object layout or allocation behavior.

| Scope | Row | MiB/s | Source mode | Direct ReadableStream | Full ArrayBuffer input | Bounded memory | Artifact | Notes |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| Fastest bounded public event-object row | `eventObjectFull` | 141.62 | `sync-iterable-byte-batches` | no | no | yes | `candidate-headroom-books-corpus-stability.json` | 58.38 MiB/s below 200 MiB/s; 162.55 MiB/s below 0.9x 1024 MiB Woodstox reference target |

Interpretation: This is the public event-object frontier; raw-frame rows are reported separately and must not be used as public event-object throughput. This compares the public event-object frontier to the 1024 MiB Woodstox reference as target distance only; it is not same object-shape or allocation-equivalence proof.

## Source Shape Safety

| Scope | Rows | Not full ArrayBuffer parser input | Full ArrayBuffer parser input | Unknown parser input | File-backed sync iterable rows | Direct ReadableStream rows | Corpus seed replay rows | Max corpus seed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 GiB+ JS full-string rows with source mode metadata | 233 | 233 | 0 | 0 | 36 | 1 | 150 | 100.26 MiB |

| Source mode | Rows | Not full ArrayBuffer | Full ArrayBuffer | Unknown | Direct ReadableStream | Corpus seed replay | Fastest row |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `fetch-async-iterable-byte-batches` | 1 | 1 | 0 | 0 | 0 | 1 | Chrome/V8 browser `fetchAsyncByteBatchFull` 9.77 MiB/s from `browser-fetch-readable-stream-books-corpus.json` |
| `fetch-readable-stream-pull` | 1 | 1 | 0 | 0 | 1 | 1 | Chrome/V8 browser `fetchReadableStreamFull` 9.68 MiB/s from `browser-fetch-readable-stream-books-corpus.json` |
| `file-backed-sync-iterable-byte-batches` | 36 | 36 | 0 | 0 | 0 | 0 | Node/V8 `stax-raw-frame-name-id-batch-8` 152.11 MiB/s from `file-backed-batch-size-sweep.json` |
| `sync-iterable-byte-batches` | 195 | 195 | 0 | 0 | 0 | 148 | Node/V8 `rawFrameNameId` 185.50 MiB/s from `text-trim-cost-decomposition.json` |

## Source Consumption Frontier

This separates the current large-file Iterable<Uint8Array[]> baseline from direct ReadableStream consumption. ReadableStream rows are bounded source-shape evidence, not the aggregate comparison baseline.

| Scope | Row | Input | MiB/s | RSS | Batch size | Direct ReadableStream | Full ArrayBuffer input | Backpressure | Counters |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Fastest sync byte batches | `sync-iterable-byte-batches-batch-8` | synchronous Iterable<Uint8Array[]> | 71.96 | 74.51 MiB | 8 | no | no | n/a | reads=16385, batches=2048, pulls=0, enqueues=0 |
| Fastest async byte batches | `async-iterable-raw-frame-ascii-batch-8` | async Iterable<Uint8Array[]> | 77.56 | 88.06 MiB | 8 | no | no | yes | reads=16385, batches=2048, pulls=0, enqueues=0 |
| Fastest direct ReadableStream | `web-readable-stream-raw-frame-ascii-batch-8` | Web ReadableStream<Uint8Array> | 76.53 | 110.88 MiB | 8 | yes | no | yes | reads=16385, batches=0, pulls=16385, enqueues=16384 |

- Direct ReadableStream / sync byte-batch ratio: 1.06x
- Async byte-batch / sync byte-batch ratio: 1.08x
- Backpressure-respecting async/readable rows: 6/6
- Full ArrayBuffer parser-input rows in source-consumption artifact: 0
- Primary large comparison input: The file-backed release comparison rows call external-baseline with --stax-stream-source file-sync-batches, which records synchronous Iterable<Uint8Array[]> parser input and directReadableStream=false.
Interpretation: The current large-file comparison uses demand-driven Iterable<Uint8Array[]> batches; direct ReadableStream rows are separate source-shape evidence and remain bounded by pull/read demand.

## Browser Live Fetch Source Frontier

This keeps Chrome fetch Response.body rows separate from prepared corpus-seed replay rows. Both live rows preserve the full checksum contract and do not use a full ArrayBuffer parser input.

| Scope | Row | Source mode | MiB/s | JS heap | Direct ReadableStream | Full ArrayBuffer input | Backpressure | Events | Checksum |
| --- | --- | --- | ---: | ---: | --- | --- | --- | ---: | ---: |
| Prepared corpus seed replay | `eventObjectFull` | `sync-iterable-byte-batches` | 64.56 | 16.54 MiB | n/a | no | n/a | 57096514 | -540013997 |
| Fetch ReadableStream | `fetchReadableStreamFull` | `fetch-readable-stream-pull` | 9.68 | 34.05 MiB | yes | no | yes | 57096514 | -540013997 |
| Fetch async byte batches | `fetchAsyncByteBatchFull` | `fetch-async-iterable-byte-batches` | 9.77 | 17.75 MiB | no | no | yes | 57096514 | -540013997 |

- Live fetch rows respecting backpressure: 2/2
- Live fetch rows with full ArrayBuffer parser input: 0
- Fetch ReadableStream / prepared replay ratio: 0.15x
- Fetch async byte-batch / prepared replay ratio: 0.15x
Interpretation: Browser live fetch rows consume Response.body directly or through grouped AsyncIterable<Uint8Array[]> batches under the same checksum contract; they are intentionally separate from prepared corpus-seed replay rows.

## Memory Frontier

This classifies memory only within the same 1 GiB+ JavaScript full-string row set used by the counterexample scan. Metric kinds stay separate; process RSS, browser JS heap, and browser host-probe-only rows are not allocation-model equivalents.

- Rows classified: 239
- Bounded rows: 222
- Unbounded or unproven rows: 17
- Fastest bounded row: Node/V8 rawFrameNameId at 185.50 MiB/s (process RSS max 60.45 MiB)
- Fastest bounded process RSS row under 128 MiB: Node/V8 rawFrameNameId at 185.50 MiB/s (process RSS max 60.45 MiB)
- Fastest bounded browser JS heap row: Chrome/V8 browser rawFrameNameId at 69.90 MiB/s (JS heap max 39.55 MiB; host working set 500.10 MiB)

| Memory kind | Rows | Bounded | Unbounded/unproven | Max recorded | Fastest row | Fastest bounded row |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| browser-js-heap | 20 | 20 | 0 | 358.37 MiB | Chrome/V8 browser rawFrameNameId at 69.90 MiB/s (JS heap max 39.55 MiB; host working set 500.10 MiB) | Chrome/V8 browser rawFrameNameId at 69.90 MiB/s (JS heap max 39.55 MiB; host working set 500.10 MiB) |
| browser-js-heap-unavailable | 9 | 0 | 9 | n/a MiB | Firefox/SpiderMonkey browser rawFrameNameId at 64.24 MiB/s (browser-js-heap-unavailable; fresh host probe 702.56 MiB) | none |
| process-rss | 210 | 202 | 8 | 1956.69 MiB | Node/V8 rawFrameNameId at 185.50 MiB/s (process RSS max 60.45 MiB) | Node/V8 rawFrameNameId at 185.50 MiB/s (process RSS max 60.45 MiB) |

Interpretation: Memory is classified on the same 1 GiB+ JavaScript full-string row set used for counterexample scanning; process RSS, browser JS heap, and browser host-probe-only rows are not normalized into one allocation model.

## Selected Comparison Rows

| Group | Runtime | Case | Events | Checksum | MiB/s | Bounded | Memory | Source mode | Full ArrayBuffer input | Corpus seed replay | Artifact |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- |
| `external-baseline-16mib` | stax-scan-all-no-decode | `stax-scan-all-no-decode` | 967967 | -141941271 | 167.91 | yes | process RSS max 134.16 MiB | n/a | unknown | no | `external-baseline.json` |
| `external-baseline-16mib` | stax-raw-frame-semantic-checksum | `stax-raw-frame-semantic-checksum` | 967967 | -746772258 | 105.48 | yes | process RSS max 134.33 MiB | n/a | unknown | no | `external-baseline.json` |
| `external-baseline-16mib` | Node/V8 stax-stream | `stax-stream` | 967967 | -746772258 | 99.27 | yes | process RSS max 134.93 MiB | n/a | unknown | no | `external-baseline.json` |
| `external-baseline-16mib` | Node/V8 stax-raw-frame-name-id | `stax-raw-frame-name-id` | 967967 | -746772258 | 119.05 | yes | process RSS max 134.97 MiB | n/a | unknown | no | `external-baseline.json` |
| `external-baseline-16mib` | stax-raw-frame-name-id-fold-trim | `stax-raw-frame-name-id-fold-trim` | 967967 | -746772258 | 109.80 | yes | process RSS max 135.13 MiB | n/a | unknown | no | `external-baseline.json` |
| `external-baseline-16mib` | stax-raw-frame-string-cache | `stax-raw-frame-string-cache` | 967967 | -746772258 | 29.40 | yes | process RSS max 358.83 MiB | n/a | unknown | no | `external-baseline.json` |
| `external-baseline-16mib` | Node/V8 stax-event | `stax-event` | 967967 | -746772258 | 84.84 | yes | process RSS max 312.50 MiB | n/a | unknown | no | `external-baseline.json` |
| `external-baseline-16mib` | Java/Woodstox | `woodstox` | 967967 | -746772258 | 303.10 | yes | process RSS max 121.57 MiB | n/a | unknown | no | `external-baseline.json` |
| `external-baseline-16mib` | Rust/quick-xml | `quick-xml` | 967967 | -746772258 | 243.43 | yes | process RSS max 4.79 MiB | n/a | unknown | no | `external-baseline.json` |
| `external-baseline-1024mib-file-sync-batches` | Node/V8 stax-stream | `stax-stream` | 61236571 | -716099804 | 124.62 | yes | process RSS max 61.30 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `external-baseline-1024mib-file-sync-batches.json` |
| `external-baseline-1024mib-file-sync-batches` | Node/V8 stax-raw-frame-name-id | `stax-raw-frame-name-id` | 61236571 | -716099804 | 132.54 | yes | process RSS max 67.59 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `external-baseline-1024mib-file-sync-batches.json` |
| `external-baseline-1024mib-file-sync-batches` | Java/Woodstox | `woodstox` | 61236571 | -716099804 | 337.97 | yes | process RSS max 312.07 MiB | n/a | unknown | no | `external-baseline-1024mib-file-sync-batches.json` |
| `external-baseline-1024mib-file-sync-batches` | Rust/quick-xml | `quick-xml` | 61236571 | -716099804 | 270.26 | yes | process RSS max 4.78 MiB | n/a | unknown | no | `external-baseline-1024mib-file-sync-batches.json` |
| `external-baseline-treebank-wrapper-1024mib-file-sync-batches` | Node/V8 stax-stream | `stax-stream` | 75206128 | -1234990902 | 65.18 | yes | process RSS max 73.85 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `external-baseline-treebank-wrapper-1024mib-file-sync-batches.json` |
| `external-baseline-treebank-wrapper-1024mib-file-sync-batches` | Node/V8 stax-raw-frame-name-id | `stax-raw-frame-name-id` | 75206128 | -1234990902 | 68.22 | yes | process RSS max 74.76 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `external-baseline-treebank-wrapper-1024mib-file-sync-batches.json` |
| `external-baseline-treebank-wrapper-1024mib-file-sync-batches` | Java/Woodstox | `woodstox` | 75206128 | -1234990902 | 166.05 | yes | process RSS max 309.14 MiB | n/a | unknown | no | `external-baseline-treebank-wrapper-1024mib-file-sync-batches.json` |
| `external-baseline-treebank-wrapper-1024mib-file-sync-batches` | Rust/quick-xml | `quick-xml` | 75206128 | -1234990902 | 175.82 | yes | process RSS max 4.76 MiB | n/a | unknown | no | `external-baseline-treebank-wrapper-1024mib-file-sync-batches.json` |
| `file-backed-short-attr-value-cache-candidate` | Node/V8 stax-raw-frame-name-id | `stax-raw-frame-name-id` | 61236571 | -716099804 | 147.05 | yes | process RSS max 61.14 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-short-attr-value-cache-candidate.json` |
| `file-backed-short-attr-value-cache-candidate` | stax-raw-frame-short-attr-value-cache | `stax-raw-frame-short-attr-value-cache` | 61236571 | -716099804 | 140.15 | yes | process RSS max 67.01 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-short-attr-value-cache-candidate.json` |
| `file-backed-short-attr-value-cache-candidate` | Java/Woodstox | `woodstox` | 61236571 | -716099804 | 338.14 | yes | process RSS max 318.52 MiB | n/a | unknown | no | `file-backed-short-attr-value-cache-candidate.json` |
| `file-backed-short-attr-value-cache-candidate` | Rust/quick-xml | `quick-xml` | 61236571 | -716099804 | 274.63 | yes | process RSS max 4.78 MiB | n/a | unknown | no | `file-backed-short-attr-value-cache-candidate.json` |
| `file-backed-trim-boundary-check-candidate` | Node/V8 stax-raw-frame-name-id | `stax-raw-frame-name-id` | 61236571 | -716099804 | 143.35 | yes | process RSS max 61.40 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-trim-boundary-check-candidate.json` |
| `file-backed-trim-boundary-check-candidate` | stax-raw-frame-name-id-trim-boundary-check | `stax-raw-frame-name-id-trim-boundary-check` | 61236571 | -716099804 | 130.27 | yes | process RSS max 67.22 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-trim-boundary-check-candidate.json` |
| `file-backed-trim-boundary-check-candidate` | Java/Woodstox | `woodstox` | 61236571 | -716099804 | 351.56 | yes | process RSS max 312.71 MiB | n/a | unknown | no | `file-backed-trim-boundary-check-candidate.json` |
| `file-backed-trim-boundary-check-candidate` | Rust/quick-xml | `quick-xml` | 61236571 | -716099804 | 273.74 | yes | process RSS max 4.78 MiB | n/a | unknown | no | `file-backed-trim-boundary-check-candidate.json` |
| `file-backed-long-ascii-text-candidate` | Node/V8 stax-raw-frame-name-id | `stax-raw-frame-name-id` | 61236571 | -716099804 | 141.29 | yes | process RSS max 61.34 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-long-ascii-text-candidate.json` |
| `file-backed-long-ascii-text-candidate` | stax-raw-frame-name-id-long-ascii-text | `stax-raw-frame-name-id-long-ascii-text` | 61236571 | -716099804 | 77.52 | yes | process RSS max 99.57 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-long-ascii-text-candidate.json` |
| `file-backed-long-ascii-text-candidate` | Java/Woodstox | `woodstox` | 61236571 | -716099804 | 308.06 | yes | process RSS max 310.86 MiB | n/a | unknown | no | `file-backed-long-ascii-text-candidate.json` |
| `file-backed-long-ascii-text-candidate` | Rust/quick-xml | `quick-xml` | 61236571 | -716099804 | 272.33 | yes | process RSS max 4.78 MiB | n/a | unknown | no | `file-backed-long-ascii-text-candidate.json` |
| `generated-1gib-candidate` | Node/V8 | `stringFull` | 45189256 | 1421012805 | 49.01 | yes | process RSS max 85.56 MiB | `sync-iterable-byte-batches` | no | no | `candidate-headroom-large.json` |
| `generated-1gib-candidate` | Node/V8 | `eventObjectFull` | 45189256 | 1421012805 | 39.45 | yes | process RSS max 137.52 MiB | `sync-iterable-byte-batches` | no | no | `candidate-headroom-large.json` |
| `generated-1gib-candidate` | Node/V8 | `cursorAccessor` | 45189256 | 1421012805 | 51.99 | yes | process RSS max 143.24 MiB | `sync-iterable-byte-batches` | no | no | `candidate-headroom-large.json` |
| `generated-1gib-candidate` | Node/V8 | `rawFrameDirect` | 45189256 | 1421012805 | 52.23 | yes | process RSS max 143.06 MiB | `sync-iterable-byte-batches` | no | no | `candidate-headroom-large.json` |
| `generated-1gib-candidate` | Node/V8 | `rawFrameNameId` | 45189256 | 1421012805 | 55.85 | yes | process RSS max 144.54 MiB | `sync-iterable-byte-batches` | no | no | `candidate-headroom-large.json` |
| `generated-1gib-candidate` | Bun/JSC | `stringFull` | 45189256 | 1421012805 | 52.93 | yes | process RSS max 188.56 MiB | `sync-iterable-byte-batches` | no | no | `bun-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Bun/JSC | `eventObjectFull` | 45189256 | 1421012805 | 37.27 | yes | process RSS max 177.00 MiB | `sync-iterable-byte-batches` | no | no | `bun-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Bun/JSC | `cursorAccessor` | 45189256 | 1421012805 | 54.62 | yes | process RSS max 181.95 MiB | `sync-iterable-byte-batches` | no | no | `bun-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Bun/JSC | `rawFrameDirect` | 45189256 | 1421012805 | 49.93 | yes | process RSS max 192.83 MiB | `sync-iterable-byte-batches` | no | no | `bun-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Bun/JSC | `rawFrameNameId` | 45189256 | 1421012805 | 57.99 | yes | process RSS max 192.98 MiB | `sync-iterable-byte-batches` | no | no | `bun-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Chrome/V8 browser | `stringFull` | 45189256 | 1421012805 | 67.42 | yes | JS heap max 20.29 MiB; host working set 500.10 MiB | `sync-iterable-byte-batches` | no | no | `browser-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Chrome/V8 browser | `eventObjectFull` | 45189256 | 1421012805 | 56.52 | yes | JS heap max 36.10 MiB; host working set 500.10 MiB | `sync-iterable-byte-batches` | no | no | `browser-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Chrome/V8 browser | `cursorAccessor` | 45189256 | 1421012805 | 66.58 | yes | JS heap max 56.29 MiB; host working set 500.10 MiB | `sync-iterable-byte-batches` | no | no | `browser-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Chrome/V8 browser | `rawFrameDirect` | 45189256 | 1421012805 | 67.77 | yes | JS heap max 33.07 MiB; host working set 500.10 MiB | `sync-iterable-byte-batches` | no | no | `browser-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Chrome/V8 browser | `rawFrameNameId` | 45189256 | 1421012805 | 69.90 | yes | JS heap max 39.55 MiB; host working set 500.10 MiB | `sync-iterable-byte-batches` | no | no | `browser-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Firefox/SpiderMonkey browser | `stringFull` | 45189256 | 1421012805 | 33.02 | no | browser-js-heap-unavailable; fresh host probe 783.20 MiB | `sync-iterable-byte-batches` | no | no | `firefox-bidi-candidate-headroom.json` |
| `generated-1gib-candidate` | Firefox/SpiderMonkey browser | `eventObjectFull` | 45189256 | 1421012805 | 23.31 | no | browser-js-heap-unavailable; fresh host probe 956.18 MiB | `sync-iterable-byte-batches` | no | no | `firefox-bidi-candidate-headroom.json` |
| `generated-1gib-candidate` | Firefox/SpiderMonkey browser | `rawFrameNameId` | 45189256 | 1421012805 | 35.02 | no | browser-js-heap-unavailable; fresh host probe 775.57 MiB | `sync-iterable-byte-batches` | no | no | `firefox-bidi-candidate-headroom.json` |
| `corpus-1gib-candidate` | Node/V8 | `stringFull` | 75206126 | -925527041 | 62.17 | yes | process RSS max 353.58 MiB | `sync-iterable-byte-batches` | no | yes (85.42 MiB) | `candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Node/V8 | `eventObjectFull` | 75206126 | -925527041 | 61.80 | yes | process RSS max 419.02 MiB | `sync-iterable-byte-batches` | no | yes (85.42 MiB) | `candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Node/V8 | `cursorAccessor` | 75206126 | -925527041 | 66.95 | yes | process RSS max 419.54 MiB | `sync-iterable-byte-batches` | no | yes (85.42 MiB) | `candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Node/V8 | `rawFrameDirect` | 75206126 | -925527041 | 71.51 | yes | process RSS max 419.35 MiB | `sync-iterable-byte-batches` | no | yes (85.42 MiB) | `candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Node/V8 | `rawFrameNameId` | 75206126 | -925527041 | 77.00 | yes | process RSS max 419.31 MiB | `sync-iterable-byte-batches` | no | yes (85.42 MiB) | `candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Bun/JSC | `stringFull` | 75206126 | -925527041 | 56.23 | no | process RSS max 1470.83 MiB | `sync-iterable-byte-batches` | no | yes (85.42 MiB) | `bun-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Bun/JSC | `eventObjectFull` | 75206126 | -925527041 | 62.08 | no | process RSS max 1476.53 MiB | `sync-iterable-byte-batches` | no | yes (85.42 MiB) | `bun-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Bun/JSC | `cursorAccessor` | 75206126 | -925527041 | 71.78 | no | process RSS max 1482.77 MiB | `sync-iterable-byte-batches` | no | yes (85.42 MiB) | `bun-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Bun/JSC | `rawFrameDirect` | 75206126 | -925527041 | 62.45 | no | process RSS max 1750.19 MiB | `sync-iterable-byte-batches` | no | yes (85.42 MiB) | `bun-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Bun/JSC | `rawFrameNameId` | 75206126 | -925527041 | 76.08 | no | process RSS max 1751.13 MiB | `sync-iterable-byte-batches` | no | yes (85.42 MiB) | `bun-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Chrome/V8 browser | `stringFull` | 75206126 | -925527041 | 30.38 | yes | JS heap max 349.79 MiB; host working set 865.83 MiB | `sync-iterable-byte-batches` | no | yes (85.42 MiB) | `browser-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Chrome/V8 browser | `eventObjectFull` | 75206126 | -925527041 | 28.92 | yes | JS heap max 358.37 MiB; host working set 865.83 MiB | `sync-iterable-byte-batches` | no | yes (85.42 MiB) | `browser-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Chrome/V8 browser | `cursorAccessor` | 75206126 | -925527041 | 30.07 | yes | JS heap max 337.04 MiB; host working set 865.83 MiB | `sync-iterable-byte-batches` | no | yes (85.42 MiB) | `browser-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Chrome/V8 browser | `rawFrameDirect` | 75206126 | -925527041 | 30.29 | yes | JS heap max 351.61 MiB; host working set 865.83 MiB | `sync-iterable-byte-batches` | no | yes (85.42 MiB) | `browser-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Chrome/V8 browser | `rawFrameNameId` | 75206126 | -925527041 | 29.05 | yes | JS heap max 345.78 MiB; host working set 865.83 MiB | `sync-iterable-byte-batches` | no | yes (85.42 MiB) | `browser-candidate-headroom-corpus.json` |
| `browser-fetch-readable-stream-books-corpus` | Chrome/V8 browser | `eventObjectFull` | 57096514 | -540013997 | 64.56 | yes | JS heap max 16.54 MiB; host working set 644.96 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `browser-fetch-readable-stream-books-corpus.json` |
| `browser-fetch-readable-stream-books-corpus` | Chrome/V8 browser | `fetchReadableStreamFull` | 57096514 | -540013997 | 9.68 | yes | JS heap max 34.05 MiB; host working set 644.96 MiB | `fetch-readable-stream-pull` | no | yes (0.00 MiB) | `browser-fetch-readable-stream-books-corpus.json` |
| `browser-fetch-readable-stream-books-corpus` | Chrome/V8 browser | `fetchAsyncByteBatchFull` | 57096514 | -540013997 | 9.77 | yes | JS heap max 17.75 MiB; host working set 644.96 MiB | `fetch-async-iterable-byte-batches` | no | yes (0.00 MiB) | `browser-fetch-readable-stream-books-corpus.json` |
| `corpus-1gib-candidate` | Firefox/SpiderMonkey browser | `stringFull` | 75206126 | -925527041 | 44.92 | no | browser-js-heap-unavailable; fresh host probe 1064.98 MiB | `sync-iterable-byte-batches` | no | yes (85.42 MiB) | `firefox-bidi-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Firefox/SpiderMonkey browser | `eventObjectFull` | 75206126 | -925527041 | 36.27 | no | browser-js-heap-unavailable; fresh host probe 1220.22 MiB | `sync-iterable-byte-batches` | no | yes (85.42 MiB) | `firefox-bidi-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Firefox/SpiderMonkey browser | `rawFrameNameId` | 75206126 | -925527041 | 48.15 | no | browser-js-heap-unavailable; fresh host probe 1060.55 MiB | `sync-iterable-byte-batches` | no | yes (85.42 MiB) | `firefox-bidi-candidate-headroom-corpus.json` |
| `projection-1gib-full` | Node/V8 | `stringFull` | 60416563 | 1441552024 | 67.04 | yes | process RSS max 78.53 MiB | `sync-iterable-byte-batches` | no | no | `candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Node/V8 | `eventObjectFull` | 60416563 | 1441552024 | 57.67 | yes | process RSS max 135.87 MiB | `sync-iterable-byte-batches` | no | no | `candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Node/V8 | `cursorAccessor` | 60416563 | 1441552024 | 77.29 | yes | process RSS max 144.34 MiB | `sync-iterable-byte-batches` | no | no | `candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Node/V8 | `rawFrameDirect` | 60416563 | 1441552024 | 74.48 | yes | process RSS max 144.48 MiB | `sync-iterable-byte-batches` | no | no | `candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Node/V8 | `rawFrameNameId` | 60416563 | 1441552024 | 82.91 | yes | process RSS max 145.97 MiB | `sync-iterable-byte-batches` | no | no | `candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Bun/JSC | `stringFull` | 60416563 | 1441552024 | 77.04 | yes | process RSS max 214.97 MiB | `sync-iterable-byte-batches` | no | no | `bun-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Bun/JSC | `eventObjectFull` | 60416563 | 1441552024 | 63.29 | yes | process RSS max 182.34 MiB | `sync-iterable-byte-batches` | no | no | `bun-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Bun/JSC | `cursorAccessor` | 60416563 | 1441552024 | 80.14 | yes | process RSS max 177.44 MiB | `sync-iterable-byte-batches` | no | no | `bun-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Bun/JSC | `rawFrameDirect` | 60416563 | 1441552024 | 64.97 | yes | process RSS max 194.21 MiB | `sync-iterable-byte-batches` | no | no | `bun-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Bun/JSC | `rawFrameNameId` | 60416563 | 1441552024 | 84.68 | yes | process RSS max 199.15 MiB | `sync-iterable-byte-batches` | no | no | `bun-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Chrome/V8 browser | `stringFull` | 60416563 | 1441552024 | 56.44 | yes | JS heap max 13.82 MiB; host working set 444.27 MiB | `sync-iterable-byte-batches` | no | no | `browser-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Chrome/V8 browser | `eventObjectFull` | 60416563 | 1441552024 | 48.12 | yes | JS heap max 15.88 MiB; host working set 444.27 MiB | `sync-iterable-byte-batches` | no | no | `browser-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Chrome/V8 browser | `cursorAccessor` | 60416563 | 1441552024 | 56.15 | yes | JS heap max 16.78 MiB; host working set 444.27 MiB | `sync-iterable-byte-batches` | no | no | `browser-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Chrome/V8 browser | `rawFrameDirect` | 60416563 | 1441552024 | 57.69 | yes | JS heap max 16.49 MiB; host working set 444.27 MiB | `sync-iterable-byte-batches` | no | no | `browser-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Chrome/V8 browser | `rawFrameNameId` | 60416563 | 1441552024 | 60.32 | yes | JS heap max 30.03 MiB; host working set 444.27 MiB | `sync-iterable-byte-batches` | no | no | `browser-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Firefox/SpiderMonkey browser | `stringFull` | 60416563 | 1441552024 | 61.77 | no | browser-js-heap-unavailable; fresh host probe 673.60 MiB | `sync-iterable-byte-batches` | no | no | `firefox-bidi-candidate-headroom-projection.json` |
| `projection-1gib-full` | Firefox/SpiderMonkey browser | `eventObjectFull` | 60416563 | 1441552024 | 52.54 | no | browser-js-heap-unavailable; fresh host probe 724.15 MiB | `sync-iterable-byte-batches` | no | no | `firefox-bidi-candidate-headroom-projection.json` |
| `projection-1gib-full` | Firefox/SpiderMonkey browser | `rawFrameNameId` | 60416563 | 1441552024 | 64.24 | no | browser-js-heap-unavailable; fresh host probe 702.56 MiB | `sync-iterable-byte-batches` | no | no | `firefox-bidi-candidate-headroom-projection.json` |
| `generated-1gib-textdecoder` | Node/V8 | `subarraySharedDecoder` | 45189256 | 1421012805 | 37.33 | yes | process RSS max 72.16 MiB | n/a | unknown | no | `textdecoder-span-variants.json` |
| `generated-1gib-textdecoder` | Node/V8 | `shortAsciiSubarraySharedDecoder` | 45189256 | 1421012805 | 51.60 | yes | process RSS max 83.91 MiB | n/a | unknown | no | `textdecoder-span-variants.json` |
| `generated-1gib-textdecoder` | Bun/JSC | `subarraySharedDecoder` | 45189256 | 1421012805 | 40.31 | yes | process RSS max 186.27 MiB | n/a | unknown | no | `bun-textdecoder-span-variants.json` |
| `generated-1gib-textdecoder` | Bun/JSC | `shortAsciiSubarraySharedDecoder` | 45189256 | 1421012805 | 47.67 | yes | process RSS max 215.22 MiB | n/a | unknown | no | `bun-textdecoder-span-variants.json` |
| `generated-1gib-textdecoder` | Chrome/V8 browser | `subarraySharedDecoder` | 45189256 | 1421012805 | 16.63 | yes | JS heap max 9.77 MiB; host working set 479.99 MiB | n/a | unknown | no | `browser-textdecoder-span-variants.json` |
| `generated-1gib-textdecoder` | Chrome/V8 browser | `shortAsciiSubarraySharedDecoder` | 45189256 | 1421012805 | 39.42 | yes | JS heap max 10.04 MiB; host working set 479.99 MiB | n/a | unknown | no | `browser-textdecoder-span-variants.json` |
| `books-corpus-stability` | Node/V8 | `stringFull` | 57096514 | -540013997 | 154.29 | yes | process RSS max 66.80 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-books-corpus-stability.json` |
| `books-corpus-stability` | Node/V8 | `eventObjectFull` | 57096514 | -540013997 | 141.62 | yes | process RSS max 203.27 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-books-corpus-stability.json` |
| `books-corpus-stability` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 176.47 | yes | process RSS max 223.06 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-books-corpus-stability.json` |
| `books-corpus-stability` | Node/V8 | `rawFrameStringCache` | 57096514 | -540013997 | 129.28 | yes | process RSS max 226.89 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-books-corpus-stability.json` |
| `books-corpus-stability` | Bun/JSC | `stringFull` | 57096514 | -540013997 | 171.35 | yes | process RSS max 204.55 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `bun-candidate-headroom-books-corpus-stability.json` |
| `books-corpus-stability` | Bun/JSC | `eventObjectFull` | 57096514 | -540013997 | 136.44 | yes | process RSS max 199.21 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `bun-candidate-headroom-books-corpus-stability.json` |
| `books-corpus-stability` | Bun/JSC | `rawFrameNameId` | 57096514 | -540013997 | 178.52 | yes | process RSS max 189.37 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `bun-candidate-headroom-books-corpus-stability.json` |
| `books-corpus-stability` | Bun/JSC | `rawFrameStringCache` | 57096514 | -540013997 | 143.20 | yes | process RSS max 184.98 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `bun-candidate-headroom-books-corpus-stability.json` |
| `text-cache-negative-stability` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 175.02 | yes | process RSS max 71.23 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-cache-materialization-candidate-stability.json` |
| `text-cache-negative-stability` | Node/V8 | `rawFrameNameIdTextCache` | 57096514 | -540013997 | 129.31 | yes | process RSS max 77.43 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-cache-materialization-candidate-stability.json` |
| `offset-text-cache-negative` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 160.72 | yes | process RSS max 60.44 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `offset-text-cache-materialization-candidate.json` |
| `offset-text-cache-negative` | Node/V8 | `rawFrameNameIdTextCache` | 57096514 | -540013997 | 110.79 | yes | process RSS max 66.84 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `offset-text-cache-materialization-candidate.json` |
| `offset-text-cache-negative` | Node/V8 | `rawFrameNameIdOffsetTextCache` | 57096514 | -540013997 | 105.41 | yes | process RSS max 198.44 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `offset-text-cache-materialization-candidate.json` |
| `offset-text-cache-negative` | Node/V8 | `withoutTextStrings` | 57096514 | 1372281363 | 216.04 | yes | process RSS max 254.16 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `offset-text-cache-materialization-candidate.json` |
| `medium-ascii-text-negative` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 164.31 | yes | process RSS max 60.86 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `medium-ascii-text-materialization-candidate.json` |
| `medium-ascii-text-negative` | Node/V8 | `rawFrameNameIdMediumAsciiText` | 57096514 | -540013997 | 170.16 | yes | process RSS max 66.70 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `medium-ascii-text-materialization-candidate.json` |
| `medium-ascii-text-negative` | Node/V8 | `withoutTextStrings` | 57096514 | 1372281363 | 222.28 | yes | process RSS max 70.29 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `medium-ascii-text-materialization-candidate.json` |
| `unrolled-medium-ascii-text-negative` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 164.13 | yes | process RSS max 60.94 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `unrolled-medium-ascii-text-materialization-candidate.json` |
| `unrolled-medium-ascii-text-negative` | Node/V8 | `rawFrameNameIdUnrolledMediumAsciiText` | 57096514 | -540013997 | 170.59 | yes | process RSS max 67.30 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `unrolled-medium-ascii-text-materialization-candidate.json` |
| `unrolled-medium-ascii-text-negative` | Node/V8 | `rawFrameNameIdMediumAsciiText` | 57096514 | -540013997 | 155.35 | yes | process RSS max 67.17 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `unrolled-medium-ascii-text-materialization-candidate.json` |
| `unrolled-medium-ascii-text-negative` | Node/V8 | `withoutTextStrings` | 57096514 | 1372281363 | 214.41 | yes | process RSS max 71.18 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `unrolled-medium-ascii-text-materialization-candidate.json` |
| `text-trim-guard-negative` | Node/V8 | `rawFrameNameId` | 45189256 | 1421012805 | 109.66 | yes | process RSS max 77.91 MiB | `sync-iterable-byte-batches` | no | no | `text-trim-guard-candidate.json` |
| `text-trim-guard-negative` | Node/V8 | `rawFrameNameIdTrimGuard` | 45189256 | 1421012805 | 109.56 | yes | process RSS max 78.71 MiB | `sync-iterable-byte-batches` | no | no | `text-trim-guard-candidate.json` |
| `unrolled-medium-ascii-text-trim-guard-negative` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 136.23 | yes | process RSS max 61.23 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `unrolled-medium-ascii-text-trim-guard-candidate.json` |
| `unrolled-medium-ascii-text-trim-guard-negative` | Node/V8 | `rawFrameNameIdUnrolledMediumAsciiText` | 57096514 | -540013997 | 166.33 | yes | process RSS max 67.28 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `unrolled-medium-ascii-text-trim-guard-candidate.json` |
| `unrolled-medium-ascii-text-trim-guard-negative` | Node/V8 | `rawFrameNameIdTrimGuard` | 57096514 | -540013997 | 163.62 | yes | process RSS max 66.95 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `unrolled-medium-ascii-text-trim-guard-candidate.json` |
| `unrolled-medium-ascii-text-trim-guard-negative` | Node/V8 | `rawFrameNameIdUnrolledMediumAsciiTextTrimGuard` | 57096514 | -540013997 | 164.14 | yes | process RSS max 68.82 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `unrolled-medium-ascii-text-trim-guard-candidate.json` |
| `unrolled-medium-ascii-text-trim-guard-negative` | Node/V8 | `withoutTextStrings` | 57096514 | 1372281363 | 215.70 | yes | process RSS max 71.43 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `unrolled-medium-ascii-text-trim-guard-candidate.json` |
| `medium-ascii-attr-value-negative` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 165.38 | yes | process RSS max 61.18 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `medium-ascii-attr-value-materialization-candidate.json` |
| `medium-ascii-attr-value-negative` | Node/V8 | `rawFrameNameIdMediumAsciiAttrValue` | 57096514 | -540013997 | 167.49 | yes | process RSS max 66.52 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `medium-ascii-attr-value-materialization-candidate.json` |
| `medium-ascii-attr-value-negative` | Node/V8 | `rawFrameNameIdMediumAsciiText` | 57096514 | -540013997 | 155.23 | yes | process RSS max 66.48 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `medium-ascii-attr-value-materialization-candidate.json` |
| `medium-ascii-attr-value-negative` | Node/V8 | `withoutTextStrings` | 57096514 | 1372281363 | 213.11 | yes | process RSS max 70.62 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `medium-ascii-attr-value-materialization-candidate.json` |
| `attr-value-cache-negative` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 161.24 | yes | process RSS max 60.58 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `attr-value-cache-materialization-candidate.json` |
| `attr-value-cache-negative` | Node/V8 | `rawFrameNameIdAttrValueCache` | 57096514 | -540013997 | 158.96 | yes | process RSS max 66.18 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `attr-value-cache-materialization-candidate.json` |
| `attr-value-cache-negative` | Node/V8 | `rawFrameStringCache` | 57096514 | -540013997 | 120.41 | yes | process RSS max 66.98 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `attr-value-cache-materialization-candidate.json` |
| `attr-value-cache-negative` | Node/V8 | `withoutAttributeValueStrings` | 57096514 | 1597287507 | 151.93 | yes | process RSS max 67.40 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `attr-value-cache-materialization-candidate.json` |
| `bun-cache-candidates-books-corpus` | Bun/JSC | `rawFrameNameId` | 57096514 | -540013997 | 169.07 | yes | process RSS max 177.93 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `bun-cache-candidates-books-corpus.json` |
| `bun-cache-candidates-books-corpus` | Bun/JSC | `rawFrameNameIdAttrValueCache` | 57096514 | -540013997 | 158.09 | yes | process RSS max 176.35 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `bun-cache-candidates-books-corpus.json` |
| `bun-cache-candidates-books-corpus` | Bun/JSC | `rawFrameNameIdOffsetTextCache` | 57096514 | -540013997 | 99.92 | yes | process RSS max 179.61 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `bun-cache-candidates-books-corpus.json` |
| `bun-cache-candidates-books-corpus` | Bun/JSC | `rawFrameNameIdUnrolledMediumAsciiText` | 57096514 | -540013997 | 150.27 | yes | process RSS max 178.85 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `bun-cache-candidates-books-corpus.json` |
| `bun-cache-candidates-books-corpus` | Bun/JSC | `withoutTextStrings` | 57096514 | 1372281363 | 213.15 | yes | process RSS max 170.96 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `bun-cache-candidates-books-corpus.json` |
| `long-ascii-text-negative-stability` | Node/V8 | `stringFull` | 57096514 | -540013997 | 148.17 | yes | process RSS max 71.39 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `long-ascii-text-materialization-candidate-stability.json` |
| `long-ascii-text-negative-stability` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 172.85 | yes | process RSS max 78.00 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `long-ascii-text-materialization-candidate-stability.json` |
| `long-ascii-text-negative-stability` | Node/V8 | `rawFrameNameIdLongAsciiText` | 57096514 | -540013997 | 71.21 | yes | process RSS max 102.10 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `long-ascii-text-materialization-candidate-stability.json` |
| `fold-trimmed-text-negative-stability` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 122.32 | yes | process RSS max 71.22 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `fold-trimmed-text-candidate-stability.json` |
| `fold-trimmed-text-negative-stability` | Node/V8 | `rawFrameNameIdFoldTrim` | 57096514 | -540013997 | 103.26 | yes | process RSS max 77.77 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `fold-trimmed-text-candidate-stability.json` |
| `name-collision-safe-interning` | Node/V8 | `stringFull` | 45189256 | 1421012805 | 84.18 | yes | process RSS max 99.26 MiB | `sync-iterable-byte-batches` | no | no | `name-collision-safe-interning-perf.json` |
| `name-collision-safe-interning` | Node/V8 | `eventObjectFull` | 45189256 | 1421012805 | 70.96 | yes | process RSS max 202.43 MiB | `sync-iterable-byte-batches` | no | no | `name-collision-safe-interning-perf.json` |
| `name-collision-safe-interning` | Node/V8 | `rawFrameNameId` | 45189256 | 1421012805 | 96.99 | yes | process RSS max 218.93 MiB | `sync-iterable-byte-batches` | no | no | `name-collision-safe-interning-perf.json` |
| `no-counter-materialization-negative` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 94.41 | yes | process RSS max 71.57 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-candidate.json` |
| `no-counter-materialization-negative` | Node/V8 | `rawFrameNameIdNoCounters` | 57096514 | -540013997 | 96.55 | yes | process RSS max 72.18 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-candidate.json` |
| `no-counter-materialization-negative` | Node/V8 | `rawFrameNameIdNoCountersNameFoldCache` | 57096514 | -540013997 | 99.44 | yes | process RSS max 73.86 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-candidate.json` |
| `no-counter-materialization-negative` | Node/V8 | `rawFrameNameIdNoCountersStringFoldCache` | 57096514 | -540013997 | 100.43 | yes | process RSS max 83.75 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-candidate.json` |
| `no-counter-materialization-negative` | Node/V8 | `rawFrameNameIdNoCountersFoldTrim` | 57096514 | -540013997 | 88.01 | yes | process RSS max 84.13 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-candidate.json` |
| `no-counter-materialization-negative` | Node/V8 | `rawFrameNameIdNoCountersUnrolledMediumAsciiText` | 57096514 | -540013997 | 99.08 | yes | process RSS max 84.66 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-candidate.json` |
| `no-counter-materialization-negative` | Node/V8 | `rawFrameNameIdNoCountersValueCache` | 57096514 | -540013997 | 68.91 | yes | process RSS max 84.55 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-candidate.json` |
| `no-counter-materialization-negative` | Node/V8 | `withoutTextStrings` | 57096514 | 1372281363 | 116.94 | yes | process RSS max 92.05 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-candidate.json` |
| `no-counter-materialization-batch1-negative` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 91.16 | yes | process RSS max 71.82 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-candidate.json` |
| `no-counter-materialization-batch1-negative` | Node/V8 | `rawFrameNameIdNoCounters` | 57096514 | -540013997 | 93.90 | yes | process RSS max 73.78 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-candidate.json` |
| `no-counter-materialization-batch1-negative` | Node/V8 | `rawFrameNameIdNoCountersNameFoldCache` | 57096514 | -540013997 | 94.71 | yes | process RSS max 73.32 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-candidate.json` |
| `no-counter-materialization-batch1-negative` | Node/V8 | `rawFrameNameIdNoCountersStringFoldCache` | 57096514 | -540013997 | 94.22 | yes | process RSS max 83.91 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-candidate.json` |
| `no-counter-materialization-batch1-negative` | Node/V8 | `rawFrameNameIdNoCountersFoldTrim` | 57096514 | -540013997 | 81.96 | yes | process RSS max 86.16 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-candidate.json` |
| `no-counter-materialization-batch1-negative` | Node/V8 | `rawFrameNameIdNoCountersUnrolledMediumAsciiText` | 57096514 | -540013997 | 93.19 | yes | process RSS max 85.63 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-candidate.json` |
| `no-counter-materialization-batch1-negative` | Node/V8 | `rawFrameNameIdNoCountersValueCache` | 57096514 | -540013997 | 64.59 | yes | process RSS max 87.50 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-candidate.json` |
| `no-counter-materialization-batch1-negative` | Node/V8 | `withoutTextStrings` | 57096514 | 1372281363 | 116.68 | yes | process RSS max 91.54 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-candidate.json` |
| `text-trim-cost-decomposition` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 185.50 | yes | process RSS max 60.45 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-decomposition.json` |
| `text-trim-cost-decomposition` | Node/V8 | `rawFrameNameIdFoldTrim` | 57096514 | -540013997 | 148.57 | yes | process RSS max 66.88 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-decomposition.json` |
| `text-trim-cost-decomposition-2gib` | Node/V8 | `rawFrameNameId` | 114192784 | 1903859545 | 184.92 | yes | process RSS max 66.48 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-decomposition-2gib.json` |
| `text-trim-cost-decomposition-2gib` | Node/V8 | `rawFrameNameIdFoldTrim` | 114192784 | 1903859545 | 148.58 | yes | process RSS max 77.16 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-decomposition-2gib.json` |
| `text-trim-cost-decomposition-4gib` | Node/V8 | `rawFrameNameId` | 228385566 | -1067702969 | 178.86 | yes | process RSS max 66.07 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-decomposition-4gib.json` |
| `text-trim-cost-decomposition-8gib` | Node/V8 | `rawFrameNameId` | 456770888 | 734413569 | 184.03 | yes | process RSS max 76.94 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-decomposition-8gib.json` |
| `text-checksum-consumer-decomposition` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 91.20 | yes | process RSS max 73.34 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-checksum-consumer-decomposition.json` |
| `text-checksum-consumer-decomposition` | Node/V8 | `rawFrameNameIdTextLengthOnly` | 57096514 | 1149246483 | 99.01 | yes | process RSS max 73.93 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-checksum-consumer-decomposition.json` |
| `text-checksum-consumer-decomposition` | Node/V8 | `rawFrameNameIdTextNoFold` | 57096514 | 1372281363 | 99.39 | yes | process RSS max 73.57 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-checksum-consumer-decomposition.json` |
| `text-checksum-consumer-decomposition` | Node/V8 | `withoutTextStrings` | 57096514 | 1372281363 | 113.94 | yes | process RSS max 77.15 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-checksum-consumer-decomposition.json` |
| `semantic-checksum-upper-bound` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 96.88 | yes | process RSS max 67.15 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `semantic-checksum-upper-bound.json` |
| `semantic-checksum-upper-bound` | Node/V8 | `rawFrameSemanticChecksum` | 57096514 | -540013997 | 94.11 | yes | process RSS max 72.68 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `semantic-checksum-upper-bound.json` |
| `semantic-checksum-upper-bound` | Node/V8 | `withoutTextStrings` | 57096514 | 1372281363 | 119.39 | yes | process RSS max 77.27 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `semantic-checksum-upper-bound.json` |
| `access-shape-rerun-cross-process-books-corpus` | Node/V8 | `cursorAccessor` | 57096514 | -540013997 | 107.04 | yes | process RSS max 66.16 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `access-shape-rerun-cross-process-books-corpus.json` |
| `access-shape-rerun-cross-process-books-corpus` | Node/V8 | `rawFrameDirect` | 57096514 | -540013997 | 76.43 | yes | process RSS max 66.46 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `access-shape-rerun-cross-process-books-corpus.json` |
| `access-shape-rerun-cross-process-books-corpus` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 85.55 | yes | process RSS max 66.91 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `access-shape-rerun-cross-process-books-corpus.json` |
| `access-shape-rerun-cross-process-books-corpus` | Bun/JSC | `cursorAccessor` | 57096514 | -540013997 | 114.05 | yes | process RSS max 189.48 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `access-shape-rerun-cross-process-books-corpus.json` |
| `access-shape-rerun-cross-process-books-corpus` | Bun/JSC | `rawFrameDirect` | 57096514 | -540013997 | 75.84 | yes | process RSS max 188.68 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `access-shape-rerun-cross-process-books-corpus.json` |
| `access-shape-rerun-cross-process-books-corpus` | Bun/JSC | `rawFrameNameId` | 57096514 | -540013997 | 93.33 | yes | process RSS max 187.12 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `access-shape-rerun-cross-process-books-corpus.json` |
| `raw-frame-nameid-alone-cross-process-books-corpus` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 113.72 | yes | process RSS max 65.82 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `raw-frame-nameid-alone-cross-process-books-corpus.json` |
| `raw-frame-nameid-alone-cross-process-books-corpus` | Bun/JSC | `rawFrameNameId` | 57096514 | -540013997 | 118.58 | yes | process RSS max 178.65 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `raw-frame-nameid-alone-cross-process-books-corpus.json` |
| `cross-process-books-corpus` | Node/V8 | `stringFull` | 57096514 | -540013997 | 113.79 | yes | process RSS max 70.73 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-cross-process-books-corpus.json` |
| `cross-process-books-corpus` | Node/V8 | `eventObjectFull` | 57096514 | -540013997 | 72.76 | yes | process RSS max 136.90 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-cross-process-books-corpus.json` |
| `cross-process-books-corpus` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 94.98 | yes | process RSS max 147.60 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-cross-process-books-corpus.json` |
| `cross-process-books-corpus` | Bun/JSC | `stringFull` | 57096514 | -540013997 | 120.18 | yes | process RSS max 190.20 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-cross-process-books-corpus.json` |
| `cross-process-books-corpus` | Bun/JSC | `eventObjectFull` | 57096514 | -540013997 | 76.84 | yes | process RSS max 190.21 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-cross-process-books-corpus.json` |
| `cross-process-books-corpus` | Bun/JSC | `rawFrameNameId` | 57096514 | -540013997 | 97.84 | yes | process RSS max 176.32 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-cross-process-books-corpus.json` |
| `deno-cross-process-books-corpus` | Deno/V8 | `stringFull` | 57096514 | -540013997 | 81.48 | yes | process RSS max 66.44 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `deno-candidate-headroom-cross-process-books-corpus.json` |
| `deno-cross-process-books-corpus` | Deno/V8 | `eventObjectFull` | 57096514 | -540013997 | 64.71 | yes | process RSS max 133.11 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `deno-candidate-headroom-cross-process-books-corpus.json` |
| `deno-cross-process-books-corpus` | Deno/V8 | `rawFrameNameId` | 57096514 | -540013997 | 80.96 | yes | process RSS max 143.59 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `deno-candidate-headroom-cross-process-books-corpus.json` |
| `no-counter-name-fold-cache-cross-process-books-corpus` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 138.96 | yes | process RSS max 65.59 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-name-fold-cache-cross-process-books-corpus.json` |
| `no-counter-name-fold-cache-cross-process-books-corpus` | Node/V8 | `rawFrameNameIdNoCounters` | 57096514 | -540013997 | 141.64 | yes | process RSS max 66.28 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-name-fold-cache-cross-process-books-corpus.json` |
| `no-counter-name-fold-cache-cross-process-books-corpus` | Node/V8 | `rawFrameNameIdNoCountersNameFoldCache` | 57096514 | -540013997 | 132.06 | yes | process RSS max 66.67 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-name-fold-cache-cross-process-books-corpus.json` |
| `no-counter-materialization-batch1-cross-runtime-books-corpus` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 114.40 | yes | process RSS max 65.66 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-cross-runtime-books-corpus.json` |
| `no-counter-materialization-batch1-cross-runtime-books-corpus` | Node/V8 | `rawFrameNameIdNoCountersNameFoldCache` | 57096514 | -540013997 | 95.74 | yes | process RSS max 66.43 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-cross-runtime-books-corpus.json` |
| `no-counter-materialization-batch1-cross-runtime-books-corpus` | Node/V8 | `rawFrameNameIdNoCountersStringFoldCache` | 57096514 | -540013997 | 92.19 | yes | process RSS max 66.71 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-cross-runtime-books-corpus.json` |
| `no-counter-materialization-batch1-cross-runtime-books-corpus` | Node/V8 | `withoutTextStrings` | 57096514 | 1372281363 | 117.65 | yes | process RSS max 69.13 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-cross-runtime-books-corpus.json` |
| `no-counter-materialization-batch1-cross-runtime-books-corpus` | Bun/JSC | `rawFrameNameId` | 57096514 | -540013997 | 121.23 | yes | process RSS max 179.04 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-cross-runtime-books-corpus.json` |
| `no-counter-materialization-batch1-cross-runtime-books-corpus` | Bun/JSC | `rawFrameNameIdNoCountersNameFoldCache` | 57096514 | -540013997 | 101.04 | yes | process RSS max 178.04 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-cross-runtime-books-corpus.json` |
| `no-counter-materialization-batch1-cross-runtime-books-corpus` | Bun/JSC | `rawFrameNameIdNoCountersStringFoldCache` | 57096514 | -540013997 | 97.54 | yes | process RSS max 178.36 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-cross-runtime-books-corpus.json` |
| `no-counter-materialization-batch1-cross-runtime-books-corpus` | Bun/JSC | `withoutTextStrings` | 57096514 | 1372281363 | 132.29 | yes | process RSS max 178.47 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-cross-runtime-books-corpus.json` |
| `no-counter-materialization-batch1-cross-runtime-books-corpus` | Deno/V8 | `rawFrameNameId` | 57096514 | -540013997 | 109.47 | yes | process RSS max 66.37 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-cross-runtime-books-corpus.json` |
| `no-counter-materialization-batch1-cross-runtime-books-corpus` | Deno/V8 | `rawFrameNameIdNoCountersNameFoldCache` | 57096514 | -540013997 | 84.23 | yes | process RSS max 66.39 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-cross-runtime-books-corpus.json` |
| `no-counter-materialization-batch1-cross-runtime-books-corpus` | Deno/V8 | `rawFrameNameIdNoCountersStringFoldCache` | 57096514 | -540013997 | 85.01 | yes | process RSS max 66.88 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-cross-runtime-books-corpus.json` |
| `no-counter-materialization-batch1-cross-runtime-books-corpus` | Deno/V8 | `withoutTextStrings` | 57096514 | 1372281363 | 112.28 | yes | process RSS max 68.45 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-materialization-batch1-cross-runtime-books-corpus.json` |
| `warmup-full-cross-process-books-corpus` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 86.60 | yes | process RSS max 66.51 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `warmup-full-cross-process-books-corpus.json` |
| `warmup-full-cross-process-books-corpus` | Node/V8 | `rawFrameNameIdNoCounters` | 57096514 | -540013997 | 93.96 | yes | process RSS max 73.00 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `warmup-full-cross-process-books-corpus.json` |
| `medium-ascii-text-cross-process-books-corpus-warmup` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 88.82 | yes | process RSS max 66.38 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `medium-ascii-text-cross-process-books-corpus-warmup.json` |
| `medium-ascii-text-cross-process-books-corpus-warmup` | Node/V8 | `rawFrameNameIdMediumAsciiText` | 57096514 | -540013997 | 88.42 | yes | process RSS max 72.78 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `medium-ascii-text-cross-process-books-corpus-warmup.json` |
| `medium-ascii-text-cross-process-books-corpus-warmup` | Node/V8 | `withoutTextStrings` | 57096514 | 1372281363 | 115.61 | yes | process RSS max 76.92 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `medium-ascii-text-cross-process-books-corpus-warmup.json` |
| `medium-ascii-text-cross-process-books-corpus-warmup` | Bun/JSC | `rawFrameNameId` | 57096514 | -540013997 | 91.11 | yes | process RSS max 200.18 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `medium-ascii-text-cross-process-books-corpus-warmup.json` |
| `medium-ascii-text-cross-process-books-corpus-warmup` | Bun/JSC | `rawFrameNameIdMediumAsciiText` | 57096514 | -540013997 | 91.98 | yes | process RSS max 196.91 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `medium-ascii-text-cross-process-books-corpus-warmup.json` |
| `medium-ascii-text-cross-process-books-corpus-warmup` | Bun/JSC | `withoutTextStrings` | 57096514 | 1372281363 | 128.96 | yes | process RSS max 214.36 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `medium-ascii-text-cross-process-books-corpus-warmup.json` |
| `no-counter-medium-ascii-text-cross-process-books-corpus-warmup` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 87.13 | yes | process RSS max 66.55 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-medium-ascii-text-cross-process-books-corpus-warmup.json` |
| `no-counter-medium-ascii-text-cross-process-books-corpus-warmup` | Node/V8 | `rawFrameNameIdNoCounters` | 57096514 | -540013997 | 92.63 | yes | process RSS max 72.76 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-medium-ascii-text-cross-process-books-corpus-warmup.json` |
| `no-counter-medium-ascii-text-cross-process-books-corpus-warmup` | Node/V8 | `rawFrameNameIdNoCountersMediumAsciiText` | 57096514 | -540013997 | 94.43 | yes | process RSS max 73.23 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-medium-ascii-text-cross-process-books-corpus-warmup.json` |
| `no-counter-medium-ascii-text-cross-process-books-corpus-warmup` | Node/V8 | `rawFrameNameIdNoCountersUnrolledMediumAsciiText` | 57096514 | -540013997 | 93.35 | yes | process RSS max 73.23 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-medium-ascii-text-cross-process-books-corpus-warmup.json` |
| `no-counter-medium-ascii-text-cross-process-books-corpus-warmup` | Bun/JSC | `rawFrameNameId` | 57096514 | -540013997 | 92.40 | yes | process RSS max 199.32 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-medium-ascii-text-cross-process-books-corpus-warmup.json` |
| `no-counter-medium-ascii-text-cross-process-books-corpus-warmup` | Bun/JSC | `rawFrameNameIdNoCounters` | 57096514 | -540013997 | 96.82 | yes | process RSS max 194.96 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-medium-ascii-text-cross-process-books-corpus-warmup.json` |
| `no-counter-medium-ascii-text-cross-process-books-corpus-warmup` | Bun/JSC | `rawFrameNameIdNoCountersMediumAsciiText` | 57096514 | -540013997 | 93.40 | yes | process RSS max 184.41 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-medium-ascii-text-cross-process-books-corpus-warmup.json` |
| `no-counter-medium-ascii-text-cross-process-books-corpus-warmup` | Bun/JSC | `rawFrameNameIdNoCountersUnrolledMediumAsciiText` | 57096514 | -540013997 | 94.75 | yes | process RSS max 187.79 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `no-counter-medium-ascii-text-cross-process-books-corpus-warmup.json` |
| `text-trim-cost-cross-process-books-corpus` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 115.55 | yes | process RSS max 65.77 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-cross-process-books-corpus.json` |
| `text-trim-cost-cross-process-books-corpus` | Node/V8 | `rawFrameNameIdNoTrim` | 57096514 | -540013997 | 89.37 | yes | process RSS max 66.51 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-cross-process-books-corpus.json` |
| `text-trim-cost-cross-process-books-corpus` | Node/V8 | `rawFrameNameIdFoldTrim` | 57096514 | -540013997 | 82.43 | yes | process RSS max 67.07 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-cross-process-books-corpus.json` |
| `text-trim-cost-cross-process-books-corpus` | Node/V8 | `withoutTextStrings` | 57096514 | 1372281363 | 117.63 | yes | process RSS max 68.88 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-cross-process-books-corpus.json` |
| `text-trim-cost-cross-process-books-corpus` | Bun/JSC | `rawFrameNameId` | 57096514 | -540013997 | 119.21 | yes | process RSS max 178.54 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-cross-process-books-corpus.json` |
| `text-trim-cost-cross-process-books-corpus` | Bun/JSC | `rawFrameNameIdNoTrim` | 57096514 | -540013997 | 97.81 | yes | process RSS max 178.00 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-cross-process-books-corpus.json` |
| `text-trim-cost-cross-process-books-corpus` | Bun/JSC | `rawFrameNameIdFoldTrim` | 57096514 | -540013997 | 95.76 | yes | process RSS max 177.80 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-cross-process-books-corpus.json` |
| `text-trim-cost-cross-process-books-corpus` | Bun/JSC | `withoutTextStrings` | 57096514 | 1372281363 | 133.74 | yes | process RSS max 177.52 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-cross-process-books-corpus.json` |
| `text-trim-cost-cross-process-books-corpus` | Deno/V8 | `rawFrameNameId` | 57096514 | -540013997 | 108.68 | yes | process RSS max 65.78 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-cross-process-books-corpus.json` |
| `text-trim-cost-cross-process-books-corpus` | Deno/V8 | `rawFrameNameIdNoTrim` | 57096514 | -540013997 | 86.68 | yes | process RSS max 66.72 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-cross-process-books-corpus.json` |
| `text-trim-cost-cross-process-books-corpus` | Deno/V8 | `rawFrameNameIdFoldTrim` | 57096514 | -540013997 | 77.41 | yes | process RSS max 66.89 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-cross-process-books-corpus.json` |
| `text-trim-cost-cross-process-books-corpus` | Deno/V8 | `withoutTextStrings` | 57096514 | 1372281363 | 114.46 | yes | process RSS max 67.54 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-cross-process-books-corpus.json` |
| `text-trim-cost-cross-process-diverse-cycle` | Node/V8 | `rawFrameNameId` | 45189256 | 1421012805 | 57.31 | yes | process RSS max 74.26 MiB | `sync-iterable-byte-batches` | no | no | `text-trim-cost-cross-process-diverse-cycle.json` |
| `text-trim-cost-cross-process-diverse-cycle` | Node/V8 | `rawFrameNameIdNoTrim` | 45189256 | 1421012805 | 51.34 | yes | process RSS max 83.14 MiB | `sync-iterable-byte-batches` | no | no | `text-trim-cost-cross-process-diverse-cycle.json` |
| `text-trim-cost-cross-process-diverse-cycle` | Node/V8 | `rawFrameNameIdFoldTrim` | 45189256 | 1421012805 | 49.00 | yes | process RSS max 83.19 MiB | `sync-iterable-byte-batches` | no | no | `text-trim-cost-cross-process-diverse-cycle.json` |
| `text-trim-cost-cross-process-diverse-cycle` | Node/V8 | `withoutTextStrings` | 45189256 | -679247912 | 62.78 | yes | process RSS max 100.01 MiB | `sync-iterable-byte-batches` | no | no | `text-trim-cost-cross-process-diverse-cycle.json` |
| `text-trim-cost-cross-process-diverse-cycle` | Bun/JSC | `rawFrameNameId` | 45189256 | 1421012805 | 55.13 | yes | process RSS max 182.53 MiB | `sync-iterable-byte-batches` | no | no | `text-trim-cost-cross-process-diverse-cycle.json` |
| `text-trim-cost-cross-process-diverse-cycle` | Bun/JSC | `rawFrameNameIdNoTrim` | 45189256 | 1421012805 | 48.08 | yes | process RSS max 187.64 MiB | `sync-iterable-byte-batches` | no | no | `text-trim-cost-cross-process-diverse-cycle.json` |
| `text-trim-cost-cross-process-diverse-cycle` | Bun/JSC | `rawFrameNameIdFoldTrim` | 45189256 | 1421012805 | 48.24 | yes | process RSS max 186.77 MiB | `sync-iterable-byte-batches` | no | no | `text-trim-cost-cross-process-diverse-cycle.json` |
| `text-trim-cost-cross-process-diverse-cycle` | Bun/JSC | `withoutTextStrings` | 45189256 | -679247912 | 59.77 | yes | process RSS max 184.84 MiB | `sync-iterable-byte-batches` | no | no | `text-trim-cost-cross-process-diverse-cycle.json` |
| `text-trim-cost-cross-process-diverse-cycle` | Deno/V8 | `rawFrameNameId` | 45189256 | 1421012805 | 53.89 | yes | process RSS max 75.73 MiB | `sync-iterable-byte-batches` | no | no | `text-trim-cost-cross-process-diverse-cycle.json` |
| `text-trim-cost-cross-process-diverse-cycle` | Deno/V8 | `rawFrameNameIdNoTrim` | 45189256 | 1421012805 | 47.40 | yes | process RSS max 87.44 MiB | `sync-iterable-byte-batches` | no | no | `text-trim-cost-cross-process-diverse-cycle.json` |
| `text-trim-cost-cross-process-diverse-cycle` | Deno/V8 | `rawFrameNameIdFoldTrim` | 45189256 | 1421012805 | 45.37 | yes | process RSS max 88.04 MiB | `sync-iterable-byte-batches` | no | no | `text-trim-cost-cross-process-diverse-cycle.json` |
| `text-trim-cost-cross-process-diverse-cycle` | Deno/V8 | `withoutTextStrings` | 45189256 | -679247912 | 64.04 | yes | process RSS max 106.74 MiB | `sync-iterable-byte-batches` | no | no | `text-trim-cost-cross-process-diverse-cycle.json` |
| `cross-process-books-corpus-batch16` | Node/V8 | `stringFull` | 57096514 | -540013997 | 119.66 | yes | process RSS max 67.73 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-cross-process-books-corpus-batch16.json` |
| `cross-process-books-corpus-batch16` | Node/V8 | `eventObjectFull` | 57096514 | -540013997 | 78.90 | yes | process RSS max 132.04 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-cross-process-books-corpus-batch16.json` |
| `cross-process-books-corpus-batch16` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 99.83 | yes | process RSS max 137.17 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-cross-process-books-corpus-batch16.json` |
| `cross-process-books-corpus-batch16` | Bun/JSC | `stringFull` | 57096514 | -540013997 | 123.45 | yes | process RSS max 199.61 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-cross-process-books-corpus-batch16.json` |
| `cross-process-books-corpus-batch16` | Bun/JSC | `eventObjectFull` | 57096514 | -540013997 | 76.71 | yes | process RSS max 198.94 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-cross-process-books-corpus-batch16.json` |
| `cross-process-books-corpus-batch16` | Bun/JSC | `rawFrameNameId` | 57096514 | -540013997 | 92.49 | yes | process RSS max 179.29 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-cross-process-books-corpus-batch16.json` |
| `cross-process-large-asset-corpus` | Node/V8 | `stringFull` | 83635224 | -2136498212 | 130.10 | yes | process RSS max 399.21 MiB | `sync-iterable-byte-batches` | no | yes (100.26 MiB) | `candidate-headroom-cross-process-large-asset-corpus.json` |
| `cross-process-large-asset-corpus` | Node/V8 | `eventObjectFull` | 83635224 | -2136498212 | 105.86 | yes | process RSS max 495.34 MiB | `sync-iterable-byte-batches` | no | yes (100.26 MiB) | `candidate-headroom-cross-process-large-asset-corpus.json` |
| `cross-process-large-asset-corpus` | Node/V8 | `rawFrameNameId` | 83635224 | -2136498212 | 146.11 | yes | process RSS max 495.31 MiB | `sync-iterable-byte-batches` | no | yes (100.26 MiB) | `candidate-headroom-cross-process-large-asset-corpus.json` |
| `cross-process-large-asset-corpus` | Bun/JSC | `stringFull` | 83635224 | -2136498212 | 99.71 | no | process RSS max 1956.69 MiB | `sync-iterable-byte-batches` | no | yes (100.26 MiB) | `candidate-headroom-cross-process-large-asset-corpus.json` |
| `cross-process-large-asset-corpus` | Bun/JSC | `eventObjectFull` | 83635224 | -2136498212 | 62.79 | no | process RSS max 1849.16 MiB | `sync-iterable-byte-batches` | no | yes (100.26 MiB) | `candidate-headroom-cross-process-large-asset-corpus.json` |
| `cross-process-large-asset-corpus` | Bun/JSC | `rawFrameNameId` | 83635224 | -2136498212 | 82.95 | no | process RSS max 1849.75 MiB | `sync-iterable-byte-batches` | no | yes (100.26 MiB) | `candidate-headroom-cross-process-large-asset-corpus.json` |
| `cross-process-midsize-corpus` | Node/V8 | `stringFull` | 78059522 | -34487917 | 86.51 | yes | process RSS max 106.30 MiB | `sync-iterable-byte-batches` | no | yes (13.37 MiB) | `candidate-headroom-cross-process-midsize-corpus.json` |
| `cross-process-midsize-corpus` | Node/V8 | `eventObjectFull` | 78059522 | -34487917 | 61.51 | yes | process RSS max 192.59 MiB | `sync-iterable-byte-batches` | no | yes (13.37 MiB) | `candidate-headroom-cross-process-midsize-corpus.json` |
| `cross-process-midsize-corpus` | Node/V8 | `rawFrameNameId` | 78059522 | -34487917 | 79.06 | yes | process RSS max 192.28 MiB | `sync-iterable-byte-batches` | no | yes (13.37 MiB) | `candidate-headroom-cross-process-midsize-corpus.json` |
| `cross-process-midsize-corpus` | Bun/JSC | `stringFull` | 78059522 | -34487917 | 91.17 | yes | process RSS max 420.17 MiB | `sync-iterable-byte-batches` | no | yes (13.37 MiB) | `candidate-headroom-cross-process-midsize-corpus.json` |
| `cross-process-midsize-corpus` | Bun/JSC | `eventObjectFull` | 78059522 | -34487917 | 61.62 | yes | process RSS max 419.00 MiB | `sync-iterable-byte-batches` | no | yes (13.37 MiB) | `candidate-headroom-cross-process-midsize-corpus.json` |
| `cross-process-midsize-corpus` | Bun/JSC | `rawFrameNameId` | 78059522 | -34487917 | 77.74 | yes | process RSS max 420.55 MiB | `sync-iterable-byte-batches` | no | yes (13.37 MiB) | `candidate-headroom-cross-process-midsize-corpus.json` |
| `deno-cross-process-midsize-corpus` | Deno/V8 | `stringFull` | 78059522 | -34487917 | 85.42 | yes | process RSS max 105.69 MiB | `sync-iterable-byte-batches` | no | yes (13.37 MiB) | `deno-candidate-headroom-cross-process-midsize-corpus.json` |
| `deno-cross-process-midsize-corpus` | Deno/V8 | `eventObjectFull` | 78059522 | -34487917 | 53.77 | yes | process RSS max 170.38 MiB | `sync-iterable-byte-batches` | no | yes (13.37 MiB) | `deno-candidate-headroom-cross-process-midsize-corpus.json` |
| `deno-cross-process-midsize-corpus` | Deno/V8 | `rawFrameNameId` | 78059522 | -34487917 | 72.37 | yes | process RSS max 170.38 MiB | `sync-iterable-byte-batches` | no | yes (13.37 MiB) | `deno-candidate-headroom-cross-process-midsize-corpus.json` |
| `file-backed-batch-size-sweep` | Node/V8 | `stax-stream-batch-1` | 61236571 | -716099804 | 140.55 | yes | process RSS max 60.19 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-batch-size-sweep.json` |
| `file-backed-batch-size-sweep` | Node/V8 | `stax-raw-frame-name-id-batch-1` | 61236571 | -716099804 | 130.09 | yes | process RSS max 60.42 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-batch-size-sweep.json` |
| `file-backed-batch-size-sweep` | Node/V8 | `stax-stream-batch-2` | 61236571 | -716099804 | 139.20 | yes | process RSS max 60.55 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-batch-size-sweep.json` |
| `file-backed-batch-size-sweep` | Node/V8 | `stax-raw-frame-name-id-batch-2` | 61236571 | -716099804 | 130.30 | yes | process RSS max 60.83 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-batch-size-sweep.json` |
| `file-backed-batch-size-sweep` | Node/V8 | `stax-stream-batch-4` | 61236571 | -716099804 | 140.89 | yes | process RSS max 60.95 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-batch-size-sweep.json` |
| `file-backed-batch-size-sweep` | Node/V8 | `stax-raw-frame-name-id-batch-4` | 61236571 | -716099804 | 130.57 | yes | process RSS max 61.64 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-batch-size-sweep.json` |
| `file-backed-batch-size-sweep` | Node/V8 | `stax-stream-batch-8` | 61236571 | -716099804 | 138.89 | yes | process RSS max 60.25 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-batch-size-sweep.json` |
| `file-backed-batch-size-sweep` | Node/V8 | `stax-raw-frame-name-id-batch-8` | 61236571 | -716099804 | 152.11 | yes | process RSS max 61.77 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-batch-size-sweep.json` |
| `file-backed-batch-size-sweep` | Node/V8 | `stax-stream-batch-16` | 61236571 | -716099804 | 144.45 | yes | process RSS max 95.80 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-batch-size-sweep.json` |
| `file-backed-batch-size-sweep` | Node/V8 | `stax-raw-frame-name-id-batch-16` | 61236571 | -716099804 | 148.07 | yes | process RSS max 63.54 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-batch-size-sweep.json` |
| `file-backed-batch-size-sweep` | Node/V8 | `stax-stream-batch-32` | 61236571 | -716099804 | 136.20 | yes | process RSS max 98.45 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-batch-size-sweep.json` |
| `file-backed-batch-size-sweep` | Node/V8 | `stax-raw-frame-name-id-batch-32` | 61236571 | -716099804 | 148.69 | yes | process RSS max 69.52 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-batch-size-sweep.json` |
| `file-backed-batch-size-sweep` | Node/V8 | `stax-stream-batch-64` | 61236571 | -716099804 | 136.92 | yes | process RSS max 121.50 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-batch-size-sweep.json` |
| `file-backed-batch-size-sweep` | Node/V8 | `stax-raw-frame-name-id-batch-64` | 61236571 | -716099804 | 148.68 | yes | process RSS max 87.03 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-batch-size-sweep.json` |
| `file-backed-source-sweep` | Node/V8 | `stax-stream-chunk-16kib` | 61236571 | -716099804 | 135.59 | yes | process RSS max 59.01 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-source-sweep.json` |
| `file-backed-source-sweep` | Node/V8 | `stax-raw-frame-name-id-chunk-16kib` | 61236571 | -716099804 | 149.22 | yes | process RSS max 59.05 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-source-sweep.json` |
| `file-backed-source-sweep` | Node/V8 | `stax-stream-chunk-32kib` | 61236571 | -716099804 | 139.10 | yes | process RSS max 59.11 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-source-sweep.json` |
| `file-backed-source-sweep` | Node/V8 | `stax-raw-frame-name-id-chunk-32kib` | 61236571 | -716099804 | 151.70 | yes | process RSS max 59.23 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-source-sweep.json` |
| `file-backed-source-sweep` | Node/V8 | `stax-stream-chunk-64kib` | 61236571 | -716099804 | 139.41 | yes | process RSS max 59.74 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-source-sweep.json` |
| `file-backed-source-sweep` | Node/V8 | `stax-raw-frame-name-id-chunk-64kib` | 61236571 | -716099804 | 149.77 | yes | process RSS max 60.63 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-source-sweep.json` |
| `file-backed-source-sweep` | Node/V8 | `stax-stream-chunk-128kib` | 61236571 | -716099804 | 142.74 | yes | process RSS max 80.66 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-source-sweep.json` |
| `file-backed-source-sweep` | Node/V8 | `stax-raw-frame-name-id-chunk-128kib` | 61236571 | -716099804 | 142.12 | yes | process RSS max 62.48 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-source-sweep.json` |
| `file-backed-source-sweep` | Node/V8 | `stax-stream-chunk-256kib` | 61236571 | -716099804 | 138.80 | yes | process RSS max 123.99 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-source-sweep.json` |
| `file-backed-source-sweep` | Node/V8 | `stax-raw-frame-name-id-chunk-256kib` | 61236571 | -716099804 | 148.83 | yes | process RSS max 121.28 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-source-sweep.json` |
| `file-backed-source-sweep` | Node/V8 | `stax-stream-chunk-512kib` | 61236571 | -716099804 | 138.27 | yes | process RSS max 112.02 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-source-sweep.json` |
| `file-backed-source-sweep` | Node/V8 | `stax-raw-frame-name-id-chunk-512kib` | 61236571 | -716099804 | 146.17 | yes | process RSS max 110.47 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `file-backed-source-sweep.json` |

## Allocation Evidence

These rows are evidence about allocation shape, not directly comparable peak memory numbers.

| Runtime | Evidence | Throughput | Events | Checksum | Memory/shape note | Artifact |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Rust/quick-xml | global-allocator-counters | 257.43 | 967967 | -746772258 | allocated 81.38 MiB, net 0.00 MiB; borrowed=854085, owned=0; dominantPhase=attribute-collection 78.19 MiB | `quick-xml-allocation-count.json` |
| Rust/quick-xml | global-allocator-counters-stability | 220.90 | 967967 | -746772258 | allocated 81.38 MiB, net 0.00 MiB; borrowed=854085, owned=0; dominantPhase=attribute-collection 78.19 MiB | `quick-xml-allocation-count-stability.json` |
| Java/Woodstox | jfr-sampled-allocation | 311.86 | 967967 | -746772258 | sampled 3.5 KiB; string-boundary samples=44 | `woodstox-jfr-allocation.json` |
| Java/Woodstox | measured-window-jfr-sampled-allocation | 182.56 | 967967 | -746772258 | sampled 0.7 KiB; string-boundary samples=7 | `woodstox-measured-jfr-allocation.json` |
| Java/Woodstox | measured-window-jfr-sampled-allocation-rerun | 136.56 | 967967 | -746772258 | sampled 0.5 KiB; string-boundary samples=9 | `woodstox-measured-jfr-allocation-rerun.json` |

## Findings

- same-contract-not-same-memory-counter (SOURCE_AGGREGATION): Rows are grouped by semantic checksum contract, while memory counters remain runtime-specific.
  - browser-js-heap
  - browser-js-heap-unavailable
  - process-rss
- large-js-full-memory-frontier-visible (CLASSIFIED): The same 1 GiB+ JavaScript full-string row set used for counterexample scanning is classified by memory metric and bounded-memory status.
  - rows=239
  - boundedRows=222
  - unboundedRows=17
  - fastestBounded=rawFrameNameId@185.50 MiB/s
  - fastestBoundedMemory=process RSS max 60.45 MiB
  - memoryKinds=browser-js-heap,browser-js-heap-unavailable,process-rss
- no-js-200mib-large-full-counterexample-in-aggregated-artifacts (NOT_FOUND_IN_AGGREGATED_ARTIFACTS): The aggregated 1 GiB+ JavaScript full-string rows contain no 200 MiB/s bounded-memory counterexample.
  - jsLargeFullRows=239
  - counterexamples=0
- public-event-object-frontier-below-target (BELOW_TARGET): The fastest bounded 1 GiB+ public event-object row is tracked separately from raw-frame rows.
  - row=eventObjectFull
  - mibPerSec=141.62
  - remainingTo200MiB=58.38
  - remainingToWoodstox90=162.55
- source-shape-not-full-arraybuffer (CLASSIFIED): Recognized 1 GiB+ JavaScript full-string source-mode rows are classified for full XML ArrayBuffer parser input.
  - largeJsFullSourceModeRows=233
  - notFullArrayBufferRows=233
  - fullArrayBufferRows=0
  - unknownArrayBufferRows=0
- external-target-remains-visible (BENCH_FACT): The external baselines keep Woodstox and quick-xml visible as non-JS comparators under the same checksum contract.
  - 16MiB woodstox=303.10 MiB/s
  - 16MiB quick-xml=243.43 MiB/s
  - 16MiB quick-xml/Woodstox=0.80
  - 1024MiB stax-stream=124.62 MiB/s
  - 1024MiB stax-stream/Woodstox=0.37
  - 1024MiB rawFrameNameId=132.54 MiB/s
  - 1024MiB rawFrameNameId/Woodstox=0.39
  - 1024MiB woodstox=337.97 MiB/s
  - 1024MiB quick-xml=270.26 MiB/s
  - same-fixture-fastest-js=stax-raw-frame-name-id-batch-8
  - same-fixture-fastest-js/Woodstox=0.43
  - same-fixture-target-distance-rows=6
  - same-fixture-fastest-js/quick-xml=0.55
  - same-fixture-quick-xml-target-distance-rows=6
  - same-fixture-0.9x-quick-xml-target-met=false
  - same-fixture-fastest-js-rss=61.77 MiB
  - same-fixture-woodstox-rss=312.71 MiB
  - same-fixture-quick-xml-rss=4.78 MiB
  - same-fixture-0.9x-target-met=false
- text-materialization-frontier-visible (HEADROOM_CLASSIFIED): The nearest full-string row, text/CDATA omission headroom, and negative text-materialization candidates remain visible in the aggregate comparison.
  - fastestFull=rawFrameNameId@185.50 MiB/s
  - remainingTo200=14.50 MiB/s
  - requiredSpeedup=1.08x
  - withoutText=withoutTextStrings@252.36 MiB/s
  - withoutTextRowsCrossTarget=4
  - negativeCandidates=27
- source-consumption-frontier-visible (CLASSIFIED): The aggregate comparison links the sync byte-batch baseline, async byte-batch rows, direct ReadableStream rows, and backpressure counters.
  - sync=sync-iterable-byte-batches-batch-8@71.96 MiB/s
  - async=async-iterable-raw-frame-ascii-batch-8@77.56 MiB/s
  - readable=web-readable-stream-raw-frame-ascii-batch-8@76.53 MiB/s
  - readable/sync=1.06x
  - backpressureRows=6/6
  - fullArrayBufferRows=0
- browser-live-fetch-source-visible (CLASSIFIED): Chrome live fetch ReadableStream and grouped async byte-batch rows remain visible separately from prepared corpus-seed replay rows.
  - prepared=eventObjectFull@64.56 MiB/s
  - fetchReadable=fetchReadableStreamFull@9.68 MiB/s
  - fetchAsyncBatch=fetchAsyncByteBatchFull@9.77 MiB/s
  - liveBackpressureRows=2/2
  - liveFullArrayBufferRows=0

## Limits

- Node and Bun rows use process memory counters such as RSS; Chrome browser rows use variant-level `performance.memory` JS heap plus separate Windows process-tree host counters.
- Firefox browser rows currently lack page-exposed JS heap counters; their fresh-browser per-variant Windows host process-tree probes are row-level host evidence, not portable browser RSS or bounded JS heap proof.
- Source-mode values are preserved only when the input artifact records them or an explicit benchmark option identifies the file-backed byte-batch path; older artifacts without source metadata remain `n/a`.
- `Corpus seed replay` means the benchmark prepared a smaller corpus byte seed and replayed it through `Iterable<Uint8Array[]>`; it is distinct from passing one complete 1 GiB XML ArrayBuffer to the parser.
- Woodstox JFR rows are sampled allocation evidence, and quick-xml rows are global allocator traffic evidence. Neither is peak RSS.
- The fastest aggregated JS row and the 1024 MiB Woodstox reference can come from different corpus fixtures; the ratio is a target-distance reference, not an identical-input speed comparison.
- This report aggregates existing artifacts only. It is not a Safari browser row, not a codegen trace, and not proof that JavaScript runtimes have no remaining headroom.
