# Same-Contract Runtime Comparison

Generated: 2026-05-25T14:42:02.946Z

This report aggregates existing release artifacts. It compares rows only through the same full-string checksum contract; it does not assert identical object shape, identical allocation models, or a JavaScript runtime ceiling.

## Summary

- Aggregated rows: 89
- 1 GiB+ JavaScript full-string rows: 83
- 200 MiB/s+ bounded-memory JavaScript counterexamples found: 0
- Fastest aggregated 1 GiB+ JS full-string row: Bun/JSC rawFrameNameId at 178.52 MiB/s (process RSS max 189.37 MiB)
- Fastest JS full-string row vs 200 MiB/s: 0.89x, 21.48 MiB/s remaining
- Fastest JS full-string row vs 1024 MiB Woodstox reference: 0.56x Woodstox, 109.62 MiB/s below 0.9x reference target
- Fastest 1 GiB+ JS public event-object row: Node/V8 eventObjectFull at 141.62 MiB/s (process RSS max 203.27 MiB)
- Fastest bounded 1 GiB+ JS public event-object row: Node/V8 eventObjectFull at 141.62 MiB/s (process RSS max 203.27 MiB)
- 16 MiB Woodstox baseline: 333.43 MiB/s
- 16 MiB quick-xml baseline: 309.82 MiB/s (0.93x Woodstox)
- 1024 MiB file-backed stax-stream baseline: 108.23 MiB/s (0.34x Woodstox)
- 1024 MiB file-backed rawFrameNameId baseline: 134.39 MiB/s (0.42x Woodstox)
- 1024 MiB Woodstox baseline: 320.16 MiB/s
- 1024 MiB quick-xml baseline: 287.39 MiB/s (0.90x Woodstox)
- Recognized JS source modes: file-backed-sync-iterable-byte-batches, sync-iterable-byte-batches

## Fastest JS Rows By Group

| Group | Runtime | Case | MiB/s | Bounded | Memory | Source mode |
| --- | --- | --- | ---: | --- | --- | --- |
| `external-baseline-1024mib-file-sync-batches` | Node/V8 stax-raw-frame-name-id | `stax-raw-frame-name-id` | 134.39 | yes | process RSS max 77.18 MiB | `file-backed-sync-iterable-byte-batches` |
| `generated-1gib-candidate` | Bun/JSC | `rawFrameNameId` | 57.99 | yes | process RSS max 192.98 MiB | n/a |
| `corpus-1gib-candidate` | Node/V8 | `rawFrameNameId` | 77.00 | yes | process RSS max 419.31 MiB | n/a |
| `projection-1gib-full` | Bun/JSC | `rawFrameNameId` | 84.68 | yes | process RSS max 199.15 MiB | n/a |
| `generated-1gib-textdecoder` | Node/V8 | `shortAsciiSubarraySharedDecoder` | 51.60 | yes | process RSS max 83.91 MiB | n/a |
| `books-corpus-stability` | Bun/JSC | `rawFrameNameId` | 178.52 | yes | process RSS max 189.37 MiB | `sync-iterable-byte-batches` |
| `text-cache-negative-stability` | Node/V8 | `rawFrameNameId` | 175.02 | yes | process RSS max 71.23 MiB | `sync-iterable-byte-batches` |
| `long-ascii-text-negative-stability` | Node/V8 | `rawFrameNameId` | 172.85 | yes | process RSS max 78.00 MiB | `sync-iterable-byte-batches` |
| `fold-trimmed-text-negative-stability` | Node/V8 | `rawFrameNameId` | 122.32 | yes | process RSS max 71.22 MiB | `sync-iterable-byte-batches` |
| `access-shape-cross-process-books-corpus` | Bun/JSC | `rawFrameNameId` | 177.34 | yes | process RSS max 189.37 MiB | `sync-iterable-byte-batches` |
| `cross-process-books-corpus` | Bun/JSC | `stringFull` | 120.18 | yes | process RSS max 190.20 MiB | `sync-iterable-byte-batches` |
| `cross-process-books-corpus-batch16` | Bun/JSC | `stringFull` | 123.45 | yes | process RSS max 199.61 MiB | `sync-iterable-byte-batches` |
| `cross-process-large-asset-corpus` | Node/V8 | `rawFrameNameId` | 146.11 | yes | process RSS max 495.31 MiB | `sync-iterable-byte-batches` |

## Selected Comparison Rows

| Group | Runtime | Case | Events | Checksum | MiB/s | Bounded | Memory | Source mode | Artifact |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| `external-baseline-16mib` | Node/V8 stax-stream | `stax-stream` | 967967 | -746772258 | 105.30 | n/a | not-recorded | n/a | `external-baseline.json` |
| `external-baseline-16mib` | Node/V8 stax-event | `stax-event` | 967967 | -746772258 | 95.94 | n/a | not-recorded | n/a | `external-baseline.json` |
| `external-baseline-16mib` | Java/Woodstox | `woodstox` | 967967 | -746772258 | 333.43 | n/a | not-recorded | n/a | `external-baseline.json` |
| `external-baseline-16mib` | Rust/quick-xml | `quick-xml` | 967967 | -746772258 | 309.82 | n/a | not-recorded | n/a | `external-baseline.json` |
| `external-baseline-1024mib-file-sync-batches` | Node/V8 stax-stream | `stax-stream` | 61236571 | -716099804 | 108.23 | yes | process RSS max 70.85 MiB | `file-backed-sync-iterable-byte-batches` | `external-baseline-1024mib-file-sync-batches.json` |
| `external-baseline-1024mib-file-sync-batches` | Node/V8 stax-raw-frame-name-id | `stax-raw-frame-name-id` | 61236571 | -716099804 | 134.39 | yes | process RSS max 77.18 MiB | `file-backed-sync-iterable-byte-batches` | `external-baseline-1024mib-file-sync-batches.json` |
| `external-baseline-1024mib-file-sync-batches` | Java/Woodstox | `woodstox` | 61236571 | -716099804 | 320.16 | n/a | not-recorded | n/a | `external-baseline-1024mib-file-sync-batches.json` |
| `external-baseline-1024mib-file-sync-batches` | Rust/quick-xml | `quick-xml` | 61236571 | -716099804 | 287.39 | n/a | not-recorded | n/a | `external-baseline-1024mib-file-sync-batches.json` |
| `generated-1gib-candidate` | Node/V8 | `stringFull` | 45189256 | 1421012805 | 49.01 | yes | process RSS max 85.56 MiB | n/a | `candidate-headroom-large.json` |
| `generated-1gib-candidate` | Node/V8 | `eventObjectFull` | 45189256 | 1421012805 | 39.45 | yes | process RSS max 137.52 MiB | n/a | `candidate-headroom-large.json` |
| `generated-1gib-candidate` | Node/V8 | `rawFrameNameId` | 45189256 | 1421012805 | 55.85 | yes | process RSS max 144.54 MiB | n/a | `candidate-headroom-large.json` |
| `generated-1gib-candidate` | Bun/JSC | `stringFull` | 45189256 | 1421012805 | 52.93 | yes | process RSS max 188.56 MiB | n/a | `bun-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Bun/JSC | `eventObjectFull` | 45189256 | 1421012805 | 37.27 | yes | process RSS max 177.00 MiB | n/a | `bun-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Bun/JSC | `rawFrameNameId` | 45189256 | 1421012805 | 57.99 | yes | process RSS max 192.98 MiB | n/a | `bun-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Chrome/V8 browser | `stringFull` | 45189256 | 1421012805 | 34.46 | yes | JS heap max 14.66 MiB; host working set 522.09 MiB | n/a | `browser-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Chrome/V8 browser | `eventObjectFull` | 45189256 | 1421012805 | 33.10 | yes | JS heap max 38.78 MiB; host working set 522.09 MiB | n/a | `browser-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Chrome/V8 browser | `rawFrameNameId` | 45189256 | 1421012805 | 43.45 | yes | JS heap max 17.86 MiB; host working set 522.09 MiB | n/a | `browser-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Firefox/SpiderMonkey browser | `stringFull` | 45189256 | 1421012805 | 33.02 | no | browser-js-heap-unavailable; fresh host probe 783.20 MiB | n/a | `firefox-bidi-candidate-headroom.json` |
| `generated-1gib-candidate` | Firefox/SpiderMonkey browser | `eventObjectFull` | 45189256 | 1421012805 | 23.31 | no | browser-js-heap-unavailable; fresh host probe 956.18 MiB | n/a | `firefox-bidi-candidate-headroom.json` |
| `generated-1gib-candidate` | Firefox/SpiderMonkey browser | `rawFrameNameId` | 45189256 | 1421012805 | 35.02 | no | browser-js-heap-unavailable; fresh host probe 775.57 MiB | n/a | `firefox-bidi-candidate-headroom.json` |
| `corpus-1gib-candidate` | Node/V8 | `stringFull` | 75206126 | -925527041 | 62.17 | yes | process RSS max 353.58 MiB | n/a | `candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Node/V8 | `eventObjectFull` | 75206126 | -925527041 | 61.80 | yes | process RSS max 419.02 MiB | n/a | `candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Node/V8 | `rawFrameNameId` | 75206126 | -925527041 | 77.00 | yes | process RSS max 419.31 MiB | n/a | `candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Bun/JSC | `stringFull` | 75206126 | -925527041 | 56.23 | no | process RSS max 1470.83 MiB | n/a | `bun-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Bun/JSC | `eventObjectFull` | 75206126 | -925527041 | 62.08 | no | process RSS max 1476.53 MiB | n/a | `bun-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Bun/JSC | `rawFrameNameId` | 75206126 | -925527041 | 76.08 | no | process RSS max 1751.13 MiB | n/a | `bun-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Chrome/V8 browser | `stringFull` | 75206126 | -925527041 | 30.38 | yes | JS heap max 349.79 MiB; host working set 865.83 MiB | n/a | `browser-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Chrome/V8 browser | `eventObjectFull` | 75206126 | -925527041 | 28.92 | yes | JS heap max 358.37 MiB; host working set 865.83 MiB | n/a | `browser-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Chrome/V8 browser | `rawFrameNameId` | 75206126 | -925527041 | 29.05 | yes | JS heap max 345.78 MiB; host working set 865.83 MiB | n/a | `browser-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Firefox/SpiderMonkey browser | `stringFull` | 75206126 | -925527041 | 44.92 | no | browser-js-heap-unavailable; fresh host probe 1064.98 MiB | n/a | `firefox-bidi-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Firefox/SpiderMonkey browser | `eventObjectFull` | 75206126 | -925527041 | 36.27 | no | browser-js-heap-unavailable; fresh host probe 1220.22 MiB | n/a | `firefox-bidi-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Firefox/SpiderMonkey browser | `rawFrameNameId` | 75206126 | -925527041 | 48.15 | no | browser-js-heap-unavailable; fresh host probe 1060.55 MiB | n/a | `firefox-bidi-candidate-headroom-corpus.json` |
| `projection-1gib-full` | Node/V8 | `stringFull` | 60416563 | 1441552024 | 67.04 | yes | process RSS max 78.53 MiB | n/a | `candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Node/V8 | `eventObjectFull` | 60416563 | 1441552024 | 57.67 | yes | process RSS max 135.87 MiB | n/a | `candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Node/V8 | `rawFrameNameId` | 60416563 | 1441552024 | 82.91 | yes | process RSS max 145.97 MiB | n/a | `candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Bun/JSC | `stringFull` | 60416563 | 1441552024 | 77.04 | yes | process RSS max 214.97 MiB | n/a | `bun-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Bun/JSC | `eventObjectFull` | 60416563 | 1441552024 | 63.29 | yes | process RSS max 182.34 MiB | n/a | `bun-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Bun/JSC | `rawFrameNameId` | 60416563 | 1441552024 | 84.68 | yes | process RSS max 199.15 MiB | n/a | `bun-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Chrome/V8 browser | `stringFull` | 60416563 | 1441552024 | 56.44 | yes | JS heap max 13.82 MiB; host working set 444.27 MiB | n/a | `browser-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Chrome/V8 browser | `eventObjectFull` | 60416563 | 1441552024 | 48.12 | yes | JS heap max 15.88 MiB; host working set 444.27 MiB | n/a | `browser-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Chrome/V8 browser | `rawFrameNameId` | 60416563 | 1441552024 | 60.32 | yes | JS heap max 30.03 MiB; host working set 444.27 MiB | n/a | `browser-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Firefox/SpiderMonkey browser | `stringFull` | 60416563 | 1441552024 | 61.77 | no | browser-js-heap-unavailable; fresh host probe 673.60 MiB | n/a | `firefox-bidi-candidate-headroom-projection.json` |
| `projection-1gib-full` | Firefox/SpiderMonkey browser | `eventObjectFull` | 60416563 | 1441552024 | 52.54 | no | browser-js-heap-unavailable; fresh host probe 724.15 MiB | n/a | `firefox-bidi-candidate-headroom-projection.json` |
| `projection-1gib-full` | Firefox/SpiderMonkey browser | `rawFrameNameId` | 60416563 | 1441552024 | 64.24 | no | browser-js-heap-unavailable; fresh host probe 702.56 MiB | n/a | `firefox-bidi-candidate-headroom-projection.json` |
| `generated-1gib-textdecoder` | Node/V8 | `subarraySharedDecoder` | 45189256 | 1421012805 | 37.33 | yes | process RSS max 72.16 MiB | n/a | `textdecoder-span-variants.json` |
| `generated-1gib-textdecoder` | Node/V8 | `shortAsciiSubarraySharedDecoder` | 45189256 | 1421012805 | 51.60 | yes | process RSS max 83.91 MiB | n/a | `textdecoder-span-variants.json` |
| `generated-1gib-textdecoder` | Bun/JSC | `subarraySharedDecoder` | 45189256 | 1421012805 | 40.31 | yes | process RSS max 186.27 MiB | n/a | `bun-textdecoder-span-variants.json` |
| `generated-1gib-textdecoder` | Bun/JSC | `shortAsciiSubarraySharedDecoder` | 45189256 | 1421012805 | 47.67 | yes | process RSS max 215.22 MiB | n/a | `bun-textdecoder-span-variants.json` |
| `generated-1gib-textdecoder` | Chrome/V8 browser | `subarraySharedDecoder` | 45189256 | 1421012805 | 16.63 | yes | JS heap max 9.77 MiB; host working set 479.99 MiB | n/a | `browser-textdecoder-span-variants.json` |
| `generated-1gib-textdecoder` | Chrome/V8 browser | `shortAsciiSubarraySharedDecoder` | 45189256 | 1421012805 | 39.42 | yes | JS heap max 10.04 MiB; host working set 479.99 MiB | n/a | `browser-textdecoder-span-variants.json` |
| `books-corpus-stability` | Node/V8 | `stringFull` | 57096514 | -540013997 | 154.29 | yes | process RSS max 66.80 MiB | `sync-iterable-byte-batches` | `candidate-headroom-books-corpus-stability.json` |
| `books-corpus-stability` | Node/V8 | `eventObjectFull` | 57096514 | -540013997 | 141.62 | yes | process RSS max 203.27 MiB | `sync-iterable-byte-batches` | `candidate-headroom-books-corpus-stability.json` |
| `books-corpus-stability` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 176.47 | yes | process RSS max 223.06 MiB | `sync-iterable-byte-batches` | `candidate-headroom-books-corpus-stability.json` |
| `books-corpus-stability` | Node/V8 | `rawFrameStringCache` | 57096514 | -540013997 | 129.28 | yes | process RSS max 226.89 MiB | `sync-iterable-byte-batches` | `candidate-headroom-books-corpus-stability.json` |
| `books-corpus-stability` | Bun/JSC | `stringFull` | 57096514 | -540013997 | 171.35 | yes | process RSS max 204.55 MiB | `sync-iterable-byte-batches` | `bun-candidate-headroom-books-corpus-stability.json` |
| `books-corpus-stability` | Bun/JSC | `eventObjectFull` | 57096514 | -540013997 | 136.44 | yes | process RSS max 199.21 MiB | `sync-iterable-byte-batches` | `bun-candidate-headroom-books-corpus-stability.json` |
| `books-corpus-stability` | Bun/JSC | `rawFrameNameId` | 57096514 | -540013997 | 178.52 | yes | process RSS max 189.37 MiB | `sync-iterable-byte-batches` | `bun-candidate-headroom-books-corpus-stability.json` |
| `books-corpus-stability` | Bun/JSC | `rawFrameStringCache` | 57096514 | -540013997 | 143.20 | yes | process RSS max 184.98 MiB | `sync-iterable-byte-batches` | `bun-candidate-headroom-books-corpus-stability.json` |
| `text-cache-negative-stability` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 175.02 | yes | process RSS max 71.23 MiB | `sync-iterable-byte-batches` | `text-cache-materialization-candidate-stability.json` |
| `text-cache-negative-stability` | Node/V8 | `rawFrameNameIdTextCache` | 57096514 | -540013997 | 129.31 | yes | process RSS max 77.43 MiB | `sync-iterable-byte-batches` | `text-cache-materialization-candidate-stability.json` |
| `long-ascii-text-negative-stability` | Node/V8 | `stringFull` | 57096514 | -540013997 | 148.17 | yes | process RSS max 71.39 MiB | `sync-iterable-byte-batches` | `long-ascii-text-materialization-candidate-stability.json` |
| `long-ascii-text-negative-stability` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 172.85 | yes | process RSS max 78.00 MiB | `sync-iterable-byte-batches` | `long-ascii-text-materialization-candidate-stability.json` |
| `long-ascii-text-negative-stability` | Node/V8 | `rawFrameNameIdLongAsciiText` | 57096514 | -540013997 | 71.21 | yes | process RSS max 102.10 MiB | `sync-iterable-byte-batches` | `long-ascii-text-materialization-candidate-stability.json` |
| `fold-trimmed-text-negative-stability` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 122.32 | yes | process RSS max 71.22 MiB | `sync-iterable-byte-batches` | `fold-trimmed-text-candidate-stability.json` |
| `fold-trimmed-text-negative-stability` | Node/V8 | `rawFrameNameIdFoldTrim` | 57096514 | -540013997 | 103.26 | yes | process RSS max 77.77 MiB | `sync-iterable-byte-batches` | `fold-trimmed-text-candidate-stability.json` |
| `access-shape-cross-process-books-corpus` | Node/V8 | `cursorAccessor` | 57096514 | -540013997 | 161.48 | yes | process RSS max 70.70 MiB | `sync-iterable-byte-batches` | `access-shape-candidate-cross-process.json` |
| `access-shape-cross-process-books-corpus` | Node/V8 | `rawFrameDirect` | 57096514 | -540013997 | 136.98 | yes | process RSS max 71.11 MiB | `sync-iterable-byte-batches` | `access-shape-candidate-cross-process.json` |
| `access-shape-cross-process-books-corpus` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 147.13 | yes | process RSS max 71.84 MiB | `sync-iterable-byte-batches` | `access-shape-candidate-cross-process.json` |
| `access-shape-cross-process-books-corpus` | Bun/JSC | `cursorAccessor` | 57096514 | -540013997 | 167.04 | yes | process RSS max 195.59 MiB | `sync-iterable-byte-batches` | `access-shape-candidate-cross-process.json` |
| `access-shape-cross-process-books-corpus` | Bun/JSC | `rawFrameDirect` | 57096514 | -540013997 | 139.83 | yes | process RSS max 195.54 MiB | `sync-iterable-byte-batches` | `access-shape-candidate-cross-process.json` |
| `access-shape-cross-process-books-corpus` | Bun/JSC | `rawFrameNameId` | 57096514 | -540013997 | 177.34 | yes | process RSS max 189.37 MiB | `sync-iterable-byte-batches` | `access-shape-candidate-cross-process.json` |
| `cross-process-books-corpus` | Node/V8 | `stringFull` | 57096514 | -540013997 | 113.79 | yes | process RSS max 70.73 MiB | `sync-iterable-byte-batches` | `candidate-headroom-cross-process-books-corpus.json` |
| `cross-process-books-corpus` | Node/V8 | `eventObjectFull` | 57096514 | -540013997 | 72.76 | yes | process RSS max 136.90 MiB | `sync-iterable-byte-batches` | `candidate-headroom-cross-process-books-corpus.json` |
| `cross-process-books-corpus` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 94.98 | yes | process RSS max 147.60 MiB | `sync-iterable-byte-batches` | `candidate-headroom-cross-process-books-corpus.json` |
| `cross-process-books-corpus` | Bun/JSC | `stringFull` | 57096514 | -540013997 | 120.18 | yes | process RSS max 190.20 MiB | `sync-iterable-byte-batches` | `candidate-headroom-cross-process-books-corpus.json` |
| `cross-process-books-corpus` | Bun/JSC | `eventObjectFull` | 57096514 | -540013997 | 76.84 | yes | process RSS max 190.21 MiB | `sync-iterable-byte-batches` | `candidate-headroom-cross-process-books-corpus.json` |
| `cross-process-books-corpus` | Bun/JSC | `rawFrameNameId` | 57096514 | -540013997 | 97.84 | yes | process RSS max 176.32 MiB | `sync-iterable-byte-batches` | `candidate-headroom-cross-process-books-corpus.json` |
| `cross-process-books-corpus-batch16` | Node/V8 | `stringFull` | 57096514 | -540013997 | 119.66 | yes | process RSS max 67.73 MiB | `sync-iterable-byte-batches` | `candidate-headroom-cross-process-books-corpus-batch16.json` |
| `cross-process-books-corpus-batch16` | Node/V8 | `eventObjectFull` | 57096514 | -540013997 | 78.90 | yes | process RSS max 132.04 MiB | `sync-iterable-byte-batches` | `candidate-headroom-cross-process-books-corpus-batch16.json` |
| `cross-process-books-corpus-batch16` | Node/V8 | `rawFrameNameId` | 57096514 | -540013997 | 99.83 | yes | process RSS max 137.17 MiB | `sync-iterable-byte-batches` | `candidate-headroom-cross-process-books-corpus-batch16.json` |
| `cross-process-books-corpus-batch16` | Bun/JSC | `stringFull` | 57096514 | -540013997 | 123.45 | yes | process RSS max 199.61 MiB | `sync-iterable-byte-batches` | `candidate-headroom-cross-process-books-corpus-batch16.json` |
| `cross-process-books-corpus-batch16` | Bun/JSC | `eventObjectFull` | 57096514 | -540013997 | 76.71 | yes | process RSS max 198.94 MiB | `sync-iterable-byte-batches` | `candidate-headroom-cross-process-books-corpus-batch16.json` |
| `cross-process-books-corpus-batch16` | Bun/JSC | `rawFrameNameId` | 57096514 | -540013997 | 92.49 | yes | process RSS max 179.29 MiB | `sync-iterable-byte-batches` | `candidate-headroom-cross-process-books-corpus-batch16.json` |
| `cross-process-large-asset-corpus` | Node/V8 | `stringFull` | 83635224 | -2136498212 | 130.10 | yes | process RSS max 399.21 MiB | `sync-iterable-byte-batches` | `candidate-headroom-cross-process-large-asset-corpus.json` |
| `cross-process-large-asset-corpus` | Node/V8 | `eventObjectFull` | 83635224 | -2136498212 | 105.86 | yes | process RSS max 495.34 MiB | `sync-iterable-byte-batches` | `candidate-headroom-cross-process-large-asset-corpus.json` |
| `cross-process-large-asset-corpus` | Node/V8 | `rawFrameNameId` | 83635224 | -2136498212 | 146.11 | yes | process RSS max 495.31 MiB | `sync-iterable-byte-batches` | `candidate-headroom-cross-process-large-asset-corpus.json` |
| `cross-process-large-asset-corpus` | Bun/JSC | `stringFull` | 83635224 | -2136498212 | 99.71 | no | process RSS max 1956.69 MiB | `sync-iterable-byte-batches` | `candidate-headroom-cross-process-large-asset-corpus.json` |
| `cross-process-large-asset-corpus` | Bun/JSC | `eventObjectFull` | 83635224 | -2136498212 | 62.79 | no | process RSS max 1849.16 MiB | `sync-iterable-byte-batches` | `candidate-headroom-cross-process-large-asset-corpus.json` |
| `cross-process-large-asset-corpus` | Bun/JSC | `rawFrameNameId` | 83635224 | -2136498212 | 82.95 | no | process RSS max 1849.75 MiB | `sync-iterable-byte-batches` | `candidate-headroom-cross-process-large-asset-corpus.json` |

## Allocation Evidence

These rows are evidence about allocation shape, not directly comparable peak memory numbers.

| Runtime | Evidence | Throughput | Events | Checksum | Memory/shape note | Artifact |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Rust/quick-xml | global-allocator-counters | 243.53 | 967967 | -746772258 | allocated 27.13 MiB, net 0.00 MiB; borrowed=284695, owned=0; dominantPhase=attribute-collection 26.06 MiB | `quick-xml-allocation-count.json` |
| Java/Woodstox | jfr-sampled-allocation | 320.27 | 967967 | -746772258 | sampled 3.0 KiB; string-boundary samples=42 | `woodstox-jfr-allocation.json` |
| Java/Woodstox | measured-window-jfr-sampled-allocation | 201.11 | 967967 | -746772258 | sampled 0.5 KiB; string-boundary samples=9 | `woodstox-measured-jfr-allocation.json` |

## Findings

- same-contract-not-same-memory-counter (SOURCE_AGGREGATION): Rows are grouped by semantic checksum contract, while memory counters remain runtime-specific.
  - browser-js-heap
  - browser-js-heap-unavailable
  - not-recorded
  - process-rss
- no-js-200mib-large-full-counterexample-in-aggregated-artifacts (NOT_FOUND_IN_AGGREGATED_ARTIFACTS): The aggregated 1 GiB+ JavaScript full-string rows contain no 200 MiB/s bounded-memory counterexample.
  - jsLargeFullRows=83
  - counterexamples=0
- external-target-remains-visible (BENCH_FACT): The external baselines keep Woodstox and quick-xml visible as non-JS comparators under the same checksum contract.
  - 16MiB woodstox=333.43 MiB/s
  - 16MiB quick-xml=309.82 MiB/s
  - 16MiB quick-xml/Woodstox=0.93
  - 1024MiB stax-stream=108.23 MiB/s
  - 1024MiB stax-stream/Woodstox=0.34
  - 1024MiB rawFrameNameId=134.39 MiB/s
  - 1024MiB rawFrameNameId/Woodstox=0.42
  - 1024MiB woodstox=320.16 MiB/s
  - 1024MiB quick-xml=287.39 MiB/s

## Limits

- Node and Bun rows use process memory counters such as RSS; Chrome browser rows use variant-level `performance.memory` JS heap plus separate Windows process-tree host counters.
- Firefox browser rows currently lack page-exposed JS heap counters; their fresh-browser per-variant Windows host process-tree probes are row-level host evidence, not portable browser RSS or bounded JS heap proof.
- Source-mode values are preserved only when the input artifact records them or an explicit benchmark option identifies the file-backed byte-batch path; older artifacts without source metadata remain `n/a`.
- Woodstox JFR rows are sampled allocation evidence, and quick-xml rows are global allocator traffic evidence. Neither is peak RSS.
- The fastest aggregated JS row and the 1024 MiB Woodstox reference can come from different corpus fixtures; the ratio is a target-distance reference, not an identical-input speed comparison.
- This report aggregates existing artifacts only. It is not a Safari browser row, not a codegen trace, and not proof that JavaScript runtimes have no remaining headroom.
