# Same-Contract Runtime Comparison

Generated: 2026-05-24T05:01:09.105Z

This report aggregates existing release artifacts. It compares rows only through the same full-string checksum contract; it does not assert identical object shape, identical allocation models, or a JavaScript runtime ceiling.

## Summary

- Aggregated rows: 46
- 1 GiB+ JavaScript full-string rows: 42
- 200 MiB/s+ bounded-memory JavaScript counterexamples found: 0
- Fastest aggregated 1 GiB+ JS full-string row: Bun/JSC rawFrameNameId at 84.68 MiB/s (process RSS max 199.15 MiB)
- Fastest 1 GiB+ JS public event-object row: Bun/JSC eventObjectFull at 63.29 MiB/s (process RSS max 182.34 MiB)
- Fastest bounded 1 GiB+ JS public event-object row: Bun/JSC eventObjectFull at 63.29 MiB/s (process RSS max 182.34 MiB)
- 16 MiB Woodstox baseline: 333.43 MiB/s
- 16 MiB quick-xml baseline: 309.82 MiB/s (0.93x Woodstox)

## Fastest JS Rows By Group

| Group | Runtime | Case | MiB/s | Bounded | Memory |
| --- | --- | --- | ---: | --- | --- |
| `generated-1gib-candidate` | Bun/JSC | `rawFrameNameId` | 57.99 | yes | process RSS max 192.98 MiB |
| `corpus-1gib-candidate` | Node/V8 | `rawFrameNameId` | 77.00 | yes | process RSS max 419.31 MiB |
| `projection-1gib-full` | Bun/JSC | `rawFrameNameId` | 84.68 | yes | process RSS max 199.15 MiB |
| `generated-1gib-textdecoder` | Node/V8 | `shortAsciiSubarraySharedDecoder` | 51.60 | yes | process RSS max 83.91 MiB |

## Selected Comparison Rows

| Group | Runtime | Case | Events | Checksum | MiB/s | Bounded | Memory | Artifact |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| `external-baseline-16mib` | Node/V8 stax-stream | `stax-stream` | 967967 | -746772258 | 105.30 | n/a | not-recorded | `external-baseline.json` |
| `external-baseline-16mib` | Node/V8 stax-event | `stax-event` | 967967 | -746772258 | 95.94 | n/a | not-recorded | `external-baseline.json` |
| `external-baseline-16mib` | Java/Woodstox | `woodstox` | 967967 | -746772258 | 333.43 | n/a | not-recorded | `external-baseline.json` |
| `external-baseline-16mib` | Rust/quick-xml | `quick-xml` | 967967 | -746772258 | 309.82 | n/a | not-recorded | `external-baseline.json` |
| `generated-1gib-candidate` | Node/V8 | `stringFull` | 45189256 | 1421012805 | 49.01 | yes | process RSS max 85.56 MiB | `candidate-headroom-large.json` |
| `generated-1gib-candidate` | Node/V8 | `eventObjectFull` | 45189256 | 1421012805 | 39.45 | yes | process RSS max 137.52 MiB | `candidate-headroom-large.json` |
| `generated-1gib-candidate` | Node/V8 | `rawFrameNameId` | 45189256 | 1421012805 | 55.85 | yes | process RSS max 144.54 MiB | `candidate-headroom-large.json` |
| `generated-1gib-candidate` | Bun/JSC | `stringFull` | 45189256 | 1421012805 | 52.93 | yes | process RSS max 188.56 MiB | `bun-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Bun/JSC | `eventObjectFull` | 45189256 | 1421012805 | 37.27 | yes | process RSS max 177.00 MiB | `bun-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Bun/JSC | `rawFrameNameId` | 45189256 | 1421012805 | 57.99 | yes | process RSS max 192.98 MiB | `bun-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Chrome/V8 browser | `stringFull` | 45189256 | 1421012805 | 34.46 | yes | JS heap max 14.66 MiB; host working set 522.09 MiB | `browser-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Chrome/V8 browser | `eventObjectFull` | 45189256 | 1421012805 | 33.10 | yes | JS heap max 38.78 MiB; host working set 522.09 MiB | `browser-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Chrome/V8 browser | `rawFrameNameId` | 45189256 | 1421012805 | 43.45 | yes | JS heap max 17.86 MiB; host working set 522.09 MiB | `browser-candidate-headroom-large.json` |
| `generated-1gib-candidate` | Firefox/SpiderMonkey browser | `stringFull` | 45189256 | 1421012805 | 33.02 | no | browser-js-heap-unavailable; fresh host probe 783.20 MiB | `firefox-bidi-candidate-headroom.json` |
| `generated-1gib-candidate` | Firefox/SpiderMonkey browser | `eventObjectFull` | 45189256 | 1421012805 | 23.31 | no | browser-js-heap-unavailable; fresh host probe 956.18 MiB | `firefox-bidi-candidate-headroom.json` |
| `generated-1gib-candidate` | Firefox/SpiderMonkey browser | `rawFrameNameId` | 45189256 | 1421012805 | 35.02 | no | browser-js-heap-unavailable; fresh host probe 775.57 MiB | `firefox-bidi-candidate-headroom.json` |
| `corpus-1gib-candidate` | Node/V8 | `stringFull` | 75206126 | -925527041 | 62.17 | yes | process RSS max 353.58 MiB | `candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Node/V8 | `eventObjectFull` | 75206126 | -925527041 | 61.80 | yes | process RSS max 419.02 MiB | `candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Node/V8 | `rawFrameNameId` | 75206126 | -925527041 | 77.00 | yes | process RSS max 419.31 MiB | `candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Bun/JSC | `stringFull` | 75206126 | -925527041 | 56.23 | no | process RSS max 1470.83 MiB | `bun-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Bun/JSC | `eventObjectFull` | 75206126 | -925527041 | 62.08 | no | process RSS max 1476.53 MiB | `bun-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Bun/JSC | `rawFrameNameId` | 75206126 | -925527041 | 76.08 | no | process RSS max 1751.13 MiB | `bun-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Chrome/V8 browser | `stringFull` | 75206126 | -925527041 | 30.38 | yes | JS heap max 349.79 MiB; host working set 865.83 MiB | `browser-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Chrome/V8 browser | `eventObjectFull` | 75206126 | -925527041 | 28.92 | yes | JS heap max 358.37 MiB; host working set 865.83 MiB | `browser-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Chrome/V8 browser | `rawFrameNameId` | 75206126 | -925527041 | 29.05 | yes | JS heap max 345.78 MiB; host working set 865.83 MiB | `browser-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Firefox/SpiderMonkey browser | `stringFull` | 75206126 | -925527041 | 44.92 | no | browser-js-heap-unavailable; fresh host probe 1064.98 MiB | `firefox-bidi-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Firefox/SpiderMonkey browser | `eventObjectFull` | 75206126 | -925527041 | 36.27 | no | browser-js-heap-unavailable; fresh host probe 1220.22 MiB | `firefox-bidi-candidate-headroom-corpus.json` |
| `corpus-1gib-candidate` | Firefox/SpiderMonkey browser | `rawFrameNameId` | 75206126 | -925527041 | 48.15 | no | browser-js-heap-unavailable; fresh host probe 1060.55 MiB | `firefox-bidi-candidate-headroom-corpus.json` |
| `projection-1gib-full` | Node/V8 | `stringFull` | 60416563 | 1441552024 | 67.04 | yes | process RSS max 78.53 MiB | `candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Node/V8 | `eventObjectFull` | 60416563 | 1441552024 | 57.67 | yes | process RSS max 135.87 MiB | `candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Node/V8 | `rawFrameNameId` | 60416563 | 1441552024 | 82.91 | yes | process RSS max 145.97 MiB | `candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Bun/JSC | `stringFull` | 60416563 | 1441552024 | 77.04 | yes | process RSS max 214.97 MiB | `bun-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Bun/JSC | `eventObjectFull` | 60416563 | 1441552024 | 63.29 | yes | process RSS max 182.34 MiB | `bun-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Bun/JSC | `rawFrameNameId` | 60416563 | 1441552024 | 84.68 | yes | process RSS max 199.15 MiB | `bun-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Chrome/V8 browser | `stringFull` | 60416563 | 1441552024 | 56.44 | yes | JS heap max 13.82 MiB; host working set 444.27 MiB | `browser-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Chrome/V8 browser | `eventObjectFull` | 60416563 | 1441552024 | 48.12 | yes | JS heap max 15.88 MiB; host working set 444.27 MiB | `browser-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Chrome/V8 browser | `rawFrameNameId` | 60416563 | 1441552024 | 60.32 | yes | JS heap max 30.03 MiB; host working set 444.27 MiB | `browser-candidate-headroom-projection-large.json` |
| `projection-1gib-full` | Firefox/SpiderMonkey browser | `stringFull` | 60416563 | 1441552024 | 61.77 | no | browser-js-heap-unavailable; fresh host probe 673.60 MiB | `firefox-bidi-candidate-headroom-projection.json` |
| `projection-1gib-full` | Firefox/SpiderMonkey browser | `eventObjectFull` | 60416563 | 1441552024 | 52.54 | no | browser-js-heap-unavailable; fresh host probe 724.15 MiB | `firefox-bidi-candidate-headroom-projection.json` |
| `projection-1gib-full` | Firefox/SpiderMonkey browser | `rawFrameNameId` | 60416563 | 1441552024 | 64.24 | no | browser-js-heap-unavailable; fresh host probe 702.56 MiB | `firefox-bidi-candidate-headroom-projection.json` |
| `generated-1gib-textdecoder` | Node/V8 | `subarraySharedDecoder` | 45189256 | 1421012805 | 37.33 | yes | process RSS max 72.16 MiB | `textdecoder-span-variants.json` |
| `generated-1gib-textdecoder` | Node/V8 | `shortAsciiSubarraySharedDecoder` | 45189256 | 1421012805 | 51.60 | yes | process RSS max 83.91 MiB | `textdecoder-span-variants.json` |
| `generated-1gib-textdecoder` | Bun/JSC | `subarraySharedDecoder` | 45189256 | 1421012805 | 40.31 | yes | process RSS max 186.27 MiB | `bun-textdecoder-span-variants.json` |
| `generated-1gib-textdecoder` | Bun/JSC | `shortAsciiSubarraySharedDecoder` | 45189256 | 1421012805 | 47.67 | yes | process RSS max 215.22 MiB | `bun-textdecoder-span-variants.json` |
| `generated-1gib-textdecoder` | Chrome/V8 browser | `subarraySharedDecoder` | 45189256 | 1421012805 | 16.63 | yes | JS heap max 9.77 MiB; host working set 479.99 MiB | `browser-textdecoder-span-variants.json` |
| `generated-1gib-textdecoder` | Chrome/V8 browser | `shortAsciiSubarraySharedDecoder` | 45189256 | 1421012805 | 39.42 | yes | JS heap max 10.04 MiB; host working set 479.99 MiB | `browser-textdecoder-span-variants.json` |

## Allocation Evidence

These rows are evidence about allocation shape, not directly comparable peak memory numbers.

| Runtime | Evidence | Throughput | Events | Checksum | Memory/shape note | Artifact |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Rust/quick-xml | global-allocator-counters | 279.42 | 967967 | -746772258 | allocated 27.13 MiB, net 0.00 MiB; borrowed=284695, owned=0 | `quick-xml-allocation-count.json` |
| Java/Woodstox | jfr-sampled-allocation | 320.27 | 967967 | -746772258 | sampled 3.0 KiB; string-boundary samples=42 | `woodstox-jfr-allocation.json` |
| Java/Woodstox | measured-window-jfr-sampled-allocation | 201.11 | 967967 | -746772258 | sampled 0.5 KiB; string-boundary samples=9 | `woodstox-measured-jfr-allocation.json` |

## Findings

- same-contract-not-same-memory-counter (SOURCE_AGGREGATION): Rows are grouped by semantic checksum contract, while memory counters remain runtime-specific.
  - browser-js-heap
  - browser-js-heap-unavailable
  - not-recorded
  - process-rss
- no-js-200mib-large-full-counterexample-in-aggregated-artifacts (NOT_FOUND_IN_AGGREGATED_ARTIFACTS): The aggregated 1 GiB+ JavaScript full-string rows contain no 200 MiB/s bounded-memory counterexample.
  - jsLargeFullRows=42
  - counterexamples=0
- external-target-remains-visible (BENCH_FACT): The 16 MiB external baseline keeps Woodstox and quick-xml visible as non-JS comparators under the same checksum contract.
  - woodstox=333.43 MiB/s
  - quick-xml=309.82 MiB/s
  - quick-xml/Woodstox=0.93

## Limits

- Node and Bun rows use process memory counters such as RSS; Chrome browser rows use variant-level `performance.memory` JS heap plus separate Windows process-tree host counters.
- Firefox browser rows currently lack page-exposed JS heap counters; their fresh-browser per-variant Windows host process-tree probes are row-level host evidence, not portable browser RSS or bounded JS heap proof.
- Woodstox JFR rows are sampled allocation evidence, and quick-xml rows are global allocator traffic evidence. Neither is peak RSS.
- This report aggregates existing artifacts only. It is not a Safari browser row, not a codegen trace, and not proof that JavaScript runtimes have no remaining headroom.
