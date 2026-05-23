# TextDecoder Span Variant Matrix

Generated: 2026-05-23T23:14:36.180Z

This experiment compares browser-compatible `Uint8Array` + `TextDecoder` span materialization variants over corpus-backed `Uint8Array` batches under the same full-string checksum contract.
Every row folds event type, element names, text/CDATA, attribute names, and attribute values.
It does not use Node `Buffer.toString()`, does not use native addons, and does not use lazy getters.
It is a counterexample search, not a proof that JavaScript runtimes have no further headroom.
Any 200 MiB/s+ bounded-memory full-string row remains a counterexample to the broad runtime-limit claim.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Bun 1.3.13, JavaScriptCore WebKit 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
- Fixture source: corpus-file
- Source file: G:\programming\stax-xml\packages\stax-xml\performance\samples\treebank_e.xml
- Generated size: 1.00 GiB (1074787404 bytes)
- Fixture shape: corpus-cycle
- Row cycle size: 1
- Batch size: 1
- Runs: warmups=0, runs=1
- Bounded RSS reporting gate: 512.0 MiB

## Results

| Variant | Span view | Decoder lifetime | Copy span bytes | Manual short ASCII | Throughput | Bounded memory | Counterexample | Events | Checksum |
| --- | --- | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| subarraySharedDecoder | Uint8Array.subarray | per-run-shared | no | no | 56.18 MiB/s | no | not-found | 75206126 | -925527041 |
| viewSharedDecoder | Uint8Array constructor view | per-run-shared | no | no | 47.35 MiB/s | no | not-found | 75206126 | -925527041 |
| sliceCopySharedDecoder | Uint8Array copy | per-run-shared | yes | no | 43.79 MiB/s | no | not-found | 75206126 | -925527041 |
| subarrayNewDecoder | Uint8Array.subarray | per-span-new | no | no | 31.31 MiB/s | no | not-found | 75206126 | -925527041 |
| shortAsciiSubarraySharedDecoder | Uint8Array.subarray | per-run-shared | no | yes | 63.93 MiB/s | no | not-found | 75206126 | -925527041 |

## Parity

- Full-string parity rows: ok
- Event count parity rows: ok
- Shared events: 75206126
- Shared checksum: -925527041

## Memory

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| subarraySharedDecoder | +179.0 MiB | +1.12 GiB | 351.1 MiB | 1.41 GiB |
| viewSharedDecoder | +251.1 MiB | +387.5 MiB | 602.3 MiB | 1.79 GiB |
| sliceCopySharedDecoder | -283.4 MiB | +229.6 MiB | 602.3 MiB | 2.02 GiB |
| subarrayNewDecoder | +270.1 MiB | +225.6 MiB | 589.0 MiB | 2.24 GiB |
| shortAsciiSubarraySharedDecoder | -270.1 MiB | +829.7 MiB | 589.0 MiB | 3.05 GiB |

## Materialization Counters

| Variant | String fields | Raw spans | TextDecoder calls | New TextDecoder instances | Short ASCII hits | Copied spans | Copied bytes | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| subarraySharedDecoder | 75,206,148 | 75,206,148 | 75,206,148 | 0 | 0 | 0 | 0 B | 12 |
| viewSharedDecoder | 75,206,148 | 75,206,148 | 75,206,148 | 0 | 0 | 0 | 0 B | 12 |
| sliceCopySharedDecoder | 75,206,148 | 75,206,148 | 75,206,148 | 0 | 0 | 75,206,148 | 540.6 MiB | 12 |
| subarrayNewDecoder | 75,206,148 | 75,206,148 | 75,206,148 | 75,206,148 | 0 | 0 | 0 B | 12 |
| shortAsciiSubarraySharedDecoder | 75,206,148 | 75,206,148 | 16,870,380 | 0 | 58,335,768 | 0 | 0 B | 12 |

## Findings

- same-full-string-contract (BENCH_FACT): All TextDecoder variants fold event type, names, text/CDATA, attribute names, and attribute values into the same checksum.
- textdecoder-variants-are-headroom-search (BENCH_FACT): Fastest row in this run was shortAsciiSubarraySharedDecoder at 63.93 MiB/s; this is a decode-span headroom search, not an impossibility proof.
- runtime-limit-still-unproven (HYPOTHESIS): No 200 MiB/s+ bounded-memory 1 GiB+ full-string row was found in this TextDecoder span matrix, but absence in this matrix is not a proof that JavaScript runtimes have no further headroom.
- no-buffer-native-or-lazy-getter-path (SOURCE_FACT): Rows use Uint8Array plus TextDecoder only; they do not use Node Buffer.toString(), native addons, or lazy getters.
- fixture-scope (BENCH_FACT): Fixture is corpus-backed 1.00 GiB corpus-cycle; broaden corpus/runtime coverage before drawing global conclusions.
- corpus-cycle-fixture (BENCH_FACT): The fixture repeats a real XML corpus seed as byte batches rather than synthesized element rows.

## Interpretation

- Fastest row: shortAsciiSubarraySharedDecoder at 63.93 MiB/s.
- A slow row only rejects that decode strategy under this fixture/runtime; it does not reject all JS runtime headroom.
- A fast partial or selected-field row from another matrix is still narrower headroom evidence, not a full StAX materialization result.
