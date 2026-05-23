# Browser TextDecoder Span Variant Matrix

Generated: 2026-05-23T23:29:48.678Z

This experiment compares browser-compatible `Uint8Array` + `TextDecoder` span materialization variants over corpus-backed browser `Uint8Array` batches under the same full-string checksum contract.
Every row folds event type, element names, text/CDATA, attribute names, and attribute values.
It does not use Node `Buffer.toString()`, does not use native addons, and does not use lazy getters.
Variant memory uses browser JS heap. Host process-tree memory is reported separately when available.
It is a counterexample search, not a proof that JavaScript runtimes have no further headroom.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Chrome 148.0.0.0 / browser V8
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
| subarraySharedDecoder | Uint8Array.subarray | per-run-shared | no | no | 19.30 MiB/s | yes | not-found | 75206126 | -925527041 |
| viewSharedDecoder | Uint8Array constructor view | per-run-shared | no | no | 18.54 MiB/s | yes | not-found | 75206126 | -925527041 |
| sliceCopySharedDecoder | Uint8Array copy | per-run-shared | yes | no | 19.56 MiB/s | yes | not-found | 75206126 | -925527041 |
| subarrayNewDecoder | Uint8Array.subarray | per-span-new | no | no | 9.67 MiB/s | yes | not-found | 75206126 | -925527041 |
| shortAsciiSubarraySharedDecoder | Uint8Array.subarray | per-run-shared | no | yes | 30.57 MiB/s | yes | not-found | 75206126 | -925527041 |

## Parity

- Full-string parity rows: ok
- Event count parity rows: ok
- Shared events: 75206126
- Shared checksum: -925527041

## Memory

Memory uses Chromium `performance.memory` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg used heap delta | Max used heap | Max total heap | JS heap limit |
| --- | ---: | ---: | ---: | ---: |
| subarraySharedDecoder | +239.4 MiB | 331.7 MiB | 339.0 MiB | 4.00 GiB |
| viewSharedDecoder | +240.4 MiB | 331.8 MiB | 338.5 MiB | 4.00 GiB |
| sliceCopySharedDecoder | +235.7 MiB | 327.2 MiB | 336.0 MiB | 4.00 GiB |
| subarrayNewDecoder | +241.3 MiB | 332.7 MiB | 343.5 MiB | 4.00 GiB |
| shortAsciiSubarraySharedDecoder | +236.5 MiB | 327.9 MiB | 345.0 MiB | 4.00 GiB |

## Host Process Memory

Windows Win32_Process process tree rooted at the browser pid. Working set and private bytes are host OS counters, not portable browser RSS, and are not variant-level JS heap measurements.

- Scope: windows-process-tree
- Max working set: 805.0 MiB
- Max private bytes: 635.0 MiB
- Max process count: 10

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
- browser-textdecoder-variants-are-headroom-search (BENCH_FACT): Fastest browser row in this run was shortAsciiSubarraySharedDecoder at 30.57 MiB/s; this is a decode-span headroom search, not an impossibility proof.
- browser-memory-scope (BENCH_FACT): Variant memory is browser JS heap only; host process memory is separate (windows-process-tree).
- runtime-limit-still-unproven (HYPOTHESIS): No 200 MiB/s+ bounded-memory 1 GiB+ full-string browser row was found in this matrix, but absence in this matrix is not a proof that JavaScript runtimes have no further headroom.
- no-buffer-native-or-lazy-getter-path (SOURCE_FACT): Rows use browser Uint8Array plus TextDecoder only; they do not use Node Buffer.toString(), native addons, or lazy getters.
- fixture-scope (BENCH_FACT): Fixture is corpus-backed 1.00 GiB corpus-cycle; broaden browser engines and corpus coverage before drawing global conclusions.
- corpus-cycle-fixture (BENCH_FACT): The browser fixture repeats a real XML corpus seed as byte batches rather than synthesized element rows.

## Interpretation

- Fastest row: shortAsciiSubarraySharedDecoder at 30.57 MiB/s.
- A slow row only rejects that decode strategy under this browser build and fixture; it does not reject all JS runtime headroom.
- Browser JS heap and host process-tree memory are different counters and must not be mixed as a single RSS proof.
