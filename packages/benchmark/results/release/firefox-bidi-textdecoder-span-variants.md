# Browser TextDecoder Span Variant Matrix

Generated: 2026-05-24T05:51:00.539Z

This experiment compares browser-compatible `Uint8Array` + `TextDecoder` span materialization variants under the same full-string checksum contract.
Every row folds event type, element names, text/CDATA, attribute names, and attribute values.
It does not use Node `Buffer.toString()`, does not use native addons, and does not use lazy getters.
Variant browser JS heap counters are unavailable in this engine. Host process-tree memory is reported separately when available.
It is a counterexample search, not a proof that JavaScript runtimes have no further headroom.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Firefox 143.0 / browser SpiderMonkey
- Fixture source: generated
- Generated size: 1.00 GiB (1073742038 bytes)
- Fixture shape: diverse-cycle
- Row cycle size: 4096
- Batch size: 16
- Runs: warmups=0, runs=1
- Bounded JS heap reporting gate: 512.0 MiB

## Results

| Variant | Span view | Decoder lifetime | Copy span bytes | Manual short ASCII | Throughput | Bounded JS heap | Counterexample | Events | Checksum |
| --- | --- | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| subarraySharedDecoder | Uint8Array.subarray | per-run-shared | no | no | 35.08 MiB/s | no | not-found | 45189256 | 1421012805 |
| viewSharedDecoder | Uint8Array constructor view | per-run-shared | no | no | 35.19 MiB/s | no | not-found | 45189256 | 1421012805 |
| sliceCopySharedDecoder | Uint8Array copy | per-run-shared | yes | no | 30.43 MiB/s | no | not-found | 45189256 | 1421012805 |
| subarrayNewDecoder | Uint8Array.subarray | per-span-new | no | no | 17.16 MiB/s | no | not-found | 45189256 | 1421012805 |
| shortAsciiSubarraySharedDecoder | Uint8Array.subarray | per-run-shared | no | yes | 46.28 MiB/s | no | not-found | 45189256 | 1421012805 |

## Parity

- Full-string parity rows: ok
- Event count parity rows: ok
- Shared events: 45189256
- Shared checksum: 1421012805

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
- Max working set: 1014.6 MiB
- Max private bytes: 844.2 MiB
- Max process count: 12

## Materialization Counters

| Variant | String fields | Raw spans | TextDecoder calls | New TextDecoder instances | Short ASCII hits | Copied spans | Copied bytes | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| subarraySharedDecoder | 102,702,850 | 102,702,850 | 102,702,850 | 0 | 0 | 0 | 0 B | 28,756,798 |
| viewSharedDecoder | 102,702,850 | 102,702,850 | 102,702,850 | 0 | 0 | 0 | 0 B | 28,756,798 |
| sliceCopySharedDecoder | 102,702,850 | 102,702,850 | 102,702,850 | 0 | 0 | 102,702,850 | 835.9 MiB | 28,756,798 |
| subarrayNewDecoder | 102,702,850 | 102,702,850 | 102,702,850 | 102,702,850 | 0 | 0 | 0 B | 28,756,798 |
| shortAsciiSubarraySharedDecoder | 102,702,850 | 102,702,850 | 12,215,015 | 0 | 90,487,835 | 0 | 0 B | 28,756,798 |

## Findings

- same-full-string-contract (BENCH_FACT): All browser TextDecoder variants fold event type, names, text/CDATA, attribute names, and attribute values into the same checksum.
- browser-textdecoder-variants-are-headroom-search (BENCH_FACT): Fastest browser row in this run was shortAsciiSubarraySharedDecoder at 46.28 MiB/s; this is a decode-span headroom search, not an impossibility proof.
- browser-memory-scope (BENCH_FACT): Variant memory scope is browser JS heap unavailable; host process memory is separate (windows-process-tree).
- runtime-limit-still-unproven (HYPOTHESIS): No 200 MiB/s+ bounded-memory 1 GiB+ full-string browser row was found in this matrix, but absence in this matrix is not a proof that JavaScript runtimes have no further headroom.
- no-buffer-native-or-lazy-getter-path (SOURCE_FACT): Rows use browser Uint8Array plus TextDecoder only; they do not use Node Buffer.toString(), native addons, or lazy getters.
- fixture-scope (BENCH_FACT): Fixture is generated 1.00 GiB diverse-cycle; broaden browser engines and corpus coverage before drawing global conclusions.

## Interpretation

- Fastest row: shortAsciiSubarraySharedDecoder at 46.28 MiB/s.
- A slow row only rejects that decode strategy under this browser build and fixture; it does not reject all JS runtime headroom.
- Browser JS heap and host process-tree memory are different counters and must not be mixed as a single RSS proof.

## Firefox BiDi Notes

- Automation: WebDriver BiDi
- Browser: Firefox 143.0
- Engine: SpiderMonkey
- This path does not use Playwright, Selenium, CDP, Node `Buffer.toString()`, native addons, or lazy getters.
- Firefox does not expose Chromium `performance.memory`; browser JS heap values are unavailable and host process-tree memory is not portable browser RSS or bounded JS heap proof.
