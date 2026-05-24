# TextDecoder Span Variant Matrix

Generated: 2026-05-24T16:05:40.092Z

This experiment compares browser-compatible `Uint8Array` + `TextDecoder` span materialization variants under the same full-string checksum contract.
Every row folds event type, element names, text/CDATA, attribute names, and attribute values.
It does not use Node `Buffer.toString()`, does not use native addons, and does not use lazy getters.
It is a counterexample search, not a proof that JavaScript runtimes have no further headroom.
Any 200 MiB/s+ bounded-memory full-string row remains a counterexample to the broad runtime-limit claim.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Deno 2.7.13, V8 14.7.173.20-rusty
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
| subarraySharedDecoder | Uint8Array.subarray | per-run-shared | no | no | 50.65 MiB/s | yes | not-found | 45189256 | 1421012805 |
| viewSharedDecoder | Uint8Array constructor view | per-run-shared | no | no | 50.66 MiB/s | yes | not-found | 45189256 | 1421012805 |
| sliceCopySharedDecoder | Uint8Array copy | per-run-shared | yes | no | 22.23 MiB/s | yes | not-found | 45189256 | 1421012805 |
| subarrayNewDecoder | Uint8Array.subarray | per-span-new | no | no | 31.01 MiB/s | yes | not-found | 45189256 | 1421012805 |
| shortAsciiSubarraySharedDecoder | Uint8Array.subarray | per-run-shared | no | yes | 87.97 MiB/s | yes | not-found | 45189256 | 1421012805 |

## Parity

- Full-string parity rows: ok
- Event count parity rows: ok
- Shared events: 45189256
- Shared checksum: 1421012805

## Memory

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| subarraySharedDecoder | +2.6 MiB | +11.1 MiB | 14.3 MiB | 72.1 MiB |
| viewSharedDecoder | -1.5 MiB | +940.0 KiB | 14.3 MiB | 73.1 MiB |
| sliceCopySharedDecoder | +2.5 MiB | +14.0 MiB | 15.3 MiB | 87.1 MiB |
| subarrayNewDecoder | -617.3 KiB | -1.6 MiB | 15.3 MiB | 87.1 MiB |
| shortAsciiSubarraySharedDecoder | +5.1 MiB | +1.7 MiB | 19.8 MiB | 87.2 MiB |

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
- textdecoder-variants-are-headroom-search (BENCH_FACT): Fastest row in this run was shortAsciiSubarraySharedDecoder at 87.97 MiB/s; this is a decode-span headroom search, not an impossibility proof.
- runtime-limit-still-unproven (HYPOTHESIS): No 200 MiB/s+ bounded-memory 1 GiB+ full-string row was found in this TextDecoder span matrix, but absence in this matrix is not a proof that JavaScript runtimes have no further headroom.
- no-buffer-native-or-lazy-getter-path (SOURCE_FACT): Rows use Uint8Array plus TextDecoder only; they do not use Node Buffer.toString(), native addons, or lazy getters.
- fixture-scope (BENCH_FACT): Fixture is generated 1.00 GiB diverse-cycle; broaden corpus/runtime coverage before drawing global conclusions.

## Interpretation

- Fastest row: shortAsciiSubarraySharedDecoder at 87.97 MiB/s.
- A slow row only rejects that decode strategy under this fixture/runtime; it does not reject all JS runtime headroom.
- A fast partial or selected-field row from another matrix is still narrower headroom evidence, not a full StAX materialization result.
