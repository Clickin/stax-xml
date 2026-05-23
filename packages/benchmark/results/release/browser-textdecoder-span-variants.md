# Browser TextDecoder Span Variant Matrix

Generated: 2026-05-23T23:06:12.642Z

This experiment compares browser-compatible `Uint8Array` + `TextDecoder` span materialization variants under the same full-string checksum contract.
Every row folds event type, element names, text/CDATA, attribute names, and attribute values.
It does not use Node `Buffer.toString()`, does not use native addons, and does not use lazy getters.
Variant memory uses browser JS heap. Host process-tree memory is reported separately when available.
It is a counterexample search, not a proof that JavaScript runtimes have no further headroom.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Chrome 148.0.0.0 / browser V8
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
| subarraySharedDecoder | Uint8Array.subarray | per-run-shared | no | no | 16.63 MiB/s | yes | not-found | 45189256 | 1421012805 |
| viewSharedDecoder | Uint8Array constructor view | per-run-shared | no | no | 16.19 MiB/s | yes | not-found | 45189256 | 1421012805 |
| sliceCopySharedDecoder | Uint8Array copy | per-run-shared | yes | no | 16.65 MiB/s | yes | not-found | 45189256 | 1421012805 |
| subarrayNewDecoder | Uint8Array.subarray | per-span-new | no | no | 6.80 MiB/s | yes | not-found | 45189256 | 1421012805 |
| shortAsciiSubarraySharedDecoder | Uint8Array.subarray | per-run-shared | no | yes | 39.42 MiB/s | yes | not-found | 45189256 | 1421012805 |

## Parity

- Full-string parity rows: ok
- Event count parity rows: ok
- Shared events: 45189256
- Shared checksum: 1421012805

## Memory

Memory uses Chromium `performance.memory` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg used heap delta | Max used heap | Max total heap | JS heap limit |
| --- | ---: | ---: | ---: | ---: |
| subarraySharedDecoder | +1.3 MiB | 9.8 MiB | 18.4 MiB | 4.00 GiB |
| viewSharedDecoder | +5.6 MiB | 13.1 MiB | 26.3 MiB | 4.00 GiB |
| sliceCopySharedDecoder | +8.3 MiB | 15.9 MiB | 26.1 MiB | 4.00 GiB |
| subarrayNewDecoder | +3.7 MiB | 11.2 MiB | 42.0 MiB | 4.00 GiB |
| shortAsciiSubarraySharedDecoder | +2.5 MiB | 10.0 MiB | 42.2 MiB | 4.00 GiB |

## Host Process Memory

Windows Win32_Process process tree rooted at the browser pid. Working set and private bytes are host OS counters, not portable browser RSS, and are not variant-level JS heap measurements.

- Scope: windows-process-tree
- Max working set: 480.0 MiB
- Max private bytes: 240.4 MiB
- Max process count: 10

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
- browser-textdecoder-variants-are-headroom-search (BENCH_FACT): Fastest browser row in this run was shortAsciiSubarraySharedDecoder at 39.42 MiB/s; this is a decode-span headroom search, not an impossibility proof.
- browser-memory-scope (BENCH_FACT): Variant memory is browser JS heap only; host process memory is separate (windows-process-tree).
- runtime-limit-still-unproven (HYPOTHESIS): No 200 MiB/s+ bounded-memory 1 GiB+ full-string browser row was found in this matrix, but absence in this matrix is not a proof that JavaScript runtimes have no further headroom.
- no-buffer-native-or-lazy-getter-path (SOURCE_FACT): Rows use browser Uint8Array plus TextDecoder only; they do not use Node Buffer.toString(), native addons, or lazy getters.
- fixture-scope (BENCH_FACT): Fixture is generated 1.00 GiB diverse-cycle; broaden browser engines and corpus coverage before drawing global conclusions.

## Interpretation

- Fastest row: shortAsciiSubarraySharedDecoder at 39.42 MiB/s.
- A slow row only rejects that decode strategy under this browser build and fixture; it does not reject all JS runtime headroom.
- Browser JS heap and host process-tree memory are different counters and must not be mixed as a single RSS proof.
