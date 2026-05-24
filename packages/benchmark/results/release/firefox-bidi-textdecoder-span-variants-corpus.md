# Browser TextDecoder Span Variant Matrix

Generated: 2026-05-24T05:53:20.861Z

This experiment compares browser-compatible `Uint8Array` + `TextDecoder` span materialization variants over corpus-backed browser `Uint8Array` batches under the same full-string checksum contract.
Every row folds event type, element names, text/CDATA, attribute names, and attribute values.
It does not use Node `Buffer.toString()`, does not use native addons, and does not use lazy getters.
Variant browser JS heap counters are unavailable in this engine. Host process-tree memory is reported separately when available.
It is a counterexample search, not a proof that JavaScript runtimes have no further headroom.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Firefox 143.0 / browser SpiderMonkey
- Fixture source: corpus-file
- Source file: G:\programming\stax-xml\packages\stax-xml\performance\samples\treebank_e.xml
- Generated size: 1.00 GiB (1074787404 bytes)
- Fixture shape: corpus-cycle
- Row cycle size: 1
- Batch size: 1
- Runs: warmups=0, runs=1
- Bounded JS heap reporting gate: 512.0 MiB

## Results

| Variant | Span view | Decoder lifetime | Copy span bytes | Manual short ASCII | Throughput | Bounded JS heap | Counterexample | Events | Checksum |
| --- | --- | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| subarraySharedDecoder | Uint8Array.subarray | per-run-shared | no | no | 50.48 MiB/s | no | not-found | 75206126 | -925527041 |
| viewSharedDecoder | Uint8Array constructor view | per-run-shared | no | no | 49.61 MiB/s | no | not-found | 75206126 | -925527041 |
| sliceCopySharedDecoder | Uint8Array copy | per-run-shared | yes | no | 42.69 MiB/s | no | not-found | 75206126 | -925527041 |
| subarrayNewDecoder | Uint8Array.subarray | per-span-new | no | no | 26.01 MiB/s | no | not-found | 75206126 | -925527041 |
| shortAsciiSubarraySharedDecoder | Uint8Array.subarray | per-run-shared | no | yes | 68.42 MiB/s | no | not-found | 75206126 | -925527041 |

## Parity

- Full-string parity rows: ok
- Event count parity rows: ok
- Shared events: 75206126
- Shared checksum: -925527041

## Memory

This browser does not expose compatible `performance.memory` JS heap counters to the page. Memory values below are `n/a`; host process-tree memory is reported separately.

| Variant | Avg used heap delta | Max used heap | Max total heap | JS heap limit |
| --- | ---: | ---: | ---: | ---: |
| subarraySharedDecoder | n/a | n/a | n/a | n/a |
| viewSharedDecoder | n/a | n/a | n/a | n/a |
| sliceCopySharedDecoder | n/a | n/a | n/a | n/a |
| subarrayNewDecoder | n/a | n/a | n/a | n/a |
| shortAsciiSubarraySharedDecoder | n/a | n/a | n/a | n/a |

## Host Process Memory

Windows Win32_Process process tree rooted at the browser pid. Working set and private bytes are host OS counters, not portable browser RSS, and are not variant-level JS heap measurements.

- Scope: windows-process-tree
- Max working set: 9.14 GiB
- Max private bytes: 9.15 GiB
- Max process count: 12

## Materialization Counters

| Variant | String fields | Raw spans | TextDecoder calls | New TextDecoder instances | Short ASCII hits | Copied spans | Copied bytes | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| subarraySharedDecoder | 75,206,148 | 75,206,148 | 75,206,148 | 0 | 0 | 0 | 0 B | 12 |
| viewSharedDecoder | 75,206,148 | 75,206,148 | 75,206,148 | 0 | 0 | 0 | 0 B | 12 |
| sliceCopySharedDecoder | 75,206,148 | 75,206,148 | 75,206,148 | 0 | 0 | 75,206,148 | 540.6 MiB | 12 |
| subarrayNewDecoder | 75,206,148 | 75,206,148 | 75,206,148 | 75,206,148 | 0 | 0 | 0 B | 12 |
| shortAsciiSubarraySharedDecoder | 75,206,148 | 75,206,148 | 16,870,380 | 0 | 58,335,768 | 0 | 0 B | 12 |

## Findings

- same-full-string-contract (BENCH_FACT): All browser TextDecoder variants fold event type, names, text/CDATA, attribute names, and attribute values into the same checksum.
- browser-textdecoder-variants-are-headroom-search (BENCH_FACT): Fastest browser row in this run was shortAsciiSubarraySharedDecoder at 68.42 MiB/s; this is a decode-span headroom search, not an impossibility proof.
- browser-memory-scope (BENCH_FACT): Variant memory scope is browser JS heap unavailable; host process memory is separate (windows-process-tree).
- runtime-limit-still-unproven (HYPOTHESIS): No 200 MiB/s+ bounded-memory 1 GiB+ full-string browser row was found in this matrix, but absence in this matrix is not a proof that JavaScript runtimes have no further headroom.
- no-buffer-native-or-lazy-getter-path (SOURCE_FACT): Rows use browser Uint8Array plus TextDecoder only; they do not use Node Buffer.toString(), native addons, or lazy getters.
- fixture-scope (BENCH_FACT): Fixture is corpus-backed 1.00 GiB corpus-cycle; broaden browser engines and corpus coverage before drawing global conclusions.
- corpus-cycle-fixture (BENCH_FACT): The browser fixture repeats a real XML corpus seed as byte batches rather than synthesized element rows.

## Interpretation

- Fastest row: shortAsciiSubarraySharedDecoder at 68.42 MiB/s.
- A slow row only rejects that decode strategy under this browser build and fixture; it does not reject all JS runtime headroom.
- Browser JS heap and host process-tree memory are different counters and must not be mixed as a single RSS proof.

## Firefox BiDi Notes

- Automation: WebDriver BiDi
- Browser: Firefox 143.0
- Engine: SpiderMonkey
- This path does not use Playwright, Selenium, CDP, Node `Buffer.toString()`, native addons, or lazy getters.
- Firefox does not expose Chromium `performance.memory`; browser JS heap values are unavailable and host process-tree memory is not portable browser RSS or bounded JS heap proof.
