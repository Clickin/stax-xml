# Same-Contract Runtime Comparison

Generated: 2026-05-26T06:42:50.210Z

This report aggregates existing release artifacts. It compares rows only through the same full-string checksum contract; it does not assert identical object shape, identical allocation models, or a JavaScript runtime ceiling.

## Summary

- Aggregated rows: 156
- 1 GiB+ JavaScript full-string rows: 139
- 200 MiB/s+ bounded-memory JavaScript counterexamples found: 0
- Fastest aggregated 1 GiB+ JS full-string row: Node/V8 rawFrameNameId at 185.50 MiB/s (process RSS max 60.45 MiB)
- Fastest JS full-string row vs 200 MiB/s: 0.93x, 14.50 MiB/s remaining
- Fastest JS full-string row vs 1024 MiB Woodstox reference: 0.97x Woodstox, -13.85 MiB/s below 0.9x reference target
- Same-fixture 1024 MiB JS row vs Woodstox target: stax-raw-frame-name-id-batch-8 at 0.43x Woodstox, 164.29 MiB/s below 0.9x target
- Same-fixture 1024 MiB process RSS snapshot: JS 61.77 MiB, Woodstox 312.71 MiB, quick-xml 4.78 MiB
- Fastest 1 GiB+ JS public event-object row: Node/V8 eventObjectFull at 141.62 MiB/s (process RSS max 203.27 MiB)
- Fastest bounded 1 GiB+ JS public event-object row: Node/V8 eventObjectFull at 141.62 MiB/s (process RSS max 203.27 MiB)
- 16 MiB Woodstox baseline: 303.10 MiB/s
- 16 MiB quick-xml baseline: 243.43 MiB/s (0.80x Woodstox)
- 1024 MiB file-backed stax-stream baseline: 72.72 MiB/s (0.38x Woodstox)
- 1024 MiB file-backed rawFrameNameId baseline: 76.13 MiB/s (0.40x Woodstox)
- 1024 MiB Woodstox baseline: 190.72 MiB/s
- 1024 MiB quick-xml baseline: 150.24 MiB/s (0.79x Woodstox)
- Recognized JS source modes: file-backed-sync-iterable-byte-batches, sync-iterable-byte-batches
- 1 GiB+ JS full-string source-mode rows not using full ArrayBuffer parser input: 133/133
- 1 GiB+ source-mode rows replaying a corpus seed buffer: 63 (max seed 100.26 MiB, max seed/target 0.09)

## Fastest JS Rows By Group

| Group | Runtime | Case | MiB/s | Bounded | Memory | Source mode | Full ArrayBuffer input |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| `external-baseline-1024mib-file-sync-batches` | Node/V8 stax-raw-frame-name-id | `stax-raw-frame-name-id` | 76.13 | yes | process RSS max 77.80 MiB | `file-backed-sync-iterable-byte-batches` | no |
| `file-backed-short-attr-value-cache-candidate` | Node/V8 stax-raw-frame-name-id | `stax-raw-frame-name-id` | 147.05 | yes | process RSS max 61.14 MiB | `file-backed-sync-iterable-byte-batches` | no |
| `file-backed-trim-boundary-check-candidate` | Node/V8 stax-raw-frame-name-id | `stax-raw-frame-name-id` | 143.35 | yes | process RSS max 61.40 MiB | `file-backed-sync-iterable-byte-batches` | no |
| `file-backed-long-ascii-text-candidate` | Node/V8 stax-raw-frame-name-id | `stax-raw-frame-name-id` | 141.29 | yes | process RSS max 61.34 MiB | `file-backed-sync-iterable-byte-batches` | no |
| `generated-1gib-candidate` | Bun/JSC | `rawFrameNameId` | 57.99 | yes | process RSS max 192.98 MiB | `sync-iterable-byte-batches` | no |
| `corpus-1gib-candidate` | Node/V8 | `rawFrameNameId` | 77.00 | yes | process RSS max 419.31 MiB | `sync-iterable-byte-batches` | no |
| `projection-1gib-full` | Bun/JSC | `rawFrameNameId` | 84.68 | yes | process RSS max 199.15 MiB | `sync-iterable-byte-batches` | no |
| `generated-1gib-textdecoder` | Node/V8 | `shortAsciiSubarraySharedDecoder` | 51.60 | yes | process RSS max 83.91 MiB | n/a | unknown |
| `books-corpus-stability` | Bun/JSC | `rawFrameNameId` | 178.52 | yes | process RSS max 189.37 MiB | `sync-iterable-byte-batches` | no |
| `text-cache-negative-stability` | Node/V8 | `rawFrameNameId` | 175.02 | yes | process RSS max 71.23 MiB | `sync-iterable-byte-batches` | no |
| `long-ascii-text-negative-stability` | Node/V8 | `rawFrameNameId` | 172.85 | yes | process RSS max 78.00 MiB | `sync-iterable-byte-batches` | no |
| `fold-trimmed-text-negative-stability` | Node/V8 | `rawFrameNameId` | 122.32 | yes | process RSS max 71.22 MiB | `sync-iterable-byte-batches` | no |
| `text-trim-cost-decomposition` | Node/V8 | `rawFrameNameId` | 185.50 | yes | process RSS max 60.45 MiB | `sync-iterable-byte-batches` | no |
| `text-trim-cost-decomposition-2gib` | Node/V8 | `rawFrameNameId` | 184.92 | yes | process RSS max 66.48 MiB | `sync-iterable-byte-batches` | no |
| `text-trim-cost-decomposition-4gib` | Node/V8 | `rawFrameNameId` | 178.86 | yes | process RSS max 66.07 MiB | `sync-iterable-byte-batches` | no |
| `text-trim-cost-decomposition-8gib` | Node/V8 | `rawFrameNameId` | 184.03 | yes | process RSS max 76.94 MiB | `sync-iterable-byte-batches` | no |
| `access-shape-cross-process-books-corpus` | Bun/JSC | `rawFrameNameId` | 177.34 | yes | process RSS max 189.37 MiB | `sync-iterable-byte-batches` | no |
| `cross-process-books-corpus` | Bun/JSC | `stringFull` | 120.18 | yes | process RSS max 190.20 MiB | `sync-iterable-byte-batches` | no |
| `cross-process-books-corpus-batch16` | Bun/JSC | `stringFull` | 123.45 | yes | process RSS max 199.61 MiB | `sync-iterable-byte-batches` | no |
| `cross-process-large-asset-corpus` | Node/V8 | `rawFrameNameId` | 146.11 | yes | process RSS max 495.31 MiB | `sync-iterable-byte-batches` | no |
| `file-backed-batch-size-sweep` | Node/V8 | `stax-raw-frame-name-id-batch-8` | 152.11 | yes | process RSS max 61.77 MiB | `file-backed-sync-iterable-byte-batches` | no |
| `file-backed-source-sweep` | Node/V8 | `stax-raw-frame-name-id-chunk-32kib` | 151.70 | yes | process RSS max 59.23 MiB | `file-backed-sync-iterable-byte-batches` | no |

## Source Shape Safety

| Scope | Rows | Not full ArrayBuffer parser input | Full ArrayBuffer parser input | Unknown parser input | Corpus seed replay rows | Max corpus seed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 GiB+ JS full-string rows with source mode metadata | 133 | 133 | 0 | 0 | 63 | 100.26 MiB |

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
| `external-baseline-1024mib-file-sync-batches` | Node/V8 stax-stream | `stax-stream` | 61236571 | -716099804 | 72.72 | yes | process RSS max 71.78 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `external-baseline-1024mib-file-sync-batches.json` |
| `external-baseline-1024mib-file-sync-batches` | Node/V8 stax-raw-frame-name-id | `stax-raw-frame-name-id` | 61236571 | -716099804 | 76.13 | yes | process RSS max 77.80 MiB | `file-backed-sync-iterable-byte-batches` | no | no | `external-baseline-1024mib-file-sync-batches.json` |
| `external-baseline-1024mib-file-sync-batches` | Java/Woodstox | `woodstox` | 61236571 | -716099804 | 190.72 | yes | process RSS max 308.70 MiB | n/a | unknown | no | `external-baseline-1024mib-file-sync-batches.json` |
| `external-baseline-1024mib-file-sync-batches` | Rust/quick-xml | `quick-xml` | 61236571 | -716099804 | 150.24 | yes | process RSS max 4.78 MiB | n/a | unknown | no | `external-baseline-1024mib-file-sync-batches.json` |
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
| `generated-1gib-candidate` | Chrome/V8 browser | `stringFull` | 45189256 | 1421012805 | 34.46 | yes | JS heap max 14.66 MiB; host working set 522.09 MiB | `sync-iterable-byte-batches` | no | no | `browser-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Chrome/V8 browser | `eventObjectFull` | 45189256 | 1421012805 | 33.10 | yes | JS heap max 38.78 MiB; host working set 522.09 MiB | `sync-iterable-byte-batches` | no | no | `browser-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Chrome/V8 browser | `cursorAccessor` | 45189256 | 1421012805 | 40.05 | yes | JS heap max 42.84 MiB; host working set 522.09 MiB | `sync-iterable-byte-batches` | no | no | `browser-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Chrome/V8 browser | `rawFrameDirect` | 45189256 | 1421012805 | 42.35 | yes | JS heap max 31.70 MiB; host working set 522.09 MiB | `sync-iterable-byte-batches` | no | no | `browser-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Chrome/V8 browser | `rawFrameNameId` | 45189256 | 1421012805 | 43.45 | yes | JS heap max 17.86 MiB; host working set 522.09 MiB | `sync-iterable-byte-batches` | no | no | `browser-candidate-headroom-large.json` |
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
| `long-ascii-text-negative-stability` | Node/V8 | `stringFull` | 57096514 | -540013997 | 148.17 | yes | process RSS max 71.39 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `long-ascii-text-materialization-candidate-stability.json` |
| `long-ascii-text-negative-stability` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 172.85 | yes | process RSS max 78.00 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `long-ascii-text-materialization-candidate-stability.json` |
| `long-ascii-text-negative-stability` | Node/V8 | `rawFrameNameIdLongAsciiText` | 57096514 | -540013997 | 71.21 | yes | process RSS max 102.10 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `long-ascii-text-materialization-candidate-stability.json` |
| `fold-trimmed-text-negative-stability` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 122.32 | yes | process RSS max 71.22 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `fold-trimmed-text-candidate-stability.json` |
| `fold-trimmed-text-negative-stability` | Node/V8 | `rawFrameNameIdFoldTrim` | 57096514 | -540013997 | 103.26 | yes | process RSS max 77.77 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `fold-trimmed-text-candidate-stability.json` |
| `text-trim-cost-decomposition` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 185.50 | yes | process RSS max 60.45 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-decomposition.json` |
| `text-trim-cost-decomposition` | Node/V8 | `rawFrameNameIdFoldTrim` | 57096514 | -540013997 | 148.57 | yes | process RSS max 66.88 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-decomposition.json` |
| `text-trim-cost-decomposition-2gib` | Node/V8 | `rawFrameNameId` | 114192784 | 1903859545 | 184.92 | yes | process RSS max 66.48 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-decomposition-2gib.json` |
| `text-trim-cost-decomposition-2gib` | Node/V8 | `rawFrameNameIdFoldTrim` | 114192784 | 1903859545 | 148.58 | yes | process RSS max 77.16 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-decomposition-2gib.json` |
| `text-trim-cost-decomposition-4gib` | Node/V8 | `rawFrameNameId` | 228385566 | -1067702969 | 178.86 | yes | process RSS max 66.07 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-decomposition-4gib.json` |
| `text-trim-cost-decomposition-8gib` | Node/V8 | `rawFrameNameId` | 456770888 | 734413569 | 184.03 | yes | process RSS max 76.94 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `text-trim-cost-decomposition-8gib.json` |
| `access-shape-cross-process-books-corpus` | Node/V8 | `cursorAccessor` | 57096514 | -540013997 | 161.48 | yes | process RSS max 70.70 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `access-shape-candidate-cross-process.json` |
| `access-shape-cross-process-books-corpus` | Node/V8 | `rawFrameDirect` | 57096514 | -540013997 | 136.98 | yes | process RSS max 71.11 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `access-shape-candidate-cross-process.json` |
| `access-shape-cross-process-books-corpus` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 147.13 | yes | process RSS max 71.84 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `access-shape-candidate-cross-process.json` |
| `access-shape-cross-process-books-corpus` | Bun/JSC | `cursorAccessor` | 57096514 | -540013997 | 167.04 | yes | process RSS max 195.59 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `access-shape-candidate-cross-process.json` |
| `access-shape-cross-process-books-corpus` | Bun/JSC | `rawFrameDirect` | 57096514 | -540013997 | 139.83 | yes | process RSS max 195.54 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `access-shape-candidate-cross-process.json` |
| `access-shape-cross-process-books-corpus` | Bun/JSC | `rawFrameNameId` | 57096514 | -540013997 | 177.34 | yes | process RSS max 189.37 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `access-shape-candidate-cross-process.json` |
| `cross-process-books-corpus` | Node/V8 | `stringFull` | 57096514 | -540013997 | 113.79 | yes | process RSS max 70.73 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-cross-process-books-corpus.json` |
| `cross-process-books-corpus` | Node/V8 | `eventObjectFull` | 57096514 | -540013997 | 72.76 | yes | process RSS max 136.90 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-cross-process-books-corpus.json` |
| `cross-process-books-corpus` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 94.98 | yes | process RSS max 147.60 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-cross-process-books-corpus.json` |
| `cross-process-books-corpus` | Bun/JSC | `stringFull` | 57096514 | -540013997 | 120.18 | yes | process RSS max 190.20 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-cross-process-books-corpus.json` |
| `cross-process-books-corpus` | Bun/JSC | `eventObjectFull` | 57096514 | -540013997 | 76.84 | yes | process RSS max 190.21 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-cross-process-books-corpus.json` |
| `cross-process-books-corpus` | Bun/JSC | `rawFrameNameId` | 57096514 | -540013997 | 97.84 | yes | process RSS max 176.32 MiB | `sync-iterable-byte-batches` | no | yes (0.00 MiB) | `candidate-headroom-cross-process-books-corpus.json` |
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
| Rust/quick-xml | global-allocator-counters | 243.53 | 967967 | -746772258 | allocated 27.13 MiB, net 0.00 MiB; borrowed=284695, owned=0; dominantPhase=attribute-collection 26.06 MiB | `quick-xml-allocation-count.json` |
| Rust/quick-xml | global-allocator-counters-stability | 220.90 | 967967 | -746772258 | allocated 81.38 MiB, net 0.00 MiB; borrowed=854085, owned=0; dominantPhase=attribute-collection 78.19 MiB | `quick-xml-allocation-count-stability.json` |
| Java/Woodstox | jfr-sampled-allocation | 320.27 | 967967 | -746772258 | sampled 3.0 KiB; string-boundary samples=42 | `woodstox-jfr-allocation.json` |
| Java/Woodstox | measured-window-jfr-sampled-allocation | 201.11 | 967967 | -746772258 | sampled 0.5 KiB; string-boundary samples=9 | `woodstox-measured-jfr-allocation.json` |
| Java/Woodstox | measured-window-jfr-sampled-allocation-rerun | 136.56 | 967967 | -746772258 | sampled 0.5 KiB; string-boundary samples=9 | `woodstox-measured-jfr-allocation-rerun.json` |

## Findings

- same-contract-not-same-memory-counter (SOURCE_AGGREGATION): Rows are grouped by semantic checksum contract, while memory counters remain runtime-specific.
  - browser-js-heap
  - browser-js-heap-unavailable
  - process-rss
- no-js-200mib-large-full-counterexample-in-aggregated-artifacts (NOT_FOUND_IN_AGGREGATED_ARTIFACTS): The aggregated 1 GiB+ JavaScript full-string rows contain no 200 MiB/s bounded-memory counterexample.
  - jsLargeFullRows=139
  - counterexamples=0
- source-shape-not-full-arraybuffer (CLASSIFIED): Recognized 1 GiB+ JavaScript full-string source-mode rows are classified for full XML ArrayBuffer parser input.
  - largeJsFullSourceModeRows=133
  - notFullArrayBufferRows=133
  - fullArrayBufferRows=0
  - unknownArrayBufferRows=0
- external-target-remains-visible (BENCH_FACT): The external baselines keep Woodstox and quick-xml visible as non-JS comparators under the same checksum contract.
  - 16MiB woodstox=303.10 MiB/s
  - 16MiB quick-xml=243.43 MiB/s
  - 16MiB quick-xml/Woodstox=0.80
  - 1024MiB stax-stream=72.72 MiB/s
  - 1024MiB stax-stream/Woodstox=0.38
  - 1024MiB rawFrameNameId=76.13 MiB/s
  - 1024MiB rawFrameNameId/Woodstox=0.40
  - 1024MiB woodstox=190.72 MiB/s
  - 1024MiB quick-xml=150.24 MiB/s
  - same-fixture-fastest-js=stax-raw-frame-name-id-batch-8
  - same-fixture-fastest-js/Woodstox=0.43
  - same-fixture-fastest-js-rss=61.77 MiB
  - same-fixture-woodstox-rss=312.71 MiB
  - same-fixture-quick-xml-rss=4.78 MiB
  - same-fixture-0.9x-target-met=false

## Limits

- Node and Bun rows use process memory counters such as RSS; Chrome browser rows use variant-level `performance.memory` JS heap plus separate Windows process-tree host counters.
- Firefox browser rows currently lack page-exposed JS heap counters; their fresh-browser per-variant Windows host process-tree probes are row-level host evidence, not portable browser RSS or bounded JS heap proof.
- Source-mode values are preserved only when the input artifact records them or an explicit benchmark option identifies the file-backed byte-batch path; older artifacts without source metadata remain `n/a`.
- `Corpus seed replay` means the benchmark prepared a smaller corpus byte seed and replayed it through `Iterable<Uint8Array[]>`; it is distinct from passing one complete 1 GiB XML ArrayBuffer to the parser.
- Woodstox JFR rows are sampled allocation evidence, and quick-xml rows are global allocator traffic evidence. Neither is peak RSS.
- The fastest aggregated JS row and the 1024 MiB Woodstox reference can come from different corpus fixtures; the ratio is a target-distance reference, not an identical-input speed comparison.
- This report aggregates existing artifacts only. It is not a Safari browser row, not a codegen trace, and not proof that JavaScript runtimes have no remaining headroom.
