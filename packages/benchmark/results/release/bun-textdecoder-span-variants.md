# TextDecoder Span Variant Matrix

Generated: 2026-05-23T22:38:13.342Z

This experiment compares browser-compatible `Uint8Array` + `TextDecoder` span materialization variants under the same full-string checksum contract.
Every row folds event type, element names, text/CDATA, attribute names, and attribute values.
It does not use Node `Buffer.toString()`, does not use native addons, and does not use lazy getters.
It is a counterexample search, not a proof that JavaScript runtimes have no further headroom.
Any 200 MiB/s+ bounded-memory full-string row remains a counterexample to the broad runtime-limit claim.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Bun 1.3.13, JavaScriptCore WebKit 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
- Fixture source: generated
- Generated size: 1.00 GiB (1073742038 bytes)
- Fixture shape: diverse-cycle
- Row cycle size: 4096
- Batch size: 16
- Runs: warmups=0, runs=1
- Bounded RSS reporting gate: 512.0 MiB

## Results

| Variant | Span view | Decoder lifetime | Copy span bytes | Manual short ASCII | Throughput | Bounded memory | Counterexample | Events | Checksum |
| --- | --- | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| subarraySharedDecoder | Uint8Array.subarray | per-run-shared | no | no | 40.31 MiB/s | yes | not-found | 45189256 | 1421012805 |
| viewSharedDecoder | Uint8Array constructor view | per-run-shared | no | no | 33.44 MiB/s | yes | not-found | 45189256 | 1421012805 |
| sliceCopySharedDecoder | Uint8Array copy | per-run-shared | yes | no | 30.04 MiB/s | yes | not-found | 45189256 | 1421012805 |
| subarrayNewDecoder | Uint8Array.subarray | per-span-new | no | no | 21.27 MiB/s | yes | not-found | 45189256 | 1421012805 |
| shortAsciiSubarraySharedDecoder | Uint8Array.subarray | per-run-shared | no | yes | 47.67 MiB/s | yes | not-found | 45189256 | 1421012805 |

## Parity

- Full-string parity rows: ok
- Event count parity rows: ok
- Shared events: 45189256
- Shared checksum: 1421012805

## Memory

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| subarraySharedDecoder | +45.2 MiB | +38.7 MiB | 45.4 MiB | 186.3 MiB |
| viewSharedDecoder | -48.7 KiB | +480.0 KiB | 45.4 MiB | 186.8 MiB |
| sliceCopySharedDecoder | +1.8 MiB | -3.4 MiB | 47.1 MiB | 186.8 MiB |
| subarrayNewDecoder | -24.9 MiB | +12.2 MiB | 47.1 MiB | 195.5 MiB |
| shortAsciiSubarraySharedDecoder | +21.5 MiB | +19.7 MiB | 43.7 MiB | 215.2 MiB |

## Materialization Counters

| Variant | String fields | Raw spans | TextDecoder calls | New TextDecoder instances | Short ASCII hits | Copied spans | Copied bytes | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| subarraySharedDecoder | 102,702,850 | 102,702,850 | 102,702,850 | 0 | 0 | 0 | 0 B | 28,756,798 |
| viewSharedDecoder | 102,702,850 | 102,702,850 | 102,702,850 | 0 | 0 | 0 | 0 B | 28,756,798 |
| sliceCopySharedDecoder | 102,702,850 | 102,702,850 | 102,702,850 | 0 | 0 | 102,702,850 | 835.9 MiB | 28,756,798 |
| subarrayNewDecoder | 102,702,850 | 102,702,850 | 102,702,850 | 102,702,850 | 0 | 0 | 0 B | 28,756,798 |
| shortAsciiSubarraySharedDecoder | 102,702,850 | 102,702,850 | 12,215,015 | 0 | 90,487,835 | 0 | 0 B | 28,756,798 |

## Findings

- same-full-string-contract (BENCH_FACT): All TextDecoder variants fold event type, names, text/CDATA, attribute names, and attribute values into the same checksum.
- textdecoder-variants-are-headroom-search (BENCH_FACT): Fastest row in this run was shortAsciiSubarraySharedDecoder at 47.67 MiB/s; this is a decode-span headroom search, not an impossibility proof.
- runtime-limit-still-unproven (HYPOTHESIS): No 200 MiB/s+ bounded-memory 1 GiB+ full-string row was found in this TextDecoder span matrix, but absence in this matrix is not a proof that JavaScript runtimes have no further headroom.
- no-buffer-native-or-lazy-getter-path (SOURCE_FACT): Rows use Uint8Array plus TextDecoder only; they do not use Node Buffer.toString(), native addons, or lazy getters.
- fixture-scope (BENCH_FACT): Fixture is generated 1.00 GiB diverse-cycle; broaden corpus/runtime coverage before drawing global conclusions.

## Interpretation

- Fastest row: shortAsciiSubarraySharedDecoder at 47.67 MiB/s.
- A slow row only rejects that decode strategy under this fixture/runtime; it does not reject all JS runtime headroom.
- A fast partial or selected-field row from another matrix is still narrower headroom evidence, not a full StAX materialization result.
